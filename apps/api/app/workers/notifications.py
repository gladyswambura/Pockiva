"""Notification tasks — push (Web Push / VAPID), SMS (Africa's Talking), and Email."""

from __future__ import annotations

import json
import logging
import smtplib
from datetime import UTC, date, datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import africastalking
from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.db import SyncSession
from app.core.models import Account, Device, Loan, NotificationPref, Subscription, User

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Africa's Talking SDK init (lazy — only when a task runs)
# ---------------------------------------------------------------------------

_at_sms = None


def _get_at_sms():
    global _at_sms
    if _at_sms is None:
        africastalking.initialize(settings.at_username, settings.at_api_key)
        _at_sms = africastalking.SMS
    return _at_sms


# ---------------------------------------------------------------------------
# Email helper
# ---------------------------------------------------------------------------

def _send_email(to_email: str, subject: str, html_body: str, text_body: str | None = None) -> None:
    """Send email via SMTP. Requires SMTP_* settings."""
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        log.info("email_skipped_no_smtp to=%s", to_email)
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = to_email
        msg.attach(MIMEText(text_body or html_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
        log.info("email_sent to=%s subject=%s", to_email, subject)
    except Exception as exc:
        log.warning("email_failed to=%s error=%s", to_email, exc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pref_enabled(db: Session, user_id: str, channel: str, topic: str) -> bool:
    pref = db.scalar(
        select(NotificationPref).where(
            NotificationPref.user_id == user_id,
            NotificationPref.channel == channel,
            NotificationPref.topic == topic,
            NotificationPref.enabled.is_(True),
        )
    )
    if not pref:
        return channel == "sms" and topic == "otp"  # OTP always on

    # Quiet hours check (EAT = UTC+3)
    if pref.quiet_hours_start is not None and pref.quiet_hours_end is not None:
        now_hour = (datetime.now(UTC).hour + 3) % 24
        start, end = pref.quiet_hours_start, pref.quiet_hours_end
        in_quiet = (
            start <= now_hour < end if start < end
            else now_hour >= start or now_hour < end
        )
        if in_quiet:
            return False
    return True


def _send_push(db: Session, user_id: str, topic: str, title: str, body: str) -> None:
    if not _pref_enabled(db, user_id, "push", topic):
        return
    devices = db.scalars(
        select(Device).where(Device.user_id == user_id, Device.push_token.isnot(None))
    ).all()
    payload = json.dumps({"title": title, "body": body, "topic": topic})
    for device in devices:
        try:
            webpush(
                subscription_info=json.loads(device.push_token),
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": f"mailto:{settings.vapid_contact_email}"},
            )
        except WebPushException as exc:
            if exc.response and exc.response.status_code in (404, 410):
                # Token expired — remove device
                db.delete(device)
            else:
                log.warning("push_failed device_id=%s error=%s", device.id, exc)


def _send_sms(db: Session, user_id: str, topic: str, message: str) -> None:
    if not _pref_enabled(db, user_id, "sms", topic):
        return
    user = db.get(User, user_id)
    if not user or not user.phone_e164:
        return
    try:
        _get_at_sms().send(message, [user.phone_e164], sender_id=settings.at_sender_id)
    except Exception as exc:
        log.warning("sms_failed user_id=%s error=%s", user_id, exc)


def _send_email_otp(to_email: str, code: str) -> None:
    """Send OTP via email."""
    subject = "Your Pockiva verification code"
    html = f"""
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fbf8f3;border-radius:12px;border:1px solid #e8e0d5;">
      <h1 style="color:#0b2650;margin:0 0 8px;">Your verification code</h1>
      <p style="color:#374151;margin:0 0 16px;">Use this code to sign in to Pockiva:</p>
      <div style="background:#0b2650;color:#fbf8f3;padding:24px;border-radius:8px;text-align:center;font-size:32px;letter-spacing:8px;font-weight:700;font-family:monospace;">{code}</div>
      <p style="color:#6b7280;font-size:14px;margin:16px 0 0;">Valid for {settings.otp_expire_minutes} minutes. If you didn't request this, ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e8e0d5;margin:24px 0;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Pockiva — Your money, in one glance</p>
    </div>
    """
    text = f"Your Pockiva verification code is {code}. Valid for {settings.otp_expire_minutes} minutes."
    _send_email(to_email, subject, html, text)


# ---------------------------------------------------------------------------
# Public helper — send OTP SMS (called from auth module synchronously)
# ---------------------------------------------------------------------------

def send_otp_sms(phone_e164: str, code: str) -> None:
    """Fire-and-forget OTP SMS. Called directly (not via Celery) for low latency."""
    if not settings.at_api_key:
        log.info("otp_sms_skipped_no_key phone=%s", phone_e164)
        return
    try:
        _get_at_sms().send(
            f"Your Pockiva code is {code}. Valid for {settings.otp_expire_minutes} minutes.",
            [phone_e164],
            sender_id=settings.at_sender_id,
        )
    except Exception as exc:
        log.warning("otp_sms_failed phone=%s error=%s", phone_e164, exc)


def send_otp_email(email: str, code: str) -> None:
    """Fire-and-forget OTP email. Called directly for low latency."""
    _send_email_otp(email, code)


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------

@celery_app.task(name="app.workers.notifications.send_payday_reminders", bind=True, max_retries=2)
def send_payday_reminders(self) -> dict:  # type: ignore[override]
    with SyncSession() as db:
        users = db.scalars(select(User).where(User.deleted_at.is_(None))).all()
        sent = 0
        for user in users:
            _send_push(
                db, user.id, "payday_routine",
                "Income routine 🎉",
                "Ready to plan this month's income? Review your envelopes and choose what needs funding.",
            )
            sent += 1
        db.commit()
    return {"sent": sent}


@celery_app.task(name="app.workers.notifications.send_low_envelope_nudges", bind=True, max_retries=2)
def send_low_envelope_nudges(self) -> dict:  # type: ignore[override]
    """Notify users whose envelope balance < 10% of plan and plan > 0."""
    with SyncSession() as db:
        envelopes = db.scalars(
            select(Account).where(
                Account.kind == "envelope",
                Account.archived_at.is_(None),
                Account.plan_cents > 0,
            )
        ).all()
        sent = 0
        for env in envelopes:
            if env.balance_cents < env.plan_cents * 0.10:
                _send_push(
                    db, env.user_id, "low_envelope",
                    "Envelope running low",
                    "One of your envelopes is nearly empty. Check your budget.",
                )
                sent += 1
        db.commit()
    return {"sent": sent}


@celery_app.task(name="app.workers.notifications.send_loan_due_reminders", bind=True, max_retries=2)
def send_loan_due_reminders(self) -> dict:  # type: ignore[override]
    """Remind users of loans due within 3 days."""
    today = date.today()
    in_3 = today + timedelta(days=3)
    with SyncSession() as db:
        loans = db.scalars(
            select(Loan).where(Loan.owed_cents > 0, Loan.due_day.isnot(None))
        ).all()
        sent = 0
        for loan in loans:
            # due_day is day-of-month; check if it falls within next 3 days
            due = date(today.year, today.month, min(loan.due_day, 28))
            if today <= due <= in_3:
                _send_push(
                    db, loan.user_id, "loan_due",
                    "Loan payment due soon",
                    "A loan repayment is due in the next 3 days.",
                )
                sent += 1
        db.commit()
    return {"sent": sent}


@celery_app.task(name="app.workers.notifications.send_savings_lock_reminders", bind=True, max_retries=2)
def send_savings_lock_reminders(self) -> dict:  # type: ignore[override]
    """Remind users whose savings lock ends within 7 days."""
    today = date.today()
    in_7 = today + timedelta(days=7)
    with SyncSession() as db:
        accounts = db.scalars(
            select(Account).where(
                Account.kind == "savings",
                Account.lock_until.isnot(None),
                Account.lock_until <= in_7,
                Account.lock_until >= today,
            )
        ).all()
        sent = 0
        for acc in accounts:
            _send_push(
                db, acc.user_id, "savings_lock_ending",
                "Savings lock ending soon",
                f"Your savings lock ends on {acc.lock_until}.",
            )
            sent += 1
        db.commit()
    return {"sent": sent}


@celery_app.task(name="app.workers.notifications.send_renewal_reminders", bind=True, max_retries=2)
def send_renewal_reminders(self) -> dict:  # type: ignore[override]
    """Remind users whose subscription renews within 3 days."""
    now = datetime.now(UTC)
    in_3 = now + timedelta(days=3)
    with SyncSession() as db:
        subs = db.scalars(
            select(Subscription).where(
                Subscription.status == "active",
                Subscription.current_period_end <= in_3,
                Subscription.current_period_end >= now,
            )
        ).all()
        sent = 0
        for sub in subs:
            _send_push(
                db, sub.user_id, "subscription_renewal",
                "Subscription renewing soon",
                "Your Pockiva Plus subscription renews in 3 days.",
            )
            sent += 1
        db.commit()
    return {"sent": sent}

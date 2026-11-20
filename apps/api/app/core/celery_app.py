from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "pockiva",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.notifications",
        "app.workers.dunning",
        "app.workers.integrity",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Africa/Nairobi",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    # Nightly integrity check at 02:00 EAT
    "nightly-integrity": {
        "task": "app.workers.integrity.check_ledger_invariant",
        "schedule": crontab(hour=2, minute=0),
    },
    # Subscription dunning: check expired subs every hour
    "dunning-hourly": {
        "task": "app.workers.dunning.process_expired_subscriptions",
        "schedule": crontab(minute=5),
    },
    # Payday routine reminder: 08:00 EAT on the 1st of each month
    "payday-reminder": {
        "task": "app.workers.notifications.send_payday_reminders",
        "schedule": crontab(hour=8, minute=0, day_of_month=1),
    },
    # Low-envelope nudge: daily at 09:00 EAT
    "low-envelope-nudge": {
        "task": "app.workers.notifications.send_low_envelope_nudges",
        "schedule": crontab(hour=9, minute=0),
    },
    # Loan due reminder: daily at 08:30 EAT
    "loan-due-reminder": {
        "task": "app.workers.notifications.send_loan_due_reminders",
        "schedule": crontab(hour=8, minute=30),
    },
    # Savings lock ending: daily at 09:00 EAT
    "savings-lock-ending": {
        "task": "app.workers.notifications.send_savings_lock_reminders",
        "schedule": crontab(hour=9, minute=0),
    },
    # Subscription renewal reminder: daily at 10:00 EAT
    "sub-renewal-reminder": {
        "task": "app.workers.notifications.send_renewal_reminders",
        "schedule": crontab(hour=10, minute=0),
    },
}

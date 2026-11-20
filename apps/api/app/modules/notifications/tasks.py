from app.core.celery_app import celery_app


@celery_app.task(name="app.modules.notifications.tasks.nightly_integrity_check")
def nightly_integrity_check() -> None:
    """Placeholder — full implementation in Part 4."""


@celery_app.task(name="app.modules.notifications.tasks.subscription_renewal_reminders")
def subscription_renewal_reminders() -> None:
    """Placeholder — full implementation in Part 4."""

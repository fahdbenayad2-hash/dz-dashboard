from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings


def create_scheduler(sync_service) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="Africa/Algiers")

    scheduler.add_job(
        sync_service.full_sync,
        "interval",
        minutes=settings.sync_interval_minutes,
        id="full_sync",
        replace_existing=True,
    )

    return scheduler

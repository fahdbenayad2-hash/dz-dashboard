from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.scheduler import create_scheduler
from app.db.init_db import init_db
from app.api.routes.orders import router as orders_router
from app.api.routes.tracking import router as tracking_router
from app.api.routes.stats import router as stats_router
from app.services.sync import SyncService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

sync_service = SyncService()
_scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    logger.info("Starting up...")
    await init_db()
    logger.info("Database ready")

    _scheduler = create_scheduler(sync_service)
    _scheduler.start()
    logger.info("Scheduler started")

    try:
        result = await sync_service.full_sync()
        logger.info("Initial sync complete: %s", result)
    except Exception as e:
        logger.error("Initial sync failed: %s", e)

    yield

    if _scheduler:
        _scheduler.shutdown(wait=False)
    logger.info("Shutdown complete")


app = FastAPI(
    title="dz-bot API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders_router)
app.include_router(tracking_router)
app.include_router(stats_router)


@app.get("/health")
async def health():
    from app.db.database import async_session_factory
    from sqlalchemy import text

    db_status = "ok"
    try:
        async with async_session_factory() as db:
            await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {e}"

    return {"status": "ok", "db": db_status}

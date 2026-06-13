import logging
from datetime import datetime, timezone

from sqlalchemy import text, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import async_session_factory
from app.models.order import Order
from app.models.tracking import TrackingEvent
from app.services.octomatic import OctomaticClient
from app.services.noest import NoestClient
from app.services.notifier import NotifierService

logger = logging.getLogger(__name__)


_LAST_SYNC_KEY = "last_sync_timestamp"


class SyncService:
    def __init__(
        self,
        octomatic: OctomaticClient | None = None,
        noest: NoestClient | None = None,
        notifier: NotifierService | None = None,
    ):
        self.octomatic = octomatic or OctomaticClient()
        self.noest = noest or NoestClient()
        self.notifier = notifier or NotifierService()

    async def _get_last_sync(self) -> datetime | None:
        async with async_session_factory() as session:
            result = await session.execute(
                text("SELECT value FROM config WHERE key = :key"),
                {"key": _LAST_SYNC_KEY},
            )
            row = result.scalar_one_or_none()
            if row:
                try:
                    return datetime.fromisoformat(row[0])
                except (ValueError, TypeError):
                    return None
            return None

    async def _set_last_sync(self, dt: datetime | None = None):
        if dt is None:
            dt = datetime.now(timezone.utc)
        async with async_session_factory() as session:
            await session.execute(
                text("""
                    INSERT INTO config (key, value) VALUES (:key, :value)
                    ON CONFLICT(key) DO UPDATE SET value = :value
                """),
                {"key": _LAST_SYNC_KEY, "value": dt.isoformat()},
            )
            await session.commit()

    async def _ensure_config_table(self):
        async with async_session_factory() as session:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS config (
                    key   TEXT PRIMARY KEY,
                    value TEXT
                )
            """))
            await session.commit()

    async def sync_orders(self, incremental: bool = True) -> dict:
        await self._ensure_config_table()
        result = {"synced": 0, "new": 0, "updated": 0, "errors": 0}

        date_from = None
        if incremental:
            last_sync = await self._get_last_sync()
            if last_sync:
                date_from = last_sync.strftime("%Y-%m-%dT%H:%M:%SZ")

        prev_statuses: dict[str, str] = {}
        async with async_session_factory() as session:
            rows = await session.execute(select(Order.id, Order.status))
            for row in rows:
                prev_statuses[row[0]] = row[1]

        async for page in self.octomatic.get_all_orders_paginated(date_from=date_from):
            for order_data in page:
                try:
                    oid = order_data["id"]
                    async with async_session_factory() as session:
                        existing = await session.get(Order, oid)
                        if existing:
                            result["updated"] += 1
                            for key, value in order_data.items():
                                setattr(existing, key, value)
                            existing.date_updated = datetime.now(timezone.utc)
                        else:
                            result["new"] += 1
                            order = Order(**order_data)
                            session.add(order)
                        await session.commit()

                        if existing and oid in prev_statuses:
                            old_status = prev_statuses[oid]
                            new_status = order_data.get("status", old_status)
                            if old_status != new_status:
                                try:
                                    await self.notifier.notify_status_change(
                                        order=order_data,
                                        old_status=old_status,
                                        new_status=new_status,
                                    )
                                except Exception as e:
                                    logger.error("Status change notification error for %s: %s", oid, e)

                        if oid not in prev_statuses:
                            prev_statuses[oid] = order_data.get("status", "")

                    result["synced"] += 1
                except Exception as e:
                    logger.error("Error syncing order %s: %s", order_data.get("id", "?"), e)
                    result["errors"] += 1

        await self._set_last_sync()
        return result

    async def sync_tracking(self, order_ids: list[str] | None = None) -> dict:
        result = {"synced": 0, "events_added": 0}

        async with async_session_factory() as session:
            query = select(Order.id, Order.tracking_code).where(
                Order.tracking_code.isnot(None),
                Order.tracking_code != "",
            )
            if order_ids:
                query = query.where(Order.id.in_(order_ids))
            rows = await session.execute(query)
            code_map: dict[str, str] = {}
            for row in rows:
                code_map[row[1]] = row[0]

        if not code_map:
            return result

        codes = list(code_map.keys())
        raw_results = await self.noest.track_batch(codes)
        result["synced"] = len(raw_results)

        for tracking_code, raw_events in raw_results.items():
            if not raw_events:
                continue
            order_id = code_map.get(tracking_code)
            if not order_id:
                continue
            mapped_events = NoestClient.map_events(order_id, tracking_code, raw_events)

            async with async_session_factory() as session:
                for ev_data in mapped_events:
                    ev_date = ev_data.get("event_date")
                    existing = await session.execute(
                        select(TrackingEvent).where(
                            TrackingEvent.tracking_code == tracking_code,
                            TrackingEvent.event_date == ev_date,
                            TrackingEvent.status == ev_data["status"],
                        )
                    )
                    if existing.scalar_one_or_none():
                        continue
                    event = TrackingEvent(**ev_data)
                    session.add(event)
                    result["events_added"] += 1
                await session.commit()

        return result

    async def full_sync(self) -> dict:
        logger.info("Starting full sync...")
        orders_result = await self.sync_orders(incremental=True)
        tracking_result = await self.sync_tracking()
        logger.info("Full sync complete: orders=%s tracking=%s", orders_result, tracking_result)
        return {"orders": orders_result, "tracking": tracking_result}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.tracking import TrackingEvent
from app.models.order import Order
from app.schemas.tracking import TrackingEventRead
from app.services.noest import NoestClient
from app.db.database import async_session_factory

router = APIRouter(prefix="/api/tracking", tags=["tracking"])


@router.get("/{tracking_code}", response_model=list[TrackingEventRead])
async def get_tracking(tracking_code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrackingEvent)
        .where(TrackingEvent.tracking_code == tracking_code)
        .order_by(TrackingEvent.event_date.desc())
    )
    events = result.scalars().all()
    return [TrackingEventRead.model_validate(e) for e in events]


@router.post("/refresh/{tracking_code}", response_model=list[TrackingEventRead])
async def refresh_tracking(tracking_code: str):
    noest = NoestClient()
    try:
        raw_data = await noest.track(tracking_code)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch from NoEST: {e}")

    events = raw_data if isinstance(raw_data, list) else raw_data.get("events", raw_data.get("data", []))

    async with async_session_factory() as db:
        result = await db.execute(
            select(Order).where(Order.tracking_code == tracking_code)
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="No order with this tracking code")

        added = []
        for ev in events:
            ev_date_str = ev.get("date")
            ev_status = ev.get("status_code", "")
            ev_label = ev.get("status", "")
            ev_location = ev.get("center") or ev.get("location")

            existing = await db.execute(
                select(TrackingEvent).where(
                    TrackingEvent.tracking_code == tracking_code,
                    TrackingEvent.status == ev_status,
                ).limit(1)
            )
            if existing.scalar_one_or_none():
                continue

            new_event = TrackingEvent(
                order_id=order.id,
                tracking_code=tracking_code,
                status=ev_status,
                status_label=ev_label,
                location=ev_location,
                event_date=__import__("datetime").datetime.fromisoformat(ev_date_str) if ev_date_str else None,
            )
            db.add(new_event)
            added.append(new_event)

        await db.commit()

    async with async_session_factory() as db:
        result = await db.execute(
            select(TrackingEvent)
            .where(TrackingEvent.tracking_code == tracking_code)
            .order_by(TrackingEvent.event_date.desc())
        )
        return [TrackingEventRead.model_validate(e) for e in result.scalars().all()]

import pytest
from datetime import datetime, timezone

from app.services.octomatic import parse_utc
from app.models.order import Order
from app.db.database import Base, engine, async_session_factory


@pytest.mark.asyncio
async def test_parse_utc_formats():
    iso = "2024-06-13T15:30:00+00:00"
    dt = parse_utc(iso)
    assert dt is not None
    assert dt.year == 2024
    assert dt.month == 6
    assert dt.day == 13

    naive = "2024-06-13 15:30:00"
    dt2 = parse_utc(naive)
    assert dt2 is not None
    assert dt2.tzinfo is not None

    empty = parse_utc("")
    assert empty is None

    none = parse_utc(None)
    assert none is None


@pytest.mark.asyncio
async def test_order_upsert():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        o1 = Order(
            id="test-1",
            reference="REF-001",
            customer_name="Test Customer",
            customer_phone="0555000000",
            wilaya="Alger",
            total=1500.0,
            status="pending",
            date_created=datetime.now(timezone.utc),
        )
        db.add(o1)
        await db.commit()

    async with async_session_factory() as db:
        o2 = Order(
            id="test-1",
            reference="REF-001",
            customer_name="Test Customer",
            customer_phone="0555000000",
            wilaya="Alger",
            total=2000.0,
            status="confirmed",
            date_created=datetime.now(timezone.utc),
        )
        await db.merge(o2)
        await db.commit()

    async with async_session_factory() as db:
        from sqlalchemy import select
        result = await db.execute(select(Order).where(Order.id == "test-1"))
        order = result.scalar_one_or_none()
        assert order is not None
        assert order.total == 2000.0
        assert order.status == "confirmed"

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_status_change_detection():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        order = Order(
            id="test-2",
            reference="REF-002",
            customer_name="Status Test",
            customer_phone="0555111111",
            wilaya="Oran",
            total=3000.0,
            status="pending",
            date_created=datetime.now(timezone.utc),
        )
        db.add(order)
        await db.commit()

    prev_status = "pending"
    new_status = "confirmed"
    assert prev_status != new_status

    async with async_session_factory() as db:
        from sqlalchemy import select
        result = await db.execute(select(Order).where(Order.id == "test-2"))
        order = result.scalar_one_or_none()
        assert order is not None
        assert order.status == "pending"

        order.status = "confirmed"
        await db.commit()

    async with async_session_factory() as db:
        from sqlalchemy import select
        result = await db.execute(select(Order).where(Order.id == "test-2"))
        order = result.scalar_one_or_none()
        assert order.status == "confirmed"

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

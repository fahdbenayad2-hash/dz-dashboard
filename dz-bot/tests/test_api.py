import pytest
from httpx import AsyncClient, ASGITransport

from main import app
from app.db.database import engine, Base


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "db" in data


@pytest.mark.asyncio
async def test_get_orders_empty():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/orders")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 0
        assert "items" in data
        assert "page" in data
        assert "pages" in data

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_get_stats_today():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/stats/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_orders" in data
        assert "revenue_total" in data
        assert "delivery_rate" in data
        assert "top_wilayas" in data

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

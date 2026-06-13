from datetime import date, timedelta
from collections import Counter

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.order import Order
from app.schemas.order import StatsResponse, WilayaStat

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _compute_stats_from_orders(orders: list, target_date: str) -> StatsResponse:
    total = len(orders)
    counts: dict[str, int] = {
        "confirmed": 0, "shipped": 0, "delivered": 0,
        "cancelled": 0, "returned": 0, "pending": 0,
    }
    revenue_total = 0.0
    revenue_delivered = 0.0
    wilaya_counter: Counter = Counter()
    wilaya_revenue: dict[str, float] = {}

    for o in orders:
        status = o.status or "pending"
        if status in counts:
            counts[status] += 1
        else:
            counts["pending"] += 1
        revenue_total += o.total or 0
        if status == "delivered":
            revenue_delivered += o.total or 0
        wilaya_counter[o.wilaya] += 1
        wilaya_revenue[o.wilaya] = wilaya_revenue.get(o.wilaya, 0) + (o.total or 0)

    delivered = counts.get("delivered", 0)
    returned = counts.get("returned", 0)
    cancelled = counts.get("cancelled", 0)
    denominator = delivered + returned + cancelled
    delivery_rate = delivered / denominator if denominator > 0 else 0.0

    top_wilayas = [
        WilayaStat(wilaya=w, count=c, revenue=wilaya_revenue.get(w, 0.0))
        for w, c in wilaya_counter.most_common(10)
    ]

    return StatsResponse(
        date=target_date,
        total_orders=total,
        confirmed=counts.get("confirmed", 0),
        shipped=counts.get("shipped", 0),
        delivered=delivered,
        cancelled=cancelled,
        returned=returned,
        pending=counts.get("pending", 0),
        revenue_total=revenue_total,
        revenue_delivered=revenue_delivered,
        delivery_rate=delivery_rate,
        top_wilayas=top_wilayas,
    )


@router.get("/summary", response_model=StatsResponse)
async def stats_summary(db: AsyncSession = Depends(get_db)):
    today = date.today()
    result = await db.execute(
        select(Order).where(
            func.date(Order.date_created) == today.isoformat()
        )
    )
    orders = result.scalars().all()
    return _compute_stats_from_orders(orders, today.isoformat())


@router.get("/daily", response_model=StatsResponse)
async def stats_daily(target_date: str = Query(default=None), db: AsyncSession = Depends(get_db)):
    if target_date is None:
        target_date = date.today().isoformat()
    try:
        date.fromisoformat(target_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    result = await db.execute(
        select(Order).where(
            func.date(Order.date_created) == target_date
        )
    )
    orders = result.scalars().all()
    return _compute_stats_from_orders(orders, target_date)


@router.get("/range", response_model=list[StatsResponse])
async def stats_range(
    date_from: str = Query(),
    date_to: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    try:
        d_from = date.fromisoformat(date_from)
        d_to = date.fromisoformat(date_to)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    if d_from > d_to:
        raise HTTPException(status_code=400, detail="date_from must be before date_to")

    result = await db.execute(
        select(Order).where(
            func.date(Order.date_created) >= date_from,
            func.date(Order.date_created) <= date_to,
        )
    )
    orders = result.scalars().all()

    daily_map: dict[str, list] = {}
    for o in orders:
        if o.date_created:
            d = o.date_created.strftime("%Y-%m-%d")
            daily_map.setdefault(d, []).append(o)

    results = []
    current = d_from
    while current <= d_to:
        d_str = current.isoformat()
        day_orders = daily_map.get(d_str, [])
        results.append(_compute_stats_from_orders(day_orders, d_str))
        current += timedelta(days=1)

    return results


@router.get("/wilayas")
async def stats_wilayas(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order))
    orders = result.scalars().all()
    wilaya_counter: Counter = Counter()
    wilaya_revenue: dict[str, float] = {}

    for o in orders:
        wilaya_counter[o.wilaya] += 1
        wilaya_revenue[o.wilaya] = wilaya_revenue.get(o.wilaya, 0) + (o.total or 0)

    sorted_wilayas = sorted(
        [{"wilaya": w, "count": c, "revenue": wilaya_revenue.get(w, 0.0)}
         for w, c in wilaya_counter.items()],
        key=lambda x: x["count"],
        reverse=True,
    )
    return sorted_wilayas

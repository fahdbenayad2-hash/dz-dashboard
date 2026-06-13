import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.order import Order
from app.models.tracking import TrackingEvent
from app.schemas.order import OrderRead, OrderListResponse

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("", response_model=OrderListResponse)
async def get_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    status: str | None = None,
    wilaya: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Order).options(selectinload(Order.tracking_events))

    if status:
        statuses = [s.strip() for s in status.split(",")]
        query = query.where(Order.status.in_(statuses))

    if wilaya:
        query = query.where(Order.wilaya.ilike(f"%{wilaya}%"))

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Order.customer_name.ilike(pattern),
                Order.customer_phone.ilike(pattern),
                Order.reference.ilike(pattern),
            )
        )

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from)
            query = query.where(Order.date_created >= dt_from)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format")

    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to)
            query = query.where(Order.date_created <= dt_to)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format")

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Order.date_created.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    orders = result.scalars().all()

    return OrderListResponse(
        items=[OrderRead.model_validate(o) for o in orders],
        total=total,
        page=page,
        pages=max(1, (total + per_page - 1) // per_page),
    )


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(order_id: str, db: AsyncSession = Depends(get_db)):
    query = select(Order).options(selectinload(Order.tracking_events)).where(Order.id == order_id)
    result = await db.execute(query)
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderRead.model_validate(order)


@router.get("/export")
async def export_orders(
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Order).options(selectinload(Order.tracking_events))

    if status:
        statuses = [s.strip() for s in status.split(",")]
        query = query.where(Order.status.in_(statuses))
    if date_from:
        try:
            query = query.where(Order.date_created >= datetime.fromisoformat(date_from))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from")
    if date_to:
        try:
            query = query.where(Order.date_created <= datetime.fromisoformat(date_to))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to")

    query = query.order_by(Order.date_created.desc())
    result = await db.execute(query)
    orders = result.scalars().all()

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Reference", "Customer", "Phone", "Wilaya", "Commune",
        "Address", "Total", "Status", "Tracking Code", "Date Created",
    ])
    for o in orders:
        writer.writerow([
            o.id, o.reference, o.customer_name, o.customer_phone, o.wilaya,
            o.commune or "", o.address or "", o.total, o.status,
            o.tracking_code or "",
            o.date_created.isoformat() if o.date_created else "",
        ])

    output.seek(0)
    today_str = datetime.now().strftime("%Y-%m-%d")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=orders_{today_str}.csv"},
    )

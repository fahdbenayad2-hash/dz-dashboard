from datetime import datetime
from pydantic import BaseModel

from app.schemas.tracking import TrackingEventRead


class OrderBase(BaseModel):
    id: str
    reference: str
    customer_name: str
    customer_phone: str
    wilaya: str
    commune: str | None = None
    address: str | None = None
    total: float
    status: str
    confirmed_by: str | None = None
    date_created: datetime | None = None
    date_updated: datetime | None = None
    tracking_code: str | None = None


class OrderCreate(OrderBase):
    pass


class OrderRead(OrderBase):
    tracking_events: list[TrackingEventRead] = []

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    items: list[OrderRead]
    total: int
    page: int
    pages: int


class WilayaStat(BaseModel):
    wilaya: str
    count: int
    revenue: float


class StatsResponse(BaseModel):
    date: str
    total_orders: int
    confirmed: int
    shipped: int
    delivered: int
    cancelled: int
    returned: int
    pending: int
    revenue_total: float
    revenue_delivered: float
    delivery_rate: float
    top_wilayas: list[WilayaStat]

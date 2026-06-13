from pydantic import BaseModel


class TrackingEventRead(BaseModel):
    id: int
    order_id: str
    tracking_code: str
    status: str
    status_label: str
    location: str | None = None
    event_date: str | None = None
    fetched_at: str | None = None

    model_config = {"from_attributes": True}

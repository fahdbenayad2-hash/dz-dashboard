from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    tracking_code = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="")
    status_label = Column(String, nullable=False, default="")
    location = Column(String, nullable=True)
    event_date = Column(DateTime(timezone=True), nullable=True)
    fetched_at = Column(DateTime(timezone=True), default=func.now())

    order = relationship("Order", back_populates="tracking_events")

    def __repr__(self) -> str:
        return f"<TrackingEvent {self.tracking_code} {self.status}>"

from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, JSON, Text, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True)
    reference = Column(String, unique=True, nullable=False)
    customer_name = Column(String, nullable=False, default="")
    customer_phone = Column(String, nullable=False, default="")
    wilaya = Column(String, nullable=False, default="")
    commune = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    total = Column(Float, default=0.0)
    status = Column(String, nullable=False, default="pending")
    confirmed_by = Column(String, nullable=True)
    date_created = Column(DateTime(timezone=True), nullable=True)
    date_updated = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    tracking_code = Column(String, nullable=True)
    raw_json = Column(JSON, nullable=True)

    tracking_events = relationship("TrackingEvent", back_populates="order", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Order {self.reference}>"

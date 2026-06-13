from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Boolean, DateTime, JSON, func
from app.db.database import Base


class Subscriber(Base):
    __tablename__ = "subscribers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chat_id = Column(BigInteger, unique=True, nullable=False)
    username = Column(String, nullable=True)
    subscribed_at = Column(DateTime(timezone=True), default=func.now())
    is_active = Column(Boolean, default=True)
    alert_types = Column(JSON, default=lambda: ["status_change"])

    def __repr__(self) -> str:
        return f"<Subscriber {self.chat_id}>"

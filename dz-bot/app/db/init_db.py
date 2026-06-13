from app.db.database import engine, Base
from app.models import order, tracking, subscriber


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

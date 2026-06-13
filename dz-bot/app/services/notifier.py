import logging
from datetime import datetime, timezone, date
from collections import Counter

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import async_session_factory
from app.models.order import Order
from app.models.subscriber import Subscriber
from app.schemas.order import StatsResponse, WilayaStat
from app.bot.utils.formatting import STATUS_EMOJI, STATUS_AR, fmt_currency

logger = logging.getLogger(__name__)


def _algiers_now() -> datetime:
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Africa/Algiers")
    return datetime.now(tz)


class NotifierService:
    async def notify_status_change(
        self,
        order: dict,
        old_status: str,
        new_status: str,
    ) -> None:
        try:
            from telegram import Bot
            from telegram.error import TelegramError
            from app.core.config import settings

            async with async_session_factory() as session:
                result = await session.execute(
                    select(Subscriber).where(
                        Subscriber.is_active == True,
                        func.json_array_length(Subscriber.alert_types) > 0,
                    )
                )
                subscribers = result.scalars().all()

            if not subscribers:
                return

            bot = Bot(token=settings.telegram_bot_token)
            old_emoji = STATUS_EMOJI.get(old_status, "❓")
            new_emoji = STATUS_EMOJI.get(new_status, "❓")
            old_ar = STATUS_AR.get(old_status, old_status)
            new_ar = STATUS_AR.get(new_status, new_status)

            message = (
                f"🔔 تغيير حالة الطلب\n"
                f"📦 #{order.get('reference', '?')} — {order.get('customer_name', '?')}\n"
                f"{old_emoji} {old_ar} ← {new_emoji} {new_ar}\n"
                f"💰 {fmt_currency(order.get('total', 0))}"
            )

            for sub in subscribers:
                try:
                    await bot.send_message(chat_id=sub.chat_id, text=message)
                except TelegramError as e:
                    logger.warning("Failed to notify subscriber %d: %s", sub.chat_id, e)
        except Exception as e:
            logger.error("Error in notify_status_change: %s", e)

    async def send_daily_summary(self, bot) -> None:
        try:
            today = _algiers_now().date()
            stats = await self._compute_stats(today)

            async with async_session_factory() as session:
                result = await session.execute(
                    select(Subscriber).where(Subscriber.is_active == True)
                )
                subscribers = result.scalars().all()

            if not subscribers:
                return

            top_lines = "\n".join(
                f"  {i+1}. {w.wilaya}: {w.count} طلب"
                for i, w in enumerate(stats.top_wilayas[:5])
            )

            message = (
                f"📊 ملخص اليوم {today.strftime('%Y-%m-%d')}\n\n"
                f"📦 إجمالي الطلبات: {stats.total_orders}\n"
                f"✅ مؤكدة: {stats.confirmed}\n"
                f"🚚 مشحونة: {stats.shipped}\n"
                f"✔️ مسلمة: {stats.delivered}\n"
                f"❌ ملغاة: {stats.cancelled}\n"
                f"🔄 مرجعة: {stats.returned}\n"
                f"⏳ معلقة: {stats.pending}\n\n"
                f"💰 رقم الأعمال: {fmt_currency(stats.revenue_total)}\n"
                f"📈 معدل التسليم: {stats.delivery_rate:.1%}\n\n"
                f"🗺️ أكثر الولايات:\n{top_lines}"
            )

            for sub in subscribers:
                try:
                    await bot.send_message(chat_id=sub.chat_id, text=message)
                except Exception as e:
                    logger.warning("Failed to send daily summary to %d: %s", sub.chat_id, e)
        except Exception as e:
            logger.error("Error in send_daily_summary: %s", e)

    async def _compute_stats(self, target_date: date) -> StatsResponse:
        import zoneinfo
        tz = zoneinfo.ZoneInfo("Africa/Algiers")

        async with async_session_factory() as session:
            orders_today = await session.execute(
                select(Order).where(
                    func.date(Order.date_created).cast(func.text) == target_date.isoformat()
                )
            )
            orders_list = orders_today.scalars().all()

        total = len(orders_list)
        counts: dict[str, int] = {"confirmed": 0, "shipped": 0, "delivered": 0, "cancelled": 0, "returned": 0, "pending": 0}
        revenue_total = 0.0
        revenue_delivered = 0.0
        wilaya_counter: Counter = Counter()
        wilaya_revenue: dict[str, float] = {}

        for o in orders_list:
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

        delivered_count = counts.get("delivered", 0)
        returned_count = counts.get("returned", 0)
        cancelled_count = counts.get("cancelled", 0)
        denominator = delivered_count + returned_count + cancelled_count
        delivery_rate = delivered_count / denominator if denominator > 0 else 0.0

        top_wilayas = [
            WilayaStat(wilaya=w, count=c, revenue=wilaya_revenue.get(w, 0.0))
            for w, c in wilaya_counter.most_common(10)
        ]

        return StatsResponse(
            date=target_date.isoformat(),
            total_orders=total,
            confirmed=counts.get("confirmed", 0),
            shipped=counts.get("shipped", 0),
            delivered=delivered_count,
            cancelled=cancelled_count,
            returned=returned_count,
            pending=counts.get("pending", 0),
            revenue_total=revenue_total,
            revenue_delivered=revenue_delivered,
            delivery_rate=delivery_rate,
            top_wilayas=top_wilayas,
        )

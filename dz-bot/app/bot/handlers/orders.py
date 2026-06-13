from datetime import datetime

from telegram import Update
from telegram.ext import ContextTypes
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.database import async_session_factory
from app.models.order import Order
from app.models.tracking import TrackingEvent
from app.bot.utils.formatting import fmt_currency, STATUS_EMOJI, STATUS_AR


async def _check_auth(update: Update) -> bool:
    chat_id = update.effective_chat.id if update.effective_chat else None
    if chat_id and chat_id in settings.allowed_chat_ids:
        return True
    if update.message:
        await update.message.reply_text("⛔ غير مخوّل")
    return False


async def order_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _check_auth(update):
        return

    if not context.args:
        await update.message.reply_text("❌ استخدم: /order <رقم الطلب>")
        return

    query_text = context.args[0]

    async with async_session_factory() as db:
        result = await db.execute(
            select(Order)
            .options(selectinload(Order.tracking_events))
            .where(
                or_(Order.id == query_text, Order.reference == query_text)
            )
        )
        order = result.scalar_one_or_none()

    if not order:
        await update.message.reply_text(f"❌ لم يتم العثور على طلب: {query_text}")
        return

    status_emoji = STATUS_EMOJI.get(order.status, "❓")
    status_ar = STATUS_AR.get(order.status, order.status)

    tracking = ""
    if order.tracking_events:
        last_event = order.tracking_events[-1]
        tracking = (
            f"\n📦 تتبع: {order.tracking_code}\n"
            f"   {last_event.status_label} - {last_event.location or ''}"
        )

    message = (
        f"📋 تفاصيل الطلب\n\n"
        f"🆔 المعرف: {order.id}\n"
        f"🔖 المرجع: {order.reference}\n"
        f"👤 العميل: {order.customer_name}\n"
        f"📞 الهاتف: {order.customer_phone}\n"
        f"📍 الولاية: {order.wilaya}\n"
        f"🏘️ البلدية: {order.commune or '-'}\n"
        f"💰 الإجمالي: {fmt_currency(order.total)}\n"
        f"📌 الحالة: {status_emoji} {status_ar}\n"
        f"📅 التاريخ: {order.date_created.strftime('%Y-%m-%d %H:%M') if order.date_created else '-'}"
        f"{tracking}"
    )

    await update.message.reply_text(message)


async def pending_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _check_auth(update):
        return

    wilaya_filter = " ".join(context.args) if context.args else None

    async with async_session_factory() as db:
        query = (
            select(Order)
            .where(Order.status == "pending")
            .order_by(Order.date_created.desc())
        )
        if wilaya_filter:
            query = query.where(Order.wilaya.ilike(f"%{wilaya_filter}%"))
        result = await db.execute(query)
        orders = result.scalars().all()

    if not orders:
        msg = "✅ لا توجد طلبات معلقة"
        if wilaya_filter:
            msg += f" في {wilaya_filter}"
        await update.message.reply_text(msg)
        return

    lines = []
    for i, o in enumerate(orders[:10], 1):
        lines.append(
            f"{i}. #{o.reference} — {o.customer_name}\n"
            f"   📍 {o.wilaya} | 💰 {fmt_currency(o.total)} | "
            f"📅 {o.date_created.strftime('%Y-%m-%d') if o.date_created else '-'}"
        )

    message = "⏳ الطلبات المعلقة:\n\n" + "\n".join(lines)

    if len(orders) > 10:
        message += f"\n\n📋 و {len(orders) - 10} طلبات معلقة أخرى"

    await update.message.reply_text(message)

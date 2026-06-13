from telegram import Update
from telegram.ext import ContextTypes
from sqlalchemy import select

from app.core.config import settings
from app.db.database import async_session_factory
from app.models.subscriber import Subscriber


async def _check_auth(update: Update) -> bool:
    chat_id = update.effective_chat.id if update.effective_chat else None
    if chat_id and chat_id in settings.allowed_chat_ids:
        return True
    if update.message:
        await update.message.reply_text("⛔ غير مخوّل")
    return False


async def subscribe_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _check_auth(update):
        return

    chat_id = update.effective_chat.id
    username = update.effective_user.username if update.effective_user else None

    async with async_session_factory() as db:
        result = await db.execute(
            select(Subscriber).where(Subscriber.chat_id == chat_id)
        )
        sub = result.scalar_one_or_none()

        if sub:
            sub.is_active = True
            if username:
                sub.username = username
        else:
            sub = Subscriber(
                chat_id=chat_id,
                username=username,
                is_active=True,
                alert_types=["status_change"],
            )
            db.add(sub)
        await db.commit()

    await update.message.reply_text("✅ اشتركت في التنبيهات")


async def unsubscribe_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _check_auth(update):
        return

    chat_id = update.effective_chat.id

    async with async_session_factory() as db:
        result = await db.execute(
            select(Subscriber).where(Subscriber.chat_id == chat_id)
        )
        sub = result.scalar_one_or_none()

        if sub:
            sub.is_active = False
            await db.commit()

    await update.message.reply_text("🔕 تم إلغاء الاشتراك")

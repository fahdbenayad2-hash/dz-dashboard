from telegram import Update
from telegram.ext import ContextTypes

from app.core.config import settings


async def _check_auth(update: Update) -> bool:
    chat_id = update.effective_chat.id if update.effective_chat else None
    if chat_id and chat_id in settings.allowed_chat_ids:
        return True
    if update.message:
        await update.message.reply_text("⛔ غير مخوّل")
    return False


async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _check_auth(update):
        return

    welcome = (
        "مرحباً بك في بوت متجر femmesoir 👋\n\n"
        "الأوامر المتاحة:\n"
        "/stats - إحصائيات اليوم\n"
        "/stats YYYY-MM-DD - إحصائيات لتاريخ معين\n"
        "/order <رقم الطلب> - تفاصيل طلب\n"
        "/pending - قائمة الطلبات المعلقة\n"
        "/pending <الولاية> - طلبات معلقة لولاية معينة\n"
        "/noest <كود التتبع> - تتبع شحنة\n"
        "/subscribe - اشتراك في التنبيهات\n"
        "/unsubscribe - إلغاء الاشتراك"
    )
    await update.message.reply_text(welcome)

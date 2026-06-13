from datetime import date, datetime

from telegram import Update
from telegram.ext import ContextTypes

from app.core.config import settings
from app.services.notifier import NotifierService
from app.bot.utils.formatting import fmt_currency


async def _check_auth(update: Update) -> bool:
    chat_id = update.effective_chat.id if update.effective_chat else None
    if chat_id and chat_id in settings.allowed_chat_ids:
        return True
    if update.message:
        await update.message.reply_text("⛔ غير مخوّل")
    return False


async def stats_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _check_auth(update):
        return

    target_date = date.today()
    if context.args:
        try:
            target_date = datetime.strptime(context.args[0], "%Y-%m-%d").date()
        except ValueError:
            await update.message.reply_text("❌ صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD")
            return

    notifier = NotifierService()
    try:
        stats = await notifier._compute_stats(target_date)
    except Exception as e:
        await update.message.reply_text(f"❌ خطأ في جلب الإحصائيات: {e}")
        return

    top_lines = "\n".join(
        f"  {i+1}. {w.wilaya}: {w.count} طلب ({fmt_currency(w.revenue)})"
        for i, w in enumerate(stats.top_wilayas[:5])
    )

    message = (
        f"📊 إحصائيات {stats.date}\n\n"
        f"📦 الطلبات: {stats.total_orders}\n"
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

    await update.message.reply_text(message)

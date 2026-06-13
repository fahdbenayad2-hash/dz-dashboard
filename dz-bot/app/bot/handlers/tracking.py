from datetime import datetime

from telegram import Update
from telegram.ext import ContextTypes

from app.core.config import settings
from app.services.noest import NoestClient


async def _check_auth(update: Update) -> bool:
    chat_id = update.effective_chat.id if update.effective_chat else None
    if chat_id and chat_id in settings.allowed_chat_ids:
        return True
    if update.message:
        await update.message.reply_text("⛔ غير مخوّل")
    return False


STATUS_EMOJIS = {
    "ramassé": "📦",
    "en transit": "🚚",
    "en livraison": "🚛",
    "livré": "✅",
    "livrée": "✅",
    "retour": "🔙",
    "retourné": "🔙",
    "refus": "❌",
    "refusé": "❌",
}


async def noest_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await _check_auth(update):
        return

    if not context.args:
        await update.message.reply_text("❌ استخدم: /noest <كود التتبع>")
        return

    tracking_code = context.args[0]

    await update.message.reply_text("🔍 جاري البحث عن الشحنة...")

    noest = NoestClient()
    try:
        raw_data = await noest.track(tracking_code)
    except Exception:
        await update.message.reply_text("❌ تعذر الاتصال بـ NOEST. تحقق من كود التتبع.")
        return

    events = raw_data if isinstance(raw_data, list) else raw_data.get("events", raw_data.get("data", []))
    if not events:
        await update.message.reply_text(f"❌ لا توجد أحداث لهذا الكود: {tracking_code}")
        return

    lines = [f"📦 تتبع الشحنة: {tracking_code}\n"]
    for ev in events:
        status_text = ev.get("status", "")
        status_code = ev.get("status_code", "")
        location = ev.get("center") or ev.get("location") or ""
        date_raw = ev.get("date", "")
        emoji = "📌"
        for key, e in STATUS_EMOJIS.items():
            if key in status_text.lower() or key in status_code.lower():
                emoji = e
                break

        date_str = ""
        if date_raw:
            try:
                dt = datetime.fromisoformat(date_raw)
                date_str = dt.strftime("%Y-%m-%d %H:%M")
            except (ValueError, TypeError):
                date_str = date_raw

        lines.append(f"{emoji} {status_text}")
        if location:
            lines.append(f"   📍 {location}")
        if date_str:
            lines.append(f"   🕐 {date_str}")
        lines.append("")

    await update.message.reply_text("\n".join(lines).strip())

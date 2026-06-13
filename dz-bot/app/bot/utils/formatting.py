from app.models.order import Order
from app.schemas.order import StatsResponse
from app.models.tracking import TrackingEvent


STATUS_EMOJI: dict[str, str] = {
    "pending": "⏳",
    "confirmed": "✅",
    "shipped": "🚚",
    "delivered": "✔️",
    "cancelled": "❌",
    "returned": "🔄",
}

STATUS_AR: dict[str, str] = {
    "pending": "معلق",
    "confirmed": "مؤكد",
    "shipped": "مشحون",
    "delivered": "مسلّم",
    "cancelled": "ملغى",
    "returned": "مرجع",
}


def fmt_currency(amount: float) -> str:
    return f"{amount:,.0f} DZD"


def fmt_order(order: Order) -> str:
    status_emoji = STATUS_EMOJI.get(order.status, "❓")
    status_ar = STATUS_AR.get(order.status, order.status)
    lines = [
        f"📋 تفاصيل الطلب",
        f"🔖 المرجع: {order.reference}",
        f"👤 العميل: {order.customer_name}",
        f"📞 الهاتف: {order.customer_phone}",
        f"📍 الولاية: {order.wilaya}",
        f"💰 الإجمالي: {fmt_currency(order.total)}",
        f"📌 الحالة: {status_emoji} {status_ar}",
    ]
    if order.date_created:
        lines.append(f"📅 التاريخ: {order.date_created.strftime('%Y-%m-%d %H:%M')}")
    return "\n".join(lines)


def fmt_stats(stats: StatsResponse) -> str:
    top_lines = "\n".join(
        f"  {i+1}. {w.wilaya}: {w.count} طلب"
        for i, w in enumerate(stats.top_wilayas[:5])
    )
    return (
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


def fmt_tracking_events(events: list[TrackingEvent]) -> str:
    if not events:
        return "لا توجد أحداث تتبع"
    lines = []
    for ev in events:
        emoji = STATUS_EMOJI.get(ev.status, "📌")
        date_str = ev.event_date.strftime("%Y-%m-%d %H:%M") if ev.event_date else ""
        location_str = f" @ {ev.location}" if ev.location else ""
        lines.append(f"{emoji} {ev.status_label}{location_str} — {date_str}")
    return "\n".join(lines)

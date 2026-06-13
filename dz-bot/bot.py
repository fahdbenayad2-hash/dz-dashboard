import logging
import asyncio

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from app.core.config import settings
from app.db.init_db import init_db
from app.bot.handlers.start import start_handler
from app.bot.handlers.stats import stats_handler
from app.bot.handlers.orders import order_handler, pending_handler
from app.bot.handlers.tracking import noest_handler
from app.bot.handlers.alerts import subscribe_handler, unsubscribe_handler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def post_init(application: Application):
    await init_db()
    logger.info("Bot database initialized")


async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.error("Bot error: %s", context.error)


def main():
    if not settings.telegram_bot_token:
        logger.error("TELEGRAM_BOT_TOKEN is not set")
        return

    application = (
        Application.builder()
        .token(settings.telegram_bot_token)
        .post_init(post_init)
        .build()
    )

    application.add_handler(CommandHandler("start", start_handler))
    application.add_handler(CommandHandler("stats", stats_handler))
    application.add_handler(CommandHandler("order", order_handler))
    application.add_handler(CommandHandler("pending", pending_handler))
    application.add_handler(CommandHandler("noest", noest_handler))
    application.add_handler(CommandHandler("subscribe", subscribe_handler))
    application.add_handler(CommandHandler("unsubscribe", unsubscribe_handler))

    application.add_error_handler(error_handler)

    logger.info("Bot started in polling mode")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()

import asyncio
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

TOKEN = "9134534266:AAEay88ShrbujXpvCBkdwxBnHYD81NysNnc"
APP_URL = "https://interpreted-equivalent-stranger-essentials.trycloudflare.com"

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_text = (
        "🖨️ *RISO PRINT STUDIO // ТРАФАРЕТНЫЙ СТАНОК*\n\n"
        "Добро пожаловать в студию аутентичной ризографии!\n\n"
        "• *Физический оверпринт:* соевые чернила Fluo Pink, Federal Blue, Sunflower\n"
        "• *Механический сдвиг слоёв:* регулировка Misregistration\n"
        "• *Полутоновый растр:* винтажные розетки без муара\n"
        "• *Камера:* делайте снимки или загружайте любые фото\n\n"
        "Нажмите кнопку ниже, чтобы открыть приложение прямо в Telegram 👇"
    )

    keyboard = [
        [
            InlineKeyboardButton(
                "🎨 ЗАПУСТИТЬ RISO STUDIO",
                web_app=WebAppInfo(url=APP_URL)
            )
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        welcome_text,
        reply_markup=reply_markup,
        parse_mode="Markdown"
    )

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [
            InlineKeyboardButton(
                "🎨 ОТКРЫТЬ В РИЗОГРАФЕ",
                web_app=WebAppInfo(url=APP_URL)
            )
        ]
    ]
    await update.message.reply_text(
        "📸 Фото получено! Нажмите кнопку ниже, чтобы открыть его в RISO Studio и применить эффект:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

def main():
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, start))

    print("Riso Telegram Bot is running...")
    app.run_polling()

if __name__ == "__main__":
    main()

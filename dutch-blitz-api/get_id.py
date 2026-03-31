import os
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, '.env.local')
load_dotenv(env_path)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.message.chat_id
    print(f"\n🚨 YOUR SECRET CHAT ID IS: {chat_id}\n")
    await update.message.reply_text(f"Your Chat ID is: {chat_id}\nPut this in your .env file!")

def main() -> None:
    # Now it will grab it securely from the .env file!
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    
    if not token:
        print(f"❌ Error: Still couldn't find the token. Check that TELEGRAM_BOT_TOKEN is saved in {env_path}")
        return

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    
    print("Bot is listening! Go to Telegram and send /start to your bot.")
    
    # Run synchronously to avoid the event loop crash
    app.run_polling()

if __name__ == "__main__":
    main()
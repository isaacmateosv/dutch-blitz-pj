import os
import random
import string
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from dotenv import load_dotenv
from database import SessionLocal
import models

current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, '.env')
load_dotenv(env_path)

ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

def generate_room_code(length=4):
    """Generates a random lowercase string (e.g., 'abxy')"""
    return "".join(random.choices(string.ascii_lowercase, k=length))

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if str(update.message.chat_id) != str(ADMIN_CHAT_ID):
        return 

    await update.message.reply_text(
        "👋 Welcome back, Boss.\n\n"
        "Send /new to generate a secure, permanent code."
    )

async def create_room(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # 🛡️ THE FIREWALL
    if str(update.message.chat_id) != str(ADMIN_CHAT_ID):
        return

    db = SessionLocal()
    try:
        # 1. Generate a unique code 
        while True:
            code = generate_room_code()
            exists = db.query(models.Room).filter(models.Room.room_code == code).first()
            if not exists:
                break

        # 2. Save it to the database 
        new_room = models.Room(
            room_code=code,
            is_permanent=True,
            created_by="telegram_admin"
        )
        db.add(new_room)
        db.commit()

        await update.message.reply_text(
            f"✅ Secure Room Created!\n\n"
            f"🔑 Code: `{code}`\n\n"
            f"Share this code with the players. This room is protected from the 24-hour garbage collector."
        )
    except Exception as e:
        await update.message.reply_text(f"❌ Database error: {e}")
    finally:
        db.close()

def main() -> None:
    if not TOKEN or not ADMIN_CHAT_ID:
        print("❌ CRITICAL: Missing TELEGRAM_BOT_TOKEN or ADMIN_CHAT_ID in .env")
        return

    app = Application.builder().token(TOKEN).build()
    
    # Register commands
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("new", create_room))
    
    print("🛡️ BlitzRoom Gateway is online and secured.")
    app.run_polling()

if __name__ == "__main__":
    main()
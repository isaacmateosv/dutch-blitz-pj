#!/bin/bash

# 1. Start the Telegram bot in the background (the '&' is the magic trick)
python bot.py &

# 2. Start the FastAPI WebSockets server in the foreground
uvicorn main:app --host 0.0.0.0 --port $PORT
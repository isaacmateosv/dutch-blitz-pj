import json
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from socket_manager import manager
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
import os
from database import engine, SessionLocal
from openai import AsyncOpenAI
from dotenv import load_dotenv

# AI model and functions; there's also a controller
load_dotenv()
# client=AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1" # This tells the SDK to talk to Groq!
)

class ScoreData(BaseModel):
    player_name: str
    total_score: int

class MatchRecapRequest(BaseModel):
    room_code: str
    scores: list[ScoreData]

# This line magically creates your tables in PostgreSQL if they don't exist yet
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow your frontend to talk to your backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, you would put your Vercel URL here
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas (for data validation)
class UserCreate(BaseModel):
    username: str

class RoomCreate(BaseModel):
    room_code: str

# Dependency function: Gives each API request its own database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/users/")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # 1. Check if user already exists
    existing_user = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # 2. Create and save the new user
    db_user = models.User(username=user.username)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/rooms/")
def create_room(room: RoomCreate, db: Session = Depends(get_db)):
    db_room = models.Room(room_code=room.room_code)
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room

@app.websocket("/ws/{room_code}/{username}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, username: str):
    await manager.connect(websocket, room_code)
    
    # 1. Announce join and send player count
    player_count = len(manager.active_connections[room_code])
    join_message = {
        "type": "system",
        "message": f"🟢 {username} joined the lobby.",
        "playerCount": player_count
    }
    await manager.broadcast(json.dumps(join_message), room_code)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            # NEW: If it's a ping, reply directly to the user with a pong to keep Render happy!
            try:
                parsed = json.loads(data)
                if parsed.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                    continue 
            except:
                pass
                
            await manager.broadcast(data, room_code)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_code)
        
        # 2. Announce leave and update player count
        player_count = len(manager.active_connections.get(room_code, []))
        leave_message = {
            "type": "system",
            "message": f"🔴 {username} left the table.",
            "playerCount": player_count
        }
        if player_count > 0:
            await manager.broadcast(json.dumps(leave_message), room_code)

@app.post("/generate-recap/")
async def generate_match_recap(data: MatchRecapRequest):
    try:
        stats_string = ", ".join([
            f"{s.player_name}: {s.total_score} pts" 
            for s in data.scores
        ])
        
        prompt = f"""
        You are an energetic, slightly chaotic esports commentator for a fast-paced card game called Dutch Blitz.
        The game just ended. Here are the final stats: {stats_string}.
        Write a short, funny 2-sentence recap of the match. 
        Tease the loser and heavily praise the winner.
        Do it only in Latam Spanish, please. Of course, use English phrases when required (if they help us in any way).
        """

        response = await client.chat.completions.create(
            # model="gpt-3.5-turbo",
            model="llama-3.1-8b-instant", # Swapped to Groq's lightning-fast model; The new, supported model!
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=150
        )
        
        return {"recap": response.choices[0].message.content}
        
    except Exception as e:
        print(f"AI Error: {e}")
        return {"recap": "🎙️ The AI Announcer just lost connection to the studio! (Check logs for quota/API errors)."}

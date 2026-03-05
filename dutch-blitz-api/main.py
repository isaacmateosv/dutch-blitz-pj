from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
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
client=AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class ScoreData(BaseModel):
    player_name: str
    total_score: int
    blitz_cards_left: int

class MatchRecapRequest(BaseModel):
    room_code: str
    scores: list[ScoreData]

# This line magically creates your tables in PostgreSQL if they don't exist yet
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

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
    # 1. Connect the user to their specific room
    await manager.connect(websocket, room_code)
    
    # 2. Announce to the room that a new player joined
    await manager.broadcast(f"System: {username} has joined the blitz!", room_code)
    
    try:
        # 3. Keep the connection open and listen for incoming messages (like score updates)
        while True:
            data = await websocket.receive_text()
            
            # For now, we just broadcast the raw message back to everyone.
            # Later, this is where we will calculate the +1 and -2 points.
            await manager.broadcast(f"{username}: {data}", room_code)
            
    except WebSocketDisconnect:
        # 4. Handle a player closing their tab or losing connection
        manager.disconnect(websocket, room_code)
        await manager.broadcast(f"System: {username} left the table.", room_code)

@app.post("/generate-recap/")
async def generate_match_recap(data: MatchRecapRequest):
    # 1. Format the game data into a string for the AI
    stats_string = ", ".join([
        f"{s.player_name}: {s.total_score} pts ({s.blitz_cards_left} blitz cards left)" 
        for s in data.scores
    ])
    
    # 2. Build the prompt
    prompt = f"""
    You are an energetic, slightly chaotic esports commentator for a fast-paced card game called Dutch Blitz.
    The game just ended. Here are the final stats: {stats_string}.
    Write a short, funny 3-sentence recap of the match. 
    Tease the person who left the most blitz cards (which are bad). Praise the winner. Do it only in Latam Spanish, please. Of course, use English phrases when required (if they help us in any way).
    """

    # 3. Call the LLM
    response = await client.chat.completions.create(
        model="gpt-3.5-turbo", # Or gpt-4o-mini for cheaper/faster results
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8,
        max_tokens=150
    )
    
    return {"recap": response.choices[0].message.content}

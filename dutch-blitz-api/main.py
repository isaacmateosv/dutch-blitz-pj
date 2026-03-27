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

load_dotenv()

client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1" 
)

class ScoreData(BaseModel):
    player_name: str
    total_score: int

class MatchRecapRequest(BaseModel):
    room_code: str
    scores: list[ScoreData]

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserCreate(BaseModel):
    username: str

class RoomCreate(BaseModel):
    room_code: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/users/")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
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
            
            try:
                parsed = json.loads(data)
                
                # 1. Ignorar los pings
                if parsed.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                    continue 
                
                # 2. NUEVO: Capturar peticiones de la IA por WebSocket
                elif parsed.get("type") == "request_ai_recap":
                    scores_data = parsed.get("scores", [])
                    
                    # Formatear el string de estadísticas
                    stats_string = ", ".join([
                        f"{s['player_name']}: {s['total_score']} pts" 
                        for s in scores_data
                    ])
                    
                    prompt = f"""
                    You are an energetic, slightly chaotic esports commentator for a fast-paced card game called Dutch Blitz.
                    The game just ended. Here are the final stats: {stats_string}.
                    Write a short, funny 2-sentence recap of the match. 
                    Tease the loser and heavily praise the winner.
                    Do it only in Latam Spanish, please. Of course, use English phrases when required (if they help us in any way).
                    """

                    try:
                        response = await client.chat.completions.create(
                            model="llama-3.1-8b-instant",
                            messages=[{"role": "user", "content": prompt}],
                            temperature=0.8,
                            max_tokens=150
                        )
                        recap_text = response.choices[0].message.content
                    except Exception as e:
                        print(f"Groq API Error: {e}")
                        recap_text = "The AI Announcer just lost connection to the studio! (Check API quota)."

                    # BROADCAST A TODA LA SALA
                    broadcast_msg = {
                        "type": "ai_recap_broadcast",
                        "message": recap_text
                    }
                    await manager.broadcast(json.dumps(broadcast_msg), room_code)
                    continue 

            except Exception as parse_error:
                # Si falla el parseo del JSON, no rompas el servidor
                pass
                
            # 3. Si no es un ping ni una petición de IA, haz broadcast del mensaje normal
            await manager.broadcast(data, room_code)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_code)
        
        player_count = len(manager.active_connections.get(room_code, []))
        leave_message = {
            "type": "system",
            "message": f"🔴 {username} left the table.",
            "playerCount": player_count
        }
        if player_count > 0:
            await manager.broadcast(json.dumps(leave_message), room_code)

# IMPORTANTE: Eliminé la ruta @app.post("/generate-recap/") por completo. 
# Ya no la necesitamos porque todo viaja por el WebSocket.
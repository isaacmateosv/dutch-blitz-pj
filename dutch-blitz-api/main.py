import json
import os
from fastapi import APIRouter, FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from socket_manager import manager
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
from database import engine, SessionLocal, get_db
from openai import AsyncOpenAI
from dotenv import load_dotenv
from prompts import GAME_RECAP_PROMPT, AI_SALUTE
import base64
import httpx

# 🔥 1. IMPORT THE NEW ROUTER
from routers import rooms

load_dotenv()

client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1" 
)

class ScoreData(BaseModel):
    player_name: str
    total_score: int
    status: str = "concentrating" 
    round_number: int = 1
    blitz_pile_cards: int = 0
    dutch_pile_cards: int = 0

class MatchRecapRequest(BaseModel):
    room_code: str
    scores: list[ScoreData]

class UserCreate(BaseModel):
    username: str

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔥 2. REGISTER THE ROUTER WITH FASTAPI
app.include_router(rooms.router)

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

@app.post("/game/recap/")
def save_game_recap(recap: MatchRecapRequest, db: Session = Depends(get_db)):
    db_room = db.query(models.Room).filter(models.Room.room_code == recap.room_code).first()
    if not db_room:
        db_room = models.Room(room_code=recap.room_code, status="finished")
        db.add(db_room)
        db.commit()
        db.refresh(db_room)
    else:
        db_room.status = "finished"

    for stat in recap.scores:
        user = db.query(models.User).filter(models.User.username == stat.player_name).first()
        if not user:
            user = models.User(username=stat.player_name)
            db.add(user)
            db.commit()
            db.refresh(user)
        
        new_score = models.Score(
            room_id=db_room.id,
            player_name=stat.player_name,
            total_score=stat.total_score,
            round_number=stat.round_number,
            blitz_pile_cards=stat.blitz_pile_cards,
            dutch_pile_cards=stat.dutch_pile_cards
        )
        db.add(new_score)

    db.commit()
    return {"status": "success", "message": "Match results archived!"}

@app.websocket("/ws/{room_code}/{username}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, username: str, email: str = None, db: Session = Depends(get_db)):
    await manager.connect(websocket, room_code)
    
    try:
        db_room = db.query(models.Room).filter(models.Room.room_code == room_code).first()
        if not db_room:
            db_room = models.Room(
                room_code=room_code, 
                target_score=75,
                is_permanent=bool(email), 
                created_by=email
            )
            db.add(db_room)
            db.commit()
        elif email and not db_room.is_permanent:
            db_room.is_permanent = True
            db_room.created_by = email
            db.commit()
    except Exception as e:
        print(f"Database error during room creation: {e}")

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
                
                if parsed.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                    continue 
                
                elif parsed.get("type") == "request_greeting":
                    user_name = parsed.get("username", "Un jugador")
                    print(f"🤖 Pidiendo saludo a IA para: {user_name}") # <-- ESPÍA 1
                    prompt = AI_SALUTE.format(user_name=user_name)
                    
                    try:
                        response = await client.chat.completions.create(
                            model="llama-3.3-70b-versatile", # 🔥 Modelo pesado
                            messages=[{"role": "user", "content": prompt}],
                            temperature=1.1, # 🔥 Más creatividad
                            max_tokens=25
                        )
                        ai_salute = response.choices[0].message.content.strip().replace('"', '')
                        print(f"✅ Respuesta IA recibida: {ai_salute}") # <-- ESPÍA 2
                    except Exception as e:
                        print(f"❌ Groq Salute Error: {e}")
                        ai_salute = "¡A llorar a la llorería! 🃏" 

                    broadcast_msg = {
                        "type": "ai_suggestion",
                        "username": user_name,
                        "suggestion": ai_salute
                    }
                    print(f"📡 Enviando por WebSocket: {broadcast_msg}") # <-- ESPÍA 3
                    await manager.broadcast(json.dumps(broadcast_msg), room_code)
                    continue

                elif parsed.get("type") == "request_ai_recap":
                    scores_data = parsed.get("scores", [])
                    
                    stats_string = "\n".join([
                        f"- Jugador: {s.get('player_name', 'Unknown')} | Puntos: {s.get('total_score', 0)} | Pensamiento: [{s.get('status', 'concentrating')}]" 
                        for s in scores_data
                    ])
                    
                    # 🔥 NUEVO: Buscamos el historial reciente en la BD para darle contexto a la IA
                    history_context = "No previous history available."
                    try:
                        db_room_info = db.query(models.Room).filter(models.Room.room_code == room_code).first()
                        if db_room_info:
                            recent_scores = db.query(models.Score).filter(
                                models.Score.room_id == db_room_info.id
                            ).order_by(models.Score.id.desc()).limit(15).all()
                            
                            if recent_scores:
                                history_context = "Recent Past Games Data:\n"
                                for score in recent_scores:
                                    history_context += f"- Round {score.round_number}: {score.player_name} scored {score.total_score} pts.\n"
                    except Exception as e:
                        print(f"Error fetching history for AI context: {e}")

                    system_prompt = GAME_RECAP_PROMPT
                    user_prompt_content = f"CURRENT MATCH STATS:\n{stats_string}\n\nRECENT HISTORY:\n{history_context}"

                    try:
                        response = await client.chat.completions.create(
                            model="llama-3.3-70b-versatile", # 🔥 Modelo pesado
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt_content}
                            ],
                            temperature=1.1, # 🔥 Más caos y sarcasmo
                            max_tokens=200
                        )
                        recap_text = response.choices[0].message.content
                    except Exception as e:
                        print(f"Groq API Error: {e}")
                        recap_text = "**🎙️ AI Announcer:** Error de conexión con el estudio. ¡Pero vaya partida acabamos de presenciar! Felicidades al campeón."

                    broadcast_msg = {
                        "type": "ai_recap_broadcast",
                        "message": recap_text
                    }
                    await manager.broadcast(json.dumps(broadcast_msg), room_code)
                    continue
            except Exception as parse_error:
                print(f"Parse error: {parse_error}")
                pass
                
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


class ImageGenRequest(BaseModel):
    recap_text: str

@app.post("/game/recap/image/")
async def generate_recap_image(req: ImageGenRequest):
    if not os.getenv("HF_API_KEY"):
        raise HTTPException(status_code=500, detail="Hugging Face API key missing")

    try:
        # 1. Groq traduce el resumen chistoso a un Prompt Visual en Inglés
        translator_prompt = f"""
        Extract the core action from this Spanish game recap and turn it into a short, highly visual, dynamic image generation prompt in English. 
        Style: Comic book illustration, chaotic, funny. 
        Recap: "{req.recap_text}"
        Output ONLY the English prompt, no explanations.
        """
        groq_response = await client.chat.completions.create(
            model="llama-3.1-8b-instant", # Aquí el modelo rápido es perfecto
            messages=[{"role": "user", "content": translator_prompt}],
            temperature=0.7,
            max_tokens=50
        )
        visual_prompt = groq_response.choices[0].message.content.strip()
        print(f"🎨 Prompt Visual Generado: {visual_prompt}")

        headers = {"Authorization": f"Bearer {os.getenv('HF_API_KEY')}"}

        async with httpx.AsyncClient(timeout=60.0) as http_client:
            image_res = await http_client.post(
                os.getenv("HF_API_URL"), 
                headers=headers, 
                json={"inputs": visual_prompt}
            )
            
            if image_res.status_code != 200:
                print(f"HF Error: {image_res.text}")
                raise HTTPException(status_code=500, detail="Image generation failed")

            # 3. Convertimos la imagen a Base64 para mandarla directo al navegador
            base64_img = base64.b64encode(image_res.content).decode('utf-8')
            return {"image_data": f"data:image/jpeg;base64,{base64_img}"}

    except Exception as e:
        print(f"Error en generación de imagen: {e}")
        raise HTTPException(status_code=500, detail=str(e))
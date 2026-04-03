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
                    print(f"🤖 Pidiendo saludo a IA para: {user_name}") 
                    prompt = AI_SALUTE.format(user_name=user_name)
                    
                    try:
                        response = await client.chat.completions.create(
                            model="llama-3.3-70b-versatile",
                            messages=[{"role": "user", "content": prompt}],
                            temperature=1.1,
                            max_tokens=25
                        )
                        ai_salute = response.choices[0].message.content.strip().replace('"', '')
                        print(f"✅ Respuesta IA recibida: {ai_salute}") 
                    except Exception as e:
                        print(f"❌ Groq Salute Error: {e}")
                        ai_salute = "¡A llorar a la llorería! 🃏" 

                    broadcast_msg = {
                        "type": "ai_suggestion",
                        "username": user_name,
                        "suggestion": ai_salute
                    }
                    print(f"📡 Enviando por WebSocket: {broadcast_msg}")
                    await manager.broadcast(json.dumps(broadcast_msg), room_code)
                    continue

                elif parsed.get("type") == "request_ai_recap":
                    scores_data = parsed.get("scores", [])
                    
                    stats_string = "\n".join([
                        f"- Jugador: {s.get('player_name', 'Unknown')} | Puntos: {s.get('total_score', 0)} | Pensamiento: [{s.get('status', 'concentrating')}]" 
                        for s in scores_data
                    ])
                    
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
                    user_prompt_content = f"""
                    CURRENT MATCH STATS (ONLY NARRATE ABOUT THESE ACTIVE PLAYERS):
                    {stats_string}

                    RECENT HISTORY (FOR CONTEXT ONLY. DO NOT MENTION THESE PLAYERS IF THEY ARE NOT IN THE ACTIVE LIST ABOVE):
                    {history_context}
                    """

                    try:
                        response = await client.chat.completions.create(
                            model="llama-3.3-70b-versatile",
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt_content}
                            ],
                            temperature=1.1,
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
        # 🔥 EL PROMPT MAESTRO (Comedia Épica Absurda, CERO Texto)
        json_prompt = f"""
        Analyze this game recap: "{req.recap_text}"

        You must respond with a valid JSON object containing exactly 3 keys:
        1. "flux_prompt": A highly detailed, absurdly epic and lmfao style image generation prompt in English. 
           ART STYLE: Over-the-top, dynamic, epic showdown (think final boss battle).  Be randomly realistic.
           ENVIRONMENT: Set the scene in a majestic or iconic Ecuadorian location (like the top of El Panecillo, Cotopaxi, or any actual and real Ecuadorian emblematic place/location; reflect the four regions: Sierra, Costa, Amazonía, Galápagos). Add a cartoon-ish local animal with confused face (like a sea lion, iguana, turtle, condor, cuy, alpaca, etc) or an animated Ecuadorian symbol/sign (like Inti Sun, Virgen Del Panecillo, The Monument to the Equator, Panama Hat, etc) watching the chaos if needed.
           ACTION: Focus on the winning/losing players. The winner should look like an overpowered villain or superhero glowing with dramatic energy, while the losers are defeated in an annoyed way, like tired of the mockery and booing. Be creative and make it hilarious.
           MANDATORY RULE: NO SPEECH BUBBLES, NO BALLOONS, NO WORDS, NO LETTERS, AND NO TEXT OF ANY KIND IN THE IMAGE.
        2. "display_en": A punchy, short 1-sentence summary of the scene being drawn (in English, max 12 words).
        3. "display_es": The exact same punchy summary translated to Spanish, using informal Quito/Ecuadorian slang (max 12 words).

        Output ONLY the JSON object.
        """

        groq_response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": json_prompt}],
            temperature=0.7,
            response_format={"type": "json_object"} 
        )
        
        prompt_data = json.loads(groq_response.choices[0].message.content.strip())
        flux_prompt = prompt_data.get("flux_prompt", "Comic book scene of players playing a game.")
        display_en = prompt_data.get("display_en", "A chaotic card match.")
        display_es = prompt_data.get("display_es", "Una partida loca, mi llave.")

        print(f"🎨 FLUX Prompt (Para la IA): {flux_prompt}")

        # 🔥 MODIFICACIÓN MINI: Usar la URL directa de FLUX por si tu .env tiene la antigua
        HF_URL = os.getenv("HF_API_URL", "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell")
        headers = {"Authorization": f"Bearer {os.getenv('HF_API_KEY')}"}
        
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            image_res = await http_client.post(
                HF_URL, 
                headers=headers, 
                json={"inputs": flux_prompt}
            )
            
            if image_res.status_code != 200:
                print(f"HF Error: {image_res.text}")
                raise HTTPException(status_code=500, detail="Image generation failed")

            base64_img = base64.b64encode(image_res.content).decode('utf-8')
            
            return {
                "image_data": f"data:image/jpeg;base64,{base64_img}",
                "visual_prompt": {
                    "en": display_en,
                    "es": display_es
                }
            }

    except Exception as e:
        print(f"Error en generación de imagen: {e}")
        raise HTTPException(status_code=500, detail=str(e))
import json
import os
from fastapi import APIRouter, FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from socket_manager import manager
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
import models
from database import engine, SessionLocal, get_db
from openai import AsyncOpenAI
from dotenv import load_dotenv
from prompts import GAME_RECAP_PROMPT, AI_SALUTE
import urllib.parse
import random
import traceback
import re

from fastapi.responses import JSONResponse

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
    # 🔥 FIX: Todo indentado correctamente dentro del try
    try:
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
    
    # 🔥 FIX: El bloque except que faltaba para evitar el crash y el falso CORS
    except Exception as e:
        db.rollback()
        trace = traceback.format_exc()
        print(f"🔥 ERROR EN RECAP: {trace}")
        return JSONResponse(status_code=400, content={"detail": str(e), "trace": trace})

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
                    prompt = AI_SALUTE.format(user_name=user_name)
                    
                    try:
                        response = await client.chat.completions.create(
                            model="llama-3.3-70b-versatile",
                            messages=[{"role": "user", "content": prompt}],
                            temperature=1.1,
                            max_tokens=25
                        )
                        ai_salute = response.choices[0].message.content.strip().replace('"', '')
                    except Exception as e:
                        ai_salute = "¡A llorar a la llorería! 🃏" 

                    broadcast_msg = {
                        "type": "ai_suggestion",
                        "username": user_name,
                        "suggestion": ai_salute
                    }
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
                        recap_text = "**🎙️ AI Announcer:** Error de conexión con el estudio. ¡Pero vaya partida acabamos de presenciar! Felicidades al campeón."

                    broadcast_msg = {
                        "type": "ai_recap_broadcast",
                        "message": recap_text
                    }
                    await manager.broadcast(json.dumps(broadcast_msg), room_code)
                    continue
            except Exception as parse_error:
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

# ==============================================================
# 🔥 NUEVA SECCIÓN: GALERÍA HISTÓRICA E IMÁGENES
# ==============================================================

class ImageGenRequest(BaseModel):
    recap_text: str
    room_code: str 

class ReactionRequest(BaseModel):
    username: str
    reaction_emoji: str

@app.post("/game/recap/image/")
async def generate_recap_image(req: ImageGenRequest, db: Session = Depends(get_db)):
    try:
        json_prompt = f"""
        Analyze this game recap: "{req.recap_text}"

        You must respond with a valid JSON object containing exactly 3 keys:
        1. "flux_prompt": A highly detailed, absurdly epic and hilarious image generation prompt in English. 
           ART STYLE: Over-the-top, dynamic comic book or epic anime showdown. 
           ENVIRONMENT: Set the scene in a majestic or iconic Ecuadorian location. Add a confused local animal watching the chaos.
           ACTION: Focus on the winning/losing players.
           MANDATORY RULE: ABSOLUTELY NO SPEECH BUBBLES, NO WORDS, NO LETTERS IN THE IMAGE.
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
        flux_prompt = prompt_data.get("flux_prompt", "Comic book scene.")
        display_en = prompt_data.get("display_en", "A chaotic match.")
        display_es = prompt_data.get("display_es", "Una partida loca.")

        clean_prompt = re.sub(r'[^a-zA-Z0-9\s]', '', flux_prompt).strip()
        clean_prompt = clean_prompt[:200]
        encoded_prompt = urllib.parse.quote(clean_prompt)
        
        seed = random.randint(1, 1000000)
        
        # 🔥 LA URL CORRECTA PARA LA API DE IMÁGENES:
        pollinations_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&seed={seed}"

        # 🔥 MAGIA DE DEBUGGING: Imprimimos la URL en tu terminal
        print(f"\n=======================================================")
        print(f"🖼️ DALE CLIC A ESTE LINK PARA VER SI FUNCIONA:")
        print(f"{pollinations_url}")
        print(f"=======================================================\n")

        # GUARDAR EN BASE DE DATOS
        db_room = db.query(models.Room).filter(models.Room.room_code == req.room_code).first()

        new_image_id = None
        if db_room:
            new_image = models.GalleryImage(
                room_id=db_room.id,
                image_url=pollinations_url,
                prompt_en=display_en,
                prompt_es=display_es
            )
            db.add(new_image)
            db.commit()
            db.refresh(new_image)
            new_image_id = new_image.id

        return {
            "image_id": new_image_id,
            "image_data": pollinations_url,
            "visual_prompt": {
                "en": display_en,
                "es": display_es
            }
        }

    # 🔥 FIX: El bloque except que faltaba para evitar el falso CORS aquí también
    except Exception as e:
        db.rollback()
        trace = traceback.format_exc()
        print(f"🔥 ERROR EN IMAGEN: {trace}")
        return JSONResponse(status_code=400, content={"detail": str(e), "trace": trace})

@app.get("/rooms/{room_code}/gallery/")
def get_room_gallery(room_code: str, db: Session = Depends(get_db)):
    try:
        db_room = db.query(models.Room).filter(models.Room.room_code == room_code).first()
        if not db_room:
            return [] 

        images = db.query(models.GalleryImage).filter(
            models.GalleryImage.room_id == db_room.id
        ).options(joinedload(models.GalleryImage.votes)).order_by(models.GalleryImage.created_at.desc()).all()

        gallery_data = []
        for img in images:
            reactions = {}
            for vote in img.votes:
                emoji = vote.reaction_emoji
                reactions[emoji] = reactions.get(emoji, 0) + 1

            gallery_data.append({
                "id": img.id,
                "url": img.image_url,
                "prompt_en": img.prompt_en,
                "prompt_es": img.prompt_es,
                "created_at": img.created_at,
                "reactions": reactions,
                "raw_votes": [{"user": v.username, "emoji": v.reaction_emoji} for v in img.votes]
            })
        
        return gallery_data
    except Exception as e:
        print(f"🔥 Error en Galería: {e}")
        return []

@app.post("/gallery/{image_id}/react/")
def toggle_reaction(image_id: int, req: ReactionRequest, db: Session = Depends(get_db)):
    try:
        image = db.query(models.GalleryImage).filter(models.GalleryImage.id == image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        existing_vote = db.query(models.ImageVote).filter(
            models.ImageVote.image_id == image_id,
            models.ImageVote.username == req.username,
            models.ImageVote.reaction_emoji == req.reaction_emoji
        ).first()

        action = ""
        if existing_vote:
            db.delete(existing_vote)
            action = "removed"
        else:
            new_vote = models.ImageVote(
                image_id=image_id,
                username=req.username,
                reaction_emoji=req.reaction_emoji
            )
            db.add(new_vote)
            action = "added"

        db.commit()
        return {"status": "success", "action": action, "emoji": req.reaction_emoji}
    except Exception as e:
        db.rollback()
        trace = traceback.format_exc()
        print(f"🔥 ERROR EN REACCIÓN: {trace}")
        return JSONResponse(status_code=400, content={"detail": str(e), "trace": trace})
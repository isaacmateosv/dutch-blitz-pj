from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
from database import get_db
from sqlalchemy import func

# This prefix means we don't have to type "/rooms" on every single route below
router = APIRouter(
    prefix="/rooms",
    tags=["Rooms"]
)

# Move the Pydantic model here since it's only used by these routes
class RoomCreate(BaseModel):
    room_code: str

@router.post("/")
def create_room(room: RoomCreate, db: Session = Depends(get_db)):
    db_room = models.Room(room_code=room.room_code)
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room

@router.delete("/{room_code}")
def delete_room(room_code: str, db: Session = Depends(get_db)):
    db_room = db.query(models.Room).filter(models.Room.room_code == room_code).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Thanks to the cascade in models.py, this deletes the room and ALL its scores
    db.delete(db_room)
    db.commit()
    return {"status": "success", "message": "Room obliterated."}

@router.get("/{room_code}/history/")
def get_room_history(room_code: str, db: Session = Depends(get_db)):
    db_room = db.query(models.Room).filter(models.Room.room_code == room_code).first()
    if not db_room:
        return []

    # 🔥 EL VERDADERO HALL OF FAME: Agrupamos por jugador y sacamos su récord máximo
    hall_of_fame = db.query(
        models.Score.player_name,
        func.max(models.Score.total_score).label('highest_score')
    ).filter(
        models.Score.room_id == db_room.id
    ).group_by(
        models.Score.player_name
    ).order_by(
        func.max(models.Score.total_score).desc()
    ).limit(10).all()
    
    # Formateamos la respuesta para que el frontend la lea sin problemas
    history_formatted = [
        {
            "id": f"rank_{idx}", # Creamos un ID falso para el key de React
            "player_name": record.player_name, 
            "total_score": record.highest_score
        } 
        for idx, record in enumerate(hall_of_fame)
    ]
    
    return history_formatted
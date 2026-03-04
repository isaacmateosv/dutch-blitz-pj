from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
from database import engine, SessionLocal

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

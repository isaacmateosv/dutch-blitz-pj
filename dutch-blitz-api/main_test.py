from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# Pydantic models for data validation
class UserCreate(BaseModel):
    username: str

class RoomCreate(BaseModel):
    room_code: str

@app.get("/")
def read_root():
    return {"message": "Dutch Blitz API is running!"}

@app.post("/users/")
def create_user(user: UserCreate):
    # Later, this will save to PostgreSQL. For now, we just return the data.
    return {"message": f"User '{user.username}' created successfully!"}

@app.post("/rooms/")
def create_room(room: RoomCreate):
    # E.g., creating a room for testing with dummy players like Bruce or Judie
    return {"message": f"Room '{room.room_code}' created! Waiting for players..."}

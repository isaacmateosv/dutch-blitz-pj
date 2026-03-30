from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime, timezone

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)

class Room(Base):
    __tablename__ = 'rooms'
    id = Column(Integer, primary_key=True, index=True)
    room_code = Column(String, unique=True, index=True)
    status = Column(String, default="waiting") # waiting, playing, finished
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # 🔥 NEW: Authentication Wall Logic
    is_permanent = Column(Boolean, default=False)
    created_by = Column(String, nullable=True) 

    # Cascade: If a room is deleted, all its scores are wiped clean too.
    scores = relationship("Score", back_populates="room", cascade="all, delete-orphan")

class Score(Base):
    __tablename__ = 'scores'
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey('rooms.id'))
    
    # Core Data
    player_name = Column(String, index=True) 
    
    # Analytics / Stats (Defaulting to 0/1 so it doesn't break if the UI doesn't send them yet)
    round_number = Column(Integer, default=1)
    blitz_pile_cards = Column(Integer, default=0) 
    dutch_pile_cards = Column(Integer, default=0) 
    total_score = Column(Integer, default=0)

    # The wire connecting this score back to the room
    room = relationship("Room", back_populates="scores")
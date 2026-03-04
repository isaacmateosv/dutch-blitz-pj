from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)

class Room(Base):
    __tablename__ = 'rooms'
    id = Column(Integer, primary_key=True, index=True)
    room_code = Column(String, unique=True, index=True)
    status = Column(String, default="waiting") # Statuses: waiting, playing, finished

class Score(Base):
    __tablename__ = 'scores'
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey('rooms.id'))
    user_id = Column(Integer, ForeignKey('users.id'))
    round_number = Column(Integer)
    blitz_pile_cards = Column(Integer) # Usually 0, or remaining cards (x -2 points)
    dutch_pile_cards = Column(Integer) # Cards played in the center (x +1 point)

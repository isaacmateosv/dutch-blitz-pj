from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
# 🔥 FIX: Importamos datetime y timezone que faltaban para el modelo Room
from datetime import datetime, timezone 

# 🔥 FIX: Eliminada la línea "Base = declarative_base()" porque ya 
# lo estás importando correctamente desde tu archivo "database" arriba.

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)

class Room(Base):
    __tablename__ = 'rooms'
    id = Column(Integer, primary_key=True, index=True)
    room_code = Column(String, unique=True, index=True)
    status = Column(String, default="waiting") # waiting, playing, finished
    
    # 🔥 FIX: ¡Añadimos la columna que faltaba!
    target_score = Column(Integer, default=75) 
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    is_permanent = Column(Boolean, default=False)
    created_by = Column(String, nullable=True) 

    scores = relationship("Score", back_populates="room", cascade="all, delete-orphan")
    gallery_images = relationship("GalleryImage", back_populates="room")

class Score(Base):
    __tablename__ = 'scores'
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey('rooms.id'))
    
    player_name = Column(String, index=True) 
    
    round_number = Column(Integer, default=1)
    blitz_pile_cards = Column(Integer, default=0) 
    dutch_pile_cards = Column(Integer, default=0) 
    total_score = Column(Integer, default=0)

    room = relationship("Room", back_populates="scores")

    
class GalleryImage(Base):
    __tablename__ = "gallery_images"

    # 🔥 FIX: primary_key=True (con guion bajo)
    id = Column(Integer, primary_key=True, index=True) 
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    image_url = Column(String, nullable=False)
    prompt_en = Column(String, nullable=False)
    prompt_es = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 🔥 FIX: Agregada la relación inversa obligatoria para que "Room" pueda conectarse
    room = relationship("Room", back_populates="gallery_images") 
    votes = relationship("ImageVote", back_populates="image", cascade="all, delete-orphan")

class ImageVote(Base):
    __tablename__ = "image_votes"

    # 🔥 FIX: primary_key=True (con guion bajo)
    id = Column(Integer, primary_key=True, index=True) 
    image_id = Column(Integer, ForeignKey("gallery_images.id"), nullable=False)
    username = Column(String, nullable=False) 
    reaction_emoji = Column(String, nullable=False) 

    image = relationship("GalleryImage", back_populates="votes")
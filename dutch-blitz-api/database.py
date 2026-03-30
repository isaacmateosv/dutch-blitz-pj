import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base 
from dotenv import load_dotenv

print(f"Current working directory: {os.getcwd()}")
print(f"Script location: {__file__}")

# Load environment variables from .env file
load_dotenv()  

# Fetch the Supabase URL from your .env file
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# The engine is the actual connection to the database
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    pool_pre_ping=True
)

# This creates database sessions for our API requests
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Es el molde para tus tablas
Base = declarative_base()

# 🔥 ADD THIS MISSING FUNCTION:
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
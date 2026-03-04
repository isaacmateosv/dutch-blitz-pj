import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

print(f"Current working directory: {os.getcwd()}")
print(f"Script location: {__file__}")


# Load environment variables from .env file
load_dotenv()  # Will search from current working directory upward
print(f"DB_USER: {os.getenv('DB_USER')}")

# Get database credentials from environment variables
DB_USER = os.getenv("DB_USER", "postgres")  # Default to "postgres" if not set
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "dutchblitz")

# Build the database URL from components
SQLALCHEMY_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# The engine is the actual connection to the database
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# This creates database sessions for our API requests
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

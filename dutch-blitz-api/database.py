from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Update this URL with your local PostgreSQL credentials
# Format: postgresql://username:password@localhost/database_name
SQLALCHEMY_DATABASE_URL = "postgresql://dutchblitzuser:dutch-blitz-user-passphrase_password@localhost/dutchblitz"

# The engine is the actual connection to the database
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# This creates database sessions for our API requests
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) 

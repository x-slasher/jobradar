from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import get_settings
import os

settings = get_settings()

os.makedirs(settings.CV_UPLOAD_DIR, exist_ok=True)

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # reconnect on stale connections
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

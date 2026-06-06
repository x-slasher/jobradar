from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, Text, JSON, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    location = Column(String(255), nullable=True)
    job_type = Column(String(50), nullable=True)           # remote/hybrid/onsite
    experience_level = Column(String(50), nullable=True)   # junior/mid/senior
    location_region = Column(String(100), nullable=True)
    tech_stack = Column(JSON, nullable=True)               # list of strings
    description_json = Column(JSON, nullable=True)         # full normalized job data
    url = Column(String(1000), nullable=False)
    fingerprint = Column(String(64), unique=True, index=True, nullable=False)
    score = Column(Float, nullable=True)
    analysis = Column(Text, nullable=True)
    status = Column(String(20), default="new", nullable=False)  # new/interested/applied/skipped
    posted_at = Column(DateTime, nullable=True)
    fetched_at = Column(DateTime, server_default=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    cv_version_id = Column(Integer, ForeignKey("cv_versions.id"), nullable=True)


class CVVersion(Base):
    __tablename__ = "cv_versions"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    summary = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)


class UserFilter(Base):
    __tablename__ = "user_filters"

    id = Column(Integer, primary_key=True, index=True)
    role_titles = Column(JSON, nullable=True)         # ["Backend Engineer", "Software Engineer"]
    experience_level = Column(JSON, nullable=True)    # ["mid", "senior"]
    location_type = Column(JSON, nullable=True)       # ["remote", "hybrid"]
    location_region = Column(JSON, nullable=True)     # ["Asia", "Anywhere"]
    tech_stack = Column(JSON, nullable=True)          # ["Python", "FastAPI", "Docker"]
    min_score_threshold = Column(Float, default=0.0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Platform(Base):
    __tablename__ = "platforms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

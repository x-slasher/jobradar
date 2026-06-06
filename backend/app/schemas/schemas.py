from pydantic import BaseModel, HttpUrl, EmailStr, field_validator
from typing import Optional, List, Any
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be empty")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Job ───────────────────────────────────────────────────────────────────────

class JobBase(BaseModel):
    platform: str
    title: str
    company: str
    location: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    location_region: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    url: str
    posted_at: Optional[datetime] = None


class JobInDB(JobBase):
    id: int
    score: Optional[float] = None
    analysis: Optional[str] = None
    status: str
    fetched_at: datetime
    description_json: Optional[Any] = None

    class Config:
        from_attributes = True


class JobListItem(BaseModel):
    id: int
    platform: str
    title: str
    company: str
    location: Optional[str] = None
    job_type: Optional[str] = None
    score: Optional[float] = None
    status: str
    posted_at: Optional[datetime] = None
    fetched_at: datetime
    url: str

    class Config:
        from_attributes = True


class JobDetail(JobInDB):
    pass


class JobStatusUpdate(BaseModel):
    status: str  # new / interested / applied / skipped


class AnalysisData(BaseModel):
    summary: Optional[str] = None
    strengths: Optional[List[str]] = None
    gaps: Optional[List[str]] = None
    suggestions: Optional[List[str]] = None


class JobScoreUpdate(BaseModel):
    score: float  # 0-100
    analysis: Optional[AnalysisData] = None


class PaginatedJobResponse(BaseModel):
    items: List[JobListItem]
    total: int
    page: int
    limit: int
    total_pages: int


# ── CV ────────────────────────────────────────────────────────────────────────

class CVVersionResponse(BaseModel):
    id: int
    filename: str
    summary: Optional[str] = None
    uploaded_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


# ── Filters ───────────────────────────────────────────────────────────────────

class UserFilterRequest(BaseModel):
    role_titles: Optional[List[str]] = None
    experience_level: Optional[List[str]] = None
    location_type: Optional[List[str]] = None
    location_region: Optional[List[str]] = None
    tech_stack: Optional[List[str]] = None
    min_score_threshold: Optional[float] = 0.0


class UserFilterResponse(UserFilterRequest):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Task ──────────────────────────────────────────────────────────────────────

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None

import os
import re
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.core.config import get_settings
from app.schemas.schemas import CVVersionResponse
from app.services.cv_service import (
    extract_text_from_pdf,
    generate_cv_summary,
    save_cv_version,
    get_all_cv_versions,
)

settings = get_settings()
router = APIRouter(prefix="/cv", tags=["cv"])


MAX_CV_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def _safe_filename(filename: str) -> str:
    name = os.path.basename(filename)
    name = re.sub(r"[^\w.\- ]", "_", name)
    return name or "cv.pdf"


@router.post("/upload", response_model=CVVersionResponse)
async def upload_cv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    content = await file.read()

    if len(content) > MAX_CV_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File too large — maximum size is 10 MB")

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF")

    os.makedirs(settings.CV_UPLOAD_DIR, exist_ok=True)
    safe_name = _safe_filename(file.filename)
    file_path = os.path.join(settings.CV_UPLOAD_DIR, safe_name)

    with open(file_path, "wb") as f:
        f.write(content)

    try:
        raw_text = extract_text_from_pdf(file_path)
        summary = generate_cv_summary(raw_text)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {str(e)}")

    cv = save_cv_version(db, filename=safe_name, file_path=file_path, summary=summary)
    return cv


@router.get("", response_model=List[CVVersionResponse])
def list_cv_versions(
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return get_all_cv_versions(db)


@router.get("/active", response_model=CVVersionResponse)
def get_active_cv(
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    from app.models.models import CVVersion
    cv = db.query(CVVersion).filter(CVVersion.is_active == True).first()
    if not cv:
        raise HTTPException(status_code=404, detail="No active CV found")
    return cv


@router.post("/{cv_id}/activate", response_model=CVVersionResponse)
def activate_cv(
    cv_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    from app.models.models import CVVersion
    cv = db.query(CVVersion).filter(CVVersion.id == cv_id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV version not found")

    db.query(CVVersion).update({"is_active": False})
    cv.is_active = True
    db.commit()
    db.refresh(cv)
    return cv



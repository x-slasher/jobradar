import os
import pdfplumber
from sqlalchemy.orm import Session
from app.models.models import CVVersion
from app.core.config import get_settings
import logging

settings = get_settings()
logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> str:
    """Extract raw text from a PDF file using pdfplumber."""
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        logger.error(f"CV: PDF extraction failed: {e}")
        raise
    return text.strip()


def generate_cv_summary(full_text: str) -> str:
    """
    Produce a clean, concise CV summary (~300 words) from extracted text.
    This summary is what gets sent to Claude with every job match request.
    We trim whitespace and limit to the most relevant sections.
    """
    lines = [line.strip() for line in full_text.splitlines() if line.strip()]
    # Keep first 400 lines max to avoid bloating the prompt
    trimmed = "\n".join(lines[:400])
    # Hard cap at 3000 characters for token efficiency
    return trimmed[:3000]


def save_cv_version(
    db: Session,
    filename: str,
    file_path: str,
    summary: str,
) -> CVVersion:
    """Deactivate all existing CVs, then save the new one as active."""
    db.query(CVVersion).update({"is_active": False})
    db.commit()

    cv = CVVersion(
        filename=filename,
        file_path=file_path,
        summary=summary,
        is_active=True,
    )
    db.add(cv)
    db.commit()
    db.refresh(cv)
    logger.info(f"CV: Saved new version '{filename}' as active (id={cv.id})")
    return cv


def get_active_cv_summary(db: Session) -> str:
    """Return the summary of the currently active CV version."""
    cv = db.query(CVVersion).filter(CVVersion.is_active == True).first()
    if not cv:
        raise ValueError("No active CV found. Please upload your CV first.")
    return cv.summary


def get_all_cv_versions(db: Session):
    return db.query(CVVersion).order_by(CVVersion.uploaded_at.desc()).all()

import hashlib
import re
from app.services.scrapers.base import NormalizedJob
from sqlalchemy.orm import Session
from app.models.models import Job
import logging

logger = logging.getLogger(__name__)


def generate_fingerprint(job: NormalizedJob) -> str:
    """
    Generate a unique fingerprint from:
    - normalized company name
    - normalized job title
    - first 200 characters of description
    """
    company = re.sub(r"\s+", "", job.company.lower().strip())
    title = re.sub(r"\s+", "", job.title.lower().strip())
    desc_snippet = job.description[:200].lower().strip() if job.description else ""

    raw = f"{company}|{title}|{desc_snippet}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def is_duplicate(fingerprint: str, db: Session) -> bool:
    """Check if a job with this fingerprint already exists in the database."""
    exists = db.query(Job).filter(Job.fingerprint == fingerprint).first()
    return exists is not None


def deduplicate_jobs(jobs: list[NormalizedJob], db: Session) -> list[tuple[NormalizedJob, str]]:
    """
    Returns a list of (job, fingerprint) tuples for jobs that are NOT duplicates.
    Deduplicates within the batch as well as against the database.
    """
    seen_fingerprints = set()
    unique_jobs = []

    for job in jobs:
        fingerprint = generate_fingerprint(job)

        # Skip if already seen in this batch
        if fingerprint in seen_fingerprints:
            logger.debug(f"Dedup (batch): Skipping {job.title} at {job.company}")
            continue

        # Skip if already in database
        if is_duplicate(fingerprint, db):
            logger.debug(f"Dedup (db): Skipping {job.title} at {job.company}")
            continue

        seen_fingerprints.add(fingerprint)
        unique_jobs.append((job, fingerprint))

    logger.info(f"Dedup: {len(jobs)} jobs → {len(unique_jobs)} unique")
    return unique_jobs

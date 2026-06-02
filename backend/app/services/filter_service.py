from typing import List, Tuple
from app.services.scrapers.base import NormalizedJob
from app.models.models import UserFilter
import logging

logger = logging.getLogger(__name__)


def apply_filters(
    jobs: List[Tuple[NormalizedJob, str]],
    user_filter: UserFilter,
) -> List[Tuple[NormalizedJob, str]]:
    """
    Filter normalized jobs against user-defined preferences.
    Only jobs passing ALL active filters are forwarded to Claude.
    Returns list of (job, fingerprint) tuples.
    """
    if not user_filter:
        logger.info("Filter: No user filter defined — passing all jobs to Claude")
        return jobs

    filtered = []

    for job, fingerprint in jobs:
        if not _passes_filter(job, user_filter):
            logger.debug(f"Filter: Excluded '{job.title}' at '{job.company}'")
            continue
        filtered.append((job, fingerprint))

    logger.info(f"Filter: {len(jobs)} jobs → {len(filtered)} passed filter")
    return filtered


def _passes_filter(job: NormalizedJob, f: UserFilter) -> bool:
    # Role title filter — check if any preferred title keyword appears in job title
    if f.role_titles:
        title_lower = job.title.lower()
        if not any(rt.lower() in title_lower for rt in f.role_titles):
            return False

    # Experience level filter
    if f.experience_level and job.experience_level:
        if job.experience_level not in f.experience_level:
            return False

    # Location type filter (remote/hybrid/onsite)
    if f.location_type and job.job_type:
        if job.job_type not in f.location_type:
            return False

    # Location region filter
    if f.location_region and job.location_region:
        region_lower = job.location_region.lower()
        if not any(lr.lower() in region_lower for lr in f.location_region):
            # Allow "anywhere" to pass all region filters
            if "anywhere" not in region_lower:
                return False

    # Tech stack filter — job must contain at least ONE preferred tech
    if f.tech_stack and job.tech_stack:
        preferred = {t.lower() for t in f.tech_stack}
        job_tech = {t.lower() for t in job.tech_stack}
        if not preferred.intersection(job_tech):
            return False

    return True

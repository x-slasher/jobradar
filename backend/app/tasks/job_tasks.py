import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.tasks.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.models import Job, Platform
from app.services.scrapers.weworkremotely import WeWorkRemotelyScraper
from app.services.scrapers.himalayas import HimalayanScraper
from app.services.scrapers.arcdev import ArcDevScraper
from app.services.scrapers.remoteok import RemoteOKScraper
from app.services.scrapers.workingnomads import WorkingNomadsScraper
from app.services.scrapers.empllo import EmplloScraper
from app.services.scrapers.remotive import RemotiveScraper
from app.services.scrapers.arbeitnow import ArbeitnowScraper
from app.services.deduplicator import deduplicate_jobs
from app.services.filter_service import apply_filters
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

SCRAPERS = [
    WeWorkRemotelyScraper(),
    HimalayanScraper(),
    ArcDevScraper(),
    RemoteOKScraper(),
    WorkingNomadsScraper(),
    EmplloScraper(),
    RemotiveScraper(),
    ArbeitnowScraper(),
]


@celery_app.task(bind=True, name="app.tasks.job_tasks.run_daily_job_pipeline")
def run_daily_job_pipeline(self):
    logger.info("Pipeline: Starting daily job pipeline")
    self.update_state(state="STARTED", meta={"step": "initializing"})
    db = SessionLocal()
    try:
        cleanup_old_jobs(db)
        now = datetime.now(timezone.utc)
        to_dt = now
        from_dt = now - timedelta(hours=settings.JOB_FETCH_WINDOW_HOURS)
        logger.info(f"Pipeline: Fetch window {from_dt} -> {to_dt}")

        self.update_state(state="PROGRESS", meta={"step": "fetching"})
        all_jobs = asyncio.run(fetch_all_platforms(db, from_dt, to_dt))

        self.update_state(state="PROGRESS", meta={"step": "deduplicating"})
        unique_jobs = deduplicate_jobs(all_jobs, db)

        self.update_state(state="PROGRESS", meta={"step": "filtering"})
        from app.models.models import UserFilter
        user_filter = db.query(UserFilter).first()
        filtered_jobs = apply_filters(unique_jobs, user_filter)

        self.update_state(state="PROGRESS", meta={"step": "saving"})
        saved_count = 0
        for job, fingerprint in filtered_jobs:
            try:
                db_job = Job(
                    platform=job.platform, title=job.title, company=job.company,
                    location=job.location, job_type=job.job_type,
                    experience_level=job.experience_level, location_region=job.location_region,
                    tech_stack=job.tech_stack, description_json=job.raw,
                    url=job.url, fingerprint=fingerprint,
                    status="new", posted_at=job.posted_at,
                )
                db.add(db_job)
                db.commit()
                saved_count += 1
            except Exception as e:
                logger.error(f"Pipeline: Failed to save '{job.title}': {e}")
                db.rollback()

        logger.info(f"Pipeline: Complete - {saved_count} jobs saved")
        return {
            "status": "success",
            "fetched": len(all_jobs),
            "unique": len(unique_jobs),
            "filtered": len(filtered_jobs),
            "saved": saved_count,
        }
    except Exception as e:
        logger.error(f"Pipeline: Fatal error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


async def fetch_all_platforms(db: Session, from_dt: datetime, to_dt: datetime):
    active_platforms = {p.name for p in db.query(Platform).filter(Platform.is_active == True).all()}
    tasks = [s.fetch(from_dt, to_dt) for s in SCRAPERS if s.PLATFORM_NAME in active_platforms]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    all_jobs = []
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Pipeline: Scraper failed: {result}")
        else:
            all_jobs.extend(result)
    return all_jobs


def cleanup_old_jobs(db: Session):
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.JOB_RETENTION_DAYS)
    deleted = db.query(Job).filter(Job.fetched_at < cutoff).delete(synchronize_session=False)
    db.commit()
    logger.info(f"Cleanup: Deleted {deleted} jobs older than {settings.JOB_RETENTION_DAYS} days")

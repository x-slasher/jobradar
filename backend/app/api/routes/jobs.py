from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import Optional
from math import ceil
import json

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import Job
from app.schemas.schemas import (
    JobListItem, JobDetail, JobStatusUpdate, JobScoreUpdate,
    PaginatedJobResponse, TaskStatusResponse
)

router = APIRouter(prefix="/jobs", tags=["jobs"])

VALID_STATUSES = {"new", "interested", "applied", "skipped"}
VALID_SORT_FIELDS = {"score", "posted_at", "fetched_at", "platform", "title", "status"}
VALID_ORDERS = {"asc", "desc"}


@router.get("", response_model=PaginatedJobResponse)
def list_jobs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="fetched_at"),
    order: str = Query(default="desc"),
    platform: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    score_min: Optional[float] = Query(default=None),
    score_max: Optional[float] = Query(default=None),
    title: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if sort_by not in VALID_SORT_FIELDS:
        sort_by = "fetched_at"
    if order not in VALID_ORDERS:
        order = "desc"

    query = db.query(Job).filter(Job.is_deleted == False)

    if platform:
        query = query.filter(Job.platform == platform)
    if status:
        query = query.filter(Job.status == status)
    if score_min is not None:
        query = query.filter(Job.score >= score_min)
    if score_max is not None:
        query = query.filter(Job.score <= score_max)
    if title:
        query = query.filter(Job.title.ilike(f"%{title}%"))

    total = query.count()

    sort_col = getattr(Job, sort_by, Job.fetched_at)
    query = query.order_by(desc(sort_col) if order == "desc" else asc(sort_col))

    offset = (page - 1) * limit
    jobs = query.offset(offset).limit(limit).all()

    return PaginatedJobResponse(
        items=jobs,
        total=total,
        page=page,
        limit=limit,
        total_pages=ceil(total / limit) if total > 0 else 1,
    )


@router.get("/{job_id}", response_model=JobDetail)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id, Job.is_deleted == False).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/{job_id}/score")
def save_job_score(
    job_id: int,
    body: JobScoreUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Save a manually entered score and analysis for a job."""
    job = db.query(Job).filter(Job.id == job_id, Job.is_deleted == False).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.score = max(0.0, min(100.0, body.score))
    job.analysis = json.dumps(body.analysis.model_dump()) if body.analysis else None
    db.commit()
    return {"message": "Score saved"}


@router.patch("/{job_id}/status")
def update_job_status(
    job_id: int,
    body: JobStatusUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {VALID_STATUSES}",
        )
    job = db.query(Job).filter(Job.id == job_id, Job.is_deleted == False).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = body.status
    db.commit()
    return {"message": f"Status updated to '{body.status}'"}


@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}


@router.post("/trigger", response_model=TaskStatusResponse)
def trigger_pipeline(
    _: str = Depends(get_current_user),
):
    """Manually trigger the daily job pipeline."""
    from app.tasks.job_tasks import run_daily_job_pipeline
    task = run_daily_job_pipeline.delay()
    return TaskStatusResponse(
        task_id=task.id,
        status="queued",
        message="Daily pipeline triggered manually",
    )



@router.get("/task/{task_id}", response_model=TaskStatusResponse)
def get_task_status(
    task_id: str,
    _: str = Depends(get_current_user),
):
    from app.tasks.celery_app import celery_app
    result = celery_app.AsyncResult(task_id)
    return TaskStatusResponse(
        task_id=task_id,
        status=result.status,
        message=str(result.result) if result.ready() else None,
    )

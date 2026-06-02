from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import UserFilter
from app.schemas.schemas import UserFilterRequest, UserFilterResponse

router = APIRouter(prefix="/filters", tags=["filters"])


@router.get("", response_model=UserFilterResponse)
def get_filters(
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    f = db.query(UserFilter).first()
    if not f:
        raise HTTPException(status_code=404, detail="No filters configured yet")
    return f


@router.put("", response_model=UserFilterResponse)
def save_filters(
    body: UserFilterRequest,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    f = db.query(UserFilter).first()

    if f:
        f.role_titles = body.role_titles
        f.experience_level = body.experience_level
        f.location_type = body.location_type
        f.location_region = body.location_region
        f.tech_stack = body.tech_stack
        f.min_score_threshold = body.min_score_threshold or 0.0
    else:
        f = UserFilter(
            role_titles=body.role_titles,
            experience_level=body.experience_level,
            location_type=body.location_type,
            location_region=body.location_region,
            tech_stack=body.tech_stack,
            min_score_threshold=body.min_score_threshold or 0.0,
        )
        db.add(f)

    db.commit()
    db.refresh(f)
    return f

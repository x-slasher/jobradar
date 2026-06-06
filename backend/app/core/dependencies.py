from fastapi import Depends, HTTPException, status, Cookie
from sqlalchemy.orm import Session
from typing import Optional
from app.core.security import decode_access_token
from app.db.database import get_db
from app.models.models import User


def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    if not access_token:
        raise credentials_exception

    email = decode_access_token(access_token)
    if email is None:
        raise credentials_exception

    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if user is None:
        raise credentials_exception

    return email

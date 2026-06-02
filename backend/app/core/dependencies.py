from fastapi import Depends, HTTPException, status, Cookie
from typing import Optional
from app.core.security import decode_access_token
from app.core.config import get_settings

settings = get_settings()


def get_current_user(access_token: Optional[str] = Cookie(default=None)) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    if not access_token:
        raise credentials_exception

    username = decode_access_token(access_token)
    if username is None:
        raise credentials_exception

    if username != settings.ADMIN_USERNAME:
        raise credentials_exception

    return username

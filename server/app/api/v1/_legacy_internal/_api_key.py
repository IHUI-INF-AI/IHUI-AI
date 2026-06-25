"""API key auth (migrated from client/backend/api/auth.py)."""
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.services._legacy_settings import settings

api_key_header = APIKeyHeader(name=settings.API_KEY_HEADER, auto_error=False)


def verify_api_key(api_key: str = Security(api_key_header)) -> str:
    if not settings.REQUIRE_API_KEY:
        return "anonymous"

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少API密钥",
        )

    if api_key not in settings.API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无效的API密钥",
        )

    return api_key

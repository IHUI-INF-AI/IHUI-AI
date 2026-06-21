"""
User schemas (Pydantic request/response models).
"""

from datetime import datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    """Create a new user."""

    uuid: str = Field(..., description="User UUID")
    password_hash: str | None = None
    nickname: str | None = None
    avatar: str | None = None
    phone: str | None = None
    invite_code: str | None = None


class UserUpdate(BaseModel):
    """Update user info."""

    nickname: str | None = None
    avatar: str | None = None
    phone: str | None = None
    gender: int | None = None


class UserOut(BaseModel):
    """User response."""

    uuid: str
    nickname: str | None = None
    avatar: str | None = None
    phone: str | None = None
    is_vip: int = 0
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    """Login request."""

    phone: str = Field(..., description="Phone number")
    password: str | None = None
    code: str | None = None  # SMS verification code


class LoginResponse(BaseModel):
    """Login response."""

    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    user: UserOut

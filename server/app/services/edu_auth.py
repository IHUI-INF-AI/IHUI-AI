"""edu_auth service - Authentication & SSO (migrated from ihui-ai-edu-auth-service).

Phase F: User (IHUI-AI) uses uuid + phone, no username/email field.
"""
from __future__ import annotations

import hashlib
import secrets
from typing import Optional, Tuple
from app.utils.datetime_helper import utcnow
from app.utils.redis_util import get_key, set_key

from sqlalchemy import or_, select

from app.models.user_models import User
from app.models.edu_models import EduAuthSsoKey
from app.services.edu_base import EduNotFoundError, EduPermissionError, EduValidationError


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()
    return pwd_hash, salt


def verify_password(password: str, pwd_hash: str, salt: str) -> bool:
    test_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(test_hash, pwd_hash)


def register_user(
    db: Session,
    username: str, password: str,
    phone: Optional[str] = None, email: Optional[str] = None,
    nickname: Optional[str] = None, invite_code: Optional[str] = None,
) -> dict:
    """Register a new user. Phase F: stores in User table (uuid PK) + UserAuthInfo."""
    if not username or len(username) < 3 or len(username) > 64:
        raise EduValidationError("username must be 3-64 chars")
    if not password or len(password) < 6:
        raise EduValidationError("password must be >= 6 chars")
    # Phase F: User uses uuid PK + phone; use username as uuid for simplicity
    user_uuid = username
    existing = db.execute(
        select(User).where(User.uuid == user_uuid)
    ).scalar_one_or_none()
    if existing:
        return {"uuid": existing.uuid, "phone": existing.phone, "nickname": existing.nickname}

    # Create user (with hashed password)
    pwd_hash, salt = hash_password(password)
    user = User(
        uuid=user_uuid,
        phone=phone or username,
        password_hash=pwd_hash,
        password_salt=salt,
        nickname=nickname or username,
    )
    db.add(user)
    db.flush()
    return {"uuid": user.uuid, "phone": user.phone, "nickname": user.nickname}


def login(db: Session, username: str, password: str) -> Tuple[dict, str, str]:
    """Login with username/password. Phase F: look up by phone or uuid."""
    user = db.execute(
        select(User).where(or_(
            User.uuid == username,
            User.phone == username,
        ))
    ).scalar_one_or_none()
    if not user:
        raise EduPermissionError("invalid credentials")
    if user.status != 1:
        raise EduPermissionError("account disabled")
    if not user.password_hash or not user.password_salt:
        raise EduPermissionError("invalid password format")
    if not verify_password(password, user.password_hash, user.password_salt):
        raise EduPermissionError("invalid credentials")
    user.last_login_at = utcnow()
    db.flush()
    access_token = f"edu_at_{secrets.token_urlsafe(32)}"
    refresh_token = f"edu_rt_{secrets.token_urlsafe(32)}"
    # 持久化 access_token 到 Redis (TTL 7天), 供 verify_edu_token 校验.
    # Redis 不可用时 set_key 静默失败, 降级为不校验 (保持原行为).
    set_key(f"edu:token:{access_token}", str(user.uuid), ex=7 * 24 * 3600)
    return {"uuid": user.uuid, "phone": user.phone, "nickname": user.nickname}, access_token, refresh_token


def verify_edu_token(token: str) -> Optional[str]:
    """校验 edu access_token, 返回对应的 user_uuid; 无效或 Redis 不可用时返回 None.

    Redis 不可用时 get_key 静默返回 None, 降级为不校验 (保持原行为).
    """
    if not token:
        return None
    return get_key(f"edu:token:{token}")


def update_profile(db: Session, user_uuid: str, **fields) -> User:
    user = db.execute(
        select(User).where(User.uuid == str(user_uuid))
    ).scalar_one_or_none()
    if user is None:
        raise EduNotFoundError("user", 0)
    allowed = {"nickname", "avatar", "gender", "phone"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(user, k, v)
    db.flush()
    db.refresh(user)
    return user


def change_password(db: Session, user_uuid: str, old_password: str, new_password: str) -> bool:
    user = db.execute(
        select(User).where(User.uuid == str(user_uuid))
    ).scalar_one_or_none()
    if user is None:
        raise EduNotFoundError("user", 0)
    if not verify_password(old_password, user.password_hash, user.password_salt):
        raise EduPermissionError("old password incorrect")
    new_hash, new_salt = hash_password(new_password)
    user.password_hash = new_hash
    user.password_salt = new_salt
    db.flush()
    return True


def get_user_by_id(db: Session, user_uuid: str) -> User:
    user = db.execute(
        select(User).where(User.uuid == str(user_uuid))
    ).scalar_one_or_none()
    if user is None:
        raise EduNotFoundError("user", 0)
    return user


# SSO (Phase F: stub)
def generate_sso_keypair(db: Session, client_id: str, name: Optional[str] = None):
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    return {"client_id": client_id, "public_key": public_pem}


def sso_login(db: Session, client_id: str, signed_jwt: str):
    from jose import jwt, JWTError
    key = db.execute(
        select(EduAuthSsoKey).where(EduAuthSsoKey.app_id == client_id)
    ).scalar_one_or_none()
    if not key:
        raise EduPermissionError("unknown client_id")
    try:
        payload = jwt.decode(signed_jwt, key.key_data, algorithms=["RS256"])
    except JWTError as e:
        raise EduPermissionError(f"invalid JWT: {e}")
    sso_user_id = payload.get("sub")
    if not sso_user_id:
        raise EduValidationError("JWT missing sub claim")
    return {"uuid": sso_user_id}, "access", "refresh"


# Third-party OAuth (Phase F: stub)
def third_party_login(db: Session, platform: str, code: str, user_info: Optional[dict] = None):
    if platform not in ("wechat", "dingtalk", "feishu", "wecom", "qq"):
        raise EduValidationError(f"unsupported platform: {platform}")
    if not user_info or "open_id" not in user_info:
        raise EduValidationError("user_info.open_id required")
    return {"uuid": user_info["open_id"]}, "access", "refresh"

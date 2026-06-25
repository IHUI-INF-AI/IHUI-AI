"""edu_auth service - Authentication & SSO (migrated from ihui-ai-edu-auth-service).

Source (junction access): G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-auth-service\\
Original package: com.yjs.cloud.learning.auth
Controllers: LoginController, SsoController, KeyPairController, ThirdPartyController
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduAuthUser, EduAuthSsoKey, EduAuthThirdParty
from app.services.edu_base import EduNotFoundError, EduPermissionError, EduValidationError, get_or_404


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """Hash password with PBKDF2. Returns (hash, salt)."""
    if salt is None:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()
    return pwd_hash, salt


def verify_password(password: str, pwd_hash: str, salt: str) -> bool:
    """Verify password against stored hash."""
    test_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(test_hash, pwd_hash)


# ============================================================================
# User CRUD (迁移自 LoginController + UserService)
# ============================================================================

def register_user(
    db: Session,
    username: str,
    password: str,
    phone: Optional[str] = None,
    email: Optional[str] = None,
    nickname: Optional[str] = None,
    invite_code: Optional[str] = None,
) -> EduAuthUser:
    """Register a new user."""
    if not username or len(username) < 3 or len(username) > 64:
        raise EduValidationError("username must be 3-64 chars")
    if not password or len(password) < 6:
        raise EduValidationError("password must be >= 6 chars")

    # Check uniqueness
    existing = db.execute(
        select(EduAuthUser).where(
            or_(EduAuthUser.username == username,
                phone and EduAuthUser.phone == phone,
                email and EduAuthUser.email == email)
        )
    ).scalar_one_or_none()
    if existing:
        if existing.username == username:
            raise EduValidationError("username already taken")
        if phone and existing.phone == phone:
            raise EduValidationError("phone already registered")
        if email and existing.email == email:
            raise EduValidationError("email already registered")

    pwd_hash, salt = hash_password(password)
    user = EduAuthUser(
        username=username,
        password_hash=f"{salt}${pwd_hash}",  # store salt + hash together
        phone=phone,
        email=email,
        nickname=nickname or username,
        status=1,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


def login(
    db: Session, username: str, password: str
) -> Tuple[EduAuthUser, str, str]:
    """Login with username/password. Returns (user, access_token, refresh_token)."""
    user = db.execute(
        select(EduAuthUser).where(
            or_(
                EduAuthUser.username == username,
                EduAuthUser.phone == username,
                EduAuthUser.email == username,
            )
        )
    ).scalar_one_or_none()
    if not user:
        raise EduPermissionError("invalid credentials")
    if user.status != 1:
        raise EduPermissionError("account disabled")
    if "$" not in user.password_hash:
        raise EduPermissionError("invalid password format")
    salt, pwd_hash = user.password_hash.split("$", 1)
    if not verify_password(password, pwd_hash, salt):
        raise EduPermissionError("invalid credentials")

    user.last_login_at = datetime.now(timezone.utc)
    db.flush()

    access_token = f"edu_at_{secrets.token_urlsafe(32)}"
    refresh_token = f"edu_rt_{secrets.token_urlsafe(32)}"
    return user, access_token, refresh_token


def update_profile(db: Session, user_id: int, **fields) -> EduAuthUser:
    """Update user profile (nickname, avatar, gender, etc.)."""
    user = get_or_404(db, EduAuthUser, user_id, "user")
    allowed = {"nickname", "avatar", "gender", "email", "phone"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(user, k, v)
    db.flush()
    db.refresh(user)
    return user


def change_password(db: Session, user_id: int, old_password: str, new_password: str) -> bool:
    """Change password."""
    user = get_or_404(db, EduAuthUser, user_id, "user")
    if "$" not in user.password_hash:
        raise EduValidationError("invalid password format")
    salt, pwd_hash = user.password_hash.split("$", 1)
    if not verify_password(old_password, pwd_hash, salt):
        raise EduPermissionError("old password incorrect")
    new_hash, new_salt = hash_password(new_password)
    user.password_hash = f"{new_salt}${new_hash}"
    db.flush()
    return True


def get_user_by_id(db: Session, user_id: int) -> EduAuthUser:
    return get_or_404(db, EduAuthUser, user_id, "user")


# ============================================================================
# SSO (迁移自 SsoController + KeyPairController)
# ============================================================================

def generate_sso_keypair(
    db: Session,
    client_id: str,
    name: Optional[str] = None,
) -> EduAuthSsoKey:
    """Generate RSA keypair for SSO client."""
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

    key = EduAuthSsoKey(
        client_id=client_id,
        public_key=public_pem,
        private_key=private_pem,
        name=name,
        is_active=True,
    )
    db.add(key)
    db.flush()
    db.refresh(key)
    return key


def sso_login(
    db: Session, client_id: str, signed_jwt: str
) -> Tuple[EduAuthUser, str, str]:
    """Verify JWT signed by SSO client and login user."""
    from jose import jwt, JWTError

    key = db.execute(
        select(EduAuthSsoKey).where(
            and_(EduAuthSsoKey.client_id == client_id, EduAuthSsoKey.status == True)
        )
    ).scalar_one_or_none()
    if not key:
        raise EduPermissionError("unknown client_id")

    try:
        payload = jwt.decode(signed_jwt, key.public_key, algorithms=["RS256"])
    except JWTError as e:
        raise EduPermissionError(f"invalid JWT: {e}")

    sso_user_id = payload.get("sub")
    if not sso_user_id:
        raise EduValidationError("JWT missing sub claim")

    # Auto-provision user if first SSO login
    user = db.get(EduAuthUser, int(sso_user_id))
    if not user:
        user = register_user(
            db, username=f"sso_{client_id}_{sso_user_id}",
            password=secrets.token_urlsafe(16),
            nickname=payload.get("name", f"SSO User {sso_user_id}"),
        )

    access_token = f"edu_at_{secrets.token_urlsafe(32)}"
    refresh_token = f"edu_rt_{secrets.token_urlsafe(32)}"
    return user, access_token, refresh_token


# ============================================================================
# Third-party login (迁移自 ThirdPartyController)
# ============================================================================

def third_party_login(
    db: Session,
    platform: str,
    code: str,
    user_info: Optional[dict] = None,
) -> Tuple[EduAuthUser, str, str]:
    """OAuth login from wechat/dingtalk/feishu/wecom/qq.

    Java source: ThirdPartyController.callback
    In production, exchange code for access_token via platform API.
    Simplified here: trust user_info directly.
    """
    if platform not in {"wechat", "dingtalk", "feishu", "wecom", "qq"}:
        raise EduValidationError(f"unsupported platform: {platform}")

    if not user_info or "open_id" not in user_info:
        raise EduValidationError("user_info.open_id required")

    open_id = user_info["open_id"]

    # Find existing binding
    binding = db.execute(
        select(EduAuthThirdParty).where(
            and_(
                EduAuthThirdParty.platform == platform,
                EduAuthThirdParty.open_id == open_id,
            )
        )
    ).scalar_one_or_none()

    if binding:
        user = db.get(EduAuthUser, binding.user_id)
    else:
        # Auto-provision new user
        username = f"{platform}_{open_id[:8]}"
        user = register_user(
            db, username=username, password=secrets.token_urlsafe(16),
            nickname=user_info.get("nickname", username),
            email=user_info.get("email"),
        )
        binding = EduAuthThirdParty(
            user_id=user.id, platform=platform, open_id=open_id,
            union_id=user_info.get("union_id"),
        )
        db.add(binding)
        db.flush()

    access_token = f"edu_at_{secrets.token_urlsafe(32)}"
    refresh_token = f"edu_rt_{secrets.token_urlsafe(32)}"
    return user, access_token, refresh_token

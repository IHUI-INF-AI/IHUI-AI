"""User management service."""

import logging

from app.database import get_session

logger = logging.getLogger(__name__)


def get_user_by_uuid(user_uuid: str) -> dict | None:
    with get_session() as db:
        from app.models.user_models import User, UserAuthInfo, UserMargin

        user = db.query(User).filter(User.uuid == user_uuid).first()
        if not user:
            return None
        margin = db.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
        auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
        return {
            "uuid": user.uuid,
            "nickname": user.nickname,
            "avatar": user.avatar,
            "gender": user.gender,
            "is_vip": user.is_vip,
            "status": user.status,
            "token_balance": margin.token_quantity if margin else 0,
            "phone": auth.phone if auth else None,
        }


def update_user(user_uuid: str, **kwargs) -> dict:
    with get_session() as db:
        from app.models.user_models import User

        user = db.query(User).filter(User.uuid == user_uuid).first()
        if not user:
            return {"success": False, "msg": "User not found"}
        for k, v in kwargs.items():
            if hasattr(user, k) and v is not None:
                setattr(user, k, v)
        return {"success": True}


def get_user_vip_info(user_uuid: str) -> dict:
    with get_session() as db:
        from app.models.user_models import User

        user = db.query(User).filter(User.uuid == user_uuid).first()
        if not user:
            return {"is_vip": 0, "found": False}
        return {"is_vip": user.is_vip or 0, "found": True}


def list_users(page: int = 1, limit: int = 20, keyword: str | None = None) -> dict:
    with get_session() as db:
        from app.models.user_models import User

        q = db.query(User)
        if keyword:
            q = q.filter(User.nickname.like(f"%{keyword}%"))
        total = q.count()
        users = q.offset((page - 1) * limit).limit(limit).all()
        return {
            "total": total,
            "page": page,
            "limit": limit,
            "users": [
                {
                    "uuid": u.uuid,
                    "nickname": u.nickname,
                    "avatar": u.avatar,
                    "is_vip": u.is_vip,
                }
                for u in users
            ],
        }

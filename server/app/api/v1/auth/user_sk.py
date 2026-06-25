"""User Secret Key (SK) management routes."""

import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.database import SessionFactory2
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter(prefix="/user-sk", tags=["User SK"])


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class SKCreateBody(BaseModel):
    """Body for creating a secret key. Additional fields may be set later."""

    pass


class SKUpdateBody(BaseModel):
    status: int | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_sk(sk) -> dict:
    return {
        "id": sk.id,
        "user_uuid": sk.user_uuid,
        "key": sk.key,
        "status": sk.status,
        "created_time": sk.created_time.isoformat() if sk.created_time else None,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/create", summary="Create a secret key")
def create_sk(
    body: SKCreateBody,
    user_uuid: str = Depends(require_login),
):
    """Generate a new secret key for the authenticated user."""
    from app.models.token_models import UserSKInfo

    db = SessionFactory2()
    try:
        sk_key = "sk-" + secrets.token_hex(24)
        sk = UserSKInfo(
            user_uuid=user_uuid,
            key=sk_key,
            status=1,
            created_time=datetime.now(UTC),
        )
        db.add(sk)
        db.commit()
        db.refresh(sk)
        return success(_serialize_sk(sk))
    except Exception as e:
        db.rollback()
        return error(str(e))
    finally:
        db.close()


@router.get("/list", summary="List user secret keys")
def list_sks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    """List all secret keys for the authenticated user with pagination."""
    from app.models.token_models import UserSKInfo

    db = SessionFactory2()
    try:
        total = db.query(UserSKInfo).filter(UserSKInfo.user_uuid == user_uuid).count()
        items = (
            db.query(UserSKInfo)
            .filter(UserSKInfo.user_uuid == user_uuid)
            .order_by(UserSKInfo.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return success([_serialize_sk(s) for s in items], total=total)
    finally:
        db.close()


@router.put("/{sk_id}", summary="Update a secret key")
def update_sk(
    sk_id: int,
    body: SKUpdateBody,
    user_uuid: str = Depends(require_login),
):
    """Update secret key name or status."""
    from app.models.token_models import UserSKInfo

    db = SessionFactory2()
    try:
        sk = db.query(UserSKInfo).filter(UserSKInfo.id == sk_id, UserSKInfo.user_uuid == user_uuid).first()
        if not sk:
            return error("Secret key not found", "404")
        update_data = body.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(sk, field, value)
        db.commit()
        db.refresh(sk)
        return success(_serialize_sk(sk))
    except Exception as e:
        db.rollback()
        return error(str(e))
    finally:
        db.close()


@router.delete("/{sk_id}", summary="Delete a secret key")
def delete_sk(
    sk_id: int,
    user_uuid: str = Depends(require_login),
):
    """Delete a secret key owned by the authenticated user."""
    from app.models.token_models import UserSKInfo

    db = SessionFactory2()
    try:
        sk = db.query(UserSKInfo).filter(UserSKInfo.id == sk_id, UserSKInfo.user_uuid == user_uuid).first()
        if not sk:
            return error("Secret key not found", "404")
        db.delete(sk)
        db.commit()
        return success({"deleted": sk_id})
    except Exception as e:
        db.rollback()
        return error(str(e))
    finally:
        db.close()

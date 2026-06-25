"""智能体创作/分享路由 -- Agent Creation & Sharing."""

import random
import string
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy import and_

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VALID_TYPES = {"image", "audio", "video", "text"}
VALID_OPERATE_TYPES = {"like", "collect"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _generate_share_code(length: int = 8) -> str:
    """Generate a random alphanumeric share code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


def _serialize_context(c) -> dict:
    """Serialize a UserAgentContext row."""
    return {
        "id": c.id,
        "gc_id": c.gc_id,
        "user_id": c.user_id,
        "agent_id": c.agent_id,
        "type": c.type,
        "title": c.title,
        "content": c.content,
        "cover_url": c.cover_url,
        "media_url": c.media_url,
        "like_count": c.like_count or 0,
        "collect_count": c.collect_count or 0,
        "share_count": c.share_count or 0,
        "status": c.status,
        "create_time": c.create_time.isoformat() if c.create_time else None,
        "update_time": c.update_time.isoformat() if c.update_time else None,
    }


def _serialize_share(s) -> dict:
    """Serialize a CreationShare row."""
    return {
        "id": s.id,
        "gc_id": s.gc_id,
        "share_code": s.share_code,
        "user_id": s.user_id,
        "expire_at": s.expire_at.isoformat() if s.expire_at else None,
        "create_time": s.create_time.isoformat() if s.create_time else None,
    }


# ---------------------------------------------------------------------------
# Models (lazy imports to avoid circular dependencies)
# ---------------------------------------------------------------------------


def _get_context_model():
    from app.models.agent_models import UserAgentContext

    return UserAgentContext


def _get_image_model():
    from app.models.agent_models import UserAgentImage

    return UserAgentImage


def _get_audio_model():
    from app.models.agent_models import UserAgentAudio

    return UserAgentAudio


def _get_operate_model():
    from app.models.agent_models import CreationOperate

    return CreationOperate


def _get_share_model():
    from app.models.agent_models import CreationShare

    return CreationShare


TYPE_MODEL_MAP = {
    "image": _get_image_model,
    "audio": _get_audio_model,
    "video": _get_context_model,  # video uses the same context table
    "text": _get_context_model,  # text uses the same context table
}


# ---------------------------------------------------------------------------
# POST /my/{type} - 我的创作列表
# ---------------------------------------------------------------------------


@router.post("/my/{type}", summary="我的创作列表")
def my_creations(
    type: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    """Return the current user's creations filtered by type."""
    if type not in VALID_TYPES:
        return error(f"无效的类型: {type},支持: {', '.join(sorted(VALID_TYPES))}")

    with get_session() as db:
        try:
            UserAgentContext = _get_context_model()
            q = db.query(UserAgentContext).filter(
                and_(
                    UserAgentContext.user_id == user_uuid,
                    UserAgentContext.type == type,
                )
            )
            total = q.count()
            items = q.order_by(UserAgentContext.create_time.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_serialize_context(c) for c in items], total=total)
        except Exception as e:
            logger.error(f"My creations error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# POST /share - 分享创作(生成分享码)
# ---------------------------------------------------------------------------


@router.post("/share", summary="分享创作(生成分享码)")
def share_creation(
    gc_id: str = Query(..., description="创作ID"),
    user_uuid: str = Depends(require_login),
):
    """Generate a share code for a creation."""
    with get_session() as db:
        try:
            CreationShare = _get_share_model()
            UserAgentContext = _get_context_model()

            # Verify the creation exists
            creation = db.query(UserAgentContext).filter(UserAgentContext.gc_id == gc_id).first()
            if not creation:
                return error("未找到该创作", code="404")

            # Check if already shared by this user
            existing = (
                db.query(CreationShare)
                .filter(
                    and_(
                        CreationShare.gc_id == gc_id,
                        CreationShare.user_id == user_uuid,
                    )
                )
                .first()
            )
            if existing:
                return success(_serialize_share(existing))

            # Generate unique share code
            share_code = _generate_share_code()
            while db.query(CreationShare).filter(CreationShare.share_code == share_code).first():
                share_code = _generate_share_code()

            share = CreationShare(
                gc_id=gc_id,
                share_code=share_code,
                user_id=user_uuid,
            )
            db.add(share)

            # Increment share count on the creation
            creation.share_count = (creation.share_count or 0) + 1

            db.commit()
            db.refresh(share)
            return success(_serialize_share(share))
        except Exception as e:
            logger.error(f"Share creation error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# GET /operate/{gc_id}/{type} - 点赞/收藏操作
# ---------------------------------------------------------------------------


@router.get("/operate/{gc_id}/{type}", summary="点赞/收藏操作")
def operate_creation(
    gc_id: str,
    type: str,
    user_uuid: str = Depends(require_login),
):
    """Toggle like or collect on a creation. Returns new state."""
    if type not in VALID_OPERATE_TYPES:
        return error(f"无效的操作类型: {type},支持: like, collect")

    with get_session() as db:
        try:
            CreationOperate = _get_operate_model()
            UserAgentContext = _get_context_model()

            # Verify creation exists
            creation = db.query(UserAgentContext).filter(UserAgentContext.gc_id == gc_id).first()
            if not creation:
                return error("未找到该创作", code="404")

            # Check existing operation
            existing = (
                db.query(CreationOperate)
                .filter(
                    and_(
                        CreationOperate.gc_id == gc_id,
                        CreationOperate.user_id == user_uuid,
                        CreationOperate.type == type,
                    )
                )
                .first()
            )

            if existing:
                # Toggle off -- remove operation, decrement count
                db.delete(existing)
                if type == "like":
                    creation.like_count = max(0, (creation.like_count or 0) - 1)
                else:
                    creation.collect_count = max(0, (creation.collect_count or 0) - 1)
                db.commit()
                return success({"gc_id": gc_id, "type": type, "active": False})
            else:
                # Toggle on -- add operation, increment count
                op = CreationOperate(
                    gc_id=gc_id,
                    user_id=user_uuid,
                    type=type,
                )
                db.add(op)
                if type == "like":
                    creation.like_count = (creation.like_count or 0) + 1
                else:
                    creation.collect_count = (creation.collect_count or 0) + 1
                db.commit()
                return success({"gc_id": gc_id, "type": type, "active": True})
        except Exception as e:
            logger.error(f"Operate creation error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# GET /share/third/{code} - 通过分享码获取创作
# ---------------------------------------------------------------------------


@router.get("/share/third/{code}", summary="通过分享码获取创作")
def get_creation_by_share_code(code: str):
    """Public endpoint -- retrieve a creation by its share code."""
    with get_session() as db:
        try:
            CreationShare = _get_share_model()
            UserAgentContext = _get_context_model()

            share = db.query(CreationShare).filter(CreationShare.share_code == code).first()
            if not share:
                return error("分享码无效或已过期", code="404")

            # Check expiry
            if share.expire_at and share.expire_at < datetime.now(UTC):
                return error("分享码已过期", code="410")

            creation = db.query(UserAgentContext).filter(UserAgentContext.gc_id == share.gc_id).first()
            if not creation:
                return error("未找到关联的创作", code="404")

            return success(
                {
                    "share": _serialize_share(share),
                    "creation": _serialize_context(creation),
                }
            )
        except Exception as e:
            logger.error(f"Get creation by share code error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# POST /share/code - 分享转CODE
# ---------------------------------------------------------------------------


@router.post("/share/code", summary="分享转CODE")
def share_to_code(
    gc_id: str = Query(..., description="创作ID"),
    user_uuid: str = Depends(require_login),
):
    """Convert a share reference to a code (alias for share creation)."""
    with get_session() as db:
        try:
            CreationShare = _get_share_model()
            UserAgentContext = _get_context_model()

            creation = db.query(UserAgentContext).filter(UserAgentContext.gc_id == gc_id).first()
            if not creation:
                return error("未找到该创作", code="404")

            existing = (
                db.query(CreationShare)
                .filter(
                    and_(
                        CreationShare.gc_id == gc_id,
                        CreationShare.user_id == user_uuid,
                    )
                )
                .first()
            )
            if existing:
                return success(
                    {
                        "code": existing.share_code,
                        "gc_id": gc_id,
                    }
                )

            share_code = _generate_share_code()
            while db.query(CreationShare).filter(CreationShare.share_code == share_code).first():
                share_code = _generate_share_code()

            share = CreationShare(
                gc_id=gc_id,
                share_code=share_code,
                user_id=user_uuid,
            )
            db.add(share)
            db.commit()
            return success(
                {
                    "code": share_code,
                    "gc_id": gc_id,
                }
            )
        except Exception as e:
            logger.error(f"Share to code error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# POST /share/image - 分享生成图片
# ---------------------------------------------------------------------------


@router.post("/share/image", summary="分享生成图片")
def share_generate_image(
    gc_id: str = Query(..., description="创作ID"),
    width: int = Query(800, ge=200, le=2000, description="图片宽度"),
    height: int = Query(600, ge=200, le=2000, description="图片高度"),
    user_uuid: str = Depends(require_login),
):
    """Generate a shareable image card for a creation."""
    with get_session() as db:
        try:
            UserAgentContext = _get_context_model()

            creation = db.query(UserAgentContext).filter(UserAgentContext.gc_id == gc_id).first()
            if not creation:
                return error("未找到该创作", code="404")

            # Build share image metadata (actual image rendering is delegated to frontend)
            share_image_data = {
                "gc_id": creation.gc_id,
                "title": creation.title,
                "type": creation.type,
                "cover_url": creation.cover_url,
                "like_count": creation.like_count or 0,
                "collect_count": creation.collect_count or 0,
                "width": width,
                "height": height,
                "generated_at": datetime.now(UTC).isoformat(),
            }
            return success(share_image_data)
        except Exception as e:
            logger.error(f"Share generate image error: {e}")
            return error(str(e))

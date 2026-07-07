"""行为模块路由 - 迁移自旧 Java Spring Boot behavior-service (2026-07-06).

包含: 浏览记录(记录浏览/浏览计数/我的列表/删除/清空).
点赞/收藏/评论已在 comment 模块实现, 此处仅保留浏览记录部分.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import EduWatchRecord
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 浏览记录
# ---------------------------------------------------------------------------


def _watch_to_dict(w: EduWatchRecord) -> dict:
    return {
        "id": w.id,
        "member_id": w.member_id,
        "topic_id": w.topic_id,
        "topic_type": w.topic_type,
        "topic_title": w.topic_title,
        "watch_duration": w.watch_duration,
        "last_position": w.last_position,
        "created_at": w.created_at.isoformat() if w.created_at else None,
        "updated_at": w.updated_at.isoformat() if w.updated_at else None,
    }


@router.post("/public-api/watch", summary="记录浏览")
async def record_watch(
    member_id: int = Body(..., description="会员id"),
    topic_id: int = Body(..., description="目标id"),
    topic_type: str = Body(..., max_length=50, description="目标类型: lesson/news/article/resource"),
    topic_title: str | None = Body(None, max_length=200, description="目标标题"),
    watch_duration: int = Body(0, ge=0, description="观看时长(秒)"),
    last_position: int = Body(0, ge=0, description="上次位置"),
):
    """记录/更新浏览记录. 若同一会员对同一目标已有记录则累加时长并更新位置."""
    with get_session() as db:
        try:
            existing = (
                db.query(EduWatchRecord)
                .filter(
                    EduWatchRecord.member_id == member_id,
                    EduWatchRecord.topic_id == topic_id,
                    EduWatchRecord.topic_type == topic_type,
                )
                .first()
            )
            if existing:
                existing.watch_duration = (existing.watch_duration or 0) + watch_duration
                existing.last_position = last_position
                if topic_title:
                    existing.topic_title = topic_title
                return success({"id": existing.id, "updated": True})
            w = EduWatchRecord(
                member_id=member_id,
                topic_id=topic_id,
                topic_type=topic_type,
                topic_title=topic_title,
                watch_duration=watch_duration,
                last_position=last_position,
            )
            db.add(w)
            db.flush()
            return success({"id": w.id, "updated": False})
        except Exception as e:
            logger.error(f"[edu behavior] record watch error: {e}")
            return error(str(e))


@router.get("/public-api/watch/count", summary="浏览计数")
async def watch_count(
    topic_id: int = Query(..., description="目标id"),
    topic_type: str = Query(..., description="目标类型: lesson/news/article/resource"),
):
    """统计指定目标的浏览次数(浏览记录条数)."""
    with get_session() as db:
        try:
            count = (
                db.query(EduWatchRecord)
                .filter(
                    EduWatchRecord.topic_id == topic_id,
                    EduWatchRecord.topic_type == topic_type,
                )
                .count()
            )
            return success({"topic_id": topic_id, "topic_type": topic_type, "count": count})
        except Exception as e:
            logger.error(f"[edu behavior] watch count error: {e}")
            return error(str(e))


@router.get("/auth-api/watch/list", summary="我的浏览记录列表")
async def my_watch_list(
    member_id: int = Query(..., description="会员id"),
    topic_type: str | None = Query(None, description="目标类型筛选: lesson/news/article/resource"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(EduWatchRecord).filter(EduWatchRecord.member_id == member_id)
            if topic_type:
                q = q.filter(EduWatchRecord.topic_type == topic_type)
            total = q.count()
            items = (
                q.order_by(EduWatchRecord.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_watch_to_dict(w) for w in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu behavior] my watch list error: {e}")
            return error(str(e))


@router.delete("/auth-api/watch", summary="删除浏览记录")
async def delete_watch(
    id: int = Query(..., description="浏览记录id"),
    member_id: int | None = Query(None, description="会员id(传入则校验归属)"),
):
    with get_session() as db:
        try:
            q = db.query(EduWatchRecord).filter(EduWatchRecord.id == id)
            if member_id is not None:
                q = q.filter(EduWatchRecord.member_id == member_id)
            w = q.first()
            if not w:
                return error("浏览记录不存在", "404")
            db.delete(w)
            return success()
        except Exception as e:
            logger.error(f"[edu behavior] delete watch error: {e}")
            return error(str(e))


@router.delete("/auth-api/watch/all", summary="清空浏览记录")
async def clear_all_watch(member_id: int = Query(..., description="会员id")):
    with get_session() as db:
        try:
            deleted = (
                db.query(EduWatchRecord)
                .filter(EduWatchRecord.member_id == member_id)
                .delete()
            )
            return success({"deleted": deleted})
        except Exception as e:
            logger.error(f"[edu behavior] clear all watch error: {e}")
            return error(str(e))

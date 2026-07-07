"""消息模块路由 - 迁移自旧 Java Spring Boot message-service (2026-07-05).

包含: 公告CRUD/站内消息查询.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import EduAnnouncement, EduMessage
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 公告
# ---------------------------------------------------------------------------


def _announcement_to_dict(a: EduAnnouncement, with_content: bool = True) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "content": a.content if with_content else None,
        "is_published": a.is_published,
        "is_top": a.is_top,
        "publish_time": a.publish_time.isoformat() if a.publish_time else None,
        "sort": a.sort,
        "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.get("/announcement/list", summary="公告列表")
async def announcement_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    title: str | None = None,
    is_published: bool | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduAnnouncement)
            if title:
                q = q.filter(EduAnnouncement.title.like(f"%{title}%"))
            if is_published is not None:
                q = q.filter(EduAnnouncement.is_published == is_published)
            if status is not None:
                q = q.filter(EduAnnouncement.status == status)
            total = q.count()
            items = (
                q.order_by(EduAnnouncement.is_top.desc(), EduAnnouncement.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_announcement_to_dict(a, with_content=False) for a in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu message] announcement list error: {e}")
            return error(str(e))


@router.get("/announcement", summary="公告详情", operation_id="edu_platform_message_get_announcement")
async def get_announcement(id: int = Query(..., description="公告id")):
    with get_session() as db:
        try:
            a = db.query(EduAnnouncement).filter(EduAnnouncement.id == id).first()
            if not a:
                return error("公告不存在", "404")
            return success(_announcement_to_dict(a, with_content=True))
        except Exception as e:
            logger.error(f"[edu message] get announcement error: {e}")
            return error(str(e))


@router.post("/announcement", summary="新建公告", operation_id="edu_platform_message_create_announcement")
async def create_announcement(
    title: str = Body(..., min_length=1, max_length=200),
    content: str | None = Body(None),
    is_published: bool = Body(False),
    is_top: bool = Body(False),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            a = EduAnnouncement(
                title=title,
                content=content,
                is_published=is_published,
                is_top=is_top,
                sort=sort,
                status=status,
            )
            db.add(a)
            db.flush()
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"[edu message] create announcement error: {e}")
            return error(str(e))


@router.put("/announcement", summary="更新公告", operation_id="edu_platform_message_update_announcement")
async def update_announcement(
    id: int = Body(...),
    title: str | None = Body(None),
    content: str | None = Body(None),
    is_published: bool | None = Body(None),
    is_top: bool | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            a = db.query(EduAnnouncement).filter(EduAnnouncement.id == id).first()
            if not a:
                return error("公告不存在", "404")
            if title is not None:
                a.title = title
            if content is not None:
                a.content = content
            if is_published is not None:
                a.is_published = is_published
            if is_top is not None:
                a.is_top = is_top
            if sort is not None:
                a.sort = sort
            if status is not None:
                a.status = status
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"[edu message] update announcement error: {e}")
            return error(str(e))


@router.delete("/announcement", summary="删除公告", operation_id="edu_platform_message_delete_announcement")
async def delete_announcement(data: dict = Body(..., description="包含 id 字段")):
    with get_session() as db:
        try:
            ann_id = data.get("id")
            if ann_id is None:
                return error("缺少 id 参数", "400")
            a = db.query(EduAnnouncement).filter(EduAnnouncement.id == ann_id).first()
            if not a:
                return error("公告不存在", "404")
            db.delete(a)
            return success()
        except Exception as e:
            logger.error(f"[edu message] delete announcement error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 站内消息(辅助查询)
# ---------------------------------------------------------------------------


def _message_to_dict(m: EduMessage) -> dict:
    return {
        "id": m.id,
        "member_id": m.member_id,
        "sender_id": m.sender_id,
        "title": m.title,
        "content": m.content,
        "msg_type": m.msg_type,
        "is_read": m.is_read,
        "ref_id": m.ref_id,
        "ref_type": m.ref_type,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


@router.get("/message/list", summary="站内消息列表")
async def message_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
    msg_type: str | None = None,
    is_read: bool | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduMessage)
            if member_id:
                q = q.filter(EduMessage.member_id == member_id)
            if msg_type:
                q = q.filter(EduMessage.msg_type == msg_type)
            if is_read is not None:
                q = q.filter(EduMessage.is_read == is_read)
            total = q.count()
            items = (
                q.order_by(EduMessage.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_message_to_dict(m) for m in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu message] message list error: {e}")
            return error(str(e))


@router.put("/message/read", summary="标记消息已读")
async def mark_message_read(
    id: int = Body(..., embed=True),
):
    with get_session() as db:
        try:
            m = db.query(EduMessage).filter(EduMessage.id == id).first()
            if not m:
                return error("消息不存在", "404")
            m.is_read = True
            return success({"id": m.id, "is_read": True})
        except Exception as e:
            logger.error(f"[edu message] mark message read error: {e}")
            return error(str(e))

"""消息通知 - 私信 CRUD + 会话管理 + 系统通知"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import or_

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.message_ext_models import (
    MessagePrivateLetter,
    MessageSystemNotice,
)
from app.schemas.common import error, success


class PrivateMessageCreateRequest(BaseModel):
    content: str = Field(..., min_length=1)


class SystemNoticeCreateRequest(BaseModel):
    content: str = Field(..., min_length=1)


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _p_to_dict(p: MessagePrivateLetter) -> dict:
    return {
        "id": p.id,
        "sender_id": p.sender_id,
        "receiver_id": p.receiver_id,
        "content": p.content,
        "read_time": p.read_time.isoformat() if p.read_time else None,
        "is_read": p.is_read,
        "status": p.status,
        "create_time": p.created_at.isoformat() if p.created_at else None,
    }


# ============ 私信 ============


@router.get("/private/list", summary="我的私信列表")
async def list_private(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    peer_id: str | None = None,
    is_read: bool | None = None,
):
    with get_session() as db:
        try:
            uid = _uid()
            q = db.query(MessagePrivateLetter).filter(
                or_(
                    MessagePrivateLetter.sender_id == uid,
                    MessagePrivateLetter.receiver_id == uid,
                )
            )
            if peer_id:
                q = q.filter(
                    or_(
                        MessagePrivateLetter.sender_id == peer_id,
                        MessagePrivateLetter.receiver_id == peer_id,
                    )
                )
            if is_read is not None:
                q = q.filter(MessagePrivateLetter.is_read == is_read)
            total = q.count()
            items = q.order_by(MessagePrivateLetter.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_p_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"message private list error: {e}")
            return error(str(e))


@router.get("/private/conversation/list", summary="会话列表")
async def list_conversations():
    with get_session() as db:
        try:
            uid = _uid()
            items = (
                db.query(MessagePrivateLetter)
                .filter(
                    or_(
                        MessagePrivateLetter.sender_id == uid,
                        MessagePrivateLetter.receiver_id == uid,
                    )
                )
                .order_by(MessagePrivateLetter.id.desc())
                .all()
            )
            conversations: dict[str, dict] = {}
            for it in items:
                peer = it.receiver_id if it.sender_id == uid else it.sender_id
                if peer not in conversations:
                    conversations[peer] = {
                        "peer_id": peer,
                        "last_content": it.content,
                        "last_time": it.created_at.isoformat() if it.created_at else None,
                        "unread_count": 0,
                    }
                if it.receiver_id == uid and not it.is_read:
                    conversations[peer]["unread_count"] += 1
            return success(list(conversations.values()), total=len(conversations))
        except Exception as e:
            logger.error(f"message conversation list error: {e}")
            return error(str(e))


@router.post("/private", summary="发送私信")
async def send_private(
    receiver_id: str = Query(..., min_length=1),
    payload: PrivateMessageCreateRequest = Depends(),
    status: str = "normal",
):
    with get_session() as db:
        try:
            uid = _uid()
            p = MessagePrivateLetter(
                sender_id=uid,
                receiver_id=receiver_id,
                content=payload.content,
                is_read=False,
                status=status,
            )
            db.add(p)
            db.flush()
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"message private send error: {e}")
            return error(str(e))


@router.post("/private/{pid}/read", summary="标记私信已读")
async def mark_read(pid: int):
    with get_session() as db:
        try:
            uid = _uid()
            p = db.query(MessagePrivateLetter).filter(
                MessagePrivateLetter.id == pid,
                MessagePrivateLetter.receiver_id == uid,
            ).first()
            if not p:
                return error("私信不存在", "404")
            p.is_read = True
            p.read_time = datetime.utcnow()
            return success()
        except Exception as e:
            logger.error(f"message private read error: {e}")
            return error(str(e))


@router.delete("/private/{pid}", summary="删除私信")
async def delete_private(pid: int):
    with get_session() as db:
        try:
            uid = _uid()
            p = db.query(MessagePrivateLetter).filter(
                MessagePrivateLetter.id == pid,
                or_(
                    MessagePrivateLetter.sender_id == uid,
                    MessagePrivateLetter.receiver_id == uid,
                ),
            ).first()
            if not p:
                return error("私信不存在", "404")
            db.delete(p)
            return success()
        except Exception as e:
            logger.error(f"message private delete error: {e}")
            return error(str(e))


# ============ 系统通知 ============


@router.get("/system-notice/list", summary="系统通知列表")
async def list_system_notices(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(MessageSystemNotice)
            total = q.count()
            items = q.order_by(MessageSystemNotice.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": n.id,
                        "content": n.content,
                        "create_time": n.created_at.isoformat() if n.created_at else None,
                    }
                    for n in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"message system notice list error: {e}")
            return error(str(e))


@router.post("/system-notice", summary="发布系统通知")
async def create_system_notice(payload: SystemNoticeCreateRequest = Depends()):
    with get_session() as db:
        try:
            n = MessageSystemNotice(content=payload.content)
            db.add(n)
            db.flush()
            return success({"id": n.id})
        except Exception as e:
            logger.error(f"message system notice create error: {e}")
            return error(str(e))


@router.delete("/system-notice/{nid}", summary="删除系统通知")
async def delete_system_notice(nid: int):
    with get_session() as db:
        try:
            n = db.query(MessageSystemNotice).filter(MessageSystemNotice.id == nid).first()
            if not n:
                return error("系统通知不存在", "404")
            db.delete(n)
            return success()
        except Exception as e:
            logger.error(f"message system notice delete error: {e}")
            return error(str(e))

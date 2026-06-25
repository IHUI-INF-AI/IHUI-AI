"""消息通知 - 站内信/系统消息/公告"""

from typing import Any, Optional

from fastapi import APIRouter, Body, Query
from loguru import logger
from pydantic import BaseModel, Field

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.message_models import (
    Message,
    MessageAnnouncement,
    MessageTemplate,
)
from app.schemas.common import error, success
from app.utils.datetime_helper import utcnow

router = APIRouter()


# ============ 通用发送消息 (前端 sendMessage / unifiedSendMessage 同形) ============


class SendMessageBody(BaseModel):
    """POST /message/send 请求体.

    兼容前端两套调用:
    - api/message.ts sendMessage: { userId, type, title, content, priority, category, actionUrl, actionText, expireTime, metadata }
    - api/api-utils.ts unifiedSendMessage: { content, type, agentId, sessionId }

    全部字段可选, 只有 content 必填.
    """

    user_id: Optional[str] = Field(default=None, alias="userId", description="接收者UUID, 缺省发给自己")
    type: Optional[str] = Field(default="system", description="system/notice/private")
    title: Optional[str] = Field(default=None, max_length=200)
    content: str = Field(..., min_length=1, description="消息内容")
    priority: Optional[str] = Field(default="medium", description="low/medium/high/urgent")
    category: Optional[str] = Field(default=None, max_length=50, description="消息分类")
    action_url: Optional[str] = Field(default=None, alias="actionUrl", max_length=500, description="跳转URL")
    action_text: Optional[str] = Field(default=None, alias="actionText", max_length=100, description="跳转按钮文案")
    target_type: Optional[str] = Field(default=None, alias="targetType", max_length=50)
    target_id: Optional[str] = Field(default=None, alias="targetId", max_length=64)
    expire_time: Optional[datetime] = Field(default=None, alias="expireTime")
    # ai/会话场景的扩展字段(不存 DB, 仅回显)
    agent_id: Optional[str] = Field(default=None, alias="agentId")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    metadata: Optional[dict[str, Any]] = Field(default=None, description="扩展元数据, 不存 DB")

    class Config:
        populate_by_name = True
        extra = "ignore"


@router.post("/send", summary="通用发送消息 (兼容前端 sendMessage / unifiedSendMessage)")
async def send_message(body: SendMessageBody = Body(...)):
    with get_session() as db:
        try:
            uid = _uid()
            # userId 缺省时: 私信类发给自己, 其他类发给自己(系统通知写入自己的信箱)
            receiver = body.user_id or uid
            msg_type = (body.type or "system").lower()
            if msg_type not in {"system", "notice", "private"}:
                msg_type = "system"

            # 兜底 title: content 截前 30 字
            title = body.title or (body.content[:30] + ("..." if len(body.content) > 30 else ""))

            m = Message(
                user_id=receiver,
                sender_id=uid,
                sender_name="我",
                type=msg_type,
                title=title,
                content=body.content,
                target_type=body.target_type or body.category,
                target_id=body.target_id,
                target_url=body.action_url,
            )
            db.add(m)
            db.flush()

            payload: dict[str, Any] = {
                "id": m.id,
                "type": m.type,
                "title": m.title,
                "content": m.content,
                "create_time": m.created_at.isoformat() if m.created_at else None,
            }
            # 扩展字段回显(不持久化但返回, 方便前端调试/记账)
            if body.priority is not None:
                payload["priority"] = body.priority
            if body.category is not None:
                payload["category"] = body.category
            if body.action_url is not None:
                payload["actionUrl"] = body.action_url
            if body.action_text is not None:
                payload["actionText"] = body.action_text
            if body.expire_time is not None:
                payload["expireTime"] = body.expire_time.isoformat()
            if body.agent_id is not None:
                payload["agentId"] = body.agent_id
            if body.session_id is not None:
                payload["sessionId"] = body.session_id
            if body.metadata is not None:
                payload["metadata"] = body.metadata

            return success(payload)
        except Exception as e:
            logger.error(f"message send error: {e}")
            return error(str(e))


def _uid() -> str:
    return current_user_id_or_guest()

@router.get("/list", summary="我的消息列表")
async def list_messages(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: str | None = None,
    is_read: bool | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Message).filter(Message.user_id == _uid())
            if type:
                q = q.filter(Message.type == type)
            if is_read is not None:
                q = q.filter(Message.is_read == is_read)
            total = q.count()
            items = q.order_by(Message.is_top.desc(), Message.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": m.id,
                        "user_id": m.user_id,
                        "sender_id": m.sender_id,
                        "sender_name": m.sender_name,
                        "type": m.type,
                        "title": m.title,
                        "content": m.content,
                        "target_type": m.target_type,
                        "target_id": m.target_id,
                        "target_url": m.target_url,
                        "is_read": m.is_read,
                        "read_time": m.read_time.isoformat() if m.read_time else None,
                        "is_top": m.is_top,
                        "create_time": m.created_at.isoformat() if m.created_at else None,
                    }
                    for m in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"message list error: {e}")
            return error(str(e))


@router.get("/unread-count", operation_id="message_unread_count", summary="未读消息数")
async def unread_count():
    with get_session() as db:
        try:
            count = db.query(Message).filter(Message.user_id == _uid(), not Message.is_read).count()
            return success({"count": count})
        except Exception as e:
            logger.error(f"message unread count error: {e}")
            return error(str(e))


@router.post("/{mid}/read", summary="标记已读")
async def mark_read(mid: int):
    with get_session() as db:
        try:
            m = db.query(Message).filter(Message.id == mid, Message.user_id == _uid()).first()
            if not m:
                return error("消息不存在", "404")
            m.is_read = True
            m.read_time = utcnow()
            return success()
        except Exception as e:
            logger.error(f"message read error: {e}")
            return error(str(e))


@router.post("/read-all", operation_id="message_mark_all_read", summary="全部标记已读")
async def mark_all_read():
    with get_session() as db:
        try:
            db.query(Message).filter(Message.user_id == _uid(), not Message.is_read).update(
                {Message.is_read: True, Message.read_time: utcnow()}
            )
            return success()
        except Exception as e:
            logger.error(f"message read all error: {e}")
            return error(str(e))


@router.delete("/{mid}", summary="删除消息")
async def delete_message(mid: int):
    with get_session() as db:
        try:
            m = db.query(Message).filter(Message.id == mid, Message.user_id == _uid()).first()
            if not m:
                return error("消息不存在", "404")
            db.delete(m)
            return success()
        except Exception as e:
            logger.error(f"message delete error: {e}")
            return error(str(e))


@router.delete("/batch-delete", summary="批量删除")
async def batch_delete(ids: str = Query(..., description="ID列表,逗号分隔")):
    with get_session() as db:
        try:
            id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
            db.query(Message).filter(Message.id.in_(id_list), Message.user_id == _uid()).delete(
                synchronize_session=False
            )
            return success({"deleted": len(id_list)})
        except Exception as e:
            logger.error(f"message batch delete error: {e}")
            return error(str(e))


# ============ 公告 ============


@router.get("/announcement/list", summary="公告列表")
async def list_announcements(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(MessageAnnouncement).filter(MessageAnnouncement.status == 1)
            if type is not None:
                q = q.filter(MessageAnnouncement.type == type)
            total = q.count()
            items = (
                q.order_by(MessageAnnouncement.is_top.desc(), MessageAnnouncement.publish_time.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [
                    {
                        "id": a.id,
                        "title": a.title,
                        "content": a.content,
                        "cover": a.cover,
                        "type": a.type,
                        "priority": a.priority,
                        "target_url": a.target_url,
                        "publish_time": a.publish_time.isoformat() if a.publish_time else None,
                        "expire_time": a.expire_time.isoformat() if a.expire_time else None,
                        "view_num": a.view_num,
                        "is_top": a.is_top,
                    }
                    for a in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"announcement list error: {e}")
            return error(str(e))


@router.get("/announcement/{aid}", summary="公告详情")
async def get_announcement(aid: int):
    with get_session() as db:
        try:
            a = db.query(MessageAnnouncement).filter(MessageAnnouncement.id == aid).first()
            if not a:
                return error("公告不存在", "404")
            a.view_num = (a.view_num or 0) + 1
            return success(
                {
                    "id": a.id,
                    "title": a.title,
                    "content": a.content,
                    "cover": a.cover,
                    "type": a.type,
                    "priority": a.priority,
                    "target_url": a.target_url,
                    "publish_time": a.publish_time.isoformat() if a.publish_time else None,
                    "view_num": a.view_num,
                    "is_top": a.is_top,
                }
            )
        except Exception as e:
            logger.error(f"announcement get error: {e}")
            return error(str(e))


@router.post("/announcement", summary="发布公告")
async def create_announcement(
    title: str = Query(..., min_length=1, max_length=200),
    content: str = Query(..., min_length=1),
    cover: str | None = None,
    type: int = 1,
    priority: int = 1,
    target_user: str = "all",
    target_url: str | None = None,
    publish_time: datetime | None = None,
    expire_time: datetime | None = None,
):
    with get_session() as db:
        try:
            a = MessageAnnouncement(
                title=title,
                content=content,
                cover=cover,
                type=type,
                priority=priority,
                status=1,
                target_user=target_user,
                target_url=target_url,
                publish_time=publish_time or utcnow(),
                expire_time=expire_time,
            )
            db.add(a)
            db.flush()
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"announcement create error: {e}")
            return error(str(e))


@router.put("/announcement/{aid}", summary="修改公告")
async def update_announcement(
    aid: int,
    title: str | None = None,
    content: str | None = None,
    status: int | None = None,
    priority: int | None = None,
):
    with get_session() as db:
        try:
            a = db.query(MessageAnnouncement).filter(MessageAnnouncement.id == aid).first()
            if not a:
                return error("公告不存在", "404")
            if title:
                a.title = title
            if content:
                a.content = content
            if status is not None:
                a.status = status
            if priority is not None:
                a.priority = priority
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"announcement update error: {e}")
            return error(str(e))


@router.delete("/announcement/{aid}", summary="删除公告")
async def delete_announcement(aid: int):
    with get_session() as db:
        try:
            a = db.query(MessageAnnouncement).filter(MessageAnnouncement.id == aid).first()
            if not a:
                return error("公告不存在", "404")
            db.delete(a)
            return success()
        except Exception as e:
            logger.error(f"announcement delete error: {e}")
            return error(str(e))


# ============ 私信 ============


@router.post("/private", summary="发送私信")
async def send_private(
    to_user_id: str = Query(...), content: str = Query(..., min_length=1), title: str | None = None
):
    with get_session() as db:
        try:
            uid = _uid()
            m = Message(
                user_id=to_user_id,
                sender_id=uid,
                sender_name="匿名用户",
                type="private",
                title=title or "新消息",
                content=content,
            )
            db.add(m)
            db.flush()
            return success({"id": m.id})
        except Exception as e:
            logger.error(f"private send error: {e}")
            return error(str(e))


# ============ 模板 ============


@router.get("/template/list", summary="消息模板列表")
async def template_list(type: str | None = None):
    with get_session() as db:
        try:
            q = db.query(MessageTemplate).filter(MessageTemplate.status == 1)
            if type:
                q = q.filter(MessageTemplate.type == type)
            items = q.all()
            return success(
                [
                    {
                        "id": t.id,
                        "code": t.code,
                        "name": t.name,
                        "type": t.type,
                        "subject": t.subject,
                        "content": t.content,
                        "variables": t.variables,
                    }
                    for t in items
                ]
            )
        except Exception as e:
            logger.error(f"template list error: {e}")
            return error(str(e))


@router.post("/template", summary="新增模板")
async def create_template(
    code: str = Query(...),
    name: str = Query(...),
    type: str = Query(...),
    content: str = Query(...),
    subject: str | None = None,
    variables: str | None = None,
):
    with get_session() as db:
        try:
            t = MessageTemplate(
                code=code,
                name=name,
                type=type,
                content=content,
                subject=subject,
                variables=variables,
                status=1,
            )
            db.add(t)
            db.flush()
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"template create error: {e}")
            return error(str(e))

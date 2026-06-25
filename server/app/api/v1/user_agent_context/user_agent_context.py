"""用户上下文 - 用户Agent对话上下文管理"""


from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Boolean, Column, Index, Integer, String, Text

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class UserAgentContext(TimestampMixin, Base):
    """用户Agent上下文"""

    __tablename__ = "zhs_user_agent_context"
    __table_args__ = (
        Index("idx_uac_user_agent", "user_id", "agent_id"),
        Index("idx_uac_session", "session_id"),
        {"extend_existing": True},
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    agent_id = Column(String(64), nullable=False)
    session_id = Column(String(64), nullable=False, comment="会话ID")
    role = Column(String(20), nullable=False, comment="user/assistant/system/tool")
    content = Column(Text, nullable=False, comment="内容")
    content_type = Column(String(20), default="text", comment="text/image/file")
    tokens = Column(Integer, default=0, comment="Token数")
    model = Column(String(50), nullable=True)
    is_summary = Column(Boolean, default=False, comment="是否为总结消息")


class UserAgentContextSummary(TimestampMixin, Base):
    """用户Agent上下文总结"""

    __tablename__ = "zhs_user_agent_context_summary"
    __table_args__ = (
        Index("idx_uacs_user_agent", "user_id", "agent_id"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    agent_id = Column(String(64), nullable=False)
    summary = Column(Text, nullable=False, comment="总结内容")
    message_count = Column(Integer, default=0, comment="总结消息数")
    tokens = Column(Integer, default=0, comment="Token数")
    start_message_id = Column(BigInteger, default=0)
    end_message_id = Column(BigInteger, default=0)


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.post("", summary="添加上下文消息")
def add_context(
    agent_id: str = Query(...),
    session_id: str = Query(...),
    role: str = Query(..., pattern="^(user|assistant|system|tool)$"),
    content: str = Query(..., min_length=1),
    content_type: str = "text",
    tokens: int = 0,
    model: str | None = None,
):
    with get_session() as db:
        try:
            uid = _uid()
            c = UserAgentContext(
                user_id=uid,
                agent_id=agent_id,
                session_id=session_id,
                role=role,
                content=content,
                content_type=content_type,
                tokens=tokens,
                model=model,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"context add error: {e}")
            return error(str(e))


@router.get("/list", summary="获取上下文")
def list_context(
    agent_id: str = Query(...), session_id: str | None = None, limit: int = Query(50, ge=1, le=200)
):
    with get_session() as db:
        try:
            uid = _uid()
            q = db.query(UserAgentContext).filter(
                UserAgentContext.user_id == uid,
                UserAgentContext.agent_id == agent_id,
            )
            if session_id:
                q = q.filter(UserAgentContext.session_id == session_id)
            items = q.order_by(UserAgentContext.id.asc()).limit(limit).all()
            return success(
                [
                    {
                        "id": c.id,
                        "role": c.role,
                        "content": c.content,
                        "content_type": c.content_type,
                        "tokens": c.tokens,
                        "model": c.model,
                        "is_summary": c.is_summary,
                        "create_time": c.created_at.isoformat() if c.created_at else None,
                    }
                    for c in items
                ]
            )
        except Exception as e:
            logger.error(f"context list error: {e}")
            return error(str(e))


@router.delete("", summary="清空上下文")
def clear_context(agent_id: str = Query(...), session_id: str | None = None):
    with get_session() as db:
        try:
            uid = _uid()
            q = db.query(UserAgentContext).filter(
                UserAgentContext.user_id == uid,
                UserAgentContext.agent_id == agent_id,
            )
            if session_id:
                q = q.filter(UserAgentContext.session_id == session_id)
            q.delete(synchronize_session=False)
            return success()
        except Exception as e:
            logger.error(f"context clear error: {e}")
            return error(str(e))


@router.post("/summary", summary="总结上下文")
def summarize_context(
    agent_id: str = Query(...),
    session_id: str | None = None,
    summary: str = Query(..., min_length=1),
    start_id: int = 0,
    end_id: int = 0,
    tokens: int = 0,
):
    with get_session() as db:
        try:
            uid = _uid()
            s = UserAgentContextSummary(
                user_id=uid,
                agent_id=agent_id,
                summary=summary,
                message_count=end_id - start_id + 1 if end_id > start_id else 0,
                tokens=tokens,
                start_message_id=start_id,
                end_message_id=end_id,
            )
            db.add(s)
            db.flush()
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"context summary error: {e}")
            return error(str(e))


@router.get("/summary/list", summary="总结列表")
def list_summaries(agent_id: str = Query(...), limit: int = Query(10, ge=1, le=50)):
    with get_session() as db:
        try:
            uid = _uid()
            items = (
                db.query(UserAgentContextSummary)
                .filter(
                    UserAgentContextSummary.user_id == uid,
                    UserAgentContextSummary.agent_id == agent_id,
                )
                .order_by(UserAgentContextSummary.id.desc())
                .limit(limit)
                .all()
            )
            return success(
                [
                    {
                        "id": s.id,
                        "summary": s.summary,
                        "message_count": s.message_count,
                        "tokens": s.tokens,
                        "create_time": s.created_at.isoformat() if s.created_at else None,
                    }
                    for s in items
                ]
            )
        except Exception as e:
            logger.error(f"context summary list error: {e}")
            return error(str(e))

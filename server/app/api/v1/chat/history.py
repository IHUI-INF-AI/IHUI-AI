"""User model chat history routes (from user_model_chat.py + user_agent_context.py).

Endpoints:
  POST /create         - Create a chat record
  POST /query          - Query chat records by user/model
  PUT  /{chat_id}/mark - Update chat mark/label
  DELETE /{chat_id}    - Delete a chat record
"""

import logging

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.database import get_session
from app.models.activity_models import AiModelInfo, ZhsUserModelChat
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class ChatCreateBody(BaseModel):
    model_name: str = Field(..., description="Model name")
    mark: str | None = Field(None, description="Chat summary/label")


class ChatQueryBody(BaseModel):
    model_name: str | None = Field(None, description="Model name (optional filter)")


class ChatMarkBody(BaseModel):
    mark: str = Field(..., description="New mark/label text")


# ---------------------------------------------------------------------------
# POST /create
# ---------------------------------------------------------------------------


@router.post("/create", summary="Create a chat record")
def create_chat(
    body: ChatCreateBody,
    user_uuid: str = Depends(require_login),
):
    """Create a new user-model chat record."""
    try:
        with get_session() as db:
            chat = ZhsUserModelChat(
                user_uuid=user_uuid,
                model_name=body.model_name,
                mark=body.mark,
            )
            db.add(chat)
            db.commit()
            db.refresh(chat)
            return success(
                {
                    "id": chat.id,
                    "user_uuid": chat.user_uuid,
                    "model_name": chat.model_name,
                    "mark": chat.mark,
                    "create_time": chat.create_time.isoformat() if chat.create_time else None,
                }
            )
    except Exception as e:
        db.rollback()
        logger.error(f"Create chat record error: {e}")
        return error(str(e))


# ---------------------------------------------------------------------------
# POST /query
# ---------------------------------------------------------------------------


@router.post("/query", summary="Query chat records")
def query_chats(
    body: ChatQueryBody,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    """Query chat records for the authenticated user, optionally filtered by model_name.
    Joins with zhs_ai_model_info to include model source and icon.
    """
    with get_session() as db:
        try:
            # Build base query with join to get model metadata
            query = (
                db.query(
                    ZhsUserModelChat,
                    AiModelInfo.source,
                    AiModelInfo.icon,
                )
                .outerjoin(AiModelInfo, ZhsUserModelChat.model_name == AiModelInfo.name)
                .filter(ZhsUserModelChat.user_uuid == user_uuid)
            )

            if body.model_name:
                query = query.filter(ZhsUserModelChat.model_name == body.model_name)

            # Count total before pagination
            total = query.count()

            # Order by create_time descending and paginate
            rows = query.order_by(ZhsUserModelChat.create_time.desc()).offset((page - 1) * limit).limit(limit).all()

            items = []
            for chat, source, icon in rows:
                items.append(
                    {
                        "id": chat.id,
                        "user_uuid": chat.user_uuid,
                        "model_name": chat.model_name,
                        "mark": chat.mark,
                        "create_time": chat.create_time.isoformat() if chat.create_time else None,
                        "source": source,
                        "icon": icon,
                    }
                )

            return success(items, total=total)
        except Exception as e:
            logger.error(f"Query chat records error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# PUT /{chat_id}/mark
# ---------------------------------------------------------------------------


@router.put("/{chat_id}/mark", summary="Update chat mark/label")
def update_chat_mark(
    chat_id: int,
    body: ChatMarkBody,
    user_uuid: str = Depends(require_login),
):
    """Update the mark (label/summary) of a chat record owned by the user."""
    with get_session() as db:
        try:
            chat = (
                db.query(ZhsUserModelChat)
                .filter(
                    ZhsUserModelChat.id == chat_id,
                    ZhsUserModelChat.user_uuid == user_uuid,
                )
                .first()
            )
            if not chat:
                return error("Chat record not found", "404")

            chat.mark = body.mark
            db.commit()
            db.refresh(chat)
            return success(
                {
                    "id": chat.id,
                    "user_uuid": chat.user_uuid,
                    "model_name": chat.model_name,
                    "mark": chat.mark,
                    "create_time": chat.create_time.isoformat() if chat.create_time else None,
                }
            )
        except Exception as e:
            logger.error(f"Update chat mark error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# DELETE /{chat_id}
# ---------------------------------------------------------------------------


@router.delete("/{chat_id}", summary="Delete a chat record")
def delete_chat(
    chat_id: int,
    user_uuid: str = Depends(require_login),
):
    """Delete a chat record owned by the authenticated user."""
    with get_session() as db:
        try:
            chat = (
                db.query(ZhsUserModelChat)
                .filter(
                    ZhsUserModelChat.id == chat_id,
                    ZhsUserModelChat.user_uuid == user_uuid,
                )
                .first()
            )
            if not chat:
                return error("Chat record not found", "404")

            db.delete(chat)
            db.commit()
            return success({"deleted": chat_id})
        except Exception as e:
            logger.error(f"Delete chat record error: {e}")
            return error(str(e))

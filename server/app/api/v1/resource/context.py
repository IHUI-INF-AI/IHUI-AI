"""User Agent Context API -- save / get / remove context, invoke agent with token deduction."""

import contextlib
import json as _json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import and_, text

from app.database import get_session
from app.models.agent_models import Agent
from app.models.context_models import UserAgentContext
from app.schemas.common import error, success
from app.security import require_login
from app.services.token_service import check_user_token, deduct_user_token

router = APIRouter()


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class ContextSaveRequest(BaseModel):
    agent_id: str
    context_key: str
    context_value: str
    field_name: str | None = None


class FieldRemoveRequest(BaseModel):
    agent_id: str
    field_name: str


# ---------------------------------------------------------------------------
# POST /save -- save user context
# ---------------------------------------------------------------------------


@router.post("/save", summary="保存用户上下文")
async def save_context(
    req: ContextSaveRequest,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            ctx = (
                db.query(UserAgentContext)
                .filter(
                    and_(
                        UserAgentContext.user_uuid == user_uuid,
                        UserAgentContext.agent_id == req.agent_id,
                        UserAgentContext.context_key == req.context_key,
                    )
                )
                .first()
            )
            if ctx:
                ctx.context_value = req.context_value
                if req.field_name is not None:
                    ctx.field_name = req.field_name
            else:
                ctx = UserAgentContext(
                    user_uuid=user_uuid,
                    agent_id=req.agent_id,
                    context_key=req.context_key,
                    context_value=req.context_value,
                    field_name=req.field_name,
                )
                db.add(ctx)
            db.commit()
            return success({"id": ctx.id, "context_key": ctx.context_key})
        except Exception as e:
            logger.error(f"Save context error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# GET /get -- get user context list
# ---------------------------------------------------------------------------


@router.get("/get", summary="获取用户上下文")
async def get_context(
    agent_id: str = Query(..., description="Agent ID"),
    context_key: str | None = Query(None, description="Context key (optional filter)"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            q = db.query(UserAgentContext).filter(
                and_(
                    UserAgentContext.user_uuid == user_uuid,
                    UserAgentContext.agent_id == agent_id,
                )
            )
            if context_key:
                q = q.filter(UserAgentContext.context_key == context_key)
            items = q.order_by(UserAgentContext.id.desc()).all()
            return success(
                [
                    {
                        "id": c.id,
                        "agent_id": c.agent_id,
                        "context_key": c.context_key,
                        "context_value": c.context_value,
                        "field_name": c.field_name,
                        "create_time": c.create_time.isoformat() if c.create_time else None,
                        "update_time": c.update_time.isoformat() if c.update_time else None,
                    }
                    for c in items
                ],
                total=len(items),
            )
        except Exception as e:
            logger.error(f"Get context error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# GET /field -- get value by field_name
# ---------------------------------------------------------------------------


@router.get("/field", summary="获取指定字段值")
async def get_field(
    agent_id: str = Query(...),
    field_name: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            ctx = (
                db.query(UserAgentContext)
                .filter(
                    and_(
                        UserAgentContext.user_uuid == user_uuid,
                        UserAgentContext.agent_id == agent_id,
                        UserAgentContext.field_name == field_name,
                    )
                )
                .first()
            )
            if not ctx:
                return error("Field not found", code="404")
            return success(
                {
                    "id": ctx.id,
                    "context_key": ctx.context_key,
                    "context_value": ctx.context_value,
                    "field_name": ctx.field_name,
                }
            )
        except Exception as e:
            logger.error(f"Get field error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# POST /remove/field -- delete by field_name
# ---------------------------------------------------------------------------


@router.post("/remove/field", summary="删除指定字段")
async def remove_field(
    req: FieldRemoveRequest,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            count = (
                db.query(UserAgentContext)
                .filter(
                    and_(
                        UserAgentContext.user_uuid == user_uuid,
                        UserAgentContext.agent_id == req.agent_id,
                        UserAgentContext.field_name == req.field_name,
                    )
                )
                .delete(synchronize_session=False)
            )
            db.commit()
            return success({"deleted": count})
        except Exception as e:
            logger.error(f"Remove field error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# GET /agent/{agent_id} -- invoke agent with token deduction
# ---------------------------------------------------------------------------


@router.get("/agent/{agent_id}", summary="获取Agent调用(含token扣除)")
async def get_agent_with_deduction(
    agent_id: str,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            # 1. Fetch agent info
            agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
            if not agent:
                return error("Agent not found", code="404")

            # 2. Determine cost: use agent's max_tokens or a default
            cost_tokens = agent.agent_max_tokens or 100

            # 3. Check balance
            balance_check = check_user_token(user_uuid, min_tokens=cost_tokens)
            if not balance_check["sufficient"]:
                return error(
                    f"Token余额不足, 当前余额: {balance_check['current_balance']}, 需要: {cost_tokens}",
                    code="402",
                )

            # 4. Deduct tokens
            bill = deduct_user_token(user_uuid, cost_tokens, desc=f"Agent调用:{agent_id}", bot_id=agent.bot_id)
            if not bill.get("success"):
                return error(bill.get("reason", "Token扣减失败"))

            # 5. Fetch user context for this agent
            contexts = (
                db.query(UserAgentContext)
                .filter(
                    and_(
                        UserAgentContext.user_uuid == user_uuid,
                        UserAgentContext.agent_id == agent_id,
                    )
                )
                .all()
            )

            return success(
                {
                    "agent_id": agent.agent_id,
                    "agent_name": agent.agent_name,
                    "agent_description": agent.agent_description,
                    "agent_prompt": agent.agent_prompt,
                    "cost_tokens": cost_tokens,
                    "remaining_balance": bill.get("balance"),
                    "context": [
                        {
                            "context_key": c.context_key,
                            "context_value": c.context_value,
                            "field_name": c.field_name,
                        }
                        for c in contexts
                    ],
                }
            )
        except Exception as e:
            logger.error(f"Get agent error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# POST /query -- query user agent context with raw SQL (from user_agent_context.py)
# ---------------------------------------------------------------------------


class RawContextRequest(BaseModel):
    model_name: str = Field(..., description="Model name")
    chat_id: str = Field(..., description="Chat ID")
    limit: int = Field(10, ge=1, le=1000, description="Max rows to return")


@router.post("/query", summary="Query user agent context (raw SQL)")
async def query_context_raw(
    req: RawContextRequest,
    user_uuid: str = Depends(require_login),
):
    """Query zhs_user_agent_context by user_uuid + model_name + chat_id.
    Returns messages list with user/assistant role alternation.
    """
    with get_session() as db:
        try:
            params = {
                "user_uuid": user_uuid,
                "model_name": req.model_name,
                "chat_id": req.chat_id,
            }

            data_sql = text(
                """
                SELECT id, problem, summary, user_url, answer, chat_id,
                       agent_url, field1, video_ratio
                FROM zhs_user_agent_context
                WHERE user_uuid = :user_uuid
                  AND model_name = :model_name
                  AND chat_id = :chat_id
                ORDER BY send_time ASC
            """
            )

            rows = db.execute(data_sql, params).mappings().all()

            messages = []
            for row in rows:
                row_id = row.get("id")
                chat_id = row.get("chat_id")
                agent_url = row.get("agent_url")
                user_url = row.get("user_url")
                field1 = row.get("field1")
                video_ratio = row.get("video_ratio")
                summary = row.get("summary")

                # User message
                if row.get("problem"):
                    messages.append(
                        {
                            "id": row_id,
                            "role": "user",
                            "content": row["problem"],
                            "chat_id": chat_id,
                            "agent_url": user_url,
                        }
                    )

                # Assistant message
                if row.get("answer"):
                    answer_content = row["answer"]
                    msg = {
                        "id": row_id,
                        "role": "assistant",
                        "content": answer_content,
                        "chat_id": chat_id,
                        "agent_url": agent_url,
                        "total_tokens": field1,
                        "video_ratio": video_ratio,
                    }
                    if summary:
                        msg["summary"] = summary
                    # Try to parse JSON content
                    try:
                        if answer_content and isinstance(answer_content, str):
                            stripped = answer_content.strip()
                            if stripped.startswith("[") or stripped.startswith("{"):
                                msg["lists"] = _json.loads(answer_content)
                    except (_json.JSONDecodeError, TypeError):
                        pass
                    messages.append(msg)

            return success(
                {
                    "messages": messages,
                    "count": len(rows),
                }
            )
        except Exception as e:
            logger.error(f"Query context error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# GET /sample -- sample rows from zhs_user_agent_context
# ---------------------------------------------------------------------------


@router.get("/sample", summary="Get sample context data")
async def get_sample_context(
    limit: int = Query(5, ge=1, le=20, description="Number of rows"),
    user_uuid: str = Depends(require_login),
):
    """Return a few sample rows for debugging / display."""
    with get_session() as db:
        try:
            sql = text(
                """
                SELECT user_uuid, model_name, problem, send_time, chat_id
                FROM zhs_user_agent_context
                ORDER BY send_time DESC
                LIMIT :limit
            """
            )
            rows = db.execute(sql, {"limit": limit}).mappings().all()
            return success([dict(row) for row in rows])
        except Exception as e:
            logger.error(f"Sample context error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# POST /history -- usage history with pagination
# ---------------------------------------------------------------------------


class HistoryRequest(BaseModel):
    type: str = Field("a", description="Time range: w=week, m=month, y=year, a=all")
    page: int = Field(1, ge=1)
    page_size: int = Field(10, ge=1, le=100)


@router.post("/history", summary="Query usage history")
async def get_usage_history(
    req: HistoryRequest,
    user_uuid: str = Depends(require_login),
):
    """Query user's agent usage history with model name join and pagination."""
    with get_session() as db:
        try:
            now = datetime.now()
            start_time = 0
            if req.type == "w":
                start_time = int((now - timedelta(days=7)).timestamp())
            elif req.type == "m":
                start_time = int((now - timedelta(days=30)).timestamp())
            elif req.type == "y":
                start_time = int((now - timedelta(days=365)).timestamp())

            params = {
                "user_uuid": user_uuid,
                "start_time": start_time,
                "limit": req.page_size,
                "offset": (req.page - 1) * req.page_size,
            }

            where_clause = "WHERE a.user_uuid = :user_uuid"
            if req.type != "a":
                where_clause += " AND a.send_time >= :start_time"

            # Count
            count_sql = text(f"SELECT COUNT(*) FROM zhs_user_agent_context a {where_clause}")
            total = db.execute(count_sql, params).scalar_one_or_none() or 0

            # Data
            data_sql = text(
                f"""
                SELECT a.id, a.agent_id, a.problem, a.answer,
                       a.user_url, a.agent_url,
                       a.send_time AS create_at,
                       a.model_name, a.chat_id,
                       a.field1 AS token,
                       b.source AS agentName
                FROM zhs_user_agent_context a
                LEFT JOIN zhs_ai_model_info b ON a.model_name = b.name
                {where_clause}
                ORDER BY a.send_time DESC
                LIMIT :limit OFFSET :offset
            """
            )
            rows = db.execute(data_sql, params).mappings().all()

            result = []
            for row in rows:
                d = dict(row)
                ts = d.get("create_at")
                if ts:
                    with contextlib.suppress(ValueError, TypeError):
                        d["create_at"] = datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
                result.append(d)

            return success(result, total=total)
        except Exception as e:
            logger.error(f"Usage history error: {e}")
            return error(str(e))

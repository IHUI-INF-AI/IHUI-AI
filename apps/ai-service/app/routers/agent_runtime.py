"""Agent runtime 路由(8 端点)。

对齐 CLI 5 项核心能力(Permission/PlanMode/Sessions/Personas + Agent 执行链路)。
/execute/stream 由 LangGraph StateGraph(plan → execute → summarize)驱动 SSE 事件流。
"""

import asyncio
import json
import logging
import os
import time
import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.agent_graph import AgentState, get_agent_graph
from app.services.memory import unified_memory_client

router = APIRouter(prefix="/agent-runtime", tags=["agent-runtime"])
logger = logging.getLogger(__name__)


# ============ 数据模型(对齐 packages/types/src/agent-runtime.ts)============


class ExecuteRequest(BaseModel):
    message: str = Field(..., min_length=1)
    mode: str = Field("default")
    sessionId: str | None = None
    botId: str | None = None


class ExecuteResponse(BaseModel):
    sessionId: str
    mode: str
    received: str
    summary: str = ""


class SessionMessage(BaseModel):
    role: str
    content: str
    timestamp: float = Field(default_factory=time.time)


class SessionState(BaseModel):
    id: str
    status: str = "running"
    messages: list[SessionMessage] = []
    botId: str = "default"
    createdAt: float = Field(default_factory=time.time)


class PermissionCheckResponse(BaseModel):
    toolName: str
    mode: str
    dangerLevel: str
    decision: str


# ============ 会话存储(Redis 优先 + 内存降级,最大 1000 条)============

_MAX_SESSIONS = 1000
_sessions: dict[str, SessionState] = {}


def _evict_if_needed() -> None:
    """内存会话超过上限时按 FIFO 淘汰最旧条目(防止内存泄漏)。"""
    while len(_sessions) > _MAX_SESSIONS:
        _sessions.pop(next(iter(_sessions)))


def _get_or_create_session(session_id: str | None, bot_id: str) -> SessionState:
    """获取或创建会话:内存命中 → Redis 回填 → 新建。"""
    new_id = session_id or str(uuid.uuid4())
    if new_id in _sessions:
        return _sessions[new_id]
    session = _load_session_redis(new_id)
    if session is not None:
        _sessions[new_id] = session
        _evict_if_needed()
        return session
    session = SessionState(id=new_id, botId=bot_id)
    _sessions[new_id] = session
    _evict_if_needed()
    return session


def _find_session(session_id: str) -> SessionState | None:
    """查找会话(只读):内存 → Redis 回填,不新建。"""
    if session_id in _sessions:
        return _sessions[session_id]
    session = _load_session_redis(session_id)
    if session is not None:
        _sessions[session_id] = session
        _evict_if_needed()
    return session


# ============ Redis 客户端(不可用时降级到纯内存)============

_redis_client = None
_redis_disabled = False


def _get_redis():
    global _redis_client, _redis_disabled
    if _redis_disabled:
        return None
    if _redis_client is None:
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            _redis_disabled = True
            return None
        try:
            import redis

            _redis_client = redis.from_url(redis_url, decode_responses=True)
            _redis_client.ping()
        except Exception:
            _redis_client = None
            _redis_disabled = True
            return None
    return _redis_client


def _save_session_redis(session: SessionState) -> None:
    r = _get_redis()
    if r is None:
        return
    try:
        r.set(f"agent_session:{session.id}", session.model_dump_json(), ex=86400)
    except Exception:
        pass


def _load_session_redis(session_id: str) -> SessionState | None:
    r = _get_redis()
    if r is None:
        return None
    try:
        data = r.get(f"agent_session:{session_id}")
        if not data:
            return None
        return SessionState.model_validate_json(data)
    except Exception:
        return None


# ============ Permission 决策矩阵(对齐 CLI permission-guard)============


def _check_permission(tool_name: str, mode: str, danger_level: str) -> str:
    if mode == "bypassPermissions":
        return "allow"
    if mode == "manual":
        return "ask"
    if mode == "plan":
        return "deny" if danger_level in ("write", "dangerous") else "allow"
    if mode == "acceptEdits":
        return "allow" if danger_level in ("read", "write") else "ask"
    if danger_level == "read":
        return "allow"
    if danger_level == "write":
        return "ask"
    return "ask"


# ============ 端点 ============


@router.post("/execute", response_model=ExecuteResponse)
async def execute(req: ExecuteRequest) -> ExecuteResponse:
    """同步执行 — 调用 LangGraph plan → execute → summarize 完整链路。"""
    session = _get_or_create_session(req.sessionId, req.botId or "default")
    session.messages.append(SessionMessage(role="user", content=req.message))
    _save_session_redis(session)

    summary = ""
    try:
        graph = get_agent_graph()
        initial_state: AgentState = {
            "messages": [m.model_dump() for m in session.messages],
            "mode": req.mode,
            "session_id": session.id,
            "plan": "",
            "execution_result": "",
            "summary": "",
            "error": None,
        }
        result = await graph.ainvoke(initial_state)
        summary = result.get("summary", "")
    except Exception as e:
        logger.warning("agent_runtime /execute graph failed: %s", e)

    return ExecuteResponse(
        sessionId=session.id, mode=req.mode, received=req.message, summary=summary
    )


@router.post("/execute/stream")
async def execute_stream(req: ExecuteRequest, request: Request) -> StreamingResponse:
    """SSE 流式执行 — LangGraph plan → execute → summarize 真实驱动。"""
    session = _get_or_create_session(req.sessionId, req.botId or "default")
    session.messages.append(SessionMessage(role="user", content=req.message))
    _save_session_redis(session)

    async def event_stream():
        yield f"event: session\ndata: {json.dumps({'sessionId': session.id})}\n\n"

        if req.mode == "plan":
            yield (
                f"event: permission\ndata: "
                f"{json.dumps({'mode': req.mode, 'toolName': 'Write', 'dangerLevel': 'write', 'decision': 'deny'})}\n\n"
            )

        try:
            graph = get_agent_graph()
            initial_state: AgentState = {
                "messages": [m.model_dump() for m in session.messages],
                "mode": req.mode,
                "session_id": session.id,
                "plan": "",
                "execution_result": "",
                "summary": "",
                "error": None,
            }

            async for event in graph.astream(initial_state):
                if await request.is_disconnected():
                    logger.info("agent_runtime SSE client disconnected, stopping stream")
                    break
                for node_name, node_output in event.items():
                    if not isinstance(node_output, dict):
                        continue
                    if node_name == "plan" and node_output.get("plan"):
                        yield (
                            f"event: plan\ndata: "
                            f"{json.dumps({'plan': node_output['plan']})}\n\n"
                        )
                    elif (
                        node_name == "execute"
                        and node_output.get("execution_result")
                    ):
                        yield (
                            f"event: delta\ndata: "
                            f"{json.dumps({'content': node_output['execution_result']})}\n\n"
                        )
                    elif node_name == "summarize" and node_output.get("summary"):
                        session.messages.append(
                            SessionMessage(
                                role="assistant", content=node_output["summary"]
                            )
                        )
                        session.status = "completed"
                        _save_session_redis(session)
                        yield (
                            f"event: done\ndata: "
                            f"{json.dumps({'sessionId': session.id, 'status': 'completed', 'summary': node_output['summary']})}\n\n"
                        )
                    if node_output.get("error"):
                        yield (
                            f"event: error\ndata: "
                            f"{json.dumps({'message': node_output['error']})}\n\n"
                        )
        except asyncio.CancelledError:
            logger.info("agent_runtime SSE cancelled by client disconnect")
            raise
        except Exception as e:
            session.status = "failed"
            _save_session_redis(session)
            yield (
                f"event: error\ndata: "
                f"{json.dumps({'message': f'graph execution failed: {e}'})}\n\n"
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/{session_id}/status")
async def get_status(session_id: str) -> dict:
    session = _find_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return {"sessionId": session.id, "status": session.status, "messageCount": len(session.messages)}


@router.post("/{session_id}/cancel")
async def cancel_session(session_id: str) -> dict:
    session = _find_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    session.status = "cancelled"
    _save_session_redis(session)
    return {"sessionId": session_id, "status": "cancelled"}


@router.get("/sessions")
async def list_sessions(limit: int = 20, offset: int = 0) -> dict:
    items = list(_sessions.values())
    return {
        "sessions": [s.model_dump() for s in items[offset : offset + limit]],
        "total": len(items),
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> dict:
    session = _find_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return session.model_dump()


@router.post("/sessions/{session_id}/resume")
async def resume_session(session_id: str) -> dict:
    session = _find_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    session.status = "running"
    _save_session_redis(session)
    return {"sessionId": session_id, "status": "running"}


@router.get("/permission/check")
async def check_permission(
    toolName: str, mode: str = "default", dangerLevel: str = "read"
) -> PermissionCheckResponse:
    decision = _check_permission(toolName, mode, dangerLevel)
    return PermissionCheckResponse(
        toolName=toolName, mode=mode, dangerLevel=dangerLevel, decision=decision
    )


@router.get("/memory")
async def get_memory(
    user_id: str, scope: str = "session", session_id: str | None = None
) -> dict:
    """读取统一记忆(对接 api /api/memory,网络失败降级返回空列表)。"""
    entries = await unified_memory_client.get_entries(user_id, scope, session_id)
    return {"code": 0, "message": "ok", "data": entries}


@router.post("/memory")
async def add_memory(request: Request) -> dict:
    """写入统一记忆(对接 api /api/memory,网络失败降级返回 None)。"""
    body = await request.json()
    result = await unified_memory_client.add_entry(body.get("userId"), body.get("entry"))
    return {"code": 0, "message": "ok", "data": result}


__all__ = ["router"]

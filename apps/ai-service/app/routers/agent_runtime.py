"""Agent runtime 路由(8 端点)。

对齐 CLI 5 项核心能力(Permission/PlanMode/Sessions/Personas + Agent 执行链路)。
骨架实现 — 实际 Agent 执行由 LangGraph 状态机完成(后续串行集成)。
"""

import json
import time
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/agent-runtime", tags=["agent-runtime"])


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


# ============ 内存会话存储(占位 — 后续可换 Redis/DB)============

_sessions: dict[str, SessionState] = {}


def _get_or_create_session(session_id: str | None, bot_id: str) -> SessionState:
    if session_id and session_id in _sessions:
        return _sessions[session_id]
    new_id = session_id or str(uuid.uuid4())
    session = SessionState(id=new_id, botId=bot_id)
    _sessions[new_id] = session
    return session


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
    """同步执行(占位 — 实际 Agent 执行由 /execute/stream SSE 完成)。"""
    session = _get_or_create_session(req.sessionId, req.botId or "default")
    session.messages.append(SessionMessage(role="user", content=req.message))
    return ExecuteResponse(sessionId=session.id, mode=req.mode, received=req.message)


@router.post("/execute/stream")
async def execute_stream(req: ExecuteRequest) -> StreamingResponse:
    """SSE 流式执行(占位 — 实际由 LangGraph 状态机完成)。"""
    session = _get_or_create_session(req.sessionId, req.botId or "default")
    session.messages.append(SessionMessage(role="user", content=req.message))

    async def event_stream():
        yield f"event: session\ndata: {json.dumps({'sessionId': session.id})}\n\n"
        yield f"event: permission\ndata: {json.dumps({'mode': req.mode, 'decision': 'allow'})}\n\n"
        yield (
            f"event: done\ndata: "
            f"{json.dumps({'sessionId': session.id, 'status': 'streaming-placeholder'})}\n\n"
        )

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{session_id}/status")
async def get_status(session_id: str) -> dict:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="session not found")
    s = _sessions[session_id]
    return {"sessionId": s.id, "status": s.status, "messageCount": len(s.messages)}


@router.post("/{session_id}/cancel")
async def cancel_session(session_id: str) -> dict:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="session not found")
    _sessions[session_id].status = "cancelled"
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
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="session not found")
    return _sessions[session_id].model_dump()


@router.post("/sessions/{session_id}/resume")
async def resume_session(session_id: str) -> dict:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="session not found")
    _sessions[session_id].status = "running"
    return {"sessionId": session_id, "status": "running"}


@router.get("/permission/check")
async def check_permission(
    toolName: str, mode: str = "default", dangerLevel: str = "read"
) -> PermissionCheckResponse:
    decision = _check_permission(toolName, mode, dangerLevel)
    return PermissionCheckResponse(
        toolName=toolName, mode=mode, dangerLevel=dangerLevel, decision=decision
    )


__all__ = ["router"]

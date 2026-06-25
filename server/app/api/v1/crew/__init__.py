"""多智能体 Crew API 路由."""

import asyncio
import json
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel

from app.services.crew_agent_registry import agent_registry
from app.services.crew_llm_adapter import get_available_models
from app.services.crew_orchestrator import crew_orchestrator

router = APIRouter(prefix="/crew", tags=["Multi-Agent Crew"])


class CreateSessionReq(BaseModel):
    """创建会话请求."""

    user_id: str
    input_message: str
    title: str = ""
    config: dict[str, Any] | None = None


class ExecuteSessionReq(BaseModel):
    """执行会话请求."""

    config: dict[str, Any] | None = None


class CancelSessionReq(BaseModel):
    """取消会话请求."""

    pass


@router.post("/sessions", summary="创建多智能体会话")
async def create_session(req: CreateSessionReq):
    """创建新的多智能体协作会话."""
    try:
        session_id = crew_orchestrator.create_session(
            user_id=req.user_id,
            input_message=req.input_message,
            title=req.title,
            config=req.config,
        )
        return {"code": 0, "data": {"session_id": session_id}, "msg": "ok"}
    except Exception as e:
        logger.error(f"创建会话失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/sessions", summary="列出会话")
async def list_sessions(user_id: str = "", limit: int = 20):
    """列出多智能体会话."""
    sessions = crew_orchestrator.list_sessions(user_id=user_id, limit=limit)
    return {"code": 0, "data": sessions, "msg": "ok"}


@router.get("/sessions/{session_id}", summary="获取会话详情")
async def get_session(session_id: str):
    """获取会话详情."""
    session = crew_orchestrator.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"code": 0, "data": session, "msg": "ok"}


@router.post("/sessions/{session_id}/execute", summary="执行会话")
async def execute_session(session_id: str, req: ExecuteSessionReq | None = None):
    """执行多智能体会话."""
    config = req.config if req else None
    result = await asyncio.to_thread(crew_orchestrator.execute_session, session_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "执行失败"))
    return {"code": 0, "data": result, "msg": "ok"}


@router.post("/sessions/{session_id}/cancel", summary="取消会话")
async def cancel_session(session_id: str):
    """取消多智能体会话."""
    ok = crew_orchestrator.cancel_session(session_id)
    if not ok:
        raise HTTPException(status_code=400, detail="无法取消 (会话不存在或已完成)")
    return {"code": 0, "msg": "已取消"}


@router.get("/sessions/{session_id}/tasks", summary="获取会话任务列表")
async def get_session_tasks(session_id: str):
    """获取会话的任务分解列表."""
    tasks = crew_orchestrator.get_session_tasks(session_id)
    return {"code": 0, "data": tasks, "msg": "ok"}


@router.get("/sessions/{session_id}/messages", summary="获取会话消息日志")
async def get_session_messages(session_id: str):
    """获取会话的智能体间消息日志."""
    msgs = crew_orchestrator.get_session_messages(session_id)
    return {"code": 0, "data": msgs, "msg": "ok"}


@router.get("/agents", summary="列出智能体角色")
async def list_agents():
    """列出所有可用的智能体角色."""
    roles = agent_registry.list_roles()
    return {"code": 0, "data": roles, "msg": "ok"}


@router.get("/models", summary="列出可用模型")
async def list_models():
    """列出可用的 LLM 模型."""
    models = get_available_models()
    return {"code": 0, "data": models, "msg": "ok"}


@router.get("/health", summary="健康检查")
async def health():
    """多智能体服务健康检查."""
    return {
        "code": 0,
        "data": {
            "status": "ok",
            "crewai_available": crew_orchestrator._crewai_available,
            "roles": len(agent_registry.list_roles()),
        },
        "msg": "ok",
    }


# ===== WebSocket 流式执行 =====


@router.websocket("/sessions/{session_id}/ws")
async def execute_session_ws(websocket: WebSocket, session_id: str):
    """WebSocket 流式执行多智能体会话.

    客户端连接后, 服务端逐步推送执行进度:
    - {"type": "start", ...}
    - {"type": "plan", ...}
    - {"type": "task_start", ...}
    - {"type": "task_complete", ...}
    - {"type": "complete", ...}

    注意: 同步生成器用 anyio 线程池拉取, 避免阻塞事件循环.
    """
    import anyio

    await websocket.accept()
    try:
        gen = crew_orchestrator.execute_session_streaming(session_id)
        while True:
            try:
                progress = await anyio.to_thread.run_sync(next, gen)
            except StopIteration:
                break
            await websocket.send_json(progress)
            if progress.get("type") in ("complete", "error"):
                break
    except WebSocketDisconnect:
        logger.info(f"WebSocket 客户端断开: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket 执行失败: {e}")
        await websocket.send_json({"type": "error", "content": str(e)})
    finally:
        await websocket.close()


# ===== SSE 流式执行 =====


@router.post("/sessions/{session_id}/stream", summary="SSE 流式执行")
async def execute_session_stream(session_id: str):
    """SSE (Server-Sent Events) 流式执行多智能体会话.

    返回 text/event-stream, 每条消息格式:
    data: {"type": "task_start", "role": "planner", ...}

    注意: crew_orchestrator.execute_session_streaming 是同步生成器,
    内部包含同步 LLM 调用 (httpx.Client), 会长时间阻塞.
    此处用 anyio 线程池逐步拉取, 避免阻塞事件循环导致响应头无法发送.
    """
    import anyio

    async def event_generator():
        gen = crew_orchestrator.execute_session_streaming(session_id)
        while True:
            try:
                progress = await anyio.to_thread.run_sync(next, gen)
            except StopIteration:
                break
            yield f"data: {json.dumps(progress, ensure_ascii=False)}\n\n"
            if progress.get("type") in ("complete", "error"):
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ===== 一站式创建并执行 =====


@router.post("/run", summary="创建并执行会话 (一站式)")
async def create_and_execute(req: CreateSessionReq):
    """创建会话并立即执行, 返回最终结果."""
    try:
        session_id = crew_orchestrator.create_session(
            user_id=req.user_id,
            input_message=req.input_message,
            title=req.title,
            config=req.config,
        )
        result = crew_orchestrator.execute_session(session_id)
        return {
            "code": 0,
            "data": {
                "session_id": session_id,
                "result": result,
            },
            "msg": "ok",
        }
    except Exception as e:
        logger.error(f"创建并执行失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

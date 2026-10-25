# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent runtime 路由(8 端点)。

对齐 CLI 5 项核心能力(Permission/PlanMode/Sessions/Personas + Agent 执行链路)。
/execute/stream 由 LangGraph StateGraph(plan → execute → summarize)驱动 SSE 事件流。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.agent_graph import AgentState, get_agent_graph

# 真实云端 Agent 容器运行时(对标 Cursor Cloud Agents / Codex CI sandbox,2026-09-05 立)
from app.services.container_runtime import container_runtime
# D14② 沙箱任务队列(G-17 拆票,2026-10-23):/queue/* 端点的队列消费面
from app.services.sandbox_task_queue import SandboxQueueFullError, sandbox_task_queue
from app.services.memory import unified_memory_client
from app.services.session_store import owner_scoped_allows

from ..core.jwt_auth import get_current_user_id
from ..core.rbac import Permission, require_permission
from ..core.sse_frames import with_frame_trace_id
from ..services.async_gen_close import aclose_async_gen

router = APIRouter(prefix="/agent-runtime", tags=["agent-runtime"])
logger = logging.getLogger(__name__)


def _sse_frame(evt: str, payload: dict[str, Any], *, ensure_ascii: bool = True) -> str:
    """SSE 文本帧(帧级 traceId 经共享注入点,承 G-248 R3)。"""
    framed = with_frame_trace_id(evt, payload)
    return f"event: {evt}\ndata: {json.dumps(framed, ensure_ascii=ensure_ascii)}\n\n"


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
    # 2026-07-22 P1 鲁棒性加固:TTL 过期清理,防长期空闲会话内存泄漏
    last_access: float = Field(default_factory=time.time)
    # P1 修复(2026-08-06): 会话归属用户 ID,用于跨用户会话隔离
    user_id: str = ""


class PermissionCheckResponse(BaseModel):
    toolName: str
    mode: str
    dangerLevel: str
    decision: str


# ============ 会话存储(Redis 优先 + 内存降级,最大 1000 条)============

_MAX_SESSIONS = 1000
# 2026-07-22 P1 鲁棒性加固:30 分钟未访问的 session 自动淘汰
_SESSION_TTL_SEC = 1800
_sessions: dict[str, SessionState] = {}


def _evict_if_needed() -> None:
    """内存会话淘汰:FIFO 容量上限 + TTL 过期清理(防止内存泄漏)。"""
    now = time.time()
    # TTL 淘汰:删除超过 30 分钟未访问的 session
    expired = [sid for sid, s in _sessions.items() if now - s.last_access > _SESSION_TTL_SEC]
    for sid in expired:
        _sessions.pop(sid, None)
    # FIFO 容量淘汰
    while len(_sessions) > _MAX_SESSIONS:
        _sessions.pop(next(iter(_sessions)))


def _get_or_create_session(
    session_id: str | None, bot_id: str, user_id: str, is_admin: bool = False
) -> SessionState:
    """获取或创建会话:内存命中 → 新建(写入时持久化 Redis)。

    P1 修复(2026-08-06): 创建/复用会话时记录并校验归属 user_id,
    防止跨用户通过猜测 session_id 读取/续用他人会话(管理员除外)。
    """
    new_id = session_id or str(uuid.uuid4())
    if new_id in _sessions:
        # P1 修复(2026-08-06): 会话归属校验 —— 归属非空且与当前用户不一致时拒绝(管理员除外)。
        owner = _sessions[new_id].user_id
        if owner and owner != user_id and not is_admin:
            raise HTTPException(status_code=403, detail="无权访问他人会话")
        _sessions[new_id].last_access = time.time()
        return _sessions[new_id]
    session = SessionState(id=new_id, botId=bot_id, user_id=user_id)
    _sessions[new_id] = session
    _evict_if_needed()
    return session


def _require_session(session_id: str, user_id: str, is_admin: bool = False) -> SessionState:
    """查找会话并校验归属;不归属当前用户时按 404 处理(不泄露会话是否存在)。"""
    session = _find_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    owner = session.user_id
    if owner and owner != user_id and not is_admin:
        raise HTTPException(status_code=404, detail="session not found")
    return session


def _get_current_user(request: Request) -> tuple[str, bool]:
    """从 JWT 派生当前用户(user_id, is_admin)。"""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    role_id = getattr(request.state, "role_id", 0) or 0
    return str(user_id), int(role_id) >= 1


def _find_session(session_id: str) -> SessionState | None:
    """查找会话(只读):内存 → Redis 回填,不新建。"""
    if session_id in _sessions:
        _sessions[session_id].last_access = time.time()
        return _sessions[session_id]
    session = _load_session_redis(session_id)
    if session is not None:
        _sessions[session_id] = session
        _evict_if_needed()
    return session


# ============ Redis 客户端(不可用时降级到纯内存)============

_redis_client: Any = None
_redis_disabled: bool = False


def _get_redis() -> Any:
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

            # protocol=2 强制 RESP2:redis-py 8.x 默认 RESP3(HELLO 3 协商),
            # 老 Redis/Memurai 4.x 不支持会 unknown command HELLO(同 im_bridge)
            _redis_client = redis.from_url(redis_url, decode_responses=True, protocol=2, socket_connect_timeout=2)
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
        logger.exception("redis_session_save_failed", extra={"session_id": session.id})


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
async def execute(req: ExecuteRequest, request: Request) -> ExecuteResponse:
    """同步执行 — 调用 LangGraph plan → execute → summarize 完整链路。"""
    # P1 修复(2026-08-06): 强制 JWT 身份,创建/复用会话时校验归属
    user_id, is_admin = _get_current_user(request)
    session = _get_or_create_session(req.sessionId, req.botId or "default", user_id, is_admin)
    session.messages.append(SessionMessage(role="user", content=req.message))
    _save_session_redis(session)

    summary = ""
    try:
        _get_graph: Any = get_agent_graph
        graph = _get_graph()
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
    # P1 修复(2026-08-06): 强制 JWT 身份,创建/复用会话时校验归属
    user_id, is_admin = _get_current_user(request)
    session = _get_or_create_session(req.sessionId, req.botId or "default", user_id, is_admin)
    session.messages.append(SessionMessage(role="user", content=req.message))
    _save_session_redis(session)

    async def event_stream() -> AsyncIterator[str]:
        yield _sse_frame("session", {"sessionId": session.id})

        if req.mode == "plan":
            yield _sse_frame(
                "permission",
                {'mode': req.mode, 'toolName': 'Write', 'dangerLevel': 'write', 'decision': 'deny'},
            )

        try:
            _get_graph: Any = get_agent_graph
            graph = _get_graph()
            initial_state: AgentState = {
                "messages": [m.model_dump() for m in session.messages],
                "mode": req.mode,
                "session_id": session.id,
                "plan": "",
                "execution_result": "",
                "summary": "",
                "error": None,
            }

            _graph_stream: AsyncIterator[Any] | None = None
            try:
                _graph_stream = graph.astream(initial_state)
                async for event in _graph_stream:
                    if await request.is_disconnected():
                        logger.info("agent_runtime SSE client disconnected, stopping stream")
                        # 被弃路径就地关停:break 之后本流还要走完外层 except 的收尾,
                        # 而 graph.astream(langgraph)此刻仍停在半读态 —— 拖到 GC 才关,
                        # 检查点与内部清理要等不确定的时间(G-77:借来的生成器谁借谁关)。
                        await aclose_async_gen(
                            _graph_stream,
                            label="agent_runtime execute/stream (client disconnected)",
                        )
                        break
                    for node_name, node_output in event.items():
                        if not isinstance(node_output, dict):
                            continue
                        if node_name == "plan" and node_output.get("plan"):
                            yield _sse_frame("plan", {"plan": node_output["plan"]})
                        elif (
                            node_name == "execute"
                            and node_output.get("execution_result")
                        ):
                            yield _sse_frame(
                                "delta", {"content": node_output["execution_result"]}
                            )
                        elif node_name == "summarize" and node_output.get("summary"):
                            session.messages.append(
                                SessionMessage(
                                    role="assistant", content=node_output["summary"]
                                )
                            )
                            session.status = "completed"
                            _save_session_redis(session)
                            yield _sse_frame(
                                "done",
                                {
                                    "sessionId": session.id,
                                    "status": "completed",
                                    "summary": node_output["summary"],
                                },
                            )
                        if node_output.get("error"):
                            yield _sse_frame("error", {"message": node_output["error"]})
            finally:
                # 兜底关停:覆盖"流中途抛错 / CancelledError / GeneratorExit"三条被弃路径
                # (客户端断开那条已在 break 之前就关)。正常耗尽时 aclose 是合法 no-op,
                # 不构成二次回滚;出口自身吞错,绝不用关停异常掩盖正在传播的原异常。
                # **必须 shield + 只吞本行等待**:这段 finally 会在"任务被取消"的作用域里
                # 执行,裸 await 一旦在取消点点燃 CancelledError,外层 except 分支的
                # session failed 收尾就整批被跳过;shield 让关停任务脱离本次取消跑完
                # (资源真的关掉),except 只吞"这一行的等待":外层正在传播的取消 /
                # GeneratorExit 仍随 finally 结束后照常向外传播。
                try:
                    await asyncio.shield(
                        aclose_async_gen(
                            _graph_stream,
                            label="agent_runtime execute/stream (stream finally)",
                        )
                    )
                except BaseException as close_err:  # noqa: BLE001 - 兜底关停不得吞掉原异常
                    logger.warning(
                        "[agent_runtime] 兜底关停未在此处等待完成(已交 shield 接管) err=%r",
                        close_err,
                    )
        except asyncio.CancelledError:
            logger.info("agent_runtime SSE cancelled by client disconnect")
            raise
        except Exception as e:
            session.status = "failed"
            _save_session_redis(session)
            yield _sse_frame("error", {"message": f"graph execution failed: {e}"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/{session_id}/status")
async def get_status(session_id: str, request: Request) -> dict[str, Any]:
    # P1 修复(2026-08-06): 校验会话归属,防跨用户读取他人会话状态
    user_id, is_admin = _get_current_user(request)
    session = _require_session(session_id, user_id, is_admin)
    return {"sessionId": session.id, "status": session.status, "messageCount": len(session.messages)}


@router.post("/{session_id}/cancel")
async def cancel_session(
    session_id: str,
    request: Request,
    # RBAC 示例接入(2026-09-06):取消动作需 run:cancel 权限点(viewer → 403);
    # 归属校验仍由 _require_session 兜底(admin 可跨用户取消)。
    _perm: object = Depends(require_permission(Permission.RUN_CANCEL)),
) -> dict[str, Any]:
    # P1 修复(2026-08-06): 校验会话归属,防跨用户取消他人会话
    user_id, is_admin = _get_current_user(request)
    session = _require_session(session_id, user_id, is_admin)
    session.status = "cancelled"
    _save_session_redis(session)
    return {"sessionId": session_id, "status": "cancelled"}


@router.get("/sessions")
async def list_sessions(request: Request, limit: int = 20, offset: int = 0) -> dict[str, Any]:
    # P1 修复(2026-08-06): 只返回当前用户的会话(管理员可见全部)
    user_id, is_admin = _get_current_user(request)
    items = list(_sessions.values())
    if not is_admin:
        items = [s for s in items if not s.user_id or s.user_id == user_id]
    return {
        "sessions": [s.model_dump() for s in items[offset : offset + limit]],
        "total": len(items),
    }


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, request: Request) -> dict[str, Any]:
    # P1 修复(2026-08-06): 校验会话归属,防跨用户读取他人会话(含消息内容)
    user_id, is_admin = _get_current_user(request)
    session = _require_session(session_id, user_id, is_admin)
    return session.model_dump()


@router.post("/sessions/{session_id}/resume")
async def resume_session(session_id: str, request: Request) -> dict[str, Any]:
    # P1 修复(2026-08-06): 校验会话归属,防跨用户续用他人会话
    user_id, is_admin = _get_current_user(request)
    session = _require_session(session_id, user_id, is_admin)
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
    request: Request,
    scope: str = "session",
    session_id: str | None = None,
) -> dict[str, Any]:
    """读取统一记忆(对接 api /api/memory,网络失败降级返回空列表)。

    P0-9 修复(2026-08-05):user_id 一律从 JWT 派生,忽略客户端 query 参数,
    防止越权读取他人私有记忆。
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    entries = await unified_memory_client.get_entries(user_id, scope, session_id)
    return {"code": 0, "message": "ok", "data": entries}


@router.post("/memory")
async def add_memory(request: Request) -> dict[str, Any]:
    """写入统一记忆(对接 api /api/memory,网络失败降级返回 None)。

    P0-9 修复(2026-08-05):user_id 一律从 JWT 派生,忽略 body 中的 userId。
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    result = await unified_memory_client.add_entry(user_id, body.get("entry"))
    return {"code": 0, "message": "ok", "data": result}


# ==================== 容器运行时:真实云端 Agent 执行层 ====================
# 对标 Cursor Cloud Agents / Codex CI sandbox:容器(或本地沙箱降级)真执行,
# 与 cloud_run_store 联动落记录。响应信封 {code:0,message,data} 对齐 cloud_runs.py。


class RunContainerRequest(BaseModel):
    """POST /runs 请求体:任务描述 + 执行命令 + 工作区快照。"""

    task: str = ""
    # 命令:字符串(容器内 sh / 本地 shell 解释)或数组(本地直接 exec,无 shell 注入面)
    command: str | list[str] = ""
    # 工作区快照(dict[相对路径 -> 文本内容]),tar 打包传入容器 /workspace
    files: dict[str, str] = {}
    # 镜像覆盖(默认 CONTAINER_IMAGE 环境变量,再默认 python:3.12-slim)
    image: str | None = None
    # 执行超时(秒),超时强杀;None 用运行时默认
    timeout_sec: float | None = None


@router.post("/runs")
async def start_container_run(
    req: RunContainerRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """启动一次容器/沙箱运行(异步后台执行),返回 run_id 与 execution_env。"""
    command: str | list[str] = req.command or "python --version"
    prompt = req.task or (command if isinstance(command, str) else " ".join(command))
    run = await container_runtime.start_run(
        prompt,
        command,
        files=req.files,
        image=req.image,
        timeout_sec=req.timeout_sec,
        user_id=user_id,
    )
    return {"code": 0, "message": "ok", "data": run}


@router.get("/runs")
async def list_container_runs(
    user_id: str = Depends(get_current_user_id),
    limit: int = 50,
) -> dict[str, Any]:
    """列出**本人**内容器运行记录快照(新→旧)。

    批 63 / G-258 A 组:`start_run` 那侧一直在把令牌主体写进 `run.user_id`,而列举与
    查询两向完全不看它 ⇒ 任何已登录用户能读到全站运行的 prompt、文件清单与输出。
    过滤放在服务侧一处(`container_runtime.list_runs`),不在响应侧筛。
    """
    return {
        "code": 0,
        "message": "ok",
        "data": container_runtime.list_runs(limit=limit, owner_user_id=user_id),
    }


def _run_or_404(run_id: str, user_id: str) -> dict[str, Any]:
    """按 id 取运行快照,非属主与"没这条运行"**同码同形**(不给存在性探针留缝)。"""
    snap = container_runtime.snapshot(run_id)
    if snap is None or not owner_scoped_allows(user_id, snap.get("user_id")):
        raise HTTPException(status_code=404, detail=f"运行记录不存在: {run_id}")
    return snap


@router.get("/runs/{run_id}")
async def get_container_run(
    run_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """查询单次容器运行状态/输出快照(只准属主读)。"""
    return {"code": 0, "message": "ok", "data": _run_or_404(run_id, user_id)}


@router.get("/runs/{run_id}/stream")
async def stream_container_run(
    run_id: str,
    user_id: str = Depends(get_current_user_id),
) -> StreamingResponse:
    """SSE 流式输出运行 stdout/stderr/exit 事件(连接后可回放缓冲事件)。

    归属判定**在取事件队列之前**:先拿到 queue 再拒,等于已经建立了别人的事件订阅。
    """
    _run_or_404(run_id, user_id)
    queue = container_runtime.events_queue(run_id)
    if queue is None:
        raise HTTPException(status_code=404, detail=f"运行记录不存在: {run_id}")

    async def event_stream() -> AsyncIterator[str]:
        while True:
            evt = await queue.get()
            name = str(evt.get("event", "message"))
            yield _sse_frame(name, evt, ensure_ascii=False)
            if name == "exit":
                break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.delete("/runs/{run_id}")
async def cancel_container_run(
    run_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """终止运行:强杀子进程,状态置 cancelled;幂等。

    批 63 前这里只在**成功之后**把 user_id 打进日志 ⇒ 任何已登录用户都能杀掉别人的
    进程(跨用户 DoS)。归属判定必须在 `cancel()` 之前。
    """
    _run_or_404(run_id, user_id)
    snap = container_runtime.cancel(run_id)
    if snap is None:
        raise HTTPException(status_code=404, detail=f"运行记录不存在: {run_id}")
    logger.info("agent-runtime cancel container run=%s user=%s", run_id, user_id)
    return {"code": 0, "message": "ok", "data": snap}


# ==================== D14② 沙箱任务队列(G-17 拆票,2026-10-23) ====================
# 队列语义:按镜像道串行度可配、failed 可重放一次、队列满明确拒绝(429)。
# 默认执行器委托 container_runtime:本机无 docker 时严档 fail-closed 以
# "任务失败(可重放一次)"如实呈现,队列不降级、不假装成功。


@router.post("/queue/tasks")
async def enqueue_queue_task(
    req: RunContainerRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """任务入队(按镜像道排队)。队列满 → 429 明确拒绝,不静默排队。"""
    command: str | list[str] = req.command or "python --version"
    prompt = req.task or (command if isinstance(command, str) else " ".join(command))
    try:
        snap = await sandbox_task_queue.enqueue(
            {
                "task": prompt,
                "command": command,
                "files": req.files,
                "timeout_sec": req.timeout_sec,
            },
            image=req.image,
            user_id=user_id,
        )
    except SandboxQueueFullError as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    return {"code": 0, "message": "ok", "data": snap}


@router.get("/queue/tasks")
async def list_queue_tasks(
    user_id: str = Depends(get_current_user_id),
    limit: int = 50,
    image: str | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    """列出本人队列任务快照(新→旧),可按镜像道/状态过滤。"""
    return {
        "code": 0,
        "message": "ok",
        "data": sandbox_task_queue.list_tasks(
            limit=limit, user_id=user_id, image=image, status=status
        ),
    }


@router.get("/queue/stats")
async def queue_stats(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """队列面快照(串行度/上限/各道等待数/状态计数),运维与看板取数用。"""
    return {"code": 0, "message": "ok", "data": sandbox_task_queue.stats()}


def _queue_task_or_404(task_id: str, user_id: str) -> dict[str, Any]:
    """按 id 取任务快照,非属主与"没这条任务"同码同形(与 _run_or_404 同判据)。"""
    snap = sandbox_task_queue.snapshot(task_id)
    if snap is None or not owner_scoped_allows(user_id, snap.get("user_id")):
        raise HTTPException(status_code=404, detail=f"队列任务不存在: {task_id}")
    return snap


@router.get("/queue/tasks/{task_id}")
async def get_queue_task(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """查询队列任务状态/结果快照(只准属主读)。"""
    return {"code": 0, "message": "ok", "data": _queue_task_or_404(task_id, user_id)}


@router.post("/queue/tasks/{task_id}/replay")
async def replay_queue_task(
    task_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """重放 failed 任务(每任务仅一次)。不可重放 → 409;队列满 → 429。"""
    _queue_task_or_404(task_id, user_id)
    try:
        data = await sandbox_task_queue.replay(task_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except SandboxQueueFullError as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    return {"code": 0, "message": "ok", "data": data}


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

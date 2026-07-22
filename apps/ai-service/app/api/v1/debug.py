"""DAP 调试路由 — 封装 DebugSessionManager 为 HTTP 端点。

提供 10 个端点(对齐 DAP 协议生命周期):
- POST /api/v1/debug/launch                          启动调试会话
- POST /api/v1/debug/attach                           附加到已运行进程
- POST /api/v1/debug/sessions/{id}/breakpoints        设置断点
- POST /api/v1/debug/sessions/{id}/continue           继续执行
- POST /api/v1/debug/sessions/{id}/step               单步执行
- GET  /api/v1/debug/sessions/{id}/stack              获取调用栈
- GET  /api/v1/debug/sessions/{id}/variables          获取变量
- POST /api/v1/debug/sessions/{id}/eval               表达式求值
- DELETE /api/v1/debug/sessions/{id}                   断开会话
- GET  /api/v1/debug/sessions                          列出所有会话

底层复用 app.services.debugger.get_debug_manager() 单例。
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.debugger import get_debug_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/debug", tags=["debug"])


# ==================== 请求模型(camelCase 对齐前端)====================


class DebugLaunchRequest(BaseModel):
    """启动调试会话请求。"""

    language: str = Field(..., description="语言: node / python / web")
    program: str = Field(..., description="目标程序路径或 URL")
    args: Optional[list[str]] = Field(None, description="程序参数")
    cwd: Optional[str] = Field(None, description="工作目录")
    env: Optional[dict[str, str]] = Field(None, description="环境变量")


class DebugAttachRequest(BaseModel):
    """附加调试会话请求。"""

    language: str = Field(..., description="语言: node / python / web")
    port: int = Field(..., ge=1, le=65535, description="调试端口")
    host: str = Field("localhost", description="调试主机")


class DebugBreakpointsRequest(BaseModel):
    """设置断点请求。"""

    file: str = Field(..., description="文件绝对路径")
    lines: list[dict[str, Any]] = Field(
        ..., description="断点行列表 [{line, condition?, hitCondition?}]"
    )


class DebugStepRequest(BaseModel):
    """单步执行请求。"""

    stepType: str = Field("next", description="步进类型: next/stepIn/stepOut/stepBack/continue")


class DebugEvalRequest(BaseModel):
    """表达式求值请求。"""

    expression: str = Field(..., description="表达式")
    frameId: Optional[int] = Field(None, description="栈帧 ID(不传用当前帧)")


# ==================== 辅助函数 ====================


def _ok(data: Any) -> dict[str, Any]:
    """成功响应统一格式。"""
    return {"code": 200, "message": "ok", "data": data}


def _session_not_found(session_id: str) -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": 404, "message": f"debug session 不存在: {session_id}", "data": None},
    )


def _internal_error(e: Exception) -> HTTPException:
    logger.warning("[debug] 内部错误: %s", e)
    return HTTPException(
        status_code=500,
        detail={"code": 500, "message": f"调试器内部错误: {e}", "data": None},
    )


def _handle_debug_error(session_id: str, e: Exception) -> None:
    """统一处理 DebugSessionManager 抛出的 RuntimeError。"""
    msg = str(e)
    if "不存在" in msg or "已终止" in msg:
        raise _session_not_found(session_id)
    raise _internal_error(e)


# ==================== 端点 ====================


@router.post("/launch")
async def launch(req: DebugLaunchRequest) -> dict[str, Any]:
    """POST /api/v1/debug/launch — 启动调试会话。"""
    manager = get_debug_manager()
    try:
        # debugger.launch 参数名为 command(对齐 DAP program 字段语义)
        session_id = await manager.launch(
            language=req.language,
            command=req.program,
            args=req.args,
            cwd=req.cwd,
            env=req.env,
        )
    except Exception as e:
        raise _internal_error(e)
    return _ok({"sessionId": session_id})


@router.post("/attach")
async def attach(req: DebugAttachRequest) -> dict[str, Any]:
    """POST /api/v1/debug/attach — 附加到已运行进程。"""
    manager = get_debug_manager()
    try:
        session_id = await manager.attach(
            language=req.language,
            port=req.port,
            host=req.host,
        )
    except Exception as e:
        raise _internal_error(e)
    return _ok({"sessionId": session_id})


@router.post("/sessions/{session_id}/breakpoints")
async def set_breakpoints(
    session_id: str, req: DebugBreakpointsRequest
) -> dict[str, Any]:
    """POST /api/v1/debug/sessions/{id}/breakpoints — 设置断点。"""
    manager = get_debug_manager()
    try:
        breakpoints = await manager.set_breakpoints(
            session_id=session_id,
            file=req.file,
            lines=req.lines,
        )
    except Exception as e:
        _handle_debug_error(session_id, e)
        raise  # _handle_debug_error 一定 raise,这里满足类型检查
    return _ok({"breakpoints": breakpoints})


@router.post("/sessions/{session_id}/continue")
async def continue_execution(session_id: str) -> dict[str, Any]:
    """POST /api/v1/debug/sessions/{id}/continue — 继续执行。"""
    manager = get_debug_manager()
    try:
        stopped = await manager.continue_execution(session_id)
    except Exception as e:
        _handle_debug_error(session_id, e)
        raise
    return _ok({"stopped": stopped})


@router.post("/sessions/{session_id}/step")
async def step(session_id: str, req: DebugStepRequest) -> dict[str, Any]:
    """POST /api/v1/debug/sessions/{id}/step — 单步执行。

    stepType=continue 时内部转发到 continue_execution(语义等价)。
    """
    manager = get_debug_manager()
    try:
        if req.stepType == "continue":
            stopped = await manager.continue_execution(session_id)
        else:
            stopped = await manager.step(session_id, step_type=req.stepType)
    except Exception as e:
        _handle_debug_error(session_id, e)
        raise
    return _ok({"stopped": stopped})


@router.get("/sessions/{session_id}/stack")
async def get_stack_trace(session_id: str) -> dict[str, Any]:
    """GET /api/v1/debug/sessions/{id}/stack — 获取调用栈。"""
    manager = get_debug_manager()
    try:
        stack_frames = await manager.get_stack_trace(session_id)
    except Exception as e:
        _handle_debug_error(session_id, e)
        raise
    return _ok({"stackFrames": stack_frames})


@router.get("/sessions/{session_id}/variables")
async def get_variables(
    session_id: str,
    frameId: int = Query(..., description="栈帧 ID(必填,从 stackTrace 获取)"),
    scope: str = Query("local", description="变量作用域: local/globals/closure"),
) -> dict[str, Any]:
    """GET /api/v1/debug/sessions/{id}/variables — 获取变量。"""
    manager = get_debug_manager()
    try:
        variables = await manager.get_variables(
            session_id=session_id,
            frame_id=frameId,
            scope=scope,
        )
    except Exception as e:
        _handle_debug_error(session_id, e)
        raise
    return _ok({"variables": variables})


@router.post("/sessions/{session_id}/eval")
async def evaluate(session_id: str, req: DebugEvalRequest) -> dict[str, Any]:
    """POST /api/v1/debug/sessions/{id}/eval — 表达式求值。"""
    manager = get_debug_manager()
    try:
        result = await manager.evaluate(
            session_id=session_id,
            expression=req.expression,
            frame_id=req.frameId,
        )
    except Exception as e:
        _handle_debug_error(session_id, e)
        raise
    # evaluate 返回 {result, type?, variablesReference?, ...}
    data: dict[str, Any] = {"result": result.get("result")}
    if "type" in result:
        data["type"] = result["type"]
    return _ok(data)


@router.delete("/sessions/{session_id}")
async def disconnect(session_id: str) -> dict[str, Any]:
    """DELETE /api/v1/debug/sessions/{id} — 断开会话。"""
    manager = get_debug_manager()
    try:
        disconnected = await manager.disconnect(session_id)
    except Exception as e:
        raise _internal_error(e)
    if not disconnected:
        raise _session_not_found(session_id)
    return _ok({"disconnected": True})


@router.get("/sessions")
async def list_sessions() -> dict[str, Any]:
    """GET /api/v1/debug/sessions — 列出所有会话。"""
    manager = get_debug_manager()
    sessions = await manager.list_sessions()
    return _ok({"sessions": sessions})

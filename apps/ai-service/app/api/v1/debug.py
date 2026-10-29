# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""DAP 调试路由 — 封装 DebugSessionManager 为 HTTP 端点。

提供 12 个端点(对齐 DAP 协议生命周期):
- POST /api/v1/debug/launch                          启动调试会话
- POST /api/v1/debug/attach                           附加到已运行进程
- POST /api/v1/debug/sessions/{id}/breakpoints        设置断点
- POST /api/v1/debug/sessions/{id}/continue           继续执行
- POST /api/v1/debug/sessions/{id}/step               单步执行
- GET  /api/v1/debug/sessions/{id}/stack              获取调用栈
- GET  /api/v1/debug/sessions/{id}/scopes             获取 scope 分组(DAP scopes)
- GET  /api/v1/debug/sessions/{id}/threads            获取线程列表(DAP threads)
- GET  /api/v1/debug/sessions/{id}/variables          获取变量(variablesReference 优先)
- POST /api/v1/debug/sessions/{id}/eval               表达式求值
- DELETE /api/v1/debug/sessions/{id}                   断开会话
- GET  /api/v1/debug/sessions                          列出所有会话

底层复用 app.services.debugger.get_debug_manager() 单例。
"""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.jwt_auth import require_request_user_id
from app.services.debugger import DebugSessionForbidden, get_debug_manager

logger = logging.getLogger(__name__)


# ==================== 身份与归属(P0 根因加固 2026-10-29)====================
#
# 本面在 ai-service 上能 launch 任意程序 / eval 任意表达式 / attach 任意进程 —— 服务器级 RCE。
# api 网关层已收为「管理员 + 内网」,但那只挡住 HTTP 入口;本层补三件根因:
#   ① **默认关闭**(IHUI_DEBUG_ENABLED 不为 true 时整面 404):本仓实测零调用方
#      (apps/web / apps/mobile-rn / packages 无任何 /api/debug 引用,MCP 工具面亦无),
#      不用就关 = 攻击面直接不存在,强于任何入口校验;
#   ② 逐端点身份依赖(require_request_user_id):生产缺身份即 401,不依赖网关是否转发;
#   ③ 会话归属:launch/attach 记录调用者,其余端点逐次校验,拿到他人 session_id 也不能接管。
#
# 刻意**不**做 program/cwd 路径白名单:program 允许指向仓库内的解释器,args 传
# `-c "<任意代码>"` 即等价于 RCE —— 白名单只会制造「已防护」的错觉,却挡不住一次攻击;
# 且 Windows 上 `/tmp` 这类 POSIX 字面量会被解析成盘符相对路径,误伤真实调用方。
# 真要做到「开了也只能调自己的代码」,必须连 args 一起约束(解释器白名单 + 脚本路径校验),
# 那是另一个量级的改造,不在本次范围;在那之前靠 ① 默认关闭 + ② 管理员内网兜底。


def _debug_enabled() -> bool:
    """调试面总开关。只有显式 `IHUI_DEBUG_ENABLED=true` 才启用。

    默认关闭的理由:本面零调用方(见上方注释),而它是本服务最强的 RCE 面 ——
    「不用就关」比任何入口校验都可靠。开启后仍受 api 网关的「管理员 + 内网」双重约束。
    """
    return os.environ.get("IHUI_DEBUG_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}


def _require_debug_enabled() -> None:
    """router 级依赖:未启用时整面 404(不暴露「这里有个调试面」这一事实)。"""
    if not _debug_enabled():
        raise HTTPException(
            status_code=404,
            detail={
                "code": 404,
                "message": "Not Found",
                "data": None,
            },
        )


def _guard_owner(manager: Any, session_id: str, user_id: str) -> None:
    """归属校验的 HTTP 映射:异主体 ⇒ 403,不存在 ⇒ 404。

    manager 是 mock 时 verify_owner 为 MagicMock,调用即通过(既有测试不被打断)。
    """
    try:
        manager.verify_owner(session_id, user_id)
    except DebugSessionForbidden as e:
        raise HTTPException(
            status_code=403,
            detail={"code": 403, "message": "无权访问该调试会话", "data": None},
        ) from e
    except RuntimeError as e:
        raise _session_not_found(session_id) from e


# 总开关挂在 router 级:一处生效,12 个端点不必各写一遍(漏写一个就是一条绕过路径)。
router = APIRouter(
    prefix="/debug",
    tags=["debug"],
    dependencies=[Depends(_require_debug_enabled)],
)


# ==================== 请求模型(camelCase 对齐前端)====================


class DebugLaunchRequest(BaseModel):
    """启动调试会话请求。"""

    language: str = Field(..., description="语言: node / python / web")
    program: str = Field(..., description="目标程序路径或 URL")
    args: list[str] | None = Field(None, description="程序参数")
    cwd: str | None = Field(None, description="工作目录")
    env: dict[str, str] | None = Field(None, description="环境变量")


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
    frameId: int | None = Field(None, description="栈帧 ID(不传用当前帧)")


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
    if isinstance(e, DebugSessionForbidden):
        raise HTTPException(
            status_code=403,
            detail={"code": 403, "message": "无权访问该调试会话", "data": None},
        ) from e
    msg = str(e)
    if "不存在" in msg or "已终止" in msg:
        raise _session_not_found(session_id)
    raise _internal_error(e)


# ==================== 端点 ====================


@router.post("/launch")
async def launch(
    req: DebugLaunchRequest,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
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
            owner_user_id=user_id,
        )
    except Exception as e:
        raise _internal_error(e)
    return _ok({"sessionId": session_id})


@router.post("/attach")
async def attach(
    req: DebugAttachRequest,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """POST /api/v1/debug/attach — 附加到已运行进程。"""
    manager = get_debug_manager()
    try:
        session_id = await manager.attach(
            language=req.language,
            port=req.port,
            host=req.host,
            owner_user_id=user_id,
        )
    except Exception as e:
        raise _internal_error(e)
    return _ok({"sessionId": session_id})


@router.post("/sessions/{session_id}/breakpoints")
async def set_breakpoints(
    session_id: str,
    req: DebugBreakpointsRequest,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """POST /api/v1/debug/sessions/{id}/breakpoints — 设置断点。"""
    manager = get_debug_manager()
    _guard_owner(manager, session_id, user_id)
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
async def continue_execution(
    session_id: str,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """POST /api/v1/debug/sessions/{id}/continue — 继续执行。"""
    manager = get_debug_manager()
    _guard_owner(manager, session_id, user_id)
    try:
        stopped = await manager.continue_execution(session_id)
    except Exception as e:
        _handle_debug_error(session_id, e)
        raise
    return _ok({"stopped": stopped})


@router.post("/sessions/{session_id}/step")
async def step(
    session_id: str,
    req: DebugStepRequest,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """POST /api/v1/debug/sessions/{id}/step — 单步执行。

    stepType=continue 时内部转发到 continue_execution(语义等价)。
    """
    manager = get_debug_manager()
    _guard_owner(manager, session_id, user_id)
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
async def get_stack_trace(
    session_id: str,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """GET /api/v1/debug/sessions/{id}/stack — 获取调用栈。"""
    manager = get_debug_manager()
    _guard_owner(manager, session_id, user_id)
    try:
        stack_frames = await manager.get_stack_trace(session_id)
    except Exception as e:
        _handle_debug_error(session_id, e)
        raise
    return _ok({"stackFrames": stack_frames})


@router.get("/sessions/{session_id}/scopes")
async def get_scopes(
    session_id: str,
    frameId: int = Query(..., description="栈帧 ID(必填,从 stackTrace 获取)"),
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """GET /api/v1/debug/sessions/{id}/scopes — 获取 frame 的 scope 分组(DAP scopes)。"""
    manager = get_debug_manager()
    _guard_owner(manager, session_id, user_id)
    try:
        scopes = await manager.get_scopes(session_id=session_id, frame_id=frameId)
    except Exception as e:
        _handle_debug_error(session_id, e)
        raise
    return _ok({"scopes": scopes})


@router.get("/sessions/{session_id}/threads")
async def get_threads(
    session_id: str,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """GET /api/v1/debug/sessions/{id}/threads — 获取线程列表(DAP threads)。"""
    manager = get_debug_manager()
    _guard_owner(manager, session_id, user_id)
    try:
        threads = await manager.get_threads(session_id)
    except Exception as e:
        _handle_debug_error(session_id, e)
        raise
    return _ok({"threads": threads})


@router.get("/sessions/{session_id}/variables")
async def get_variables(
    session_id: str,
    variablesReference: int | None = Query(None, description="DAP 变量引用(优先,支持子树懒加载)"),
    frameId: int | None = Query(None, description="栈帧 ID(兼容旧接口)"),
    scope: str = Query("local", description="变量作用域: local/globals/closure"),
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """GET /api/v1/debug/sessions/{id}/variables — 获取变量。

    DAP 语义:variablesReference 优先(直接透传 DAP variables 请求,支持子树懒加载);
    未传时回退到 frameId + scope(旧接口,scopes+variables 组合)。
    """
    if variablesReference is None and frameId is None:
        raise HTTPException(
            status_code=422,
            detail={
                "code": 422,
                "message": "需要 variablesReference 或 frameId 参数",
                "data": None,
            },
        )
    manager = get_debug_manager()
    _guard_owner(manager, session_id, user_id)
    try:
        if variablesReference is not None:
            variables = await manager.get_variables_by_reference(
                session_id=session_id,
                variables_reference=variablesReference,
            )
        else:
            # 前面已校验 variablesReference/frameId 至少一个非空,此处 frameId 必有值
            assert frameId is not None
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
async def evaluate(
    session_id: str,
    req: DebugEvalRequest,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """POST /api/v1/debug/sessions/{id}/eval — 表达式求值。"""
    manager = get_debug_manager()
    _guard_owner(manager, session_id, user_id)
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
async def disconnect(
    session_id: str,
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """DELETE /api/v1/debug/sessions/{id} — 断开会话。"""
    manager = get_debug_manager()
    _guard_owner(manager, session_id, user_id)
    try:
        disconnected = await manager.disconnect(session_id)
    except Exception as e:
        raise _internal_error(e)
    if not disconnected:
        raise _session_not_found(session_id)
    return _ok({"disconnected": True})


@router.get("/sessions")
async def list_sessions(
    user_id: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """GET /api/v1/debug/sessions — 列出会话(仅当前主体自己的)。"""
    manager = get_debug_manager()
    sessions = await manager.list_sessions(user_id)
    return _ok({"sessions": sessions})


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

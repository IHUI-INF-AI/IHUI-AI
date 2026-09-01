# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LangGraph API 路由(P3 Q1.8)。

5 端点:
- POST /{thread_id}/interrupt — 触发暂停(HITL)
- POST /resume — 恢复执行
- GET  /{thread_id}/state — 查询当前状态
- GET  /{thread_id}/history — 查询历史(Time Travel)
- GET  /{thread_id}/stream — SSE 流式输出

设计:
- 路由自注册:main agent 挂载 `router` 即可,无需改 main.py。
- graph 注入:通过 `register_langgraph_graph(graph)` 注册已编译(含 checkpointer)的图。
  未注册时 /stream 与 /state 的 graph 部分降级(仅返回自定义表数据)。
- 全 async,响应统一 {code, message, data}。
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.langgraph_checkpoint import (
    LangGraphCheckpointManager,
    get_langgraph_checkpoint_manager,
    resume_from_interrupt,
    trigger_interrupt,
)
from app.services.langgraph_stream import (
    DEFAULT_STREAM_MODES,
    VALID_STREAM_MODES,
    SSEEvent,
    stream_agent_execution,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/langgraph", tags=["langgraph"])

# ----------------------------------------------------------------------
# 已编译 graph 注册表(由 main agent / 挂载方注册)
# ----------------------------------------------------------------------

_registered_graph: Any | None = None


def register_langgraph_graph(graph: Any) -> None:
    """注册已编译(含 checkpointer)的 LangGraph,供 /stream /resume /state 使用。

    Args:
        graph: langgraph StateGraph.compile(checkpointer=...) 返回值
    """
    global _registered_graph
    _registered_graph = graph
    logger.info("langgraph router 已注册编译图: %r", graph)


def get_registered_graph() -> Any | None:
    """获取已注册的编译图(未注册返回 None)。"""
    return _registered_graph


def _ensure_graph() -> Any | None:
    """懒加载:未注册时尝试编译并注册默认 LangGraph(plan→execute→summarize)。

    2026-09-01 补实:此前 LangGraph 路由"宣传存在但默认不可用",需显式
    register_langgraph_graph 才生效。现改为首次调用自动编译注册,消除
    "名不副实"缺口;编译失败/异常降级保持 None,走既有降级路径,不阻塞。
    """
    if _registered_graph is not None:
        return _registered_graph
    try:
        from ..services.agent_graph import build_agent_graph

        graph = build_agent_graph()
        register_langgraph_graph(graph)
        logger.info("langgraph 懒加载注册默认图(plan→execute→summarize)")
        return graph
    except Exception as e:
        logger.warning("langgraph 懒加载注册失败(降级保持未注册): %s", e)
        return None


def _manager() -> LangGraphCheckpointManager:
    """获取 checkpoint manager 单例。"""
    return get_langgraph_checkpoint_manager()


def _ok(data: Any, message: str = "ok") -> dict[str, Any]:
    """统一成功响应 {code:0, message, data}。"""
    return {"code": 0, "message": message, "data": data}


# ----------------------------------------------------------------------
# 请求 / 响应模型(对齐 packages/types/src/langgraph.ts)
# ----------------------------------------------------------------------


class InterruptRequest(BaseModel):
    """触发 interrupt 请求(对齐 InterruptEvent)。"""

    node_id: str = Field(..., description="暂停的节点 id")
    reason: str = Field(..., description="暂停原因")
    payload: Any = Field(default=None, description="暂停附加负载")


class ResumeRequest(BaseModel):
    """恢复 interrupt 请求(对齐 ResumeCommand)。"""

    thread_id: str = Field(..., description="线程 id")
    interrupt_id: str = Field(..., description="暂停事件 id")
    resume_value: Any = Field(default=None, description="恢复值")
    action: str = Field(default="resume", description="resume / rollback / cancel")


class StreamQuery(BaseModel):
    """stream 端点 query 参数(用于 GET 透传 input)。"""

    input: dict[str, Any] | None = Field(default=None, description="图输入(JSON)")
    stream_modes: list[str] | None = Field(default=None, description="stream_mode 列表")


# ----------------------------------------------------------------------
# 1. POST /{thread_id}/interrupt — 触发暂停
# ----------------------------------------------------------------------


@router.post("/{thread_id}/interrupt")
async def post_interrupt(thread_id: str, req: InterruptRequest) -> dict[str, Any]:
    """触发节点暂停(HITL)。

    实际 interrupt() 调用须在 graph 节点函数内执行;本端点构造并持久化 interrupt event,
    供前端轮询 / SSE 消费。若已注册 graph 且节点已通过 interrupt() 暂停,本端点仅记录元数据。
    """
    try:
        event = await trigger_interrupt(
            thread_id=thread_id,
            node_id=req.node_id,
            reason=req.reason,
            payload=req.payload,
        )
        # 持久化到自定义 writes 表(channel=interrupt),供 /state 查询
        manager = _manager()
        try:
            await manager.save_write(
                thread_id=thread_id,
                checkpoint_id=event["interruptId"],
                task_id=event["interruptId"],
                channel="interrupt",
                value=event,
            )
        except Exception as e:  # 持久化失败不阻塞响应
            logger.warning("interrupt 事件持久化失败: %s", e)
        return _ok(event, "interrupt triggered")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


# ----------------------------------------------------------------------
# 2. POST /resume — 恢复执行
# ----------------------------------------------------------------------


@router.post("/resume")
async def post_resume(req: ResumeRequest) -> dict[str, Any]:
    """恢复暂停的节点。

    返回 ResumeCommand;若已注册 graph,后续由调用方通过 /stream(graph_input=null)
    继续 astream。本端点不直接驱动 graph(避免阻塞),只构造恢复指令。
    """
    try:
        command = await resume_from_interrupt(
            thread_id=req.thread_id,
            interrupt_id=req.interrupt_id,
            resume_value=req.resume_value,
            action=req.action,
        )
        graph = _ensure_graph()
        if graph is not None:
            # graph 已注册:尝试用 Command(resume=...) 触发一次 ainvoke 以推进执行
            # (非流式;流式恢复走 /stream?input=null)
            try:
                # 软依赖 langgraph.types.Command
                from langgraph.types import Command

                config = {"configurable": {"thread_id": req.thread_id}}
                if req.action == "resume":
                    await graph.ainvoke(Command(resume=req.resume_value), config=config)
                    command["invoked"] = True
                elif req.action == "rollback":
                    # rollback:不调用 ainvoke,仅标记,由调用方 update_state 后重跑
                    command["invoked"] = False
                else:  # cancel
                    command["invoked"] = False
            except ImportError:
                command["invoked"] = False
                command["invoke_skipped_reason"] = "langgraph 未安装"
            except Exception as e:
                command["invoked"] = False
                command["invoke_error"] = str(e)
                logger.warning("resume ainvoke 失败: %s", e)
        else:
            command["invoked"] = False
            command["invoke_skipped_reason"] = "未注册编译图"
        return _ok(command, "resume command processed")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


# ----------------------------------------------------------------------
# 3. GET /{thread_id}/state — 查询当前状态
# ----------------------------------------------------------------------


@router.get("/{thread_id}/state")
async def get_state(thread_id: str) -> dict[str, Any]:
    """查询线程当前状态:自定义表最新 checkpoint + graph StateSnapshot(若已注册)。"""
    manager = _manager()
    try:
        latest = await manager.get_latest_checkpoint(thread_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from None

    graph_state: dict[str, Any] | None = None
    graph = _ensure_graph()
    if graph is not None:
        try:
            graph_state = await manager.get_graph_state(graph, thread_id)
        except RuntimeError as e:
            logger.warning("get_graph_state 失败: %s", e)
            graph_state = None
        except Exception as e:
            logger.warning("get_graph_state 异常: %s", e)
            graph_state = None

    return _ok(
        {
            "threadId": thread_id,
            "latestCheckpoint": latest,
            "graphState": graph_state,
        }
    )


# ----------------------------------------------------------------------
# 4. GET /{thread_id}/history — 查询历史(Time Travel)
# ----------------------------------------------------------------------


@router.get("/{thread_id}/history")
async def get_history(
    thread_id: str,
    limit: int = Query(100, ge=1, le=1000, description="返回条数上限"),
) -> dict[str, Any]:
    """查询线程历史 checkpoint 列表(Time Travel 用),按 created_at 升序。"""
    manager = _manager()
    try:
        history = await manager.get_state_history(thread_id, limit=limit)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from None
    return _ok(
        {
            "threadId": thread_id,
            "history": history,
            "count": len(history),
        }
    )


# ----------------------------------------------------------------------
# 5. GET /{thread_id}/stream — SSE 流式输出
# ----------------------------------------------------------------------


@router.get("/{thread_id}/stream")
async def get_stream(
    thread_id: str,
    request: Request,
    input: str | None = Query(
        default=None, description="图输入 JSON 字符串(首次执行传入,恢复时省略)"
    ),
    stream_modes: str | None = Query(
        default=None,
        description="stream_mode 逗号分隔,如 updates,messages,events",
    ),
) -> StreamingResponse:
    """SSE 流式输出 agent 执行过程。

    Query 参数:
    - input: 图输入 JSON 字符串(可选;恢复执行时不传)
    - stream_modes: stream_mode 逗号分隔(可选,默认 updates,messages,events)

    SSE 输出:`event: <type>\\ndata: <json>\\n\\n`
    """
    graph = _ensure_graph()
    if graph is None:
        raise HTTPException(
            status_code=503,
            detail="未注册编译图,请先调用 register_langgraph_graph(graph)",
        )

    # 解析 input
    graph_input: dict[str, Any] | None = None
    if input:
        try:
            graph_input = json.loads(input)
            if not isinstance(graph_input, dict):
                raise ValueError("input 必须是 JSON 对象")
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=400, detail=f"input JSON 解析失败: {e}") from None

    # 解析 stream_modes
    modes: list[str] | None = None
    if stream_modes:
        modes = [m.strip() for m in stream_modes.split(",") if m.strip()]
        invalid = [m for m in modes if m not in VALID_STREAM_MODES]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"非法 stream_mode: {invalid},允许 {sorted(VALID_STREAM_MODES)}",
            )

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for evt in stream_agent_execution(
                graph=graph,
                thread_id=thread_id,
                graph_input=graph_input,
                stream_modes=modes or DEFAULT_STREAM_MODES,
            ):
                if await request.is_disconnected():
                    logger.info("langgraph SSE client disconnected thread=%s", thread_id)
                    break
                yield _sse_format(evt)
        except Exception as e:  # pragma: no cover
            logger.exception("langgraph SSE 异常 thread=%s", thread_id)
            err_evt = SSEEvent(
                type="error",
                thread_id=thread_id,
                node_id=None,
                data={"message": str(e), "type": type(e).__name__},
            )
            yield _sse_format(err_evt)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _sse_format(evt: SSEEvent) -> str:
    """SSEEvent -> SSE 文本帧。"""
    payload = evt.to_dict()
    # data 中可能含非 ASCII 字符,ensure_ascii=False 保留可读性
    data_str = json.dumps(payload, ensure_ascii=False, default=str)
    return f"event: {evt.type}\ndata: {data_str}\n\n"


__all__ = ["router", "register_langgraph_graph", "get_registered_graph"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

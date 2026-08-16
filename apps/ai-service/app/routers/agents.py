"""Agent 路由(9 端点)。

提供 agent 执行、状态查询、取消、trace 可视化,以及会话记忆管理。
新增 SSE 流式执行端点(事件缓冲 + 断线重连重放 + SSE event 字段 + 心跳保活)。
L5-10(2026-08-12):AgentLoopV2 执行器(env AGENT_EXECUTOR=loop_v2 启用,
重试/错误分类/元学习/事件总线),MCP 工具包装 + OpenAI tool_calls 格式转换。
"""

import asyncio
import json
import logging
import os
from typing import Any, AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..core.sse_buffer import sse_buffer
from ..services.agent_loop import agent_executor
from ..services.agent_orchestrator import AgentOrchestrator, agent_orchestrator
from ..services.langgraph_service import langgraph_service
from ..services.memory import memory_store
from ..services.skills import skill_evolution_service
from ..services.vector_memory import vector_memory

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# L5-10 AgentLoopV2 执行器接线(2026-08-12 立)
# ---------------------------------------------------------------------------


def _convert_openai_tool_calls(
    tc_list: Any,
) -> list[dict[str, Any]] | None:
    """llm_gateway 返回的 OpenAI 格式 tool_calls → AgentLoopV2 格式。

    OpenAI: [{id, type, function: {name, arguments: JSON字符串}}]
    AgentLoopV2: [{id, name, args: dict}]
    """
    if not tc_list:
        return None
    result: list[dict[str, Any]] = []
    for tc in tc_list:
        if not isinstance(tc, dict):
            continue
        fn = tc.get("function") or {}
        args_raw = fn.get("arguments") or "{}"
        if isinstance(args_raw, str):
            try:
                args = json.loads(args_raw)
            except (ValueError, TypeError):
                args = {}
        else:
            args = args_raw
        result.append(
            {"id": tc.get("id", ""), "name": fn.get("name", ""), "args": args}
        )
    return result or None


def _build_loop_v2_tools(tool_names: list[str] | None) -> list[Any]:
    """把 MCP 工具包装为 AgentLoopV2 的 ToolDefinition 列表(白名单过滤)。

    工具执行器走 mcp_server.call_tool(与 v1 agent_executor 同源),
    失败抛异常由 AgentLoopV2 的瞬时错误重试/错误分类机制处理。
    """
    from ..services.agent_loop_v2 import ToolDefinition
    from ..services.mcp_server import mcp_server

    tools: list[Any] = []
    for mt in mcp_server.list_tools():
        if tool_names and mt.name not in tool_names:
            continue

        async def _exec(args: dict[str, Any], _name: str = mt.name) -> Any:
            return await mcp_server.call_tool(_name, args)

        tools.append(
            ToolDefinition(
                name=mt.name,
                description=mt.description,
                parameters=mt.input_schema,
                executor=_exec,
            )
        )
    return tools


def _make_loop_v2_llm(model: str | None) -> Any:
    """构造 AgentLoopV2 的 llm_complete_fn(包装 llm_gateway.complete)。"""

    async def _llm(messages: list[dict[str, Any]], tools: list[Any]) -> dict[str, Any]:
        from ..core.llm_gateway import llm_gateway

        result = await llm_gateway.complete(messages, model=model)
        return {
            "content": result.get("content", ""),
            "tool_calls": _convert_openai_tool_calls(result.get("tool_calls")),
        }

    return _llm


def _is_loop_v2_enabled() -> bool:
    """生产执行器开关(默认保持 langgraph 现状,env 显式启用 loop_v2)。"""
    return os.environ.get("AGENT_EXECUTOR", "langgraph").lower() == "loop_v2"


def _map_hook_event_to_sse(event: str) -> str:
    """hook_engine 事件 → SSE event 类型(前端 use-agent-runtime 对齐)。"""
    return {
        "session.start": "session",
        "tool.before": "tool_call",
        "tool.after": "tool_result",
        "error": "error",
        "message.receive": "message",
    }.get(event, event)


@router.get("/agents/tasks/stream")
async def stream_agent_tasks(request: Request, agentId: str = "") -> StreamingResponse:
    """L5-10(2026-08-12):AgentLoopV2 实时事件订阅(workbench runtime 视图)。

    通过 hook_engine 订阅器实时推送 tool_call/tool_result/error/session 事件
    (按 agentId=session_id 过滤)。AgentLoopV2 执行器启用(AGENT_EXECUTOR=loop_v2)
    后,execute/stream 的事件会在此实时可见;未启用时无事件源(静默心跳)。
    """

    async def event_generator() -> AsyncIterator[str]:
        from ..services.hook_engine import hook_engine

        subs: dict[str, asyncio.Queue[Any]] = {}
        for evt in ("session.start", "tool.before", "tool.after", "error"):
            subs[evt] = hook_engine.subscribe(evt)
        try:
            # 心跳保活(30s) + 事件转发
            last_beat = asyncio.get_running_loop().time()
            while True:
                if await request.is_disconnected():
                    break
                got = False
                for evt, q in subs.items():
                    try:
                        payload = q.get_nowait()
                    except asyncio.QueueEmpty:
                        continue
                    got = True
                    if agentId and payload.get("session_id") not in (agentId, ""):
                        continue
                    sse_evt = {
                        "type": _map_hook_event_to_sse(evt),
                        "payload": payload,
                    }
                    yield f"event: {sse_evt['type']}\ndata: {json.dumps(sse_evt, ensure_ascii=False)}\n\n"
                now = asyncio.get_running_loop().time()
                if not got and now - last_beat > 30:
                    yield ": keep-alive\n\n"
                    last_beat = now
                await asyncio.sleep(0.2)
        finally:
            for evt, q in subs.items():
                hook_engine.unsubscribe(evt, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/agents/{agent_id}/stream")
async def stream_agent_logs(request: Request, agent_id: str) -> StreamingResponse:
    """L5-12(2026-08-12):Agent 运行日志 SSE(AgentRuntimeLog 断线修复)。

    按 agent_id(=session_id)过滤 hook_engine 事件,映射为前端 AgentRuntimeLog
    期望的 LogEntry 格式 {type, content, ts, success}。此前双端无此路由,
    workbench AgentRuntimeLog 组件 404 断线——与 tasks/stream 同一事件源,
    不同展示格式(日志型 vs 事件型)。
    """

    async def event_generator() -> AsyncIterator[str]:
        from ..services.hook_engine import hook_engine

        subs: dict[str, asyncio.Queue[Any]] = {}
        for evt in ("session.start", "tool.before", "tool.after", "error", "message.receive"):
            subs[evt] = hook_engine.subscribe(evt)
        try:
            last_beat = asyncio.get_running_loop().time()
            while True:
                if await request.is_disconnected():
                    break
                got = False
                for evt, q in subs.items():
                    try:
                        payload = q.get_nowait()
                    except asyncio.QueueEmpty:
                        continue
                    got = True
                    if payload.get("session_id") not in (agent_id, ""):
                        continue
                    entry = _map_hook_event_to_log_entry(evt, payload)
                    if entry is None:
                        continue
                    yield f"data: {json.dumps(entry, ensure_ascii=False)}\n\n"
                now = asyncio.get_running_loop().time()
                if not got and now - last_beat > 30:
                    yield ": keep-alive\n\n"
                    last_beat = now
                await asyncio.sleep(0.2)
        finally:
            for evt, q in subs.items():
                hook_engine.unsubscribe(evt, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


def _map_hook_event_to_log_entry(event: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    """hook_engine 事件 → AgentRuntimeLog LogEntry 格式 {type, content, ts, success}。"""
    now = payload.get("ts") or payload.get("timestamp") or ""
    ts = now if isinstance(now, str) else ""
    content = ""
    success: bool | None = None
    if event == "session.start":
        content = f"session {payload.get('session_id', '')} started"
    elif event == "tool.before":
        tools_count = payload.get("tools_count", "")
        content = f"LLM 推理完成,准备调用工具(tools_count={tools_count})"
    elif event == "tool.after":
        results = payload.get("tool_results") or []
        if results:
            # 每个工具结果一行(含重试/错误分类明细)
            lines = []
            for tr in results:
                if not isinstance(tr, dict):
                    continue
                status = tr.get("status", "")
                name = tr.get("name", "")
                line = f"tool {name} -> {status}"
                if tr.get("error"):
                    line += f" error={str(tr['error'])[:120]}"
                if tr.get("error_type"):
                    line += f" [{tr['error_type']}]"
                if tr.get("retry_count"):
                    line += f" (retry x{tr['retry_count']})"
                if tr.get("duration_ms") is not None:
                    line += f" {tr['duration_ms']}ms"
                lines.append(line)
            content = "; ".join(lines)
            success = all(
                isinstance(tr, dict) and tr.get("status") == "success"
                for tr in results
            )
        else:
            content = "工具执行完成"
            success = None
    elif event == "message.receive":
        content = f"回复完成(content_length={payload.get('content_length', '')})"
        success = True
    elif event == "error":
        content = f"error[{payload.get('error_type', 'unknown')}]: {str(payload.get('message', payload.get('error', '')))[:300]}"
        success = False
    else:
        return None
    return {"type": _map_hook_event_to_sse(event), "content": content, "ts": ts, "success": success}

# ---------------------------------------------------------------------------
# Trace 存储(进程内 LRU,供 agent 执行轨迹可视化)
# ---------------------------------------------------------------------------

_trace_store: dict[str, dict[str, Any]] = {}
_MAX_TRACES = 100


def store_trace(session_id: str, trace_data: dict[str, Any]) -> None:
    """存储 agent 执行 trace。"""
    _trace_store[session_id] = trace_data
    if len(_trace_store) > _MAX_TRACES:
        oldest = min(_trace_store.keys(), key=lambda k: _trace_store[k].get("timestamp", 0))
        del _trace_store[oldest]


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class AgentExecuteRequest(BaseModel):
    """执行 agent 请求。"""

    goal: str = Field(..., description="agent 目标/用户输入")
    session_id: str | None = Field(None, description="会话 ID,为空则新建")
    model: str | None = Field(None, description="指定模型,为空使用默认")
    max_iterations: int | None = Field(None, description="最大迭代次数")
    tools: list[str] | None = Field(None, description="允许调用的工具名列表")


class MemorySearchRequest(BaseModel):
    """记忆语义搜索请求。"""

    query: str = Field(..., description="搜索查询文本")
    top_k: int = Field(5, description="返回最相关的 N 条")
    session_id: str | None = Field(None, description="限定会话内搜索,为空则跨所有会话")


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.post("/agents/execute")
async def execute_agent(req: AgentExecuteRequest) -> dict[str, Any]:
    """执行 agent(同步返回结果)。"""
    result = await agent_executor.run(
        goal=req.goal,
        session_id=req.session_id,
        model=req.model,
        max_iterations=req.max_iterations,
        tools=req.tools,
    )
    return result


def _format_sse(event_id: str, event: dict[str, Any]) -> str:
    """格式化 SSE 事件(含 id + event + data 三行)。

    event 字段取自 payload 的 type,客户端可用 addEventListener 分发。
    """
    event_type = event.get("type", "message")
    return f"id: {event_id}\nevent: {event_type}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.post("/agents/execute/stream")
async def execute_agent_stream(req: AgentExecuteRequest, request: Request) -> StreamingResponse:
    """流式执行 agent,通过 SSE 返回增量结果,支持断线重连重放。

    优先使用 LangGraph 工作流(plan → execute → summarize);
    若工作流异常则降级为 agent_executor.run_stream。

    断线重连机制:
    - 每个事件携带 id 字段,客户端重连时发送 Last-Event-ID header
    - 服务端通过 sse_buffer 缓冲事件(5 分钟 TTL)
    - 重连时重放 Last-Event-ID 之后的所有缺失事件,然后继续实时流
    - 所有事件使用 SSE event: 字段(取自 payload type),客户端可 addEventListener 分发
    """

    last_event_id = request.headers.get("last-event-id")

    async def event_generator() -> AsyncIterator[str]:
        task_id = f"task-{asyncio.get_event_loop().time()}"

        # 断线重连: 先重放缺失事件
        if last_event_id:
            # 从 last_event_id 所在的 task 提取(格式 task_id-seq)
            replay_task_id = last_event_id.rsplit("-", 1)[0] if "-" in last_event_id else task_id
            missed = sse_buffer.replay_after(replay_task_id, last_event_id)
            for item in missed:
                yield _format_sse(item["id"], item["event"])
            # 如果有重放事件且最后一个事件是 done/error,直接结束
            if missed and missed[-1]["event"].get("type") in ("done", "error"):
                return

        try:
            # 发送开始事件(携带 resume_from 供客户端判断是否为重连)
            start_event = {"type": "start", "task_id": task_id, "session_id": req.session_id, "resume_from": last_event_id}
            eid = sse_buffer.append(task_id, start_event)
            yield _format_sse(eid, start_event)

            # L5-10(2026-08-12):AgentLoopV2 执行器(env AGENT_EXECUTOR=loop_v2 启用)。
            # 重试/错误分类/元学习/事件总线,SSE 事件经 hook_engine 订阅器按 session 过滤。
            if _is_loop_v2_enabled():
                from ..services.agent_loop_v2 import AgentLoopV2
                from ..services.hook_engine import hook_engine

                session_id = req.session_id or f"session-{asyncio.get_running_loop().time()}"
                loop = AgentLoopV2(
                    _make_loop_v2_llm(req.model),
                    tools=_build_loop_v2_tools(req.tools),
                    session_id=session_id,
                    max_iterations=req.max_iterations or 8,
                    enable_checkpoint=True,
                )
                # 订阅事件 → SSE(只转发本 session 的 tool/error/session 事件)
                subs: dict[str, asyncio.Queue[Any]] = {}
                for evt in ("session.start", "tool.before", "tool.after", "error", "message.receive"):
                    subs[evt] = hook_engine.subscribe(evt)
                try:
                    # L5-10 打磨(2026-08-12):run() 与事件转发并发——
                    # 此前 run() 完成后才消费队列(3s 窗口),SSE 不实时;
                    # 现 run 在后台任务执行,主流程边跑边转发(真流式)。
                    run_task = asyncio.create_task(
                        loop.run([{"role": "user", "content": req.goal}])
                    )
                    while not run_task.done() or any(
                        not q.empty() for q in subs.values()
                    ):
                        drained = False
                        for evt, q in subs.items():
                            try:
                                payload = q.get_nowait()
                            except asyncio.QueueEmpty:
                                continue
                            drained = True
                            if payload.get("session_id") not in (session_id, ""):
                                continue
                            sse_evt = {
                                "type": _map_hook_event_to_sse(evt),
                                "session_id": session_id,
                                "payload": payload,
                            }
                            eid2 = sse_buffer.append(task_id, sse_evt)
                            yield _format_sse(eid2, sse_evt)
                        if not drained:
                            if run_task.done():
                                break
                            await asyncio.sleep(0.05)
                    result = run_task.result()
                    # 结果事件(唯一 done,含 success/stop_reason/output)
                    result_evt = {
                        "type": "done",
                        "task_id": task_id,
                        "session_id": session_id,
                        "success": result.success,
                        "stop_reason": result.stop_reason,
                        "output": getattr(result, "final_response", "")[:2000],
                    }
                    eid3 = sse_buffer.append(task_id, result_evt)
                    yield _format_sse(eid3, result_evt)
                finally:
                    for evt, q in subs.items():
                        hook_engine.unsubscribe(evt, q)
                return

            # 优先用 LangGraph 工作流(完整 plan→execute→summarize)
            try:
                async for event in langgraph_service.run_graph_stream(
                    goal=req.goal,
                    session_id=req.session_id,
                    model=req.model,
                ):
                    # G9: 客户端断连则停止 LLM 生成,避免 token + buffer 浪费
                    if await request.is_disconnected():
                        break
                    eid = sse_buffer.append(task_id, event)
                    yield _format_sse(eid, event)
            except Exception:
                # 降级为 agent_executor
                async for event in agent_executor.run_stream(
                    goal=req.goal,
                    session_id=req.session_id,
                    model=req.model,
                    max_iterations=req.max_iterations,
                    tools=req.tools,
                ):
                    # G9: 客户端断连则停止 LLM 生成
                    if await request.is_disconnected():
                        break
                    eid = sse_buffer.append(task_id, event)
                    yield _format_sse(eid, event)

            # 发送结束事件
            done_event = {"type": "done", "task_id": task_id}
            eid = sse_buffer.append(task_id, done_event)
            yield _format_sse(eid, done_event)
        except Exception as e:
            err_event = {"type": "error", "message": str(e)}
            eid = sse_buffer.append(task_id, err_event)
            yield _format_sse(eid, err_event)
        finally:
            # G9: 立即清理缓冲区,避免已完成会话的过期事件占内存(TTL 仍兜底重连场景)
            sse_buffer.clear(task_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲,确保实时流式
        },
    )


@router.get("/agents/running")
async def list_running() -> dict[str, Any]:
    """列出所有运行中/已完成任务。"""
    return {"tasks": agent_executor.list_running()}


@router.get("/agents/sessions")
async def list_sessions() -> dict[str, Any]:
    """列出所有会话 ID。"""
    sessions = await memory_store.list_sessions()
    return {"sessions": sessions, "count": len(sessions)}


@router.get("/agents/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str, limit: int = 100
) -> dict[str, Any]:
    """获取指定会话的消息列表。"""
    messages = await memory_store.get(session_id, limit=limit)
    return {"session_id": session_id, "messages": messages, "count": len(messages)}


@router.delete("/agents/sessions/{session_id}")
async def clear_session(session_id: str) -> dict[str, Any]:
    """清除指定会话的全部消息。"""
    await memory_store.clear(session_id)
    await vector_memory.clear(session_id)
    return {"session_id": session_id, "cleared": True}


@router.post("/agents/memory/search")
async def search_memory(req: MemorySearchRequest) -> dict[str, Any]:
    """语义搜索记忆(向量检索)。

    通过 LLM 嵌入向量 + 余弦相似度检索最相关的历史记忆。
    支持跨会话搜索或限定在指定会话内搜索。
    """
    query_embedding = await vector_memory.embed(req.query)
    results = await vector_memory.search(
        query_embedding=query_embedding,
        top_k=req.top_k,
    )
    return {"query": req.query, "results": results, "count": len(results)}


@router.get("/agents/{task_id}/status")
async def get_task_status(task_id: str) -> dict[str, Any]:
    """查询任务状态。"""
    info = agent_executor.status(task_id)
    if not info:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    return info


@router.post("/agents/{task_id}/cancel")
async def cancel_task(task_id: str) -> dict[str, Any]:
    """取消任务。"""
    info = agent_executor.status(task_id)
    if not info:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    ok = agent_executor.cancel(task_id)
    latest_info = agent_executor.status(task_id)
    return {"task_id": task_id, "canceled": ok, "status": latest_info["status"] if latest_info else "cancelled"}


@router.post("/agents/skill-evolution")
async def trigger_skill_evolution(request: Request) -> dict[str, Any]:
    """手动触发 Skill 自进化评估。

    body: SkillEvolutionRequest 字典
    (taskId/sessionId/goal/steps/finalResult/existingSkills)。
    """
    body = await request.json()
    result = await skill_evolution_service.evaluate(body)
    return {"code": 0, "message": "ok", "data": result}


@router.post("/agents/debate")
async def agent_debate(request: Request) -> dict[str, Any]:
    """多 Agent 协商辩论(debate/vote/critique 三模式,P1-2)。

    body: AgentDebateRequest 字典(mode/agents/topic/maxRounds/sessionId/modelOverride)。
    - mode="debate":多 Agent 多轮交替发言,LLM 综合结论
    - mode="vote":每个 Agent 出方案,所有 Agent 投票选最佳
    - mode="critique":第一个 Agent 出方案,其余批判,迭代改进
    """
    body = await request.json()
    mode = body.get("mode", "debate")
    agents = body.get("agents", [])
    topic = body.get("topic", "")
    max_rounds = int(body.get("maxRounds", 3))
    session_id = body.get("sessionId")
    model_override = body.get("modelOverride")

    if len(agents) < 2:
        return {"code": 400, "message": "至少需要 2 个 Agent", "data": None}

    if mode == "debate":
        result = await agent_orchestrator.run_debate(
            agents, topic, max_rounds, session_id, model_override
        )
    elif mode == "vote":
        result = await agent_orchestrator.run_vote(
            agents, topic, session_id, model_override
        )
    elif mode == "critique":
        result = await agent_orchestrator.run_critique(
            agents, topic, max_rounds, session_id, model_override
        )
    else:
        return {"code": 400, "message": f"不支持的 mode: {mode}", "data": None}

    return {
        "code": 0,
        "message": "ok",
        "data": AgentOrchestrator.orchestration_to_dict(result),
    }


@router.get("/agent/trace/{session_id}")
async def get_agent_trace(session_id: str) -> dict[str, Any]:
    """获取 Agent 执行轨迹。

    返回该 session 的完整 trace(每轮迭代的推理/工具调用/结果/耗时)。
    数据由 AgentLoopV2 执行完成后通过 store_trace 写入。
    """
    trace = _trace_store.get(session_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return {"code": 0, "message": "success", "data": trace}


@router.get("/agent/traces")
async def list_agent_traces() -> dict[str, Any]:
    """列出所有可用的 Agent 执行轨迹。

    返回每个 trace 的元数据（session_id、timestamp、goal/task 摘要等），
    按 timestamp 降序排列，最多返回 50 条。
    """
    traces: list[dict[str, Any]] = []
    for session_id, trace_data in _trace_store.items():
        goal_raw = trace_data.get("goal", "")
        goal = (goal_raw[:100] + "...") if len(goal_raw) > 100 else goal_raw
        traces.append({
            "session_id": session_id,
            "timestamp": trace_data.get("timestamp", 0),
            "goal": goal,
            "steps": trace_data.get("iterations", 0) or len(trace_data.get("steps", [])),
            "status": trace_data.get("status", "completed"),
        })

    traces.sort(key=lambda t: t["timestamp"], reverse=True)
    return {"code": 0, "message": "success", "data": traces[:50]}


@router.get("/agents/{agent_id}/tool-calls")
async def get_agent_tool_calls(agent_id: str, range: str = "24h") -> dict[str, Any]:
    """Agent 工具调用链(agent-runtime ToolCallTree 数据源,2026-08-12 补缺)。

    此前 web 端调用 /api/agents/{id}/tool-calls 在 8802/8803 均 404。
    数据源:checkpoint trace(messages 中 assistant.tool_calls + tool 结果),
    缺失时降级进程内 _trace_store。
    """
    calls: list[dict[str, Any]] = []
    try:
        from ..services.agent_checkpoint import get_agent_checkpoint_manager

        cp = await get_agent_checkpoint_manager().load_latest_by_session(agent_id)
        if cp and cp.messages:
            for msg in cp.messages:
                if msg.get("role") == "assistant" and msg.get("tool_calls"):
                    for tc in msg["tool_calls"]:
                        calls.append({
                            "id": tc.get("id", ""),
                            "name": tc.get("name", ""),
                            "args": tc.get("args", {}),
                            "status": "called",
                            "result": "",
                        })
                elif msg.get("role") == "tool":
                    content = str(msg.get("content", ""))
                    matched = next(
                        (c for c in reversed(calls)
                         if c.get("id") == msg.get("tool_call_id")
                         and c.get("status") == "called"),
                        None,
                    )
                    if matched:
                        matched["status"] = "error" if "error" in content[:200] else "ok"
                        matched["result"] = content[:500]
    except Exception as e:
        logger.warning("get_agent_tool_calls checkpoint 提取失败(降级): %s", e)
    if not calls:
        trace = _trace_store.get(agent_id)
        if trace:
            for step in (trace.get("steps") or []):
                if isinstance(step, dict) and step.get("tool"):
                    calls.append({
                        "id": str(step.get("tool_call_id", "")),
                        "name": str(step.get("tool", "")),
                        "args": step.get("args", {}),
                        "status": "error" if step.get("error") else "ok",
                        "result": str(step.get("result", ""))[:500],
                    })
    return {"code": 0, "message": "success", "data": {"toolCalls": calls}}


@router.get("/agents/{agent_id}/errors")
async def get_agent_errors(agent_id: str, range: str = "24h") -> dict[str, Any]:
    """Agent 错误事件(agent-runtime ErrorHeatmap 数据源,2026-08-12 补缺)。

    数据源:checkpoint(failed 状态 + metadata.error + tool 消息 error)。
    """
    errors: list[dict[str, Any]] = []
    try:
        from ..services.agent_checkpoint import get_agent_checkpoint_manager

        cp = await get_agent_checkpoint_manager().load_latest_by_session(agent_id)
        if cp:
            meta = cp.metadata or {}
            if cp.status == "failed" or meta.get("error"):
                errors.append({
                    "type": str(meta.get("error_type", "unknown")),
                    "message": str(meta.get("error", "agent_loop failed"))[:300],
                    "timestamp": cp.created_at,
                })
            for msg in (cp.messages or []):
                if msg.get("role") == "tool":
                    content = str(msg.get("content", ""))
                    if content.startswith('{"error"'):
                        errors.append({
                            "type": "tool_error",
                            "message": content[:300],
                            "timestamp": cp.created_at,
                        })
    except Exception as e:
        logger.warning("get_agent_errors checkpoint 提取失败(降级): %s", e)
    if not errors:
        trace = _trace_store.get(agent_id)
        if trace:
            for step in (trace.get("steps") or []):
                if isinstance(step, dict) and step.get("error"):
                    errors.append({
                        "type": "step_error",
                        "message": str(step.get("error", ""))[:300],
                        "timestamp": trace.get("timestamp", 0),
                    })
    return {"code": 0, "message": "success", "data": {"errors": errors}}


@router.get("/agents/{agent_id}/sessions")
async def get_agent_sessions(agent_id: str, range: str = "24h") -> dict[str, Any]:
    """Agent 会话树(agent-runtime SessionTree 数据源,2026-08-12 补缺)。

    此前 web 端调用 /api/agents/{id}/sessions 在 8802/8803 均 404
    (8802 的 sessions 注册在 /api/agent-runtime/ 前缀,路径不匹配)。
    数据源:checkpoint manager 按 session 过滤(created_at 升序),
    缺失时降级进程内 _trace_store。
    """
    nodes: list[dict[str, Any]] = []
    try:
        from ..services.agent_checkpoint import get_agent_checkpoint_manager

        cps = await get_agent_checkpoint_manager().list_checkpoints(session_id=agent_id)
        for cp in cps:
            status_map = {
                "completed": "completed",
                "running": "active",
                "paused": "active",
                "failed": "error",
                "cancelled": "archived",
            }
            nodes.append({
                "id": cp.checkpoint_id,
                "startedAt": _ts_to_iso(cp.created_at),
                "messageCount": len(cp.messages or []),
                "status": status_map.get(cp.status, "archived"),
            })
    except Exception as e:
        logger.warning("get_agent_sessions checkpoint 提取失败(降级): %s", e)
    if not nodes:
        trace = _trace_store.get(agent_id)
        if trace:
            nodes.append({
                "id": agent_id,
                "startedAt": _ts_to_iso(trace.get("timestamp", 0)),
                "messageCount": len(trace.get("steps") or []),
                "status": "completed" if trace.get("status") != "failed" else "error",
            })
    return {"code": 0, "message": "success", "data": {"sessions": nodes}}


@router.get("/agents/{agent_id}/token-usage")
async def get_agent_token_usage(agent_id: str, range: str = "24h") -> dict[str, Any]:
    """Agent Token 用量(agent-runtime TokenUsageChart 数据源,2026-08-12 补缺)。

    此前 web 端调用 /api/agents/{id}/token-usage 在 8802/8803 均 404。
    数据源:checkpoint messages 按轮估算(prompt=输入/工具结果,completion=
    输出),缺失时降级 _trace_store。估算公式:字符数/4(中文约 1 token/字)。
    """
    items: list[dict[str, Any]] = []
    try:
        from ..services.agent_checkpoint import get_agent_checkpoint_manager

        cps = await get_agent_checkpoint_manager().list_checkpoints(session_id=agent_id)
        for cp in cps:
            prompt = 0
            completion = 0
            for msg in (cp.messages or []):
                role = msg.get("role", "")
                content = str(msg.get("content", ""))
                if role in ("user", "tool", "system"):
                    prompt += max(1, len(content) // 4)
                elif role == "assistant":
                    completion += max(1, len(content) // 4)
                    for tc in (msg.get("tool_calls") or []):
                        if isinstance(tc, dict):
                            completion += max(1, len(str(tc.get("args", ""))) // 4)
            if prompt or completion:
                items.append({
                    "sessionLabel": f"I{cp.iteration}",
                    "prompt": prompt,
                    "completion": completion,
                })
    except Exception as e:
        logger.warning("get_agent_token_usage checkpoint 提取失败(降级): %s", e)
    if not items:
        trace = _trace_store.get(agent_id)
        if trace:
            prompt = 0
            completion = 0
            for step in (trace.get("steps") or []):
                if isinstance(step, dict):
                    prompt += max(1, len(str(step.get("args", ""))) // 4)
                    completion += max(1, len(str(step.get("result", ""))) // 4)
            if prompt or completion:
                items.append({
                    "sessionLabel": agent_id[:8],
                    "prompt": prompt,
                    "completion": completion,
                })
    return {"code": 0, "message": "success", "data": {"tokenUsage": items}}


def _ts_to_iso(ts: Any) -> str:
    """时间戳(秒) → ISO8601(带 Z);非数值原样返回。"""
    if isinstance(ts, (int, float)) and ts > 0:
        import datetime as _dt

        return _dt.datetime.fromtimestamp(ts, tz=_dt.timezone.utc).isoformat()
    return ""

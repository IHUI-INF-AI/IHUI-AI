"""Agent 路由(8 端点)。

提供 agent 执行、状态查询、取消,以及会话记忆管理。
新增 SSE 流式执行端点(事件缓冲 + 断线重连重放 + SSE event 字段 + 心跳保活)。
"""

import asyncio
import json
from typing import Any

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

router = APIRouter()


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

    async def event_generator():
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
    vector_memory.clear(session_id)
    return {"session_id": session_id, "cleared": True}


@router.post("/agents/memory/search")
async def search_memory(req: MemorySearchRequest) -> dict[str, Any]:
    """语义搜索记忆(向量检索)。

    通过 LLM 嵌入向量 + 余弦相似度检索最相关的历史记忆。
    支持跨会话搜索或限定在指定会话内搜索。
    """
    results = await vector_memory.search(
        query=req.query,
        top_k=req.top_k,
        session_id=req.session_id,
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
    return {"task_id": task_id, "canceled": ok, "status": agent_executor.status(task_id)["status"]}


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

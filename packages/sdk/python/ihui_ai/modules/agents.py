"""Agent 模块 — 列表 / 调用 / 高级执行 / Pipeline / 并行。

端点(12 个):
- GET  /v1/agents
- GET  /v1/agents/:id
- POST /v1/agents/:id/call
- POST /v1/agents/execute(高级执行)
- POST /v1/agents/execute/stream(SSE 流式执行)
- GET  /v1/agents/tasks/:id/status
- POST /v1/agents/tasks/:id/cancel
- GET  /v1/agents/sessions
- DELETE /v1/agents/sessions/:id
- POST /v1/agents/pipeline
- POST /v1/agents/parallel
- POST /v1/agents/decompose
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from urllib.parse import quote

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..streaming import parse_agent_stream_async, parse_agent_stream_sync
from ..types import (
    AgentStreamEvent,
    V1AgentCallRequest,
    V1AgentCallResponse,
    V1AgentDecomposeResponse,
    V1AgentExecuteRequest,
    V1AgentExecuteResponse,
    V1AgentInfo,
    V1AgentParallelRequest,
    V1AgentParallelResponse,
    V1AgentPipelineRequest,
    V1AgentPipelineResponse,
    V1AgentSessionsResponse,
    V1AgentTaskStatusResponse,
    V1AgentsListResponse,
)


class AgentsApi:
    """Agent 模块(同步)— 列表 / 调用 / 高级执行 / Pipeline / 并行。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def list(self) -> V1AgentsListResponse:
        """GET /v1/agents(Agent 列表)。"""
        return self._client.request("GET", "/agents")

    def get(self, agent_id: str) -> V1AgentInfo:
        """GET /v1/agents/:id(Agent 详情)。"""
        return self._client.request("GET", f"/agents/{quote(agent_id, safe='')}")

    def call(self, agent_id: str, req: V1AgentCallRequest) -> V1AgentCallResponse:
        """POST /v1/agents/:id/call(调用 Agent)。"""
        return self._client.request("POST", f"/agents/{quote(agent_id, safe='')}/call", req)

    def execute(self, req: V1AgentExecuteRequest) -> V1AgentExecuteResponse:
        """POST /v1/agents/execute(高级执行,支持 PermissionGuard)。"""
        return self._client.request("POST", "/agents/execute", req)

    def execute_stream(self, req: V1AgentExecuteRequest) -> Iterator[AgentStreamEvent]:
        """POST /v1/agents/execute/stream(SSE 流式执行)→ 生成器。"""
        byte_iter = self._client.request_stream("POST", "/agents/execute/stream", req)
        yield from parse_agent_stream_sync(byte_iter)

    def get_task_status(self, task_id: str) -> V1AgentTaskStatusResponse:
        """GET /v1/agents/tasks/:id/status(任务状态)。"""
        return self._client.request("GET", f"/agents/tasks/{quote(task_id, safe='')}/status")

    def cancel_task(self, task_id: str) -> None:
        """POST /v1/agents/tasks/:id/cancel(取消任务)。"""
        self._client.request("POST", f"/agents/tasks/{quote(task_id, safe='')}/cancel")

    def list_sessions(self) -> V1AgentSessionsResponse:
        """GET /v1/agents/sessions(会话列表)。"""
        return self._client.request("GET", "/agents/sessions")

    def delete_session(self, session_id: str) -> None:
        """DELETE /v1/agents/sessions/:id(删除会话)。"""
        self._client.request("DELETE", f"/agents/sessions/{quote(session_id, safe='')}")

    def pipeline(self, req: V1AgentPipelineRequest) -> V1AgentPipelineResponse:
        """POST /v1/agents/pipeline(Pipeline 编排)。"""
        return self._client.request("POST", "/agents/pipeline", req)

    def parallel(self, req: V1AgentParallelRequest) -> V1AgentParallelResponse:
        """POST /v1/agents/parallel(并行执行)。"""
        return self._client.request("POST", "/agents/parallel", req)

    def decompose(self, req: V1AgentExecuteRequest) -> V1AgentDecomposeResponse:
        """POST /v1/agents/decompose(任务分解)。"""
        return self._client.request("POST", "/agents/decompose", req)


class AsyncAgentsApi:
    """Agent 模块(asyncio)— 列表 / 调用 / 高级执行 / Pipeline / 并行。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def list(self) -> V1AgentsListResponse:
        """GET /v1/agents(Agent 列表)。"""
        return await self._client.request("GET", "/agents")

    async def get(self, agent_id: str) -> V1AgentInfo:
        """GET /v1/agents/:id(Agent 详情)。"""
        return await self._client.request("GET", f"/agents/{quote(agent_id, safe='')}")

    async def call(self, agent_id: str, req: V1AgentCallRequest) -> V1AgentCallResponse:
        """POST /v1/agents/:id/call(调用 Agent)。"""
        return await self._client.request("POST", f"/agents/{quote(agent_id, safe='')}/call", req)

    async def execute(self, req: V1AgentExecuteRequest) -> V1AgentExecuteResponse:
        """POST /v1/agents/execute(高级执行,支持 PermissionGuard)。"""
        return await self._client.request("POST", "/agents/execute", req)

    async def execute_stream(self, req: V1AgentExecuteRequest) -> AsyncIterator[AgentStreamEvent]:
        """POST /v1/agents/execute/stream(SSE 流式执行)→ 异步生成器。"""
        reader = await self._client.request_stream("POST", "/agents/execute/stream", req)
        async for event in parse_agent_stream_async(reader):
            yield event

    async def get_task_status(self, task_id: str) -> V1AgentTaskStatusResponse:
        """GET /v1/agents/tasks/:id/status(任务状态)。"""
        return await self._client.request("GET", f"/agents/tasks/{quote(task_id, safe='')}/status")

    async def cancel_task(self, task_id: str) -> None:
        """POST /v1/agents/tasks/:id/cancel(取消任务)。"""
        await self._client.request("POST", f"/agents/tasks/{quote(task_id, safe='')}/cancel")

    async def list_sessions(self) -> V1AgentSessionsResponse:
        """GET /v1/agents/sessions(会话列表)。"""
        return await self._client.request("GET", "/agents/sessions")

    async def delete_session(self, session_id: str) -> None:
        """DELETE /v1/agents/sessions/:id(删除会话)。"""
        await self._client.request("DELETE", f"/agents/sessions/{quote(session_id, safe='')}")

    async def pipeline(self, req: V1AgentPipelineRequest) -> V1AgentPipelineResponse:
        """POST /v1/agents/pipeline(Pipeline 编排)。"""
        return await self._client.request("POST", "/agents/pipeline", req)

    async def parallel(self, req: V1AgentParallelRequest) -> V1AgentParallelResponse:
        """POST /v1/agents/parallel(并行执行)。"""
        return await self._client.request("POST", "/agents/parallel", req)

    async def decompose(self, req: V1AgentExecuteRequest) -> V1AgentDecomposeResponse:
        """POST /v1/agents/decompose(任务分解)。"""
        return await self._client.request("POST", "/agents/decompose", req)


__all__ = ["AgentsApi", "AsyncAgentsApi"]

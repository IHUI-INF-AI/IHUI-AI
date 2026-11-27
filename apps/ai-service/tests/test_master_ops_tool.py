# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P3-05 agent_ops：只读面、未实现动作明确拒绝、HTTP 错误封闭。"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from app.services.master_tools.ops import AgentOpsTool


def _tool(handler) -> AgentOpsTool:  # type: ignore[no-untyped-def]
    return AgentOpsTool(base_url="http://test", transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_run_get_reads_result() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={"code": 0, "data": {"action": "run_get", "result": {"id": "run-1", "status": "running"}}},
        )

    envelope = await _tool(handler).handle({"action": "run_get", "runId": "run-1"}, user_id="user-1")

    assert envelope["ok"] is True
    assert envelope["data"]["status"] == "running"
    assert captured == {"action": "run_get", "runId": "run-1"}


@pytest.mark.asyncio
async def test_decomposed_mode_still_explicitly_rejected() -> None:
    envelope = await _tool(lambda _r: httpx.Response(200, json={"code": 0})).handle(
        {"action": "dispatch", "definitionId": "def-1", "goal": "拆掉它", "mode": "decomposed"},
        user_id="user-1",
    )

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "AGENT_MODE_NOT_IMPLEMENTED"


@pytest.mark.asyncio
async def test_dispatch_debate_wires_agents_and_rounds(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.agent_orchestrator import (
        AgentOrchestrator,
        AgentStepResult,
        OrchestrationResult,
    )

    definitions = [
        _raw_definition("11111111-1111-4111-8111-111111111111", "debater-a"),
        _raw_definition("22222222-2222-4222-8222-222222222222", "debater-b"),
    ]
    calls: list[tuple[str, str, dict[str, Any]]] = []
    captured: dict[str, Any] = {}

    async def fake_debate(self, agents, topic, *args, **kwargs):  # type: ignore[no-untyped-def]
        captured.update({"agents": agents, "topic": topic, **kwargs})
        return OrchestrationResult(
            orchestration_id="orch-test",
            steps=[
                AgentStepResult(
                    agent_name=agents[0], input=topic, output="正方", status="completed"
                ),
                AgentStepResult(
                    agent_name=agents[1], input=topic, output="反方", status="completed"
                ),
            ],
            final_output="综合：两边都有理",
            status="completed",
            total_duration_ms=12.0,
        )

    monkeypatch.setattr(AgentOrchestrator, "run_debate", fake_debate)
    envelope = await _tool(_run_handler(definitions, calls)).handle(
        {
            "action": "dispatch",
            "mode": "debate",
            "definitionId": definitions[0]["id"],
            "goal": "要不要上四天工作制",
            "maxRounds": 2,
            "agents": [{"definitionId": d["id"]} for d in definitions],
        },
        user_id="user-1",
    )

    assert envelope["ok"] is True
    assert captured["agents"] == [d["id"] for d in definitions]
    assert captured["topic"] == "要不要上四天工作制"
    assert captured["max_rounds"] == 2
    assert len(envelope["data"]["steps"]) == 2
    envelope = await _tool(lambda _r: httpx.Response(200, json={"code": 0})).handle(
        {"action": "dispatch", "definitionId": "def-1", "goal": "做一件小事", "mode": "parallel"},
        user_id="user-1",
    )

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "AGENT_DISPATCH_INPUT_MISSING"


def _raw_definition(def_id: str, name: str) -> dict[str, Any]:
    return {
        "id": def_id,
        "version": 4,
        "name": name,
        "displayName": name,
        "description": "测试",
        "role": "reviewer",
        "systemPrompt": "只读评审",
        "tools": ["read_file"],
        "skills": [],
        "model": None,
        "temperature": "0.2",
        "maxTokens": None,
        "maxIterations": 5,
        "permissions": {},
        "memoryPolicy": {},
        "budget": {},
        "concurrencyLimit": 1,
        "isBuiltin": False,
        "isDispatchable": True,
        "ownerUserId": "user-1",
        "teamId": None,
        "scope": "personal",
        "status": "active",
        "marketAgentId": None,
        "metadata": {},
        "updatedAt": "2026-11-28T10:00:00.000Z",
    }


def _run_handler(definitions: list[dict[str, Any]], calls: list[tuple[str, str, dict[str, Any]]]):
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content) if request.content else {}
        calls.append((request.method, request.url.path, payload))
        if request.url.path.endswith("/snapshot"):
            return httpx.Response(
                200,
                json={"code": 0, "data": {"items": definitions, "version": 1732788000000}},
            )
        if request.url.path.endswith("/runs") and request.method == "POST":
            return httpx.Response(
                201, json={"code": 0, "data": {"run": {"id": payload["runId"]}, "created": True}}
            )
        if "/runs/" in request.url.path:
            return httpx.Response(200, json={"code": 0, "data": {"ok": True}})
        return httpx.Response(404, json={"code": 404, "message": "not found"})

    return handler


@pytest.mark.asyncio
async def test_parallel_requires_participants() -> None:
    envelope = await _tool(lambda _r: httpx.Response(200, json={"code": 0})).handle(
        {"action": "dispatch", "definitionId": "def-1", "goal": "做一件小事", "mode": "parallel"},
        user_id="user-1",
    )

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "AGENT_DISPATCH_INPUT_MISSING"


@pytest.mark.asyncio
async def test_dispatch_parallel_runs_two_agents(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.agent_orchestrator import AgentOrchestrator, AgentStepResult

    definitions = [
        _raw_definition("11111111-1111-4111-8111-111111111111", "reviewer-a"),
        _raw_definition("22222222-2222-4222-8222-222222222222", "reviewer-b"),
    ]
    calls: list[tuple[str, str, dict[str, Any]]] = []

    async def fake_run(self, agent, user_input, *args, **kwargs):  # type: ignore[no-untyped-def]
        return AgentStepResult(
            agent_name=agent.name, input=user_input, output=f"{agent.name} 完成", status="completed"
        )

    monkeypatch.setattr(AgentOrchestrator, "_run_agent", fake_run)
    envelope = await _tool(_run_handler(definitions, calls)).handle(
        {
            "action": "dispatch",
            "mode": "parallel",
            "definitionId": definitions[0]["id"],
            "goal": "分别检查前端与后端",
            "agents": [
                {"definitionId": definitions[0]["id"], "goal": "检查前端"},
                {"definitionId": definitions[1]["id"], "goal": "检查后端"},
            ],
        },
        user_id="user-1",
    )

    assert envelope["ok"] is True
    assert envelope["data"]["runStatus"] == "succeeded"
    assert len(envelope["data"]["steps"]) == 2
    create_call = next(c for c in calls if c[0] == "POST" and c[1].endswith("/runs"))
    assert create_call[2]["mode"] == "parallel"
    assert create_call[2]["metadata"]["participants"] == [d["id"] for d in definitions]


@pytest.mark.asyncio
async def test_dispatch_pipeline_passes_previous_output(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.agent_orchestrator import AgentOrchestrator, AgentStepResult

    definitions = [
        _raw_definition("11111111-1111-4111-8111-111111111111", "drafter"),
        _raw_definition("22222222-2222-4222-8222-222222222222", "reviewer-b"),
    ]
    calls: list[tuple[str, str, dict[str, Any]]] = []
    inputs: list[str] = []

    async def fake_run(self, agent, user_input, *args, **kwargs):  # type: ignore[no-untyped-def]
        inputs.append(user_input)
        return AgentStepResult(
            agent_name=agent.name, input=user_input, output=f"{agent.name}:{user_input}", status="completed"
        )

    monkeypatch.setattr(AgentOrchestrator, "_run_agent", fake_run)
    envelope = await _tool(_run_handler(definitions, calls)).handle(
        {
            "action": "dispatch",
            "mode": "pipeline",
            "definitionId": definitions[0]["id"],
            "goal": "写一段介绍",
            "steps": [
                {"definitionId": definitions[0]["id"], "inputTemplate": "{input}"},
                {
                    "definitionId": definitions[1]["id"],
                    "inputTemplate": "请评审：{prev_output}",
                },
            ],
        },
        user_id="user-1",
    )

    assert envelope["ok"] is True
    assert envelope["data"]["runStatus"] == "succeeded"
    assert inputs[0] == "写一段介绍"
    assert "drafter:写一段介绍" in inputs[1]


@pytest.mark.asyncio
async def test_http_error_maps_code_and_retryable() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"code": 503, "message": "库挂了", "errorCode": "STORAGE_UNAVAILABLE"})

    envelope = await _tool(handler).handle({"action": "run_list", "definitionId": "def-1"}, user_id="user-1")

    assert envelope["error"]["code"] == "STORAGE_UNAVAILABLE"
    assert envelope["error"]["retryable"] is True


@pytest.mark.asyncio
async def test_local_pause_requires_run_id() -> None:
    envelope = await _tool(lambda _r: httpx.Response(200, json={"code": 0})).handle(
        {"action": "run_pause"}, user_id="user-1"
    )

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "AGENT_RUN_ID_REQUIRED"


@pytest.mark.asyncio
async def test_dispatch_single_creates_run_and_executes(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.agent_orchestrator import AgentOrchestrator, AgentStepResult

    raw_definition = {
        "id": "11111111-1111-4111-8111-111111111111",
        "version": 4,
        "name": "reviewer-readonly",
        "displayName": "只读评审",
        "description": "测试",
        "role": "reviewer",
        "systemPrompt": "只读评审",
        "tools": ["read_file"],
        "skills": [],
        "model": None,
        "temperature": "0.2",
        "maxTokens": None,
        "maxIterations": 5,
        "permissions": {},
        "memoryPolicy": {},
        "budget": {},
        "concurrencyLimit": 1,
        "isBuiltin": False,
        "isDispatchable": True,
        "ownerUserId": "user-1",
        "teamId": None,
        "scope": "personal",
        "status": "active",
        "marketAgentId": None,
        "metadata": {},
        "updatedAt": "2026-11-28T10:00:00.000Z",
    }
    calls: list[tuple[str, str, dict[str, Any]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content) if request.content else {}
        calls.append((request.method, request.url.path, payload))
        if request.url.path.endswith("/snapshot"):
            return httpx.Response(
                200,
                json={"code": 0, "data": {"items": [raw_definition], "version": 1732788000000}},
            )
        if request.url.path.endswith("/runs") and request.method == "POST":
            return httpx.Response(
                201, json={"code": 0, "data": {"run": {"id": payload["runId"]}, "created": True}}
            )
        if "/runs/" in request.url.path:
            return httpx.Response(200, json={"code": 0, "data": {"ok": True}})
        return httpx.Response(404, json={"code": 404, "message": "not found"})

    async def fake_run(self, agent, user_input, *args, **kwargs):  # type: ignore[no-untyped-def]
        return AgentStepResult(
            agent_name=agent.name, input=user_input, output="评审通过", status="completed"
        )

    monkeypatch.setattr(AgentOrchestrator, "_run_agent", fake_run)
    envelope = await _tool(handler).handle(
        {
            "action": "dispatch",
            "definitionId": "11111111-1111-4111-8111-111111111111",
            "goal": "检查这次改动",
            "mode": "single",
        },
        user_id="user-1",
    )

    assert envelope["ok"] is True
    assert envelope["data"]["status"] == "completed"
    assert envelope["data"]["agent"] == "reviewer-readonly"
    create_call = next(c for c in calls if c[0] == "POST" and c[1].endswith("/runs"))
    assert create_call[2]["definitionVersion"] == 4
    assert create_call[2]["mode"] == "single"
    assert create_call[2]["goal"] == "检查这次改动"


@pytest.mark.asyncio
async def test_health_is_passthrough() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"code": 0, "data": {"action": "health", "result": {"ok": True}}})

    envelope = await _tool(handler).handle({"action": "health"}, user_id="user-1")

    assert envelope["ok"] is True
    assert envelope["data"] == {"ok": True}

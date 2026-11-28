# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P3-05 agent_ops：只读面、未实现动作明确拒绝、HTTP 错误封闭。"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest

import app.services.master_tools.ops as ops_module
from app.services.master_tools.ops import AgentOpsTool


@pytest.fixture(autouse=True)
def _isolate_registry_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    """真库探针会在 data/ 留快照；本文件全部用 mock transport，必须关掉磁盘缓存。"""
    monkeypatch.setenv("AGENT_REGISTRY_DISABLE_DISK_CACHE", "1")


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
async def test_unknown_mode_still_explicitly_rejected() -> None:
    envelope = await _tool(lambda _r: httpx.Response(200, json={"code": 0})).handle(
        {"action": "dispatch", "definitionId": "def-1", "goal": "拆掉它", "mode": "unknown"},
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
async def test_dispatch_team_aggregates_contributors(monkeypatch: pytest.MonkeyPatch) -> None:
    from types import SimpleNamespace

    from app.services.agent_teams import TeamContributor, TeamOrchestrator

    definitions = [
        _raw_definition("11111111-1111-4111-8111-111111111111", "team-a"),
        _raw_definition("22222222-2222-4222-8222-222222222222", "team-b"),
    ]
    calls: list[tuple[str, str, dict[str, Any]]] = []
    captured: dict[str, Any] = {}

    async def fake_round(self, **kwargs):  # type: ignore[no-untyped-def]
        captured.update(kwargs)
        return SimpleNamespace(
            round_id="round-test",
            round_index=0,
            round_count=1,
            strategy=kwargs["strategy"],
            succeeded=2,
            failed=0,
            contributors=[
                TeamContributor(name=kwargs["tasks"][0]["name"], task="a", status="completed", output="甲完成"),
                TeamContributor(name=kwargs["tasks"][1]["name"], task="b", status="completed", output="乙完成"),
            ],
            aggregate={"merged_text": "甲完成\n乙完成", "recommendation": "可以合并"},
            summary_context="summary",
        )

    monkeypatch.setattr(TeamOrchestrator, "run_round", fake_round)
    envelope = await _tool(_run_handler(definitions, calls)).handle(
        {
            "action": "dispatch",
            "mode": "team",
            "definitionId": definitions[0]["id"],
            "goal": "一起完成方案",
            "strategy": "consensus",
            "agents": [{"definitionId": d["id"]} for d in definitions],
        },
        user_id="user-1",
    )

    assert envelope["ok"] is True
    assert envelope["data"]["runStatus"] == "succeeded"
    assert captured["strategy"] == "consensus"
    assert [task["name"] for task in captured["tasks"]] == [d["name"] for d in definitions]
    assert len(envelope["data"]["steps"]) == 2


@pytest.mark.asyncio
async def test_dispatch_decomposed_restricts_to_given_agents(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.agent_orchestrator import (
        AgentOrchestrator,
        AgentStepResult,
        OrchestrationResult,
    )

    definitions = [
        _raw_definition("11111111-1111-4111-8111-111111111111", "dec-a"),
        _raw_definition("22222222-2222-4222-8222-222222222222", "dec-b"),
    ]
    captured: dict[str, Any] = {}

    async def fake_decomposed(self, task, strategy="dag", session_id=None, agent_refs=None):  # type: ignore[no-untyped-def]
        captured.update(
            {"task": task, "strategy": strategy, "agent_refs": agent_refs, "session_id": session_id}
        )
        return OrchestrationResult(
            orchestration_id="orch-dec",
            steps=[
                AgentStepResult(agent_name="dec-a", input="子任务1", output="甲产出", status="completed"),
                AgentStepResult(agent_name="dec-b", input="子任务2", output="乙产出", status="completed"),
            ],
            final_output="分解执行完成",
            status="completed",
            total_duration_ms=10.0,
        )

    monkeypatch.setattr(AgentOrchestrator, "run_decomposed", fake_decomposed)
    envelope = await _tool(_run_handler(definitions, [])).handle(
        {
            "action": "dispatch",
            "mode": "decomposed",
            "definitionId": definitions[0]["id"],
            "goal": "把这件事拆成子任务",
            "decomposeStrategy": "sequential",
            "agents": [{"definitionId": d["id"]} for d in definitions],
        },
        user_id="user-1",
    )

    assert envelope["ok"] is True
    assert envelope["data"]["runStatus"] == "succeeded"
    assert captured["strategy"] == "sequential"
    assert sorted(captured["agent_refs"]) == sorted(d["id"] for d in definitions)
    assert len(envelope["data"]["steps"]) == 2


@pytest.mark.asyncio
async def test_dispatch_decomposed_requires_goal() -> None:
    definitions = [_raw_definition("11111111-1111-4111-8111-111111111111", "dec-a")]
    envelope = await _tool(_run_handler(definitions, [])).handle(
        {
            "action": "dispatch",
            "mode": "decomposed",
            "definitionId": definitions[0]["id"],
            "agents": [{"definitionId": definitions[0]["id"]}],
        },
        user_id="user-1",
    )

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "AGENT_DISPATCH_INPUT_MISSING"


@pytest.mark.asyncio
async def test_dispatch_recursive_maps_chunks_to_agents(monkeypatch: pytest.MonkeyPatch) -> None:
    from types import SimpleNamespace

    from app.services.agent_orchestrator import AgentOrchestrator
    from app.services.agent_teams import TeamOrchestrator

    definitions = [
        _raw_definition("11111111-1111-4111-8111-111111111111", "rec-a"),
        _raw_definition("22222222-2222-4222-8222-222222222222", "rec-b"),
    ]
    calls: list[tuple[str, str, str]] = []
    invoke_calls: list[tuple[str, str, str]] = []
    captured: dict[str, Any] = {}

    async def fake_invoke(self, agent_id, input_text, **kwargs):  # type: ignore[no-untyped-def]
        invoke_calls.append((agent_id, input_text, kwargs.get("session_id", "")))
        return SimpleNamespace(
            status="completed",
            final_output=f"{agent_id}:{input_text}",
            total_duration_ms=4.0,
        )

    async def fake_recursive(self, objective, chunks, **kwargs):  # type: ignore[no-untyped-def]
        captured["objective"] = objective
        captured["chunks"] = chunks
        captured["depth"] = kwargs.get("depth")
        captured["runner"] = kwargs.get("runner")
        contributors = await kwargs["runner"](
            [
                {"name": f"part-{index}", "task": f"{objective}::{chunk}"}
                for index, chunk in enumerate(chunks, start=1)
            ],
            2,
        )
        return {
            "ok": True,
            "objective": objective,
            "depth": kwargs.get("depth"),
            "levels": [
                {
                    "round_index": 0,
                    "strategy": "merge",
                    "succeeded": 2,
                    "failed": 0,
                    "contributors": [c.to_dict() for c in contributors],
                }
            ],
            "merged_text": "两片结论合并",
            "final_summary_context": "summary",
        }

    monkeypatch.setattr(AgentOrchestrator, "invoke", fake_invoke)
    monkeypatch.setattr(TeamOrchestrator, "run_recursive", fake_recursive)
    envelope = await _tool(_run_handler(definitions, calls)).handle(
        {
            "action": "dispatch",
            "mode": "recursive",
            "definitionId": definitions[0]["id"],
            "goal": "读完整份材料",
            "chunks": ["前半", "后半"],
            "depth": 2,
            "agents": [{"definitionId": d["id"]} for d in definitions],
        },
        user_id="user-1",
    )

    assert envelope["ok"] is True
    assert envelope["data"]["runStatus"] == "succeeded"
    assert captured["objective"] == "读完整份材料"
    assert captured["chunks"] == ["前半", "后半"]
    assert captured["depth"] == 2
    assert len(invoke_calls) == 2
    assert invoke_calls[0][0] == definitions[0]["id"] and "前半" in invoke_calls[0][1]
    assert invoke_calls[1][0] == definitions[1]["id"] and "后半" in invoke_calls[1][1]
    assert envelope["data"]["output"] == "两片结论合并"


@pytest.mark.asyncio
async def test_dispatch_recursive_requires_chunks() -> None:
    definitions = [_raw_definition("11111111-1111-4111-8111-111111111111", "rec-a")]
    envelope = await _tool(_run_handler(definitions, [])).handle(
        {
            "action": "dispatch",
            "mode": "recursive",
            "definitionId": definitions[0]["id"],
            "goal": "读完整份材料",
            "agents": [{"definitionId": definitions[0]["id"]}],
        },
        user_id="user-1",
    )

    assert envelope["ok"] is False
    assert envelope["error"]["code"] == "AGENT_DISPATCH_INPUT_MISSING"


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


@pytest.mark.asyncio
async def test_run_cancel_without_local_task_is_not_local(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def no_remote_cancel(*_args: Any, **_kwargs: Any) -> bool:
        return False

    monkeypatch.setattr(ops_module, "request_remote_cancel", no_remote_cancel)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/ops"):
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "result": {
                            "id": "run-remote",
                            "status": "running",
                            "sessionId": "session-remote",
                            "mode": "single",
                        }
                    },
                },
            )
        return httpx.Response(404, json={"code": 404, "message": "not found"})

    envelope = await _tool(handler).handle(
        {"action": "run_cancel", "runId": "run-remote"}, user_id="user-1"
    )

    assert envelope["ok"] is True
    assert envelope["data"]["outcome"] == "not_local"
    assert envelope["data"]["runStatus"] == "running"
    assert "跨实例取消位不可用" in envelope["data"]["reason"]


@pytest.mark.asyncio
async def test_run_cancel_remote_waits_for_ledger_terminal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"run_get": 0}

    async def remote_task(*_args: Any, **_kwargs: Any) -> bool:
        return True

    async def append_event(**_kwargs: Any) -> bool:
        return True

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content) if request.content else {}
        if request.url.path.endswith("/ops") and payload.get("action") == "run_get":
            calls["run_get"] += 1
            status = "running" if calls["run_get"] == 1 else "canceled"
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "result": {
                            "id": "run-remote",
                            "status": status,
                            "sessionId": "session-remote",
                        }
                    },
                },
            )
        return httpx.Response(404, json={"code": 404, "message": "not found"})

    monkeypatch.setattr(ops_module, "request_remote_cancel", remote_task)
    monkeypatch.setattr(ops_module, "_REMOTE_CANCEL_TIMEOUT_SECONDS", 1.0)
    monkeypatch.setattr(ops_module, "_REMOTE_CANCEL_POLL_SECONDS", 0.01)
    tool = _tool(handler)
    tool._append_cancel_event = AsyncMock(side_effect=append_event)  # type: ignore[method-assign]

    envelope = await tool.handle({"action": "run_cancel", "runId": "run-remote"}, user_id="user-1")

    assert envelope["ok"] is True
    assert envelope["data"]["outcome"] == "cancelled"
    assert envelope["data"]["runStatus"] == "canceled"
    assert envelope["data"]["remoteRequested"] is True
    assert envelope["data"]["cancelEventWritten"] is True


@pytest.mark.asyncio
async def test_run_stop_requests_local_graceful_stop_without_hard_cancel(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services.agent_task_registry import (
        register_run_control,
        unregister_run_control,
    )

    class Control:
        def __init__(self) -> None:
            self.stop_requested = False

        def request_stop(self) -> None:
            self.stop_requested = True

    control = Control()
    register_run_control("run-stop", control)
    calls = {"run_get": 0}

    async def append_event(**_kwargs: Any) -> bool:
        return True

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content) if request.content else {}
        if request.url.path.endswith("/ops") and payload.get("action") == "run_get":
            calls["run_get"] += 1
            status = "running" if calls["run_get"] == 1 else "canceled"
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "result": {
                            "id": "run-stop",
                            "status": status,
                            "sessionId": "session-stop",
                        }
                    },
                },
            )
        return httpx.Response(404, json={"code": 404, "message": "not found"})

    monkeypatch.setattr(ops_module, "_GRACEFUL_STOP_TIMEOUT_SECONDS", 1.0)
    monkeypatch.setattr(ops_module, "_REMOTE_CANCEL_POLL_SECONDS", 0.01)
    tool = _tool(handler)
    tool._append_cancel_event = AsyncMock(side_effect=append_event)  # type: ignore[method-assign]

    try:
        envelope = await tool.handle(
            {"action": "run_stop", "runId": "run-stop"}, user_id="user-1"
        )
    finally:
        unregister_run_control("run-stop", control)

    assert envelope["ok"] is True
    assert control.stop_requested is True
    assert envelope["data"]["outcome"] == "stopped"
    assert envelope["data"]["stopRequested"] is True
    assert envelope["data"]["remoteRequested"] is False
    assert envelope["data"]["cancelEventWritten"] is True
    assert tool._append_cancel_event.await_args.kwargs["error_code"] == "AGENT_RUN_STOPPED"


@pytest.mark.asyncio
async def test_run_stop_remote_waits_for_ledger_terminal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[dict[str, Any]] = []
    calls = {"run_get": 0}

    async def remote_task(*_args: Any, **kwargs: Any) -> bool:
        requests.append(kwargs)
        return True

    async def append_event(**_kwargs: Any) -> bool:
        return True

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content) if request.content else {}
        if request.url.path.endswith("/ops") and payload.get("action") == "run_get":
            calls["run_get"] += 1
            status = "running" if calls["run_get"] == 1 else "canceled"
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "result": {
                            "id": "run-remote-stop",
                            "status": status,
                            "sessionId": "session-remote-stop",
                        }
                    },
                },
            )
        return httpx.Response(404, json={"code": 404, "message": "not found"})

    monkeypatch.setattr(ops_module, "request_remote_cancel", remote_task)
    monkeypatch.setattr(ops_module, "_GRACEFUL_STOP_TIMEOUT_SECONDS", 1.0)
    monkeypatch.setattr(ops_module, "_REMOTE_CANCEL_POLL_SECONDS", 0.01)
    tool = _tool(handler)
    tool._append_cancel_event = AsyncMock(side_effect=append_event)  # type: ignore[method-assign]

    envelope = await tool.handle(
        {"action": "run_stop", "runId": "run-remote-stop"}, user_id="user-1"
    )

    assert envelope["ok"] is True
    assert requests and requests[0]["action"] == "run_stop"
    assert envelope["data"]["outcome"] == "stopped"
    assert envelope["data"]["remoteRequested"] is True


@pytest.mark.asyncio
async def test_run_retry_replays_dispatch_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.agent_orchestrator import AgentOrchestrator, AgentStepResult

    definition = _raw_definition("11111111-1111-4111-8111-111111111111", "retry-agent")
    calls: list[tuple[str, str, dict[str, Any]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content) if request.content else {}
        calls.append((request.method, request.url.path, payload))
        if request.url.path.endswith("/ops"):
            return httpx.Response(
                200,
                json={
                    "code": 0,
                    "data": {
                        "result": {
                            "id": "run-old",
                            "definitionId": definition["id"],
                            "definitionName": "retry-agent",
                            "mode": "single",
                            "goal": "重试任务",
                            "status": "failed",
                            "metadata": {
                                "dispatchPayload": {
                                    "mode": "single",
                                    "definitionId": definition["id"],
                                    "goal": "重试任务",
                                }
                            },
                        }
                    },
                },
            )
        if request.url.path.endswith("/snapshot"):
            return httpx.Response(
                200, json={"code": 0, "data": {"items": [definition], "version": 3}}
            )
        if request.url.path.endswith("/runs") and request.method == "POST":
            return httpx.Response(201, json={"code": 0, "data": {"created": True}})
        if "/runs/" in request.url.path:
            return httpx.Response(200, json={"code": 0, "data": {"ok": True}})
        return httpx.Response(404, json={"code": 404, "message": "not found"})

    async def fake_run(self, agent, user_input, *args, **kwargs):  # type: ignore[no-untyped-def]
        return AgentStepResult(
            agent_name=agent.name, input=user_input, output="重试完成", status="completed"
        )

    monkeypatch.setattr(AgentOrchestrator, "_run_agent", fake_run)
    envelope = await _tool(handler).handle(
        {"action": "run_retry", "runId": "run-old"}, user_id="user-1"
    )

    assert envelope["ok"] is True
    assert envelope["data"]["retriedFrom"] == "run-old"
    assert envelope["data"]["requestedMode"] == "single"
    assert envelope["data"]["run"]["status"] == "completed"
    assert envelope["data"]["run"]["runStatus"] == "succeeded"
    create_call = next(c for c in calls if c[0] == "POST" and c[1].endswith("/runs"))
    assert create_call[2]["sessionId"].endswith("-session")

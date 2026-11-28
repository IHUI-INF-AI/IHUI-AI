# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P2-06 orchestrator 绑定：provider 命中时带定义元数据，解析失败给明确错误码。"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.agent_definition import RuntimeAgentDefinition
from app.services.agent_orchestrator import (
    AgentOrchestrator,
    AgentRegistry,
    AgentStepResult,
    to_run_registry_status,
)
from app.services.agent_resolver import AgentResolveError


def _runtime(
    *, status: str = "active", definition_id: str = "def-reviewer", name: str = "reviewer-readonly"
) -> RuntimeAgentDefinition:
    return RuntimeAgentDefinition.from_mapping(
        {
            "id": definition_id,
            "version": 3,
            "name": name,
            "displayName": "只读评审",
            "description": "测试定义",
            "role": "reviewer",
            "systemPrompt": "只读评审提示词",
            "tools": ["read_file"],
            "skills": [],
            "model": "test-model",
            "temperature": "0.2",
            "maxTokens": 4096,
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
            "status": status,
            "marketAgentId": None,
            "metadata": {},
        }
    )


@pytest.mark.asyncio
async def test_provider_hit_attaches_definition_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    orchestrator = AgentOrchestrator(
        registry=AgentRegistry(),
        definition_provider=lambda _ref: _runtime(),
        available_tool_names={"read_file"},
    )
    seen: dict[str, Any] = {}

    async def fake_run(agent, user_input, *args, **kwargs):  # type: ignore[no-untyped-def]
        seen["name"] = agent.name
        seen["prompt"] = agent.system_prompt
        seen["tools"] = agent.tools
        return AgentStepResult(
            agent_name=agent.name, input=user_input, output="ok", status="completed"
        )

    monkeypatch.setattr(orchestrator, "_run_agent", fake_run)
    result = await orchestrator.invoke("reviewer-readonly", "检查一下")

    assert seen == {"name": "reviewer-readonly", "prompt": "只读评审提示词", "tools": ["read_file"]}
    assert result.status == "completed"
    assert result.definition_id == "def-reviewer"
    assert result.definition_version == 3
    assert result.prompt_hash


@pytest.mark.asyncio
async def test_provider_resolve_error_returns_code(monkeypatch: pytest.MonkeyPatch) -> None:
    def provider(_ref: str) -> RuntimeAgentDefinition:
        raise AgentResolveError("AGENT_DISABLED", "定义已停用")

    orchestrator = AgentOrchestrator(registry=AgentRegistry(), definition_provider=provider)
    result = await orchestrator.invoke("reviewer-readonly", "检查一下")

    assert result.status == "failed"
    assert result.error_code == "AGENT_DISABLED"
    assert result.error == "定义已停用"


@pytest.mark.asyncio
async def test_run_decomposed_only_uses_explicit_agent_refs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """分解/调度不能把进程内旧注册表的其他定义混进来。"""
    from types import SimpleNamespace

    from app.services.task_decomposer import TaskDecomposer

    runtimes = {
        "def-a": _runtime(definition_id="def-a", name="agent-a"),
        "def-b": _runtime(definition_id="def-b", name="agent-b"),
    }
    orchestrator = AgentOrchestrator(
        registry=AgentRegistry(),
        definition_provider=lambda ref: runtimes[ref],
    )
    captured: dict[str, Any] = {}

    async def fake_decompose(self, request):  # type: ignore[no-untyped-def]
        captured["agents"] = request.availableAgents
        return SimpleNamespace(
            subTasks=[], executionOrder=[], parallelBatches=[], strategy="dag"
        )

    monkeypatch.setattr(TaskDecomposer, "decompose", fake_decompose)
    result = await orchestrator.run_decomposed(
        "拆一下", strategy="dag", agent_refs=["def-a", "def-b"]
    )

    assert [item["name"] for item in captured["agents"]] == ["agent-a", "agent-b"]
    assert "任务分解未产生子任务" in result.final_output
    assert result.status == "failed"


@pytest.mark.asyncio
async def test_ledger_gets_registry_enum_not_completed(monkeypatch: pytest.MonkeyPatch) -> None:
    """`completed` 是编排语义；agent_runs 只认 succeeded，直写会被 R1 拒绝。"""
    statuses: list[tuple[str, str | None]] = []

    class FakeSession:
        def __init__(self, _run_id: str) -> None:
            pass

        async def status(
            self, status: str, *, error_code: str | None = None, error_message: str | None = None
        ) -> None:
            statuses.append((status, error_code))

        async def append(self, _event_type: str, _payload: dict[str, Any]) -> None:
            pass

    class FakeLedger:
        def session(self, run_id: str) -> FakeSession:
            return FakeSession(run_id)

    runtime = _runtime()
    orchestrator = AgentOrchestrator(
        registry=AgentRegistry(),
        definition_provider=lambda _ref: runtime,
        run_ledger=FakeLedger(),  # type: ignore[arg-type]
    )

    async def fake_run(agent, user_input, *args, **kwargs):  # type: ignore[no-untyped-def]
        return AgentStepResult(
            agent_name=agent.name,
            input=user_input,
            output="ok",
            status="completed",
            tool_calls=[{"tool": "read_file", "ok": True}],
        )

    monkeypatch.setattr(orchestrator, "_run_agent", fake_run)
    await orchestrator.invoke("reviewer-readonly", "跑", run_id="run-1")

    assert statuses == [("running", None), ("succeeded", None)]


def test_stub_result_never_lands_as_success() -> None:
    assert to_run_registry_status("completed") == "succeeded"
    assert to_run_registry_status("stub") == "failed"
    assert to_run_registry_status("skipped") == "canceled"
    assert to_run_registry_status("not-a-status") == "failed"


@pytest.mark.asyncio
async def test_without_provider_keeps_in_memory_registry(monkeypatch: pytest.MonkeyPatch) -> None:
    orchestrator = AgentOrchestrator(registry=AgentRegistry())

    async def fake_run(agent, user_input, *args, **kwargs):  # type: ignore[no-untyped-def]
        return AgentStepResult(agent_name=agent.name, input=user_input, output="ok", status="completed")

    monkeypatch.setattr(orchestrator, "_run_agent", fake_run)
    result = await orchestrator.invoke("researcher", "调研")

    assert result.status == "completed"
    assert result.definition_id is None


def _runtime_with_tools(tools: list[str]) -> RuntimeAgentDefinition:
    raw = _runtime().to_public_dict()
    raw["systemPrompt"] = _runtime().system_prompt
    raw["tools"] = tools
    return RuntimeAgentDefinition.from_mapping(raw)


@pytest.mark.asyncio
async def test_unknown_tool_rejected_before_run(monkeypatch: pytest.MonkeyPatch) -> None:
    runtime = _runtime_with_tools(["shell_magic"])
    orchestrator = AgentOrchestrator(
        registry=AgentRegistry(),
        definition_provider=lambda _ref: runtime,
        available_tool_names={"read_file"},
    )
    called = False

    async def fake_run(*args, **kwargs):  # type: ignore[no-untyped-def]
        nonlocal called
        called = True
        return AgentStepResult(agent_name="x", input="", output="", status="completed")

    monkeypatch.setattr(orchestrator, "_run_agent", fake_run)
    result = await orchestrator.invoke("reviewer-readonly", "跑")

    assert called is False
    assert result.error_code == "AGENT_TOOL_UNKNOWN"


@pytest.mark.asyncio
async def test_denied_tool_rejected_before_run(monkeypatch: pytest.MonkeyPatch) -> None:
    runtime = _runtime_with_tools(["delete_file"])
    orchestrator = AgentOrchestrator(
        registry=AgentRegistry(),
        definition_provider=lambda _ref: runtime,
        available_tool_names={"delete_file"},
    )
    called = False

    async def fake_run(*args, **kwargs):  # type: ignore[no-untyped-def]
        nonlocal called
        called = True
        return AgentStepResult(agent_name="x", input="", output="", status="completed")

    monkeypatch.setattr(orchestrator, "_run_agent", fake_run)
    result = await orchestrator.invoke("reviewer-readonly", "跑", tool_deny=["delete_file"])

    assert called is False
    assert result.error_code == "AGENT_TOOL_DENIED"


@pytest.mark.asyncio
async def test_run_ledger_records_status_and_tool_steps(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeSession:
        def __init__(self) -> None:
            self.events: list[tuple[str, dict[str, Any]]] = []

        async def status(self, status: str, **kwargs: Any) -> None:
            self.events.append(("status", {"status": status, **kwargs}))

        async def append(self, event_type: str, payload: dict[str, Any]) -> None:
            self.events.append((event_type, payload))

    class FakeLedger:
        def __init__(self) -> None:
            self.session_obj = FakeSession()

        def session(self, _run_id: str) -> FakeSession:
            return self.session_obj

    ledger = FakeLedger()
    orchestrator = AgentOrchestrator(registry=AgentRegistry(), run_ledger=ledger)  # type: ignore[arg-type]

    async def fake_run(agent, user_input, *args, **kwargs):  # type: ignore[no-untyped-def]
        return AgentStepResult(
            agent_name=agent.name,
            input=user_input,
            output="ok",
            status="completed",
            tool_calls=[{"tool": "read_file", "ok": True}],
        )

    monkeypatch.setattr(orchestrator, "_run_agent", fake_run)
    result = await orchestrator.invoke("researcher", "调研", run_id="run-1")

    assert result.status == "completed"
    assert ledger.session_obj.events == [
        ("status", {"status": "running"}),
        ("status", {"status": "succeeded", "error_code": None, "error_message": None}),
        ("step", {"iteration": 1, "tool": "read_file", "ok": True, "blocked": False}),
    ]

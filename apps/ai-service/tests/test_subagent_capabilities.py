# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""子代理能力边界(工具白名单 + 再派发开关)测试。

覆盖:
  ① 默认最小权限:未声明 → 空白名单 + 不可再派发(不继承父级);
  ② 白名单外工具被拒并留痕;白名单内工具正常可用;
  ③ 不可再派发的子代理尝试派发 → 拒绝并留痕;
  ④ AgentDefinition 自带工具面/元数据作为兜底声明,显式声明优先;
  ⑤ 团队派发面接入:越权任务不派发、其它任务不受影响、失败可归因;
  ⑥ 路由 PUT/GET/authorize 的声明与 403 拒绝。
"""

from types import SimpleNamespace

import pytest

from app.routers import team_orchestration as router_module
from app.services.agent_teams import TeamOrchestrator
from app.services.subagent_capabilities import (
    CapabilityDeclarationError,
    CapabilityDenied,
    SubagentCapability,
    SubagentCapabilityGuard,
    SubagentCapabilityRegistry,
    evaluate_tool,
    evaluate_tool_request,
    resolve_capability,
)


class _Recorder:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def __call__(self, action, actor, target, detail):
        self.calls.append(
            {"action": action, "actor": actor, "target": target, "detail": detail}
        )
        return "audit-cap-1"


class _Sink:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    async def __call__(self, event_type, payload):
        self.calls.append({"event_type": event_type, "payload": payload})
        return "event-cap-1"


class _FakeAgentRegistry:
    def __init__(self, definitions: dict[str, object] | None = None) -> None:
        self._definitions = definitions or {}

    def get(self, name: str):  # noqa: ANN201
        return self._definitions.get(name)


class _FakeAgentOrchestrator:
    """替身:记录派发规格,按 spec 顺序回结果;registry 模拟 AgentRegistry。"""

    def __init__(self, definitions: dict[str, object] | None = None) -> None:
        self.registry = _FakeAgentRegistry(definitions)
        self.calls: list[dict[str, object]] = []

    async def invoke_parallel(self, specs, max_concurrency=5):
        self.calls.append({"specs": specs, "max_concurrency": max_concurrency})
        return {
            "results": [
                {
                    "name": spec["name"],
                    "task": spec["task"],
                    "status": "completed",
                    "output": f"out-{index}",
                    "duration_ms": 1.0,
                }
                for index, spec in enumerate(specs)
            ]
        }


def _guard() -> tuple[SubagentCapabilityRegistry, SubagentCapabilityGuard, _Recorder, _Sink]:
    registry = SubagentCapabilityRegistry()
    recorder = _Recorder()
    sink = _Sink()
    return registry, SubagentCapabilityGuard(registry, sink=sink, recorder=recorder), recorder, sink


# ---------------------------------------------------------------------------
# ① 默认最小权限
# ---------------------------------------------------------------------------


def test_undeclared_agent_gets_default_deny() -> None:
    capability = resolve_capability("ghost", registry=SubagentCapabilityRegistry())
    assert capability.allowed_tools == ()
    assert capability.can_be_sub_agent is False
    assert capability.source == "default_deny"
    assert evaluate_tool(capability, "read_file") == "tool_not_whitelisted"


def test_declaration_defaults_are_minimal() -> None:
    capability = SubagentCapability()
    assert capability.allowed_tools == ()
    assert capability.can_be_sub_agent is False


def test_declaration_from_dict_rejects_bad_shapes() -> None:
    with pytest.raises(CapabilityDeclarationError):
        SubagentCapability.from_dict({"allowed_tools": "read_file"})
    with pytest.raises(CapabilityDeclarationError):
        SubagentCapability.from_dict({"allowed_tools": ["read_file", 1]})
    with pytest.raises(CapabilityDeclarationError):
        SubagentCapability.from_dict({"can_be_sub_agent": "yes"})


# ---------------------------------------------------------------------------
# ② / ③ 白名单与再派发
# ---------------------------------------------------------------------------


def test_whitelisted_tool_is_allowed() -> None:
    registry = SubagentCapabilityRegistry()
    registry.declare("worker", SubagentCapability(("read_file",), False))

    capability = resolve_capability("worker", registry=registry)
    assert evaluate_tool(capability, "read_file") == ""
    assert evaluate_tool(capability, "write_file") == "tool_not_whitelisted"


def test_explicit_declaration_overrides_agent_definition() -> None:
    registry = SubagentCapabilityRegistry()
    registry.declare("worker", SubagentCapability(("only_this",), False))

    capability = resolve_capability(
        "worker",
        registry=registry,
        declared_tools=["read_file"],
        can_be_sub_agent=True,
    )
    assert capability.source == "declared"
    assert capability.allowed_tools == ("only_this",)
    assert capability.can_be_sub_agent is False


def test_agent_definition_used_when_not_declared() -> None:
    capability = resolve_capability(
        "worker",
        registry=SubagentCapabilityRegistry(),
        declared_tools=["read_file"],
        can_be_sub_agent=True,
    )
    assert capability.source == "agent_definition"
    assert capability.allowed_tools == ("read_file",)
    assert capability.can_be_sub_agent is True


def test_tool_request_shape_is_validated() -> None:
    registry = SubagentCapabilityRegistry()
    registry.declare("worker", SubagentCapability(("read_file",), False))
    capability = resolve_capability("worker", registry=registry)
    _, code, offending = evaluate_tool_request(capability, "read_file")
    assert code == "invalid_tool_request"
    assert offending.startswith("<")
    _, code, offending = evaluate_tool_request(capability, ["read_file", ""])
    assert code == "invalid_tool_request"
    assert offending == "<str>"


async def test_guard_denies_tool_outside_whitelist_and_audits() -> None:
    registry, guard, recorder, sink = _guard()
    registry.declare("worker", SubagentCapability(("read_file",), False))

    with pytest.raises(CapabilityDenied) as excinfo:
        await guard.authorize_tool("worker", "write_file")

    denial = excinfo.value
    assert denial.code == "tool_not_whitelisted"
    assert denial.receipt["audit_id"] == "audit-cap-1"
    assert denial.receipt["event_id"] == "event-cap-1"
    assert recorder.calls[0]["action"] == "subagent.capability_denied"
    assert recorder.calls[0]["target"] == "worker"
    assert sink.calls[0]["event_type"] == "subagent.capability_denied"
    assert sink.calls[0]["payload"]["agent"] == "worker"
    assert sink.calls[0]["payload"]["code"] == "tool_not_whitelisted"


async def test_guard_allows_whitelisted_tool_without_audit_noise() -> None:
    registry, guard, recorder, sink = _guard()
    registry.declare("worker", SubagentCapability(("read_file",), False))

    receipt = await guard.authorize_tool("worker", "read_file")

    assert receipt == {
        "allowed": True,
        "agent": "worker",
        "tool": "read_file",
        "source": "declared",
    }
    assert recorder.calls == []
    assert sink.calls == []


async def test_guard_denies_spawn_when_flag_off() -> None:
    registry, guard, recorder, _ = _guard()
    registry.declare("worker", SubagentCapability(("read_file",), False))

    with pytest.raises(CapabilityDenied) as excinfo:
        await guard.authorize_spawn("worker")

    assert excinfo.value.code == "spawn_forbidden"
    assert recorder.calls[0]["detail"]["action"] == "spawn_subagent"


async def test_guard_allows_spawn_when_flag_on() -> None:
    registry, guard, recorder, _ = _guard()
    registry.declare("manager", SubagentCapability((), True))

    receipt = await guard.authorize_spawn("manager")

    assert receipt["allowed"] is True
    assert receipt["action"] == "spawn_subagent"
    assert recorder.calls == []


async def test_guard_default_deny_for_undeclared_agent() -> None:
    _, guard, recorder, _ = _guard()
    with pytest.raises(CapabilityDenied) as excinfo:
        await guard.authorize_tool("ghost", "read_file")
    assert excinfo.value.code == "tool_not_whitelisted"
    assert recorder.calls[0]["detail"]["code"] == "tool_not_whitelisted"


# ---------------------------------------------------------------------------
# ⑤ 团队派发面接入
# ---------------------------------------------------------------------------


def _team(capability_registry: SubagentCapabilityRegistry, orchestrator=None) -> TeamOrchestrator:  # noqa: ANN001
    recorder = _Recorder()
    sink = _Sink()
    guard = SubagentCapabilityGuard(capability_registry, sink=sink, recorder=recorder)
    return TeamOrchestrator(
        orchestrator=orchestrator or _FakeAgentOrchestrator(),
        capability_registry=capability_registry,
        capability_guard=guard,
    )


async def test_dispatch_allows_whitelisted_tool() -> None:
    registry = SubagentCapabilityRegistry()
    registry.declare("worker", SubagentCapability(("read_file",), False))
    orchestrator = _FakeAgentOrchestrator()
    team = _team(registry, orchestrator)

    result = await team.run_round(
        objective="读文件",
        tasks=[{"name": "worker", "task": "读", "tools": ["read_file"]}],
    )

    assert result.contributors[0].status == "completed"
    assert len(orchestrator.calls) == 1
    assert orchestrator.calls[0]["specs"] == [
        {"name": "worker", "task": "读", "context": None}
    ]


async def test_dispatch_denies_tool_outside_whitelist_and_keeps_other_tasks() -> None:
    registry = SubagentCapabilityRegistry()
    registry.declare("worker", SubagentCapability(("read_file",), False))
    registry.declare("other", SubagentCapability(("write_file",), False))
    orchestrator = _FakeAgentOrchestrator()
    team = _team(registry, orchestrator)

    result = await team.run_round(
        objective="混合工具",
        tasks=[
            {"name": "worker", "task": "写", "tools": ["write_file"]},
            {"name": "other", "task": "写", "tools": ["write_file"]},
        ],
    )

    assert [c.status for c in result.contributors] == ["failed", "completed"]
    assert result.contributors[0].error == "capability_denied:tool_not_whitelisted:write_file"
    assert len(orchestrator.calls) == 1
    assert orchestrator.calls[0]["specs"][0]["name"] == "other"


async def test_dispatch_denies_undeclared_agent_tool_request() -> None:
    registry = SubagentCapabilityRegistry()
    orchestrator = _FakeAgentOrchestrator()
    team = _team(registry, orchestrator)

    result = await team.run_round(
        objective="默认拒绝",
        tasks=[{"name": "ghost", "task": "随便", "tools": ["read_file"]}],
    )

    assert result.contributors[0].status == "failed"
    assert result.contributors[0].error == "capability_denied:tool_not_whitelisted:read_file"
    assert orchestrator.calls == []


async def test_dispatch_rejects_invalid_tool_request_shape() -> None:
    registry = SubagentCapabilityRegistry()
    orchestrator = _FakeAgentOrchestrator()
    team = _team(registry, orchestrator)

    result = await team.run_round(
        objective="坏请求",
        tasks=[{"name": "worker", "task": "x", "tools": "read_file"}],
    )

    assert result.contributors[0].status == "failed"
    assert result.contributors[0].error.startswith("capability_denied:invalid_tool_request")


async def test_dispatched_contributors_keep_task_order() -> None:
    registry = SubagentCapabilityRegistry()
    registry.declare("ok", SubagentCapability(("read_file",), False))
    orchestrator = _FakeAgentOrchestrator()
    team = _team(registry, orchestrator)

    result = await team.run_round(
        objective="顺序",
        tasks=[
            {"name": "ghost", "task": "a", "tools": ["read_file"]},
            {"name": "ok", "task": "b", "tools": ["read_file"]},
            {"name": "ghost2", "task": "c", "tools": ["read_file"]},
        ],
    )

    assert [c.name for c in result.contributors] == ["ghost", "ok", "ghost2"]
    assert [c.status for c in result.contributors] == ["failed", "completed", "failed"]


async def test_round_requester_without_spawn_flag_is_rejected() -> None:
    registry = SubagentCapabilityRegistry()
    registry.declare("worker", SubagentCapability(("read_file",), False))
    recorder = _Recorder()
    guard = SubagentCapabilityGuard(registry, sink=_Sink(), recorder=recorder)
    team = TeamOrchestrator(
        orchestrator=_FakeAgentOrchestrator(),
        capability_registry=registry,
        capability_guard=guard,
    )

    with pytest.raises(CapabilityDenied) as excinfo:
        await team.run_round(
            objective="再派发",
            tasks=[],
            requester="worker",
        )

    assert excinfo.value.code == "spawn_forbidden"
    assert excinfo.value.receipt["audit_id"] == "audit-cap-1"
    assert recorder.calls[0]["detail"]["action"] == "spawn_subagent"


async def test_round_requester_with_spawn_flag_is_allowed() -> None:
    registry = SubagentCapabilityRegistry()
    registry.declare("manager", SubagentCapability(("read_file",), True))
    team = _team(registry)

    result = await team.run_round(objective="再派发", tasks=[], requester="manager")

    assert result.succeeded == 0


async def test_top_level_round_has_no_spawn_gate() -> None:
    team = _team(SubagentCapabilityRegistry())
    result = await team.run_round(objective="主循环", tasks=[])
    assert result.succeeded == 0


async def test_requester_capability_can_come_from_agent_definition() -> None:
    definition = SimpleNamespace(tools=["read_file"], metadata={"can_be_sub_agent": True})
    orchestrator = _FakeAgentOrchestrator({"manager": definition})
    team = _team(SubagentCapabilityRegistry(), orchestrator)

    assert team.resolve_agent_capability("manager").source == "agent_definition"
    result = await team.run_round(
        objective="兜底声明",
        tasks=[{"name": "manager", "task": "x", "tools": ["read_file"]}],
        requester="manager",
    )
    assert result.contributors[0].status == "completed"


# ---------------------------------------------------------------------------
# ⑥ 路由:声明 / 读 / 授权
# ---------------------------------------------------------------------------


def _patch_router(
    monkeypatch,
    registry: SubagentCapabilityRegistry | None = None,
    definitions: dict[str, object] | None = None,
):
    registry = registry or SubagentCapabilityRegistry()
    recorder = _Recorder()
    sink = _Sink()
    guard = SubagentCapabilityGuard(registry, sink=sink, recorder=recorder)
    team = TeamOrchestrator(
        orchestrator=_FakeAgentOrchestrator(definitions),
        capability_registry=registry,
        capability_guard=guard,
    )
    monkeypatch.setattr(router_module, "team_orchestrator", team)
    return team, recorder, sink


async def test_route_declare_and_read_capability(client, monkeypatch) -> None:
    _patch_router(monkeypatch)

    put_resp = await client.put(
        "/api/orchestration/subagents/worker/capability",
        json={"allowed_tools": ["read_file"], "can_be_sub_agent": False},
    )
    assert put_resp.json()["code"] == 0
    assert put_resp.json()["data"]["allowed_tools"] == ["read_file"]

    get_resp = await client.get("/api/orchestration/subagents/worker/capability")
    data = get_resp.json()["data"]
    assert data["source"] == "declared"
    assert data["can_be_sub_agent"] is False


async def test_route_undeclared_agent_reads_default_deny(client, monkeypatch) -> None:
    _patch_router(monkeypatch)
    resp = await client.get("/api/orchestration/subagents/ghost/capability")
    data = resp.json()["data"]
    assert data["source"] == "default_deny"
    assert data["allowed_tools"] == []


async def test_route_authorize_tool_denied_returns_403(client, monkeypatch) -> None:
    _, recorder, sink = _patch_router(monkeypatch)
    await client.put(
        "/api/orchestration/subagents/worker/capability",
        json={"allowed_tools": ["read_file"], "can_be_sub_agent": False},
    )

    resp = await client.post(
        "/api/orchestration/subagents/capabilities/authorize",
        json={"action": "tool", "agent": "worker", "tool": "write_file"},
    )
    payload = resp.json()

    assert payload["code"] == 403
    assert payload["message"] == "tool_not_whitelisted"
    assert payload["data"]["code"] == "tool_not_whitelisted"
    assert payload["data"]["receipt"]["audit_id"] == "audit-cap-1"
    assert recorder.calls[0]["action"] == "subagent.capability_denied"
    assert sink.calls[0]["payload"]["code"] == "tool_not_whitelisted"


async def test_route_authorize_tool_allowed(client, monkeypatch) -> None:
    _patch_router(monkeypatch)
    await client.put(
        "/api/orchestration/subagents/worker/capability",
        json={"allowed_tools": ["read_file"], "can_be_sub_agent": False},
    )

    resp = await client.post(
        "/api/orchestration/subagents/capabilities/authorize",
        json={"action": "tool", "agent": "worker", "tool": "read_file"},
    )

    payload = resp.json()
    assert payload["code"] == 0
    assert payload["data"]["allowed"] is True


async def test_route_authorize_spawn_denied_and_allowed(client, monkeypatch) -> None:
    _patch_router(monkeypatch)
    await client.put(
        "/api/orchestration/subagents/worker/capability",
        json={"allowed_tools": [], "can_be_sub_agent": False},
    )

    denied = await client.post(
        "/api/orchestration/subagents/capabilities/authorize",
        json={"action": "spawn", "agent": "worker"},
    )
    assert denied.json()["code"] == 403
    assert denied.json()["message"] == "spawn_forbidden"

    await client.put(
        "/api/orchestration/subagents/manager/capability",
        json={"allowed_tools": [], "can_be_sub_agent": True},
    )
    allowed = await client.post(
        "/api/orchestration/subagents/capabilities/authorize",
        json={"action": "spawn", "agent": "manager"},
    )
    assert allowed.json()["code"] == 0
    assert allowed.json()["data"]["action"] == "spawn_subagent"


async def test_route_authorize_rejects_unknown_action(client, monkeypatch) -> None:
    _patch_router(monkeypatch)
    resp = await client.post(
        "/api/orchestration/subagents/capabilities/authorize",
        json={"action": "read", "agent": "worker"},
    )
    assert resp.status_code == 422


async def test_route_round_requester_spawn_denied_returns_403(client, monkeypatch) -> None:
    _patch_router(monkeypatch)
    await client.put(
        "/api/orchestration/subagents/worker/capability",
        json={"allowed_tools": [], "can_be_sub_agent": False},
    )

    resp = await client.post(
        "/api/orchestration/teams/round",
        json={
            "objective": "再派发",
            "tasks": [],
            "requester": "worker",
        },
    )
    payload = resp.json()

    assert payload["code"] == 403
    assert payload["message"] == "spawn_forbidden"
    assert payload["data"]["code"] == "spawn_forbidden"

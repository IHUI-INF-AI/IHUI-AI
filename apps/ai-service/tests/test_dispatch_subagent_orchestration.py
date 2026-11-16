# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""dispatch_subagent 统一编排模式测试(2026-11-16)。

钉住的性质:
- 唯一入口:六种编排模式都走同一个 dispatch_subagent,不新增平级工具
- mode 封闭枚举 / agents 白名单与数量上限 / pipeline steps 校验 / strategy 校验
- 六种模式分别路由到既有 AgentOrchestrator 方法,参数逐字透传
- 统一回包结构(mode/ok/status/steps/final_output/trace)
- 嵌套深度闸与 stub 语义对编排模式同样生效

通过 monkeypatch `_get_orchestrator` 返回 fake,不依赖真实注册表 / LLM。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services import mcp_server as mcp_mod
from app.services.agent_orchestrator import AgentStepResult, OrchestrationResult
from app.services.mcp_server import _tool_dispatch_subagent

AGENT_NAMES = ["researcher", "coder", "reviewer", "architect", "debugger"]


class _FakeRegistry:
    def __init__(self, names: list[str]) -> None:
        self._names = names

    def names(self) -> list[str]:
        return list(self._names)


class _FakeOrchestrator:
    """记录六种编排方法的调用参数,按统一结构返回结果。"""

    def __init__(
        self,
        *,
        names: list[str] | None = None,
        status: str = "completed",
        step_status: str = "completed",
    ) -> None:
        self.registry = _FakeRegistry(names or AGENT_NAMES)
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self._status = status
        self._step_status = step_status

    def _result(self, label: str, agents: list[str]) -> OrchestrationResult:
        return OrchestrationResult(
            orchestration_id=f"orch-{label}",
            steps=[
                AgentStepResult(
                    agent_name=name,
                    input="",
                    output=f"out-{name}",
                    status=self._step_status,
                    duration_ms=1.5,
                )
                for name in agents
            ],
            final_output=f"final-{label}",
            status=self._status,
            total_duration_ms=3.0,
            trace=[{"phase": label}],
        )

    async def run_pipeline(
        self,
        steps: list[dict[str, Any]],
        initial_input: str,
        session_id: str | None = None,
    ) -> OrchestrationResult:
        self.calls.append((
            "pipeline",
            {"steps": steps, "initial_input": initial_input, "session_id": session_id},
        ))
        return self._result("pipeline", [str(s["agent"]) for s in steps])

    async def run_debate(
        self,
        agents: list[str],
        topic: str,
        max_rounds: int = 3,
        session_id: str | None = None,
    ) -> OrchestrationResult:
        self.calls.append((
            "debate",
            {
                "agents": agents,
                "topic": topic,
                "max_rounds": max_rounds,
                "session_id": session_id,
            },
        ))
        return self._result("debate", agents)

    async def run_vote(
        self,
        agents: list[str],
        topic: str,
        session_id: str | None = None,
    ) -> OrchestrationResult:
        self.calls.append((
            "vote",
            {"agents": agents, "topic": topic, "session_id": session_id},
        ))
        return self._result("vote", agents)

    async def run_critique(
        self,
        agents: list[str],
        topic: str,
        max_rounds: int = 2,
        session_id: str | None = None,
    ) -> OrchestrationResult:
        self.calls.append((
            "critique",
            {
                "agents": agents,
                "topic": topic,
                "max_rounds": max_rounds,
                "session_id": session_id,
            },
        ))
        return self._result("critique", agents)

    async def run_decomposed(
        self,
        task: str,
        strategy: str = "dag",
        session_id: str | None = None,
    ) -> OrchestrationResult:
        self.calls.append((
            "decompose",
            {"task": task, "strategy": strategy, "session_id": session_id},
        ))
        return self._result("decompose", AGENT_NAMES[:2])

    async def run_with_communication(
        self,
        agents: list[str],
        task: str,
        session_id: str | None = None,
    ) -> OrchestrationResult:
        self.calls.append((
            "team",
            {"agents": agents, "task": task, "session_id": session_id},
        ))
        return self._result("team", agents)

    async def invoke_parallel(
        self,
        tasks: list[dict[str, Any]],
        max_concurrency: int = 5,
    ) -> dict[str, Any]:
        """TeamOrchestrator 的默认 runner 依赖此方法(team 模式真实路径)。"""
        self.calls.append((
            "team_parallel",
            {"tasks": tasks, "max_concurrency": max_concurrency},
        ))
        results = [
            {
                "name": task["name"],
                "task": task["task"],
                "status": "completed",
                "output": f"out-{task['name']}",
                "error": None,
                "duration_ms": 1.5,
            }
            for task in tasks
        ]
        return {
            "ok": True,
            "total": len(results),
            "succeeded": len(results),
            "failed": 0,
            "results": results,
            "message": f"并行派发完成:{len(results)}/{len(results)} 成功",
        }


def _use(monkeypatch: pytest.MonkeyPatch, fake: _FakeOrchestrator) -> None:
    monkeypatch.setattr(mcp_mod, "_get_orchestrator", lambda: fake)


# =============================================================================
# 校验面
# =============================================================================


def test_schema_advertises_all_modes() -> None:
    """模型面 schema 必须真的广告全部模式,否则分支存在但模型永远选不到。"""
    tool = next(t for t in mcp_mod._TOOLS if t.name == "orchestrate_agents")
    assert tool.input_schema["properties"]["mode"]["enum"] == list(
        mcp_mod._DISPATCH_MODES
    )
    for key in ("agents", "steps", "strategy", "aggregation", "max_rounds"):
        assert key in tool.input_schema["properties"], key


def test_legacy_alias_resolves_to_same_schema() -> None:
    """旧名只在别名表里存在;新名占据 _TOOLS 唯一广告位。"""
    names = {t.name for t in mcp_mod._TOOLS}
    assert "orchestrate_agents" in names
    assert "dispatch_subagent" not in names
    assert mcp_mod._normalize_tool_name("dispatch_subagent") == "orchestrate_agents"
    new_schema = mcp_mod.get_full_tool_schema("orchestrate_agents")
    old_schema = mcp_mod.get_full_tool_schema("dispatch_subagent")
    assert new_schema is not None and old_schema is not None
    assert old_schema["description"] == new_schema["description"]


async def test_legacy_alias_call_tool_still_works(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """CLI/历史会话按旧名调用,必须仍落到同一 handler。"""
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await mcp_mod.mcp_server.call_tool("dispatch_subagent", {
        "mode": "vote",
        "task": "旧名兼容",
        "agents": ["coder", "reviewer"],
    })
    assert out["tool"] == "orchestrate_agents"
    assert out["mode"] == "vote"
    assert out["ok"] is True
    assert fake.calls[0][0] == "vote"


async def test_non_string_mode_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({"mode": 5, "task": "x"})
    assert out["errorCode"] == "INVALID_PARAMS"
    assert "字符串" in out["error"]
    assert fake.calls == []


async def test_single_mode_rejects_tasks(monkeypatch: pytest.MonkeyPatch) -> None:
    """mode=single 不能被 tasks 静默带到并行分支。"""
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "single",
        "tasks": [{"name": "coder", "task": "x"}],
    })
    assert out["errorCode"] == "INVALID_PARAMS"
    assert "single" in out["error"]
    assert fake.calls == []


async def test_single_mode_rejects_orchestration_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """single/parallel 不能静默忽略 agents/steps/strategy 等编排专属字段。"""
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    for args in (
        {"mode": "single", "task": "x", "steps": [{"agent": "researcher"}]},
        {"mode": "single", "task": "x", "agents": ["coder", "reviewer"]},
        {
            "mode": "parallel",
            "tasks": [{"name": "coder", "task": "x"}],
            "max_rounds": 2,
        },
        {
            "mode": "parallel",
            "tasks": [{"name": "coder", "task": "x"}],
            "background": True,
        },
    ):
        out = await _tool_dispatch_subagent(args)
        assert out["errorCode"] == "INVALID_PARAMS", args
    assert fake.calls == []


async def test_steps_without_mode_infers_pipeline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "task": "初稿",
        "steps": [{"agent": "researcher"}],
    })
    assert out["ok"] is True
    assert out["mode"] == "pipeline"
    assert fake.calls[0][0] == "pipeline"


async def test_max_rounds_bool_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "debate",
        "task": "x",
        "agents": ["coder", "reviewer"],
        "max_rounds": True,
    })
    assert out["errorCode"] == "INVALID_PARAMS"
    assert fake.calls == []


async def test_pipeline_rejects_non_string_template(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "pipeline",
        "task": "x",
        "steps": [{"agent": "researcher", "input_template": {"bad": 1}}],
    })
    assert out["errorCode"] == "INVALID_PARAMS"
    assert fake.calls == []


async def test_mode_specific_fields_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    pipeline_agents = await _tool_dispatch_subagent({
        "mode": "pipeline",
        "task": "x",
        "agents": ["coder", "reviewer"],
        "steps": [{"agent": "researcher"}],
    })
    assert pipeline_agents["errorCode"] == "INVALID_PARAMS"
    decompose_steps = await _tool_dispatch_subagent({
        "mode": "decompose",
        "task": "x",
        "steps": [{"agent": "researcher"}],
    })
    assert decompose_steps["errorCode"] == "INVALID_PARAMS"
    assert fake.calls == []


async def test_orchestration_fields_without_mode_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """传了 agents/strategy 却不给 mode,不能静默落进 single。"""
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "task": "x",
        "agents": ["coder", "reviewer"],
    })
    assert out["errorCode"] == "INVALID_PARAMS"
    assert "mode" in out["error"]
    assert fake.calls == []


async def test_unknown_mode_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({"mode": "swarm", "task": "x"})
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PARAMS"
    assert "mode" in out["error"]
    assert fake.calls == []


async def test_orchestration_requires_task(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "vote",
        "agents": ["coder", "reviewer"],
    })
    assert out["errorCode"] == "MISSING_PARAMS"
    assert fake.calls == []


async def test_debate_requires_two_agents(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "debate",
        "task": "要不要引入向量库",
        "agents": ["coder"],
    })
    assert out["errorCode"] == "INVALID_PARAMS"
    assert "至少" in out["error"]


async def test_agents_unknown_name_lists_available(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "vote",
        "task": "方案选择",
        "agents": ["coder", "ghost"],
    })
    assert out["errorCode"] == "UNKNOWN_AGENT"
    assert "ghost" in out["error"]
    assert "coder" in out["availableAgents"]


async def test_agents_limit_and_duplicates(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeOrchestrator(names=AGENT_NAMES + ["frontend-dev"])
    _use(monkeypatch, fake)
    too_many = await _tool_dispatch_subagent({
        "mode": "vote",
        "task": "x",
        "agents": AGENT_NAMES + ["frontend-dev"],
    })
    assert too_many["errorCode"] == "INVALID_PARAMS"
    duplicated = await _tool_dispatch_subagent({
        "mode": "vote",
        "task": "x",
        "agents": ["coder", "coder"],
    })
    assert duplicated["errorCode"] == "INVALID_PARAMS"


async def test_tasks_rejected_in_orchestration_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "team",
        "task": "x",
        "agents": ["coder"],
        "tasks": [{"name": "coder", "task": "y"}],
    })
    # tasks 与 task/name 同时出现时先命中既有 DUAL_MODE 互斥,同样不执行
    assert out["ok"] is False
    assert out["errorCode"] in ("DUAL_MODE", "INVALID_PARAMS")
    assert fake.calls == []


async def test_pipeline_rejects_unknown_step_agent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "pipeline",
        "task": "初稿",
        "steps": [{"agent": "ghost"}],
    })
    assert out["errorCode"] == "UNKNOWN_AGENT"
    assert fake.calls == []


async def test_decompose_rejects_unknown_strategy(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "decompose",
        "task": "x",
        "strategy": "magic",
    })
    assert out["errorCode"] == "INVALID_PARAMS"
    assert fake.calls == []


# =============================================================================
# 路由面
# =============================================================================


async def test_pipeline_routes_and_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    events: list[dict[str, Any]] = []
    out = await _tool_dispatch_subagent(
        {
            "mode": "pipeline",
            "task": "写一份评审报告",
            "steps": [
                {"agent": "researcher", "input_template": "调研:{input}"},
                {"agent": "reviewer"},
            ],
        },
        progress_callback=events.append,
    )
    assert fake.calls[0][0] == "pipeline"
    call = fake.calls[0][1]
    assert call["initial_input"] == "写一份评审报告"
    assert call["steps"][0]["input_template"] == "调研:{input}"
    assert call["steps"][1]["input_template"] == "{input}"
    assert out["tool"] == "orchestrate_agents"
    assert out["mode"] == "pipeline"
    assert out["ok"] is True
    assert out["status"] == "completed"
    assert out["steps"][0]["agent"] == "researcher"
    assert out["final_output"] == "final-pipeline"
    assert [event["phase"] for event in events] == [
        "orchestration_started",
        "orchestration_done",
    ]


@pytest.mark.parametrize("mode", ["debate", "vote", "critique"])
async def test_agent_list_modes_route(
    monkeypatch: pytest.MonkeyPatch, mode: str
) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    args = {
        "mode": mode,
        "task": "统一编排主题",
        "agents": ["coder", "reviewer"],
    }
    if mode in ("debate", "critique"):
        args["max_rounds"] = 9
    out = await _tool_dispatch_subagent(args)
    assert out["mode"] == mode
    assert out["ok"] is True
    assert [step["agent"] for step in out["steps"]] == ["coder", "reviewer"]
    call_mode, call = fake.calls[0]
    assert call_mode == mode
    assert call["agents"] == ["coder", "reviewer"]
    if mode in ("debate", "critique"):
        # 轮次上限统一夹到 3,不允许一次调用烧穿预算
        assert call["max_rounds"] == 3


async def test_decompose_routes(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "decompose",
        "task": "重构登录链路",
        "strategy": "sequential",
        "session_id": "s-1",
    })
    assert out["mode"] == "decompose"
    call_mode, call = fake.calls[0]
    assert call_mode == "decompose"
    assert call["task"] == "重构登录链路"
    assert call["strategy"] == "sequential"
    assert call["session_id"] == "s-1"


async def test_team_uses_fanout_and_aggregation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """team 走 TeamOrchestrator:fan-out + 结构化聚合,而不是顺序黑板。"""
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "team",
        "task": "评估统一编排方案",
        "agents": ["researcher", "coder"],
        "aggregation": "consensus",
    })
    assert out["mode"] == "team"
    assert out["ok"] is True
    assert out["aggregate"]["strategy"] == "consensus"
    assert [step["agent"] for step in out["steps"]] == ["researcher", "coder"]
    assert fake.calls[0][0] == "team_parallel"
    assert fake.calls[0][1]["max_concurrency"] == 2
    # team 任务必须携带结构化尾巴契约,否则 best_of/consensus 拿不到 score/conclusion
    for task in fake.calls[0][1]["tasks"]:
        assert "结论：" in task["task"]
        assert "评分：" in task["task"]


async def test_team_rejects_unknown_aggregation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "team",
        "task": "x",
        "agents": ["coder"],
        "aggregation": "majority",
    })
    assert out["errorCode"] == "INVALID_PARAMS"
    assert fake.calls == []


# =============================================================================
# 治理面
# =============================================================================


async def test_depth_guard_blocks_orchestration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeOrchestrator()
    _use(monkeypatch, fake)
    token = mcp_mod._subagent_depth.set(mcp_mod._SUBAGENT_MAX_DEPTH)
    try:
        out = await _tool_dispatch_subagent({
            "mode": "vote",
            "task": "x",
            "agents": ["coder", "reviewer"],
        })
    finally:
        mcp_mod._subagent_depth.reset(token)
    assert out["errorCode"] == "NESTING_DEPTH_EXCEEDED"
    assert fake.calls == []


async def test_stub_steps_not_reported_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeOrchestrator(status="completed", step_status="stub")
    _use(monkeypatch, fake)
    out = await _tool_dispatch_subagent({
        "mode": "debate",
        "task": "x",
        "agents": ["coder", "reviewer"],
    })
    assert out["ok"] is False
    assert out["stub"] is True
    assert out["status"] == "stub"
    assert out["errorCode"] == "STUB_RESPONSE"

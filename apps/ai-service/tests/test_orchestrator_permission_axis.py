# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""G2(D6 收敛审计 2026-09-27):旧编排循环的权限判定并轨到唯一谓词。

钉的是两件事,方向相反,缺一即只是把功能改坏了:

1. **负向**:三轴里 permission_mode=plan(严禁副作用)经 `agent_orchestrator`
   这条循环跑写类工具时必须被拒,且**副作用没发生** —— 不是只断言"回了个错误"。
   审计原文的验收口径就是这条:`_run_agent` 此前不 import `permission_mode`,
   plan 对它结构上无效(见 docs/d6-convergence-audit-2026-09-27.md §2.1)。
   断言取"未发出那条调用":`mcp_server.call_tool` 对写类工具零调用、
   exec_policy 的一次性放行表逐元素不变、`approve_exec_command` 未被调用。
   (本循环没有审批腿,所以"不发审批请求"的可证形态就是这三条都没动过。)
2. **正向对照**:同档内只读工具照旧执行;不给轴时(现网所有调用方的现状)行为与
   并轨前**逐字节同**(写类工具照旧执行、schema 照旧全给) —— 否则本门只是在削功能。

另有两条"判据有牙 / 无第二份真相"的锁:
- 把唯一谓词换成恒真 ⇒ 拦截必须消失(证明拦下来的是那个出口,不是别的巧合);
- 编排侧源码不得出现第二份只读白名单成员判定,且四个出口必须真被调用。

测试隔离:全部 LLM 与工具执行都是替身;memory_store 强制内存模式(§5 测试隔离铁律,
不得对生产 PostgreSQL 8810 / Redis 8811 产生任何写入)。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

import app.services.agent_orchestrator as orch_mod
from app.services.agent_orchestrator import (
    AgentDefinition,
    agent_orchestrator,
)
from app.services.memory import memory_store

# =============================================================================
# 替身与夹具
# =============================================================================


@pytest.fixture(autouse=True)
def force_memory_mode():
    """强制 memory_store 内存模式(与 tests/test_agent_orchestrator.py 同一条隔离)。"""
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    yield
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()


class _FakeToolDef:
    """mcp_server.list_tools() 返回项的最小形状(name/description/input_schema)。"""

    def __init__(self, name: str) -> None:
        self.name = name
        self.description = f"fake tool {name}"
        self.input_schema: dict[str, Any] = {"type": "object", "properties": {}}


class _FakeMcp:
    """替身注册表:记录 call_tool 实参,永不真执行任何工具。"""

    def __init__(self, tool_names: list[str]) -> None:
        self._names = list(tool_names)
        self.executed: list[tuple[str, dict[str, Any]]] = []

    def list_tools(self) -> list[_FakeToolDef]:
        return [_FakeToolDef(n) for n in self._names]

    async def call_tool(
        self, name: str, arguments: dict[str, Any] | None = None, **_: Any
    ) -> dict[str, Any]:
        self.executed.append((name, dict(arguments or {})))
        return {"ok": True, "tool": name, "result": f"executed-{name}"}

    @property
    def executed_names(self) -> list[str]:
        return [n for n, _ in self.executed]


class _FakeGateway:
    """替身 LLM:按脚本回答,并记下每轮收到的 messages / kwargs(用于看 schema 收窄)。"""

    def __init__(self, scripted: list[dict[str, Any]]) -> None:
        self._scripted = list(scripted)
        self.calls: list[dict[str, Any]] = []

    async def complete(
        self, messages: list[dict[str, Any]], model: str | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        self.calls.append({"messages": [dict(m) for m in messages], "kwargs": kwargs})
        if not self._scripted:
            return {"content": "fallback-summary"}
        return self._scripted.pop(0)


def _tool_call(name: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "id": f"call-{name}",
        "type": "function",
        "function": {"name": name, "arguments": json.dumps(args or {})},
    }


def _agent(suffix: str, tools: list[str]) -> AgentDefinition:
    return AgentDefinition(
        name=f"g2-probe-{suffix}",
        description="G2 并轨探针 agent",
        system_prompt="你是测试用的 agent。",
        tools=list(tools),
        max_iterations=3,
    )


@pytest.fixture
def probe_agent():
    """注册一个临时 agent(只读 + 写类各一),用完立即摘掉,不污染共享注册表。"""
    agent = _agent("main", ["read_file", "write_file"])
    agent_orchestrator.registry.register(agent)
    try:
        yield agent
    finally:
        agent_orchestrator.registry.remove(agent.name)


@pytest.fixture
def stubs(monkeypatch: pytest.MonkeyPatch):
    """把编排模块里的 llm_gateway / mcp_server 换成替身(不触真工具、不触生产依赖)。"""

    class _Holder:
        def __init__(self) -> None:
            self.mcp = _FakeMcp(
                ["read_file", "write_file", "run_command", "search_codebase", "generate_test"]
            )
            self.gateway = _FakeGateway(
                [
                    {"content": "", "tool_calls": [_tool_call("write_file", {"path": "a.py"})]},
                    {"content": "最终答复:写操作已被拒绝"},
                ]
            )
            monkeypatch.setattr(orch_mod, "mcp_server", self.mcp)
            monkeypatch.setattr(orch_mod, "llm_gateway", self.gateway)

    return _Holder()


async def _run(
    monkeypatch: pytest.MonkeyPatch,
    stubs: Any,
    agent_name: str = "g2-probe-main",
    **axis: str | None,
):
    """跑一次 invoke(经真 `_run_agent`,LLM/工具全为替身),返回 (结果, 进度事件)。"""
    events: list[dict[str, Any]] = []
    result = await agent_orchestrator.invoke(
        agent_name=agent_name,
        user_input="把这段逻辑落到 a.py",
        session_id="g2-session",
        progress_callback=lambda e: events.append(dict(e)),
        **axis,
    )
    return result, events


# =============================================================================
# 负向:plan 档下写类工具被拒,且没有任何副作用
# =============================================================================


class TestPlanBlocksWriteTool:
    async def test_write_tool_not_executed(self, monkeypatch, stubs, probe_agent):
        result, _ = await _run(monkeypatch, stubs, permission_mode="plan")

        # 副作用没发生:真派发点是 mcp_server.call_tool,它对写类工具必须一次都没被调。
        assert stubs.mcp.executed == [], f"plan 档下竟执行了工具: {stubs.mcp.executed}"
        assert "write_file" not in stubs.mcp.executed_names
        # 被拦的一刻要在结果里留痕(不是静默丢掉那一轮)
        blocked = [t for t in result.tool_calls if t.get("blocked")]
        assert [t["tool"] for t in blocked] == ["write_file"]
        assert blocked[0]["ok"] is False

    async def test_no_approval_is_requested(self, monkeypatch, stubs, probe_agent):
        from app.services import mcp_server as mcp_mod

        approved_before = set(mcp_mod._exec_approved_commands)
        grant_spy: list[str] = []
        consume_spy: list[str] = []
        monkeypatch.setattr(
            mcp_mod,
            "approve_exec_command",
            lambda command: grant_spy.append(command),
        )
        monkeypatch.setattr(
            mcp_mod,
            "_consume_exec_approval",
            lambda command: consume_spy.append(command) or False,
        )

        await _run(monkeypatch, stubs, permission_mode="plan")

        # 审批的两条腿都没被碰:既没请求放行,也没消费放行,放行表逐元素不变。
        assert grant_spy == []
        assert consume_spy == []
        assert set(mcp_mod._exec_approved_commands) == approved_before

    async def test_model_gets_the_exit_canonical_message(self, monkeypatch, stubs, probe_agent):
        """回填给模型的拒绝文案必须来自唯一出口(措辞不在编排里另写一份)。"""
        from app.core.permission_mode import blocked_tool_message, resolve_mode_policy

        await _run(monkeypatch, stubs, permission_mode="plan")
        want = blocked_tool_message(resolve_mode_policy(None, "plan"), "write_file")

        tool_msgs = [m for m in stubs.gateway.calls[1]["messages"] if m.get("role") == "tool"]
        assert len(tool_msgs) == 1
        assert tool_msgs[0]["content"] == want
        assert "本次未执行" in tool_msgs[0]["content"]
        assert tool_msgs[0]["name"] == "write_file"

    async def test_progress_events_keep_blocked_flag(self, monkeypatch, stubs, probe_agent):
        _, events = await _run(monkeypatch, stubs, permission_mode="plan")
        results = [e for e in events if e.get("phase") == "tool_result"]
        assert [(e["tool"], e["ok"], e.get("blocked", False)) for e in results] == [
            ("write_file", False, True)
        ]


# =============================================================================
# 正向对照:同档内该放的照旧放;不给轴时行为不变
# =============================================================================


class TestPositiveControls:
    async def test_readonly_tool_still_runs_under_plan(self, monkeypatch, stubs):
        agent = _agent("ro", ["read_file", "search_codebase"])
        agent_orchestrator.registry.register(agent)
        stubs.gateway._scripted = [
            {"content": "", "tool_calls": [_tool_call("read_file", {"path": "a.py"})]},
            {"content": "已读取"},
        ]
        try:
            result, _ = await _run(
                monkeypatch, stubs, agent_name=agent.name, permission_mode="plan"
            )
        finally:
            agent_orchestrator.registry.remove(agent.name)

        assert stubs.mcp.executed_names == ["read_file"]
        assert result.status == "completed"
        assert not [t for t in result.tool_calls if t.get("blocked")]

    async def test_no_axis_keeps_legacy_behavior(self, monkeypatch, stubs, probe_agent):
        """现网调用方一律不传轴 ⇒ 出口保守兜底(工具档 'all'),与并轨前逐字节同。"""
        result, _ = await _run(monkeypatch, stubs)

        assert stubs.mcp.executed_names == ["write_file"], "并轨把无轴路径改坏了"
        assert not [t for t in result.tool_calls if t.get("blocked")]
        assert result.status == "completed"

    async def test_bypass_permissions_axis_does_not_run(
        self, monkeypatch, stubs, probe_agent
    ):
        """plan 会话里的 permission=bypassPermissions 不得放宽模式轴(矩阵'取更严')。"""
        await _run(monkeypatch, stubs, chat_mode="plan", permission_mode="bypassPermissions")
        assert stubs.mcp.executed == []


# =============================================================================
# schema 收窄:发给 LLM 的工具清单由出口推导
# =============================================================================


class TestToolSchemaNarrowing:
    def _names(self, gateway: _FakeGateway) -> list[str]:
        kw = gateway.calls[0]["kwargs"]
        return [t["function"]["name"] for t in kw.get("tools", [])]

    async def test_default_axis_exposes_both(self, monkeypatch, stubs, probe_agent):
        await _run(monkeypatch, stubs)
        assert sorted(self._names(stubs.gateway)) == ["read_file", "write_file"]

    async def test_plan_axis_exposes_only_readonly(self, monkeypatch, stubs, probe_agent):
        await _run(monkeypatch, stubs, permission_mode="plan")
        assert self._names(stubs.gateway) == ["read_file"]

    async def test_ask_axis_exposes_nothing(self, monkeypatch, stubs, probe_agent):
        await _run(monkeypatch, stubs, chat_mode="ask")
        assert "tools" not in stubs.gateway.calls[0]["kwargs"]

    async def test_ask_axis_message_says_all_tools_disabled(
        self, monkeypatch, stubs, probe_agent
    ):
        """'none' 档的文案与 'readonly' 档必须可分辨(出口内两条分支,不能只有一条有牙)。"""
        await _run(monkeypatch, stubs, chat_mode="ask")
        tool_msgs = [m for m in stubs.gateway.calls[1]["messages"] if m.get("role") == "tool"]
        assert "禁用全部工具" in tool_msgs[0]["content"]


# =============================================================================
# 归一化住在出口,不在编排里再猜
# =============================================================================


class TestNormalizationLivesInTheExit:
    async def test_history_alias_still_narrows(self, monkeypatch, stubs, probe_agent):
        """'read-only' 是 plan 的历史别名 —— 编排侧不做任何字符串猜测,交给出口归一。"""
        await _run(monkeypatch, stubs, permission_mode="read-only")
        assert stubs.mcp.executed == []

    async def test_unparsable_axis_falls_back_conservatively(
        self, monkeypatch, stubs, probe_agent
    ):
        """认不出的档 ⇒ 出口兜底 'default'(工具档 all、审批最严),编排不得自己造默认。"""
        await _run(monkeypatch, stubs, permission_mode="totally-unknown-value")
        assert stubs.mcp.executed_names == ["write_file"]


# =============================================================================
# 两条"有牙"锁:拦截真的来自那个出口;源码里没有第二份真相
# =============================================================================


class TestGateIsTheThingThatBlocks:
    async def test_mutating_the_predicate_removes_the_block(self, monkeypatch, stubs, probe_agent):
        """把唯一谓词换成恒真 ⇒ 拦截必须消失。

        反向证明:红不是由"替身 LLM 恰好没请求工具"之类的巧合造出来的。
        """
        monkeypatch.setattr(orch_mod, "_tool_allowed_by_policy", lambda policy, name: True)
        await _run(monkeypatch, stubs, permission_mode="plan")
        assert stubs.mcp.executed_names == ["write_file"]

    async def test_mutating_the_intersection_removes_the_narrowing(
        self, monkeypatch, stubs, probe_agent
    ):
        """把交集出口换成恒等 ⇒ schema 收窄也必须消失(同上,针对第二条判据)。"""
        monkeypatch.setattr(orch_mod, "_allowed_tool_names", lambda policy, names: frozenset(names))
        await _run(monkeypatch, stubs, permission_mode="plan")
        names = [t["function"]["name"] for t in stubs.gateway.calls[0]["kwargs"]["tools"]]
        assert sorted(names) == ["read_file", "write_file"]


class TestNoSecondSourceOfTruth:
    """源码级反向锁(§22c:判据必须覆盖门自己产出的形态,也要看不见"换个写法"的绕过)。"""

    SRC = Path(orch_mod.__file__).read_text(encoding="utf-8")

    def test_orchestrator_does_not_read_the_readonly_whitelist(self):
        # 交集只有一处实现:编排里连白名单的名字都不该出现(注释面也不算豁免)。
        assert "READONLY_TOOLS" not in self.SRC

    def test_orchestrator_calls_each_shared_exit(self):
        for exit_name in (
            "_resolve_mode_policy(",
            "_allowed_tool_names(",
            "_tool_allowed_by_policy(",
            "_blocked_tool_message(",
        ):
            assert self.SRC.count(exit_name) >= 1, f"出口未被调用: {exit_name}"

    def test_exits_are_imported_from_permission_mode_only(self):
        # "import 了却没用它读判定"这一型(守门 118 的 half-wired)在权限并轨上同样不许:
        # 出口必须从 core/permission_mode 导入,不得端内自造同名函数顶替。
        assert "from ..core.permission_mode import" in self.SRC
        for local_def in ("def _tool_allowed_by_policy", "def _allowed_tool_names"):
            assert local_def not in self.SRC


class TestDefaultRegistryDeltaIsHonest:
    """把审计里那份"差集"钉成现读事实:默认 agent 在 plan 档各掉哪些工具。

    判据方向唯一:plan 档的工具集合必须是 default 档的**子集**(只收不严),
    且至少有一个默认 agent 真的被收窄 —— 否则本票并轨的是一条空集,判据失明。
    """

    def test_write_capable_defaults_are_narrowed(self, monkeypatch, stubs):
        from app.core.permission_mode import resolve_mode_policy

        monkeypatch.setattr(orch_mod, "mcp_server", stubs.mcp)
        plan = resolve_mode_policy(None, "plan")
        default = resolve_mode_policy(None, "default")

        narrowed_agents: list[str] = []
        for agent in agent_orchestrator.registry.list_agents():
            if not agent.tools:
                continue
            got_plan = {
                t["function"]["name"] for t in agent_orchestrator._filter_tools(agent.tools, plan)
            }
            got_default = {
                t["function"]["name"]
                for t in agent_orchestrator._filter_tools(agent.tools, default)
            }
            assert got_plan <= got_default, f"{agent.name}: plan 档反而放宽了工具"
            assert got_plan <= set(agent.tools), f"{agent.name}: 塞进了未声明的能力"
            if got_default != got_plan:
                narrowed_agents.append(agent.name)

        assert narrowed_agents, "没有任何默认 agent 被收窄 ⇒ 并轨判据对真注册表失明"
        assert "coder" in narrowed_agents, "coder(带 write_file/run_command)必须被收窄"


def test_import_smoke_json_roundtrip():
    """结果序列化仍可用(tool_calls 新增了 blocked 键,不得破坏 json.dumps)。"""
    from app.services.agent_orchestrator import AgentStepResult

    r = AgentStepResult(
        agent_name="a",
        input="i",
        output="",
        status="completed",
        tool_calls=[{"tool": "write_file", "arguments": {}, "ok": False, "blocked": True}],
    )
    d = agent_orchestrator.step_result_to_dict(r)
    assert json.loads(json.dumps(d))["tool_calls"][0]["blocked"] is True

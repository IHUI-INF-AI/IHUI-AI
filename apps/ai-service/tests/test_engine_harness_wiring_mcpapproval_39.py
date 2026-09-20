# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# MCP 工具注解审批接线测试 — 第三十九批
# (对标 Codex requires_mcp_tool_approval 在 AgentLoopV2 审批门的强制点)
from __future__ import annotations

from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolDefinition
from app.services.mcp_tool_aggregator import MCPSuperToolAggregator, ToolSource


def _ann_tool(name: str, annotations: dict | None, calls: list[dict]) -> ToolDefinition:
    async def executor(args: dict) -> dict:
        calls.append(dict(args))
        return {"ok": True, "tool": name}

    return ToolDefinition(
        name=name,
        description="external mcp tool",
        parameters={"type": "object"},
        executor=executor,
        mcp_annotations=annotations,
    )


def _make_loop(tools: list[ToolDefinition], *, mode: str = "auto") -> AgentLoopV2:
    async def mock_llm(messages, tools):  # noqa: ANN001, ANN202
        return {"content": "done", "tool_calls": None}

    return AgentLoopV2(
        mock_llm,
        tools,
        max_iterations=3,
        approval_enabled=True,
        permission_mode=mode,
    )


# =============================================================================
# 审批门注解判定(auto 模式)
# =============================================================================


async def test_read_only_hint_true_skips_approval() -> None:
    """read_onlyHint=True 的外部工具:auto 模式免审批直接执行。"""
    calls: list[dict] = []
    loop = _make_loop([_ann_tool("ext_search", {"read_only_hint": True}, calls)])
    tr = await loop._execute_single(ToolCall(id="c1", name="ext_search", args={}))
    assert tr.error is None
    assert tr.result == {"ok": True, "tool": "ext_search"}
    assert len(calls) == 1
    # 无 mcp_annotations_require_approval 决策提示(未弹审批)
    assert "mcp_annotations_require_approval" not in loop._decision_hints


async def test_destructive_hint_true_requires_approval(monkeypatch) -> None:
    """destructiveHint=True:免审通道被覆盖,转真实审批;批准后执行。"""
    calls: list[dict] = []

    async def fake_approve(tc: ToolCall) -> str | None:
        return None  # 用户批准

    tool = _ann_tool("ext_deploy", {"destructive_hint": True}, calls)
    loop = _make_loop([tool])
    monkeypatch.setattr(loop, "_request_approval", fake_approve)
    tr = await loop._execute_single(ToolCall(id="c2", name="ext_deploy", args={}))
    assert tr.error is None
    assert tr.result == {"ok": True, "tool": "ext_deploy"}
    assert loop._decision_hints.get("c2", ("",))[0] == "mcp_annotations_require_approval"


async def test_unknown_annotations_require_approval_by_default(monkeypatch) -> None:
    """注解未知(destructive/open_world 缺失):保守语义按最坏情况需批。"""
    calls: list[dict] = []
    decisions: list[str | None] = []

    async def fake_reject(tc: ToolCall) -> str | None:
        decisions.append("user_rejected")
        return "user_rejected"

    # 空 dict 注解 = 全未知 → 需批(绝不因元数据缺失放行)
    tool = _ann_tool("ext_unknown", {}, calls)
    loop = _make_loop([tool])
    monkeypatch.setattr(loop, "_request_approval", fake_reject)
    tr = await loop._execute_single(ToolCall(id="c3", name="ext_unknown", args={}))
    assert tr.error == "User rejected tool call"
    assert tr.error_type == "user_rejected"
    assert calls == []  # 未执行


async def test_open_world_unknown_requires_approval(monkeypatch) -> None:
    """read_only 未声明但 open_world 缺失 → 需批(逐行对应 Codex 语义)。"""
    calls: list[dict] = []

    async def fake_reject(tc: ToolCall) -> str | None:
        return "user_rejected"

    tool = _ann_tool("ext_ow", {"read_only_hint": False}, calls)
    loop = _make_loop([tool])
    monkeypatch.setattr(loop, "_request_approval", fake_reject)
    tr = await loop._execute_single(ToolCall(id="c4", name="ext_ow", args={}))
    assert tr.error == "User rejected tool call"
    assert calls == []


async def test_internal_tools_unaffected_in_default_mode() -> None:
    """default 模式:注解判定不介入(内部工具零行为变化,回归红线)。"""
    calls: list[dict] = []
    tool = _ann_tool("ext_ro", {"read_only_hint": True}, calls)
    loop = _make_loop([tool], mode="default")
    tr = await loop._execute_single(ToolCall(id="c5", name="ext_ro", args={}))
    assert tr.error is None
    assert len(calls) == 1
    assert "mcp_annotations_require_approval" not in loop._decision_hints


# =============================================================================
# 聚合器注解透传
# =============================================================================


def test_aggregator_passes_annotations_through() -> None:
    """MCPClientTool 的 annotations 经聚合归一化后原样下发到 PoolTool。"""
    from types import SimpleNamespace

    agg = MCPSuperToolAggregator()
    tool = SimpleNamespace(
        name="search",
        description="web search",
        input_schema={"type": "object"},
        annotations={"read_only_hint": True},
    )
    pool = agg.build(
        [ToolSource(server_name="srv-a", tools=[tool], priority=0)],
        collision_policy="first",
    )
    entry = pool.lookup("search")
    assert entry is not None
    assert entry.annotations == {"read_only_hint": True}


def test_aggregator_missing_annotations_stays_none() -> None:
    """server 未提供 annotations → PoolTool.annotations 保持 None(下游零变化)。"""
    agg = MCPSuperToolAggregator()
    pool = agg.build(
        [
            ToolSource(
                server_name="srv-b",
                tools=[{"name": "plain", "description": "d", "inputSchema": {}}],
                priority=0,
            )
        ],
        collision_policy="first",
    )
    entry = pool.lookup("plain")
    assert entry is not None
    assert entry.annotations is None


# =============================================================================
# hook_runtime PRE_TOOL_USE 接线(批 30 模块 × 审批门)
# =============================================================================


def _hook_runtime_with(func):  # noqa: ANN001, ANN202
    from app.core.hook_runtime import HookKind, HookRuntime

    rt = HookRuntime()
    rt.register(HookKind.PRE_TOOL_USE, func)
    return rt


async def test_hook_deny_blocks_tool_execution() -> None:
    """pre_tool_use 钩子 deny → 工具不执行,error_type=hook_denied。"""
    calls: list[dict] = []

    async def deny_hook(payload: dict) -> dict:
        assert payload["tool_name"] == "ext_search"
        return {"decision": "deny", "reason": "合规策略禁止"}

    tool = _ann_tool("ext_search", {"read_only_hint": True}, calls)
    loop = _make_loop([tool])
    loop._hook_runtime = _hook_runtime_with(deny_hook)
    tr = await loop._execute_single(ToolCall(id="h1", name="ext_search", args={}))
    assert tr.error_type == "hook_denied"
    assert tr.result == {"blocked": True, "reason": "合规策略禁止"}
    assert calls == []  # 工具未执行


async def test_hook_passthrough_allows_execution() -> None:
    """钩子返回 None(passthrough)→ 正常执行,零行为变化。"""
    calls: list[dict] = []
    tool = _ann_tool("ext_search", {"read_only_hint": True}, calls)
    loop = _make_loop([tool])
    loop._hook_runtime = _hook_runtime_with(lambda payload: None)
    tr = await loop._execute_single(ToolCall(id="h2", name="ext_search", args={}))
    assert tr.error is None
    assert tr.result == {"ok": True, "tool": "ext_search"}
    assert len(calls) == 1


async def test_no_hook_runtime_zero_behavior_change() -> None:
    """未注入 hook_runtime(默认 None)→ 行为与接线前完全一致(回归红线)。"""
    calls: list[dict] = []
    tool = _ann_tool("ext_search", {"read_only_hint": True}, calls)
    loop = _make_loop([tool])
    assert loop._hook_runtime is None
    tr = await loop._execute_single(ToolCall(id="h3", name="ext_search", args={}))
    assert tr.error is None
    assert len(calls) == 1


async def test_hook_runtime_crash_fails_open() -> None:
    """钩子运行时自身崩溃 → 降级放行(异常隔离,不阻塞工具执行)。"""
    calls: list[dict] = []

    class _BrokenRT:
        async def run(self, *_a, **_kw):  # noqa: ANN002, ANN003, ANN202
            raise RuntimeError("hook runtime exploded")

    tool = _ann_tool("ext_search", {"read_only_hint": True}, calls)
    loop = _make_loop([tool])
    loop._hook_runtime = _BrokenRT()
    tr = await loop._execute_single(ToolCall(id="h4", name="ext_search", args={}))
    assert tr.error is None
    assert len(calls) == 1

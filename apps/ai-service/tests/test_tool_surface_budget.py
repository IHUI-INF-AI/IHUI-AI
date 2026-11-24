# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具面惰性装载(缺口表 ⑤,2026-11-05)—— 判据锁 + 接线锁。

钉住的性质(①–④ 对应派单书,⑤–⑦ 是本仓必有的反向牙):
  ① 被 `deferred` 的工具**仍可直接调用**:列表面收口不等于执行面收口,
     `_TOOLS`/`_TOOL_HANDLERS` 一条不动(既有 `len(_TOOLS)==len(_TOOL_HANDLERS)` 判据不破);
  ② `unjudged` ⇒ 可见集与全量**逐字同序同对象**(反向牙:防"判不了就藏工具",§0.3/§0.10);
  ③ 预算表改值 ⇒ 可见集变化可断言(具名表是真输入,不是烘死在宿主里);且反查面
     `get_tool_schema` 作为必付格**永不被上限挤掉**(否则惰性装载退化成单向阉割);
  ④ 与既有能力门的次序:能力关掉的工具不因预算重新出现(两种喂法结论一致);
  ⑤ 纯判据不读 env:同一入参换 env 必得同一结论(env 只负责"选表"那一格);
  ⑥ 本轮上下文载体只有一个 ContextVar 且必复位;
  ⑦ 接线锁:`MCPServer.list_tools` 真走了这把尺(造好没装车 = 没有,§0.9),
     且未交上下文/未选表时与 `_TOOLS` 逐字同序同集(零扰动是接线的前提)。

不连生产库/Redis(测试隔离铁律):只用静态清单与 spy handler。
"""

from __future__ import annotations

from dataclasses import replace

import pytest

from app.core.permission_mode import CHAT_MODES
from app.services import mcp_server as mcp_mod
from app.services import tool_surface_budget as tsb
from app.services.mcp_server import _TOOLS, MCPServer, MCPTool
from app.services.tool_surface_budget import BUDGET_TABLES, BudgetTable, RoundContext

CORE = tsb.SCHEMA_RETRIEVAL_TOOL


def make_tool(name: str, *, description: str = "d", schema_key: str = "p") -> MCPTool:
    """夹具工具:`description`/`schema_key` 的体量控制该枚 schema 的估价。"""
    return MCPTool(
        name=name,
        description=description,
        input_schema={"type": "object", "properties": {schema_key: {"type": "string"}}},
    )


SAMPLE_TOOLS: tuple[MCPTool, ...] = (
    make_tool("read_file"),
    make_tool("write_file"),
    make_tool("search_web"),
    make_tool("knowledge_lookup"),
    make_tool(CORE),
    make_tool("context_recall"),
    make_tool("list_files"),
    make_tool("token6688_balance"),
    make_tool("edu_list_students"),
    # 刻意让它在字节序里排最后:③ 里"中性档被上限挤掉"才是可断言的,不靠运气。
    make_tool("image_generation", description="x" * 2000),
)
SAMPLE_NAMES = [t.name for t in SAMPLE_TOOLS]


def build_tier(**overrides: object) -> BudgetTable:
    """把在册 `lean` 表的 build 档按传入值改写(其余档原样保留)。"""
    base = BUDGET_TABLES["lean"]
    return BudgetTable(
        name=f"probe-{overrides}",
        tiers=tuple(
            replace(t, **overrides) if t.name == "build" else t  # type: ignore[arg-type]
            for t in base.tiers
        ),
        doc="测试夹具:由在册表派生,不复写第二份档位清单。",
    )


# ── ① 缺席仍可直调 + 注册表一条不动 ───────────────────────────────────────


def test_deferred_tools_are_absent_from_list_but_registry_untouched() -> None:
    """被推迟只作用于列表面:`_TOOLS` 的尺寸与双射判据一律不破。"""
    baseline = len(_TOOLS)
    visible = tsb.apply_tool_surface_budget(
        _TOOLS, context=RoundContext(session_mode="build"), table_name="tight"
    )
    assert 0 < len(visible) < baseline, "tight 表在 build 档必须真的收口"
    assert len(_TOOLS) == baseline, "列表面不得删改 _TOOLS 条目"
    assert len(_TOOLS) == len(mcp_mod._TOOL_HANDLERS), (
        "既有双射判据 len(_TOOLS)==len(_TOOL_HANDLERS) 不许被本票破坏"
    )

    deferred = sorted({t.name for t in _TOOLS} - {t.name for t in visible})
    assert deferred, "夹具前提:必须有工具被推迟"
    assert [n for n in deferred if n in mcp_mod._TOOL_HANDLERS] == deferred, (
        "缺席的工具必须仍逐枚留在执行面注册表里"
    )


@pytest.mark.asyncio
async def test_absent_tool_still_executes_through_call_tool(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """缺席那枚被直接调用 ⇒ 照常执行(spy 命中 = 列表面收口没牵连执行面)。"""
    target = "edu_list_students"
    visible = tsb.apply_tool_surface_budget(
        _TOOLS, context=RoundContext(session_mode="build"), table_name="tight"
    )
    assert all(t.name != target for t in visible), f"夹具前提:{target} 在 tight/build 档必须缺席"
    assert target not in mcp_mod._ADMIN_ONLY_TOOLS, "夹具前提:该枚不受角色矩阵干扰"

    hits: list[dict[str, object]] = []

    async def spy(arguments: dict[str, object]) -> dict[str, object]:
        hits.append(arguments)
        return {"ok": True, "tool": target}

    monkeypatch.setitem(mcp_mod._TOOL_HANDLERS, target, spy)
    result = await MCPServer().call_tool(target, {"q": 1}, user_role=0)
    assert len(hits) == 1, "缺席工具被直调时 handler 必须照常收到入参(执行面不受列表面收口)"
    assert hits[0]["q"] == 1 and hits[0]["__user_role"] == 0
    assert result["ok"] is True


# ── ② unjudged ⇒ 全量可见(反向牙)──────────────────────────────────────


def test_unjudged_returns_verbatim_identical_visible_set() -> None:
    """上下文取不到 ⇒ `unjudged`,且可见集与入参**逐字同序同对象**(不是"差不多")。"""
    decision = tsb.select_tool_surface(SAMPLE_TOOLS, table=BUDGET_TABLES["tight"], context=None)
    assert decision.state == tsb.SURFACE_UNJUDGED
    assert decision.judged is False
    assert [t.name for t in decision.visible] == SAMPLE_NAMES
    assert all(
        t is kept for t, kept in zip(SAMPLE_TOOLS, decision.visible, strict=True)
    ), "unjudged 必须原对象交回:重建对象等于偷偷改了列表面"
    assert decision.deferred_names == []
    assert all(e.state == tsb.SURFACE_UNJUDGED and e.visible for e in decision.entries)


@pytest.mark.parametrize(
    ("context", "expected_fragment"),
    [
        (RoundContext(), "会话模式没传"),
        (RoundContext(session_mode="瞎写一个认不出的模式"), "会话模式认不出"),
        (RoundContext(session_mode="ask"), "要求显式意图"),
    ],
)
def test_every_unjudgeable_shape_keeps_everything_visible(
    context: RoundContext, expected_fragment: str
) -> None:
    """模式缺 / 模式认不出 / 该档要意图而本轮没有 ⇒ 一律不藏,且理由点名是哪一格判不出。"""
    decision = tsb.select_tool_surface(SAMPLE_TOOLS, table=BUDGET_TABLES["tight"], context=context)
    assert decision.state == tsb.SURFACE_UNJUDGED
    assert [t.name for t in decision.visible] == SAMPLE_NAMES
    assert expected_fragment in decision.reason, (
        "理由必须点名判不出的那一格:否则下次有人改默认档时看不出是哪条在起作用"
    )


def test_missing_or_unknown_table_falls_back_to_full_visibility() -> None:
    """表名不在册 ⇒ 整轴不生效并交回全量;**不静默换另一张表**(换表 = 换可见集)。"""
    table, used = tsb.resolve_budget_table("no-such-table")
    assert table is None and used == "no-such-table"
    decision = tsb.select_tool_surface(
        SAMPLE_TOOLS,
        table=None,
        context=RoundContext(session_mode="build"),
        table_name=used,
    )
    assert decision.state == tsb.SURFACE_UNJUDGED
    assert [t.name for t in decision.visible] == SAMPLE_NAMES


def test_table_without_tier_for_the_mode_is_inert_not_narrowing() -> None:
    """表存在但没覆盖该模式 ⇒ 该表在这一档判不出 ⇒ 全量(缺档不等于"什么都不给")。"""
    build = BUDGET_TABLES["lean"].tier_for("build")
    assert build is not None, "夹具前提:在册 lean 表必须有 build 档"
    partial = BudgetTable(name="partial", tiers=(build,))
    assert partial.tier_for("plan") is None
    decision = tsb.select_tool_surface(
        SAMPLE_TOOLS, table=partial, context=RoundContext(session_mode="plan")
    )
    assert decision.state == tsb.SURFACE_UNJUDGED
    assert [t.name for t in decision.visible] == SAMPLE_NAMES


def test_apply_without_environment_returns_capability_gate_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """没交上下文 + 没设表名 env ⇒ 与 filter_visible_tools 逐字同序同集(零扰动)。"""
    monkeypatch.delenv(tsb.BUDGET_TABLE_ENV, raising=False)
    assert tsb.apply_tool_surface_budget(_TOOLS) == tsb.filter_visible_tools(_TOOLS)


# ── ③ 表改值 ⇒ 集合变化可断言 + 反查面必付 ────────────────────────────────


def test_changing_the_limits_changes_the_visible_set() -> None:
    """同一份上下文,上限从 20 改到 10 ⇒ 可见集单调不增,且真的变了(表是输入不是装饰)。"""
    context = RoundContext(session_mode="build")
    wide = tsb.select_tool_surface(_TOOLS, table=build_tier(max_visible=20), context=context)
    narrow = tsb.select_tool_surface(_TOOLS, table=build_tier(max_visible=10), context=context)
    none_capped = tsb.select_tool_surface(
        _TOOLS, table=BUDGET_TABLES["lean"], context=context
    )
    assert [t.name for t in none_capped.visible] == [t.name for t in _TOOLS]
    assert len(wide.visible) == 20 and len(narrow.visible) == 10
    assert {t.name for t in narrow.visible} <= {t.name for t in wide.visible}
    assert wide.deferred_names and narrow.deferred_names


def test_declared_intent_and_recent_use_earn_visibility_under_cap() -> None:
    """本轮显式意图 > 上轮用过 > 中性档:同一枚工具在三种上下文下的取舍可断言。"""
    capped = build_tier(
        always_exact=(CORE,),
        priority_prefixes=(),
        demote_prefixes=(),
        max_visible=4,
        max_schema_bytes=None,
    )
    context = RoundContext(session_mode="build")
    base = tsb.select_tool_surface(SAMPLE_TOOLS, table=capped, context=context)
    intent = tsb.select_tool_surface(
        SAMPLE_TOOLS,
        table=capped,
        context=RoundContext(session_mode="build", declared_intent=("image_generation",)),
    )
    used = tsb.select_tool_surface(
        SAMPLE_TOOLS,
        table=capped,
        context=RoundContext(session_mode="build", recently_used=("image_generation",)),
    )
    assert "image_generation" not in base.visible_names, "夹具前提:中性档(字节最大)在该上限下进不来"
    assert "image_generation" in intent.visible_names, "声明意图必须把它捞回来"
    assert "image_generation" in used.visible_names, "上轮用过必须保留连续性"
    assert "本轮显式意图声明" in next(
        e.reason for e in intent.entries if e.tool == "image_generation"
    )
    assert "上轮实际使用" in next(e.reason for e in used.entries if e.tool == "image_generation")


def test_last_round_denial_demotes_without_locking_out() -> None:
    """上轮被拒 ⇒ 降权,但**不得**与"必付格/本轮意图"打架后把它永久锁死。"""
    capped = build_tier(
        always_exact=(CORE,),
        priority_prefixes=(),
        demote_prefixes=(),
        max_visible=4,
        max_schema_bytes=None,
    )
    denied = tsb.select_tool_surface(
        SAMPLE_TOOLS,
        table=capped,
        context=RoundContext(session_mode="build", recently_denied=("image_generation",)),
    )
    assert "image_generation" not in denied.visible_names, "被拒过 ⇒ 该轮少看一眼"
    # 本轮重新声明它 ⇒ 意图档压过降权(否则"上次没成功 ⇒ 这次再也拿不到"= 死锁)
    revived = tsb.select_tool_surface(
        SAMPLE_TOOLS,
        table=capped,
        context=RoundContext(
            session_mode="build",
            recently_denied=("image_generation",),
            declared_intent=("image_generation",),
        ),
    )
    assert "image_generation" in revived.visible_names, "显式意图不得被上轮被拒锁死"


def test_schema_retrieval_leg_survives_even_a_zero_cap() -> None:
    """上限清零也挤不掉反查面必付格(否则被推迟的工具再也拿不回 schema)。"""
    zero = build_tier(
        always_exact=(CORE,), max_visible=0, max_schema_bytes=0
    )
    decision = tsb.select_tool_surface(
        SAMPLE_TOOLS, table=zero, context=RoundContext(session_mode="build")
    )
    assert decision.visible_names == [CORE]


@pytest.mark.parametrize("table_name", sorted(BUDGET_TABLES))
def test_every_shipped_tier_covers_every_mode_and_keeps_the_retrieval_leg(
    table_name: str,
) -> None:
    """在册表的形状锁:五档 ChatMode 全覆盖(缺档 = 整轴不生效)+ 反查面必付。"""
    table = BUDGET_TABLES[table_name]
    for mode in CHAT_MODES:
        tier = table.tier_for(mode)
        assert tier is not None, f"表 {table_name} 缺模式 {mode} 的档"
        assert CORE in tier.always_exact, f"{table_name}/{mode} 把 get_tool_schema 漏在必付格之外"


def test_byte_cap_defers_the_expensive_schema_first() -> None:
    """字节上限这一轴可断言:掉的是贵的 schema,理由里带上算式(不是只说"超了")。"""
    retrieval = make_tool(CORE)
    cheap = make_tool("knowledge_lookup")
    expensive = make_tool("image_generation", description="y" * 4000)
    reserved = tsb.estimate_schema_bytes(retrieval) + tsb.estimate_schema_bytes(cheap)
    capped = build_tier(
        always_exact=(CORE, "knowledge_lookup"),
        priority_prefixes=(),
        demote_prefixes=(),
        max_visible=None,
        max_schema_bytes=reserved,
    )
    decision = tsb.select_tool_surface(
        [retrieval, cheap, expensive],
        table=capped,
        context=RoundContext(session_mode="build"),
    )
    assert set(decision.visible_names) == {CORE, "knowledge_lookup"}
    reason = next(e.reason for e in decision.entries if e.tool == "image_generation")
    assert "max_schema_bytes" in reason and "超出" in reason, f"理由要给出算式:{reason}"


# ── ④ 与能力门的次序 ─────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("env", "value"),
    [
        ("MCP_COMPUTER_TOOLS_ENABLED", "false"),
        ("MCP_TOOL_SURFACE_PRODUCT_FORM", "web"),
    ],
)
def test_capability_disabled_tools_never_come_back_through_the_budget(
    monkeypatch: pytest.MonkeyPatch, env: str, value: str
) -> None:
    """能力门关掉的族不因预算回来 —— 两种喂法(先过滤 / 直接把全量交进来)结论一致。"""
    monkeypatch.setenv(env, value)
    target = "computer_screenshot_screen"
    gated = tsb.filter_visible_tools(_TOOLS)
    assert all(t.name != target for t in gated), f"夹具前提:{env}={value} 应摘掉 {target}"

    context = RoundContext(
        session_mode="build", declared_intent=(target,), recently_used=(target,)
    )
    wired = tsb.apply_tool_surface_budget(_TOOLS, context=context)
    assert all(t.name != target for t in wired)

    decision = tsb.select_tool_surface(
        _TOOLS,
        table=BUDGET_TABLES["tight"],
        context=context,
        ineligible=frozenset(t.name for t in _TOOLS) - frozenset(t.name for t in gated),
    )
    assert all(t.name != target for t in decision.visible)
    entry = next(e for e in decision.entries if e.tool == target)
    assert entry.state == tsb.SURFACE_DEFERRED and "能力门" in entry.reason


def test_budget_never_widens_the_capability_gate_output() -> None:
    """单调性:预算后的可见集 ⊆ 能力门的可见集(只会更少,不会凭空多)。"""
    context = RoundContext(session_mode="build", declared_intent=tuple(SAMPLE_NAMES))
    gated = {t.name for t in tsb.filter_visible_tools(SAMPLE_TOOLS)}
    after = {t.name for t in tsb.apply_tool_surface_budget(SAMPLE_TOOLS, context=context)}
    assert after <= gated


# ── ⑤ 纯判据与 env 隔离 ──────────────────────────────────────────────────


def test_pure_judge_is_environment_independent(monkeypatch: pytest.MonkeyPatch) -> None:
    """`select_tool_surface` 只吃入参:换 env(含表名 env、形态 env)不改结论。"""
    context = RoundContext(session_mode="build")
    before = tsb.select_tool_surface(
        SAMPLE_TOOLS, table=BUDGET_TABLES["tight"], context=context
    )
    monkeypatch.setenv(tsb.BUDGET_TABLE_ENV, "lean")
    monkeypatch.setenv("MCP_TOOL_SURFACE_PRODUCT_FORM", "cli")
    after = tsb.select_tool_surface(SAMPLE_TOOLS, table=BUDGET_TABLES["tight"], context=context)
    assert before.visible_names == after.visible_names
    assert [e.reason for e in before.entries] == [e.reason for e in after.entries]


def test_environment_selects_only_the_table_name() -> None:
    """env 那一格只做一件事:选表。认不出 ⇒ (None, 名字),由调用方落 unjudged。"""
    assert tsb.resolve_budget_table(environ={}) == (None, "")
    table, used = tsb.resolve_budget_table(environ={tsb.BUDGET_TABLE_ENV: "tight"})
    assert table is BUDGET_TABLES["tight"] and used == "tight"
    missing, name = tsb.resolve_budget_table(environ={tsb.BUDGET_TABLE_ENV: "bogus"})
    assert missing is None and name == "bogus"


def test_explicit_table_argument_beats_the_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """显式交表 > env:程序内选择不得被机器现状反向覆盖。"""
    monkeypatch.setenv(tsb.BUDGET_TABLE_ENV, "tight")
    table, used = tsb.resolve_budget_table("lean", environ={tsb.BUDGET_TABLE_ENV: "tight"})
    assert used == "lean" and table is BUDGET_TABLES["lean"]


# ── ⑥ 本轮上下文载体 ────────────────────────────────────────────────────


def test_round_context_carrier_is_scoped_and_resets() -> None:
    """载体只有一个 ContextVar,退出作用域必复位(漏复位 = 上一轮污染下一轮)。"""
    assert tsb.current_round_context() is None
    context = RoundContext(session_mode="plan", declared_intent=("read_file",))
    with tsb.use_round_context(context):
        assert tsb.current_round_context() is context
        assert tsb.apply_tool_surface_budget(SAMPLE_TOOLS, table_name="lean") is not None
    assert tsb.current_round_context() is None


def test_exception_inside_the_scope_still_resets_the_carrier() -> None:
    """异常路径同样复位(否则一条 traceback 就把后续所有轮次钉在旧上下文上)。"""
    with pytest.raises(RuntimeError):
        with tsb.use_round_context(RoundContext(session_mode="build")):
            raise RuntimeError("boom")
    assert tsb.current_round_context() is None


def test_ambient_context_drives_the_surface_without_explicit_argument(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """下一腿只需要放置上下文,不必改列表面调用点(载体的存在意义就在这一条)。"""
    monkeypatch.delenv(tsb.BUDGET_TABLE_ENV, raising=False)
    capped = build_tier(always_exact=(CORE,), max_visible=3, max_schema_bytes=None)
    monkeypatch.setitem(BUDGET_TABLES, capped.name, capped)
    with tsb.use_round_context(RoundContext(session_mode="build")):
        ambient = tsb.apply_tool_surface_budget(SAMPLE_TOOLS, table_name=capped.name)
    assert len(ambient) == 3
    assert CORE in [t.name for t in ambient]


# ── ⑦ 接线锁:MCPServer.list_tools 真走了这把尺 ──────────────────────────


def test_list_tools_wiring_is_zero_disturbance_without_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """未交上下文 + 未选表 ⇒ 与 `_TOOLS` 逐字同序同集(查找表型消费点一条都不能少拿)。"""
    monkeypatch.delenv(tsb.BUDGET_TABLE_ENV, raising=False)
    server = MCPServer()
    assert [t.name for t in server.list_tools()] == [t.name for t in _TOOLS]
    # 只交上下文、没选表 ⇒ 走默认 lean 档(不设上限):同样一条不少。
    assert [t.name for t in server.list_tools(surface_context=RoundContext(session_mode="build"))] == [
        t.name for t in _TOOLS
    ]


def test_list_tools_wiring_applies_the_budget_when_both_legs_are_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """接线真生效:选表 + 交上下文 ⇒ 同一枚 server 的列表面按表收口,且只收窄不放宽。"""
    monkeypatch.delenv(tsb.BUDGET_TABLE_ENV, raising=False)
    server = MCPServer()
    full = [t.name for t in server.list_tools()]

    monkeypatch.setenv(tsb.BUDGET_TABLE_ENV, "tight")
    narrowed = [
        t.name
        for t in server.list_tools(surface_context=RoundContext(session_mode="build"))
    ]
    assert narrowed and set(narrowed) < set(full), "预算必须真收窄,且不得凭空造出工具"
    assert CORE in narrowed, "反查面必付格不得在接线后掉掉"

    # 反向对照:选了表但**没有**上下文 ⇒ 判不了 ⇒ 全量(绝不因判不了而藏)。
    assert [t.name for t in server.list_tools()] == full


def test_list_tools_reports_a_reason_for_every_registered_tool() -> None:
    """逐条理由齐备:每一枚在册工具都要说清为什么在/不在,不是只给一个集合。"""
    decision = tsb.select_tool_surface(
        SAMPLE_TOOLS, table=BUDGET_TABLES["tight"], context=RoundContext(session_mode="build")
    )
    assert {e.tool for e in decision.entries} == set(SAMPLE_NAMES)
    assert all(e.reason for e in decision.entries)
    assert all(
        e.visible == (e.state == tsb.SURFACE_SELECTED) for e in decision.entries
    ), "visible 旗标必须与三态一致:reason 与集合互相打脸就是本仓最贵的假绿"
    report = tsb.surface_decision_report(decision)
    assert report["state"] == decision.state
    assert report["visibleCount"] == len(decision.visible)
    assert report["judged"] is True


def test_mcp_server_source_wires_the_budget_at_the_list_face_only() -> None:
    """源码层锁:接线只发生在 list_tools 的返回处,执行面(`call_tool`)不得出现这把尺。"""
    import ast
    from pathlib import Path

    source = Path(mcp_mod.__file__).read_text(encoding="utf-8")
    tree = ast.parse(source)
    list_tools_calls: list[str] = []
    call_tool_calls: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == "list_tools":
            list_tools_calls = [
                n.func.id
                for n in ast.walk(node)
                if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
            ]
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "call_tool":
            call_tool_calls = [
                n.func.id
                for n in ast.walk(node)
                if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
            ]
    assert "_apply_tool_surface_budget" in list_tools_calls, (
        "MCPServer.list_tools 不再走预算尺 ⇒ 本票的接线被回退了(造好没装车)"
    )
    assert "_apply_tool_surface_budget" not in call_tool_calls, (
        "执行面出现预算尺 = 缺席变成不可调用,违反本票第①条"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

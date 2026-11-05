# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具面惰性装载(缺口表 ⑤):按**具名预算表**决定"本轮哪些工具 schema 进列表"。

背景(2026-11-05 立,逆向-复现-超越铁律 §0.12):
    取证册 `docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/W1-workbuddy-main.md`
    §2 表行 21 观察到对侧 65 枚工具面里有一组**惰性装载**工具(`ToolSearch` +
    `DeferExecuteTool`),其净效果是"每一轮只把模型本轮真要用到的那部分 schema 付给
    上下文",而不是一开始全铺。同册缺口表第 ⑤ 行现读本仓
    `app/services/mcp_server.py` 的列表面 111 枚**全量常驻**(枚数以现读为准,勿抄本段)。

与既有三把尺的关系(§0.6 单一真相源:本模块不复写任何一条,只 import 复用):
    1. **能力/形态门** `app/services/tool_surface.py` —— 判"这枚工具该形态能不能用"。
       先跑;被它摘掉的工具**永不因预算重新出现**(接线出口 `apply_tool_surface_budget`
       把它作为 `ineligible` 一并下传,所以即使调用方误把全量清单交进来也翻不回来)。
    2. **模式 × 权限档收窄** `app/core/permission_mode.py`(`resolve_mode_policy` +
       `allowed_tool_names`,消费点在 `routers/llm.py`)—— 判"这轮这个模式**允不允许**该类
       工具",那是**执行面承诺**。本模块只借它的**词汇表**(`normalize_chat_mode`)给预算
       档位定键,**刻意不在列表面再收一次**:把执行面承诺搬进 `tools/list` 会把
       `get_tool_schema` 这类"不在只读白名单里、但必须常驻反查面"的格一起挤掉,
       那正是本票要防的"惰性装载退化成单向阉割"(见下节)。收窄与预算各守一道闸,
       两道都过才叫能用 —— 交集只在既有单源算一次,本模块不重写只读白名单。
    3. **执行配额预算** `app/services/tool_budget_governor.py` —— 判"单 run 能调几次/多少钱"。
       与本模块**同族不同轴**(那是执行面,这是列表面),互不替代。
    本模块新增的只有第 4 轴:**本轮注意力/token 预算**(哪些名字进 `tools/list`)。

失效方向(§0.3/§0.10,这是本票最重要的一条):
    判不了 ⇒ **全量可见**,三态里的 `unjudged` 永远等于"一条都没藏":
      · 本轮上下文取不到(`context=None` 且无环境上下文);
      · 会话模式缺失或拼写认不出(`normalize_chat_mode` 返回 None);
      · 预算表名不在 `BUDGET_TABLES` 键集 / 该表没有覆盖该模式的档;
      · 该档声明 `requires_intent` 而本轮没有显式意图。
    以上一律落 `unjudged` 并原序原对象交回入参清单,**绝不因"判不了"少给一次机会**。
    反向牙由测试钉住:unjudged 时可见集与全量**逐字同序同对象**。

缺席 ≠ 不可得(超越轴,复现行为但不复刻对方字节):
    被 `deferred` 的工具**仍在 `_TOOLS`/`_TOOL_HANDLERS` 里**,所以
      · 直接调用照常执行(列表面不收口执行面;测试 ①);
      · 完整 schema 仍可经既有 `get_tool_schema`(见 `mcp_server` 的 deferral 注册表)反查
        —— 因此 `get_tool_schema` 在预算表里登记为 `always_exact`:上限永远不得把它挤掉,
        否则"惰性装载"会变成"单向阉割"(测试 ③ 钉这一条)。
    对侧只观察到"搜得到/延迟执行",没有本仓这条**具名拒绝 + 反查面同源**的回路
    (`tool_surface.capability_denial` 与 `_tool_get_tool_schema` 已在缺口表 #7 那票并轨)。

可测性(对方无此对账):"哪些工具进入本轮列表"是一个**纯函数 + 具名表**的可断言集合,
    不起进程、不连库、不读 env(唯一的 env 字面量 `MCP_TOOL_SURFACE_BUDGET` 只负责
    **表名选择**,发生在 `resolve_budget_table` 这一格,纯判据 `select_tool_surface`
    拿不到它也判得出同一结论 —— 测试 ⑤ 用 monkeypatch 证这条)。
"""

from __future__ import annotations

import contextvars
import json
import logging
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field, replace
from typing import Final, Literal, Protocol

from app.core.permission_mode import normalize_chat_mode
from app.services.tool_surface import filter_visible_tools

logger = logging.getLogger(__name__)

__all__ = [
    "BUDGET_TABLE_ENV",
    "BUDGET_TABLES",
    "SURFACE_DEFERRED",
    "SURFACE_SELECTED",
    "SURFACE_UNJUDGED",
    "BudgetTable",
    "BudgetTier",
    "RoundContext",
    "SurfaceDecision",
    "SurfaceEntry",
    "apply_tool_surface_budget",
    "current_round_context",
    "estimate_schema_bytes",
    "resolve_budget_table",
    "select_tool_surface",
    "use_round_context",
]

# 三态字面量(稳定契约名,勿改字符串;列表面/测试/日志共用)。
SurfaceState = Literal["selected", "deferred", "unjudged"]

SURFACE_SELECTED: Final[SurfaceState] = "selected"
SURFACE_DEFERRED: Final[SurfaceState] = "deferred"
SURFACE_UNJUDGED: Final[SurfaceState] = "unjudged"

# 表名选择 env。只选表,不判能力 —— 与 tool_surface 的形态门不同轴,故本模块不复写它。
BUDGET_TABLE_ENV = "MCP_TOOL_SURFACE_BUDGET"

# 反查面必须常驻:被延迟的工具靠它把完整 schema 取回来(见模块头注「缺席 ≠ 不可得」)。
SCHEMA_RETRIEVAL_TOOL: Final[str] = "get_tool_schema"


class SurfaceTool(Protocol):
    """列表面需要的形状:name + 可估价的 schema 两件套。

    这是**形状契约**不是判据:`MCPTool` 天然满足,夹具也能满足,便于离线逐档断言。
    """

    name: str
    description: str
    input_schema: dict[str, object]


@dataclass(frozen=True)
class RoundContext:
    """本轮上下文(调用方显式交入;本模块不猜、不回读会话库)。

    空值语义与 `permission_mode` 同规矩:**"没传"与"传了但认不出"是两件事** ——
    两者在本模块都落 `unjudged`(全量可见),但理由字符串必须区分,否则下次换默认档
    时看不出是哪一格在起作用。
    """

    session_mode: str | None = None
    declared_intent: tuple[str, ...] = ()
    recently_used: tuple[str, ...] = ()
    recently_denied: tuple[str, ...] = ()
    turn_index: int | None = None


@dataclass(frozen=True)
class BudgetTier:
    """一个会话模式在本张预算表里的档位。

    `max_visible=None` 与 `max_visible=0` 语义不同:None = 该轴不设限,0 = 该轮什么都
    不给(仅 `always_*` 仍保留 —— 上限永远挤不掉声明必付格,见模块头注)。
    """

    name: str
    always_exact: tuple[str, ...] = ()
    always_prefixes: tuple[str, ...] = ()
    priority_prefixes: tuple[str, ...] = ()
    demote_prefixes: tuple[str, ...] = ()
    max_visible: int | None = None
    max_schema_bytes: int | None = None
    requires_intent: bool = False


@dataclass(frozen=True)
class BudgetTable:
    """具名预算表:模式 → 档。缺档即整表不生效(unjudged),不做"就近取一档"。"""

    name: str
    tiers: tuple[BudgetTier, ...]
    doc: str = ""

    def tier_for(self, mode: str | None) -> BudgetTier | None:
        if mode is None:
            return None
        for tier in self.tiers:
            if tier.name == mode:
                return tier
        return None


def _match_any(tool_name: str, prefixes: tuple[str, ...]) -> bool:
    return any(tool_name.startswith(prefix) for prefix in prefixes)


def _prefix_rank(tool_name: str, prefixes: tuple[str, ...]) -> int | None:
    """命中的第一个前缀名次(越靠前优先级越高);未命中 None。"""
    for rank, prefix in enumerate(prefixes):
        if tool_name.startswith(prefix):
            return rank
    return None


def estimate_schema_bytes(tool: SurfaceTool) -> int:
    """该枚 schema 进上下文的**粗估字节数**(UTF-8,键序稳定 ⇒ 可断言)。

    刻意是粗估:列表面要的是"这一档会不会撑爆"的单调序,不是精确 tokenizer 值
    (精确值随 provider 变,把它写进判据等于把判据钉在某一家计费口径上)。
    """
    payload = {
        "name": tool.name,
        "description": tool.description,
        "parameters": tool.input_schema,
    }
    return len(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8"))


@dataclass(frozen=True)
class SurfaceEntry:
    """逐条理由:这枚工具本轮为什么出现/缺席。"""

    tool: str
    state: SurfaceState
    visible: bool
    reason: str
    priority: int


@dataclass(frozen=True)
class SurfaceDecision[T: SurfaceTool]:
    """一次判定的完整输出(可见集 + 逐条理由 + 判据现场)。"""

    state: SurfaceState
    visible: list[T]
    entries: tuple[SurfaceEntry, ...]
    table_name: str
    tier_name: str
    reason: str
    estimated_visible_bytes: int = 0
    limits: dict[str, object] = field(default_factory=dict)

    @property
    def visible_names(self) -> list[str]:
        return [tool.name for tool in self.visible]

    @property
    def deferred_names(self) -> list[str]:
        return [e.tool for e in self.entries if e.state == SURFACE_DEFERRED]

    @property
    def judged(self) -> bool:
        return self.state != SURFACE_UNJUDGED


def _unjudge[T: SurfaceTool](
    tools: Sequence[T], *, table_name: str, reason: str
) -> SurfaceDecision[T]:
    """唯一的全量交回出口:原对象、原序、一条不藏(§0.3)。"""
    visible = list(tools)
    entries = tuple(
        SurfaceEntry(tool=t.name, state=SURFACE_UNJUDGED, visible=True, reason=reason, priority=0)
        for t in tools
    )
    return SurfaceDecision[T](
        state=SURFACE_UNJUDGED,
        visible=visible,
        entries=entries,
        table_name=table_name,
        tier_name="",
        reason=reason,
        estimated_visible_bytes=sum(estimate_schema_bytes(t) for t in visible),
    )


def select_tool_surface[T: SurfaceTool](
    tools: Sequence[T],
    *,
    table: BudgetTable | None,
    context: RoundContext | None,
    ineligible: frozenset[str] = frozenset(),
    table_name: str | None = None,
) -> SurfaceDecision[T]:
    """纯判据主出口:预算表 + 本轮上下文 → 本轮可见工具集 + 逐条理由。

    判序(固定,便于逐档断言):
      1. 表/上下文/模式任一取不到 ⇒ `unjudged` 全量交回;
      2. 先剔除 `ineligible`(上游能力门已摘的格,预算不得翻回);
      3. 再按 `allowed_tool_names` 与模式 × 权限档收窄(交集只在既有单源算一次);
      4. 按优先级分档 + 上限(枚数/字节)决定 `selected`/`deferred`。
    本函数**不读 env、不读台账** ⇒ 同一入参必得同一结论(测试 ⑤)。
    """
    resolved_name = table_name or (table.name if table is not None else "")
    if table is None:
        return _unjudge(
            tools,
            table_name=resolved_name,
            reason=f"{SURFACE_UNJUDGED}:预算表缺失或未在 BUDGET_TABLES 在册({resolved_name or '(空名)'})",
        )
    if context is None:
        return _unjudge(
            tools, table_name=table.name, reason=f"{SURFACE_UNJUDGED}:本轮上下文取不到(未显式交入,环境也无)"
        )

    normalized_mode = normalize_chat_mode(context.session_mode)
    if normalized_mode is None:
        absent = context.session_mode is None or not str(context.session_mode).strip()
        return _unjudge(
            tools,
            table_name=table.name,
            reason=(
                f"{SURFACE_UNJUDGED}:会话模式没传"
                if absent
                else f"{SURFACE_UNJUDGED}:会话模式认不出({context.session_mode!r})"
            ),
        )

    tier = table.tier_for(normalized_mode)
    if tier is None:
        return _unjudge(
            tools,
            table_name=table.name,
            reason=f"{SURFACE_UNJUDGED}:表 {table.name} 没有覆盖模式 {normalized_mode} 的档",
        )
    if tier.requires_intent and not context.declared_intent:
        return _unjudge(
            tools,
            table_name=table.name,
            reason=f"{SURFACE_UNJUDGED}:档 {tier.name} 要求显式意图而本轮没有(tier.requires_intent=True)",
        )

    intent_names = frozenset(n for n in context.declared_intent if not n.endswith("*"))
    intent_prefixes = tuple(n[:-1] for n in context.declared_intent if n.endswith("*"))
    used_set = frozenset(context.recently_used)
    denied_set = frozenset(context.recently_denied)

    ranked: list[tuple[int, int, str, T, str]] = []
    blocked: list[SurfaceEntry] = []
    for tool in tools:
        if tool.name in ineligible:
            blocked.append(
                SurfaceEntry(
                    tool=tool.name,
                    state=SURFACE_DEFERRED,
                    visible=False,
                    reason=f"{SURFACE_DEFERRED}:上游能力门已摘,预算不得翻回",
                    priority=-1,
                )
            )
            continue
        priority, reason = _classify(
            tool.name,
            tier,
            intent_names=intent_names,
            intent_prefixes=intent_prefixes,
            used=used_set,
            denied=denied_set,
        )
        ranked.append((priority, _bytes_rank(tool), tool.name, tool, reason))

    kept, cap_reasons = _apply_caps(ranked, tier)

    entries: list[SurfaceEntry] = list(blocked)
    for priority, _rank, name, _tool, reason in ranked:
        if name in kept:
            entries.append(
                SurfaceEntry(
                    tool=name,
                    state=SURFACE_SELECTED,
                    visible=True,
                    reason=reason,
                    priority=priority,
                )
            )
        else:
            entries.append(
                SurfaceEntry(
                    tool=name,
                    state=SURFACE_DEFERRED,
                    visible=False,
                    reason=cap_reasons.get(name, f"{SURFACE_DEFERRED}:超出该档上限"),
                    priority=priority,
                )
            )

    kept_set = set(kept)
    visible = [t for t in tools if t.name in kept_set and t.name not in ineligible]
    visible_bytes = sum(estimate_schema_bytes(t) for t in visible)
    deferred_count = len([e for e in entries if e.state == SURFACE_DEFERRED])
    state: SurfaceState = SURFACE_DEFERRED if deferred_count else SURFACE_SELECTED
    by_name = {e.tool: e for e in entries}
    ordered = [by_name[t.name] for t in tools if t.name in by_name]

    logger.debug(
        "[tool_surface_budget] 表=%s 档=%s 模式=%s 可见=%d 缺席=%d",
        table.name,
        tier.name,
        normalized_mode,
        len(visible),
        deferred_count,
    )
    return SurfaceDecision[T](
        state=state,
        visible=visible,
        entries=tuple(ordered),
        table_name=table.name,
        tier_name=tier.name,
        reason=(
            f"{state}:表 {table.name} / 档 {tier.name} / 模式 {normalized_mode}"
            f" → 可见 {len(visible)} 枚"
        ),
        estimated_visible_bytes=visible_bytes,
        limits={
            "max_visible": tier.max_visible,
            "max_schema_bytes": tier.max_schema_bytes,
            "always_kept": sorted(row[2] for row in ranked if row[0] >= 5),
        },
    )


def _classify(
    tool_name: str,
    tier: BudgetTier,
    *,
    intent_names: frozenset[str],
    intent_prefixes: tuple[str, ...],
    used: frozenset[str],
    denied: frozenset[str],
) -> tuple[int, str]:
    """优先级分档:5 always → 4 意图 → 3 上轮用过 → 2 表内优先族 → 1 中性 → 0 降权。

    意图声明支持 `前缀*` 形态(下一腿按族声明用),与精确名同档。

    `always`/意图 两档**不受"上轮被拒"降权影响**:被拒只该让模型少看一眼,
    不该让声明必付格或本轮显式意图消失(否则会出现"上一次没成功 ⇒ 这次再也拿不到"的死锁)。
    """
    if tool_name in tier.always_exact:
        return 5, f"{SURFACE_SELECTED}:表内必付格(always_exact={tool_name})"
    if _match_any(tool_name, tier.always_prefixes):
        return 5, f"{SURFACE_SELECTED}:表内必付族(always_prefix 命中 {tool_name})"
    if tool_name in intent_names or _match_any(tool_name, intent_prefixes):
        return 4, f"{SURFACE_SELECTED}:本轮显式意图声明({tool_name})"
    if tool_name in used:
        return 3, f"{SURFACE_SELECTED}:上轮实际使用,保留连续性({tool_name})"
    rank = _prefix_rank(tool_name, tier.priority_prefixes)
    if rank is not None:
        return 2, f"{SURFACE_SELECTED}:优先族名次 {rank}(priority_prefixes)"
    if _match_any(tool_name, tier.demote_prefixes) or tool_name in denied:
        return 0, f"{SURFACE_SELECTED}:降权族(demote/上轮被拒),仅在上限有余量时出现"
    return 1, f"{SURFACE_SELECTED}:中性档,按上限余量纳入"


def _bytes_rank(tool: SurfaceTool) -> int:
    return estimate_schema_bytes(tool)


def _apply_caps[T: SurfaceTool](
    ranked: list[tuple[int, int, str, T, str]], tier: BudgetTier
) -> tuple[set[str], dict[str, str]]:
    """先保 `always`(5 档,上限不得挤掉它),再按 (优先级降序, 字节升序, 名字) 填余量。"""
    kept: set[str] = set()
    cap_reasons: dict[str, str] = {}
    used_bytes = 0
    order = sorted(ranked, key=lambda row: (-row[0], row[1], row[2]))

    for priority, _b, name, tool, _reason in order:
        if priority < 5:
            continue
        kept.add(name)
        used_bytes += estimate_schema_bytes(tool)

    for priority, _b, name, tool, _reason in order:
        if priority >= 5:
            continue
        if tier.max_visible is not None and len(kept) >= tier.max_visible:
            cap_reasons[name] = f"{SURFACE_DEFERRED}:枚数上限 max_visible={tier.max_visible} 已满"
            continue
        cost = estimate_schema_bytes(tool)
        if tier.max_schema_bytes is not None and used_bytes + cost > tier.max_schema_bytes:
            cap_reasons[name] = (
                f"{SURFACE_DEFERRED}:字节上限 max_schema_bytes={tier.max_schema_bytes}"
                f" 已用 {used_bytes}+{cost} 超出"
            )
            continue
        kept.add(name)
        used_bytes += cost
    return kept, cap_reasons


# ---------------------------------------------------------------------------
# 具名预算表(默认档 = 什么都不藏:max_visible/max_schema_bytes 全 None)
# ---------------------------------------------------------------------------
# 三张表覆盖五档 ChatMode 全部拼写(`normalize_chat_mode` 的输出),缺档即整表不生效。
# `lean` 是本票的"能落地即不扰动"档:必付格 + 模式收窄照旧,枚数/字节不设限。

_CORE_ALWAYS: tuple[str, ...] = (
    SCHEMA_RETRIEVAL_TOOL,
    "read_file",
    "list_files",
    "search_web",
    "knowledge_lookup",
    "context_recall",
)

_LEAN_TIERS: tuple[BudgetTier, ...] = (
    BudgetTier(
        name="build",
        always_exact=_CORE_ALWAYS,
        priority_prefixes=("file", "read", "search", "list_", "write", "edit", "run_"),
        demote_prefixes=("token6688_", "edu_"),
        max_visible=None,
        max_schema_bytes=None,
    ),
    BudgetTier(
        name="spec",
        always_exact=_CORE_ALWAYS,
        priority_prefixes=("file", "read", "search", "list_", "write", "edit", "run_"),
        demote_prefixes=("token6688_", "edu_"),
    ),
    BudgetTier(
        name="plan",
        always_exact=(SCHEMA_RETRIEVAL_TOOL, "read_file", "list_files", "knowledge_lookup"),
        priority_prefixes=("read", "search", "list_", "file", "index", "context", "analyze"),
    ),
    BudgetTier(
        name="review",
        always_exact=(SCHEMA_RETRIEVAL_TOOL, "read_file", "list_files", "knowledge_lookup"),
        priority_prefixes=("read", "search", "list_", "file", "review", "git", "analyze"),
    ),
    BudgetTier(
        name="ask",
        always_exact=(SCHEMA_RETRIEVAL_TOOL, "knowledge_lookup", "context_recall"),
        priority_prefixes=("read", "search", "list_", "fetch", "extract"),
    ),
)

_TIGHT_TIERS: tuple[BudgetTier, ...] = tuple(
    replace(
        tier,
        max_visible=28 if tier.name in ("build", "spec") else 18,
        max_schema_bytes=24000 if tier.name in ("build", "spec") else 14000,
        requires_intent=tier.name == "ask",
    )
    for tier in _LEAN_TIERS
)

BUDGET_TABLES: dict[str, BudgetTable] = {
    "lean": BudgetTable(
        name="lean",
        tiers=_LEAN_TIERS,
        doc="只收口必付格与模式收窄,不设枚数/字节上限(默认档:不藏任何工具)。",
    ),
    "tight": BudgetTable(
        name="tight",
        tiers=_TIGHT_TIERS,
        doc="对侧那一档:每轮只付模型真要用到的那部分 schema;ask 档要求显式意图。",
    ),
}

_ROUND_CONTEXT: contextvars.ContextVar[RoundContext | None] = contextvars.ContextVar(
    "ihui_tool_surface_round_context", default=None
)


def current_round_context() -> RoundContext | None:
    """环境上下文里的本轮上下文;没有则 None(调用方据此落 unjudged,绝不编造)。"""
    return _ROUND_CONTEXT.get()


@contextmanager
def use_round_context(context: RoundContext | None) -> Iterator[RoundContext | None]:
    """把本轮上下文放进当前上下文(与 `exec_env.set_session_env_context` 同纪律)。

    载体只有这一个 ContextVar;写入点归调用方(下一腿:routers 侧按 chat_mode +
    已声明 agent_tools 交入),本模块不回读会话库。
    """
    token = _ROUND_CONTEXT.set(context)
    try:
        yield context
    finally:
        _ROUND_CONTEXT.reset(token)


def resolve_budget_table(
    name: str | None = None, *, environ: dict[str, str] | None = None
) -> tuple[BudgetTable | None, str]:
    """按名字取表;名字缺失时读 `BUDGET_TABLE_ENV`。返回 (表或 None, 用到的名字)。

    表名解析不出来/不在册 ⇒ `(None, 名字)`,由 `select_tool_surface` 落 `unjudged`
    (全量可见)—— 这里不猜、也不回落成另一张表:静默换表就是静默改可见集。
    """
    resolved = (name or "").strip()
    if not resolved:
        source = environ if environ is not None else _environ_snapshot()
        resolved = (source.get(BUDGET_TABLE_ENV) or "").strip()
    if not resolved:
        return None, ""
    return BUDGET_TABLES.get(resolved), resolved


def _environ_snapshot() -> dict[str, str]:
    import os

    return dict(os.environ)


def apply_tool_surface_budget[T: SurfaceTool](
    tools: Sequence[T],
    *,
    context: RoundContext | None = None,
    table_name: str | None = None,
    default_table: str = "lean",
) -> list[T]:
    """列表面唯一接线出口:能力门 → (本轮上下文齐备时)模式收窄 + 预算。

    两条进入条件(缺一即整轴不生效,原样交回能力门结果):
      · 有人显式交入/放置本轮上下文;
      · 或部署侧把 `MCP_TOOL_SURFACE_BUDGET` 设成一张在册表名。
    只交上下文没选表 ⇒ 用 `default_table`(`lean`:不设枚数/字节上限,只走既有模式收窄);
    选了表但上下文取不到 ⇒ `unjudged` ⇒ 仍然全量可见(§0.3:判不了绝不藏工具)。

    三条硬性质(逐条有测试):
      · 无上下文且未选表 ⇒ 与 `filter_visible_tools(tools)` **逐字同序同集**(零扰动);
      · 被能力门摘掉的工具**永不因预算回来**(它作为 `ineligible` 下传,即使误把全量
        清单交进 `select_tool_surface` 也翻不回来);
      · 任何 deferred 只作用于列表面 —— 注册表与 handler 一律不动(缺席仍可直调)。
    """
    gated = filter_visible_tools(tools)
    resolved_context = context if context is not None else current_round_context()
    table, used_name = resolve_budget_table(table_name)
    if table is None and not used_name:
        if resolved_context is None:
            # 既没人要求判、也没有可判的上下文 ⇒ 本轴整体不生效(不是"判不了")。
            return gated
        table, used_name = BUDGET_TABLES.get(default_table), default_table
    ineligible = frozenset(t.name for t in tools) - frozenset(t.name for t in gated)
    decision = select_tool_surface(
        gated,
        table=table,
        context=resolved_context,
        ineligible=ineligible,
        table_name=used_name if table is None else None,
    )
    if not decision.judged:
        logger.info(
            "[tool_surface_budget] 本轮未判定 ⇒ 全量可见(%d 枚): %s",
            len(decision.visible),
            decision.reason,
        )
    return decision.visible


def surface_decision_report(decision: SurfaceDecision[SurfaceTool]) -> dict[str, object]:
    """把一次判定折成可呈现结构(逐条理由 + 判据现场),供日志/调试端点消费。"""
    return {
        "state": decision.state,
        "judged": decision.judged,
        "table": decision.table_name,
        "tier": decision.tier_name,
        "reason": decision.reason,
        "visibleCount": len(decision.visible),
        "estimatedVisibleBytes": decision.estimated_visible_bytes,
        "limits": dict(decision.limits),
        "entries": [
            {
                "tool": e.tool,
                "state": e.state,
                "visible": e.visible,
                "priority": e.priority,
                "reason": e.reason,
            }
            for e in decision.entries
        ],
    }


# 供测试直接取用(§22c:判据只有一份,测试 import 源模块而不是复制)。
__test__ = {
    "select_tool_surface": select_tool_surface,
    "apply_tool_surface_budget": apply_tool_surface_budget,
    "resolve_budget_table": resolve_budget_table,
    "estimate_schema_bytes": estimate_schema_bytes,
    "classify": _classify,
    "surface_decision_report": surface_decision_report,
    "LEAN_TABLE": BUDGET_TABLES["lean"],
    "TIGHT_TABLE": BUDGET_TABLES["tight"],
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

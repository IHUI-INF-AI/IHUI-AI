# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具预算「第二层(聚合层)配额」接线锁(goal-b49 Z20,2026-11-06 立)。

缺口表原文口径(Z4-triage 第 58 行 / 对标靶 T9 §3 #7「三层装箱预算 maxChunkChars /
maxCharsPerResult / **maxTotalChars** + maxRerankTokens」):我方只有**每桶**那一层,
缺的是"每桶之外的聚合总量层"。本文件钉四件事,缺一即本票未落地:

1. 层二两维(`tool_call_total_limit` / `mcp_token_total_limit`)与层一同纪律:
   各自独立、0 ⇒ 关闭且**一次计数都不写**、超限**具名拒绝**(维度名 + 聚合实测 + 上限);
2. 被层二拒绝的本次**连层一计数都不污染**(绝不"少放一次"当截断);
3. **比较式只有一枚** `over_limit()`:层一三维 + 层一四维 + 层二两维全走它,
   判定路径源码里出现第二份 `> limit` 形态即红(§0.6 / §22c 同纪律);
4. 层二接在**既有生产消费点**上(acquire ← guarded_tool_pipeline,
   consume_mcp_tokens ← mcp_client)——"造好没装车=没有"(§0.9),故本文件读消费侧源码
   取证,而不是只测本器。

判据单源:维度名 / env 键 / 上限取值 / 文案一律 import 源模块,本文件不复制常量。
纯内存 + 只读源码,零 DB(不碰生产库 8810/8811)、零网络、零新依赖。
"""

from __future__ import annotations

import inspect
import re
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from app.core.capability_matrix import CAPABILITY_MATRIX
from app.services.tool_budget_governor import (
    AGGREGATE_DIMENSIONS,
    ALL_DIMENSIONS,
    BUDGET_DIMENSIONS,
    BUDGET_EXCEEDED,
    DEFAULT_AGGREGATE_SCOPE,
    DIM_ENV_KEYS,
    DIM_LABELS,
    DIM_MCP_TOKEN_LIMIT,
    DIM_MCP_TOKEN_TOTAL_LIMIT,
    DIM_TOOL_CALL_TOTAL_LIMIT,
    REASON_DIM_DISABLED,
    REASON_DISABLED,
    ToolBudgetConfig,
    ToolBudgetGovernor,
    over_limit,
)

# 判定路径源码里**不得**出现的第二份超限比较形态(实测 > limit / > c.max_*)
_SECOND_COMPARISON = re.compile(r">\s*(?:limit|c\.max_\w+)")

# 生产消费侧的既有调用形态(逐字):少了它们,层二就退回"造好没装车"
_CONSUMER_SOURCES: dict[str, tuple[str, ...]] = {
    "guarded_tool_pipeline.py": ("budget_gov.acquire(", "budget_gov.release(run_id"),
    "mcp_client.py": ("consume_mcp_tokens(",),
}

# 层二维度的「以本次增量为 1」判定入口(逐维一份,供边界对照复用)
_LAYER_TWO_CALLS: dict[str, Callable[[ToolBudgetGovernor, str], Any]] = {
    DIM_TOOL_CALL_TOTAL_LIMIT: lambda gov, rid: gov.acquire(rid),
    DIM_MCP_TOKEN_TOTAL_LIMIT: lambda gov, rid: gov.consume_mcp_tokens(rid, 1),
}


def _gov(**overrides: int) -> ToolBudgetGovernor:
    """只开指定分维(enabled 保持默认 False)——维度名即配置字段名,由测试 ① 钉。"""
    return ToolBudgetGovernor(ToolBudgetConfig(**overrides))


# ① 维度名 / 配置字段 / env 键 / 到人说明四者同源,且与层一互不相交
# ===========================================================================


def test_layer_two_dims_share_the_same_naming_discipline() -> None:
    assert len(AGGREGATE_DIMENSIONS) == 2
    assert set(AGGREGATE_DIMENSIONS).isdisjoint(BUDGET_DIMENSIONS)
    assert ALL_DIMENSIONS == BUDGET_DIMENSIONS + AGGREGATE_DIMENSIONS
    for dimension in AGGREGATE_DIMENSIONS:
        assert hasattr(ToolBudgetConfig(), dimension), dimension
        assert getattr(ToolBudgetConfig(), dimension) == 0, "层二默认必须为 0(该维关闭)"
        assert ToolBudgetConfig().dim_limit(dimension) == 0, dimension
        assert dimension in DIM_LABELS and dimension in DIM_ENV_KEYS, dimension
        assert DIM_ENV_KEYS[dimension].isupper(), dimension


def test_layer_two_negative_limit_is_named_not_clamped() -> None:
    with pytest.raises(ValueError, match="不得为负"):
        ToolBudgetConfig(**{DIM_TOOL_CALL_TOTAL_LIMIT: -1})


# ② 层二全关(默认)⇒ 与接线前逐零差异
# ===========================================================================


def test_layer_two_closed_is_byte_identical_to_before() -> None:
    gov = _gov()
    res = gov.acquire("r", tool_name="write_file", cost_estimate=9999.0)
    assert res.allowed is True and res.reason == REASON_DISABLED
    assert res.dimension == ""
    assert gov.get_state("r")["used"] == {"tool_count": 0, "cost": 0.0, "active": 0}

    bucket = gov.consume_mcp_tokens("b", 10**9)
    assert bucket.allowed is True and bucket.reason == REASON_DIM_DISABLED
    assert bucket.limits[DIM_MCP_TOKEN_LIMIT] == 0
    assert gov.dim_state("b")["used"][DIM_MCP_TOKEN_LIMIT] == 0
    # 一次聚合计数都不写,且关闭维的 remaining = None(不用 0 冒充「已用尽」)
    state = gov.aggregate_state()
    assert state["used"] == dict.fromkeys(AGGREGATE_DIMENSIONS, 0)
    assert state["open_dimensions"] == []
    assert all(value is None for value in state["remaining"].values())


def test_aggregate_projection_shape() -> None:
    state = _gov(**{DIM_TOOL_CALL_TOTAL_LIMIT: 4}).aggregate_state()
    assert state["layer"] == "aggregate"
    assert state["scope_id"] == DEFAULT_AGGREGATE_SCOPE
    assert state["limits"] == dict.fromkeys(AGGREGATE_DIMENSIONS, 0) | {
        DIM_TOOL_CALL_TOTAL_LIMIT: 4
    }
    assert state["open_dimensions"] == [DIM_TOOL_CALL_TOTAL_LIMIT]
    assert state["remaining"][DIM_TOOL_CALL_TOTAL_LIMIT] == 4
    assert state["remaining"][DIM_MCP_TOKEN_TOTAL_LIMIT] is None


# ③ 单一比较式:层二拒绝逐值 ⟺ over_limit,且判定路径不写第二份比较
# ===========================================================================


@pytest.mark.parametrize("dimension", list(_LAYER_TWO_CALLS))
@pytest.mark.parametrize("limit", (1, 3))
def test_layer_two_refuses_exactly_where_the_single_predicate_says(
    dimension: str, limit: int
) -> None:
    gov = _gov(**{dimension: limit})
    verdicts = [_LAYER_TWO_CALLS[dimension](gov, f"r{i}") for i in range(limit + 2)]
    assert [v.allowed for v in verdicts] == [
        not over_limit(i + 1, limit) for i in range(limit + 2)
    ], "层二拒绝必须与唯一比较式逐值同判"


def test_judgment_paths_do_not_replicate_the_comparison() -> None:
    judgment_paths = (
        ToolBudgetGovernor.acquire,
        ToolBudgetGovernor.consume_mcp_tokens,
        ToolBudgetGovernor.check_dim,
        ToolBudgetGovernor._aggregate_denial,
    )
    for fn in judgment_paths:
        src = inspect.getsource(fn)
        assert _SECOND_COMPARISON.search(src) is None, f"{fn.__name__} 里出现第二份超限比较"
    # 层二只能通过 over_limit 得出拒绝,且层一路径必须真的问它
    assert "over_limit(" in inspect.getsource(ToolBudgetGovernor._aggregate_denial)
    assert "self._aggregate_denial(" in inspect.getsource(ToolBudgetGovernor.acquire)
    assert "self._aggregate_denial(" in inspect.getsource(ToolBudgetGovernor.consume_mcp_tokens)


def test_check_dim_refuses_layer_two_dims() -> None:
    """聚合量在提交时才成形,阈值出口替它判定 = 第二把尺 ⇒ 当场拒(§0.6)。"""
    gov = _gov(**{DIM_TOOL_CALL_TOTAL_LIMIT: 10})
    for dimension in AGGREGATE_DIMENSIONS:
        with pytest.raises(ValueError, match="第二层"):
            gov.check_dim(dimension, 1)
    with pytest.raises(ValueError) as exc:
        gov.check_dim("nope", 1)
    for dimension in ALL_DIMENSIONS:
        assert dimension in str(exc.value), "未知维度必须点名全部合法维度(含层二)"


# ④ 超限具名拒绝 + 被拒本次不污染任何一层
# ===========================================================================


def test_tool_call_total_refuses_by_name_and_pollutes_nothing() -> None:
    limit = 3
    gov = _gov(**{DIM_TOOL_CALL_TOTAL_LIMIT: limit})
    for i in range(limit):
        assert gov.acquire(f"run-{i}", tool_name=f"t{i}").allowed is True
    over = gov.acquire("run-x", tool_name="t-late")
    assert over.allowed is False
    assert over.error_type == BUDGET_EXCEEDED
    assert over.dimension == DIM_TOOL_CALL_TOTAL_LIMIT
    assert DIM_TOOL_CALL_TOTAL_LIMIT in over.reason
    assert str(limit + 1) in over.reason and str(limit) in over.reason
    # 被拒的本次:层一没建 run、层二没涨
    assert gov.get_state("run-x")["used"] == {"tool_count": 0, "cost": 0.0, "active": 0}
    assert gov.aggregate_state()["used"][DIM_TOOL_CALL_TOTAL_LIMIT] == limit
    assert gov.aggregate_state()["remaining"][DIM_TOOL_CALL_TOTAL_LIMIT] == 0


def test_layer_two_bites_before_layer_one_when_run_loop_is_looser() -> None:
    """enabled=True 且 run 循环很宽(100)时,聚合层(2)仍先拦 —— 它不是 run 维的附庸。"""
    gov = ToolBudgetGovernor(
        ToolBudgetConfig(enabled=True, max_tools_per_run=100, **{DIM_TOOL_CALL_TOTAL_LIMIT: 2})
    )
    assert gov.acquire("r", tool_name="a").allowed is True
    assert gov.acquire("r", tool_name="b").allowed is True
    third = gov.acquire("r", tool_name="c")
    assert third.allowed is False and third.dimension == DIM_TOOL_CALL_TOTAL_LIMIT
    assert "执行次数超限" not in third.reason  # 报的是聚合层,不是层一次数
    assert gov.get_state("r")["used"]["tool_count"] == 2


# ⑤ 聚合按 scope 分区:未显式分区 ⇒ 默认合计面(单例治理器的进程/部署面)
# ===========================================================================


def test_aggregate_scopes_are_independent_and_default_is_named() -> None:
    gov = _gov(**{DIM_TOOL_CALL_TOTAL_LIMIT: 2})
    assert gov.acquire("r1", scope_id="tenant-a").allowed is True
    assert gov.acquire("r2", scope_id="tenant-a").allowed is True
    assert gov.acquire("r3", scope_id="tenant-a").allowed is False
    assert gov.acquire("r4", scope_id="tenant-b").allowed is True
    assert gov.aggregate_state("tenant-a")["used"][DIM_TOOL_CALL_TOTAL_LIMIT] == 2
    assert gov.aggregate_state("tenant-b")["used"][DIM_TOOL_CALL_TOTAL_LIMIT] == 1
    # 未分区不落成"没判":显式回落默认 scope,并在投影里点名
    assert gov.aggregate_state()["scope_id"] == DEFAULT_AGGREGATE_SCOPE
    assert gov.aggregate_state("   ")["scope_id"] == DEFAULT_AGGREGATE_SCOPE
    assert gov.reset_aggregate("tenant-a") is True
    assert gov.reset_aggregate("tenant-a") is False
    assert gov.aggregate_state("tenant-a")["used"][DIM_TOOL_CALL_TOTAL_LIMIT] == 0


# ⑥ MCP 令牌桶的层二:跨桶合计有界,且桶不受聚合拒绝污染
# ===========================================================================


def test_mcp_token_total_aggregates_across_buckets() -> None:
    gov = _gov(**{DIM_MCP_TOKEN_LIMIT: 600, DIM_MCP_TOKEN_TOTAL_LIMIT: 1000})
    assert gov.consume_mcp_tokens("bucket-a", 600).allowed is True
    second = gov.consume_mcp_tokens("bucket-b", 400)
    assert second.allowed is True
    assert second.used[DIM_MCP_TOKEN_TOTAL_LIMIT] == 1000
    assert second.limits[DIM_MCP_TOKEN_TOTAL_LIMIT] == 1000
    over = gov.consume_mcp_tokens("bucket-b", 1)
    assert over.allowed is False and over.dimension == DIM_MCP_TOKEN_TOTAL_LIMIT
    assert DIM_MCP_TOKEN_TOTAL_LIMIT in over.reason
    assert str(1001) in over.reason and str(1000) in over.reason
    # 层二拒绝不得回写层一桶(不夹逼、不静默截断)
    assert gov.dim_state("bucket-b")["used"][DIM_MCP_TOKEN_LIMIT] == 400
    assert gov.aggregate_state()["used"][DIM_MCP_TOKEN_TOTAL_LIMIT] == 1000


# ⑦ env 装配(from_env 六维同源)
# ===========================================================================


def test_from_env_assembles_layer_two_keys() -> None:
    cfg = ToolBudgetConfig.from_env(
        {
            DIM_ENV_KEYS[DIM_TOOL_CALL_TOTAL_LIMIT]: "500",
            DIM_ENV_KEYS[DIM_MCP_TOKEN_TOTAL_LIMIT]: "200000",
        }
    )
    assert cfg.tool_call_total_limit == 500
    assert cfg.mcp_token_total_limit == 200000
    assert cfg.enabled is False  # 装分维绝不顺手打开 run 循环门
    assert ToolBudgetConfig.from_env({}).tool_call_total_limit == 0
    junk = ToolBudgetConfig.from_env({DIM_ENV_KEYS[DIM_MCP_TOKEN_TOTAL_LIMIT]: "-3"})
    assert junk.mcp_token_total_limit == 0  # 非法 ⇒ 关闭,不猜上限


# ⑧ 台账在册(超越轴:对方配额是内置常量,我方可被守门 diff)
# ===========================================================================


def test_layer_two_dims_are_registered_in_capability_ledger() -> None:
    rows = {row["env"]: row for row in CAPABILITY_MATRIX}
    for dimension in AGGREGATE_DIMENSIONS:
        env_key = DIM_ENV_KEYS[dimension]
        assert env_key in rows, f"{dimension} 的 env {env_key} 未登记进 capability_matrix.py"
        row = rows[env_key]
        assert row["default"] == "0", f"{env_key} 的 default 必须如实登记 0(未配即不拦)"
        assert row["owner_module"] == "app.services.tool_budget_governor", env_key
        assert env_key in row["doc_ref"], f"{env_key} 的 doc_ref 必须指向唯一读取点"


# ⑨ 装车证明:两条生产消费点确实走到层二(§0.9「造好没装车=没有」)
# ===========================================================================


def test_production_consumers_still_drive_the_governor_paths() -> None:
    services = Path(__file__).resolve().parents[1] / "app" / "services"
    for filename, needles in _CONSUMER_SOURCES.items():
        src = (services / filename).read_text(encoding="utf-8")
        for needle in needles:
            assert needle in src, f"{filename} 不再经 {needle} 走预算门 ⇒ 层二失去生产消费点"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具预算「分维配额」接线锁(goal-b49 S4,2026-11-05 立)。

覆盖三类回归,缺一即本票未落地:
1. 四维各自独立:mcp_tool_limit / mcp_token_limit / custom_prompt_token_limit /
   history_query_limit —— 未配(0)⇒ 该维关闭,配了 ⇒ 超限**具名拒绝**(拒绝原因
   同时含维度名 + 实测值 + 上限值),绝不静默截断;
2. run 循环三维(max_tools_per_run / max_cost_per_run_usd / max_concurrency)行为
   **一字未动**:新增四维既不能把 `enabled=False` 翻成开,也不能改 used/remaining 形状;
3. 四维的大写 env 键必须同时在 `core/capability_matrix.py` 台账在册(超越轴:对方配额
   是产品内置常量、无入库台账,我方这格可被守门 diff)。

判据单源(AGENTS §22c 同纪律):维度名 / env 键 / 量法 / 拒绝文案一律 import 源模块,
本文件不复制任何常量或正则。
"""

from __future__ import annotations

import pytest

from app.core.capability_matrix import CAPABILITY_MATRIX
from app.services.tool_budget_governor import (
    ACCUMULATING_DIMENSIONS,
    BUDGET_DIMENSIONS,
    BUDGET_EXCEEDED,
    DIM_CUSTOM_PROMPT_TOKEN_LIMIT,
    DIM_ENV_KEYS,
    DIM_HISTORY_QUERY_LIMIT,
    DIM_LABELS,
    DIM_MCP_TOKEN_LIMIT,
    DIM_MCP_TOOL_LIMIT,
    REASON_DIM_DISABLED,
    REASON_DISABLED,
    REASON_OK,
    ToolBudgetConfig,
    ToolBudgetGovernor,
    estimate_tokens,
)


def _gov(**overrides: int) -> ToolBudgetGovernor:
    """只开指定分维(enabled 保持默认 False)——维度名即配置字段名,由测试 ① 钉住。"""
    return ToolBudgetGovernor(ToolBudgetConfig(**overrides))


# 阈值型(非累加)维度的公开入口:维度名 → 以「实测值」为入参的检查函数
_THRESHOLD_CHECKS = {
    DIM_MCP_TOOL_LIMIT: lambda gov, value: gov.check_mcp_tool_count(value),
    DIM_HISTORY_QUERY_LIMIT: lambda gov, value: gov.check_history_query(value),
}


# ① 维度名 / 配置字段名 / 台账键三者同源
# ===========================================================================


def test_dimension_names_are_config_field_names() -> None:
    """维度名字面量必须就是 ToolBudgetConfig 的字段名(否则 from_env 与台账会两套名)。"""
    for dimension in BUDGET_DIMENSIONS:
        assert hasattr(ToolBudgetConfig(), dimension), dimension
        assert getattr(ToolBudgetConfig(), dimension) == 0, f"{dimension} 默认必须为 0(该维关闭)"
        assert ToolBudgetConfig().dim_limit(dimension) == 0, dimension
        assert dimension in DIM_LABELS, f"{dimension} 缺到人说明,拒绝原因将无法点名"
        assert DIM_ENV_KEYS[dimension].isupper(), dimension


def test_dimensions_are_four_independent_and_unique() -> None:
    assert len(BUDGET_DIMENSIONS) == 4
    assert len(set(BUDGET_DIMENSIONS)) == 4
    env_keys = list(DIM_ENV_KEYS.values())
    assert len(set(env_keys)) == len(env_keys), "四维 env 键不得撞名"


# ② 默认不配即不拦
# ===========================================================================


@pytest.mark.parametrize("dimension", BUDGET_DIMENSIONS)
def test_unset_dimension_never_blocks(dimension: str) -> None:
    """未配置(0)⇒ 该维放行且 reason 如实标 dim_disabled,不写 any 计数。"""
    gov = _gov()
    if dimension in ACCUMULATING_DIMENSIONS:
        res = gov.consume_mcp_tokens("run-default", 10**9)
    elif dimension == DIM_CUSTOM_PROMPT_TOKEN_LIMIT:
        res = gov.check_custom_prompt("提示词" * 10**4)
    else:
        res = _THRESHOLD_CHECKS[dimension](gov, 10**9)
    assert res.allowed is True, res.reason
    assert res.error_type is None
    assert res.reason == REASON_DIM_DISABLED
    assert res.dimension == dimension
    assert res.limits[dimension] == 0
    assert gov.dim_state("run-default")["used"][dimension] == 0


# ③ 每维正反对照:未超放行 / 超限具名拒绝
# ===========================================================================


@pytest.mark.parametrize("dimension", list(_THRESHOLD_CHECKS))
def test_threshold_dims_positive_and_negative(dimension: str) -> None:
    limit = 40
    gov = _gov(**{dimension: limit})
    check = _THRESHOLD_CHECKS[dimension]

    for measured, expected_allowed in ((0, True), (limit, True), (limit + 1, False)):
        res = check(gov, measured)
        assert res.allowed is expected_allowed, (dimension, measured, res.reason)
        assert res.used[dimension] == measured
        assert res.limits[dimension] == limit
        assert res.dimension == dimension
        if expected_allowed:
            assert res.error_type is None
            assert res.reason == REASON_OK
        else:
            assert res.error_type == BUDGET_EXCEEDED
            # 具名拒绝三要素:维度名 + 实测值 + 上限值
            assert dimension in res.reason
            assert str(measured) in res.reason
            assert str(limit) in res.reason


def test_mcp_token_bucket_positive_and_negative() -> None:
    limit = 1000
    gov = _gov(**{DIM_MCP_TOKEN_LIMIT: limit})

    first = gov.consume_mcp_tokens("r", 600, tool_name="mcp:a")
    assert first.allowed is True and first.used[DIM_MCP_TOKEN_LIMIT] == 600
    second = gov.consume_mcp_tokens("r", 400)
    assert second.allowed is True and second.used[DIM_MCP_TOKEN_LIMIT] == 1000
    assert second.reason == REASON_OK

    over = gov.consume_mcp_tokens("r", 1)
    assert over.allowed is False
    assert over.error_type == BUDGET_EXCEEDED
    assert over.dimension == DIM_MCP_TOKEN_LIMIT
    assert DIM_MCP_TOKEN_LIMIT in over.reason
    assert "1001" in over.reason and str(limit) in over.reason
    # 被拒的本次不得污染已用量(不静默截断成上限)
    assert gov.dim_state("r")["used"][DIM_MCP_TOKEN_LIMIT] == limit

    assert gov.refund_mcp_tokens("r", 600) == 400
    assert gov.consume_mcp_tokens("r", 600).allowed is True
    assert gov.dim_state("r")["used"][DIM_MCP_TOKEN_LIMIT] == 1000
    assert gov.dim_state("r")["remaining"][DIM_MCP_TOKEN_LIMIT] == 0


def test_mcp_token_bucket_is_per_run() -> None:
    gov = _gov(**{DIM_MCP_TOKEN_LIMIT: 100})
    assert gov.consume_mcp_tokens("run-a", 100).allowed is True
    assert gov.consume_mcp_tokens("run-a", 1).allowed is False
    assert gov.consume_mcp_tokens("run-b", 100).allowed is True
    assert gov.dim_state("run-a")["used"][DIM_MCP_TOKEN_LIMIT] == 100
    assert gov.dim_state("run-b")["used"][DIM_MCP_TOKEN_LIMIT] == 100
    gov.reset("run-a")
    assert gov.dim_state("run-a")["used"][DIM_MCP_TOKEN_LIMIT] == 0


def test_custom_prompt_uses_the_module_estimator() -> None:
    prompt = "请用中文回复,including some English words."
    measured = estimate_tokens(prompt)
    gov = _gov(**{DIM_CUSTOM_PROMPT_TOKEN_LIMIT: measured})
    assert gov.check_custom_prompt(prompt).allowed is True
    over = _gov(**{DIM_CUSTOM_PROMPT_TOKEN_LIMIT: measured - 1}).check_custom_prompt(prompt)
    assert over.allowed is False
    assert over.used[DIM_CUSTOM_PROMPT_TOKEN_LIMIT] == measured
    assert DIM_CUSTOM_PROMPT_TOKEN_LIMIT in over.reason
    assert str(measured) in over.reason and str(measured - 1) in over.reason


def test_estimate_tokens_documented_quantity() -> None:
    """量法如实:CJK 1 token/字,其余 4 字符 ≈ 1 token 向上取整(估算,非某家 tokenizer)。"""
    assert estimate_tokens("") == 0
    assert estimate_tokens("a") == 1
    assert estimate_tokens("abcd") == 1
    assert estimate_tokens("abcde") == 2
    assert estimate_tokens("积分") == 2
    assert estimate_tokens("积分 ab") == 3


# ④ 失效方向 = 多要一次定向说明,绝不静默放行
# ===========================================================================


def test_unknown_dimension_raises_instead_of_allowing() -> None:
    gov = _gov()
    with pytest.raises(ValueError) as exc:
        gov.check_dim("nonexistent_dimension", 1)
    message = str(exc.value)
    assert "nonexistent_dimension" in message
    for dimension in BUDGET_DIMENSIONS:
        assert dimension in message, "未知维度必须点名全部合法维度,便于定向说明"
    with pytest.raises(KeyError):
        ToolBudgetConfig().dim_limit("nonexistent_dimension")


def test_accumulating_dim_cannot_be_checked_statelessly() -> None:
    """同一维两条消耗通道必然漂移(§0.6):累加维走 check_dim 直接拒。"""
    gov = _gov(**{DIM_MCP_TOKEN_LIMIT: 10})
    with pytest.raises(ValueError, match="consume_mcp_tokens"):
        gov.check_dim(DIM_MCP_TOKEN_LIMIT, 5)


def test_negative_inputs_are_named_not_clamped() -> None:
    with pytest.raises(ValueError) as exc:
        ToolBudgetConfig(**{DIM_HISTORY_QUERY_LIMIT: -1})
    assert DIM_HISTORY_QUERY_LIMIT in str(exc.value)
    gov = _gov(**{DIM_HISTORY_QUERY_LIMIT: 10})
    with pytest.raises(ValueError, match="不得为负"):
        gov.check_history_query(-1)
    # 令牌桶开起来才谈 run_id:桶关时恒放行,不会走到 run_id 校验
    bucket = _gov(**{DIM_MCP_TOKEN_LIMIT: 10})
    with pytest.raises(ValueError, match="run_id"):
        bucket.consume_mcp_tokens("", 1)


# ⑤ run 循环维回归:既有语义与投影形状一字未动
# ===========================================================================


def test_run_loop_dims_ignore_new_dimensions() -> None:
    """四维开而 enabled=False ⇒ acquire 仍按「预算未启用」恒放行、零计数(零行为差异)。"""
    gov = _gov(
        **dict.fromkeys(BUDGET_DIMENSIONS, 1),
    )
    res = gov.acquire("r", tool_name="write_file", cost_estimate=9999.0)
    assert res.allowed is True
    assert res.reason == REASON_DISABLED
    assert res.dimension == ""
    state = gov.get_state("r")
    assert state["used"] == {"tool_count": 0, "cost": 0.0, "active": 0}
    assert set(state["remaining"]) == {"tools", "cost"}


def test_run_loop_limits_still_enforced_and_projected() -> None:
    gov = ToolBudgetGovernor(
        ToolBudgetConfig(enabled=True, max_tools_per_run=2, **{DIM_MCP_TOOL_LIMIT: 40})
    )
    for i in range(2):
        assert gov.acquire("r", tool_name=f"t{i}").allowed is True
        gov.release("r")
    res = gov.acquire("r", tool_name="t2")
    assert res.allowed is False
    assert res.error_type == BUDGET_EXCEEDED
    assert "次数超限" in res.reason  # 既有文案未改
    assert res.limits["max_tools"] == 2  # 既有投影键未删
    assert res.limits[DIM_MCP_TOOL_LIMIT] == 40  # 新维度同时带出


def test_limits_projection_carries_four_dims_without_dropping_old_keys() -> None:
    gov = _gov(**{dimension: index + 1 for index, dimension in enumerate(BUDGET_DIMENSIONS)})
    limits = gov.get_state("r")["limits"]
    for legacy in ("max_tools", "max_cost", "max_concurrency"):
        assert legacy in limits, f"既有投影键 {legacy} 被删 ⇒ 上层呈现会静默降级"
    for index, dimension in enumerate(BUDGET_DIMENSIONS):
        assert limits[dimension] == index + 1
    state = gov.dim_state("r")
    assert state["open_dimensions"] == list(BUDGET_DIMENSIONS)
    assert state["accumulating_dimensions"] == list(ACCUMULATING_DIMENSIONS)
    # 关闭维的 remaining = None(不设限),不用 0 冒充「已用尽」
    closed = ToolBudgetGovernor().dim_state("r")
    assert all(closed["remaining"][d] is None for d in BUDGET_DIMENSIONS)


# ⑥ env 装配(from_env)
# ===========================================================================


def test_from_env_maps_env_keys_to_dimensions() -> None:
    cfg = ToolBudgetConfig.from_env(
        {
            DIM_ENV_KEYS[DIM_MCP_TOOL_LIMIT]: "40",
            DIM_ENV_KEYS[DIM_MCP_TOKEN_LIMIT]: "8000",
            DIM_ENV_KEYS[DIM_CUSTOM_PROMPT_TOKEN_LIMIT]: "10000",
            DIM_ENV_KEYS[DIM_HISTORY_QUERY_LIMIT]: "300",
        }
    )
    assert cfg.mcp_tool_limit == 40
    assert cfg.mcp_token_limit == 8000
    assert cfg.custom_prompt_token_limit == 10000
    assert cfg.history_query_limit == 300
    # env 只装分维,绝不顺手打开 run 循环门
    assert cfg.enabled is False
    assert cfg.max_tools_per_run == ToolBudgetConfig().max_tools_per_run
    assert cfg.max_cost_per_run_usd == ToolBudgetConfig().max_cost_per_run_usd
    assert cfg.max_concurrency == ToolBudgetConfig().max_concurrency


def test_from_env_unset_and_illegal_values_close_the_dimension() -> None:
    empty = ToolBudgetConfig.from_env({})
    assert all(getattr(empty, dimension) == 0 for dimension in BUDGET_DIMENSIONS)
    junk = ToolBudgetConfig.from_env(
        {
            DIM_ENV_KEYS[DIM_MCP_TOOL_LIMIT]: "abc",
            DIM_ENV_KEYS[DIM_MCP_TOKEN_LIMIT]: "-5",
            DIM_ENV_KEYS[DIM_CUSTOM_PROMPT_TOKEN_LIMIT]: " 60 ",
            DIM_ENV_KEYS[DIM_HISTORY_QUERY_LIMIT]: "",
        }
    )
    assert junk.mcp_tool_limit == 0  # 非法整数 ⇒ 关闭(不猜上限)
    assert junk.mcp_token_limit == 0  # 负数 ⇒ 关闭
    assert junk.custom_prompt_token_limit == 60  # 容忍空白
    assert junk.history_query_limit == 0


# ⑦ 超越轴:四维必须进了 capability_matrix 台账(可被守门 diff)
# ===========================================================================


def test_four_dimensions_are_registered_in_capability_ledger() -> None:
    rows = {row["env"]: row for row in CAPABILITY_MATRIX}
    for dimension in BUDGET_DIMENSIONS:
        env_key = DIM_ENV_KEYS[dimension]
        assert env_key in rows, f"{dimension} 的 env {env_key} 未登记进 capability_matrix.py"
        row = rows[env_key]
        assert row["default"] == "0", f"{env_key} 的 default 必须如实登记 0(未配即不拦)"
        assert row["owner_module"] == "app.services.tool_budget_governor", env_key
        assert env_key in row["doc_ref"], (
            f"{env_key} 的 doc_ref 必须指向唯一读取点,实际 {row['doc_ref']}"
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

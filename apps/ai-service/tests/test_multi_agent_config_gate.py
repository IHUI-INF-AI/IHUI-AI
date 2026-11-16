# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""multi_agent_config_gate 判据测试 —— 三段约束 + spawn 准入 + 反向变异。"""

from __future__ import annotations

from app.core.multi_agent_config_gate import (
    CODEX_ERR_AGENT_ALREADY_CLOSED,
    CODEX_ERR_CONCURRENCY_AT_LEAST_ONE,
    CODEX_ERR_DEFAULT_ABOVE_MAX,
    CODEX_ERR_DEFAULT_BELOW_MIN,
    CODEX_ERR_DEPTH_LIMIT,
    CODEX_ERR_INVALID_AGENT_ID,
    MultiAgentConfig,
    admit_spawn,
    validate_multi_agent_config,
)


def _cfg(**kw):
    base = {
        "min_wait_timeout_ms": 1000,
        "max_wait_timeout_ms": 60000,
        "default_wait_timeout_ms": 30000,
        "max_concurrent_threads_per_session": 5,
    }
    base.update(kw)
    return MultiAgentConfig(**base)


def test_valid_config_no_violation():
    assert validate_multi_agent_config(_cfg()) == ()


def test_default_below_min():
    v = validate_multi_agent_config(_cfg(default_wait_timeout_ms=500))
    assert len(v) == 1 and v[0].codex_error == CODEX_ERR_DEFAULT_BELOW_MIN


def test_default_above_max():
    v = validate_multi_agent_config(_cfg(default_wait_timeout_ms=99999))
    assert len(v) == 1 and v[0].codex_error == CODEX_ERR_DEFAULT_ABOVE_MAX


def test_concurrency_below_one():
    v = validate_multi_agent_config(_cfg(max_concurrent_threads_per_session=0))
    assert v[0].codex_error == CODEX_ERR_CONCURRENCY_AT_LEAST_ONE


def test_reports_all_violations_not_failfast():
    """超越轴：default 同时越下界、并发=0 ⇒ 一次报 2 条（对照 fail-fast 只报首条）。"""
    v = validate_multi_agent_config(
        _cfg(default_wait_timeout_ms=500, max_concurrent_threads_per_session=0)
    )
    assert len(v) == 2
    errs = {x.codex_error for x in v}
    assert CODEX_ERR_DEFAULT_BELOW_MIN in errs
    assert CODEX_ERR_CONCURRENCY_AT_LEAST_ONE in errs


def test_default_equal_bounds_ok():
    assert validate_multi_agent_config(_cfg(default_wait_timeout_ms=1000)) == ()
    assert validate_multi_agent_config(_cfg(default_wait_timeout_ms=60000)) == ()


def test_depth_limit_denies():
    a = admit_spawn(current_depth=2, max_depth=2, agent_id="a1", agent_closed=False)
    assert not a.allowed and a.codex_error == CODEX_ERR_DEPTH_LIMIT
    assert "Solve the task yourself." in (a.codex_error or "")


def test_depth_below_limit_admits():
    a = admit_spawn(current_depth=1, max_depth=2, agent_id="a1", agent_closed=False)
    assert a.allowed


def test_invalid_agent_id_denies():
    for bad in (None, "", "   "):
        a = admit_spawn(current_depth=0, max_depth=2, agent_id=bad, agent_closed=False)
        assert not a.allowed and a.codex_error == CODEX_ERR_INVALID_AGENT_ID


def test_resume_closed_agent_denies():
    a = admit_spawn(current_depth=0, max_depth=2, agent_id="a1", agent_closed=True)
    assert not a.allowed and a.codex_error == CODEX_ERR_AGENT_ALREADY_CLOSED


def test_depth_takes_priority():
    """深度超限优先于 agent id 非法。"""
    a = admit_spawn(current_depth=5, max_depth=2, agent_id=None, agent_closed=True)
    assert a.codex_error == CODEX_ERR_DEPTH_LIMIT


# —— 反向变异 ——
def test_mutation_default_bounds_swapped():
    """若把 default<=max 判据删掉，default 超上界必须仍报 ABOVE_MAX。"""
    v = validate_multi_agent_config(_cfg(default_wait_timeout_ms=99999))
    assert CODEX_ERR_DEFAULT_ABOVE_MAX in {x.codex_error for x in v}


def test_mutation_depth_off_by_one():
    """若 depth 判据写成 > 而非 >=，边界 depth==max 必须仍拒绝。"""
    a = admit_spawn(current_depth=2, max_depth=2, agent_id="a1", agent_closed=False)
    assert not a.allowed
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

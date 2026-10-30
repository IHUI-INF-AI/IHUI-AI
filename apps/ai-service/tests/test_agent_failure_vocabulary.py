# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""失败结局二分 + 停摆位置词表的 Python 侧钉子(2026-10-31 立,§30 一等契约)。

三层各钉一格,缺一格就是"造好没装车"(AGENTS §0.9):
① 同语言闭合:StrEnum 成员 ≡ ``*_VALUES`` 字面量总表(供静态解析的那一份),
   改任何一侧必须同笔 —— 与 ``tests/test_turn_stop_reason_closure.py`` 同一纪律;
② 判据正反成对:登记过的族各判自己那一档(正向对照),认不出的族必须落
   ``undetermined`` 而**不是** ``terminal``(反向对照,§0.3 取不到不冒绿也不冒红);
③ 现场与接线:每档停摆位置的登记文件/锚点现读存在(凭空造词即红),
   且生产链路真的在消费本词表(agent_loop_v2 的 retry 闸取源、审计两键、done 帧两键)。

跨语言成员集合等值**不在本文件判** —— 那份对账只住在
``packages/types/tests/agent-failure-vocabulary.test.ts`` 一处(§0.6 单一真相源,
第二份判据必然漂移)。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.agent_failure_vocabulary import (
    AGENT_FAILURE_OUTCOME_VALUES,
    AGENT_RETRYABLE_ERROR_FAMILIES,
    AGENT_STALL_STAGE_VALUES,
    AGENT_TERMINAL_ERROR_FAMILIES,
    AgentFailureOutcome,
    AgentStallStage,
    AgentStallStageError,
    agent_failure_outcome_of,
    ensure_agent_stall_stage,
    failure_signal,
    is_agent_failure_outcome_judged,
    normalize_agent_failure_outcome,
    normalize_agent_stall_stage,
    stall_stage_for_error_family,
    stall_stage_site,
)

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
LOOP = REPO_ROOT / "apps" / "ai-service" / "app" / "services" / "agent_loop_v2.py"
ROUTER = REPO_ROOT / "apps" / "ai-service" / "app" / "routers" / "agents.py"


# ---- ① 同语言闭合 ----


def test_enum_members_equal_literal_table_in_order():
    assert tuple(m.value for m in AgentFailureOutcome) == AGENT_FAILURE_OUTCOME_VALUES
    assert tuple(m.value for m in AgentStallStage) == AGENT_STALL_STAGE_VALUES


def test_literal_tables_have_no_duplicates_and_are_str():
    assert len(set(AGENT_FAILURE_OUTCOME_VALUES)) == len(AGENT_FAILURE_OUTCOME_VALUES)
    assert len(set(AGENT_STALL_STAGE_VALUES)) == len(AGENT_STALL_STAGE_VALUES)
    assert all(isinstance(v, str) for v in AGENT_STALL_STAGE_VALUES)


def test_wire_value_is_the_member_value():
    assert AgentFailureOutcome.UNDETERMINED == "undetermined"
    assert AgentStallStage.LLM_REQUEST == "llm_request"
    assert str(AgentStallStage.DOOM_LOOP_GUARD) == "doom_loop_guard"


def test_retryable_and_terminal_families_are_disjoint():
    """两桶交集为空;并了等于把"能不能重试"折回一个布尔。"""
    assert set(AGENT_RETRYABLE_ERROR_FAMILIES).isdisjoint(AGENT_TERMINAL_ERROR_FAMILIES)


def test_undetermined_is_in_neither_family_bucket():
    assert "undetermined" not in AGENT_RETRYABLE_ERROR_FAMILIES
    assert "undetermined" not in AGENT_TERMINAL_ERROR_FAMILIES
    assert is_agent_failure_outcome_judged("undetermined") is False
    assert is_agent_failure_outcome_judged("retryable") is True
    # 反向锁:未知值不许被读成"已判定"
    assert is_agent_failure_outcome_judged("probably_retryable") is False
    assert is_agent_failure_outcome_judged(None) is False


# ---- ② 判据正反成对 ----


@pytest.mark.parametrize("family", list(AGENT_RETRYABLE_ERROR_FAMILIES))
def test_retryable_families_judge_retryable(family: str):
    assert agent_failure_outcome_of(family) == "retryable"


@pytest.mark.parametrize("family", list(AGENT_TERMINAL_ERROR_FAMILIES))
def test_terminal_families_judge_terminal(family: str):
    assert agent_failure_outcome_of(family) == "terminal"


@pytest.mark.parametrize("family", ["unknown", "", "provider_pipe_broken", None, 42, b"timeout"])
def test_unjudged_families_land_undetermined_never_terminal(family: object):
    """本模块与"二分"的差别就在这一格:未登记**不等于**不可重试。"""
    assert agent_failure_outcome_of(family) == "undetermined"


def test_normalizers_are_fail_closed():
    assert normalize_agent_failure_outcome("terminal") == "terminal"
    assert normalize_agent_failure_outcome("failed") is None
    assert normalize_agent_failure_outcome(None) is None
    assert normalize_agent_stall_stage("approval_wait") == "approval_wait"
    assert normalize_agent_stall_stage("somewhere_else") is None


def test_only_self_describing_family_carries_a_stage():
    """环节由现场显式传入;只有 approval_timeout 自带环节,余下一律 undetermined。"""
    assert stall_stage_for_error_family("approval_timeout") == "approval_wait"
    assert stall_stage_for_error_family("timeout") == "undetermined"
    assert stall_stage_for_error_family(None) == "undetermined"


def test_ensure_rejects_unregistered_stage_and_names_it():
    for value in list(AGENT_STALL_STAGE_VALUES):
        assert ensure_agent_stall_stage(value) == value
    with pytest.raises(AgentStallStageError) as ei:
        ensure_agent_stall_stage("stuck_in_sandbox")
    msg = str(ei.value)
    assert "stuck_in_sandbox" in msg and "AgentStallStage" in msg
    with pytest.raises(AgentStallStageError):
        ensure_agent_stall_stage(None)


def test_success_carries_no_failure_claim():
    """成功回合两键皆 None:缺席不是 retryable,更不是 terminal。"""
    assert failure_signal(success=True, last_error_family="timeout") == {
        "failure_outcome": None,
        "stall_stage": None,
    }


def test_failure_signal_without_family_stays_undetermined():
    got = failure_signal(success=False, last_error_family=None)
    assert got["failure_outcome"] == "undetermined"
    assert got["stall_stage"] == "undetermined"


def test_failure_signal_from_tool_family_picks_tool_execution():
    got = failure_signal(success=False, last_error_family="timeout")
    assert got == {"failure_outcome": "retryable", "stall_stage": "tool_execution"}


def test_failure_signal_explicit_stage_wins_and_is_validated():
    got = failure_signal(
        success=False,
        last_error_family="http_5xx",
        stall_stage=AgentStallStage.STREAM_CHANNEL.value,
    )
    assert got == {"failure_outcome": "retryable", "stall_stage": "stream_channel"}
    with pytest.raises(AgentStallStageError):
        failure_signal(success=False, last_error_family="http_5xx", stall_stage="nope")


# ---- ③ 现场与接线 ----


def test_every_stage_except_undetermined_has_a_live_site():
    for stage in AGENT_STALL_STAGE_VALUES:
        if stage == "undetermined":
            assert stall_stage_site(stage) is None
            continue
        site = stall_stage_site(stage)
        assert site is not None, f"{stage} 没有登记现场 —— 凭空造词"
        rel_file, anchor = site
        path = REPO_ROOT / rel_file
        assert path.is_file(), f"{stage} 的现场文件不在:{rel_file}(搬家须同批改表)"
        assert anchor in path.read_text(encoding="utf-8"), (
            f"{stage} 的锚点 {anchor} 不在 {rel_file} 里 —— 该环节已无人产出"
        )


def test_retry_gate_takes_the_family_list_from_the_vocabulary():
    """retry 闸不再自带字面量 —— 词表没被消费就等于没装车(§0.9)。"""
    src = LOOP.read_text(encoding="utf-8")
    assert "frozenset(RETRYABLE_ERROR_FAMILY_SET)" in src, (
        "agent_loop_v2 的 _TOOL_RETRYABLE_ERRORS 退回本地字面量了"
    )
    assert '"timeout", "connection", "http_5xx"' not in src


def test_error_reporting_and_done_frame_emit_both_keys():
    loop_src = LOOP.read_text(encoding="utf-8")
    assert '"failure_outcome": _agent_failure_outcome_of(error_type)' in loop_src
    assert '"stall_stage": _ensure_agent_stall_stage(' in loop_src
    assert '"stall_stage": _AgentStallStage.LLM_REQUEST.value' in loop_src
    router_src = ROUTER.read_text(encoding="utf-8")
    assert "_failure_signal(" in router_src, "done 帧没接词表 ⇒ 消费面断线"
    assert '"failure_outcome": _failure_keys["failure_outcome"]' in router_src
    assert '"stall_stage": _failure_keys["stall_stage"]' in router_src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""turn_phase_advance 判据测试 —— 逐字错误锚 + 三档前进 + 反向变异。"""

from __future__ import annotations

import pytest

from app.core.turn_phase_advance import (
    CODEX_ERR_CONTINUING,
    CODEX_ERR_ENDING_EARLY,
    CODEX_ERR_HALTING,
    OrchestratorActionKind,
    OrchestratorStopPoint,
    TurnPhase,
    advance_orchestrator,
    task_phase_order,
)


def _adv(**kw):
    base = {
        "phase": TurnPhase.REGULAR_TASK_START,
        "task_registered": True,
        "stop_point": OrchestratorStopPoint.NONE,
        "fatal_error": False,
    }
    base.update(kw)
    return advance_orchestrator(**base)


def test_no_error_no_stop_continues():
    a = _adv()
    assert a.kind is OrchestratorActionKind.CONTINUING
    assert a.codex_error == CODEX_ERR_CONTINUING


def test_non_fatal_after_registration_continues():
    a = _adv(fatal_error=False)
    assert a.kind is OrchestratorActionKind.CONTINUING


def test_fatal_after_transmit_halts():
    a = _adv(phase=TurnPhase.TRANSMIT, fatal_error=True)
    assert a.kind is OrchestratorActionKind.HALTING
    assert a.codex_error == CODEX_ERR_HALTING


def test_fatal_before_transmit_ends_early():
    a = _adv(phase=TurnPhase.REGULAR_TASK_START, fatal_error=True)
    assert a.kind is OrchestratorActionKind.ENDING_EARLY
    assert a.codex_error == CODEX_ERR_ENDING_EARLY


def test_stop_point_before_transmit_ends_early_without_fatal():
    a = _adv(stop_point=OrchestratorStopPoint.BEFORE_TRANSMIT, fatal_error=False)
    assert a.kind is OrchestratorActionKind.ENDING_EARLY
    assert a.codex_error == CODEX_ERR_ENDING_EARLY


def test_fatal_takes_priority_over_stop_point():
    a = _adv(phase=TurnPhase.TRANSMIT, fatal_error=True,
             stop_point=OrchestratorStopPoint.BEFORE_TRANSMIT)
    assert a.kind is OrchestratorActionKind.HALTING


def test_ending_early_codex_anchor_exact():
    a = _adv(stop_point=OrchestratorStopPoint.BEFORE_TRANSMIT)
    assert "`BeforeTransmit`" in (a.codex_error or "")


def test_phase_order_main_chain():
    order = task_phase_order()
    assert order[0] is TurnPhase.TASK_START
    assert order[-1] is TurnPhase.TRANSMIT
    assert TurnPhase.CUSTOM_CA not in order
    assert TurnPhase.EXPLICIT_TLS not in order


@pytest.mark.parametrize("bad_kind", ["continuing", "halting", "ending_early"])
def test_action_kind_is_exact_string(bad_kind):
    assert OrchestratorActionKind(bad_kind).value == bad_kind


# —— 反向变异：把判据写错，测试必须转红 ——
def test_mutation_halt_vs_endearly_swapped():
    """若把「transmit 前后」分野抹掉（致命一律 HALTING），ENDING_EARLY 分支失守。"""
    a = _adv(phase=TurnPhase.TASK_START, fatal_error=True)
    # 正确判据：未 transmit ⇒ ENDING_EARLY（不是 HALTING）
    assert a.kind is not OrchestratorActionKind.HALTING


def test_mutation_stop_point_ignored():
    """若忽略 stop point（无致命就 CONTINUING），ENDING_EARLY 分支失守。"""
    a = _adv(stop_point=OrchestratorStopPoint.BEFORE_TRANSMIT, fatal_error=False)
    assert a.kind is OrchestratorActionKind.ENDING_EARLY
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

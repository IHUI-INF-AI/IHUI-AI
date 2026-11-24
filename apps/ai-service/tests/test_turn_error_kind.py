# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""turn_error_kind 判据测试 —— 六值封闭集 + 优先级链 + 反向变异。"""

from __future__ import annotations

from app.core.turn_error_kind import (
    CODEX_ERR_BUDGET_REACHED,
    CODEX_ERR_STREAM_DISCONNECTED,
    CODEX_KIND_MISALIGNMENT,
    TurnErrorKind,
    classify_turn_error,
)


def _cls(**kw):
    base = {
        "interrupted": False, "shutdown": False, "not_found": False,
        "misaligned": False, "still_running": False,
    }
    base.update(kw)
    return classify_turn_error(**base)


def test_six_kind_closed_set():
    assert len(set(TurnErrorKind)) == 6
    assert {k.value for k in TurnErrorKind} == {
        "running", "interrupted", "errored", "shutdown", "not_found", "misalignment",
    }


def test_interrupted_highest_priority():
    e = _cls(interrupted=True, shutdown=True, not_found=True, misaligned=True)
    assert e.kind is TurnErrorKind.INTERRUPTED


def test_not_found():
    e = _cls(not_found=True)
    assert e.kind is TurnErrorKind.NOT_FOUND


def test_shutdown():
    e = _cls(shutdown=True)
    assert e.kind is TurnErrorKind.SHUTDOWN


def test_misalignment_explicit():
    e = _cls(misaligned=True)
    assert e.kind is TurnErrorKind.MISALIGNMENT
    assert e.kind.value == CODEX_KIND_MISALIGNMENT
    assert e.codex_error_info is not None


def test_still_running():
    e = _cls(still_running=True)
    assert e.kind is TurnErrorKind.RUNNING


def test_default_errored():
    e = _cls()
    assert e.kind is TurnErrorKind.ERRORED


def test_misalignment_driven_by_flag_not_details():
    """Misalignment 由 misaligned 显式驱动，非靠「有无明细」猜。"""
    e = _cls(misaligned=True, still_running=True)
    assert e.kind is TurnErrorKind.MISALIGNMENT


def test_errored_subcauses_documented():
    """errored 的两个已知子因（budget/stream 断开）逐字锚在案。"""
    assert "stream disconnected" in CODEX_ERR_STREAM_DISCONNECTED
    assert "budget" in CODEX_ERR_BUDGET_REACHED


# —— 反向变异 ——
def test_mutation_misalignment_conflated_with_errored():
    """若把 MISALIGNMENT 并入 ERRORED，misaligned=True 必须仍判 MISALIGNMENT。"""
    e = _cls(misaligned=True)
    assert e.kind is not TurnErrorKind.ERRORED


def test_mutation_interrupted_not_priority():
    """若中断不最优先，interrupted+shutdown 必须仍判 INTERRUPTED。"""
    e = _cls(interrupted=True, shutdown=True)
    assert e.kind is TurnErrorKind.INTERRUPTED
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""reasoning_channel 测试（R27）——推理摘要通道形态封闭集。

含反向变异：封闭集漂移 / final_answer 被回退 / 未知值误升级，均须转红。
"""

from __future__ import annotations

from app.core.reasoning_channel import (
    ReasoningChannel,
    advance_phase,
    is_discardable,
    is_final_answer,
)


# --- 封闭集 -------------------------------------------------------------------
def test_channel_closed_set():
    """三档逐字对照协议层 phase 封闭集。"""
    assert {c.value for c in ReasoningChannel} == {
        "commentary",
        "partial_answer",
        "final_answer",
    }


# --- is_final_answer ----------------------------------------------------------
def test_final_answer_is_final():
    assert is_final_answer(ReasoningChannel.FINAL_ANSWER) is True


def test_partial_answer_not_final():
    assert is_final_answer(ReasoningChannel.PARTIAL_ANSWER) is False


def test_commentary_not_final():
    assert is_final_answer(ReasoningChannel.COMMENTARY) is False


def test_is_final_accepts_bare_string():
    """接受裸字符串（防调用方传未包装字面量）。"""
    assert is_final_answer("final_answer") is True


def test_is_final_unknown_string_false():
    """未知字符串不误判为最终答案。"""
    assert is_final_answer("weird") is False


# --- is_discardable -----------------------------------------------------------
def test_commentary_discardable():
    assert is_discardable(ReasoningChannel.COMMENTARY) is True


def test_partial_answer_not_discardable():
    assert is_discardable(ReasoningChannel.PARTIAL_ANSWER) is False


def test_final_answer_not_discardable():
    assert is_discardable(ReasoningChannel.FINAL_ANSWER) is False


def test_is_discardable_unknown_true():
    """未知字符串按可丢弃处理（保守，不误当答案保留）。"""
    assert is_discardable("weird") is True


# --- advance_phase ------------------------------------------------------------
def test_advance_commentary_to_partial():
    assert advance_phase("commentary", "partial_answer") is ReasoningChannel.PARTIAL_ANSWER


def test_advance_to_final():
    assert advance_phase("partial_answer", "final_answer") is ReasoningChannel.FINAL_ANSWER


def test_advance_final_irreversible():
    """final_answer 终态不可被 commentary 回退。"""
    assert advance_phase("final_answer", "commentary") is ReasoningChannel.FINAL_ANSWER


def test_advance_final_partial_stays_final():
    """final_answer 之后来 partial_answer 仍保持 final。"""
    assert advance_phase("final_answer", "partial_answer") is ReasoningChannel.FINAL_ANSWER


def test_advance_unknown_incoming_normalizes_commentary():
    """未知 incoming 归一化为 commentary（保守，不误升级）。"""
    assert advance_phase("partial_answer", "weird") is ReasoningChannel.COMMENTARY


# --- 反向变异 -----------------------------------------------------------------
def test_reverse_closed_set_drift():
    """反向变异：若封闭集漏掉 partial_answer 须转红。"""
    assert "partial_answer" in {c.value for c in ReasoningChannel}


def test_reverse_final_reversible():
    """反向变异：若 advance 让 final 被 commentary 回退须转红。"""
    assert advance_phase("final_answer", "commentary") is not ReasoningChannel.COMMENTARY


def test_reverse_unknown_upgraded():
    """反向变异：未知 incoming 若被误升级为 final 须转红。"""
    assert advance_phase("commentary", "weird") is not ReasoningChannel.FINAL_ANSWER


def test_channel_is_str_enum():
    """ReasoningChannel 是 StrEnum（值可直接当字符串比较）。"""
    assert ReasoningChannel.FINAL_ANSWER == "final_answer"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

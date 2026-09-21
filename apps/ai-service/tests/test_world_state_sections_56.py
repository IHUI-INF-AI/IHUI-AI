# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批 56：world_state_sections 测试(对标 codex model/guidance/token_budget)。

覆盖: ModelInstructionsState 三分支、ContextWindowGuidanceState 四分支(含
REPLACEMENT/REMOVAL 逐字断言)、TokenBudgetRemainingContext 两文案、
ContextWindowSection diff。
"""

from __future__ import annotations

from app.core.world_state_sections import (
    CONTEXT_WINDOW_CLOSE_TAG,
    CONTEXT_WINDOW_GUIDANCE_CLOSE_TAG,
    CONTEXT_WINDOW_GUIDANCE_OPEN_TAG,
    CONTEXT_WINDOW_OPEN_TAG,
    MODEL_SWITCH_CLOSE_TAG,
    MODEL_SWITCH_OPEN_TAG,
    REMOVAL_NOTICE,
    REPLACEMENT_NOTICE,
    ContextWindowGuidanceState,
    ContextWindowSection,
    ModelInstructionsState,
    PreviousSectionState,
    TokenBudgetRemainingContext,
)


def _body_of(fragment):
    return fragment["content"][0]["text"]


def _strip(body, open_tag, close_tag):
    assert body.startswith(open_tag)
    assert body.endswith(close_tag)
    return body[len(open_tag) : -len(close_tag)]


# ModelInstructionsState 三分支 -------------------------------------------------
def test_model_switch_known_different_renders():
    state = ModelInstructionsState("gpt-new", "gpt-old", "use new model instructions")
    frag = state.render_diff(PreviousSectionState.known("gpt-old"))
    assert frag is not None
    inner = _strip(_body_of(frag), MODEL_SWITCH_OPEN_TAG, MODEL_SWITCH_CLOSE_TAG)
    assert inner == (
        "\nThe user was previously using a different model. "
        "Please continue the conversation according to the following instructions:\n\n"
        "use new model instructions\n"
    )
    assert frag["role"] == "developer"


def test_model_switch_known_same_no_render():
    state = ModelInstructionsState("gpt", "gpt", "instructions")
    assert state.render_diff(PreviousSectionState.known("gpt")) is None


def test_model_switch_unknown_with_previous_model_renders():
    state = ModelInstructionsState("gpt-new", "gpt-old", "switch now")
    frag = state.render_diff(PreviousSectionState.unknown())
    assert frag is not None
    inner = _strip(_body_of(frag), MODEL_SWITCH_OPEN_TAG, MODEL_SWITCH_CLOSE_TAG)
    assert "previously using a different model" in inner
    assert "switch now\n" in inner


def test_model_switch_absent_no_previous_model_no_render():
    state = ModelInstructionsState("gpt-new", None, "switch now")
    assert state.render_diff(PreviousSectionState.absent()) is None


def test_model_switch_empty_instructions_no_render():
    state = ModelInstructionsState("gpt-new", "gpt-old", "")
    assert state.render_diff(PreviousSectionState.known("gpt-old")) is None


# ContextWindowGuidanceState 四分支 ---------------------------------------------
def test_guidance_known_same_no_render():
    state = ContextWindowGuidanceState("keep guidance")
    assert state.render_diff(PreviousSectionState.known("keep guidance")) is None


def test_guidance_new_message_replacement_notice():
    state = ContextWindowGuidanceState("new guidance")
    frag = state.render_diff(PreviousSectionState.known("old guidance"))
    assert frag is not None
    inner = _strip(
        _body_of(frag), CONTEXT_WINDOW_GUIDANCE_OPEN_TAG, CONTEXT_WINDOW_GUIDANCE_CLOSE_TAG
    )
    assert inner == f"\n{REPLACEMENT_NOTICE}\n\nnew guidance\n"


def test_guidance_cleared_with_previous_removal_notice():
    state = ContextWindowGuidanceState("")
    frag = state.render_diff(PreviousSectionState.known("old guidance"))
    assert frag is not None
    inner = _strip(
        _body_of(frag), CONTEXT_WINDOW_GUIDANCE_OPEN_TAG, CONTEXT_WINDOW_GUIDANCE_CLOSE_TAG
    )
    assert inner == f"\n{REMOVAL_NOTICE}\n"


def test_guidance_cleared_absent_no_render():
    state = ContextWindowGuidanceState("")
    assert state.render_diff(PreviousSectionState.absent()) is None


def test_guidance_cleared_unknown_removal_notice():
    state = ContextWindowGuidanceState("")
    frag = state.render_diff(PreviousSectionState.unknown())
    assert frag is not None
    inner = _strip(
        _body_of(frag), CONTEXT_WINDOW_GUIDANCE_OPEN_TAG, CONTEXT_WINDOW_GUIDANCE_CLOSE_TAG
    )
    assert inner == f"\n{REMOVAL_NOTICE}\n"


def test_guidance_new_message_no_previous_renders_raw():
    state = ContextWindowGuidanceState("first guidance")
    frag = state.render_diff(PreviousSectionState.absent())
    assert frag is not None
    inner = _strip(
        _body_of(frag), CONTEXT_WINDOW_GUIDANCE_OPEN_TAG, CONTEXT_WINDOW_GUIDANCE_CLOSE_TAG
    )
    assert inner == "\nfirst guidance\n"


def test_guidance_whitespace_treated_as_empty():
    state = ContextWindowGuidanceState("   \n  ")
    assert state.message == ""


# TokenBudgetRemainingContext 两文案 --------------------------------------------
def test_remaining_tokens_known_count():
    frag = TokenBudgetRemainingContext(1234).render()
    assert frag["role"] == "developer"
    assert frag["content"][0]["text"] == "You have 1234 tokens left in this context window."


def test_remaining_tokens_unknown():
    frag = TokenBudgetRemainingContext(None).render()
    assert frag["content"][0]["text"] == (
        "You have unknown tokens left in this context window."
    )


# ContextWindowSection diff ----------------------------------------------------
def test_context_window_known_same_no_render():
    section = ContextWindowSection("agent", "w1", None, "w2", None)
    assert section.render_diff(PreviousSectionState.known("agent")) is None


def test_context_window_known_different_renders():
    section = ContextWindowSection("agent-b", "w1", "w0", "w2", None)
    frag = section.render_diff(PreviousSectionState.known("agent-a"))
    assert frag is not None
    inner = _strip(_body_of(frag), CONTEXT_WINDOW_OPEN_TAG, CONTEXT_WINDOW_CLOSE_TAG)
    assert inner == (
        "\nAgent name: agent-b\n"
        "First context window id: w1\n"
        "Current context window id: w2\n"
        "Previous context window id: w0\n"
    )


def test_context_window_with_thread_hint():
    section = ContextWindowSection("agent", "w1", None, "w2", "thread hint line")
    frag = section.render_diff(PreviousSectionState.known("other"))
    assert frag is not None
    inner = _strip(_body_of(frag), CONTEXT_WINDOW_OPEN_TAG, CONTEXT_WINDOW_CLOSE_TAG)
    assert "thread hint line" in inner
    assert "Previous context window id" not in inner


def test_context_window_absent_no_render():
    # codex: 仅 Known 且不同才渲染; Absent/Unknown 返回 None
    section = ContextWindowSection("agent", "w1", None, "w2", None)
    assert section.render_diff(PreviousSectionState.absent()) is None

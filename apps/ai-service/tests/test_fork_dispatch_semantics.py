# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Fork 派发语义测试（对标 Codex 26.1111 warm_fork 派发 + fork_turns 上下文传播）。

逐字锚来自 codex.exe 364.8MB 流式 strings 抽取，全部保真。
"""

from __future__ import annotations

import pytest

from app.core.fork_dispatch_semantics import (
    FORK_TURNS_ALL,
    FORK_TURNS_NONE,
    VERBATIM_EPHEMERAL_REQUIRE_PROMPT,
    VERBATIM_FULL_HISTORY_INHERIT_MODEL,
    VERBATIM_IMAGES_REQUIRE_PROMPT,
    VERBATIM_OUTPUT_OPTIONS_REQUIRE_PROMPT,
    VERBATIM_WORKTREE_DEV_INSTRUCTIONS_DIFFER,
    VERBATIM_WORKTREE_REQUIRES_SESSION_ID,
    ForkDispatch,
    ForkRequest,
    ForkVerdict,
    decide_fork,
    fork_turns_closed_set,
    is_full_history_fork,
    normalize_fork_turns,
)


def _minimal_ok() -> ForkRequest:
    """一个最简合法 fork 请求（有 prompt + fork_turns=all）。"""
    return ForkRequest(has_prompt=True, fork_turns=FORK_TURNS_ALL)


# ── 1. fork_turns 封闭集 + 归一化（可机检）─────────────────────────────────

def test_fork_turns_closed_set() -> None:
    assert fork_turns_closed_set() == frozenset({"all", "none"})


def test_normalize_fork_turns_none_means_all() -> None:
    assert normalize_fork_turns(None) == FORK_TURNS_ALL
    assert is_full_history_fork(None)


def test_normalize_fork_turns_rejects_invalid_string() -> None:
    with pytest.raises(ValueError, match="invalid fork_turns"):
        normalize_fork_turns("banana")


def test_normalize_fork_turns_rejects_negative() -> None:
    with pytest.raises(ValueError, match="non-negative"):
        normalize_fork_turns(-1)


def test_normalize_fork_turns_accepts_non_negative_int() -> None:
    assert normalize_fork_turns(0) == 0
    assert normalize_fork_turns(5) == 5
    assert not is_full_history_fork(5)


def test_normalize_fork_turns_rejects_bool() -> None:
    """bool 是 int 子类，显式排除防误用。"""
    with pytest.raises(ValueError, match="invalid fork_turns"):
        normalize_fork_turns(True)


# ── 2. OK：最简合法 fork → DISPATCH + IN_PROCESS ──────────────────────────

def test_minimal_fork_dispatches_in_process() -> None:
    d = decide_fork(_minimal_ok())
    assert d.verdict is ForkVerdict.DISPATCH
    assert d.dispatch_mode is ForkDispatch.IN_PROCESS
    assert d.ok
    assert d.rejections == ()
    assert d.context_propagation == FORK_TURNS_ALL


def test_disable_in_process_fallback_switches_to_out_of_process() -> None:
    d = decide_fork(
        ForkRequest(
            has_prompt=True,
            fork_turns=FORK_TURNS_NONE,
            disable_in_process_fallback=True,
        )
    )
    assert d.verdict is ForkVerdict.DISPATCH
    assert d.dispatch_mode is ForkDispatch.OUT_OF_PROCESS


# ── 3. worktree developer instructions 冲突 → REJECT ──────────────────────

def test_worktree_dev_instructions_differ_rejects() -> None:
    d = decide_fork(
        ForkRequest(
            has_prompt=True,
            worktree=True,
            has_explicit_session_id=True,
            developer_instructions_match=False,
        )
    )
    assert d.verdict is ForkVerdict.REJECT
    assert VERBATIM_WORKTREE_DEV_INSTRUCTIONS_DIFFER in d.rejections


# ── 4. worktree 无显式 session_id → REJECT ────────────────────────────────

def test_worktree_without_session_id_rejects() -> None:
    d = decide_fork(
        ForkRequest(
            has_prompt=True,
            worktree=True,
            has_explicit_session_id=False,
            developer_instructions_match=True,
        )
    )
    assert d.verdict is ForkVerdict.REJECT
    assert VERBATIM_WORKTREE_REQUIRES_SESSION_ID in d.rejections


# ── 5. images / ephemeral / output_options 无 prompt → REJECT ─────────────

def test_images_without_prompt_rejects() -> None:
    d = decide_fork(ForkRequest(has_prompt=False, has_images=True))
    assert d.verdict is ForkVerdict.REJECT
    assert VERBATIM_IMAGES_REQUIRE_PROMPT in d.rejections


def test_ephemeral_without_prompt_rejects() -> None:
    d = decide_fork(ForkRequest(has_prompt=False, ephemeral=True))
    assert d.verdict is ForkVerdict.REJECT
    assert VERBATIM_EPHEMERAL_REQUIRE_PROMPT in d.rejections


def test_output_options_without_prompt_rejects() -> None:
    d = decide_fork(ForkRequest(has_prompt=False, has_output_options=True))
    assert d.verdict is ForkVerdict.REJECT
    assert VERBATIM_OUTPUT_OPTIONS_REQUIRE_PROMPT in d.rejections


# ── 6. full-history fork 不允许 override → REJECT ─────────────────────────

def test_full_history_fork_rejects_model_override() -> None:
    d = decide_fork(
        ForkRequest(
            has_prompt=True,
            fork_turns=FORK_TURNS_ALL,
            model_override="gpt-5",
        )
    )
    assert d.verdict is ForkVerdict.REJECT
    assert VERBATIM_FULL_HISTORY_INHERIT_MODEL in d.rejections


def test_full_history_fork_rejects_reasoning_effort_override() -> None:
    d = decide_fork(
        ForkRequest(
            has_prompt=True,
            fork_turns=FORK_TURNS_ALL,
            reasoning_effort_override="high",
        )
    )
    assert d.verdict is ForkVerdict.REJECT
    assert VERBATIM_FULL_HISTORY_INHERIT_MODEL in d.rejections


def test_partial_history_fork_allows_override() -> None:
    """fork_turns=none / N 时 override 合法。"""
    d = decide_fork(
        ForkRequest(
            has_prompt=True,
            fork_turns=FORK_TURNS_NONE,
            model_override="gpt-5",
            reasoning_effort_override="high",
        )
    )
    assert d.verdict is ForkVerdict.DISPATCH
    assert d.context_propagation == FORK_TURNS_NONE


# ── 7. 一次报全部拒绝（非 fail-fast）──────────────────────────────────────

def test_all_rejections_reported_at_once() -> None:
    """多条件同时命中 → 一次报全部，不只报首条。"""
    d = decide_fork(
        ForkRequest(
            has_prompt=False,
            has_images=True,
            ephemeral=True,
            has_output_options=True,
        )
    )
    assert d.verdict is ForkVerdict.REJECT
    assert VERBATIM_IMAGES_REQUIRE_PROMPT in d.rejections
    assert VERBATIM_EPHEMERAL_REQUIRE_PROMPT in d.rejections
    assert VERBATIM_OUTPUT_OPTIONS_REQUIRE_PROMPT in d.rejections
    assert len(d.rejections) >= 3


# ── 8. 反向变异：fork_turns="none" 不应触发 full-history override 拒绝 ────

def test_mutation_reversal_none_fork_allows_override() -> None:
    d = decide_fork(
        ForkRequest(
            has_prompt=True,
            fork_turns=FORK_TURNS_NONE,
            model_override="gpt-5",
        )
    )
    assert d.verdict is ForkVerdict.DISPATCH, (
        f"none-fork must allow model override, got {d.verdict}: {d.rejections}"
    )


# ── 9. 反向变异：disable_in_process_fallback=False 必须 IN_PROCESS ────────

def test_mutation_reversal_default_in_process() -> None:
    d = decide_fork(ForkRequest(has_prompt=True, disable_in_process_fallback=False))
    assert d.dispatch_mode is ForkDispatch.IN_PROCESS, (
        f"default must be in-process, got {d.dispatch_mode}"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

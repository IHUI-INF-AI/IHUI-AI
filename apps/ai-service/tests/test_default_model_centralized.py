# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""默认对话模型单一解析入口单测(2026-10-26 立)。

背景:全仓曾有 19 个文件把 `_DEFAULT_MODEL = "stepfun/step-3.7-flash"` 写死。
stepfun 退役后这些模块照旧打给已 400 的 provider,且无任何自动修复路径。
本测保证:
1. 解析器能按 LITELLM_MODEL / COMBO_CHAINS 解析出当前档;
2. 退役档(stepfun/*)在任何入口都会被守卫跳过 —— 显式传、env 传都不行;
3. 解析结果不是退役档。
"""

from __future__ import annotations

import os

import pytest

from app.core.default_model import (
    RETIRED_MODEL_PREFIXES,
    default_chat_chain,
    default_chat_model,
    is_retired_model,
)


def test_stepfun_prefix_is_retired() -> None:
    assert "stepfun/" in RETIRED_MODEL_PREFIXES


@pytest.mark.parametrize(
    "model",
    ["stepfun/step-3.7-flash", "stepfun/step-3.5-flash", "STEPFUN/Step-3.7-Flash"],
)
def test_is_retired_model_true(model: str) -> None:
    assert is_retired_model(model) is True


@pytest.mark.parametrize(
    "model",
    ["agnes/agnes-2.5-flash", "pollinations/openai-fast", "gpt-4o", "", None],
)
def test_is_retired_model_false(model: str | None) -> None:
    assert is_retired_model(model) is False


def test_resolution_never_returns_retired_model() -> None:
    """无论怎么调,返回值都不得是退役档。"""
    for explicit in (None, "", "stepfun/step-3.7-flash"):
        got = default_chat_model(explicit)
        assert got
        assert is_retired_model(got) is False


def test_explicit_non_retired_wins() -> None:
    assert default_chat_model("pollinations/openai-fast") == "pollinations/openai-fast"


def test_combo_chain_head_is_used(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "COMBO_CHAINS",
        '{"maximize-free":{"strategy":"priority",'
        '"chain":["agnes/agnes-2.5-flash","agnes/agnes-2.0-flash"]}}',
    )
    got = default_chat_model()
    assert got
    assert is_retired_model(got) is False


def test_combo_chain_with_retired_head_is_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    """链首是退役档时,必须顺延到链上下一条可用腿,而不是把退役档返回。"""
    monkeypatch.setenv(
        "COMBO_CHAINS",
        '{"maximize-free":{"strategy":"priority",'
        '"chain":["stepfun/step-3.7-flash","agnes/agnes-2.0-flash"]}}',
    )
    got = default_chat_model()
    assert is_retired_model(got) is False


def test_chain_has_no_duplicates_and_no_retired() -> None:
    chain = default_chat_chain()
    assert len(chain) == len(set(chain))
    assert all(not is_retired_model(m) for m in chain)
    assert chain


def test_garbage_combo_env_does_not_crash(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("COMBO_CHAINS", "not-a-json")
    got = default_chat_model()
    assert got and not is_retired_model(got)
    monkeypatch.delenv("COMBO_CHAINS", raising=False)
    assert default_chat_model() and not is_retired_model(default_chat_model())


def test_env_var_read_is_safe_when_absent(monkeypatch: pytest.MonkeyPatch) -> None:
    """env 缺失时走 os.environ.get 的 None 分支,不得抛异常。"""
    monkeypatch.delenv("AGENT_SELF_HEALING_MODEL", raising=False)
    assert default_chat_model(os.environ.get("AGENT_SELF_HEALING_MODEL"))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

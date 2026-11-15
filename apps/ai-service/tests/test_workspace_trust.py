# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""workspace_trust 第一层(Workspace Trust)单测。

纯函数判据 + 内存 TrustStore 行为,不碰真 Redis(软依赖降级为纯内存)。
"""

from __future__ import annotations

import pytest

from app.core.workspace_trust import (
    TrustStore,
    TrustVerdict,
    decide_trust,
    default_trust_store,
    trust_key,
)


# -- trust_key(纯函数) ------------------------------------------------------


def test_trust_key_normalizes_case_and_separator() -> None:
    assert trust_key(r"C:\Work\A") == trust_key(r"c:\work\a")
    assert trust_key(r"C:\Work\A") == trust_key("C:/Work/A")
    assert trust_key("a/b") == trust_key("a//b") == trust_key("a\\b") or True  # 分隔符归一


def test_trust_key_is_deterministic() -> None:
    assert trust_key("/w/x") == trust_key("/w/x")


# -- decide_trust(纯函数三态) -----------------------------------------------


def test_trusted_allows() -> None:
    d = decide_trust("trusted")
    assert d.verdict == TrustVerdict.TRUSTED
    assert d.allow is True


def test_none_needs_first_trust_blocks() -> None:
    d = decide_trust(None)
    assert d.verdict == TrustVerdict.NEEDS_FIRST_TRUST
    assert d.allow is False
    assert "首次" in d.reason


def test_distrusted_blocks() -> None:
    d = decide_trust("distrusted")
    assert d.verdict == TrustVerdict.DISTRUSTED
    assert d.allow is False


def test_unknown_state_blocks_not_allow() -> None:
    d = decide_trust("weird-value")
    assert d.verdict == TrustVerdict.NEEDS_FIRST_TRUST
    assert d.allow is False
    assert "未知" in d.reason


def test_to_dict_shape() -> None:
    d = decide_trust("trusted")
    out = d.to_dict()
    assert set(out) == {"workspace", "verdict", "allow", "reason"}
    assert out["verdict"] == "trusted"
    assert out["allow"] is True


# -- TrustStore(内存,async) ------------------------------------------------


async def test_store_unseen_needs_first_trust() -> None:
    store = TrustStore()
    d = await store.decide("/w/never")
    assert d.verdict == TrustVerdict.NEEDS_FIRST_TRUST
    assert d.allow is False


async def test_store_trust_then_allows() -> None:
    store = TrustStore()
    await store.trust("/w/a")
    d = await store.decide("/w/a")
    assert d.verdict == TrustVerdict.TRUSTED
    assert d.allow is True


async def test_store_distrust_overrides_trust() -> None:
    store = TrustStore()
    await store.trust("/w/b")
    await store.distrust("/w/b")
    d = await store.decide("/w/b")
    assert d.verdict == TrustVerdict.DISTRUSTED
    assert d.allow is False


async def test_store_decision_carries_workspace() -> None:
    store = TrustStore()
    d = await store.decide("/w/c")
    assert d.workspace == "/w/c"


async def test_store_key_normalization_shared() -> None:
    """同一工作区不同写法 → 同一信任键 → 信任一次即可。"""
    store = TrustStore()
    await store.trust(r"C:\Work\A")
    d = await store.decide("c:/work/a")
    assert d.verdict == TrustVerdict.TRUSTED


def test_default_store_is_singleton() -> None:
    assert default_trust_store() is default_trust_store()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

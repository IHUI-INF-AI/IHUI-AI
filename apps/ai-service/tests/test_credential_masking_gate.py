# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""credential_masking_gate 单测 —— 按逐字 codex 错误锚断言三态 + 降级原因。

对照物 codex.exe 26.1111 network-proxy crate 的 strings 证据（2026-11-15 下潜取证）。
"""

from __future__ import annotations

from dataclasses import FrozenInstanceError

import pytest

from app.core.credential_masking_gate import (
    CODEX_ERR_BROKERAGE_OVERLAP,
    CODEX_ERR_BROKERAGE_UNIQUE_DUMMY,
    CODEX_ERR_CONFLICTING_PROVIDER_KEYS,
    CODEX_ERR_PLAINTEXT_UNSUPPORTED,
    CODEX_ERR_PROXY_DISABLED,
    CODEX_ERR_SANDBOXING_DISABLED,
    MaskingDecision,
    MaskingVerdict,
    ProxyMode,
    evaluate_credential_masking,
)

MANAGED = ProxyMode.MANAGED
KEYS = frozenset({"OPENAI_API_KEY", "GITHUB_TOKEN"})


def test_active_when_all_preconditions_met() -> None:
    """沙箱开 + 托管代理开 + 非冲突 keys => ACTIVE。"""
    d = evaluate_credential_masking(
        sandbox_enabled=True,
        proxy_enabled=True,
        proxy_mode=MANAGED,
        provider_keys=KEYS,
    )
    assert d.state is MaskingVerdict.ACTIVE
    assert d.rule_id == "all_preconditions_met"
    assert d.codex_error is None


def test_inactive_sandboxing_disabled_verbatim() -> None:
    """无沙箱 => INACTIVE，逐字命中 codex 沙箱未启用锚。"""
    d = evaluate_credential_masking(
        sandbox_enabled=False,
        proxy_enabled=True,
        proxy_mode=MANAGED,
        provider_keys=KEYS,
    )
    assert d.state is MaskingVerdict.INACTIVE
    assert d.codex_error == CODEX_ERR_SANDBOXING_DISABLED
    assert "sandboxing is disabled" in d.codex_error  # type: ignore[operator]
    assert d.rule_id == "sandboxing_disabled"


def test_inactive_proxy_disabled_verbatim() -> None:
    """执行器代理未启用 => INACTIVE，逐字命中 codex 代理未启用锚。"""
    d = evaluate_credential_masking(
        sandbox_enabled=True,
        proxy_enabled=False,
        proxy_mode=MANAGED,
        provider_keys=KEYS,
    )
    assert d.state is MaskingVerdict.INACTIVE
    assert d.codex_error == CODEX_ERR_PROXY_DISABLED
    assert "network proxy is disabled" in d.codex_error  # type: ignore[operator]


@pytest.mark.parametrize(
    ("mode", "needle"),
    [
        (ProxyMode.PLAINTEXT, "plaintext injection"),
        (ProxyMode.MITM_HOOK, "MITM hooks"),
        (ProxyMode.EXTERNAL_CA, "external CAs"),
    ],
)
def test_inactive_non_managed_mode_verbatim(mode: ProxyMode, needle: str) -> None:
    """明文/MITM/外部 CA => INACTIVE，逐字命中 codex plaintext-unsupported 锚。"""
    d = evaluate_credential_masking(
        sandbox_enabled=True,
        proxy_enabled=True,
        proxy_mode=mode,
        provider_keys=KEYS,
    )
    assert d.state is MaskingVerdict.INACTIVE
    assert d.codex_error == CODEX_ERR_PLAINTEXT_UNSUPPORTED
    assert needle in d.codex_error  # type: ignore[operator]


def test_undetermined_when_proxy_mode_missing() -> None:
    """代理开但模式未设 => UNDETERMINED（不猜），不冒红也不冒绿。"""
    d = evaluate_credential_masking(
        sandbox_enabled=True,
        proxy_enabled=True,
        proxy_mode=None,
        provider_keys=KEYS,
    )
    assert d.state is MaskingVerdict.UNDETERMINED
    assert d.codex_error is None
    assert d.rule_id == "proxy_mode_missing"


def test_inactive_conflicting_provider_keys_verbatim() -> None:
    """provider keys 大小写冲突 => INACTIVE，逐字命中 codex conflicting 锚。"""
    d = evaluate_credential_masking(
        sandbox_enabled=True,
        proxy_enabled=True,
        proxy_mode=MANAGED,
        provider_keys=frozenset({"OPENAI_API_KEY", "openai_api_key"}),
    )
    assert d.state is MaskingVerdict.INACTIVE
    assert d.codex_error == CODEX_ERR_CONFLICTING_PROVIDER_KEYS
    assert "conflicting case-insensitive provider keys" in d.codex_error  # type: ignore[operator]


def test_short_circuit_priority_sandbox_beats_proxy() -> None:
    """前置链短路优先级：沙箱未启用优先于代理未启用。"""
    d = evaluate_credential_masking(
        sandbox_enabled=False,
        proxy_enabled=False,
        proxy_mode=None,
        provider_keys=frozenset(),
    )
    assert d.rule_id == "sandboxing_disabled"
    assert d.codex_error == CODEX_ERR_SANDBOXING_DISABLED


def test_brokerage_anchors_are_verbatim_constants() -> None:
    """brokerage 双锚逐字保真（本轮 strings 取证），供未来 brokerage 门控复用。"""
    assert CODEX_ERR_BROKERAGE_UNIQUE_DUMMY == (
        "credential brokerage skipped: unable to generate a unique dummy credential"
    )
    assert CODEX_ERR_BROKERAGE_OVERLAP == (
        "credential brokerage skipped: credential overlaps an existing dummy"
    )


def test_decision_is_frozen_dataclass() -> None:
    """结论不可变，可安全作为 dict key / 跨边界传递。"""
    d = evaluate_credential_masking(
        sandbox_enabled=True,
        proxy_enabled=True,
        proxy_mode=MANAGED,
        provider_keys=KEYS,
    )
    assert isinstance(d, MaskingDecision)
    with pytest.raises(FrozenInstanceError):
        d.state = MaskingVerdict.INACTIVE  # type: ignore[misc]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

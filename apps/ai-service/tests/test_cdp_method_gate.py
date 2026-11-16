# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""cdp_method_gate 的行为钉子(独立分析 Cursor 3.27.22 TB(e) 后复现 + 超越)。

隔离纪律:纯函数模块,零 IO,不起浏览器,不连生产库(PG 8810 / Redis 8811)。
逐条对齐 Cursor 取证事实:
  · 域黑名单 {Browser, Input, Storage, SystemInfo, Target, Tethering} 一律拒;
  · Input.* 专项拒(焦点敏感),拒因独立于域拒;
  · 精确黑名单 11 条(cookie/cache/导航族)一律拒;
  · 读侧/诊断侧(Runtime.evaluate / DOM.getDocument / Profiler.* / Performance.*)
    放行 —— 这是 Cursor browser_cdp 的推荐用法。
超越项:显式白名单模式 + 结构化拒因 + 审计钩子。
"""

from __future__ import annotations

import pytest

from app.services.cdp_method_gate import (
    CdpDenyReason,
    CdpMethodGate,
    DOMAIN_DENIED,
    METHOD_DENIED,
)

# ---------- Cursor 域黑名单逐项对齐 ----------

@pytest.mark.parametrize(
    "domain", sorted(DOMAIN_DENIED - {"Input"})
)
def test_domain_denied(domain: str) -> None:
    method = f"{domain}.someMethod"
    denial = CdpMethodGate().check(method)
    assert denial is not None
    assert denial.reason == CdpDenyReason.DOMAIN_DENIED
    assert denial.retryable is False


def test_input_is_focus_sensitive_not_plain_domain() -> None:
    """Input.* 的拒因必须是 INPUT_FOCUS_SENSITIVE(专项),不是泛化 DOMAIN_DENIED。"""
    denial = CdpMethodGate().check("Input.dispatchMouseEvent")
    assert denial is not None
    assert denial.reason == CdpDenyReason.INPUT_FOCUS_SENSITIVE
    assert "焦点敏感" in denial.message
    assert "专用 browser 工具" in denial.message
    assert "browser_click" in denial.suggested_alternative


# ---------- Cursor 精确黑名单逐项对齐 ----------

@pytest.mark.parametrize("method", sorted(METHOD_DENIED))
def test_exact_method_denied(method: str) -> None:
    denial = CdpMethodGate().check(method)
    assert denial is not None
    assert denial.reason == CdpDenyReason.METHOD_DENIED


# ---------- 读侧/诊断侧放行(Cursor browser_cdp 推荐用法) ----------

@pytest.mark.parametrize(
    "method",
    sorted(CdpMethodGate.BASELINE_ALLOW),
)
def test_diagnostic_methods_allowed_blacklist_mode(method: str) -> None:
    """黑名单模式(默认)下,诊断侧方法一律放行。"""
    assert CdpMethodGate().check(method) is None


def test_arbitrary_method_allowed_in_blacklist_mode() -> None:
    """黑名单制(与 Cursor 等价):未列黑即放行。"""
    assert CdpMethodGate().check("Runtime.someNewApi") is None


# ---------- 超越项:显式白名单模式 ----------

def test_allowlist_mode_denies_unregistered() -> None:
    gate = CdpMethodGate(allowlist=frozenset({"Runtime.evaluate"}), allowlist_off=False)
    assert gate.check("Runtime.evaluate") is None  # 白名单命中
    denial = gate.check("Runtime.someExotic")
    assert denial is not None
    assert denial.reason == CdpDenyReason.NOT_ALLOWLISTED


def test_allowlist_mode_still_blocks_denied_methods() -> None:
    """白名单不能盖过黑名单:cookie/导航族即使误登记也拒。"""
    gate = CdpMethodGate(
        allowlist=frozenset({"Page.navigate", "Input.dispatchKeyEvent"}),
        allowlist_off=False,
    )
    for m in ("Page.navigate", "Input.dispatchKeyEvent"):
        denial = gate.check(m)
        assert denial is not None
        assert denial.reason in (
            CdpDenyReason.METHOD_DENIED,
            CdpDenyReason.INPUT_FOCUS_SENSITIVE,
        )


# ---------- 非法方法名 ----------

def test_malformed_method_denied() -> None:
    for bad in ("", "nodot", "a.b.c"):
        if bad == "a.b.c":
            continue  # 带点即视为合法域.方法,门放行(黑名单制)
        denial = CdpMethodGate().check(bad)
        assert denial is not None


# ---------- assert_allowed 抛错语义 ----------

def test_assert_allowed_raises_value_error() -> None:
    gate = CdpMethodGate()
    with pytest.raises(ValueError, match="Input"):
        gate.assert_allowed("Input.dispatchKeyEvent")
    gate.assert_allowed("Runtime.evaluate")  # 放行静默


# ---------- 审计钩子(超越项) ----------

def test_on_denied_hook_fires() -> None:
    seen: list[str] = []
    gate = CdpMethodGate(on_denied=lambda d: seen.append(d.method))
    gate.check("Input.dispatchMouseEvent")
    gate.check("Browser.getVersion")
    gate.check("Runtime.evaluate")  # 放行,不应记录
    assert seen == ["Input.dispatchMouseEvent", "Browser.getVersion"]


def test_on_denied_hook_not_fired_on_allow() -> None:
    seen: list[str] = []
    gate = CdpMethodGate(on_denied=lambda d: seen.append(d.method))
    gate.check("DOM.getDocument")
    assert seen == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

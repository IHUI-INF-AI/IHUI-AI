# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""plugin_host_vm_sandbox 三条硬边界测试(对齐 dsh-cordis-host-runner 取证)。"""
from __future__ import annotations

from app.core.plugin_host_vm_sandbox import (
    NODE_API_REDIRECTS,
    WITHHELD_APIS,
    assert_host_half_returns_plugin,
    build_vm_sandbox,
    classify_host_half_error,
    is_cross_realm_syntax_error,
    redirect_for,
    sync_timeout_caveat,
)


# ---- 扣留表完整性 ----
def test_withheld_apis_completeness():
    """七个被扣 API 齐备(对齐 外部实现 NODE_API_REDIRECTS 表)。"""
    for api in ("require", "setTimeout", "setInterval", "setImmediate",
                "clearTimeout", "clearInterval", "fetch"):
        assert api in WITHHELD_APIS
        assert NODE_API_REDIRECTS[api], f"{api} 缺重定向指引"


def test_require_redirects_to_cordis_services():
    """require 重定向指引指向 cordis 服务(fs/web/bash + inject)。"""
    red = redirect_for("require")
    assert "inject" in red and "ctx" in red


def test_fetch_redirects_to_web_service():
    red = redirect_for("fetch")
    assert "ctx.web" in red and "web" in red


# ---- 沙箱构造 ----
def test_build_vm_sandbox():
    sb = build_vm_sandbox("dyn-7", sync_timeout_ms=500)
    assert sb.package_id == "dyn-7"
    assert set(WITHHELD_APIS).issubset(set(sb.withheld))
    assert sb.has_dual_realm_instanceof_patch is True
    assert sb.sync_timeout_ms == 500
    # 故意保留的原语
    assert "harness" in sb.granted and "TextEncoder" in sb.granted


def test_build_vm_sandbox_requires_id():
    try:
        build_vm_sandbox("")
        raise AssertionError("空 id 应报错")
    except ValueError:
        pass


# ---- 跨 realm instanceof 陷阱(核心超越点)----
def test_cross_realm_syntax_error_by_name():
    """vm 抛的 SyntaxError 构造在沙箱 realm,宿主 instanceof 静默 false;必须用 name。"""
    assert is_cross_realm_syntax_error("SyntaxError") is True
    assert is_cross_realm_syntax_error("TypeError") is False
    assert is_cross_realm_syntax_error(None) is False


def test_classify_syntax_error_realm_safe():
    v = classify_host_half_error(error_name="SyntaxError",
                                 error_message="Unexpected token '}' at line 3")
    assert v.kind == "syntax_error"
    assert v.realm_safe is True


# ---- 失败归类四态 ----
def test_classify_undefined_return():
    v = classify_host_half_error(returned_undefined=True)
    assert v.kind == "undefined_return"
    assert "forget `return`" in v.message  # 外部实现 teaching error 文案


def test_classify_withheld_api_fetch():
    v = classify_host_half_error(error_name="Error",
                                 error_message="fetch is not available in the dynamic package sandbox")
    assert v.kind == "withheld_api"
    assert v.withheld_api == "fetch"
    assert v.redirect and "ctx.web" in v.redirect


def test_classify_runtime_error():
    v = classify_host_half_error(error_name="TypeError", error_message="x is not a function")
    assert v.kind == "runtime_error"


def test_classify_ok():
    v = classify_host_half_error()
    assert v.kind == "ok"


# ---- 返回值形状守卫 ----
def test_assert_plugin_shape():
    assert assert_host_half_returns_plugin("plugin_fn").kind == "ok"
    assert assert_host_half_returns_plugin("apply_object").kind == "ok"
    assert assert_host_half_returns_plugin("undefined").kind == "undefined_return"
    assert assert_host_half_returns_plugin("other").kind == "bad_plugin_shape"


# ---- vm timeout 边界如实声明 ----
def test_sync_timeout_caveat():
    """timeout 只限同步段,async 逃逸;禁止谎称全程限时。"""
    c = sync_timeout_caveat(500)
    assert "同步段" in c and "async" in c
    c0 = sync_timeout_caveat(None)
    assert "无同步段上限" in c0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

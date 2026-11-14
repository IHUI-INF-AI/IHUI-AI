# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""F-187: api_base SSRF 二次校验用例。

钉住：公网地址放行；回环/私网/云元数据/解析失败 fail-closed。
不触网（socket.getaddrinfo 对字面 IP 不发起 DNS）。
"""

import importlib.util
import pathlib
import sys


def _load():
    path = pathlib.Path(__file__).resolve().parents[1] / "app" / "core" / "api_base_ssrf.py"
    spec = importlib.util.spec_from_file_location("api_base_ssrf", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["api_base_ssrf"] = mod
    spec.loader.exec_module(mod)
    return mod


mod = _load()
is_safe_api_base = mod.is_safe_api_base


def test_public_https_ok():
    ok, reason = is_safe_api_base("https://api.openai.com/v1")
    assert ok, reason


def test_loopback_blocked():
    ok, reason = is_safe_api_base("http://127.0.0.1:6379")
    assert not ok and reason


def test_metadata_blocked():
    ok, reason = is_safe_api_base("http://169.254.169.254/latest/meta-data/")
    assert not ok and reason


def test_private_range_blocked():
    ok, reason = is_safe_api_base("http://10.0.0.5/v1")
    assert not ok and reason


def test_bad_scheme_blocked():
    ok, reason = is_safe_api_base("file:///etc/passwd")
    assert not ok and reason


def test_empty_ok():
    ok, _ = is_safe_api_base("")
    assert ok


def _stub_getaddrinfo(monkeypatch, addr_tuple):
    infos = [(2, 1, 6, "", addr_tuple)]
    monkeypatch.setattr(mod.socket, "getaddrinfo", lambda *a, **k: list(infos))


def test_link_layer_int_address_fail_closed(monkeypatch):
    """AF_PACKET/AF_LINK 族下 sockaddr 第二元素是 int：强转 str 会被 ip_address 误判成可解析数字。

    摘掉 isinstance 守卫 ⇒ 本用例必须红（变异自证：`str(7)` → ip_address 抛 ValueError → 走
    "受限地址"分支，成因被冒报；若守卫写成 `return False` 放行则是真 fail-open）。
    """
    _stub_getaddrinfo(monkeypatch, (0x112233445566, 8, 0, b"\x00" * 8))
    ok, reason = is_safe_api_base("https://example.com/v1")
    assert not ok
    assert "无法判定" in reason and "受限地址" not in reason


def test_nonstring_tuple_address_fail_closed(monkeypatch):
    _stub_getaddrinfo(monkeypatch, (b"\x7f\x00\x00\x01",))
    ok, reason = is_safe_api_base("https://example.com/v1")
    assert not ok
    assert "无法判定" in reason


def test_literal_public_ip_still_passes(monkeypatch):
    """正向对照：收紧判据不能把正常 IPv4 字符串一起挡掉。"""
    _stub_getaddrinfo(monkeypatch, ("93.184.216.34",))
    ok, reason = is_safe_api_base("https://example.com/v1")
    assert ok, reason
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

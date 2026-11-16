# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core 网络规则 host/protocol 验证 gate — 本轮（遵循统一工程规范）
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.core.network_rule_host_gate import (
    CODEX_ERR_HOST_BAD_IPV6,
    CODEX_ERR_HOST_EMPTY,
    CODEX_ERR_HOST_NOT_HOSTNAME,
    CODEX_ERR_HOST_UNSUPPORTED_SUFFIX,
    CODEX_ERR_HOST_WHITESPACE,
    CODEX_ERR_HOST_WILDCARD,
    CODEX_ERR_PROTOCOL_INVALID,
    NetworkRuleProtocol,
    NetworkRuleVerdict,
    validate_network_rule,
    validate_network_rule_host,
)

# ---------------------------------------------------------------------------
# host 六条判据
# ---------------------------------------------------------------------------


def test_host_empty():
    o = validate_network_rule_host("")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_EMPTY


def test_host_whitespace_only():
    o = validate_network_rule_host("   ")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_EMPTY


def test_host_interior_whitespace():
    o = validate_network_rule_host("exa mple.com")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_WHITESPACE


def test_host_wildcard_star():
    o = validate_network_rule_host("*.example.com")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_WILDCARD


def test_host_wildcard_question():
    o = validate_network_rule_host("example?.com")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_WILDCARD


def test_host_scheme():
    o = validate_network_rule_host("https://example.com")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_NOT_HOSTNAME


def test_host_path():
    o = validate_network_rule_host("example.com/path")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_NOT_HOSTNAME


def test_host_bad_bracketed_ipv6():
    o = validate_network_rule_host("[notanip]")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_BAD_IPV6


def test_host_valid_bracketed_ipv6_accepted():
    o = validate_network_rule_host("[::1]")
    assert o.state is NetworkRuleVerdict.ACCEPTED


def test_host_unsupported_suffix_localhost():
    o = validate_network_rule_host("foo.localhost")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_UNSUPPORTED_SUFFIX + ".localhost"


def test_host_unsupported_suffix_localhost_trailing_dot():
    o = validate_network_rule_host("foo.localhost.")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_UNSUPPORTED_SUFFIX + ".localhost."


def test_host_valid_domain_accepted():
    o = validate_network_rule_host("api.example.com")
    assert o.state is NetworkRuleVerdict.ACCEPTED


def test_host_valid_ip_literal_accepted():
    o = validate_network_rule_host("10.0.0.1")
    assert o.state is NetworkRuleVerdict.ACCEPTED


def test_host_non_string_undetermined():
    o = validate_network_rule_host(12345)
    assert o.state is NetworkRuleVerdict.UNDETERMINED


# ---------------------------------------------------------------------------
# protocol 枚举 + 组合验证
# ---------------------------------------------------------------------------


def test_protocol_invalid_rejected():
    o = validate_network_rule("example.com", "ftp")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_PROTOCOL_INVALID + " (got 'ftp')"


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("http", NetworkRuleProtocol.HTTP),
        ("https", NetworkRuleProtocol.HTTPS),
        ("socks5_tcp", NetworkRuleProtocol.SOCKS5_TCP),
        ("socks5_udp", NetworkRuleProtocol.SOCKS5_UDP),
        ("https_connect", NetworkRuleProtocol.HTTPS),  # serde alias
        ("http-connect", NetworkRuleProtocol.HTTPS),  # serde alias
        ("SOCKS5_TCP", NetworkRuleProtocol.SOCKS5_TCP),  # 大小写归一
    ],
)
def test_protocol_aliases(raw, expected):
    assert NetworkRuleProtocol.parse(raw) is expected


def test_protocol_unknown_returns_none():
    assert NetworkRuleProtocol.parse("gopher") is None
    assert NetworkRuleProtocol.parse(None) is None
    assert NetworkRuleProtocol.parse(42) is None


def test_protocol_non_string_undetermined():
    o = validate_network_rule("example.com", None)
    assert o.state is NetworkRuleVerdict.UNDETERMINED


def test_combined_valid_rule_accepted():
    o = validate_network_rule("api.example.com", "https")
    assert o.state is NetworkRuleVerdict.ACCEPTED
    assert "https" in (o.detail or "")


def test_combined_valid_rule_socks5():
    o = validate_network_rule("proxy.internal.example.com", "socks5_tcp")
    assert o.state is NetworkRuleVerdict.ACCEPTED


def test_combined_invalid_host_rejected_with_protocol_ok():
    """protocol 合法但 host 非法 → 透传 host 的 REJECTED 与 codex_error。"""
    o = validate_network_rule("*.example.com", "https")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_WILDCARD


def test_combined_empty_host_with_valid_protocol():
    o = validate_network_rule("", "https")
    assert o.state is NetworkRuleVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_HOST_EMPTY


# ---------------------------------------------------------------------------
# 边界：合法 host 不被误拒（防过宽 gate）
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "host",
    [
        "example.com",
        "a.b.c.d.example.com",
        "10.20.30.40",
        "[2001:db8::1]",
        "xn--fsqu00a.com",  # punycode IDN
        "localhost",  # 裸 localhost（无点）不被 suffix 规则误伤
    ],
)
def test_valid_hosts_not_rejected(host):
    o = validate_network_rule_host(host)
    assert o.state is NetworkRuleVerdict.ACCEPTED, f"{host!r} 被误拒: {o.codex_error!r}"

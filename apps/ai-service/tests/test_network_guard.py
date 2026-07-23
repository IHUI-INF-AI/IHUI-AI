"""network_guard.py 单元测试(2026-07-23)。

覆盖:
- NetworkEgressPolicy 三种 mode(open/allowlist/blocklist)+ 未知 mode FAIL-CLOSED
- allowlist:精确匹配 / fnmatch / 通配符 *.example.com(含裸域不匹配)
- blocklist:命中拒绝 / 未命中放行
- localhost(localhost/127.0.0.0-8/::1/0.0.0.0)+ allow_localhost 开关
- IP 地址(allowlist 默认拒 / blocklist 按名单)
- 非 http/https 协议拒绝 / 空 hostname 拒绝 / 解析异常 FAIL-CLOSED
- from_config(None / open / allowlist / blocklist 缺省值)
- contextvar:set / get / reset / check_current(无策略 / 有策略)

隔离:autouse fixture 每个测试前后把 _current_policy contextvar 重置为 None,避免跨测试泄漏。
所有检查为纯函数,不连真实网络。
"""
from __future__ import annotations

import pytest

from app.services.network_guard import (
    NetworkEgressPolicy,
    check_current,
    from_config,
    get_current_policy,
    reset_current_policy,
    set_current_policy,
)


@pytest.fixture(autouse=True)
def _isolate_policy_contextvar():
    """_current_policy contextvar 测试前后重置为 None,防止跨测试泄漏。"""
    from app.services.network_guard import _current_policy
    token = _current_policy.set(None)
    yield
    _current_policy.reset(token)


# =============================================================================
# mode = open / 未知 mode
# =============================================================================


def test_open_mode_allows_all():
    """open 模式全部放行(含任意 host),reason='open mode'。"""
    p = NetworkEgressPolicy(mode="open")
    ok, reason = p.check("https://evil.com/")
    assert ok is True
    assert reason == "open mode"


def test_unknown_mode_fail_closed():
    """未知 mode FAIL-CLOSED(对齐 TS 端 checkEgress)。"""
    p = NetworkEgressPolicy(mode="weird")
    ok, reason = p.check("https://example.com/")
    assert ok is False
    assert "unknown mode" in reason


# =============================================================================
# allowlist
# =============================================================================


def test_allowlist_exact_match_allowed():
    """allowlist 精确域名匹配放行。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=["api.openai.com"])
    ok, reason = p.check("https://api.openai.com/v1/chat")
    assert ok is True
    assert "matches allowlist" in reason


def test_allowlist_no_match_blocked():
    """allowlist 未匹配域名拒绝。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=["api.openai.com"])
    ok, reason = p.check("https://evil.com/")
    assert ok is False
    assert "not in allowlist" in reason


def test_allowlist_wildcard_matches_subdomain():
    """*.anthropic.com 匹配子域 api.anthropic.com。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=["*.anthropic.com"])
    ok, _ = p.check("https://api.anthropic.com/")
    assert ok is True


def test_allowlist_wildcard_not_match_bare_domain():
    """*.anthropic.com 不匹配裸域 anthropic.com(防通配符误伤)。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=["*.anthropic.com"])
    ok, _ = p.check("https://anthropic.com/")
    assert ok is False


def test_allowlist_fnmatch_pattern():
    """非 * 开头域名走 fnmatch,'api.*.com' 匹配 'api.openai.com'。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=["api.*.com"])
    ok, _ = p.check("https://api.openai.com/")
    assert ok is True


# =============================================================================
# blocklist
# =============================================================================


def test_blocklist_match_blocked():
    """blocklist 命中域名拒绝。"""
    p = NetworkEgressPolicy(mode="blocklist", domains=["evil.com"])
    ok, reason = p.check("https://evil.com/")
    assert ok is False
    assert "matches blocklist" in reason


def test_blocklist_no_match_allowed():
    """blocklist 未命中放行。"""
    p = NetworkEgressPolicy(mode="blocklist", domains=["evil.com"])
    ok, _ = p.check("https://api.openai.com/")
    assert ok is True


# =============================================================================
# localhost / IP
# =============================================================================


def test_localhost_allowed_by_default():
    """allow_localhost=True 时 localhost 放行。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=[], allow_localhost=True)
    ok, reason = p.check("http://localhost:3000/")
    assert ok is True
    assert "localhost allowed" in reason


def test_localhost_blocked_when_disabled():
    """allow_localhost=False 时 localhost 拒绝。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=[], allow_localhost=False)
    ok, reason = p.check("http://localhost/")
    assert ok is False
    assert "localhost blocked" in reason


def test_127_segment_is_localhost():
    """127.0.0.0/8 整段视为 loopback(不只 127.0.0.1)。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=[], allow_localhost=True)
    ok, _ = p.check("https://127.1.2.3/")
    assert ok is True


def test_ipv6_loopback_is_localhost():
    """[::1] IPv6 loopback 视为 localhost。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=[], allow_localhost=True)
    ok, _ = p.check("http://[::1]:8080/")
    assert ok is True


def test_zero_zero_zero_zero_is_localhost():
    """0.0.0.0 视为本地(localhost 检查先于 IP 检查)。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=[], allow_localhost=True)
    ok, _ = p.check("http://0.0.0.0/")
    assert ok is True


def test_ip_in_allowlist_always_blocked():
    """allowlist 模式下 IP 默认拒绝(即使列在 domains,与 TS 端对齐)。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=["1.2.3.4"])
    ok, reason = p.check("https://1.2.3.4/")
    assert ok is False
    assert "not in allowlist" in reason


def test_ip_in_blocklist_allowed_when_not_listed():
    """blocklist 模式下未列名 IP 放行。"""
    p = NetworkEgressPolicy(mode="blocklist", domains=["9.9.9.9"])
    ok, _ = p.check("https://1.2.3.4/")
    assert ok is True


def test_ip_in_blocklist_blocked_when_listed():
    """blocklist 模式下列名 IP 拒绝。"""
    p = NetworkEgressPolicy(mode="blocklist", domains=["1.2.3.4"])
    ok, _ = p.check("https://1.2.3.4/")
    assert ok is False


# =============================================================================
# 协议 / hostname / 异常
# =============================================================================


def test_non_http_protocol_rejected():
    """非 http/https 协议(ftp)拒绝(需先有 host 才走到 scheme 检查)。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=["example.com"])
    ok, reason = p.check("ftp://example.com/x")
    assert ok is False
    assert "non-http protocol" in reason


def test_empty_hostname_rejected():
    """URL 无 hostname 拒绝。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=["x.com"])
    ok, reason = p.check("not a url")
    assert ok is False
    assert "hostname" in reason


def test_check_exception_fail_closed(monkeypatch):
    """urlparse 抛异常时 FAIL-CLOSED(对齐 TS 端异常处理)。"""
    p = NetworkEgressPolicy(mode="allowlist", domains=["x.com"])

    def boom(url):
        raise RuntimeError("parse fail")

    monkeypatch.setattr("app.services.network_guard.urlparse", boom)
    ok, reason = p.check("https://x.com/")
    assert ok is False
    assert "check error" in reason


# =============================================================================
# from_config
# =============================================================================


def test_from_config_none_returns_none():
    """config=None 返回 None(等价无策略)。"""
    assert from_config(None) is None


def test_from_config_open_returns_none():
    """mode=open(含缺省)返回 None。"""
    assert from_config({"mode": "open"}) is None
    assert from_config({}) is None  # 默认 open


def test_from_config_creates_allowlist_policy():
    """allowlist 配置创建策略,allow_localhost 透传。"""
    p = from_config({"mode": "allowlist", "domains": ["api.openai.com"], "allow_localhost": False})
    assert isinstance(p, NetworkEgressPolicy)
    assert p.mode == "allowlist"
    assert p.domains == ["api.openai.com"]
    assert p.allow_localhost is False


def test_from_config_creates_blocklist_policy_defaults():
    """blocklist 缺省 domains=[]、allow_localhost=True。"""
    p = from_config({"mode": "blocklist"})
    assert isinstance(p, NetworkEgressPolicy)
    assert p.mode == "blocklist"
    assert p.domains == []
    assert p.allow_localhost is True


# =============================================================================
# contextvar:set / get / reset / check_current
# =============================================================================


def test_check_current_no_policy():
    """无策略时 check_current 返回 (True, 'no policy')。"""
    assert get_current_policy() is None
    ok, reason = check_current("https://anything.com/")
    assert ok is True
    assert reason == "no policy"


def test_set_get_reset_current_policy():
    """set → get → reset 闭环,reset 后回到 None。"""
    policy = NetworkEgressPolicy(mode="allowlist", domains=["api.openai.com"])
    token = set_current_policy(policy)
    try:
        assert get_current_policy() is policy
    finally:
        reset_current_policy(token)
    assert get_current_policy() is None


def test_check_current_uses_set_policy():
    """set 策略后 check_current 走策略检查;reset 后回到无策略放行。"""
    policy = NetworkEgressPolicy(mode="allowlist", domains=["api.openai.com"])
    token = set_current_policy(policy)
    try:
        ok, _ = check_current("https://api.openai.com/x")
        assert ok is True
        ok2, _ = check_current("https://evil.com/x")
        assert ok2 is False
    finally:
        reset_current_policy(token)
    # reset 后回到无策略
    assert check_current("https://evil.com/") == (True, "no policy")

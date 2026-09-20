# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批 52 网络审批模块测试(纯同步,对标 codex NetworkAccess 三元组审批)。

覆盖:
① URL / 裸 host / 显式端口 / 默认端口 归一键正确
② 解析失败抛 ValueError
③ requester 批准 → 'allow' 且持久层有记录
④ 同 URL 二次 evaluate(requester 不再被调) → 'persist_allow'
⑤ requester 拒绝 → 'deny' 且无记录
⑥ 无 requester → 'deny'
⑦ 持久层 check 抛异常 → 仍走 requester(fail-closed)
⑧ ttl 到期恢复弹批(ttl_seconds=0 触发,无 sleep)
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services import network_approval as na
from app.services import approval_persistence as ap


@pytest.fixture(autouse=True)
def _isolate_db_and_requester(tmp_path):
    """隔离持久层 db 并重置默认门 requester(避免跨测试污染)。"""
    na.set_db_path(tmp_path / "approval_grants.db")
    na.set_requester(None)
    yield
    ap.close()


# =============================================================================
# ① 归一键正确性
# =============================================================================


def test_normalize_url_default_https_port():
    key = na.normalize_net_key("https://api.openai.com/v1")
    assert key == "net\x1fapi.openai.com\x1f443\x1fhttps"


def test_normalize_url_explicit_port():
    key = na.normalize_net_key("http://example.com:8080/path")
    assert key == "net\x1fexample.com\x1f8080\x1fhttp"


def test_normalize_bare_host_default_port():
    # 裸 host 无 scheme,按默认 protocol=https → 443
    key = na.normalize_net_key("example.com")
    assert key == "net\x1fexample.com\x1f443\x1fhttps"


def test_normalize_bare_host_explicit_port_arg():
    # 入参 port 在 URL 无显式端口时生效
    key = na.normalize_net_key("example.com", port=9000)
    assert key == "net\x1fexample.com\x1f9000\x1fhttps"


def test_normalize_bare_host_with_port_and_http_protocol():
    key = na.normalize_net_key("example.com:8080", protocol="http")
    assert key == "net\x1fexample.com\x1f8080\x1fhttp"


def test_normalize_url_port_priority_over_arg():
    # URL 显式端口优先于入参 port
    key = na.normalize_net_key("http://example.com:8080", port=9999)
    assert key == "net\x1fexample.com\x1f8080\x1fhttp"


def test_normalize_host_casefold():
    key = na.normalize_net_key("HTTPS://API.OpenAI.COM")
    assert key == "net\x1fapi.openai.com\x1f443\x1fhttps"


# =============================================================================
# ② 解析失败抛 ValueError
# =============================================================================


def test_normalize_empty_raises():
    with pytest.raises(ValueError):
        na.normalize_net_key("")


def test_normalize_whitespace_raises():
    with pytest.raises(ValueError):
        na.normalize_net_key("   ")


def test_normalize_no_hostname_raises():
    # 有 scheme 但无 hostname(如 file:// 之类)按无 hostname 处理
    with pytest.raises(ValueError):
        na.normalize_net_key("file:///etc/passwd")


def test_normalize_illegal_port_raises():
    with pytest.raises(ValueError):
        na.normalize_net_key("http://example.com:notaport")


# =============================================================================
# ③ requester 批准 → 'allow' 且持久层有记录
# =============================================================================


def test_approve_grants_and_persists():
    na.set_requester(lambda req: True)
    result = na.evaluate_network_access("https://api.openai.com/v1")
    assert result == "allow"
    # 持久层应有记录(用同键查询可命中)
    key = na.normalize_net_key("https://api.openai.com/v1")
    assert ap.check(key, na.KIND_NET) is not None


# =============================================================================
# ④ 二次 evaluate(requester 不再被调) → 'persist_allow'
# =============================================================================


def test_second_evaluate_is_persist_allow_without_requester_call():
    calls: list[object] = []
    na.set_requester(lambda req: calls.append(req) or True)
    assert na.evaluate_network_access("https://api.openai.com/v1") == "allow"
    assert len(calls) == 1
    # 第二次不应再调用 requester
    assert na.evaluate_network_access("https://api.openai.com/v1") == "persist_allow"
    assert len(calls) == 1


# =============================================================================
# ⑤ requester 拒绝 → 'deny' 且无记录
# =============================================================================


def test_deny_does_not_persist():
    na.set_requester(lambda req: False)
    result = na.evaluate_network_access("https://evil.example.com/x")
    assert result == "deny"
    key = na.normalize_net_key("https://evil.example.com/x")
    assert ap.check(key, na.KIND_NET) is None
    assert ap.stats()["total"] == 0


# =============================================================================
# ⑥ 无 requester → 'deny'
# =============================================================================


def test_no_requester_is_deny():
    na.set_requester(None)
    result = na.evaluate_network_access("https://api.openai.com/v1")
    assert result == "deny"


# =============================================================================
# ⑦ 持久层 check 抛异常 → 仍走 requester(fail-closed)
# =============================================================================


def test_persistence_check_exception_falls_through_to_requester():
    calls: list[object] = []
    na.set_requester(lambda req: calls.append(req) or True)

    with patch.object(ap, "check", side_effect=RuntimeError("db broken")):
        result = na.evaluate_network_access("https://api.openai.com/v1")
    # 异常按未命中 → 仍征询 requester → 批准 → allow
    assert result == "allow"
    assert len(calls) == 1


# =============================================================================
# ⑧ ttl 到期恢复弹批(ttl_seconds=0 触发,无 sleep)
# =============================================================================


def test_ttl_zero_expiry_re_prompts():
    calls: list[object] = []
    rec = lambda req: calls.append(req) or True  # noqa: E731

    gate = na.NetworkApprovalGate(requester=rec, ttl_seconds=0)
    # 第一次:批准并落盘(ttl=0 → expires_at 落在本秒)
    assert gate.evaluate("https://api.openai.com/v1") == "allow"
    assert len(calls) == 1
    # 第二次 check 时 session 记录已过期(被顺手删除) → 再次征询 requester
    assert gate.evaluate("https://api.openai.com/v1") == "allow"
    assert len(calls) == 2


def test_request_from_url_parses_triple():
    req = na.NetworkApprovalRequest.from_url("http://example.com:8080/p")
    assert req.host == "example.com"
    assert req.port == 8080
    assert req.protocol == "http"
    assert req.target == "http://example.com:8080/p"

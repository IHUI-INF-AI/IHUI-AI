# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58(十六):网络审批拒绝原因码 + codex 可读文案接线测试。

对标 codex network_policy_decision.rs:deny 分支透出机器原因码,
并翻译为"为什么不能在此放行"的可读消息。
"""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.core.network_policy_decision import denied_network_policy_message  # noqa: E402
from app.services import network_approval  # noqa: E402
from app.services.mcp_server import _network_denial_message  # noqa: E402
from app.services.network_approval import (  # noqa: E402
    NetworkApprovalGate,
    _unparsable_denial_reason,
)


@pytest.fixture(autouse=True)
def _isolated_persistence(tmp_path):
    """隔离审批持久层:避免测试间授权缓存串味(批准后同 target 免弹)。"""
    network_approval.set_db_path(str(tmp_path / "net_approval.db"))
    yield
    network_approval.set_db_path(None)


# --- 原因码分类 ---


def test_unparsable_loopback_is_local():
    assert _unparsable_denial_reason("http://127.0.0.1:9/x") == "not_allowed_local"
    assert _unparsable_denial_reason("localhost") == "not_allowed_local"


def test_unparsable_private_ip_is_local():
    assert _unparsable_denial_reason("http://192.168.1.5/x") == "not_allowed_local"
    assert _unparsable_denial_reason("http://10.0.0.1") == "not_allowed_local"


def test_unparsable_public_host_is_not_allowed():
    assert _unparsable_denial_reason("https://example.com/x") == "not_allowed"


def test_unparsable_empty_is_not_allowed():
    assert _unparsable_denial_reason("") == "not_allowed"


def test_dot_local_domain_is_local():
    assert _unparsable_denial_reason("printer.local") == "not_allowed_local"


# --- 门行为:evaluate 与 evaluate_detailed 结果一致 ---


def test_gate_deny_without_requester_reports_denied():
    gate = NetworkApprovalGate(requester=None)
    verdict, denial = gate.evaluate_detailed("https://example.com/x")
    assert verdict == "deny"
    assert denial == "denied"
    # 旧接口逐字节等价
    assert gate.evaluate("https://example.com/x") == "deny"


def test_gate_deny_on_requester_reject_reports_denied():
    gate = NetworkApprovalGate(requester=lambda _req: False)
    verdict, denial = gate.evaluate_detailed("https://example.com/x")
    assert (verdict, denial) == ("deny", "denied")


def test_gate_allow_has_no_denial_reason():
    gate = NetworkApprovalGate(requester=lambda _req: True)
    verdict, denial = gate.evaluate_detailed("https://example.com/x")
    assert verdict == "allow"
    assert denial is None


def test_gate_unparsable_target_reports_local_or_not_allowed():
    """非法端口触发 target 解析失败 → deny + 原因码(此时 requester 不参与)。"""
    gate = NetworkApprovalGate(requester=lambda _req: True)
    verdict, denial = gate.evaluate_detailed("http://example.com:99999/x")
    assert verdict == "deny"
    assert denial == "not_allowed"


def test_gate_loopback_unparsable_reports_local_code():
    gate = NetworkApprovalGate(requester=lambda _req: True)
    verdict, denial = gate.evaluate_detailed("http://127.0.0.1:99999/x")
    assert verdict == "deny"
    assert denial == "not_allowed_local"


def test_old_evaluate_signature_unchanged():
    gate = NetworkApprovalGate(requester=None)
    assert gate.evaluate("https://fresh-host-58.example/x") == "deny"


# --- 可读消息(mcp_server 侧接线) ---


def test_network_denial_message_contains_reason_detail():
    msg = _network_denial_message("not_allowed", "https://example.com/x")
    assert "example.com" in msg
    assert "allowlist" in msg


def test_network_denial_message_local_variant():
    msg = _network_denial_message("not_allowed_local", "http://10.0.0.1")
    assert "local/private" in msg


def test_network_denial_message_denied_variant():
    msg = _network_denial_message("denied", "https://example.com/x")
    assert "explicitly denied" in msg


def test_network_denial_message_empty_host_generic():
    msg = _network_denial_message("denied", "")
    assert msg == "Network access was blocked by policy."


def test_network_denial_message_unknown_reason_generic_detail():
    msg = _network_denial_message("something_else", "https://example.com")
    assert "blocked by network policy" in msg


def test_network_denial_message_none_reason_defaults_denied():
    msg = _network_denial_message(None, "https://example.com")
    assert "explicitly denied" in msg


def test_codex_message_shape_matches_codex_module():
    """mcp_server 侧文案由 codex 模块同一函数产出(单一真源)。"""
    assert _network_denial_message("denied", "a.com") == denied_network_policy_message(
        "denied", "a.com"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

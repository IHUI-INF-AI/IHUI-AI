"""网络策略修正案模块测试(2026-09-20 第二十九批,对标 codex network_policy_decision_tests.rs)。

运行:cd apps/ai-service && G:/IHUI-AI/apps/ai-service/.venv/Scripts/python.exe -m pytest tests/test_network_rule_amendments_58.py -q --noconftest
"""

from __future__ import annotations

import hashlib
import os

from app.core import instructional_fragments
from app.core import network_rule_amendments as nra
from app.core.network_rule_amendments import (
    ExecPolicyNetworkRuleAmendment,
    NetworkApprovalContext,
    NetworkApprovalProtocol,
    NetworkPolicyAmendment,
    NetworkPolicyRuleAction,
    execpolicy_network_rule_amendment,
    network_approval_context_from_payload,
    network_rule_saved_body,
    network_rule_saved_fragment,
)


def _amend_ctx(action: NetworkPolicyRuleAction, protocol: NetworkApprovalProtocol, host: str):
    return (
        NetworkPolicyAmendment(host=host, action=action),
        NetworkApprovalContext(host=host, protocol=protocol),
        host,
    )


# ---------------------------------------------------------------------------
# A. NetworkApprovalProtocol.protocol_label (对标 network_policy_decision.rs:89-94)
# ---------------------------------------------------------------------------
def test_protocol_label_http():
    assert NetworkApprovalProtocol.HTTP.protocol_label() == "http"


def test_protocol_label_https_is_https_connect():
    # 注意:https 的 label 是 https_connect,与协议串 https 不同
    assert NetworkApprovalProtocol.HTTPS.protocol_label() == "https_connect"


def test_protocol_label_socks5_tcp():
    assert NetworkApprovalProtocol.SOCKS5_TCP.protocol_label() == "socks5_tcp"


def test_protocol_label_socks5_udp():
    assert NetworkApprovalProtocol.SOCKS5_UDP.protocol_label() == "socks5_udp"


# ---------------------------------------------------------------------------
# B. execpolicy_network_rule_amendment 八组 (4 协议 × 2 动作)
#    对标 network_policy_decision.rs:74-102
# ---------------------------------------------------------------------------
def test_execpolicy_allow_http():
    a, c, h = _amend_ctx(NetworkPolicyRuleAction.ALLOW, NetworkApprovalProtocol.HTTP, "api.github.com")
    r = execpolicy_network_rule_amendment(a, c, h)
    assert r.decision == "allow"
    assert r.justification == "Allow http access to api.github.com"
    assert r.protocol is NetworkApprovalProtocol.HTTP


def test_execpolicy_allow_https():
    a, c, h = _amend_ctx(NetworkPolicyRuleAction.ALLOW, NetworkApprovalProtocol.HTTPS, "api.github.com")
    r = execpolicy_network_rule_amendment(a, c, h)
    assert r.decision == "allow"
    assert r.justification == "Allow https_connect access to api.github.com"


def test_execpolicy_allow_socks5_tcp():
    a, c, h = _amend_ctx(NetworkPolicyRuleAction.ALLOW, NetworkApprovalProtocol.SOCKS5_TCP, "1.2.3.4")
    r = execpolicy_network_rule_amendment(a, c, h)
    assert r.decision == "allow"
    assert r.justification == "Allow socks5_tcp access to 1.2.3.4"


def test_execpolicy_allow_socks5_udp():
    a, c, h = _amend_ctx(NetworkPolicyRuleAction.ALLOW, NetworkApprovalProtocol.SOCKS5_UDP, "1.2.3.4")
    r = execpolicy_network_rule_amendment(a, c, h)
    assert r.decision == "allow"
    assert r.justification == "Allow socks5_udp access to 1.2.3.4"


def test_execpolicy_deny_http():
    a, c, h = _amend_ctx(NetworkPolicyRuleAction.DENY, NetworkApprovalProtocol.HTTP, "api.github.com")
    r = execpolicy_network_rule_amendment(a, c, h)
    assert r.decision == "forbidden"
    assert r.justification == "Deny http access to api.github.com"


def test_execpolicy_deny_https():
    a, c, h = _amend_ctx(NetworkPolicyRuleAction.DENY, NetworkApprovalProtocol.HTTPS, "api.github.com")
    r = execpolicy_network_rule_amendment(a, c, h)
    assert r.decision == "forbidden"
    assert r.justification == "Deny https_connect access to api.github.com"


def test_execpolicy_deny_socks5_tcp():
    a, c, h = _amend_ctx(NetworkPolicyRuleAction.DENY, NetworkApprovalProtocol.SOCKS5_TCP, "1.2.3.4")
    r = execpolicy_network_rule_amendment(a, c, h)
    assert r.decision == "forbidden"
    assert r.justification == "Deny socks5_tcp access to 1.2.3.4"


def test_execpolicy_deny_socks5_udp():
    a, c, h = _amend_ctx(NetworkPolicyRuleAction.DENY, NetworkApprovalProtocol.SOCKS5_UDP, "1.2.3.4")
    r = execpolicy_network_rule_amendment(a, c, h)
    assert r.decision == "forbidden"
    assert r.justification == "Deny socks5_udp access to 1.2.3.4"


def test_execpolicy_codex_specific_case():
    # 对标 network_policy_decision_tests.rs::
    # execpolicy_network_rule_amendment_maps_protocol_action_and_justification
    amendment = NetworkPolicyAmendment(host="example.com", action=NetworkPolicyRuleAction.DENY)
    context = NetworkApprovalContext(host="example.com", protocol=NetworkApprovalProtocol.SOCKS5_UDP)
    r = execpolicy_network_rule_amendment(amendment, context, "example.com")
    assert r == ExecPolicyNetworkRuleAmendment(
        protocol=NetworkApprovalProtocol.SOCKS5_UDP,
        decision="forbidden",
        justification="Deny socks5_udp access to example.com",
    )


# ---------------------------------------------------------------------------
# C. network_approval_context_from_payload
#    对标 network_policy_decision_tests.rs::
#    network_approval_context_requires_ask_from_decider
#    network_approval_context_maps_http_https_and_socks_protocols
# ---------------------------------------------------------------------------
def test_context_requires_ask_from_decider():
    # 非 ask-from-decider -> None
    assert (
        network_approval_context_from_payload(
            protocol="https", host="example.com", is_ask_from_decider=False
        )
        is None
    )


def test_context_protocol_missing():
    assert (
        network_approval_context_from_payload(
            protocol=None, host="example.com", is_ask_from_decider=True
        )
        is None
    )


def test_context_host_missing():
    assert (
        network_approval_context_from_payload(
            protocol="https", host=None, is_ask_from_decider=True
        )
        is None
    )


def test_context_host_blank():
    assert (
        network_approval_context_from_payload(
            protocol="https", host="   ", is_ask_from_decider=True
        )
        is None
    )


def test_context_normal_http():
    ctx = network_approval_context_from_payload(
        protocol="http", host="example.com", is_ask_from_decider=True
    )
    assert ctx == NetworkApprovalContext(host="example.com", protocol=NetworkApprovalProtocol.HTTP)


def test_context_normal_https():
    ctx = network_approval_context_from_payload(
        protocol="https", host="example.com", is_ask_from_decider=True
    )
    assert ctx == NetworkApprovalContext(host="example.com", protocol=NetworkApprovalProtocol.HTTPS)


def test_context_normal_socks5_tcp():
    ctx = network_approval_context_from_payload(
        protocol="socks5_tcp", host="example.com", is_ask_from_decider=True
    )
    assert ctx == NetworkApprovalContext(host="example.com", protocol=NetworkApprovalProtocol.SOCKS5_TCP)


def test_context_normal_socks5_udp():
    ctx = network_approval_context_from_payload(
        protocol="socks5_udp", host="example.com", is_ask_from_decider=True
    )
    assert ctx == NetworkApprovalContext(host="example.com", protocol=NetworkApprovalProtocol.SOCKS5_UDP)


def test_context_host_is_stripped_not_normalized():
    # 返回裸 host.strip(),不改大小写
    ctx = network_approval_context_from_payload(
        protocol="http", host="  Example.COM  ", is_ask_from_decider=True
    )
    assert ctx is not None
    assert ctx.host == "Example.COM"


def test_context_https_connect_alias():
    # 等价 codex 反序列化别名 https_connect -> HTTPS
    ctx = network_approval_context_from_payload(
        protocol="https_connect", host="example.com", is_ask_from_decider=True
    )
    assert ctx is not None
    assert ctx.protocol is NetworkApprovalProtocol.HTTPS


def test_context_http_connect_alias():
    ctx = network_approval_context_from_payload(
        protocol="http-connect", host="example.com", is_ask_from_decider=True
    )
    assert ctx is not None
    assert ctx.protocol is NetworkApprovalProtocol.HTTPS


# ---------------------------------------------------------------------------
# D. network_rule_saved_body (对标 network_rule_saved.rs::body)
# ---------------------------------------------------------------------------
def test_network_rule_saved_body_allow():
    assert (
        network_rule_saved_body(NetworkPolicyRuleAction.ALLOW, "api.github.com")
        == "Allowed network rule saved in execpolicy (allowlist): api.github.com"
    )


def test_network_rule_saved_body_deny():
    assert (
        network_rule_saved_body(NetworkPolicyRuleAction.DENY, "1.2.3.4")
        == "Denied network rule saved in execpolicy (denylist): 1.2.3.4"
    )


def test_network_rule_saved_body_accepts_string():
    assert (
        network_rule_saved_body("allow", "api.github.com")
        == "Allowed network rule saved in execpolicy (allowlist): api.github.com"
    )


# ---------------------------------------------------------------------------
# E. network_rule_saved_fragment 片段契约
#    对标 network_rule_saved.rs::content_kind/role/markers/body
# ---------------------------------------------------------------------------
def test_fragment_role_is_developer():
    frag = network_rule_saved_fragment(NetworkPolicyRuleAction.ALLOW, "api.github.com")
    assert frag["role"] == "developer"


def test_fragment_markers_empty():
    # markers 为 ("",""):正文不被包裹,text 直接等于 body
    frag = network_rule_saved_fragment(NetworkPolicyRuleAction.ALLOW, "api.github.com")
    text = frag["content"][0]["text"]
    assert text == network_rule_saved_body(NetworkPolicyRuleAction.ALLOW, "api.github.com")


def test_fragment_content_kind():
    assert instructional_fragments.CONTENT_KIND_NETWORK_RULE_SAVED == "network_proxy.rule_saved"


def test_fragment_body_matches_rule_saved():
    frag = network_rule_saved_fragment(NetworkPolicyRuleAction.DENY, "1.2.3.4")
    text = frag["content"][0]["text"]
    assert text == "Denied network rule saved in execpolicy (denylist): 1.2.3.4"


# ---------------------------------------------------------------------------
# F. 水印头逐字节一致 (对标 rollout_budget.py 前 3 行)
# ---------------------------------------------------------------------------
def _head3_md5(path: str) -> str:
    with open(path, "r", newline="", encoding="utf-8") as f:
        raw = f.read()
    head3 = "\n".join(raw.split("\n")[:3]) + "\n"
    return hashlib.md5(head3.encode("utf-8")).hexdigest()


def test_watermark_md5_matches_rollout_budget():
    here = os.path.dirname(os.path.abspath(__file__))
    new_path = os.path.join(here, "..", "app", "core", "network_rule_amendments.py")
    ref_path = os.path.join(here, "..", "app", "core", "rollout_budget.py")
    expected = "f7421cf7680c54ba9dc3a2d054f7fd98"
    assert _head3_md5(new_path) == expected
    assert _head3_md5(new_path) == _head3_md5(ref_path)

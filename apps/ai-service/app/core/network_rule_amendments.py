# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""网络策略修正案(2026-09-20 第二十九批,对标 Codex approvals.rs / network_policy_decision.rs / context/network_rule_saved.rs)。

逐条移植 codex 网络策略修正案语义:

- ``NetworkPolicyRuleAction`` / ``NetworkApprovalProtocol`` /
  ``NetworkPolicyAmendment`` / ``NetworkApprovalContext``
  (对标 codex_protocol::approvals,见 protocol/src/approvals.rs:62-186)
- ``execpolicy_network_rule_amendment`` / ``network_approval_context_from_payload``
  (对标 core/src/network_policy_decision.rs:26-102)
- ``network_rule_saved_body`` / ``network_rule_saved_fragment``
  (对标 core/src/context/network_rule_saved.rs:38-48)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from . import instructional_fragments

# https_connect / http-connect 是 codex 反序列化时的协议别名(approvals.rs:68),
# 对标层仍把其归一为 HTTPS,与 codex serde alias 行为一致。
_PROTOCOL_ALIASES = {"https_connect": "https", "http-connect": "https"}


class NetworkPolicyRuleAction(StrEnum):
    """对标 codex_protocol::approvals::NetworkPolicyRuleAction(lowercase)。"""

    ALLOW = "allow"
    DENY = "deny"


class NetworkApprovalProtocol(StrEnum):
    """对标 codex_protocol::approvals::NetworkApprovalProtocol(snake_case)。"""

    HTTP = "http"
    HTTPS = "https"
    SOCKS5_TCP = "socks5_tcp"
    SOCKS5_UDP = "socks5_udp"

    def protocol_label(self) -> str:
        """对标 network_policy_decision.rs 中 protocol_label 映射。

        注意 HTTPS 的 label 是 ``https_connect``(与协议字符串 ``https`` 不同,
        codex 即如此,不要合并)。
        """
        if self is NetworkApprovalProtocol.HTTP:
            return "http"
        if self is NetworkApprovalProtocol.HTTPS:
            return "https_connect"
        if self is NetworkApprovalProtocol.SOCKS5_TCP:
            return "socks5_tcp"
        return "socks5_udp"


@dataclass(frozen=True)
class NetworkApprovalContext:
    """对标 codex_protocol::approvals::NetworkApprovalContext(host, protocol)。"""

    host: str
    protocol: NetworkApprovalProtocol


@dataclass(frozen=True)
class NetworkPolicyAmendment:
    """对标 codex_protocol::approvals::NetworkPolicyAmendment(host, action)。"""

    host: str
    action: NetworkPolicyRuleAction


@dataclass(frozen=True)
class ExecPolicyNetworkRuleAmendment:
    """对标 core/src/network_policy_decision.rs::ExecPolicyNetworkRuleAmendment。"""

    protocol: NetworkApprovalProtocol
    decision: str
    justification: str


def execpolicy_network_rule_amendment(
    amendment: NetworkPolicyAmendment,
    network_approval_context: NetworkApprovalContext,
    host: str,
) -> ExecPolicyNetworkRuleAmendment:
    """对标 core/src/network_policy_decision.rs::execpolicy_network_rule_amendment。

    - ``protocol`` 直接取 ``network_approval_context.protocol``
      (codex 把 NetworkApprovalProtocol 映射到 execpolicy 的 NetworkRuleProtocol,
      字段名一一对应);
    - ``decision`` + ``action_verb``: ALLOW->("allow","Allow")、DENY->("forbidden","Deny");
    - ``justification = f"{action_verb} {protocol_label} access to {host}"``。
    """
    # 对标:NetworkApprovalProtocol -> execpolicy NetworkRuleProtocol(1:1)
    protocol = network_approval_context.protocol
    # 对标:Allow->(Allow,"Allow");Deny->(Forbidden,"Deny")
    if amendment.action == NetworkPolicyRuleAction.ALLOW:
        decision, action_verb = "allow", "Allow"
    else:
        decision, action_verb = "forbidden", "Deny"
    justification = f"{action_verb} {protocol.protocol_label()} access to {host}"
    return ExecPolicyNetworkRuleAmendment(
        protocol=protocol,
        decision=decision,
        justification=justification,
    )


def network_approval_context_from_payload(
    *,
    protocol: str | None,
    host: str | None,
    is_ask_from_decider: bool,
) -> NetworkApprovalContext | None:
    """对标 core/src/network_policy_decision.rs::network_approval_context_from_payload。

    入参设计成显式关键字参数,由调用方从自己的 payload 结构取值:
    - 非 ask-from-decider 的决策 -> None;
    - ``protocol`` 缺失 -> None;
    - ``host`` 缺失或 ``strip()`` 后为空 -> None;
    - 否则返回裸 ``host.strip()``(不归一化、不改大小写)。
    """
    if not is_ask_from_decider:
        return None
    if protocol is None:
        return None
    if host is None:
        return None
    host_clean = host.strip()
    if not host_clean:
        return None
    # 调用方已把协议解析为字符串;归一 https_connect/http-connect 别名后构造枚举。
    proto_value = _PROTOCOL_ALIASES.get(protocol, protocol)
    proto_enum = NetworkApprovalProtocol(proto_value)
    return NetworkApprovalContext(host=host_clean, protocol=proto_enum)


def network_rule_saved_body(action: NetworkPolicyRuleAction | str, host: str) -> str:
    """对标 core/src/context/network_rule_saved.rs::body。

    Allow->("Allowed","allowlist");Deny->("Denied","denylist")。
    """
    action_norm = (
        action
        if isinstance(action, NetworkPolicyRuleAction)
        else NetworkPolicyRuleAction(action)
    )
    if action_norm == NetworkPolicyRuleAction.ALLOW:
        verb, list_name = "Allowed", "allowlist"
    else:
        verb, list_name = "Denied", "denylist"
    return f"{verb} network rule saved in execpolicy ({list_name}): {host}"


def network_rule_saved_fragment(
    action: NetworkPolicyRuleAction | str, host: str
) -> dict[str, Any]:
    """薄封装:委托 instructional_fragments.build_network_rule_saved_fragment。

    该构造器签名为 ``(action: str, host: str)``,此处把枚举归一为小写字串传入。
    """
    action_str = action.value if isinstance(action, NetworkPolicyRuleAction) else str(action)
    return instructional_fragments.build_network_rule_saved_fragment(action_str, host)

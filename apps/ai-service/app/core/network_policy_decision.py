# app/core/network_policy_decision.py
"""网络策略拒绝的用户可读消息(2026-09-19 第二十七批,对标 Codex network_policy_decision.rs)。

沙箱/代理层拒绝网络访问时,拒绝原因(reason)是机器码;本模块把它翻译成
模型与用户都能理解、且指明"为什么不能从本提示批准"的可读消息:

- 显式拒绝(denied)明确告知"不可从此提示批准",避免模型反复重试;
- 未列入允许名单 / 本地私网地址 / 请求方法受限 / 代理未启用各有专属文案;
- 主机名缺失时退化为通用文案。

另含 ``parse_network_decision``(deny/ask 白名单解析,未知值安全返回 None,
绝不把未知策略猜成放行)。
"""

from __future__ import annotations

from typing import Optional


def parse_network_decision(value: Optional[str]) -> Optional[str]:
    """解析策略决定字符串;仅接受 deny/ask,未知返回 None(安全默认)。"""
    if value == "deny":
        return "deny"
    if value == "ask":
        return "ask"
    return None


_REASON_DETAIL = {
    "denied": "domain is explicitly denied by policy and cannot be approved from this prompt",
    "not_allowed": "domain is not on the allowlist for the current sandbox mode",
    "not_allowed_local": "local/private network addresses are blocked by the sandbox policy",
    "method_not_allowed": "request method is blocked by the current network mode",
    "proxy_disabled": "network proxy is disabled",
}


def denied_network_policy_message(reason: str, host: Optional[str]) -> str:
    """构造拒绝消息(对标 denied_network_policy_message)。"""
    host_clean = (host or "").strip()
    detail = _REASON_DETAIL.get(reason, "request is blocked by network policy")
    if not host_clean:
        return "Network access was blocked by policy."
    return f'Network access to "{host_clean}" was blocked: {detail}.'


def should_surface_as_ask(payload_decision: Optional[str], is_ask_from_decider: bool) -> bool:
    """该 payload 是否应作为"询问用户"上报(仅 decider 主动 ask 才上报)。"""
    return bool(is_ask_from_decider) and parse_network_decision(payload_decision) == "ask"

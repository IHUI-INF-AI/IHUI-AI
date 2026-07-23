"""网络出站白名单检查(P1-5,executor 入口拦截)。

注意:这是应用层软检查,只能拦截通过本模块发起的 HTTP 请求。
完整网络隔离需 OS 沙箱(Linux network namespace / Windows WFP),本模块不提供。

接入方式(dag_scheduler._worker_loop):
  1. executor 启动前用 set_current_policy(policy) 注入策略到 contextvar
  2. executor 内部 HTTP 客户端调用 check_current(url) 校验出站请求
  3. executor 完成后 reset_current_policy(token) 清理
"""

from __future__ import annotations

import contextvars
import fnmatch
import ipaddress
import logging
import re
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# 当前任务的网络策略 contextvar(asyncio.create_task 自动复制 context,executor Task 可读)
_current_policy: contextvars.ContextVar = contextvars.ContextVar(
    "network_egress_policy", default=None
)


@dataclass
class NetworkEgressPolicy:
    """网络出站策略(对齐 agent-runtime.ts NetworkEgressPolicy)。

    mode:
        - 'open': 不限制(默认)
        - 'allowlist': 只允许白名单域名(其他全部拒绝)
        - 'blocklist': 拒绝黑名单域名
    """

    mode: str = "open"
    domains: list[str] = field(default_factory=list)
    allow_localhost: bool = True

    def check(self, url: str) -> tuple[bool, str]:
        """检查 URL 是否允许访问。

        Returns:
            (allowed, reason)
        """
        if self.mode == "open":
            return True, "open mode"

        # 缺陷 1 修复:未知 mode FAIL-CLOSED(与 TS 端 checkEgress 对齐)
        if self.mode not in ("allowlist", "blocklist"):
            return False, f"unknown mode: {self.mode}"

        try:
            parsed = urlparse(url)
            host = parsed.hostname or ""
            if not host:
                return False, "无法解析 hostname"

            # 缺陷 2 修复:非 http/https 协议拒绝(与 TS 端 checkEgress 对齐)
            if parsed.scheme not in ("http", "https"):
                return False, f"non-http protocol: {parsed.scheme}://"

            # localhost 检查
            if self._is_localhost(host):
                if self.allow_localhost:
                    return True, "localhost allowed"
                return False, "localhost blocked by policy"

            # IP 地址检查(allowlist 模式下 IP 默认拒绝,除非显式在白名单)
            if self._is_ip(host):
                if self.mode == "allowlist":
                    return False, f"IP {host} not in allowlist (IPs blocked by default)"
                # blocklist: IP 不在黑名单则允许
                return not self._match_domains(host), f"IP {host}"

            # 域名匹配
            if self.mode == "allowlist":
                if self._match_domains(host):
                    return True, f"{host} matches allowlist"
                return False, f"{host} not in allowlist"
            elif self.mode == "blocklist":
                if self._match_domains(host):
                    return False, f"{host} matches blocklist"
                return True, f"{host} not in blocklist"
        except Exception as e:  # noqa: BLE001
            logger.warning("网络策略检查异常: %s, url=%s", e, url)
            return False, f"check error: {e}"

    def _match_domains(self, host: str) -> bool:
        """检查 host 是否匹配域名列表(支持通配符 *.example.com)。"""
        for domain in self.domains:
            if domain.startswith("*"):
                # 通配符:*.example.com 匹配 sub.example.com,不匹配裸域 example.com
                pattern = domain[1:]  # 去掉 * → .example.com
                if host.endswith(pattern) and len(host) > len(pattern):
                    return True
            elif fnmatch.fnmatch(host, domain):
                return True
            elif host == domain:
                return True
        return False

    def _is_localhost(self, host: str) -> bool:
        """检查是否是 localhost / loopback 地址(与 TS 端 isLocalhost 对齐)。"""
        h = host.lower().strip("[]")  # 去除 IPv6 方括号 [::1] → ::1
        if h == "localhost":
            return True
        # IPv4 127/8 整段(loopback 网段,不只 127.0.0.1)
        if h.startswith("127."):
            return True
        # IPv6 loopback 各种形式
        if h in ("::1", "0:0:0:0:0:0:0:1", "::ffff:127.0.0.1", "0:0:0:0:0:0:ffff:7f00:1"):
            return True
        # 0.0.0.0(监听所有接口,视为本地)
        if h == "0.0.0.0":
            return True
        return False

    def _is_ip(self, host: str) -> bool:
        """检查是否是 IP 地址。"""
        try:
            ipaddress.ip_address(host)
            return True
        except ValueError:
            return False


def from_config(config: Optional[dict]) -> Optional[NetworkEgressPolicy]:
    """从 WorkerPoolConfig.network_egress_policy 字典创建策略。

    config 示例:
        {"mode": "allowlist", "domains": ["api.openai.com", "*.anthropic.com"]}
    """
    if config is None:
        return None
    mode = config.get("mode", "open")
    if mode == "open":
        return None
    return NetworkEgressPolicy(
        mode=mode,
        domains=config.get("domains", []),
        allow_localhost=config.get("allow_localhost", True),
    )


def set_current_policy(policy):
    """设置当前任务的网络策略(在 executor 启动前调用)。

    Returns: token,executor 完成后用 reset_current_policy(token) 清理。
    """
    return _current_policy.set(policy)


def reset_current_policy(token) -> None:
    """清理 contextvar(在 executor finally 块调用)。"""
    _current_policy.reset(token)


def get_current_policy():
    """获取当前任务的网络策略(executor 内部 HTTP 客户端调用)。"""
    return _current_policy.get()


def check_current(url: str) -> tuple[bool, str]:
    """检查当前 contextvar 中的策略是否允许访问 url。

    无策略时返回 (True, "no policy")。
    executor 内部的 HTTP 客户端应在每次出站请求前调用本函数。
    """
    policy = _current_policy.get()
    if policy is None:
        return True, "no policy"
    return policy.check(url)

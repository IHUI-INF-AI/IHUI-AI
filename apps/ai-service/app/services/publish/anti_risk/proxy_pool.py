"""代理池 — 每账号绑定固定住宅 IP,反交叉检测核心。

反风控核心:平台通过 IP 识别"是否同一网络/同一设备"。
如果所有账号用同 IP → 平台判定"同一网络操作多账号"→ 关联封号。
如果同账号换 IP → 平台判定"异地登录"→ 触发安全告警。
本模块确保:同账号永远同 IP(跨会话稳定),不同账号不同 IP(零关联)。

代理类型要求:
- ✅ 住宅代理(Residential):真实家宽 IP,最隐蔽,推荐
- ✅ 移动代理(Mobile):4G/5G IP,隐蔽性最高,推荐
- ❌ 数据中心代理(Datacenter):秒被识别,禁用

配置方式(优先级):
1. DB 持久化(账号→代理映射,跨会话稳定)— TODO 待接入 DB
2. 环境变量 ANTI_RISK_PROXY_CONFIG(JSON 数组,启动加载)
3. 内存分配(首次请求时从池中分配并缓存)

诚实说明:本模块只做"代理路由",不提供代理 IP。
用户需自行购买住宅代理(快代理/芝麻代理/Luminati 等),通过环境变量或 DB 注入。
"""
from __future__ import annotations

import json
import logging
import os
import random
import threading
from dataclasses import dataclass
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class ProxyConfig:
    """单个代理配置。"""

    server: str  # "http://ip:port" 或 "socks5://ip:port"
    username: str | None = None
    password: str | None = None
    proxy_type: str = "http"  # 'http' | 'socks5'
    # 代理地理位置(应与账号指纹 timezone/geolocation 匹配)
    region: str = "cn"  # 'cn' | 'hk' | 'us' 等

    def to_playwright_proxy(self) -> dict[str, str]:
        """转换为 Playwright browser.launch(proxy=...) 参数。"""
        proxy: dict[str, str] = {"server": self.server}
        if self.username:
            proxy["username"] = self.username
        if self.password:
            proxy["password"] = self.password
        return proxy

    def is_datacenter(self) -> bool:
        """粗略判断是否数据中心 IP(机房段)。

        仅做常见机房 IP 段检测,不保证准确。
        真正的住宅/机房识别需通过 IP 库(如 ipinfo.io)。
        """
        # 常见云厂商 IP 段前缀(粗略)
        datacenter_prefixes = (
            "47.92.", "47.93.", "47.94.", "47.95.", "47.96.",  # 阿里云
            "39.104.", "39.105.", "39.106.",  # 阿里云
            "49.232.", "49.233.", "49.234.",  # 腾讯云
            "129.226.",  # 腾讯云
            "121.37.", "121.36.",  # 华为云
            "139.9.", "139.196.",  # 华为云/阿里云
        )
        # 从 server 提取 IP
        server = self.server
        for prefix in ("http://", "https://", "socks5://", "socks4://"):
            if server.startswith(prefix):
                server = server[len(prefix):]
                break
        # 去掉端口和认证
        server = server.split("@")[-1].split(":")[0]
        return server.startswith(datacenter_prefixes)


class ProxyPool:
    """代理池:管理账号→代理映射,确保同账号同代理、不同账号不同代理。

    线程安全(多适配器并行发布时共享同一池)。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # 账号 ID → 代理配置(持久映射)
        self._account_proxy: dict[str, ProxyConfig] = {}
        # 可用代理池(未分配的)
        self._available: list[ProxyConfig] = []
        # 已分配的代理(用于避免重复分配)
        self._assigned_servers: set[str] = set()
        self._initialized = False

    def _ensure_initialized(self) -> None:
        """惰性初始化:从环境变量加载代理配置。"""
        if self._initialized:
            return
        with self._lock:
            if self._initialized:
                return
            config_env = os.environ.get("ANTI_RISK_PROXY_CONFIG", "")
            if config_env:
                try:
                    configs = json.loads(config_env)
                    for cfg in configs:
                        proxy = ProxyConfig(
                            server=cfg.get("server", ""),
                            username=cfg.get("username"),
                            password=cfg.get("password"),
                            proxy_type=cfg.get("type", "http"),
                            region=cfg.get("region", "cn"),
                        )
                        if proxy.server and not proxy.is_datacenter():
                            self._available.append(proxy)
                        elif proxy.server and proxy.is_datacenter():
                            logger.warning(
                                "[proxy_pool] 跳过数据中心代理(易被识别): %s",
                                proxy.server,
                            )
                except (json.JSONDecodeError, KeyError) as e:
                    logger.error("[proxy_pool] 代理配置解析失败: %s", e)
            if not self._available:
                logger.warning(
                    "[proxy_pool] 未配置住宅代理(ANTI_RISK_PROXY_CONFIG 为空),"
                    "将使用直连 — 反风控能力降级,六大号平台不建议使用"
                )
            self._initialized = True
            logger.info(
                "[proxy_pool] 初始化完成:可用代理 %d 个",
                len(self._available),
            )

    def get_proxy(self, account_id: str) -> ProxyConfig | None:
        """获取账号绑定的代理(同账号永远返回同一代理)。

        首次请求时从可用池中分配一个并持久绑定。
        池空时返回 None(直连,反风控降级)。
        """
        self._ensure_initialized()
        with self._lock:
            # 已绑定 → 直接返回
            existing = self._account_proxy.get(account_id)
            if existing:
                return existing
            # 未绑定 → 从可用池分配
            if not self._available:
                return None
            # 随机选一个(避免按顺序分配产生规律)
            idx = random.randint(0, len(self._available) - 1)
            proxy = self._available.pop(idx)
            self._account_proxy[account_id] = proxy
            self._assigned_servers.add(proxy.server)
            logger.info(
                "[proxy_pool] 账号 %s 绑定代理 %s (region=%s)",
                account_id, proxy.server, proxy.region,
            )
            return proxy

    def assign_proxy(self, account_id: str, proxy: ProxyConfig) -> None:
        """手动绑定账号→代理(用于用户在 UI 指定某账号用某代理)。"""
        with self._lock:
            self._account_proxy[account_id] = proxy
            self._assigned_servers.add(proxy.server)
            # 如果代理在可用池中,移除
            self._available = [p for p in self._available if p.server != proxy.server]
            logger.info(
                "[proxy_pool] 账号 %s 手动绑定代理 %s",
                account_id, proxy.server,
            )

    def release_proxy(self, account_id: str) -> None:
        """释放账号代理绑定(账号删除时调用,代理回收到可用池)。"""
        with self._lock:
            proxy = self._account_proxy.pop(account_id, None)
            if proxy:
                self._assigned_servers.discard(proxy.server)
                self._available.append(proxy)
                logger.info(
                    "[proxy_pool] 账号 %s 释放代理 %s",
                    account_id, proxy.server,
                )

    def stats(self) -> dict[str, int]:
        """返回代理池统计(可用/已分配/总数)。"""
        with self._lock:
            return {
                "available": len(self._available),
                "assigned": len(self._account_proxy),
                "total": len(self._available) + len(self._account_proxy),
            }


# ---------------------------------------------------------------------------
# 全局单例(多适配器共享同一代理池,确保分配不冲突)
# ---------------------------------------------------------------------------

_global_pool: ProxyPool | None = None
_global_pool_lock = threading.Lock()


def get_proxy_pool() -> ProxyPool:
    """获取全局代理池单例。"""
    global _global_pool
    if _global_pool is None:
        with _global_pool_lock:
            if _global_pool is None:
                _global_pool = ProxyPool()
    return _global_pool


__all__ = ["ProxyConfig", "ProxyPool", "get_proxy_pool"]

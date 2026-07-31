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

强化(2026-07-31):
- health_check():异步 ping 所有代理,标记失效 IP
- auto_evict():自动剔除连续 3 次健康检查失败的代理
- get_proxy_for_region(region):按区域匹配代理(华东/华南等)
- stats() -> ProxyPoolStats:返回池状态(总数/活跃/失效/平均响应时间)

诚实说明:本模块只做"代理路由",不提供代理 IP。
用户需自行购买住宅代理(快代理/芝麻代理/Luminati 等),通过环境变量或 DB 注入。
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import threading
import time
from dataclasses import asdict, dataclass
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


# 健康检查目标 URL(轻量、稳定、支持 HEAD)
_HEALTH_CHECK_URL = "https://www.baidu.com/"
# 健康检查超时(秒)
_HEALTH_CHECK_TIMEOUT = 10.0
# 自动剔除阈值(连续失败次数)
_EVICT_THRESHOLD = 3
# 健康检查并发数
_HEALTH_CHECK_CONCURRENCY = 8


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

    def server_host(self) -> str:
        """提取 server 的 host:port(去掉协议和认证)。"""
        s = self.server
        for prefix in ("http://", "https://", "socks5://", "socks4://"):
            if s.startswith(prefix):
                s = s[len(prefix):]
                break
        return s.split("@")[-1]


@dataclass
class ProxyPoolStats:
    """代理池统计状态。

    Attributes:
        total: 代理总数(可用 + 已分配 + 已剔除)
        available: 可用代理数(未分配)
        assigned: 已分配代理数(绑定到账号)
        evicted: 已剔除代理数(连续健康检查失败)
        failed: 当前标记为失效的代理数(未达剔除阈值)
        avg_response_ms: 平均响应时间(毫秒,0=未检测)
        last_health_check: 最后一次健康检查时间戳(0=未检查)
    """

    total: int = 0
    available: int = 0
    assigned: int = 0
    evicted: int = 0
    failed: int = 0
    avg_response_ms: float = 0.0
    last_health_check: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """转为 dict(向后兼容 stats() 调用方)。"""
        return asdict(self)


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
        # 健康检查追踪(2026-07-31 强化)
        # server_host -> 连续失败次数(达 _EVICT_THRESHOLD 即剔除)
        self._failure_counts: dict[str, int] = {}
        # server_host -> 最近响应时间(毫秒)
        self._response_times: dict[str, float] = {}
        # 已剔除的代理(不重新分配)
        self._evicted_servers: set[str] = set()
        # 最后一次健康检查时间戳
        self._last_health_check: float = 0.0

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

        注意:已剔除(连续健康检查失败)的代理不会重新分配,
        但已绑定到账号的代理不会被强制解除(避免同账号换 IP 触发异地登录告警)。
        """
        self._ensure_initialized()
        with self._lock:
            # 已绑定 → 直接返回
            existing = self._account_proxy.get(account_id)
            if existing:
                return existing
            # 未绑定 → 从可用池分配(过滤已剔除的)
            available_proxies = [
                p for p in self._available
                if p.server_host() not in self._evicted_servers
            ]
            if not available_proxies:
                return None
            # 随机选一个(避免按顺序分配产生规律)
            idx = random.randint(0, len(available_proxies) - 1)
            proxy = available_proxies[idx]
            self._available.remove(proxy)
            self._account_proxy[account_id] = proxy
            self._assigned_servers.add(proxy.server)
            logger.info(
                "[proxy_pool] 账号 %s 绑定代理 %s (region=%s)",
                account_id, proxy.server, proxy.region,
            )
            return proxy

    def get_proxy_for_region(self, region: str) -> ProxyConfig | None:
        """按区域匹配代理(如"华东"/"华南"/"cn"/"hk")。

        优先返回匹配 region 的未分配代理;无匹配时返回 None。
        匹配后的代理会从可用池移除(避免重复分配)。

        Args:
            region: 区域标识(如 "cn"/"hk"/"us" 或 "华东"/"华南")

        Returns:
            匹配的 ProxyConfig,无匹配返回 None
        """
        self._ensure_initialized()
        with self._lock:
            # 模糊匹配:region 包含或被包含
            for i, proxy in enumerate(self._available):
                if proxy.server_host() in self._evicted_servers:
                    continue
                if (region in proxy.region) or (proxy.region in region):
                    matched = self._available.pop(i)
                    self._assigned_servers.add(matched.server)
                    logger.info(
                        "[proxy_pool] 区域 %s 匹配代理 %s",
                        region, matched.server,
                    )
                    return matched
            return None

    async def health_check(self) -> dict[str, Any]:
        """异步 ping 所有可用代理,标记失效 IP。

        并发检查所有可用 + 已分配的代理,记录响应时间,
        失败的代理计入 _failure_counts。

        Returns:
            检查结果 dict:{"total": N, "healthy": M, "unhealthy": K,
            "avg_response_ms": float}
        """
        self._ensure_initialized()
        # 收集所有代理(可用 + 已分配,排除已剔除)
        with self._lock:
            all_proxies: list[ProxyConfig] = []
            all_proxies.extend(self._available)
            all_proxies.extend(
                p for p in self._account_proxy.values()
                if p.server_host() not in self._evicted_servers
            )

        if not all_proxies:
            logger.info("[proxy_pool] health_check: 无代理可检查")
            return {"total": 0, "healthy": 0, "unhealthy": 0, "avg_response_ms": 0.0}

        # 信号量限制并发
        sem = asyncio.Semaphore(_HEALTH_CHECK_CONCURRENCY)

        async def _check_one(proxy: ProxyConfig) -> tuple[str, bool, float]:
            """检查单个代理,返回 (server_host, is_healthy, response_ms)。"""
            async with sem:
                return await self._ping_proxy(proxy)

        # 并发检查所有代理
        results = await asyncio.gather(
            *[_check_one(p) for p in all_proxies],
            return_exceptions=False,
        )

        healthy = 0
        unhealthy = 0
        response_times: list[float] = []
        for server_host, is_healthy, response_ms in results:
            if is_healthy:
                healthy += 1
                response_times.append(response_ms)
                self._record_health_success(server_host, response_ms)
            else:
                unhealthy += 1
                self._record_health_failure(server_host)

        avg_ms = sum(response_times) / len(response_times) if response_times else 0.0
        self._last_health_check = time.time()

        logger.info(
            "[proxy_pool] health_check 完成: total=%d healthy=%d unhealthy=%d avg_ms=%.0f",
            len(all_proxies), healthy, unhealthy, avg_ms,
        )
        return {
            "total": len(all_proxies),
            "healthy": healthy,
            "unhealthy": unhealthy,
            "avg_response_ms": avg_ms,
        }

    async def _ping_proxy(self, proxy: ProxyConfig) -> tuple[str, bool, float]:
        """ping 单个代理,返回 (server_host, is_healthy, response_ms)。

        用 httpx 通过代理发起 HEAD 请求,返回是否健康 + 响应时间。
        超时/连接错误视为不健康。
        """
        try:
            import httpx
        except ImportError:
            # httpx 不可用,降级为 TCP 连通性检查
            return await self._tcp_check_proxy(proxy)

        server_host = proxy.server_host()
        proxy_dict = proxy.to_playwright_proxy()
        start = time.time()
        try:
            async with httpx.AsyncClient(
                proxy=proxy_dict["server"],
                timeout=_HEALTH_CHECK_TIMEOUT,
                verify=False,  # 代理证书可能自签,不验证
            ) as client:
                resp = await client.head(_HEALTH_CHECK_URL)
                response_ms = (time.time() - start) * 1000
                is_healthy = 200 <= resp.status_code < 400
                return (server_host, is_healthy, response_ms)
        except Exception as e:
            logger.debug(
                "[proxy_pool] ping %s 失败: %s: %s",
                server_host, type(e).__name__, e,
            )
            return (server_host, False, 0.0)

    async def _tcp_check_proxy(self, proxy: ProxyConfig) -> tuple[str, bool, float]:
        """TCP 连通性检查(httpx 不可用时的降级方案)。"""
        server_host = proxy.server_host()
        # 解析 host:port
        if ":" in server_host:
            host, port_str = server_host.rsplit(":", 1)
            try:
                port = int(port_str)
            except ValueError:
                host, port = server_host, 80
        else:
            host, port = server_host, 80

        start = time.time()
        try:
            # 用 asyncio 包装阻塞 socket
            future = asyncio.open_connection(host, port)
            _reader, writer = await asyncio.wait_for(future, timeout=_HEALTH_CHECK_TIMEOUT)
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            response_ms = (time.time() - start) * 1000
            return (server_host, True, response_ms)
        except (asyncio.TimeoutError, OSError, ConnectionError) as e:
            logger.debug(
                "[proxy_pool] TCP check %s 失败: %s: %s",
                server_host, type(e).__name__, e,
            )
            return (server_host, False, 0.0)

    def _record_health_success(self, server_host: str, response_ms: float) -> None:
        """记录健康检查成功(重置失败计数)。"""
        with self._lock:
            self._failure_counts.pop(server_host, None)
            self._response_times[server_host] = response_ms

    def _record_health_failure(self, server_host: str) -> None:
        """记录健康检查失败(累加失败计数)。"""
        with self._lock:
            self._failure_counts[server_host] = self._failure_counts.get(server_host, 0) + 1

    def auto_evict(self) -> list[str]:
        """自动剔除连续 3 次健康检查失败的代理。

        从可用池移除失效代理(防止分配给新账号);
        已绑定到账号的代理不会被强制解除(避免同账号换 IP 触发异地登录告警)。

        Returns:
            被剔除的代理 server_host 列表
        """
        self._ensure_initialized()
        evicted: list[str] = []
        with self._lock:
            for server_host, fail_count in list(self._failure_counts.items()):
                if fail_count >= _EVICT_THRESHOLD:
                    if server_host in self._evicted_servers:
                        continue
                    self._evicted_servers.add(server_host)
                    evicted.append(server_host)
                    # 从可用池移除
                    self._available = [
                        p for p in self._available
                        if p.server_host() != server_host
                    ]
                    logger.warning(
                        "[proxy_pool] 自动剔除代理 %s(连续 %d 次健康检查失败)",
                        server_host, fail_count,
                    )
        if evicted:
            logger.info("[proxy_pool] auto_evict 剔除 %d 个代理", len(evicted))
        return evicted

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

    def stats(self) -> ProxyPoolStats:
        """返回代理池统计(总数/活跃/失效/平均响应时间)。

        返回 ProxyPoolStats dataclass,可用 .to_dict() 转 dict(向后兼容)。
        """
        with self._lock:
            total = len(self._available) + len(self._account_proxy) + len(self._evicted_servers)
            # 失效(未达剔除阈值)的代理数
            failed = sum(
                1 for p in self._available + list(self._account_proxy.values())
                if p.server_host() in self._failure_counts
                and self._failure_counts[p.server_host()] > 0
                and p.server_host() not in self._evicted_servers
            )
            # 平均响应时间(仅健康代理)
            response_times = list(self._response_times.values())
            avg_ms = sum(response_times) / len(response_times) if response_times else 0.0
            return ProxyPoolStats(
                total=total,
                available=len(self._available),
                assigned=len(self._account_proxy),
                evicted=len(self._evicted_servers),
                failed=failed,
                avg_response_ms=avg_ms,
                last_health_check=self._last_health_check,
            )


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


__all__ = ["ProxyConfig", "ProxyPool", "ProxyPoolStats", "get_proxy_pool"]

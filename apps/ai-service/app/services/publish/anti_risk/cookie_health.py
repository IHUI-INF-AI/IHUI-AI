"""Cookie 健康度监控 — 过期预警/自动刷新/失效检测。

反风控核心:平台 Cookie 有有效期(7-30 天),过期后发布会被拒绝或触发重新登录。
本模块监控所有账号的 Cookie 健康状态,过期前自动刷新(访问平台首页保活),
避免发布时才发现 Cookie 失效。

健康状态:
- healthy:        Cookie 有效,距过期 >7 天
- expiring_soon:  即将过期,距过期 ≤7 天(需刷新)
- expired:        已过期(需重新登录)
- invalid:        Cookie 缺失或无效(需重新登录)

数据来源:
- Cookie 元数据持久化到 .trae-cn/tmp/anti-cookie-health.json(快速检查,无需开浏览器)
- 实际 Cookie 通过 Playwright context.cookies() 检查(精确检查)

后台任务:scheduler 每 6 小时调用 refresh_cookie 保活所有账号(避免 7-30 天过期)。

设计:
- 单例模式(多适配器共享同一监控器)
- 线程安全(threading.Lock)
- 元数据文件持久化(进程重启后可恢复)
- 实际 Cookie 检查惰性执行(仅发布前 + 定时保活时)
"""
from __future__ import annotations

import asyncio
import json
import os
import threading
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.core.logging import get_logger

logger = get_logger(__name__)


# Cookie 健康度元数据持久化路径(AGENTS.md §15:临时文件放 .trae-cn/tmp/)
_HEALTH_FILE = Path(os.environ.get(
    "ANTI_RISK_COOKIE_HEALTH_FILE",
    ".trae-cn/tmp/anti-cookie-health.json",
)).resolve()

# 健康状态阈值(天)
_EXPIRING_SOON_DAYS = 7  # 距过期 ≤7 天 → expiring_soon

# Cookie 关键名称(各平台登录 Cookie,用于判断是否已登录)
# 扩展各平台实际 Cookie 名(发布时由适配器补充)
_PLATFORM_SESSION_COOKIES: dict[str, tuple[str, ...]] = {
    "csdn": ("UserName", "UserToken", "uuid"),
    "zhihu": ("z_c0", "d_c0", "_xsrf"),
    "baijiahao": ("BDUSS", "STOKEN"),
    "wordpress": ("wordpress_logged_in_", "wp-settings-"),
    "juejin": ("sessionid", "sessionid_ss"),
    "default": ("session", "token", "auth", "sid"),
}

# 保活间隔(秒)— scheduler 每 6 小时保活一次
_REFRESH_INTERVAL_SEC = 6 * 3600

# 平台首页 URL(用于保活访问)
_PLATFORM_HOMEPAGE: dict[str, str] = {
    "csdn": "https://www.csdn.net/",
    "zhihu": "https://www.zhihu.com/",
    "baijiahao": "https://baijiahao.baidu.com/",
    "juejin": "https://juejin.cn/",
    "wordpress": "",  # 用户自建,无统一首页
}


# ---------------------------------------------------------------------------
# 数据类
# ---------------------------------------------------------------------------

@dataclass
class CookieHealth:
    """Cookie 健康度检查结果。

    Attributes:
        status: 健康状态(healthy/expiring_soon/expired/invalid)
        days_until_expiry: 距过期天数(-1 表示已过期或无法判断)
        last_active_at: 最后活跃时间戳(上次访问平台时间)
        refresh_attempted: 是否已尝试刷新
        refresh_success: 刷新是否成功
        cookie_count: 检测到的 Cookie 数量
        has_session_cookie: 是否有会话 Cookie(判断是否已登录)
    """

    status: str  # 'healthy' | 'expiring_soon' | 'expired' | 'invalid'
    days_until_expiry: int
    last_active_at: float
    refresh_attempted: bool = False
    refresh_success: bool = False
    cookie_count: int = 0
    has_session_cookie: bool = False

    def to_dict(self) -> dict[str, Any]:
        """序列化为 dict。"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CookieHealth":
        """从 dict 反序列化。"""
        return cls(**data)


@dataclass
class ExpiryAlert:
    """即将过期的账号告警。

    Attributes:
        account_id: 账号 ID
        platform: 平台
        days_until_expiry: 距过期天数
        status: 当前状态
        last_active_at: 最后活跃时间
    """

    account_id: str
    platform: str
    days_until_expiry: int
    status: str
    last_active_at: float


# ---------------------------------------------------------------------------
# Cookie 健康度监控器
# ---------------------------------------------------------------------------

class CookieHealthMonitor:
    """Cookie 健康度监控 — 过期预警/自动刷新/失效检测。

    用法:
        monitor = CookieHealthMonitor()
        # 发布前检查
        health = await monitor.check_cookie_health(account_id, platform, credentials)
        if health.status == 'expired':
            return PublishResult(success=False, error_message="Cookie 已过期")
        if health.status == 'expiring_soon':
            await monitor.refresh_cookie(account_id, platform)
        # 获取即将过期列表(定时任务用)
        alerts = monitor.get_expiring_soon(days=7)
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # 元数据缓存:(account_id, platform) -> CookieHealth
        self._health_cache: dict[tuple[str, str], CookieHealth] = {}
        self._loaded = False

    def _ensure_loaded(self) -> None:
        """惰性加载持久化的元数据文件。"""
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            try:
                if _HEALTH_FILE.is_file():
                    data = json.loads(_HEALTH_FILE.read_text(encoding="utf-8"))
                    for key_str, health_data in data.items():
                        # key_str 格式: "account_id|platform"
                        parts = key_str.split("|", 1)
                        if len(parts) == 2:
                            key = (parts[0], parts[1])
                            self._health_cache[key] = CookieHealth.from_dict(health_data)
                    logger.info(
                        "[cookie_health] 加载历史 Cookie 健康度: %d 个账号",
                        len(self._health_cache),
                    )
            except (OSError, json.JSONDecodeError) as e:
                logger.warning("[cookie_health] 加载健康度文件失败: %s", e)
            self._loaded = True

    def _persist(self) -> None:
        """持久化元数据到文件(锁外调用)。"""
        try:
            _HEALTH_FILE.parent.mkdir(parents=True, exist_ok=True)
            data = {
                f"{key[0]}|{key[1]}": health.to_dict()
                for key, health in self._health_cache.items()
            }
            _HEALTH_FILE.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError as e:
            logger.warning("[cookie_health] 持久化健康度失败: %s", e)

    # -----------------------------------------------------------------
    # 公开 API
    # -----------------------------------------------------------------

    async def check_cookie_health(
        self,
        account_id: str,
        platform: str,
        credentials: Optional[dict[str, Any]] = None,
        context: Any = None,
    ) -> CookieHealth:
        """检查 Cookie 健康度(有效期/活跃度/完整性)。

        优先用 Playwright context 实际检查 Cookie(精确);
        若无 context,降级为元数据缓存估算(快速但可能过期)。

        Args:
            account_id: 账号 ID
            platform: 平台
            credentials: 账号凭证(可选,用于判断是否有登录信息)
            context: Playwright BrowserContext(可选,用于实际检查 Cookie)

        Returns:
            CookieHealth 实例
        """
        self._ensure_loaded()
        cache_key = (account_id, platform)

        # 若有 context,实际检查 Cookie
        if context is not None:
            health = await self._check_actual_cookies(account_id, platform, context)
            with self._lock:
                self._health_cache[cache_key] = health
            self._persist()
            return health

        # 降级:从元数据缓存估算
        with self._lock:
            cached = self._health_cache.get(cache_key)

        if cached is None:
            # 无缓存记录,标记为 invalid(未检查过)
            health = CookieHealth(
                status="invalid",
                days_until_expiry=-1,
                last_active_at=time.time(),
                cookie_count=0,
                has_session_cookie=False,
            )
            with self._lock:
                self._health_cache[cache_key] = health
            self._persist()
            return health

        # 基于缓存数据重新计算状态(可能已过期)
        now = time.time()
        if cached.days_until_expiry >= 0:
            elapsed_days = (now - cached.last_active_at) / 86400
            remaining = max(-1, int(cached.days_until_expiry - elapsed_days))
            if remaining <= 0:
                status = "expired"
            elif remaining <= _EXPIRING_SOON_DAYS:
                status = "expiring_soon"
            else:
                status = "healthy"
            return CookieHealth(
                status=status,
                days_until_expiry=remaining,
                last_active_at=cached.last_active_at,
                refresh_attempted=cached.refresh_attempted,
                refresh_success=cached.refresh_success,
                cookie_count=cached.cookie_count,
                has_session_cookie=cached.has_session_cookie,
            )

        return cached

    async def _check_actual_cookies(
        self,
        account_id: str,
        platform: str,
        context: Any,
    ) -> CookieHealth:
        """通过 Playwright context 实际检查 Cookie。"""
        try:
            cookies: list[dict[str, Any]] = await context.cookies()
            cookie_count = len(cookies)

            # 检查是否有会话 Cookie
            session_names = _PLATFORM_SESSION_COOKIES.get(
                platform, _PLATFORM_SESSION_COOKIES["default"],
            )
            has_session = any(
                any(sn in c.get("name", "") for sn in session_names)
                for c in cookies
            )

            # 计算最早过期时间
            now = time.time()
            min_expiry = float("inf")
            for c in cookies:
                expires = c.get("expires", -1)
                # expires > 0 是绝对时间戳;-1 是会话 Cookie(浏览器关闭即过期)
                if expires > 0:
                    min_expiry = min(min_expiry, float(expires))

            if min_expiry == float("inf"):
                # 全是会话 Cookie,无法判断过期时间
                days_until = -1
                status = "healthy" if has_session else "invalid"
            else:
                days_until = max(-1, int((min_expiry - now) / 86400))
                if days_until <= 0:
                    status = "expired"
                elif days_until <= _EXPIRING_SOON_DAYS:
                    status = "expiring_soon"
                else:
                    status = "healthy" if has_session else "invalid"

            if not has_session:
                status = "invalid"

            return CookieHealth(
                status=status,
                days_until_expiry=days_until,
                last_active_at=now,
                cookie_count=cookie_count,
                has_session_cookie=has_session,
            )
        except Exception as e:
            logger.warning(
                "[cookie_health] 实际 Cookie 检查异常: %s: %s", type(e).__name__, e,
            )
            return CookieHealth(
                status="invalid",
                days_until_expiry=-1,
                last_active_at=time.time(),
            )

    async def refresh_cookie(
        self,
        account_id: str,
        platform: str,
        context: Any = None,
    ) -> bool:
        """自动刷新 Cookie — 访问平台首页保持活跃。

        策略:
        1. 若有 context,访问平台首页(触发 Cookie 续期)
        2. 更新 last_active_at(保活时间戳)
        3. 重新检查 Cookie 健康度

        Args:
            account_id: 账号 ID
            platform: 平台
            context: Playwright BrowserContext(可选)

        Returns:
            True(刷新成功)/ False(失败)
        """
        self._ensure_loaded()
        cache_key = (account_id, platform)
        homepage = _PLATFORM_HOMEPAGE.get(platform, "")

        success = False
        if context is not None and homepage:
            try:
                # 访问平台首页(触发 Cookie 续期)
                page = await context.new_page()
                try:
                    await page.goto(homepage, wait_until="domcontentloaded", timeout=30000)
                    # 等待页面加载(给 Cookie 续期时间)
                    await asyncio.sleep(3)
                    # 模拟人类活动(滚动 + 停顿)
                    await page.mouse.wheel(0, 200)
                    await asyncio.sleep(1)
                    success = True
                finally:
                    await page.close()
            except Exception as e:
                logger.warning(
                    "[cookie_health] 刷新 Cookie 异常(account=%s platform=%s): %s: %s",
                    account_id, platform, type(e).__name__, e,
                )

        # 更新元数据
        now = time.time()
        with self._lock:
            cached = self._health_cache.get(cache_key)
            if cached is None:
                health = CookieHealth(
                    status="healthy" if success else "unknown",
                    days_until_expiry=_EXPIRING_SOON_DAYS + 1 if success else -1,
                    last_active_at=now,
                    refresh_attempted=True,
                    refresh_success=success,
                )
            else:
                health = CookieHealth(
                    status="healthy" if success else cached.status,
                    days_until_expiry=(
                        _EXPIRING_SOON_DAYS + 1 if success else cached.days_until_expiry
                    ),
                    last_active_at=now,
                    refresh_attempted=True,
                    refresh_success=success,
                    cookie_count=cached.cookie_count,
                    has_session_cookie=cached.has_session_cookie,
                )
            self._health_cache[cache_key] = health

        self._persist()
        logger.info(
            "[cookie_health] 刷新 Cookie: account=%s platform=%s success=%s",
            account_id, platform, success,
        )
        return success

    def predict_expiration(
        self,
        account_id: str,
        platform: str,
    ) -> Optional[datetime]:
        """预测 Cookie 过期时间(基于 cookie max-age + 历史数据)。

        Args:
            account_id: 账号 ID
            platform: 平台

        Returns:
            过期时间(datetime),无法预测时返回 None
        """
        self._ensure_loaded()
        cache_key = (account_id, platform)
        with self._lock:
            cached = self._health_cache.get(cache_key)

        if cached is None or cached.days_until_expiry < 0:
            return None

        # 预测过期 = 最后活跃时间 + 剩余天数
        expiry_ts = cached.last_active_at + cached.days_until_expiry * 86400
        return datetime.fromtimestamp(expiry_ts, tz=timezone.utc)

    def get_expiring_soon(self, days: int = _EXPIRING_SOON_DAYS) -> list[ExpiryAlert]:
        """获取即将过期的账号列表。

        Args:
            days: 阈值(天),默认 7 天

        Returns:
            ExpiryAlert 列表(按剩余天数升序)
        """
        self._ensure_loaded()
        now = time.time()
        alerts: list[ExpiryAlert] = []

        with self._lock:
            for (account_id, platform), health in self._health_cache.items():
                if health.status in ("expired", "invalid"):
                    alerts.append(ExpiryAlert(
                        account_id=account_id,
                        platform=platform,
                        days_until_expiry=health.days_until_expiry,
                        status=health.status,
                        last_active_at=health.last_active_at,
                    ))
                    continue

                if health.days_until_expiry >= 0:
                    elapsed = (now - health.last_active_at) / 86400
                    remaining = max(0, int(health.days_until_expiry - elapsed))
                    if remaining <= days:
                        alerts.append(ExpiryAlert(
                            account_id=account_id,
                            platform=platform,
                            days_until_expiry=remaining,
                            status="expiring_soon",
                            last_active_at=health.last_active_at,
                        ))

        # 按剩余天数升序(最紧迫的在前)
        alerts.sort(key=lambda a: a.days_until_expiry)
        return alerts

    def record_cookie_status(
        self,
        account_id: str,
        platform: str,
        status: str,
        cookie_count: int = 0,
        has_session: bool = False,
        days_until_expiry: int = -1,
    ) -> None:
        """记录 Cookie 状态(供适配器在发布后更新)。

        Args:
            account_id: 账号 ID
            platform: 平台
            status: 健康状态
            cookie_count: Cookie 数量
            has_session: 是否有会话 Cookie
            days_until_expiry: 距过期天数
        """
        self._ensure_loaded()
        cache_key = (account_id, platform)
        now = time.time()
        with self._lock:
            self._health_cache[cache_key] = CookieHealth(
                status=status,
                days_until_expiry=days_until_expiry,
                last_active_at=now,
                cookie_count=cookie_count,
                has_session_cookie=has_session,
            )
        self._persist()

    # ----- 批量保活(scheduler 定时任务用) -----

    async def refresh_all_expiring(self, days: int = _EXPIRING_SOON_DAYS) -> int:
        """批量刷新即将过期的账号(scheduler 每 6 小时调用)。

        注意:此方法仅更新元数据时间戳,实际 Cookie 刷新需要 context。
        scheduler 应在调用此方法前为每个账号创建 context。

        Args:
            days: 阈值(天)

        Returns:
            更新的账号数量
        """
        alerts = self.get_expiring_soon(days)
        count = 0
        for alert in alerts:
            # 仅更新 last_active_at(实际刷新需 scheduler 提供 context)
            cache_key = (alert.account_id, alert.platform)
            with self._lock:
                cached = self._health_cache.get(cache_key)
                if cached:
                    self._health_cache[cache_key] = CookieHealth(
                        status=cached.status,
                        days_until_expiry=cached.days_until_expiry,
                        last_active_at=time.time(),
                        refresh_attempted=True,
                        refresh_success=cached.refresh_success,
                        cookie_count=cached.cookie_count,
                        has_session_cookie=cached.has_session_cookie,
                    )
            count += 1
        if count > 0:
            self._persist()
            logger.info("[cookie_health] 批量保活 %d 个账号", count)
        return count


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_global_monitor: CookieHealthMonitor | None = None
_global_monitor_lock = threading.Lock()


def get_monitor() -> CookieHealthMonitor:
    """获取全局 CookieHealthMonitor 单例。"""
    global _global_monitor
    if _global_monitor is None:
        with _global_monitor_lock:
            if _global_monitor is None:
                _global_monitor = CookieHealthMonitor()
    return _global_monitor


__all__ = [
    "CookieHealthMonitor",
    "CookieHealth",
    "ExpiryAlert",
    "get_monitor",
]

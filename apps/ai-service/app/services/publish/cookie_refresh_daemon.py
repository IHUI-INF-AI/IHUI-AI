"""Cookie 自动保活守护进程(2026-08-01 新增)。

设计:
- 每 COOKIE_REFRESH_INTERVAL_HOURS(默认 6)小时遍历所有账号
- 用 Playwright headless 访问平台首页(已登录态下访问会刷新 cookie)
- 等待 5-10 秒后关闭,保持 cookie 活跃
- 仅对 browser_cookie 类型平台有效;api_key/oauth 平台跳过(密钥不会过期)
- 模块级单例 cookie_daemon,首次访问 cookie-refresh 端点时懒启动

配置(环境变量):
- COOKIE_REFRESH_INTERVAL_HOURS=6  轮询间隔(小时)
- COOKIE_REFRESH_ENABLED=true      是否启用自动守护(默认 false,避免开发环境开销)

实现:
- start() 启动 asyncio 后台任务循环
- stop() 取消后台任务
- refresh_all_accounts() 遍历所有用户的 browser_cookie 账号
- refresh_single(account_id, platform) 单账号保活,返回 RefreshResult
- get_refresh_stats() 返回统计

注意:Playwright async API 需在 async 上下文中使用。refresh_single 用 async_playwright。
"""
from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request

from app.core.db import get_db_conn
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/publish/cookie-refresh", tags=["publish-cookie-refresh"])

# 轮询间隔(小时),默认 6 小时
_INTERVAL_HOURS = float(os.environ.get("COOKIE_REFRESH_INTERVAL_HOURS", "6"))
# 是否启用自动守护(默认 false,开发环境不自动跑)
_AUTO_ENABLED = os.environ.get("COOKIE_REFRESH_ENABLED", "false").lower() == "true"
# 访问首页后等待秒数(让 cookie 刷新生效)
_VISIT_WAIT_SECONDS = 7


@dataclass
class RefreshResult:
    """单账号保活结果。"""
    account_id: int
    platform: str
    success: bool
    message: str
    duration_ms: int = 0


@dataclass
class RefreshStats:
    """保活统计。"""
    total: int = 0
    success: int = 0
    failed: int = 0
    skipped: int = 0
    last_run_at: Optional[str] = None
    running: bool = False


def _ok(data: Any, message: str = "ok") -> dict[str, Any]:
    return {"code": 0, "message": message, "data": data}


def _get_user_id(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="未登录")
    return str(uid)


class CookieRefreshDaemon:
    """Cookie 自动保活守护进程。

    模块级单例 cookie_daemon,首次调用 ensure_started() 启动后台循环。
    """

    def __init__(self) -> None:
        self._task: Optional[asyncio.Task[None]] = None
        self._stats = RefreshStats()
        self._lock = asyncio.Lock()

    def ensure_started(self) -> None:
        """懒启动后台守护任务(仅在 _AUTO_ENABLED=true 时启动循环)。"""
        if not _AUTO_ENABLED:
            return
        if self._task is not None and not self._task.done():
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return  # 无事件循环(同步上下文),跳过
        self._task = loop.create_task(self._run_loop(), name="cookie-refresh-daemon")
        logger.info("[cookie_daemon] 后台守护任务已启动,间隔 %s 小时", _INTERVAL_HOURS)

    async def start(self) -> None:
        """显式启动守护进程(手动触发)。"""
        if self._task is not None and not self._task.done():
            return
        self._task = asyncio.create_task(self._run_loop(), name="cookie-refresh-daemon")
        logger.info("[cookie_daemon] 守护进程已启动")

    async def stop(self) -> None:
        """停止守护进程。"""
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        logger.info("[cookie_daemon] 守护进程已停止")

    async def _run_loop(self) -> None:
        """后台循环:每 _INTERVAL_HOURS 小时执行一次 refresh_all_accounts。"""
        while True:
            try:
                await self.refresh_all_accounts()
            except Exception:
                logger.exception("[cookie_daemon] refresh_all_accounts 异常")
            await asyncio.sleep(_INTERVAL_HOURS * 3600)

    async def refresh_all_accounts(self) -> RefreshStats:
        """遍历所有 browser_cookie 账号执行保活。"""
        async with self._lock:
            self._stats.running = True
            self._stats.total = 0
            self._stats.success = 0
            self._stats.failed = 0
            self._stats.skipped = 0
            try:
                from app.services.scan_login import PLATFORM_SCAN_CONFIG
                conn = await get_db_conn()
                try:
                    rows = await conn.fetch(
                        "SELECT id, platform FROM publish_accounts WHERE status='active'"
                    )
                finally:
                    await conn.close()
                self._stats.total = len(rows)
                for r in rows:
                    cfg = PLATFORM_SCAN_CONFIG.get(r["platform"])
                    # 跳过 api_key/oauth 平台(success_cookies 为空)
                    if not cfg or not cfg.get("success_cookies"):
                        self._stats.skipped += 1
                        continue
                    result = await self.refresh_single(r["id"], r["platform"])
                    if result.success:
                        self._stats.success += 1
                    else:
                        self._stats.failed += 1
                self._stats.last_run_at = datetime.now(timezone.utc).isoformat()
                return self._stats
            finally:
                self._stats.running = False

    async def refresh_single(self, account_id: int, platform: str) -> RefreshResult:
        """单账号保活:用 Playwright headless 访问平台首页,保持 cookie 活跃。"""
        from app.services.scan_login import PLATFORM_SCAN_CONFIG
        cfg = PLATFORM_SCAN_CONFIG.get(platform)
        if not cfg or not cfg.get("success_cookies"):
            return RefreshResult(
                account_id=account_id, platform=platform, success=False,
                message="此平台不支持 Cookie 保活(API 密钥类型)",
            )
        login_url = cfg["login_url"]
        start = time.time()
        try:
            from playwright.async_api import async_playwright
        except ImportError as e:
            return RefreshResult(
                account_id=account_id, platform=platform, success=False,
                message=f"Playwright 未安装: {e}",
            )

        # 加载该账号的 cookies 注入浏览器
        try:
            from app.services.publish.credentials_crypto import decrypt
            conn = await get_db_conn()
            try:
                row = await conn.fetchrow(
                    "SELECT credentials_enc FROM publish_accounts WHERE id=$1",
                    account_id,
                )
            finally:
                await conn.close()
            if not row:
                return RefreshResult(
                    account_id=account_id, platform=platform, success=False,
                    message="账号不存在",
                )
            credentials = decrypt(row["credentials_enc"])
        except Exception as e:
            return RefreshResult(
                account_id=account_id, platform=platform, success=False,
                message=f"加载凭证失败: {type(e).__name__}: {e}",
            )

        # 注入 cookies 并访问首页
        try:
            async with async_playwright() as p:
                from app.services.scan_login import _find_chromium_executable
                chromium_path = _find_chromium_executable()
                browser = await p.chromium.launch(
                    executable_path=chromium_path,
                    headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    locale="zh-CN",
                    timezone_id="Asia/Shanghai",
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                )
                # 注入已有 cookies(把 dict 转 Playwright cookie 格式)
                cookies_list = self._build_cookies(credentials, login_url)
                if cookies_list:
                    # mypy: SetCookieParam 是 TypedDict,dict 字面量字段完全匹配,类型安全
                    await context.add_cookies(cookies_list)  # type: ignore[arg-type]
                page = await context.new_page()
                try:
                    await page.goto(login_url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(_VISIT_WAIT_SECONDS * 1000)
                    # 检查 cookie 是否仍存在(保活成功标志)
                    final_cookies = await context.cookies()
                    final_names = {c["name"] for c in final_cookies}
                    target = cfg["success_cookies"][0]
                    alive = target in final_names
                finally:
                    await context.close()
                    await browser.close()
            duration = int((time.time() - start) * 1000)
            if alive:
                return RefreshResult(
                    account_id=account_id, platform=platform, success=True,
                    message=f"Cookie 保活成功,访问 {login_url}", duration_ms=duration,
                )
            return RefreshResult(
                account_id=account_id, platform=platform, success=False,
                message="Cookie 保活后未检测到目标 cookie,可能已过期", duration_ms=duration,
            )
        except Exception as e:
            logger.exception("[cookie_daemon] refresh_single account=%s failed", account_id)
            return RefreshResult(
                account_id=account_id, platform=platform, success=False,
                message=f"保活异常: {type(e).__name__}: {str(e)[:200]}",
                duration_ms=int((time.time() - start) * 1000),
            )

    @staticmethod
    def _build_cookies(credentials: dict[str, Any], url: str) -> list[dict[str, Any]]:
        """把凭证 dict 转为 Playwright add_cookies 格式。"""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.hostname or ""
        # 去掉前导点,Playwright 接受 example.com
        domain = domain.lstrip(".")
        if not domain:
            return []
        out: list[dict[str, Any]] = []
        for name, value in credentials.items():
            if not isinstance(value, str) or not value:
                continue
            out.append({
                "name": name,
                "value": value,
                "domain": domain,
                "path": "/",
                "httpOnly": False,
                "secure": parsed.scheme == "https",
                "sameSite": "Lax",
            })
        return out

    def get_refresh_stats(self) -> RefreshStats:
        return self._stats


# 模块级单例
cookie_daemon = CookieRefreshDaemon()


# =============================================================================
# API 端点
# =============================================================================
@router.get("/stats")
async def get_stats(request: Request) -> dict[str, Any]:
    """查询保活统计。"""
    _get_user_id(request)  # 鉴权
    cookie_daemon.ensure_started()
    s = cookie_daemon.get_refresh_stats()
    return _ok({
        "total": s.total,
        "success": s.success,
        "failed": s.failed,
        "skipped": s.skipped,
        "last_run_at": s.last_run_at,
        "running": s.running,
        "interval_hours": _INTERVAL_HOURS,
        "auto_enabled": _AUTO_ENABLED,
    })


@router.post("/trigger")
async def trigger_refresh(request: Request) -> dict[str, Any]:
    """手动触发全量保活(异步执行,立即返回)。"""
    _get_user_id(request)  # 鉴权
    cookie_daemon.ensure_started()
    # 后台触发,不阻塞响应
    asyncio.create_task(cookie_daemon.refresh_all_accounts())
    return _ok({"triggered": True}, "保活任务已触发,后台执行中")

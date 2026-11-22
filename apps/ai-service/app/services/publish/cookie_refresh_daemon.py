# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

注意:Windows + uvicorn(--reload)下事件循环是 SelectorEventLoop,async_playwright
的 subprocess 启动会抛 NotImplementedError(与 browser_render.py 相同的坑)。
因此 refresh_single 用 sync_playwright + asyncio.to_thread(根治,见 browser_render.py)。
"""
from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, HTTPException, Request

if TYPE_CHECKING:
    from playwright._impl._api_structures import SetCookieParam

import contextlib

from app.core.background_tasks import spawn
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
    # 续期是否真正落库(2026-11-22 永久保活):探活成功但 cookie 轮换回写失败时,
    # success 仍为真(本次会话活着),但库里是旧 cookie,下轮可能失效 —— 必须让上层
    # 看见这个"续期未落地"状态,否则回写失败被 warning 吞掉,永久保活断在这里。
    writeback_failed: bool = False
    # 本轮是否发生了 cookie 轮换并回写落库(供 keepalive 状态面判断"真的续期了")
    refreshed: bool = False


@dataclass
class RefreshStats:
    """保活统计。"""
    total: int = 0
    success: int = 0
    failed: int = 0
    skipped: int = 0
    last_run_at: str | None = None
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
        self._task: asyncio.Task[None] | None = None
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
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
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
                self._stats.last_run_at = datetime.now(UTC).isoformat()
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
            # 可用性探针:实际调用在 _visit_and_check 内;此处 import 仅为提前给出友好报错,
            # 且 tests/test_cookie_refresh_daemon.py 通过 monkeypatch __import__ 模拟未安装,
            # 故不能用 find_spec 替代(ruff F401 显式豁免)。
            from playwright.sync_api import sync_playwright  # noqa: F401
        except ImportError as e:
            return RefreshResult(
                account_id=account_id, platform=platform, success=False,
                message=f"Playwright 未安装: {e}",
            )

        # 加载该账号的 cookies 注入浏览器
        raw_extra: object = None
        try:
            from app.services.publish.credentials_crypto import decrypt
            conn = await get_db_conn()
            try:
                row = await conn.fetchrow(
                    "SELECT credentials_enc, extra FROM publish_accounts WHERE id=$1",
                    account_id,
                )
            finally:
                await conn.close()
            if not row:
                return RefreshResult(
                    account_id=account_id, platform=platform, success=False,
                    message="账号不存在",
                )
            try:
                raw_extra = row["extra"]
            except (KeyError, TypeError, IndexError, AttributeError):
                raw_extra = None  # 老测试/老库没有 extra 列 ⇒ 无历史可用,不影响主流程
            credentials = decrypt(row["credentials_enc"])
        except Exception as e:
            # 文案带"需重新扫码录入":这句话会原样进告警。原先只说"加载凭证失败:
            # InvalidTag",用户看到的是异常类名,不知道该做什么 —— 解密失败唯一
            # 的出路就是重录,得把动作写在消息里。
            # 没有 message 的异常(InvalidTag 就是)只留类名,避免出现 "InvalidTag: "
            # 这种尾巴空着的字符串(形似笔误,看着像 bug)。
            detail = type(e).__name__ + (f": {e}" if str(e).strip() else "")
            return RefreshResult(
                account_id=account_id, platform=platform, success=False,
                message=f"凭证无法解密({detail}),需重新扫码录入该账号",
            )

        # 注入 cookies 并访问首页(sync_playwright 在线程池跑,规避 Windows
        # SelectorEventLoop 下 async_playwright 启动 subprocess 抛 NotImplementedError)
        try:
            alive, updated_cookies = await asyncio.to_thread(
                self._visit_and_check, platform, login_url, credentials
            )
        except Exception as e:
            logger.exception("[cookie_daemon] refresh_single account=%s failed", account_id)
            return RefreshResult(
                account_id=account_id, platform=platform, success=False,
                message=f"保活异常: {type(e).__name__}: {str(e)[:200]}",
                duration_ms=int((time.time() - start) * 1000),
            )
        duration = int((time.time() - start) * 1000)

        # Cookie 回写(2026-09-15 新增):平台在访问时可能轮换 cookie 值(如 z_c0),
        # 只检查不回写会让 stored cookie 与服务端会话逐渐脱节,最终"保活成功但发布
        # 时 cookie 过期"。这里把浏览器最终持有的新值合并回凭证并持久化。
        # 2026-09-27:这一步恰好就是"刷新"动作本身,过去它**无条件覆盖**旧密文不留余料;
        # 现在一律走唯一出口 credential_history.apply_credentials_update —— 覆盖前把库里
        # 那份旧密文压进有界历史,历史准备失败只喊 error 并退回原写入,不阻断保活。
        writeback_failed = False
        refreshed = False
        if alive and updated_cookies:
            changed = {k: v for k, v in updated_cookies.items() if credentials.get(k) != v}
            if changed:
                # 永久保活(2026-11-22):回写是"续期落地"的临门一脚,失败不能只 warning
                # 吞掉。用 writeback_verdict 驱动带界重试;预算耗尽仍失败 ⇒ 标记
                # writeback_failed,让上层看见"本次会话活着但库里还是旧 cookie"。
                from app.services.publish.credentials_crypto import encrypt
                merged = {**credentials, **changed}
                enc = encrypt(merged)
                writeback_failed = not await self._writeback_with_retry(account_id, enc)
                refreshed = not writeback_failed
                if writeback_failed:
                    logger.error(
                        "[cookie_daemon] account=%s cookie 回写重试耗尽,续期未落地: %s",
                        account_id, sorted(changed),
                    )

        if alive:
            msg = f"Cookie 保活成功,访问 {login_url}"
            await self._stamp_verified(account_id, msg)
            return RefreshResult(
                account_id=account_id, platform=platform, success=True,
                message=msg, duration_ms=duration,
                writeback_failed=writeback_failed, refreshed=refreshed,
            )
        # 永久保活(2026-11-22):软失败(未检测到目标 cookie)先自愈,不立即判死。
        # 历史凭据是现成的自愈素材 —— credential_history 每次覆盖都压了旧密文,
        # 但此前只写不读。逐份回滚探活,救回即提升为当前凭据;全军覆没才返回失败
        # (此时才允许上层判 expired 喊人工重扫)。硬失败(解不开)不走回滚 —— 重试无用。
        fail_msg = "Cookie 保活后未检测到目标 cookie,可能已过期"
        from app.services.publish.perpetual import is_soft_expire, soft_failure_needs_retry

        if is_soft_expire(fail_msg) and soft_failure_needs_retry(fail_msg, attempts=0):
            recovered = await self._try_history_recovery(
                account_id, platform, login_url, raw_extra
            )
            if recovered is not None:
                msg = f"Cookie 保活自愈成功,从历史凭据回滚({recovered})"
                await self._stamp_verified(account_id, msg)
                return RefreshResult(
                    account_id=account_id, platform=platform, success=True,
                    message=msg, duration_ms=duration, refreshed=True,
                )
        return RefreshResult(
            account_id=account_id, platform=platform, success=False,
            message=fail_msg, duration_ms=duration,
        )

    async def _try_history_recovery(
        self, account_id: int, platform: str, login_url: str, raw_extra: object
    ) -> str | None:
        """从 credential_history 逐份回滚探活,成功则提升为当前凭据。

        返回命中的历史标签(如 ``history[0]``),全军覆没返回 None。只读历史、不猜
        凭据格式:每份旧密文 decrypt 后用同一个 ``_visit_and_check`` 探活,与当前凭据
        完全同口径。任何异常都当"这份不可用"继续下一份 —— 自愈是附加保险,绝不
        反过来把保活主流程拖崩。
        """
        from app.services.publish.credential_history import CREDENTIALS_HISTORY_KEY
        from app.services.publish.credentials_crypto import decrypt, encrypt
        from app.services.publish.perpetual import (
            RecoveryCandidate,
            plan_recovery,
        )

        history: list[dict[str, object]] = []
        try:
            if isinstance(raw_extra, str) and raw_extra.strip():
                import json
                parsed = json.loads(raw_extra)
                if isinstance(parsed, dict):
                    maybe = parsed.get(CREDENTIALS_HISTORY_KEY)
                    if isinstance(maybe, list):
                        history = [e for e in maybe if isinstance(e, dict)]
            elif isinstance(raw_extra, dict):
                maybe = raw_extra.get(CREDENTIALS_HISTORY_KEY)
                if isinstance(maybe, list):
                    history = [e for e in maybe if isinstance(e, dict)]
        except Exception:  # noqa: BLE001 —— 历史结构坏了就当没有历史
            return None
        if not history:
            return None

        candidates: list[RecoveryCandidate] = []
        decrypted: dict[str, dict[str, object]] = {}
        for i, entry in enumerate(history):
            enc = entry.get("enc")
            if not isinstance(enc, str) or not enc:
                continue
            label = f"history[{i}]"
            try:
                creds = decrypt(enc)
            except Exception:  # noqa: BLE001 —— 某份解不开跳过,不影响其它
                continue
            if not isinstance(creds, dict) or not creds:
                continue
            decrypted[label] = creds
            candidates.append(RecoveryCandidate(label=label, enc=enc, alive=False))

        if not candidates:
            return None

        # 逐份用同一探活口径验活(线程池跑,规避 Windows SelectorEventLoop)
        alive_map: dict[str, bool] = {}
        updated_map: dict[str, dict[str, str]] = {}
        for label, creds in decrypted.items():
            try:
                alive, updated = await asyncio.to_thread(
                    self._visit_and_check, platform, login_url, creds
                )
            except Exception:  # noqa: BLE001 —— 该份探活异常当不可用
                continue
            alive_map[label] = alive
            if updated:
                updated_map[label] = updated

        judged = [
            RecoveryCandidate(
                label=c.label, enc=c.enc, alive=alive_map.get(c.label, False)
            )
            for c in candidates
        ]
        plan = plan_recovery(judged)
        if plan.chosen is None or plan.chosen.label not in decrypted:
            return None

        chosen_label = plan.chosen.label
        chosen_creds = dict(decrypted[chosen_label])
        chosen_creds.update(updated_map.get(chosen_label, {}))
        # 救回的凭据提升为当前(走唯一写出口,旧密文继续压栈,可再次回滚)
        enc = encrypt(chosen_creds)
        ok = await self._writeback_with_retry(account_id, enc)
        return chosen_label if ok else None

    async def _writeback_with_retry(self, account_id: int, enc: str) -> bool:
        """把新密文回写库,失败带界重试(永久保活关键路径)。

        每次重试都重新取 DB 连接 —— 连接本身可能是失败根因,复用坏连接重试只是
        把同一个错写 N 遍。重试次数由 writeback_verdict 单一判据决定(默认 3 次)。
        返回 True=已落地;False=预算耗尽仍未落地(调用方据此标 writeback_failed)。
        """
        from app.services.publish.perpetual import (
            WritebackAction,
            writeback_verdict,
        )

        failures = 0
        while True:
            verdict = writeback_verdict(changed=True, failures=failures)
            if verdict.action == WritebackAction.GIVE_UP:
                return False
            try:
                from app.services.publish.credential_history import (
                    apply_credentials_update,
                )
                conn = await get_db_conn()
                try:
                    await apply_credentials_update(
                        conn, account_id, enc,
                        source_note="Cookie 保活轮换回写",
                    )
                finally:
                    await conn.close()
                logger.info(
                    "[cookie_daemon] account=%s cookie 已回写(第 %s 次尝试)",
                    account_id, failures + 1,
                )
                return True
            except Exception as e:  # noqa: BLE001 —— DB/历史准备异常都要进重试判据
                failures += 1
                logger.warning(
                    "[cookie_daemon] account=%s cookie 回写第 %s 次失败: %s",
                    account_id, failures, type(e).__name__,
                )

    async def _stamp_verified(self, account_id: int, message: str) -> None:
        """保活成功即"凭证确认有效",戳新 last_verified_at(2026-09-29)。

        此前只有 cookie 轮换回写路径(apply_credentials_update)才顺带戳;访问成功但
        平台没轮换 cookie 时(常态),健康度永远停留在旧时间 —— 自动保活做了也
        "看不见",用户仍需操心。失败只告警不影响保活结论。手动端点
        (account_groups.refresh_cookie)的同名戳保留,幂等无害。
        """
        try:
            conn = await get_db_conn()
            try:
                await conn.execute(
                    "UPDATE publish_accounts SET last_verified_at=NOW(),"
                    " last_verify_msg=$1 WHERE id=$2",
                    message, account_id,
                )
            finally:
                await conn.close()
        except Exception as e:
            logger.warning(
                "[cookie_daemon] account=%s last_verified_at 戳新失败(不影响保活): %s",
                account_id, e,
            )

    @staticmethod
    def _visit_and_check(platform: str, login_url: str, credentials: dict[str, Any]) -> tuple[bool, dict[str, str]]:
        """同步版保活:注入 cookies 访问平台首页,返回(目标 cookie 是否仍存在, 平台最终下发的 cookie 值)。"""
        from playwright.sync_api import sync_playwright

        from app.services.scan_login import PLATFORM_SCAN_CONFIG, _find_chromium_executable
        cfg = PLATFORM_SCAN_CONFIG[platform]
        with sync_playwright() as p:
            chromium_path = _find_chromium_executable()
            browser = p.chromium.launch(
                executable_path=chromium_path,
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            try:
                context = browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    locale="zh-CN",
                    timezone_id="Asia/Shanghai",
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                )
                # 注入已有 cookies(把 dict 转 Playwright cookie 格式)
                cookies_list = CookieRefreshDaemon._build_cookies(credentials, login_url)
                if cookies_list:
                    context.add_cookies(cookies_list)
                page = context.new_page()
                try:
                    page.goto(login_url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(_VISIT_WAIT_SECONDS * 1000)
                    # 检查 cookie 是否仍存在(保活成功标志),并收集平台最终下发的值
                    final_cookies = context.cookies()
                    final_names = {c["name"] for c in final_cookies}
                    final_values = {c["name"]: c["value"] for c in final_cookies}
                    target = cfg["success_cookies"][0]
                    updated = {
                        name: final_values[name]
                        for name in credentials
                        if name in final_values and final_values[name]
                    }
                    return target in final_names, updated
                finally:
                    context.close()
            finally:
                browser.close()

    @staticmethod
    def _build_cookies(credentials: dict[str, Any], url: str) -> list[SetCookieParam]:
        """把凭证 dict 转为 Playwright add_cookies 格式。"""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.hostname or ""
        # 去掉前导点,Playwright 接受 example.com
        domain = domain.lstrip(".")
        if not domain:
            return []
        out: list[SetCookieParam] = []
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
    spawn(cookie_daemon.refresh_all_accounts(), name="cookie-refresh-manual")
    return _ok({"triggered": True}, "保活任务已触发,后台执行中")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

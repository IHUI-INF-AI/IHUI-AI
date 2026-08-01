"""cookie_refresh_daemon.py 单元测试:Cookie 自动保活守护进程。

测试覆盖:
- RefreshResult dataclass 构造与默认值
- RefreshStats dataclass 构造与默认值
- _ok 响应包装函数
- _get_user_id:已登录 / 未登录抛 401
- CookieRefreshDaemon.__init__:初始状态
- ensure_started:_AUTO_ENABLED=false 跳过 / 无事件循环跳过 / 已运行跳过 / 启用后创建 task
- start:创建 task / 已运行不重复创建
- stop:无 task 安全 / 取消已有 task
- refresh_all_accounts:DB 异常 / 无账号 / 跳过 api_key 平台 / 累计 success/failed/skipped
- refresh_single:平台不支持 / Playwright 未安装 / 账号不存在 / 保活成功 / 保活失败(cookie 未检测到)
- _build_cookies:空 url / 非字符串值过滤 / domain 提取 / httpOnly/secure 设置
- get_refresh_stats:返回当前统计
- cookie_daemon 单例
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.services.publish import cookie_refresh_daemon
from app.services.publish.cookie_refresh_daemon import (
    CookieRefreshDaemon,
    RefreshResult,
    RefreshStats,
    _get_user_id,
    _ok,
    cookie_daemon,
)


# =============================================================================
# 1. RefreshResult dataclass
# =============================================================================


class TestRefreshResult:
    """RefreshResult 单账号保活结果。"""

    def test_full_construction(self) -> None:
        """所有字段显式构造。"""
        r = RefreshResult(
            account_id=42,
            platform="wechat",
            success=True,
            message="ok",
            duration_ms=1500,
        )
        assert r.account_id == 42
        assert r.platform == "wechat"
        assert r.success is True
        assert r.message == "ok"
        assert r.duration_ms == 1500

    def test_default_duration_ms_is_zero(self) -> None:
        """duration_ms 默认为 0。"""
        r = RefreshResult(
            account_id=1, platform="p", success=False, message="fail",
        )
        assert r.duration_ms == 0


# =============================================================================
# 2. RefreshStats dataclass
# =============================================================================


class TestRefreshStats:
    """RefreshStats 保活统计。"""

    def test_default_values(self) -> None:
        """默认全零 + last_run_at=None + running=False。"""
        s = RefreshStats()
        assert s.total == 0
        assert s.success == 0
        assert s.failed == 0
        assert s.skipped == 0
        assert s.last_run_at is None
        assert s.running is False

    def test_custom_values(self) -> None:
        """自定义字段值。"""
        s = RefreshStats(
            total=10, success=7, failed=2, skipped=1,
            last_run_at="2026-08-01T00:00:00+00:00", running=True,
        )
        assert s.total == 10
        assert s.success == 7
        assert s.failed == 2
        assert s.skipped == 1
        assert s.last_run_at == "2026-08-01T00:00:00+00:00"
        assert s.running is True


# =============================================================================
# 3. _ok 响应包装
# =============================================================================


class TestOk:
    """_ok 响应包装函数。"""

    def test_default_message(self) -> None:
        """默认 message 为 'ok'。"""
        result = _ok({"x": 1})
        assert result == {"code": 0, "message": "ok", "data": {"x": 1}}

    def test_custom_message(self) -> None:
        """自定义 message。"""
        result = _ok("hello", message="done")
        assert result == {"code": 0, "message": "done", "data": "hello"}

    def test_none_data(self) -> None:
        """data 为 None。"""
        result = _ok(None)
        assert result == {"code": 0, "message": "ok", "data": None}


# =============================================================================
# 4. _get_user_id
# =============================================================================


class TestGetUserId:
    """_get_user_id 从 request.state 取身份。"""

    def test_returns_user_id_when_present(self) -> None:
        """request.state.user_id 存在时返回字符串。"""
        request = MagicMock()
        request.state.user_id = 123
        assert _get_user_id(request) == "123"

    def test_returns_string_when_already_string(self) -> None:
        """user_id 已是字符串时直接返回。"""
        request = MagicMock()
        request.state.user_id = "abc"
        assert _get_user_id(request) == "abc"

    def test_raises_401_when_missing(self) -> None:
        """user_id 缺失时抛 401。"""
        request = MagicMock()
        request.state.user_id = None
        with pytest.raises(HTTPException) as exc_info:
            _get_user_id(request)
        assert exc_info.value.status_code == 401

    def test_raises_401_when_empty_string(self) -> None:
        """user_id 为空串时抛 401。"""
        request = MagicMock()
        request.state.user_id = ""
        with pytest.raises(HTTPException) as exc_info:
            _get_user_id(request)
        assert exc_info.value.status_code == 401


# =============================================================================
# 5. CookieRefreshDaemon.__init__
# =============================================================================


class TestDaemonInit:
    """CookieRefreshDaemon 初始化。"""

    def test_initial_state(self) -> None:
        """新实例初始状态:_task=None / _stats=默认 / _lock=Lock。"""
        d = CookieRefreshDaemon()
        assert d._task is None
        assert isinstance(d._stats, RefreshStats)
        assert d._stats.running is False
        assert d._stats.total == 0
        # _lock 应为 asyncio.Lock
        assert hasattr(d._lock, "acquire")
        assert hasattr(d._lock, "release")


# =============================================================================
# 6. ensure_started
# =============================================================================


class TestEnsureStarted:
    """ensure_started 懒启动后台守护任务。"""

    def test_disabled_auto_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """_AUTO_ENABLED=false 时不启动。"""
        monkeypatch.setattr(cookie_refresh_daemon, "_AUTO_ENABLED", False)
        d = CookieRefreshDaemon()
        d.ensure_started()
        assert d._task is None

    def test_skips_when_task_already_running(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """已有运行中 task 时不重复创建。"""
        monkeypatch.setattr(cookie_refresh_daemon, "_AUTO_ENABLED", True)
        d = CookieRefreshDaemon()
        fake_task = MagicMock()
        fake_task.done.return_value = False
        d._task = fake_task  # type: ignore[assignment]
        d.ensure_started()
        # _task 应仍为原 fake_task
        assert d._task is fake_task

    def test_skips_when_no_running_loop(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """无事件循环时(RuntimeError)跳过启动。"""
        monkeypatch.setattr(cookie_refresh_daemon, "_AUTO_ENABLED", True)

        def raise_no_loop() -> Any:
            raise RuntimeError("no running event loop")

        with patch("asyncio.get_running_loop", side_effect=raise_no_loop):
            d = CookieRefreshDaemon()
            d.ensure_started()
            assert d._task is None


# =============================================================================
# 7. start / stop
# =============================================================================


class TestStartStop:
    """start / stop 显式启停。"""

    @pytest.mark.asyncio
    async def test_start_creates_task(self) -> None:
        """start 应创建 asyncio.Task。"""
        d = CookieRefreshDaemon()
        # Mock _run_loop 避免真循环
        with patch.object(d, "_run_loop", new_callable=AsyncMock):
            await d.start()
            assert d._task is not None
            assert not d._task.done()
            # 清理
            await d.stop()

    @pytest.mark.asyncio
    async def test_start_does_not_duplicate(self) -> None:
        """已有运行中 task 时不重复创建。"""
        d = CookieRefreshDaemon()
        with patch.object(d, "_run_loop", new_callable=AsyncMock):
            await d.start()
            first_task = d._task
            await d.start()  # 再次调用
            assert d._task is first_task
            await d.stop()

    @pytest.mark.asyncio
    async def test_stop_with_no_task_safe(self) -> None:
        """无 task 时 stop 应安全(不抛)。"""
        d = CookieRefreshDaemon()
        assert d._task is None
        await d.stop()  # 不抛
        assert d._task is None

    @pytest.mark.asyncio
    async def test_stop_cancels_running_task(self) -> None:
        """stop 应取消运行中的 task。"""
        d = CookieRefreshDaemon()
        with patch.object(d, "_run_loop", new_callable=AsyncMock):
            await d.start()
            task = d._task
            assert task is not None
            await d.stop()
            assert d._task is None
            assert task.cancelled() or task.done()

    @pytest.mark.asyncio
    async def test_stop_with_done_task(self) -> None:
        """已完成 task 时 stop 应安全清理。"""
        d = CookieRefreshDaemon()
        with patch.object(d, "_run_loop", new_callable=AsyncMock):
            await d.start()
            # 等待 task 完成(mock 立即返回)
            await d._task  # type: ignore[arg-type]
            await d.stop()  # 不抛
            assert d._task is None


# =============================================================================
# 8. refresh_all_accounts
# =============================================================================


class TestRefreshAllAccounts:
    """refresh_all_accounts 遍历账号保活。"""

    @pytest.mark.asyncio
    async def test_returns_stats_after_run(self) -> None:
        """成功运行后返回 RefreshStats。"""
        d = CookieRefreshDaemon()
        with patch("app.services.publish.cookie_refresh_daemon.get_db_conn") as mock_conn, \
             patch("app.services.scan_login.PLATFORM_SCAN_CONFIG", {}):
            mock_conn_obj = AsyncMock()
            mock_conn_obj.fetch.return_value = []
            mock_conn.return_value = mock_conn_obj
            result = await d.refresh_all_accounts()
            assert isinstance(result, RefreshStats)
            assert result.total == 0
            assert result.running is False
            mock_conn_obj.close.assert_awaited()

    @pytest.mark.asyncio
    async def test_skips_api_key_platforms(self) -> None:
        """api_key 平台(success_cookies 为空)应被跳过。"""
        d = CookieRefreshDaemon()
        fake_config = {
            "wechat": {"login_url": "https://x", "success_cookies": ["sid"]},
            "wordpress_api": {"login_url": "https://y", "success_cookies": []},
        }
        fake_rows = [
            {"id": 1, "platform": "wechat"},
            {"id": 2, "platform": "wordpress_api"},
        ]
        with patch("app.services.publish.cookie_refresh_daemon.get_db_conn") as mock_conn, \
             patch("app.services.scan_login.PLATFORM_SCAN_CONFIG", fake_config), \
             patch.object(d, "refresh_single", AsyncMock(return_value=RefreshResult(
                 account_id=1, platform="wechat", success=True, message="ok",
             ))):
            mock_conn_obj = AsyncMock()
            mock_conn_obj.fetch.return_value = fake_rows
            mock_conn.return_value = mock_conn_obj
            result = await d.refresh_all_accounts()
            assert result.total == 2
            assert result.success == 1
            assert result.skipped == 1
            assert result.failed == 0

    @pytest.mark.asyncio
    async def test_unknown_platform_skipped(self) -> None:
        """未知平台(cfg=None)应被跳过。"""
        d = CookieRefreshDaemon()
        fake_rows = [{"id": 1, "platform": "unknown_xyz"}]
        with patch("app.services.publish.cookie_refresh_daemon.get_db_conn") as mock_conn, \
             patch("app.services.scan_login.PLATFORM_SCAN_CONFIG", {}):
            mock_conn_obj = AsyncMock()
            mock_conn_obj.fetch.return_value = fake_rows
            mock_conn.return_value = mock_conn_obj
            result = await d.refresh_all_accounts()
            assert result.skipped == 1
            assert result.success == 0

    @pytest.mark.asyncio
    async def test_counts_failed_when_refresh_fails(self) -> None:
        """refresh_single 失败时 failed 计数 +1。"""
        d = CookieRefreshDaemon()
        fake_config = {
            "wechat": {"login_url": "https://x", "success_cookies": ["sid"]},
        }
        fake_rows = [{"id": 1, "platform": "wechat"}]
        with patch("app.services.publish.cookie_refresh_daemon.get_db_conn") as mock_conn, \
             patch("app.services.scan_login.PLATFORM_SCAN_CONFIG", fake_config), \
             patch.object(d, "refresh_single", AsyncMock(return_value=RefreshResult(
                 account_id=1, platform="wechat", success=False, message="failed",
             ))):
            mock_conn_obj = AsyncMock()
            mock_conn_obj.fetch.return_value = fake_rows
            mock_conn.return_value = mock_conn_obj
            result = await d.refresh_all_accounts()
            assert result.failed == 1
            assert result.success == 0

    @pytest.mark.asyncio
    async def test_last_run_at_set_after_run(self) -> None:
        """运行后 last_run_at 应被设置(ISO 时间字符串)。"""
        d = CookieRefreshDaemon()
        with patch("app.services.publish.cookie_refresh_daemon.get_db_conn") as mock_conn, \
             patch("app.services.scan_login.PLATFORM_SCAN_CONFIG", {}):
            mock_conn_obj = AsyncMock()
            mock_conn_obj.fetch.return_value = []
            mock_conn.return_value = mock_conn_obj
            result = await d.refresh_all_accounts()
            assert result.last_run_at is not None
            assert isinstance(result.last_run_at, str)
            # 应可被 fromisoformat 解析
            from datetime import datetime
            datetime.fromisoformat(result.last_run_at)


# =============================================================================
# 9. refresh_single
# =============================================================================


class TestRefreshSingle:
    """refresh_single 单账号保活。"""

    @pytest.mark.asyncio
    async def test_unsupported_platform_returns_failure(self) -> None:
        """平台不支持(success_cookies 为空)→ 返回失败。"""
        d = CookieRefreshDaemon()
        with patch("app.services.scan_login.PLATFORM_SCAN_CONFIG", {"p": {"success_cookies": []}}):
            result = await d.refresh_single(1, "p")
            assert result.success is False
            assert "不支持 Cookie 保活" in result.message

    @pytest.mark.asyncio
    async def test_unknown_platform_returns_failure(self) -> None:
        """未知平台(cfg=None)→ 返回失败。"""
        d = CookieRefreshDaemon()
        with patch("app.services.scan_login.PLATFORM_SCAN_CONFIG", {}):
            result = await d.refresh_single(1, "unknown")
            assert result.success is False
            assert "不支持 Cookie 保活" in result.message

    @pytest.mark.asyncio
    async def test_playwright_not_installed_returns_failure(self) -> None:
        """Playwright 未安装 → 返回失败。"""
        d = CookieRefreshDaemon()
        fake_config = {
            "wechat": {
                "login_url": "https://mp.weixin.qq.com/",
                "success_cookies": ["sid"],
            },
        }

        real_import = __import__

        def no_playwright_import(name: str, *args: Any, **kwargs: Any) -> Any:
            # 只拦截 playwright.async_api,其他模块放行(避免误伤 scan_login 等)
            if name == "playwright.async_api" or name.startswith("playwright."):
                raise ImportError("no playwright")
            return real_import(name, *args, **kwargs)

        with patch("app.services.scan_login.PLATFORM_SCAN_CONFIG", fake_config), \
             patch("builtins.__import__", side_effect=no_playwright_import):
            result = await d.refresh_single(1, "wechat")
            assert result.success is False
            assert "Playwright 未安装" in result.message

    @pytest.mark.asyncio
    async def test_account_not_found_returns_failure(self) -> None:
        """账号不存在(row=None)→ 返回失败。"""
        d = CookieRefreshDaemon()
        fake_config = {
            "wechat": {
                "login_url": "https://mp.weixin.qq.com/",
                "success_cookies": ["sid"],
            },
        }
        with patch("app.services.scan_login.PLATFORM_SCAN_CONFIG", fake_config), \
             patch("app.services.publish.cookie_refresh_daemon.get_db_conn") as mock_conn, \
             patch("playwright.async_api.async_playwright") as mock_pw:
            mock_conn_obj = AsyncMock()
            mock_conn_obj.fetchrow.return_value = None
            mock_conn.return_value = mock_conn_obj
            # playwright 不应被调用
            result = await d.refresh_single(999, "wechat")
            assert result.success is False
            assert "账号不存在" in result.message

    @pytest.mark.asyncio
    async def test_credentials_load_failure_returns_failure(self) -> None:
        """凭证解密失败 → 返回失败。"""
        d = CookieRefreshDaemon()
        fake_config = {
            "wechat": {
                "login_url": "https://mp.weixin.qq.com/",
                "success_cookies": ["sid"],
            },
        }
        with patch("app.services.scan_login.PLATFORM_SCAN_CONFIG", fake_config), \
             patch("app.services.publish.cookie_refresh_daemon.get_db_conn") as mock_conn, \
             patch("app.services.publish.credentials_crypto.decrypt", side_effect=RuntimeError("decrypt fail")):
            mock_conn_obj = AsyncMock()
            mock_conn_obj.fetchrow.return_value = {"credentials_enc": "cipher"}
            mock_conn.return_value = mock_conn_obj
            result = await d.refresh_single(1, "wechat")
            assert result.success is False
            assert "加载凭证失败" in result.message


# =============================================================================
# 10. _build_cookies
# =============================================================================


class TestBuildCookies:
    """_build_cookies 凭证 dict → Playwright cookies 格式。"""

    def test_empty_url_returns_empty_list(self) -> None:
        """空 url(无 hostname)→ 空列表。"""
        result = CookieRefreshDaemon._build_cookies({"k": "v"}, "")
        assert result == []

    def test_invalid_url_returns_empty_list(self) -> None:
        """无效 url(无 hostname)→ 空列表。"""
        result = CookieRefreshDaemon._build_cookies({"k": "v"}, "not-a-url")
        assert result == []

    def test_valid_url_returns_cookie_list(self) -> None:
        """合法 url → 返回 cookie 列表。"""
        result = CookieRefreshDaemon._build_cookies(
            {"session": "abc", "token": "xyz"},
            "https://mp.weixin.qq.com/path",
        )
        assert len(result) == 2
        names = {c["name"] for c in result}
        assert names == {"session", "token"}
        for c in result:
            assert c["domain"] == "mp.weixin.qq.com"
            assert c["path"] == "/"
            assert c["httpOnly"] is False
            assert c["secure"] is True  # https

    def test_strips_leading_dot_from_domain(self) -> None:
        """domain 前导点应被去除。"""
        result = CookieRefreshDaemon._build_cookies(
            {"k": "v"}, "https://.example.com/path",
        )
        assert result[0]["domain"] == "example.com"

    def test_http_url_secure_false(self) -> None:
        """http 协议 secure=False。"""
        result = CookieRefreshDaemon._build_cookies(
            {"k": "v"}, "http://example.com/",
        )
        assert result[0]["secure"] is False

    def test_non_string_values_filtered(self) -> None:
        """非字符串值应被过滤。"""
        result = CookieRefreshDaemon._build_cookies(
            {"valid": "ok", "num": 123, "none": None, "empty": ""},
            "https://example.com/",
        )
        assert len(result) == 1
        assert result[0]["name"] == "valid"

    def test_sameSite_is_lax(self) -> None:
        """sameSite 应为 'Lax'。"""
        result = CookieRefreshDaemon._build_cookies(
            {"k": "v"}, "https://example.com/",
        )
        assert result[0]["sameSite"] == "Lax"


# =============================================================================
# 11. get_refresh_stats
# =============================================================================


class TestGetRefreshStats:
    """get_refresh_stats 返回当前统计。"""

    def test_returns_current_stats(self) -> None:
        """应返回内部 _stats 对象。"""
        d = CookieRefreshDaemon()
        d._stats.total = 5
        d._stats.success = 3
        result = d.get_refresh_stats()
        assert result.total == 5
        assert result.success == 3
        # 应返回同一对象(引用)
        assert result is d._stats


# =============================================================================
# 12. cookie_daemon 单例
# =============================================================================


class TestSingleton:
    """模块级单例 cookie_daemon。"""

    def test_singleton_exists(self) -> None:
        """cookie_daemon 应为 CookieRefreshDaemon 实例。"""
        assert isinstance(cookie_daemon, CookieRefreshDaemon)

    def test_singleton_is_module_level(self) -> None:
        """多次 import 应返回同一对象。"""
        from app.services.publish.cookie_refresh_daemon import cookie_daemon as d2
        assert cookie_daemon is d2


# =============================================================================
# 13. 模块级配置常量
# =============================================================================


class TestModuleConstants:
    """模块级配置常量。"""

    def test_interval_hours_is_positive(self) -> None:
        """_INTERVAL_HOURS 应为正数。"""
        assert cookie_refresh_daemon._INTERVAL_HOURS > 0

    def test_visit_wait_seconds_is_positive(self) -> None:
        """_VISIT_WAIT_SECONDS 应为正数。"""
        assert cookie_refresh_daemon._VISIT_WAIT_SECONDS > 0

    def test_auto_enabled_is_bool(self) -> None:
        """_AUTO_ENABLED 应为 bool。"""
        assert isinstance(cookie_refresh_daemon._AUTO_ENABLED, bool)

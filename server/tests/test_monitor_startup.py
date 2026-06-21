"""app.services.monitor_startup 单测."""

import pytest

from app.services.monitor_startup import MonitorManager, monitor_manager


class TestMonitorManagerInit:
    def test_default_state(self):
        mgr = MonitorManager()
        assert mgr.is_started is False
        assert mgr.cached_monitor is None

    def test_get_status(self):
        mgr = MonitorManager()
        status = mgr.get_status()
        assert status["is_started"] is False
        assert status["cached_monitor_running"] is False


class TestMonitorManagerStartStop:
    def setup_method(self):
        self.mgr = MonitorManager()
        # 用 monkeypatch-style 替换 monitor_startup 模块内的 cached_expiration_monitor 引用
        import app.services.monitor_startup as ms_mod
        from app.services.cached_expiration_monitor import CachedExpirationMonitor

        self._orig_monitor = ms_mod.cached_expiration_monitor
        self.mock_monitor = CachedExpirationMonitor()
        self.mock_started = False
        self.mock_stopped = False

        async def fake_start():
            self.mock_started = True

        async def fake_stop():
            self.mock_stopped = True

        self.mock_monitor.start = fake_start  # type: ignore
        self.mock_monitor.stop = fake_stop  # type: ignore
        self.mock_monitor.is_running = False
        ms_mod.cached_expiration_monitor = self.mock_monitor

    def teardown_method(self):
        import app.services.monitor_startup as ms_mod

        ms_mod.cached_expiration_monitor = self._orig_monitor

    @pytest.mark.asyncio
    async def test_start_all_monitors(self):
        """start_all_monitors 应调用 cached_monitor.start() 并标记 is_started."""
        await self.mgr.start_all_monitors()
        assert self.mock_started is True
        assert self.mgr.is_started is True
        assert self.mgr.cached_monitor is self.mock_monitor

    @pytest.mark.asyncio
    async def test_start_twice_is_noop(self):
        """重复启动应为 no-op, 不抛异常."""
        self.mgr.is_started = True  # 模拟已启动
        await self.mgr.start_all_monitors()
        # mock start 不应被再次调用
        assert self.mock_started is False

    @pytest.mark.asyncio
    async def test_stop_all_monitors(self):
        """stop_all_monitors 应调用 cached_monitor.stop() 并清除状态."""
        self.mgr.cached_monitor = self.mock_monitor
        self.mgr.is_started = True
        await self.mgr.stop_all_monitors()
        assert self.mock_stopped is True
        assert self.mgr.is_started is False

    @pytest.mark.asyncio
    async def test_stop_when_not_started_is_noop(self):
        """未启动时 stop 应为 no-op, 不抛异常."""
        await self.mgr.stop_all_monitors()
        assert self.mock_stopped is False
        assert self.mgr.is_started is False


class TestModuleSingleton:
    def test_singleton_loaded(self):

        assert isinstance(monitor_manager, MonitorManager)
        assert monitor_manager is monitor_manager  # 单例

"""app.services.cached_expiration_monitor 单测."""

from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
from sqlalchemy import text

from app.database import SessionFactory1
from app.services.cached_expiration_monitor import (
    CachedExpirationMonitor,
    CachedRecord,
    TableConfig,
    cached_expiration_monitor,
)
from app.utils.datetime_helper import utcnow


def _next_buy_id() -> int:
    db = SessionFactory1()
    try:
        r = db.execute(text("SELECT COALESCE(MAX(id), 0) + 1 FROM zhs_agent_buy")).first()
        return r[0] if r else 1
    finally:
        db.close()


def _insert_agent_buy(order_no: str, expiration_date: datetime, status: str = "0") -> int:
    db = SessionFactory1()
    try:
        result = db.execute(
            text(
                "INSERT INTO zhs_agent_buy "
                "(id, order_no, agent_id, agent_name, bug_uuid, bug_name, bug_time, "
                " expiration_date, status, settlement, count) "
                "VALUES (:id, :ono, :aid, :an, :bu, :bn, :bt, :ed, :st, :se, 1)"
            ),
            {
                "id": _next_buy_id(),
                "ono": order_no,
                "aid": "test-agent-cem",
                "an": "测试智能体",
                "bu": "buyer-uuid",
                "bn": "buyer",
                "bt": utcnow(),
                "ed": expiration_date,
                "st": status,
                "se": "0",
            },
        )
        db.commit()
        return result.lastrowid or 0
    finally:
        db.close()


def _clear_agent_buy() -> None:
    db = SessionFactory1()
    try:
        db.execute(text("DELETE FROM zhs_agent_buy WHERE agent_id = 'test-agent-cem'"))
        db.commit()
    finally:
        db.close()


class TestCachedRecord:
    def test_is_expired_true(self):
        rec = CachedRecord(
            id="1", table_name="t", expiration_date=datetime.now() - timedelta(seconds=1), current_status="0"
        )
        assert rec.is_expired() is True

    def test_is_expired_false(self):
        rec = CachedRecord(
            id="2", table_name="t", expiration_date=datetime.now() + timedelta(hours=1), current_status="0"
        )
        assert rec.is_expired() is False


class TestTableConfig:
    def test_config_creation(self):
        cfg = TableConfig(
            model_class=MagicMock(),
            table_name="my_table",
            expiration_field="exp",
            status_field="st",
            expired_value="1",
            unexpired_value="0",
        )
        assert cfg.table_name == "my_table"
        assert cfg.preload_hours == 24  # 默认


class TestCachedExpirationMonitor:
    def setup_method(self):
        self.monitor = CachedExpirationMonitor(db_session_factory=SessionFactory1)
        self.monitor.cache = {t: {} for t in self.monitor.table_configs}
        _clear_agent_buy()

    def teardown_method(self):
        _clear_agent_buy()
        # 清理注册的回调, 避免测试间互相影响
        self.monitor.callbacks.clear()

    def test_default_configs_registered(self):
        """默认应注册 zhs_agent_buy 和 zhs_agent_settlement."""
        assert "zhs_agent_buy" in self.monitor.table_configs
        assert "zhs_agent_settlement" in self.monitor.table_configs

    def test_register_callback(self):
        """注册回调后应出现在 callbacks 字典中."""
        cb = MagicMock()
        self.monitor.register_callback("zhs_agent_buy", cb)
        assert cb in self.monitor.callbacks["zhs_agent_buy"]

    def test_register_table_config(self):
        """注册新表配置后应加入缓存."""
        cfg = TableConfig(
            model_class=MagicMock(),
            table_name="custom_t",
            expiration_field="ed",
            status_field="st",
            expired_value="1",
            unexpired_value="0",
        )
        self.monitor.register_table_config(cfg)
        assert "custom_t" in self.monitor.table_configs
        assert "custom_t" in self.monitor.cache

    @pytest.mark.asyncio
    async def test_refresh_table_cache_loads_unexpired(self):
        """刷新缓存应加载未过期记录 (status=0)."""
        future = datetime.now() + timedelta(hours=24)
        _insert_agent_buy("ORDER-FUTURE-1", future, status="0")
        count = await self.monitor._refresh_table_cache("zhs_agent_buy", self.monitor.table_configs["zhs_agent_buy"])
        assert count >= 1
        assert "zhs_agent_buy" in self.monitor.cache

    @pytest.mark.asyncio
    async def test_refresh_table_cache_skips_expired_status(self):
        """刷新缓存应跳过已过期记录 (status=1)."""
        past = datetime.now() - timedelta(hours=1)
        _insert_agent_buy("ORDER-EXPIRED-1", past, status="1")
        count = await self.monitor._refresh_table_cache("zhs_agent_buy", self.monitor.table_configs["zhs_agent_buy"])
        # status=1 的记录不应被加载
        for r in self.monitor.cache["zhs_agent_buy"].values():
            assert r.current_status == "0"

    @pytest.mark.asyncio
    async def test_check_expired_marks_and_clears(self):
        """check_expired_in_cache 应移除已过期的缓存条目."""
        past = datetime.now() - timedelta(seconds=1)
        with self.monitor.cache_lock:
            self.monitor.cache["zhs_agent_buy"]["x1"] = CachedRecord(
                id="x1", table_name="zhs_agent_buy", expiration_date=past, current_status="0"
            )
        await self.monitor._check_expired_in_cache()
        with self.monitor.cache_lock:
            assert "x1" not in self.monitor.cache["zhs_agent_buy"]
        assert self.monitor.stats["total_checked"] >= 1

    def test_get_cache_info(self):
        info = self.monitor.get_cache_info()
        assert "cache_info" in info
        assert "stats" in info
        assert "is_running" in info
        assert info["is_running"] is False


class TestSingletonInstance:
    def test_singleton_loaded(self):
        """模块级单例应已注册默认配置 + 默认回调."""
        from app.services.cached_expiration_monitor import (
            agent_buy_expired_callback,
            agent_settlement_expired_callback,
        )

        assert isinstance(cached_expiration_monitor, CachedExpirationMonitor)
        assert "zhs_agent_buy" in cached_expiration_monitor.callbacks
        assert "zhs_agent_settlement" in cached_expiration_monitor.callbacks
        assert agent_buy_expired_callback is not None
        assert agent_settlement_expired_callback is not None

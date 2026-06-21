"""app.tasks.heat_stats_task 单测 (Agent 热度统计后台任务)."""

from datetime import date, timedelta

from sqlalchemy import text

from app.database import SessionFactory1
from app.tasks.heat_stats_task import aggregate_daily_heat, cleanup_old_heat

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _insert_heat(agent_id: str, date_str: str, hit_count: int) -> None:
    """直接 SQL INSERT (SQLite 不支持 BigInteger AUTOINCREMENT)."""
    db = SessionFactory1()
    try:
        db.execute(
            text("INSERT INTO agent_heat_stats (id, agent_id, date_str, hit_count) " "VALUES (:id, :a, :d, :h)"),
            {"id": _next_heat_id(), "a": agent_id, "d": date_str, "h": hit_count},
        )
        db.commit()
    finally:
        db.close()


def _insert_heat_null(agent_id: str, date_str: str) -> None:
    db = SessionFactory1()
    try:
        db.execute(
            text("INSERT INTO agent_heat_stats (id, agent_id, date_str, hit_count) " "VALUES (:id, :a, :d, NULL)"),
            {"id": _next_heat_id(), "a": agent_id, "d": date_str},
        )
        db.commit()
    finally:
        db.close()


def _clear() -> None:
    db = SessionFactory1()
    db.execute(text("DELETE FROM agent_heat_stats"))
    db.commit()
    db.close()


_HEAT_ID = [0]


def _next_heat_id() -> int:
    """SQLite 上 BigInteger 主键不自增, 用 module 级计数器模拟."""
    _HEAT_ID[0] += 1
    return _HEAT_ID[0]


# ---------------------------------------------------------------------------
# TestAggregateDailyHeat
# ---------------------------------------------------------------------------


class TestAggregateDailyHeat:
    def test_no_data_returns_empty(self):
        _clear()
        result = aggregate_daily_heat(days=7)
        assert result["days"] == 7
        assert result["daily"] == {}

    def test_single_day_single_agent(self):
        _clear()
        today_str = date.today().isoformat()
        _insert_heat("A001", today_str, 100)
        result = aggregate_daily_heat(days=7)
        assert result["daily"].get(today_str) == 100

    def test_single_day_multiple_agents_summed(self):
        _clear()
        today_str = date.today().isoformat()
        _insert_heat("A001", today_str, 50)
        _insert_heat("A002", today_str, 75)
        _insert_heat("A003", today_str, 25)
        result = aggregate_daily_heat(days=7)
        assert result["daily"][today_str] == 150

    def test_old_data_excluded(self):
        _clear()
        old = (date.today() - timedelta(days=30)).isoformat()
        recent = date.today().isoformat()
        _insert_heat("A1", old, 999)
        _insert_heat("A2", recent, 10)
        result = aggregate_daily_heat(days=7)
        assert old not in result["daily"]
        assert result["daily"][recent] == 10

    def test_null_hit_count_treated_as_zero(self):
        _clear()
        today_str = date.today().isoformat()
        _insert_heat("A1", today_str, 0)
        _insert_heat_null("A2", today_str)
        result = aggregate_daily_heat(days=7)
        assert result["daily"][today_str] == 0


# ---------------------------------------------------------------------------
# TestCleanupOldHeat
# ---------------------------------------------------------------------------


class TestCleanupOldHeat:
    def test_deletes_old_records(self):
        _clear()
        old = (date.today() - timedelta(days=100)).isoformat()
        recent = date.today().isoformat()
        _insert_heat("A1", old, 1)
        _insert_heat("A2", recent, 1)
        deleted = cleanup_old_heat(days_to_keep=90)
        assert deleted == 1
        db = SessionFactory1()
        try:
            remaining = db.execute(text("SELECT date_str FROM agent_heat_stats")).fetchall()
            assert len(remaining) == 1
            assert remaining[0][0] == recent
        finally:
            db.close()

    def test_no_old_records_returns_zero(self):
        _clear()
        _insert_heat("A1", date.today().isoformat(), 5)
        deleted = cleanup_old_heat(days_to_keep=90)
        assert deleted == 0

    def test_custom_keep_days(self):
        _clear()
        old = (date.today() - timedelta(days=5)).isoformat()
        _insert_heat("A1", old, 1)
        deleted = cleanup_old_heat(days_to_keep=3)
        assert deleted == 1


# ---------------------------------------------------------------------------
# TestSessionCleanup
# ---------------------------------------------------------------------------


class TestSessionCleanup:
    """确认 task 函数 close session (不泄漏连接)."""

    def test_session_closed_after_call(self):
        _clear()
        _insert_heat("A1", date.today().isoformat(), 10)
        for _ in range(3):
            aggregate_daily_heat(days=7)
            cleanup_old_heat(days_to_keep=90)

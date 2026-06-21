"""app.tasks.expiration_monitor 单测 (Agent 过期监控后台任务)."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.database import SessionFactory1
from app.tasks.expiration_monitor import expire_agents, remind_expiring_soon

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _insert_buy(
    order_no: str,
    agent_id: str,
    agent_name: str,
    expiration_date,
    status: str = "0",
) -> None:
    """直接 SQL INSERT (SQLite 不支持 BigInteger AUTOINCREMENT)."""
    db = SessionFactory1()
    try:
        db.execute(
            text(
                "INSERT INTO zhs_agent_buy "
                "(id, order_no, agent_id, agent_name, bug_uuid, bug_name, "
                " bug_time, expiration_date, status, settlement, count) "
                "VALUES "
                "(:id, :ono, :aid, :an, :bu, :bn, :bt, :ed, :st, :se, 1)"
            ),
            {
                "id": _next_buy_id(),
                "ono": order_no,
                "aid": agent_id,
                "an": agent_name,
                "bu": "buyer-uuid-001",
                "bn": "buyer",
                "bt": datetime.now(UTC),
                "ed": expiration_date,
                "st": status,
                "se": "0",
            },
        )
        db.commit()
    finally:
        db.close()


def _clear() -> None:
    db = SessionFactory1()
    db.execute(text("DELETE FROM zhs_agent_buy"))
    db.commit()
    db.close()


_BUY_ID = [0]


def _next_buy_id() -> int:
    """SQLite 上 BigInteger 主键不自增, 用 module 级计数器模拟."""
    _BUY_ID[0] += 1
    return _BUY_ID[0]


# ---------------------------------------------------------------------------
# TestExpireAgents
# ---------------------------------------------------------------------------


class TestExpireAgents:
    def test_expires_overdue_active_records(self):
        _clear()
        past = datetime.now(UTC) - timedelta(days=2)
        _insert_buy("ORD001", "A1", "agent1", past, status="0")
        count = expire_agents(grace_days=0)
        assert count == 1
        db = SessionFactory1()
        try:
            row = db.execute(
                text("SELECT status FROM zhs_agent_buy WHERE order_no=:o"),
                {"o": "ORD001"},
            ).first()
            assert row[0] == "1"
        finally:
            db.close()

    def test_does_not_expire_future(self):
        _clear()
        future = datetime.now(UTC) + timedelta(days=5)
        _insert_buy("ORD002", "A1", "agent1", future, status="0")
        count = expire_agents(grace_days=0)
        assert count == 0
        db = SessionFactory1()
        try:
            row = db.execute(
                text("SELECT status FROM zhs_agent_buy WHERE order_no=:o"),
                {"o": "ORD002"},
            ).first()
            assert row[0] == "0"
        finally:
            db.close()

    def test_does_not_expire_already_expired(self):
        _clear()
        past = datetime.now(UTC) - timedelta(days=10)
        _insert_buy("ORD003", "A1", "agent1", past, status="1")
        count = expire_agents(grace_days=0)
        assert count == 0

    def test_grace_days_skips_within_grace(self):
        _clear()
        past = datetime.now(UTC) - timedelta(days=2)
        _insert_buy("ORD004", "A1", "agent1", past, status="0")
        count = expire_agents(grace_days=5)
        assert count == 0
        db = SessionFactory1()
        try:
            row = db.execute(
                text("SELECT status FROM zhs_agent_buy WHERE order_no=:o"),
                {"o": "ORD004"},
            ).first()
            assert row[0] == "0"
        finally:
            db.close()

    def test_handles_null_expiration(self):
        _clear()
        _insert_buy("ORD005", "A1", "agent1", None, status="0")
        count = expire_agents(grace_days=0)
        assert count == 0

    def test_expires_multiple(self):
        _clear()
        past = datetime.now(UTC) - timedelta(days=3)
        for i in range(5):
            _insert_buy(f"ORD_M{i}", f"A{i}", f"agent{i}", past, status="0")
        count = expire_agents(grace_days=0)
        assert count == 5

    def test_rollback_on_error_returns_zero(self, monkeypatch):
        _clear()
        past = datetime.now(UTC) - timedelta(days=3)
        _insert_buy("ORD_ERR", "A1", "agent1", past, status="0")
        # 模拟 commit 失败
        calls = {"n": 0}
        from sqlalchemy.orm import Session

        original_commit = Session.commit

        def _failing_commit(self):
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("simulated commit failure")
            return original_commit(self)

        monkeypatch.setattr(Session, "commit", _failing_commit)
        count = expire_agents(grace_days=0)
        assert count == 0


# ---------------------------------------------------------------------------
# TestRemindExpiringSoon
# ---------------------------------------------------------------------------


class TestRemindExpiringSoon:
    def test_returns_within_window(self):
        _clear()
        soon = datetime.now(UTC) + timedelta(hours=12)
        _insert_buy("ORD_SOON", "A1", "agent1", soon, status="0")
        result = remind_expiring_soon(hours_before=24)
        assert len(result) == 1
        item = result[0]
        assert item["order_no"] == "ORD_SOON"
        assert item["agent_id"] == "A1"
        assert item["agent_name"] == "agent1"
        assert item["bug_uuid"] == "buyer-uuid-001"
        assert item["expiration_date"] is not None

    def test_excludes_outside_window(self):
        _clear()
        far = datetime.now(UTC) + timedelta(hours=48)
        _insert_buy("ORD_FAR", "A1", "agent1", far, status="0")
        past = datetime.now(UTC) - timedelta(hours=5)
        _insert_buy("ORD_PAST", "A2", "agent2", past, status="0")
        result = remind_expiring_soon(hours_before=24)
        assert len(result) == 0

    def test_excludes_already_expired(self):
        _clear()
        past = datetime.now(UTC) - timedelta(hours=1)
        _insert_buy("ORD_PAST2", "A1", "agent1", past, status="0")
        result = remind_expiring_soon(hours_before=24)
        assert len(result) == 0

    def test_excludes_already_inactive(self):
        _clear()
        soon = datetime.now(UTC) + timedelta(hours=12)
        _insert_buy("ORD_INACT", "A1", "agent1", soon, status="1")
        result = remind_expiring_soon(hours_before=24)
        assert len(result) == 0

    def test_handles_null_expiration(self):
        _clear()
        _insert_buy("ORD_NULL", "A1", "agent1", None, status="0")
        result = remind_expiring_soon(hours_before=24)
        assert len(result) == 0

    def test_multiple_returns_all(self):
        _clear()
        for i in range(3):
            soon = datetime.now(UTC) + timedelta(hours=2 + i)
            _insert_buy(f"ORD_MANY_{i}", f"A{i}", f"agent{i}", soon, status="0")
        result = remind_expiring_soon(hours_before=24)
        assert len(result) == 3
        order_nos = {r["order_no"] for r in result}
        assert order_nos == {"ORD_MANY_0", "ORD_MANY_1", "ORD_MANY_2"}

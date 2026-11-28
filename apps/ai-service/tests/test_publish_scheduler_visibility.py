# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌​​​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​‌‌‌‌​‍‍​‌‌​​‌‌‌​‍‍‌‌​​‌‌​​‍‌​​‌‌‌​‍‍​​⁠

"""排期执行可观测性测试(2026-11-28 立)。

覆盖:
1. PublishScheduler.status_snapshot 的 stopped/warming/ok/stale 四态;
2. /publish/stats 返回 overdue 与 nextScheduledAt,且 SQL 用 5 分钟迟到阈值;
3. /publish/tasks?status=scheduled 按 scheduled_at 正序,超时任务不会被新任务压到后面。
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

from app.routers import publish
from app.services.publish.scheduler import PublishScheduler


class _StatsConn:
    def __init__(self, row: dict[str, Any]) -> None:
        self.row = row
        self.sql = ""
        self.closed = False

    async def fetchrow(self, sql: str, *_args: Any) -> dict[str, Any]:
        self.sql = sql
        return self.row

    async def fetch(self, _sql: str, *_args: Any) -> list[Any]:
        return []

    async def close(self) -> None:
        self.closed = True


class _ListConn:
    def __init__(self) -> None:
        self.sql = ""
        self.closed = False

    async def fetch(self, sql: str, *_args: Any) -> list[Any]:
        self.sql = sql
        return []

    async def close(self) -> None:
        self.closed = True


def _req() -> SimpleNamespace:
    return SimpleNamespace(state=SimpleNamespace(user_id="user-1"))


def test_status_snapshot_stopped_and_warming() -> None:
    scheduler = PublishScheduler()
    snap = scheduler.status_snapshot()
    assert snap["state"] == "stopped"
    assert snap["healthy"] is False
    assert snap["lastPollAt"] is None

    scheduler._started = True
    snap = scheduler.status_snapshot()
    assert snap["state"] == "warming"
    assert snap["pollIntervalSec"] > 0


def test_status_snapshot_ok_and_stale() -> None:
    scheduler = PublishScheduler()
    scheduler._started = True
    scheduler._last_poll_at = datetime.now(UTC) - timedelta(seconds=2)
    scheduler._last_poll_ok = True
    scheduler._last_due_count = 3
    snap = scheduler.status_snapshot()
    assert snap["state"] == "ok"
    assert snap["healthy"] is True
    assert snap["dueCount"] == 3
    assert snap["lastPollAt"]

    scheduler._last_poll_ok = False
    assert scheduler.status_snapshot()["state"] == "stale"

    scheduler._last_poll_ok = True
    scheduler._last_poll_at = datetime.now(UTC) - timedelta(seconds=600)
    assert scheduler.status_snapshot()["state"] == "stale"


@pytest.mark.asyncio
async def test_stats_exposes_overdue_and_next_schedule(monkeypatch: pytest.MonkeyPatch) -> None:
    next_at = datetime(2026, 11, 28, 1, 0, tzinfo=UTC)
    conn = _StatsConn(
        {
            "total": 10,
            "success": 4,
            "failed": 1,
            "partial": 0,
            "draft": 2,
            "cancelled": 0,
            "running": 1,
            "scheduled": 2,
            "overdue": 1,
            "next_scheduled_at": next_at,
        }
    )

    async def fake_conn() -> _StatsConn:
        return conn

    monkeypatch.setattr(publish, "_get_conn", fake_conn)
    monkeypatch.setattr(
        publish.publish_scheduler,
        "status_snapshot",
        lambda: {"state": "ok", "healthy": True, "dueCount": 0},
    )

    res = await publish.get_stats(_req(), days=30)  # type: ignore[arg-type]
    data = res["data"]
    assert data["tasks"]["overdue"] == 1
    assert data["tasks"]["nextScheduledAt"] == next_at.isoformat()
    assert data["scheduler"]["state"] == "ok"
    assert "INTERVAL '5 minutes'" in conn.sql
    assert "min(scheduled_at)" in conn.sql
    assert conn.closed is True


@pytest.mark.asyncio
async def test_scheduled_tasks_order_by_plan_time(monkeypatch: pytest.MonkeyPatch) -> None:
    conn = _ListConn()

    async def fake_conn() -> _ListConn:
        return conn

    monkeypatch.setattr(publish, "_get_conn", fake_conn)
    await publish.list_tasks(_req(), status="scheduled", limit=50, offset=0)  # type: ignore[arg-type]
    assert "ORDER BY scheduled_at ASC NULLS LAST, created_at DESC" in conn.sql
    assert conn.closed is True

    conn2 = _ListConn()

    async def fake_conn2() -> _ListConn:
        return conn2

    monkeypatch.setattr(publish, "_get_conn", fake_conn2)
    await publish.list_tasks(_req(), status=None, limit=50, offset=0)  # type: ignore[arg-type]
    assert "ORDER BY created_at DESC" in conn2.sql

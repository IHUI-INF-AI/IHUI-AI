# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""已排期任务的改期/取消契约测试(2026-11-28 立)。

只打桩数据库与调度器，不连真库、不执行发布：
- 改期只允许 scheduled/pending，且必须带 scheduled_at；
- 取消 scheduled 要落成 cancelled，未开始的任务不交给 running 集合处理。
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

import app.routers.publish as publish_router


class FakeConn:
    def __init__(self, row: dict[str, Any] | None = None):
        self.row = row
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self.closed = False

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        if "SELECT user_id, status" in sql:
            return self.row
        return None

    async def execute(self, sql: str, *args: Any) -> None:
        self.executed.append((sql, args))

    async def close(self) -> None:
        self.closed = True


@pytest.fixture
def req():
    return SimpleNamespace(state=SimpleNamespace(user_id="user-1"))


async def test_reschedule_scheduled_task(monkeypatch, req):
    when = datetime(2026, month=11, day=30, hour=1, minute=0, tzinfo=UTC)
    conn = FakeConn({"user_id": "user-1", "status": "scheduled"})

    async def fake_conn():
        return conn

    monkeypatch.setattr(publish_router, "_get_conn", fake_conn)

    body = SimpleNamespace(scheduled_at=when)
    res = await publish_router.reschedule_task("pub-1", body, req)
    assert res["code"] == 0
    assert res["data"]["scheduled_at"] == when.isoformat()
    assert conn.executed
    assert conn.executed[0][1] == ("pub-1", when)
    assert conn.closed is True


async def test_reschedule_rejects_finished_task(monkeypatch, req):
    conn = FakeConn({"user_id": "user-1", "status": "success"})

    async def fake_conn():
        return conn

    monkeypatch.setattr(publish_router, "_get_conn", fake_conn)

    with pytest.raises(HTTPException) as exc_info:
        await publish_router.reschedule_task(
            "pub-1", SimpleNamespace(scheduled_at=datetime.now(UTC)), req
        )
    assert exc_info.value.status_code == 400


async def test_cancel_scheduled_task_marks_cancelled(monkeypatch, req):
    conn = FakeConn({"user_id": "user-1", "status": "scheduled"})

    async def fake_conn():
        return conn

    async def fake_cancel(task_id: str) -> bool:
        return False

    monkeypatch.setattr(publish_router, "_get_conn", fake_conn)
    monkeypatch.setattr(publish_router.publish_scheduler, "cancel_task", fake_cancel)

    res = await publish_router.cancel_task("pub-1", req)
    assert res["data"]["status"] == "cancelled"
    assert any("status='cancelled'" in sql for sql, _ in conn.executed)
    assert conn.closed is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

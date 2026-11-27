# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""人工确认草稿端点测试(2026-11-27 立)。

覆盖:草稿转 scheduled、非草稿拒绝、预检阻断保持 draft、任务归属 404。
数据库与 run_preflight 全部打桩,不连真库、不执行发布。
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

import app.routers.publish as publish_router


class FakeConn:
    def __init__(
        self,
        task: dict[str, Any] | None = None,
        updated: dict[str, Any] | None = None,
    ):
        self.task = task
        self.updated = updated
        self.update_args: tuple[Any, ...] | None = None
        self.closed = False

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        if "SELECT task_id, user_id" in sql:
            return self.task
        if "UPDATE publish_tasks" in sql:
            self.update_args = args
            return self.updated
        return None

    async def close(self) -> None:
        self.closed = True


def _draft_task(status: str = "draft") -> dict[str, Any]:
    return {
        "task_id": "pub-1",
        "user_id": "user-1",
        "title": "草稿标题",
        "format": "md",
        "content": '{"text":"正文","images":[]}',
        "targets": '[{"platform":"douyin","account_id":1}]',
        "status": status,
    }


async def _fake_preflight_ok(conn, user_id, targets, content):
    return {"ok": True, "blocked": 0, "warnings": 0, "targets": [{"platform": "douyin", "accountId": 1, "ok": True}]}


@pytest.fixture
def req():
    return SimpleNamespace(state=SimpleNamespace(user_id="user-1"))


async def test_confirm_draft_moves_to_scheduled(monkeypatch, req):
    now = datetime(2026, 11, 27, 8, 0, tzinfo=UTC)
    conn = FakeConn(_draft_task(), {"task_id": "pub-1", "status": "scheduled", "scheduled_at": now})

    async def fake_conn():
        return conn

    monkeypatch.setattr(publish_router, "_get_conn", fake_conn)
    monkeypatch.setattr(publish_router, "run_preflight", _fake_preflight_ok)

    res = await publish_router.confirm_draft("pub-1", req)
    assert res["code"] == 0
    assert res["data"]["status"] == "scheduled"
    assert res["data"]["taskId"] == "pub-1"
    assert conn.update_args[0] == "pub-1"
    assert conn.update_args[2] == "user-1"
    assert conn.closed is True


async def test_confirm_draft_passes_scheduled_at(monkeypatch, req):
    when = datetime(2026, 11, 29, 1, 30, tzinfo=UTC)
    conn = FakeConn(_draft_task(), {"task_id": "pub-1", "status": "scheduled", "scheduled_at": when})

    async def fake_conn():
        return conn

    monkeypatch.setattr(publish_router, "_get_conn", fake_conn)
    monkeypatch.setattr(publish_router, "run_preflight", _fake_preflight_ok)

    body = SimpleNamespace(scheduled_at=when)
    res = await publish_router.confirm_draft("pub-1", req, body)
    assert res["data"]["scheduledAt"] == when.isoformat()
    assert conn.update_args[1] is when


async def test_confirm_draft_rejects_non_draft(monkeypatch, req):
    conn = FakeConn(_draft_task(status="scheduled"))

    async def fake_conn():
        return conn

    monkeypatch.setattr(publish_router, "_get_conn", fake_conn)
    with pytest.raises(HTTPException) as exc_info:
        await publish_router.confirm_draft("pub-1", req)
    assert exc_info.value.status_code == 409


async def test_confirm_draft_keeps_draft_when_preflight_blocks(monkeypatch, req):
    conn = FakeConn(_draft_task())

    async def fake_conn():
        return conn

    async def fake_blocked(conn_, user_id, targets, content):
        return {
            "ok": False,
            "blocked": 1,
            "warnings": 0,
            "targets": [{"platform": "douyin", "accountId": 1, "ok": False, "message": "登录态过期"}],
        }

    monkeypatch.setattr(publish_router, "_get_conn", fake_conn)
    monkeypatch.setattr(publish_router, "run_preflight", fake_blocked)

    with pytest.raises(HTTPException) as exc_info:
        await publish_router.confirm_draft("pub-1", req)
    assert exc_info.value.status_code == 409
    assert conn.update_args is None


async def test_confirm_draft_missing_task_404(monkeypatch, req):
    conn = FakeConn(None)

    async def fake_conn():
        return conn

    monkeypatch.setattr(publish_router, "_get_conn", fake_conn)
    with pytest.raises(HTTPException) as exc_info:
        await publish_router.confirm_draft("pub-404", req)
    assert exc_info.value.status_code == 404
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

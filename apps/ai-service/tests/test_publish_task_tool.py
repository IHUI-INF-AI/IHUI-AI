# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""get_publish_task 单任务详情工具测试（2026-11-27 立）。

覆盖：归属查询、正文/目标/逐平台结果、指标快照、失败诊断建议、
指标/历史表缺失降级、草稿建议、MCP 注册。数据库全部打桩，不连真库、不执行发布。
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest

from app.tools import publish_tools
from app.tools.publish_tools import get_publish_task


class FakeConn:
    def __init__(
        self,
        task: dict[str, Any] | None = None,
        history: list[dict[str, Any]] | None = None,
        metrics: list[dict[str, Any]] | None = None,
        history_error: bool = False,
        metrics_error: bool = False,
    ):
        self.task = task
        self.history = history or []
        self.metrics = metrics or []
        self.history_error = history_error
        self.metrics_error = metrics_error
        self.closed = False

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        if "FROM publish_tasks" in sql:
            return self.task
        return None

    async def fetch(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        if "FROM publish_history" in sql:
            if self.history_error:
                raise RuntimeError("history table missing")
            return self.history
        if "FROM publish_metrics" in sql:
            if self.metrics_error:
                raise RuntimeError("metrics table missing")
            return self.metrics
        return []

    async def close(self) -> None:
        self.closed = True


def _task(**overrides: Any) -> dict[str, Any]:
    base = {
        "task_id": "pub-1",
        "title": "AI时代普通人如何做好内容的变现",
        "format": "md",
        "status": "failed",
        "content": json.dumps({"text": "正文" * 240, "images": ["https://img.example/a.png"]}),
        "targets": json.dumps([{"platform": "douyin", "account_id": 7}]),
        "results": json.dumps([{"platform": "douyin", "challenge": {"type": "captcha"}}]),
        "error": None,
        "scheduled_at": datetime(2026, 11, 27, 8, 0, tzinfo=UTC),
        "started_at": datetime(2026, 11, 27, 8, 1, tzinfo=UTC),
        "finished_at": datetime(2026, 11, 27, 8, 2, tzinfo=UTC),
        "created_at": datetime(2026, 11, 27, 7, 59, tzinfo=UTC),
        "updated_at": datetime(2026, 11, 27, 8, 2, tzinfo=UTC),
    }
    base.update(overrides)
    return base


def _history(**overrides: Any) -> dict[str, Any]:
    base = {
        "platform": "douyin",
        "success": False,
        "published_url": None,
        "platform_content_id": None,
        "error_message": "登录态已过期，请重新扫码",
        "duration_ms": 1200,
        "created_at": datetime(2026, 11, 27, 8, 2, tzinfo=UTC),
    }
    base.update(overrides)
    return base


@pytest.fixture
def fake_conn(monkeypatch):
    def _install(conn: FakeConn):
        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        return conn

    return _install


async def test_returns_task_detail_without_user_id_or_credentials(fake_conn):
    conn = fake_conn(
        FakeConn(
            _task(),
            [_history()],
            [{"platform": "douyin", "views": 100, "likes": 10, "comments": 3, "shares": 2, "collected_at": datetime(2026, 11, 27, 9, 0, tzinfo=UTC)}],
        )
    )

    res = await get_publish_task({"__user_id": "user-1", "task_id": "pub-1"})
    assert res["ok"] is True
    assert res["taskId"] == "pub-1"
    assert res["status"] == "failed"
    assert res["content"]["text"].startswith("正文")
    assert res["targets"] == [{"platform": "douyin", "accountId": 7, "poolId": None}]
    assert res["platforms"][0]["success"] is False
    assert res["platforms"][0]["errorMessage"].startswith("登录态")
    assert res["platforms"][0]["metrics"]["views"] == 100
    assert res["challenges"] == [{"type": "captcha"}]
    assert res["nextActions"][0]["action"] == "account.reconnect"
    assert res["nextActions"][0]["humanOnly"] is True
    assert res["metricsAvailable"] is True
    assert "user-1" not in json.dumps(res, ensure_ascii=False)
    assert "credentials" not in json.dumps(res, ensure_ascii=False)
    assert conn.closed is True


async def test_draft_next_action_is_human_confirm(fake_conn):
    fake_conn(FakeConn(_task(status="draft", started_at=None, finished_at=None), [], []))
    res = await get_publish_task({"__user_id": "user-1", "task_id": "pub-1"})
    assert res["ok"] is True
    assert res["nextActions"][0]["action"] == "publish.confirm"
    assert res["nextActions"][0]["humanOnly"] is True


async def test_metrics_table_missing_is_degraded_not_fatal(fake_conn):
    fake_conn(FakeConn(_task(status="success"), [_history(success=True, error_message=None)], [], metrics_error=True))
    res = await get_publish_task({"__user_id": "user-1", "task_id": "pub-1"})
    assert res["ok"] is True
    assert res["metricsAvailable"] is False
    assert res["historyAvailable"] is True
    assert "指标快照" in res["hint"]
    assert res["platforms"][0]["metrics"] is None


async def test_history_table_missing_is_degraded_not_fatal(fake_conn):
    fake_conn(FakeConn(_task(), [], [], history_error=True))
    res = await get_publish_task({"__user_id": "user-1", "task_id": "pub-1"})
    assert res["ok"] is True
    assert res["historyAvailable"] is False
    assert res["platforms"] == []


async def test_task_not_found(fake_conn):
    conn = fake_conn(FakeConn(None))
    res = await get_publish_task({"__user_id": "user-1", "task_id": "pub-404"})
    assert res["ok"] is False
    assert res["errorCode"] == "TASK_NOT_FOUND"
    assert conn.closed is True


async def test_missing_user():
    res = await get_publish_task({"task_id": "pub-1"})
    assert res["ok"] is False
    assert res["errorCode"] == "MISSING_USER"


async def test_invalid_task_id():
    res = await get_publish_task({"__user_id": "user-1", "task_id": "  "})
    assert res["ok"] is False
    assert res["errorCode"] == "INVALID_TASK_ID"


def test_registered_in_mcp_registry():
    from app.services.mcp_server import _TOOL_HANDLERS, _TOOLS, mcp_server

    names = {tool.name for tool in _TOOLS}
    assert "get_publish_task" in names
    assert "get_publish_task" in _TOOL_HANDLERS
    assert "get_publish_task" in {tool.name for tool in mcp_server.list_tools()}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

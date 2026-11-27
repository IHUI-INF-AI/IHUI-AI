# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""publish_tools 发布工具测试（2026-11-27 立）。

覆盖：账号清单脱敏/过滤/空表、发布预检的内容合规合并、账号预检合并、
缺少正文/文件、非法 targets、草稿落库闸门、发布统计、MCP 注册与清单可见。
数据库与 run_preflight 全部打桩，不连真库、不打开浏览器、不执行发布。
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import app.services.publish.preflight as preflight_module
from app.tools import publish_tools
from app.tools.publish_tools import (
    create_publish_draft,
    get_publish_acceptance,
    get_publish_stats,
    list_publish_accounts,
    list_publish_tasks,
    publish_preflight,
)

_TITLE_16 = "AI时代普通人如何做好内容的变现"
_HASHTAGS_5 = ["#AI", "#人工智能", "#内容创作", "#普通人副业", "#AI工具"]


class FakeConn:
    def __init__(
        self,
        rows: list[dict[str, Any]],
        sessions: list[dict[str, Any]] | None = None,
        task_stats: dict[str, Any] | None = None,
        platform_rows: list[dict[str, Any]] | None = None,
        metric_rows: list[dict[str, Any]] | None = None,
        metrics_error: bool = False,
    ):
        self.rows = rows
        self.sessions = sessions or []
        self.task_stats = task_stats
        self.platform_rows = platform_rows or []
        self.metric_rows = metric_rows or []
        self.metrics_error = metrics_error
        self.closed = False

    async def fetch(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        if "publish_metrics" in sql:
            if self.metrics_error:
                raise RuntimeError("metrics table missing")
            return self.metric_rows
        if "publish_history" in sql:
            return self.platform_rows
        if "publish_accounts" in sql:
            return self.rows
        if "publish_session_state" in sql:
            return self.sessions
        return []

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        if "publish_tasks" in sql:
            return self.task_stats
        return None

    async def close(self) -> None:
        self.closed = True


def _row(**overrides: Any) -> dict[str, Any]:
    base = {
        "id": 1,
        "platform": "douyin",
        "display_name": "智汇AI主号",
        "status": "active",
        "credentials_enc": "cipher-should-not-leak",
        "last_verified_at": datetime(2026, 11, 27, 9, 0, tzinfo=UTC),
        "last_verify_msg": "登录态有效",
        "extra": {"publish_blocked": False},
        "created_at": datetime(2026, 11, 1, 9, 0, tzinfo=UTC),
    }
    base.update(overrides)
    return base


class TestListAccounts:
    async def test_sanitizes_and_never_leaks_credentials(self, monkeypatch):
        conn = FakeConn([_row()], [{"account_id": 1, "status": "healthy", "last_error": ""}])

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await list_publish_accounts({"__user_id": "user-1"})
        assert res["ok"] is True
        assert res["count"] == 1
        item = res["items"][0]
        assert item["accountId"] == 1
        assert item["hasCredentials"] is True
        assert item["sessionStatus"] == "healthy"
        assert "credentials" not in item
        assert "userId" not in item
        dumped = json.dumps(res, ensure_ascii=False)
        assert "cipher-should-not-leak" not in dumped

    async def test_platform_filter(self, monkeypatch):
        conn = FakeConn([_row(), _row(id=2, platform="xiaohongshu", display_name="小红书号")])

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await list_publish_accounts({"__user_id": "user-1", "platform": "xiaohongshu"})
        assert res["count"] == 1
        assert res["items"][0]["platform"] == "xiaohongshu"

    async def test_include_disabled_false(self, monkeypatch):
        conn = FakeConn([_row(), _row(id=2, status="disabled", display_name="停用号")])

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await list_publish_accounts({"__user_id": "user-1", "include_disabled": False})
        assert res["count"] == 1
        assert res["items"][0]["status"] == "active"

    async def test_empty_is_ok(self, monkeypatch):
        conn = FakeConn([])

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await list_publish_accounts({"__user_id": "user-1"})
        assert res["ok"] is True
        assert res["count"] == 0
        assert "还没有" in res["hint"]

    async def test_missing_user(self):
        res = await list_publish_accounts({})
        assert res["ok"] is False
        assert res["errorCode"] == "MISSING_USER"


class TestPublishPreflight:
    async def _fake_preflight(self, monkeypatch, result: dict[str, Any] | None = None):
        captured: dict[str, Any] = {}

        async def fake_run(conn, user_id, targets, content):
            captured["user_id"] = user_id
            captured["targets"] = targets
            captured["content"] = content
            return result or {
                "ok": True,
                "blocked": 0,
                "warnings": 0,
                "targets": [{"platform": "douyin", "accountId": 1, "ok": True, "code": "ok"}],
            }

        monkeypatch.setattr(preflight_module, "run_preflight", fake_run)
        return captured

    async def test_content_and_targets_pass(self, monkeypatch):
        captured = await self._fake_preflight(monkeypatch)
        conn = FakeConn([])

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await publish_preflight(
            {
                "__user_id": "user-1",
                "title": _TITLE_16,
                "format": "md",
                "text": "字" * 480,
                "hashtags": list(_HASHTAGS_5),
                "profile": "ihui_koubo",
                "targets": [{"platform": "douyin", "account_id": 1}],
            }
        )
        assert res["ok"] is True
        assert res["contentOk"] is True
        assert res["targetsOk"] is True
        assert res["contentCheck"]["blocking"] == 0
        assert captured["user_id"] == "user-1"
        assert captured["targets"] == [{"platform": "douyin", "account_id": 1}]
        assert captured["content"].format == "md"
        assert captured["content"].text == "字" * 480

    async def test_content_block_makes_overall_false(self, monkeypatch):
        await self._fake_preflight(monkeypatch)
        conn = FakeConn([])

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await publish_preflight(
            {
                "__user_id": "user-1",
                "title": "#" + _TITLE_16,
                "format": "md",
                "text": "字" * 480,
                "hashtags": list(_HASHTAGS_5),
                "profile": "ihui_koubo",
                "targets": [{"platform": "douyin", "account_id": 1}],
            }
        )
        assert res["ok"] is False
        assert res["contentOk"] is False
        assert res["blocked"] == res["contentCheck"]["blocking"]
        assert res["contentCheck"]["blocking"] >= 1

    async def test_target_block_makes_overall_false(self, monkeypatch):
        await self._fake_preflight(
            monkeypatch,
            {
                "ok": False,
                "blocked": 1,
                "warnings": 0,
                "targets": [
                    {
                        "platform": "douyin",
                        "accountId": 1,
                        "ok": False,
                        "code": "auth_required",
                        "message": "登录态已过期",
                    }
                ],
            }
        )
        conn = FakeConn([])

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await publish_preflight(
            {
                "__user_id": "user-1",
                "title": _TITLE_16,
                "format": "md",
                "text": "字" * 480,
                "hashtags": list(_HASHTAGS_5),
                "profile": "ihui_koubo",
                "targets": [{"platform": "douyin", "account_id": 1}],
            }
        )
        assert res["ok"] is False
        assert res["targetsOk"] is False
        assert res["blocked"] == 1
        assert res["targets"][0]["code"] == "auth_required"

    async def test_md_without_text_or_file(self):
        res = await publish_preflight(
            {
                "__user_id": "user-1",
                "title": _TITLE_16,
                "format": "md",
                "targets": [{"platform": "douyin", "account_id": 1}],
            }
        )
        assert res["ok"] is False
        assert res["errorCode"] == "MISSING_CONTENT"

    async def test_video_without_file(self):
        res = await publish_preflight(
            {
                "__user_id": "user-1",
                "title": _TITLE_16,
                "format": "video",
                "targets": [{"platform": "douyin", "account_id": 1}],
            }
        )
        assert res["ok"] is False
        assert res["errorCode"] == "MISSING_FILE"

    async def test_empty_targets(self):
        res = await publish_preflight(
            {
                "__user_id": "user-1",
                "title": _TITLE_16,
                "format": "md",
                "text": "字" * 480,
                "targets": [],
            }
        )
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TARGETS"

    async def test_bad_target_account_id(self):
        res = await publish_preflight(
            {
                "__user_id": "user-1",
                "title": _TITLE_16,
                "format": "md",
                "text": "字" * 480,
                "targets": [{"platform": "douyin", "account_id": "1"}],
            }
        )
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TARGETS"

    async def test_missing_user(self):
        res = await publish_preflight(
            {"title": _TITLE_16, "format": "md", "text": "字" * 480, "targets": [{"platform": "douyin"}]}
        )
        assert res["ok"] is False
        assert res["errorCode"] == "MISSING_USER"


class TestCreateDraft:
    async def _fake_preflight(self, monkeypatch, ok: bool = True):
        async def fake_run(conn, user_id, targets, content):
            return {
                "ok": ok,
                "blocked": 0 if ok else 1,
                "warnings": 0,
                "targets": [{"platform": "douyin", "accountId": 1, "ok": ok, "code": "ok" if ok else "blocked"}],
            }

        monkeypatch.setattr(preflight_module, "run_preflight", fake_run)
        conn = FakeConn([])

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)

    async def test_creates_draft_without_dispatch(self, monkeypatch, tmp_path):
        await self._fake_preflight(monkeypatch)
        captured: dict[str, Any] = {}

        async def fake_submit(**kwargs):
            captured.update(kwargs)
            return {"ok": True, "task_id": kwargs["task_id"], "status": "draft"}

        from app.services.publish.scheduler import publish_scheduler

        monkeypatch.setattr(publish_scheduler, "submit_task", fake_submit)
        res = await create_publish_draft(
            {
                "__user_id": "user-1",
                "title": "AI时代的发布草稿",
                "format": "md",
                "text": "字" * 480,
                "targets": [{"platform": "douyin", "account_id": 1}],
            }
        )
        assert res["ok"] is True
        assert res["status"] == "draft"
        assert res["taskId"] == captured["task_id"]
        assert captured["as_draft"] is True
        assert captured["targets"][0]["account_id"] == 1
        assert captured["idempotency_key"].startswith("draft-")
        assert res["confirm"]["path"] == "/publish/history"

    async def test_preflight_block_does_not_create(self, monkeypatch):
        await self._fake_preflight(monkeypatch, ok=False)
        res = await create_publish_draft(
            {
                "__user_id": "user-1",
                "title": "标题",
                "format": "md",
                "text": "正文",
                "targets": [{"platform": "douyin", "account_id": 1}],
            }
        )
        assert res["ok"] is False
        assert res["errorCode"] == "PREFLIGHT_BLOCKED"

    async def test_account_id_required(self, monkeypatch):
        await self._fake_preflight(monkeypatch)
        res = await create_publish_draft(
            {
                "__user_id": "user-1",
                "title": "标题",
                "format": "md",
                "text": "正文",
                "targets": [{"platform": "douyin"}],
            }
        )
        assert res["ok"] is False
        assert res["errorCode"] == "ACCOUNT_REQUIRED"

    async def test_file_outside_upload_root_rejected(self, monkeypatch, tmp_path):
        await self._fake_preflight(monkeypatch)
        monkeypatch.setattr(publish_tools, "_upload_root", lambda: tmp_path)
        outside = tmp_path.parent / "secret.pdf"
        outside.write_text("x", encoding="utf-8")
        res = await create_publish_draft(
            {
                "__user_id": "user-1",
                "title": "标题",
                "format": "pdf",
                "file_path": str(outside),
                "targets": [{"platform": "douyin", "account_id": 1}],
            }
        )
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_FILE_PATH"

    async def test_missing_user(self):
        res = await create_publish_draft({})
        assert res["ok"] is False
        assert res["errorCode"] == "MISSING_USER"


class TestPublishStats:
    async def test_aggregates_tasks_platforms_and_metrics(self, monkeypatch):
        conn = FakeConn(
            [],
            task_stats={
                "total": 12,
                "success": 8,
                "failed": 2,
                "partial": 1,
                "cancelled": 1,
                "running": 0,
                "scheduled": 0,
            },
            platform_rows=[
                {"platform": "douyin", "total": 10, "success": 8, "failed": 2, "avg_ms": 1234}
            ],
            metric_rows=[
                {"task_id": "t1", "platform": "douyin", "views": 100, "likes": 10, "comments": 3, "shares": 2},
                {"task_id": "t2", "platform": "douyin", "views": 50, "likes": 5, "comments": 1, "shares": 1},
            ],
        )

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await get_publish_stats({"__user_id": "user-1", "days": 30})
        assert res["ok"] is True
        assert res["tasks"]["total"] == 12
        assert res["tasks"]["successRate"] == round(8 / 11, 4)
        assert res["platforms"][0]["successRate"] == 0.8
        assert res["platforms"][0]["avgMs"] == 1234
        assert res["engagement"] == {"views": 150, "likes": 15, "comments": 4, "shares": 3}
        assert res["byPlatformEngagement"][0]["views"] == 150
        assert res["metricsAvailable"] is True

    async def test_metrics_table_missing_is_not_fatal(self, monkeypatch):
        conn = FakeConn(
            [],
            task_stats={"total": 1, "success": 1},
            platform_rows=[],
            metrics_error=True,
        )

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await get_publish_stats({"__user_id": "user-1"})
        assert res["ok"] is True
        assert res["metricsAvailable"] is False
        assert res["engagement"]["views"] == 0

    async def test_empty_history_hint(self, monkeypatch):
        conn = FakeConn(
            [],
            task_stats={"total": 0, "success": 0, "failed": 0, "partial": 0, "cancelled": 0, "running": 0, "scheduled": 0},
        )

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await get_publish_stats({"__user_id": "user-1"})
        assert res["ok"] is True
        assert "还没有" in res["hint"]

    async def test_invalid_days(self):
        res = await get_publish_stats({"__user_id": "user-1", "days": "30"})
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_DAYS"

    async def test_missing_user(self):
        res = await get_publish_stats({})
        assert res["ok"] is False
        assert res["errorCode"] == "MISSING_USER"


class FakeTaskListConn:
    def __init__(self, rows: list[dict[str, Any]]):
        self.rows = rows
        self.closed = False
        self.sql = ""
        self.args: tuple[Any, ...] = ()

    async def fetch(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        self.sql = sql
        self.args = args
        return self.rows

    async def close(self) -> None:
        self.closed = True


class TestListTasks:
    async def test_returns_sanitized_queue_and_status_filter(self, monkeypatch):
        conn = FakeTaskListConn(
            [
                {
                    "task_id": "pub-1",
                    "title": "标题" * 120,
                    "format": "md",
                    "status": "draft",
                    "content": {"text": "正文" * 150, "file_path": None},
                    "targets": json.dumps([{"platform": "douyin", "account_id": 7}]),
                    "error": None,
                    "scheduled_at": None,
                    "created_at": datetime(2026, 11, 27, 9, 0, tzinfo=UTC),
                    "updated_at": datetime(2026, 11, 27, 9, 1, tzinfo=UTC),
                }
            ]
        )

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await list_publish_tasks({"__user_id": "user-1", "status": "draft", "limit": 10})
        assert res["ok"] is True
        assert res["count"] == 1
        item = res["items"][0]
        assert item["taskId"] == "pub-1"
        assert item["status"] == "draft"
        assert item["targets"] == [{"platform": "douyin", "accountId": 7}]
        assert len(item["preview"]) == 200
        assert len(item["title"]) == 200
        assert "userId" not in json.dumps(res, ensure_ascii=False)
        assert conn.closed is True
        assert "status=$3" in conn.sql
        assert conn.args[2] == "draft"

    async def test_invalid_filters_and_missing_user(self):
        bad_status = await list_publish_tasks({"__user_id": "user-1", "status": "unknown"})
        assert bad_status["ok"] is False
        assert bad_status["errorCode"] == "INVALID_STATUS"
        bad_limit = await list_publish_tasks({"__user_id": "user-1", "limit": 0})
        assert bad_limit["ok"] is False
        assert bad_limit["errorCode"] == "INVALID_LIMIT"
        missing = await list_publish_tasks({})
        assert missing["ok"] is False
        assert missing["errorCode"] == "MISSING_USER"

    async def test_empty_queue_hint(self, monkeypatch):
        conn = FakeTaskListConn([])

        async def fake_open():
            return conn

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await list_publish_tasks({"__user_id": "user-1"})
        assert res["ok"] is True
        assert res["count"] == 0
        assert "没有" in res["hint"]


class TestAcceptance:
    async def test_returns_matrix_without_user_id(self, monkeypatch):
        conn = FakeConn([])
        captured: dict[str, Any] = {}

        async def fake_open():
            return conn

        async def fake_matrix(_conn, user_id, platform):
            captured["user_id"] = user_id
            captured["platform"] = platform
            return {
                "generatedAt": "2026-11-27T09:00:00+00:00",
                "userId": "user-1",
                "summary": {"totalPlatforms": 1, "verified": 1},
                "platforms": [
                    {
                        "platform": "douyin",
                        "status": "verified",
                        "publishReadiness": "ready",
                        "nextAction": "可以直接发",
                    }
                ],
            }

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        monkeypatch.setattr(publish_tools, "_acceptance_matrix", fake_matrix)
        res = await get_publish_acceptance({"__user_id": "user-1", "platform": "douyin"})
        assert res["ok"] is True
        assert res["count"] == 1
        assert res["summary"]["verified"] == 1
        assert res["platforms"][0]["status"] == "verified"
        assert "userId" not in json.dumps(res, ensure_ascii=False)
        assert captured == {"user_id": "user-1", "platform": "douyin"}
        assert conn.closed is True

    async def test_invalid_platform_and_missing_user(self):
        bad = await get_publish_acceptance({"__user_id": "user-1", "platform": 7})
        assert bad["ok"] is False
        assert bad["errorCode"] == "INVALID_PLATFORM"
        missing = await get_publish_acceptance({})
        assert missing["ok"] is False
        assert missing["errorCode"] == "MISSING_USER"

    async def test_db_unavailable(self, monkeypatch):
        async def fake_open():
            raise RuntimeError("DATABASE_URL not configured")

        monkeypatch.setattr(publish_tools, "_open_conn", fake_open)
        res = await get_publish_acceptance({"__user_id": "user-1"})
        assert res["ok"] is False
        assert res["errorCode"] == "DB_UNAVAILABLE"


class TestRegistry:
    def test_registered_in_mcp_registry(self):
        from app.services.mcp_server import _TOOL_HANDLERS, _TOOLS

        names = {tool.name for tool in _TOOLS}
        assert "list_publish_accounts" in names
        assert "publish_preflight" in names
        assert "create_publish_draft" in names
        assert "get_publish_stats" in names
        assert "get_publish_acceptance" in names
        assert "list_publish_tasks" in names
        assert "list_publish_accounts" in _TOOL_HANDLERS
        assert "publish_preflight" in _TOOL_HANDLERS
        assert "create_publish_draft" in _TOOL_HANDLERS
        assert "get_publish_stats" in _TOOL_HANDLERS
        assert "get_publish_acceptance" in _TOOL_HANDLERS
        assert "list_publish_tasks" in _TOOL_HANDLERS

    def test_list_tools_exposes_both(self):
        from app.services.mcp_server import mcp_server

        names = {tool.name for tool in mcp_server.list_tools()}
        assert "list_publish_accounts" in names
        assert "publish_preflight" in names
        assert "create_publish_draft" in names
        assert "get_publish_stats" in names
        assert "get_publish_acceptance" in names
        assert "list_publish_tasks" in names
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

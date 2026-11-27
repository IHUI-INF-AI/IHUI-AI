# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""update_publish_draft 草稿编辑工具测试（2026-11-27 立）。

覆盖：字段合并、仍是 draft、预检阻断不落库、非草稿拒绝、越权/不存在、
空标题、上传目录外文件、缺 account_id、MCP 注册。数据库与预检全部打桩。
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest

import app.services.publish.preflight as preflight_module
from app.tools import publish_tools
from app.tools.publish_tools import update_publish_draft


class FakeConn:
    def __init__(self, task: dict[str, Any] | None = None, updated: dict[str, Any] | None = None):
        self.task = task
        self.updated = updated
        self.update_args: tuple[Any, ...] | None = None
        self.closed = False

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        if "SELECT task_id, title, format, status, content, targets" in sql:
            return self.task
        if "UPDATE publish_tasks" in sql:
            self.update_args = args
            return self.updated
        return None

    async def close(self) -> None:
        self.closed = True


def _task(**overrides: Any) -> dict[str, Any]:
    base = {
        "task_id": "pub-1",
        "title": "旧标题",
        "format": "md",
        "status": "draft",
        "content": json.dumps({"text": "旧正文", "images": ["https://img.example/a.png"]}),
        "targets": json.dumps([{"platform": "douyin", "account_id": 7}]),
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


@pytest.fixture
def fake_preflight(monkeypatch):
    state: dict[str, Any] = {"ok": True, "captured": None}

    async def _preflight(arguments):
        state["captured"] = arguments
        return {
            "ok": state["ok"],
            "blocked": 0 if state["ok"] else 1,
            "warnings": 1,
            "contentCheck": {"contentHash": "hash-1"},
            "targets": [{"platform": "douyin", "accountId": 7, "ok": state["ok"]}],
        }

    monkeypatch.setattr(publish_tools, "publish_preflight", _preflight)
    return state


async def test_merges_only_explicit_fields_and_stays_draft(fake_conn, fake_preflight):
    now = datetime(2026, 11, 27, 9, 0, tzinfo=UTC)
    conn = fake_conn(FakeConn(_task(), {"task_id": "pub-1", "status": "draft", "updated_at": now}))

    res = await update_publish_draft(
        {"__user_id": "user-1", "task_id": "pub-1", "title": "新标题", "text": "新正文"}
    )
    assert res["ok"] is True
    assert res["status"] == "draft"
    assert res["title"] == "新标题"
    assert res["changedFields"] == ["text", "title"]
    assert res["contentHash"] == "hash-1"
    assert fake_preflight["captured"]["title"] == "新标题"
    assert fake_preflight["captured"]["format"] == "md"
    assert fake_preflight["captured"]["text"] == "新正文"
    assert fake_preflight["captured"]["targets"] == [{"platform": "douyin", "account_id": 7}]
    assert conn.update_args[0] == "新标题"
    assert conn.update_args[1] == "md"
    saved = json.loads(conn.update_args[2])
    assert saved["text"] == "新正文"
    assert saved["images"] == ["https://img.example/a.png"]
    assert json.loads(conn.update_args[3]) == [{"platform": "douyin", "account_id": 7}]
    assert conn.closed is True


async def test_preflight_block_keeps_original_draft(fake_conn, fake_preflight):
    fake_preflight["ok"] = False
    conn = fake_conn(FakeConn(_task()))
    res = await update_publish_draft(
        {"__user_id": "user-1", "task_id": "pub-1", "title": "带#号的新标题", "text": "新正文"}
    )
    assert res["ok"] is False
    assert res["errorCode"] == "PREFLIGHT_BLOCKED"
    assert conn.update_args is None
    assert conn.closed is True


async def test_real_preflight_blocks_title_with_hash(fake_conn, monkeypatch):
    conn = fake_conn(FakeConn(_task()))
    captured: dict[str, Any] = {}

    async def fake_run(conn_, user_id, targets, content):
        captured["content"] = content
        captured["targets"] = targets
        return {
            "ok": True,
            "blocked": 0,
            "warnings": 0,
            "targets": [{"platform": "douyin", "accountId": 7, "ok": True}],
        }

    monkeypatch.setattr(preflight_module, "run_preflight", fake_run)
    res = await update_publish_draft(
        {"__user_id": "user-1", "task_id": "pub-1", "title": "#带井号的标题", "text": "新正文"}
    )
    assert res["ok"] is False
    assert res["errorCode"] == "PREFLIGHT_BLOCKED"
    assert res["blocked"] >= 1
    assert conn.update_args is None
    assert captured["content"].title == "#带井号的标题"


async def test_non_draft_is_rejected(fake_conn, fake_preflight):
    conn = fake_conn(FakeConn(_task(status="scheduled")))
    res = await update_publish_draft({"__user_id": "user-1", "task_id": "pub-1", "title": "新标题"})
    assert res["ok"] is False
    assert res["errorCode"] == "NOT_DRAFT"
    assert conn.update_args is None


async def test_task_not_found(fake_conn, fake_preflight):
    conn = fake_conn(FakeConn(None))
    res = await update_publish_draft({"__user_id": "user-1", "task_id": "pub-404", "title": "新标题"})
    assert res["ok"] is False
    assert res["errorCode"] == "TASK_NOT_FOUND"
    assert conn.closed is True


async def test_empty_title_rejected_before_preflight(fake_conn, fake_preflight):
    conn = fake_conn(FakeConn(_task()))
    res = await update_publish_draft({"__user_id": "user-1", "task_id": "pub-1", "title": "  "})
    assert res["ok"] is False
    assert res["errorCode"] == "INVALID_TITLE"
    assert fake_preflight["captured"] is None
    assert conn.update_args is None


async def test_file_outside_upload_root_rejected(fake_conn, fake_preflight, monkeypatch, tmp_path):
    conn = fake_conn(FakeConn(_task()))
    monkeypatch.setattr(publish_tools, "_upload_root", lambda: tmp_path)
    outside = tmp_path.parent / "secret.pdf"
    outside.write_text("x", encoding="utf-8")
    res = await update_publish_draft(
        {"__user_id": "user-1", "task_id": "pub-1", "format": "pdf", "file_path": str(outside)}
    )
    assert res["ok"] is False
    assert res["errorCode"] == "INVALID_FILE_PATH"
    assert conn.update_args is None


async def test_targets_without_account_id_rejected(fake_conn, fake_preflight):
    conn = fake_conn(FakeConn(_task()))
    res = await update_publish_draft(
        {"__user_id": "user-1", "task_id": "pub-1", "targets": [{"platform": "douyin"}]}
    )
    assert res["ok"] is False
    assert res["errorCode"] == "ACCOUNT_REQUIRED"
    assert conn.update_args is None


async def test_missing_user_and_invalid_task_id():
    res = await update_publish_draft({"task_id": "pub-1"})
    assert res["ok"] is False
    assert res["errorCode"] == "MISSING_USER"
    res = await update_publish_draft({"__user_id": "user-1", "task_id": " "})
    assert res["ok"] is False
    assert res["errorCode"] == "INVALID_TASK_ID"


def test_registered_in_mcp_registry():
    from app.services.mcp_server import _TOOL_HANDLERS, _TOOLS, mcp_server

    names = {tool.name for tool in _TOOLS}
    assert "update_publish_draft" in names
    assert "update_publish_draft" in _TOOL_HANDLERS
    assert "update_publish_draft" in {tool.name for tool in mcp_server.list_tools()}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

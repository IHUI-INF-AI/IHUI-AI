# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Qoder 能力对齐 · 会话待办板(todo_write / todo_read)。

钉住的判据:

1. ``todo_write`` 是**整表替换**,不是追加;``[]`` 表示清空;
2. 校验失败(非数组、空正文、非法状态、多条 in_progress、超长、超条数)时
   任务板**保持原样**,模型不会误以为写成功了;
3. 任务板按 (user_id, session_id) 隔离,2 小时过期;
4. 缺 session 的调用 fail-closed,不能把计划写成全进程共享;
5. ``todo_read`` 读回的结构与 ``todo_write`` 提交的一致。
"""

from __future__ import annotations

import pytest

import app.services.mcp_server as mcp_mod
from app.services.session_todo import (
    MAX_TODO_CONTENT_LEN,
    MAX_TODOS,
    SessionTodoBoard,
    format_todos,
    normalize_todos,
    todo_board,
)


@pytest.fixture(autouse=True)
def _clean_board():
    todo_board.reset()
    yield
    todo_board.reset()


def test_normalize_accepts_minimal_list():
    items, error = normalize_todos(
        [
            {"content": "读代码", "status": "completed"},
            {"content": "写测试", "status": "in_progress", "activeForm": "正在写测试"},
        ]
    )
    assert error is None
    assert items is not None
    assert [i.status for i in items] == ["completed", "in_progress"]
    assert items[1].active_form == "正在写测试"


def test_normalize_accepts_qoder_five_statuses():
    """Qoder 的 TodoWrite 认五档;只认三档会让模型表达"放弃/受阻"时被拒。"""
    items, error = normalize_todos(
        [
            {"content": "已放弃", "status": "cancelled"},
            {"content": "被阻塞", "status": "blocked"},
        ]
    )
    assert error is None and items is not None
    text = format_todos(items)
    assert "[-] 已放弃" in text
    assert "[!] 被阻塞" in text


def test_normalize_rejects_bad_shapes():
    assert normalize_todos(None)[1] is not None
    assert normalize_todos("not-a-list")[1] is not None
    assert normalize_todos([{"status": "pending"}])[1] is not None
    assert normalize_todos([{"content": "   ", "status": "pending"}])[1] is not None
    assert normalize_todos([{"content": "x", "status": "done"}])[1] is not None


def test_normalize_rejects_two_in_progress():
    items, error = normalize_todos(
        [
            {"content": "a", "status": "in_progress"},
            {"content": "b", "status": "in_progress"},
        ]
    )
    assert items is None
    assert error is not None and "in_progress" in error


def test_normalize_rejects_overflow_and_long_content():
    too_many = [
        {"content": f"item-{i}", "status": "pending"} for i in range(MAX_TODOS + 1)
    ]
    assert normalize_todos(too_many)[1] is not None

    long_text = "x" * (MAX_TODO_CONTENT_LEN + 1)
    assert normalize_todos([{"content": long_text, "status": "pending"}])[1] is not None


def test_format_todos_marks_each_status():
    items, error = normalize_todos(
        [
            {"content": "done", "status": "completed"},
            {"content": "active", "status": "in_progress"},
            {"content": "todo", "status": "pending"},
        ]
    )
    assert error is None and items is not None
    text = format_todos(items)
    assert "1/3 已完成" in text
    assert "[x] done" in text
    assert "[→] active" in text
    assert "[ ] todo" in text


def test_board_isolation_and_expiry():
    board = SessionTodoBoard(ttl_seconds=100, max_boards=4)
    items, _ = normalize_todos([{"content": "a", "status": "pending"}])
    assert items is not None
    board.set(user_id="u1", session_id="s1", items=items, now=10.0)
    board.set(user_id="u2", session_id="s1", items=items, now=10.0)
    assert len(board.get(user_id="u1", session_id="s1", now=20.0)) == 1
    assert board.get(user_id="u3", session_id="s1", now=20.0) == []
    # 过期即空(不是"读到旧计划");u2 未到期,仍能读回自己的板。
    assert board.get(user_id="u1", session_id="s1", now=111.0) == []
    assert len(board.get(user_id="u2", session_id="s1", now=20.0)) == 1
    assert board.get(user_id="u2", session_id="s1", now=111.0) == []


@pytest.mark.asyncio
async def test_todo_write_replace_then_read():
    first = await mcp_mod.mcp_server.call_tool(
        "todo_write",
        {
            "todos": [
                {"content": "定位问题", "status": "completed"},
                {"content": "修复并验证", "status": "in_progress"},
            ]
        },
        user_id="u1",
        session_id="s1",
    )
    assert first["ok"] is True, first
    assert first["data"]["counts"] == {
        "total": 2,
        "pending": 0,
        "inProgress": 1,
        "completed": 1,
        "cancelled": 0,
        "blocked": 0,
    }

    # 整表替换:第二次提交只有一条,板上就只剩一条(不是 3 条)。
    second = await mcp_mod.mcp_server.call_tool(
        "todo_write",
        {"todos": [{"content": "写回归测试", "status": "pending"}]},
        user_id="u1",
        session_id="s1",
    )
    assert second["ok"] is True, second
    assert second["data"]["counts"]["total"] == 1

    read = await mcp_mod.mcp_server.call_tool(
        "todo_read", {}, user_id="u1", session_id="s1"
    )
    assert read["ok"] is True
    assert [t["content"] for t in read["data"]["todos"]] == ["写回归测试"]
    assert read["data"]["todos"][0]["status"] == "pending"


@pytest.mark.asyncio
async def test_invalid_write_keeps_previous_board():
    await mcp_mod.mcp_server.call_tool(
        "todo_write",
        {"todos": [{"content": "原有计划", "status": "pending"}]},
        user_id="u1",
        session_id="s1",
    )
    bad = await mcp_mod.mcp_server.call_tool(
        "todo_write",
        {"todos": [{"content": "", "status": "pending"}]},
        user_id="u1",
        session_id="s1",
    )
    assert bad["ok"] is False
    assert bad["errorCode"] == "INVALID_TODOS"
    assert "原有计划" in bad["board"]

    read = await mcp_mod.mcp_server.call_tool(
        "todo_read", {}, user_id="u1", session_id="s1"
    )
    assert [t["content"] for t in read["data"]["todos"]] == ["原有计划"]


@pytest.mark.asyncio
async def test_empty_list_clears_board():
    await mcp_mod.mcp_server.call_tool(
        "todo_write",
        {"todos": [{"content": "a", "status": "pending"}]},
        user_id="u1",
        session_id="s1",
    )
    cleared = await mcp_mod.mcp_server.call_tool(
        "todo_write", {"todos": []}, user_id="u1", session_id="s1"
    )
    assert cleared["ok"] is True
    assert cleared["data"]["counts"]["total"] == 0

    read = await mcp_mod.mcp_server.call_tool(
        "todo_read", {}, user_id="u1", session_id="s1"
    )
    assert read["data"]["todos"] == []
    assert read["data"]["board"] == "任务板为空。"


@pytest.mark.asyncio
async def test_todo_requires_session():
    out = await mcp_mod.mcp_server.call_tool(
        "todo_write", {"todos": [{"content": "a", "status": "pending"}]}, user_id="u1"
    )
    assert out["ok"] is False
    assert out["errorCode"] == "SESSION_REQUIRED"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

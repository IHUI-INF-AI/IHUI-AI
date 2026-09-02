# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""后台任务服务测试(Phase 1 第 6 项 · 2026-09-02 立)。

覆盖:成功 / 不存在 / 异常 / 超时 / 并发超限拒绝 / MCP 工具注册与调用。
测试内真实 sleep 尽量短(≤0.1s),不依赖 redis / 外部 IM webhook(通知失败降级 log)。
"""

from __future__ import annotations

import asyncio

from app.services.background_tasks import (
    MAX_CONCURRENT,
    TaskState,
    background_task_manager,
)


async def _wait_terminal(task_id: str, timeout: float = 2.0) -> dict:
    """轮询任务直到进入终态(成功/失败/超时),返回最终状态字典。"""
    deadline = asyncio.get_event_loop().time() + timeout
    terminal = (TaskState.SUCCEEDED.value, TaskState.FAILED.value, TaskState.TIMEOUT.value)
    while asyncio.get_event_loop().time() < deadline:
        status = await background_task_manager.get_status(task_id)
        assert status is not None, f"任务丢失: {task_id}"
        if status["state"] in terminal:
            return status
        await asyncio.sleep(0.01)
    raise AssertionError(f"任务未在 {timeout}s 内进入终态: {task_id}")


async def test_submit_sleep_succeeds() -> None:
    """提交 sleep(0.01),最终状态应为 succeeded。"""
    task_id = await background_task_manager.submit(
        lambda: asyncio.sleep(0.01),
        name="test-sleep",
        user_id="u-test",
        notify_on_done=False,
        timeout_s=5,
    )
    assert isinstance(task_id, str) and len(task_id) == 32
    status = await _wait_terminal(task_id)
    assert status["state"] == TaskState.SUCCEEDED.value
    assert status["duration_ms"] is not None
    assert status["finished_at"] is not None


async def test_get_status_unknown_returns_none() -> None:
    """不存在的 task_id 应返回 None。"""
    assert await background_task_manager.get_status("deadbeef" * 4) is None


async def test_failed_task_records_error() -> None:
    """抛出异常的任务 → failed + error 摘要。"""

    async def boom() -> None:
        raise ValueError("boom-on-purpose")

    task_id = await background_task_manager.submit(
        lambda: boom(),
        name="test-boom",
        user_id="u-test",
        notify_on_done=False,
        timeout_s=5,
    )
    status = await _wait_terminal(task_id)
    assert status["state"] == TaskState.FAILED.value
    assert status["error"] is not None
    assert "boom-on-purpose" in status["error"]


async def test_timeout_task() -> None:
    """执行超过 timeout_s 的任务 → timeout。"""
    task_id = await background_task_manager.submit(
        lambda: asyncio.sleep(1.0),
        name="test-timeout",
        user_id="u-test",
        notify_on_done=False,
        timeout_s=0.05,
    )
    status = await _wait_terminal(task_id)
    assert status["state"] == TaskState.TIMEOUT.value


async def test_concurrency_limit_rejects() -> None:
    """并发超过 MAX_CONCURRENT 时,超出部分被拒绝。"""
    results = []
    for _ in range(MAX_CONCURRENT + 1):
        r = await background_task_manager.submit(
            lambda: asyncio.sleep(0.05),
            name="test-concurrency",
            user_id="u-test",
            notify_on_done=False,
            timeout_s=5,
        )
        results.append(r)
    rejected = [
        r for r in results
        if isinstance(r, dict) and r.get("error") == "too_many_background_tasks"
    ]
    assert rejected, f"期望有被拒绝的任务,实际返回: {results}"
    # 收尾:等后台任务跑完,避免遗留挂起任务
    await asyncio.sleep(0.1)


async def test_list_tasks_filters_by_user() -> None:
    """list_tasks 能按 user_id 过滤。"""
    tid = await background_task_manager.submit(
        lambda: asyncio.sleep(0.01),
        name="test-list",
        user_id="u-list",
        notify_on_done=False,
        timeout_s=5,
    )
    await _wait_terminal(tid)
    all_tasks = await background_task_manager.list_tasks(limit=50)
    assert any(t["task_id"] == tid for t in all_tasks)
    scoped = await background_task_manager.list_tasks(user_id="u-list", limit=50)
    assert all(t["user_id"] == "u-list" for t in scoped)
    assert any(t["task_id"] == tid for t in scoped)


async def test_mcp_tool_registration() -> None:
    """mcp_server._TOOLS 应含 run_in_background 与 bg_task_status。"""
    from app.services import mcp_server

    names = {t.name for t in mcp_server._TOOLS}
    assert "run_in_background" in names
    assert "bg_task_status" in names
    # handler 也已注册
    assert mcp_server._TOOL_HANDLERS.get("run_in_background") is not None
    assert mcp_server._TOOL_HANDLERS.get("bg_task_status") is not None


async def test_run_in_background_via_call_tool() -> None:
    """经 MCPServer.call_tool 调用 run_in_background → 返回 task_id;bg_task_status 可查。"""
    from app.services import mcp_server

    server = mcp_server.MCPServer()
    submit_res = await server.call_tool(
        "run_in_background",
        {"task": "sleep", "arguments": {"seconds": 0.01}, "notify_on_done": False},
        user_role=0,
        user_id="u-calltool",
    )
    assert submit_res.get("ok") is True, submit_res
    task_id = submit_res["task_id"]
    # 等后台完成后查询
    await asyncio.sleep(0.05)
    status_res = await server.call_tool(
        "bg_task_status", {"task_id": task_id}, user_role=0, user_id="u-calltool"
    )
    assert status_res.get("ok") is True, status_res
    assert status_res["task"]["state"] == TaskState.SUCCEEDED.value


async def test_run_in_background_unknown_task_rejected() -> None:
    """未知 task 类型 → ok=False 且给出可用列表。"""
    from app.services import mcp_server

    server = mcp_server.MCPServer()
    res = await server.call_tool(
        "run_in_background", {"task": "not_a_real_task"}, user_role=0, user_id="u-x"
    )
    assert res.get("ok") is False
    assert "available" in res

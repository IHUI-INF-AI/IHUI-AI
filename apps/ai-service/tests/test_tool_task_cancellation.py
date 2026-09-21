# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 工具调用取消闭环单测(2026-09-19 立)。

覆盖 app/routers/llm.py::_InflightToolTasks(gen 流内工具任务生命周期追踪器):
- 工具任务完成时自动从追踪集合移除(done_callback discard,不泄漏)
- 请求取消/断开时 in-flight 工具任务被统一 cancel(孤儿任务切断)
- 无 in-flight 任务时 cancel_all 幂等不报错
"""

from __future__ import annotations

import asyncio

from app.routers.llm import _InflightToolTasks


async def test_completed_task_auto_removed_from_set() -> None:
    """任务完成 → done_callback 自动 discard,追踪集合回空。"""
    tracker = _InflightToolTasks()

    async def _tool() -> str:
        return "done"

    task = tracker.track(asyncio.create_task(_tool()))
    assert len(tracker._tasks) == 1

    await task
    # done_callback 经 call_soon 调度,让出一拍确保回调已执行
    await asyncio.sleep(0)
    assert len(tracker._tasks) == 0


async def test_cancel_all_cancels_inflight_tool_tasks() -> None:
    """取消时:仍 in-flight 的工具任务收到 cancel;已完成的不再计数、不重复取消。"""
    tracker = _InflightToolTasks()

    async def _long_tool() -> str:
        # 模拟长工具执行(浏览器操作/子进程),不主动结束,只能被外部 cancel
        await asyncio.sleep(30)
        return "should_not_reach"

    async def _quick_tool() -> str:
        return "ok"

    long_task = tracker.track(asyncio.create_task(_long_tool()))
    quick_task = tracker.track(asyncio.create_task(_quick_tool()))
    assert len(tracker._tasks) == 2

    # quick_task 正常完成并自动移出集合(长任务仍在跑)
    await quick_task
    await asyncio.sleep(0)
    assert quick_task not in tracker._tasks
    assert long_task in tracker._tasks

    # 客户端断开/请求取消 → finally 统一 cancel:仅剩的 in-flight long_task 被取消
    cancelled = tracker.cancel_all()
    assert cancelled == 1
    assert len(tracker._tasks) == 0

    # 被取消任务的 CancelledError 被妥善吞掉(不逃逸为未回收异常)
    try:
        await long_task
    except asyncio.CancelledError:
        pass
    assert long_task.cancelled()


async def test_cancel_all_with_empty_set_is_noop() -> None:
    """无 in-flight 任务时 cancel_all 不抛异常,重复调用幂等,返回 0。"""
    tracker = _InflightToolTasks()
    assert tracker.cancel_all() == 0
    assert tracker.cancel_all() == 0
    assert len(tracker._tasks) == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

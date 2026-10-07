# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815973:后台任务终态写入 first-writer-wins 闩锁(`TaskRecord.claim_terminal`)。

正反成对(台账验收):
① 通知 await 期间 `cancel()` ⇒ 终态只有一个、通知恰好一条(防"成功通知寄出后
   又补一条已取消"或通知被掐断双向吞没);
② 正常完成无取消 ⇒ 行为逐字不变(防把 claim 写成"只有取消能落终态"吞掉成功);
③ `cancel()` 打在已 SUCCEEDED 且通知寄完的任务上 ⇒ 回"不再变更"而非二次通知。

测试用独立 manager 实例 + `_notify` 替身,不触碰模块级单例与 message_bus。
"""

from __future__ import annotations

import asyncio

from app.services.background_tasks import (
    BackgroundTaskManager,
    TaskRecord,
    TaskState,
)


class _RecordingManager(BackgroundTaskManager):
    """把 `_notify` 换成可观测替身:到达即记 arrival,过栅栏后记 completed。"""

    def __init__(self) -> None:
        super().__init__()
        self.notify_arrivals: list[TaskRecord] = []
        self.notify_completed: list[TaskRecord] = []
        self._notify_gate: asyncio.Event | None = None

    async def _notify(self, record: TaskRecord) -> None:
        self.notify_arrivals.append(record)
        if self._notify_gate is not None:
            await self._notify_gate.wait()
        self.notify_completed.append(record)


async def _wait_for(condition, timeout: float = 2.0) -> None:
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        if condition():
            return
        await asyncio.sleep(0.005)
    raise AssertionError("等待条件超时")


async def test_cancel_during_notification_keeps_single_terminal_and_single_notification():
    """① 通知 await 期间 cancel() ⇒ 终态唯一(succeeded)、通知恰好一条、cancel 回不再变更。"""
    mgr = _RecordingManager()
    gate = asyncio.Event()
    mgr._notify_gate = gate
    task_id = await mgr.submit(
        lambda: asyncio.sleep(0), name="latch-1", user_id="u", notify_on_done=True
    )
    await _wait_for(lambda: bool(mgr.notify_arrivals))

    result = await mgr.cancel(task_id)
    assert result["ok"] is False
    assert result["state"] == TaskState.SUCCEEDED.value
    assert "不再变更" in result["message"]

    gate.set()
    await _wait_for(lambda: bool(mgr.notify_completed))
    status = await mgr.get_status(task_id)
    assert status is not None
    assert status["state"] == TaskState.SUCCEEDED.value
    assert len(mgr.notify_arrivals) == 1
    assert len(mgr.notify_completed) == 1


async def _ok_coro() -> str:
    return "ok"


async def test_normal_completion_behavior_unchanged():
    """② 正常完成无取消 ⇒ 行为逐字不变:state=succeeded、恰好一条通知、字段齐全。"""
    mgr = _RecordingManager()
    task_id = await mgr.submit(
        _ok_coro, name="latch-2", user_id="u", notify_on_done=True
    )
    await _wait_for(lambda: bool(mgr.notify_completed))
    status = await mgr.get_status(task_id)
    assert status is not None
    assert status["state"] == TaskState.SUCCEEDED.value
    assert status["result"] is not None
    assert status["finished_at"] is not None
    assert status["duration_ms"] is not None
    assert len(mgr.notify_arrivals) == 1
    assert len(mgr.notify_completed) == 1


async def test_cancel_after_succeeded_is_noop():
    """③ cancel() 打在已 SUCCEEDED 且通知寄完的任务上 ⇒ 回"不再变更",无二次通知。"""
    mgr = _RecordingManager()
    task_id = await mgr.submit(
        lambda: asyncio.sleep(0), name="latch-3", user_id="u", notify_on_done=True
    )
    await _wait_for(lambda: bool(mgr.notify_completed))
    notifications_before = len(mgr.notify_completed)

    result = await mgr.cancel(task_id)
    assert result["ok"] is False
    assert result["state"] == TaskState.SUCCEEDED.value
    status = await mgr.get_status(task_id)
    assert status is not None
    assert status["state"] == TaskState.SUCCEEDED.value
    assert len(mgr.notify_completed) == notifications_before


async def test_claim_terminal_is_one_shot():
    """终态名额本体:第一次 True 并落状态,此后一律 False 且状态不再变更。"""
    record = TaskRecord(task_id="t", name="n", user_id=None)
    assert record.claim_terminal(TaskState.FAILED) is True
    assert record.state is TaskState.FAILED
    assert record.claim_terminal(TaskState.SUCCEEDED) is False
    assert record.claim_terminal(TaskState.CANCELLED) is False
    assert record.state is TaskState.FAILED


async def test_resume_resets_terminal_claim():
    """续跑复用同一记录 ⇒ 终态名额复位后可再落新终态(防续跑永远落不了终态)。"""
    mgr = BackgroundTaskManager()
    task_id = await mgr.submit(
        lambda: asyncio.sleep(0), name="latch-4", user_id=None, notify_on_done=False
    )
    record = mgr._tasks[task_id]
    await _wait_for(lambda: record.state in (TaskState.SUCCEEDED,))
    assert record.claim_terminal(TaskState.CANCELLED) is False  # 名额已被成功出口取走
    # resume 路径的复位与 submit_typed 续跑分支同律
    record._terminal_claimed = False
    assert record.claim_terminal(TaskState.SUCCEEDED) is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

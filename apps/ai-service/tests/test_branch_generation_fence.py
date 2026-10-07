# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815974:branch_generation 分支栅栏测试(提交 → rewind/fork → 完成 的竞态闩)。

判据(台账原文):
① 提交后台任务后 rewind ⇒ 旧任务完成时既不寄通知也不写历史,且留一条可诊断日志;
② 未 rewind 的常规完成必须照常通知;
③ 同一 session 内 fork 出的**新**分支自己的任务不得被父分支 generation 误杀。

栅栏语义:bump(checkpoint 恢复 / fork 各提升一次,盖**来源**线程)/
capture(任务入队盖章,resume 重盖即取当前代)/ isCurrent(落地前复校 ——
查注册表**当前值**,不信任务自带的那份)/ superseded(作废留痕,不许静默丢)。
"""

from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace

import pytest

from app.services import background_tasks as bg_mod
from app.services import branch_generation as fence_mod
from app.services.background_tasks import BackgroundTaskManager, TaskState


@pytest.fixture(autouse=True)
def _reset_fence() -> None:
    """每测归零栅栏注册表(进程级内存态,不隔离会串)。"""
    fence_mod.__reset_branch_generation_for_test()  # noqa: SLF001 - 测试专用出口


class _PublishRecorder:
    """替换 message_bus.publish:记录寄出的通知,恒报成功投递。"""

    def __init__(self) -> None:
        self.calls: list[object] = []

    async def __call__(
        self, msg: object, *, channels: object = None, priority: str = "normal"
    ) -> object:
        self.calls.append(msg)
        return SimpleNamespace(delivered_channels=["im"], error=None)


@pytest.fixture()
def recorder(monkeypatch: pytest.MonkeyPatch) -> _PublishRecorder:
    rec = _PublishRecorder()
    monkeypatch.setattr(bg_mod.message_bus, "publish", rec)
    return rec


async def _wait_terminal(
    mgr: BackgroundTaskManager, task_id: str, timeout: float = 3.0
) -> dict:
    """轮询任务直到进入终态,返回最终状态字典。"""
    deadline = asyncio.get_running_loop().time() + timeout
    terminal = (
        TaskState.SUCCEEDED.value,
        TaskState.FAILED.value,
        TaskState.TIMEOUT.value,
    )
    while asyncio.get_running_loop().time() < deadline:
        status = await mgr.get_status(task_id)
        assert status is not None, f"任务丢失: {task_id}"
        if status["state"] in terminal:
            return status
        await asyncio.sleep(0.01)
    raise AssertionError(f"任务未在 {timeout}s 内进入终态: {task_id}")


async def test_rewind_after_submit_suppresses_notification_and_logs(
    recorder: _PublishRecorder, caplog: pytest.LogCaptureFixture
) -> None:
    """①提交后 checkpoint 恢复(bump)⇒ 任务照常落终态,但通知被栅栏拦下且留可诊断日志。"""
    mgr = BackgroundTaskManager()

    async def _stale_work() -> str:
        await asyncio.sleep(0.02)
        return "stale-result"

    task_id = await mgr.submit(
        lambda: _stale_work(),
        name="fence-stale",
        user_id="u-fence",
        session_id="sess-fence-a",
        notify_on_done=True,
        timeout_s=5,
    )
    # 任务在飞期间,该会话发生 checkpoint 恢复(装配出口 bump 一次:0 → 1)
    assert fence_mod.bump_branch_generation("sess-fence-a", "checkpoint-restore") == 1

    with caplog.at_level(logging.WARNING):
        status = await _wait_terminal(mgr, task_id)

    # 任务本身照常跑完(栅栏不改任务生命周期,只拦结果落地)
    assert status["state"] == TaskState.SUCCEEDED.value
    assert status["result"] == "stale-result"
    # ①不寄通知
    assert recorder.calls == []
    # ①可诊断日志(不许静默丢)
    assert "[branch-generation]" in caplog.text
    assert "不寄通知" in caplog.text
    # ①作废留痕:superseded 计数 +1,事件流水含该会话的作废记录
    assert fence_mod.branch_generation_stats().superseded == 1
    superseded = [
        e for e in fence_mod.recent_branch_generation_events() if e.kind == "superseded"
    ]
    assert len(superseded) == 1
    assert superseded[0].thread_id == "sess-fence-a"
    assert superseded[0].stale_generation == 0  # 入队时 capture 到的旧代
    assert superseded[0].generation == 1  # 作废判定时的当前代
    assert superseded[0].detail is not None
    assert superseded[0].detail.get("taskId") == task_id


async def test_no_rewind_notification_still_sent(recorder: _PublishRecorder) -> None:
    """②未 rewind 的常规完成必须照常通知(恰好一条,零作废留痕)。"""
    mgr = BackgroundTaskManager()

    async def _fresh_work() -> str:
        await asyncio.sleep(0.01)
        return "fresh-result"

    task_id = await mgr.submit(
        lambda: _fresh_work(),
        name="fence-fresh",
        user_id="u-fence",
        session_id="sess-fresh",
        notify_on_done=True,
        timeout_s=5,
    )
    status = await _wait_terminal(mgr, task_id)
    assert status["state"] == TaskState.SUCCEEDED.value
    assert len(recorder.calls) == 1
    assert fence_mod.branch_generation_stats().superseded == 0


async def test_fork_new_branch_not_killed_by_parent_generation(
    recorder: _PublishRecorder,
) -> None:
    """③fork 盖**来源**线程;新分支 session 的任务照常通知(代数按 key 隔离)。"""
    mgr = BackgroundTaskManager()

    async def _child_work() -> str:
        await asyncio.sleep(0.01)
        return "child-result"

    # fork 装配出口:来源线程代数 +1(session_store.fork 同款调用)
    assert fence_mod.bump_branch_generation("thread-parent", "fork") == 1

    task_id = await mgr.submit(
        lambda: _child_work(),
        name="fence-child",
        user_id="u-fence",
        session_id="thread-child",
        notify_on_done=True,
        timeout_s=5,
    )
    status = await _wait_terminal(mgr, task_id)
    assert status["state"] == TaskState.SUCCEEDED.value
    # 新分支自己的任务不被父代数误杀:照常寄通知、零作废
    assert len(recorder.calls) == 1
    assert fence_mod.branch_generation_stats().superseded == 0


def test_capture_and_is_current_unit_semantics() -> None:
    """单元(成对正反):缺 key 视为代数 0;bump 后旧令牌不再 current、新令牌 current。"""
    assert fence_mod.current_branch_generation("unit-key") == 0  # 反向:未登记 = 0
    assert fence_mod.is_branch_generation_current("unit-key", 0)

    token = fence_mod.capture_branch_generation("unit-key")
    assert token == 0
    assert fence_mod.is_branch_generation_current("unit-key", token)  # 正向:盖章后仍 current

    assert fence_mod.bump_branch_generation("unit-key", "checkpoint-restore") == 1
    assert not fence_mod.is_branch_generation_current("unit-key", token)  # 反向:旧令牌作废
    new_token = fence_mod.capture_branch_generation("unit-key")
    assert new_token == 1
    assert fence_mod.is_branch_generation_current("unit-key", new_token)  # 正向:新令牌有效

    kinds = [e.kind for e in fence_mod.recent_branch_generation_events()]
    assert "capture" in kinds and "bump" in kinds


async def test_resume_recaptures_current_generation(
    recorder: _PublishRecorder,
) -> None:
    """续跑重盖:首跑 TIMEOUT → bump → resume ⇒ 令牌重盖为当前代,重跑结果照常通知。"""
    mgr = BackgroundTaskManager()

    ack = await mgr.submit_typed(
        "sleep",
        {"seconds": 2.0},
        name="fence-resume",
        user_id="u-fence",
        session_id="sess-resume",
        notify_on_done=True,
        timeout_s=1,
    )
    assert isinstance(ack, dict) and ack.get("ok") is True
    task_id = str(ack["task_id"])
    status = await _wait_terminal(mgr, task_id)
    assert status["state"] == TaskState.TIMEOUT.value
    # 首轮的通知(bump 尚未发生)已照常寄出
    assert len(recorder.calls) == 1
    record = mgr._tasks[task_id]  # noqa: SLF001 - 断言旧令牌
    assert record.branch_generation_token == 0

    # 首轮结束后、续跑前,该会话发生 checkpoint 恢复(0 → 1)
    assert fence_mod.bump_branch_generation("sess-resume", "checkpoint-restore") == 1

    resume_ack = await mgr.resume(task_id)
    assert isinstance(resume_ack, dict) and resume_ack.get("resumed") is True
    # G-815974:_launch 重盖 —— 令牌从旧代 0 翻成当前代 1
    assert record.branch_generation_token == 1

    status = await _wait_terminal(mgr, task_id)
    assert status["state"] == TaskState.TIMEOUT.value
    # 重跑结果未被栅栏作废:零 superseded,第二轮通知照常寄出
    assert fence_mod.branch_generation_stats().superseded == 0
    assert len(recorder.calls) == 2


async def test_unstamped_task_unaffected_by_fence(recorder: _PublishRecorder) -> None:
    """无 session 的任务不盖章 ⇒ 栅栏恒放行(bump 谁都影响不到它)。"""
    mgr = BackgroundTaskManager()

    async def _anon_work() -> str:
        await asyncio.sleep(0.01)
        return "anon-result"

    task_id = await mgr.submit(
        lambda: _anon_work(),
        name="fence-anon",
        user_id="u-fence",
        session_id=None,
        notify_on_done=True,
        timeout_s=5,
    )
    assert fence_mod.bump_branch_generation("some-other-session", "fork") == 1
    status = await _wait_terminal(mgr, task_id)
    assert status["state"] == TaskState.SUCCEEDED.value
    assert len(recorder.calls) == 1
    assert fence_mod.branch_generation_stats().superseded == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

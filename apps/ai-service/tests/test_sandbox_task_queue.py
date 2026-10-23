# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D14② 沙箱任务队列单元测试(G-17 拆票,票面三条硬判据逐条验证)。

设计原则:队列语义不依赖 docker —— 前三组用注入执行器(stub)验证
串行度可配 / 失败可重放一次 / 队列满明确拒绝;第四组用默认执行器走
container_runtime 真链路(本机 local-fallback 真实子进程,与
test_container_runtime.py 同套路),验证队列→运行时派发接线确实装车。
"""

import asyncio
import sys

import pytest

from app.services import container_runtime as cr_mod
from app.services.cloud_run_store import CloudRunStore
from app.services.sandbox_task_queue import (
    SandboxQueueFullError,
    SandboxTaskQueue,
)

PY = sys.executable or "python"


def _counting_executor(state: dict, fail_first: bool = False):
    """stub 执行器:记录并发峰值;可选"首次必失败、重放即成功"。"""

    async def executor(record):
        state["active"] += 1
        state["max_active"] = max(state["active"], state.get("max_active", 0))
        state["calls"].append(record.task_id)
        try:
            await asyncio.sleep(0.05)
        finally:
            state["active"] -= 1
        if fail_first and record.attempts == 1:
            raise RuntimeError("boom(首次失败)")
        return {"ok": True, "task_id": record.task_id}

    return executor


# =============================================================================
# 判据① 同一镜像 N 个任务串行度可配
# =============================================================================


async def test_concurrency_one_is_fully_serial():
    """concurrency=1:同镜像 3 个任务全串行,并发峰值恒为 1。"""
    state = {"active": 0, "max_active": 0, "calls": []}
    q = SandboxTaskQueue(executor=_counting_executor(state), concurrency=1)
    ids = [(await q.enqueue({"task": f"t{i}"}, image="img-a"))["task_id"] for i in range(3)]
    await q.drain(timeout=15)
    assert state["max_active"] == 1
    assert len(state["calls"]) == 3
    for tid in ids:
        snap = q.snapshot(tid)
        assert snap["status"] == "succeeded"
        assert snap["attempts"] == 1
    await q.shutdown()


async def test_concurrency_two_bounds_overlap():
    """concurrency=2:同镜像任务并发峰值受控于 2(可配,非固定串行)。"""
    state = {"active": 0, "max_active": 0, "calls": []}
    q = SandboxTaskQueue(executor=_counting_executor(state), concurrency=2)
    for i in range(4):
        await q.enqueue({"task": f"t{i}"}, image="img-a")
    await q.drain(timeout=15)
    assert state["max_active"] == 2
    await q.shutdown()


async def test_different_images_use_independent_lanes():
    """不同镜像各自成道互不阻塞:两道 concurrency=1 合计峰值 2。"""
    state = {"active": 0, "max_active": 0, "calls": []}
    q = SandboxTaskQueue(executor=_counting_executor(state), concurrency=1)
    await q.enqueue({"task": "a"}, image="img-a")
    await q.enqueue({"task": "b"}, image="img-b")
    await q.drain(timeout=15)
    assert state["max_active"] == 2
    await q.shutdown()


# =============================================================================
# 判据② 失败可重放一次
# =============================================================================


async def test_failure_replay_once_succeeds_then_locked():
    """failed 任务 replay 一次即成功;成功后再 replay 明确拒绝。"""
    state = {"active": 0, "max_active": 0, "calls": []}
    q = SandboxTaskQueue(
        executor=_counting_executor(state, fail_first=True), concurrency=1
    )
    snap = await q.enqueue({"task": "t"}, image="img-a")
    tid = snap["task_id"]
    await q.drain(timeout=15)
    assert q.snapshot(tid)["status"] == "failed"
    assert "boom" in q.snapshot(tid)["error"]

    await q.replay(tid)
    await q.drain(timeout=15)
    after = q.snapshot(tid)
    assert after["status"] == "succeeded"
    assert after["attempts"] == 2
    assert after["replayed"] is True

    # 名额语义:非 failed 不可重放
    with pytest.raises(ValueError, match="仅 failed"):
        await q.replay(tid)
    await q.shutdown()


async def test_second_replay_of_still_failing_task_is_refused():
    """重放后仍失败:第二次重放被拒(仅允许一次)。"""
    async def always_fail(record):
        raise RuntimeError("nope")

    q = SandboxTaskQueue(executor=always_fail, concurrency=1)
    tid = (await q.enqueue({"task": "t"}, image="img-a"))["task_id"]
    await q.drain(timeout=15)
    assert q.snapshot(tid)["status"] == "failed"
    await q.replay(tid)
    await q.drain(timeout=15)
    assert q.snapshot(tid)["status"] == "failed"
    with pytest.raises(ValueError, match="重放名额已用尽"):
        await q.replay(tid)
    await q.shutdown()


async def test_replay_unknown_task_raises():
    q = SandboxTaskQueue(executor=_counting_executor({"active": 0, "calls": []}))
    with pytest.raises(ValueError, match="任务不存在"):
        await q.replay("no-such-task")
    await q.shutdown()


# =============================================================================
# 判据③ 队列满时明确拒绝而不是静默排队
# =============================================================================


async def test_queue_full_explicit_reject_not_silent():
    """等待队列达上限:enqueue 抛 SandboxQueueFullError,任务不落库。"""
    gate = asyncio.Event()

    async def blocking_executor(record):
        await gate.wait()
        return {"ok": True}

    q = SandboxTaskQueue(executor=blocking_executor, concurrency=1, max_pending=2)
    t1 = (await q.enqueue({"task": "run"}, image="img-a"))["task_id"]
    # 让 t1 真正占用执行槽(等待计数随之减一),此后满判定确定化
    for _ in range(5):
        await asyncio.sleep(0)
    assert q.stats()["lanes"]["img-a"]["waiting"] == 0

    await q.enqueue({"task": "w1"}, image="img-a")
    await q.enqueue({"task": "w2"}, image="img-a")
    with pytest.raises(SandboxQueueFullError, match="已满"):
        await q.enqueue({"task": "overflow"}, image="img-a")

    # 明确拒绝 = 被拒任务根本没落库(不是静默排队,也不是排队后再丢)
    assert q.stats()["total_tasks"] == 3
    assert all(
        r["payload"]["task"] != "overflow"
        for r in q.list_tasks(limit=50)
    )
    assert q.snapshot(t1)["status"] == "running"

    # 另一镜像道不受影响(分道独立)
    await q.enqueue({"task": "other"}, image="img-b")

    gate.set()
    await q.drain(timeout=15)
    await q.shutdown()


async def test_replay_also_subject_to_full_reject():
    """重放同样走容量判据:满则 429 语义异常,不静默入队。"""
    gate = asyncio.Event()

    async def blocking(record):
        await gate.wait()
        return {"ok": True}

    async def fail_once_then_block(record):
        if record.attempts == 1:
            raise RuntimeError("boom")
        await gate.wait()
        return {"ok": True}

    q = SandboxTaskQueue(executor=fail_once_then_block, concurrency=1, max_pending=1)
    tid = (await q.enqueue({"task": "t"}, image="img-a"))["task_id"]
    await q.drain(timeout=15)
    assert q.snapshot(tid)["status"] == "failed"

    # 占满唯一等待位
    await q.enqueue({"task": "blocker"}, image="img-a")
    for _ in range(5):
        await asyncio.sleep(0)
    # blocker 拿到执行槽后等待位为 0?不会 —— 它阻塞在 gate,但 waiting 已减一。
    # 再造一个纯排队任务把等待位打满:
    await q.enqueue({"task": "waiter"}, image="img-a")
    with pytest.raises(SandboxQueueFullError):
        await q.replay(tid)
    assert q.snapshot(tid)["replayed"] is False  # 拒绝时不得消耗重放名额

    gate.set()
    await q.drain(timeout=15)
    await q.shutdown()


# =============================================================================
# 默认执行器真链路:队列 → container_runtime(本机无 docker,同 test_container_runtime 套路)
# =============================================================================


def _make_runtime(tmp_path, monkeypatch, allow_fallback: bool):
    rt = cr_mod.ContainerRuntime(
        store=CloudRunStore(file_path=tmp_path / "cloud_runs.json"),
        persist_path=tmp_path / "container_runs.json",
    )
    rt._docker_available = False
    monkeypatch.setattr(cr_mod, "container_runtime", rt)
    if allow_fallback:
        monkeypatch.setenv("CONTAINER_RUNTIME_ALLOW_LOCAL_FALLBACK", "1")
    else:
        monkeypatch.delenv("CONTAINER_RUNTIME_ALLOW_LOCAL_FALLBACK", raising=False)
    return rt


async def test_default_executor_real_subprocess_via_queue(tmp_path, monkeypatch):
    """默认执行器真跑本地子进程:队列 succeeded 且 result 带容器侧输出。"""
    _make_runtime(tmp_path, monkeypatch, allow_fallback=True)
    q = SandboxTaskQueue(concurrency=1)
    tid = (
        await q.enqueue(
            {"task": "打印 42", "command": [PY, "-c", "print(42)"]},
            image="python:3.12-slim",
            user_id="u1",
        )
    )["task_id"]
    await q.drain(timeout=30)
    snap = q.snapshot(tid)
    assert snap["status"] == "succeeded", snap["error"]
    assert snap["result"]["execution_env"] == "local-fallback"
    assert "42" in snap["result"]["output"]
    await q.shutdown()


async def test_failclosed_docker_absent_surfaces_as_replayable_failure(
    tmp_path, monkeypatch
):
    """严档 fail-closed 如实穿透:无 docker 且未 opt-in → 任务 failed(可读原因),
    可重放一次(仍无 docker 则二次失败,名额锁死)—— 队列绝不假装成功。"""
    _make_runtime(tmp_path, monkeypatch, allow_fallback=False)
    q = SandboxTaskQueue(concurrency=1)
    tid = (
        await q.enqueue(
            {"task": "需要容器的任务", "command": [PY, "-c", "print(1)"]},
            image="python:3.12-slim",
        )
    )["task_id"]
    await q.drain(timeout=30)
    snap = q.snapshot(tid)
    assert snap["status"] == "failed"
    assert "fail-closed" in snap["error"]

    await q.replay(tid)
    await q.drain(timeout=30)
    assert q.snapshot(tid)["status"] == "failed"
    with pytest.raises(ValueError, match="重放名额已用尽"):
        await q.replay(tid)
    await q.shutdown()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

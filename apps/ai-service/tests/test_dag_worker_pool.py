"""WorkerPool 单元测试(限并发 + 优先级队列 + 依赖 + 超时 + 优雅关闭)。

对齐 packages/types/src/agent-runtime.ts L1232-1447 多 Agent 并行执行契约。

测试覆盖:
- 并发限制:N=4 worker 跑 10 任务,验证 max_active <= 4 且 >= 2(真并行)
- 优先级排序:max_workers=1,低优先进队后高优先,验证高优先先执行
- 依赖缺失 → blocked
- 依赖满足 → 等待后执行(wait 路径)
- 超时 → blocked(假 executor sleep 100s,timeout 0.5s)
- 优雅关闭:shutdown 后 submit 抛 RuntimeError
- SSE 事件回调:task_created / task_status_changed / task_completed
- KanbanTask.to_camel_dict 字段名 camelCase 对齐 TS 契约
"""

from __future__ import annotations

import asyncio

import pytest

from app.services.dag_scheduler import (
    AgentSSEEvent,
    KanbanTask,
    ParallelExecutionResult,
    WorkerPool,
    WorkerPoolConfig,
    WorkerState,
)


def _make_task(tid: str, *, priority: int = 0, dependencies=None) -> KanbanTask:
    return KanbanTask(
        id=tid,
        agent_id="test-agent",
        name=f"task-{tid}",
        priority=priority,
        dependencies=list(dependencies or []),
    )


# =============================================================================
# 并发限制
# =============================================================================


async def test_concurrency_limit():
    """N=4 worker 跑 10 任务,最大并发不超过 4 且至少 2(真并行)。"""
    state = {"active": 0, "max": 0}

    async def factory(task: KanbanTask) -> dict:
        state["active"] += 1
        state["max"] = max(state["max"], state["active"])
        await asyncio.sleep(0.05)
        state["active"] -= 1
        return {"id": task.id}

    pool = WorkerPool(
        WorkerPoolConfig(max_workers=4, task_timeout_seconds=10),
        executor_factory=factory,
    )
    for i in range(10):
        await pool.submit(_make_task(f"t{i}"))

    await pool.start()
    result = await pool.wait_all()
    await pool.shutdown()

    assert state["max"] <= 4, f"并发超过限制: max={state['max']}"
    assert state["max"] >= 2, f"未实现真并行: max={state['max']}"
    assert result.status == "success"
    assert len(result.task_results) == 10
    assert all(t.status == "done" for t in result.task_results.values())
    assert result.worker_count == 4


# =============================================================================
# 优先级排序
# =============================================================================


async def test_priority_ordering():
    """max_workers=1,低优先进队后高优先,启动后高优先先执行。"""
    order: list[str] = []

    async def factory(task: KanbanTask) -> dict:
        order.append(task.id)
        return {"id": task.id}

    pool = WorkerPool(
        WorkerPoolConfig(max_workers=1, task_timeout_seconds=10),
        executor_factory=factory,
    )
    # 先提交低优先,再提交高优先(均入队后才 start,保证优先级而非 FIFO)
    await pool.submit(_make_task("low", priority=1))
    await pool.submit(_make_task("high", priority=10))

    await pool.start()
    await pool.wait_all()
    await pool.shutdown()

    assert order == ["high", "low"], f"期望高优先级先执行,实际顺序 {order}"


# =============================================================================
# 依赖:缺失 → blocked
# =============================================================================


async def test_dependency_missing_blocked():
    """依赖不存在的任务 → blocked。"""
    events: list[str] = []
    pool = WorkerPool(
        WorkerPoolConfig(max_workers=2, task_timeout_seconds=5),
        on_event=lambda e: events.append(e.type),
    )
    await pool.start()
    await pool.submit(_make_task("t1", dependencies=["nonexistent"]))

    result = await pool.wait_all()
    await pool.shutdown()

    t = result.task_results["t1"]
    assert t.status == "blocked"
    assert "不存在" in (t.error_message or "")
    assert "task_failed" in events
    assert "task_created" in events


# =============================================================================
# 依赖:满足 → 等待后执行
# =============================================================================


async def test_dependency_resolves():
    """依赖任务完成后,等待任务执行(wait 路径)。"""
    order: list[str] = []

    async def factory(task: KanbanTask) -> dict:
        order.append(task.id)
        await asyncio.sleep(0.01)
        return {"id": task.id}

    pool = WorkerPool(
        WorkerPoolConfig(max_workers=2, task_timeout_seconds=5),
        executor_factory=factory,
    )
    await pool.start()
    await pool.submit(_make_task("a", priority=5))
    await pool.submit(_make_task("b", priority=1, dependencies=["a"]))

    result = await pool.wait_all()
    await pool.shutdown()

    assert result.status == "success"
    assert result.task_results["a"].status == "done"
    assert result.task_results["b"].status == "done"
    assert order.index("a") < order.index("b"), f"a 应在 b 之前完成,实际 {order}"


# =============================================================================
# 超时 → blocked
# =============================================================================


async def test_timeout_blocked():
    """假 executor sleep 100s,timeout 0.5s → blocked。"""
    async def slow_factory(task: KanbanTask) -> dict:
        await asyncio.sleep(100)
        return {"id": task.id}

    pool = WorkerPool(
        WorkerPoolConfig(max_workers=1, task_timeout_seconds=0.5),
        executor_factory=slow_factory,
    )
    await pool.start()
    await pool.submit(_make_task("slow"))

    result = await pool.wait_all()
    await pool.shutdown()

    t = result.task_results["slow"]
    assert t.status == "blocked"
    assert "超时" in (t.error_message or "")


# =============================================================================
# 优雅关闭:shutdown 后 submit 拒绝
# =============================================================================


async def test_shutdown_rejects_submit():
    """shutdown 后新 submit 抛 RuntimeError。"""
    pool = WorkerPool(WorkerPoolConfig(max_workers=2))
    await pool.start()
    await pool.shutdown()

    with pytest.raises(RuntimeError, match="已关闭"):
        await pool.submit(_make_task("x"))


# =============================================================================
# SSE 事件回调
# =============================================================================


async def test_sse_events_emitted():
    """任务生命周期触发 task_created / task_status_changed / task_completed。"""
    events: list[AgentSSEEvent] = []

    async def factory(task: KanbanTask) -> dict:
        return {"id": task.id}

    pool = WorkerPool(
        WorkerPoolConfig(max_workers=1, task_timeout_seconds=5),
        executor_factory=factory,
        on_event=lambda e: events.append(e),
    )
    await pool.start()
    await pool.submit(_make_task("e1"))
    await pool.wait_all()
    await pool.shutdown()

    types = [e.type for e in events]
    assert "task_created" in types
    assert "task_status_changed" in types
    assert "task_completed" in types
    # 每个 event 都带 task_id + timestamp
    for e in events:
        assert e.task_id == "e1"
        assert e.timestamp


# =============================================================================
# camelCase 序列化对齐 TS 契约
# =============================================================================


def test_kanban_task_camel_dict():
    """KanbanTask.to_camel_dict 字段名 camelCase 对齐 agent-runtime.ts。"""
    task = KanbanTask(
        id="k1",
        agent_id="agent-1",
        name="任务",
        status="in_progress",
        priority=5,
        payload={"x": 1},
        scheduled_at="2026-07-22T00:00:00Z",
        dependencies=["d1"],
        worker_id="worker-1",
        created_by="u1",
        created_at="2026-07-22T00:00:00Z",
        updated_at="2026-07-22T00:00:00Z",
    )
    d = task.to_camel_dict()
    assert d["id"] == "k1"
    assert d["agentId"] == "agent-1"
    assert d["status"] == "in_progress"
    assert d["priority"] == 5
    assert d["scheduledAt"] == "2026-07-22T00:00:00Z"
    assert d["dependencies"] == ["d1"]
    assert d["workerId"] == "worker-1"
    assert d["createdBy"] == "u1"
    assert d["createdAt"] == "2026-07-22T00:00:00Z"
    assert d["updatedAt"] == "2026-07-22T00:00:00Z"
    # 确认无 snake_case 残留
    for key in d:
        assert "_" not in key, f"发现 snake_case 残留字段: {key}"


def test_worker_pool_config_camel_dict():
    """WorkerPoolConfig.to_camel_dict 对齐 TS。"""
    cfg = WorkerPoolConfig(max_workers=8, task_timeout_seconds=120, max_queue_size=50)
    d = cfg.to_camel_dict()
    assert d["maxWorkers"] == 8
    assert d["taskTimeoutSeconds"] == 120
    assert d["maxQueueSize"] == 50
    assert d["preemptive"] is False


def test_worker_state_camel_dict():
    """WorkerState.to_camel_dict 对齐 TS。"""
    ws = WorkerState(
        worker_id="w1",
        type="ai-service-worker",
        status="idle",
        completed_count=3,
        failed_count=1,
    )
    d = ws.to_camel_dict()
    assert d["workerId"] == "w1"
    assert d["type"] == "ai-service-worker"
    assert d["completedCount"] == 3
    assert d["failedCount"] == 1


def test_parallel_execution_result_camel_dict():
    """ParallelExecutionResult.to_camel_dict 对齐 TS。"""
    r = ParallelExecutionResult(
        execution_id="exec-1",
        status="success",
        total_duration_ms=123.4,
        worker_count=4,
        trace=[{"level": 0, "nodeIds": ["a"], "status": "success", "durationMs": 10.0}],
    )
    d = r.to_camel_dict()
    assert d["executionId"] == "exec-1"
    assert d["status"] == "success"
    assert d["totalDurationMs"] == 123.4
    assert d["workerCount"] == 4
    assert d["trace"][0]["nodeIds"] == ["a"]


# =============================================================================
# 队列满拒绝
# =============================================================================


async def test_queue_full_rejected():
    """队列满后 submit 抛 RuntimeError。"""
    async def factory(task: KanbanTask) -> dict:
        await asyncio.sleep(0.5)  # 慢消费,撑满队列
        return {"id": task.id}

    pool = WorkerPool(
        WorkerPoolConfig(max_workers=1, max_queue_size=3, task_timeout_seconds=10),
        executor_factory=factory,
    )
    await pool.start()
    # 提交 3 个填满队列(worker 正在跑第 1 个,队列里 2 个)
    # 注意:qsize 只计队列内,不计 in_progress;max_queue_size=3
    await pool.submit(_make_task("q1"))
    await pool.submit(_make_task("q2"))
    await pool.submit(_make_task("q3"))
    # 此时队列可能已满,再提交应被拒
    with pytest.raises(RuntimeError, match="队列已满"):
        await pool.submit(_make_task("q4"))

    await pool.shutdown()

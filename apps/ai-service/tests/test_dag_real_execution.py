# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #51 判据 5:DAG / WorkerPool 必须**真执行**,不再回显 payload。

覆盖两条入口:
- `WorkerPool._default_executor`(未注入 executor_factory 时的默认档)
- `POST /api/dag/execute` 的节点 executor 工厂

两者都必须分派到 `task_executors` 的真实注册表;跑不了的类型要**失败可见**
(blocked / failed),而不是把"没跑"写成 `executed: True`。
"""

from __future__ import annotations

import sys
import uuid
from typing import Any

import pytest

from app.api import dag as dag_module
from app.services.dag_scheduler import (
    KanbanTask,
    WorkerPool,
    WorkerPoolConfig,
)
from app.services.task_executors import TaskExecutionError


def _uid() -> str:
    return uuid.uuid4().hex[:10]


def _cmd_task(task_id: str, marker: str, key: str | None = None) -> KanbanTask:
    payload: dict[str, Any] = {
        "taskType": "long_running_command",
        "arguments": {"command": [sys.executable, "-c", f"print('{marker}')"]},
    }
    if key:
        payload["idempotencyKey"] = key
    return KanbanTask(id=task_id, agent_id="dag-test", name="真实命令", payload=payload)


# ---------------------------------------------------------------------------
# WorkerPool 默认 executor
# ---------------------------------------------------------------------------


async def test_worker_pool_default_executor_runs_real_command() -> None:
    """默认 executor 真起进程:结果里有子进程真实 exit_code 与 stdout,而非 echo。"""
    pool = WorkerPool(WorkerPoolConfig(max_workers=2, task_timeout_seconds=120))
    await pool.start()
    try:
        marker = f"POOL{_uid()}"
        await pool.submit(_cmd_task(f"pool-{_uid()}", marker))
        result = await pool.wait_all()
        task = next(iter(result.task_results.values()))
        assert task.status == "done"
        assert task.result is not None
        assert task.result["executed"] is True
        assert task.result["stub"] is False
        assert task.result["analysis_depth"] == "real"
        assert task.result["exit_code"] == 0
        assert marker in task.result["stdout"]
        assert "echo" not in task.result, "旧回显键不得再出现在结果面"
    finally:
        await pool.shutdown()


async def test_worker_pool_blocks_task_with_unknown_type_and_names_the_reason() -> None:
    """未知类型 ⇒ blocked + 可诊断原因(把失败写成人能看懂的一格,不是 done)。"""
    pool = WorkerPool(WorkerPoolConfig(max_workers=1, task_timeout_seconds=60))
    await pool.start()
    try:
        await pool.submit(
            KanbanTask(
                id=f"bad-{_uid()}",
                agent_id="dag-test",
                name="未知类型",
                payload={"taskType": "no_such_executor_type"},
            )
        )
        result = await pool.wait_all()
        task = next(iter(result.task_results.values()))
        assert task.status == "blocked"
        assert task.error_message and "未知任务类型" in task.error_message
        assert "batch_llm" in task.error_message, "要顺带给出可用类型,否则调用方只能瞎猜"
        assert result.status == "failed"
    finally:
        await pool.shutdown()


async def test_worker_pool_blocks_task_without_task_type() -> None:
    """payload 里没声明 taskType ⇒ 同样 blocked(旧实现此处会回 echo 并标 done)。"""
    pool = WorkerPool(WorkerPoolConfig(max_workers=1, task_timeout_seconds=60))
    await pool.start()
    try:
        await pool.submit(
            KanbanTask(id=f"none-{_uid()}", agent_id="dag-test", name="未声明", payload={"foo": 1})
        )
        result = await pool.wait_all()
        task = next(iter(result.task_results.values()))
        assert task.status == "blocked"
        assert task.error_message and "未声明 taskType" in task.error_message
    finally:
        await pool.shutdown()


async def test_worker_pool_uses_declared_idempotency_key_as_checkpoint() -> None:
    """checkpoint 键取 payload.idempotencyKey ⇒ 同一 DAG 任务重跑才接得上断点。"""
    pool = WorkerPool(WorkerPoolConfig(max_workers=1, task_timeout_seconds=120))
    await pool.start()
    key = f"dag-idem-{_uid()}"
    try:
        await pool.submit(_cmd_task(f"idem-{_uid()}", f"IDEM{_uid()}", key=key))
        result = await pool.wait_all()
        task = next(iter(result.task_results.values()))
        assert task.result is not None
        assert task.result["checkpoint_key"] == key
    finally:
        await pool.shutdown()


# ---------------------------------------------------------------------------
# /dag/execute 路由(直接调生产 handler,不在测试里重写判据)
# ---------------------------------------------------------------------------


async def test_dag_execute_endpoint_runs_declared_node(tmp_path: Any) -> None:
    """声明 taskType 的节点真跑真实 executor,结果经 GET 端点可读回。"""
    marker = f"DAGEP{_uid()}"
    req = dag_module.DAGExecuteRequest(
        nodes=[
            dag_module.DAGNodeSpec(
                id="n-run",
                name="真实节点",
                taskType="long_running_command",
                arguments={"command": [sys.executable, "-c", f"print('{marker}')"]},
                maxRetries=1,
            )
        ],
        initialContext={"seed": 1},
    )
    resp = await dag_module.execute_dag(req)
    assert resp["code"] == 0
    execution_id = resp["data"]["executionId"]
    assert resp["data"]["status"] == "success"

    fetched = await dag_module.get_execution(execution_id)
    node = fetched["data"]["taskResults"]["n-run"]
    assert node["status"] == "done"
    assert node["result"]["executed"] is True
    assert marker in node["result"]["stdout"]


async def test_dag_execute_endpoint_undeclared_node_is_marked_stub_not_done_success() -> None:
    """未声明类型的节点:调度成功,但 result 必须自证 executed=False / stub=True。"""
    req = dag_module.DAGExecuteRequest(
        nodes=[dag_module.DAGNodeSpec(id="n-bare", name="空节点", maxRetries=1)],
        initialContext={"seed": 1},
    )
    resp = await dag_module.execute_dag(req)
    fetched = await dag_module.get_execution(resp["data"]["executionId"])
    node = fetched["data"]["taskResults"]["n-bare"]
    assert node["result"]["executed"] is False
    assert node["result"]["stub"] is True
    assert node["result"]["analysis_depth"] == "none"


async def test_dag_execute_endpoint_declared_but_unknown_type_fails_node() -> None:
    """声明了不存在的类型 ⇒ 该节点 failed(不是"成功但啥都没干")。"""
    req = dag_module.DAGExecuteRequest(
        nodes=[
            dag_module.DAGNodeSpec(
                id="n-bad", name="坏类型", taskType="not_a_type", maxRetries=1
            )
        ]
    )
    resp = await dag_module.execute_dag(req)
    fetched = await dag_module.get_execution(resp["data"]["executionId"])
    node = fetched["data"]["taskResults"]["n-bad"]
    assert node["status"] == "blocked"
    assert node["errorMessage"] and "未知任务类型" in node["errorMessage"]


async def test_dag_node_without_type_still_propagates_to_downstream_levels() -> None:
    """DAG 调度语义没被改坏:依赖链仍按拓扑分层执行。"""
    req = dag_module.DAGExecuteRequest(
        nodes=[
            dag_module.DAGNodeSpec(id="a", name="A", maxRetries=1),
            dag_module.DAGNodeSpec(id="b", name="B", dependencies=["a"], maxRetries=1),
        ]
    )
    resp = await dag_module.execute_dag(req)
    fetched = await dag_module.get_execution(resp["data"]["executionId"])
    trace_nodes = {t.get("node_id") for t in fetched["data"]["trace"]}
    assert {"a", "b"} <= trace_nodes


async def test_execute_for_kanban_raises_for_unknown_type() -> None:
    """`execute_for_kanban` 是两条入口的共用出口:未知类型必须抛,不返回伪造体。"""
    from app.services.task_executors import execute_for_kanban

    with pytest.raises(TaskExecutionError):
        await execute_for_kanban(
            KanbanTask(id="x", agent_id="a", name="n", payload={"task_type": "不存在"})
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

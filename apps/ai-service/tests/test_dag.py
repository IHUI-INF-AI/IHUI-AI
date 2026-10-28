# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""dag.py 单元测试 — DAG 执行 + Worker Pool 任务管理 API。

测试覆盖:
- 数据模型:KanbanTaskCreate / DAGNodeSpec / DAGExecuteRequest(camelCase alias)
- DAG 执行端点:POST /dag/execute(成功 / 失败 500)
- DAG 查询端点:GET /dag/execute/{id}(命中 / 404)
- 任务管理端点:POST /dag/tasks / GET /dag/tasks/{id} / GET /dag/tasks / GET /dag/workers
- 隔离:mock DAGScheduler / WorkerPool 单例,不依赖真实 asyncio 池
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api import dag as dag_module
from app.api.dag import (
    DAGExecuteRequest,
    DAGNodeSpec,
    KanbanTaskCreate,
)
from app.services.dag_scheduler import (
    RUN_STATUS_PHYSICAL_STATES,
    RUN_STATUS_UNDETERMINED,
    DAGResult,
    KanbanTask,
    decode_run_status,
    encode_run_status,
)

# =============================================================================
# 辅助
# =============================================================================


def _make_app():
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(dag_module.router, prefix="/api")
    return app


@pytest.fixture(autouse=True)
def _reset_globals():
    """每个测试前后清空全局 _pool + _executions。"""
    dag_module._pool = None
    dag_module._executions.clear()
    yield
    dag_module._pool = None
    dag_module._executions.clear()


# =============================================================================
# 数据模型
# =============================================================================


def test_kanban_task_create_camel_case_alias():
    """KanbanTaskCreate 接受 camelCase alias(agentId/scheduledAt/createdBy)。"""
    task = KanbanTaskCreate(
        agentId="agent-1",
        name="do something",
        description="desc",
        priority=5,
        payload={"k": "v"},
        scheduledAt="2026-07-23T00:00:00Z",
        dependencies=["dep1"],
        createdBy="user-1",
    )
    assert task.agent_id == "agent-1"
    assert task.scheduled_at == "2026-07-23T00:00:00Z"
    assert task.created_by == "user-1"
    assert task.priority == 5
    assert task.dependencies == ["dep1"]


def test_kanban_task_create_required_fields():
    """KanbanTaskCreate:agentId + name 必填。"""
    with pytest.raises(ValueError):
        KanbanTaskCreate(name="x")  # 缺 agentId
    with pytest.raises(ValueError):
        KanbanTaskCreate(agentId="a")  # 缺 name


def test_kanban_task_create_defaults():
    """KanbanTaskCreate 默认 priority=0, payload={}, dependencies=[]。"""
    t = KanbanTaskCreate(agentId="a", name="n")
    assert t.priority == 0
    assert t.payload == {}
    assert t.dependencies == []
    assert t.id is None


def test_dag_node_spec_camel_case_alias():
    """DAGNodeSpec 接受 maxRetries alias。"""
    spec = DAGNodeSpec(
        id="n1",
        name="node1",
        dependencies=["n0"],
        maxRetries=5,
        timeout=60.0,
    )
    assert spec.max_retries == 5
    assert spec.timeout == 60.0
    assert spec.dependencies == ["n0"]


def test_dag_node_spec_defaults():
    """DAGNodeSpec 默认 max_retries=3, timeout=300, dependencies=[]。"""
    spec = DAGNodeSpec(id="n1", name="node1")
    assert spec.max_retries == 3
    assert spec.timeout == 300.0
    assert spec.dependencies == []


def test_dag_execute_request_camel_case_alias():
    """DAGExecuteRequest 接受 initialContext alias。"""
    req = DAGExecuteRequest(
        nodes=[DAGNodeSpec(id="n1", name="n1")],
        edges=[{"from": "a", "to": "b"}],
        initialContext={"k": "v"},
    )
    assert req.initial_context == {"k": "v"}
    assert req.edges == [{"from": "a", "to": "b"}]


def test_dag_execute_request_defaults():
    """DAGExecuteRequest 默认 edges=[], initial_context={}。"""
    req = DAGExecuteRequest(nodes=[DAGNodeSpec(id="n", name="n")])
    assert req.edges == []
    assert req.initial_context == {}


# =============================================================================
# KanbanTask.to_camel_dict
# =============================================================================


def test_kanban_task_to_camel_dict_keys():
    """KanbanTask.to_camel_dict 字段名转 camelCase。"""
    t = KanbanTask(
        id="t1",
        agent_id="a1",
        name="task name",
        description="desc",
        priority=2,
        payload={"x": 1},
        dependencies=["d1"],
        created_by="u1",
    )
    d = t.to_camel_dict()
    assert d["id"] == "t1"
    assert d["agentId"] == "a1"
    assert d["name"] == "task name"
    assert d["createdBy"] == "u1"
    assert d["dependencies"] == ["d1"]
    # snake_case 不应出现在结果中
    assert "agent_id" not in d
    assert "created_by" not in d


# =============================================================================
# 端点:POST /dag/execute
# =============================================================================


async def test_execute_dag_success(monkeypatch):
    """POST /api/dag/execute 成功 → code=0 + executionId + status。"""
    fake_scheduler = MagicMock()
    fake_result = MagicMock(spec=DAGResult)
    fake_result.status = "success"
    fake_result.node_results = {}
    fake_result.total_duration_ms = 100.0
    fake_result.trace = []
    fake_scheduler.add_node = MagicMock()
    fake_scheduler.execute = AsyncMock(return_value=fake_result)
    fake_scheduler.nodes = {}

    monkeypatch.setattr(dag_module, "DAGScheduler", lambda: fake_scheduler)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dag/execute",
            json={
                "nodes": [{"id": "n1", "name": "node1"}],
                "initialContext": {"k": "v"},
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert "executionId" in data["data"]
    assert data["data"]["status"] == "success"
    # 执行结果应被缓存到 _executions
    assert len(dag_module._executions) == 1


async def test_execute_dag_failure_returns_500(monkeypatch):
    """DAGScheduler.execute 抛异常 → code=500。"""
    fake_scheduler = MagicMock()
    fake_scheduler.add_node = MagicMock()
    fake_scheduler.execute = AsyncMock(side_effect=RuntimeError("dag boom"))
    monkeypatch.setattr(dag_module, "DAGScheduler", lambda: fake_scheduler)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dag/execute",
            json={"nodes": [{"id": "n1", "name": "node1"}]},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 500
    assert "DAG 执行失败" in data["message"]
    assert data["data"] is None


# =============================================================================
# 端点:GET /dag/execute/{execution_id}
# =============================================================================


async def test_get_execution_found():
    """GET /api/dag/execute/{id}:命中缓存 → 返回数据。"""
    dag_module._executions["exec-1"] = {"executionId": "exec-1", "status": "success"}
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/execute/exec-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"]["executionId"] == "exec-1"


async def test_get_execution_404():
    """GET /api/dag/execute/{id}:不存在 → 404。"""
    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/execute/nonexistent")
    assert resp.status_code == 404


# =============================================================================
# 端点:POST /dag/tasks
# =============================================================================


async def test_submit_task_success(monkeypatch):
    """POST /api/dag/tasks:提交任务 → code=0 + taskId。"""
    fake_pool = MagicMock()
    fake_pool.start = AsyncMock()
    fake_pool.submit = AsyncMock(return_value="task-123")
    monkeypatch.setattr(dag_module, "_ensure_pool_started", AsyncMock(return_value=fake_pool))

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dag/tasks",
            json={
                "agentId": "a1",
                "name": "task1",
                "payload": {"k": "v"},
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"]["taskId"] == "task-123"
    assert data["data"]["task"]["agentId"] == "a1"
    fake_pool.submit.assert_awaited_once()


async def test_submit_task_runtime_error_returns_500(monkeypatch):
    """POST /api/dag/tasks:pool.submit 抛 RuntimeError → code=500。"""
    fake_pool = MagicMock()
    fake_pool.start = AsyncMock()
    fake_pool.submit = AsyncMock(side_effect=RuntimeError("pool full"))
    monkeypatch.setattr(dag_module, "_ensure_pool_started", AsyncMock(return_value=fake_pool))

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dag/tasks",
            json={"agentId": "a1", "name": "t1"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 500
    assert data["message"] == "pool full"


async def test_submit_task_with_explicit_id(monkeypatch):
    """POST /api/dag/tasks:传 id 时复用,不传则生成 UUID。"""
    fake_pool = MagicMock()
    fake_pool.start = AsyncMock()
    fake_pool.submit = AsyncMock(return_value="explicit-id")
    monkeypatch.setattr(dag_module, "_ensure_pool_started", AsyncMock(return_value=fake_pool))

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/dag/tasks",
            json={"id": "explicit-id", "agentId": "a", "name": "n"},
        )

    data = resp.json()
    assert data["data"]["taskId"] == "explicit-id"
    # pool.submit 收到的 task.id 应是 explicit-id
    submitted_task = fake_pool.submit.call_args.args[0]
    assert submitted_task.id == "explicit-id"


# =============================================================================
# 端点:GET /dag/tasks/{task_id}
# =============================================================================


async def test_get_task_found(monkeypatch):
    """GET /api/dag/tasks/{id}:命中 → 返回 task camelCase 字典。"""
    task = KanbanTask(id="t1", agent_id="a1", name="task1")
    fake_pool = MagicMock()
    fake_pool.get_status = AsyncMock(return_value=task)
    monkeypatch.setattr(dag_module, "_get_pool", lambda: fake_pool)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/tasks/t1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"]["id"] == "t1"
    assert data["data"]["agentId"] == "a1"


async def test_get_task_404(monkeypatch):
    """GET /api/dag/tasks/{id}:pool.get_status 返回 None → 404。"""
    fake_pool = MagicMock()
    fake_pool.get_status = AsyncMock(return_value=None)
    monkeypatch.setattr(dag_module, "_get_pool", lambda: fake_pool)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/tasks/missing")
    assert resp.status_code == 404


# =============================================================================
# 端点:GET /dag/tasks(列表)
# =============================================================================


async def test_list_tasks_no_filter(monkeypatch):
    """GET /api/dag/tasks:无 status 参数 → 返回全部。"""
    tasks = [
        KanbanTask(id="t1", agent_id="a", name="n1"),
        KanbanTask(id="t2", agent_id="a", name="n2"),
    ]
    fake_pool = MagicMock()
    fake_pool.list_tasks = MagicMock(return_value=tasks)
    monkeypatch.setattr(dag_module, "_get_pool", lambda: fake_pool)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/tasks")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["total"] == 2
    assert len(data["data"]) == 2


async def test_list_tasks_with_status_filter(monkeypatch):
    """GET /api/dag/tasks?status=done → 把 status 透传给 pool.list_tasks。"""
    fake_pool = MagicMock()
    fake_pool.list_tasks = MagicMock(return_value=[])
    monkeypatch.setattr(dag_module, "_get_pool", lambda: fake_pool)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/tasks", params={"status": "done"})
    assert resp.status_code == 200
    fake_pool.list_tasks.assert_called_once_with(status="done")


# =============================================================================
# 端点:GET /dag/workers
# =============================================================================


async def test_list_workers(monkeypatch):
    """GET /api/dag/workers:返回 worker 状态列表。"""
    worker = MagicMock()
    worker.to_camel_dict = MagicMock(
        return_value={"workerId": "w1", "status": "idle", "type": "ai-service-worker"}
    )
    fake_pool = MagicMock()
    fake_pool.get_workers_state = MagicMock(return_value=[worker])
    monkeypatch.setattr(dag_module, "_get_pool", lambda: fake_pool)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/dag/workers")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert len(data["data"]) == 1
    assert data["data"][0]["workerId"] == "w1"


# =============================================================================
# _get_pool 单例
# =============================================================================


def test_get_pool_creates_singleton():
    """_get_pool:首次调用惰性创建 WorkerPool 实例。"""
    dag_module._pool = None
    pool1 = dag_module._get_pool()
    pool2 = dag_module._get_pool()
    assert pool1 is pool2


def test_get_pool_recreates_after_shutdown():
    """_get_pool:_shutdown=True 时重建实例。"""
    pool1 = dag_module._get_pool()
    pool1._shutdown = True
    pool2 = dag_module._get_pool()
    assert pool1 is not pool2


# =============================================================================
# V3 #51:_node_executor —— 未声明 taskType 的节点必须**自证没跑业务**
# (旧实现无条件回 `{"executed": True, "contextKeys": [...]}`,正是票面点名的
#  「/dag/execute 回显」病根;下面两条断言方向已反转。)
# =============================================================================


async def test_node_without_task_type_self_proves_not_executed():
    """未声明 taskType:调度照跑,但返回体必须 executed=False / stub=True。"""
    spec = dag_module.DAGNodeSpec(id="n1", name="节点一")
    result = await dag_module._node_executor(spec)({"a": 1, "b": 2})
    assert result["executed"] is False
    assert result["stub"] is True
    assert result["analysis_depth"] == "none"
    assert sorted(result["contextKeys"]) == ["a", "b"]
    assert result["supported_task_types"], "应把可用类型回给调用方,而不是只说失败"


async def test_node_with_unknown_task_type_raises_not_echoes():
    """声明了不存在的 taskType:抛 TaskExecutionError(节点记 failed),不伪装成功。"""
    from app.services.task_executors import TaskExecutionError

    spec = dag_module.DAGNodeSpec(id="n2", name="节点二", taskType="not_a_real_type")
    import pytest

    with pytest.raises(TaskExecutionError):
        await dag_module._node_executor(spec)({})


# =============================================================================
# L11501:run 级终态词汇编解码 round-trip
# (逻辑词汇↔物理列映射只活在仓储编解码出口;物理存储值零迁移零漂移)
# =============================================================================


def test_run_status_round_trip_logical_to_physical_to_logical():
    """逻辑词汇 → 物理值 → 逻辑词汇,逐字相等。"""
    for logical in ("errored", "interrupted", "superseded"):
        physical = encode_run_status(logical)
        assert physical in RUN_STATUS_PHYSICAL_STATES, f"{logical} 必须落在既有物理三档内"
        assert decode_run_status(physical) == logical, f"{logical} round-trip 失真"


def test_run_status_physical_words_zero_drift():
    """物理三档零漂移:encode(decode(物理值)) == 物理值(物理存储值不变的硬保证)。"""
    for physical in ("partial", "failed", "success"):
        assert encode_run_status(decode_run_status(physical)) == physical


def test_run_status_decode_canonicalizes_registered_buckets():
    """读侧还原逻辑词汇:注册过的物理档位 canonical 化为其逻辑词。"""
    assert decode_run_status("failed") == "errored"
    assert decode_run_status("partial") == "interrupted"
    assert decode_run_status("success") == "superseded"


def test_run_status_unregistered_word_lands_undetermined(caplog):
    """未注册词汇 ⇒ 落未判定并点名,不许猜成任意一档。"""
    import logging

    with caplog.at_level(logging.WARNING, logger="app.services.dag_scheduler"):
        assert encode_run_status("stopped") == RUN_STATUS_UNDETERMINED
        assert encode_run_status("bogus_status") == RUN_STATUS_UNDETERMINED
    assert "'stopped'" in caplog.text
    assert "'bogus_status'" in caplog.text


def test_run_status_decode_unknown_physical_lands_undetermined(caplog):
    """未知物理值 ⇒ 落未判定并点名。"""
    import logging

    with caplog.at_level(logging.WARNING, logger="app.services.dag_scheduler"):
        assert decode_run_status("cancelled") == RUN_STATUS_UNDETERMINED
        assert decode_run_status("") == RUN_STATUS_UNDETERMINED
    assert "'cancelled'" in caplog.text


# =============================================================================
# L11505 / G-998100:投递档位过滤「收口不变量」—— 两处终态词汇逐字节一致。
# 判据全部从两个源模块各自导入后比对,不抄一份常量进测试(§22c 禁复制门体判据)。
# =============================================================================


def test_g998100_dispatch_status_vocab_byte_equal():
    """dag_scheduler 两处档位词汇:AgentTaskStatus(Literal) ≡ KANBAN_TASK_STATUSES。

    契约"本 Literal 与下方对齐表必须同笔"(dag_scheduler.py:353)。漂任一词、
    改顺序、加减成员,本测试当场翻红。
    """
    from typing import get_args

    from app.services.dag_scheduler import KANBAN_TASK_STATUSES, AgentTaskStatus

    literal_vocab = tuple(get_args(AgentTaskStatus))
    table_vocab = tuple(KANBAN_TASK_STATUSES)
    assert literal_vocab == table_vocab
    # 字节层再钉一遍:同一顺序同一拼写,无隐形归一。
    assert [w.encode("utf-8") for w in literal_vocab] == [
        w.encode("utf-8") for w in table_vocab
    ]


def test_g998100_queue_ledger_terminal_vocab_byte_equal():
    """queue_ledger 两处终态词汇:跃迁表空集键(终态:空集) ≡ TERMINAL_STATES。

    两份词汇各自独立书写(queue_ledger.py:79 与 :94),漂一词即红;并验证
    事件→状态映射覆盖全部终态词、每个终态词恰有一个事件源(唯一映射)。
    """
    from app.core.queue_ledger import (
        _ALLOWED_TRANSITIONS,
        _EVENT_TO_STATE,
        TERMINAL_STATES,
    )

    sink_vocab = {state for state, outs in _ALLOWED_TRANSITIONS.items() if not outs}
    assert sink_vocab == set(TERMINAL_STATES)
    assert sorted(s.encode("utf-8") for s in sink_vocab) == sorted(
        s.encode("utf-8") for s in TERMINAL_STATES
    )

    targets = frozenset(_EVENT_TO_STATE.values())
    assert targets >= TERMINAL_STATES, "每个终态词都必须有事件可达"
    inverted: dict[str, list[str]] = {}
    for event, target in _EVENT_TO_STATE.items():
        inverted.setdefault(target, []).append(event)
    for state in sorted(TERMINAL_STATES):
        assert len(inverted[state]) == 1, f"终态 {state} 必须恰有一个事件源"


def test_g998100_write_and_replay_paths_byte_equal(tmp_path):
    """两条消费路径(写入 _transition / 回放 _load)对同一逻辑事件收敛出的
    终态字符串逐字节相等,且落在 TERMINAL_STATES 内。"""
    from app.core.queue_ledger import TERMINAL_STATES, QueueLedger

    # 终态事件 → 公开写入方法(方法名是 API 面,不是词汇表副本)。
    record_fns = {
        "confirm": "record_confirmed",
        "cancel": "record_cancel",
        "discard": "record_discard",
        "fail": "record_fail",
    }
    for event, fn_name in record_fns.items():
        item_id = f"i-{event}"
        ledger_path = tmp_path / f"{event}.jsonl"
        writer = QueueLedger(ledger_path)  # 路径A:写入收敛
        assert getattr(writer, fn_name)("t", item_id) is True
        written_final = writer.state_of("t", item_id)
        replayer = QueueLedger(ledger_path)  # 路径B:第二实例走 _load 回放收敛
        replayed_final = replayer.state_of("t", item_id)
        assert written_final is not None and replayed_final is not None
        assert written_final.encode("utf-8") == replayed_final.encode("utf-8")
        assert written_final in TERMINAL_STATES
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""DAG 调度引擎单元测试。

测试覆盖:
- DAGScheduler.add_node: 添加节点 / 重复节点报错
- DAGScheduler.validate: 无依赖验证 / 环检测 / 依赖不存在
- DAGScheduler._topological_levels: 拓扑分层
- DAGScheduler.execute: 串行 / 并行 / 重试 / 条件跳过 / fail_fast / continue_on_fail / 空 DAG
- DAGScheduler.visualize: 可视化输出
"""

from __future__ import annotations

import asyncio

import pytest

from app.services.dag_scheduler import (
    DAGNode,
    DAGResult,
    DAGScheduler,
    DAGValidationError,
    NodeResult,
)


# =============================================================================
# 公共 executor
# =============================================================================


async def mock_executor(context):
    return {"result": "done"}


async def always_fail(context):
    raise RuntimeError("boom")


def make_named_executor(name: str, record: list[str] | None = None):
    """构造一个 async executor:返回 {name: "done"},可选追加执行顺序到 record。"""

    async def fn(context):
        if record is not None:
            record.append(name)
        return {name: "done"}

    return fn


def make_flaky_executor(fail_count: int):
    """构造一个前 fail_count 次失败、之后成功的 executor。

    返回 (executor, calls) 元组,calls["n"] 可用于断言调用次数。
    """

    calls = {"n": 0}

    async def fn(context):
        calls["n"] += 1
        if calls["n"] <= fail_count:
            raise RuntimeError(f"fail #{calls['n']}")
        return {"attempt": calls["n"]}

    return fn, calls


# =============================================================================
# add_node
# =============================================================================


def test_add_node():
    """添加节点后 nodes 字典包含该节点。"""
    scheduler = DAGScheduler()
    node = DAGNode(id="a", name="A", executor=mock_executor)
    scheduler.add_node(node)

    assert "a" in scheduler.nodes
    assert scheduler.nodes["a"] is node


def test_add_duplicate_node():
    """重复添加同 id 节点应抛出 DAGValidationError。"""
    scheduler = DAGScheduler()
    scheduler.add_node(DAGNode(id="a", name="A", executor=mock_executor))

    with pytest.raises(DAGValidationError, match="已存在"):
        scheduler.add_node(DAGNode(id="a", name="A2", executor=mock_executor))


# =============================================================================
# validate
# =============================================================================


def test_validate_no_deps():
    """无依赖的单节点 DAG 验证通过。"""
    scheduler = DAGScheduler()
    scheduler.add_node(DAGNode(id="a", name="A", executor=mock_executor))
    # 不抛异常即通过
    scheduler.validate()


def test_validate_cycle():
    """存在环的 DAG 应抛出 DAGValidationError。"""
    scheduler = DAGScheduler()
    scheduler.add_node(DAGNode(id="a", name="A", executor=mock_executor, dependencies=["b"]))
    scheduler.add_node(DAGNode(id="b", name="B", executor=mock_executor, dependencies=["a"]))

    with pytest.raises(DAGValidationError, match="环"):
        scheduler.validate()


def test_validate_missing_dep():
    """依赖不存在的节点应抛出 DAGValidationError。"""
    scheduler = DAGScheduler()
    scheduler.add_node(
        DAGNode(id="a", name="A", executor=mock_executor, dependencies=["nonexistent"])
    )

    with pytest.raises(DAGValidationError, match="依赖不存在"):
        scheduler.validate()


# =============================================================================
# _topological_levels
# =============================================================================


def test_topological_levels():
    """拓扑分层:A→{B,C}→D 应分 3 层。"""
    scheduler = DAGScheduler()
    scheduler.add_node(DAGNode(id="a", name="A", executor=mock_executor))
    scheduler.add_node(DAGNode(id="b", name="B", executor=mock_executor, dependencies=["a"]))
    scheduler.add_node(DAGNode(id="c", name="C", executor=mock_executor, dependencies=["a"]))
    scheduler.add_node(
        DAGNode(id="d", name="D", executor=mock_executor, dependencies=["b", "c"])
    )

    levels = scheduler._topological_levels()

    assert len(levels) == 3
    assert levels[0] == ["a"]
    assert set(levels[1]) == {"b", "c"}
    assert levels[2] == ["d"]


# =============================================================================
# execute
# =============================================================================


async def test_execute_sequential():
    """串行执行 A→B→C,顺序正确且 context 合并。"""
    order: list[str] = []
    scheduler = DAGScheduler()
    scheduler.add_node(DAGNode(id="a", name="A", executor=make_named_executor("a", order)))
    scheduler.add_node(
        DAGNode(id="b", name="B", executor=make_named_executor("b", order), dependencies=["a"])
    )
    scheduler.add_node(
        DAGNode(id="c", name="C", executor=make_named_executor("c", order), dependencies=["b"])
    )

    result = await scheduler.execute({"input": "build feature"})

    assert result.status == "success"
    assert order == ["a", "b", "c"]
    assert result.context["a"] == {"a": "done"}
    assert result.context["b"] == {"b": "done"}
    assert result.context["c"] == {"c": "done"}
    assert result.context["input"] == "build feature"
    # 每个节点都有 NodeResult
    assert all(r.status == "success" for r in result.node_results.values())


async def test_execute_parallel():
    """并行执行 A→{B,C}→D,B 和 C 应同时运行(max_active >= 2)。"""
    state = {"active": 0, "max": 0}

    def make_tracked_executor(key: str):
        async def fn(context):
            state["active"] += 1
            state["max"] = max(state["max"], state["active"])
            await asyncio.sleep(0.05)
            state["active"] -= 1
            return {key: "done"}

        return fn

    scheduler = DAGScheduler()
    scheduler.add_node(DAGNode(id="a", name="A", executor=mock_executor))
    scheduler.add_node(
        DAGNode(id="b", name="B", executor=make_tracked_executor("b"), dependencies=["a"])
    )
    scheduler.add_node(
        DAGNode(id="c", name="C", executor=make_tracked_executor("c"), dependencies=["a"])
    )
    scheduler.add_node(
        DAGNode(
            id="d", name="D", executor=mock_executor, dependencies=["b", "c"]
        )
    )

    result = await scheduler.execute()

    assert result.status == "success"
    assert state["max"] >= 2  # B、C 并发执行
    assert result.context["b"] == {"b": "done"}
    assert result.context["c"] == {"c": "done"}
    assert result.context["d"] == {"result": "done"}


async def test_execute_retry():
    """节点重试:前 2 次失败,第 3 次成功。"""
    flaky, calls = make_flaky_executor(fail_count=2)
    scheduler = DAGScheduler()
    scheduler.add_node(
        DAGNode(
            id="flaky",
            name="不稳定节点",
            executor=flaky,
            max_retries=3,
            retry_delay=0,  # 测试不等待
        )
    )

    result = await scheduler.execute()

    assert result.status == "success"
    nr = result.node_results["flaky"]
    assert nr.status == "success"
    assert nr.attempts == 3
    assert nr.retry_count == 2
    assert calls["n"] == 3


async def test_execute_retry_exhausted():
    """节点重试全部耗尽后标记 failed。"""
    flaky, calls = make_flaky_executor(fail_count=99)  # 永远失败
    scheduler = DAGScheduler()
    scheduler.add_node(
        DAGNode(id="flaky", name="永败节点", executor=flaky, max_retries=2, retry_delay=0)
    )

    result = await scheduler.execute()

    assert result.status == "failed"
    nr = result.node_results["flaky"]
    assert nr.status == "failed"
    assert nr.attempts == 2
    assert "fail #2" in nr.error
    assert calls["n"] == 2


async def test_execute_condition():
    """条件节点:condition 返回 False → 跳过,下游也跳过。"""
    # A 返回 passed=False → B 的 condition 不满足 → B 跳过 → C(B 的下游)也跳过
    async def exec_a(context):
        return {"passed": False}

    scheduler = DAGScheduler()
    scheduler.add_node(DAGNode(id="a", name="A", executor=exec_a))
    scheduler.add_node(
        DAGNode(
            id="b",
            name="B",
            executor=mock_executor,
            dependencies=["a"],
            condition=lambda ctx: ctx.get("a", {}).get("passed", False),
        )
    )
    scheduler.add_node(
        DAGNode(id="c", name="C", executor=mock_executor, dependencies=["b"])
    )

    result = await scheduler.execute()

    assert result.status == "success"  # A 成功,B/C 跳过,无 failed
    assert result.node_results["a"].status == "success"
    assert result.node_results["b"].status == "skipped"
    # C 因上游 B 被跳过,不在 node_results 中(执行前已过滤)
    assert "c" not in result.node_results


async def test_execute_condition_met():
    """条件满足时节点正常执行。"""
    async def exec_a(context):
        return {"passed": True}

    scheduler = DAGScheduler()
    scheduler.add_node(DAGNode(id="a", name="A", executor=exec_a))
    scheduler.add_node(
        DAGNode(
            id="b",
            name="B",
            executor=mock_executor,
            dependencies=["a"],
            condition=lambda ctx: ctx.get("a", {}).get("passed", False),
        )
    )

    result = await scheduler.execute()

    assert result.status == "success"
    assert result.node_results["a"].status == "success"
    assert result.node_results["b"].status == "success"


async def test_execute_fail_fast():
    """节点失败 + continue_on_fail=False → 下游被跳过,DAG 状态 failed。"""
    scheduler = DAGScheduler()
    scheduler.add_node(
        DAGNode(id="a", name="A", executor=always_fail, max_retries=1, retry_delay=0)
    )
    scheduler.add_node(
        DAGNode(
            id="b",
            name="B",
            executor=mock_executor,
            dependencies=["a"],
            continue_on_fail=False,
        )
    )

    result = await scheduler.execute()

    assert result.status == "failed"
    assert result.node_results["a"].status == "failed"
    # B 因上游 A 失败且 continue_on_fail=False,被标记 skipped 后过滤,不执行
    assert "b" not in result.node_results


async def test_execute_continue_on_fail():
    """节点失败 + continue_on_fail=True → 下游继续执行,DAG 状态 partial。"""
    scheduler = DAGScheduler()
    # A 失败但 continue_on_fail=True,允许下游 B 继续
    scheduler.add_node(
        DAGNode(
            id="a",
            name="A",
            executor=always_fail,
            max_retries=1,
            retry_delay=0,
            continue_on_fail=True,
        )
    )
    scheduler.add_node(
        DAGNode(id="b", name="B", executor=mock_executor, dependencies=["a"])
    )

    result = await scheduler.execute()

    assert result.status == "partial"  # 既有 failed(A)又有 success(B)
    assert result.node_results["a"].status == "failed"
    assert result.node_results["b"].status == "success"


async def test_execute_empty_dag():
    """空 DAG 执行返回 success,node_results 为空。"""
    scheduler = DAGScheduler()
    result = await scheduler.execute()

    assert result.status == "success"
    assert result.node_results == {}
    assert result.trace == []
    assert isinstance(result, DAGResult)


async def test_execute_timeout():
    """节点超时后重试耗尽标记 failed。"""
    async def slow_executor(context):
        await asyncio.sleep(10)
        return {}

    scheduler = DAGScheduler()
    scheduler.add_node(
        DAGNode(
            id="slow",
            name="超时节点",
            executor=slow_executor,
            max_retries=1,
            retry_delay=0,
            timeout=0.1,
        )
    )

    result = await scheduler.execute()

    assert result.status == "failed"
    nr = result.node_results["slow"]
    assert nr.status == "failed"
    assert "超时" in nr.error


# =============================================================================
# visualize
# =============================================================================


def test_visualize():
    """可视化输出包含层级、节点名、依赖、条件、重试标记。"""
    scheduler = DAGScheduler()
    scheduler.add_node(DAGNode(id="a", name="调研", executor=mock_executor))
    scheduler.add_node(
        DAGNode(id="b", name="编码", executor=mock_executor, dependencies=["a"])
    )
    scheduler.add_node(
        DAGNode(
            id="c",
            name="部署",
            executor=mock_executor,
            dependencies=["b"],
            condition=lambda ctx: True,
            max_retries=5,
        )
    )

    text = scheduler.visualize()

    assert "DAG 可视化" in text
    assert "调研" in text
    assert "编码" in text
    assert "部署" in text
    assert "层级 0" in text
    assert "层级 1" in text
    assert "层级 2" in text
    assert "[条件]" in text
    assert "[重试 5]" in text


def test_node_result_dataclass():
    """NodeResult 必填字段 + 默认值正确。"""
    nr = NodeResult(node_id="x", status="failed")
    assert nr.node_id == "x"
    assert nr.status == "failed"
    assert nr.output is None
    assert nr.error is None
    assert nr.retry_count == 0
    assert nr.attempts == 0
    assert nr.duration_ms == 0.0


def test_dag_result_dataclass():
    """DAGResult 可正常构造。"""
    dr = DAGResult(
        status="success",
        node_results={},
        total_duration_ms=100.0,
        context={},
        trace=[],
    )
    assert dr.status == "success"
    assert dr.node_results == {}

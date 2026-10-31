# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""步骤「定义摘要」:定义一变即绝不回放(2026-10-31 立)。

病根(`step_call_key` 的旧 docstring 自己登记过):调用键只含
`step/name/type/input/context`,用户把 `config.tool` / `condition` / `thenSteps` /
`steps` 之类字段就地改写后,resume 仍命中旧缓存并回放旧结果 —— 静默拿错结果。

本文件的判据只有一条方向:**失效方向必须是"多跑一次",绝不能"拿错结果"**。
钉死七条:
  1. 定义摘要只认"除 input 外的全部定义字段":input 变了摘要不变(它已进调用键);
  2. 键序无关、只有 input 的步也返回稳定摘要(空对象摘要),且非空串;
  3. 算式单源(§0.6):摘要 = `task_executors.compute_idempotency_key` 的那一份实现,
     `workflow_engine.py` 里不长第二份哈希(由 test_workflow_resume.py 的反向锁继续钉住);
  4. 改 condition / config.tool / thenSteps ⇒ 该步重跑,并在
     `definitionChangedSteps` 里被点名;
  5. 只改 input ⇒ 仍按调用键语义重跑,但**不得**被记成"定义变了"(归因不许混);
  6. 定义完全没变 ⇒ 照旧回放,且新实例自己带着可对账的摘要(下一轮仍全回放);
  7. 旧记录无摘要 ⇒ 不回放(保守),并单列在 `definitionUnprovableSteps`。

测试隔离(AGENTS §5):每个用例一份全新 `WorkflowEngine()`,执行体换成计数替身;
零 PG(8810)/ 零 Redis(8811)/ 零网络 / 零 LLM。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest

from app.services.task_executors import compute_idempotency_key
from app.services.workflow_engine import (
    WORKFLOW_STEP_DEFINITION_TYPE,
    WorkflowEngine,
    definition_digest_of_step,
)

TERMINAL = ("completed", "failed", "cancelled")


# =========================================================================
# 替身与夹具
# =========================================================================


@pytest.fixture
def engine(monkeypatch: pytest.MonkeyPatch) -> WorkflowEngine:
    """测试隔离(AGENTS §5):每个用例一份全新引擎,不共享内存 store。

    与 test_workflow_resume.py 的 engine 同形,不另造第二套装配口径。
    """
    return WorkflowEngine()


def _install_executor_spy(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> list[str]:
    """把 `_execute_step` 换成计数替身:返回值由步名派生,零 LLM/零工具触达。"""
    calls: list[str] = []

    async def fake(
        step: dict[str, Any],
        context: dict[str, Any],
        instance_id: str,
        *,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        name = str(step.get("name", ""))
        calls.append(name)
        return {"output": f"ran::{name}::{step.get('input', '')}"}

    monkeypatch.setattr(engine, "_execute_step", fake)
    return calls


async def _wait_final(engine: WorkflowEngine, instance_id: str) -> str:
    """轮询到终态(后台 task 由 spawn 持有,没有句柄可 await)。"""
    deadline = time.perf_counter() + 5.0
    while time.perf_counter() < deadline:
        inst = engine._instances.get(instance_id)
        if inst is not None and inst.status in TERMINAL:
            return inst.status
        await asyncio.sleep(0.01)
    raise AssertionError(f"实例 {instance_id} 未在 5s 内进入终态")


def _wf(engine: WorkflowEngine, steps: list[dict[str, Any]]) -> Any:
    return engine.create_workflow(
        name="定义摘要夹具流",
        description="定义摘要续跑夹具",
        triggerType="manual",
        steps=steps,
    )


async def _run(engine: WorkflowEngine, wf: Any, calls: list[str]) -> str:
    """跑一遍源实例,交还时清空计数("续跑没执行"才可断言)。"""
    inst = await engine.trigger_workflow(wf.id, {})
    assert inst is not None
    await _wait_final(engine, inst.id)
    calls.clear()
    return inst.id


async def _resume(engine: WorkflowEngine, source_id: str) -> dict[str, Any]:
    result = await engine.resume_instance(source_id)
    assert result["ok"] is True, result
    await _wait_final(engine, result["instanceId"])
    return result


# =========================================================================
# 1. 摘要本身:覆盖哪些键、稳定性、单源
# =========================================================================

BASE_STEP: dict[str, Any] = {
    "name": "s1",
    "type": "tool",
    "input": "hello",
    "config": {"tool": "search", "limit": 3},
}


@pytest.mark.parametrize(
    "override",
    [
        {"name": "s1-renamed"},
        {"type": "llm"},
        {"config": {"tool": "fetch", "limit": 3}},
        {"config": {"tool": "search", "limit": 4}},
        {"condition": "x > 1"},
        {"thenSteps": [{"name": "t1", "type": "echo", "input": "y"}]},
        {"elseSteps": [{"name": "e1", "type": "echo", "input": "n"}]},
        {"steps": [{"name": "l1", "type": "echo", "input": "z"}]},
        {"duration": 5},
        {"count": 3},
        {"continueOnFail": True},
        {"skill": "summarize"},
    ],
)
def test_digest_tracks_every_definition_field(override: dict[str, Any]) -> None:
    """除 input 外的任一字段被改写 ⇒ 摘要必须变(否则 resume 会回放旧结果)。"""
    assert definition_digest_of_step(BASE_STEP) != definition_digest_of_step(
        {**BASE_STEP, **override}
    )


def test_digest_ignores_input() -> None:
    """input 不进摘要:它已经进调用键,且会被模板渲染(等价模板不该判成定义变了)。"""
    assert definition_digest_of_step(BASE_STEP) == definition_digest_of_step(
        {**BASE_STEP, "input": "totally-different"}
    )
    assert definition_digest_of_step({"input": "a"}) == definition_digest_of_step(
        {"input": "b"}
    )


def test_digest_is_key_order_insensitive_and_never_empty() -> None:
    """规范化 JSON 的键序无关;空定义也返回稳定摘要,且**不是空串**。"""
    reordered = {"config": BASE_STEP["config"], "input": "hello", "type": "tool", "name": "s1"}
    assert definition_digest_of_step(BASE_STEP) == definition_digest_of_step(reordered)

    empty_digest = definition_digest_of_step({})
    assert empty_digest
    assert empty_digest == definition_digest_of_step({})
    assert empty_digest == definition_digest_of_step({"input": "whatever"})
    assert definition_digest_of_step({"name": "s1"}) != empty_digest


def test_digest_reuses_the_single_hash_source() -> None:
    """§0.6:摘要必须就是 compute_idempotency_key 那一份算式(本文件零复算)。"""
    payload = {k: v for k, v in BASE_STEP.items() if k != "input"}
    assert definition_digest_of_step(BASE_STEP) == compute_idempotency_key(
        WORKFLOW_STEP_DEFINITION_TYPE, payload
    )


# =========================================================================
# 2. 改定义 ⇒ 该步重跑(逐字段)
# =========================================================================


async def test_condition_change_reruns_the_step(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _wf(
        engine,
        [
            {"name": "s1", "type": "echo", "input": "one"},
            {
                "name": "s2",
                "type": "condition",
                "condition": "score > 10",
                "thenSteps": [{"name": "t1", "type": "echo", "input": "yes"}],
            },
            {"name": "s3", "type": "echo", "input": "three"},
        ],
    )
    source_id = await _run(engine, wf, calls)

    edited = [dict(s) for s in wf.steps]
    edited[1] = {**edited[1], "condition": "score > 100"}
    engine.update_workflow(wf.id, steps=edited)

    result = await _resume(engine, source_id)
    assert result["replayedSteps"] == [1, 3]
    assert result["definitionChangedSteps"] == [2]
    assert calls == ["s2"], f"condition 改了必须重跑,实际:{calls}"


async def test_config_tool_change_reruns_the_step(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """config.tool 不在调用键里(键不变)⇒ 只有定义摘要能拦下它。"""
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _wf(
        engine,
        [
            {"name": "s1", "type": "tool", "input": "q", "config": {"tool": "search"}},
            {"name": "s2", "type": "echo", "input": "two"},
        ],
    )
    source_id = await _run(engine, wf, calls)

    before = dict(wf.steps[0])
    edited = [dict(s) for s in wf.steps]
    edited[0] = {**edited[0], "config": {"tool": "fetch"}}
    engine.update_workflow(wf.id, steps=edited)

    # 归因对照:调用键对 config 完全瞎 ⇒ 拦住它的只能是定义摘要
    assert engine._key_of_definition_step(1, before, {}) == engine._key_of_definition_step(
        1, edited[0], {}
    )
    assert definition_digest_of_step(before) != definition_digest_of_step(edited[0])

    result = await _resume(engine, source_id)
    assert result["replayedSteps"] == [2]
    assert result["definitionChangedSteps"] == [1]
    assert calls == ["s1"], f"config.tool 改了必须重跑,实际:{calls}"


async def test_then_steps_change_reruns_the_step(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """分支体(thenSteps)改写也算定义变更 —— 嵌套字段由父步摘要覆盖。"""
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _wf(
        engine,
        [
            {
                "name": "s1",
                "type": "condition",
                "condition": "ok",
                "thenSteps": [{"name": "t1", "type": "echo", "input": "yes"}],
            },
            {"name": "s2", "type": "echo", "input": "two"},
        ],
    )
    source_id = await _run(engine, wf, calls)

    edited = [dict(s) for s in wf.steps]
    edited[0] = {
        **edited[0],
        "thenSteps": [{"name": "t1", "type": "echo", "input": "yes-改"}],
    }
    engine.update_workflow(wf.id, steps=edited)

    result = await _resume(engine, source_id)
    assert result["replayedSteps"] == [2]
    assert result["definitionChangedSteps"] == [1]
    assert calls == ["s1"], f"thenSteps 改了必须重跑,实际:{calls}"


# =========================================================================
# 3. 只改 input:仍按调用键语义,但不得记成"定义变了"
# =========================================================================


async def test_input_only_change_reruns_via_call_key(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _wf(
        engine,
        [
            {"name": "s1", "type": "echo", "input": "one"},
            {"name": "s2", "type": "echo", "input": "two"},
        ],
    )
    source_id = await _run(engine, wf, calls)

    edited = [dict(s) for s in wf.steps]
    edited[1] = {**edited[1], "input": "two-changed"}
    engine.update_workflow(wf.id, steps=edited)

    result = await _resume(engine, source_id)
    assert result["replayedSteps"] == [1]
    assert result["definitionChangedSteps"] == [], "input 改的是调用键,不该记成定义变更"
    assert calls == ["s2"]
    assert [t.output for t in engine._tasks[result["instanceId"]]] == [
        "ran::s1::one",
        "ran::s2::two-changed",
    ]


# =========================================================================
# 4. 定义没变:照旧回放,且新实例自身可对账
# =========================================================================


async def test_unchanged_definition_replays_and_stamps_digest(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _wf(
        engine,
        [
            {"name": "s1", "type": "echo", "input": "one"},
            {"name": "s2", "type": "tool", "input": "q", "config": {"tool": "search"}},
            {"name": "s3", "type": "echo", "input": "three"},
        ],
    )
    source_id = await _run(engine, wf, calls)
    expected = [definition_digest_of_step(s) for s in wf.steps]
    assert [t.definitionDigest for t in engine._tasks[source_id]] == expected

    first = await _resume(engine, source_id)
    assert first["replayedSteps"] == [1, 2, 3]
    assert first["replayedCount"] == 3
    assert first["definitionChangedSteps"] == []
    assert first["definitionUnprovableSteps"] == []
    assert calls == [], f"定义没变就不许执行,实际:{calls}"
    # 复用步也必须落摘要:否则新实例自己成了"无从证明"的旧记录
    assert [t.definitionDigest for t in engine._tasks[first["instanceId"]]] == expected

    # 下一轮照样全回放(两轮结果不变)
    second = await _resume(engine, first["instanceId"])
    assert second["replayedSteps"] == [1, 2, 3]
    assert [t.output for t in engine._tasks[second["instanceId"]]] == [
        t.output for t in engine._tasks[first["instanceId"]]
    ]


# =========================================================================
# 5. 旧记录无摘要:保守不回放(且归因与"定义变了"分开)
# =========================================================================


async def test_legacy_record_without_digest_is_never_replayed(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _wf(
        engine,
        [
            {"name": "s1", "type": "echo", "input": "one"},
            {"name": "s2", "type": "echo", "input": "two"},
        ],
    )
    source_id = await _run(engine, wf, calls)
    # 本列出现之前的记录形态:摘要为空串
    for task in engine._tasks[source_id]:
        task.definitionDigest = ""

    result = await _resume(engine, source_id)
    assert result["replayedSteps"] == []
    assert result["replayedCount"] == 0
    assert result["definitionChangedSteps"] == [], "旧记录不是'定义变了',归因不许混"
    assert result["definitionUnprovableSteps"] == [1, 2]
    assert calls == ["s1", "s2"], "无从证明定义没变 ⇒ 多跑一次"
    # 重跑后摘要补齐,下一轮即可全回放
    assert all(t.definitionDigest for t in engine._tasks[result["instanceId"]])


# =========================================================================
# 6. 多步:只有第 2 步定义变了
# =========================================================================


async def test_only_second_step_definition_changed(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _wf(
        engine,
        [
            {"name": "s1", "type": "echo", "input": "one"},
            {"name": "s2", "type": "tool", "input": "q", "config": {"tool": "search"}},
            {"name": "s3", "type": "echo", "input": "three"},
        ],
    )
    source_id = await _run(engine, wf, calls)
    assert len(engine._tasks[source_id]) == 3

    edited = [dict(s) for s in wf.steps]
    edited[1] = {**edited[1], "config": {"tool": "sql-query"}}
    engine.update_workflow(wf.id, steps=edited)

    result = await _resume(engine, source_id)
    assert result["replayedSteps"] == [1, 3]
    assert result["definitionChangedSteps"] == [2]
    assert calls == ["s2"], f"只有第 2 步该真跑,实际:{calls}"
    assert [t.step for t in engine._tasks[result["instanceId"]]] == [1, 2, 3]
    assert [t.output for t in engine._tasks[result["instanceId"]]] == [
        "ran::s1::one",
        "ran::s2::q",
        "ran::s3::three",
    ]
    assert await _wait_final(engine, result["instanceId"]) == "completed"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

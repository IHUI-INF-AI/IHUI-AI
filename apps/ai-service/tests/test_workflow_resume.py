# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""G-01 补齐腿(2026-10-31 立):Workflow 步骤级续跑 + 工作流动作的模型可见面。

票面事实(现读,不是叙述):引擎 `app/services/workflow_engine.py` 早在产,`WorkflowTask`
逐步持久化 input/output/status,重放所需的数据本来就在库里;真缺的只有两条腿 ——
① 按调用键复用已完成步骤(对标对方 `resumeFromRunId`),② 把触发/续跑/查状态注册成
MCP 工具(改前 `mcp_server` 里 workflow 工具名 0 命中)。

钉死七条:
  1. **命中即结构上不执行**:复用步不进 `_execute_step`(计数替身断言"一次都没调"),
     而不是"看起来结果一样";
  2. 改动/新增的步才真跑(定义里 name/type/input 就地改写 ⇒ 键变 ⇒ 重跑);
  3. 未判定优先(AGENTS §0.3):源实例取不到 / 属主不符 / trace 对不上 / 记录残缺 /
     completed 而 output 空串 ⇒ 具名错误码,**且一条副作用都不发生**;
  4. 认证不等于授权(§5):越权与不存在同码同形(不给存在性 oracle),正向对照同批留;
     工具面只认宿主注入的 `__user_id`,dev 降级身份归一后即拒;
  5. 工具面最小:schema 里**没有 script/scriptPath/code** 且 `additionalProperties=False`
     —— 对方的 RCE 面在本仓是靠"没有那个字段"消除的,不是靠正则拦住的;
  6. 调用键算式单源(§0.6):复用 `task_executors.compute_idempotency_key`,
     `workflow_engine.py` 里不得长出第二份 sha 指纹;
  7. `_TOOLS` ↔ `_TOOL_HANDLERS` 同批双射。

测试隔离(AGENTS §5):每个用例一份全新 `WorkflowEngine()`,执行体与 LLM/工具出口全部
换成替身;零 PG(8810)/ 零 Redis(8811)/ 零网络。
"""

from __future__ import annotations

import asyncio
import re
import time
from pathlib import Path
from typing import Any

import pytest

from app.core.jwt_auth import DEV_ANONYMOUS_PRINCIPAL
from app.services import mcp_server
from app.services.task_executors import compute_idempotency_key
from app.services.workflow_engine import (
    WF_RESUME_OUTPUT_UNVERIFIABLE,
    WF_RESUME_SOURCE_NOT_FINAL,
    WF_RESUME_SOURCE_NOT_VISIBLE,
    WF_RESUME_TASK_RECORD_INCOMPLETE,
    WF_RESUME_TASK_TRACE_MISALIGNED,
    WF_RESUME_TRIGGER_REFUSED,
    WF_RESUME_WORKFLOW_NOT_VISIBLE,
    WORKFLOW_STEP_KEY_TYPE,
    WorkflowEngine,
    WorkflowTask,
    resolve_caller,
)
from app.services.workflow_engine import (
    workflow_engine as engine_singleton,
)

USER_A = "user-a-workflow-resume"
USER_B = "user-b-workflow-resume"

TERMINAL = ("completed", "failed", "cancelled")


# =========================================================================
# 替身与夹具
# =========================================================================


def _install_executor_spy(
    engine: WorkflowEngine,
    monkeypatch: pytest.MonkeyPatch,
    *,
    fail_on: str | None = None,
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
        if fail_on is not None and name == fail_on:
            return {"error": "spy: 故意失败"}
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


@pytest.fixture
def engine(monkeypatch: pytest.MonkeyPatch) -> WorkflowEngine:
    return WorkflowEngine()


def _three_step_wf(engine: WorkflowEngine, *, owner: str | None = None) -> Any:
    return engine.create_workflow(
        name="三步回声流",
        description="续跑夹具",
        triggerType="manual",
        steps=[
            {"name": "s1", "type": "echo", "input": "one"},
            {"name": "s2", "type": "echo", "input": "two"},
            {"name": "s3", "type": "echo", "input": "three"},
        ],
        owner=owner,
    )


async def _run_once(
    engine: WorkflowEngine, workflow_id: str, calls: list[str], *, principal: str | None = None
) -> str:
    inst = await engine.trigger_workflow(workflow_id, {}, principal=principal)
    assert inst is not None
    instance_id = inst.id
    await _wait_final(engine, instance_id)
    assert calls == ["s1", "s2", "s3"], f"首轮就该整条真跑,实际:{calls}"
    calls.clear()  # 交还给调用方时计数恒为 0,"续跑没执行"才是可断言的
    return instance_id


# =========================================================================
# 1. 调用键:算式单源 + 四个维度各自咬合
# =========================================================================


def test_call_key_reuses_single_source_algorithm(engine: WorkflowEngine) -> None:
    """§0.6:键必须等于 task_executors.compute_idempotency_key 的那一份实现。"""
    key = engine.step_call_key(
        step=1, name="s1", step_type="echo", raw_input="one", context={"a": 1}
    )
    assert key == compute_idempotency_key(
        WORKFLOW_STEP_KEY_TYPE,
        {
            "step": 1,
            "name": "s1",
            "type": "echo",
            "input": "one",
            "context": {"a": 1},
        },
    )
    assert len(key) == 32


def test_engine_does_not_grow_a_second_fingerprint(engine: WorkflowEngine) -> None:
    """反向锁:workflow_engine.py 里不得出现第二份 sha 算式(§0.6 单一真相源)。"""
    src = (Path(__file__).resolve().parent.parent / "app" / "services" / "workflow_engine.py").read_text(
        encoding="utf-8"
    )
    assert not re.search(r"\bhashlib\b", src), "引擎里长出了第二份哈希实现"
    assert not re.search(r"\bsha256\b", src), "引擎里长出了第二份 sha256 指纹"
    assert "compute_idempotency_key" in src, "调用键没有复用 task_executors 那一份算式"


@pytest.mark.parametrize(
    "override",
    [
        {"step": 2},
        {"name": "s2"},
        {"step_type": "llm"},
        {"raw_input": "two"},
        {"context": {"a": 2}},
    ],
)
def test_every_dimension_changes_the_key(engine: WorkflowEngine, override: dict[str, Any]) -> None:
    base = {
        "step": 1,
        "name": "s1",
        "step_type": "echo",
        "raw_input": "one",
        "context": {"a": 1},
    }
    assert engine.step_call_key(**base) != engine.step_call_key(**{**base, **override})  # type: ignore[arg-type]


def test_key_uses_rendered_value_not_the_template(engine: WorkflowEngine) -> None:
    """模板等价 ⇒ 同键;上下文换了以致渲染结果换了 ⇒ 不同键。"""
    rendered_same = {
        "step": 1,
        "name": "s1",
        "step_type": "echo",
        "raw_input": "{greeting}!",
        "context": {"greeting": "hi"},
    }
    literal_same = {**rendered_same, "raw_input": "hi!"}
    assert engine.step_call_key(**rendered_same) == engine.step_call_key(**literal_same)  # type: ignore[arg-type]

    other_context = {**rendered_same, "context": {"greeting": "hello"}}
    assert engine.step_call_key(**rendered_same) != engine.step_call_key(**other_context)  # type: ignore[arg-type]


# =========================================================================
# 2. 命中即结构上不执行(计数替身断言)
# =========================================================================


async def test_unchanged_steps_are_never_executed(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    source_id = await _run_once(engine, wf.id, calls)

    result = await engine.resume_instance(source_id)
    assert result["ok"] is True, result
    assert result["replayedSteps"] == [1, 2, 3]
    assert result["replayedCount"] == 3
    new_id = result["instanceId"]
    await _wait_final(engine, new_id)

    assert calls == [], f"命中缓存的步一次都不该进执行体,实际跑了:{calls}"
    for idx, task in enumerate(engine._tasks[new_id]):
        assert task.status == "completed"
        assert task.step == idx + 1
    outputs = [t.output for t in engine._tasks[new_id]]
    assert outputs == ["ran::s1::one", "ran::s2::two", "ran::s3::three"]
    # 复用集合必须留痕,否则"没跑"与"跑了但账面空着"同形
    logs = " ".join(log.message for log in engine._logs[new_id])
    assert "复用" in logs and "未执行" in logs


async def test_edited_step_reruns_others_hit(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    source_id = await _run_once(engine, wf.id, calls)

    # 就地改写中间那一步的 input(画布上"改了这一步"的真实形态)
    edited = [dict(s) for s in wf.steps]
    edited[1]["input"] = "two-changed"
    engine.update_workflow(wf.id, steps=edited)

    result = await engine.resume_instance(source_id)
    assert result["ok"] is True, result
    assert result["replayedSteps"] == [1, 3]
    await _wait_final(engine, result["instanceId"])

    assert calls == ["s2"], f"只有被改动的那一步该真跑,实际:{calls}"
    new_tasks = engine._tasks[result["instanceId"]]
    assert [t.output for t in new_tasks] == [
        "ran::s1::one",
        "ran::s2::two-changed",
        "ran::s3::three",
    ]


async def test_resume_after_failure_reuses_prefix_only(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """失败后续跑:成功前缀复用,失败那步及其后真跑(这就是与 retry_instance 的区别)。"""
    calls = _install_executor_spy(engine, monkeypatch, fail_on="s2")
    wf = _three_step_wf(engine)
    inst = await engine.trigger_workflow(wf.id, {})
    assert inst is not None
    source_id = inst.id
    assert await _wait_final(engine, source_id) == "failed"
    assert calls == ["s1", "s2"]

    # "把失败那一步修好"的真实形态:改定义里那一步的类型;替身同步换成不失败的那一份
    engine.update_workflow(
        wf.id,
        steps=[
            {**s, "type": "llm"} if s["name"] == "s2" else dict(s)
            for s in wf.steps
        ],
    )
    calls = _install_executor_spy(engine, monkeypatch)
    result = await engine.resume_instance(source_id)
    assert result["ok"] is True, result
    assert result["replayedSteps"] == [1]
    await _wait_final(engine, result["instanceId"])
    assert calls == ["s2", "s3"], f"失败步与其后的步该真跑,实际:{calls}"


async def test_resume_with_new_input_reruns_everything(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """实例入参是全步骤共享的渲染上下文 ⇒ 换入参即所有键都变(不许声称"入参没变")。"""
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    source_id = await _run_once(engine, wf.id, calls)

    result = await engine.resume_instance(source_id, {"k": "v"})
    assert result["ok"] is True, result
    assert result["replayedSteps"] == []
    await _wait_final(engine, result["instanceId"])
    assert calls == ["s1", "s2", "s3"]


async def test_resume_is_stable_across_two_rounds(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """跑两次结果不变(§5 测试隔离 + 续跑本身的可重复性)。"""
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    source_id = await _run_once(engine, wf.id, calls)

    first = await engine.resume_instance(source_id)
    await _wait_final(engine, first["instanceId"])
    second = await engine.resume_instance(first["instanceId"])
    await _wait_final(engine, second["instanceId"])

    assert first["replayedSteps"] == second["replayedSteps"] == [1, 2, 3]
    assert [t.output for t in engine._tasks[first["instanceId"]]] == [
        t.output for t in engine._tasks[second["instanceId"]]
    ]


# =========================================================================
# 3. 未判定:具名错误码 + 零副作用
# =========================================================================


async def test_unknown_source_is_unjudged_with_zero_side_effects(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    before = len(engine._instances)
    result = await engine.resume_instance("wi-not-exist")
    assert result["ok"] is False
    assert result["errorCode"] == WF_RESUME_SOURCE_NOT_VISIBLE
    assert result["error"]
    assert len(engine._instances) == before
    assert calls == []
    assert engine._running_instances == set()


async def test_cross_owner_resume_is_refused_and_shaped_like_missing(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """§5 越权:与"不存在"同码同体(不给存在性 oracle),且副作用一次都没发生。"""
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine, owner=USER_A)
    source_id = await _run_once(engine, wf.id, calls, principal=USER_A)

    before = len(engine._instances)
    as_attacker = await engine.resume_instance(source_id, principal=USER_B)
    assert as_attacker["ok"] is False
    assert as_attacker["errorCode"] == WF_RESUME_SOURCE_NOT_VISIBLE
    assert calls == []
    assert len(engine._instances) == before
    assert engine._running_instances == set()
    # 源实例的 trace 一个字都没被动过
    assert [t.status for t in engine._tasks[source_id]] == ["completed"] * 3

    # 正向对照:同属主照样续得动(且复用步仍一次都不执行)
    as_owner = await engine.resume_instance(source_id, principal=USER_A)
    assert as_owner["ok"] is True, as_owner
    assert as_owner["replayedSteps"] == [1, 2, 3]
    await _wait_final(engine, as_owner["instanceId"])
    assert calls == []


async def test_completed_task_with_empty_output_is_unjudged(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    source_id = await _run_once(engine, wf.id, calls)
    engine._tasks[source_id][1].output = ""

    before = len(engine._instances)
    result = await engine.resume_instance(source_id)
    assert result["ok"] is False
    assert result["errorCode"] == WF_RESUME_OUTPUT_UNVERIFIABLE
    assert "第 2 步" in result["error"]
    assert len(engine._instances) == before
    assert calls == []


async def test_misaligned_trace_is_unjudged(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    source_id = await _run_once(engine, wf.id, calls)
    engine._tasks[source_id][1].step = 9

    result = await engine.resume_instance(source_id)
    assert result["ok"] is False
    assert result["errorCode"] == WF_RESUME_TASK_TRACE_MISALIGNED
    assert len(engine._instances) == 1
    assert calls == []


async def test_more_recorded_tasks_than_steps_is_unjudged(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    source_id = await _run_once(engine, wf.id, calls)
    extra = WorkflowTask(
        id="task-extra",
        instanceId=source_id,
        step=4,
        name="s4",
        type="echo",
        status="completed",
        input="four",
        output="ran::s4::four",
    )
    engine._tasks[source_id].append(extra)

    result = await engine.resume_instance(source_id)
    assert result["ok"] is False
    assert result["errorCode"] == WF_RESUME_TASK_TRACE_MISALIGNED
    assert len(engine._instances) == 1
    assert calls == []


async def test_record_without_name_is_unjudged(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    source_id = await _run_once(engine, wf.id, calls)
    engine._tasks[source_id][0].name = ""

    result = await engine.resume_instance(source_id)
    assert result["ok"] is False
    assert result["errorCode"] == WF_RESUME_TASK_RECORD_INCOMPLETE
    assert len(engine._instances) == 1
    assert calls == []


async def test_source_still_running_is_unjudged(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    inst = await engine.trigger_workflow(wf.id, {})
    assert inst is not None
    inst.status = "running"
    engine._tasks[inst.id] = []

    result = await engine.resume_instance(inst.id)
    assert result["ok"] is False
    assert result["errorCode"] == WF_RESUME_SOURCE_NOT_FINAL
    assert len(engine._instances) == 1
    assert calls == []


async def test_missing_workflow_definition_is_unjudged(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    source_id = await _run_once(engine, wf.id, calls)
    engine.delete_workflow(wf.id)

    result = await engine.resume_instance(source_id)
    assert result["ok"] is False
    assert result["errorCode"] == WF_RESUME_WORKFLOW_NOT_VISIBLE
    assert len(engine._instances) == 1
    assert calls == []


async def test_trigger_refusal_is_reported_not_recorded_green(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """计划建好但承载层拒触发(禁用/已有实例在跑)⇒ 具名错误码,不许把"复用了几步"当成功。"""
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    source_id = await _run_once(engine, wf.id, calls)
    engine.update_workflow(wf.id, isActive=False)

    result = await engine.resume_instance(source_id)
    assert result["ok"] is False
    assert result["errorCode"] == WF_RESUME_TRIGGER_REFUSED
    assert len(engine._instances) == 1
    assert calls == []


async def test_cancelled_before_first_step_resumes_as_zero_reuse(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """一步都没跑成的源实例:复用集如实为 0(不是"判不出",也不是"记绿")。"""
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    inst = await engine.trigger_workflow(wf.id, {})
    assert inst is not None
    # 真实形态:第一步还没进就被取消 ⇒ 终态 cancelled、trace 空
    assert await engine.cancel_instance(inst.id) is True
    assert await _wait_final(engine, inst.id) == "cancelled"
    assert engine._tasks[inst.id] == []

    result = await engine.resume_instance(inst.id)
    assert result["ok"] is True, result
    assert result["replayedSteps"] == []
    assert result["replayedCount"] == 0
    await _wait_final(engine, result["instanceId"])
    assert calls == ["s1", "s2", "s3"]


async def test_resume_without_identity_inherits_owner_not_a_fake_principal(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """无调用者身份时新实例继承定义行属主,绝不写 dev-anonymous 假主体。"""
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine, owner=USER_A)
    inst = await engine.trigger_workflow(wf.id, {})
    assert inst is not None
    source_id = inst.id
    await _wait_final(engine, source_id)
    calls.clear()

    result = await engine.resume_instance(source_id, principal=None)
    assert result["ok"] is True, result
    assert engine._instances[result["instanceId"]].userId == USER_A
    assert engine._instances[result["instanceId"]].userId != DEV_ANONYMOUS_PRINCIPAL
    assert calls == [], "无身份通道续跑同样不许执行已完成步"
    await _wait_final(engine, result["instanceId"])


# =========================================================================
# 4. 模型可见工具面:双射、身份、形状
# =========================================================================

WORKFLOW_TOOLS = ("workflow_trigger", "workflow_resume", "workflow_instance_status")


def _tool(name: str) -> Any:
    return next(t for t in mcp_server._TOOLS if t.name == name)


def test_three_tools_registered_bijectively() -> None:
    for name in WORKFLOW_TOOLS:
        assert name in mcp_server._TOOL_HANDLERS, f"{name} 只有声明没有处理函数"
    assert len(mcp_server._TOOLS) == len(mcp_server._TOOL_HANDLERS)


def test_tool_schemas_admit_no_script_surface() -> None:
    """超越轴的具体形状:没有脚本字段 + additionalProperties=False。"""
    forbidden = {"script", "scriptpath", "script_path", "code", "command", "path", "python"}
    for name in WORKFLOW_TOOLS:
        schema = _tool(name).input_schema
        assert schema.get("additionalProperties") is False, f"{name} 允许模型塞任意字段"
        keys = {k.lower() for k in schema.get("properties", {})}
        assert not (keys & forbidden), f"{name} 暴露了脚本面:{sorted(keys & forbidden)}"
        # 身份不得住模型可填字段(§5 / ROUTING_IDENTITY_KEYS)
        assert "user_id" not in keys and "userid" not in keys


async def test_handlers_refuse_without_host_principal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """无宿主身份 ⇒ PRINCIPAL_REQUIRED,且引擎一次都没被碰。"""
    hits: list[str] = []

    async def fake_trigger(*args: Any, **kwargs: Any) -> None:
        hits.append("trigger")
        return None

    async def fake_resume(*args: Any, **kwargs: Any) -> dict[str, Any]:
        hits.append("resume")
        return {}

    monkeypatch.setattr(engine_singleton, "trigger_workflow", fake_trigger)
    monkeypatch.setattr(engine_singleton, "resume_instance", fake_resume)

    for name, args in (
        ("workflow_trigger", {"workflow_id": "wf-x"}),
        ("workflow_resume", {"instance_id": "wi-x"}),
        ("workflow_instance_status", {"instance_id": "wi-x"}),
    ):
        out = await mcp_server._TOOL_HANDLERS[name](args)
        assert out["ok"] is False, out
        assert out["errorCode"] == "PRINCIPAL_REQUIRED", out
    assert hits == [], "没身份就不该走到引擎"


async def test_dev_anonymous_principal_is_not_a_principal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """dev 降级身份经 resolve_caller 归一成 None ⇒ 同样拒,而不是"按假主体放行全体"。"""
    hits: list[str] = []

    async def fake_trigger(*args: Any, **kwargs: Any) -> None:
        hits.append("trigger")
        return None

    monkeypatch.setattr(engine_singleton, "trigger_workflow", fake_trigger)
    out = await mcp_server._TOOL_HANDLERS["workflow_trigger"](
        {"workflow_id": "wf-x", "__user_id": DEV_ANONYMOUS_PRINCIPAL}
    )
    assert out["errorCode"] == "PRINCIPAL_REQUIRED"
    assert resolve_caller(DEV_ANONYMOUS_PRINCIPAL) is None
    assert hits == []


async def test_trigger_handler_passes_host_identity_into_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}

    async def fake_trigger(workflow_id: str, input_data: Any = None, **kwargs: Any) -> None:
        seen["workflow_id"] = workflow_id
        seen["input"] = input_data
        seen["principal"] = kwargs.get("principal")
        return None

    monkeypatch.setattr(engine_singleton, "trigger_workflow", fake_trigger)
    out = await mcp_server._TOOL_HANDLERS["workflow_trigger"](
        {"workflow_id": "wf-1", "input": {"k": "v"}, "__user_id": USER_A}
    )
    assert seen["principal"] == USER_A
    assert seen["workflow_id"] == "wf-1"
    assert out["errorCode"] == "WORKFLOW_NOT_TRIGGERABLE"

    bad = await mcp_server._TOOL_HANDLERS["workflow_trigger"](
        {"workflow_id": "wf-1", "input": "print(1)", "__user_id": USER_A}
    )
    assert bad["errorCode"] == "INVALID_PARAMS"
    empty = await mcp_server._TOOL_HANDLERS["workflow_trigger"]({"__user_id": USER_A})
    assert empty["errorCode"] == "MISSING_PARAMS"


async def test_resume_handler_forwards_engine_error_code(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_resume(instance_id: str, input_data: Any = None, **kwargs: Any) -> dict[str, Any]:
        return {
            "ok": False,
            "errorCode": WF_RESUME_OUTPUT_UNVERIFIABLE,
            "error": "第 2 步 status=completed 而 output 为空串",
        }

    monkeypatch.setattr(engine_singleton, "resume_instance", fake_resume)
    out = await mcp_server._TOOL_HANDLERS["workflow_resume"](
        {"instance_id": "wi-1", "__user_id": USER_A}
    )
    assert out["tool"] == "workflow_resume"
    assert out["ok"] is False
    assert out["errorCode"] == WF_RESUME_OUTPUT_UNVERIFIABLE


async def test_status_handler_is_owner_scoped(monkeypatch: pytest.MonkeyPatch) -> None:
    """非本人可见与不存在同形(INSTANCE_NOT_VISIBLE),正向对照拿到逐步 trace。"""
    e = WorkflowEngine()
    calls = _install_executor_spy(e, monkeypatch)
    wf = _three_step_wf(e, owner=USER_A)
    inst = await e.trigger_workflow(wf.id, {}, principal=USER_A)
    assert inst is not None
    await _wait_final(e, inst.id)

    monkeypatch.setattr(engine_singleton, "get_instance", e.get_instance)
    monkeypatch.setattr(engine_singleton, "get_instance_tasks", e.get_instance_tasks)
    monkeypatch.setattr(engine_singleton, "instance_to_dict", e.instance_to_dict)
    monkeypatch.setattr(engine_singleton, "task_to_dict", e.task_to_dict)

    denied = await mcp_server._TOOL_HANDLERS["workflow_instance_status"](
        {"instance_id": inst.id, "__user_id": USER_B}
    )
    assert denied["ok"] is False
    assert denied["errorCode"] == "INSTANCE_NOT_VISIBLE"

    ok = await mcp_server._TOOL_HANDLERS["workflow_instance_status"](
        {"instance_id": inst.id, "__user_id": USER_A}
    )
    assert ok["ok"] is True
    assert ok["taskCount"] == 3
    assert {t["status"] for t in ok["tasks"]} == {"completed"}
    assert all(t["outputChars"] > 0 for t in ok["tasks"])
    assert calls == ["s1", "s2", "s3"]


# =========================================================================
# 5. 向后兼容:老出口的老形状
# =========================================================================


async def test_retry_instance_semantics_unchanged(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """retry 仍是整条重跑、一个 output 都不复用(本票没把它改成续跑)。"""
    calls = _install_executor_spy(engine, monkeypatch, fail_on="s1")
    wf = _three_step_wf(engine)
    inst = await engine.trigger_workflow(wf.id, {})
    assert inst is not None
    assert await _wait_final(engine, inst.id) == "failed"
    assert calls == ["s1"]

    # 换回"这一步已经修好"的替身:retry 的语义与步成败无关,只看它不复用任何 output
    calls = _install_executor_spy(engine, monkeypatch)
    retried = await engine.retry_instance(inst.id)
    assert retried is not None
    await _wait_final(engine, retried.id)
    assert retried.id != inst.id
    assert calls == ["s1", "s2", "s3"], "retry 必须照旧整条重跑"


async def test_trigger_without_replay_arg_is_byte_identical(
    engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """新增的 replayed_outputs 缺省即旧行为:不传参时与改动前逐字同形。"""
    calls = _install_executor_spy(engine, monkeypatch)
    wf = _three_step_wf(engine)
    inst = await engine.trigger_workflow(wf.id, {"x": 1})
    assert inst is not None
    await _wait_final(engine, inst.id)
    assert calls == ["s1", "s2", "s3"]
    assert [t.output for t in engine._tasks[inst.id]] == [
        "ran::s1::one",
        "ran::s2::two",
        "ran::s3::three",
    ]
    assert engine.instance_to_dict(inst)["status"] == "completed"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

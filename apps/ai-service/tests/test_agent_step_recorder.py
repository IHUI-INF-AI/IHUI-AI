# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Agent 步骤录制与回放(agent_step_recorder + agent_loop_v2 埋点)单元测试。

验证:
- append_step / get_run_steps 分页
- 单 run 步数上限截断(丢最旧,保留最近)
- replay 全量 / 单步 / 越界
- get_run_metrics 聚合统计
- reset_run 清空(存在/不存在幂等)
- 空运行/不存在 run 的错误处理
- JSON 序列化耐久(写盘再读恢复)
- agent_loop_v2 注入 recorder 后逐步录制;未注入时默认路径与现状零差异
"""

from __future__ import annotations

import pytest

from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition
from app.services.agent_step_recorder import AgentStepRecorder

# =============================================================================
# recorder 纯服务测试
# =============================================================================


def test_append_and_pagination(tmp_path):
    rec = AgentStepRecorder(file_path=tmp_path / "step_records.json")
    for i in range(5):
        rec.append_step(
            "run-1",
            {"type": "tool", "tool_name": f"tool_{i}", "input_summary": {"n": i}},
        )

    data = rec.get_run_steps("run-1", page=1, page_size=2)
    assert data["total"] == 5
    assert len(data["list"]) == 2
    assert [s["step_index"] for s in data["list"]] == [0, 1]
    assert data["list"][0]["tool_name"] == "tool_0"

    page2 = rec.get_run_steps("run-1", page=3, page_size=2)
    assert len(page2["list"]) == 1
    assert page2["list"][0]["step_index"] == 4


def test_step_normalization_and_summary_truncation(tmp_path):
    rec = AgentStepRecorder(file_path=tmp_path / "step_records.json")
    big = {"x": "y" * 5000}
    step = rec.append_step(
        "run-1",
        {
            "type": "bogus_type",  # 非法 type → 归一化为 tool
            "status": "bogus",  # 非法 status → 归 ok
            "tool_name": "read",
            "input_summary": big,
            "result_summary": "fine",
            "tokens": "12",  # 字符串 → int
            "duration_ms": "3.5",
        },
    )
    assert step["type"] == "tool"
    assert step["status"] == "ok"
    assert step["tokens"] == 12
    assert step["duration_ms"] == 3.5
    assert step["tool_name"] == "read"
    assert len(step["input_summary"]) <= rec._summary_limit + 1
    assert step["result_summary"] == '"fine"'  # 摘要统一 json 序列化
    assert step["at"]


def test_step_index_auto_assigned(tmp_path):
    rec = AgentStepRecorder(file_path=tmp_path / "step_records.json")
    for i in range(3):
        rec.append_step("r", {"tool_name": f"t{i}"})
    steps = rec.replay("r")["steps"]
    assert [s["step_index"] for s in steps] == [0, 1, 2]


def test_max_steps_cap_truncates_oldest(tmp_path):
    rec = AgentStepRecorder(file_path=tmp_path / "c.json", max_steps=3)
    for i in range(6):
        rec.append_step("run-1", {"tool_name": f"t{i}"})
    steps = rec.replay("run-1")["steps"]
    assert len(steps) == 3
    # 丢最旧 0,1,2,保 3,4,5(最近 3 步)
    assert [s["tool_name"] for s in steps] == ["t3", "t4", "t5"]


def test_replay_full_and_single(tmp_path):
    rec = AgentStepRecorder(file_path=tmp_path / "c.json")
    for i in range(3):
        rec.append_step("run-1", {"tool_name": f"t{i}", "status": "ok"})

    full = rec.replay("run-1")
    assert full["total"] == 3
    assert len(full["steps"]) == 3

    one = rec.replay("run-1", step_index=1)
    assert one["found"] is True
    assert one["step"]["tool_name"] == "t1"

    # 越界单步 → found=false
    oob = rec.replay("run-1", step_index=99)
    assert oob["found"] is False
    assert oob["step"] is None


def test_metrics_stats(tmp_path):
    rec = AgentStepRecorder(file_path=tmp_path / "c.json")
    rec.append_step("run-1", {"status": "ok", "tokens": 10, "duration_ms": 100, "cost": 0.5})
    rec.append_step("run-1", {"status": "ok", "tokens": 20, "duration_ms": 200, "cost": 1.0})
    rec.append_step("run-1", {"status": "error", "tokens": 5, "duration_ms": 50, "cost": 0.25})

    m = rec.get_run_metrics("run-1")
    assert m["run_id"] == "run-1"
    assert m["step_count"] == 3
    assert m["ok_count"] == 2
    assert m["error_count"] == 1
    assert m["total_tokens"] == 35
    assert m["total_duration_ms"] == 350.0
    assert m["total_cost"] == 1.75


def test_reset_run(tmp_path):
    rec = AgentStepRecorder(file_path=tmp_path / "c.json")
    rec.append_step("run-1", {"tool_name": "t"})
    assert rec.reset_run("run-1") is True
    assert rec.replay("run-1")["total"] == 0
    # 不存在/已清空 → 幂等返回 False
    assert rec.reset_run("run-1") is False
    assert rec.reset_run("ghost") is False


def test_empty_and_missing_run_handling(tmp_path):
    rec = AgentStepRecorder(file_path=tmp_path / "c.json")
    assert rec.replay("ghost") == {"run_id": "ghost", "steps": [], "total": 0}
    assert rec.replay("ghost", step_index=0)["found"] is False
    assert rec.get_run_steps("ghost")["total"] == 0
    m = rec.get_run_metrics("ghost")
    assert m["step_count"] == 0 and m["total_tokens"] == 0 and m["total_cost"] == 0.0


def test_append_step_requires_run_id(tmp_path):
    rec = AgentStepRecorder(file_path=tmp_path / "c.json")
    with pytest.raises(ValueError):
        rec.append_step("", {"tool_name": "t"})


def test_persist_and_reload(tmp_path):
    """写盘后再读(模拟进程重启)能从文件恢复。"""
    p = tmp_path / "step_records.json"
    rec = AgentStepRecorder(file_path=p)
    rec.append_step("run-1", {"tool_name": "t0", "tokens": 7})
    rec.append_step("run-1", {"tool_name": "t1"})
    rec.append_step("run-2", {"tool_name": "x"})

    reloaded = AgentStepRecorder(file_path=p)
    assert reloaded.replay("run-1")["total"] == 2
    assert reloaded.replay("run-2")["total"] == 1
    assert reloaded.replay("run-1", step_index=0)["step"]["tokens"] == 7
    assert reloaded.replay("ghost")["total"] == 0


# =============================================================================
# agent_loop_v2 埋点测试(注入录制 / 未注入零差异)
# =============================================================================


async def _weather_executor(args):
    return {"city": args["city"], "weather": "晴", "temp": 25}


def _weather_tool() -> ToolDefinition:
    return ToolDefinition(
        name="get_weather",
        description="查天气",
        parameters={
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
        executor=_weather_executor,
    )


def _single_tool_llm():
    """第 1 轮调用工具,第 2 轮返回最终回复。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查一下北京天气",
                "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "北京晴 25 度", "tool_calls": None}

    return mock_llm


async def test_loop_with_recorder_records_tool_steps(tmp_path):
    """注入 recorder 后:每次工具调用 append 一步,含入参/结果摘要与状态。"""
    rec = AgentStepRecorder(file_path=tmp_path / "c.json")
    loop = AgentLoopV2(
        _single_tool_llm(),
        [_weather_tool()],
        max_iterations=5,
        recorder=rec,
    )
    result = await loop.run([{"role": "user", "content": "北京天气"}])

    assert result.success is True
    assert result.stop_reason == "completed"
    # recorder 未绑定 run_id → loop 以 session_id 作为运行标识
    got = loop._session_id
    run_steps = AgentStepRecorder(file_path=tmp_path / "c.json").replay(got)["steps"]
    assert len(run_steps) == 1
    s = run_steps[0]
    assert s["type"] == "tool"
    assert s["tool_name"] == "get_weather"
    assert "北京" in s["input_summary"]
    assert s["status"] == "ok"
    assert s["duration_ms"] >= 0


async def test_loop_recorder_run_id_fallback(tmp_path):
    """recorder 绑定 run_id:步骤落在该运行,而非 session_id。"""
    rec = AgentStepRecorder(file_path=tmp_path / "c.json")
    rec.run_id = "cloud-run-42"  # 生产由调用方绑定 cloud run_id
    loop = AgentLoopV2(
        _single_tool_llm(),
        [_weather_tool()],
        max_iterations=5,
        recorder=rec,
    )
    await loop.run([{"role": "user", "content": "北京天气"}])
    steps = rec.replay("cloud-run-42")["steps"]
    assert len(steps) == 1
    assert steps[0]["tool_name"] == "get_weather"


async def test_loop_records_error_steps(tmp_path):
    """工具执行错误也被录为 status=error 一步。"""
    async def bad_executor(args):
        raise RuntimeError("boom")

    tool = ToolDefinition(
        name="failing",
        description="fails",
        parameters={"type": "object", "properties": {}},
        executor=bad_executor,
    )

    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count <= 1:
            return {"content": "do it", "tool_calls": [{"id": "c1", "name": "failing", "args": {}}]}
        return {"content": "done", "tool_calls": None}

    rec = AgentStepRecorder(file_path=tmp_path / "c.json")
    loop = AgentLoopV2(mock_llm, [tool], max_iterations=5, recorder=rec)
    result = await loop.run([{"role": "user", "content": "x"}])
    # 错误后循环继续到第 2 轮返回最终回复
    assert result.success is True
    run_steps = rec.replay(loop._session_id)["steps"]
    assert len(run_steps) == 1
    assert run_steps[0]["status"] == "error"
    assert "boom" in run_steps[0]["result_summary"]


async def test_loop_without_recorder_zero_diff(tmp_path):
    """未注入 recorder 时:行为与基线逐零一致,且不产生任何 step。"""
    rec = AgentStepRecorder(file_path=tmp_path / "c.json")
    # 基线:不注入 recorder
    base_loop = AgentLoopV2(_single_tool_llm(), [_weather_tool()], max_iterations=5)
    base_result = await base_loop.run([{"role": "user", "content": "北京天气"}])

    # 对照:注入 recorder(行为应不变)
    rec_loop = AgentLoopV2(
        _single_tool_llm(), [_weather_tool()], max_iterations=5, recorder=rec
    )
    rec_result = await rec_loop.run([{"role": "user", "content": "北京天气"}])

    # 默认路径零差异:最终回复/停止原因一致
    assert base_result.final_response == rec_result.final_response == "北京晴 25 度"
    assert base_result.stop_reason == rec_result.stop_reason == "completed"
    assert len(base_result.iterations) == len(rec_result.iterations) == 2

    # 未注入 recorder 的实例不产生任何 step;注入的产生了
    fresh = AgentStepRecorder(file_path=tmp_path / "c.json")
    assert fresh.replay(base_loop._session_id)["total"] == 0
    assert fresh.replay(rec_loop._session_id)["total"] == 1


async def test_loop_parallel_record_steps(tmp_path):
    """并行多工具调用,每个工具各录一步。"""
    called = []

    async def mk(name):
        async def ex(args):
            called.append(name)
            return {"name": name}

        return ToolDefinition(
            name=name,
            description="d",
            parameters={"type": "object", "properties": {}},
            executor=ex,
        )

    tools = [await mk("a"), await mk("b")]

    async def mock_llm(messages, tools):
        if len(messages) <= 3:
            return {
                "content": "do both",
                "tool_calls": [
                    {"id": "c1", "name": "a", "args": {}},
                    {"id": "c2", "name": "b", "args": {}},
                ],
            }
        return {"content": "done", "tool_calls": None}

    rec = AgentStepRecorder(file_path=tmp_path / "c.json")
    loop = AgentLoopV2(mock_llm, tools, max_iterations=5, recorder=rec)
    result = await loop.run([{"role": "user", "content": "y"}])
    assert result.success is True
    run_steps = rec.replay(loop._session_id)["steps"]
    assert {s["tool_name"] for s in run_steps} == {"a", "b"}

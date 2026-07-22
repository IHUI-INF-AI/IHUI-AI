"""agent_loop_v2.py 单元测试:完整 ReAct 工具调用循环。

测试覆盖(11 个用例):
- 单工具调用循环(2 轮:工具调用 → 最终回复)
- 无工具直接回复(1 轮完成)
- 并行多工具调用(start_time 接近)
- 串行多工具调用(parallel_tool_calls=False,start_time 拉开)
- 达到 max_iterations 终止
- 工具执行错误继续循环
- 工具超时处理
- 未知工具处理
- LLM 调用异常
- tools schema 构建
- iterations trace 完整性

所有 mock 在测试函数内定义,无外部依赖,可 --noconftest 独立运行。
"""

from __future__ import annotations

import asyncio
import time

import pytest

from app.services.agent_loop_v2 import (
    AgentLoopResult,
    AgentLoopV2,
    LoopIteration,
    ToolCall,
    ToolDefinition,
    ToolResult,
)


# =============================================================================
# 辅助:常用工具定义
# =============================================================================


def _weather_tool(executor=None) -> ToolDefinition:
    return ToolDefinition(
        name="get_weather",
        description="查询城市天气",
        parameters={
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
        executor=executor or _weather_executor,
    )


async def _weather_executor(args):
    return {"city": args["city"], "weather": "晴", "temp": 25}


def _default_messages() -> list[dict]:
    return [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "北京天气"},
    ]


# =============================================================================
# 1. 单工具调用循环(2 轮)
# =============================================================================


async def test_run_single_tool_call():
    """LLM 第 1 轮返回 tool_call,第 2 轮返回最终回复。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "我来查一下天气",
                "tool_calls": [
                    {"id": "c1", "name": "get_weather", "args": {"city": "北京"}}
                ],
            }
        return {"content": "北京今天晴,25度", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=5)
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.final_response == "北京今天晴,25度"
    assert result.stop_reason == "completed"
    assert len(result.iterations) == 2
    assert call_count == 2
    # 第 1 轮:有 tool_calls 和 tool_results
    assert len(result.iterations[0].tool_calls) == 1
    assert result.iterations[0].tool_calls[0].name == "get_weather"
    assert len(result.iterations[0].tool_results) == 1
    assert result.iterations[0].tool_results[0].result["temp"] == 25
    # 第 2 轮:无 tool_calls(完成轮)
    assert result.iterations[1].tool_calls == []
    assert result.iterations[1].tool_results == []
    # messages 被追加:assistant + tool
    assert result.iterations[0].tool_results[0].error is None


# =============================================================================
# 2. 无工具直接回复(1 轮完成)
# =============================================================================


async def test_run_no_tools():
    """LLM 第 1 轮即返回无 tool_calls,1 轮完成。"""

    async def mock_llm(messages, tools):
        return {"content": "你好,我是助手", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=5)
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.final_response == "你好,我是助手"
    assert result.stop_reason == "completed"
    assert len(result.iterations) == 1
    assert result.iterations[0].tool_calls == []
    assert result.iterations[0].tool_results == []


# =============================================================================
# 3. 并行多工具调用
# =============================================================================


async def test_run_parallel_tools():
    """同一轮 2 个 tool_calls 并行执行:两工具 start_time 接近。"""
    starts: list[float] = []

    async def slow_tool(args):
        starts.append(time.time())
        await asyncio.sleep(0.1)
        return {"x": args["x"]}

    tools = [
        ToolDefinition(
            name="t_a",
            description="a",
            parameters={"type": "object", "properties": {"x": {"type": "integer"}}},
            executor=slow_tool,
        ),
        ToolDefinition(
            name="t_b",
            description="b",
            parameters={"type": "object", "properties": {"x": {"type": "integer"}}},
            executor=slow_tool,
        ),
    ]

    call_count = 0

    async def mock_llm(messages, tools_schema):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "并行执行",
                "tool_calls": [
                    {"id": "p1", "name": "t_a", "args": {"x": 1}},
                    {"id": "p2", "name": "t_b", "args": {"x": 2}},
                ],
            }
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, tools, max_iterations=5, parallel_tool_calls=True)
    result = await loop.run(_default_messages())

    assert result.success is True
    assert len(result.iterations[0].tool_results) == 2
    # 并行:两工具 start_time 差距很小(< 50ms)
    assert len(starts) == 2
    assert abs(starts[1] - starts[0]) < 0.05
    # 结果正确
    results = {tr.name: tr.result for tr in result.iterations[0].tool_results}
    assert results["t_a"]["x"] == 1
    assert results["t_b"]["x"] == 2


# =============================================================================
# 4. 串行多工具调用
# =============================================================================


async def test_run_serial_tools():
    """parallel_tool_calls=False:两工具 start_time 拉开(>= sleep 时长)。"""
    starts: list[float] = []

    async def slow_tool(args):
        starts.append(time.time())
        await asyncio.sleep(0.1)
        return {"x": args["x"]}

    tools = [
        ToolDefinition(
            name="t_a",
            description="a",
            parameters={"type": "object", "properties": {"x": {"type": "integer"}}},
            executor=slow_tool,
        ),
        ToolDefinition(
            name="t_b",
            description="b",
            parameters={"type": "object", "properties": {"x": {"type": "integer"}}},
            executor=slow_tool,
        ),
    ]

    call_count = 0

    async def mock_llm(messages, tools_schema):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "串行执行",
                "tool_calls": [
                    {"id": "s1", "name": "t_a", "args": {"x": 1}},
                    {"id": "s2", "name": "t_b", "args": {"x": 2}},
                ],
            }
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, tools, max_iterations=5, parallel_tool_calls=False)
    result = await loop.run(_default_messages())

    assert result.success is True
    assert len(result.iterations[0].tool_results) == 2
    # 串行:第二个工具 start 晚于第一个工具 start + sleep(0.1s)
    assert len(starts) == 2
    assert starts[1] - starts[0] >= 0.08


# =============================================================================
# 5. 达到 max_iterations 终止
# =============================================================================


async def test_run_max_iterations():
    """LLM 每轮都返回 tool_calls,达到 max_iterations 终止。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        return {
            "content": f"第{call_count}轮",
            "tool_calls": [{"id": f"c{call_count}", "name": "get_weather", "args": {"city": "北京"}}],
        }

    loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=2)
    result = await loop.run(_default_messages())

    assert result.success is False
    assert result.stop_reason == "max_iterations"
    assert "达到最大迭代数 2" in result.error
    assert len(result.iterations) == 2
    assert call_count == 2
    assert result.final_response == ""


# =============================================================================
# 6. 工具执行错误继续循环
# =============================================================================


async def test_run_tool_error():
    """工具 executor 抛异常,错误回填后循环继续,最终完成。"""

    async def bad_executor(args):
        raise ValueError("天气服务不可用")

    bad_tool = ToolDefinition(
        name="get_weather",
        description="查天气",
        parameters={"type": "object", "properties": {"city": {"type": "string"}}},
        executor=bad_executor,
    )

    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "e1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "抱歉,天气查询失败", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [bad_tool], max_iterations=5)
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert result.final_response == "抱歉,天气查询失败"
    # 第 1 轮工具结果含 error
    tr = result.iterations[0].tool_results[0]
    assert tr.error is not None
    assert "天气服务不可用" in tr.error
    assert tr.result is None
    # 第 2 轮完成
    assert len(result.iterations) == 2


# =============================================================================
# 7. 工具超时处理
# =============================================================================


async def test_run_tool_timeout():
    """工具执行超过 tool_timeout,返回超时 error,循环继续完成。"""

    async def slow_executor(args):
        await asyncio.sleep(0.5)
        return {"should": "never reach"}

    slow_tool = ToolDefinition(
        name="get_weather",
        description="查天气",
        parameters={"type": "object", "properties": {"city": {"type": "string"}}},
        executor=slow_executor,
    )

    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "t1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "天气查询超时了", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [slow_tool], max_iterations=5, tool_timeout=0.1)
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    tr = result.iterations[0].tool_results[0]
    assert tr.error is not None
    assert "超时" in tr.error
    assert tr.result is None
    # duration 应 >= timeout(实际等待了 timeout 才抛)
    assert tr.duration_ms >= 90  # 约 100ms,留 10ms 容差


# =============================================================================
# 8. 未知工具处理
# =============================================================================


async def test_run_unknown_tool():
    """LLM 返回未知工具名,返回"工具 X 不存在"error,循环继续完成。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "调用未知工具",
                "tool_calls": [
                    {"id": "u1", "name": "nonexistent_tool", "args": {"x": 1}}
                ],
            }
        return {"content": "工具不存在,放弃", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=5)
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    tr = result.iterations[0].tool_results[0]
    assert tr.error is not None
    assert "不存在" in tr.error
    assert tr.name == "nonexistent_tool"
    assert tr.result is None
    assert tr.duration_ms == 0  # 未知工具不执行,duration 为 0


# =============================================================================
# 9. LLM 调用异常
# =============================================================================


async def test_run_llm_error():
    """LLM 调用抛异常,stop_reason=error,success=False。"""

    async def mock_llm(messages, tools):
        raise RuntimeError("LLM 网关连接失败")

    loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=5)
    result = await loop.run(_default_messages())

    assert result.success is False
    assert result.stop_reason == "error"
    assert "LLM 网关连接失败" in result.error
    assert result.final_response == ""
    # 异常轮仍被记录
    assert len(result.iterations) == 1
    assert result.iterations[0].iteration == 1


# =============================================================================
# 10. tools schema 构建
# =============================================================================


def test_build_tools_schema():
    """_build_tools_schema 输出 OpenAI function calling 格式。"""
    tools = [
        ToolDefinition(
            name="get_weather",
            description="查询天气",
            parameters={
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
            executor=_weather_executor,
        ),
        ToolDefinition(
            name="search",
            description="搜索",
            parameters={"type": "object", "properties": {"q": {"type": "string"}}},
            executor=_weather_executor,
        ),
    ]

    async def mock_llm(messages, tools_schema):
        return {"content": "", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, tools, max_iterations=1)
    schema = loop._build_tools_schema()

    assert len(schema) == 2
    assert schema[0] == {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询天气",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }
    assert schema[1]["function"]["name"] == "search"
    assert schema[1]["function"]["parameters"]["properties"]["q"]["type"] == "string"


# =============================================================================
# 11. iterations trace 完整性
# =============================================================================


async def test_loop_result_trace():
    """每轮 iteration 记录字段完整:iteration/start_time/end_time/duration_ms/reasoning。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "tr1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "北京晴 25度", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=5)
    result = await loop.run(_default_messages())

    assert isinstance(result, AgentLoopResult)
    # 内存 mock 极快,total_duration_ms 可能 < 1ms 截断为 0.0,验证非负即可
    assert result.total_duration_ms >= 0
    assert result.total_tokens_used > 0

    # 2 轮 iteration,每轮字段完整
    assert len(result.iterations) == 2
    for idx, it in enumerate(result.iterations, start=1):
        assert isinstance(it, LoopIteration)
        assert it.iteration == idx
        assert it.start_time is not None
        assert it.end_time is not None
        assert "T" in it.start_time  # ISO 8601
        assert it.duration_ms >= 0
        assert isinstance(it.reasoning, str)
        assert len(it.reasoning) > 0
        assert isinstance(it.tool_calls, list)
        assert isinstance(it.tool_results, list)
        # 第 1 轮有 tool_calls/tool_results,第 2 轮为空
        if idx == 1:
            assert len(it.tool_calls) == 1
            assert isinstance(it.tool_calls[0], ToolCall)
            assert it.tool_calls[0].id == "tr1"
            assert it.tool_calls[0].args == {"city": "北京"}
            assert len(it.tool_results) == 1
            assert isinstance(it.tool_results[0], ToolResult)
            assert it.tool_results[0].tool_call_id == "tr1"
            assert it.tool_results[0].duration_ms >= 0
        else:
            assert it.tool_calls == []
            assert it.tool_results == []

    # messages 被正确追加:原 2 条 + assistant + tool = 4
    # (run 会原地修改 messages 列表)


# =============================================================================
# 额外:messages 原地追加验证(佐证 trace 与 messages 一致)
# =============================================================================


async def test_run_appends_messages_in_place():
    """run 原地修改 messages:工具轮追加 assistant + tool 消息。"""
    call_count = 0
    messages = _default_messages()

    async def mock_llm(msgs, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "m1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        # 第 2 轮:验证 messages 已被追加 assistant + tool
        roles = [m["role"] for m in msgs]
        assert "assistant" in roles
        assert "tool" in roles
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_weather_tool()], max_iterations=5)
    await loop.run(messages)

    # 最终 messages:system + user + assistant + tool = 4
    assert len(messages) == 4
    assert messages[2]["role"] == "assistant"
    assert messages[2]["tool_calls"][0]["name"] == "get_weather"
    assert messages[3]["role"] == "tool"
    assert messages[3]["tool_call_id"] == "m1"

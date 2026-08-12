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
    """LLM 调用抛异常,stop_reason=error,success=False。

    关闭重试(llm_retry_max=0),聚焦「异常 → error 结果」链路;
    重试行为由 test_llm_retry_* 系列单独覆盖。
    """

    async def mock_llm(messages, tools):
        raise RuntimeError("LLM 网关连接失败")

    loop = AgentLoopV2(
        mock_llm, [_weather_tool()], max_iterations=5, llm_retry_max=0
    )
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


# =============================================================================
# L5-1 错误恢复:LLM 指数退避重试(2026-08-12 立)
# =============================================================================


async def test_llm_retry_success_after_transient_failure():
    """瞬时失败 2 次后成功:llm_complete 共被调 3 次,循环正常完成。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count <= 2:
            raise ConnectionError("网络抖动")
        return {"content": "重试后成功", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=5,
        llm_retry_max=3,
        llm_retry_backoff=0.01,
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert result.final_response == "重试后成功"
    assert call_count == 3  # 2 次失败 + 1 次成功


async def test_llm_retry_exhausted_raises_error():
    """持续失败且重试耗尽:stop_reason=error,llm_complete 被调 retry_max+1 次。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        raise TimeoutError("LLM 网关超时")

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=5,
        llm_retry_max=2,
        llm_retry_backoff=0.01,
    )
    result = await loop.run(_default_messages())

    assert result.success is False
    assert result.stop_reason == "error"
    assert "超时" in result.error
    assert call_count == 3  # 2 次重试 + 1 次最终 = retry_max+1


async def test_llm_retry_zero_disables_retry():
    """llm_retry_max=0 时失败立即抛错,不重试。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        raise RuntimeError("一次性失败")

    loop = AgentLoopV2(
        mock_llm, [_weather_tool()], max_iterations=5, llm_retry_max=0
    )
    result = await loop.run(_default_messages())

    assert result.success is False
    assert result.stop_reason == "error"
    assert call_count == 1


async def test_llm_retry_cancel_not_retried():
    """asyncio.CancelledError 不重试(用户取消必须立即生效)。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        raise asyncio.CancelledError()

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool()],
        max_iterations=5,
        llm_retry_max=3,
        llm_retry_backoff=0.01,
    )
    with pytest.raises(asyncio.CancelledError):
        await loop.run(_default_messages())

    assert call_count == 1  # 取消不重试


def test_classify_error_categories():
    """_classify_error 对常见异常分类正确。"""
    from app.services.agent_loop_v2 import AgentLoopV2

    assert AgentLoopV2._classify_error(TimeoutError("timeout")) == "timeout"
    assert AgentLoopV2._classify_error(ConnectionError("conn reset")) == "connection"
    assert (
        AgentLoopV2._classify_error(RuntimeError("HTTP 503 Service Unavailable"))
        == "http_5xx"
    )
    assert AgentLoopV2._classify_error(RuntimeError("HTTP 429 rate limited")) == "http_4xx"
    assert AgentLoopV2._classify_error(asyncio.CancelledError()) == "cancelled"
    assert AgentLoopV2._classify_error(ValueError("bad args")) == "unknown"


# =============================================================================
# L5-2 错误恢复:工具瞬时失败自动重试(2026-08-12 立)
# =============================================================================


async def test_tool_retry_success_after_transient_failure():
    """工具瞬时失败(ConnectionError)1 次后成功:executor 调 2 次,retry_count=1,循环完成。"""
    exec_count = 0

    async def flaky_executor(args):
        nonlocal exec_count
        exec_count += 1
        if exec_count == 1:
            raise ConnectionError("网络抖动")
        return {"ok": True}

    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "t1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "重试后完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool(flaky_executor)],
        max_iterations=5,
        tool_retry_max=1,
        tool_retry_backoff=0.01,
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert exec_count == 2  # 1 次失败 + 1 次重试成功
    tr = result.iterations[0].tool_results[0]
    assert tr.error is None
    assert tr.result == {"ok": True}
    assert tr.retry_count == 1


async def test_tool_retry_not_for_business_error():
    """http_4xx 业务错误不重试:executor 只调 1 次,retry_count=0。"""
    exec_count = 0

    async def biz_error_executor(args):
        nonlocal exec_count
        exec_count += 1
        raise RuntimeError("HTTP 429 rate limited")

    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "t2", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "放弃", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool(biz_error_executor)],
        max_iterations=5,
        tool_retry_max=3,  # 即使允许 3 次重试,业务错误也不重试
        tool_retry_backoff=0.01,
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    assert exec_count == 1  # 业务错误不重试
    tr = result.iterations[0].tool_results[0]
    assert tr.error is not None
    assert "429" in tr.error
    assert tr.retry_count == 0


async def test_tool_retry_exhausted():
    """持续超时且重试耗尽:executor 调 retry_max+1 次,retry_count=重试次数。"""
    exec_count = 0

    async def always_timeout(args):
        nonlocal exec_count
        exec_count += 1
        raise TimeoutError("工具超时")

    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "t3", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "工具仍失败", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool(always_timeout)],
        max_iterations=5,
        tool_retry_max=2,
        tool_retry_backoff=0.01,
    )
    result = await loop.run(_default_messages())

    assert result.success is True  # 工具失败回填 error,循环继续完成
    assert exec_count == 3  # 1 + 2 次重试
    tr = result.iterations[0].tool_results[0]
    assert tr.error is not None
    assert tr.retry_count == 2


async def test_tool_retry_zero_disabled():
    """tool_retry_max=0 时不重试:executor 只调 1 次。"""
    exec_count = 0

    async def flaky_executor(args):
        nonlocal exec_count
        exec_count += 1
        raise ConnectionError("网络抖动")

    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "t4", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_weather_tool(flaky_executor)],
        max_iterations=5,
        tool_retry_max=0,
    )
    result = await loop.run(_default_messages())

    assert result.success is True
    assert exec_count == 1  # 不重试
    tr = result.iterations[0].tool_results[0]
    assert tr.retry_count == 0


# =============================================================================
# L5-7 自进化:元认知反思注入 system prompt(2026-08-12 立)
# =============================================================================


async def test_metacognition_snippet_injected_into_system(monkeypatch):
    """metacognition.build_system_prompt_snippet 有内容时注入 system prompt。"""
    monkeypatch.setattr(
        "app.services.metacognition.metacognition.build_system_prompt_snippet",
        lambda **kw: "## 元认知提示\n- 反思发现1",
    )

    async def mock_llm(messages, tools):
        # 第 1 轮就能看到注入后的 system prompt
        sys_msg = messages[0]
        assert sys_msg["role"] == "system"
        assert "元认知提示" in sys_msg["content"]
        assert "反思发现1" in sys_msg["content"]
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [], max_iterations=5)
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"


async def test_metacognition_empty_snippet_noop(monkeypatch):
    """metacognition 空缓存时不注入,不影响原 system prompt。"""
    monkeypatch.setattr(
        "app.services.metacognition.metacognition.build_system_prompt_snippet",
        lambda **kw: "",
    )

    async def mock_llm(messages, tools):
        sys_msg = messages[0]
        assert sys_msg["role"] == "system"
        assert "元认知" not in sys_msg["content"]
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [], max_iterations=5)
    result = await loop.run(_default_messages())

    assert result.success is True


# =============================================================================
# L5-12 指标埋点回归测试(2026-08-12 立)
# =============================================================================


async def test_metrics_recorded_for_run_and_error(monkeypatch):
    """执行计数 + 错误计数埋点真实工作(增量断言,防全局污染)。"""
    from prometheus_client import REGISTRY

    def _get(name: str, labels: dict[str, str]) -> float:
        return REGISTRY.get_sample_value(name, labels) or 0.0

    base_runs_completed = _get(
        "ihui_agent_loop_runs_total", {"status": "completed"}
    )
    base_runs_error = _get("ihui_agent_loop_runs_total", {"status": "error"})
    base_errs_conn = _get(
        "ihui_agent_loop_errors_total", {"error_type": "connection"}
    )

    # 1. 成功任务 → runs_total{completed} +1
    async def ok_llm(messages, tools):
        return {"content": "完成", "tool_calls": None}

    loop_ok = AgentLoopV2(ok_llm, [], max_iterations=3)
    await loop_ok.run(_default_messages())

    # 2. 失败任务(LLM 抛连接错误,不重试)→ runs_total{error} + errors_total{connection} +1
    async def bad_llm(messages, tools):
        raise ConnectionError("network down")

    loop_bad = AgentLoopV2(bad_llm, [], max_iterations=3, llm_retry_max=0)
    await loop_bad.run(_default_messages())

    assert (
        _get("ihui_agent_loop_runs_total", {"status": "completed"})
        == base_runs_completed + 1
    )
    assert (
        _get("ihui_agent_loop_runs_total", {"status": "error"})
        == base_runs_error + 1
    )
    assert (
        _get("ihui_agent_loop_errors_total", {"error_type": "connection"})
        == base_errs_conn + 1
    )

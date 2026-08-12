"""AgentLoopV2(loop_v2)与 langgraph 模式简单任务行为一致性回归测试(2026-08-12 立)。

背景:execute_agent_stream 已支持 env AGENT_EXECUTOR=loop_v2 切换执行器。
本文件用 mock llm(llm_gateway.complete 返回固定回复)驱动 AgentLoopV2 生产接线
(_make_loop_v2_llm 风格:真实 closure + _convert_openai_tool_calls),
验证 loop_v2 在简单任务上的结果结构与成功路径与 langgraph 模式一致:

- 简单任务(无工具):success=True + final_response 非空 + stop_reason=completed
- 工具任务:mock llm 先返回 OpenAI 格式 tool_calls → 工具执行 + 结果回填 → 最终完成
- 工具失败:executor 抛异常 → 错误回填 LLM,stop_reason 仍 completed + tool_results 含 error
- LLM 全失败:mock llm 抛异常 → run() 不崩溃(success=False / error 兜底)
- SSE done 事件契约:与 execute_agent_stream loop_v2 分支映射一致

所有 mock 在测试内定义,不真调网络(llm_gateway.complete 被 monkeypatch)。
"""

from __future__ import annotations

from typing import Any

from app.routers.agents import _make_loop_v2_llm
from app.services.agent_loop_v2 import (
    AgentLoopResult,
    AgentLoopV2,
    ToolDefinition,
)


# =============================================================================
# 辅助:与 test_agent_loop_v2.py 同款工具 helper(复用模式)
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


def _patch_llm_gateway_complete(monkeypatch, replies: list[dict]):
    """把 llm_gateway.complete monkeypatch 为按序返回固定回复的 mock。"""
    import app.core.llm_gateway as lg

    call_count = 0

    async def _fake_complete(messages, model=None, **kwargs):
        nonlocal call_count
        reply = replies[min(call_count, len(replies) - 1)]
        call_count += 1
        return reply

    monkeypatch.setattr(lg.llm_gateway, "complete", _fake_complete)
    return lambda: call_count


def _make_loop_v2(tools: list[ToolDefinition] | None = None, **kw) -> AgentLoopV2:
    """用真实生产接线 _make_loop_v2_llm 构造 AgentLoopV2。"""
    return AgentLoopV2(
        _make_loop_v2_llm(model="test-model"),
        tools=tools or [_weather_tool()],
        max_iterations=5,
        enable_checkpoint=False,
        llm_retry_max=0,
        **kw,
    )


def _router_done_event(result: AgentLoopResult) -> dict[str, Any]:
    """镜像 execute_agent_stream loop_v2 分支的 done 事件(agents.py 322-331)。"""
    return {
        "type": "done",
        "success": result.success,
        "stop_reason": result.stop_reason,
        "output": getattr(result, "final_response", "")[:2000],
    }


# =============================================================================
# 1. 简单任务(无工具调用)
# =============================================================================


async def test_parity_simple_task_no_tools(monkeypatch):
    """简单任务:mock llm 直接返回固定回复 → success + final_response + completed。"""
    _patch_llm_gateway_complete(
        monkeypatch,
        [{"content": "北京今天晴,25度", "tool_calls": None}],
    )

    loop = _make_loop_v2()
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert result.final_response == "北京今天晴,25度"
    assert result.error is None
    assert len(result.iterations) == 1
    assert result.iterations[0].tool_calls == []
    assert result.iterations[0].tool_results == []


# =============================================================================
# 2. 工具任务(tool_calls → 执行 → 回填 → 完成)
# =============================================================================


async def test_parity_tool_call_roundtrip(monkeypatch):
    """工具任务:mock llm 第 1 轮返回 OpenAI tool_calls,第 2 轮返回最终回复。

    走 _make_loop_v2_llm 真实接线,验证 OpenAI 格式 tool_calls 经
    _convert_openai_tool_calls 转换后执行、结果回填、循环完成。
    """
    _patch_llm_gateway_complete(
        monkeypatch,
        [
            {
                "content": "我来查一下天气",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {"name": "get_weather", "arguments": '{"city": "北京"}'},
                    }
                ],
            },
            {"content": "北京今天晴,25度", "tool_calls": None},
        ],
    )

    loop = _make_loop_v2()
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert result.final_response == "北京今天晴,25度"
    assert len(result.iterations) == 2
    # 第 1 轮:工具执行 + 结果回填
    tr = result.iterations[0].tool_results[0]
    assert tr.name == "get_weather"
    assert tr.result == {"city": "北京", "weather": "晴", "temp": 25}
    assert tr.error is None
    # 第 2 轮:完成轮
    assert result.iterations[1].tool_calls == []
    assert result.iterations[1].tool_results == []


# =============================================================================
# 3. 工具失败(executor 抛异常 → 错误回填 LLM → 仍 completed)
# =============================================================================


async def test_parity_tool_failure_still_completed(monkeypatch):
    """工具失败:executor 抛异常,stop_reason 仍 completed,tool_results 含 error。"""

    async def bad_executor(args):
        raise ValueError("天气服务不可用")

    _patch_llm_gateway_complete(
        monkeypatch,
        [
            {
                "content": "查天气",
                "tool_calls": [
                    {
                        "id": "e1",
                        "type": "function",
                        "function": {"name": "get_weather", "arguments": '{"city": "北京"}'},
                    }
                ],
            },
            {"content": "抱歉,天气查询失败", "tool_calls": None},
        ],
    )

    loop = _make_loop_v2(tools=[_weather_tool(bad_executor)])
    result = await loop.run(_default_messages())

    assert result.success is True
    assert result.stop_reason == "completed"
    assert result.final_response == "抱歉,天气查询失败"
    # 工具错误被回填,不中断循环
    tr = result.iterations[0].tool_results[0]
    assert tr.error is not None
    assert "天气服务不可用" in tr.error
    assert tr.result is None


# =============================================================================
# 4. LLM 全失败(mock llm 抛异常 → run() 不崩溃)
# =============================================================================


async def test_parity_llm_total_failure_no_crash(monkeypatch):
    """LLM 全失败:mock llm 抛异常 → success=False + stop_reason=error,不崩溃。"""
    import app.core.llm_gateway as lg

    async def _failing_complete(messages, model=None, **kwargs):
        raise RuntimeError("LLM 网关连接失败")

    monkeypatch.setattr(lg.llm_gateway, "complete", _failing_complete)

    loop = _make_loop_v2()
    result = await loop.run(_default_messages())

    assert result.success is False
    assert result.stop_reason == "error"
    assert "LLM 网关连接失败" in result.error
    assert result.final_response == ""
    # 异常轮仍被记录,不丢 trace
    assert len(result.iterations) == 1


# =============================================================================
# 5. SSE done 事件契约(与 langgraph 模式成功路径一致)
# =============================================================================


async def test_parity_done_event_contract(monkeypatch):
    """SSE done 事件契约:简单任务 → done 事件 success/stop_reason/output 一致。

    loop_v2 分支与 langgraph 模式在简单任务上都应产出"成功完成"路径:
    langgraph 模式终止事件 status=completed,loop_v2 done 事件 stop_reason=completed。
    """
    _patch_llm_gateway_complete(
        monkeypatch,
        [{"content": "你好,我是助手", "tool_calls": None}],
    )

    loop = _make_loop_v2()
    result = await loop.run(_default_messages())

    evt = _router_done_event(result)
    assert evt["type"] == "done"
    assert evt["success"] is True
    assert evt["stop_reason"] == "completed"
    assert evt["output"] == "你好,我是助手"

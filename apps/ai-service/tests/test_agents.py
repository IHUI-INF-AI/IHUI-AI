"""agents 路由纯逻辑单元测试(2026-08-12 立)。

覆盖不依赖服务端点的部分:
- _convert_openai_tool_calls: OpenAI tool_calls 格式 → AgentLoopV2 格式
- _map_hook_event_to_sse: hook 事件 → SSE 事件名映射
"""

from __future__ import annotations

from app.routers.agents import _convert_openai_tool_calls, _map_hook_event_to_sse


def test_convert_openai_tool_calls_basic():
    """标准 OpenAI 格式转换(id/name/args,arguments JSON 字符串解析)。"""
    tc = [
        {
            "id": "call_1",
            "type": "function",
            "function": {"name": "get_weather", "arguments": '{"city": "北京"}'},
        }
    ]
    result = _convert_openai_tool_calls(tc)
    assert result == [{"id": "call_1", "name": "get_weather", "args": {"city": "北京"}}]


def test_convert_openai_tool_calls_empty_none():
    """空/None 返回 None(AgentLoopV2 视为无工具调用)。"""
    assert _convert_openai_tool_calls(None) is None
    assert _convert_openai_tool_calls([]) is None


def test_convert_openai_tool_calls_bad_arguments():
    """arguments 非法 JSON → args 兜底为 {}。"""
    tc = [
        {"id": "c1", "function": {"name": "tool_a", "arguments": "not-json"}},
        {"id": "c2", "function": {"name": "tool_b"}},  # 缺 arguments
    ]
    result = _convert_openai_tool_calls(tc)
    assert result == [
        {"id": "c1", "name": "tool_a", "args": {}},
        {"id": "c2", "name": "tool_b", "args": {}},
    ]


def test_convert_openai_tool_calls_skips_non_dict():
    """非 dict 项跳过。"""
    tc = [{"id": "c1", "function": {"name": "a", "arguments": "{}"}}, "garbage", None]
    result = _convert_openai_tool_calls(tc)
    assert result == [{"id": "c1", "name": "a", "args": {}}]


def test_map_hook_event_to_sse():
    """hook 事件 → SSE 事件名映射。"""
    assert _map_hook_event_to_sse("session.start") == "session"
    assert _map_hook_event_to_sse("tool.before") == "tool_call"
    assert _map_hook_event_to_sse("tool.after") == "tool_result"
    assert _map_hook_event_to_sse("error") == "error"
    assert _map_hook_event_to_sse("unknown.event") == "unknown.event"

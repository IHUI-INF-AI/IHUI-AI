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


# =============================================================================
# L5-12 日志映射(AgentRuntimeLog SSE 端点)
# =============================================================================


def test_map_hook_event_to_log_entry_session():
    """session.start → 日志条目(type=session)。"""
    from app.routers.agents import _map_hook_event_to_log_entry

    entry = _map_hook_event_to_log_entry("session.start", {"session_id": "s1"})
    assert entry is not None
    assert entry["type"] == "session"
    assert "s1" in entry["content"]


def test_map_hook_event_to_log_entry_tool_after_success():
    """tool.after 成功 → success=True + type=tool_result + tool_results 明细。"""
    from app.routers.agents import _map_hook_event_to_log_entry

    entry = _map_hook_event_to_log_entry(
        "tool.after",
        {
            "tool_results": [
                {"name": "weather", "status": "success", "retry_count": 2, "duration_ms": 150}
            ]
        },
    )
    assert entry is not None
    assert entry["type"] == "tool_result"
    assert entry["success"] is True
    assert "weather" in entry["content"]
    assert "retry x2" in entry["content"]
    assert "150ms" in entry["content"]


def test_map_hook_event_to_log_entry_tool_after_error():
    """tool.after 失败 → success=False + error/error_type 摘要。"""
    from app.routers.agents import _map_hook_event_to_log_entry

    entry = _map_hook_event_to_log_entry(
        "tool.after",
        {
            "tool_results": [
                {"name": "db", "status": "error", "error": "timeout", "error_type": "timeout"}
            ]
        },
    )
    assert entry is not None
    assert entry["type"] == "tool_result"
    assert entry["success"] is False
    assert "timeout" in entry["content"]


def test_map_hook_event_to_log_entry_error():
    """error → success=False + error_type 分类。"""
    from app.routers.agents import _map_hook_event_to_log_entry

    entry = _map_hook_event_to_log_entry(
        "error", {"error_type": "connection", "message": "network down"}
    )
    assert entry is not None
    assert entry["type"] == "error"
    assert entry["success"] is False
    assert "connection" in entry["content"]


def test_map_hook_event_to_log_entry_unknown_noop():
    """未知事件 → None(不产生日志)。"""
    from app.routers.agents import _map_hook_event_to_log_entry

    assert _map_hook_event_to_log_entry("unknown.event", {"x": 1}) is None

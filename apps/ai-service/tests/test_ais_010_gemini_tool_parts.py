"""AIS-010 回归:Gemini 原生工具历史必须映射成 functionCall / functionResponse。

票面:`app/providers/gemini_provider.py` 原 `_convert_messages` 把所有非
user/system 角色一律映射成 role=model + text,assistant.tool_calls 与 role=tool
结果都退化成纯文本,模型看不到"调用/结果"配对,多轮工具调用语义错乱。

本文件纯单测 `_convert_messages`(不连网络/DB),锁定:
- assistant(tool_calls)+tool 两轮 → model.functionCall + 下一 user.functionResponse 且 name 配对;
- 并行同名工具(不同 id)→ 各自 functionResponse 按 id 对应,合并且在同一个 user turn;
- 普通文本映射不变;args 非 JSON 字符串不抛错。
"""

from __future__ import annotations

import logging
from typing import Any

from app.providers.gemini_provider import GeminiProvider


def _provider() -> GeminiProvider:
    return GeminiProvider(api_key="k")


def _tool_call(call_id: str, name: str, arguments: Any) -> dict[str, Any]:
    return {
        "id": call_id,
        "type": "function",
        "function": {"name": name, "arguments": arguments},
    }


def test_tool_call_turn_maps_to_function_call_and_response():
    """assistant.tool_calls → model.functionCall;role=tool → 下一 user.functionResponse。"""
    messages = [
        {"role": "user", "content": "北京天气?"},
        {
            "role": "assistant",
            "content": "我查一下",
            "tool_calls": [_tool_call("call_1", "get_weather", '{"city": "北京"}')],
        },
        {
            "role": "tool",
            "tool_call_id": "call_1",
            "name": "get_weather",
            "content": '{"temp": 26}',
        },
    ]

    system, contents = _provider()._convert_messages(messages)

    assert system is None
    assert [c["role"] for c in contents] == ["user", "model", "user"]
    # 原 assistant 文本保留,functionCall 的 args 解析成对象
    assert contents[1]["parts"] == [
        {"text": "我查一下"},
        {"functionCall": {"name": "get_weather", "args": {"city": "北京"}}},
    ]
    # 工具结果落在紧随其后的 user turn,且 name 与 functionCall 配对
    assert contents[2]["parts"] == [
        {"functionResponse": {"name": "get_weather", "response": {"temp": 26}}},
    ]


def test_parallel_same_name_tools_map_each_response_by_id():
    """并行两个同名工具但不同 id:tool 消息不带 name,靠 id 映射各自配对。"""
    messages = [
        {"role": "user", "content": "查两个城市"},
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                _tool_call("call_a", "search", '{"city": "北京"}'),
                _tool_call("call_b", "search", '{"city": "上海"}'),
            ],
        },
        # 故意不带 name:name 只能来自 tool_call_id → function.name 的映射
        {"role": "tool", "tool_call_id": "call_a", "content": '{"result": "晴"}'},
        {"role": "tool", "tool_call_id": "call_b", "content": '{"result": "雨"}'},
    ]

    _, contents = _provider()._convert_messages(messages)

    assert [c["role"] for c in contents] == ["user", "model", "user"]
    calls = contents[1]["parts"]
    assert [p["functionCall"]["name"] for p in calls] == ["search", "search"]
    assert [p["functionCall"]["args"] for p in calls] == [{"city": "北京"}, {"city": "上海"}]
    # 两个并行结果合并且在同一个 user turn(不拆成两个 user turn)
    responses = contents[2]["parts"]
    assert len(responses) == 2
    assert [p["functionResponse"]["name"] for p in responses] == ["search", "search"]
    assert [p["functionResponse"]["response"] for p in responses] == [
        {"result": "晴"},
        {"result": "雨"},
    ]


def test_plain_text_mapping_unchanged():
    """普通 system/user/assistant 文本映射与此前一致。"""
    messages = [
        {"role": "system", "content": "rule"},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]

    system, contents = _provider()._convert_messages(messages)

    assert system == "rule"
    assert contents == [
        {"role": "user", "parts": [{"text": "hi"}]},
        {"role": "model", "parts": [{"text": "hello"}]},
    ]


def test_invalid_json_arguments_degrade_to_empty_object_without_raising():
    """args / tool content 不是合法 JSON 时不抛错,安全降级为对象。"""
    messages = [
        {"role": "user", "content": "hi"},
        {
            "role": "assistant",
            "content": "调用",
            "tool_calls": [_tool_call("call_x", "do", "{不是 JSON")],
        },
        {"role": "tool", "tool_call_id": "call_x", "name": "do", "content": "纯文本结果"},
    ]

    _, contents = _provider()._convert_messages(messages)

    assert contents[1]["parts"] == [
        {"text": "调用"},
        {"functionCall": {"name": "do", "args": {}}},
    ]
    assert contents[2]["parts"][0]["functionResponse"] == {
        "name": "do",
        "response": {"result": "纯文本结果"},
    }


def test_tool_name_falls_back_to_message_name_when_id_unknown():
    """id 无映射时回退到 tool 消息自带的 name。"""
    messages = [
        {"role": "user", "content": "hi"},
        {"role": "tool", "tool_call_id": "not-in-history", "name": "legacy", "content": "ok"},
    ]

    _, contents = _provider()._convert_messages(messages)

    assert contents[1]["parts"][0]["functionResponse"]["name"] == "legacy"
    assert contents[1]["parts"][0]["functionResponse"]["response"] == {"result": "ok"}


def test_tool_message_without_resolvable_name_is_skipped_and_logged(caplog):
    """映射与自带 name 都没有 → 跳过该 tool 消息并留下告警日志。"""
    messages = [
        {"role": "user", "content": "hi"},
        {"role": "tool", "tool_call_id": "unknown", "content": "x"},
        {"role": "assistant", "content": "done"},
    ]

    with caplog.at_level(logging.WARNING, logger="app.providers.gemini_provider"):
        _, contents = _provider()._convert_messages(messages)

    assert [c["role"] for c in contents] == ["user", "model"]
    assert "已跳过" in caplog.text

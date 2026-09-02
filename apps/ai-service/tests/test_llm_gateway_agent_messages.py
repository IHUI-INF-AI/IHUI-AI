"""llm_gateway agent loop 消息修复单元测试(2026-09-02 立)。

覆盖 IHUI-Bench v0 根因修复新增的三个纯函数:
- _normalize_agent_tool_calls:自定义 {id,name,args} → OpenAI {id,type,function:{name,arguments}}
- _is_agent_loop_messages:agent loop 消息流判定(tool role / 自定义 tool_calls)
- _repair_agent_loop_messages:保留 tool role + 归一化,不合并并行 tool 结果

背景:AgentLoopV2 第 2 轮起请求必 400(自定义 tool_calls 缺 type/function +
repair_messages 剥 tool role),本轮在此落回归守门。
"""

from __future__ import annotations

import json

from app.core.llm_gateway import (
    _is_agent_loop_messages,
    _normalize_agent_tool_calls,
    _repair_agent_loop_messages,
)


# ---------------------------------------------------------------------------
# _normalize_agent_tool_calls
# ---------------------------------------------------------------------------


def test_normalize_legacy_tool_calls_to_openai_shape():
    tcs = _normalize_agent_tool_calls(
        [{"id": "c1", "name": "read_file", "args": {"path": "a.py"}}]
    )
    assert tcs[0]["type"] == "function"
    assert tcs[0]["id"] == "c1"
    assert tcs[0]["function"]["name"] == "read_file"
    assert json.loads(tcs[0]["function"]["arguments"]) == {"path": "a.py"}


def test_normalize_keeps_openai_shape_passthrough():
    orig = [{"id": "c2", "type": "function", "function": {"name": "x", "arguments": "{}"}}]
    assert _normalize_agent_tool_calls(orig) == orig


def test_normalize_edge_inputs():
    assert _normalize_agent_tool_calls(None) is None
    assert _normalize_agent_tool_calls([]) == []
    assert _normalize_agent_tool_calls("nope") == "nope"
    # 无法识别项(无 name)原样返回,交由下游报错,不静默吞掉
    assert _normalize_agent_tool_calls([{"id": "x"}]) == [{"id": "x"}]


def test_normalize_args_already_json_string():
    tcs = _normalize_agent_tool_calls(
        [{"id": "c3", "name": "w", "args": '{"a": 1}'}]
    )
    assert tcs[0]["function"]["arguments"] == '{"a": 1}'


# ---------------------------------------------------------------------------
# _is_agent_loop_messages
# ---------------------------------------------------------------------------


def test_detect_tool_role_message():
    msgs = [
        {"role": "user", "content": "hi"},
        {"role": "tool", "tool_call_id": "c", "content": "{}"},
    ]
    assert _is_agent_loop_messages(msgs) is True


def test_detect_legacy_custom_tool_calls():
    msgs = [{
        "role": "assistant",
        "content": "x",
        "tool_calls": [{"id": "c", "name": "read_file", "args": {}}],
    }]
    assert _is_agent_loop_messages(msgs) is True


def test_chat_messages_are_not_agent_loop():
    msgs = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "yo"},
    ]
    assert _is_agent_loop_messages(msgs) is False
    # OpenAI 原生 tool_calls(含 function 键)不算自定义形态 → False
    msgs2 = [{
        "role": "assistant",
        "content": "x",
        "tool_calls": [{
            "id": "c", "type": "function",
            "function": {"name": "x", "arguments": "{}"},
        }],
    }]
    assert _is_agent_loop_messages(msgs2) is False


# ---------------------------------------------------------------------------
# _repair_agent_loop_messages
# ---------------------------------------------------------------------------


def test_repair_keeps_tool_role_and_normalizes_tool_calls():
    msgs = [
        {"role": "user", "content": "task"},
        {"role": "assistant", "content": "先读文件", "tool_calls": [
            {"id": "c1", "name": "read_file", "args": {"path": "a.py"}},
        ]},
        {"role": "tool", "tool_call_id": "c1", "name": "read_file", "content": '{"ok": true}'},
    ]
    out, removed = _repair_agent_loop_messages(msgs)
    assert removed == 0
    # tool 结果必须保留(此前被 repair_messages 角色过滤剥掉)
    assert [m["role"] for m in out] == ["user", "assistant", "tool"]
    # assistant.tool_calls 归一化为 OpenAI 形态
    assert out[1]["tool_calls"][0]["type"] == "function"
    assert out[1]["tool_calls"][0]["function"]["name"] == "read_file"


def test_repair_does_not_merge_parallel_tool_results():
    """连续多条 tool 消息(并行工具结果)不得合并,保持 tool_call_id 对应关系。"""
    msgs = [
        {"role": "assistant", "content": "并行调用", "tool_calls": []},
        {"role": "tool", "tool_call_id": "c1", "content": "r1"},
        {"role": "tool", "tool_call_id": "c2", "content": "r2"},
    ]
    out, _ = _repair_agent_loop_messages(msgs)
    ids = [m["tool_call_id"] for m in out if m.get("role") == "tool"]
    assert ids == ["c1", "c2"]


def test_repair_drops_invalid_role_and_empty_system_user():
    msgs = [
        {"role": "user", "content": ""},
        {"role": "system", "content": "  "},
        {"role": "bogus", "content": "x"},
        {"role": "assistant", "content": "ok"},
    ]
    out, removed = _repair_agent_loop_messages(msgs)
    assert removed == 3
    assert [m["role"] for m in out] == ["assistant"]


def test_repair_keeps_empty_content_assistant_with_tool_calls():
    """纯工具轮 assistant 可能 content 为空但带 tool_calls,不得被空 content 规则误删。"""
    msgs = [{
        "role": "assistant",
        "content": "",
        "tool_calls": [{"id": "c", "name": "file_edit", "args": {}}],
    }]
    out, removed = _repair_agent_loop_messages(msgs)
    assert removed == 0
    assert out[0]["tool_calls"][0]["type"] == "function"

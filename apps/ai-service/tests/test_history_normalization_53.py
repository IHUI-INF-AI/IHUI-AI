# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批 53：会话历史健全化测试（对标 codex normalize.rs）。

覆盖场景：
① assistant 双 tool_calls 缺一补一（占位插在正确位置、与既有 tool 回复相邻）
② 孤儿 tool（前置无 assistant）删除
③ 混合链：正常对 + 孤儿 + 缺位一次 normalize 全修
④ remove_corresponding_for 连带删除
⑤ 畸形输入（tool_calls=None、非 dict 项）不崩
⑥ 只删不补模式（placeholder=None）
⑦ 空列表 / 无工具消息原样返回（计数 0）
"""

from __future__ import annotations

from app.core.history_normalization import (
    DEFAULT_PLACEHOLDER,
    ensure_call_outputs_present,
    normalize_history,
    remove_corresponding_for,
    remove_orphan_outputs,
)


def _assistant(call_ids, content="hi"):
    return {
        "role": "assistant",
        "content": content,
        "tool_calls": [
            {"id": cid, "type": "function", "function": {"name": f"tool_{cid}", "arguments": "{}"}}
            for cid in call_ids
        ],
    }


def _tool(tool_call_id, content="result", name=None):
    msg = {"role": "tool", "tool_call_id": tool_call_id, "content": content}
    if name is not None:
        msg["name"] = name
    return msg


# ① assistant 双 tool_calls 缺一补一 -------------------------------------------------
def test_ensure_fills_one_missing_of_two_in_correct_position():
    messages = [
        {"role": "user", "content": "do a and b"},
        _assistant(["call_a", "call_b"]),
        _tool("call_a", "result of a"),
        {"role": "assistant", "content": "done"},
    ]
    added = ensure_call_outputs_present(messages)
    assert added == 1

    # 占位插在 call_a 回复之后、下一个 assistant 之前；与既有 tool 回复相邻。
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert messages[2]["role"] == "tool" and messages[2]["tool_call_id"] == "call_a"
    assert messages[3]["role"] == "tool"
    assert messages[3]["tool_call_id"] == "call_b"
    assert messages[3]["content"] == DEFAULT_PLACEHOLDER
    assert messages[4]["role"] == "assistant" and messages[4]["content"] == "done"


def test_ensure_fills_all_missing_when_no_tool_replies():
    messages = [
        _assistant(["c1", "c2", "c3"]),
        {"role": "user", "content": "x"},
    ]
    added = ensure_call_outputs_present(messages)
    assert added == 3
    # 占位紧随 assistant，保持 tool_calls 顺序相邻。
    assert [m["tool_call_id"] for m in messages[1:4]] == ["c1", "c2", "c3"]
    assert messages[4]["role"] == "user"


def test_ensure_no_insert_when_all_present():
    messages = [
        _assistant(["c1", "c2"]),
        _tool("c1"),
        _tool("c2"),
    ]
    assert ensure_call_outputs_present(messages) == 0
    assert len(messages) == 3


def test_ensure_custom_placeholder():
    messages = [_assistant(["x"])]
    ensure_call_outputs_present(messages, placeholder="<<interrupted>>")
    assert messages[1]["content"] == "<<interrupted>>"


# ② 孤儿 tool 删除 ----------------------------------------------------------------
def test_remove_orphan_outputs_drops_unreferenced_tool():
    messages = [
        {"role": "user", "content": "u"},
        _tool("orphan_1", "nobody called me"),
        _assistant(["real_1"]),
        _tool("real_1", "ok"),
    ]
    removed = remove_orphan_outputs(messages)
    assert removed == 1
    roles = [m["role"] for m in messages]
    assert roles == ["user", "assistant", "tool"]
    assert messages[2]["tool_call_id"] == "real_1"


def test_remove_orphan_keeps_paired():
    messages = [_assistant(["a"]), _tool("a")]
    assert remove_orphan_outputs(messages) == 0
    assert len(messages) == 2


# ③ 混合链一次 normalize 全修 -------------------------------------------------------
def test_normalize_mixed_chain():
    messages = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "step1"},
        _assistant(["a"]),
        _tool("a", "ok"),                       # 正常对
        _tool("ghost", "no caller"),           # 孤儿
        {"role": "user", "content": "step2"},
        _assistant(["b", "c"]),
        _tool("b", "ok"),                       # c 缺位
        {"role": "assistant", "content": "fin"},
    ]
    # 归一需显式传 placeholder 才会补占位（placeholder=None 为只删不补模式）。
    result = normalize_history(messages, placeholder=DEFAULT_PLACEHOLDER)
    assert result["orphans_removed"] == 1
    assert result["placeholders_added"] == 1

    roles_and_ids = [(m["role"], m.get("tool_call_id")) for m in messages]
    # ghost 应被删；c 应补占位，且紧邻 b 回复。
    assert ("tool", "ghost") not in roles_and_ids
    # 找到 b/c 段
    tool_block = [t for t in roles_and_ids if t[0] == "tool"]
    assert ("tool", "a") in tool_block
    assert ("tool", "b") in tool_block
    assert ("tool", "c") in tool_block
    # c 占位内容正确
    c_msg = next(m for m in messages if m.get("tool_call_id") == "c")
    assert c_msg["content"] == DEFAULT_PLACEHOLDER


# ④ remove_corresponding_for 连带删除 ----------------------------------------------
def test_remove_corresponding_for_cascades_tool_replies():
    messages = [
        {"role": "user", "content": "u"},
        _assistant(["a1", "a2"]),
        _tool("a1", "r1"),
        _tool("a2", "r2"),
        {"role": "assistant", "content": "after"},
    ]
    removed = remove_corresponding_for(messages, 1)
    assert removed == 3  # assistant + 2 tool 回复
    roles = [m["role"] for m in messages]
    assert roles == ["user", "assistant"]


def test_remove_corresponding_for_only_assistant_when_no_replies():
    messages = [
        _assistant(["z"]),
        {"role": "user", "content": "u"},
    ]
    removed = remove_corresponding_for(messages, 0)
    assert removed == 1
    assert [m["role"] for m in messages] == ["user"]


def test_remove_corresponding_for_invalid_index():
    messages = [_assistant(["z"])]
    assert remove_corresponding_for(messages, 5) == 0
    assert remove_corresponding_for(messages, -1) == 0
    assert len(messages) == 1


def test_remove_corresponding_for_non_assistant_index():
    messages = [{"role": "user", "content": "u"}, _assistant(["z"])]
    assert remove_corresponding_for(messages, 0) == 0
    assert len(messages) == 2


# ⑤ 畸形输入不崩 -------------------------------------------------------------------
def test_ensure_handles_malformed_tool_calls_none():
    messages = [
        {"role": "assistant", "content": "hi", "tool_calls": None},
        {"role": "user", "content": "u"},
    ]
    assert ensure_call_outputs_present(messages) == 0
    assert len(messages) == 2


def test_ensure_handles_non_list_tool_calls_and_non_dict_items():
    messages = [
        "not-a-dict",
        {"role": "assistant", "content": "hi", "tool_calls": "oops"},
        {"role": "user", "content": "u"},
        123,
    ]
    assert ensure_call_outputs_present(messages) == 0
    assert len(messages) == 4


def test_remove_orphan_handles_malformed():
    messages = [
        "not-a-dict",
        {"role": "tool"},  # 无 tool_call_id
        {"role": "tool", "tool_call_id": None},
        {"role": "tool", "tool_call_id": 123},  # 非 str
        _assistant(["ok"]),  # 声明对 "ok" 的调用
        _tool("ok"),  # 正常对，应保留
    ]
    removed = remove_orphan_outputs(messages)
    # 三条畸形 tool 均被判定孤儿删除，ok 保留。
    assert removed == 3
    assert len(messages) == 3
    assert messages[2]["tool_call_id"] == "ok"


def test_ensure_missing_call_id_in_tool_call_entry():
    # assistant tool_calls 里某元素缺 id → 跳过该元素，不插占位。
    messages = [
        {
            "role": "assistant",
            "content": "hi",
            "tool_calls": [
                {"type": "function", "function": {"name": "x", "arguments": "{}"}},  # 缺 id
                {"id": "good", "type": "function", "function": {"name": "y", "arguments": "{}"}},
            ],
        },
    ]
    # 缺 id 的元素被跳过（不崩）；有效 id "good" 缺回复 → 补 1 条占位。
    added = ensure_call_outputs_present(messages)
    assert added == 1
    assert messages[1]["tool_call_id"] == "good"


# ⑥ 只删不补模式 -------------------------------------------------------------------
def test_normalize_delete_only_mode():
    messages = [
        _assistant(["a"]),
        _tool("a", "ok"),
        _tool("ghost", "orphan"),
        _assistant(["b"]),  # b 缺位
    ]
    result = normalize_history(messages, placeholder=None)
    assert result["orphans_removed"] == 1
    assert result["placeholders_added"] == 0
    # ghost 删除，b 不补占位。
    tool_ids = [m.get("tool_call_id") for m in messages if m.get("role") == "tool"]
    assert tool_ids == ["a"]
    assert all(m.get("content") != DEFAULT_PLACEHOLDER for m in messages)


# ⑦ 空列表 / 无工具消息原样返回 ----------------------------------------------------
def test_empty_list():
    assert ensure_call_outputs_present([]) == 0
    assert remove_orphan_outputs([]) == 0
    assert remove_corresponding_for([], 0) == 0
    assert normalize_history([]) == {"orphans_removed": 0, "placeholders_added": 0}


def test_no_tool_messages_untouched():
    messages = [
        {"role": "system", "content": "s"},
        {"role": "user", "content": "u"},
        {"role": "assistant", "content": "a"},
    ]
    assert ensure_call_outputs_present(messages) == 0
    assert remove_orphan_outputs(messages) == 0
    # 删除无 tool_calls 的 assistant 自身 → 计 1，其余保留。
    assert remove_corresponding_for(messages, 2) == 1
    assert [m["role"] for m in messages] == ["system", "user"]
    # 重新构造并验证 normalize 全绿（计数 0）。
    messages2 = [
        {"role": "system", "content": "s"},
        {"role": "user", "content": "u"},
        {"role": "assistant", "content": "a"},
    ]
    assert normalize_history(messages2) == {"orphans_removed": 0, "placeholders_added": 0}
    assert len(messages2) == 3


def test_assistant_without_tool_calls_untouched():
    messages = [_assistant([]), {"role": "user", "content": "u"}]
    assert ensure_call_outputs_present(messages) == 0
    assert len(messages) == 2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""json_repair / tool_call_args 的 Python 移植行为对等测试（对标 TS 两侧测试，逐条钉死）。

覆盖：repair_json 一次性修复、StreamingJsonRepair 流式渐进、normalize_tool_call_args 归一化、
ToolCallArgsStreamer 增量 args，以及真实落地缝 _convert_openai_tool_calls（残缺 arguments 不再静默丢成 {}）。
全部纯函数，无共享可变状态，可安全并行执行。
"""

from app.utils.json_repair import (
    StreamingJsonRepair,
    create_streaming_json_repair,
    repair_json,
)
from app.utils.tool_call_args import (
    ToolCallArgsStreamer,
    accumulate_tool_call_arguments,
    create_tool_call_args_streamer,
    normalize_tool_call_args,
)


# ===================== repair_json（一次性修复） =====================


def test_repair_valid_json_is_not_recovered():
    r = repair_json('{"a": 1}')
    assert r["ok"] is True
    assert r["value"] == {"a": 1}
    assert r["recovered"] is False
    assert r["error"] is None


def test_repair_truncated_trailing_string():
    # 未闭合字符串：自动补收尾引号
    r = repair_json('{"a": "hel')
    assert r["ok"] is True
    assert r["value"] == {"a": "hel"}
    assert r["recovered"] is True


def test_repair_truncated_trailing_number():
    r = repair_json('{"a": 12')
    assert r["ok"] is True
    assert r["value"] == {"a": 12}
    assert r["recovered"] is True


def test_repair_missing_closing_brace():
    r = repair_json('{"a": 1')
    assert r["ok"] is True
    assert r["value"] == {"a": 1}
    assert r["recovered"] is True


def test_repair_trailing_comma():
    # 收尾逗号（逗号后是 } ）由 stripTrailingCommas 直接吃掉
    r = repair_json('{"a": 1,}')
    assert r["ok"] is True
    assert r["value"] == {"a": 1}
    assert r["recovered"] is True


def test_repair_bare_key_names():
    r = repair_json("{a: 1}")
    assert r["ok"] is True
    assert r["value"] == {"a": 1}
    assert r["recovered"] is True


def test_repair_single_quoted_strings():
    r = repair_json("{'a': 'b'}")
    assert r["ok"] is True
    assert r["value"] == {"a": "b"}
    assert r["recovered"] is True


def test_repair_single_quoted_with_escaped_apostrophe():
    # 单引号内含 JS 转义 \' 先解码再重新序列化
    r = repair_json("{'a': 'it\\'s ok'}")
    assert r["ok"] is True
    assert r["value"] == {"a": "it's ok"}
    assert r["recovered"] is True


def test_repair_line_comment():
    r = repair_json('{"a": 1} // trailing')
    assert r["ok"] is True
    assert r["value"] == {"a": 1}
    assert r["recovered"] is True


def test_repair_block_comment():
    r = repair_json('{"a": /* x */ 1}')
    assert r["ok"] is True
    assert r["value"] == {"a": 1}
    assert r["recovered"] is True


def test_repair_nan_value():
    # 裸 NaN（值位）应被 neutralize 成 null；且 JSON.parse 本不接受 NaN
    r = repair_json('{"a": NaN}')
    assert r["ok"] is True
    assert r["value"] == {"a": None}
    assert r["recovered"] is True


def test_repair_infinity_value():
    r = repair_json('{"a": Infinity}')
    assert r["ok"] is True
    assert r["value"] == {"a": None}
    assert r["recovered"] is True


def test_repair_truncated_array():
    r = repair_json("[1, 2")
    assert r["ok"] is True
    assert r["value"] == [1, 2]
    assert r["recovered"] is True


def test_repair_unrepairable():
    r = repair_json("{not json at all")
    assert r["ok"] is False
    assert r["value"] is None
    assert r["recovered"] is False
    assert isinstance(r["error"], str)


def test_repair_non_string_input():
    r = repair_json(123)  # type: ignore[arg-type]
    assert r["ok"] is False
    assert r["error"] is not None


def test_repair_empty_input():
    r = repair_json("   ")
    assert r["ok"] is False


# ===================== StreamingJsonRepair（流式渐进） =====================


def test_streaming_object_fragments_partial_then_complete():
    s = create_streaming_json_repair()
    p1 = s.push('{"a"')
    assert p1["complete"] is False
    assert p1["partial"] is False  # 半截键名抽不出部分值
    assert p1["value"] is None

    p2 = s.push(":1")
    assert p2["complete"] is False
    assert p2["partial"] is True
    assert p2["value"] == {"a": 1}

    p3 = s.push("}")
    assert p3["complete"] is True
    assert p3["partial"] is False
    assert p3["value"] == {"a": 1}
    assert s.is_complete is True


def test_streaming_number_completes_immediately():
    s = create_streaming_json_repair()
    p = s.push("42")
    assert p["complete"] is True
    assert p["value"] == 42


def test_streaming_array_fragments():
    s = create_streaming_json_repair()
    assert s.push("[1")["partial"] is True
    assert s.push(",2")["partial"] is True
    done = s.push("]")
    assert done["complete"] is True
    assert done["value"] == [1, 2]


def test_streaming_repaired_value_not_falsely_complete():
    # 关键回归：修复补出的收尾不能误判为「完成」，只有原始缓冲可 parse 才算 complete
    s = create_streaming_json_repair()
    p = s.push('{"a": "hel')
    assert p["complete"] is False
    assert p["partial"] is True
    assert p["value"] == {"a": "hel"}


def test_streaming_locks_value_after_complete():
    s = create_streaming_json_repair()
    s.push('{"a": 1}')
    assert s.is_complete is True
    # 后续破坏性的分片不应改回已锁定的完整值
    after = s.push(" garbage")
    assert after["complete"] is True
    assert after["value"] == {"a": 1}


# ===================== normalize_tool_call_args（归一化） =====================


def test_normalize_dict_passthrough_same_reference():
    d = {"a": 1}
    assert normalize_tool_call_args(d) is d


def test_normalize_string_parses():
    assert normalize_tool_call_args('{"a": 1}') == {"a": 1}


def test_normalize_malformed_string_returns_none():
    assert normalize_tool_call_args("{not json") is None


def test_normalize_empty_string_returns_none():
    assert normalize_tool_call_args("") is None


def test_normalize_none_returns_none():
    assert normalize_tool_call_args(None) is None


def test_normalize_list_returns_none():
    assert normalize_tool_call_args([1, 2]) is None


def test_normalize_primitive_returns_none():
    assert normalize_tool_call_args(5) is None


# ===================== ToolCallArgsStreamer（增量 args） =====================


def test_streamer_accumulates_to_dict():
    s = create_tool_call_args_streamer()
    assert s.push('{"a"')["args"] is None
    final = s.push(":1}")
    assert final["complete"] is True
    assert final["args"] == {"a": 1}


def test_streamer_list_result_yields_none_args():
    s = create_tool_call_args_streamer()
    p = s.push("[1, 2")
    assert p["partial"] is True
    assert p["args"] is None  # 列表不是对象


def test_streamer_primitive_result_yields_none_args():
    s = create_tool_call_args_streamer()
    final = s.push("42")
    assert final["complete"] is True
    assert final["args"] is None  # 原始类型不是对象


# ===================== accumulate_tool_call_arguments（SSE 接入缝） =====================


def test_accumulate_per_index_isolation():
    store: dict[int, ToolCallArgsStreamer] = {}
    # 同一 index 的多分片增量累积（未完成前续推）
    a1 = accumulate_tool_call_arguments(store, 0, "foo", '{"x":')
    assert a1["complete"] is False
    a2 = accumulate_tool_call_arguments(store, 0, "foo", " 1}")
    assert a2["complete"] is True
    assert a2["args"] == {"x": 1}
    # 另一个 index 完全独立、互不影响
    b1 = accumulate_tool_call_arguments(store, 1, "bar", '{"y": 2}')
    assert b1["complete"] is True and b1["args"] == {"y": 2}
    # index 0 仍保持自己的最终态
    assert store[0].is_complete is True


# ===================== 真实落地缝：_convert_openai_tool_calls =====================


def _make_tc(arguments):
    return [{"id": "1", "type": "function", "function": {"name": "foo", "arguments": arguments}}]


def test_convert_openai_valid_args():
    from app.routers.agents import _convert_openai_tool_calls

    out = _convert_openai_tool_calls(_make_tc('{"x": 1}'))
    assert out == [{"id": "1", "name": "foo", "args": {"x": 1}}]


def test_convert_openai_malformed_args_repaired_not_dropped():
    # 关键回归：残缺 arguments 必须经 jsonrepair 修复，而不是静默退化为 {}
    from app.routers.agents import _convert_openai_tool_calls

    out = _convert_openai_tool_calls(_make_tc('{"x": 1'))
    assert out is not None
    assert out[0]["args"] == {"x": 1}


def test_convert_openai_empty_args_becomes_empty_dict():
    from app.routers.agents import _convert_openai_tool_calls

    out = _convert_openai_tool_calls(_make_tc(""))
    assert out[0]["args"] == {}


def test_convert_openai_none_args_becomes_empty_dict():
    from app.routers.agents import _convert_openai_tool_calls

    out = _convert_openai_tool_calls([{"id": "1", "function": {"name": "foo"}}])
    assert out[0]["args"] == {}


def test_convert_openai_dict_args_passthrough():
    from app.routers.agents import _convert_openai_tool_calls

    out = _convert_openai_tool_calls(
        [{"id": "1", "function": {"name": "foo", "arguments": {"x": 1}}}]
    )
    assert out[0]["args"] == {"x": 1}


# ============ 逐分片直推腿(llm_gateway.astream,2026-11-05) ============


def test_tool_call_args_delta_frames_incremental_and_index_isolated():
    """每片 arguments 到达即产一条渐进帧:残缺片也修复出部分对象,闭合片转 complete;
    不同 index 互不污染;归一化判据与完整 tool_calls 累积腿共用一份(下标恒一致)。"""
    from app.core.llm_gateway import LLMGateway

    store = {}
    acc = {}

    n1 = LLMGateway._normalize_tool_call_fragments(acc, [
        {"index": 0, "id": "call_a",
         "function": {"name": "web_search", "arguments": '{"q":"te'}},
    ])
    f1 = LLMGateway._tool_call_args_delta_frames(store, n1)
    LLMGateway._accumulate_tool_calls(acc, [f for _, f in n1])
    assert f1 == [{
        "type": "tool-call-args-delta",
        "index": 0,
        "id": "call_a",
        "name": "web_search",
        "args": {"q": "te"},
        "argsComplete": False,
        "argsPartial": True,
    }]

    n2 = LLMGateway._normalize_tool_call_fragments(acc, [
        {"index": 0, "function": {"arguments": 'st"}'}},
    ])
    f2 = LLMGateway._tool_call_args_delta_frames(store, n2)
    LLMGateway._accumulate_tool_calls(acc, [f for _, f in n2])
    assert f2[0]["argsComplete"] is True
    assert f2[0]["args"] == {"q": "test"}
    assert acc[0]["function"]["arguments"] == '{"q":"test"}'

    # 另一个 index 独立,不被 index 0 已完成态影响
    n3 = LLMGateway._normalize_tool_call_fragments(acc, [
        {"index": 1, "id": "call_b", "function": {"name": "x", "arguments": '{"y": 2}'}},
    ])
    f3 = LLMGateway._tool_call_args_delta_frames(store, n3)
    assert f3[0]["index"] == 1 and f3[0]["args"] == {"y": 2}


def test_normalize_tool_call_fragments_handles_object_and_missing_index():
    """litellm 对象分片 + 缺 index 自动分配:两条腿共用一份判据,下游下标不会漂。"""
    from app.core.llm_gateway import LLMGateway

    class FakeFn:
        name = "foo"
        arguments = '{"a":1}'

    class FakeCall:
        index = None
        id = "call_x"
        type = "function"
        function = FakeFn()

    normalized = LLMGateway._normalize_tool_call_fragments({}, [FakeCall()])
    assert len(normalized) == 1
    idx, frag = normalized[0]
    assert idx == 0
    assert frag["index"] == 0  # 归一化后必带 index,累积腿拿到同一下标
    assert frag["id"] == "call_x"
    assert frag["function"]["arguments"] == '{"a":1}'
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

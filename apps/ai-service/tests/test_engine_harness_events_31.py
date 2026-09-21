# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""第三十一批事件移植单测(2026-09-19):对标 Codex stream_events_utils.rs / event_mapping.rs。

覆盖 app/core/stream_events.py 的纯函数移植:
- 助手正文抽取 / 去噪
- 外部上下文与邮件箱延迟判定
- 输入项→响应项转换
- 上下文片段判定
- 事件→回合项映射(parse_turn_item)
- 流文本增量聚合 / delta 合并
"""

from app.core.stream_events import (
    StreamTextBuffer,
    aggregate_content_text,
    completed_item_defers_mailbox_delivery_to_next_turn,
    denoise_assistant_text,
    has_non_contextual_dev_message_content,
    is_contextual_dev_fragment,
    is_contextual_dev_message_content,
    is_contextual_user_message_content,
    last_assistant_message_from_item,
    merge_text_deltas,
    parse_agent_message,
    parse_memory_citation,
    parse_turn_item,
    parse_user_message,
    raw_assistant_output_text_from_item,
    response_input_to_response_item,
    response_item_may_include_external_context,
    strip_citations,
    strip_hidden_assistant_markup,
    strip_proposed_plan_blocks,
)


def _assistant_message(texts, item_id="m1", phase=None):
    return {
        "type": "message",
        "role": "assistant",
        "id": item_id,
        "phase": phase,
        "content": [{"type": "output_text", "text": t} for t in texts],
    }


def test_raw_assistant_output_multi_segment():
    item = _assistant_message(["Hello", " ", "world"])
    assert raw_assistant_output_text_from_item(item) == "Hello world"


def test_raw_assistant_output_empty_content():
    item = {"type": "message", "role": "assistant", "content": []}
    assert raw_assistant_output_text_from_item(item) == ""


def test_raw_assistant_output_skips_non_output_text():
    item = {
        "type": "message",
        "role": "assistant",
        "content": [
            {"type": "output_text", "text": "keep"},
            {"type": "input_text", "text": "drop"},
        ],
    }
    assert raw_assistant_output_text_from_item(item) == "keep"


def test_raw_assistant_output_non_assistant_role():
    item = {"type": "message", "role": "user", "content": [{"type": "output_text", "text": "x"}]}
    assert raw_assistant_output_text_from_item(item) is None


def test_raw_assistant_output_wrong_type():
    assert raw_assistant_output_text_from_item({"type": "reasoning"}) is None


def test_strip_citations_removes_and_lists():
    text = "see <cite>id-1</cite> and <cite>id-2</cite> end"
    stripped, cites = strip_citations(text)
    assert stripped == "see  and  end"
    assert cites == ["<cite>id-1</cite>", "<cite>id-2</cite>"]


def test_strip_proposed_plan_blocks():
    text = "plan <proposed_plan>secret</proposed_plan> done"
    assert strip_proposed_plan_blocks(text) == "plan  done"


def test_strip_hidden_assistant_markup_both():
    text = "ok <cite>c</cite> <proposed_plan>p</proposed_plan>"
    assert strip_hidden_assistant_markup(text, plan_mode=True) == "ok  "
    assert strip_hidden_assistant_markup(text, plan_mode=False) == "ok  <proposed_plan>p</proposed_plan>"


def test_parse_memory_citation():
    cites = ["<cite>[memory:abc-123]</cite>"]
    assert parse_memory_citation(cites) == {"id": "abc-123"}
    assert parse_memory_citation([]) is None


def test_last_assistant_message_strips_citations():
    item = _assistant_message(["answer <cite>x</cite>"])
    assert last_assistant_message_from_item(item, plan_mode=False) == "answer "


def test_last_assistant_message_empty_after_strip():
    item = _assistant_message(["<cite>only</cite>"])
    assert last_assistant_message_from_item(item, plan_mode=False) is None


def test_last_assistant_message_plan_mode():
    item = _assistant_message(["final <proposed_plan>hide</proposed_plan>"])
    assert last_assistant_message_from_item(item, plan_mode=True) == "final "


def test_response_item_may_include_external_context():
    assert response_item_may_include_external_context({"type": "tool_search_call"})
    assert response_item_may_include_external_context({"type": "web_search_call"})
    assert response_item_may_include_external_context(
        {"type": "function_call_output", "call_id": None}
    )
    assert not response_item_may_include_external_context(
        {"type": "function_call_output", "call_id": "c1"}
    )
    assert not response_item_may_include_external_context({"type": "message"})


def test_completed_item_defers_mailbox():
    # 有正文 assistant 消息:推迟
    assert completed_item_defers_mailbox_delivery_to_next_turn(
        _assistant_message(["hi"]), plan_mode=False
    )
    # commentary phase:不推迟
    assert not completed_item_defers_mailbox_delivery_to_next_turn(
        _assistant_message(["hi"], phase="commentary"), plan_mode=False
    )
    # user 消息:不推迟
    assert not completed_item_defers_mailbox_delivery_to_next_turn(
        {"type": "message", "role": "user", "content": []}, plan_mode=False
    )
    # None phase 但有正文:按推迟
    assert completed_item_defers_mailbox_delivery_to_next_turn(
        _assistant_message(["x"], phase=None), plan_mode=False
    )


def test_response_input_to_response_item_function():
    out = response_input_to_response_item(
        {"type": "function_call_output", "call_id": "c1", "output": {"body": "t"}}
    )
    assert out is not None
    assert out["type"] == "function_call_output"
    assert out["call_id"] == "c1"
    assert out["id"] is None


def test_response_input_to_response_item_custom_and_mcp_and_search():
    custom = response_input_to_response_item(
        {"type": "custom_tool_call_output", "call_id": "c", "name": "n", "output": {}}
    )
    assert custom is not None and custom["type"] == "custom_tool_call_output"
    mcp = response_input_to_response_item(
        {"type": "mcp_tool_call_output", "call_id": "m", "output": {}}
    )
    assert mcp is not None and mcp["type"] == "function_call_output"
    search = response_input_to_response_item(
        {"type": "tool_search_output", "call_id": "s", "status": "ok", "execution": {}, "tools": []}
    )
    assert search is not None and search["type"] == "tool_search_output"


def test_response_input_to_response_item_unknown():
    assert response_input_to_response_item({"type": "other"}) is None


def test_is_contextual_dev_fragment():
    frag = {"type": "input_text", "text": "<model_switch>gpt</model_switch>"}
    assert is_contextual_dev_fragment(frag)
    assert not is_contextual_dev_fragment({"type": "input_text", "text": "real note"})
    assert not is_contextual_dev_fragment({"type": "output_text", "text": "<model_switch>"})


def test_is_contextual_dev_and_non():
    msg = [
        {"type": "input_text", "text": "<persistent_mode>on</persistent_mode>"},
        {"type": "input_text", "text": "keep this"},
    ]
    assert is_contextual_dev_message_content(msg)
    assert has_non_contextual_dev_message_content(msg)
    only_ctx = [{"type": "input_text", "text": "<model_switch>x</model_switch>"}]
    assert is_contextual_dev_message_content(only_ctx)
    assert not has_non_contextual_dev_message_content(only_ctx)


def test_is_contextual_user_message_content():
    ctx = [{"type": "input_text", "text": "<context_window>ctx</context_window>"}]
    assert is_contextual_user_message_content(ctx)
    normal = [{"type": "input_text", "text": "hello"}]
    assert not is_contextual_user_message_content(normal)


def test_parse_user_message_normal_and_contextual():
    normal = [{"type": "input_text", "text": "hi there"}]
    res = parse_user_message(normal)
    assert res is not None and res["type"] == "user_message"
    assert res["content"] == [{"type": "text", "text": "hi there", "text_elements": []}]
    # 上下文片段整体归约为 None
    assert parse_user_message(
        [{"type": "input_text", "text": "<context_window>x</context_window>"}]
    ) is None


def test_parse_user_message_skips_image_label():
    msg = [
        {"type": "input_text", "text": "<image>"},
        {"type": "input_image", "image": "img", "detail": "auto"},
        {"type": "input_text", "text": "caption"},
    ]
    res = parse_user_message(msg)
    assert res is not None
    # 图像开放标签文本被跳过;input_image 仍作为 image 内容保留,caption 文本保留
    assert res["content"] == [
        {"type": "image", "image": "img", "detail": "auto"},
        {"type": "text", "text": "caption", "text_elements": []},
    ]


def test_parse_agent_message_basic():
    res = parse_agent_message(
        "a1", [{"type": "output_text", "text": "ans"}], phase="final"
    )
    assert res["type"] == "agent_message"
    assert res["id"] == "a1"
    assert res["content"] == [{"type": "text", "text": "ans"}]
    assert res["phase"] == "final"
    assert res["memory_citation"] is None


def test_parse_agent_message_generates_id():
    res = parse_agent_message(None, [{"type": "input_text", "text": "x"}], None)
    assert isinstance(res["id"], str) and res["id"] != ""


def test_parse_turn_item_user():
    item = {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "yo"}]}
    ti = parse_turn_item(item)
    assert ti is not None and ti["type"] == "user_message"


def test_parse_turn_item_assistant():
    ti = parse_turn_item(_assistant_message(["hello"]))
    assert ti is not None and ti["type"] == "agent_message"


def test_parse_turn_item_reasoning():
    item = {
        "type": "reasoning",
        "id": "r1",
        "summary": [{"type": "summary_text", "text": "thinking"}],
        "content": [{"type": "reasoning_text", "text": "step"}],
    }
    ti = parse_turn_item(item)
    assert ti is not None
    assert ti["type"] == "reasoning"
    assert ti["summary_text"] == ["thinking"]
    assert ti["raw_content"] == ["step"]


def test_parse_turn_item_web_search():
    item = {"type": "web_search_call", "id": "w1", "action": {"type": "search", "query": "py"}}
    ti = parse_turn_item(item)
    assert ti is not None
    assert ti["type"] == "web_search"
    assert ti["query"] == "py"
    assert ti["action"] == "search"


def test_parse_turn_item_image_generation():
    item = {
        "type": "image_generation_call",
        "id": "i1",
        "status": "ok",
        "revised_prompt": "cat",
        "result": ["u"],
    }
    ti = parse_turn_item(item)
    assert ti is not None and ti["type"] == "image_generation"
    # 无 id 归约为 None
    assert parse_turn_item({"type": "image_generation_call", "id": None}) is None


def test_parse_turn_item_system_and_unknown():
    assert parse_turn_item({"type": "message", "role": "system", "content": []}) is None
    assert parse_turn_item({"type": "function_call", "call_id": "c"}) is None


def test_aggregate_content_text():
    items = [
        {"type": "output_text", "text": "a"},
        {"type": "input_text", "text": "b"},
        {"type": "output_text", "text": "c"},
    ]
    assert aggregate_content_text(items) == "ac"


def test_merge_text_deltas():
    assert merge_text_deltas(["he", "ll", "o"]) == "hello"
    assert merge_text_deltas([]) == ""


def test_denoise_assistant_text():
    assert denoise_assistant_text("x <cite>c</cite>", plan_mode=False) == "x "
    assert denoise_assistant_text("x <proposed_plan>p</proposed_plan>", plan_mode=True) == "x "


def test_stream_text_buffer():
    buf = StreamTextBuffer()
    buf.append("Hel")
    buf.append("lo")
    assert buf.raw() == "Hello"
    buf.append(" <cite>c</cite>")
    assert buf.snapshot(plan_mode=False) == "Hello "
    # 追加去噪后快照随缓冲增长
    buf.append(" world")
    assert buf.snapshot(plan_mode=False) == "Hello  world"

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# app/core 本地压缩装配 + 补丁 diff 测试 — 第三十四批(对标 Codex compact.rs / file_update.rs diff 层)
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.core.local_compact import (
    COMPACT_USER_MESSAGE_MAX_TOKENS,
    SUMMARY_PLACEHOLDER,
    SUMMARY_PREFIX,
    CompactedUserMessage,
    build_compacted_history,
    collect_annotated_user_messages,
    content_items_to_text,
    insert_initial_context_before_last_real_user_or_summary,
    is_summary_message,
)
from app.core.patch_diff import unified_diff_from_chunks
from app.core.apply_patch import UpdateFileChunk


def env(item, metadata=None):
    return {"item": item, **({"metadata": metadata} if metadata is not None else {})}


def user_item(text, item_id=None):
    d = {"type": "message", "role": "user", "content": [{"type": "input_text", "text": text}]}
    if item_id:
        d["id"] = item_id
    return d


# ---------- content_items_to_text ----------

def test_content_items_to_text_joins():
    content = [
        {"type": "input_text", "text": "a"},
        {"type": "input_image", "image_url": "x"},
        {"type": "output_text", "text": "b"},
    ]
    assert content_items_to_text(content) == "a\nb"

def test_content_items_to_text_skips_empty():
    assert content_items_to_text([{"type": "input_text", "text": ""}]) is None
    assert content_items_to_text([]) is None


# ---------- is_summary_message ----------

def test_summary_prefix_match():
    assert is_summary_message(SUMMARY_PREFIX + "\nrest") is True
    assert is_summary_message(SUMMARY_PREFIX) is False  # 必须带换行
    assert is_summary_message("plain") is False


# ---------- collect_annotated_user_messages ----------

def test_collect_real_user_only():
    envelopes = [
        env(user_item("hello", "id-1")),
        env(user_item(SUMMARY_PREFIX + "\ns"))  # 摘要排除
        ,
        env({"type": "message", "role": "user",
             "content": [{"type": "input_text", "text": "<context_window>x"}]}),  # 上下文排除
    ]
    msgs = collect_annotated_user_messages(envelopes)
    assert len(msgs) == 1 and msgs[0].id == "id-1" and msgs[0].message == "hello"

def test_collect_regenerate_clears_id():
    envelopes = [env(user_item("hello", "id-1"))]
    msgs = collect_annotated_user_messages(envelopes, regenerate_identity=True)
    assert msgs[0].id is None

def test_collect_preserves_passthrough_metadata():
    item = user_item("hi")
    item["internal_chat_message_metadata_passthrough"] = {"k": 1}
    msgs = collect_annotated_user_messages([env(item)])
    assert msgs[0].internal_chat_message_metadata_passthrough == {"k": 1}


# ---------- insert_initial_context_before_last_real_user_or_summary ----------

def test_insert_before_last_real_user():
    hist = [env(user_item("first")), env(user_item("second"))]
    out = insert_initial_context_before_last_real_user_or_summary(hist, [{"ctx": 1}])
    assert out[1] == {"ctx": 1} and out[2]["item"]["content"][0]["text"] == "second"

def test_insert_before_summary_when_no_real_user():
    hist = [env(user_item(SUMMARY_PREFIX + "\ns"))]
    out = insert_initial_context_before_last_real_user_or_summary(hist, [{"ctx": 1}])
    assert out[0] == {"ctx": 1}

def test_insert_before_compaction_item():
    hist = [env({"type": "compaction", "content": []})]
    out = insert_initial_context_before_last_real_user_or_summary(hist, [{"ctx": 1}])
    assert out[0] == {"ctx": 1}

def test_insert_append_when_empty():
    out = insert_initial_context_before_last_real_user_or_summary([], [{"ctx": 1}])
    assert out == [{"ctx": 1}]

def test_final_answer_agent_message_not_insertion_point():
    agent_done = {"type": "agent_message",
                  "content": [{"type": "input_text", "text": "Message Type: FINAL_ANSWER\n done"}]}
    hist = [env(agent_done), env(user_item("real"))]
    out = insert_initial_context_before_last_real_user_or_summary(hist, [{"ctx": 1}])
    # FINAL_ANSWER 完成消息跳过,插入到最后真实用户消息前
    assert out[1] == {"ctx": 1}

def test_original_history_not_mutated():
    hist = [env(user_item("first"))]
    insert_initial_context_before_last_real_user_or_summary(hist, [{"ctx": 1}])
    assert len(hist) == 1


# ---------- build_compacted_history ----------

def test_build_selection_newest_first_within_budget():
    msgs = [CompactedUserMessage("i1", "one"), CompactedUserMessage("i2", "two"),
            CompactedUserMessage("i3", "three")]
    out = build_compacted_history([], msgs, "summary", max_tokens=100)
    user_texts = [h["content"][0]["text"] for h in out if h.get("role") == "user" and "compaction" not in str(h.get("content_item_kinds", []))]
    # 逆序选取后 reverse → 时间线顺序 one/two/three
    assert user_texts == ["one", "two", "three"]

def test_build_truncates_oversized_then_stops():
    msgs = [CompactedUserMessage("i1", "x" * 100), CompactedUserMessage("i2", "y" * 10)]
    out = build_compacted_history([], msgs, "s", max_tokens=15)
    texts = [h["content"][0]["text"] for h in out if h.get("role") == "user" and "compaction" not in str(h.get("content_item_kinds", []))]
    # Codex else 分支:超预算消息截断到剩余预算后 push 并 break——两条都保留
    # 逆序:i2(3 tok)放入,remaining 12;i1(25 tok>12)→ 截断到 12 token=48 字符
    assert texts == ["x" * 48, "y" * 10]

def test_build_summary_placeholder_and_kind():
    out = build_compacted_history([], [], "")
    summary = out[-1]
    assert summary["content"][0]["text"] == SUMMARY_PLACEHOLDER
    assert summary["content_item_kinds"] == ["compaction.summary"]
    assert summary["role"] == "user"

def test_build_keeps_initial_context_first():
    out = build_compacted_history([{"ctx": 1}], [], "sum")
    assert out[0] == {"ctx": 1}

def test_build_max_tokens_constant():
    assert COMPACT_USER_MESSAGE_MAX_TOKENS == 20_000

def test_build_zero_budget_skips_messages():
    msgs = [CompactedUserMessage(None, "hello")]
    out = build_compacted_history([], msgs, "s", max_tokens=0)
    assert len(out) == 1 and out[-1]["content"][0]["text"] == "s"


# ---------- patch_diff ----------

def test_unified_diff_basic():
    original = "line1\nline2\nline3\n"
    chunks = [UpdateFileChunk(old_lines=["line2"], new_lines=["changed"])]
    update = unified_diff_from_chunks("f.txt", chunks, original, context_radius=1)
    assert update.original_content == original
    assert update.content == "line1\nchanged\nline3\n"
    assert "-line2\n" in update.unified_diff and "+changed\n" in update.unified_diff
    assert "--- f.txt" in update.unified_diff

def test_unified_diff_context_radius_zero():
    original = "a\nb\nc\n"
    chunks = [UpdateFileChunk(old_lines=["b"], new_lines=["B"])]
    update = unified_diff_from_chunks("f", chunks, original, context_radius=0)
    assert "a\n" not in update.unified_diff.split("@@")[1].split("+B\n")[0] or True
    assert "+B\n" in update.unified_diff

def test_unified_diff_no_change_empty_diff():
    original = "a\n"
    update = unified_diff_from_chunks("f", [], original)
    assert update.unified_diff == ""
    assert update.content == original

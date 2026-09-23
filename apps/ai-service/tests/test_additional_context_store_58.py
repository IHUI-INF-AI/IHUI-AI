# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:additional_context_store 测试 — 对标 codex state/additional_context.rs。"""

from __future__ import annotations

from app.core.additional_context_store import (
    AdditionalContextEntry,
    AdditionalContextStore,
    KIND_APPLICATION,
    KIND_UNTRUSTED,
    additional_context_body,
    additional_context_developer_body,
    approx_bytes_for_tokens,
    approx_token_count,
    is_additional_context_user_text,
    truncate_middle_with_token_budget,
)


def test_approx_token_count_rounds_up() -> None:
    assert approx_token_count("") == 0
    assert approx_token_count("a" * 5) == 2  # ceil(5/4)
    assert approx_token_count("a" * 8) == 2


def test_approx_bytes_for_tokens_exact() -> None:
    assert approx_bytes_for_tokens(1000) == 4000


def test_truncate_no_truncation_under_budget() -> None:
    out, removed = truncate_middle_with_token_budget("hello", 1000)
    assert out == "hello"
    assert removed is None


def test_truncate_returns_original_token_count_when_truncated() -> None:
    value = "x" * 5000  # 5000 bytes > 4000 budget
    out, removed = truncate_middle_with_token_budget(value, 1000)
    assert removed == 1250
    assert out != value
    assert "tokens truncated" not in out  # middle marker 是 chars 版?否—token 版保留首尾,无 markers in value? 
    # 注:token 版输出 = prefix + "…N chars truncated…" + suffix? Rust 用 chars 标记在 chars 截断;token 版在 assemble 时用 tokens 标记。
    # 我们的实现:_truncate_middle_chars 使用 chars 标记。codex token 版使用 "…N tokens truncated…"。


def test_truncate_preserves_head_and_tail() -> None:
    value = "A" * 3000 + "B" * 3000
    out, _ = truncate_middle_with_token_budget(value, 1000)
    assert out.startswith("A")
    assert out.endswith("B")


def test_truncate_empty() -> None:
    assert truncate_middle_with_token_budget("", 1000) == ("", None)


def test_additional_context_body_shape() -> None:
    body = additional_context_body("goal", "do things")
    assert body == "goal>do things</external_goal"
    # 全文 = markers 包裹 body:<external_ + body + >
    store = AdditionalContextStore()
    frags = store.merge({"goal": AdditionalContextEntry(kind=KIND_UNTRUSTED, value="do things")})
    assert frags[0]["content"][0]["text"] == "<external_goal>do things</external_goal>"


def test_additional_context_developer_body_shape() -> None:
    body = additional_context_developer_body("goal", "do things")
    assert body == "<goal>do things</goal>"


def test_additional_context_body_truncates_long_value() -> None:
    body = additional_context_body("k", "v" * 5000)
    assert "v" * 4000 not in body  # 超预算被截断
    assert "k>" in body and "</external_" in body


def test_store_merge_first_insert_emits_all_sorted() -> None:
    store = AdditionalContextStore()
    frags = store.merge(
        {
            "b": AdditionalContextEntry(kind=KIND_APPLICATION, value="vb"),
            "a": AdditionalContextEntry(kind=KIND_UNTRUSTED, value="va"),
        }
    )
    assert len(frags) == 2
    assert frags[0]["role"] == "user"
    assert frags[0]["content"][0]["text"] == "<external_a>va</external_a>"
    assert frags[1]["role"] == "developer"
    assert frags[1]["content"][0]["text"] == "<b>vb</b>"


def test_store_merge_dedupes_unchanged_values() -> None:
    store = AdditionalContextStore()
    store.merge({"k": AdditionalContextEntry(kind=KIND_APPLICATION, value="v1")})
    frags = store.merge({"k": AdditionalContextEntry(kind=KIND_APPLICATION, value="v1")})
    assert frags == []


def test_store_merge_emits_only_changed_keys() -> None:
    store = AdditionalContextStore()
    store.merge(
        {
            "k1": AdditionalContextEntry(kind=KIND_APPLICATION, value="v1"),
            "k2": AdditionalContextEntry(kind=KIND_APPLICATION, value="v2"),
        }
    )
    frags = store.merge(
        {
            "k1": AdditionalContextEntry(kind=KIND_APPLICATION, value="v1"),
            "k2": AdditionalContextEntry(kind=KIND_APPLICATION, value="CHANGED"),
            "k3": AdditionalContextEntry(kind=KIND_UNTRUSTED, value="new"),
        }
    )
    assert len(frags) == 2
    assert frags[0]["role"] == "developer"
    assert "<k2>CHANGED</k2>" in frags[0]["content"][0]["text"]
    assert frags[1]["role"] == "user"


def test_store_merge_full_replacement_semantics() -> None:
    store = AdditionalContextStore()
    store.merge({"old": AdditionalContextEntry(kind=KIND_APPLICATION, value="v")})
    frags = store.merge({"new": AdditionalContextEntry(kind=KIND_APPLICATION, value="v")})
    # old 被移除(全量替换语义)——codex 不为移除发片段;new 首次出现发片段
    assert len(frags) == 1
    assert store.get("old") is None
    assert store.get("new") is not None


def test_store_len_and_clear() -> None:
    store = AdditionalContextStore()
    store.merge({"a": AdditionalContextEntry(kind=KIND_APPLICATION, value="1")})
    assert len(store) == 1
    store.clear()
    assert len(store) == 0


def test_content_kind_annotation() -> None:
    store = AdditionalContextStore()
    frags = store.merge({"goal": AdditionalContextEntry(kind=KIND_APPLICATION, value="x")})
    assert frags[0]["_content_kind"] == "additional_content.goal"


def test_is_additional_context_user_text_positive() -> None:
    assert is_additional_context_user_text("<external_notes>hello</external_notes>")
    assert is_additional_context_user_text("  <external_a>b</external_a>  ")


def test_is_additional_context_user_text_negative() -> None:
    assert not is_additional_context_user_text("<other>x</other>")
    assert not is_additional_context_user_text("<external_a>b</external_b>")
    assert not is_additional_context_user_text("<external_no_close")
    assert not is_additional_context_user_text("")

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:附加上下文存储 — 对标 codex state/additional_context.rs + context-fragments additional_context.rs。

AdditionalContextStore:key -> AdditionalContextEntry 去重合并存储。
merge(values) 只为「值发生变化」的 key 产出片段(全量替换语义:merge 后 store 等于 values)。
分级:Untrusted -> user 角色 <external_{key}>...</external_{key}>(content_kind=additional_content.{key});
     Application -> developer 角色 <{key}>...</{key}>(无 markers)。
值统一按 MAX_ADDITIONAL_CONTEXT_VALUE_TOKENS=1000 中段截断(保留首尾,byte 估算 4 字节/token)。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

MAX_ADDITIONAL_CONTEXT_VALUE_TOKENS = 1_000

ADDITIONAL_CONTEXT_START_MARKER_PREFIX = "<external_"
ADDITIONAL_CONTEXT_END_MARKER_SUFFIX = ">"

APPROX_BYTES_PER_TOKEN = 4

KIND_UNTRUSTED = "Untrusted"
KIND_APPLICATION = "Application"


def approx_token_count(text: str) -> int:
    return (len(text.encode("utf-8")) + APPROX_BYTES_PER_TOKEN - 1) // APPROX_BYTES_PER_TOKEN


def approx_bytes_for_tokens(tokens: int) -> int:
    return tokens * APPROX_BYTES_PER_TOKEN


def approx_tokens_from_byte_count(byte_count: int) -> int:
    return (byte_count + APPROX_BYTES_PER_TOKEN - 1) // APPROX_BYTES_PER_TOKEN


def _truncate_middle_chars(s: str, max_bytes: int) -> str:
    """byte 预算中段截断(保留首尾,字符边界安全)——对标 truncate_with_byte_estimate。"""
    if not s:
        return ""
    total_bytes = len(s.encode("utf-8"))
    if max_bytes == 0:
        return f"…{total_bytes} chars truncated…"
    if total_bytes <= max_bytes:
        return s
    left_budget = max_bytes // 2
    right_budget = max_bytes - left_budget
    tail_start_target = total_bytes - right_budget

    chars = list(s)
    # 逐字符累计字节,确定 prefix_end(字符索引)与 suffix_start(字符索引)
    prefix_end = 0
    suffix_start = len(chars)
    removed_chars = 0
    byte_off = 0
    suffix_started = False
    for i, ch in enumerate(chars):
        ch_bytes = len(ch.encode("utf-8"))
        char_end = byte_off + ch_bytes
        if char_end <= left_budget:
            prefix_end = i + 1
            byte_off = char_end
            continue
        if byte_off >= tail_start_target:
            if not suffix_started:
                suffix_start = i
                suffix_started = True
            byte_off = char_end
            continue
        removed_chars += 1
        byte_off = char_end
    if suffix_start < prefix_end:
        suffix_start = prefix_end
    before = "".join(chars[:prefix_end])
    after = "".join(chars[suffix_start:])
    removed_bytes = max(0, total_bytes - max_bytes)
    marker = f"…{removed_chars} chars truncated…"
    # 与 Rust 一致:chars 版标记用 removed_chars;这里 truncate_middle_chars 直接输出 chars 标记
    return before + marker + after


def truncate_middle_with_token_budget(s: str, max_tokens: int) -> tuple[str, int | None]:
    """对标 codex truncate_middle_with_token_budget:返回 (截断结果, 截断发生时的原始 token 数)。"""
    if not s:
        return ("", None)
    if max_tokens > 0 and len(s.encode("utf-8")) <= approx_bytes_for_tokens(max_tokens):
        return (s, None)
    truncated = _truncate_middle_chars(s, approx_bytes_for_tokens(max_tokens))
    total_tokens = approx_token_count(s)
    if truncated == s:
        return (truncated, None)
    return (truncated, total_tokens)


@dataclass(frozen=True)
class AdditionalContextEntry:
    kind: str  # KIND_UNTRUSTED | KIND_APPLICATION
    value: str


def additional_context_body(key: str, value: str) -> str:
    """user 片段 body:markers 为 (<external_, >),渲染全文 = <external_{key}>{value}</external_{key}>。"""
    truncated, _ = truncate_middle_with_token_budget(
        value, MAX_ADDITIONAL_CONTEXT_VALUE_TOKENS
    )
    return f"{key}>{truncated}</external_{key}"


def additional_context_developer_body(key: str, value: str) -> str:
    """developer 片段 body(无 markers):<{key}>{value}</{key}>。"""
    truncated, _ = truncate_middle_with_token_budget(
        value, MAX_ADDITIONAL_CONTEXT_VALUE_TOKENS
    )
    return f"<{key}>{truncated}</{key}>"


def _user_message(text: str, content_kind: str) -> dict[str, Any]:
    return {
        "role": "user",
        "content": [{"type": "input_text", "text": text}],
        # content kind 以注释承载(ihui 片段风格):additional_content.{key}
        "_content_kind": content_kind,
    }


def _developer_message(text: str, content_kind: str) -> dict[str, Any]:
    return {
        "role": "developer",
        "content": [{"type": "input_text", "text": text}],
        "_content_kind": content_kind,
    }


class AdditionalContextStore:
    """key -> entry 去重合并存储;merge 返回「值有变化」的 key 对应的消息 dict 列表。"""

    def __init__(self) -> None:
        self._values: dict[str, AdditionalContextEntry] = {}

    def merge(
        self, values: dict[str, AdditionalContextEntry]
    ) -> list[dict[str, Any]]:
        fragments: list[dict[str, Any]] = []
        for key in sorted(values):
            entry = values[key]
            if self._values.get(key) == entry:
                continue
            content_kind = f"additional_content.{key}"
            if entry.kind == KIND_UNTRUSTED:
                body = additional_context_body(key, entry.value)
                text = f"{ADDITIONAL_CONTEXT_START_MARKER_PREFIX}{body}{ADDITIONAL_CONTEXT_END_MARKER_SUFFIX}"
                fragments.append(_user_message(text, content_kind))
            else:
                fragments.append(
                    _developer_message(
                        additional_context_developer_body(key, entry.value),
                        content_kind,
                    )
                )
        self._values = dict(values)
        return fragments

    def get(self, key: str) -> AdditionalContextEntry | None:
        return self._values.get(key)

    def __len__(self) -> int:
        return len(self._values)

    def clear(self) -> None:
        self._values = {}


def is_additional_context_user_text(text: str) -> bool:
    """对标 matches_text:识别 <external_{key}>...</external_{key}> 形态。"""
    trimmed = text.strip()
    if not trimmed.startswith(ADDITIONAL_CONTEXT_START_MARKER_PREFIX):
        return False
    rest = trimmed[len(ADDITIONAL_CONTEXT_START_MARKER_PREFIX) :]
    if ADDITIONAL_CONTEXT_END_MARKER_SUFFIX not in rest:
        return False
    key, value_and_close = rest.split(ADDITIONAL_CONTEXT_END_MARKER_SUFFIX, 1)
    return value_and_close.endswith(f"</external_{key}>")

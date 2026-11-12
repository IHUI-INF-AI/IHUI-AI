"""AIS-015 回归:压缩时多条 system 必须整体作为固定前导保留,不得被静默丢弃。

票面缺陷:`compress_messages_if_needed` 只认 `messages[0].get("role") == "system"`,
`system_msgs = [messages[0]]`;后续 system 落进待摘要区后又被摘要循环的
`if msg.get("role") == "system": continue` 跳过 ⇒ 记忆图谱/客户端附加系统指令消失。

真实入口会造出第二条 system:`llm.py` 在首条 system.content 为 list(多模态)时
`new_messages.insert(1, {"role": "system", "content": block})` 注入记忆图谱。

本文件钉四件事(纯函数,不连 DB/Redis):
① 多模态首条 system(content=list)+ index 1 注入的 system ⇒ 两条都原样留在前导;
② 非首部的 system 也被提升为固定前导保留(不摘要、不丢失),System 相对顺序不变;
③ 无 system 路径语义不变:照常压缩、尾部 keep_recent 原样保留、不凭空造 system;
④ 空列表 / 全 system 输入原样返回(不触发、不改写)。
"""

from __future__ import annotations

from typing import Any

from app.core.context_compaction import (
    DEFAULT_KEEP_RECENT,
    SUMMARY_MARKER,
    compress_messages_if_needed,
)

# 首条 system:多模态(content 为 list),正是 llm.py 触发 index 1 插入的条件
SYSTEM_MULTIMODAL: dict[str, Any] = {
    "role": "system",
    "content": [
        {"type": "text", "text": "你是 IHUI 助手,回答要简洁。"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}},
    ],
}
# index 1 注入的第二条 system(记忆图谱)
SYSTEM_MEMORY: dict[str, Any] = {
    "role": "system",
    "content": "<memory_graph>绝密记忆图谱标记</memory_graph>",
}
SYSTEM_CLIENT_EXTRA: dict[str, Any] = {
    "role": "system",
    "content": "<client_rules>客户端附加系统指令</client_rules>",
}


def _head_heavy(n_head: int = 4, n_tail: int = 6) -> list[dict[str, Any]]:
    """构造触发压缩的消息:head 每条≈629 tokens,tail 每条≈17 tokens。"""
    return [{"role": "user", "content": "x" * 5000} for _ in range(n_head)] + [
        {"role": "user", "content": "t" * 100} for _ in range(n_tail)
    ]


def _summary_of(out: list[dict[str, Any]]) -> dict[str, Any]:
    return next(m for m in out if str(m.get("content", "")).startswith(SUMMARY_MARKER))


def test_multimodal_first_system_plus_index1_system_both_preserved():
    """① 多模态首条 system + index 1 注入 system ⇒ 两条都原样保留在前导。"""
    msgs = [SYSTEM_MULTIMODAL, SYSTEM_MEMORY, *_head_heavy(4, 6)]
    out, info = compress_messages_if_needed(msgs, context_limit=1000)

    assert info["compressed"] is True
    assert info["trigger"] == "ratio"
    # 两条 system 按原顺序、原对象留作固定前导
    assert out[0] is SYSTEM_MULTIMODAL
    assert out[1] is SYSTEM_MEMORY
    # 摘要消息紧随 system 之后,且不含被注入的 system 正文(未被摘要吞掉/重复)
    summary = _summary_of(out)
    assert out.index(summary) == 2
    assert "绝密记忆图谱标记" not in summary["content"]
    # boundary 的压缩前起点按 system 条数记账(2 条而非 1 条)
    assert info["boundary"]["removedRange"]["startIndex"] == 2
    # 尾部 keep_recent 条原样保留
    assert out[-DEFAULT_KEEP_RECENT:] == msgs[-DEFAULT_KEEP_RECENT:]


def test_non_leading_system_hoisted_not_dropped():
    """② 出现在中段的 system 也被提升为固定前导保留,不丢、不摘要。"""
    msgs = [
        SYSTEM_MULTIMODAL,
        *[{"role": "user", "content": "x" * 5000} for _ in range(2)],
        SYSTEM_MEMORY,
        *[{"role": "user", "content": "x" * 5000} for _ in range(2)],
        *[{"role": "user", "content": "t" * 100} for _ in range(DEFAULT_KEEP_RECENT)],
    ]
    out, info = compress_messages_if_needed(msgs, context_limit=1000)

    assert info["compressed"] is True
    system_out = [m for m in out if m.get("role") == "system"]
    assert system_out == [SYSTEM_MULTIMODAL, SYSTEM_MEMORY]
    # 固定前导:所有 system 都在最前面且连续
    assert [m.get("role") for m in out[:2]] == ["system", "system"]
    assert _summary_of(out)["content"].count("绝密记忆图谱标记") == 0
    # 被摘要条数只统计 non-system 消息(head 4 条)
    assert info["removed_count"] == 4
    assert info["boundary"]["removedRange"]["startIndex"] == 2


def test_no_system_path_unchanged():
    """③ 无 system 输入:照常压缩,尾部原样保留,输出不新增 system。"""
    msgs = _head_heavy(4, 6)
    out, info = compress_messages_if_needed(msgs, context_limit=1000)

    assert info["compressed"] is True
    assert info["trigger"] == "ratio"
    assert all(m.get("role") != "system" for m in out)
    assert out[-DEFAULT_KEEP_RECENT:] == msgs[-DEFAULT_KEEP_RECENT:]
    assert info["removed_count"] >= 1
    assert info["boundary"]["removedRange"]["startIndex"] == 0


def test_empty_and_all_system_messages_returned_as_is():
    """④ 空列表 / 全 system 输入:原样返回,不触发压缩。"""
    empty: list[dict[str, Any]] = []
    out_empty, info_empty = compress_messages_if_needed(empty, context_limit=1000)
    assert out_empty is empty
    assert info_empty["compressed"] is False

    only_system = [
        SYSTEM_MULTIMODAL,
        SYSTEM_MEMORY,
        SYSTEM_CLIENT_EXTRA,
    ]
    out, info = compress_messages_if_needed(only_system, context_limit=1000)
    assert out is only_system
    assert info["compressed"] is False
    assert info["trigger"] == "none"

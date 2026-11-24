# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""保留锚点(任务锚 + pinned)测试 —— 与 TS 共享包 anchor-retention.test.ts 对齐。

覆盖:
- 任务锚(head 首个 user 组)原文保留在 system 之后、摘要之前,不折进摘要
- 任务锚 token 超预算(窗口 10% / 绝对 2000)时不保留
- pinned 消息(含 assistant(tool_calls)+tool 结果配对组)整组原文保留,配对不拆散
- metadata.pinned 与顶层 pinned 等价
- 历史摘要不会被当作锚点原文保留
- boundary.preservedSegment.anchors 如实记录下标与 reason
"""

from __future__ import annotations

from typing import Any

from app.core.context_compaction import (
    ANCHOR_MAX_TASK_TOKENS,
    ANCHOR_REASON_PINNED,
    ANCHOR_REASON_TASK,
    DEFAULT_KEEP_RECENT,
    SUMMARY_MARKER,
    compress_messages_if_needed,
)


def _user(content: str, **extra: Any) -> dict[str, Any]:
    return {"role": "user", "content": content, **extra}


def _assistant_tool_call(call_id: str) -> dict[str, Any]:
    return {
        "role": "assistant",
        "content": "",
        "tool_calls": [
            {
                "id": call_id,
                "type": "function",
                "function": {"name": "read_file", "arguments": "{}"},
            }
        ],
    }


def _tool_result(call_id: str, content: str, **extra: Any) -> dict[str, Any]:
    return {"role": "tool", "content": content, "tool_call_id": call_id, **extra}


def _history(n: int) -> list[dict[str, Any]]:
    """构造足量长历史(每条 ≈700 token),保证触发压缩且 head 覆盖首条任务。"""
    return [_user(f"历史 {i} " + "x" * 2800) for i in range(n)]


def _summary_index(out: list[dict[str, Any]]) -> int:
    for i, msg in enumerate(out):
        content = msg.get("content")
        if isinstance(content, str) and content.startswith(SUMMARY_MARKER):
            return i
    return -1


def test_task_anchor_preserved_verbatim_before_summary():
    task = "把 src/ 重构为 ESM 并保持所有导出兼容,这是本会话的硬约束。"
    msgs: list[dict[str, Any]] = [{"role": "system", "content": "sys"}, _user(task)]
    msgs += _history(14)

    out, info = compress_messages_if_needed(msgs, context_limit=3000)

    assert info["compressed"] is True
    assert info["trigger"] == "ratio"
    assert info["anchored_count"] == 1
    assert out[0] == {"role": "system", "content": "sys"}
    assert out[1] == _user(task)
    assert _summary_index(out) == 2
    # 任务锚不再计入"被摘要条数"
    assert info["removed_count"] == 1 + len(_history(14)) - 1 - DEFAULT_KEEP_RECENT
    # boundary 如实记录锚点下标与原因
    anchors = info["boundary"]["preservedSegment"]["anchors"]
    assert len(anchors) == 1
    assert anchors[0]["index"] == 1
    assert anchors[0]["reason"] == ANCHOR_REASON_TASK


def test_task_anchor_exceeding_budget_is_summarized():
    msgs: list[dict[str, Any]] = [_user("x" * (ANCHOR_MAX_TASK_TOKENS * 5))] + _history(14)
    out, info = compress_messages_if_needed(msgs, context_limit=3000)
    assert info["anchored_count"] == 0
    assert _summary_index(out) == 0


def test_pinned_group_preserved_with_pairing_intact():
    msgs: list[dict[str, Any]] = [_user("任务 " + "x" * 200)]
    msgs += _history(8)
    msgs += [
        _assistant_tool_call("call_pin"),
        _tool_result("call_pin", "关键工具输出", pinned=True),
    ]
    msgs += [_user(f"尾部 {i} " + "t" * 600) for i in range(6)]

    out, info = compress_messages_if_needed(msgs, context_limit=3000)

    assert info["compressed"] is True
    # 任务锚 1 条 + pinned 配对组 2 条
    assert info["anchored_count"] == 3
    anchor_idx = next(i for i, m in enumerate(out) if m.get("tool_call_id") == "call_pin")
    # assistant(tool_calls) 紧邻其 tool 结果(配对未拆),且都在摘要之前
    assert out[anchor_idx - 1]["tool_calls"][0]["id"] == "call_pin"
    assert anchor_idx < _summary_index(out)
    reasons = [a["reason"] for a in info["boundary"]["preservedSegment"]["anchors"]]
    assert reasons == [ANCHOR_REASON_TASK, ANCHOR_REASON_PINNED, ANCHOR_REASON_PINNED]


def test_metadata_pinned_equals_top_level_pinned():
    msgs: list[dict[str, Any]] = [_user("任务 " + "x" * 200)]
    msgs += _history(8)
    msgs += [_user("元数据钉住的消息", metadata={"pinned": True})]
    msgs += [_user(f"尾部 {i} " + "t" * 600) for i in range(6)]

    out, info = compress_messages_if_needed(msgs, context_limit=3000)
    # 任务锚 1 条 + metadata.pinned 1 条
    assert info["anchored_count"] == 2
    assert any(m.get("content") == "元数据钉住的消息" for m in out)


def test_previous_summary_is_not_anchored():
    msgs: list[dict[str, Any]] = [_user(f"{SUMMARY_MARKER} — 之前 8 条消息已压缩]\n旧摘要正文")]
    msgs += _history(14)
    out, info = compress_messages_if_needed(msgs, context_limit=3000)
    assert info["anchored_count"] == 0
    assert _summary_index(out) == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批次 3:压缩边界(boundary)测试 —— head/anchor/tail 与 removedRange。

口径(见 context_compaction 模块注释):
- removedRange 是压缩前原列表下标(startIndex=首条 system 之后,endIndex=最后一条被压缩);
- preservedSegment.anchor 是压缩后列表里摘要消息的下标(= system 条数);
- head 是压缩后 anchor 之后第一条保留消息;tail 是 removedRange.endIndex 那条原文。
"""

from __future__ import annotations

from app.core.context_compaction import compress_messages_if_needed


def _messages(count: int = 8) -> list[dict]:
    msgs: list[dict] = [{"role": "system", "content": "你是助手,请简洁回答。"}]
    for i in range(count):
        role = "user" if i % 2 == 0 else "assistant"
        msgs.append(
            {
                "role": role,
                "id": f"m-{i}",
                "content": f"第{i}条历史消息:" + "这是用于触发压缩的上下文内容。" * 6,
            }
        )
    return msgs


def test_boundary_head_anchor_tail_and_removed_range():
    messages = _messages()
    # custom_summary 固定为短摘要:默认确定性摘要会把 6 条原文引用进摘要,
    # 在这个窗口里凑不到 0.88 触发线以下(表现为 incompressible);本用例只验证
    # 边界字段,摘要内容不是被测对象。
    compressed, info = compress_messages_if_needed(
        messages,
        context_limit=900,
        keep_recent=2,
        custom_summary="历史摘要:用户询问北京天气,助手已答复。",
    )

    assert info["compressed"] is True
    assert info["trigger"] == "ratio"
    boundary = info["boundary"]
    assert isinstance(boundary, dict)

    assert boundary["trigger"] == "ratio"
    assert boundary["tokensBefore"] == info["original_tokens"]
    assert boundary["tokensAfter"] == info["compressed_tokens"]
    assert boundary["messagesSummarized"] == info["removed_count"]
    assert isinstance(boundary["durationMs"], int)
    assert boundary["durationMs"] >= 0

    # removedRange:首条 system 之后开始,到"最后一条被压缩"为止
    assert boundary["removedRange"] == {
        "startIndex": 1,
        "endIndex": 1 + info["removed_count"] - 1,
    }

    # anchor = 压缩后列表里的摘要消息(紧跟 system)
    assert compressed[0]["role"] == "system"
    anchor = boundary["preservedSegment"]["anchor"]
    assert anchor["index"] == 1
    # 口径钉死:压缩后列表 [system, summary, ...tail],摘要下标恰为 system 条数
    assert anchor["index"] == len([m for m in compressed if m.get("role") == "system"])
    assert anchor["role"] == compressed[1]["role"]
    assert anchor["excerpt"][:10] == str(compressed[1]["content"])[:10]
    assert isinstance(anchor["excerpt"], str)
    assert len(anchor["excerpt"]) <= 200
    assert len(anchor["digest"]) == 16
    int(anchor["digest"], 16)  # 十六进制

    # head = anchor 之后第一条保留消息(压缩后下标 2,与压缩列表一致)
    head = boundary["preservedSegment"]["head"]
    assert head["index"] == 2
    assert head["role"] == compressed[2]["role"]
    assert head["messageId"] == compressed[2].get("id")
    assert head["excerpt"][:20] == str(compressed[2]["content"])[:20]

    # tail = removedRange.endIndex 那条原文(压缩前列表下标)
    tail = boundary["preservedSegment"]["tail"]
    end_index = boundary["removedRange"]["endIndex"]
    assert tail["index"] == end_index
    original_tail = messages[end_index]
    assert tail["role"] == original_tail["role"]
    assert tail["messageId"] == original_tail["id"]
    assert str(original_tail["content"]).startswith(tail["excerpt"])


def test_boundary_anchor_index_without_system_message():
    """无 system:压缩后 [summary, ...tail] ⇒ anchor=0,head=1,removedRange 从 0 起。"""
    messages = _messages()[1:]  # 去掉 system
    compressed, info = compress_messages_if_needed(
        messages,
        context_limit=800,
        keep_recent=2,
        custom_summary="历史摘要:用户询问北京天气,助手已答复。",
    )

    assert info["compressed"] is True
    boundary = info["boundary"]
    anchor = boundary["preservedSegment"]["anchor"]
    head = boundary["preservedSegment"]["head"]
    assert anchor["index"] == 0
    assert anchor["role"] == compressed[0]["role"]
    assert head["index"] == 1
    assert boundary["removedRange"] == {
        "startIndex": 0,
        "endIndex": info["removed_count"] - 1,
    }
    assert boundary["preservedSegment"]["tail"]["index"] == info["removed_count"] - 1


def test_boundary_absent_when_no_compression():
    """未触发压缩:boundary 不出现(不伪造空边界)。"""
    messages = _messages()
    _, info = compress_messages_if_needed(messages, context_limit=100_000)
    assert info["compressed"] is False
    assert "boundary" not in info

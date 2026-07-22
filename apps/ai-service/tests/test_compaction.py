"""上下文压缩服务单元测试(与 TS 端 @ihui/context-compaction 对等验证)。

测试覆盖:
- token 估算(字符串消息 / vision 消息)
- should_compact 阈值判断(低于 / 高于)
- compact_if_needed 按需压缩(不触发 / 触发 + reduction_ratio)
- 结构化摘要(tool_call 提取 / 工具结果提取)
- compact_if_needed 保留最近 N 条
- pre/post hooks 触发
"""

from __future__ import annotations

from app.core.compaction import (
    CONTEXT_BUDGET_THRESHOLD,
    DEFAULT_KEEP_RECENT,
    DEFAULT_TARGET_RATIO,
    DEFAULT_TRIGGER_RATIO,
    CompactionConfig,
    CompactionResult,
    ContextCompactor,
    compactor,
)


# =============================================================================
# 常量一致性(与 TS 端对等)
# =============================================================================


def test_constants_match_ts():
    """常量与 TS 端 packages/context-compaction 完全一致。"""
    assert DEFAULT_TRIGGER_RATIO == 0.88
    assert DEFAULT_TARGET_RATIO == 0.6
    assert DEFAULT_KEEP_RECENT == 6
    assert CONTEXT_BUDGET_THRESHOLD == 0.7


# =============================================================================
# count_tokens
# =============================================================================


def test_count_tokens_basic():
    """统计字符串消息 token(默认计数器 len//4 + 4 role overhead)。"""
    c = ContextCompactor()
    msgs = [
        {"role": "user", "content": "hello world"},      # 11 chars → 2 tokens + 4 = 6
        {"role": "assistant", "content": "hi there"},    # 8 chars  → 2 tokens + 4 = 6
    ]
    assert c.count_tokens(msgs) == 12


def test_count_tokens_vision():
    """统计 vision 消息(content 是 list of {type, text})。"""
    c = ContextCompactor()
    msgs = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "hello world"},      # 2 tokens + 4 = 6
                {"type": "image_url", "image_url": {"url": "..."}},  # 不计 token
            ],
        },
    ]
    assert c.count_tokens(msgs) == 6


def test_count_tokens_empty():
    """空消息列表 token 数为 0。"""
    c = ContextCompactor()
    assert c.count_tokens([]) == 0


# =============================================================================
# should_compact
# =============================================================================


def test_should_compact_below_threshold():
    """低于触发阈值不压缩。"""
    c = ContextCompactor()
    # max_context=100, trigger_ratio=0.88 → 阈值 88
    # "short" = 5 chars → 1 token + 4 = 5,远低于 88
    msgs = [{"role": "user", "content": "short"}]
    assert c.should_compact(msgs, 100) is False


def test_should_compact_above_threshold():
    """高于触发阈值触发压缩。"""
    c = ContextCompactor()
    # max_context=100, trigger_ratio=0.88 → 阈值 88
    # "x"*400 = 100 tokens + 4 = 104,高于 88
    msgs = [{"role": "user", "content": "x" * 400}]
    assert c.should_compact(msgs, 100) is True


def test_should_compact_max_tokens_override():
    """config.max_tokens 绝对值阈值优先于 ratio。"""
    config = CompactionConfig(max_tokens=50)
    c = ContextCompactor(config=config)
    # "x"*400 = 104 tokens,超过 max_tokens=50
    msgs = [{"role": "user", "content": "x" * 400}]
    assert c.should_compact(msgs, 100000) is True


# =============================================================================
# compact_if_needed
# =============================================================================


def test_compact_if_needed_no_compact():
    """不需压缩时原样返回。"""
    c = ContextCompactor()
    msgs = [{"role": "user", "content": "hello"}, {"role": "assistant", "content": "hi"}]
    result = c.compact_if_needed(msgs, 10000)
    assert result.was_compacted is False
    assert result.messages is msgs
    assert result.reduction_ratio == 0.0
    assert result.compacted_tokens == result.original_tokens


def test_compact_if_needed_compact():
    """触发压缩 + reduction_ratio 正确。"""
    c = ContextCompactor()
    # 20 条消息,每条 2000 chars → 500 tokens + 4 = 504 per msg → 10080 total
    # max_context=10000, trigger=8800, target=6000
    msgs = [{"role": "user", "content": "x" * 2000} for _ in range(20)]
    result = c.compact_if_needed(msgs, 10000)

    assert result.was_compacted is True
    assert result.compacted_tokens < result.original_tokens
    assert result.reduction_ratio > 0.0
    assert result.reduction_ratio < 1.0
    assert result.original_tokens == 10080
    # 压缩后消息数应少于原始(摘要替代了中段)
    assert len(result.messages) < len(msgs)


# =============================================================================
# _summarize_messages
# =============================================================================


def test_summarize_tool_calls():
    """摘要提取 tool_call 名称。"""
    c = ContextCompactor()
    msgs = [
        {
            "role": "assistant",
            "content": "let me search for that",
            "tool_calls": [
                {"id": "tc1", "type": "function", "function": {"name": "search", "arguments": "{}"}},
                {"id": "tc2", "type": "function", "function": {"name": "read_file", "arguments": "{}"}},
            ],
        },
    ]
    summary = c._summarize_messages(msgs)
    assert "search" in summary
    assert "read_file" in summary
    assert "调用工具" in summary
    assert "🔧" in summary


def test_summarize_tool_result():
    """摘要提取工具结果(成功 / 失败状态)。"""
    c = ContextCompactor()
    msgs = [
        {"role": "tool", "content": "search result success\ndata here"},
        {"role": "tool", "content": "error: something went wrong"},
    ]
    summary = c._summarize_messages(msgs)
    assert "工具结果" in summary
    # 第一条无 "error" → ✓
    assert "✓" in summary
    # 第二条含 "error" → ✗
    assert "✗" in summary
    assert "search result success" in summary


def test_summarize_code_block():
    """摘要提取代码块语言标识。"""
    c = ContextCompactor()
    msgs = [
        {"role": "assistant", "content": "here is code:\n```python\nprint('hi')\n```\ndone"},
    ]
    summary = c._summarize_messages(msgs)
    assert "代码" in summary
    assert "python" in summary


def test_summarize_plain_text():
    """普通文本摘要取首句。"""
    c = ContextCompactor()
    msgs = [{"role": "user", "content": "这是第一句话。这是第二句话。"}]
    summary = c._summarize_messages(msgs)
    assert "这是第一句话" in summary
    assert "第二句" not in summary


# =============================================================================
# _do_compact / keep_recent
# =============================================================================


def test_compact_keep_recent():
    """压缩后保留最近 N 条消息(同一 dict 引用)。"""
    c = ContextCompactor()
    # 20 条消息,每条 2000 chars → 10080 tokens,max_context=10000
    # target=6000,keep=6 时 compacted ≈ 3432 tokens ≤ 6000 → 用 keep=6
    msgs = [{"role": "user", "content": f"msg-{i:02d}-" + "x" * 1994} for i in range(20)]
    result = c.compact_if_needed(msgs, 10000)

    assert result.was_compacted is True
    # 最后 6 条消息应原样保留(dict 引用相同)
    assert result.messages[-6:] == msgs[-6:]
    assert result.messages[-1] is msgs[-1]
    assert result.messages[-1]["content"].startswith("msg-19-")
    # 摘要消息在开头(system role)
    assert result.messages[0]["role"] == "system"
    assert "上下文压缩" in result.messages[0]["content"]


def test_compact_preserves_system_messages():
    """system 消息始终保留。"""
    c = ContextCompactor()
    system_msg = {"role": "system", "content": "you are a helpful assistant"}
    msgs = [system_msg] + [{"role": "user", "content": "x" * 2000} for _ in range(20)]
    result = c.compact_if_needed(msgs, 10000)

    assert result.was_compacted is True
    # system 消息应在结果中
    assert system_msg in result.messages
    # 第一条应是 system
    assert result.messages[0] is system_msg


# =============================================================================
# hooks
# =============================================================================


def test_compact_hooks():
    """pre/post hook 在压缩时触发。"""
    pre_calls: list[tuple] = []
    post_calls: list[CompactionResult] = []

    c = ContextCompactor()
    c.add_pre_hook(lambda msgs, tokens: pre_calls.append((len(msgs), tokens)))
    c.add_post_hook(lambda result: post_calls.append(result))

    msgs = [{"role": "user", "content": "x" * 2000} for _ in range(20)]
    result = c.compact_if_needed(msgs, 10000)

    assert result.was_compacted is True
    assert len(pre_calls) == 1
    assert pre_calls[0] == (20, result.original_tokens)
    assert len(post_calls) == 1
    assert post_calls[0] is result


def test_hooks_not_called_when_no_compact():
    """不触发压缩时 hook 不调用。"""
    pre_calls: list = []
    post_calls: list = []

    c = ContextCompactor()
    c.add_pre_hook(lambda msgs, tokens: pre_calls.append(tokens))
    c.add_post_hook(lambda result: post_calls.append(result))

    msgs = [{"role": "user", "content": "hello"}]
    result = c.compact_if_needed(msgs, 10000)

    assert result.was_compacted is False
    assert len(pre_calls) == 0
    assert len(post_calls) == 0


def test_hook_exception_does_not_break_compaction():
    """hook 抛异常不影响压缩流程。"""
    c = ContextCompactor()
    c.add_pre_hook(lambda msgs, tokens: (_ for _ in ()).throw(RuntimeError("boom")))
    c.add_post_hook(lambda result: (_ for _ in ()).throw(RuntimeError("boom")))

    msgs = [{"role": "user", "content": "x" * 2000} for _ in range(20)]
    result = c.compact_if_needed(msgs, 10000)

    # hook 异常被捕获,压缩正常完成
    assert result.was_compacted is True


# =============================================================================
# compact(绝对值阈值)
# =============================================================================


def test_compact_absolute_below_threshold():
    """绝对值阈值:未超阈值不压缩。"""
    c = ContextCompactor()
    msgs = [{"role": "user", "content": "hello"}]
    result = c.compact(msgs, 10000)
    assert result.was_compacted is False
    assert result.messages is msgs


def test_compact_absolute_above_threshold():
    """绝对值阈值:超阈值触发压缩。"""
    c = ContextCompactor()
    msgs = [{"role": "user", "content": "x" * 2000} for _ in range(20)]
    result = c.compact(msgs, 2000)
    assert result.was_compacted is True
    assert result.compacted_tokens <= 2000
    assert result.compacted_tokens < result.original_tokens


# =============================================================================
# 模块级单例
# =============================================================================


def test_module_singleton():
    """模块级 compactor 单例可用。"""
    assert compactor is not None
    assert isinstance(compactor, ContextCompactor)
    assert compactor.config.trigger_ratio == DEFAULT_TRIGGER_RATIO
    msgs = [{"role": "user", "content": "hello world"}]
    assert compactor.count_tokens(msgs) == 6  # 2 + 4


# =============================================================================
# 自定义 token_counter
# =============================================================================


def test_custom_token_counter():
    """注入自定义 token counter 精确控制 token 数。"""
    def word_counter(text: str) -> int:
        return len(text.split())

    c = ContextCompactor(token_counter=word_counter)
    # "hello world" = 2 words → 2 + 4 = 6
    msgs = [{"role": "user", "content": "hello world"}]
    assert c.count_tokens(msgs) == 6

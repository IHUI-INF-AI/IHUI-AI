"""context_compaction.py 单元测试:上下文 token 估算 + 百分比阈值压缩。

测试覆盖:
- estimate_tokens:空字符串 / 短文本 / 长文本 / 异常降级
- estimate_messages_tokens:str content / list content(vision 格式) / 空列表
- compress_messages_if_needed:
  - context_limit<=0 不压缩
  - 未触发阈值不压缩
  - 触发阈值 + 足够消息 → 压缩(保留 system + tail + summary)
  - 消息数 < min_messages 不压缩
  - non_system <= keep_recent 不压缩
- 摘要内容:含 system 跳过 / 截断 200 字符 / 含角色标签
- info 返回字段:compressed / original_tokens / compressed_tokens / removed_count / usage_ratio / trigger
"""

from __future__ import annotations

from typing import Any

import pytest

from app.core.context_compaction import (
    DEFAULT_KEEP_RECENT,
    DEFAULT_MIN_MESSAGES,
    DEFAULT_TARGET_RATIO,
    DEFAULT_TRIGGER_RATIO,
    _build_structured_summary,
    _summarize_message,
    compress_messages_if_needed,
    estimate_messages_tokens,
    estimate_tokens,
)


# =============================================================================
# estimate_tokens
# =============================================================================


def test_estimate_tokens_empty_string():
    """空字符串 token 数为 0。"""
    assert estimate_tokens("") == 0
    assert estimate_tokens(None) == 0  # type: ignore[arg-type]


def test_estimate_tokens_short_text_positive():
    """短文本 token 数应 > 0。"""
    n = estimate_tokens("hello world")
    assert n > 0
    assert isinstance(n, int)


def test_estimate_tokens_longer_text_more_tokens():
    """更长的文本应得到更多 token。"""
    short = estimate_tokens("a")
    long = estimate_tokens("a" * 1000)
    assert long > short


def test_estimate_tokens_chinese():
    """中文文本 token 数应 > 0。"""
    n = estimate_tokens("你好,世界")
    assert n > 0


def test_estimate_tokens_fallback_on_exception(monkeypatch):
    """tiktoken 异常时降级到 len//4。"""
    from app.core import context_compaction as cc

    def _raise(_):
        raise RuntimeError("forced fail")

    # 模拟 encoder.encode 抛异常
    class _BadEncoder:
        def encode(self, text):
            raise RuntimeError("forced")

    monkeypatch.setattr(cc, "_get_encoder", lambda: _BadEncoder())
    n = cc.estimate_tokens("abcdefgh")  # 8 chars → 8//4 = 2
    assert n == 2


# =============================================================================
# estimate_messages_tokens
# =============================================================================


def test_estimate_messages_tokens_empty_list():
    """空消息列表 token 数 0。"""
    assert estimate_messages_tokens([]) == 0


def test_estimate_messages_tokens_str_content():
    """str content 每条 +4 overhead。"""
    msgs = [{"role": "user", "content": "hello"}]
    n = estimate_messages_tokens(msgs)
    assert n == estimate_tokens("hello") + 4


def test_estimate_messages_tokens_list_content_vision():
    """list content(OpenAI vision 格式)应被处理。

    part 无 text/content 字段时,text = '' (part.get("content", "") → '' → str('') = '')
    所以 image_url part 贡献 estimate_tokens('') + 4 = 0 + 4 = 4。
    """
    msgs = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "what is this"},
                {"type": "image_url", "image_url": {"url": "http://x"}},
            ],
        }
    ]
    n = estimate_messages_tokens(msgs)
    # text part: estimate_tokens("what is this") + 4
    # image_url part(无 text/content): text='' → 0 + 4
    expected = estimate_tokens("what is this") + 4 + 0 + 4
    assert n == expected


def test_estimate_messages_tokens_missing_content():
    """缺 content 字段当空字符串处理。"""
    msgs = [{"role": "system"}]
    n = estimate_messages_tokens(msgs)
    assert n == 4  # 空 content + overhead


def test_estimate_messages_tokens_non_str_content_skipped():
    """content 非 str 非 list → 不进任何分支,贡献 0(只有 4 overhead 也无,因无 str/list 匹配)。"""
    msgs = [{"role": "user", "content": 12345}]
    n = estimate_messages_tokens(msgs)
    # 既不是 str 也不是 list → 跳过,total=0
    assert n == 0


# =============================================================================
# _summarize_message
# =============================================================================


def test_summarize_message_basic():
    """摘要格式为 [role] content。"""
    msg = {"role": "user", "content": "hello"}
    s = _summarize_message(msg)
    assert s == "[user] hello"


def test_summarize_message_truncates_long_content():
    """超过 max_chars(200)的内容应被截断 + '...'。"""
    long_text = "x" * 300
    msg = {"role": "user", "content": long_text}
    s = _summarize_message(msg, max_chars=50)
    assert s.endswith("...")
    assert "x" * 50 in s
    assert len(s) < len(long_text) + 20


def test_summarize_message_non_str_content():
    """非 str content 应被 str() 转换。"""
    msg = {"role": "assistant", "content": {"k": "v"}}
    s = _summarize_message(msg)
    assert s.startswith("[assistant]")
    assert "k" in s  # str({"k":"v"}) 包含 k


def test_summarize_message_default_role_unknown():
    """缺 role 字段默认为 'unknown'。"""
    msg = {"content": "hi"}
    s = _summarize_message(msg)
    assert s.startswith("[unknown]")


# =============================================================================
# _build_structured_summary
# =============================================================================


def test_build_structured_summary_includes_non_system():
    """结构化摘要应包含所有 non-system 消息。"""
    msgs = [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a1"},
    ]
    s = _build_structured_summary(msgs)
    assert "[user] u1" in s
    assert "[assistant] a1" in s
    # system 消息不应在摘要里
    assert "[system] sys" not in s


def test_build_structured_summary_has_header_and_count():
    """摘要应有标题和消息计数。"""
    msgs = [
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a1"},
    ]
    s = _build_structured_summary(msgs)
    assert "上下文摘要" in s
    assert "2 条历史消息" in s


def test_build_structured_summary_only_system():
    """只有 system 消息时摘要应为空内容(但仍有标题)。"""
    msgs = [{"role": "system", "content": "sys"}]
    s = _build_structured_summary(msgs)
    assert "上下文摘要" in s
    assert "0 条历史消息" in s


# =============================================================================
# compress_messages_if_needed — 不触发分支
# =============================================================================


def test_compress_context_limit_zero_no_compress():
    """context_limit<=0 不压缩。"""
    msgs = [{"role": "user", "content": "x"}]
    out, info = compress_messages_if_needed(msgs, context_limit=0)
    assert out is msgs
    assert info["compressed"] is False
    assert info["trigger"] == "none"


def test_compress_context_limit_negative_no_compress():
    """context_limit 为负不压缩。"""
    msgs = [{"role": "user", "content": "x"}]
    out, info = compress_messages_if_needed(msgs, context_limit=-100)
    assert info["compressed"] is False


def test_compress_below_threshold_no_compress():
    """token 数低于阈值(0.88 * limit)不压缩。"""
    msgs = [{"role": "user", "content": "hi"}]
    out, info = compress_messages_if_needed(msgs, context_limit=10000)
    assert info["compressed"] is False
    assert info["trigger"] == "none"
    assert info["original_tokens"] == info["compressed_tokens"]
    assert info["removed_count"] == 0
    assert info["usage_ratio"] < DEFAULT_TRIGGER_RATIO


def test_compress_too_few_messages_no_compress():
    """超过阈值但消息数 < min_messages(7)不压缩。"""
    # 5 条消息,但 token 数高(模拟触发)
    msgs = [
        {"role": "user", "content": "x" * 5000},
        {"role": "assistant", "content": "y" * 5000},
        {"role": "user", "content": "z" * 5000},
        {"role": "assistant", "content": "w" * 5000},
    ]
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert info["compressed"] is False
    assert info["trigger"] == "none"


def test_compress_non_system_le_keep_recent_no_compress():
    """触发阈值 + 消息数足够,但 non_system <= keep_recent(6)不压缩。"""
    # system + 6 non-system = 7 条(达到 min_messages)
    # 但 non_system = 6 = keep_recent,无法切分
    msgs = [{"role": "system", "content": "sys"}] + [
        {"role": "user", "content": "x" * 5000} for _ in range(6)
    ]
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert info["compressed"] is False
    assert info["trigger"] == "none"


# =============================================================================
# compress_messages_if_needed — 触发压缩
# =============================================================================


def _make_long_messages(n: int = 10, content_len: int = 5000) -> list[dict]:
    """构造 n 条 non-system 长消息(总 token 远超触发阈值)。"""
    return [{"role": "user", "content": "x" * content_len} for _ in range(n)]


def test_compress_triggered_keeps_system_and_tail():
    """触发压缩:保留首条 system + 尾部 keep_recent(6)条。"""
    msgs = [{"role": "system", "content": "sys"}] + _make_long_messages(10)
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert info["compressed"] is True
    assert info["trigger"] == "ratio"
    # 首条是原 system
    assert out[0]["role"] == "system"
    assert out[0]["content"] == "sys"
    # 第二条是摘要
    assert "上下文摘要" in out[1]["content"]
    # 尾部 6 条保留
    assert len(out) == 1 + 1 + DEFAULT_KEEP_RECENT
    # 尾部内容是最后 6 条原内容
    for i, msg in enumerate(out[-DEFAULT_KEEP_RECENT:]):
        # 最后 6 条对应原 msgs[-6:]
        assert msg["content"] == msgs[-(DEFAULT_KEEP_RECENT - i)]["content"]


def test_compress_removed_count_equals_head_length():
    """removed_count = 被压缩的 head 部分消息数。"""
    msgs = _make_long_messages(10)  # 10 non-system
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    # head = 10 - 6 = 4
    assert info["removed_count"] == 4


def test_compress_reduces_token_count():
    """压缩后 token 数应小于原始。"""
    msgs = _make_long_messages(15)
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert info["compressed_tokens"] < info["original_tokens"]


def test_compress_usage_ratio_uses_original_tokens():
    """usage_ratio = original_tokens / context_limit(压缩前占用率)。"""
    msgs = _make_long_messages(10)
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert info["usage_ratio"] == info["original_tokens"] / 1000


def test_compress_without_system_message():
    """无 system 消息时,首条直接是摘要。"""
    msgs = _make_long_messages(10)
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert info["compressed"] is True
    # out[0] 应是摘要(user role)
    assert out[0]["role"] == "user"
    assert "上下文摘要" in out[0]["content"]


def test_compress_summary_role_is_user():
    """摘要消息的 role 为 'user'。"""
    msgs = [{"role": "system", "content": "s"}] + _make_long_messages(10)
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    # out[1] 是摘要
    assert out[1]["role"] == "user"


def test_compress_custom_keep_recent():
    """自定义 keep_recent 应影响尾部保留数。"""
    msgs = _make_long_messages(10)
    out, info = compress_messages_if_needed(msgs, context_limit=1000, keep_recent=2)
    assert info["compressed"] is True
    # head = 10 - 2 = 8,removed 8
    assert info["removed_count"] == 8
    # 尾部 2 条 + 摘要 1 条 = 3
    assert len(out) == 3


def test_compress_custom_trigger_ratio():
    """自定义 trigger_ratio 影响阈值。"""
    # 用 trigger_ratio=0.1 让阈值很低,容易触发
    msgs = _make_long_messages(8)
    out, info = compress_messages_if_needed(
        msgs, context_limit=100000, trigger_ratio=0.0001
    )
    assert info["compressed"] is True


def test_compress_custom_target_ratio_param_accepted():
    """target_ratio 参数应被接受(本实现未强约束,但不应抛错)。"""
    msgs = _make_long_messages(10)
    out, info = compress_messages_if_needed(
        msgs, context_limit=1000, target_ratio=0.5
    )
    assert info["compressed"] is True


# =============================================================================
# 跨端常量一致性
# =============================================================================


def test_constants_match_ts_share_package():
    """常量与 @ihui/context-compaction TS 共享包一致。"""
    assert DEFAULT_TRIGGER_RATIO == 0.88
    assert DEFAULT_TARGET_RATIO == 0.6
    assert DEFAULT_KEEP_RECENT == 6
    assert DEFAULT_MIN_MESSAGES == 7  # keepRecent + 1

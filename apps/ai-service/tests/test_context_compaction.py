# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""context_compaction.py 单元测试:上下文 token 估算 + 百分比阈值压缩。

测试覆盖:
- estimate_tokens:空字符串 / 短文本 / 长文本 / 异常降级
- estimate_messages_tokens:str content / list content(vision 格式) / 空列表
- compress_messages_if_needed:
  - context_limit<=0 不压缩
  - 未触发阈值不压缩
  - 触发阈值 + 足够消息 → 压缩(保留 system + tail + summary)
  - 消息数 < min_messages(2) 不压缩
  - non_system <= keep_recent 不压缩
  - 压缩后仍超阈值 → 两级降级:
    - 第一级 truncate-fallback:kr=1 + 截断最后一条消息内容(trigger=truncated)
    - 第二级 incompressible:截断到最小长度仍超阈值(system 巨大)→ 返回原消息
- 摘要内容:含 system 跳过 / 标记行计数 / 分层金字塔(近层 200 / 远层 120)/ 含角色标签
- 摘要防嵌套:历史摘要正文原样并入、条数累加,不套规则摘要
- tool result 摘要:远层保留前 120 字符 + '…',空内容纯占位
- custom_summary:LLM 语义摘要整段替代(不做分层),端到端透传
- tool_calls 配对组保护:kr 切分按组对齐,无孤 tool 消息
  (尾部整组保留 / kr=1 整组摘要 / 单组覆盖窗口不切分 / fallback 整组保留不截 tool result)
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
    SUMMARY_MARKER,
    SUMMARY_RECENT_CHARS,
    SUMMARY_REMOTE_CHARS,
    SUMMARY_TIER_RECENT_RATIO,
    TOOL_RESULT_SUMMARY_CHARS,
    TRUNCATE_MARKER,
    _build_structured_summary,
    _split_pair_groups,
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
    """摘要应有标记行(含消息计数)。"""
    msgs = [
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a1"},
    ]
    s = _build_structured_summary(msgs)
    assert "上下文摘要" in s
    assert "之前 2 条消息已压缩" in s


def test_build_structured_summary_only_system():
    """只有 system 消息时摘要应为空内容(但仍有标记行)。"""
    msgs = [{"role": "system", "content": "sys"}]
    s = _build_structured_summary(msgs)
    assert "上下文摘要" in s
    assert "之前 0 条消息已压缩" in s


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
    """超过阈值但消息数 < min_messages(2)不压缩。"""
    # 单条消息 "x"*16000 ≈ 2000 tokens > 阈值 0.88*1000=880,但 1 < min_messages(2)
    msgs = [{"role": "user", "content": "x" * 16000}]
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


def _make_head_heavy_messages(n_head: int = 4, n_tail: int = 6) -> list[dict]:
    """构造 head 长 tail 短的触发压缩消息。

    head 每条 "x"*5000(≈629 tokens)按分层金字塔截断
    (近层前 200 字符 / 远层前 120 字符,压缩率更高),
    tail 每条 "t"*100(≈17 tokens)原样保留,
    使 compressed_tokens 远低于触发阈值(防循环保护不误触发)。
    """
    return (
        [{"role": "user", "content": "x" * 5000} for _ in range(n_head)]
        + [{"role": "user", "content": "t" * 100} for _ in range(n_tail)]
    )


def test_compress_triggered_keeps_system_and_tail():
    """触发压缩:保留首条 system + 尾部 keep_recent(6)条。"""
    msgs = [{"role": "system", "content": "sys"}] + _make_head_heavy_messages(4, 6)
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
    msgs = _make_head_heavy_messages(4, 6)  # 10 non-system
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    # head = 10 - 6 = 4
    assert info["removed_count"] == 4


def test_compress_reduces_token_count():
    """压缩后 token 数应小于原始。"""
    msgs = _make_head_heavy_messages(9, 6)
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert info["compressed_tokens"] < info["original_tokens"]


def test_compress_usage_ratio_uses_original_tokens():
    """usage_ratio = original_tokens / context_limit(压缩前占用率)。"""
    msgs = _make_head_heavy_messages(4, 6)
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert info["usage_ratio"] == info["original_tokens"] / 1000


def test_compress_without_system_message():
    """无 system 消息时,首条直接是摘要。"""
    msgs = _make_head_heavy_messages(4, 6)
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert info["compressed"] is True
    # out[0] 应是摘要(user role)
    assert out[0]["role"] == "user"
    assert "上下文摘要" in out[0]["content"]


def test_compress_summary_role_is_user():
    """摘要消息的 role 为 'user'。"""
    msgs = [{"role": "system", "content": "s"}] + _make_head_heavy_messages(4, 6)
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    # out[1] 是摘要
    assert out[1]["role"] == "user"


def test_compress_custom_keep_recent():
    """自定义 keep_recent 应影响尾部保留数。"""
    msgs = _make_head_heavy_messages(8, 2)  # 10 non-system
    out, info = compress_messages_if_needed(msgs, context_limit=1000, keep_recent=2)
    assert info["compressed"] is True
    # head = 10 - 2 = 8,removed 8
    assert info["removed_count"] == 8
    # 尾部 2 条 + 摘要 1 条 = 3
    assert len(out) == 3


def test_compress_custom_trigger_ratio():
    """自定义 trigger_ratio 影响阈值。"""
    # head-heavy 数据:original ≈1360 tokens,compressed ≈190 tokens;
    # limit=1000, trigger_ratio=0.5 → 阈值 500,落在两者之间,
    # 既触发压缩又不触发防循环保护
    msgs = _make_head_heavy_messages(2, 6)
    out, info = compress_messages_if_needed(
        msgs, context_limit=1000, trigger_ratio=0.5
    )
    assert info["compressed"] is True


def test_compress_custom_target_ratio_param_accepted():
    """target_ratio 参数应被接受(本实现未强约束,但不应抛错)。"""
    msgs = _make_head_heavy_messages(4, 6)
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
    assert DEFAULT_MIN_MESSAGES == 2  # 与 TS 共享包一致(2026-08-16 起)
    assert SUMMARY_MARKER == "[上下文摘要"
    # 分层金字塔常量(与 TS 共享包一致)
    assert SUMMARY_TIER_RECENT_RATIO == 0.3
    assert SUMMARY_RECENT_CHARS == 200
    assert SUMMARY_REMOTE_CHARS == 120
    # 旧"统一 160"常量已收编为远层常量兼容别名
    assert TOOL_RESULT_SUMMARY_CHARS == SUMMARY_REMOTE_CHARS


# =============================================================================
# compress_messages_if_needed — 防循环保护两级降级(truncated / incompressible)
# =============================================================================


def test_compress_truncate_fallback_single_long_message():
    """第一级降级:常规压缩无效 + 最后一条超长消息 → 截断降级(trigger=truncated)。

    场景:用户粘贴大文件,最后一条消息上万 tokens,摘要化收益不足,
    kr=6 常规压缩后仍超触发阈值 → 重建 kr=1 方案并截断最后一条消息内容,
    压到 target 阈值以下,保证对话可用;system 消息原样保留(永不截断)。

    token 基数(cl100k 实测):'y'*40000 ≈ 10000,'x'*5000 ≈ 625。
    """
    huge_last = "y" * 40000
    msgs = (
        [{"role": "system", "content": "sys"}]
        + [{"role": "user", "content": "x" * 5000} for _ in range(6)]
        + [{"role": "user", "content": huge_last}]
    )
    context_limit = 5000
    trigger_threshold = int(context_limit * DEFAULT_TRIGGER_RATIO)  # 4400
    target_threshold = int(context_limit * DEFAULT_TARGET_RATIO)  # 3000

    # 前置条件:original 超触发阈值(tail 含超长消息,kr=6 常规压缩必然仍超标)
    assert estimate_messages_tokens(msgs) > trigger_threshold

    out, info = compress_messages_if_needed(msgs, context_limit=context_limit)

    assert info["compressed"] is True
    assert info["trigger"] == "truncated"
    # 压缩后 tokens <= target 阈值(自然也低于触发阈值)
    assert info["compressed_tokens"] <= target_threshold
    assert info["compressed_tokens"] < trigger_threshold
    # 结构:system + 摘要 + 截断后的最后一条消息
    assert len(out) == 3
    assert out[0]["role"] == "system"
    assert out[0]["content"] == "sys"  # system 永不截断
    assert "上下文摘要" in out[1]["content"]
    assert out[-1]["role"] == "user"
    assert out[-1]["content"].endswith(TRUNCATE_MARKER)
    # 原消息列表不被修改(截断发生在拷贝上)
    assert out is not msgs
    assert out[-1] is not msgs[-1]
    assert msgs[-1]["content"] == huge_last
    assert info["original_tokens"] == estimate_messages_tokens(msgs)
    # 除最后一条外的全部 non-system 消息被摘要化
    assert info["removed_count"] == 6
    assert info["usage_ratio"] == info["original_tokens"] / context_limit


def test_compress_incompressible_when_system_too_large():
    """第二级降级:system 本身巨大(永不截断)→ 截断到最小长度仍超阈值 → incompressible。

    构造:system ≈5000 tokens('A'*40000)+ 2 条普通消息(各 ≈100 tokens),
    contextLimit=5000(触发阈值 4400):kr=1 候选含不截断的 system ≈5100 ≥ 4400,
    最后一条 user 消息截到最小长度仍超 → 返回原消息(防循环保护)。
    """
    msgs = (
        [{"role": "system", "content": "A" * 40000}]  # ≈5000 tokens
        + [{"role": "user", "content": "x" * 800} for _ in range(2)]  # 各 ≈100 tokens
    )
    context_limit = 5000
    trigger_threshold = int(context_limit * DEFAULT_TRIGGER_RATIO)  # 4400

    # 前置条件:original 超阈值;keep_recent=1 使消息数足以进入压缩分支
    assert estimate_messages_tokens(msgs) > trigger_threshold

    out, info = compress_messages_if_needed(
        msgs, context_limit=context_limit, keep_recent=1
    )

    assert info["compressed"] is False
    assert info["trigger"] == "incompressible"
    # 消息原样返回(同一对象引用,内容未被截断)
    assert out is msgs
    assert out[0]["content"] == "A" * 40000
    assert out[1]["content"] == "x" * 800
    assert out[2]["content"] == "x" * 800
    assert info["removed_count"] == 0
    assert info["original_tokens"] == estimate_messages_tokens(msgs)
    # compressed_tokens 报告的是"尝试压缩后仍超标"的 token 数
    assert info["compressed_tokens"] >= trigger_threshold
    assert info["usage_ratio"] == info["original_tokens"] / context_limit


# =============================================================================
# tool_calls 配对组保护(P0:防孤 tool 消息)
# =============================================================================


def _assistant_with_tool_calls(call_ids: list[str], content: str = "") -> dict[str, Any]:
    """构造带 tool_calls 的 assistant 消息。"""
    return {
        "role": "assistant",
        "content": content,
        "tool_calls": [
            {
                "id": cid,
                "type": "function",
                "function": {"name": "get_weather", "arguments": "{}"},
            }
            for cid in call_ids
        ],
    }


def _tool_result(call_id: str, content: str) -> dict[str, Any]:
    """构造 tool 结果消息。"""
    return {"role": "tool", "tool_call_id": call_id, "content": content}


def _assert_no_orphan_tool_messages(out: list[dict[str, Any]]) -> None:
    """断言无孤 tool 消息:每条 role='tool' 的前一条必是含对应 tool_call_id 的 assistant。"""
    for i, msg in enumerate(out):
        if msg.get("role") != "tool":
            continue
        assert i > 0, "tool 消息不能是首条(孤 tool)"
        prev = out[i - 1]
        assert prev.get("role") == "assistant", "tool 消息前一条必须是 assistant"
        tc_ids = [tc.get("id") for tc in prev.get("tool_calls") or []]
        assert msg.get("tool_call_id") in tc_ids


def test_split_pair_groups_basic_pairs():
    """assistant(tool_calls) + 其 tool 结果成组,其他消息各自成组。"""
    a = _assistant_with_tool_calls(["c1"])
    t = _tool_result("c1", "r1")
    user = {"role": "user", "content": "u"}
    groups = _split_pair_groups([a, t, user])
    assert groups == [[a, t], [user]]


def test_split_pair_groups_multi_tool_calls_pending():
    """assistant 多个 tool_calls 时,收集齐全部结果才结束组。"""
    a = _assistant_with_tool_calls(["c1", "c2"])
    t1 = _tool_result("c1", "r1")
    t2 = _tool_result("c2", "r2")
    groups = _split_pair_groups([a, t1, t2])
    assert groups == [[a, t1, t2]]


def test_split_pair_groups_orphan_tool_own_group():
    """无归属的 tool 消息(异常序列)自成组。"""
    orphan = {"role": "tool", "tool_call_id": "cX", "content": "orphan"}
    user = {"role": "user", "content": "u"}
    groups = _split_pair_groups([orphan, user])
    assert groups == [[orphan], [user]]


def test_split_pair_groups_tool_id_mismatch_keeps_pair_open():
    """tool id 不匹配 → 自成组,开放组继续收集后续匹配结果;配对组先于散组落组。"""
    a = _assistant_with_tool_calls(["c1"])
    mismatch = {"role": "tool", "tool_call_id": "cX", "content": "wrong"}
    t1 = _tool_result("c1", "r1")
    groups = _split_pair_groups([a, mismatch, t1])
    assert groups == [[a, t1], [mismatch]]


def test_compress_pair_group_kept_intact_in_tail():
    """kr=2 切分点落在配对组边界:配对组整组保留在尾部,无孤 tool 消息。

    non_system 8 条:2 条超长 user + [A1,t1] + middle + [A2,t2] + latest;
    kr=2 时尾部从组尾往前累计:latest(1) < 2 → [A2,t2](3) >= 2,
    尾部保留 [A2, t2, latest],头部 5 条被摘要。
    """
    msgs = (
        [{"role": "system", "content": "sys"}]
        + [{"role": "user", "content": "x" * 5000} for _ in range(2)]
        + [_assistant_with_tool_calls(["c1"]), _tool_result("c1", "r1")]
        + [{"role": "user", "content": "middle"}]
        + [_assistant_with_tool_calls(["c2"]), _tool_result("c2", "r2")]
        + [{"role": "user", "content": "latest"}]
    )
    out, info = compress_messages_if_needed(msgs, context_limit=1000, keep_recent=2)
    assert info["compressed"] is True
    assert info["trigger"] == "ratio"
    _assert_no_orphan_tool_messages(out)
    # 配对组整组保留在尾部(不拆组):... A2, t2, latest
    assert out[-1]["content"] == "latest"
    assert out[-2]["content"] == "r2"
    assert out[-3].get("tool_calls")
    # 头部 5 条(x, x, A1, t1, middle)被摘要
    assert info["removed_count"] == 5


def test_compress_pair_group_summarized_whole_at_kr1():
    """kr=1:尾部仅保留最后一条,两组配对整体进摘要(不产生孤 tool 消息)。"""
    msgs = (
        [{"role": "system", "content": "sys"}]
        + [{"role": "user", "content": "x" * 5000} for _ in range(2)]
        + [_assistant_with_tool_calls(["c1"]), _tool_result("c1", "r1")]
        + [{"role": "user", "content": "middle"}]
        + [_assistant_with_tool_calls(["c2"]), _tool_result("c2", "r2")]
        + [{"role": "user", "content": "latest"}]
    )
    out, info = compress_messages_if_needed(msgs, context_limit=1000, keep_recent=1)
    assert info["compressed"] is True
    # 输出无任何 tool 消息(配对组整体摘要化)
    assert all(m.get("role") != "tool" for m in out)
    # 配对组整组摘要(tool 结果内容以 160 chars 语义保留,短结果原样)
    assert "[tool] r1" in out[1]["content"]
    assert "[tool] r2" in out[1]["content"]
    # 尾部仅保留最后一条
    assert out[-1]["content"] == "latest"
    assert info["removed_count"] == 7


def test_compress_single_pair_group_covers_window_no_split():
    """单个巨大配对组覆盖整个 kr 窗口且无其他组 → 按组无法切分,不压缩。"""
    msgs = (
        [{"role": "system", "content": "sys"}]
        + [_assistant_with_tool_calls([f"c{i}" for i in range(6)], content="x" * 5000)]
        + [_tool_result(f"c{i}", "r" * 2000) for i in range(6)]
    )
    out, info = compress_messages_if_needed(msgs, context_limit=1000)
    assert info["compressed"] is False
    assert info["trigger"] == "none"
    assert out is msgs  # 未拆散配对


def test_compress_truncate_fallback_keeps_last_pair_group():
    """truncate-fallback:最后一组是配对组 → 截断组内 assistant 内容,tool result 原样保留。

    non_system 8 条:6 条超长 user + [A(c9, content=y*40000), t(c9)]。
    kr=6 常规压缩后尾部仍含超长 assistant → 仍超触发阈值 → 走 truncate-fallback;
    最后一组为配对组:截断目标为组内 assistant 的 str content,tool result 不截断。
    """
    msgs = (
        [{"role": "system", "content": "sys"}]
        + [{"role": "user", "content": "x" * 5000} for _ in range(6)]
        + [_assistant_with_tool_calls(["c9"], content="y" * 40000)]
        + [_tool_result("c9", "ok")]
    )
    context_limit = 5000
    out, info = compress_messages_if_needed(msgs, context_limit=context_limit)
    assert info["compressed"] is True
    assert info["trigger"] == "truncated"
    # 结构:system + 摘要 + [assistant(截断), tool(原样)]
    assert len(out) == 4
    assert out[0]["content"] == "sys"
    assert "上下文摘要" in out[1]["content"]
    assistant_out = out[2]
    assert assistant_out.get("tool_calls")
    assert assistant_out["content"].endswith(TRUNCATE_MARKER)
    assert assistant_out["content"] != "y" * 40000
    # 组内 tool result 不截断,且配对完整
    assert out[3]["content"] == "ok"
    assert out[3]["tool_call_id"] == "c9"
    _assert_no_orphan_tool_messages(out)
    # 原消息列表不被修改
    assert msgs[-2]["content"] == "y" * 40000
    assert msgs[-1]["content"] == "ok"
    assert info["removed_count"] == 6  # 8 条 non-system - 最后一组 2 条
    assert info["compressed_tokens"] <= int(context_limit * DEFAULT_TARGET_RATIO)


# =============================================================================
# 摘要防嵌套(P1)+ tool result 内容保留(P1)
# =============================================================================


def test_build_structured_summary_merges_nested_summary():
    """历史摘要消息:正文原样并入 + 条数累加,不套规则摘要。"""
    old = "[上下文摘要 — 之前 3 条消息已压缩]\n- [user] 旧问题\n- [assistant] 旧回答"
    msgs = [
        {"role": "user", "content": old},
        {"role": "user", "content": "新问题"},
        {"role": "assistant", "content": "新回答"},
    ]
    s = _build_structured_summary(msgs)
    # 条数累加:旧 3 + 新 2 = 5
    assert s.startswith("[上下文摘要 — 之前 5 条消息已压缩]")
    # 旧正文原样保留
    assert "- [user] 旧问题" in s
    assert "- [assistant] 旧回答" in s
    # 新消息正常摘要
    assert "- [user] 新问题" in s
    assert "- [assistant] 新回答" in s
    # 历史摘要未被再次规则摘要(无嵌套行)
    assert "[user] [上下文摘要" not in s


def test_build_structured_summary_nested_marker_without_count_defaults_1():
    """历史摘要标记行无条数(如旧格式)→ 覆盖条数按 1。"""
    old = "[上下文摘要]\n- [user] 旧内容"
    msgs = [{"role": "user", "content": old}, {"role": "user", "content": "新"}]
    s = _build_structured_summary(msgs)
    assert "之前 2 条消息已压缩" in s
    assert "- [user] 旧内容" in s


def test_compress_nested_summary_count_accumulates():
    """端到端:上一轮摘要消息再压缩 → 标记条数累加、旧正文原样保留。"""
    old_summary = (
        "[上下文摘要 — 之前 3 条消息已压缩]\n"
        "- [user] 旧问题一\n"
        "- [assistant] 旧回答一"
    )
    msgs = (
        [{"role": "system", "content": "sys"}]
        + [{"role": "user", "content": old_summary}]
        + [{"role": "user", "content": "x" * 5000} for _ in range(2)]
        + [{"role": "user", "content": "t" * 100} for _ in range(2)]
    )
    out, info = compress_messages_if_needed(msgs, context_limit=1000, keep_recent=2)
    assert info["compressed"] is True
    summary_content = out[1]["content"]
    # 条数累加:旧 3 + 新压缩 2 条非摘要消息 = 5
    assert "之前 5 条消息已压缩" in summary_content
    # 旧正文原样保留
    assert "- [user] 旧问题一" in summary_content
    assert "- [assistant] 旧回答一" in summary_content
    # 历史摘要消息未被再次规则摘要
    assert "[user] [上下文摘要" not in summary_content


def test_summarize_message_tool_keeps_remote_chars():
    """tool result 摘要保留远层字符数(TOOL_RESULT_SUMMARY_CHARS 别名 = 120)+ '…'。"""
    long_result = "r" * 300
    s = _summarize_message({"role": "tool", "content": long_result})
    assert s == f"[tool] {'r' * TOOL_RESULT_SUMMARY_CHARS}…"


def test_summarize_message_tool_short_content_kept_whole():
    """tool result 内容不超过保留上限(120 chars)时原样保留。"""
    s = _summarize_message({"role": "tool", "content": "短结果"})
    assert s == "[tool] 短结果"


def test_summarize_message_tool_empty_content_placeholder():
    """tool result 空内容才用纯占位。"""
    assert _summarize_message({"role": "tool", "content": ""}) == "[tool] (空)"


def test_compress_summary_keeps_tool_result_prefix():
    """端到端:长 tool result 压缩后摘要含前 120 chars(远层 tool,配对组整组进摘要)。"""
    long_result = "R" * 300
    msgs = (
        [{"role": "system", "content": "sys"}]
        + [_assistant_with_tool_calls(["c1"])]
        + [_tool_result("c1", long_result)]
        + [{"role": "user", "content": "x" * 5000} for _ in range(2)]
        + [{"role": "user", "content": "t" * 100} for _ in range(2)]
    )
    out, info = compress_messages_if_needed(msgs, context_limit=1000, keep_recent=2)
    assert info["compressed"] is True
    assert f"[tool] {'R' * TOOL_RESULT_SUMMARY_CHARS}…" in out[1]["content"]


# =============================================================================
# 分层金字塔摘要(近层保留细节 / 远层浓缩)
# =============================================================================


def _make_tiered_user_messages(n: int = 20, body_chars: int = 300) -> list[dict]:
    """构造 n 条可区分的长 user 消息(唯一编号前缀 + 无标点长体)。"""
    return [{"role": "user", "content": f"用户消息第{i}条。{'x' * body_chars}"} for i in range(n)]


def test_build_structured_summary_recent_tier_keeps_200_chars():
    """近层(最后 ceil(20*0.3)=6 条)摘要行保留各自前 200 chars,第 14 条(远层)不含。"""
    msgs = _make_tiered_user_messages(20)
    s = _build_structured_summary(msgs)
    assert s.startswith("[上下文摘要 — 之前 20 条消息已压缩]")
    # 近层(索引 14..19):[user] + 前 200 chars 直截 + '…'
    for i in range(14, 20):
        assert msgs[i]["content"][:SUMMARY_RECENT_CHARS] in s
    # 第 14 条(索引 13,远层)浓缩到前 120 字符,不含前 200 chars 片段
    assert msgs[13]["content"][:SUMMARY_RECENT_CHARS] not in s


def test_build_structured_summary_remote_tier_more_condensed():
    """远层浓缩:远层摘要行长度显著小于近层(120 字符 vs 200 字符)。"""
    msgs = _make_tiered_user_messages(20)
    s = _build_structured_summary(msgs)
    lines = s.split("\n")[1:]  # 去掉标记行
    recent_lines = [ln for ln in lines if ln.endswith("…")]  # 近层:200 chars + '…'
    remote_lines = [ln for ln in lines if not ln.endswith("…")]  # 远层:120 chars + '...'
    assert len(recent_lines) == 6
    assert len(remote_lines) == 14
    # 近层行(≈219 chars)显著长于远层行(≈141 chars)
    assert min(len(ln) for ln in recent_lines) > max(len(ln) for ln in remote_lines)


def test_build_structured_summary_tool_result_tiered_chars():
    """tool result 分层:近层保留前 200 chars、远层保留前 120 chars。"""
    recent_tool = "R" * 300
    remote_tool = "S" * 300
    msgs = (
        [{"role": "user", "content": "u0"}]
        + [_assistant_with_tool_calls(["c1"]), _tool_result("c1", remote_tool)]
        + [{"role": "user", "content": f"u{i}"} for i in range(1, 15)]
        + [_assistant_with_tool_calls(["c2"]), _tool_result("c2", recent_tool)]
        + [{"role": "user", "content": f"u{i}"} for i in range(15, 18)]
    )
    # 22 条非摘要消息 → 近层 = 最后 ceil(22*0.3)=7 条,tool(c2) 在近层、tool(c1) 在远层
    s = _build_structured_summary(msgs)
    assert f"[tool] {'R' * SUMMARY_RECENT_CHARS}…" in s  # 近层 tool:200 chars
    assert f"[tool] {'S' * SUMMARY_REMOTE_CHARS}…" in s  # 远层 tool:120 chars
    assert "S" * (SUMMARY_REMOTE_CHARS + 1) not in s  # 远层 tool 截断在 120


def test_build_structured_summary_custom_summary_no_tiering():
    """custom_summary 非空时优先级最高:整段替代,无分层痕迹。"""
    msgs = _make_tiered_user_messages(20)
    s = _build_structured_summary(msgs, custom_summary="LLM 语义摘要正文")
    # 标记行计数仍按防嵌套规则累计,正文整段为 custom_summary
    assert s.startswith("[上下文摘要 — 之前 20 条消息已压缩]")
    assert "LLM 语义摘要正文" in s
    # 无分层痕迹:无规则摘要行(无 '[user]' 标签行)、无近层 '…' 后缀;仅标记行 + 一行正文
    assert "[user]" not in s
    assert "…" not in s
    assert s.count("\n") == 1


def test_compress_custom_summary_end_to_end():
    """端到端:compress_messages_if_needed 传 custom_summary → 摘要正文整段用之(对齐 TS customSummary)。"""
    msgs = [{"role": "system", "content": "sys"}] + _make_tiered_user_messages(20)
    out, info = compress_messages_if_needed(msgs, context_limit=800, custom_summary="端到端LLM摘要")
    assert info["compressed"] is True
    assert info["trigger"] == "ratio"
    summary = out[1]
    assert summary["role"] == "user"
    assert "端到端LLM摘要" in summary["content"]
    assert "[user]" not in summary["content"]


def test_summary_tier_constants_match_ts_share_package():
    """分层常量与 TS 共享包规格一致(0.3 / 200 / 120)。"""
    assert SUMMARY_TIER_RECENT_RATIO == 0.3
    assert SUMMARY_RECENT_CHARS == 200
    assert SUMMARY_REMOTE_CHARS == 120
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

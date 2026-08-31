# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SessionSummarizer._estimate_tokens 单元测试(tiktoken 优先 + 降级)。

覆盖:
- 空消息 → 至少 1
- tiktoken 优先:按真实 token 数估算
- 非 dict 消息跳过(不计 token)
- tiktoken 不可用 → 降级字符数 // 3
- encoder.encode 异常 → 降级字符数,不抛异常
- 中文文本 token > 0
"""

from __future__ import annotations

import pytest

from app.services.session_summarizer import SessionSummarizer


# =============================================================================
# _estimate_tokens
# =============================================================================


class TestEstimateTokens:
    def test_empty_messages(self):
        """空消息 → max(1, 0) = 1。"""
        assert SessionSummarizer._estimate_tokens([]) == 1

    def test_tiktoken_preferred(self):
        """tiktoken 可用:content 按真实 token 数计算。"""
        msgs = [{"role": "user", "content": "abcdefghij"}]  # cl100k = 2 tokens
        assert SessionSummarizer._estimate_tokens(msgs) == 2

    def test_non_dict_message_skipped(self):
        """非 dict 消息(不计 content)→ 仅 dict 的 content 参与估算。"""
        msgs = [None, "string", {"role": "user", "content": "abc"}]  # "abc" = 1 token
        assert SessionSummarizer._estimate_tokens(msgs) == 1

    def test_chinese_content(self):
        """中文文本 token 数 > 0。"""
        msgs = [{"role": "user", "content": "你好,世界"}]
        assert SessionSummarizer._estimate_tokens(msgs) > 0

    def test_fallback_when_encoder_missing(self, monkeypatch):
        """tiktoken 不可用 → 降级字符数 // 3。"""
        import app.services.session_summarizer as ss

        monkeypatch.setattr(ss, "_get_tiktoken_encoder", lambda: None)
        msgs = [{"role": "user", "content": "abcdefghij"}]  # 10 chars → 10 // 3 = 3
        assert SessionSummarizer._estimate_tokens(msgs) == 3
        assert SessionSummarizer._estimate_tokens([]) == 1

    def test_fallback_when_encode_fails(self, monkeypatch):
        """encoder.encode 抛异常 → 降级字符数 // 3,不抛异常。"""
        import app.services.session_summarizer as ss

        class _BadEncoder:
            def encode(self, text):
                raise RuntimeError("forced")

        monkeypatch.setattr(ss, "_get_tiktoken_encoder", lambda: _BadEncoder())
        msgs = [{"role": "user", "content": "abcdefghij"}]
        assert SessionSummarizer._estimate_tokens(msgs) == 3

    def test_returns_at_least_one_even_when_empty_content(self):
        """content 为空串 → 结果至少 1。"""
        msgs = [{"role": "user", "content": ""}]
        assert SessionSummarizer._estimate_tokens(msgs) == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

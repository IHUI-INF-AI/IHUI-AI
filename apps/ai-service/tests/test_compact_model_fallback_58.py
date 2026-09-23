# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58(十七):压缩摘要失败→当前模型重试接线测试(对标 codex compact_model_fallback.rs)。"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.services.compact_with_llm import (  # noqa: E402
    compact_model_fallback_tags,
    compact_with_llm,
    should_retry_compact_with_current_model,
)


def _big_messages(n: int = 60) -> list[dict]:
    """构造超阈值且 head 足够长的消息列表。"""
    msgs: list[dict] = [{"role": "system", "content": "system prompt"}]
    for i in range(n):
        msgs.append({"role": "user", "content": f"user turn {i} " + "x" * 400})
        msgs.append({"role": "assistant", "content": f"assistant reply {i} " + "y" * 400})
    return msgs


def test_should_retry_classification():
    assert should_retry_compact_with_current_model(None) is True
    assert should_retry_compact_with_current_model(RuntimeError("connection reset")) is True
    assert should_retry_compact_with_current_model("502 Bad Gateway") is True
    assert should_retry_compact_with_current_model("turn aborted") is False
    assert should_retry_compact_with_current_model("TurnAborted") is False
    assert should_retry_compact_with_current_model("interrupted") is False
    assert should_retry_compact_with_current_model("session budget exceeded") is False
    assert should_retry_compact_with_current_model(asyncio.CancelledError()) is False


def test_tags_shape_matches_codex_dimensions():
    tags = compact_model_fallback_tags("context_limit", "responses_compaction_v2", "succeeded")
    assert tags == {
        "reason": "context_limit",
        "implementation": "responses_compaction_v2",
        "outcome": "succeeded",
    }


def test_retryable_error_retries_then_succeeds():
    """首次调用抛连接类异常,第二次成功 → info.model_fallback outcome=succeeded。"""
    calls = {"n": 0}

    async def _llm(messages, tools=None, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("connection reset by peer")
        return {"content": "语义摘要内容 " + "z" * 200}

    compressed, info = asyncio.run(
        compact_with_llm(_big_messages(), 4000, _llm, keep_recent=4)
    )
    assert calls["n"] == 2, "应重试一次"
    assert info.get("model_fallback", {}).get("outcome") == "succeeded"
    assert info["model_fallback"]["reason"] == "context_limit"
    assert compressed


def test_retryable_error_retry_fails_degrades():
    """两次都失败 → outcome=failed 且退回规则压缩(仍返回合法结果)。"""
    calls = {"n": 0}

    async def _llm(messages, tools=None, **kwargs):
        calls["n"] += 1
        raise RuntimeError("connection reset by peer")

    compressed, info = asyncio.run(
        compact_with_llm(_big_messages(), 4000, _llm, keep_recent=4)
    )
    assert calls["n"] == 2
    assert info.get("model_fallback", {}).get("outcome") == "failed"
    assert compressed


def test_non_retryable_error_does_not_retry():
    """中止类错误不重试:只调用一次,且不产生 model_fallback 标签。"""
    calls = {"n": 0}

    async def _llm(messages, tools=None, **kwargs):
        calls["n"] += 1
        raise RuntimeError("turn aborted by user")

    compressed, info = asyncio.run(
        compact_with_llm(_big_messages(), 4000, _llm, keep_recent=4)
    )
    assert calls["n"] == 1, "中止类错误不应重试"
    assert "model_fallback" not in info
    assert compressed


def test_custom_reason_label_passed_through():
    async def _llm(messages, tools=None, **kwargs):
        raise RuntimeError("timeout")

    _compressed, info = asyncio.run(
        compact_with_llm(
            _big_messages(), 4000, _llm, keep_recent=4, fallback_reason="user_requested"
        )
    )
    assert info["model_fallback"]["reason"] == "user_requested"


def test_success_path_has_no_fallback_label():
    async def _llm(messages, tools=None, **kwargs):
        return {"content": "摘要 " + "q" * 200}

    _compressed, info = asyncio.run(compact_with_llm(_big_messages(), 4000, _llm, keep_recent=4))
    assert "model_fallback" not in info


def test_below_threshold_untouched():
    async def _llm(messages, tools=None, **kwargs):  # pragma: no cover - 不应被调
        raise AssertionError("未超阈值不应调 LLM")

    msgs = [{"role": "user", "content": "tiny"}]
    out, info = asyncio.run(compact_with_llm(msgs, 100000, _llm))
    assert out == msgs
    assert "model_fallback" not in info
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

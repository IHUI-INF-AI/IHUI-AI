# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# compact_with_llm × local_compact 接线测试 — 第三十七批
# (摘要识别桥/防嵌套过滤/Codex 前缀可选注入)
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.core.context_compaction import SUMMARY_MARKER
from app.core.local_compact import SUMMARY_PREFIX
from app.services.compact_with_llm import (
    _message_plain_text,
    compact_with_llm,
    is_compaction_summary,
)


def _user(text):
    return {"role": "user", "content": text}


LONG_A = "task start " + "word " * 600
LONG_B = "recent detail"


def _default_msgs():
    return [_user(LONG_A), _user(LONG_B)]


# ---------- is_compaction_summary 桥 ----------

def test_bridge_recognizes_repo_marker():
    assert is_compaction_summary(SUMMARY_MARKER + " — 之前 3 条消息已压缩]") is True

def test_bridge_recognizes_codex_prefix():
    assert is_compaction_summary(SUMMARY_PREFIX + "\nrest") is True

def test_bridge_rejects_plain_text():
    assert is_compaction_summary("普通对话消息") is False
    assert is_compaction_summary("") is False


# ---------- _message_plain_text ----------

def test_plain_text_str_content():
    assert _message_plain_text({"content": "hello"}) == "hello"

def test_plain_text_list_content():
    msg = {"content": [{"type": "text", "text": "a"}, {"type": "text", "text": "b"}]}
    assert _message_plain_text(msg) == "a\nb"


# ---------- 防嵌套过滤 ----------

@pytest.mark.asyncio
async def test_head_summary_messages_filtered_from_prompt():
    """head 中已是摘要的消息不再送入 LLM(防嵌套)。"""
    captured = {}

    async def _fn(messages, tools=None):
        captured["prompt"] = messages
        return "新摘要"

    messages = [
        _user(LONG_A),
        _user(SUMMARY_MARKER + " — 之前 2 条消息已压缩]\n旧摘要正文"),
        _user(LONG_B),
    ]
    out, info = await compact_with_llm(
        messages, context_limit=1000, llm_complete_fn=_fn,
        trigger_ratio=0.01, target_ratio=0.05, keep_recent=1,
    )
    assert "prompt" in captured, "LLM 未被调用"
    sent_texts = [str(m.get("content")) for m in captured["prompt"][1:]]
    assert all(SUMMARY_MARKER not in t for t in sent_texts)
    assert any(LONG_A in t for t in sent_texts)


@pytest.mark.asyncio
async def test_head_codex_summary_messages_filtered():
    """Codex 前缀摘要消息同样被防嵌套过滤。"""
    captured = {}

    async def _fn(messages, tools=None):
        captured["prompt"] = messages
        return "新摘要"

    messages = [
        _user(LONG_A),
        _user(SUMMARY_PREFIX + "\nold codex summary"),
        _user(LONG_B),
    ]
    await compact_with_llm(
        messages, context_limit=1000, llm_complete_fn=_fn,
        trigger_ratio=0.01, target_ratio=0.05, keep_recent=1,
    )
    sent_texts = [str(m.get("content")) for m in captured["prompt"][1:]]
    assert all("old codex summary" not in t for t in sent_texts)


# ---------- Codex 前缀可选注入 ----------

@pytest.mark.asyncio
async def test_prefix_disabled_by_default():
    async def _fn(messages, tools=None):
        return "中文摘要正文"
    out, info = await compact_with_llm(
        _default_msgs(), context_limit=1000, llm_complete_fn=_fn,
        trigger_ratio=0.6, target_ratio=0.5, keep_recent=1,
    )
    joined = "\n".join(str(m.get("content")) for m in out)
    assert SUMMARY_PREFIX not in joined

@pytest.mark.asyncio
async def test_prefix_enabled_makes_summary_detectable():
    async def _fn(messages, tools=None):
        return "中文摘要正文"
    out, info = await compact_with_llm(
        _default_msgs(), context_limit=1000, llm_complete_fn=_fn,
        trigger_ratio=0.6, target_ratio=0.5, keep_recent=1,
        prepend_codex_prefix=True,
    )
    assert info.get("llm_summary") is True
    joined = "\n".join(str(m.get("content")) for m in out)
    assert SUMMARY_PREFIX in joined
    assert is_compaction_summary(joined) is True

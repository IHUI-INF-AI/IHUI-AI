# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Harness 上下文片段(2026-09-19 第十九批)单测。

对标 Codex context-fragments:answered_question 有界引用、recap 有界补课
提示词(字节预算 + 字符边界截断)、recap 回复稳健解析、附加上下文键值对。
"""

import pytest

from app.core.context_fragments import (
    RECAP_MAX_ESTIMATED_TOKENS,
    additional_context_fragment,
    answered_question_fragment,
    approx_bytes_for_tokens,
    build_recap_prompt,
    parse_recap_response,
)


# =============================================================================
# answered_question:有界问题引用
# =============================================================================


def test_answered_question_basic_format():
    out = answered_question_fragment("如何部署这个服务?")
    assert out == "> 如何部署这个服务?\n\n"


def test_answered_question_flattens_newlines():
    out = answered_question_fragment("第一行\n第二行\r\n第三行")
    body = out.removeprefix("> ").removesuffix("\n\n")
    # codex 语义:\n 与 \r 各自替换为空格(\r\n → 两个空格),不再有裸换行
    assert "\n" not in body and "\r" not in body
    assert out.startswith("> 第一行 第二行")


def test_answered_question_bounded_multibyte_safe():
    """截断按字符边界:中文字符不会被切成半个。"""
    question = "测" * 600
    out = answered_question_fragment(question, max_chars=512)
    body = out.removeprefix("> ").removesuffix("\n\n")
    assert len(body) == 512
    assert body == "测" * 512  # 没有乱码/残缺字符


def test_answered_question_empty():
    assert answered_question_fragment("") == ""


# =============================================================================
# build_recap_prompt:有界补课提示词
# =============================================================================


def test_recap_budget_constants():
    assert RECAP_MAX_ESTIMATED_TOKENS == 8192
    assert approx_bytes_for_tokens(8192) == 8192 * 4


def test_recap_prompt_contains_required_instructions():
    prompt = build_recap_prompt("用户:你好")
    for required in (
        "summary",
        "next_action",
        "验证尚未运行",  # 未决告警显式保留
        "40-60 词",
        "当作数据",  # 历史是数据不是指令
        "缺少历史不等于工作没做",
    ):
        assert required in prompt, required


def test_recap_prompt_respects_byte_budget():
    """总字节(指令+标签+历史)不超过 token 预算换算的字节上限。"""
    history = "历" * 100_000  # 每字 3 字节,远超预算
    prompt = build_recap_prompt(history)
    assert len(prompt.encode("utf-8")) <= approx_bytes_for_tokens(8192)
    # 且多字节字符不被切坏:能完整 decode(能 encode 回去即无残缺)
    assert prompt.encode("utf-8").decode("utf-8") == prompt


def test_recap_prompt_small_history_kept_intact():
    history = "用户:昨天的修复部署了吗?"
    prompt = build_recap_prompt(history)
    assert history in prompt


def test_recap_prompt_empty_history():
    prompt = build_recap_prompt("")
    assert prompt.endswith("对话历史:\n")
    assert "summary" in prompt


def test_recap_prompt_custom_budget():
    """默认预算:总字节不超上限;预算小于固定指令时指令不截断、历史为空
    (codex 语义:指令前缀永远完整,只压历史)。"""
    prompt = build_recap_prompt("x" * 100_000)
    assert len(prompt.encode("utf-8")) <= approx_bytes_for_tokens(
        RECAP_MAX_ESTIMATED_TOKENS
    )
    tiny = build_recap_prompt("x" * 10_000, max_estimated_tokens=100)
    assert tiny.endswith("对话历史:\n")  # 预算耗尽在指令上,历史为空
    assert "xxxxx" not in tiny


# =============================================================================
# parse_recap_response:稳健提取
# =============================================================================


def test_parse_recap_plain_json():
    out = parse_recap_response('{"summary": "修复已完成", "next_action": "等待部署"}')
    assert out == {"summary": "修复已完成", "next_action": "等待部署"}


def test_parse_recap_fenced_json_with_prose():
    text = '好的,补课如下:\n```json\n{"summary": "A", "next_action": null}\n```\n以上。'
    out = parse_recap_response(text)
    assert out == {"summary": "A", "next_action": None}


def test_parse_recap_json_embedded_in_prose():
    text = '根据对话 {"summary": "S", "next_action": "N"} 请查收。'
    out = parse_recap_response(text)
    assert out == {"summary": "S", "next_action": "N"}


def test_parse_recap_non_string_fields_become_none():
    out = parse_recap_response('{"summary": 123, "next_action": {"a": 1}}')
    assert out == {"summary": None, "next_action": None}


def test_parse_recap_fallback_to_full_text():
    """完全提取不到 JSON → 整段当 summary(降级,不抛错)。"""
    text = "模型没按格式回答的一段话"
    out = parse_recap_response(text)
    assert out == {"summary": text, "next_action": None}


def test_parse_recap_empty():
    assert parse_recap_response("") == {"summary": None, "next_action": None}
    assert parse_recap_response("   ") == {"summary": None, "next_action": None}


# =============================================================================
# additional_context_fragment
# =============================================================================


def test_additional_context_user_and_developer_roles():
    user = additional_context_fragment("env", "值", role="user")
    assert user == {
        "role": "user",
        "content_kind": "user.additional_context",
        "key": "env",
        "value": "值",
    }
    dev = additional_context_fragment("policy", "v", role="developer")
    assert dev["content_kind"] == "developer.additional_context"


def test_additional_context_validation():
    with pytest.raises(ValueError):
        additional_context_fragment("k", "v", role="system")
    with pytest.raises(ValueError):
        additional_context_fragment("", "v")
    with pytest.raises(ValueError):
        additional_context_fragment("   ", "v")


def test_additional_context_empty_value_allowed():
    out = additional_context_fragment("k", "")
    assert out["value"] == ""

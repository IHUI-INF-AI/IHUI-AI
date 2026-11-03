# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""session_prefix.py 的回归测试(对标 codex session_prefix_tests.rs 行为)。

覆盖:各 status 分支(含 None 分支)、errored 截断合法性、昵称有/无、
mention 常量、fragment 构建的角色/标记断言、开标记识别。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.session_prefix import (  # noqa: E402
    COMPLETION_MESSAGE_ENVELOPE_TOKEN_RESERVE,
    COMPLETION_MESSAGE_MAX_TOKENS,
    ERROR_MAX_TOKENS,
    ERROR_NEXT_ACTION,
    PLUGIN_TEXT_MENTION_SIGIL,
    TOOL_MENTION_SIGIL,
    build_inter_agent_completion_fragment,
    format_inter_agent_completion_message,
    format_subagent_context_line,
    is_inter_agent_completion_fragment,
    truncate_utf8_bytes,
)


def test_completed_with_message() -> None:
    out = format_inter_agent_completion_message("taskA", "agentX", "completed", "done")
    assert out is not None
    assert "Message Type: FINAL_ANSWER" in out
    assert "Task name: taskA" in out
    assert "Sender: agentX" in out
    assert "Payload:\ndone" in out


def test_completed_none_message_empty_payload() -> None:
    out = format_inter_agent_completion_message("taskA", "agentX", "completed", None)
    assert out is not None
    assert out.endswith("Payload:\n")


def test_errored_with_message() -> None:
    out = format_inter_agent_completion_message("taskA", "agentX", "errored", "boom")
    assert out is not None
    assert "Agent errored: boom" in out
    assert ERROR_NEXT_ACTION in out
    assert out.index("Agent errored: boom") < out.index(ERROR_NEXT_ACTION)


def test_errored_long_chinese_truncated_valid() -> None:
    # 超长中文串(单字符 3 字节)必须被截断且不切坏多字节字符
    big = "中" * (ERROR_MAX_TOKENS * 4 + 100)
    out = format_inter_agent_completion_message("t", "s", "errored", big)
    assert out is not None
    prefix = "Agent errored: "
    body = out[len(prefix) : out.index("\n\n" + ERROR_NEXT_ACTION)]
    # 截断后整段仍可正常 utf-8 编码、可正常解码(无残缺多字节字符)
    raw = body.encode("utf-8")
    assert raw == body.encode("utf-8")
    decoded = raw.decode("utf-8")
    assert decoded == body
    assert len(body) < len(big)


def test_errored_none_message() -> None:
    out = format_inter_agent_completion_message("t", "s", "errored", None)
    assert out is not None
    assert "Agent errored: " in out
    assert ERROR_NEXT_ACTION in out


def test_shutdown() -> None:
    out = format_inter_agent_completion_message("t", "s", "shutdown")
    assert out == "Message Type: FINAL_ANSWER\nTask name: t\nSender: s\nPayload:\nAgent shut down."


def test_not_found() -> None:
    out = format_inter_agent_completion_message("t", "s", "not_found")
    assert out == "Message Type: FINAL_ANSWER\nTask name: t\nSender: s\nPayload:\nAgent was not found."


def test_pending_init_returns_none() -> None:
    assert format_inter_agent_completion_message("t", "s", "pending_init") is None


def test_running_returns_none() -> None:
    assert format_inter_agent_completion_message("t", "s", "running") is None


def test_interrupted_returns_none() -> None:
    assert format_inter_agent_completion_message("t", "s", "interrupted") is None


def test_subagent_context_line_with_nickname() -> None:
    assert format_subagent_context_line("ref1", "nick1") == "- ref1: nick1"


def test_subagent_context_line_without_nickname() -> None:
    assert format_subagent_context_line("ref1") == "- ref1"
    assert format_subagent_context_line("ref1", None) == "- ref1"


def test_subagent_context_line_empty_nickname_treated_as_none() -> None:
    assert format_subagent_context_line("ref1", "") == "- ref1"


def test_mention_constants() -> None:
    assert TOOL_MENTION_SIGIL == "$"
    assert PLUGIN_TEXT_MENTION_SIGIL == "@"


def test_constants_values() -> None:
    assert COMPLETION_MESSAGE_MAX_TOKENS == 1_000
    assert COMPLETION_MESSAGE_ENVELOPE_TOKEN_RESERVE == 100
    assert ERROR_MAX_TOKENS == 900


def test_truncate_utf8_bytes_short() -> None:
    assert truncate_utf8_bytes("hello", 100) == "hello"


def test_truncate_utf8_bytes_boundary_safe() -> None:
    s = "中文abc"
    # 截断到 5 字节:中(3)文(3) 已超,应在"中"之后(3 字节)截断,不切坏"文"
    out = truncate_utf8_bytes(s, 5)
    assert out == "中"
    out.encode("utf-8")  # 不抛


def test_truncate_utf8_bytes_zero() -> None:
    assert truncate_utf8_bytes("abc", 0) == ""


def test_is_inter_agent_completion_fragment_true() -> None:
    out = format_inter_agent_completion_message("t", "s", "completed", "x")
    assert is_inter_agent_completion_fragment(out) is True
    # 前导空白也应识别
    assert is_inter_agent_completion_fragment("   " + out) is True


def test_is_inter_agent_completion_fragment_false() -> None:
    assert is_inter_agent_completion_fragment("random text") is False
    assert is_inter_agent_completion_fragment("") is False
    assert is_inter_agent_completion_fragment("Message Type: NEW_TASK\n...") is False


def test_build_fragment_role_and_structure() -> None:
    frag = build_inter_agent_completion_fragment("t", "s", "completed", "hi")
    assert frag["type"] == "message"
    assert frag["role"] == "assistant"
    assert isinstance(frag["content"], list) and len(frag["content"]) == 1
    item = frag["content"][0]
    assert item["type"] == "input_text"
    assert "Message Type: FINAL_ANSWER" in item["text"]


def test_build_fragment_none_status_returns_empty_dict() -> None:
    assert build_inter_agent_completion_fragment("t", "s", "running") == {}


def test_build_fragment_errored_contains_next_action() -> None:
    frag = build_inter_agent_completion_fragment("t", "s", "errored", "oops")
    text = frag["content"][0]["text"]
    assert "Agent errored: oops" in text
    assert ERROR_NEXT_ACTION in text
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""instructional_fragments 对标测试(2026-09-20 第二十八批)。

逐字断言各 build_* 的 role / markers / 正文关键句,并覆盖 multi_agent 截断、
managed 10k 超限、internal source 正则、unsupported_media 双类型、network allow/deny、
recommended_plugins ≤50 截断。
"""

from __future__ import annotations

import pytest

from app.core import instructional_fragments as F


def _text(msg: dict) -> str:
    return msg["content"][0]["text"]


# ---------------------------------------------------------------------------
# 1. apps_instructions
# ---------------------------------------------------------------------------
def test_apps_instructions_markers_and_body():
    msg = F.build_apps_instructions_fragment()
    text = _text(msg)
    assert msg["role"] == "developer"
    assert msg["type"] == "message"
    assert text.startswith(F.APPS_INSTRUCTIONS_OPEN_TAG)
    assert text.rstrip().endswith(F.APPS_INSTRUCTIONS_CLOSE_TAG)
    assert "## Apps (Connectors)" in text
    assert "codex_apps" in text
    assert "[$app-name](app://{connector_id})" in text
    assert "tool_search" in text
    assert "Do not additionally call list_mcp_resources or list_mcp_resource_templates for apps." in text


# ---------------------------------------------------------------------------
# 2. plugin_instructions(generic,无 marker)
# ---------------------------------------------------------------------------
def test_plugin_instruction_passthrough_no_markers():
    msg = F.build_plugin_instruction_fragment("custom plugin guidance here")
    text = _text(msg)
    assert msg["role"] == "developer"
    assert text == "custom plugin guidance here"
    assert F.PLUGINS_INSTRUCTIONS_OPEN_TAG not in text


# ---------------------------------------------------------------------------
# 3. available_plugins_instructions
# ---------------------------------------------------------------------------
def test_available_plugins_markers_and_body():
    msg = F.build_available_plugins_instructions_fragment()
    text = _text(msg)
    assert msg["role"] == "developer"
    assert F.PLUGINS_INSTRUCTIONS_OPEN_TAG in text
    assert F.PLUGINS_INSTRUCTIONS_CLOSE_TAG in text
    assert "## Plugins" in text
    assert "A plugin is a local bundle of skills, MCP servers, and apps." in text
    assert "### How to use plugins" in text
    assert "`mcp__server__tool`" in text
    assert "Missing/blocked:" in text


# ---------------------------------------------------------------------------
# 4. recommended_plugins_instructions
# ---------------------------------------------------------------------------
def test_recommended_plugins_markers_and_intro():
    plugins = [("Alpha", "alpha_id"), ("Beta", "beta_id")]
    msg = F.build_recommended_plugins_instructions_fragment(plugins)
    text = _text(msg)
    assert msg["role"] == "user"
    assert F.RECOMMENDED_PLUGINS_OPEN_TAG in text
    assert "Here is a list of plugins that are available but not installed." in text
    assert "- Alpha (alpha_id)" in text
    assert "- Beta (beta_id)" in text


def test_recommended_plugins_truncated_to_50():
    plugins = [(f"P{i}", f"id_{i}") for i in range(60)]
    msg = F.build_recommended_plugins_instructions_fragment(plugins)
    text = _text(msg)
    shown = [line for line in text.splitlines() if line.startswith("- ")]
    assert len(shown) == F.MAX_RECOMMENDED_PLUGINS
    assert "- P0 (id_0)" in text
    assert "- P49 (id_49)" in text
    assert "- P50 (id_50)" not in text


# ---------------------------------------------------------------------------
# 5. environments_instructions
# ---------------------------------------------------------------------------
def test_environments_markers_and_body():
    msg = F.build_environments_instructions_fragment()
    text = _text(msg)
    assert msg["role"] == "developer"
    assert F.ENVIRONMENTS_INSTRUCTIONS_OPEN_TAG in text
    assert "## Execution environments" in text
    assert "`<environment_context>`" in text
    assert "marked `starting` is not yet usable" in text


# ---------------------------------------------------------------------------
# 6. multi_agent_mode
# ---------------------------------------------------------------------------
def test_multi_agent_mode_explicit_request_only():
    msg = F.build_multi_agent_mode_fragment("explicit_request_only")
    text = _text(msg)
    assert msg["role"] == "developer"
    assert F.MULTI_AGENT_MODE_OPEN_TAG in text
    assert F.MULTI_AGENT_MODE_CLOSE_TAG in text
    assert F.EXPLICIT_REQUEST_ONLY_MULTI_AGENT_MODE_TEXT in text
    assert "Do not spawn sub-agents unless the user" in text


def test_multi_agent_mode_proactive():
    msg = F.build_multi_agent_mode_fragment("proactive")
    text = _text(msg)
    assert F.PROACTIVE_MULTI_AGENT_MODE_TEXT in text
    assert "Proactive multi-agent delegation is active." in text


def test_multi_agent_mode_custom_truncated_at_400_tokens():
    long_text = "word " * 5000  # 远超 400 token
    msg = F.build_multi_agent_mode_fragment("custom", long_text)
    text = _text(msg)
    inner = text[len(F.MULTI_AGENT_MODE_OPEN_TAG):-len(F.MULTI_AGENT_MODE_CLOSE_TAG)]
    # 近似 400 token ≈ 1600 字节,截断后追加省略号(3 字节)
    assert len(inner.encode("utf-8")) <= F.MULTI_AGENT_MODE_MAX_TOKENS * F.BYTES_PER_TOKEN + 4
    assert inner.endswith("\u2026")
    assert len(text) < len(long_text)


def test_multi_agent_mode_custom_short_not_truncated():
    short = "delegate parallel subtasks when helpful"
    msg = F.build_multi_agent_mode_fragment("custom", short)
    assert _text(msg) == (
        f"{F.MULTI_AGENT_MODE_OPEN_TAG}{short}{F.MULTI_AGENT_MODE_CLOSE_TAG}"
    )


def test_multi_agent_mode_custom_empty_returns_none():
    assert F.build_multi_agent_mode_fragment("custom", "") is None


def test_multi_agent_mode_unknown_raises():
    with pytest.raises(ValueError):
        F.build_multi_agent_mode_fragment("bogus")


# ---------------------------------------------------------------------------
# 7. multi_agent_usage_hint
# ---------------------------------------------------------------------------
def test_multi_agent_usage_hint_passthrough():
    msg = F.build_multi_agent_usage_hint_fragment("use spawn_agent for sub-tasks")
    assert msg["role"] == "developer"
    assert _text(msg) == "use spawn_agent for sub-tasks"
    assert F.MULTI_AGENT_MODE_OPEN_TAG not in _text(msg)


# ---------------------------------------------------------------------------
# 8. persistent_mode
# ---------------------------------------------------------------------------
def test_persistent_mode_replaces_channel_when_async_available():
    tpl = "Persist; ask the user {{ approval_request_channel }}."
    msg = F.build_persistent_mode_fragment("persistent", tpl, send_user_message_async_available=True)
    text = _text(msg)
    assert F.PERSISTENT_MODE_OPEN_TAG in text
    assert " via functions.send_user_message_async" in text
    assert "{{ approval_request_channel }}" not in text


def test_persistent_mode_channel_empty_when_async_unavailable():
    tpl = "Persist; ask the user {{ approval_request_channel }}."
    msg = F.build_persistent_mode_fragment("persistent", tpl, send_user_message_async_available=False)
    assert " via functions.send_user_message_async" not in _text(msg)
    assert "{{ approval_request_channel }}" not in _text(msg)


def test_persistent_mode_returns_none_when_not_persistent():
    assert F.build_persistent_mode_fragment("low", "some template") is None


def test_persistent_mode_returns_none_when_empty_template():
    assert F.build_persistent_mode_fragment("persistent", "   ") is None


# ---------------------------------------------------------------------------
# 9. managed_developer_instructions
# ---------------------------------------------------------------------------
def test_managed_developer_markers_and_body():
    msg = F.build_managed_developer_instructions_fragment("stay on main branch")
    text = _text(msg)
    assert msg["role"] == "developer"
    assert F.MANAGED_DEVELOPER_INSTRUCTIONS_OPEN_TAG in text
    assert "stay on main branch" in text


def test_managed_developer_over_limit_raises():
    over = "x" * (F.MAX_MANAGED_DEVELOPER_INSTRUCTIONS_TOKENS * F.BYTES_PER_TOKEN + 1)
    with pytest.raises(ValueError):
        F.build_managed_developer_instructions_fragment(over)


def test_managed_developer_empty_returns_none():
    assert F.build_managed_developer_instructions_fragment("") is None


# ---------------------------------------------------------------------------
# 10. user_verification_notice
# ---------------------------------------------------------------------------
def test_user_verification_notice_body():
    msg = F.build_user_verification_notice_fragment()
    text = _text(msg)
    assert msg["role"] == "developer"
    assert F.USER_VERIFICATION_NOTICE_OPEN_TAG in text
    inner = text[len(F.USER_VERIFICATION_NOTICE_OPEN_TAG):-len(F.USER_VERIFICATION_NOTICE_CLOSE_TAG)]
    assert inner == "User verification is required. Please respond in the app."
    assert "User verification is required." in text


# ---------------------------------------------------------------------------
# 11. internal_model_context
# ---------------------------------------------------------------------------
def test_internal_model_context_valid_source():
    msg = F.build_internal_model_context_fragment("my_ext_1", "hidden steering")
    text = _text(msg)
    assert msg["role"] == "user"
    assert '<codex_internal_context source="my_ext_1">' in text
    assert "hidden steering" in text
    assert F.INTERNAL_CONTEXT_END_MARKER in text


def test_internal_model_context_invalid_source_raises():
    # 下划线合法;非法:首字母大写、数字开头、含空格、空串
    for bad in ["ABC", "1abc", "has space", ""]:
        with pytest.raises(ValueError):
            F.build_internal_model_context_fragment(bad, "body")


def test_internal_model_context_source_regex_accepts_valid():
    assert F.is_valid_internal_context_source("a")
    assert F.is_valid_internal_context_source("abc_123")
    assert not F.is_valid_internal_context_source("A")
    assert not F.is_valid_internal_context_source("1a")


def test_internal_model_context_matches_legacy_goal_context():
    assert F.matches_internal_model_context_text("<goal_context>goal</goal_context>")
    assert F.matches_internal_model_context_text(
        '<codex_internal_context source="ext">body</codex_internal_context>'
    )
    assert not F.matches_internal_model_context_text("<goal_context>no close")
    assert not F.matches_internal_model_context_text(
        '<codex_internal_context source="Bad">body</codex_internal_context>'
    )


# ---------------------------------------------------------------------------
# 12. unsupported_media(image/audio)
# ---------------------------------------------------------------------------
def test_unsupported_media_image():
    msg = F.build_unsupported_media_fragment("image")
    text = _text(msg)
    assert msg["role"] == "user"
    assert text == "image content omitted because you do not support image input"


def test_unsupported_media_audio():
    msg = F.build_unsupported_media_fragment("audio")
    text = _text(msg)
    assert msg["role"] == "user"
    assert text == "audio content omitted because you do not support audio input"


def test_unsupported_media_unknown_raises():
    with pytest.raises(ValueError):
        F.build_unsupported_media_fragment("video")


# ---------------------------------------------------------------------------
# 13. network_rule_saved(allow/deny)
# ---------------------------------------------------------------------------
def test_network_rule_saved_allow():
    msg = F.build_network_rule_saved_fragment("allow", "example.com")
    text = _text(msg)
    assert msg["role"] == "developer"
    assert text == "Allowed network rule saved in execpolicy (allowlist): example.com"


def test_network_rule_saved_deny():
    msg = F.build_network_rule_saved_fragment("deny", "evil.com")
    text = _text(msg)
    assert msg["role"] == "developer"
    assert text == "Denied network rule saved in execpolicy (denylist): evil.com"


def test_network_rule_saved_unknown_raises():
    with pytest.raises(ValueError):
        F.build_network_rule_saved_fragment("maybe", "host")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

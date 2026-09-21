# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""指令片段构造(2026-09-20 第二十八批,对标 Codex core/src/context/*_instructions.rs)。

每个 build_* 函数返回 OpenAI 消息 dict,role/markers/正文逐字对齐 codex 对应
ContextualUserFragment。英文模板不中文化。

渲染规则与 codex 一致:``render = start_marker + body + end_marker``(markers 为空
则仅 body);body 自带首尾换行。多 agent mode 的 custom 文案按 400 token
(≈4 字节/token)截断;managed developer instructions 超过 10k token 抛 ValueError;
internal_model_context 的 source 须匹配 ``^[a-z][a-z0-9_]*$``。
"""

from __future__ import annotations

import re
from typing import Any

# --- tag / marker 常量(对齐 codex_protocol::protocol 与 world_state/*) ---
APPS_INSTRUCTIONS_OPEN_TAG = "<apps_instructions>"
APPS_INSTRUCTIONS_CLOSE_TAG = "</apps_instructions>"
PLUGINS_INSTRUCTIONS_OPEN_TAG = "<plugins_instructions>"
PLUGINS_INSTRUCTIONS_CLOSE_TAG = "</plugins_instructions>"
ENVIRONMENTS_INSTRUCTIONS_OPEN_TAG = "<environments_instructions>"
ENVIRONMENTS_INSTRUCTIONS_CLOSE_TAG = "</environments_instructions>"
MULTI_AGENT_MODE_OPEN_TAG = "<multi_agent_mode>"
MULTI_AGENT_MODE_CLOSE_TAG = "</multi_agent_mode>"
CODEX_APPS_MCP_SERVER_NAME = "codex_apps"

RECOMMENDED_PLUGINS_OPEN_TAG = "<recommended_plugins>"
RECOMMENDED_PLUGINS_CLOSE_TAG = "</recommended_plugins>"
PERSISTENT_MODE_OPEN_TAG = "<persistent_mode>"
PERSISTENT_MODE_CLOSE_TAG = "</persistent_mode>"
MANAGED_DEVELOPER_INSTRUCTIONS_OPEN_TAG = "<managed_developer_instructions>"
MANAGED_DEVELOPER_INSTRUCTIONS_CLOSE_TAG = "</managed_developer_instructions>"
USER_VERIFICATION_NOTICE_OPEN_TAG = "<user_verification_notice>"
USER_VERIFICATION_NOTICE_CLOSE_TAG = "</user_verification_notice>"
INTERNAL_CONTEXT_START_MARKER = "<codex_internal_context"
INTERNAL_CONTEXT_END_MARKER = "</codex_internal_context>"
LEGACY_GOAL_CONTEXT_START_MARKER = "<goal_context>"
LEGACY_GOAL_CONTEXT_END_MARKER = "</goal_context>"

# --- content_kind(对齐 codex ContentItemKind,作为内部常量参考,不进消息 dict) ---
CONTENT_KIND_APPS_INSTRUCTIONS = "apps.instructions"
CONTENT_KIND_PLUGIN_INSTRUCTIONS = "plugins.instructions"
CONTENT_KIND_AVAILABLE_PLUGINS_INSTRUCTIONS = "plugins.usage_instructions"
CONTENT_KIND_RECOMMENDED_PLUGINS = "plugins.recommendations"
CONTENT_KIND_ENVIRONMENTS_INSTRUCTIONS = "environments.instructions"
CONTENT_KIND_MULTI_AGENT_MODE = "multi_agent.mode_instructions"
CONTENT_KIND_MULTI_AGENT_USAGE_HINT = "multi_agent.usage_hint"
CONTENT_KIND_PERSISTENT_MODE = "persistent_mode.instructions"
CONTENT_KIND_MANAGED_DEVELOPER_INSTRUCTIONS = "managed_config.developer_instructions"
CONTENT_KIND_USER_VERIFICATION_NOTICE = "user_verification.notice"
CONTENT_KIND_NETWORK_RULE_SAVED = "network_proxy.rule_saved"

# --- 上限 / 截断参数(对齐 codex) ---
MULTI_AGENT_MODE_MAX_TOKENS = 400
MAX_RECOMMENDED_PLUGINS = 50
MAX_MANAGED_DEVELOPER_INSTRUCTIONS_TOKENS = 10_000
BYTES_PER_TOKEN = 4  # 近似(对齐 codex approx_bytes_for_tokens)

# --- multi_agent mode  bundled 文案(对齐 codex prompts/src/model_messages/multi_agent.rs) ---
EXPLICIT_REQUEST_ONLY_MULTI_AGENT_MODE_TEXT = (
    "Any earlier instruction enabling proactive multi-agent delegation no longer applies. "
    "Do not spawn sub-agents unless the user or applicable AGENTS.md/skill instructions "
    "explicitly ask for sub-agents, delegation, or parallel agent work."
)
PROACTIVE_MULTI_AGENT_MODE_TEXT = (
    "Proactive multi-agent delegation is active. Any earlier developer instruction requiring "
    "an explicit user request before spawning sub-agents no longer applies. This mode remains "
    "active until a later multi-agent mode developer message changes it. User requests override "
    "this hint.\n\n"
    "If at any point you can parallelize work by delegating tasks to another agent (no matter "
    "if you are root or subagent), you should do so using collaboration tools if it could save "
    "time or improve quality."
)

RECOMMENDED_PLUGINS_INTRO = "Here is a list of plugins that are available but not installed."

# managed / persistent 通知(对齐 codex)
MANAGED_REPLACEMENT_NOTICE = (
    "These managed developer instructions replace all previously provided "
    "managed developer instructions."
)
MANAGED_REMOVAL_NOTICE = (
    "The previously provided managed developer instructions no longer apply."
)
PERSISTENT_REPLACEMENT_NOTICE = (
    "These persistent-mode instructions replace all previously provided "
    "persistent-mode instructions."
)
PERSISTENT_REMOVAL_NOTICE = (
    "The previously provided persistent-mode instructions no longer apply."
)

INTERNAL_CONTEXT_SOURCE_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def _render(role: str, open_marker: str, close_marker: str, body: str) -> dict[str, Any]:
    """对齐 codex ContextualUserFragment::render: marker+body+marker(空 marker 仅 body)。"""
    return {
        "type": "message",
        "role": role,
        "content": [{"type": "input_text", "text": open_marker + body + close_marker}],
    }


def _truncate_text_by_tokens(text: str, max_tokens: int, bytes_per_token: int = BYTES_PER_TOKEN) -> str:
    """近似 codex truncate_text(TruncationPolicy::Tokens):保留 ≤ max_tokens*4 字节。"""
    max_bytes = max_tokens * bytes_per_token
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    truncated = encoded[:max_bytes]
    # 避免切断多字节字符
    while truncated and (truncated[-1] & 0xC0) == 0x80:
        truncated = truncated[:-1]
    return truncated.decode("utf-8", errors="ignore") + "\u2026"


# ---------------------------------------------------------------------------
# 1. apps_instructions
# ---------------------------------------------------------------------------
def build_apps_instructions_fragment() -> dict[str, Any]:
    """`<apps_instructions>`(developer):Apps/Connectors 触发与 tool_search 说明。"""
    body = (
        "\n## Apps (Connectors)\n"
        "Apps (Connectors) can be explicitly triggered in user messages in the format "
        "`[$app-name](app://{connector_id})`. "
        "Apps can also be implicitly triggered as long as the context suggests usage of available apps.\n"
        "An app is equivalent to a set of MCP tools within the `codex_apps` MCP.\n"
        "An installed app's MCP tools are either provided to you already, or can be lazy-loaded "
        "through the `tool_search` tool. If `tool_search` is available, the apps that are "
        "searchable by `tools_search` will be listed by it.\n"
        "Do not additionally call list_mcp_resources or list_mcp_resource_templates for apps.\n"
    )
    return _render(
        "developer",
        APPS_INSTRUCTIONS_OPEN_TAG,
        APPS_INSTRUCTIONS_CLOSE_TAG,
        body,
    )


# ---------------------------------------------------------------------------
# 2. plugin_instructions(generic,markers 为空)
# ---------------------------------------------------------------------------
def build_plugin_instruction_fragment(text: str) -> dict[str, Any]:
    """generic plugin instructions(developer,无 marker 包裹):正文即传入 text。"""
    return _render("developer", "", "", text)


# ---------------------------------------------------------------------------
# 3. available_plugins_instructions(<plugins_instructions>)
# ---------------------------------------------------------------------------
def build_available_plugins_instructions_fragment() -> dict[str, Any]:
    """`<plugins_instructions>`(developer):plugin = skills+MCP+apps 及使用规则。"""
    lines = [
        "## Plugins",
        "A plugin is a local bundle of skills, MCP servers, and apps.",
        "### How to use plugins",
        "- Skill naming: If a plugin contributes skills, those skill entries are prefixed with "
        "`plugin_name:` in the Skills list.",
        "- MCP naming: Plugin-provided MCP tools keep standard MCP identifiers such as "
        "`mcp__server__tool`; use tool provenance to tell which plugin they come from.",
        "- Trigger rules: If the user explicitly names a plugin, prefer capabilities associated "
        "with that plugin for that turn.",
        "- Relationship to capabilities: Plugins are not invoked directly. Use their underlying "
        "skills, MCP tools, and app tools to help solve the task.",
        "- Relevance: Determine what a plugin can help with from explicit user mention or from "
        "the plugin-associated skills, MCP tools, and apps exposed elsewhere in this turn.",
        "- Missing/blocked: If the user requests a plugin that does not have relevant callable "
        "capabilities for the task, say so briefly and continue with the best fallback.",
    ]
    body = "\n" + "\n".join(lines) + "\n"
    return _render(
        "developer",
        PLUGINS_INSTRUCTIONS_OPEN_TAG,
        PLUGINS_INSTRUCTIONS_CLOSE_TAG,
        body,
    )


# ---------------------------------------------------------------------------
# 4. recommended_plugins_instructions(<recommended_plugins>,user,≤50)
# ---------------------------------------------------------------------------
def build_recommended_plugins_instructions_fragment(plugins: list[tuple[str, str]]) -> dict[str, Any]:
    """`<recommended_plugins>`(user):未安装插件列表,每项 \"- name (id)\",截断 ≤50。"""
    shown = plugins[:MAX_RECOMMENDED_PLUGINS]
    listed = "\n".join(f"- {name} ({plugin_id})" for name, plugin_id in shown)
    body = f"\n{RECOMMENDED_PLUGINS_INTRO}\n\n{listed}\n"
    return _render(
        "user",
        RECOMMENDED_PLUGINS_OPEN_TAG,
        RECOMMENDED_PLUGINS_CLOSE_TAG,
        body,
    )


# ---------------------------------------------------------------------------
# 5. environments_instructions(<environments_instructions>)
# ---------------------------------------------------------------------------
def build_environments_instructions_fragment() -> dict[str, Any]:
    """`<environments_instructions>`(developer):多执行环境 / starting 状态说明。"""
    body = (
        "\n## Execution environments\n"
        "Execution environments are separate machines or workspaces with their own files, shell, "
        "and installed capabilities. `<environment_context>` lists the environments selected for "
        "this task.\n\n"
        "An environment marked `starting` is not yet usable. Its files, commands, AGENTS.md "
        "instructions, skills, plugins, and MCP tools may become available when startup completes.\n\n"
        "Wait only when the current task needs that environment. Continue using tools that are "
        "already available for unrelated work.\n"
    )
    return _render(
        "developer",
        ENVIRONMENTS_INSTRUCTIONS_OPEN_TAG,
        ENVIRONMENTS_INSTRUCTIONS_CLOSE_TAG,
        body,
    )


# ---------------------------------------------------------------------------
# 6. multi_agent_mode(<multi_agent_mode>,developer,400 token 截断)
# ---------------------------------------------------------------------------
def build_multi_agent_mode_fragment(mode: str, custom_text: str = "") -> dict[str, Any] | None:
    """`<multi_agent_mode>`(developer):explicit/proactive 用 bundled 文案,custom 截断 400 token。

    mode 取值:``"explicit_request_only"`` / ``"proactive"`` / ``"custom"``。
    custom 且为空 → 返回 None(对齐 Codex from_mode 对空 Custom 的处理)。
    """
    if mode == "custom":
        if not custom_text:
            return None
        text = _truncate_text_by_tokens(custom_text, MULTI_AGENT_MODE_MAX_TOKENS)
    elif mode == "explicit_request_only":
        text = EXPLICIT_REQUEST_ONLY_MULTI_AGENT_MODE_TEXT
    elif mode == "proactive":
        text = PROACTIVE_MULTI_AGENT_MODE_TEXT
    else:
        raise ValueError(
            f"unknown multi_agent_mode {mode!r}; "
            "expected explicit_request_only|proactive|custom"
        )
    return _render(
        "developer",
        MULTI_AGENT_MODE_OPEN_TAG,
        MULTI_AGENT_MODE_CLOSE_TAG,
        text,
    )


# ---------------------------------------------------------------------------
# 7. multi_agent_usage_hint(developer,无 marker 包裹,独立消息)
# ---------------------------------------------------------------------------
def build_multi_agent_usage_hint_fragment(text: str) -> dict[str, Any]:
    """multi_agent.usage_hint(developer,无 marker 包裹):正文即传入 usage hint。"""
    return _render("developer", "", "", text)


# ---------------------------------------------------------------------------
# 8. persistent_mode(<persistent_mode>,developer,占位替换)
# ---------------------------------------------------------------------------
def build_persistent_mode_fragment(
    reasoning_effort: str | None,
    instructions_template: str,
    send_user_message_async_available: bool = False,
) -> dict[str, Any] | None:
    """`<persistent_mode>`(developer):仅 ReasoningEffort::Persistent 注入;替换占位符。

    ``{{ approval_request_channel }}`` → \" via functions.send_user_message_async\"(可用时)
    或空串。非 persistent 或模板为空 → 返回 None。
    """
    if reasoning_effort != "persistent":
        return None
    replacement = (
        " via functions.send_user_message_async"
        if send_user_message_async_available
        else ""
    )
    instructions = instructions_template.strip().replace(
        "{{ approval_request_channel }}", replacement
    )
    if not instructions:
        return None
    return _render(
        "developer",
        PERSISTENT_MODE_OPEN_TAG,
        PERSISTENT_MODE_CLOSE_TAG,
        f"\n{instructions}\n",
    )


# ---------------------------------------------------------------------------
# 9. managed_developer_instructions(<managed_developer_instructions>,developer,10k 上限)
# ---------------------------------------------------------------------------
def build_managed_developer_instructions_fragment(instructions: str) -> dict[str, Any] | None:
    """`<managed_developer_instructions>`(developer):超 10k token 抛 ValueError,空 → None。"""
    if not instructions:
        return None
    rendered_bytes = len(instructions.encode("utf-8"))
    max_bytes = MAX_MANAGED_DEVELOPER_INSTRUCTIONS_TOKENS * BYTES_PER_TOKEN
    if rendered_bytes > max_bytes:
        estimated_tokens = rendered_bytes // BYTES_PER_TOKEN
        raise ValueError(
            f"`additional_developer_instructions` exceeds the model-context limit of "
            f"{MAX_MANAGED_DEVELOPER_INSTRUCTIONS_TOKENS} estimated tokens "
            f"({estimated_tokens} including context markers)"
        )
    return _render(
        "developer",
        MANAGED_DEVELOPER_INSTRUCTIONS_OPEN_TAG,
        MANAGED_DEVELOPER_INSTRUCTIONS_CLOSE_TAG,
        f"\n{instructions}\n",
    )


# ---------------------------------------------------------------------------
# 10. user_verification_notice(<user_verification_notice>)
# ---------------------------------------------------------------------------
def build_user_verification_notice_fragment() -> dict[str, Any]:
    """`<user_verification_notice>`(developer):固定提示文案。"""
    return _render(
        "developer",
        USER_VERIFICATION_NOTICE_OPEN_TAG,
        USER_VERIFICATION_NOTICE_CLOSE_TAG,
        "User verification is required. Please respond in the app.",
    )


# ---------------------------------------------------------------------------
# 11. internal_model_context(<codex_internal_context source="x">,user,source 正则)
# ---------------------------------------------------------------------------
def is_valid_internal_context_source(source: str) -> bool:
    """source 须匹配 ``^[a-z][a-z0-9_]*$``(对齐 Codex InternalContextSource::new)。"""
    return bool(INTERNAL_CONTEXT_SOURCE_RE.match(source))


def matches_internal_model_context_text(text: str) -> bool:
    """兼容 legacy ``<goal_context>`` 与新 ``<codex_internal_context source=\"x\">``。"""
    trimmed = text.strip()
    if (
        trimmed.startswith(LEGACY_GOAL_CONTEXT_START_MARKER)
        and trimmed.endswith(LEGACY_GOAL_CONTEXT_END_MARKER)
    ):
        return True
    rest = trimmed[len(INTERNAL_CONTEXT_START_MARKER):]
    if not rest.startswith(' source="'):
        return False
    source, _, body_and_close = rest[len(' source="'):].partition('">')
    return is_valid_internal_context_source(source) and body_and_close.endswith(
        INTERNAL_CONTEXT_END_MARKER
    )


def build_internal_model_context_fragment(source: str, body: str) -> dict[str, Any]:
    """`<codex_internal_context source=\"x\">`(user):隐藏的内部模型上下文;source 非法抛 ValueError。"""
    if not is_valid_internal_context_source(source):
        raise ValueError(
            f"invalid internal model context source {source!r}; expected [a-z][a-z0-9_]*"
        )
    return _render(
        "user",
        INTERNAL_CONTEXT_START_MARKER,
        INTERNAL_CONTEXT_END_MARKER,
        f' source="{source}">\n{body}\n',
    )


# ---------------------------------------------------------------------------
# 12. unsupported_media(image/audio,user,无 marker 包裹)
# ---------------------------------------------------------------------------
_UNSUPPORTED_MEDIA_TEXT = {
    "image": "image content omitted because you do not support image input",
    "audio": "audio content omitted because you do not support audio input",
}
_UNSUPPORTED_MEDIA_KIND = {
    "image": "images.unsupported",
    "audio": "audio.unsupported",
}


def build_unsupported_media_fragment(media: str) -> dict[str, Any]:
    """image/audio 不支持提示(user,无 marker 包裹):\"... omitted because you do not support ... input\"。"""
    if media not in _UNSUPPORTED_MEDIA_TEXT:
        raise ValueError(f"unknown media {media!r}; expected image|audio")
    return _render("user", "", "", _UNSUPPORTED_MEDIA_TEXT[media])


# ---------------------------------------------------------------------------
# 13. network_rule_saved(allow/deny,developer,无 marker 包裹)
# ---------------------------------------------------------------------------
def build_network_rule_saved_fragment(action: str, host: str) -> dict[str, Any]:
    """\"Allowed/Denied network rule saved in execpolicy (allowlist/denylist): host\"。"""
    if action == "allow":
        verb, list_name = "Allowed", "allowlist"
    elif action == "deny":
        verb, list_name = "Denied", "denylist"
    else:
        raise ValueError(f"unknown network rule action {action!r}; expected allow|deny")
    return _render(
        "developer",
        "",
        "",
        f"{verb} network rule saved in execpolicy ({list_name}): {host}",
    )

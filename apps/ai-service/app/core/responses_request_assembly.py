# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/responses_request_assembly.py
"""Responses 请求装配纯算法 — 2026-09-19 第三十一批,对标 Codex client.rs / codex-api/src/common.rs / protocol/src/response_item_id.rs。

可移植内核（均无会话/传输依赖）:
- build_reasoning: effort 覆盖→模型默认回退、summary 门控(supports_reasoning_summary_parameter 且非 none)、
  responses_lite 下 context=ALL_TURNS 否则缺省(现值 current_turn)。
- create_text_param_for_request: verbosity/output_schema 双空返 None;否则 TextControls(json_schema strict, name=codex_output_schema)。
- stream_options 门控: concurrent_reasoning_summaries 且 is_openai 且 reasoning.summary 非空才发
  REASONING_SUMMARY_DELIVERY=SEQUENTIAL_CUTOFF。
- build_responses_lite_prefix: responses_lite 下把 tools 打包成 additional_tools(developer 角色)项 + base_instructions
  contextual 消息,置于 input 头部;ID 用 uuid5(NAMESPACE_OID, thread_id) 派生确定性后缀
  (at_<uuid5(tools bytes)> / msg_<uuid5(instructions bytes)>),使重试/恢复会话保持 ID 恒定。
- is_prefixed_id / prepare_response_items: 无前缀 ID(非 `<非空>_<非空>` 结构)一律置空防服务端混淆;
  content_item_kinds 关闭时清除 content_item_kinds 透传字段。
- tool_result_metadata_allowed / filter_tool_result_metadata: 仅 https 且 host 在白名单
  (api.openai.com 或允许的 chatgpt host)时保留 tool 结果元数据,否则清除。

判定跳过(耦合证据):
- ModelClient/WebsocketSession/UnauthorizedRecovery/fallback transport: 传输与认证生命周期,属 HTTP 客户端层;
- prewarm_auth/realtime sideband headers: 依赖 AuthManager 与请求头注入点;
- filter_tool_result_metadata 中的 is_allowed_chatgpt_host: Codex 侧 chatgpt 后端域名表,我们以白名单参数注入等价替代。
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

NAMESPACE_OID = uuid.NAMESPACE_OID

REASONING_SUMMARY_DELIVERY_SEQUENTIAL_CUTOFF = "sequential_cutoff"
REASONING_CONTEXT_ALL_TURNS = "all_turns"
OUTPUT_SCHEMA_FORMAT_NAME = "codex_output_schema"
TOOL_RESULT_METADATA_ALLOWED_HOSTS = frozenset({"api.openai.com"})
ITEM_ID_SUFFIX_AT = "at"
ITEM_ID_SUFFIX_MSG = "msg"
LITE_TOOLS_ROLE_DEVELOPER = "developer"
LITE_ADDITIONAL_TOOLS_TYPE = "additional_tools"


def is_prefixed_id(item_id: str) -> bool:
    """`<非空前缀>_<非空后缀>` 视为带本地前缀的 ID;服务端裸 ID(无下划线段)返回 False。"""
    parts = item_id.split("_", 1)
    return len(parts) == 2 and bool(parts[0]) and bool(parts[1])


def derive_prefixed_id(prefix: str, suffix: str) -> str:
    """Codex ResponseItemId::with_suffix 等价: f"{prefix}_{suffix}"。"""
    return f"{prefix}_{suffix}"


def responses_lite_namespace(thread_id: str) -> uuid.UUID:
    """uuid5(NAMESPACE_OID, thread_id) — responses_lite 前缀命名空间。"""
    return uuid.uuid5(NAMESPACE_OID, thread_id)


def responses_lite_deterministic_id(namespace: uuid.UUID, suffix_id: str, kind: str) -> str:
    """`{kind}_{uuid5(namespace, payload)}` — 重试/恢复会话 ID 恒定。"""
    return derive_prefixed_id(kind, str(uuid.uuid5(namespace, suffix_id)))


def build_reasoning(
    effort_override: Optional[str],
    model_default_reasoning_level: Optional[str],
    supports_reasoning_summary_parameter: bool,
    summary_config: Optional[str],
    use_responses_lite: bool,
    resolve_reasoning_effort: Any = None,
) -> dict[str, Any]:
    """Codex build_reasoning 纯化版。

    effort: 覆盖优先,否则模型默认;经 resolve 映射后输出(无映射函数则原样)。
    summary: 仅当模型支持 reasoning summary 参数且配置非 None/"none" 时携带。
    context: responses_lite 才发 ALL_TURNS,否则缺省(Responses 默认 current_turn)。
    """
    effort_value = effort_override if effort_override is not None else model_default_reasoning_level
    if effort_value is not None and resolve_reasoning_effort is not None:
        effort_value = resolve_reasoning_effort(effort_value)
    carry_summary = supports_reasoning_summary_parameter and summary_config not in (None, "none")
    reasoning: dict[str, Any] = {}
    if effort_value is not None:
        reasoning["effort"] = effort_value
    if carry_summary and summary_config is not None:
        reasoning["summary"] = summary_config
    if use_responses_lite:
        reasoning["context"] = REASONING_CONTEXT_ALL_TURNS
    return reasoning


def create_text_param_for_request(
    verbosity: Optional[str],
    output_schema: Optional[dict[str, Any]],
    output_schema_strict: bool,
) -> Optional[dict[str, Any]]:
    """verbosity 与 output_schema 双空返 None;否则 TextControls(json_schema, strict, codex_output_schema)。"""
    if verbosity is None and output_schema is None:
        return None
    text: dict[str, Any] = {}
    if verbosity is not None:
        text["verbosity"] = verbosity
    if output_schema is not None:
        text["format"] = {
            "type": "json_schema",
            "strict": output_schema_strict,
            "schema": output_schema,
            "name": OUTPUT_SCHEMA_FORMAT_NAME,
        }
    return text


def build_stream_options(
    concurrent_reasoning_summaries_enabled: bool,
    is_openai: bool,
    reasoning_summary_present: bool,
) -> Optional[dict[str, str]]:
    """仅三条件齐备才发 sequential_cutoff 流选项。"""
    if concurrent_reasoning_summaries_enabled and is_openai and reasoning_summary_present:
        return {"reasoning_summary_delivery": REASONING_SUMMARY_DELIVERY_SEQUENTIAL_CUTOFF}
    return None


def resolve_verbosity(
    model_support_verbosity: bool,
    model_verbosity: Optional[str],
    model_default_verbosity: Optional[str],
    model_slug: str,
) -> tuple[Optional[str], Optional[str]]:
    """Codex verbosity 门控: 模型不支持时忽略用户设置并告警;支持时用户值优先于默认。返回 (verbosity, warning)。"""
    if model_support_verbosity:
        return (model_verbosity if model_verbosity is not None else model_default_verbosity), None
    warning = (
        f"model_verbosity is set but ignored as the model does not support verbosity: {model_slug}"
        if model_verbosity is not None
        else None
    )
    return None, warning


def build_responses_lite_prefix(
    thread_id: str,
    tools_json: list[dict[str, Any]],
    base_instructions: str,
) -> list[dict[str, Any]]:
    """responses_lite 前缀: additional_tools(developer) 项 + (非空时)base_instructions 消息项,ID 确定性派生。

    tools 空列表仍生成 additional_tools 项(Codex 语义:工具打包项恒存在,内容可为空数组);
    instructions 为空则跳过消息项。
    """
    namespace = responses_lite_namespace(thread_id)
    prefix: list[dict[str, Any]] = [
        {
            "type": LITE_ADDITIONAL_TOOLS_TYPE,
            "id": responses_lite_deterministic_id(namespace, _stable_json_bytes(tools_json), ITEM_ID_SUFFIX_AT),
            "role": LITE_TOOLS_ROLE_DEVELOPER,
            "tools": tools_json,
        }
    ]
    if base_instructions:
        prefix.append(
            {
                "type": "message",
                "id": responses_lite_deterministic_id(namespace, base_instructions, ITEM_ID_SUFFIX_MSG),
                "role": "user",
                "content": base_instructions,
            }
        )
    return prefix


def _stable_json_bytes(value: Any) -> str:
    """与 Rust serde_json::to_vec 等价的确定性序列化(紧凑、键序保持)。"""
    import json

    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def prepare_response_items(
    items: list[dict[str, Any]],
    *,
    content_item_kinds_enabled: bool = True,
) -> list[dict[str, Any]]:
    """发请求前清洗 input 副本: 无前缀 ID 一律置空;content_item_kinds 关闭时清除透传字段。返回新列表不改原数据。"""
    cleaned: list[dict[str, Any]] = []
    for item in items:
        copied = dict(item)
        item_id = copied.get("id")
        if isinstance(item_id, str) and item_id and not is_prefixed_id(item_id):
            copied["id"] = None
        if not content_item_kinds_enabled:
            copied.pop("content_item_kinds", None)
        cleaned.append(copied)
    return cleaned


def tool_result_metadata_allowed(base_url: str, extra_allowed_hosts: frozenset[str] = frozenset()) -> bool:
    """https 且 host 在白名单(api.openai.com ∪ 注入的允许 host 集)才允许 tool 结果元数据透传。"""
    if not base_url.startswith("https://"):
        return False
    remainder = base_url[len("https://") :]
    host = remainder.split("/", 1)[0].split(":", 1)[0].lower()
    return host in (TOOL_RESULT_METADATA_ALLOWED_HOSTS | extra_allowed_hosts)


def filter_tool_result_metadata(
    items: list[dict[str, Any]],
    base_url: str,
    extra_allowed_hosts: frozenset[str] = frozenset(),
) -> list[dict[str, Any]]:
    """白名单外清除 tool 结果元数据字段(codex_tool_result_metadata 等透传键),返回新列表。"""
    if tool_result_metadata_allowed(base_url, extra_allowed_hosts):
        return [dict(item) for item in items]
    cleaned: list[dict[str, Any]] = []
    for item in items:
        copied = dict(item)
        copied.pop("codex_tool_result_metadata", None)
        cleaned.append(copied)
    return cleaned


@dataclass
class RequestRouteTelemetry:
    """Codex RequestRouteTelemetry 等价 — 路由降级链路审计记录。"""

    transport: str
    attempt: int = 0
    fallback_reason: Optional[str] = None
    extra: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "transport": self.transport,
            "attempt": self.attempt,
            "fallback_reason": self.fallback_reason,
            "extra": dict(self.extra),
        }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

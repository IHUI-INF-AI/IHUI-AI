# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:Responses 端点模型级 header + 图像 detail 能力策略 + MCP 元数据投影。

对标 codex:
- responses_headers.rs + client.rs build_responses_headers:按模型作用域的 header 覆盖;
  x-codex-beta-features 逗号拼接 + x-codex-turn-state sticky 路由 token;
  变更需新 socket(注释语义,数据结构无 IO)。
- tools/src/image_detail.rs:supports_image_detail_original 能力位 + Original 不支持时
  替换 DEFAULT_IMAGE_DETAIL(Auto)+ normalize 语义。
- turn_metadata.rs current_meta_value_for_mcp_request:responses payload 去
  agent_name/parent_turn_id/root_turn_id + 加 codex_version + user_input_requested_during_turn。
"""

from __future__ import annotations

from typing import Any

X_CODEX_BETA_FEATURES_HEADER = "x-codex-beta-features"
X_CODEX_TURN_STATE_HEADER = "x-codex-turn-state"

DEFAULT_IMAGE_DETAIL = "auto"

AGENT_NAME_KEY = "agent_name"
PARENT_TURN_ID_KEY = "parent_turn_id"
ROOT_TURN_ID_KEY = "root_turn_id"
CODEX_VERSION_KEY = "codex_version"
USER_INPUT_REQUESTED_DURING_TURN_KEY = "user_input_requested_during_turn"
TOOL_NAMESPACES_INFO_KEY = "tool_namespaces_info"


class CodexResponsesHeaders:
    """按模型作用域的 Responses header 覆盖(仅 Codex 后端;变更需新 socket)。"""

    def __init__(self, model: str, headers: dict[str, str] | None = None) -> None:
        self.model = model
        self.headers: dict[str, str] = dict(headers or {})

    def __repr__(self) -> str:  # 对齐 codex Debug:只暴露 header 名不暴露值
        return f"CodexResponsesHeaders(model={self.model!r}, header_names={list(self.headers)!r})"


def build_responses_headers(
    beta_features: list[str] | None = None,
    turn_state: str | None = None,
) -> dict[str, str]:
    """beta 特性键逗号拼接 + sticky 路由 token;空值跳过。"""
    headers: dict[str, str] = {}
    value = ",".join(beta_features or [])
    if value:
        headers[X_CODEX_BETA_FEATURES_HEADER] = value
    if turn_state:
        headers[X_CODEX_TURN_STATE_HEADER] = turn_state
    return headers


# ---------- image detail 能力策略 ----------


def can_request_original_image_detail(model_supports_original: bool) -> bool:
    return bool(model_supports_original)


def normalize_output_image_detail(
    model_supports_original: bool,
    detail: str | None,
) -> str | None:
    if detail == "original":
        return "original" if model_supports_original else None
    if detail is None:
        return None
    return detail


def sanitize_original_image_detail(
    can_request_original: bool,
    items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """不支持 original 时把工具输出图像条目 detail==original 原地替换为 DEFAULT(auto)。"""
    if can_request_original:
        return items
    for item in items:
        if item.get("type") == "input_image" and item.get("detail") == "original":
            item["detail"] = DEFAULT_IMAGE_DETAIL
    return items


# ---------- MCP 请求元数据投影 ----------


def build_mcp_metadata_projection(
    payload_metadata: dict[str, Any],
    codex_version: str,
    *,
    user_input_requested: bool,
) -> dict[str, Any] | None:
    """responses payload 元数据的外发投影:harness 拥有的字段剥除,补版本与用户输入标记。"""
    if not isinstance(payload_metadata, dict):
        return None
    metadata = dict(payload_metadata)
    # Never serialize harness-owned tool inventory for external MCP servers.
    metadata.pop(TOOL_NAMESPACES_INFO_KEY, None)
    if not metadata:
        return None
    metadata.pop(AGENT_NAME_KEY, None)
    metadata.pop(PARENT_TURN_ID_KEY, None)
    metadata.pop(ROOT_TURN_ID_KEY, None)
    metadata[CODEX_VERSION_KEY] = codex_version
    if user_input_requested:
        metadata[USER_INPUT_REQUESTED_DURING_TURN_KEY] = True
    else:
        metadata.pop(USER_INPUT_REQUESTED_DURING_TURN_KEY, None)
    return metadata

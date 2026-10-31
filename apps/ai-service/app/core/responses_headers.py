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
#
# 2026-10-31 接线(治「已实现零调用方」):本节三个判据函数自批58 落地起**只有测试在调**,
# 生产面(`llm_gateway._apply_responses_headers`)一次都没经过它们 ⇒ 厂商不支持 original 时
# 请求照原样把原图档发出去(静默失真:上游要么 400、要么自行按低档重采样,而账面写着有闸)。
# 现在出站装配路径经 `sanitize_messages_original_image_detail` 走这一节,判定实现仍只有这一份。

#: original 档的档名(唯一字面量,判据里不再散写)。
ORIGINAL_IMAGE_DETAIL = "original"

#: 支持 original 图像 detail 档的 provider_code 名单(**唯一清单**)。
#: 判据来源 = 本模块头注对标的 codex `tools/src/image_detail.rs`:
#: `supports_image_detail_original` 是模型级能力位,名单外一律按「不支持」处理并降为
#: DEFAULT_IMAGE_DETAIL —— 拿不到能力位时把原图档静默发给厂商,正是本次要根治的失真;
#: 反过来多降一档只是画质回落 auto,不报错、不改协议。新增厂商必须带一手证据在此登记,
#: 不得在别处(网关/端内)再抄一份名单(§0.6)。
ORIGINAL_IMAGE_DETAIL_PROVIDERS: frozenset[str] = frozenset({"openai"})

#: 带 detail 档的图像条目类型,两种线格式都覆盖:
#: Responses 面的 `input_image` 与 chat.completions 面的 `image_url`。
#: 网关实际发往厂商的是后者(litellm.acompletion messages),只判前者等于没有闸。
IMAGE_DETAIL_ITEM_TYPES: frozenset[str] = frozenset({"input_image", "image_url"})


def provider_supports_original_image_detail(provider_code: str) -> bool:
    """能力位取值唯一出口:provider_code 在名单内才算支持(空串/未知厂商 ⇒ 不支持)。"""
    return can_request_original_image_detail(provider_code in ORIGINAL_IMAGE_DETAIL_PROVIDERS)


def can_request_original_image_detail(model_supports_original: bool) -> bool:
    return bool(model_supports_original)


def normalize_output_image_detail(
    model_supports_original: bool,
    detail: str | None,
) -> str | None:
    if detail == ORIGINAL_IMAGE_DETAIL:
        return ORIGINAL_IMAGE_DETAIL if model_supports_original else None
    if detail is None:
        return None
    return detail


def sanitize_original_image_detail(
    can_request_original: bool,
    items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """不支持 original 时把图像条目 detail==original 原地替换为 DEFAULT(auto)。

    降档值经 `normalize_output_image_detail` 归一(不支持 ⇒ None ⇒ 回落默认档),
    本函数不自带第二份 original 判定;支持 ⇒ 整表原样返回(逐字节不变)。
    """
    if can_request_original_image_detail(can_request_original):
        return items
    for item in items:
        if not isinstance(item, dict) or item.get("type") not in IMAGE_DETAIL_ITEM_TYPES:
            continue
        if item.get("detail") != ORIGINAL_IMAGE_DETAIL:
            continue
        normalized = normalize_output_image_detail(False, ORIGINAL_IMAGE_DETAIL)
        item["detail"] = DEFAULT_IMAGE_DETAIL if normalized is None else normalized
    return items


def collect_image_detail_items(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """从 chat 消息列表取出**可原地修改**的图像条目(返回同一对象引用,不是副本)。

    content 为字符串时无档位可言;list 形态才逐 part 判 type;非 dict 项静默跳过。
    """
    items: list[dict[str, Any]] = []
    for message in messages or []:
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if not isinstance(content, list):
            continue
        for part in content:
            if isinstance(part, dict) and part.get("type") in IMAGE_DETAIL_ITEM_TYPES:
                items.append(part)
    return items


def sanitize_messages_original_image_detail(
    messages: list[dict[str, Any]],
    provider_code: str,
) -> int:
    """整条请求的 original 档能力闸(出站前唯一处理点)。

    支持 ⇒ 原样;不支持 ⇒ 把 detail==original 的图像条目降为 DEFAULT_IMAGE_DETAIL。
    返回值 = **实际被降档的条目数**(0 既表示没有原图档请求,也表示厂商支持),
    调用方据此决定是否留痕;本函数不写新键、不新建 list ⇒ 无原图档时 kwargs 逐字节不变。
    """
    items = collect_image_detail_items(messages)
    originals = [item for item in items if item.get("detail") == ORIGINAL_IMAGE_DETAIL]
    if not originals:
        return 0
    # sanitize 原地改同一批对象,故下面直接回读 originals 里每一条的最终档位。
    sanitize_original_image_detail(
        provider_supports_original_image_detail(provider_code), items
    )
    # 只数真被改掉的那些:支持厂商走原样分支,一条也不会被计入。
    return sum(1 for item in originals if item.get("detail") != ORIGINAL_IMAGE_DETAIL)


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

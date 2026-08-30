"""Anthropic 原生 tools 格式适配层(纯函数,无 I/O)。

CLI 侧 function calling 下发的 tools schema 是 OpenAI 格式:
    [{type: "function", function: {name, description, parameters: {...}}}]

Anthropic Messages API 需要的 tools 格式:
    [{name, description, input_schema: {...}}]

响应侧 Anthropic 的工具调用是 content block:
    {type: "tool_use", id, name, input}

OpenAI 风格是 tool_calls:
    [{id, type: "function", function: {name, arguments: "<json str>"}}]

本模块提供双向纯函数转换,供 AnthropicProvider 请求组装 / 响应解析复用,
SSE 层统一以 OpenAI 风格 tool-call 事件下发。
"""

from __future__ import annotations

import copy
import json
from typing import Any

# Anthropic 模型前缀(与 llm_gateway._PREFIX_TO_PROVIDER_CODE 的
# "anthropic/" / "claude-" / "claude" 映射保持一致)
_ANTHROPIC_MODEL_PREFIXES = ("claude-", "anthropic/")


def is_anthropic_model(model: str | None, provider_code: str | None = None) -> bool:
    """判定目标模型/provider 是否为 Anthropic(claude 系列)。

    Args:
        model: 模型名(可含厂商前缀,如 anthropic/claude-3-5-sonnet)。
        provider_code: 可选的 provider 编码(ai_model_config.provider_code),
            显式传入 "anthropic" 时直接判定为 True(优先于模型名启发)。

    Returns:
        True 表示走 Anthropic 原生 tools 适配路径。
    """
    if provider_code and provider_code.lower() == "anthropic":
        return True
    m = (model or "").lower().strip()
    if not m:
        return False
    if m.startswith(_ANTHROPIC_MODEL_PREFIXES):
        return True
    # 无前缀裸模型名(如 claude-3-5-sonnet-20241022),claude 后必须紧跟
    # "-" 或结尾,避免误匹配 claudette-x 之类
    if m.startswith("claude"):
        rest = m[len("claude"):]
        return rest == "" or rest[0] in "-/._0123456789"
    return False


def openai_tools_to_anthropic(
    tools: list[dict[str, Any]] | None,
) -> list[dict[str, Any]] | None:
    """OpenAI function calling tools → Anthropic tools(input_schema 格式)。

    - function 类型:{type, function:{name, description, parameters}} →
      {name, description, input_schema};input_schema 深拷贝自 parameters,
      递归保留全部嵌套字段(properties/required/items/anyOf/$defs 等)。
    - 非 function 类型(如 Anthropic 原生 computer use block)深拷贝透传。
    - 深拷贝语义:返回结果与入参不共享任何引用,调用方修改互不影响。

    Args:
        tools: OpenAI 格式 tools 列表,None 或空列表返回 None(无工具可传)。

    Returns:
        Anthropic 格式 tools 列表,或 None。
    """
    if not tools:
        return None
    converted: list[dict[str, Any]] = []
    for t in tools:
        if not isinstance(t, dict):
            continue
        fn = t.get("function")
        if t.get("type") == "function" and isinstance(fn, dict):
            converted.append({
                "name": fn.get("name"),
                "description": fn.get("description", ""),
                "input_schema": copy.deepcopy(
                    fn.get("parameters", {"type": "object", "properties": {}})
                ),
            })
        else:
            converted.append(copy.deepcopy(t))
    return converted


def anthropic_response_to_openai(
    response: dict[str, Any] | list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Anthropic 响应中的 tool_use content block → OpenAI tool_calls 形态。

    支持三种输入:
    - 完整 Messages API 响应 dict:{"content": [{type: "tool_use", ...}, ...]}
    - content blocks 列表:[{type: "tool_use", id, name, input}, ...]
    - 单个 tool_use block dict:{type: "tool_use", id, name, input}

    转换规则(OpenAI tool_calls 形态,供 SSE 层统一以 OpenAI 风格
    tool-call 事件下发):
    - id: 透传 block.id(缺失时空串)
    - type: "function"
    - function.name: 透传 block.name
    - function.arguments: json.dumps(block.input)(ensure_ascii=False)

    Args:
        response: Anthropic 响应 dict / content blocks 列表 / 单个 tool_use block。

    Returns:
        OpenAI 风格 tool_calls 列表(无 tool_use 时为空列表)。
    """
    if response is None:
        return []
    blocks: Any
    if isinstance(response, dict):
        if response.get("type") == "tool_use":
            blocks = [response]
        else:
            content = response.get("content")
            blocks = content if isinstance(content, list) else []
    elif isinstance(response, list):
        blocks = response
    else:
        return []

    tool_calls: list[dict[str, Any]] = []
    for block in blocks:
        if isinstance(block, dict) and block.get("type") == "tool_use":
            tool_calls.append({
                "id": block.get("id") or "",
                "type": "function",
                "function": {
                    "name": block.get("name") or "",
                    "arguments": json.dumps(block.get("input") or {}, ensure_ascii=False),
                },
            })
    return tool_calls

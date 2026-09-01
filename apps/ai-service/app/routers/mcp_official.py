# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

"""官方 MCP 协议兼容层(streamable HTTP 风格,JSON-RPC 2.0 单入口)。

在**不动内部自研 JSON-RPC 引擎**(mcp_server.py)的前提下,把现有 48+ 个工具以官方
MCP 协议(initialize / tools/list / tools/call / ping)暴露给任意 MCP 客户端
(Claude Desktop / Cursor / 自研 8 端),是"MCP 应用商店"的第一步地基工程。

对齐规范: https://modelcontextprotocol.io/specification
- JSON-RPC 2.0 请求/响应信封(jsonrpc/id/result 或 error)
- 单 POST 端点,请求体为单个 JSON-RPC 消息(简化单请求-单响应)
- initialize 握手 + notifications/initialized 确认
- tools/list → {tools: [{name, description, inputSchema}]}(inputSchema 直接复用
  内部 _TOOLS 的 input_schema)
- tools/call → {content: [{type: "text", text}], isError: bool}
- 权限:带 Bearer 时由 JWTAuthMiddleware 注入 request.state.user_id,透传给
  mcp_server.call_tool;匿名 → user_id=None,高危工具由权限矩阵兜底拒绝(安全默认)。

方法分发:
- initialize → 协议握手(版本 + 能力声明 + serverInfo)
- notifications/* → 空响应(通知无 id)
- ping → {}
- tools/list → 全部工具(名称/描述/schema)
- tools/call → 执行工具(权限矩阵校验,结果序列化为 text content)
- 其他 → JSON-RPC -32601 Method not found
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..services.mcp_server import _PROMPTS, _RESOURCES, _TOOLS, mcp_server

logger = logging.getLogger(__name__)

router = APIRouter()

# MCP 协议版本(兼容 2025-03-26 / 2025-06-18 两个已发布版本)
MCP_PROTOCOL_VERSION = "2025-06-18"
SERVER_NAME = "ihui-ai-ai-service"
SERVER_VERSION = "1.0.0"

# JSON-RPC 错误码(MCP 规范)
ERR_PARSE = -32700
ERR_INVALID_REQUEST = -32600
ERR_METHOD_NOT_FOUND = -32601
ERR_INVALID_PARAMS = -32602
ERR_INTERNAL = -32603


def _jsonrpc_error(code: int, message: str, data: Any = None) -> dict[str, Any]:
    """构造 JSON-RPC 错误响应。"""
    err: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "error": err}


def _jsonrpc_result(result: Any, msg_id: Any | None) -> dict[str, Any]:
    """构造 JSON-RPC 成功响应。"""
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def _handle_initialize(params: dict[str, Any]) -> dict[str, Any]:
    """MCP initialize 握手:声明能力与服务器信息。"""
    return {
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": {
            "tools": {"listChanged": False},
            "resources": {},
            "prompts": {},
            "logging": {},
        },
        "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
    }


def _handle_tools_list() -> dict[str, Any]:
    """tools/list:返回全部工具的官方 MCP schema。"""
    tools = [
        {
            "name": t.name,
            "description": t.description,
            "inputSchema": t.input_schema,
        }
        for t in _TOOLS
    ]
    return {"tools": tools}


def _handle_resources_list() -> dict[str, Any]:
    """resources/list:返回内部资源定义(会话记忆/skill/配置)。"""
    resources = [
        {
            "uri": r.uri,
            "name": r.name,
            "description": r.description,
            "mimeType": r.mime_type,
        }
        for r in _RESOURCES
    ]
    return {"resources": resources}


def _handle_prompts_list() -> dict[str, Any]:
    """prompts/list:返回内部提示词定义(代码审查/Bug 修复等)。"""
    prompts = [
        {
            "name": p.name,
            "description": p.description,
            "arguments": p.arguments,
        }
        for p in _PROMPTS
    ]
    return {"prompts": prompts}


async def _handle_tools_call(
    params: dict[str, Any], *, user_id: str | None
) -> dict[str, Any]:
    """tools/call:执行工具,结果包装为 MCP text content。"""
    name = str(params.get("name", "")).strip()
    if not name:
        raise ValueError("name 不能为空")
    arguments = params.get("arguments") or {}
    if not isinstance(arguments, dict):
        raise ValueError("arguments 必须是对象")

    # 权限透传:匿名 → user_id=None(user_role=0),高危工具由权限矩阵拒绝
    result = await mcp_server.call_tool(
        name,
        arguments,
        user_role=0,
        user_id=user_id,
        session_id=None,
    )
    is_error = bool(result.get("ok") is False or result.get("error"))
    text = json.dumps(result, ensure_ascii=False, default=str)
    return {
        "content": [{"type": "text", "text": text}],
        "isError": is_error,
    }


def _dispatch_method(method: str) -> tuple[str, str]:
    """方法名分类:('handler', method) / ('notification', method) / ('unknown', method)。"""
    if method in {
        "initialize", "tools/list", "tools/call", "ping",
        "resources/list", "prompts/list",
    }:
        return "handler", method
    if method.startswith("notifications/"):
        return "notification", method
    return "unknown", method


@router.post("/mcp")
async def mcp_official_endpoint(request: Request) -> JSONResponse:
    """官方 MCP 协议单入口(streamable HTTP 简化版)。

    请求体:单个 JSON-RPC 2.0 消息。
    - 有 id → 返回 result/error 信封
    - 通知(id 为空) → 返回空 JSON(200)
    """
    raw = await request.body()
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        return JSONResponse(
            _jsonrpc_error(ERR_PARSE, "Parse error"), status_code=400
        )

    if not isinstance(payload, dict):
        return JSONResponse(
            _jsonrpc_error(ERR_INVALID_REQUEST, "Invalid Request"), status_code=400
        )

    method = str(payload.get("method", ""))
    params = payload.get("params") or {}
    if not isinstance(params, dict):
        params = {}
    msg_id = payload.get("id")

    kind, _ = _dispatch_method(method)

    if kind == "notification":
        # 通知(无 id):仅确认,返回空响应
        return JSONResponse({}, status_code=200)

    if kind == "unknown":
        err = _jsonrpc_error(ERR_METHOD_NOT_FOUND, f"Method not found: {method}")
        err["id"] = msg_id
        return JSONResponse(err, status_code=404)

    # 已认证用户透传(匿名为 None)
    user_id: str | None = getattr(request.state, "user_id", None)

    try:
        if method == "initialize":
            result = _handle_initialize(params)
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = _handle_tools_list()
        elif method == "resources/list":
            result = _handle_resources_list()
        elif method == "prompts/list":
            result = _handle_prompts_list()
        elif method == "tools/call":
            result = await _handle_tools_call(params, user_id=user_id)
        else:  # pragma: no cover - _dispatch_method 已过滤
            raise ValueError(f"unsupported method: {method}")
    except ValueError as e:
        err = _jsonrpc_error(ERR_INVALID_PARAMS, str(e))
        err["id"] = msg_id
        return JSONResponse(err, status_code=400)
    except Exception as e:  # noqa: BLE001 - 工具执行异常统一包装为 JSON-RPC 错误
        logger.exception("[mcp_official] tools/call 执行异常: %s", e)
        err = _jsonrpc_error(ERR_INTERNAL, f"Internal error: {e}")
        err["id"] = msg_id
        return JSONResponse(err, status_code=500)

    return JSONResponse(_jsonrpc_result(result, msg_id), status_code=200)

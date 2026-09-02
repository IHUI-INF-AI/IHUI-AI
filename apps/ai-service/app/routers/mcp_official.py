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
- tools/list → {tools: [{name, description, inputSchema}], toolsVersion}(inputSchema
  直接复用内部 _TOOLS 的 input_schema,toolsVersion 为 ETag 风格版本号)
- tools/call → {content: [{type: "text", text}], isError: bool}
- 权限:带 Bearer 时由 JWTAuthMiddleware 注入 request.state.user_id,透传给
  mcp_server.call_tool;匿名 → user_id=None,高危工具由权限矩阵兜底拒绝(安全默认)。

设计取舍(2026-09-02 立):本层是**无状态直通**,tools/list 每次实时枚举 _TOOLS,不缓存
工具副本。故 notifications/tools/list_changed 不"失效缓存",而是自增模块级版本号
_TOOLS_VERSION,再由 tools/list 的 toolsVersion 字段暴露给客户端比对;未知通知方法一律
返回空 result(JSON-RPC 规范:通知不得产生 error)。

方法分发:
- initialize → 协议握手(版本 + 能力声明 listChanged=True + serverInfo)
- notifications/* → 空响应(通知无 id);list_changed 触发 _TOOLS_VERSION 自增
- ping → {}
- tools/list → 全部工具(名称/描述/schema)+ toolsVersion
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

# 工具集版本号(2026-09-02 立):本层是无状态直通,tools/list 每次实时枚举 _TOOLS,
# 不缓存。因此收到 notifications/tools/list_changed 时不做"缓存失效",而是把本版本号
# 自增,tools/list 在响应中附带 toolsVersion 字段(ETag 风格),供客户端比对判断是否需要
# 重新拉取工具集。初始为 0,每次 list_changed 通知 +1。
_TOOLS_VERSION: int = 0


def get_tools_version() -> int:
    """返回当前工具集版本号(每次 tools/list_changed 通知自增)。

    供测试与 MCP 客户端在 tools/list 响应的 toolsVersion 字段中比对,判断工具集变化。
    """
    return _TOOLS_VERSION

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
    """MCP initialize 握手:声明能力与服务器信息。

    声明 tools.listChanged=True,告知客户端服务端支持 tools/list_changed 通知,
    客户端可据此在收到通知后重新拉取工具集(配合 tools/list 的 toolsVersion 字段)。
    """
    return {
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": {
            "tools": {"listChanged": True},
            "resources": {},
            "prompts": {},
            "logging": {},
        },
        "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
    }


def _handle_tools_list() -> dict[str, Any]:
    """tools/list:返回全部工具的官方 MCP schema。

    本层无状态直通(实时枚举 _TOOLS,无缓存),并附带 toolsVersion 字段(ETag 风格):
    客户端可比对上一次的值,仅在收到 tools/list_changed 通知且版本号变化时重新拉取。
    """
    tools = [
        {
            "name": t.name,
            "description": t.description,
            "inputSchema": t.input_schema,
        }
        for t in _TOOLS
    ]
    return {"tools": tools, "toolsVersion": _TOOLS_VERSION}


def _handle_notification(method: str) -> dict[str, Any]:
    """处理 JSON-RPC 通知(无 id,无需回包,返回空 result)。

    设计取舍:本层是**无状态直通**——tools/list 每次实时枚举 _TOOLS,服务端不持有工具
    缓存。因此 notifications/tools/list_changed 不做"缓存失效",而是把模块级版本号
    _TOOLS_VERSION 自增,再由 tools/list 的 toolsVersion 字段(ETag 风格)暴露给客户端,
    由客户端决定是否需要重新拉取。这等价于把"失效"语义上移到版本号比对,避免维护缓存副本。
    未知通知名仅记录 debug 日志,一律返回空 result(符合 JSON-RPC:通知不得产生 error)。

    Returns:
        空 result(供端点回包为 {} )。
    """
    global _TOOLS_VERSION
    if method == "notifications/tools/list_changed":
        _TOOLS_VERSION += 1
        logger.info(
            "[mcp_official] 收到 notifications/tools/list_changed,工具版本号自增 → %d",
            _TOOLS_VERSION,
        )
    else:
        logger.debug("[mcp_official] 忽略未知通知: %s", method)
    return {}


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


def _handle_prompts_get(params: dict[str, Any]) -> dict[str, Any]:
    """prompts/get:按名称返回单个提示词定义,不存在返回 prompt=None。"""
    name = str(params.get("name", "")).strip()
    if not name:
        raise ValueError("name 不能为空")
    for p in _PROMPTS:
        if p.name == name:
            return {
                "prompt": {
                    "name": p.name,
                    "description": p.description,
                    "arguments": p.arguments,
                }
            }
    return {"prompt": None}


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
        "resources/list", "prompts/list", "prompts/get",
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
        # 通知(无 id):处理(如 list_changed 自增版本号)后返回空 result,
        # 未知通知方法也返回空 result 而非 error(JSON-RPC 规范:通知不产生 error)。
        _handle_notification(method)
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
        elif method == "prompts/get":
            result = _handle_prompts_get(params)
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

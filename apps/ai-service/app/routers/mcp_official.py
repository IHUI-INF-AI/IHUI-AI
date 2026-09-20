# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""官方 MCP 协议兼容层(streamable HTTP 风格,JSON-RPC 2.0 单入口)。

在**不动内部自研 JSON-RPC 引擎**(mcp_server.py)的前提下,把现有 86 个工具以官方
MCP 协议暴露给任意 MCP 客户端(Claude Desktop / Cursor / 自研 8 端)。

对齐规范: https://modelcontextprotocol.io/specification

O9「MCP server 协议完整化」(2026-09-21)把"能连上"推进到"协议语义正确":

1. **版本协商**:按客户端 ``protocolVersion`` 协商 —— 命中支持集合就回显同值,否则回
   服务端最新支持版本,并在 ``result._meta[NEGOTIATION_META_KEY]`` 注明请求值/协商值/原因
   (规范只要求回 protocolVersion,附加说明放 _meta 不污染标准字段)。
2. **能力如实声明**:只声明本层真的实现了的东西。本层是**单请求-单响应的无状态直通**,
   没有服务端主动推送通道,因此 ``tools.listChanged`` / ``resources.subscribe`` /
   ``resources.listChanged`` 一律 **false**(不受理对应方法,直接 -32601);此前虚报的
   ``logging`` 能力(未实现 logging/setLevel)已删除。真正的服务端→客户端广播在
   ``/api/mcp/export/*``(SSE / streamable 长连接)由 ``mcp_export`` 承担。
3. **resources 完整化**:实现 ``resources/read``(按 ``RESOURCE_SCOPES`` 逐资源要 scope,
   走 ``enforce_scope``);``resources/list`` 视图与裁决同源(读不到的资源不列);
   未在 MCP 面登记的 URI(含引擎内部实现用的 ``sampling://handler``)一律 -32602 拒绝。
4. **batching**:接受 JSON-RPC 数组批量请求,逐元素独立派发、逐元素结果(授权/限流失败
   以该元素的 JSON-RPC error 表达,不牵连其他元素);纯通知批 → 202 空体。
   注:2025-06-18 起规范不再要求服务端支持批量,本层保留**宽松兼容**(超集行为)。
5. **progress**:带 ``params._meta.progressToken`` 的 tools/call,若客户端 Accept 里带
   ``text/event-stream``,本层把该 POST 的响应升级为 SSE 流:先发 progress=0 受理帧,
   执行期按节拍发真实"已耗时"进度帧,最后一帧是该请求的 JSON-RPC 响应(同 id)。
   不带该 Accept 时按普通 JSON 单响应处理(进度帧无通道可推,不做假实现)。
6. **工具元数据**:tools/list 对每个已登记工具输出 ``annotations``,四项 hint 全部由能力
   目录(dataClass/risk/domain/idempotencyRequired)推导,与 export 层逐字一致。
   ``outputSchema`` 在**本层不声明**:tools/call 只回 text content、不回 structuredContent,
   声明 schema 等于虚报(规范:声明了就必须按 schema 给 structuredContent)。
7. **按 key 限流**:机器凭据通道(``principal.is_machine_channel``)对 tools/call 与
   resources/read 走 ``rateProfileOf(scope)`` 的 rpm/burst/concurrent 闸;超限 HTTP 429
   + JSON-RPC error(data 带 ``errorCode=RATE_LIMITED`` 与 ``retryAfterMs``),与既有
   401/403 的双表达口径一致。跨实例配额由 apps/api 网关层结算(见 capability_gate 注释)。

方法与分发:
- initialize / notifications/* / ping
- tools/list / tools/call
- resources/list / resources/read
- prompts/list / prompts/get(get 同时回标准 messages 与历史 prompt 定义字段)
- 其他 → JSON-RPC -32601 Method not found

权限:O1 起强制凭据(IHUI JWT 或内网 X-IHUI-Principal),匿名一律 401;工具/资源级授权
由 capability_gate 按能力目录(capabilities.json)裁决。
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from contextlib import suppress
from typing import Any, Final

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from ..services.capability_gate import (
    Principal,
    PrincipalAuthError,
    RateLimitExceeded,
    ScopeDeniedError,
    annotation_hints_for_tool,
    await_with_progress_heartbeat,
    check_tool_access,
    enforce_rate_limit,
    enforce_scope,
    enforce_tool_access,
    refresh_tools_revision,
    resolve_principal_from_headers,
    scope_of_resource,
    tools_revision,
)
from ..services.mcp_server import _PROMPTS, _RESOURCES, _TOOLS, MCPResource, mcp_server

logger = logging.getLogger(__name__)

router = APIRouter()

# 本层真实实现的协议版本集合(2025-03-26 引入 streamable HTTP;2025-06-18 是当前上限)。
# 不虚报:2025-11-25 起的 per-request 信封 / structuredContent 强绑定 / subscriptions/listen
# 由 mcp_export(官方 SDK transport)承载,本手写带内层不声明、不协商。
SUPPORTED_PROTOCOL_VERSIONS: Final[tuple[str, ...]] = ("2025-03-26", "2025-06-18")
MCP_PROTOCOL_VERSION: Final = SUPPORTED_PROTOCOL_VERSIONS[-1]
SERVER_NAME: Final = "ihui-ai-ai-service"
SERVER_VERSION: Final = "1.0.0"
SERVER_INSTRUCTIONS: Final = (
    "IHUI AI 工具面。所有方法均需凭据(IHUI JWT 或内网 X-IHUI-Principal);"
    "工具可见集与可调用集同源,由能力目录逐工具裁决。"
)
# initialize 结果里说明"客户端要的版本 vs 实际协商结果"的 _meta 键(非标准字段放 _meta,
# 不污染 protocolVersion 语义)。
NEGOTIATION_META_KEY: Final = "ihui-ai/protocolVersionNegotiation"
# 批量请求上限(防放大:一个 HTTP 请求里塞几百个 tools/call)
MAX_BATCH_SIZE: Final = 32
# 长任务进度心跳间隔(秒)
PROGRESS_HEARTBEAT_INTERVAL_S: Final = 2.0

# JSON-RPC 错误码(MCP 规范)
ERR_PARSE = -32700
ERR_INVALID_REQUEST = -32600
ERR_METHOD_NOT_FOUND = -32601
ERR_INVALID_PARAMS = -32602
ERR_INTERNAL = -32603

# SSE 升级判定用的 Accept 值
ACCEPT_EVENT_STREAM = "text/event-stream"

# 兼容旧引用:工具版本号已上移到 capability_gate(两端共用一个计数器),
# get_tools_version() 保留为读接口。
def get_tools_version() -> int:
    """当前工具集版本号(每次真实变更 +1;tools/list 以 toolsVersion 暴露)。"""
    return tools_revision()


def _jsonrpc_error(code: int, message: str, data: Any = None, msg_id: Any | None = None) -> dict[str, Any]:
    """构造 JSON-RPC 错误响应。"""
    err: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": msg_id, "error": err}


def _jsonrpc_result(result: Any, msg_id: Any | None) -> dict[str, Any]:
    """构造 JSON-RPC 成功响应。"""
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


# ---------------------------------------------------------------------------
# 1. 版本协商 + 能力声明
# ---------------------------------------------------------------------------


def negotiate_protocol_version(requested: object) -> tuple[str, str | None]:
    """按客户端 protocolVersion 协商。

    Returns:
        (协商结果, 回退说明)。说明为 None 表示客户端要的版本被原样满足。
    """
    if not isinstance(requested, str) or not requested.strip():
        return MCP_PROTOCOL_VERSION, "客户端未声明 protocolVersion,按服务端最新支持版本回告"
    want = requested.strip()
    if want in SUPPORTED_PROTOCOL_VERSIONS:
        return want, None
    return MCP_PROTOCOL_VERSION, f"客户端请求 {want} 不在支持集合内,回服务端最新支持版本"


def server_capabilities() -> dict[str, Any]:
    """能力声明:**只报本层真做到的**。

    本端点无服务端→客户端长连接,故 listChanged / subscribe 全 false(对应方法不受理);
    未实现 logging/setLevel,故不出现 logging 键(此前声明了但没实现 = 虚报,已删)。
    """
    return {
        "tools": {"listChanged": False},
        "resources": {"subscribe": False, "listChanged": False},
        "prompts": {"listChanged": False},
    }


def _handle_initialize(params: dict[str, Any]) -> dict[str, Any]:
    """MCP initialize 握手:协商版本 + 如实声明能力 + serverInfo。"""
    requested = params.get("protocolVersion")
    negotiated, note = negotiate_protocol_version(requested)
    result: dict[str, Any] = {
        "protocolVersion": negotiated,
        "capabilities": server_capabilities(),
        "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        "instructions": SERVER_INSTRUCTIONS,
    }
    if note is not None:
        result["_meta"] = {
            NEGOTIATION_META_KEY: {
                "requested": requested if isinstance(requested, str) else None,
                "negotiated": negotiated,
                "supported": list(SUPPORTED_PROTOCOL_VERSIONS),
                "reason": note,
            }
        }
    return result


# ---------------------------------------------------------------------------
# 2. 视图(工具 / 资源):与裁决同源
# ---------------------------------------------------------------------------


def tool_view_for_principal(principal: Principal | None) -> list[dict[str, Any]]:
    """内部工具集 → MCP tools 视图(按调用方 scope 收紧 + 补能力目录推导的 annotations)。"""
    view: list[dict[str, Any]] = []
    for t in _TOOLS:
        if principal is not None and not check_tool_access(principal, t.name).allowed:
            continue
        entry: dict[str, Any] = {
            "name": t.name,
            "description": t.description,
            "inputSchema": t.input_schema,
        }
        hints = annotation_hints_for_tool(t.name)
        if hints is not None:
            entry["annotations"] = hints.as_wire()
        view.append(entry)
    return view


def _handle_tools_list(principal: Principal | None = None) -> dict[str, Any]:
    """tools/list:全部可见工具 + toolsVersion(ETag 风格,真实变更才自增)。

    本层无状态直通(实时枚举 _TOOLS,无缓存),toolsVersion 取自 capability_gate 的共享
    计数器:客户端拿到变化后的值即知需要重拉。
    """
    return {"tools": tool_view_for_principal(principal), "toolsVersion": tools_revision()}


def visible_resources(principal: Principal | None) -> list[MCPResource]:
    """已登记且在调用方 scope 内的资源(视图与 resources/read 裁决同一张表)。"""
    out: list[MCPResource] = []
    for r in _RESOURCES:
        scope = scope_of_resource(r.uri)
        if scope is None:
            continue  # 未在 MCP 面登记 → 不列也不可读
        if principal is not None and not principal.has_scope(scope):
            continue
        out.append(r)
    return out


def _handle_resources_list(principal: Principal | None = None) -> dict[str, Any]:
    """resources/list:内部资源定义(会话记忆 / skill 清单 / agent 配置)。"""
    return {
        "resources": [
            {"uri": r.uri, "name": r.name, "description": r.description, "mimeType": r.mime_type}
            for r in visible_resources(principal)
        ]
    }


class UnknownResourceError(ValueError):
    """未登记资源:按 JSON-RPC INVALID_PARAMS(-32602)回,与 export 侧 SDK 映射同码。"""

    def __init__(self, uri: str) -> None:
        super().__init__(f"未登记的资源 URI: {uri}")
        self.uri = str(uri)


async def _handle_resources_read(params: dict[str, Any], *, principal: Principal) -> dict[str, Any]:
    """resources/read:登记校验 → scope 闸 → 限流闸 → 引擎取值 → MCP contents 帧。"""
    uri_raw = params.get("uri")
    if not isinstance(uri_raw, str) or not uri_raw.strip():
        raise ValueError("uri 不能为空")
    uri = uri_raw.strip()
    resource = next((r for r in _RESOURCES if r.uri == uri), None)
    scope = scope_of_resource(uri)
    if resource is None or scope is None:
        # 与 export 侧同码:SDK 把"未知资源"映射成 INVALID_PARAMS,两端保持一致更省事
        raise UnknownResourceError(uri)
    enforce_scope(principal, scope, resource_label=f"资源 {uri}")
    release = enforce_rate_limit(principal, scope, resource_label=f"资源 {uri}")
    try:
        read = await mcp_server.read_resource(uri)
    finally:
        release()
    content = read.get("content") if isinstance(read, dict) else None
    if isinstance(read, dict) and read.get("ok") is False:
        raise ValueError(str(read.get("error") or f"资源 {uri} 读取失败"))
    return {
        "contents": [
            {
                "uri": uri,
                "mimeType": resource.mime_type,
                "text": json.dumps(content, ensure_ascii=False, default=str),
            }
        ]
    }


# ---------------------------------------------------------------------------
# 3. prompts
# ---------------------------------------------------------------------------


def _handle_prompts_list() -> dict[str, Any]:
    """prompts/list:返回内部提示词定义(代码审查/Bug 修复等)。"""
    return {
        "prompts": [
            {"name": p.name, "description": p.description, "arguments": p.arguments} for p in _PROMPTS
        ]
    }


def _handle_prompts_get(params: dict[str, Any]) -> dict[str, Any]:
    """prompts/get:标准 messages 帧 + 历史 prompt 定义字段(向后兼容既有客户端)。"""
    name = str(params.get("name", "")).strip()
    if not name:
        raise ValueError("name 不能为空")
    arguments_raw = params.get("arguments")
    arguments: dict[str, Any] = arguments_raw if isinstance(arguments_raw, dict) else {}
    for p in _PROMPTS:
        if p.name == name:
            definition = {"name": p.name, "description": p.description, "arguments": p.arguments}
            rendered = mcp_server.invoke_prompt(name, arguments)
            text = str(rendered.get("prompt", "")) if isinstance(rendered, dict) else ""
            return {
                "prompt": definition,
                "description": p.description,
                "messages": [{"role": "user", "content": {"type": "text", "text": text}}],
            }
    return {"prompt": None, "messages": []}


# ---------------------------------------------------------------------------
# 4. tools/call
# ---------------------------------------------------------------------------


async def _handle_tools_call(params: dict[str, Any], *, principal: Principal) -> dict[str, Any]:
    """tools/call:门禁 → 限流 → 执行,结果包装为 MCP text content。"""
    name = str(params.get("name", "")).strip()
    if not name:
        raise ValueError("name 不能为空")
    arguments = params.get("arguments") or {}
    if not isinstance(arguments, dict):
        raise ValueError("arguments 必须是对象")

    # 不存在的工具按 MCP 语义回 isError 结果(客户端可自行纠错);
    # 存在但未登记/ scope 不足才是授权决策,由 enforce_tool_access 抛 403。
    if not any(t.name == name for t in _TOOLS):
        text = json.dumps({"ok": False, "error": f"未知工具: {name}"}, ensure_ascii=False)
        return {"content": [{"type": "text", "text": text}], "isError": True}

    decision = enforce_tool_access(principal, name)
    release = enforce_rate_limit(principal, decision.required_scope, resource_label=f"工具 {name}")
    try:
        result = await mcp_server.call_tool(
            name,
            arguments,
            user_role=principal.role,
            user_id=principal.sub,
            session_id=None,
        )
    finally:
        release()
    is_error = bool(result.get("ok") is False or result.get("error"))
    text = json.dumps(result, ensure_ascii=False, default=str)
    return {
        "content": [{"type": "text", "text": text}],
        "isError": is_error,
    }


# ---------------------------------------------------------------------------
# 5. 通知
# ---------------------------------------------------------------------------


async def _handle_notification(method: str) -> dict[str, Any]:
    """处理 JSON-RPC 通知(无 id,规范:通知不得产生 error,一律空 result)。

    notifications/tools/list_changed 是**客户端→服务端**方向的上报(本层无状态直通,
    服务端不持工具缓存):把共享版本号自增,并把变更广播转给 export 层的真实长连接会话
    (SSE / streamable),让"有长连接的客户端"立刻收到 notifications/tools/list_changed。
    本端点自己仍然无法回推 —— 所以 capabilities.tools.listChanged 声明为 false。
    """
    if method == "notifications/tools/list_changed":
        await refresh_tools_revision(None, reason="官方带内层收到客户端 list_changed 上报")
    else:
        logger.debug("[mcp_official] 忽略未知通知: %s", method)
    return {}


# ---------------------------------------------------------------------------
# 6. 单条消息派发(被单请求与批量两条路径共用)
# ---------------------------------------------------------------------------

_HANDLED_METHODS: Final[frozenset[str]] = frozenset(
    {
        "initialize",
        "tools/list",
        "tools/call",
        "ping",
        "resources/list",
        "resources/read",
        "prompts/list",
        "prompts/get",
    }
)


def _dispatch_method(method: str) -> tuple[str, str]:
    """方法名分类:('handler', method) / ('notification', method) / ('unknown', method)。"""
    if method in _HANDLED_METHODS:
        return "handler", method
    if method.startswith("notifications/"):
        return "notification", method
    return "unknown", method


async def _dispatch_message(payload: dict[str, Any], principal: Principal) -> tuple[int, dict[str, Any] | None]:
    """派发单条 JSON-RPC 消息。

    Returns:
        (HTTP 状态码, 响应体)。响应体为 None 表示这是通知,按规范不得回包
        (端点侧回 202 空体;批量里则直接省略该元素)。
    """
    method = str(payload.get("method", ""))
    params_raw = payload.get("params")
    params: dict[str, Any] = params_raw if isinstance(params_raw, dict) else {}
    msg_id = payload.get("id")
    kind, _ = _dispatch_method(method)

    if kind == "notification":
        await _handle_notification(method)
        return 202, None

    if kind == "unknown":
        return 404, _jsonrpc_error(
            ERR_METHOD_NOT_FOUND, f"Method not found: {method}", msg_id=msg_id
        )

    try:
        if method == "initialize":
            result: Any = _handle_initialize(params)
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = _handle_tools_list(principal)
        elif method == "resources/list":
            result = _handle_resources_list(principal)
        elif method == "resources/read":
            result = await _handle_resources_read(params, principal=principal)
        elif method == "prompts/list":
            result = _handle_prompts_list()
        elif method == "prompts/get":
            result = _handle_prompts_get(params)
        elif method == "tools/call":
            result = await _handle_tools_call(params, principal=principal)
        else:  # pragma: no cover - _dispatch_method 已过滤
            raise ValueError(f"unsupported method: {method}")
    except ValueError as e:  # 参数非法 / 未登记资源
        return 400, _jsonrpc_error(ERR_INVALID_PARAMS, str(e), msg_id=msg_id)
    except ScopeDeniedError as e:
        # 403 必须 HTTP 状态 + JSON-RPC error 双表达:标准 MCP 客户端按 HTTP 码判定授权失败
        denial: dict[str, Any] = {"errorCode": e.error_code, "requiredScope": e.required_scope}
        return e.http_status, _jsonrpc_error(ERR_INTERNAL, e.message, denial, msg_id=msg_id)
    except RateLimitExceeded as e:
        throttled: dict[str, Any] = e.to_body()
        return e.http_status, _jsonrpc_error(
            ERR_INTERNAL,
            e.message,
            {"errorCode": e.error_code, "retryAfterMs": throttled["retryAfterMs"]},
            msg_id=msg_id,
        )
    except Exception as e:  # noqa: BLE001 - 工具执行异常统一包装为 JSON-RPC 错误
        logger.exception("[mcp_official] %s 执行异常: %s", method, e)
        return 500, _jsonrpc_error(ERR_INTERNAL, f"Internal error: {e}", msg_id=msg_id)

    return 200, _jsonrpc_result(result, msg_id)


# ---------------------------------------------------------------------------
# 7. 批量请求
# ---------------------------------------------------------------------------


def _batch_reject(message: str, msg_id: Any = None) -> JSONResponse:
    """整批拒绝(批量本身非法 → 单个 error 对象,规范如此)。"""
    return JSONResponse(
        _jsonrpc_error(ERR_INVALID_REQUEST, message, msg_id=msg_id), status_code=400
    )


async def _handle_batch(items: list[Any], principal: Principal) -> JSONResponse:
    """JSON-RPC 批量:逐元素独立派发,逐元素结果;授权/限流失败只影响自己那一格。"""
    if not items:
        return _batch_reject("Invalid Request: 批量请求不得为空数组")
    if len(items) > MAX_BATCH_SIZE:
        return _batch_reject(f"Invalid Request: 批量请求元素数超过上限 {MAX_BATCH_SIZE}")
    responses: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict) or "method" not in item:
            # 嵌套批量与非对象元素都属于非法的"批内条目",按 JSON-RPC 回单个 error
            item_id = item.get("id") if isinstance(item, dict) else None
            responses.append(
                _jsonrpc_error(ERR_INVALID_REQUEST, "Invalid Request: 批内元素非法", msg_id=item_id)
            )
            continue
        _, body = await _dispatch_message(item, principal)
        if body is not None:  # 通知不回元素(规范:通知无响应)
            responses.append(body)
    if not responses:
        return JSONResponse(content={}, status_code=202)  # 全是通知:无业务响应体
    return JSONResponse(responses, status_code=200)


# ---------------------------------------------------------------------------
# 8. 进度帧(SSE 升级)
# ---------------------------------------------------------------------------


def _sse_frame(message: dict[str, Any]) -> str:
    """JSON-RPC 消息 → streamable HTTP 的 SSE 帧。"""
    return f"event: message\ndata: {json.dumps(message, ensure_ascii=False, default=str)}\n\n"


def _progress_token_of(params: dict[str, Any]) -> str | int | None:
    """从 params._meta.progressToken 取进度令牌(非字符串/数字一律视为没要,不做猜测)。"""
    meta_raw = params.get("_meta")
    if not isinstance(meta_raw, dict):
        return None
    token = meta_raw.get("progressToken")
    if isinstance(token, bool):
        return None
    if isinstance(token, (str, int)):
        return token
    return None


def _wants_event_stream(request: Request) -> bool:
    """客户端是否接受 SSE 响应(streamable HTTP 客户端会同时 Accept 两种)。"""
    return ACCEPT_EVENT_STREAM in (request.headers.get("accept") or "").lower()


async def _progress_stream(
    payload: dict[str, Any], principal: Principal, token: str | int
) -> AsyncIterator[str]:
    """把一次 tools/call 的响应升级为 SSE 流:受理帧 → 心跳进度帧 → 结果帧。

    进度值取"累计秒数"(单调递增、无 total):内部引擎不回传分阶段计数,任何百分比
    都是编造。elapsed ms 与超时预算写在 message 里,是真实可得的事实。
    """
    frames: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    name = str((payload.get("params") or {}).get("name", "")) if isinstance(payload.get("params"), dict) else ""

    async def _report(progress: float, message: str) -> None:
        await frames.put(
            {
                "jsonrpc": "2.0",
                "method": "notifications/progress",
                "params": {"progressToken": token, "progress": progress, "message": message},
            }
        )

    async def _worker() -> None:
        try:
            _, body = await await_with_progress_heartbeat(
                _dispatch_message(payload, principal),
                _report,
                interval_s=PROGRESS_HEARTBEAT_INTERVAL_S,
                label=f"工具 {name} 执行中",
            )
            await frames.put(body)
        except Exception as exc:  # noqa: BLE001 - 流内不得抛,统一转 JSON-RPC error 帧
            logger.exception("[mcp_official] 进度流执行异常: %s", exc)
            msg_id = payload.get("id")
            msg_id = msg_id if isinstance(msg_id, (str, int)) else None
            await frames.put(_jsonrpc_error(ERR_INTERNAL, f"Internal error: {exc}", msg_id=msg_id))
        finally:
            await frames.put(None)

    await _report(0, f"已受理 tools/call {name}(progressToken 已登记)")
    task = asyncio.create_task(_worker())
    try:
        while True:
            message = await frames.get()
            if message is None:
                break
            yield _sse_frame(message)
    finally:
        if not task.done():
            task.cancel()
        # 取消/异常都要收干净,避免 "Task exception was never retrieved" 噪音
        with suppress(asyncio.CancelledError, Exception):
            await task


# ---------------------------------------------------------------------------
# 9. 端点
# ---------------------------------------------------------------------------


@router.post("/mcp", response_model=None)
async def mcp_official_endpoint(request: Request) -> JSONResponse | StreamingResponse:
    """官方 MCP 协议单入口(streamable HTTP 简化版)。

    请求体:单个 JSON-RPC 2.0 消息,或消息数组(批量)。
    - 有 id → result/error 信封
    - 通知 → 202 空体
    - 批量 → 逐元素结果数组(纯通知批 → 202 空体)
    - tools/call + ``_meta.progressToken`` + Accept: text/event-stream → SSE 流
    """
    # O1 收权:匿名一律 401。凭据形态 = IHUI JWT 或内网可信头 X-IHUI-Principal(apps/api 签发)
    try:
        principal = resolve_principal_from_headers(dict(request.headers))
    except PrincipalAuthError as e:
        return JSONResponse(_jsonrpc_error(ERR_INVALID_REQUEST, e.message), status_code=e.http_status)

    raw = await request.body()
    try:
        payload: object = json.loads(raw.decode("utf-8") or "null")
    except (ValueError, UnicodeDecodeError):
        return JSONResponse(_jsonrpc_error(ERR_PARSE, "Parse error"), status_code=400)

    if isinstance(payload, list):
        return await _handle_batch(payload, principal)

    if not isinstance(payload, dict) or "method" not in payload:
        return JSONResponse(_jsonrpc_error(ERR_INVALID_REQUEST, "Invalid Request"), status_code=400)

    params_raw = payload.get("params")
    params: dict[str, Any] = params_raw if isinstance(params_raw, dict) else {}
    token = _progress_token_of(params)
    if str(payload.get("method", "")) == "tools/call" and token is not None and _wants_event_stream(request):
        return StreamingResponse(
            _progress_stream(payload, principal, token),
            media_type=ACCEPT_EVENT_STREAM,
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    status, body = await _dispatch_message(payload, principal)
    if body is None:  # 通知:不回业务体
        return JSONResponse({}, status_code=200)
    return JSONResponse(body, status_code=status)

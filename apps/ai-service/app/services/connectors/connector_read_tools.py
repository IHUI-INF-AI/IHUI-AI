# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""连接器工具(2026-11-25 立,2026-11-25 扩写):把已授权连接器接入 AI 对话 tool loop。

四枚工具:
- 只读:connector_capabilities / connector_call_read(list/search/fetch);
- 写:connector_write_capabilities / connector_call_write(action)。

设计边界(安全敏感,改动前必读):
- 身份只取 `current_security_principal()`(由 mcp_server.call_tool 在服务端
  `security_principal_scope(user_id)` 里发布,来源于 request.state.user_id/JWT,
  **LLM 不可伪造**)。入参里的 user/tenant/scope 一律不采信。
- 执行走 ASGI 进程内自调用 `/api/connectors/{key}/invoke`,复用路由层既有
  凭据注入、出站校验、令牌刷新回写与三重门(allow_write / confirm / 审计)——
  这里零重复安全逻辑。
- **写操作的审批走 tool loop 的 `tool-approval` 门**:`connector_call_write`
  在 llm.py::_TOOL_DANGER_LEVELS 与 agent_loop_v2::_DEFAULT_HIGH_RISK_TOOLS
  均判 high,执行前必弹审批帧,用户批准才调用 handler;handler 被调用即视为
  审批已通过,故 confirm 由 handler 恒 True(与只读侧恒 False 对称),LLM 入参
  里的 confirm 一律丢弃 —— 与 api_endpoint_call(2026-11-13)同一先例。
- 写能力只列 capability=action 且 spec.allow_write=true 的操作;目标必须在
  当前用户自己的写能力清单内才放行,跨用户/只读操作一律拒绝。
- 工具名全局静态注册(不按用户动态注册),避免污染全局注册表造成串号;
  可见性由 handler 内的属主校验 + 工具白名单双重保证。
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import Any, Awaitable, Callable

import jwt as pyjwt
from pydantic import BaseModel

from ..agent_security_prefs import current_security_principal
from ..mcp_server import MCPTool, register_external_tool

logger = logging.getLogger(__name__)

# 工具名(前端 tool-config 与守门测试引用同一字面量,改名须同步)
CAPABILITIES_TOOL = "connector_capabilities"
CALL_READ_TOOL = "connector_call_read"
WRITE_CAPABILITIES_TOOL = "connector_write_capabilities"
CALL_WRITE_TOOL = "connector_call_write"

# 只读能力白名单 —— 与 connectors.base.CAPABILITIES 的只读子集一致
_READ_CAPABILITIES = frozenset({"list", "search", "fetch"})
# 写能力白名单 —— 只有 action 类算写;list/search/fetch 不得经由写工具执行
_WRITE_CAPABILITIES = frozenset({"action"})

_JWT_AUDIENCE = "ihui-ai-users"  # 对齐 jwt_auth._verify_token 的 audience
_TOKEN_TTL_SECONDS = 120

# ASGI 自调用目标(路由前缀 /api + /connectors)
_INVOKE_PATH = "/api/connectors/{key}/invoke"
_LIST_PATH = "/api/connectors"


class _ConnectorCallArgs(BaseModel):
    connector_key: str
    operation_id: str
    params: dict[str, Any] = {}


def _mint_token(user_id: str, role_id: int) -> str:
    """签短时 access token,把真实主体带给被调端点(不缓存、不落盘)。

    claims 对齐 jwt_auth._verify_token 的验签规则。与 ai_service_bridge
    同一套约定;这里内联是为了不依赖其下划线私有函数。
    """
    from ...core.config import settings

    secret = (getattr(settings, "jwt_secret", "") or "").strip()
    if not secret:
        return ""
    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": user_id,
        "userId": user_id,
        "roleId": role_id,
        "type": "access",
        "iat": now,
        "exp": now + int(_TOKEN_TTL_SECONDS),
        "jti": uuid.uuid4().hex,
        "iss": getattr(settings, "jwt_issuer", "ihui-ai"),
        "aud": _JWT_AUDIENCE,
    }
    token = pyjwt.encode(claims, secret, algorithm="HS256")
    return token if isinstance(token, str) else token.decode("utf-8")


def _resolve_app() -> Any:
    """现读 FastAPI app(延迟导入,避开 main.py ↔ 本模块循环导入)。"""
    from ...main import app

    return app


async def _asgi_call(
    method: str, path: str, *, user_id: str, role_id: int,
    params: dict[str, Any] | None = None, body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """进程内自调用 ai-service 端点,带真实主体 token。"""
    from urllib.parse import quote

    from httpx import ASGITransport, AsyncClient

    token = _mint_token(user_id, role_id)
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    async with AsyncClient(
        transport=ASGITransport(app=_resolve_app()),
        base_url="http://connector-read-internal",
        timeout=30.0,
    ) as client:
        if method.upper() == "GET":
            resp = await client.request(method, path, headers=headers, params=params)
        else:
            resp = await client.request(method, path, headers=headers, json=body)
    raw = resp.text or ""
    if len(raw) > 12000:
        return {"ok": resp.status_code < 400, "status": resp.status_code,
                "data": raw[:12000], "truncated": True}
    try:
        data: Any = resp.json()
    except ValueError:
        data = raw
    return {"ok": resp.status_code < 400, "status": resp.status_code, "data": data}


async def _capabilities_handler(args: dict[str, Any]) -> dict[str, Any]:
    """列出当前用户已授权连接器的**只读**操作(不返回任何凭据)。"""
    uid = str(current_security_principal() or "").strip()
    if not uid:
        return {"ok": False, "errorCode": "NO_PRINCIPAL",
                "message": "无法确认调用者身份,拒绝列举连接器能力"}
    # role 从 host 注入的 __user_role 取,仅用于签 token;不决定授权范围
    try:
        role = max(0, int(args.get("__user_role") or 0))
    except (TypeError, ValueError):
        role = 0
    result = await _asgi_call("GET", _LIST_PATH, user_id=uid, role_id=role)
    if not result.get("ok"):
        return {"ok": False, "errorCode": "LIST_FAILED", "message": "列举连接器失败",
                "detail": result.get("data")}
    payload = result.get("data")
    connectors = payload.get("connectors") if isinstance(payload, dict) else None
    items: list[dict[str, Any]] = []
    for rec in connectors or []:
        if not isinstance(rec, dict):
            continue
        if not bool(rec.get("enabled")) or not bool(rec.get("configured")):
            continue
        for op in rec.get("operations") or []:
            if not isinstance(op, dict):
                continue
            cap = str(op.get("capability") or "")
            if cap not in _READ_CAPABILITIES or bool(op.get("disabled")):
                continue
            items.append({
                "connector_key": str(rec.get("key") or ""),
                "operation_id": str(op.get("id") or ""),
                "capability": cap,
                "name": str(op.get("name") or op.get("id") or ""),
                "description": str(op.get("description") or "")[:200],
            })
    return {"ok": True, "connectors": items,
            "notice": "仅列出只读能力;写操作需在连接器页手动确认执行"}


async def _call_read_handler(args: dict[str, Any]) -> dict[str, Any]:
    """执行一条只读操作;action 与未授权连接器一律拒绝。"""
    uid = str(current_security_principal() or "").strip()
    if not uid:
        return {"ok": False, "errorCode": "NO_PRINCIPAL",
                "message": "无法确认调用者身份,拒绝执行"}
    # 先按当前用户列能力,确认目标操作在**自己的只读能力清单**内
    caps = await _capabilities_handler({"__user_role": args.get("__user_role")})
    if not caps.get("ok"):
        return {"ok": False, "errorCode": "CAP_CHECK_FAILED",
                "message": "无法校验操作权限,拒绝执行"}
    key = str(args.get("connector_key") or "").strip()
    op_id = str(args.get("operation_id") or "").strip()
    allowed = any(
        i["connector_key"] == key and i["operation_id"] == op_id
        for i in caps.get("connectors", [])
    )
    if not allowed:
        return {"ok": False, "errorCode": "READ_ONLY_DENIED",
                "message": "目标操作不在当前用户的只读能力清单内(action 或未授权),拒绝执行"}
    try:
        role = max(0, int(args.get("__user_role") or 0))
    except (TypeError, ValueError):
        role = 0
    params = args.get("params") or {}
    if not isinstance(params, dict):
        return {"ok": False, "errorCode": "BAD_PARAMS", "message": "params 必须是对象"}
    # 走路由层 invoke:confirm 缺省 False,只读操作本就不触发写门
    return await _asgi_call(
        "POST", _INVOKE_PATH.format(key=key), user_id=uid, role_id=role,
        body={"operation_id": op_id, "params": params, "confirm": False},
    )


async def _write_capabilities_handler(args: dict[str, Any]) -> dict[str, Any]:
    """列出当前用户已授权连接器的**写**操作(action 且 allow_write),不返回凭据。"""
    uid = str(current_security_principal() or "").strip()
    if not uid:
        return {"ok": False, "errorCode": "NO_PRINCIPAL",
                "message": "无法确认调用者身份,拒绝列举写能力"}
    try:
        role = max(0, int(args.get("__user_role") or 0))
    except (TypeError, ValueError):
        role = 0
    result = await _asgi_call("GET", _LIST_PATH, user_id=uid, role_id=role)
    if not result.get("ok"):
        return {"ok": False, "errorCode": "LIST_FAILED", "message": "列举连接器失败",
                "detail": result.get("data")}
    payload = result.get("data")
    connectors = payload.get("connectors") if isinstance(payload, dict) else None
    items: list[dict[str, Any]] = []
    for rec in connectors or []:
        if not isinstance(rec, dict):
            continue
        if not bool(rec.get("enabled")) or not bool(rec.get("configured")):
            continue
        # 连接器 spec.allow_write 未开启 ⇒ 该连接器任何写操作都不可执行
        spec = rec.get("spec") if isinstance(rec.get("spec"), dict) else {}
        if not bool(spec.get("allow_write")):
            continue
        for op in rec.get("operations") or []:
            if not isinstance(op, dict):
                continue
            cap = str(op.get("capability") or "")
            if cap not in _WRITE_CAPABILITIES or bool(op.get("disabled")):
                continue
            items.append({
                "connector_key": str(rec.get("key") or ""),
                "operation_id": str(op.get("id") or ""),
                "capability": cap,
                "name": str(op.get("name") or op.get("id") or ""),
                "description": str(op.get("description") or "")[:200],
            })
    return {"ok": True, "connectors": items,
            "notice": "写操作执行前会向用户弹审批确认;未经用户批准不会执行"}


async def _call_write_handler(args: dict[str, Any]) -> dict[str, Any]:
    """执行一条写操作;仅在 tool loop 审批通过后被调用,confirm 恒 True。

    安全链:① 服务端 principal;② 目标必须在当前用户自己的 action 写能力清单内
    (跨用户/只读操作拒绝);③ 走 invoke 路由复用 allow_write/confirm/审计三重门。
    LLM 入参里的 confirm 一律丢弃 —— 审批门才是写操作的二次确认。
    """
    uid = str(current_security_principal() or "").strip()
    if not uid:
        return {"ok": False, "errorCode": "NO_PRINCIPAL",
                "message": "无法确认调用者身份,拒绝执行写操作"}
    caps = await _write_capabilities_handler({"__user_role": args.get("__user_role")})
    if not caps.get("ok"):
        return {"ok": False, "errorCode": "CAP_CHECK_FAILED",
                "message": "无法校验写操作权限,拒绝执行"}
    key = str(args.get("connector_key") or "").strip()
    op_id = str(args.get("operation_id") or "").strip()
    allowed = any(
        i["connector_key"] == key and i["operation_id"] == op_id
        for i in caps.get("connectors", [])
    )
    if not allowed:
        return {"ok": False, "errorCode": "WRITE_NOT_ALLOWED",
                "message": "目标写操作不在当前用户的写能力清单内(非 action/未开写权限/未授权),拒绝执行"}
    try:
        role = max(0, int(args.get("__user_role") or 0))
    except (TypeError, ValueError):
        role = 0
    params = args.get("params") or {}
    if not isinstance(params, dict):
        return {"ok": False, "errorCode": "BAD_PARAMS", "message": "params 必须是对象"}
    # confirm 恒 True:handler 被调用 = tool loop 审批已通过(与只读侧恒 False 对称)。
    # 路由层仍会再验 allow_write 并写审计,这里不是唯一门。
    return await _asgi_call(
        "POST", _INVOKE_PATH.format(key=key), user_id=uid, role_id=role,
        body={"operation_id": op_id, "params": params, "confirm": True},
    )


def _capabilities_tool() -> MCPTool:
    return MCPTool(
        name=CAPABILITIES_TOOL,
        description=(
            "列出当前用户已授权连接器的只读能力(飞书/钉钉/企微等)。"
            "返回每个连接器的 key、可用只读操作 operation_id(list/search/fetch)、名称与说明。"
            "在需要查询外部数据前先调用本工具发现可用操作;不含任何凭据,不含写操作。"
        ),
        input_schema={"type": "object", "properties": {}, "additionalProperties": False},
    )


def _call_read_tool() -> MCPTool:
    return MCPTool(
        name=CALL_READ_TOOL,
        description=(
            "执行当前用户已授权连接器的一个只读操作(list/search/fetch),查询外部数据。"
            "connector_key 与 operation_id 必须先由 connector_capabilities 获得。"
            "写操作(action)会被拒绝,不会执行任何修改;如需写操作请到连接器页手动确认。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "connector_key": {"type": "string", "description": "连接器 key,来自 connector_capabilities"},
                "operation_id": {"type": "string", "description": "只读操作 id,来自 connector_capabilities"},
                "params": {"type": "object", "description": "操作参数(路径/query/body),默认 {}",
                           "additionalProperties": True},
            },
            "required": ["connector_key", "operation_id"],
            "additionalProperties": False,
        },
    )


def _write_capabilities_tool() -> MCPTool:
    return MCPTool(
        name=WRITE_CAPABILITIES_TOOL,
        description=(
            "列出当前用户已授权连接器可执行的写操作(action,且连接器已开启写权限)。"
            "返回每个连接器的 key、写操作 operation_id、名称与说明。"
            "在执行写操作前先调用本工具发现可用操作;不含任何凭据。"
            "写操作真正执行前会向用户弹审批确认。"
        ),
        input_schema={"type": "object", "properties": {}, "additionalProperties": False},
    )


def _call_write_tool() -> MCPTool:
    return MCPTool(
        name=CALL_WRITE_TOOL,
        description=(
            "执行当前用户已授权连接器的一个写操作(action),如发消息、建文档、提交记录等。"
            "connector_key 与 operation_id 必须先由 connector_write_capabilities 获得。"
            "本工具执行前会弹审批请求给用户,只有在用户批准后才真正执行;"
            "用户拒绝或无人应答则不会执行任何修改。params 为操作参数(路径/query/body)。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "connector_key": {"type": "string", "description": "连接器 key,来自 connector_write_capabilities"},
                "operation_id": {"type": "string", "description": "写操作 id,来自 connector_write_capabilities"},
                "params": {"type": "object", "description": "操作参数(路径/query/body),默认 {}",
                           "additionalProperties": True},
            },
            "required": ["connector_key", "operation_id"],
            "additionalProperties": False,
        },
    )


def setup_connector_read_tools() -> int:
    """注册四枚连接器工具(2 只读 + 2 写),返回本次成功注册数(幂等,失败降级返 0)。

    函数名保留 `..._read_tools` 以兼容既有 import 面,语义已扩展为读写全量。
    """
    count = 0
    for tool, handler in (
        (_capabilities_tool(), _capabilities_handler),
        (_call_read_tool(), _call_read_handler),
        (_write_capabilities_tool(), _write_capabilities_handler),
        (_call_write_tool(), _call_write_handler),
    ):
        try:
            if register_external_tool(tool, handler):
                count += 1
        except Exception as e:  # noqa: BLE001 - 单个工具注册失败不影响其余
            logger.warning("[connector] 注册工具失败 %s(忽略): %s", tool.name, e)
    logger.info("[connector] 工具注册完成: %d 个 (%s, %s, %s, %s)",
                count, CAPABILITIES_TOOL, CALL_READ_TOOL,
                WRITE_CAPABILITIES_TOOL, CALL_WRITE_TOOL)
    return count


__all__ = [
    "CAPABILITIES_TOOL",
    "CALL_READ_TOOL",
    "WRITE_CAPABILITIES_TOOL",
    "CALL_WRITE_TOOL",
    "setup_connector_read_tools",
    "_capabilities_handler",
    "_call_read_handler",
    "_write_capabilities_handler",
    "_call_write_handler",
]

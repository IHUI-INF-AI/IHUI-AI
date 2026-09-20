# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 全量操控桥接(2026-09-20 立):apps/api OpenAPI → MCP 工具注册。

拉取 apps/api 的 OpenAPI spec(/docs/json),把每个端点转换为 MCP 工具注册进
mcp_server 工具注册表 —— LLM 可经既有 call_tool 路径直接调用后端任意 API,
即"AI 全量操控桥接"。

设计:
- fetch_openapi_spec():       拉取 spec,内存缓存 TTL 300s
- spec_to_tools():            spec → MCPTool 列表(API_TOOLS_EXCLUDE 正则排除、
                              API_TOOLS_MAX 数量上限截断)
- make_api_handler():         生成端点调用 handler(path 参数替换、query/body 分流、
                              内部服务鉴权头、写操作 __user_role>=1 闸门、15s 超时、
                              响应超 4000 字符截断)
- api_endpoints_search /      两个名字恒定的入口工具:端点数可达数百,schema 全量
  api_endpoint_call           进上下文不现实,模型"先搜后调"抵达任意端点
- setup_api_tools_bridge():   按 API_TOOLS_MODE(off|read|all,默认 read)注册
- refresh_api_tools_bridge(): 清 spec 缓存后重新拉取并注册

安全:
- 所有出站调用携带内部服务鉴权头(x-internal-service-token + x-user-id,与
  mcp_server._edu_internal_headers / im_bridge 同源同约定)
- 写操作(POST/PUT/PATCH/DELETE)要求 __user_role >= 1(管理员),API 侧 RBAC 二次兜底
- header/cookie 型 OpenAPI 参数不暴露给 LLM,防止越权头注入
"""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Any, Awaitable, Callable
from urllib.parse import quote

import httpx

from .mcp_server import (
    MCPTool,
    _TOOL_HANDLERS,
    mcp_server,
    register_external_tool,
    unregister_external_tool_by_prefix,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 配量
# ---------------------------------------------------------------------------

_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_DEFAULT_EXCLUDE = r"^/docs,^/ws,^/internal,^/debug"
_SPEC_TTL_SECONDS = 300.0
_HANDLER_TIMEOUT = 15.0
_RESULT_TRUNCATE = 4000

# 已注册 API 工具的侧表:tool_name → {method, path, summary}(2026-09-20 加)。
# 工具名由 operationId 清洗而来,不可逆读,api_endpoints_search 只能靠本表回溯
# 到 method/path —— 注册入口每次重建本表,与 _TOOLS 保持同生命周期。
_API_TOOL_INDEX: dict[str, dict[str, str]] = {}


def _secret() -> str:
    """内部服务鉴权令牌:优先 AI_CALLBACK_SECRET(与兄弟模块同源),兼容 INTERNAL_SERVICE_TOKEN。"""
    return (
        os.environ.get("AI_CALLBACK_SECRET", "").strip()
        or os.environ.get("INTERNAL_SERVICE_TOKEN", "").strip()
    )


def api_base_url() -> str:
    """apps/api 内部基地址。

    与 edu/codebase 等既有内部调用同一约定:优先 API_INTERNAL_BASE_URL(本桥接专用覆盖),
    其次 settings.api_service_url(env API_SERVICE_URL,全局权威),最后回退 8802。
    """
    override = os.environ.get("API_INTERNAL_BASE_URL", "").strip()
    if override:
        return override.rstrip("/")
    from ..core.config import settings

    return str(getattr(settings, "api_service_url", "http://localhost:8802")).rstrip("/")


def internal_headers(user_id: str) -> dict[str, str]:
    """内部服务鉴权头(x-internal-service-token + x-user-id,小写与兄弟模块一致)。"""
    headers: dict[str, str] = {}
    token = _secret()
    if token:
        headers["x-internal-service-token"] = token
    if user_id:
        headers["x-user-id"] = str(user_id)
    return headers


# ---------------------------------------------------------------------------
# OpenAPI spec 拉取(内存缓存 TTL 300s)
# ---------------------------------------------------------------------------

_SPEC_CACHE: dict[str, Any] | None = None
_SPEC_FETCHED_AT: float = 0.0


def clear_spec_cache() -> None:
    """清空 spec 内存缓存(refresh 前调用,强制重拉)。"""
    global _SPEC_CACHE, _SPEC_FETCHED_AT
    _SPEC_CACHE = None
    _SPEC_FETCHED_AT = 0.0


async def fetch_openapi_spec(force: bool = False) -> dict[str, Any]:
    """拉取 apps/api 的 OpenAPI spec(/docs/json,404 时回退 /openapi.json),TTL 300s 缓存。"""
    global _SPEC_CACHE, _SPEC_FETCHED_AT
    now = time.monotonic()
    if not force and _SPEC_CACHE is not None and (now - _SPEC_FETCHED_AT) < _SPEC_TTL_SECONDS:
        return _SPEC_CACHE
    base = api_base_url()
    headers = internal_headers("")  # 仅带令牌;/docs/json 为公开端点,带令牌亦兼容
    async with httpx.AsyncClient(timeout=_HANDLER_TIMEOUT) as client:
        resp = await client.get(f"{base}/docs/json", headers=headers)
        if resp.status_code == 404:
            resp = await client.get(f"{base}/openapi.json", headers=headers)
        resp.raise_for_status()
        raw_spec: Any = resp.json()
        spec: dict[str, Any] = raw_spec if isinstance(raw_spec, dict) else {}
    _SPEC_CACHE = spec
    _SPEC_FETCHED_AT = now
    logger.info(
        "[api_bridge] 已拉取 OpenAPI spec: %s (paths=%d)", base, len(spec.get("paths") or {})
    )
    return spec


# ---------------------------------------------------------------------------
# spec → MCP 工具转换
# ---------------------------------------------------------------------------

def _exclude_patterns() -> list[re.Pattern[str]]:
    """API_TOOLS_EXCLUDE 逗号分隔正则(默认排除 docs/ws/internal/debug 前缀)。"""
    raw = os.environ.get("API_TOOLS_EXCLUDE", _DEFAULT_EXCLUDE)
    out: list[re.Pattern[str]] = []
    for part in raw.split(","):
        part = part.strip()
        if part:
            out.append(re.compile(part))
    return out


def _tools_max() -> int:
    """注册工具数量上限(env API_TOOLS_MAX,默认 300)。"""
    try:
        return max(1, int(os.environ.get("API_TOOLS_MAX", "300")))
    except ValueError:
        return 300


def _sanitize_tool_name(raw: str) -> str:
    """工具名清洗:非字母数字折叠为 _、小写、api_ 前缀、≤64 字符。"""
    name = re.sub(r"_+", "_", re.sub(r"[^a-zA-Z0-9]+", "_", raw)).strip("_").lower()
    full = f"api_{name}" if name else "api_op"
    return full[:64]


def _iter_operations(
    spec: dict[str, Any], methods: set[str] | None = None, cap: bool = True
) -> list[tuple[str, str, dict[str, Any]]]:
    """展开 spec 为 (METHOD, path, operation) 三元组;正则排除 + 方法过滤 + 数量上限。

    methods 过滤必须在 API_TOOLS_MAX 截断**之前**:实测本项目 OpenAPI 有 4471 个
    operation,先截断再按方法过滤会让 read 模式只拿到"前 300 个里恰好是 GET 的"极少数,
    绝大多数只读端点被静默丢弃。cap=False 供侧表索引用(全量覆盖,注册上限只约束
    进入工具表的条数,不约束可调用面)。
    """
    patterns = _exclude_patterns()
    ops: list[tuple[str, str, dict[str, Any]]] = []
    for path, item in (spec.get("paths") or {}).items():
        if not isinstance(item, dict):
            continue
        if any(p.search(str(path)) for p in patterns):
            continue
        for method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
            if methods is not None and method not in methods:
                continue
            op = item.get(method.lower())
            if isinstance(op, dict):
                ops.append((method, str(path), op))
    if not cap:
        return ops
    max_n = _tools_max()
    if len(ops) > max_n:
        logger.warning(
            "[api_bridge] 候选端点 %d 超过 API_TOOLS_MAX=%d,已截断(未注册部分仍可经"
            " api_endpoint_call 按 name 调用)",
            len(ops),
            max_n,
        )
        ops = ops[:max_n]
    return ops


def _build_input_schema(op: dict[str, Any]) -> dict[str, Any]:
    """构造 input_schema:path/query 参数 + requestBody(JSON)属性合并。

    - path 参数恒为 required;query 参数按 OpenAPI required 标记
    - 对象型 body:properties/required 直接合并进顶层;非对象 schema 整体挂为 body 参数
    - 无任何参数时 properties 留空对象;不输出 additionalProperties(避免约束 LLM 传参)
    """
    properties: dict[str, Any] = {}
    required: list[str] = []
    for param in op.get("parameters") or []:
        if not isinstance(param, dict):
            continue
        loc = str(param.get("in") or "")
        name = str(param.get("name") or "").strip()
        if loc not in ("path", "query") or not name:
            continue  # header/cookie 参数不暴露给 LLM,防越权头注入
        prop: dict[str, Any] = dict(param.get("schema") or {}) or {"type": "string"}
        prop["description"] = str(param.get("description") or f"{loc} 参数 {name}")
        properties[name] = prop
        if param.get("required"):
            required.append(name)

    rb = op.get("requestBody")
    body_schema: dict[str, Any] | None = None
    if isinstance(rb, dict):
        content = rb.get("content")
        if isinstance(content, dict):
            media = content.get("application/json")
            if isinstance(media, dict) and isinstance(media.get("schema"), dict):
                body_schema = media["schema"]
    if body_schema:
        if body_schema.get("type") == "object" and isinstance(body_schema.get("properties"), dict):
            for k, v in body_schema["properties"].items():
                properties[str(k)] = dict(v) if isinstance(v, dict) else {"type": "string"}
            for k in body_schema.get("required") or []:
                if str(k) not in required:
                    required.append(str(k))
        else:
            # 非对象 schema(数组/基础类型)整体作为一个 body 参数
            properties["body"] = dict(body_schema)
            properties["body"]["description"] = str(body_schema.get("description") or "请求体")
            if isinstance(rb, dict) and rb.get("required"):
                required.append("body")

    schema: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = required
    return schema


def _operation_to_tool(method: str, path: str, op: dict[str, Any]) -> MCPTool:
    """单个 operation → MCPTool(name 清洗 + 描述含写操作警示)。"""
    raw_id = str(op.get("operationId") or f"{method}_{path}")
    summary = str(op.get("summary") or op.get("description") or "").strip() or "无描述"
    tags = ",".join(str(t) for t in (op.get("tags") or []))
    desc = f"[API {method} {path}] {summary}"
    if tags:
        desc += f"；标签: {tags}"
    if method in _WRITE_METHODS:
        desc += "；⚠写操作(需管理员)"
    if len(desc) > 300:
        desc = desc[:297] + "..."
    return MCPTool(
        name=_sanitize_tool_name(raw_id),
        description=desc,
        input_schema=_build_input_schema(op),
    )


def spec_to_tools(spec: dict[str, Any]) -> list[MCPTool]:
    """OpenAPI spec → MCP 工具列表(GET/POST/PUT/PATCH/DELETE 全展开,含写操作标记)。"""
    return [_operation_to_tool(m, p, op) for m, p, op in _iter_operations(spec)]


# ---------------------------------------------------------------------------
# 端点调用 handler
# ---------------------------------------------------------------------------

def make_api_handler(
    method: str, path: str
) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    """生成调用 {method} {path} 端点的 async handler(供 register_external_tool 注入)。

    约定:
    - path 模板参数({xxx})从入参取值做 URL 编码替换,缺失 → MISSING_PATH_PARAM
    - GET/HEAD/DELETE:其余入参(除 __ 前缀内部参数与 path 参数)作为 query string
    - POST/PUT/PATCH:其余入参作为 JSON body
    - 写操作要求 __user_role >= 1,否则 PERMISSION_DENIED(不发请求)
    - 统一返回 {ok, status, data};响应文本超 4000 字符截断;异常 → API_BRIDGE_ERROR
    """
    method_u = method.upper()
    is_write = method_u in _WRITE_METHODS
    use_query = method_u in {"GET", "HEAD", "DELETE"}
    path_params = set(re.findall(r"\{([^{}]+)\}", path))
    base = api_base_url()

    async def handler(args: dict[str, Any]) -> dict[str, Any]:
        try:
            uid = str(args.get("__user_id") or "").strip()
            if not uid:
                return {
                    "ok": False,
                    "errorCode": "PERMISSION_DENIED",
                    "message": "缺少用户身份(__user_id),拒绝调用",
                }
            role = args.get("__user_role")
            try:
                role_n = int(role) if role is not None else 0
            except (TypeError, ValueError):
                role_n = 0
            if is_write and role_n < 1:
                return {
                    "ok": False,
                    "errorCode": "PERMISSION_DENIED",
                    "message": "写操作需要管理员角色",
                }

            filled = path
            for p in path_params:
                val = str(args.get(p) or "").strip()
                if not val:
                    return {
                        "ok": False,
                        "errorCode": "MISSING_PATH_PARAM",
                        "message": f"缺少路径参数: {p}",
                    }
                filled = filled.replace("{" + p + "}", quote(val, safe=""))

            extra = {
                k: v
                for k, v in args.items()
                if not k.startswith("__") and k not in path_params
            }
            url = f"{base}{filled}"
            headers = internal_headers(uid)
            async with httpx.AsyncClient(timeout=_HANDLER_TIMEOUT) as client:
                if use_query:
                    resp = await client.request(method_u, url, headers=headers, params=extra)
                else:
                    resp = await client.request(method_u, url, headers=headers, json=extra)

            raw = resp.text or ""
            if len(raw) > _RESULT_TRUNCATE:
                return {
                    "ok": resp.status_code < 400,
                    "status": resp.status_code,
                    "data": raw[:_RESULT_TRUNCATE],
                    "truncated": True,
                }
            try:
                data: Any = resp.json()
            except ValueError:
                data = raw
            return {"ok": resp.status_code < 400, "status": resp.status_code, "data": data}
        except Exception as e:  # noqa: BLE001 网络/参数层统一兜底,错误回传 LLM 而非抛出
            return {"ok": False, "errorCode": "API_BRIDGE_ERROR", "message": str(e)}

    return handler


# ---------------------------------------------------------------------------
# 稳定入口工具(2026-09-20 立)
# ---------------------------------------------------------------------------
# 端点工具数量可达数百,把它们的完整 schema 全塞进一次对话不现实;web 主链
# (llm.py agent tool loop)又要求前端显式列出工具名。这两个名字恒定的入口让
# 模型用"先搜后调"两步抵达任意端点,schema 成本与端点数解耦。

async def _search_endpoint_tools(args: dict[str, Any]) -> dict[str, Any]:
    """api_endpoints_search:按关键词在已注册 API 工具侧表里搜端点(只读)。"""
    query = str(args.get("query") or "").strip().lower()
    method = str(args.get("method") or "").strip().upper()
    try:
        limit = max(1, min(int(args.get("limit") or 20), 50))
    except (TypeError, ValueError):
        limit = 20
    tokens = [t for t in query.replace("_", " ").replace("-", " ").split() if t]
    scored: list[tuple[int, dict[str, str]]] = []
    for name, entry in _API_TOOL_INDEX.items():
        if method and entry["method"] != method:
            continue
        haystack = f"{name} {entry['path']} {entry['summary']}".lower()
        if tokens:
            score = sum(1 for t in tokens if t in haystack)
            if score == 0:
                continue
        else:
            score = 0
        scored.append((score, {"name": name, **entry}))
    scored.sort(key=lambda item: (-item[0], item[1]["name"]))
    matches = [item[1] for item in scored[:limit]]
    return {
        "ok": True,
        "count": len(matches),
        "total": len(_API_TOOL_INDEX),
        "endpoints": matches,
        "hint": "用 api_endpoint_call(name, arguments) 调用上面任一 name",
    }


async def _call_endpoint_tool(args: dict[str, Any]) -> dict[str, Any]:
    """api_endpoint_call:按 name 转发到已注册的 api_ 端点工具。

    只允许 api_ 前缀且已在侧表中的工具 —— 否则本入口等于把 run_command /
    write_file 等高危工具暴露给一次字符串参数,是越权捷径。
    """
    name = str(args.get("name") or "").strip()
    if not name:
        return {"ok": False, "errorCode": "INVALID_ARGS", "error": "缺少必填参数: name"}
    arguments = args.get("arguments")
    if arguments is None:
        arguments = {}
    if not isinstance(arguments, dict):
        return {"ok": False, "errorCode": "INVALID_ARGS", "error": "arguments 必须是对象"}
    entry = _API_TOOL_INDEX.get(name) if name.startswith("api_") else None
    if entry is None:
        return {
            "ok": False,
            "errorCode": "UNKNOWN_API_TOOL",
            "error": f"未注册的 API 工具: {name}(先用 api_endpoints_search 取准确 name)",
        }
    user_id = str(args.get("__user_id") or "")
    session_id = str(args.get("__session_id") or "")
    try:
        user_role = int(args.get("__user_role") or 0)
    except (TypeError, ValueError):
        user_role = 0
    if name in _TOOL_HANDLERS:
        # 已注册端点走 call_tool,复用全局超时/输出截断/权限矩阵
        result = await mcp_server.call_tool(
            name,
            arguments,
            user_role=user_role,
            user_id=user_id or None,
            session_id=session_id or None,
        )
        return {"tool": name, **result}
    # 未注册(API_TOOLS_MAX 截断掉的长尾端点)按侧表元数据即时建 handler 调用:
    # 注册上限只约束"进工具表的条数",不削弱可调用面,否则 4471 端点只覆盖 300 个。
    # 写操作 role 闸门在 handler 内部,两条路径同一条码。
    merged: dict[str, Any] = dict(arguments)
    # 身份字段以注入值为准,禁止模型在 arguments 里伪造
    merged["__user_id"] = user_id
    merged["__user_role"] = user_role
    merged["__session_id"] = session_id
    result = await make_api_handler(entry["method"], entry["path"])(merged)
    return {"tool": name, **result}


def _entry_tools() -> list[tuple[MCPTool, Any]]:
    """两个稳定入口工具定义 + handler。"""
    return [
        (
            MCPTool(
                name="api_endpoints_search",
                description=(
                    "[API桥接] 按关键词搜索本站后端 HTTP 接口(端点),返回可调用的工具名 "
                    "name 及 method/path/摘要。搜索结果里的 name 交给 api_endpoint_call 调用。"
                    "要操作本站数据(订单/用户/内容/配置等后端能力)先用本工具定位端点。"
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "关键词(匹配工具名/路径/摘要),留空则列出前 N 个",
                        },
                        "method": {
                            "type": "string",
                            "description": "限定 HTTP 方法,如 GET/POST(可选)",
                        },
                        "limit": {"type": "integer", "description": "返回条数,默认 20,上限 50"},
                    },
                },
            ),
            _search_endpoint_tools,
        ),
        (
            MCPTool(
                name="api_endpoint_call",
                description=(
                    "[API桥接] 调用 api_endpoints_search 找到的某个后端接口。"
                    "name 必须是搜索返回的 api_ 前缀工具名;arguments 是该接口的参数对象。"
                    "写操作(POST/PUT/PATCH/DELETE)仍需管理员角色,且经 api 侧 RBAC 二次校验。"
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "接口工具名(来自 api_endpoints_search 的 name)",
                        },
                        "arguments": {
                            "type": "object",
                            "description": "接口参数(path/query/body 平铺在一个对象里)",
                        },
                    },
                    "required": ["name"],
                },
            ),
            _call_endpoint_tool,
        ),
    ]


# ---------------------------------------------------------------------------
# 注册入口
# ---------------------------------------------------------------------------

async def setup_api_tools_bridge() -> int:
    """按 API_TOOLS_MODE 把 API 端点注册为 MCP 工具,返回注册数量(失败降级返 0)。

    - off:  不注册(并清掉既有 api_ 前缀外部工具)
    - read: 仅 GET(默认)
    - all:  GET/POST/PUT/PATCH/DELETE 全量(写操作仍受 __user_role>=1 闸门约束)
    """
    mode = os.environ.get("API_TOOLS_MODE", "read").strip().lower()
    unregister_external_tool_by_prefix("api_")
    _API_TOOL_INDEX.clear()
    if mode == "off":
        logger.info("[api_bridge] API_TOOLS_MODE=off,跳过 API 工具注册")
        return 0
    methods = {"GET"} if mode != "all" else {"GET", "POST", "PUT", "PATCH", "DELETE"}
    try:
        spec = await fetch_openapi_spec()
        # 侧表覆盖全量端点(含被上限截断的长尾),工具表只注册前 API_TOOLS_MAX 个;
        # 同名(operationId 折叠后碰撞)按先到为准,与 register_external_tool 幂等语义一致
        for m, p, op in _iter_operations(spec, methods, cap=False):
            key = _sanitize_tool_name(str(op.get("operationId") or f"{m}_{p}"))
            if key not in _API_TOOL_INDEX:
                _API_TOOL_INDEX[key] = {
                    "method": m,
                    "path": p,
                    "summary": str(op.get("summary") or "")[:120],
                }
        count = 0
        for m, p, op in _iter_operations(spec, methods):
            tool = _operation_to_tool(m, p, op)
            if register_external_tool(tool, make_api_handler(m, p)):
                count += 1
        for tool, handler in _entry_tools():
            if register_external_tool(tool, handler):
                count += 1
        logger.info(
            "[api_bridge] API 全量操控桥接注册完成: mode=%s, 可调用端点 %d 个, 已注册工具 %d",
            mode,
            len(_API_TOOL_INDEX),
            count,
        )
        return count
    except Exception as e:  # noqa: BLE001 启动降级:spec 拉取失败不阻塞应用启动
        logger.warning("[api_bridge] API 工具注册失败(忽略): %s", e)
        return 0


async def refresh_api_tools_bridge() -> tuple[int, str]:
    """清 spec 缓存后重新拉取并注册。返回 (注册数量, 错误信息)。"""
    clear_spec_cache()
    try:
        return await setup_api_tools_bridge(), ""
    except Exception as e:  # pragma: no cover - setup 内部已兜底
        return 0, str(e)

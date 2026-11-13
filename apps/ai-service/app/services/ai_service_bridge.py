# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""ai-service 自身 HTTP 接口 → MCP 工具桥接(2026-11-13 立,插件体系深度开发)。

缺口(本票要填的那一格):
    既有 `api_tools_bridge.py` 只把 **apps/api**(Fastify,OpenAPI)的端点桥接成
    MCP 工具;而承载 AI 能力本身的本服务 **ai-service**(FastAPI)自身的 HTTP 接口
    —— agent_runtime / knowledge / rag / orchestration / workflow / memory /
    connectors / skills / sessions … 数百条 operation —— **从未被桥接**。于是
    "让 AI 无缝调用整个项目所有接口"这条目标在 ai-service 这一侧一直是空的:模型
    能经 api_* 工具操作业务后端,却调不到同进程里那些 agent/编排/知识面能力。

    实测(现读 create_app().openapi()):本服务 621 条 path / 682 条 operation,
    operationId 全部存在且无重复 —— 天然可枚举、可命名、可调用。

与 api_tools_bridge 的关系(§0.6 单一真相源,本模块不复写任何一条):
    - OpenAPI → 参数 schema 的展开逻辑(`_build_input_schema`)、工具名清洗
      (`_sanitize_tool_name`)、排除正则(`_exclude_patterns`)、数量上限
      (`_tools_max`)一律 **import 复用 api_tools_bridge 里已被测试钉住的那一份**,
      绝不抄第二份。抄一份就是第二份真相,第二份真相在本仓的失效形态永远是"安静漂移"。
    - **不同点(本模块的超越轴)**:出站传输层。
      api_tools_bridge 经 `httpx.AsyncClient` 走 **网络** 打 apps/api(跨进程);
      本服务就是 ai-service 自己,**在进程内经 ASGITransport 自调用**——
      零网络端口依赖、零启动期自调 HTTP 死锁(本服务启动早期 self-HTTP 会撞上
      尚未就绪的事件循环),且天然继承 JWT 中间件、审计、输入净化、限流整条链。

鉴权(与 ai-tools 出站通道对齐,但方向相反):
    ai-service 的路由受 `JWTAuthMiddleware` 保护(验 `Authorization: Bearer`,
    aud=`ihui-ai-users`,见 jwt_auth.py)。本桥接为每次调用 **现签一枚短时 access
    token**(claims 形状严格对齐 `routers/sso.py::_provision_and_sign`,即本仓唯一
    的 ai-service access token 签发先例),把调用者的 `__user_id`/`__user_role`
    写进 sub/userId/roleId —— 让被调端点看到的是**发起这次工具调用的真实主体**,
    而不是匿名的内部通道。JWT_SECRET 未配置(本地开发降级档)时中间件自行放行,
    此时无 token 也能通(fail-open 仅限该档,与既有测试夹具同语义)。

失效方向(§0.3/§0.10):
    - spec 取不到 / 构造失败 ⇒ 启动降级返 0(不阻塞应用启动,与 api_tools_bridge 同);
    - 单次调用异常 ⇒ 具名错误码回传 LLM(`AIS_BRIDGE_ERROR`),绝不抛出打断对话链;
    - 写操作(POST/PUT/PATCH/DELETE)仍要求 `__user_role >= 1`,与 api_tools_bridge
      同一条闸 —— 放开的是可见面,不是授权面。

排除自指递归面(本模块特有的失效型):
    本服务里有一族端点是**触发 AI 对话本身**的(`/api/llm/complete*`、stream、
    steer、tool-result、approval-response …)。若把它们也桥接成工具,模型可以
    "在回答里再调一次完整对话",构成无限嵌套 + token 失控。默认档一律排除
    (可用 `AIS_TOOLS_ALLOW_LLM_ROUTES=1` 显式放开,须自担递归风险)。
"""

from __future__ import annotations

import logging
import os
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import jwt as pyjwt

from app.core.config import settings

from .api_tools_bridge import (
    _WRITE_METHODS,
    _build_input_schema,
    _exclude_patterns,
    _sanitize_tool_name,
    _tools_max,
)
from .mcp_server import (
    _TOOL_HANDLERS,
    MCPTool,
    mcp_server,
    register_external_tool,
    unregister_external_tool_by_prefix,
)

logger = logging.getLogger(__name__)

__all__ = [
    "AIS_BRIDGE_ERROR",
    "AIS_TOOL_PREFIX",
    "setup_ai_service_bridge",
    "refresh_ai_service_bridge",
]

# 具名错误码:与 api_tools_bridge 的 API_BRIDGE_ERROR 同形(契约名)。
AIS_BRIDGE_ERROR: str = "AIS_BRIDGE_ERROR"

# 本桥接注册的工具统一前缀 —— 供按前缀精确撤销(_API_TOOL_PREFIX="api_" 不冲突)。
AIS_TOOL_PREFIX: str = "ais_"

# 自指递归面:命中即默认排除(LLM 对话入口绝不能被 AI 自己再调)。
_LLM_RECURSION_PATTERNS: tuple[str, ...] = (
    "^/api/llm/complete",
    "^/api/llm/moa-complete",
    "^/api/llm/anthropic/",
    "^/api/llm/gemini/",
    "^/api/llm/embeddings",
    "^/api/v1/chat",
    "^/api/langgraph",
)

# 侧表:tool_name → {method, path, summary}。与 api_tools_bridge._API_TOOL_INDEX
# 同生命周期(注册入口重建),供 ais_endpoints_search / ais_endpoint_call 反查。
_AIS_TOOL_INDEX: dict[str, dict[str, str]] = {}

# 进程内 ASGI app 句柄(惰性解析;不持有引用则无法自调用)。
_APP_HOLDER: dict[str, Any] = {}

_JWT_AUDIENCE = "ihui-ai-users"  # 对齐 jwt_auth._verify_token 的 audience
_TOKEN_TTL_SECONDS = 120.0       # 短时票:一次工具调用内有效,不落盘不缓存
_HANDLER_TIMEOUT = 30.0
_JWT_AUDIENCE = "ihui-ai-users"  # 对齐 jwt_auth._verify_token 的 audience
_TOKEN_TTL_SECONDS = 120.0       # 短时票:一次工具调用内有效,不落盘不缓存
_HANDLER_TIMEOUT = 30.0
_RESULT_TRUNCATE = 8000


def _allow_llm_routes() -> bool:
    """是否放开自指递归面(默认关)。显式 =1 才放开,须自担嵌套风险。"""
    return os.environ.get("AIS_TOOLS_ALLOW_LLM_ROUTES", "").strip() == "1"


# ---------------------------------------------------------------------------
# 进程内 ASGI app 解析 + 短时 access token 签发
# ---------------------------------------------------------------------------

def _resolve_app() -> Any:
    """惰性解析本服务 FastAPI 实例(经 app.main,进程内单例)。

    用 `fastapi_app`(纯 FastAPI)而非外层 socketio.ASGIApp:本桥接只调 HTTP 路由,
    不经 socket.io 分支,也不必再过 ws_conn_gate(那是 WebSocket 闸门)。
    首次解析缓存进 _APP_HOLDER;取不到抛 RuntimeError 由调用方转具名错误。
    """
    if "app" in _APP_HOLDER:
        return _APP_HOLDER["app"]
    from ..main import fastapi_app

    if fastapi_app is None:
        raise RuntimeError("app.main.fastapi_app 尚未构造,无法进程内自调用")
    _APP_HOLDER["app"] = fastapi_app
    return fastapi_app


def _mint_access_token(user_id: str, role_id: int) -> str:
    """为本次调用现签一枚 ai-service access token(不缓存、不落盘)。

    claims 严格对齐 jwt_auth._verify_token 的验签规则(HS256 + iss + aud +
    type=access),也复用 routers/sso.py::_provision_and_sign 的 payload 形状
    (sub/userId/roleId)。拿不到 jwt_secret 时返回空串 —— 本地开发降级档中间件
    自行放行,无须 token;配置了 secret 却签不出则由调用方按凭据缺失明确失败。
    """
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


def _path_domain(path: str) -> str:
    """从端点 path 抽一级能力域(去掉 api/v1 前缀后的第一个非空段)。

    本服务 path 形如 /api/<domain>/... 或 /api/v1/<domain>/...;取去掉 'api'/'v1'
    后的第一个非空段作为域,便于 ais_endpoints_search 按 domain 浏览 682 条端点。
    """
    for seg in path.split("/"):
        if seg and seg not in ("api", "v1"):
            return seg
    return "(root)"


def _is_excluded(path: str) -> bool:
    """默认排除面:docs/ws/internal/debug(复用 api_tools_bridge)+ 自指递归面。"""
    for pat in _exclude_patterns():
        if pat.search(path):
            return True
    if not _allow_llm_routes():
        for rx in _LLM_RECURSION_PATTERNS:
            if re.search(rx, path):
                return True
    return False


def build_self_spec() -> dict[str, Any]:
    """现读本服务 FastAPI 的 OpenAPI spec(进程内,不经 HTTP)。

    直接调 `fastapi_app.openapi()`,拿到的 path 天然**不带 /api 前缀之外的服务器
    前缀** —— 与 api_tools_bridge 拉外部 spec 后还要 `resolve_mounted_path` 拼
    servers 不同,本服务 include_router 时已把 `/api` 写进 path,可原样调用。
    """
    app = _resolve_app()
    spec = app.openapi()
    return spec if isinstance(spec, dict) else {}


def _iter_self_operations(
    spec: dict[str, Any], methods: set[str] | None = None, cap: bool = True
) -> list[tuple[str, str, dict[str, Any]]]:
    """展开本服务 spec 为 (METHOD, path, operation);先排除、再方法过滤、最后上限。

    与 api_tools_bridge._iter_operations 同一条纪律:方法过滤必须在上限截断**之前**
    (否则 read 模式只拿到"前 N 个里恰好是 GET 的")。排除规则见 _is_excluded。
    """
    ops: list[tuple[str, str, dict[str, Any]]] = []
    for path, item in (spec.get("paths") or {}).items():
        if not isinstance(item, dict):
            continue
        if _is_excluded(str(path)):
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
            "[ais_bridge] 候选端点 %d 超过 AIS_TOOLS_MAX(复用 API_TOOLS_MAX)=%d,已截断",
            len(ops),
            max_n,
        )
        ops = ops[:max_n]
    return ops


def _self_tool_name(method: str, path: str, op: dict[str, Any]) -> str:
    """工具名:优先 operationId,缺失回退 method_path;统一 ais_ 前缀。

    本服务实测 operationId 全在且无重复,operationId 分支是主路径;
    回退分支只兜 FastAPI 未写 operation_id 的路由(用 method+path 仍唯一)。
    """
    raw_id = str(op.get("operationId") or f"{method}_{path}")
    return _sanitize_tool_name(raw_id).replace("api_", "ais_", 1)


# ---------------------------------------------------------------------------
# 端点 → MCP 工具定义 + 进程内 ASGI handler
# ---------------------------------------------------------------------------

def _operation_to_tool(method: str, path: str, op: dict[str, Any]) -> MCPTool:
    """单个 operation → MCPTool(name ais_ 前缀 + 描述含写操作/进程内标记)。"""
    summary = str(op.get("summary") or op.get("description") or "").strip() or "无描述"
    tags = ",".join(str(t) for t in (op.get("tags") or []))
    desc = f"[AIS {method} {path}] {summary}"
    if tags:
        desc += f"；标签: {tags}"
    if method in _WRITE_METHODS:
        desc += "；⚠写操作(需管理员)"
    desc += "；本服务自身接口"
    if len(desc) > 300:
        desc = desc[:297] + "..."
    return MCPTool(
        name=_self_tool_name(method, path, op),
        description=desc,
        input_schema=_build_input_schema(op),
    )


def make_ais_handler(
    method: str, path: str
) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    """生成调用本服务 {method} {path} 端点的 async handler(进程内 ASGI 自调用)。

    与 api_tools_bridge.make_api_handler 同一套约定:
    - path 模板参数({xxx})从入参取值做 URL 编码替换,缺失 → MISSING_PATH_PARAM
    - GET/HEAD/DELETE:其余入参(除 __ 前缀)作为 query;POST/PUT/PATCH 作为 JSON body
    - 写操作要求 __user_role >= 1,否则 PERMISSION_DENIED(不发起调用)
    - 统一返回 {ok, status, data};响应超 _RESULT_TRUNCATE 截断;异常 → AIS_BRIDGE_ERROR
    不同点:经 ASGITransport 打进程内 app,并把调用者身份签成短时 Bearer token,
    让被调端点看到真实主体(而非匿名内部通道)。
    """
    method_u = method.upper()
    is_write = method_u in _WRITE_METHODS
    use_query = method_u in {"GET", "HEAD", "DELETE"}
    path_params = set(re.findall(r"\{([^{}]+)\}", path))

    async def handler(args: dict[str, Any]) -> dict[str, Any]:
        from urllib.parse import quote

        from httpx import ASGITransport, AsyncClient

        try:
            uid = str(args.get("__user_id") or "").strip()
            role_raw = args.get("__user_role")
            try:
                role_id = int(role_raw) if role_raw is not None else 0
            except (TypeError, ValueError):
                role_id = 0
            role_id = max(0, role_id)
            if is_write and role_id < 1:
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

            token = _mint_access_token(uid, role_id)
            headers: dict[str, str] = {}
            if token:
                headers["Authorization"] = f"Bearer {token}"

            app = _resolve_app()
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://ais-internal",
                timeout=_HANDLER_TIMEOUT,
            ) as client:
                if use_query:
                    resp = await client.request(
                        method_u, filled, headers=headers, params=extra
                    )
                else:
                    resp = await client.request(
                        method_u, filled, headers=headers, json=extra
                    )

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
        except Exception as e:  # noqa: BLE001 统一兜底,错误回传 LLM 而非抛出打断对话链
            return {"ok": False, "errorCode": AIS_BRIDGE_ERROR, "message": str(e)}

    return handler


# ---------------------------------------------------------------------------
# 稳定入口工具(先搜后调,与 api_tools_bridge 的 api_endpoints_search/call 同形)
# ---------------------------------------------------------------------------

async def _ais_search(args: dict[str, Any]) -> dict[str, Any]:
    """ais_endpoints_search:按关键词/域/方法在本服务已注册端点侧表里搜(只读)。

    682 条端点对模型而言偏多,支持三种用法:
    - query 关键词:在 name/path/summary 里做 token 命中打分;
    - domain:按能力域(如 knowledge/agent/memory)筛选 —— path 一级段,见 _path_domain;
    - query 与 domain 均留空:返回**域清单**(各域端点数),先浏览再下钻,而非原始前 N 条。
    """
    query = str(args.get("query") or "").strip().lower()
    method = str(args.get("method") or "").strip().upper()
    domain = str(args.get("domain") or "").strip().lower()
    try:
        limit = max(1, min(int(args.get("limit") or 20), 50))
    except (TypeError, ValueError):
        limit = 20

    # 空查询且未指定域 ⇒ 列域清单(浏览入口),让模型先看全局能力分布再下钻。
    if not query and not domain:
        domains: dict[str, int] = {}
        for entry in _AIS_TOOL_INDEX.values():
            d = entry.get("domain") or "(root)"
            domains[d] = domains.get(d, 0) + 1
        listing = [
            {"domain": d, "endpoints": c}
            for d, c in sorted(domains.items(), key=lambda kv: (-kv[1], kv[0]))
        ]
        return {
            "ok": True,
            "mode": "domains",
            "total": len(_AIS_TOOL_INDEX),
            "domain_count": len(listing),
            "domains": listing,
            "hint": "用 domain=<域名> 或 query=<关键词> 下钻;再用 ais_endpoint_call(name, arguments) 调用",
        }

    tokens = [t for t in query.replace("_", " ").replace("-", " ").split() if t]
    scored: list[tuple[int, dict[str, str]]] = []
    for name, entry in _AIS_TOOL_INDEX.items():
        if method and entry["method"] != method:
            continue
        if domain and entry.get("domain") != domain:
            continue
        haystack = f"{name} {entry['path']} {entry['summary']}".lower()
        if tokens:
            score = sum(1 for t in tokens if t in haystack)
            if score == 0:
                continue
        else:
            score = 0
        scored.append(
            (
                score,
                {
                    "name": name,
                    "method": entry["method"],
                    "path": entry["path"],
                    "summary": entry["summary"],
                    "domain": entry.get("domain") or "(root)",
                },
            )
        )
    scored.sort(key=lambda item: (-item[0], item[1]["name"]))
    matches = [item[1] for item in scored[:limit]]
    return {
        "ok": True,
        "mode": "endpoints",
        "count": len(matches),
        "total": len(_AIS_TOOL_INDEX),
        "endpoints": matches,
        "hint": "用 ais_endpoint_call(name, arguments) 调用上面任一 name",
    }


async def _ais_call(args: dict[str, Any]) -> dict[str, Any]:
    """ais_endpoint_call:按 name 转发到已注册的 ais_ 端点工具。

    只允许 ais_ 前缀且已在侧表中的工具 —— 否则本入口等于把 run_command/write_file
    等高危工具暴露给一次字符串参数,是越权捷径。被 API_TOOLS_MAX 截断掉的长尾端点
    仍按侧表元数据即时建 handler 调用(上限只约束进工具表的条数,不削弱可调用面)。
    """
    name = str(args.get("name") or "").strip()
    if not name:
        return {"ok": False, "errorCode": "INVALID_ARGS", "message": "缺少必填参数: name"}
    arguments = args.get("arguments")
    if arguments is None:
        arguments = {}
    if not isinstance(arguments, dict):
        return {"ok": False, "errorCode": "INVALID_ARGS", "message": "arguments 必须是对象"}
    entry = _AIS_TOOL_INDEX.get(name) if name.startswith(AIS_TOOL_PREFIX) else None
    if entry is None:
        return {
            "ok": False,
            "errorCode": "UNKNOWN_AIS_TOOL",
            "message": f"未注册的本服务工具: {name}(先用 ais_endpoints_search 取准确 name)",
        }
    user_id = str(args.get("__user_id") or "")
    session_id = str(args.get("__session_id") or "")
    try:
        user_role = int(args.get("__user_role") or 0)
    except (TypeError, ValueError):
        user_role = 0
    if name in _TOOL_HANDLERS:
        result = await mcp_server.call_tool(
            name, arguments, user_role=user_role, user_id=user_id or None, session_id=session_id or None
        )
        return {"tool": name, **result}
    merged: dict[str, Any] = dict(arguments)
    merged["__user_id"] = user_id
    merged["__user_role"] = user_role
    merged["__session_id"] = session_id
    result = await make_ais_handler(entry["method"], entry["path"])(merged)
    return {"tool": name, **result}


def _entry_tools() -> list[tuple[MCPTool, Any]]:
    """两个稳定入口工具定义 + handler。"""
    return [
        (
            MCPTool(
                name="ais_endpoints_search",
                description=(
                    "[本服务桥接] 按关键词搜索 ai-service 自身后端 HTTP 接口(agent/知识/RAG/"
                    "编排/workflow/memory/技能/会话等能力面),返回可调用的工具名 name 及 "
                    "method/path/摘要。搜索结果里的 name 交给 ais_endpoint_call 调用。"
                    "本桥只覆盖 ai-service 自身;业务域接口(人事/电商/内容/订单等)在 apps/api,"
                    "走 api_* 族(api_list_endpoints/api_read/api_write/api_delete)。"
                    "这里搜不到时换 api_list_endpoints 再搜,不要断言项目没有该接口。"
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "关键词;留空且未指定 domain 则返回域清单"},
                        "domain": {"type": "string", "description": "按能力域筛选(如 knowledge/agent/memory);留空列出域清单时不用"},
                        "method": {"type": "string", "description": "限定 HTTP 方法,如 GET/POST(可选)"},
                        "limit": {"type": "integer", "description": "返回条数,默认 20,上限 50"},
                    },
                },
            ),
            _ais_search,
        ),
        (
            MCPTool(
                name="ais_endpoint_call",
                description=(
                    "[本服务桥接] 调用 ais_endpoints_search 找到的某个 ai-service 自身接口。"
                    "name 必须是搜索返回的 ais_ 前缀工具名;arguments 是该接口的参数对象。"
                    "写操作(POST/PUT/PATCH/DELETE)仍需管理员角色。"
                ),
                input_schema={
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "接口工具名(来自 ais_endpoints_search)"},
                        "arguments": {"type": "object", "description": "接口参数(path/query/body 平铺)"},
                    },
                    "required": ["name"],
                },
            ),
            _ais_call,
        ),
    ]


# ---------------------------------------------------------------------------
# 注册入口
# ---------------------------------------------------------------------------

def unregister_ai_service_bridge() -> int:
    """按 ais_ 前缀撤销本桥接注册的全部工具并清侧表,返回撤销数量。"""
    removed = unregister_external_tool_by_prefix(AIS_TOOL_PREFIX)
    _AIS_TOOL_INDEX.clear()
    return len(removed)


async def setup_ai_service_bridge() -> int:
    """把 ai-service 自身 OpenAPI 端点注册为 MCP 工具,返回注册数量(失败降级返 0)。

    复用 API_TOOLS_MODE(off|read|all,默认 all)与 API_TOOLS_MAX —— 同一族开关
    同时管两座桥,不另立第二份配置面。写操作仍受 handler 内 __user_role>=1 闸 +
    各路由自身依赖的双重授权。
    """
    unregister_external_tool_by_prefix(AIS_TOOL_PREFIX)
    _AIS_TOOL_INDEX.clear()
    mode = os.environ.get("API_TOOLS_MODE", "all").strip().lower()
    if mode == "off":
        logger.info("[ais_bridge] API_TOOLS_MODE=off,跳过本服务接口注册")
        return 0
    methods = {"GET"} if mode != "all" else {"GET", "POST", "PUT", "PATCH", "DELETE"}
    try:
        spec = build_self_spec()
        for m, p, op in _iter_self_operations(spec, methods, cap=False):
            key = _self_tool_name(m, p, op)
            if key not in _AIS_TOOL_INDEX:
                _AIS_TOOL_INDEX[key] = {
                    "method": m,
                    "path": p,
                    "summary": str(op.get("summary") or "")[:120],
                    "domain": _path_domain(p),
                }
        count = 0
        for m, p, op in _iter_self_operations(spec, methods):
            tool = _operation_to_tool(m, p, op)
            if register_external_tool(tool, make_ais_handler(m, p)):
                count += 1
        for tool, handler in _entry_tools():
            if register_external_tool(tool, handler):
                count += 1
        logger.info(
            "[ais_bridge] 本服务接口桥接注册完成: mode=%s, 可调用端点 %d 个, 已注册工具 %d",
            mode,
            len(_AIS_TOOL_INDEX),
            count,
        )
        return count
    except Exception as e:  # noqa: BLE001 启动降级:spec 构造失败不阻塞应用启动
        logger.warning("[ais_bridge] 本服务接口注册失败(忽略): %s", e)
        return 0


async def refresh_ai_service_bridge() -> tuple[int, str]:
    """重建本服务接口工具(现读 spec,无需清缓存)。返回 (注册数量, 错误信息)。"""
    try:
        return await setup_ai_service_bridge(), ""
    except Exception as e:  # pragma: no cover - setup 内部已兜底
        return 0, str(e)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

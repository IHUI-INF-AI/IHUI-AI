# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent Engine JSON-RPC 传输层(P2-③,2026-09-18 立)。

端:
  POST /api/engine/rpc   JSON-RPC 2.0 单发。非流式方法直接返回 JSON 响应;
                         流式方法(thread.prompt / thread.resume)返回
                         text/event-stream —— 逐帧推 thread/event、tool/execute、
                         approval/request 通知,末帧为该方法的 JSON-RPC 响应
                         (客户端按 id 匹配即知本轮结束),再以 event: done 收尾。
  WS   /api/engine/ws    JSON-RPC 2.0 全双工长连接:一帧一条报文;通知与响应同流。
                         每帧独立并发处理,故 thread.prompt 长跑期间仍能收
                         thread.interrupt / approval.respond / tools.result。

鉴权:
  - HTTP 由 JWTAuthMiddleware 统一保护(与其它 /api 路由一致);
  - WS 不经 HTTP 中间件,握手时显式校验 ?token=<jwt> 或 Authorization: Bearer
    (verify_access_token);校验失败以 1008 关闭连接。

为什么需要独立传输层:引擎内核(services/agent_engine.py)只认 JSON-RPC 报文,
第三方应用 / CLI / 桌面端 / 测试可各自接自己的承载,不必改引擎语义。
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from typing import Any

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, StreamingResponse

from ..core.jwt_auth import resolve_request_user_id, verify_access_token
from ..services.agent_engine import (
    INVALID_REQUEST,
    PARSE_ERROR,
    AgentEngine,
    _coerce_role_id,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/engine", tags=["agent-engine"])

# 需要流式回传的通知方法集合(其余方法单发即返)
STREAMING_METHODS: frozenset[str] = frozenset({"thread.prompt", "thread.resume", "agent.exec"})
# SSE 空闲轮询间隔(秒):空闲时发注释帧心跳,防中间代理按空闲断流
SSE_POLL_SECONDS = 1.0


# ---------------------------------------------------------------------------
# 依赖装配(引擎是进程级单例:线程状态与事件订阅跨连接保留)
# ---------------------------------------------------------------------------


def _make_loop_factory() -> Any:
    """构造主循环工厂:复用 agents 路由既有的 LLM/工具装配(不重复实现一遍)。"""

    async def _factory(spec: dict[str, Any], host_tools: list[Any]) -> Any:
        from ..services.agent_loop_v2 import AgentLoopV2
        from .agents import _build_loop_v2_tools, _make_loop_v2_llm

        # V3 #47 第二格:角色过桥。spec["role_id"] 由 agent_engine._spec(thread) 给出,
        # 而 thread.role_id 只可能来自承载层绑定的已验证身份(_bind_principal)。
        # 这里再过一次 _coerce_role_id 是**刻意的纵深**:工厂是 spec → 循环的唯一装配点,
        # 任何漏填/畸形值都在这里落成最严的 0,而不是被当成"没限制"传下去。
        user_role = _coerce_role_id(spec.get("role_id", 0))
        tools = await _build_loop_v2_tools(spec.get("tool_names"), user_role=user_role)
        # 负向工具过滤(2026-09-18 第二批,对标 Codex per-app omit_tools_from)
        deny = spec.get("deny_tools") or []
        if deny:
            deny_set = {str(x) for x in deny}
            tools = [t for t in tools if getattr(t, "name", "") not in deny_set]
        if host_tools:
            # 宿主注入工具与内置同名时以宿主为准(客户端显式覆盖内置实现)
            host_names = {getattr(t, "name", "") for t in host_tools}
            tools = [t for t in tools if getattr(t, "name", "") not in host_names]
            tools.extend(host_tools)
        return AgentLoopV2(
            _make_loop_v2_llm(spec.get("model")),
            tools=tools,
            max_iterations=int(spec.get("max_iterations") or 8),
            enable_checkpoint=True,
            session_id=spec.get("session_id"),
            user_id=spec.get("user_id"),
            # V3 #47 第二格:引擎线程的角色喂进循环,使自带工具也经同一份角色矩阵
            user_role=user_role,
            conversation_id=spec.get("conversation_id"),
            permission_mode=spec.get("permission_mode"),
            # 2026-09-18 收尾修复:上一批 per-tool 审批策略只进了 spec,生产工厂
            # 漏传导致产线链路被静默丢弃(测试工厂传了所以测试绿)——此处补接线。
            approval_policies=spec.get("approval_policies"),
            # 2026-09-18 第二批:生成参数透传面(temperature/top_p/reasoning_effort/...)
            model_params=spec.get("model_params"),
            # 2026-09-18 第三批(Goals 对标):线程目标注入 system 全程可见
            thread_goal=spec.get("goal"),
        )

    return _factory


async def _default_tool_lister() -> list[dict[str, Any]]:
    """工具清单:优先 MCP 超级工具池(去重/仲裁后的统一 manifest),否则内置清单。"""
    try:
        from ..services.mcp_tool_aggregator import MCPSuperToolAggregator
        from .agents import _build_supertool_pool

        pool = await _build_supertool_pool(None)
        if pool is not None:
            manifest = MCPSuperToolAggregator().manifest(pool)
            return [
                {
                    "name": item.get("key"),
                    "description": item.get("description", ""),
                    "source": "mcp-superpool",
                    "server": item.get("server_name"),
                    "collision": bool(item.get("collision")),
                }
                for item in manifest
            ]
    except Exception as e:  # noqa: BLE001 - 聚合池失败降级内置清单(不影响可用性)
        logger.warning("[engine] 超级工具池清单失败(降级内置清单): %s", e)
    from ..services.mcp_server import mcp_server

    return [
        {
            "name": tool.name,
            "description": (tool.description or "")[:200],
            "source": "builtin",
        }
        for tool in mcp_server.list_tools()
    ]


def _default_cost_report(filt: dict[str, Any] | None) -> dict[str, Any]:
    """成本账本汇总(含 P0-① 缓存三段计价字段,aggregate 内已按缓存拆分)。"""
    from ..services.cost_ledger import cost_ledger

    return {
        "aggregate": cost_ledger.aggregate(filt),
        "topTools": cost_ledger.top_tools(10, filt),
    }


def _default_model_lister() -> list[dict[str, Any]]:
    """模型路由清单:模型级单价 + 厂商兜底单价 + 缓存读/写乘数(差异化能力明面化)。"""
    from ..core.model_pricing import (
        PROVIDER_PRICES_PER_1M,
        cache_multipliers,
        list_known_model_prices,
    )

    rows: list[dict[str, Any]] = []
    for model, price in sorted(list_known_model_prices().items()):
        read_mult, write_mult = cache_multipliers(_provider_of(model))
        rows.append(
            {
                "model": model,
                "scope": "model",
                "inputPer1M": price.get("input"),
                "outputPer1M": price.get("output"),
                "cacheReadMultiplier": read_mult,
                "cacheWriteMultiplier": write_mult,
            }
        )
    for provider, price in sorted(PROVIDER_PRICES_PER_1M.items()):
        read_mult, write_mult = cache_multipliers(provider)
        rows.append(
            {
                "model": f"{provider}/*",
                "scope": "provider",
                "provider": provider,
                "inputPer1M": price.get("input"),
                "outputPer1M": price.get("output"),
                "cacheReadMultiplier": read_mult,
                "cacheWriteMultiplier": write_mult,
            }
        )
    return rows


def _provider_of(model: str) -> str | None:
    """LiteLLM 'provider/model' 形态取厂商前缀;无前缀返回 None(走默认乘数)。"""
    head, sep, _ = model.partition("/")
    return head if sep and head else None


ENGINE = AgentEngine(
    loop_factory=_make_loop_factory(),
    tool_lister=_default_tool_lister,
    cost_report=_default_cost_report,
    model_lister=_default_model_lister,
)


# ---------------------------------------------------------------------------
# HTTP 传输
# ---------------------------------------------------------------------------


def _sse_frame(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _sse_stream(payload: dict[str, Any]) -> Any:
    """把一次流式方法调用转成 SSE 帧序列(通知在前,方法响应收尾)。"""
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    async def _emit(message: dict[str, Any]) -> None:
        await queue.put(message)

    task = asyncio.ensure_future(ENGINE.handle_message(payload, _emit))
    try:
        while not task.done() or not queue.empty():
            try:
                message = await asyncio.wait_for(queue.get(), timeout=SSE_POLL_SECONDS)
            except TimeoutError:
                # 空闲心跳(注释帧不进入客户端 JSON 解析路径)
                yield ": ping\n\n"
                continue
            yield _sse_frame(message)
        response = task.result()
        if response is not None:
            yield _sse_frame(response)
        yield "event: done\ndata: [DONE]\n\n"
    finally:
        if not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task


def _bind_principal(message: Any, principal: str | None, role: int = 0) -> Any:
    """O19(2026-09-21):把**连接层已验证的身份**写入 params.userId,覆盖客户端自述值。

    引擎 `thread.start` 的 userId 原本是客户端自述 ⇒ 谎报他人 id 即可解他人审批
    (approval.respond 以 thread.user_id 为 principal)。绑定后:线程属主只可能是
    这条连接证明过的身份。principal 为 None(未鉴权/dev 通道)时不写 userId,不新增
    任何权限 —— 那类通道创建的线程 owner 仍为自述值,与其结算通道同一信任级。

    V3 #47 第二格(2026-09-26):同一处还要绑**角色** `params.roleId`,它与属主同性质
    —— 都是"谁在调用"的一部分,只可能是这条连接证明过的值。一处刻意的不对称:
    userId 在未鉴权通道上保留客户端自述值(上面那句历史语义不变),而 **roleId 一律
    被覆盖**,取不到验证角色就是 0。理由是角色属**授权输入** —— 放过自述值等于给任何
    通道留一条"自称 admin"的旁路,那正是本票要堵的那一格的镜像。
    """
    if not isinstance(message, dict):
        return message
    params = message.get("params")
    if not isinstance(params, dict):
        return message
    params["roleId"] = _coerce_role_id(role)
    if principal:
        params["userId"] = principal
    return message


def _request_role_id(request: Request) -> int:
    """取 JWT 中间件注入的 `request.state.role_id`;缺省即 0(fail-closed)。

    归一逻辑与引擎落点共用 `agent_engine._coerce_role_id` 那一份实现(两处算同一件事
    不得各写一遍 —— 本仓记过多次:各写一遍必然漂移,而漂移表现为"看起来有判据")。
    """
    return _coerce_role_id(getattr(request.state, "role_id", 0))


@router.post("/rpc")
async def engine_rpc(request: Request) -> Any:
    """JSON-RPC 2.0 单发入口;流式方法自动升级为 SSE。

    请求体:单个 JSON-RPC 报文对象,或报文数组(批量:逐条处理并按序返回数组;
    批量中不允许出现流式方法 —— JSON-RPC 批量语义无法承载 SSE,返回 -32600)。
    """
    principal = resolve_request_user_id(request)
    # V3 #47 第二格:与属主同源的角色(取不到即 0,fail-closed)
    role_id = _request_role_id(request)
    try:
        body = await request.json()
    except Exception as e:  # noqa: BLE001 - 非法 JSON 按标准解析错误返回
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": PARSE_ERROR, "message": f"JSON 解析失败: {e}"},
            }
        )

    # O19:连接层身份绑定覆盖全部三种分支(批量 / 流式 SSE / 单发)
    if isinstance(body, list):
        body = [_bind_principal(message, principal, role_id) for message in body]
    else:
        body = _bind_principal(body, principal, role_id)

    if isinstance(body, list):
        results: list[Any] = []
        for message in body:
            if not isinstance(message, dict):
                # 请求体是已解析的 JSON;非对象条目不得再当 JSON 文本二次解析
                results.append(
                    {
                        "jsonrpc": "2.0",
                        "id": None,
                        "error": {"code": INVALID_REQUEST, "message": "报文须为 JSON 对象"},
                    }
                )
                continue
            method = message.get("method")
            if method in STREAMING_METHODS:
                results.append(
                    {
                        "jsonrpc": "2.0",
                        "id": message.get("id"),
                        "error": {
                            "code": -32600,
                            "message": "流式方法不支持批量调用,请单发",
                        },
                    }
                )
                continue
            results.append(await ENGINE.handle_message(message))
        return JSONResponse([r for r in results if r is not None])

    if not isinstance(body, dict):
        # 同上:已解析值不是对象 → 标准 Invalid Request(而非把它当 JSON 文本再解析)
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": INVALID_REQUEST, "message": "报文须为 JSON 对象"},
            }
        )
    method = body.get("method")
    if method in STREAMING_METHODS:
        return StreamingResponse(
            _sse_stream(body),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    response = await ENGINE.handle_message(body)
    if response is None:
        return JSONResponse({"jsonrpc": "2.0", "id": None, "result": None})
    return JSONResponse(response)


# ---------------------------------------------------------------------------
# WebSocket 传输
# ---------------------------------------------------------------------------


def _ws_token(ws: WebSocket) -> str:
    """WS 握手取 token:?token= 优先,其次 Authorization: Bearer。"""
    query_token = ws.query_params.get("token")
    if isinstance(query_token, str) and query_token:
        return query_token
    header = ws.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return ""


async def _handle_ws_frame(
    raw: str,
    emit: Any,
    tasks: set[asyncio.Task[Any]],
    principal: str | None,
    role: int = 0,
) -> None:
    """处理一帧报文(独立任务:长跑的 prompt 不阻塞 interrupt/approval 帧)。

    O19:principal 为**握手时 verify_access_token 已证明的身份**,逐帧写入 params.userId
    覆盖客户端自述值 —— 否则攻击者可在已认证连接上谎报他人 id 解他人审批。
    V3 #47 第二格:同一帧写 params.roleId(同样只可能来自握手时验过的 token)。
    """
    current = asyncio.current_task()
    if current is not None:
        tasks.add(current)
    try:
        message: Any = raw
        with contextlib.suppress(ValueError, UnicodeDecodeError):
            message = _bind_principal(json.loads(raw), principal, role)
        response = await ENGINE.handle_message(message, emit)
        if response is not None:
            await emit(response)
    finally:
        if current is not None:
            tasks.discard(current)


@router.websocket("/ws")
async def engine_ws(ws: WebSocket) -> None:
    """JSON-RPC 2.0 全双工长连接(帧即报文)。"""
    token = _ws_token(ws)
    payload = verify_access_token(token) if token else None
    if payload is None:
        await ws.close(code=1008, reason="Authentication required")
        return
    await ws.accept()
    local_tasks: set[asyncio.Task[Any]] = set()
    lock = asyncio.Lock()

    async def _emit(message: dict[str, Any]) -> None:
        # 并发任务共享同一连接:加锁保证单帧不被交错写入
        async with lock:
            await ws.send_text(json.dumps(message, ensure_ascii=False))

    logger.info(
        "[engine] WS 连接建立 user=%s role=%s",
        payload.get("userId") or payload.get("sub"),
        _coerce_role_id(payload.get("roleId", 0)),
    )
    # O19:握手已验证的身份即本连接全部帧的 principal(与上面日志同源字段)
    ws_principal = payload.get("userId") or payload.get("sub")
    principal = ws_principal if isinstance(ws_principal, str) and ws_principal else None
    # V3 #47 第二格:角色同源 —— 只认握手验过的那份 payload,不认帧内自述值
    ws_role = _coerce_role_id(payload.get("roleId", 0))
    try:
        while True:
            text = await ws.receive_text()
            task = asyncio.ensure_future(
                _handle_ws_frame(text, _emit, local_tasks, principal, ws_role)
            )
            local_tasks.add(task)
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001 - 连接级异常不冒泡到 ASGI(避免 500 噪音)
        logger.warning("[engine] WS 会话异常结束: %s", e)
    finally:
        for task in list(local_tasks):
            if not task.done():
                task.cancel()
        local_tasks.clear()
        logger.info("[engine] WS 连接关闭")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

from ..core.jwt_auth import verify_access_token
from ..services.agent_engine import INVALID_REQUEST, PARSE_ERROR, AgentEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/engine", tags=["agent-engine"])

# 需要流式回传的通知方法集合(其余方法单发即返)
STREAMING_METHODS: frozenset[str] = frozenset({"thread.prompt", "thread.resume"})
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

        tools = await _build_loop_v2_tools(spec.get("tool_names"))
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
            conversation_id=spec.get("conversation_id"),
            permission_mode=spec.get("permission_mode"),
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


@router.post("/rpc")
async def engine_rpc(request: Request) -> Any:
    """JSON-RPC 2.0 单发入口;流式方法自动升级为 SSE。

    请求体:单个 JSON-RPC 报文对象,或报文数组(批量:逐条处理并按序返回数组;
    批量中不允许出现流式方法 —— JSON-RPC 批量语义无法承载 SSE,返回 -32600)。
    """
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
    raw: str, emit: Any, tasks: set[asyncio.Task[Any]]
) -> None:
    """处理一帧报文(独立任务:长跑的 prompt 不阻塞 interrupt/approval 帧)。"""
    current = asyncio.current_task()
    if current is not None:
        tasks.add(current)
    try:
        response = await ENGINE.handle_message(raw, emit)
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

    logger.info("[engine] WS 连接建立 user=%s", payload.get("userId") or payload.get("sub"))
    try:
        while True:
            text = await ws.receive_text()
            task = asyncio.ensure_future(_handle_ws_frame(text, _emit, local_tasks))
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

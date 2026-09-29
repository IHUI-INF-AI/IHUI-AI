# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ai-service traceparent 解析中间件(2026-07-22 立,接收 api 端透传的 trace 上下文)。

与 api 端 utils/trace-context.ts 对等:
- 解析 W3C traceparent 头
- 把 trace_id 注入到 OTel span(关联 api 端 trace)
- 把 trace_id 存入 request.state(供下游使用)
"""

import logging
from collections.abc import Awaitable, Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# ── D147(2026-09-28):本轮 trace id 的**唯一**运行时出口 ─────────────────────────
# 立因:本模块此前只把 trace_id 写进 `request.state`,而 `request` 到不了
# `core/tool_call_trace.py` 这类不带 request 的纯函数(它的调用点在 agent_loop_v2
# 的工具执行路径里)。没有 contextvar,provider/工具调用记录就**接不上**端生成的 id,
# 四段链在第三段断开 —— 而中间件照样报绿(它只管解析头)。
# 三条规矩:
# ① 声明与读写只住在这里,别处不得再建第二份 trace 上下文(票面硬约束);
# ② 值是 api 端(或端侧)透传来的 32hex,**只做关联键**,不得当授权凭据用;
# ③ set 之后必 reset(否则跨请求串号,比没有更糟)。
_current_trace_id: ContextVar[str | None] = ContextVar("ihui_trace_id", default=None)


def current_trace_id() -> str | None:
    """本轮 trace id(32hex);无上下文(后台任务/未带 traceparent)⇒ None。

    返回 None 是**如实**,不得用占位串冒充 —— 调用记录缺 trace.id 与
    trace.id 为 "unknown" 在账面上长得一样,后者会把"没接上"洗成"接上了"。
    """
    return _current_trace_id.get()


@contextmanager
def use_trace_id(trace_id: str | None) -> Iterator[None]:
    """后台任务/测试显式绑定一轮 trace id 的出口(与中间件同一份实现)。

    用于没有 HTTP 请求上下文的链路(jobs、批处理、用例),不得在端内另写一份。
    """
    token = _current_trace_id.set(trace_id)
    try:
        yield
    finally:
        _current_trace_id.reset(token)


def parse_traceparent(traceparent: str) -> dict[str, Any] | None:
    """解析 W3C traceparent 字符串。

    格式:version-trace_id-parent_id-flags
    例:00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01

    Returns:
        {"version", "trace_id", "parent_id", "flags"} 或 None
    """
    if not traceparent:
        return None
    parts = traceparent.split("-")
    if len(parts) != 4:
        return None
    version, trace_id, parent_id, flags = parts
    if len(trace_id) != 32 or len(parent_id) != 16:
        return None
    if not all(c in "0123456789abcdef" for c in trace_id.lower()):
        return None
    if not all(c in "0123456789abcdef" for c in parent_id.lower()):
        return None
    return {
        "version": version,
        "trace_id": trace_id,
        "parent_id": parent_id,
        "flags": flags,
    }


class TraceContextMiddleware(BaseHTTPMiddleware):
    """解析 traceparent 头,存入 request.state.trace_id + 本轮 contextvar。

    - 如果请求带 traceparent 头:解析并存入 request.state.trace_id / current_trace_id()
    - 如果不带:不生成新的(api 端负责生成,ai-service 只接收)
    - 不阻塞请求(解析失败也不报错)
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        traceparent = request.headers.get("traceparent")
        ctx = parse_traceparent(traceparent) if traceparent else None

        if ctx:
            request.state.trace_id = ctx["trace_id"]
            request.state.trace_parent_id = ctx["parent_id"]
            logger.debug("trace_id=%s parent_id=%s", ctx["trace_id"], ctx["parent_id"])
        else:
            request.state.trace_id = None
            request.state.trace_parent_id = None

        # D147:把 trace id 绑进本轮 contextvar。BaseHTTPMiddleware 的 call_next
        # 会在此处派生下游任务,contextvar 按创建时的快照继承 ⇒ 下游 handler 与
        # 其内部调用的纯函数(tool_call_trace 等)读到同一个 trace id,而并发请求
        # 互不串号(每轮各自 set/reset)。
        token = _current_trace_id.set(ctx["trace_id"] if ctx else None)
        try:
            response = await call_next(request)
        finally:
            _current_trace_id.reset(token)

        # 响应头回传 trace_id(便于客户端关联)
        if ctx:
            response.headers["X-Trace-Id"] = ctx["trace_id"]

        return response


def setup_trace_context_middleware(app: Any) -> None:
    """注册 trace 上下文中间件到 FastAPI app。"""
    app.add_middleware(TraceContextMiddleware)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

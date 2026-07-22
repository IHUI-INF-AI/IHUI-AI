"""ai-service traceparent 解析中间件(2026-07-22 立,接收 api 端透传的 trace 上下文)。

与 api 端 utils/trace-context.ts 对等:
- 解析 W3C traceparent 头
- 把 trace_id 注入到 OTel span(关联 api 端 trace)
- 把 trace_id 存入 request.state(供下游使用)
"""

import logging
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


def parse_traceparent(traceparent: str) -> Optional[dict]:
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
    """解析 traceparent 头,存入 request.state.trace_id。

    - 如果请求带 traceparent 头:解析并存入 request.state.trace_id
    - 如果不带:不生成新的(api 端负责生成,ai-service 只接收)
    - 不阻塞请求(解析失败也不报错)
    """

    async def dispatch(self, request: Request, call_next):
        traceparent = request.headers.get("traceparent")
        ctx = parse_traceparent(traceparent) if traceparent else None

        if ctx:
            request.state.trace_id = ctx["trace_id"]
            request.state.trace_parent_id = ctx["parent_id"]
            logger.debug("trace_id=%s parent_id=%s", ctx["trace_id"], ctx["parent_id"])
        else:
            request.state.trace_id = None
            request.state.trace_parent_id = None

        response = await call_next(request)

        # 响应头回传 trace_id(便于客户端关联)
        if ctx:
            response.headers["X-Trace-Id"] = ctx["trace_id"]

        return response


def setup_trace_context_middleware(app):
    """注册 trace 上下文中间件到 FastAPI app。"""
    app.add_middleware(TraceContextMiddleware)

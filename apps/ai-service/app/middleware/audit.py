"""FastAPI 审计中间件(2026-07-22 立,记录所有 POST/PATCH/PUT/DELETE 请求)。

与 api 端 plugins/audit.ts 对等:
- 记录 method/path/status/latency/ip/user_agent
- 透传 trace_id(从 traceparent 头解析)
- 异步记录(不阻塞响应)
"""

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from ..services.audit_service import audit_service


class AuditMiddleware(BaseHTTPMiddleware):
    """记录所有写操作(POST/PATCH/PUT/DELETE)到审计日志。

    GET/HEAD/OPTIONS 不记录(读操作不产生审计事件)。
    """

    async def dispatch(self, request: Request, call_next):
        # 只记录写操作
        if request.method not in ("POST", "PATCH", "PUT", "DELETE"):
            return await call_next(request)

        start = time.time()
        response = await call_next(request)
        latency_ms = (time.time() - start) * 1000

        # 异步记录(不阻塞响应)
        trace_id = audit_service.extract_trace_id(request.headers.get("traceparent"))
        audit_service.log_agent_action(
            agent_id="system",
            action=f"{request.method} {request.url.path}",
            details={
                "status": response.status_code,
                "latency_ms": round(latency_ms, 2),
                "ip": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent", ""),
            },
            trace_id=trace_id,
        )

        return response


def setup_audit_middleware(app):
    """注册审计中间件到 FastAPI app。"""
    app.add_middleware(AuditMiddleware)

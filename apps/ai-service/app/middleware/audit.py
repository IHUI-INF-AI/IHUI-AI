# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""FastAPI 审计中间件(2026-07-22 立,记录所有 POST/PATCH/PUT/DELETE 请求)。

与 api 端 plugins/audit.ts 对等:
- 记录 method/path/status/latency/ip/user_agent
- 透传 trace_id(从 traceparent 头解析)
- 异步记录(不阻塞响应)
"""

import time
from collections.abc import Awaitable, Callable
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..middleware.llm_metrics import record_user_request
from ..services.audit_service import audit_service

# 用户级 LLM 指标的中间件收口路径(2026-10-19 立):只收非流式 complete。
# 流式(/api/llm/complete/stream)不走这里——入口恒 200,中途失败在
# llm_gateway.astream 的 done/error 事件收口,避免双计。
_USER_LLM_PATH = "/api/llm/complete"


class AuditMiddleware(BaseHTTPMiddleware):
    """记录所有写操作(POST/PATCH/PUT/DELETE)到审计日志。

    GET/HEAD/OPTIONS 不记录(读操作不产生审计事件)。
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
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
        # 用户级 LLM 指标(2026-10-19):非流式 complete 按 HTTP 状态码收口一次。
        # 2xx=ok(含 TRIAL_QUOTA 之外的正常返回),非 2xx=failed(额度墙/未配 key/
        # 上游 502 都是用户感知失败)。流式不在此列(见 _USER_LLM_PATH 注释)。
        if request.url.path == _USER_LLM_PATH:
            record_user_request(
                "complete", "ok" if response.status_code < 400 else "failed"
            )

        return response


def setup_audit_middleware(app: Any) -> None:
    """注册审计中间件到 FastAPI app。"""
    app.add_middleware(AuditMiddleware)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

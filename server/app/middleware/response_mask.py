"""Bug-90: API 响应脱敏中间件.

对 JSON 响应体应用 response_masker 规则, 自动脱敏 password / token / idcard / phone / email 等字段.
仅处理 JSON 响应 (content-type 含 application/json), 其他类型 (文件/流式/SSE) 跳过.
"""

from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class ResponseMaskMiddleware(BaseHTTPMiddleware):
    """对 JSON 响应体自动应用脱敏规则."""

    def __init__(self, app, masker=None):
        super().__init__(app)
        self._masker = masker

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        # 无 masker 或非 JSON 响应直接放行
        if self._masker is None:
            return response
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response
        # 流式响应 / SSE 不处理 (避免缓冲整个流)
        if "text/event-stream" in content_type:
            return response
        # 仅处理 200/2xx 成功响应
        if not (200 <= response.status_code < 300):
            return response

        try:
            body = response.body
            if not body:
                return response
            import json

            data = json.loads(body)
            masked: Any = self._masker.mask(data)
            # 若 mask 未改动 (返回同一对象), 直接返回原响应
            if masked is data:
                return response
            new_body = json.dumps(masked, ensure_ascii=False, default=str).encode("utf-8")
            response.body = new_body
            # 更新 content-length
            response.headers["content-length"] = str(len(new_body))
            return response
        except Exception:
            # 脱敏失败不影响正常响应 (fail-open)
            return response

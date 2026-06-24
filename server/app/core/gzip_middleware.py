"""Gzip 响应压缩中间件.

触发条件:
- Content-Type 包含 text/json/xml/javascript/css
- 响应体大小 > 1024 字节
- 请求头 Accept-Encoding 包含 gzip
- Content-Encoding 未设置 (避免重复压缩)
"""
from __future__ import annotations

import gzip
import logging
from io import BytesIO

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# 触发压缩的最小字节数
MIN_SIZE = 1024

# 压缩的 content-type 列表 (前缀匹配)
COMPRESSIBLE_TYPES = (
    "text/",
    "application/json",
    "application/xml",
    "application/javascript",
    "application/x-javascript",
    "image/svg+xml",
)


def _should_compress(content_type: str, body_size: int, accept_encoding: str) -> bool:
    if body_size < MIN_SIZE:
        return False
    if "gzip" not in accept_encoding.lower():
        return False
    ct = content_type.lower().split(";")[0].strip()
    return any(ct.startswith(t) for t in COMPRESSIBLE_TYPES)


class GzipMiddleware(BaseHTTPMiddleware):
    """轻量 Gzip 压缩中间件 (兼容 Starlette BaseHTTPMiddleware)."""

    def __init__(self, app, minimum_size: int = MIN_SIZE, level: int = 6):
        super().__init__(app)
        self.minimum_size = minimum_size
        self.level = level

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Socket.IO 请求跳过压缩 (WebSocket/轮询, headers 可能不完整, 避免 KeyError)
        if request.url.path.startswith("/socket.io"):
            return response

        # 已被上游压缩, 跳过
        if response.headers.get("content-encoding"):
            return response

        accept_encoding = request.headers.get("accept-encoding", "")
        content_type = response.headers.get("content-type", "")

        # 读 body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk if isinstance(chunk, bytes) else chunk.encode()

        if not _should_compress(content_type, len(body), accept_encoding):
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        # 压缩
        buf = BytesIO()
        with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=self.level) as gz:
            gz.write(body)
        compressed = buf.getvalue()

        new_headers = dict(response.headers)
        new_headers["content-encoding"] = "gzip"
        new_headers["content-length"] = str(len(compressed))
        new_headers["vary"] = "Accept-Encoding"
        # 删除原 content-length (BaseHTTPMiddleware 会重新计算)
        new_headers.pop("content-length", None)

        return Response(
            content=compressed,
            status_code=response.status_code,
            headers=new_headers,
            media_type=response.media_type,
        )


def install_gzip(app, minimum_size: int = MIN_SIZE, level: int = 6) -> None:
    """注册 Gzip 中间件 (幂等)."""
    for mw in app.user_middleware:
        if mw.cls is GzipMiddleware:
            return
    app.add_middleware(GzipMiddleware, minimum_size=minimum_size, level=level)
    logger.info(f"Gzip 压缩中间件已注册: 最小 {minimum_size} 字节, level={level}")


__all__ = ["MIN_SIZE", "GzipMiddleware", "install_gzip"]

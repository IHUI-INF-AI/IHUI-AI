"""响应规范化中间件.

修复 5 套响应格式并存的一致性问题:
  - {code:0, msg, data}        (schemas.common 标准)
  - {code:0, message, data}    (response_builder)
  - {code:200, msg, data}      (mock/socketio)
  - {code:"0", msg, data}      (v2.py)
  - {success, fileId} / {code, message, url}  (文件上传类)

策略 (封版阶段, 零破坏):
  - 只做"字段补全", 不做"类型转换"
  - msg / message 互相补全 (前端 normalizeApiResponse 用 `resp.msg || resp.message` 兼容)
  - 不改 code 的类型和值 (避免破坏前端严格判断)
  - 不删任何原有字段 (total/data/success/fileId/url 等保留)
  - 跳过流式响应、WebSocket、非 JSON、非 dict
  - 出错时返回原始响应 (绝不阻断请求)

注册顺序: 应在 gzip 之后注册 (后注册先执行, 规范化先于压缩).
"""
from __future__ import annotations

import json
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class ResponseNormalizerMiddleware(BaseHTTPMiddleware):
    """响应规范化中间件 - 补全 msg/message 字段, 不改 code 不删字段."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # 跳过 Socket.IO / WebSocket (headers 可能不完整, body 是流式)
        path = request.url.path
        if path.startswith("/socket.io") or path.startswith("/ws"):
            return response

        # 跳过非 JSON 响应
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response

        # 跳过流式响应 (SSE / chunked / streaming)
        if response.headers.get("transfer-encoding") == "chunked":
            return response

        # 读取 body (参考 gzip_middleware 模式)
        try:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk if isinstance(chunk, bytes) else chunk.encode()
        except Exception as e:
            logger.debug(f"ResponseNormalizer: read body failed: {e}")
            return response

        if not body:
            return response

        # 解析 JSON
        try:
            data = json.loads(body)
        except Exception:
            return response  # 非 JSON, 不动

        # 只对 dict 响应做补全
        if not isinstance(data, dict):
            return response

        # 补全 msg / message 互相 (不改 code, 不删字段)
        changed = False
        if "msg" in data and "message" not in data:
            data["message"] = data["msg"]
            changed = True
        elif "message" in data and "msg" not in data:
            data["msg"] = data["message"]
            changed = True

        if not changed:
            # 无需补全, 返回原始 body (避免不必要的重新编码)
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        # 重新编码
        try:
            new_body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        except Exception as e:
            logger.debug(f"ResponseNormalizer: re-encode failed: {e}")
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        # 返回新响应 (保留原 headers, 更新 content-length)
        new_headers = dict(response.headers)
        new_headers["content-length"] = str(len(new_body))
        return Response(
            content=new_body,
            status_code=response.status_code,
            headers=new_headers,
            media_type=response.media_type,
        )


def install_response_normalizer(app) -> None:
    """注册响应规范化中间件 (幂等)."""
    for mw in app.user_middleware:
        if mw.cls is ResponseNormalizerMiddleware:
            return
    app.add_middleware(ResponseNormalizerMiddleware)
    logger.info("响应规范化中间件已注册 (补全 msg/message 字段)")


__all__ = ["ResponseNormalizerMiddleware", "install_response_normalizer"]

"""响应脱敏中间件(2026-07-22 立,与 api 端 plugins/response-sanitizer.ts 对等)。

递归将响应 JSON 中的敏感字段(api_key / secret / token / password / twoFactorSecret)
替换为 "***",防止敏感信息泄露到 HTTP 响应。

设计:
- 仅处理 2xx + application/json 响应(SSE / 流式响应跳过)
- 字段名大小写不敏感,子串匹配(如 passwordHash / refreshToken 均命中)
- 脱敏失败 fail-open(不影响正常响应)
- 数据主体访问自身数据时可设 request.state.skip_response_sanitization = True 跳过

P0-5m(2026-07-30):增加白名单 SAFE_KEYS,保护 LLM usage 字段(prompt_tokens /
completion_tokens / total_tokens)不被 "token" 子串规则误伤。这些字段是调用方
必需的计费数据,脱敏会导致 /v1/chat/completions 响应 usage 为空。
"""
from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# 敏感字段名集合(小写,子串匹配)
SENSITIVE_KEYS: set[str] = {
    "api_key",
    "secret",
    "token",
    "password",
    "twofactorsecret",
}

# 白名单:即便命中敏感规则也不脱敏(LLM usage 计量字段,调用方必需)
# P0-5m(2026-07-30):prompt_tokens 等含 "token" 子串会被误伤,导致 usage 返回 ***
# L5-12(2026-08-12):tokenUsage(agent-runtime TokenUsageChart 数据)含 "token"
# 子串被误伤 → 整个值脱敏为 ***;补充白名单。
SAFE_KEYS: set[str] = {
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "tokenusage",
    "token_usage",
}

MASK = "***"

# 不应从原响应复制的 header(由 Response 自动设置)
_SKIP_HEADERS: set[str] = {
    "content-length",
    "content-type",
    "transfer-encoding",
}


def _is_sensitive_key(key: str) -> bool:
    """判断字段名是否命中敏感规则(子串匹配,大小写不敏感)。

    P0-5m(2026-07-30):白名单优先,SAFE_KEYS 中的字段名即便命中敏感规则也不脱敏。
    """
    lower = key.lower()
    # 白名单优先(LLM usage 计量字段)
    if lower in SAFE_KEYS:
        return False
    return any(k in lower for k in SENSITIVE_KEYS)


def _sanitize_response(data: Any) -> Any:
    """递归脱敏:命中敏感字段名的值替换为 ***,其余递归处理。

    返回新对象(不改原对象)。对于敏感字段的值,无论类型(字符串/对象/数组)
    都统一替换为 "***"(对齐 TS 端 maskValue 行为)。
    """
    if isinstance(data, list):
        return [_sanitize_response(item) for item in data]
    if isinstance(data, dict):
        result: dict[str, Any] = {}
        for k, v in data.items():
            if _is_sensitive_key(k):
                result[k] = MASK
            else:
                result[k] = _sanitize_response(v)
        return result
    return data


class ResponseSanitizerMiddleware(BaseHTTPMiddleware):
    """响应脱敏中间件 — 拦截 JSON 响应,递归替换敏感字段值为 ***。"""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)

        # 数据主体访问自身数据时跳过脱敏(GDPR 导出等场景)
        if getattr(request.state, "skip_response_sanitization", False):
            return response

        # 仅处理 2xx
        if not (200 <= response.status_code < 300):
            return response

        content_type = response.headers.get("content-type", "")
        # 仅处理 JSON,跳过 SSE
        if "application/json" not in content_type or "text/event-stream" in content_type:
            return response

        # 消费响应 body(流式 → 缓冲到内存)
        # 注:StreamingResponse 才有 body_iterator;普通 Response 没有。
        # 用 getattr + Any 处理两种情况(mypy 严格模式下 Response 类型不含该属性)。
        body_iter = getattr(response, "body_iterator", None)
        if body_iter is None:
            return response
        body_chunks: list[bytes] = []
        async for chunk in body_iter:
            if isinstance(chunk, str):
                chunk = chunk.encode("utf-8")
            body_chunks.append(chunk)
        body_bytes = b"".join(body_chunks)

        if not body_bytes:
            return response

        try:
            data = json.loads(body_bytes)
            masked = _sanitize_response(data)
            new_body = json.dumps(masked, ensure_ascii=False).encode("utf-8")
        except (json.JSONDecodeError, UnicodeDecodeError, TypeError):
            # 脱敏失败不影响正常响应(fail-open)
            return response

        # 构建新响应(保留原 header,更新 content-length)
        new_response = Response(
            content=new_body,
            status_code=response.status_code,
            media_type="application/json",
        )
        for key, value in response.headers.items():
            if key.lower() not in _SKIP_HEADERS:
                new_response.headers[key] = value

        return new_response


def setup_response_sanitizer_middleware(app: Any) -> None:
    """注册响应脱敏中间件到 FastAPI app。"""
    app.add_middleware(ResponseSanitizerMiddleware)

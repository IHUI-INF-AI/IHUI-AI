"""请求输入净化 + 限流中间件(2026-07-22 立,与 api 端 plugins 对等)。

两部分:
1. InputSanitizerMiddleware — 递归扫描 POST/PATCH/PUT 的 JSON body,
   检测 XSS 危险标签和 Prompt Injection 注入关键词,命中返回 400。
   对齐 apps/api/src/plugins/xss-protection.ts + prompt-injection-guard.ts。
2. RateLimitMiddleware — 内存令牌桶限流(按 IP + path 维度),
   /api/llm/* 限 60/min,/api/v1/chat/* 限 30/min。
   slowapi 已在 pyproject.toml 声明,但此处用自实现令牌桶(无外部依赖,零延迟)。
"""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# ==================== XSS 危险模式(对齐 xss-protection.ts DANGEROUS_PATTERNS)====================

XSS_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"<\s*script[^>]*>[\s\S]*?<\s*/\s*script\s*>", re.IGNORECASE),
    re.compile(r"<\s*script[^>]*/?>", re.IGNORECASE),
    re.compile(r"\son\w+\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]*)", re.IGNORECASE),
    re.compile(r"javascript:\s*", re.IGNORECASE),
    re.compile(r"data:\s*text/html", re.IGNORECASE),
    re.compile(r"vbscript:\s*", re.IGNORECASE),
    re.compile(r"<\s*iframe[^>]*>[\s\S]*?<\s*/\s*iframe\s*>", re.IGNORECASE),
    re.compile(r"<\s*iframe[^>]*/?>", re.IGNORECASE),
    re.compile(r"<\s*object[^>]*>[\s\S]*?<\s*/\s*object\s*>", re.IGNORECASE),
    re.compile(r"<\s*object[^>]*/?>", re.IGNORECASE),
    re.compile(r"<\s*embed[^>]*/?>", re.IGNORECASE),
    re.compile(r"expression\s*\([^)]*\)", re.IGNORECASE),
]

# ==================== Prompt Injection 注入模式(对齐 prompt-injection-guard.ts)====================

INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r"ignore\s+(previous|prior|above)\s+(instructions?|prompts?|rules?)", re.IGNORECASE
    ),
    re.compile(r"disregard\s+the\s+(above|previous|prior)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+a", re.IGNORECASE),
    re.compile(r"system\s+prompt\s*:", re.IGNORECASE),
    re.compile(r"</system>", re.IGNORECASE),
    re.compile(r"reveal\s+your\s+(instructions?|prompts?|rules?)", re.IGNORECASE),
    re.compile(r"jailbreak", re.IGNORECASE),
    re.compile(r"forget\s+(everything|all|previous)", re.IGNORECASE),
    re.compile(r"act\s+as\s+(if\s+you\s+are|a\s+different)", re.IGNORECASE),
    re.compile(r"override\s+(your|the)\s+(instructions?|rules?|guidelines?)", re.IGNORECASE),
]

# ==================== 递归扫描 ====================


def _detect_unsafe_content(text: str) -> Optional[str]:
    """检测字符串是否包含 XSS 或 Prompt Injection 内容,返回命中类型或 None。"""
    for pattern in XSS_PATTERNS:
        if pattern.search(text):
            return "xss"
    for pattern in INJECTION_PATTERNS:
        if pattern.search(text):
            return "prompt_injection"
    return None


def _scan_value(data: Any) -> list[str]:
    """递归扫描对象/数组中的字符串值,返回命中列表(截断 100 字符)。"""
    found: list[str] = []
    if isinstance(data, str):
        hit = _detect_unsafe_content(data)
        if hit:
            found.append(data[:100])
    elif isinstance(data, list):
        for item in data:
            found.extend(_scan_value(item))
    elif isinstance(data, dict):
        for v in data.values():
            found.extend(_scan_value(v))
    return found


# ==================== 输入净化中间件 ====================


class InputSanitizerMiddleware(BaseHTTPMiddleware):
    """扫描 POST/PATCH/PUT 请求的 JSON body,检测 XSS 和 Prompt Injection。

    - 只扫描 application/json 请求
    - 只扫描 string 值,不修改合法输入
    - 命中时返回 400 JSON {code: 400, message: "输入包含不安全内容", data: None}
    - 不阻塞合法请求
    """

    async def dispatch(self, request: Request, call_next):
        method = request.method
        if method not in ("POST", "PATCH", "PUT"):
            return await call_next(request)

        content_type = request.headers.get("content-type", "")
        if "application/json" not in content_type:
            return await call_next(request)

        # 读取 body(Starlette 会缓存到 request._body,下游 handler 仍可读取)
        body_bytes = await request.body()
        if not body_bytes:
            return await call_next(request)

        try:
            data = json.loads(body_bytes)
        except (json.JSONDecodeError, UnicodeDecodeError):
            # 非 JSON,放行让路由处理器自行校验
            return await call_next(request)

        hits = _scan_value(data)
        if hits:
            logger.warning(
                "[input_sanitizer] 检测到不安全内容: method=%s path=%s hits=%s",
                method,
                request.url.path,
                hits[:3],  # 只记录前 3 条命中
            )
            return JSONResponse(
                status_code=400,
                content={"code": 400, "message": "输入包含不安全内容", "data": None},
            )

        return await call_next(request)


def setup_input_sanitizer_middleware(app) -> None:
    """注册输入净化中间件到 FastAPI app。"""
    app.add_middleware(InputSanitizerMiddleware)


# ==================== 令牌桶限流 ====================


class TokenBucket:
    """简单令牌桶(线程安全由 GIL 保证,单进程足够)。"""

    def __init__(self, capacity: int, refill_rate: float) -> None:
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.tokens = float(capacity)
        self.last_refill = time.monotonic()

    def consume(self) -> bool:
        """尝试消费 1 个令牌,成功返回 True。"""
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False


# 限流规则:(path 前缀, 请求数, 时间窗口秒)
RATE_RULES: list[tuple[str, int, int]] = [
    ("/api/llm/", 60, 60),  # 60 次/分钟
    ("/api/v1/chat/", 30, 60),  # 30 次/分钟
]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """按 IP + path 维度的令牌桶限流中间件。

    规则:
    - /api/llm/* → 60 次/分钟
    - /api/v1/chat/* → 30 次/分钟
    超限返回 429 JSON {code: 429, message: "请求过于频繁,请稍后再试", data: None}
    """

    def __init__(self, app) -> None:
        super().__init__(app)
        # key=(ip, path_prefix) → TokenBucket
        self._buckets: dict[tuple[str, str], TokenBucket] = {}

    def _get_bucket(self, ip: str, prefix: str, capacity: int, window: int) -> TokenBucket:
        key = (ip, prefix)
        bucket = self._buckets.get(key)
        if bucket is None:
            refill_rate = capacity / window  # tokens per second
            bucket = TokenBucket(capacity, refill_rate)
            self._buckets[key] = bucket
        return bucket

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        ip = request.client.host if request.client else "unknown"

        for prefix, limit, window in RATE_RULES:
            if path.startswith(prefix):
                bucket = self._get_bucket(ip, prefix, limit, window)
                if not bucket.consume():
                    logger.warning(
                        "[rate_limit] 限流命中: ip=%s path=%s prefix=%s limit=%d/%ds",
                        ip,
                        path,
                        prefix,
                        limit,
                        window,
                    )
                    return JSONResponse(
                        status_code=429,
                        content={
                            "code": 429,
                            "message": "请求过于频繁,请稍后再试",
                            "data": None,
                        },
                    )
                break  # 只应用第一个匹配的规则

        return await call_next(request)


def setup_rate_limit_middleware(app) -> None:
    """注册限流中间件到 FastAPI app。"""
    app.add_middleware(RateLimitMiddleware)

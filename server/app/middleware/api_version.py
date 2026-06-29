"""API 版本协商中间件.

协商方式 (按优先级):
  1. X-Api-Version: v2 header           -> 自动把 /api/v1/* 重写为 /api/v2/*
  2. Accept: application/vnd.zhs.v2+json -> 同上
  3. 默认 v1                            -> 不重写

策略:
  - v1 完全兼容, 不做任何改变
  - v2 路径前缀 /api/v2/* 单独 router 处理
  - 错误响应统一带 api_version 字段
  - API_VERSION_DEFAULT 环境变量可强制默认版本 (v1|v2)
"""

import os
from typing import ClassVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class ApiVersionMiddleware(BaseHTTPMiddleware):
    """API 版本协商中间件 - 路径重写 (v1 -> v2)."""

    VERSION_MAP: ClassVar[dict[str, str]] = {
        "application/json": "v1",
        "application/vnd.zhs.v1+json": "v1",
        "application/vnd.zhs.v2+json": "v2",
    }

    @staticmethod
    def _detect_version(request: Request) -> str:
        # 1) Header 优先
        header_ver = request.headers.get("x-api-version", "").lower().strip()
        if header_ver in ("v1", "v2"):
            return header_ver
        # 2) Accept 协商
        accept = request.headers.get("accept", "application/json")
        for pattern, ver in ApiVersionMiddleware.VERSION_MAP.items():
            if pattern in accept:
                return ver
        # 3) 环境变量默认
        return os.environ.get("API_VERSION_DEFAULT", "v1").lower().strip()

    async def dispatch(self, request: Request, call_next):
        version = self._detect_version(request)

        # 1) v2 请求 + /api/v1/* 路径 -> 重写为 /api/v2/*
        if version == "v2" and request.scope.get("path", "").startswith("/api/v1"):
            old_path = request.scope["path"]
            new_path = "/api/v2" + old_path[len("/api/v1"):]
            request.scope["path"] = new_path
            request.scope["raw_path"] = new_path.encode("utf-8")

        # 2) v2 请求但重写后仍不是 /api/v2/, 返回 406
        if version == "v2" and not request.scope.get("path", "").startswith("/api/v2"):
            return JSONResponse(
                status_code=406,
                content={
                    "code": "406000",
                    "msg": "v2 API requires /api/v2/ path prefix",
                    "data": None,
                    "api_version": "v2",
                },
                headers={"X-API-Version": "v2"},
            )

        # 3) 透传请求, 注入 api_version
        request.state.api_version = version
        response = await call_next(request)
        response.headers["X-API-Version"] = version
        return response

"""Luyala(路亚拉/卢雅拉)适配器(占位实现)。

api_base: 待定(无公开 API 文档)
model 前缀: luyala-*
协议: 待定(无公开 API)
注: 无公开 API,文档未提供。chat 方法抛 NotImplementedError,等待厂商提供 API 规范后补全。
"""

from __future__ import annotations

from typing import Any, AsyncIterator

from .base_provider import BaseProvider


class LuyalaProvider(BaseProvider):
    """路亚拉(卢雅拉)适配器:占位实现,等待厂商 API 规范。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        base = api_base or ""
        super().__init__(api_key, base, timeout)
        self.base_url = base.rstrip("/") if base else ""

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        raise NotImplementedError(
            "luyala provider 待厂商提供 API 规范后实现"
        )

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        raise NotImplementedError(
            "luyala provider 待厂商提供 API 规范后实现"
        )
        # 不可达:仅为满足 AsyncIterator 类型签名,使函数成为 async generator
        yield {}  # pragma: no cover

    async def generate_image(
        self,
        prompt: str,
        model: str,
        *,
        size: str = "1024x1024",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """图像生成占位:待厂商提供 API 规范。"""
        raise NotImplementedError("Luyala 图像生成 endpoint 待实现")

    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """视频生成占位:待厂商提供 API 规范。"""
        raise NotImplementedError("Luyala 视频生成 endpoint 待实现")

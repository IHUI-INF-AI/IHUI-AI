"""Luyala(路亚拉/卢雅拉)适配器(503 降级实现)。

api_base: 待定(无公开 API 文档)
model 前缀: luyala-*
协议: 待定(无公开 API)
注: 无公开 API,文档未提供。所有方法降级为 503,等待厂商提供 API 规范后补全。
"""

from __future__ import annotations

from typing import Any, AsyncIterator

from fastapi import HTTPException

from .base_provider import BaseProvider


class LuyalaProvider(BaseProvider):
    """路亚拉(卢雅拉)适配器:API 规范待定,所有方法降级 503。"""

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
        raise HTTPException(
            status_code=503,
            detail="Luyala 暂不可用:API 规范待定,暂无可用接口",
        )

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        raise HTTPException(
            status_code=503,
            detail="Luyala 暂不可用:API 规范待定,暂无可用接口",
        )
        yield {}  # pragma: no cover

    async def generate_image(
        self,
        prompt: str,
        model: str,
        *,
        size: str = "1024x1024",
        **kwargs: Any,
    ) -> dict[str, Any]:
        raise HTTPException(
            status_code=503,
            detail="Luyala 暂不可用:图像生成 API 规范待定",
        )

    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        **kwargs: Any,
    ) -> dict[str, Any]:
        raise HTTPException(
            status_code=503,
            detail="Luyala 暂不可用:视频生成 API 规范待定",
        )

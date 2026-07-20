"""Jimeng(字节即梦)适配器(图像/视频生成,非 chat)。

api_base: https://visual.volcengineapi.com/v1
model 前缀: jimeng-* (high_aes_general / high_aes_general_v21 / video_generation)
协议: 火山引擎视觉自有协议(非 OpenAI chat 兼容)
注: 仅支持图像/视频生成 endpoint,chat 方法抛 NotImplementedError。
"""

from __future__ import annotations

from typing import Any, AsyncIterator

from .base_provider import BaseProvider


class JimengProvider(BaseProvider):
    """字节即梦适配器:仅支持图像/视频生成,不支持 chat。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        base = api_base or "https://visual.volcengineapi.com/v1"
        super().__init__(api_key, base, timeout)
        self.base_url = base.rstrip("/")

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        raise NotImplementedError(
            "此 provider 仅支持图像/视频生成,请使用专用的 image/video 端点"
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
            "此 provider 仅支持图像/视频生成,请使用专用的 image/video 端点"
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
        """图像生成占位:火山引擎视觉自有协议待实现。"""
        raise NotImplementedError("Jimeng 图像生成 endpoint 待实现")

    async def generate_video(
        self,
        prompt: str,
        model: str,
        *,
        duration: int = 5,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """视频生成占位:火山引擎视觉自有协议待实现。"""
        raise NotImplementedError("Jimeng 视频生成 endpoint 待实现")

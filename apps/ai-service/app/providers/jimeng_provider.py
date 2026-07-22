"""Jimeng(字节即梦)适配器(图像/视频生成,503 降级实现)。

api_base: https://visual.volcengineapi.com/v1
model 前缀: jimeng-* (high_aes_general / high_aes_general_v21 / video_generation)
协议: 火山引擎视觉自有协议(非 OpenAI chat 兼容)
注: 仅支持图像/视频生成 endpoint,chat 和生成接口均降级为 503,等待 API 接入。
"""

from __future__ import annotations

from typing import Any, AsyncIterator

from fastapi import HTTPException

from .base_provider import BaseProvider


class JimengProvider(BaseProvider):
    """字节即梦适配器:API 待接入,所有方法降级 503。"""

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
        raise HTTPException(
            status_code=503,
            detail="Jimeng 暂不可用:此 provider 仅支持图像/视频生成,chat 接口不可用",
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
            detail="Jimeng 暂不可用:此 provider 仅支持图像/视频生成,chat 接口不可用",
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
            detail="Jimeng 暂不可用:即梦图像生成 API 待接入",
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
            detail="Jimeng 暂不可用:即梦视频生成 API 待接入",
        )

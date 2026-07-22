"""适配器基类:定义 complete / astream / list_models 抽象方法。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator

import httpx

from ..core.llm_gateway import get_http_client


class ProviderError(Exception):
    """适配器调用异常。"""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class BaseProvider(ABC):
    """厂商适配器基类。

    子类只实现厂商原生 API 的差异部分(function calling 格式 / system prompt /
    safety_settings 等),通用部分(重试/限流/模型路由)仍由 LiteLLM 兜底。
    """

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        self.api_key = api_key
        self.api_base = api_base
        self.timeout = timeout

    @abstractmethod
    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """同步完成对话,返回 {content, model, usage, tool_calls?} 格式。"""

    @abstractmethod
    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式对话,yield {type: chunk|tool_call|done|error, ...}。"""

    async def list_models(self) -> list[dict[str, Any]]:
        """列出厂商可用模型(尽力而为,默认空列表)。"""
        return []

    async def _request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """通用 httpx 请求封装,失败抛 ProviderError。使用全局共享 AsyncClient。"""
        try:
            client = get_http_client()
            resp = await client.request(method, url, headers=headers, json=json, timeout=self.timeout)
            data = resp.json()
            if resp.status_code >= 400:
                raise ProviderError(
                    f"{self.__class__.__name__} 调用失败: {resp.status_code} {str(data)[:300]}",
                    resp.status_code,
                )
            return data
        except httpx.HTTPError as e:
            raise ProviderError(f"{self.__class__.__name__} 网络异常: {e}") from e

    def _strip_prefix(self, model: str) -> str:
        """去除厂商前缀(stepfun/xxx → xxx)。"""
        return model.split("/", 1)[1] if "/" in model else model

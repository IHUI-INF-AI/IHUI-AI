# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""适配器基类:定义 complete / astream / list_models 抽象方法。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any, cast

import httpx

from ..core.llm_gateway import get_http_client
from ..core.retry_after import extract_server_retry_hint


class ProviderError(Exception):
    """适配器调用异常。

    A25(2026-09-26)收口:错误对象携带**服务端重试指示**两个可选字段,
    由 BaseProvider._request 在 ≥400 时从 Retry-After 系头 / 响应体
    retry_after 解析注入(唯一生产点,解析实现见 app/core/retry_after.py,
    本层不得另写一份)。消费方经 hint_from_error(exc) 读取:
    - retry_after_s: 服务端指示的等待秒数;None = 服务端没说。
    - should_retry: False 仅在 x-should-retry: false 明示时出现;缺省 True
      表示"无明示",由本地预算/曲线决定,不代表"一定要重试"。
    """

    def __init__(
        self,
        message: str,
        status_code: int = 502,
        *,
        retry_after_s: float | None = None,
        should_retry: bool = True,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.retry_after_s = retry_after_s
        self.should_retry = should_retry


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
    def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        """流式对话,yield {type: chunk|tool_call|done|error, ...}。

        Note: 基类不带 ``async`` —— 子类用 ``async def`` + ``yield`` 实现为
        async generator,返回 ``AsyncGenerator`` (``AsyncIterator`` 的子类型)。
        若基类写 ``async def`` 则返回 ``Coroutine[..., AsyncIterator]``,与子类
        async generator 不兼容(mypy [override] 报错)。
        """

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
            # P1 修复(2026-08-06): 先包装 JSON 解析再校验结构,畸形响应统一转
            # ProviderError(进入 fallback 链),避免 JSONDecodeError/AttributeError
            # 直接抛给上层绕过 fallback。
            try:
                data = resp.json()
            except ValueError as e:
                # A25:429/5xx 常伴非 JSON 体(HTML 错误页),Retry-After 在头上,
                # 与体是否合法无关 → 该分支同样要携带服务端指示。
                hint = (
                    extract_server_retry_hint(resp.headers)
                    if resp.status_code >= 400
                    else None
                )
                raise ProviderError(
                    f"{self.__class__.__name__} 响应非合法 JSON: "
                    f"{resp.status_code} {resp.text[:300]!r}",
                    resp.status_code,
                    retry_after_s=hint.retry_after_s if hint else None,
                    should_retry=hint.should_retry if hint else True,
                ) from e
            if not isinstance(data, dict):
                raise ProviderError(
                    f"{self.__class__.__name__} 响应结构异常: 期望 JSON 对象, "
                    f"实际为 {type(data).__name__}",
                    resp.status_code,
                )
            if resp.status_code >= 400:
                # A25 唯一生产点:上游用 Retry-After(头或体 retry_after 秒数)/
                # x-should-retry 明示时,信息必须随异常上行,不得在此层丢掉。
                hint = extract_server_retry_hint(resp.headers, data)
                raise ProviderError(
                    f"{self.__class__.__name__} 调用失败: {resp.status_code} {str(data)[:300]}",
                    resp.status_code,
                    retry_after_s=hint.retry_after_s,
                    should_retry=hint.should_retry,
                )
            return cast(dict[str, Any], data)
        except httpx.HTTPError as e:
            raise ProviderError(f"{self.__class__.__name__} 网络异常: {e}") from e

    def _strip_prefix(self, model: str) -> str:
        """去除厂商前缀(stepfun/xxx → xxx)。"""
        return model.split("/", 1)[1] if "/" in model else model
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

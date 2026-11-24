# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""适配器基类:定义 complete / astream / list_models 抽象方法。"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, cast

import httpx

from ..core.llm_gateway import get_http_client
from ..core.retry_after import extract_server_retry_hint

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class RequestMeta:
    """四层请求元数据(B3-07,2026-11-24 立)。

    分层:
    - ``workspace``:工作区标识(哪个项目/目录发起);
    - ``context``:上下文层,含 ``request_set_id``(同一批请求的集合键,落 span/日志);
    - ``purpose``:本次调用目的(advisor/tool/followup/...);
    - ``trace``:追踪层(可带 trace_id;缺省回中间件 contextvar)。

    另承载两条既有能力的可观测维度(不重复造预算/补丁逻辑):
    - ``advisor``:advisor 咨询的 ``max_uses``(预算实现仍在 ``services/advisor.py``);
    - ``patches``:按 ``cache_id`` 复用的条目(补丁归并仍在 ``services/chat_patch.py``)。

    纪律:元数据**只进 span 与日志**,绝不进上游 headers / 请求体;不传时整层不产生
    任何观测副作用(零缺省变化)。
    """

    workspace: str | None = None
    context: dict[str, Any] = field(default_factory=dict)
    purpose: str | None = None
    trace: dict[str, Any] = field(default_factory=dict)
    advisor: dict[str, Any] = field(default_factory=dict)
    patches: list[dict[str, Any]] = field(default_factory=list)

    @property
    def request_set_id(self) -> str | None:
        """上下文层的请求集合键;空/非字符串 ⇒ None(不造占位值)。"""
        value = self.context.get("request_set_id")
        return str(value) if value else None

    @property
    def advisor_max_uses(self) -> int | None:
        """advisor 次数预算;非整数(含 bool)⇒ None。"""
        value = self.advisor.get("max_uses")
        if isinstance(value, bool) or not isinstance(value, int):
            return None
        return value

    @property
    def patch_cache_ids(self) -> list[str]:
        """patches 条目的 cache_id 有序去重(复用定位键)。"""
        ids: list[str] = []
        for patch in self.patches:
            if isinstance(patch, dict):
                cache_id = patch.get("cache_id")
                if isinstance(cache_id, str) and cache_id and cache_id not in ids:
                    ids.append(cache_id)
        return ids


def parse_request_meta(raw: Any) -> RequestMeta | None:
    """把调用方传入的元数据归一为 :class:`RequestMeta`;空/坏类型 ⇒ None(fail-closed)。

    - None / 空 dict ⇒ None(调用方没传,保持现状零变化);
    - :class:`RequestMeta` ⇒ 原样返回;
    - dict ⇒ 按四层字段收编,类型不符的子段回落空容器;
    - 其他类型 ⇒ None,不抛异常进主链路。
    """
    if raw is None:
        return None
    if isinstance(raw, RequestMeta):
        return raw
    if not isinstance(raw, dict):
        return None

    workspace = raw.get("workspace")
    purpose = raw.get("purpose")
    context = raw.get("context")
    trace = raw.get("trace")
    advisor = raw.get("advisor")
    patches = raw.get("patches")
    if not any((workspace, purpose, context, trace, advisor, patches)):
        return None

    return RequestMeta(
        workspace=str(workspace) if workspace else None,
        context=dict(context) if isinstance(context, dict) else {},
        purpose=str(purpose) if purpose else None,
        trace=dict(trace) if isinstance(trace, dict) else {},
        advisor=dict(advisor) if isinstance(advisor, dict) else {},
        patches=list(patches) if isinstance(patches, list) else [],
    )


def first_choice_or_raise(data: dict[str, Any], provider_label: str) -> dict[str, Any]:
    """AIS-065:HTTP 200 但 choices 缺键/空数组时抛 ProviderError(进 fallback 链)。

    旧写法 ``data.get("choices", [{}])[0]`` 在 choices 为空数组时抛 IndexError
    (原生分支只 catch ProviderError,直穿 500),choices 缺键时静默返回成功空回复。
    """
    choices = data.get("choices")
    if not choices:
        raise ProviderError(
            f"{provider_label} 响应缺少 choices(空回复): {str(data)[:200]}", 502
        )
    return cast(dict[str, Any], choices[0])


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

    @staticmethod
    def _pop_request_meta(kwargs: dict[str, Any]) -> RequestMeta | None:
        """从调用 kwargs 摘出 ``request_meta``(不进上游 payload/headers)。"""
        return parse_request_meta(kwargs.pop("request_meta", None))

    def _annotate_request(self, meta: RequestMeta) -> None:
        """把四层元数据落 OTel span 与结构化日志;观测失败静默降级,不阻断上游。

        span 属性键与既有 telemetry 中间件风格对齐(``trace.id``);元数据只作关联键,
        不带授权凭据。取不到 current span / opentelemetry 未装 ⇒ 跳过 span,日志仍记。
        """
        trace_id = str(meta.trace.get("trace_id") or "")
        if not trace_id:
            from ..middleware.trace_context import current_trace_id

            trace_id = current_trace_id() or ""

        attrs: dict[str, Any] = {}
        if meta.workspace:
            attrs["request.workspace"] = meta.workspace
        if meta.request_set_id:
            attrs["request.context.request_set_id"] = meta.request_set_id
        if meta.purpose:
            attrs["request.purpose"] = meta.purpose
        if trace_id:
            attrs["request.trace.id"] = trace_id
        if meta.advisor_max_uses is not None:
            attrs["request.advisor.max_uses"] = meta.advisor_max_uses
        cache_ids = meta.patch_cache_ids
        if cache_ids:
            attrs["request.patches.cache_ids"] = cache_ids

        if attrs:
            try:
                from opentelemetry import trace

                span = trace.get_current_span()
                for key, value in attrs.items():
                    span.set_attribute(key, value)
            except Exception:  # noqa: BLE001 - 观测降级,不阻断上游调用
                logger.debug("provider 请求元数据落 span 失败(降级跳过)", exc_info=True)

        logger.info(
            "provider request meta: purpose=%s workspace=%s request_set_id=%s "
            "advisor_max_uses=%s patch_cache_ids=%s",
            meta.purpose,
            meta.workspace,
            meta.request_set_id,
            meta.advisor_max_uses,
            cache_ids,
            extra={
                "request_meta": {
                    "workspace": meta.workspace,
                    "purpose": meta.purpose,
                    "request_set_id": meta.request_set_id,
                    "advisor_max_uses": meta.advisor_max_uses,
                    "patch_cache_ids": cache_ids,
                }
            },
        )

    async def _request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json: dict[str, Any] | None = None,
        request_meta: RequestMeta | dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """通用 httpx 请求封装,失败抛 ProviderError。使用全局共享 AsyncClient。"""
        meta = parse_request_meta(request_meta)
        if meta is not None:
            self._annotate_request(meta)
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
            # AIS-066:HTTP 200 但响应体带 error(部分 OpenAI 兼容代理/自建网关行为),
            # 不能当成功返回空回复;有 error 即抛 ProviderError 让上层 fallback/重试。
            # A25(2026-11-21 补刀):429/503 的错误体常同时带 error 与 Retry-After 头 ——
            # 这条分支此前先 raise,**跳过**了下方 status>=400 的 hint 生产点,Retry-After
            # 与 x-should-retry 就随 error 体一起丢了(上层只能盲重试)。hint 与状态码
            # 无关地在此一并提取:HTTP 200 + error 体时 hint 为 None,行为不变。
            # 2026-11-21:任务轮询响应(带 state/is_final)里的 error 是**任务失败诊断**
            # (含 error_class/stage/actual_cost),不是 API 错误体 —— 一刀切成
            # "上游返回错误体"会把 get_task_status/_poll_task 的诊断字段全丢。
            if data.get("error") and not (
                "state" in data or "is_final" in data
            ):
                err_hint = (
                    extract_server_retry_hint(resp.headers, data)
                    if resp.status_code >= 400
                    else None
                )
                raise ProviderError(
                    f"{self.__class__.__name__} 上游返回错误体: {data['error']}",
                    resp.status_code,
                    retry_after_s=err_hint.retry_after_s if err_hint else None,
                    should_retry=err_hint.should_retry if err_hint else True,
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

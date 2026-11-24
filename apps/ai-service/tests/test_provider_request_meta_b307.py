# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B3-07 请求元数据四层 + Advisor max_uses + patches cache_id 验收(2026-11-24)。

覆盖:
- parse_request_meta 归一/空/坏类型回落;
- RequestMeta 派生属性(request_set_id / advisor_max_uses / patch_cache_ids);
- 不传 meta ⇒ span 零属性、日志零记录、上游 headers/json 零污染(零缺省变化);
- 传 meta ⇒ request_set_id 等四层落 OTel span 与结构化日志,不进上游请求体;
- OpenAI 主路径 complete 摘出 meta 且不进 payload;
- trace_id 缺省回中间件 contextvar;span 取数异常降级不抛。
"""

from __future__ import annotations

import logging
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.providers.base_provider import (
    BaseProvider,
    RequestMeta,
    parse_request_meta,
)
from app.providers.openai_provider import OpenAIProvider

META: dict[str, Any] = {
    "workspace": "proj-alpha",
    "context": {"request_set_id": "rs-123", "other": "x"},
    "purpose": "advisor",
    "trace": {"trace_id": "abc123"},
    "advisor": {"max_uses": 3, "model": "gpt-x"},
    "patches": [{"cache_id": "c1"}, {"cache_id": "c2"}, {"cache_id": "c1"}],
}


class _FakeProvider(BaseProvider):
    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return {"content": "ok", "model": model}

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ):
        yield {"type": "chunk", "content": "x"}


def _fake_response() -> MagicMock:
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"ok": True}
    return resp


class _FakeStreamCtx:
    """模拟 client.stream(...) 的 async context manager。"""

    def __init__(self, resp: MagicMock) -> None:
        self.resp = resp

    async def __aenter__(self) -> MagicMock:
        return self.resp

    async def __aexit__(self, *args: Any) -> None:
        return None


# ---------------------------------------------------------------------------
# parse_request_meta
# ---------------------------------------------------------------------------


def test_parse_none_returns_none() -> None:
    assert parse_request_meta(None) is None


def test_parse_empty_dict_returns_none() -> None:
    assert parse_request_meta({}) is None


def test_parse_request_meta_passthrough() -> None:
    meta = RequestMeta(purpose="tool")
    assert parse_request_meta(meta) is meta


def test_parse_dict_builds_four_layers() -> None:
    meta = parse_request_meta(META)
    assert meta is not None
    assert meta.workspace == "proj-alpha"
    assert meta.purpose == "advisor"
    assert meta.context == {"request_set_id": "rs-123", "other": "x"}
    assert meta.trace == {"trace_id": "abc123"}
    assert meta.advisor == {"max_uses": 3, "model": "gpt-x"}
    assert len(meta.patches) == 3


def test_parse_bad_type_returns_none() -> None:
    assert parse_request_meta("not-a-dict") is None
    assert parse_request_meta(123) is None


def test_parse_malformed_subsections_fall_back_to_empty() -> None:
    meta = parse_request_meta(
        {"context": "bad", "trace": 7, "advisor": None, "patches": "x", "purpose": "p"}
    )
    assert meta is not None
    assert meta.context == {}
    assert meta.trace == {}
    assert meta.advisor == {}
    assert meta.patches == []
    assert meta.purpose == "p"


# ---------------------------------------------------------------------------
# RequestMeta 派生属性
# ---------------------------------------------------------------------------


def test_request_set_id_from_context() -> None:
    assert RequestMeta(context={"request_set_id": "rs-9"}).request_set_id == "rs-9"
    assert RequestMeta(context={}).request_set_id is None
    assert RequestMeta(context={"request_set_id": ""}).request_set_id is None


def test_advisor_max_uses_coerces() -> None:
    assert RequestMeta(advisor={"max_uses": 5}).advisor_max_uses == 5
    assert RequestMeta(advisor={"max_uses": True}).advisor_max_uses is None
    assert RequestMeta(advisor={"max_uses": "3"}).advisor_max_uses is None
    assert RequestMeta(advisor={}).advisor_max_uses is None


def test_patch_cache_ids_ordered_dedup() -> None:
    meta = RequestMeta(
        patches=[{"cache_id": "c1"}, {"cache_id": "c2"}, {"cache_id": "c1"}, {"other": 1}]
    )
    assert meta.patch_cache_ids == ["c1", "c2"]


# ---------------------------------------------------------------------------
# 不传 meta:零缺省变化
# ---------------------------------------------------------------------------


async def test_request_without_meta_zero_observability(
    caplog: pytest.LogCaptureFixture,
) -> None:
    p = _FakeProvider(api_key="k")
    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=_fake_response())
    span = MagicMock()

    with (
        patch("app.providers.base_provider.get_http_client", return_value=fake_client),
        patch("opentelemetry.trace.get_current_span", return_value=span),
    ):
        with caplog.at_level(logging.INFO, logger="app.providers.base_provider"):
            await p._request("POST", "http://api/x", json={"q": 1})

    span.set_attribute.assert_not_called()
    assert not any("provider request meta" in r.message for r in caplog.records)
    _, kwargs = fake_client.request.call_args
    assert "request_meta" not in kwargs
    assert kwargs["json"] == {"q": 1}


# ---------------------------------------------------------------------------
# 传 meta:落 span + 日志,不进上游
# ---------------------------------------------------------------------------


async def test_request_with_meta_annotates_span_and_log(
    caplog: pytest.LogCaptureFixture,
) -> None:
    p = _FakeProvider(api_key="k")
    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=_fake_response())
    span = MagicMock()

    with (
        patch("app.providers.base_provider.get_http_client", return_value=fake_client),
        patch("opentelemetry.trace.get_current_span", return_value=span),
    ):
        with caplog.at_level(logging.INFO, logger="app.providers.base_provider"):
            await p._request(
                "POST", "http://api/x", json={"q": 1}, request_meta=META
            )

    span.set_attribute.assert_any_call("request.workspace", "proj-alpha")
    span.set_attribute.assert_any_call("request.context.request_set_id", "rs-123")
    span.set_attribute.assert_any_call("request.purpose", "advisor")
    span.set_attribute.assert_any_call("request.trace.id", "abc123")
    span.set_attribute.assert_any_call("request.advisor.max_uses", 3)
    span.set_attribute.assert_any_call("request.patches.cache_ids", ["c1", "c2"])

    meta_records = [r for r in caplog.records if "provider request meta" in r.message]
    assert len(meta_records) == 1
    assert getattr(meta_records[0], "request_meta")["request_set_id"] == "rs-123"

    # 上游请求体/headers 不含元数据
    _, kwargs = fake_client.request.call_args
    assert kwargs["json"] == {"q": 1}
    assert "request_meta" not in kwargs["json"]


async def test_trace_id_falls_back_to_contextvar() -> None:
    p = _FakeProvider(api_key="k")
    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=_fake_response())
    span = MagicMock()
    meta = {"purpose": "tool", "trace": {}}

    with (
        patch("app.providers.base_provider.get_http_client", return_value=fake_client),
        patch("opentelemetry.trace.get_current_span", return_value=span),
        patch(
            "app.middleware.trace_context.current_trace_id", return_value="cv-trace-7"
        ),
    ):
        await p._request("GET", "http://api/x", request_meta=meta)

    span.set_attribute.assert_any_call("request.trace.id", "cv-trace-7")


async def test_span_failure_is_degraded(monkeypatch: pytest.MonkeyPatch) -> None:
    """取 span 抛异常 ⇒ 降级不抛、不阻断上游请求。"""
    p = _FakeProvider(api_key="k")
    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=_fake_response())

    def _boom() -> Any:
        raise RuntimeError("otel down")

    with (
        patch("app.providers.base_provider.get_http_client", return_value=fake_client),
        patch("opentelemetry.trace.get_current_span", side_effect=_boom),
    ):
        result = await p._request("GET", "http://api/x", request_meta=META)

    assert result == {"ok": True}
    fake_client.request.assert_awaited_once()


# ---------------------------------------------------------------------------
# OpenAI 主路径贯通
# ---------------------------------------------------------------------------


async def test_openai_complete_strips_meta_from_payload() -> None:
    provider = OpenAIProvider(api_key="sk-x")
    provider._request = AsyncMock(return_value={"choices": [{"message": {"content": "hi"}}]})  # type: ignore[method-assign]

    await provider.complete(
        [{"role": "user", "content": "hi"}],
        "gpt-4",
        request_meta=META,
    )

    provider._request.assert_awaited_once()
    _, kwargs = provider._request.call_args
    sent_meta = kwargs["request_meta"]
    assert isinstance(sent_meta, RequestMeta)
    assert sent_meta.request_set_id == "rs-123"
    # payload 未被元数据污染
    assert "request_meta" not in kwargs["json"]
    assert kwargs["json"]["model"] == "gpt-4"
    assert kwargs["json"]["messages"] == [{"role": "user", "content": "hi"}]


async def test_openai_astream_strips_meta_from_payload() -> None:
    provider = OpenAIProvider(api_key="sk-x")
    provider._annotate_request = MagicMock()  # type: ignore[method-assign]

    resp = MagicMock()
    resp.status_code = 200

    async def _aiter_lines() -> Any:
        yield "data: [DONE]"

    resp.aiter_lines = _aiter_lines
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with (
        patch("app.providers.base_provider.get_http_client", return_value=fake_client),
        patch("app.providers.openai_provider.get_http_client", return_value=fake_client),
    ):
        chunks = [
            chunk
            async for chunk in provider.astream(
                [{"role": "user", "content": "hi"}], "gpt-4", request_meta=META
            )
        ]
    assert chunks  # 流式照常产出兜底 done 帧
    provider._annotate_request.assert_called_once()
    _, stream_kwargs = fake_client.stream.call_args
    assert "request_meta" not in stream_kwargs["json"]
    assert stream_kwargs["json"]["model"] == "gpt-4"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IM 通道契约 + 企业微信群机器人(round 8 · C4)。

钉住的边界:
  A 成功路径:POST 端点/参数 key/文本消息体正确,结论 sent;
  B 取不到输入:缺 key / 未知频道 / 空文本 / 超长 ⇒ unjudged 且点名原因,零外发;
  C provider 拒绝 / 网络 / HTTP / 坏响应 ⇒ failed,凭据原文不出现在结果里;
  D 幂等键与每频道配额由 OutboundGuard 统一判,重复/到顶 ⇒ skipped,失败不占幂等;
  E from_env 只读环境、坏 JSON 不抛,B 类结论在发送时具名给出。
"""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx

from app.services.im.base import (
    REASON_CHANNEL_UNKNOWN,
    REASON_CREDENTIAL_MISSING,
    REASON_DELIVERED,
    REASON_DUPLICATE,
    REASON_EMPTY_TEXT,
    REASON_HTTP_ERROR,
    REASON_INVALID_RESPONSE,
    REASON_PROVIDER_REJECTED,
    REASON_QUOTA_EXCEEDED,
    REASON_TEXT_TOO_LONG,
    REASON_TRANSPORT_ERROR,
    ImAdapter,
    OutboundGuard,
    OutboundMessage,
    SendStatus,
)
from app.services.im.wecom_webhook import (
    DEFAULT_CHANNEL,
    ENV_KEYS_JSON,
    ENV_SINGLE_KEY,
    MAX_TEXT_BYTES,
    WeComWebhookAdapter,
)

_SECRET = "S3CRET-WEBHOOK-KEY"


def _message(key: str = "msg-1", text: str = "你好", channel: str = "ops") -> OutboundMessage:
    return OutboundMessage(channel=channel, text=text, idempotency_key=key)


def _adapter(
    handler: Callable[[httpx.Request], httpx.Response],
    channels: dict[str, str] | None = None,
    guard: OutboundGuard | None = None,
) -> tuple[WeComWebhookAdapter, httpx.AsyncClient]:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = WeComWebhookAdapter(
        {"ops": _SECRET} if channels is None else channels,
        guard=guard,
        client=client,
    )
    return adapter, client


def _ok(_request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json={"errcode": 0, "errmsg": "ok"})


async def test_send_text_success() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return _ok(request)

    adapter, client = _adapter(handler)
    assert isinstance(adapter, ImAdapter)
    async with client:
        result = await adapter.send(_message())
    assert result.status is SendStatus.SENT
    assert result.reason_code == REASON_DELIVERED
    assert result.ok is True
    assert len(seen) == 1
    assert seen[0].url.params["key"] == _SECRET
    assert json.loads(seen[0].content) == {"msgtype": "text", "text": {"content": "你好"}}
    assert _SECRET not in repr(result)


async def test_missing_credential_is_unjudged_and_sends_nothing() -> None:
    calls = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return _ok(_request)

    adapter, client = _adapter(handler, channels={"ops": "   "})
    async with client:
        result = await adapter.send(_message())
    assert result.status is SendStatus.UNJUDGED
    assert result.reason_code == REASON_CREDENTIAL_MISSING
    assert calls["n"] == 0


async def test_unknown_channel_is_unjudged_and_lists_known_channels() -> None:
    calls = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return _ok(_request)

    adapter, client = _adapter(handler, channels={"ops": _SECRET, "alerts": "k2"})
    async with client:
        result = await adapter.send(_message(channel="nope"))
    assert result.status is SendStatus.UNJUDGED
    assert result.reason_code == REASON_CHANNEL_UNKNOWN
    assert result.detail == {"known_channels": ["alerts", "ops"]}
    assert calls["n"] == 0


async def test_empty_text_and_too_long_are_unjudged() -> None:
    adapter, client = _adapter(_ok, channels={"ops": _SECRET})
    async with client:
        empty = await adapter.send(_message(text="  "))
        long_text = await adapter.send(_message(key="m2", text="x" * (MAX_TEXT_BYTES + 1)))
    assert empty.reason_code == REASON_EMPTY_TEXT
    assert long_text.reason_code == REASON_TEXT_TOO_LONG
    assert long_text.detail == {"bytes": MAX_TEXT_BYTES + 1, "limit": MAX_TEXT_BYTES}


async def test_provider_rejection_is_failed_and_redacts_key() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"errcode": 93000, "errmsg": f"invalid webhook key={_SECRET}"}
        )

    adapter, client = _adapter(handler)
    async with client:
        result = await adapter.send(_message())
    assert result.status is SendStatus.FAILED
    assert result.reason_code == REASON_PROVIDER_REJECTED
    assert result.detail is not None
    assert result.detail["errcode"] == 93000
    assert _SECRET not in json.dumps(result.detail, ensure_ascii=False)
    assert "***" in str(result.detail["errmsg"])


async def test_transport_error_is_failed_and_redacts_key() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"connect failed for {request.url}", request=request)

    adapter, client = _adapter(handler)
    async with client:
        result = await adapter.send(_message())
    assert result.status is SendStatus.FAILED
    assert result.reason_code == REASON_TRANSPORT_ERROR
    assert _SECRET not in json.dumps(result.detail, ensure_ascii=False)


async def test_http_error_and_invalid_response_are_failed() -> None:
    responses = [
        httpx.Response(502, text="bad gateway"),
        httpx.Response(200, text="not-json"),
    ]

    def handler(_request: httpx.Request) -> httpx.Response:
        return responses.pop(0)

    adapter, client = _adapter(handler)
    async with client:
        http_error = await adapter.send(_message(key="a"))
        invalid = await adapter.send(_message(key="b"))
    assert http_error.reason_code == REASON_HTTP_ERROR
    assert http_error.detail == {"status": 502}
    assert invalid.reason_code == REASON_INVALID_RESPONSE
    assert _SECRET not in json.dumps(invalid.detail, ensure_ascii=False)


async def test_duplicate_idempotency_key_is_skipped() -> None:
    calls = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return _ok(_request)

    guard = OutboundGuard(max_per_window=10)
    adapter, client = _adapter(handler, guard=guard)
    async with client:
        first = await adapter.send(_message(key="same"))
        second = await adapter.send(_message(key="same"))
    assert first.status is SendStatus.SENT
    assert second.status is SendStatus.SKIPPED
    assert second.reason_code == REASON_DUPLICATE
    assert calls["n"] == 1


async def test_failed_send_does_not_block_retry() -> None:
    responses = [
        httpx.Response(200, json={"errcode": 45009, "errmsg": "rate limited"}),
        httpx.Response(200, json={"errcode": 0, "errmsg": "ok"}),
    ]

    def handler(_request: httpx.Request) -> httpx.Response:
        return responses.pop(0)

    guard = OutboundGuard(max_per_window=10)
    adapter, client = _adapter(handler, guard=guard)
    async with client:
        first = await adapter.send(_message(key="retry-me"))
        second = await adapter.send(_message(key="retry-me"))
    assert first.status is SendStatus.FAILED
    assert second.status is SendStatus.SENT


async def test_channel_quota_is_enforced() -> None:
    calls = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return _ok(_request)

    guard = OutboundGuard(max_per_window=2, window_s=60.0)
    adapter, client = _adapter(handler, guard=guard)
    async with client:
        first = await adapter.send(_message(key="q1"))
        second = await adapter.send(_message(key="q2"))
        third = await adapter.send(_message(key="q3"))
    assert first.status is SendStatus.SENT
    assert second.status is SendStatus.SENT
    assert third.status is SendStatus.SKIPPED
    assert third.reason_code == REASON_QUOTA_EXCEEDED
    assert calls["n"] == 2


def test_guard_window_and_dedupe_ttl_expire() -> None:
    guard = OutboundGuard(max_per_window=1, window_s=60.0, dedupe_ttl_s=300.0)
    message = _message(key="once")
    guard.record("wecom", message, delivered=True, now=1000.0)
    assert guard.check("wecom", message, now=1001.0) is not None
    # 窗口过了配额清空,但幂等窗口还在 ⇒ 仍是 duplicate
    duplicate = guard.check("wecom", message, now=1000.0 + 61.0)
    assert duplicate is not None and duplicate.reason_code == REASON_DUPLICATE
    # 两个窗口都过了 ⇒ 放行
    assert guard.check("wecom", message, now=1000.0 + 301.0) is None


def test_from_env_json_map_single_key_and_bad_json() -> None:
    mapped = WeComWebhookAdapter.from_env(
        environ={ENV_KEYS_JSON: json.dumps({"ops": "k1", "alerts": "k2"})}
    )
    assert mapped.known_channels == ("alerts", "ops")

    single = WeComWebhookAdapter.from_env(environ={ENV_SINGLE_KEY: "k3"})
    assert single.known_channels == (DEFAULT_CHANNEL,)

    broken = WeComWebhookAdapter.from_env(environ={ENV_KEYS_JSON: "{not-json"})
    assert broken.known_channels == ()

    empty_object = WeComWebhookAdapter.from_env(
        environ={ENV_KEYS_JSON: "{}", ENV_SINGLE_KEY: "k4"}
    )
    assert empty_object.known_channels == (DEFAULT_CHANNEL,)


async def test_from_env_without_credentials_rejects_at_send_time() -> None:
    adapter = WeComWebhookAdapter.from_env(environ={})
    result = await adapter.send(_message())
    await adapter.aclose()
    assert result.status is SendStatus.UNJUDGED
    assert result.reason_code == REASON_CHANNEL_UNKNOWN


async def test_metadata_is_not_leaked_into_payload() -> None:
    """metadata 不参与协议:额外字段不得渗进请求体。"""
    seen: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return _ok(request)

    adapter, client = _adapter(handler)
    message = OutboundMessage(
        channel="ops",
        text="hi",
        idempotency_key="meta",
        metadata={"trace_id": "t1"},
    )
    async with client:
        result = await adapter.send(message)
    assert result.status is SendStatus.SENT
    assert seen == [{"msgtype": "text", "text": {"content": "hi"}}]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""4 个通知通道(IM/Webhook/Email/SMS)真实实现的单元测试。

覆盖:
1. WebhookChannel:httpx.MockTransport 验证 POST 发出与 2xx/5xx/网络异常分支,
   URL 来源(metadata webhook_urls / 订阅 / env WEBHOOK_URLS)
2. EmailChannel:env 未配置 SMTP → 失败;配置后(monkeypatch smtplib)→ 成功路径
3. SMSChannel:网关 200/非 200 分支 + 请求 payload/Authorization 断言
4. IMChannel:钉钉格式 payload 断言 + metadata/env 优先级 + 未配置失败

设计:
- mock_http fixture 注入 httpx.AsyncClient → MockTransport,handler 由测试控制,
  不产生真实网络请求。
- 与 test_message_bus.py(聚焦 MessageBus 编排)互补,此处直接测通道 _do_send。
"""

from __future__ import annotations

import json

import httpx
import pytest

from app.services.message_bus import (
    ChannelType,
    EmailChannel,
    IMChannel,
    Message,
    SMSChannel,
    Subscription,
    WebhookChannel,
)


@pytest.fixture
def mock_http(monkeypatch):
    """注入 httpx.AsyncClient → MockTransport,handler 由测试调用时设置。

    用法:
        def handler(request: httpx.Request) -> httpx.Response: ...
        mock_http(handler)
        ok, status = await channel.send(msg, {})
    """
    original_client = httpx.AsyncClient
    state: dict = {}

    def _factory(*args, **kwargs):
        if "transport" not in state:
            raise AssertionError("mock_http: 请先调用 mock_http(handler) 设置 transport")
        return original_client(transport=state["transport"], *args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _factory)

    def _set(handler):
        state["transport"] = httpx.MockTransport(handler)

    return _set


class _FakeSMTP:
    """smtplib.SMTP 替身:记录调用,不真正连网。"""

    instances: list["_FakeSMTP"] = []

    def __init__(self, host, port=0, timeout=10, **kwargs):
        self.host = host
        self.port = port
        self.calls: list = []
        self.sent_mail: list[tuple] = []
        type(self).instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def ehlo(self):
        self.calls.append("ehlo")

    def starttls(self):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(("login", user))

    def sendmail(self, from_addr, to_addrs, msg):
        self.sent_mail.append((from_addr, to_addrs, msg))


# =============================================================================
# 1. WebhookChannel
# =============================================================================


@pytest.mark.asyncio
async def test_webhook_channel_posts_json_to_all_urls(mock_http) -> None:
    """2xx → 成功;POST 到每个 URL,body 为 JSON 且含 message_id/content。"""
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"ok": True})

    mock_http(handler)
    channel = WebhookChannel()
    msg = Message(
        id="wh-1",
        content="hello webhook",
        metadata={
            "webhook_urls": ["https://a.example/hook", "https://b.example/hook"],
        },
    )
    ok, status = await channel.send(msg, {})
    assert ok is True
    assert status == "delivered"
    assert len(requests) == 2
    assert {str(r.url) for r in requests} == {
        "https://a.example/hook",
        "https://b.example/hook",
    }
    body = json.loads(requests[0].content.decode())
    assert body["message_id"] == "wh-1"
    assert body["content"] == "hello webhook"


@pytest.mark.asyncio
async def test_webhook_channel_5xx_fails(mock_http) -> None:
    """任一 URL 非 2xx → 整体失败。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    mock_http(handler)
    channel = WebhookChannel()
    msg = Message(
        id="wh-5xx",
        content="hello",
        metadata={"webhook_urls": ["https://a.example/hook"]},
    )
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


@pytest.mark.asyncio
async def test_webhook_channel_partial_failure(mock_http) -> None:
    """多 URL 中一个 200 一个 500 → 整体失败(失败可观测)。"""
    responses = [httpx.Response(200), httpx.Response(500)]

    def handler(request: httpx.Request) -> httpx.Response:
        return responses.pop(0)

    mock_http(handler)
    channel = WebhookChannel()
    msg = Message(
        id="wh-part",
        content="hello",
        metadata={"webhook_urls": ["https://a.example/hook", "https://b.example/hook"]},
    )
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


@pytest.mark.asyncio
async def test_webhook_channel_network_error_fails(mock_http) -> None:
    """网络异常 → 失败(不抛到 publish 层)。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise RuntimeError("connection refused")

    mock_http(handler)
    channel = WebhookChannel()
    msg = Message(
        id="wh-net",
        content="hello",
        metadata={"webhook_urls": ["https://a.example/hook"]},
    )
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


@pytest.mark.asyncio
async def test_webhook_channel_from_subscriptions(mock_http) -> None:
    """订阅注册的 webhook_url 也被发送。"""
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200)

    mock_http(handler)
    channel = WebhookChannel()
    sub = Subscription(
        id="s1", channel=ChannelType.WEBHOOK, webhook_url="https://sub.example/hook"
    )
    msg = Message(id="wh-sub", content="hello")
    ok, status = await channel.send(msg, {"s1": sub})
    assert ok is True
    assert len(requests) == 1
    assert str(requests[0].url) == "https://sub.example/hook"


@pytest.mark.asyncio
async def test_webhook_channel_env_urls(monkeypatch, mock_http) -> None:
    """env WEBHOOK_URLS(逗号分隔)兜底。"""
    monkeypatch.setenv("WEBHOOK_URLS", "https://env1.example/hook, https://env2.example/hook")
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200)

    mock_http(handler)
    channel = WebhookChannel()
    msg = Message(id="wh-env", content="hello")
    ok, status = await channel.send(msg, {})
    assert ok is True
    assert len(requests) == 2


@pytest.mark.asyncio
async def test_webhook_channel_no_urls_returns_success() -> None:
    """无任何 webhook URL → 消息丢弃,视为成功(与 WebSocket 无订阅者一致)。"""
    channel = WebhookChannel()
    msg = Message(id="wh-none", content="hello")
    ok, status = await channel.send(msg, {})
    assert ok is True
    assert status == "delivered"


# =============================================================================
# 2. EmailChannel
# =============================================================================


@pytest.mark.asyncio
async def test_email_channel_no_recipient_fails() -> None:
    """metadata 无 'to' → 失败。"""
    channel = EmailChannel()
    msg = Message(id="em-1", content="hello")
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


@pytest.mark.asyncio
async def test_email_channel_smtp_not_configured_fails(monkeypatch) -> None:
    """env 未配置 SMTP_HOST → 失败,不假装成功。"""
    monkeypatch.delenv("SMTP_HOST", raising=False)
    channel = EmailChannel()
    msg = Message(id="em-2", content="hello", metadata={"to": "user@example.com"})
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


@pytest.mark.asyncio
async def test_email_channel_sends_smtp_success(monkeypatch) -> None:
    """配置 SMTP + metadata 'to' → 成功;smtplib 真实调用被断言。"""
    import smtplib

    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "bot@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setenv("SMTP_FROM", "IHUI <notify@example.com>")
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)

    channel = EmailChannel()
    msg = Message(
        id="em-3",
        content="hello email",
        metadata={
            "to": ["a@example.com", "b@example.com"],
            "subject": "测试主题",
        },
    )
    ok, status = await channel.send(msg, {})
    assert ok is True
    assert status == "delivered"

    fake = _FakeSMTP.instances[-1]
    assert fake.port == 587
    # 587 → starttls + login
    assert "starttls" in fake.calls
    assert ("login", "bot@example.com") in fake.calls
    assert fake.sent_mail, "sendmail 未被调用"
    from_addr, to_addrs, raw = fake.sent_mail[0]
    assert from_addr == "IHUI <notify@example.com>"
    assert to_addrs == ["a@example.com", "b@example.com"]
    assert "To: a@example.com, b@example.com" in raw
    assert "From: IHUI <notify@example.com>" in raw


@pytest.mark.asyncio
async def test_email_channel_no_starttls_on_plain_port(monkeypatch) -> None:
    """非 587 端口(如 25)不调用 starttls。"""
    import smtplib

    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "25")
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)

    channel = EmailChannel()
    msg = Message(id="em-4", content="hello", metadata={"to": "user@example.com"})
    ok, status = await channel.send(msg, {})
    assert ok is True
    fake = _FakeSMTP.instances[-1]
    assert "starttls" not in fake.calls


@pytest.mark.asyncio
async def test_email_channel_smtp_exception_fails(monkeypatch) -> None:
    """SMTP 服务器异常 → 失败,不抛到上层。"""
    import smtplib

    class _BrokenSMTP(_FakeSMTP):
        def sendmail(self, from_addr, to_addrs, msg):
            raise OSError("smtp server down")

    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(smtplib, "SMTP", _BrokenSMTP)

    channel = EmailChannel()
    msg = Message(id="em-5", content="hello", metadata={"to": "user@example.com"})
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


# =============================================================================
# 3. SMSChannel
# =============================================================================


@pytest.mark.asyncio
async def test_sms_channel_no_phone_fails() -> None:
    """metadata 无 'phone' → 失败。"""
    channel = SMSChannel()
    msg = Message(id="sms-1", content="hello")
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


@pytest.mark.asyncio
async def test_sms_channel_not_configured_fails(monkeypatch) -> None:
    """env 未配置 SMS_API_URL → 失败,不假装成功。"""
    monkeypatch.delenv("SMS_API_URL", raising=False)
    channel = SMSChannel()
    msg = Message(id="sms-2", content="hello", metadata={"phone": "13800138000"})
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


@pytest.mark.asyncio
async def test_sms_channel_gateway_200_success(mock_http, monkeypatch) -> None:
    """网关 200 → 成功;断言 payload {phone, content, sign} + Authorization。"""
    monkeypatch.setenv("SMS_API_URL", "https://sms.example.com/api")
    monkeypatch.setenv("SMS_API_KEY", "key-123")
    monkeypatch.setenv("SMS_SIGN", "测试签名")
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"code": 0})

    mock_http(handler)
    channel = SMSChannel()
    msg = Message(
        id="sms-3",
        content="hello sms",
        metadata={"phone": "13800138000"},
    )
    ok, status = await channel.send(msg, {})
    assert ok is True
    assert status == "delivered"
    assert len(requests) == 1
    req = requests[0]
    assert str(req.url) == "https://sms.example.com/api"
    assert req.headers.get("Authorization") == "Bearer key-123"
    body = json.loads(req.content.decode())
    assert body == {
        "phone": "13800138000",
        "content": "hello sms",
        "sign": "测试签名",
    }


@pytest.mark.asyncio
async def test_sms_channel_gateway_500_fails(mock_http, monkeypatch) -> None:
    """网关非 2xx → 失败。"""
    monkeypatch.setenv("SMS_API_URL", "https://sms.example.com/api")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="server error")

    mock_http(handler)
    channel = SMSChannel()
    msg = Message(id="sms-4", content="hello", metadata={"phone": "13800138000"})
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


# =============================================================================
# 4. IMChannel(钉钉/企微/飞书机器人 webhook)
# =============================================================================


@pytest.mark.asyncio
async def test_im_channel_not_configured_fails(monkeypatch) -> None:
    """metadata 与 env 均无 webhook_url → 失败。"""
    monkeypatch.delenv("IM_WEBHOOK_URL", raising=False)
    channel = IMChannel()
    msg = Message(id="im-1", content="hello")
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


@pytest.mark.asyncio
async def test_im_channel_empty_content_fails() -> None:
    """空 content → 失败。"""
    channel = IMChannel()
    msg = Message(id="im-2", content="", metadata={"webhook_url": "https://im.example/hook"})
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


@pytest.mark.asyncio
async def test_im_channel_dingtalk_payload(mock_http) -> None:
    """钉钉兼容格式 payload:{"msgtype":"text","text":{"content": ...}}。"""
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"errcode": 0})

    mock_http(handler)
    channel = IMChannel()
    msg = Message(
        id="im-3",
        content="你好,世界",
        metadata={"webhook_url": "https://oapi.dingtalk.com/robot/send?access_token=xxx"},
    )
    ok, status = await channel.send(msg, {})
    assert ok is True
    assert status == "delivered"
    assert len(requests) == 1
    req = requests[0]
    assert str(req.url).startswith("https://oapi.dingtalk.com/robot/send")
    body = json.loads(req.content.decode())
    assert body == {"msgtype": "text", "text": {"content": "你好,世界"}}


@pytest.mark.asyncio
async def test_im_channel_env_url_used(mock_http, monkeypatch) -> None:
    """无 metadata webhook_url → 用 env IM_WEBHOOK_URL。"""
    monkeypatch.setenv("IM_WEBHOOK_URL", "https://env.im.example/hook")
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200)

    mock_http(handler)
    channel = IMChannel()
    msg = Message(id="im-4", content="hello")
    ok, status = await channel.send(msg, {})
    assert ok is True
    assert len(requests) == 1
    assert str(requests[0].url) == "https://env.im.example/hook"


@pytest.mark.asyncio
async def test_im_channel_metadata_priority_over_env(mock_http, monkeypatch) -> None:
    """metadata['webhook_url'] 优先于 env IM_WEBHOOK_URL。"""
    monkeypatch.setenv("IM_WEBHOOK_URL", "https://env.im.example/hook")
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200)

    mock_http(handler)
    channel = IMChannel()
    msg = Message(
        id="im-5",
        content="hello",
        metadata={"webhook_url": "https://meta.im.example/hook"},
    )
    ok, status = await channel.send(msg, {})
    assert ok is True
    assert str(requests[0].url) == "https://meta.im.example/hook"


@pytest.mark.asyncio
async def test_im_channel_500_fails(mock_http) -> None:
    """IM webhook 非 2xx → 失败。"""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="sign error")

    mock_http(handler)
    channel = IMChannel()
    msg = Message(id="im-6", content="hello", metadata={"webhook_url": "https://im.example/hook"})
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"


@pytest.mark.asyncio
async def test_im_channel_network_error_fails(mock_http) -> None:
    """网络异常 → 失败,不抛到上层。"""

    def handler(request: httpx.Request) -> httpx.Response:
        raise RuntimeError("network down")

    mock_http(handler)
    channel = IMChannel()
    msg = Message(id="im-7", content="hello", metadata={"webhook_url": "https://im.example/hook"})
    ok, status = await channel.send(msg, {})
    assert ok is False
    assert status == "failed"

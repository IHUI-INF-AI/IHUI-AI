"""多通道消息总线测试(app/api/message_bus.py + app/services/message_bus.py)。

测试覆盖:
1. 消息发送到指定通道(IM/WebSocket/Webhook/Email/SMS)
2. 通道降级(主通道失败 → 自动尝试更低优先级通道)
3. 优先级排序(IM > WebSocket > Webhook > Email > SMS)
4. 批量发送(batch_publish)
5. 限流(token bucket,超限拒绝)
6. 模板渲染(变量替换 + 未知模板/缺失变量异常)
7. 订阅/取消订阅
8. 投递状态查询
9. HTTP API 端点(/api/message-bus/*)

设计:
- 服务层测试用 fresh MessageBus 实例(隔离单例污染)。
- API 层测试用 httpx ASGITransport client + autouse fixture 重置单例状态。
- 不依赖真实 IM/SMTP/SMS/Webhook 外部服务(stub 实现)。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.services.message_bus import (
    BUILTIN_TEMPLATES,
    CHANNEL_PRIORITY,
    BatchResult,
    ChannelType,
    DeliveryStatus,
    Message,
    MessageBus,
    PublishResult,
    Subscription,
    render_template,
)


# =============================================================================
# 公共 fixture:每个测试前重置 message_bus 单例状态
# =============================================================================


@pytest.fixture(autouse=True)
def _isolate_vector_memory(monkeypatch: pytest.MonkeyPatch):
    """覆盖 conftest 中 broken 的同名 fixture(引用了不存在的 _store / _next_id)。
    同时清空 jwt_secret,让 JWT 中间件在 development 模式跳过认证(HTTP 测试需要)。
    """
    from app.core.config import settings
    from app.services.vector_memory import vector_memory

    monkeypatch.setattr(settings, "jwt_secret", "")
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()
    yield
    vector_memory._use_redis = False
    vector_memory._redis = None
    vector_memory._entries.clear()
    vector_memory._vectors.clear()


@pytest.fixture(autouse=True)
def _reset_message_bus_singleton():
    """重置 message_bus 单例的订阅表 + 投递状态(隔离测试间状态污染)。"""
    from app.services.message_bus import message_bus

    for ct in ChannelType:
        message_bus._subscriptions[ct] = {}
    message_bus._delivery_status.clear()
    yield
    for ct in ChannelType:
        message_bus._subscriptions[ct] = {}
    message_bus._delivery_status.clear()


def _make_message(
    content: str = "hello",
    msg_id: str = "test-msg-1",
    template_id: str | None = None,
    template_vars: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Message:
    """构造测试用 Message。"""
    return Message(
        id=msg_id,
        content=content,
        template_id=template_id,
        template_vars=template_vars,
        metadata=metadata or {},
    )


# =============================================================================
# 1. 消息发送到指定通道
# =============================================================================


@pytest.mark.asyncio
async def test_publish_to_im_succeeds() -> None:
    """发布到 IM 通道(content 非空)→ delivered=[IM]。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="hello world", msg_id="m-im-1")
    result = await bus.publish(msg, [ChannelType.IM])
    assert isinstance(result, PublishResult)
    assert result.message_id == "m-im-1"
    assert ChannelType.IM in result.delivered_channels
    assert result.failed_channels == []
    assert result.fallback_used is False
    assert result.error is None


@pytest.mark.asyncio
async def test_publish_to_websocket_no_subscribers_succeeds() -> None:
    """发布到 WebSocket 通道(无订阅者)→ 视为成功(消息丢弃但不失败)。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="ws-msg", msg_id="m-ws-1")
    result = await bus.publish(msg, [ChannelType.WEBSOCKET])
    assert ChannelType.WEBSOCKET in result.delivered_channels
    assert result.failed_channels == []


@pytest.mark.asyncio
async def test_publish_to_webhook_no_urls_succeeds() -> None:
    """发布到 Webhook 通道(无 webhook_url)→ stub 视为成功。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="hook-msg", msg_id="m-wh-1")
    result = await bus.publish(msg, [ChannelType.WEBHOOK])
    assert ChannelType.WEBHOOK in result.delivered_channels


@pytest.mark.asyncio
async def test_publish_to_email_without_recipient_fails() -> None:
    """发布到 Email 通道(metadata 无 'to')→ 失败。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="email-msg", msg_id="m-em-1", metadata={})
    result = await bus.publish(msg, [ChannelType.EMAIL])
    assert ChannelType.EMAIL in result.failed_channels
    assert result.delivered_channels == []
    assert result.error == "所有通道投递失败"


@pytest.mark.asyncio
async def test_publish_to_email_with_recipient_succeeds() -> None:
    """发布到 Email 通道(metadata 有 'to')→ 成功。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(
        content="email-msg", msg_id="m-em-2", metadata={"to": "user@example.com"}
    )
    result = await bus.publish(msg, [ChannelType.EMAIL])
    assert ChannelType.EMAIL in result.delivered_channels


@pytest.mark.asyncio
async def test_publish_to_sms_without_phone_fails() -> None:
    """发布到 SMS 通道(metadata 无 'phone')→ 失败。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="sms-msg", msg_id="m-sms-1", metadata={})
    result = await bus.publish(msg, [ChannelType.SMS])
    assert ChannelType.SMS in result.failed_channels


@pytest.mark.asyncio
async def test_publish_to_sms_with_phone_succeeds() -> None:
    """发布到 SMS 通道(metadata 有 'phone')→ 成功。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(
        content="sms-msg", msg_id="m-sms-2", metadata={"phone": "+8613800138000"}
    )
    result = await bus.publish(msg, [ChannelType.SMS])
    assert ChannelType.SMS in result.delivered_channels


@pytest.mark.asyncio
async def test_publish_to_multiple_channels_all_succeed() -> None:
    """发布到多通道(全成功)→ delivered 含全部通道。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="multi-msg", msg_id="m-multi-1")
    result = await bus.publish(
        msg, [ChannelType.IM, ChannelType.WEBSOCKET, ChannelType.WEBHOOK]
    )
    assert len(result.delivered_channels) == 3
    assert set(result.delivered_channels) == {
        ChannelType.IM, ChannelType.WEBSOCKET, ChannelType.WEBHOOK
    }


# =============================================================================
# 2. 通道降级(主通道失败 → 备用通道)
# =============================================================================


@pytest.mark.asyncio
async def test_publish_fallback_im_to_websocket() -> None:
    """IM 失败(content 空)→ 自动降级到 WebSocket → delivered=[WS], fallback_used=True。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="", msg_id="m-fb-1")  # 空 content → IM 失败
    result = await bus.publish(msg, [ChannelType.IM])
    assert ChannelType.IM in result.failed_channels
    # 降级到 WebSocket(无订阅者,stub 成功)
    assert ChannelType.WEBSOCKET in result.delivered_channels
    assert result.fallback_used is True
    assert result.error is None  # 有通道成功 → error=None


@pytest.mark.asyncio
async def test_publish_fallback_cascades_to_sms() -> None:
    """所有通道都失败时 → 全部尝试后 fallback_used=False, error='所有通道投递失败'。

    构造场景:IM 空 content + WebSocket 无订阅者但有 handler 抛异常 +
    Webhook 无 url(但 stub 返回 True... 这里改用直接 mock)。

    更简单:mock 所有通道失败。
    """
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="", msg_id="m-fb-2", metadata={})

    # mock 所有通道的 _do_send 返回 False
    for adapter in bus._adapters.values():
        async def _fail(msg, subs):
            return False
        adapter._do_send = _fail

    result = await bus.publish(msg, [ChannelType.IM])
    assert result.delivered_channels == []
    assert result.fallback_used is False
    assert result.error == "所有通道投递失败"
    # 应尝试了所有 5 个通道(IM + 4 个降级)
    assert len(result.failed_channels) == 5


@pytest.mark.asyncio
async def test_publish_fallback_stops_at_first_success() -> None:
    """降级时第一个成功的通道即停止,不继续尝试更低优先级。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="", msg_id="m-fb-3", metadata={})

    # mock IM 失败,WebSocket 成功,其他不应被调用
    call_log: list[ChannelType] = []

    async def _im_fail(msg, subs):
        call_log.append(ChannelType.IM)
        return False

    async def _ws_success(msg, subs):
        call_log.append(ChannelType.WEBSOCKET)
        return True

    bus._adapters[ChannelType.IM]._do_send = _im_fail
    bus._adapters[ChannelType.WEBSOCKET]._do_send = _ws_success

    result = await bus.publish(msg, [ChannelType.IM])
    assert ChannelType.IM in result.failed_channels
    assert ChannelType.WEBSOCKET in result.delivered_channels
    assert result.fallback_used is True
    # IM 先调用,WebSocket 降级成功,不应继续尝试 Webhook/Email/SMS
    assert ChannelType.WEBSOCKET in call_log
    assert ChannelType.WEBHOOK not in call_log
    assert ChannelType.EMAIL not in call_log
    assert ChannelType.SMS not in call_log


# =============================================================================
# 3. 优先级排序(高优先级先发送)
# =============================================================================


@pytest.mark.asyncio
async def test_publish_priority_order_im_first() -> None:
    """发布到 [SMS, IM, Email](乱序)→ 按 priority 排序后 IM 先调用。"""
    bus = MessageBus(rate_limit_per_sec=1000)
    call_order: list[ChannelType] = []

    for ct, adapter in bus._adapters.items():
        async def _record(msg, subs, _ct=ct):
            call_order.append(_ct)
            return True, "delivered" if True else "failed"
        # 替换 send 方法(绕过限流,直接记录调用顺序)
        async def _fake_send(msg, subs, _ct=ct):
            call_order.append(_ct)
            return True, "delivered"
        adapter.send = _fake_send

    msg = _make_message(content="priority-test", msg_id="m-prio-1")
    await bus.publish(msg, [ChannelType.SMS, ChannelType.IM, ChannelType.EMAIL])

    # IM (priority 1) → EMAIL (priority 4) → SMS (priority 5)
    assert call_order[0] == ChannelType.IM
    assert call_order[1] == ChannelType.EMAIL
    assert call_order[2] == ChannelType.SMS


def test_channel_priority_values() -> None:
    """通道优先级数值正确:IM < WebSocket < Webhook < Email < SMS。"""
    assert CHANNEL_PRIORITY[ChannelType.IM] < CHANNEL_PRIORITY[ChannelType.WEBSOCKET]
    assert CHANNEL_PRIORITY[ChannelType.WEBSOCKET] < CHANNEL_PRIORITY[ChannelType.WEBHOOK]
    assert CHANNEL_PRIORITY[ChannelType.WEBHOOK] < CHANNEL_PRIORITY[ChannelType.EMAIL]
    assert CHANNEL_PRIORITY[ChannelType.EMAIL] < CHANNEL_PRIORITY[ChannelType.SMS]


def test_channel_type_enum_values() -> None:
    """ChannelType 枚举值正确。"""
    assert ChannelType.IM.value == "im"
    assert ChannelType.WEBSOCKET.value == "websocket"
    assert ChannelType.WEBHOOK.value == "webhook"
    assert ChannelType.EMAIL.value == "email"
    assert ChannelType.SMS.value == "sms"


# =============================================================================
# 4. 批量发送
# =============================================================================


@pytest.mark.asyncio
async def test_batch_publish_all_succeed() -> None:
    """批量发布 3 条消息到 IM(全成功)→ total=3, succeeded=3, failed=0。"""
    bus = MessageBus(rate_limit_per_sec=100)
    messages = [
        _make_message(content=f"batch-{i}", msg_id=f"b-1-{i}") for i in range(3)
    ]
    result = await bus.batch_publish(messages, ChannelType.IM)
    assert isinstance(result, BatchResult)
    assert result.total == 3
    assert result.succeeded == 3
    assert result.failed == 0
    assert len(result.results) == 3
    # 每条结果都应有 delivered_channels
    for r in result.results:
        assert ChannelType.IM in r.delivered_channels


@pytest.mark.asyncio
async def test_batch_publish_partial_failure() -> None:
    """批量发布 3 条消息(1 条空 content)→ succeeded=2, failed=1。"""
    bus = MessageBus(rate_limit_per_sec=100)
    messages = [
        _make_message(content="ok-1", msg_id="b-2-0"),
        _make_message(content="", msg_id="b-2-1"),  # IM 失败,但会降级到 WS 成功
        _make_message(content="ok-2", msg_id="b-2-2"),
    ]
    result = await bus.batch_publish(messages, ChannelType.IM)
    # 空 content 的消息会降级到 WebSocket(无订阅者成功),所以 succeeded=3
    # 但 delivered_channels 不含 IM(对第二条)
    assert result.total == 3
    # 第二条消息 IM 失败但 WebSocket 降级成功 → 仍算 succeeded(delivered_channels 非空)
    assert result.succeeded == 3
    # 第二条结果:IM 在 failed,WS 在 delivered
    second_result = result.results[1]
    assert ChannelType.IM in second_result.failed_channels
    assert second_result.fallback_used is True


@pytest.mark.asyncio
async def test_batch_publish_empty_list() -> None:
    """批量发布空列表 → total=0, succeeded=0, failed=0。"""
    bus = MessageBus(rate_limit_per_sec=100)
    result = await bus.batch_publish([], ChannelType.IM)
    assert result.total == 0
    assert result.succeeded == 0
    assert result.failed == 0
    assert result.results == []


# =============================================================================
# 5. 限流(token bucket,超限拒绝)
# =============================================================================


@pytest.mark.asyncio
async def test_rate_limit_rejects_excess() -> None:
    """rate_limit_per_sec=1,连续发送 2 条 → 第 2 条被限流(rate_limited)。"""
    from app.services.message_bus import IMChannel

    channel = IMChannel(rate_limit_per_sec=1)
    msg1 = _make_message(content="first", msg_id="rl-1")
    msg2 = _make_message(content="second", msg_id="rl-2")

    ok1, status1 = await channel.send(msg1, {})
    assert ok1 is True
    assert status1 == "delivered"

    # 立即发送第 2 条(令牌桶耗尽)
    ok2, status2 = await channel.send(msg2, {})
    assert ok2 is False
    assert status2 == "rate_limited"


@pytest.mark.asyncio
async def test_rate_limit_refills_over_time() -> None:
    """令牌桶随时间补充(等 1.1s 后令牌恢复)。"""
    import time as _time

    from app.services.message_bus import IMChannel

    channel = IMChannel(rate_limit_per_sec=1)
    msg1 = _make_message(content="first", msg_id="rl-r-1")
    msg2 = _make_message(content="second", msg_id="rl-r-2")

    ok1, _ = await channel.send(msg1, {})
    assert ok1 is True

    # 等待令牌补充(1.1 秒 → 补充约 1.1 个令牌)
    await asyncio.sleep(1.1)
    ok2, status2 = await channel.send(msg2, {})
    assert ok2 is True
    assert status2 == "delivered"


@pytest.mark.asyncio
async def test_rate_limit_publish_returns_rate_limited_status() -> None:
    """publish 在限流时记录 rate_limited 状态到 delivery_status。"""
    bus = MessageBus(rate_limit_per_sec=1)
    msg1 = _make_message(content="first", msg_id="rl-pub-1")
    msg2 = _make_message(content="second", msg_id="rl-pub-2")

    await bus.publish(msg1, [ChannelType.IM])
    # 第 2 条立即发送 → IM 限流 → 降级到 WebSocket(成功)
    result2 = await bus.publish(msg2, [ChannelType.IM])
    # IM 应在 failed_channels(rate_limited)
    assert ChannelType.IM in result2.failed_channels
    # WebSocket 降级成功
    assert ChannelType.WEBSOCKET in result2.delivered_channels
    assert result2.fallback_used is True

    # 投递状态应记录 rate_limited
    status = await bus.get_delivery_status("rl-pub-2")
    assert status is not None
    assert status.per_channel[ChannelType.IM] == "rate_limited"
    assert status.per_channel[ChannelType.WEBSOCKET] == "delivered"
    assert status.total_attempts == 2


# =============================================================================
# 6. 模板渲染
# =============================================================================


def test_render_template_agent_started() -> None:
    """agent_started 模板渲染:变量替换。"""
    rendered = render_template(
        "agent_started",
        {"agent_name": "TestBot", "task": "测试任务"},
    )
    assert rendered == "智能体 TestBot 已启动,任务: 测试任务"


def test_render_template_agent_completed() -> None:
    """agent_completed 模板渲染。"""
    rendered = render_template(
        "agent_completed",
        {"agent_name": "Bot", "duration": "5", "result": "成功"},
    )
    assert "智能体 Bot 已完成任务" in rendered
    assert "耗时 5s" in rendered
    assert "结果: 成功" in rendered


def test_render_template_tool_failed() -> None:
    """tool_failed 模板渲染。"""
    rendered = render_template(
        "tool_failed",
        {"tool_name": "search", "error": "timeout"},
    )
    assert rendered == "工具 search 调用失败,错误: timeout"


def test_render_template_memory_consolidated() -> None:
    """memory_consolidated 模板渲染。"""
    rendered = render_template(
        "memory_consolidated",
        {"episodic_count": 10, "semantic_count": 3},
    )
    assert "episodic 10 条" in rendered
    assert "semantic 3 条" in rendered


def test_render_template_dream_triggered() -> None:
    """dream_triggered 模板渲染。"""
    rendered = render_template(
        "dream_triggered",
        {"user_id": "u-123", "topic": "未来"},
    )
    assert "用户 u-123" in rendered
    assert "主题: 未来" in rendered


def test_render_template_no_vars_returns_template_as_is() -> None:
    """vars=None → 返回模板原文(含 {var} 占位符)。"""
    rendered = render_template("agent_started", None)
    assert rendered == BUILTIN_TEMPLATES["agent_started"]
    assert "{agent_name}" in rendered


def test_render_template_unknown_id_raises() -> None:
    """未知 template_id → ValueError。"""
    with pytest.raises(ValueError, match="未知模板 ID"):
        render_template("nonexistent_template", None)


def test_render_template_missing_var_raises() -> None:
    """模板变量缺失 → ValueError。"""
    with pytest.raises(ValueError, match="模板变量缺失"):
        render_template("agent_started", {"agent_name": "Bot"})  # 缺 task


def test_builtin_templates_has_5_entries() -> None:
    """内置模板应有 5 个。"""
    assert len(BUILTIN_TEMPLATES) == 5
    expected_ids = {
        "agent_started", "agent_completed", "tool_failed",
        "memory_consolidated", "dream_triggered",
    }
    assert set(BUILTIN_TEMPLATES.keys()) == expected_ids


@pytest.mark.asyncio
async def test_publish_with_template_renders_content() -> None:
    """publish 时 template_id + template_vars → 渲染后覆盖 content。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = Message(
        id="tpl-1",
        content="placeholder",  # 应被模板渲染覆盖
        template_id="agent_started",
        template_vars={"agent_name": "TestBot", "task": "demo"},
    )
    result = await bus.publish(msg, [ChannelType.IM])
    assert ChannelType.IM in result.delivered_channels
    # msg.content 应被渲染结果覆盖
    assert msg.content == "智能体 TestBot 已启动,任务: demo"


@pytest.mark.asyncio
async def test_publish_with_unknown_template_returns_error() -> None:
    """publish 时 template_id 未知 → 返回 error='模板渲染失败'。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = Message(
        id="tpl-err-1",
        content="hello",
        template_id="nonexistent_template",
    )
    result = await bus.publish(msg, [ChannelType.IM])
    assert result.delivered_channels == []
    assert result.failed_channels == [ChannelType.IM]
    assert result.error is not None
    assert "模板渲染失败" in result.error


@pytest.mark.asyncio
async def test_publish_with_template_missing_var_returns_error() -> None:
    """publish 时模板变量缺失 → 返回 error='模板渲染失败'。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = Message(
        id="tpl-err-2",
        content="hello",
        template_id="agent_started",
        template_vars={"agent_name": "Bot"},  # 缺 task
    )
    result = await bus.publish(msg, [ChannelType.IM])
    assert result.delivered_channels == []
    assert "模板渲染失败" in (result.error or "")


# =============================================================================
# 7. 订阅/取消订阅
# =============================================================================


@pytest.mark.asyncio
async def test_subscribe_returns_subscription_id() -> None:
    """subscribe 返回非空 subscription_id。"""
    bus = MessageBus(rate_limit_per_sec=100)
    sub_id = await bus.subscribe(ChannelType.WEBSOCKET, webhook_url=None)
    assert sub_id is not None
    assert len(sub_id) > 0
    # 订阅应注册到 _subscriptions
    assert sub_id in bus._subscriptions[ChannelType.WEBSOCKET]


@pytest.mark.asyncio
async def test_subscribe_with_webhook_url() -> None:
    """subscribe webhook 模式注册 webhook_url。"""
    bus = MessageBus(rate_limit_per_sec=100)
    sub_id = await bus.subscribe(
        ChannelType.WEBHOOK, webhook_url="https://example.com/hook"
    )
    sub = bus._subscriptions[ChannelType.WEBHOOK][sub_id]
    assert sub.webhook_url == "https://example.com/hook"
    assert sub.channel == ChannelType.WEBHOOK


@pytest.mark.asyncio
async def test_unsubscribe_existing_returns_true() -> None:
    """unsubscribe 已存在的订阅 → True。"""
    bus = MessageBus(rate_limit_per_sec=100)
    sub_id = await bus.subscribe(ChannelType.WEBSOCKET)
    ok = await bus.unsubscribe(sub_id)
    assert ok is True
    assert sub_id not in bus._subscriptions[ChannelType.WEBSOCKET]


@pytest.mark.asyncio
async def test_unsubscribe_nonexistent_returns_false() -> None:
    """unsubscribe 不存在的订阅 → False。"""
    bus = MessageBus(rate_limit_per_sec=100)
    ok = await bus.unsubscribe("nonexistent-sub-id")
    assert ok is False


@pytest.mark.asyncio
async def test_websocket_handler_invoked_on_publish() -> None:
    """WebSocket 订阅 handler 在 publish 时被调用。"""
    bus = MessageBus(rate_limit_per_sec=100)
    received: list[Message] = []

    async def _handler(msg: Message) -> None:
        received.append(msg)

    sub_id = await bus.subscribe(ChannelType.WEBSOCKET, handler=_handler)
    msg = _make_message(content="ws-handler-test", msg_id="ws-h-1")
    await bus.publish(msg, [ChannelType.WEBSOCKET])

    assert len(received) == 1
    assert received[0].id == "ws-h-1"
    assert received[0].content == "ws-handler-test"


@pytest.mark.asyncio
async def test_websocket_handler_exception_marks_failed() -> None:
    """WebSocket handler 抛异常 → 该通道标记为失败。"""
    bus = MessageBus(rate_limit_per_sec=100)

    async def _bad_handler(msg: Message) -> None:
        raise RuntimeError("handler crashed")

    await bus.subscribe(ChannelType.WEBSOCKET, handler=_bad_handler)
    msg = _make_message(content="ws-fail", msg_id="ws-h-2")
    result = await bus.publish(msg, [ChannelType.WEBSOCKET])
    # WebSocket 失败(handler 抛异常)→ 降级到 Webhook(无 url,stub 成功)
    assert ChannelType.WEBSOCKET in result.failed_channels
    assert result.fallback_used is True


# =============================================================================
# 8. 投递状态查询
# =============================================================================


@pytest.mark.asyncio
async def test_get_delivery_status_after_publish() -> None:
    """publish 后 get_delivery_status 返回 DeliveryStatus。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="status-test", msg_id="st-1")
    await bus.publish(msg, [ChannelType.IM])
    status = await bus.get_delivery_status("st-1")
    assert status is not None
    assert isinstance(status, DeliveryStatus)
    assert status.message_id == "st-1"
    assert status.per_channel[ChannelType.IM] == "delivered"
    assert status.total_attempts == 1
    assert status.last_attempt is not None


@pytest.mark.asyncio
async def test_get_delivery_status_unknown_returns_none() -> None:
    """get_delivery_status 查询不存在的 message_id → None。"""
    bus = MessageBus(rate_limit_per_sec=100)
    status = await bus.get_delivery_status("nonexistent-msg-id")
    assert status is None


@pytest.mark.asyncio
async def test_get_delivery_status_records_failed_channels() -> None:
    """投递状态记录失败通道状态(rate_limited / failed)。"""
    bus = MessageBus(rate_limit_per_sec=100)
    msg = _make_message(content="", msg_id="st-2", metadata={})
    # mock 所有通道失败
    for adapter in bus._adapters.values():
        async def _fail(m, s):
            return False
        adapter._do_send = _fail

    await bus.publish(msg, [ChannelType.IM])
    status = await bus.get_delivery_status("st-2")
    assert status is not None
    assert status.per_channel[ChannelType.IM] == "failed"
    # 降级尝试了 4 个通道(WS/WH/EM/SMS)
    assert status.total_attempts == 5


# =============================================================================
# 9. list_templates
# =============================================================================


def test_list_templates_returns_all_5() -> None:
    """list_templates 返回 5 个内置模板。"""
    bus = MessageBus(rate_limit_per_sec=100)
    templates = bus.list_templates()
    assert len(templates) == 5
    assert "agent_started" in templates
    assert "agent_completed" in templates
    assert templates["agent_started"] == BUILTIN_TEMPLATES["agent_started"]


# =============================================================================
# 10. HTTP API 端点(/api/message-bus/*)
# =============================================================================


async def test_api_publish_endpoint(client) -> None:
    """POST /api/message-bus/publish 发布到 IM → code=0 + data 含 messageId。"""
    resp = await client.post(
        "/api/message-bus/publish",
        json={
            "message": {"content": "api-test-msg"},
            "channels": ["im"],
            "priority": "normal",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["message"] == "ok"
    data = body["data"]
    assert "messageId" in data
    assert "deliveredChannels" in data
    assert "failedChannels" in data
    assert "fallbackUsed" in data
    assert "im" in data["deliveredChannels"]


async def test_api_publish_endpoint_with_template(client) -> None:
    """POST /api/message-bus/publish 带 template_id → 渲染后发布。"""
    resp = await client.post(
        "/api/message-bus/publish",
        json={
            "message": {
                "content": "placeholder",
                "templateId": "agent_started",
                "templateVars": {"agent_name": "ApiBot", "task": "测试"},
            },
            "channels": ["im"],
            "priority": "high",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert "im" in body["data"]["deliveredChannels"]


async def test_api_publish_endpoint_priority_param(client) -> None:
    """POST /api/message-bus/publish 透传 priority 参数。"""
    resp = await client.post(
        "/api/message-bus/publish",
        json={
            "message": {"content": "priority-api-test"},
            "channels": ["websocket"],
            "priority": "high",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0


async def test_api_publish_endpoint_missing_message_returns_422(client) -> None:
    """POST /api/message-bus/publish 缺 message → 422。"""
    resp = await client.post(
        "/api/message-bus/publish",
        json={"channels": ["im"], "priority": "normal"},
    )
    assert resp.status_code == 422


async def test_api_publish_endpoint_missing_channels_returns_422(client) -> None:
    """POST /api/message-bus/publish 缺 channels → 422。"""
    resp = await client.post(
        "/api/message-bus/publish",
        json={"message": {"content": "x"}, "priority": "normal"},
    )
    assert resp.status_code == 422


async def test_api_batch_endpoint(client) -> None:
    """POST /api/message-bus/batch 批量发布 → code=0 + total/succeeded/failed。"""
    resp = await client.post(
        "/api/message-bus/batch",
        json={
            "messages": [
                {"content": "batch-1"},
                {"content": "batch-2"},
                {"content": "batch-3"},
            ],
            "channel": "im",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["total"] == 3
    assert data["succeeded"] == 3
    assert data["failed"] == 0
    assert len(data["results"]) == 3


async def test_api_batch_endpoint_empty_list(client) -> None:
    """POST /api/message-bus/batch 空列表 → total=0。"""
    resp = await client.post(
        "/api/message-bus/batch",
        json={"messages": [], "channel": "im"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["total"] == 0


async def test_api_templates_endpoint(client) -> None:
    """GET /api/message-bus/templates 返回 5 个内置模板。"""
    resp = await client.get("/api/message-bus/templates")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    templates = body["data"]
    assert len(templates) == 5
    assert "agent_started" in templates
    assert "agent_completed" in templates
    assert "tool_failed" in templates
    assert "memory_consolidated" in templates
    assert "dream_triggered" in templates


async def test_api_subscribe_and_unsubscribe_flow(client) -> None:
    """POST /api/message-bus/subscribe → DELETE /api/message-bus/subscribe/{id}。"""
    # 订阅
    resp = await client.post(
        "/api/message-bus/subscribe",
        json={"channel": "webhook", "webhookUrl": "https://example.com/hook"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    sub_id = body["data"]["subscriptionId"]
    assert body["data"]["channel"] == "webhook"

    # 取消订阅
    resp2 = await client.delete(f"/api/message-bus/subscribe/{sub_id}")
    assert resp2.status_code == 200
    assert resp2.json()["code"] == 0


async def test_api_unsubscribe_nonexistent_returns_404(client) -> None:
    """DELETE /api/message-bus/subscribe/{unknown} → 404。"""
    resp = await client.delete("/api/message-bus/subscribe/nonexistent-sub-id")
    assert resp.status_code == 404


async def test_api_status_endpoint(client) -> None:
    """GET /api/message-bus/status/{message_id} 查询投递状态。"""
    # 先发布一条消息
    pub_resp = await client.post(
        "/api/message-bus/publish",
        json={
            "message": {"content": "status-api-test"},
            "channels": ["im"],
            "priority": "normal",
        },
    )
    msg_id = pub_resp.json()["data"]["messageId"]

    # 查询状态
    resp = await client.get(f"/api/message-bus/status/{msg_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["messageId"] == msg_id
    assert "perChannel" in data
    assert "im" in data["perChannel"]
    assert data["perChannel"]["im"] == "delivered"
    assert data["totalAttempts"] >= 1


async def test_api_status_not_found_returns_404(client) -> None:
    """GET /api/message-bus/status/{unknown} → 404。"""
    resp = await client.get("/api/message-bus/status/nonexistent-msg-id")
    assert resp.status_code == 404


async def test_api_publish_fallback_evidenced_in_response(client) -> None:
    """POST /api/message-bus/publish IM 失败(content 空)→ 降级到 WebSocket,response 体现。"""
    resp = await client.post(
        "/api/message-bus/publish",
        json={
            "message": {"content": ""},
            "channels": ["im"],
            "priority": "normal",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    # IM 失败
    assert "im" in data["failedChannels"]
    # 降级到 WebSocket 成功
    assert "websocket" in data["deliveredChannels"]
    assert data["fallbackUsed"] is True

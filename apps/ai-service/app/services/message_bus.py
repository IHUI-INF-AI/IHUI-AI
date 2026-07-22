"""多通道消息总线(对标并反超 OpenClaw 单 WebSocket 通道)。

支持 5 通道下发 + 通道优先级 + 失败自动降级 + 消息模板 + 批量发送 + 限流:
- IM(飞书/钉钉/微信)/ WebSocket / Webhook / Email / SMS 5 通道
- 通道优先级:IM > WebSocket > Webhook > Email > SMS
- 失败降级:高优先级通道失败自动级联降级到更低优先级通道
- 消息模板:5 内置模板(agent_started / agent_completed / tool_failed /
  memory_consolidated / dream_triggered),{var_name} 占位符渲染
- 限流:每通道 token bucket,默认 100/秒(可配置)

OpenClaw 仅支持 WebSocket 单通道下发,本总线在通道数量、优先级、降级、
模板、批量、限流 6 个维度全面反超。
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 通道类型枚举
# ---------------------------------------------------------------------------


class ChannelType(str, Enum):
    """消息通道类型。"""

    IM = "im"            # 飞书/钉钉/微信
    WEBSOCKET = "websocket"
    WEBHOOK = "webhook"
    EMAIL = "email"
    SMS = "sms"


# 通道优先级(数值越小优先级越高)
CHANNEL_PRIORITY: dict[ChannelType, int] = {
    ChannelType.IM: 1,
    ChannelType.WEBSOCKET: 2,
    ChannelType.WEBHOOK: 3,
    ChannelType.EMAIL: 4,
    ChannelType.SMS: 5,
}


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------


@dataclass
class Message:
    """消息体。"""

    id: str
    content: str
    template_id: str | None = None
    template_vars: dict[str, Any] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PublishResult:
    """单条消息发布结果。"""

    message_id: str
    delivered_channels: list[ChannelType]
    failed_channels: list[ChannelType]
    fallback_used: bool
    error: str | None


@dataclass
class DeliveryStatus:
    """消息投递状态(跨所有尝试过的通道)。"""

    message_id: str
    per_channel: dict[ChannelType, str]  # 'pending'/'delivered'/'failed'/'rate_limited'
    total_attempts: int
    last_attempt: datetime | None


@dataclass
class BatchResult:
    """批量发布结果。"""

    total: int
    succeeded: int
    failed: int
    results: list[PublishResult]


@dataclass
class Subscription:
    """订阅句柄。

    - WebSocket 模式:handler 为异步回调函数
    - Webhook 模式:webhook_url 为回调地址
    - IM/Email/SMS:仅支持 outbound,订阅无实际效果(预留扩展)
    """

    id: str
    channel: ChannelType
    handler: Callable[[Message], Awaitable[None]] | None = None
    webhook_url: str | None = None


# ---------------------------------------------------------------------------
# 消息模板
# ---------------------------------------------------------------------------


# 内置 5 个模板(生产环境用 DB 或 Redis 持久化)
BUILTIN_TEMPLATES: dict[str, str] = {
    "agent_started": "智能体 {agent_name} 已启动,任务: {task}",
    "agent_completed": "智能体 {agent_name} 已完成任务,耗时 {duration}s,结果: {result}",
    "tool_failed": "工具 {tool_name} 调用失败,错误: {error}",
    "memory_consolidated": "记忆固化完成:episodic {episodic_count} 条 → semantic {semantic_count} 条",
    "dream_triggered": "梦境触发:用户 {user_id},主题: {topic}",
}


def render_template(template_id: str, vars: dict[str, Any] | None) -> str:
    """渲染消息模板。

    Args:
        template_id: 模板 ID(必须在 BUILTIN_TEMPLATES 中)
        vars: 模板变量(可选)

    Returns:
        渲染后的字符串

    Raises:
        ValueError: 未知模板 ID 或变量缺失
    """
    tpl = BUILTIN_TEMPLATES.get(template_id)
    if tpl is None:
        raise ValueError(f"未知模板 ID: {template_id}")
    if not vars:
        return tpl
    try:
        return tpl.format(**vars)
    except KeyError as e:
        raise ValueError(f"模板变量缺失: {e}") from e


# ---------------------------------------------------------------------------
# 通道适配器
# ---------------------------------------------------------------------------


class BaseChannel:
    """通道适配器基类。

    封装 token bucket 限流(每秒 rate_limit_per_sec 条),
    子类只需实现 _do_send() 业务逻辑。
    """

    channel_type: ChannelType

    def __init__(self, rate_limit_per_sec: int = 100) -> None:
        self._rate_limit = rate_limit_per_sec
        # token bucket:初始满桶
        self._tokens: float = float(rate_limit_per_sec)
        self._last_refill: float = time.monotonic()
        self._lock = asyncio.Lock()

    async def _acquire_token(self) -> bool:
        """尝试获取一个令牌(限流)。返回 False 表示被限流。"""
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_refill
            # 按秒线性补充令牌(最多不超过桶容量)
            self._tokens = min(
                float(self._rate_limit),
                self._tokens + elapsed * self._rate_limit,
            )
            self._last_refill = now
            if self._tokens >= 1.0:
                self._tokens -= 1.0
                return True
            return False

    async def send(
        self,
        message: Message,
        subscriptions: dict[str, Subscription],
    ) -> tuple[bool, str]:
        """发送消息(含限流)。

        Returns:
            (success, status):status ∈ {'delivered', 'failed', 'rate_limited'}
        """
        if not await self._acquire_token():
            return False, "rate_limited"
        try:
            ok = await self._do_send(message, subscriptions)
            return ok, "delivered" if ok else "failed"
        except Exception as e:
            logger.exception(
                "[Channel %s] 发送异常: %s", self.channel_type.value, e
            )
            return False, "failed"

    async def _do_send(
        self,
        message: Message,
        subscriptions: dict[str, Subscription],
    ) -> bool:
        """子类实现:真实发送逻辑。返回 True 成功 / False 失败。"""
        raise NotImplementedError


class IMChannel(BaseChannel):
    """IM 通道(飞书/钉钉/微信)— Stub 实现。

    真实集成点:
    - 飞书:调用 lark-im skill / 飞书 OpenAPI(/open-apis/im/v1/messages)
    - 钉钉:调用钉钉 OpenAPI(/v1.0/robot/oToMessages/batchSend)
    - 微信公众号:调用微信公众平台 API(/cgi-bin/message/custom/send)
    """

    channel_type = ChannelType.IM

    async def _do_send(
        self, message: Message, subscriptions: dict[str, Subscription]
    ) -> bool:
        # 真实集成:根据 message.metadata.get('im_platform') 路由到对应 IM 平台 API
        # 此处 stub:验证 content 非空即视为成功
        if not message.content:
            return False
        logger.debug("[IMChannel] stub send: %s", message.id)
        return True


class WebSocketChannel(BaseChannel):
    """WebSocket 通道 — 内存连接池实现。

    真实集成点:用 aioredis pubsub 跨进程广播,Socket.IO / ws 客户端订阅。
    当前实现:遍历该通道所有订阅 handler,并发调用(内存模式,单进程)。
    """

    channel_type = ChannelType.WEBSOCKET

    async def _do_send(
        self, message: Message, subscriptions: dict[str, Subscription]
    ) -> bool:
        # 无订阅者视为成功(消息丢弃,但不算失败)
        handlers = [s.handler for s in subscriptions.values() if s.handler is not None]
        if not handlers:
            return True
        # 并发调用所有 handler
        results = await asyncio.gather(
            *[h(message) for h in handlers], return_exceptions=True
        )
        ok_count = sum(1 for r in results if not isinstance(r, Exception))
        for r in results:
            if isinstance(r, Exception):
                logger.warning("[WebSocketChannel] handler 异常: %s", r)
        return ok_count > 0


class WebhookChannel(BaseChannel):
    """Webhook 通道 — Stub 实现。

    真实集成点:用 httpx.AsyncClient POST 到订阅注册的 webhook_url,
    支持重试(3 次,指数退避)、HMAC 签名、超时控制。
    """

    channel_type = ChannelType.WEBHOOK

    async def _do_send(
        self, message: Message, subscriptions: dict[str, Subscription]
    ) -> bool:
        # 真实集成:
        #   async with httpx.AsyncClient(timeout=5.0) as client:
        #       for sub in subscriptions.values():
        #           if not sub.webhook_url:
        #               continue
        #           resp = await client.post(sub.webhook_url, json={...})
        #           resp.raise_for_status()
        # 此处 stub:有 webhook_url 即视为成功
        urls = [s.webhook_url for s in subscriptions.values() if s.webhook_url]
        if not urls:
            return True
        logger.debug(
            "[WebhookChannel] stub send to %d urls: %s", len(urls), message.id
        )
        return True


class EmailChannel(BaseChannel):
    """Email 通道 — Stub 实现。

    真实集成点:用 aiosmtplib 发送 SMTP 邮件,
    收件人从 message.metadata.get('to') 读取,主题从 metadata.get('subject')。
    """

    channel_type = ChannelType.EMAIL

    async def _do_send(
        self, message: Message, subscriptions: dict[str, Subscription]
    ) -> bool:
        # 真实集成:
        #   import aiosmtplib
        #   from email.mime.text import MIMEText
        #   msg = MIMEText(message.content)
        #   msg['Subject'] = message.metadata.get('subject', 'IHUI 通知')
        #   msg['From'] = settings.smtp_from
        #   msg['To'] = message.metadata.get('to')
        #   await aiosmtplib.send(msg, hostname=settings.smtp_host, ...)
        # 此处 stub:metadata 有 'to' 即视为成功
        if not message.metadata.get("to"):
            return False
        logger.debug("[EmailChannel] stub send: %s", message.id)
        return True


class SMSChannel(BaseChannel):
    """SMS 通道 — Stub 实现。

    真实集成点:调用阿里云/腾讯云 SMS API,
    手机号从 message.metadata.get('phone') 读取,模板号对齐 SMS 平台模板。
    """

    channel_type = ChannelType.SMS

    async def _do_send(
        self, message: Message, subscriptions: dict[str, Subscription]
    ) -> bool:
        # 真实集成:
        #   阿里云:调用 dysmsapi.aliyuncs.com SendSms
        #   腾讯云:调用 sms.tencentcloudapi.com SendSms
        # 此处 stub:metadata 有 'phone' 即视为成功
        if not message.metadata.get("phone"):
            return False
        logger.debug("[SMSChannel] stub send: %s", message.id)
        return True


# ---------------------------------------------------------------------------
# 消息总线
# ---------------------------------------------------------------------------


class MessageBus:
    """多通道消息总线。

    - 通道优先级:IM > WebSocket > Webhook > Email > SMS
    - 失败降级:高优先级通道失败时,自动级联尝试更低优先级通道
      (即使不在用户请求列表内,直到有一个成功或全部尝试完毕)
    - 限流:每通道 token bucket,默认 100/秒
    """

    def __init__(self, rate_limit_per_sec: int = 100) -> None:
        self._adapters: dict[ChannelType, BaseChannel] = {
            ChannelType.IM: IMChannel(rate_limit_per_sec),
            ChannelType.WEBSOCKET: WebSocketChannel(rate_limit_per_sec),
            ChannelType.WEBHOOK: WebhookChannel(rate_limit_per_sec),
            ChannelType.EMAIL: EmailChannel(rate_limit_per_sec),
            ChannelType.SMS: SMSChannel(rate_limit_per_sec),
        }
        # 订阅表:channel -> {subscription_id -> Subscription}
        self._subscriptions: dict[ChannelType, dict[str, Subscription]] = {
            ct: {} for ct in ChannelType
        }
        # 投递状态追踪:message_id -> DeliveryStatus
        self._delivery_status: dict[str, DeliveryStatus] = {}

    async def publish(
        self,
        message: Message,
        channels: list[ChannelType],
        priority: str = "normal",
    ) -> PublishResult:
        """发布消息到指定通道列表,支持失败自动降级。

        Args:
            message: 消息体(若 template_id 已设置,先用模板渲染 content)
            channels: 目标通道列表
            priority: 消息优先级(high / normal / low),记录到 metadata 供通道参考

        Returns:
            PublishResult:delivered_channels / failed_channels / fallback_used / error
        """
        # 模板渲染
        if message.template_id:
            try:
                rendered = render_template(message.template_id, message.template_vars)
                message.content = rendered or message.content
            except ValueError as e:
                return PublishResult(
                    message_id=message.id,
                    delivered_channels=[],
                    failed_channels=list(channels),
                    fallback_used=False,
                    error=f"模板渲染失败: {e}",
                )

        # 优先级记入 metadata(通道可据此调整策略)
        message.metadata.setdefault("priority", priority)

        delivered: list[ChannelType] = []
        failed: list[ChannelType] = []
        fallback_used = False
        per_channel_status: dict[ChannelType, str] = {}
        total_attempts = 0
        last_attempt: datetime | None = None

        # 按通道优先级排序(高 → 低),去重
        sorted_channels = sorted(set(channels), key=lambda c: CHANNEL_PRIORITY[c])

        for channel in sorted_channels:
            # 已被降级尝试过的通道跳过(避免重复发送)
            if channel in per_channel_status:
                continue
            success, status = await self._adapters[channel].send(
                message, self._subscriptions.get(channel, {})
            )
            total_attempts += 1
            last_attempt = datetime.utcnow()
            per_channel_status[channel] = status
            if success:
                delivered.append(channel)
            else:
                failed.append(channel)
                # 级联降级:尝试所有更低优先级通道
                fb_success, fb_attempts = await self._cascade_fallback(
                    message, channel, per_channel_status, delivered, failed
                )
                total_attempts += fb_attempts
                if fb_success:
                    fallback_used = True

        # 记录投递状态
        self._delivery_status[message.id] = DeliveryStatus(
            message_id=message.id,
            per_channel=per_channel_status,
            total_attempts=total_attempts,
            last_attempt=last_attempt,
        )

        error = None if delivered else "所有通道投递失败"
        return PublishResult(
            message_id=message.id,
            delivered_channels=delivered,
            failed_channels=failed,
            fallback_used=fallback_used,
            error=error,
        )

    async def _cascade_fallback(
        self,
        message: Message,
        failed_channel: ChannelType,
        per_channel_status: dict[ChannelType, str],
        delivered: list[ChannelType],
        failed: list[ChannelType],
    ) -> tuple[bool, int]:
        """级联降级:从 failed_channel 的下一优先级开始,依次尝试所有更低优先级通道。

        一旦有一个通道成功就停止;全部失败则返回 (False, 总尝试次数)。

        Returns:
            (any_success, attempts_count)
        """
        failed_priority = CHANNEL_PRIORITY[failed_channel]
        candidates = [
            ct
            for ct in CHANNEL_PRIORITY
            if CHANNEL_PRIORITY[ct] > failed_priority and ct not in per_channel_status
        ]
        candidates.sort(key=lambda c: CHANNEL_PRIORITY[c])

        attempts = 0
        for candidate in candidates:
            success, status = await self._adapters[candidate].send(
                message, self._subscriptions.get(candidate, {})
            )
            attempts += 1
            per_channel_status[candidate] = status
            if success:
                delivered.append(candidate)
                return True, attempts
            failed.append(candidate)
        return False, attempts

    async def subscribe(
        self,
        channel: ChannelType,
        handler: Callable[[Message], Awaitable[None]] | None = None,
        webhook_url: str | None = None,
    ) -> str:
        """订阅指定通道。返回 subscription_id。

        - WebSocket 模式:提供 handler(异步回调函数)
        - Webhook 模式:提供 webhook_url
        - IM/Email/SMS:仅支持 outbound,订阅无实际效果(预留扩展)
        """
        sub_id = uuid.uuid4().hex
        self._subscriptions[channel][sub_id] = Subscription(
            id=sub_id,
            channel=channel,
            handler=handler,
            webhook_url=webhook_url,
        )
        logger.info(
            "[MessageBus] 订阅注册:channel=%s, sub_id=%s",
            channel.value,
            sub_id,
        )
        return sub_id

    async def unsubscribe(self, subscription_id: str) -> bool:
        """取消订阅。返回 True 成功 / False(订阅不存在)。"""
        for channel_subs in self._subscriptions.values():
            if subscription_id in channel_subs:
                del channel_subs[subscription_id]
                logger.info(
                    "[MessageBus] 订阅取消:sub_id=%s", subscription_id
                )
                return True
        return False

    async def get_delivery_status(self, message_id: str) -> DeliveryStatus | None:
        """查询消息投递状态。未找到返回 None。"""
        return self._delivery_status.get(message_id)

    async def batch_publish(
        self,
        messages: list[Message],
        channel: ChannelType,
    ) -> BatchResult:
        """批量发布消息到单一通道。

        逐条调用 publish(受限流约束),汇总结果。
        """
        results: list[PublishResult] = []
        for msg in messages:
            r = await self.publish(msg, [channel])
            results.append(r)
        succeeded = sum(1 for r in results if r.delivered_channels)
        return BatchResult(
            total=len(messages),
            succeeded=succeeded,
            failed=len(messages) - succeeded,
            results=results,
        )

    def list_templates(self) -> dict[str, str]:
        """列出所有内置模板。返回 {template_id: template_str}。"""
        return dict(BUILTIN_TEMPLATES)


# 单例(默认限流 100/秒/通道)
message_bus = MessageBus(rate_limit_per_sec=100)

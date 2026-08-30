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
import os
import smtplib
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from email.mime.text import MIMEText
from enum import Enum
from typing import Any, Awaitable, Callable

import httpx

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

    # ------------------------------------------------------------------
    # 配置解析辅助(metadata + env)
    # ------------------------------------------------------------------

    @staticmethod
    def _env(name: str, default: str | None = None) -> str | None:
        """读取环境变量(与 MessageBus 的配置来源约定一致)。"""
        return os.getenv(name, default)

    def _get_webhook_urls(
        self,
        message: Message,
        subscriptions: dict[str, Subscription] | None = None,
    ) -> list[str]:
        """从 metadata + 订阅 + env 解析 webhook URL 列表。

        优先级:message.metadata['webhook_urls']/['webhook_url'] >
        订阅的 webhook_url > env WEBHOOK_URLS(逗号分隔)。去重保序。
        """
        urls: list[str] = []
        meta = message.metadata or {}
        for key in ("webhook_urls", "webhook_url"):
            v = meta.get(key)
            if isinstance(v, str):
                if v.strip():
                    urls.append(v.strip())
            elif isinstance(v, (list, tuple)):
                urls.extend(u.strip() for u in v if isinstance(u, str) and u.strip())
        if subscriptions:
            urls.extend(s.webhook_url for s in subscriptions.values() if s.webhook_url)
        env_urls = self._env("WEBHOOK_URLS")
        if env_urls:
            urls.extend(u.strip() for u in env_urls.split(",") if u.strip())
        # 去重保序
        seen: set[str] = set()
        result: list[str] = []
        for u in urls:
            if u not in seen:
                seen.add(u)
                result.append(u)
        return result

    @staticmethod
    def _get_im_webhook_url(message: Message) -> str | None:
        """解析 IM webhook URL:metadata['webhook_url'] 优先于 env IM_WEBHOOK_URL。"""
        meta = message.metadata or {}
        url = meta.get("webhook_url")
        if isinstance(url, str) and url.strip():
            return url.strip()
        env_url = os.getenv("IM_WEBHOOK_URL")
        if env_url:
            return env_url.strip()
        return None

    @staticmethod
    def _get_recipients(message: Message) -> list[str]:
        """解析收件人列表:metadata['to'] 支持 str(逗号分隔)或 list。"""
        meta = message.metadata or {}
        to = meta.get("to")
        if not to:
            return []
        if isinstance(to, str):
            return [addr.strip() for addr in to.split(",") if addr.strip()]
        if isinstance(to, (list, tuple)):
            return [str(a).strip() for a in to if a is not None and str(a).strip()]
        return [str(to).strip()] if str(to).strip() else []

    @staticmethod
    def _get_sms_phone(message: Message) -> str | None:
        """解析 SMS 手机号:metadata['phone']。"""
        meta = message.metadata or {}
        phone = meta.get("phone")
        if not phone:
            return None
        return str(phone).strip() or None


class IMChannel(BaseChannel):
    """IM 通道(飞书/钉钉/微信)。

    真实集成点:通用 IM 机器人 webhook(兼容钉钉/企微/飞书机器人):
    - 钉钉:`{"msgtype":"text","text":{"content": ...}}` POST 到机器人 webhook
    - webhook 地址来源:message.metadata['webhook_url'] 优先,其次 env IM_WEBHOOK_URL
    """

    channel_type = ChannelType.IM

    async def _do_send(
        self, message: Message, subscriptions: dict[str, Subscription]
    ) -> bool:
        if not message.content:
            logger.error("[IMChannel] 空内容拒绝发送: %s", message.id)
            return False
        webhook_url = self._get_im_webhook_url(message)
        if not webhook_url:
            logger.error(
                "[IMChannel] IM webhook not configured "
                "(metadata['webhook_url'] 或 env IM_WEBHOOK_URL 均缺失): %s",
                message.id,
            )
            return False
        payload = {"msgtype": "text", "text": {"content": message.content}}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(webhook_url, json=payload)
            if 200 <= resp.status_code < 300:
                logger.info("[IMChannel] IM webhook 发送成功: %s", message.id)
                return True
            logger.error(
                "[IMChannel] IM webhook 非 2xx: status=%s body=%s",
                resp.status_code,
                resp.text[:500],
            )
            return False
        except Exception as e:
            logger.error("[IMChannel] IM webhook 请求异常: %s error=%s", message.id, e)
            return False


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
    """Webhook 通道 — 真实实现。

    用 httpx.AsyncClient POST JSON 到每个 webhook URL(timeout 10s):
    - URL 来源:message.metadata['webhook_urls'/'webhook_url'] > 订阅的
      webhook_url > env WEBHOOK_URLS(逗号分隔)
    - 任一 URL 非 2xx 或请求异常 → 整体失败(收集错误日志)
    - 无 URL → 视为成功(消息丢弃,与 WebSocket 无订阅者语义一致)
    """

    channel_type = ChannelType.WEBHOOK

    async def _do_send(
        self, message: Message, subscriptions: dict[str, Subscription]
    ) -> bool:
        urls = self._get_webhook_urls(message, subscriptions)
        if not urls:
            logger.debug("[WebhookChannel] 无 webhook 目标,消息丢弃: %s", message.id)
            return True
        payload = {
            "message_id": message.id,
            "content": message.content,
            "metadata": message.metadata,
        }
        errors: list[str] = []
        ok_count = 0
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for url in urls:
                    try:
                        resp = await client.post(url, json=payload)
                        if 200 <= resp.status_code < 300:
                            ok_count += 1
                        else:
                            errors.append(f"{url} → HTTP {resp.status_code}")
                    except Exception as e:
                        errors.append(f"{url} → {e}")
        except Exception as e:
            logger.error("[WebhookChannel] 客户端异常: %s error=%s", message.id, e)
            return False
        if errors:
            logger.error(
                "[WebhookChannel] 发送失败 %d/%d: %s errors=%s",
                len(errors),
                len(urls),
                message.id,
                "; ".join(errors),
            )
            return False
        logger.info("[WebhookChannel] 发送成功 %d 个 url: %s", ok_count, message.id)
        return True


class EmailChannel(BaseChannel):
    """Email 通道 — 真实实现(SMTP)。

    配置来源 env:SMTP_HOST / SMTP_PORT(默认 587) / SMTP_USER /
    SMTP_PASSWORD / SMTP_FROM。收件人来自 message.metadata['to'](str 或 list)。
    用标准库 smtplib + email.mime 构建文本邮件,SMTP 阻塞调用放入线程池,
    整体 15s 超时。env 未配置 SMTP → 返回失败(不假装成功)。
    """

    channel_type = ChannelType.EMAIL

    async def _do_send(
        self, message: Message, subscriptions: dict[str, Subscription]
    ) -> bool:
        to_list = self._get_recipients(message)
        if not to_list:
            logger.error("[EmailChannel] 缺少收件人 metadata['to']: %s", message.id)
            return False

        host = self._env("SMTP_HOST")
        if not host:
            logger.error("[EmailChannel] SMTP not configured (env SMTP_HOST): %s", message.id)
            return False
        try:
            port = int(str(self._env("SMTP_PORT")) or "587")
        except (TypeError, ValueError):
            logger.error("[EmailChannel] SMTP_PORT 非法: %s", message.id)
            return False
        user = self._env("SMTP_USER")
        password = self._env("SMTP_PASSWORD")
        from_addr = self._env("SMTP_FROM") or user or "noreply@localhost"
        subject = (message.metadata or {}).get("subject") or "IHUI 通知"

        msg = MIMEText(message.content, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = ", ".join(to_list)

        def _send_sync() -> None:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                if port == 587:
                    server.starttls()
                    server.ehlo()
                if user:
                    server.login(user, password or "")
                server.sendmail(from_addr, to_list, msg.as_string())

        try:
            await asyncio.wait_for(asyncio.to_thread(_send_sync), timeout=15)
        except Exception as e:
            logger.error("[EmailChannel] SMTP 发送异常: %s error=%s", message.id, e)
            return False
        logger.info("[EmailChannel] 邮件发送成功: %s → %s", message.id, to_list)
        return True


class SMSChannel(BaseChannel):
    """SMS 通道 — 真实实现(HTTP 短信网关)。

    协议:POST JSON {phone, content, sign} 到网关,网关地址 env SMS_API_URL,
    API Key env SMS_API_KEY(放入 Authorization: Bearer),签名 env SMS_SIGN。
    手机号来自 message.metadata['phone']。env 未配置网关 → 返回失败。
    """

    channel_type = ChannelType.SMS

    async def _do_send(
        self, message: Message, subscriptions: dict[str, Subscription]
    ) -> bool:
        phone = self._get_sms_phone(message)
        if not phone:
            logger.error("[SMSChannel] 缺少手机号 metadata['phone']: %s", message.id)
            return False
        api_url = self._env("SMS_API_URL")
        if not api_url:
            logger.error("[SMSChannel] SMS gateway not configured (env SMS_API_URL): %s", message.id)
            return False
        api_key = self._env("SMS_API_KEY")
        sign = self._env("SMS_SIGN") or "IHUI"
        payload = {"phone": phone, "content": message.content, "sign": sign}
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(api_url, json=payload, headers=headers)
            if 200 <= resp.status_code < 300:
                logger.info("[SMSChannel] 短信发送成功: %s → %s", message.id, phone)
                return True
            logger.error(
                "[SMSChannel] 短信网关非 2xx: status=%s body=%s",
                resp.status_code,
                resp.text[:500],
            )
            return False
        except Exception as e:
            logger.error("[SMSChannel] 短信网关请求异常: %s error=%s", message.id, e)
            return False


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

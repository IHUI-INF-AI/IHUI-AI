"""基于 Redis Stream 的轻量消息队列 (替代 RocketMQ).

使用 Redis Stream 实现发布/订阅 + 消费者组模式, 无需额外部署 RabbitMQ/RocketMQ.
当 settings.MQ_ENABLED=False 时, publish 静默返回, consume 返回空列表.

Usage:
    from app.utils.message_queue import mq

    # 发布
    await mq.publish("order.created", {"order_id": 123, "amount": 99.5})

    # 消费 (需先创建消费者组)
    await mq.create_group("order.created", "order_processors")
    messages = await mq.consume("order.created", "order_processors", "worker-1", count=10)
    for msg in messages:
        ...
        await mq.ack("order.created", "order_processors", msg["message_id"])
"""

import json
from typing import Any

import redis.asyncio as aioredis
from loguru import logger

from app.config import settings


class MessageQueue:
    """基于 Redis Stream 的轻量消息队列."""

    def __init__(self):
        self._client: aioredis.Redis | None = None

    @property
    def enabled(self) -> bool:
        """消息队列是否启用."""
        return bool(settings.MQ_ENABLED)

    def _stream_key(self, topic: str) -> str:
        """拼接 stream key: prefix + topic."""
        return f"{settings.MQ_REDIS_STREAM_PREFIX}{topic}"

    async def _get_client(self) -> aioredis.Redis:
        """懒加载异步 Redis 客户端 (单例).

        优先使用 REDIS_URL 完整连接串, 否则使用分项配置.
        """
        if self._client is None:
            if settings.REDIS_URL:
                self._client = aioredis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
            else:
                self._client = aioredis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    password=settings.REDIS_PASSWORD or None,
                    db=settings.REDIS_DB,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
        return self._client

    async def publish(self, topic: str, message: dict) -> str | None:
        """发布消息到 stream.

        Args:
            topic: 主题名 (会自动加前缀 settings.MQ_REDIS_STREAM_PREFIX)
            message: 消息体 (dict, 会被 JSON 序列化存入 stream field "data")

        Returns:
            消息 ID (如 "1234567890-0"), 未启用或失败时返回 None
        """
        if not self.enabled:
            return None
        try:
            client = await self._get_client()
            stream_key = self._stream_key(topic)
            payload = json.dumps(message, ensure_ascii=False, default=str)
            message_id = await client.xadd(stream_key, {"data": payload})
            logger.debug(f"[MQ] publish -> {stream_key} msg_id={message_id}")
            return message_id
        except Exception as e:
            logger.warning(f"[MQ] publish failed topic={topic}: {e}")
            return None

    async def consume(
        self,
        topic: str,
        group: str,
        consumer: str,
        count: int = 10,
    ) -> list[dict[str, Any]]:
        """从消费者组读取消息 (不会自动 ack, 需调用 ack 确认).

        Args:
            topic: 主题名
            group: 消费者组名
            consumer: 消费者名
            count: 最多读取条数

        Returns:
            消息列表, 每条形如:
            {"message_id": "...", "fields": {...}, "data": <原始 dict>}
            未启用或出错时返回空列表
        """
        if not self.enabled:
            return []
        try:
            client = await self._get_client()
            stream_key = self._stream_key(topic)
            resp = await client.xreadgroup(
                groupname=group,
                consumername=consumer,
                streams={stream_key: ">"},
                count=count,
                block=0,
            )
            results: list[dict[str, Any]] = []
            for _stream, messages in resp:
                for message_id, fields in messages:
                    data_raw = fields.get("data", "{}") if isinstance(fields, dict) else "{}"
                    try:
                        data = json.loads(data_raw)
                    except (TypeError, ValueError):
                        data = data_raw
                    results.append({
                        "message_id": message_id,
                        "fields": fields,
                        "data": data,
                    })
            logger.debug(f"[MQ] consume <- {stream_key} group={group} count={len(results)}")
            return results
        except Exception as e:
            logger.warning(f"[MQ] consume failed topic={topic} group={group}: {e}")
            return []

    async def ack(self, topic: str, group: str, message_id: str) -> bool:
        """确认消息已处理 (从 PEL 中移除).

        Args:
            topic: 主题名
            group: 消费者组名
            message_id: 消息 ID

        Returns:
            是否成功
        """
        if not self.enabled:
            return False
        try:
            client = await self._get_client()
            stream_key = self._stream_key(topic)
            await client.xack(stream_key, group, message_id)
            logger.debug(f"[MQ] ack {stream_key} group={group} msg_id={message_id}")
            return True
        except Exception as e:
            logger.warning(f"[MQ] ack failed topic={topic} msg_id={message_id}: {e}")
            return False

    async def create_group(self, topic: str, group: str, start_id: str = "0") -> bool:
        """创建消费者组 (已存在则忽略 BUSYGROUP 错误).

        Args:
            topic: 主题名
            group: 消费者组名
            start_id: 起始 ID, 默认 "0" (从头消费); "$" 表示只消费新消息

        Returns:
            是否成功 (组已存在也算成功)
        """
        if not self.enabled:
            return False
        try:
            client = await self._get_client()
            stream_key = self._stream_key(topic)
            try:
                await client.xgroup_create(stream_key, group, id=start_id, mkstream=True)
                logger.info(f"[MQ] group created: {group} on {stream_key}")
            except aioredis.ResponseError as e:
                if "BUSYGROUP" in str(e):
                    logger.debug(f"[MQ] group already exists: {group} on {stream_key}")
                else:
                    raise
            return True
        except Exception as e:
            logger.warning(f"[MQ] create_group failed topic={topic} group={group}: {e}")
            return False

    async def close(self) -> None:
        """关闭 Redis 连接 (应用退出时调用)."""
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception as e:
                logger.debug(f"[MQ] close client error: {e}")
            finally:
                self._client = None


# 全局实例
mq = MessageQueue()

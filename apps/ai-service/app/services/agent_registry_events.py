# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · 注册表失效订阅（P2-03 / P2-04 / P2-09）。

API 写成功后向 `ihui:agent-registry:v1:changed` 发 `{version, ids, action}`。
本模块只负责“收消息 → 校验 → 交给 provider 按版本重拉”，不碰业务判定；
Redis 断线时退回 TTL 轮询，不阻塞请求路径。
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncIterator, Callable
from typing import Any

from .agent_definition_provider import AgentDefinitionProvider

logger = logging.getLogger(__name__)

AGENT_REGISTRY_CHANNEL = "ihui:agent-registry:v1:changed"


class RegistryInvalidationListener:
    """一个进程一个监听器；provider 是请求级对象时，应由调用方为每个用户各建一个。"""

    def __init__(
        self,
        provider: AgentDefinitionProvider,
        *,
        redis_url: str,
        channel: str = AGENT_REGISTRY_CHANNEL,
        redis_factory: Callable[[str], Any] | None = None,
    ) -> None:
        self._provider = provider
        self._redis_url = redis_url
        self._channel = channel
        self._redis_factory = redis_factory
        self._task: asyncio.Task[None] | None = None
        self._redis: Any = None
        self._pubsub: Any = None

    async def handle_message(self, raw: str | bytes) -> bool:
        """返回 True 表示真的重拉了；坏消息/低版本都返回 False。"""
        try:
            payload = json.loads(raw)
            version = int(payload["version"])
            ids = payload.get("ids") if isinstance(payload.get("ids"), list) else []
        except (TypeError, ValueError, KeyError, json.JSONDecodeError) as exc:
            logger.warning("[agent-registry] 忽略非法失效消息: %s (%s)", raw, exc)
            return False

        changed = [str(item) for item in ids]
        try:
            applied = await self._provider.apply_invalidation(version, changed)
        except Exception as exc:  # noqa: BLE001 -- 重拉失败不能弄死订阅循环
            logger.warning("[agent-registry] 失效后重拉失败 version=%s: %s", version, exc)
            return False
        return applied

    async def start(self) -> None:
        if self._task is not None:
            return
        if not self._redis_url:
            logger.warning("[agent-registry] 未配置 Redis，跳过失效订阅，按 TTL 轮询")
            return
        self._task = asyncio.create_task(self._run(), name="agent-registry-invalidation")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(Exception):
                await self._task
            self._task = None
        if self._pubsub is not None:
            with contextlib.suppress(Exception):
                await self._pubsub.unsubscribe(self._channel)
            with contextlib.suppress(Exception):
                await self._pubsub.aclose()
            self._pubsub = None
        if self._redis is not None:
            with contextlib.suppress(Exception):
                await self._redis.aclose()
            self._redis = None

    async def _run(self) -> None:
        if self._redis_factory is not None:
            self._redis = self._redis_factory(self._redis_url)
        else:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(self._redis_url, decode_responses=True)

        while True:
            try:
                self._pubsub = self._redis.pubsub()
                await self._pubsub.subscribe(self._channel)
                logger.info("[agent-registry] 已订阅失效频道 %s", self._channel)
                async for message in self._pubsub.listen():
                    if message.get("type") != "message":
                        continue
                    await self.handle_message(message.get("data") or "")
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 -- 断线重连是订阅器职责
                logger.warning("[agent-registry] 失效订阅断线，5s 后重连: %s", exc)
                await asyncio.sleep(5)


async def consume_messages(
    pubsub: AsyncIterator[dict[str, Any]], listener: RegistryInvalidationListener
) -> int:
    """给测试/嵌入使用的消费循环；返回已应用条数。"""
    applied = 0
    async for message in pubsub:
        if message.get("type") == "message" and await listener.handle_message(message.get("data") or ""):
            applied += 1
    return applied

"""IM 桥接服务(2026-07-31 立)。

消费 Redis `im:inbound:<userId>:<platform>` 队列消息 → 调 LLM 生成回复 →
调 apps/api 的 POST /api/im-gateway/send 回复到 IM 平台,
实现"IM 端发消息 → AI 自动回复"闭环。

设计参考:
- model_sync.py:单例服务 + lifespan 集成 + 后台任务模式
- vector_memory.py:Redis 异步客户端 + 降级处理模式
- im-gateway.ts(apps/api):Redis 队列格式 + ImInboundMessage 字段契约

Redis 队列格式(与 apps/api/src/routes/im-gateway.ts 同源):
- key: `im:inbound:<userId>:<platform>`
- value: JSON 字符串数组,ImInboundMessage[]
- 写入方:apps/api webhook 路由(push 到末尾,保留最近 100 条)
- 消费方(本服务):取出最后一条处理,留下前面的(不破坏 audit 历史)
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from ..core.config import settings

logger = logging.getLogger(__name__)

# Redis 入站消息 key 前缀(与 apps/api/src/routes/im-gateway.ts 一致)
_INBOUND_KEY_PREFIX = "im:inbound:"

# SCAN 批次大小(每次扫描 key 数量)
_SCAN_COUNT = 100

# 消费循环间隔(秒)— 空队列时 sleep 时长
_CONSUME_INTERVAL_S = 1.0

# LLM 调用超时(秒)
_LLM_TIMEOUT_S = 30.0


class ImBridgeService:
    """IM 桥接服务(单例)。

    生命周期:
    - main.py lifespan 启动时调用 initialize():启动后台消费任务
    - main.py lifespan 关闭时调用 shutdown():取消消费任务
    - Redis 不可用时不阻塞 lifespan(降级为 no-op,日志警告)

    线程安全:单实例单任务,无并发竞争。

    消费流程:
    1. SCAN 匹配 `im:inbound:*` 所有 key(游标式迭代,不阻塞 Redis)
    2. 对每个 key:读取 JSON 数组 → 取最后一条消息 → 留下前面的(set 回去)
    3. 调 LLM 生成回复(用 llm_gateway.complete,自动 stub 降级 + provider 路由)
    4. 调 apps/api POST /api/im-gateway/send 回复到 IM 平台
    5. 失败时记录日志,不抛异常(避免阻塞消费循环)
    """

    def __init__(self) -> None:
        self._consume_task: asyncio.Task[None] | None = None
        self._initialized = False
        self._redis: Any = None  # redis.asyncio.Redis 实例,惰性初始化

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """启动时调用:启动后台消费任务。

        幂等:多次调用只初始化一次。
        不阻塞:后台异步执行,FastAPI 启动立即返回。
        Redis 不可用时降级为 no-op(日志警告,不抛异常,不阻塞 lifespan)。
        """
        if self._initialized:
            return
        try:
            await self._init_redis()
        except Exception as e:
            logger.warning(
                "[ImBridge] Redis 初始化失败,IM 桥接服务降级为 no-op: %s", e
            )
            return
        self._initialized = True
        self._consume_task = asyncio.create_task(self._consume_loop())
        logger.info("[ImBridge] 后台消费任务已启动(扫描 %s*)", _INBOUND_KEY_PREFIX)

    async def shutdown(self) -> None:
        """关闭时调用:取消消费任务 + 关闭 Redis 连接。"""
        if self._consume_task is not None and not self._consume_task.done():
            self._consume_task.cancel()
            try:
                await self._consume_task
            except asyncio.CancelledError:
                pass
            self._consume_task = None
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except Exception:
                pass
            self._redis = None
        self._initialized = False

    async def _init_redis(self) -> None:
        """惰性初始化 Redis 异步客户端(参考 vector_memory._get_redis 模式)。

        Raises:
            RuntimeError: settings.redis_url 为空。
            Exception: Redis 连接失败(ping 超时/认证失败等)。
        """
        import redis.asyncio as aioredis

        url = getattr(settings, "redis_url", "") or ""
        if not url:
            raise RuntimeError("settings.redis_url 为空,无法连接 Redis")
        # protocol=2 强制 RESP2,避免 redis-py 8.x 默认发 HELLO 命令协商 RESP3
        # (本地 Memurai 4.x / Redis 5.x 不支持 HELLO,会报 unknown command `HELLO')
        client = aioredis.from_url(url, decode_responses=True, protocol=2)
        await client.ping()
        self._redis = client

    # ------------------------------------------------------------------
    # 消费循环
    # ------------------------------------------------------------------

    async def _consume_loop(self) -> None:
        """定时消费循环(每轮 SCAN + 处理 + sleep)。

        异常处理:单轮异常只 warning,不退出循环(下一轮重试)。
        CancelledError 重新抛出(配合 shutdown 取消任务)。
        """
        while True:
            try:
                await self._scan_and_consume()
            except asyncio.CancelledError:
                logger.info("[ImBridge] consume loop cancelled")
                raise
            except Exception as e:
                logger.warning("[ImBridge] 消费循环异常(忽略,下一轮重试): %s", e)
            await asyncio.sleep(_CONSUME_INTERVAL_S)

    async def _scan_and_consume(self) -> None:
        """单轮:SCAN 所有 im:inbound:* key,处理每个队列的最后一条消息。"""
        if self._redis is None:
            return
        cursor: int = 0
        processed = 0
        while True:
            cursor_raw, keys = await self._redis.scan(
                cursor=cursor,
                match=f"{_INBOUND_KEY_PREFIX}*",
                count=_SCAN_COUNT,
            )
            # redis-py 返回 int cursor;redis.asyncio 同样
            cursor = int(cursor_raw)
            for key in keys:
                if not isinstance(key, str):
                    continue
                msg = await self._pop_last_message(key)
                if msg is None:
                    continue
                try:
                    await self._handle_message(key, msg)
                    processed += 1
                except Exception as e:
                    logger.warning(
                        "[ImBridge] 处理消息失败(key=%s): %s", key, e
                    )
            if cursor == 0:
                break
        if processed > 0:
            logger.info("[ImBridge] 本轮处理 %d 条入站消息", processed)

    async def _pop_last_message(self, key: str) -> dict[str, Any] | None:
        """从队列取出最后一条消息(留下前面的,不破坏 audit 历史)。

        Redis 中存储为 JSON 字符串数组(ImInboundMessage[]),
        单实例下无并发 race,直接 get + set 即可。
        空列表删除 key 避免脏数据。
        """
        try:
            raw = await self._redis.get(key)
            if not raw:
                return None
            try:
                data = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                logger.warning("[ImBridge] 队列 %s JSON 解析失败,跳过", key)
                return None
            if not isinstance(data, list) or not data:
                return None
            last = data.pop()
            if data:
                await self._redis.set(key, json.dumps(data, ensure_ascii=False))
            else:
                await self._redis.delete(key)
            if not isinstance(last, dict):
                return None
            return last
        except Exception as e:
            logger.warning("[ImBridge] 读取队列 %s 失败: %s", key, e)
            return None

    # ------------------------------------------------------------------
    # 消息处理
    # ------------------------------------------------------------------

    async def _handle_message(self, queue_key: str, inbound: dict[str, Any]) -> None:
        """处理单条入站消息:LLM 生成回复 → 调 im-gateway/send。

        Args:
            queue_key: Redis key,格式 `im:inbound:<userId>:<platform>`,
                       用于解析 userId 和 platform。
            inbound: ImInboundMessage 字典(与 apps/api 的 TS 类型同源)。

        失败时记录日志,不抛异常(由调用方 _scan_and_consume 兜底)。
        """
        # 1. 从 key 解析 userId 和 platform
        # key 格式:im:inbound:<userId>:<platform>
        parts = queue_key.split(":")
        if len(parts) < 4:
            logger.warning("[ImBridge] 队列 key 格式异常: %s", queue_key)
            return
        user_id = parts[2]
        platform = ":".join(parts[3:])  # platform 理论上不含冒号,容错处理

        # 2. 解析消息字段(参考 ImInboundMessage TS 类型)
        text = inbound.get("text") or ""
        chat_id = inbound.get("chatId") or inbound.get("chat_id") or ""
        if not text or not chat_id:
            logger.debug(
                "[ImBridge] 跳过无文本或无 chatId 的消息(key=%s)", queue_key
            )
            return

        # 3. 调 LLM 生成回复(延迟 import 避免顶部 import 触发 litellm 重加载)
        # 用项目 llm_gateway:自动 stub 降级 + provider 路由 + fallback 容错
        from ..core.llm_gateway import llm_gateway

        prompt = (
            f"用户在 IM 平台({platform})发来消息:{text}\n"
            "请作为 AI 助手回复(简洁友好,不超过 200 字)。"
        )
        messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
        try:
            result = await asyncio.wait_for(
                llm_gateway.complete(messages, owner_uuid=user_id),
                timeout=_LLM_TIMEOUT_S,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "[ImBridge] LLM 调用超时(%ds,key=%s)", _LLM_TIMEOUT_S, queue_key
            )
            return
        except Exception as e:
            logger.warning("[ImBridge] LLM 调用失败(key=%s): %s", queue_key, e)
            return

        reply_text = result.get("content") or ""
        if not reply_text or result.get("error"):
            logger.warning(
                "[ImBridge] LLM 返回空或错误(key=%s, error=%s)",
                queue_key,
                result.get("error_message") or result.get("error"),
            )
            return

        # 4. 调 apps/api POST /api/im-gateway/send 回复到 IM 平台
        # 复用 api_client 的 httpx.AsyncClient(mTLS 感知),避免新建连接池
        send_url = f"{settings.api_service_url}/api/im-gateway/send"
        payload: dict[str, Any] = {
            "platform": platform,
            "chatId": chat_id,
            "messageType": "text",
            "text": reply_text,
        }
        headers: dict[str, str] = {"Content-Type": "application/json"}
        # 内部服务鉴权:对齐 apps/api internal-service-token 契约
        # x-internal-service-token = AI_CALLBACK_SECRET(与 config.AI_CALLBACK_SECRET 共用)
        # x-user-id = 消息归属用户(适配器所有者,UUID 格式)
        if settings.ai_callback_secret:
            headers["x-internal-service-token"] = settings.ai_callback_secret
            headers["x-user-id"] = str(user_id)

        try:
            from .api_client import get_api_client

            client = get_api_client()
            resp = await client.post(send_url, json=payload, headers=headers)
        except Exception as e:
            logger.warning(
                "[ImBridge] 调用 im-gateway/send 失败(url=%s): %s", send_url, e
            )
            return

        if resp.status_code >= 400:
            logger.warning(
                "[ImBridge] im-gateway/send 返回 %d: %s",
                resp.status_code,
                resp.text[:200],
            )
            return

        logger.info(
            "[ImBridge] 已回复 IM 消息(platform=%s, chatId=%s, reply_len=%d)",
            platform,
            chat_id,
            len(reply_text),
        )


# 模块级单例
im_bridge_service = ImBridgeService()

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
- 消费方(本服务):**先读最后一条 → 交业务 → 业务成功才把它移出队列**(G-815414)

投递语义(G-815414,2026-10-02 改):
旧序是"pop + set/delete 再交业务",于是"LLM 调用失败"、"发送失败"、"JSON 解析失败"
在账面与日志之外全部等价于**消息消失**;而 `im-gateway.ts:1216-1227` 落库+入队后即回
`received:true`,没有任何消费确认。上游同族纪律是"业务不成功就不提交游标/不 ACK"
(`weixinChannelRuntime.ts:159-163`、`channelRuntime.ts:27-37`、`botsService.ts:2704-2718`)。
所以本服务改成 **at-least-once**:未成功的消息留在活动队列里等下一轮重投,连续失败达
`_MAX_DELIVERY_ATTEMPTS` 次才移出到死信 key(仍在 Redis 里,可人工重投,不算丢)。
"读不到"与"队列为空"是两种结论,由 `QueueStatus` 四态 + `metrics_snapshot()` 计数分开,
任何一种"取不到/判不出"都必须留下可观测的一格,不得静默 continue。

死信 key:`im:bridge:dead:<userId>:<platform>` — 刻意**不**挂在 `im:inbound:` 之下,
否则 `_scan_and_consume` 的 `im:inbound:*` SCAN 会把它反复捞回成热循环。
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from ..core.config import settings

logger = logging.getLogger(__name__)

# Redis 入站消息 key 前缀(与 apps/api/src/routes/im-gateway.ts 一致)
_INBOUND_KEY_PREFIX = "im:inbound:"

# 死信 key 前缀(见模块 docstring:必须落在 SCAN 匹配面之外)
_DEAD_KEY_PREFIX = "im:bridge:dead:"

# SCAN 批次大小(每次扫描 key 数量)
_SCAN_COUNT = 100

# 消费循环间隔(秒)— 空队列时 sleep 时长
_CONSUME_INTERVAL_S = 1.0

# LLM 调用超时(秒)
_LLM_TIMEOUT_S = 30.0

# 同一条消息最多投递几次;达到上限即移入死信 key(可人工重投)。
# 没有这一档,"永久性失败"(路由 4xx / key 格式坏 / provider 长期不可用)会把
# LLM 打成每秒重试的热循环 —— 那比原来的"静默丢一条"更坏。
_MAX_DELIVERY_ATTEMPTS = 3

# 投递次数表容量上限(按插入顺序淘汰),防止长跑进程无界增长
_MAX_ATTEMPT_TRACKED = 256

# 死信列表长度上限(与写入方"保留最近 100 条"同档)
_DEAD_LIST_MAX = 100


class QueueStatus(StrEnum):
    """队列读取结论 —— 四态**不得并桶**。

    "读不到"(ERROR)/ "内容坏掉"(INVALID)一旦被读成"队列为空"(EMPTY),
    上游就无从区分"没什么要做"与"有一批消息正在静默消失",这正是 G-815414 的病灶。
    """

    EMPTY = "empty"  # 键不存在 / 空列表:本来就没什么可处理
    READY = "ready"  # 取到可处理的消息(**尚未**从队列移除)
    INVALID = "invalid"  # 内容不可解析或结构不对:计数 + 告警
    ERROR = "error"  # Redis 读取本身失败:计数 + 告警


@dataclass(frozen=True)
class PeekedMessage:
    """`_peek_last_message` 的结论。

    `message` 只在 `status is QueueStatus.READY` 时非空,且此时它**仍在队列里**
    (业务成功后由 `_commit_removal` 按身份摘除)。
    """

    status: QueueStatus
    message: dict[str, Any] | None = None


def _canonical(item: Any) -> str:
    """把队列元素规范化成可逐字比对的字符串(用于"按身份移除那一条")。"""
    try:
        return json.dumps(item, sort_keys=True, ensure_ascii=False, default=str)
    except (TypeError, ValueError):  # pragma: no cover - 极端不可序列化对象
        return repr(item)


class ImBridgeService:
    """IM 桥接服务(单例)。

    生命周期:
    - main.py lifespan 启动时调用 initialize():启动后台消费任务
    - main.py lifespan 关闭时调用 shutdown():取消消费任务
    - Redis 不可用时不阻塞 lifespan(降级为 no-op,日志警告)

    线程安全:单实例单任务,无并发竞争。

    消费流程(G-815414 后):
    1. SCAN 匹配 `im:inbound:*` 所有 key(游标式迭代,不阻塞 Redis)
    2. 对每个 key:**peek** 最后一条(不改动队列)
    3. 调 LLM 生成回复(用 llm_gateway.complete,自动 stub 降级 + provider 路由)
    4. 调 apps/api POST /api/im-gateway/send 回复到 IM 平台
    5. **只有第 3、4 步都成功**才 commit(把那一条从队列里摘掉);
       任何失败路径消息都留在原队列里等下一轮重投,连续失败达上限则进死信 key
    6. 所有"取不到/判不出/没摘掉"的分支都计入 `metrics_snapshot()` 并大声写日志,
       绝不静默 continue
    """

    # 计入「取不到 / 坏内容」的指标族 —— 用于轮级告警,严禁与 EMPTY 混算
    _UNREADABLE_METRICS: tuple[str, ...] = (
        "parse_failures",
        "invalid_payloads",
        "invalid_items",
        "read_errors",
    )

    def __init__(self) -> None:
        self._consume_task: asyncio.Task[None] | None = None
        self._initialized = False
        self._redis: Any = None  # redis.asyncio.Redis 实例,惰性初始化
        # 可观测计数(见 QueueStatus 的"四态不得并桶"):键名固定,只增不减
        self._metrics: dict[str, int] = {}
        # (queue key, 消息身份) → 已投递次数(进程内;重启后重新计,方向是多投不是丢)
        self._attempts: dict[str, int] = {}

    # ------------------------------------------------------------------
    # 可观测出口
    # ------------------------------------------------------------------

    def metrics_snapshot(self) -> dict[str, int]:
        """当前计数副本(供健康检查/监控/测试读取)。

        本票**没有**动任何路由:这一格目前只有测试与进程内读取,
        对外暴露属另票(见交付报告的"未闭环")。
        """
        return dict(self._metrics)

    def _bump(self, name: str) -> int:
        """计一格并返回累计值(便于把计数写进日志行,免"报了但不知道多严重")。"""
        value = self._metrics.get(name, 0) + 1
        self._metrics[name] = value
        return value

    def _attempt_key(self, key: str, message: dict[str, Any]) -> str:
        return f"{key}\x1f{_canonical(message)}"

    def _remember_attempt(self, ident: str, attempts: int) -> None:
        self._attempts[ident] = attempts
        # 按插入顺序淘汰:长跑进程不得因消息流水无界增长
        while len(self._attempts) > _MAX_ATTEMPT_TRACKED:
            oldest = next(iter(self._attempts))
            del self._attempts[oldest]

    def _forget_attempt(self, ident: str) -> None:
        self._attempts.pop(ident, None)

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
            with contextlib.suppress(asyncio.CancelledError):
                await self._consume_task
            self._consume_task = None
        if self._redis is not None:
            with contextlib.suppress(Exception):
                await self._redis.aclose()
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
        client = aioredis.from_url(url, decode_responses=True, protocol=2, socket_connect_timeout=2)
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
        """单轮:SCAN 所有 im:inbound:* key,对每个队列走 peek → 处理 → 成功才提交。

        核心不变量(G-815414):**未成功的消息不得被摘走**。
        """
        if self._redis is None:
            return
        unreadable_before = self._unreadable_count()
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
                if await self._consume_one(key):
                    processed += 1
            if cursor == 0:
                break
        if processed > 0:
            logger.info("[ImBridge] 本轮处理 %d 条入站消息", processed)
        unreadable_delta = self._unreadable_count() - unreadable_before
        if unreadable_delta > 0:
            # 轮级也喊一次:这些结论绝不可被读成"队列为空"
            logger.error(
                "[ImBridge] 本轮 %d 次「取不到/坏内容」结论(累计 %d,计 %s)—— "
                "它们与「队列为空」不是一回事",
                unreadable_delta,
                self._unreadable_count(),
                {k: self._metrics.get(k, 0) for k in self._UNREADABLE_METRICS},
            )

    async def _consume_one(self, key: str) -> bool:
        """投递某队列的最后一条;返回 True 仅当"业务成功且已从队列摘除"。"""
        peeked = await self._peek_last_message(key)
        message = peeked.message
        if peeked.status is not QueueStatus.READY or message is None:
            # EMPTY / INVALID / ERROR 三态各自成格(_peek_last_message 已计数并告警)
            return False

        ident = self._attempt_key(key, message)
        attempts = self._attempts.get(ident, 0) + 1
        self._remember_attempt(ident, attempts)

        delivered: bool | None = None
        try:
            delivered = await self._handle_message(key, message)
        except asyncio.CancelledError:
            # 取消不是投递失败:消息原样留在队列,下一轮/重启后重投
            raise
        except Exception as e:
            delivered = False
            logger.error(
                "[ImBridge] 处理消息抛出异常(key=%s,attempt=%d/%d): %s —— 消息留在队列待重投",
                key,
                attempts,
                _MAX_DELIVERY_ATTEMPTS,
                e,
            )

        # 只有"显式 False"与"抛错"算投递失败;None 兼容既有测试替身(它们不返回布尔)
        if delivered is not False:
            if await self._commit_removal(key, message):
                self._forget_attempt(ident)
                return True
            return False

        self._bump("delivery_failures")
        if attempts >= _MAX_DELIVERY_ATTEMPTS:
            if await self._park_dead_message(key, message, "delivery_failed", attempts):
                self._forget_attempt(ident)
        else:
            logger.warning(
                "[ImBridge] 投递失败,消息留在队列待重投(key=%s,attempt=%d/%d)",
                key,
                attempts,
                _MAX_DELIVERY_ATTEMPTS,
            )
        return False

    # ------------------------------------------------------------------
    # 队列原语:peek(不改队列) / commit(成功才摘) / pop(旧语义,兼容用)
    # ------------------------------------------------------------------

    async def _peek_last_message(self, key: str) -> PeekedMessage:
        """读出队列最后一条,**不把它摘走**(队列内容原样留在 Redis)。

        四态结论(EMPTY / READY / INVALID / ERROR)分别计数,不得并桶。
        就地清理的只有两条"永远不会成为可处理消息"的脏数据:
        - 空列表 `[]` → 删 key(对齐既有行为,2026-08-12 修的 docstring 意图)
        - 尾部元素不是对象 → 计数 + 告警后摘掉该元素(留着它等于毒丸,每轮白扫)
        """
        try:
            raw = await self._redis.get(key)
            if not raw:
                return PeekedMessage(QueueStatus.EMPTY)
            try:
                data = json.loads(raw)
            except (json.JSONDecodeError, TypeError) as e:
                n = self._bump("parse_failures")
                logger.error(
                    "[ImBridge] 队列 %s JSON 解析失败(计 parse_failures=%d): %s —— "
                    "这不是空队列,原始内容保留待处置,消息不得算已消费",
                    key,
                    n,
                    e,
                )
                return PeekedMessage(QueueStatus.INVALID)
            if not isinstance(data, list):
                n = self._bump("invalid_payloads")
                logger.error(
                    "[ImBridge] 队列 %s 内容不是数组(计 invalid_payloads=%d,实得 %s)—— "
                    "不按空队列处理",
                    key,
                    n,
                    type(data).__name__,
                )
                return PeekedMessage(QueueStatus.INVALID)
            if not data:
                # 空列表脏数据:删除 key 避免累积(对齐 docstring 意图,2026-08-12 修)
                await self._redis.delete(key)
                return PeekedMessage(QueueStatus.EMPTY)
            last = data[-1]
            if not isinstance(last, dict):
                n = self._bump("invalid_items")
                logger.error(
                    "[ImBridge] 队列 %s 尾部元素不是对象(计 invalid_items=%d),已摘除该元素:"
                    "它永远不可能成为可处理消息,留在队里等于毒丸",
                    key,
                    n,
                )
                await self._write_back(key, data[:-1])
                return PeekedMessage(QueueStatus.INVALID)
            return PeekedMessage(QueueStatus.READY, dict(last))
        except Exception as e:
            n = self._bump("read_errors")
            logger.error(
                "[ImBridge] 读取队列 %s 失败(计 read_errors=%d): %s —— "
                "「读不到」不得被上游读成「队列为空」",
                key,
                n,
                e,
            )
            return PeekedMessage(QueueStatus.ERROR)

    async def _commit_removal(self, key: str, message: dict[str, Any]) -> bool:
        """业务成功后才把这一条移出队列(重读 + 按身份摘除**那一条**)。

        重读而不是复用 peek 时的整串:处理期间 apps/api 可能又 push 了新消息,
        拿旧快照整串写回会把别人的新消息一起抹掉。
        返回 False = 没提交成功,消息仍在队列里,下一轮重投。
        """
        try:
            raw = await self._redis.get(key)
            if raw is None:
                n = self._bump("commit_gone")
                logger.warning(
                    "[ImBridge] 提交时队列 %s 已不存在(计 commit_gone=%d)—— "
                    "无内容可摘,如实报告而不是静默当成功",
                    key,
                    n,
                )
                return True
            current = json.loads(raw)
            if not isinstance(current, list):
                n = self._bump("commit_errors")
                logger.error(
                    "[ImBridge] 提交时队列 %s 内容已不是数组(计 commit_errors=%d),放弃摘除,下轮重投",
                    key,
                    n,
                )
                return False
            index = self._index_of_identity(current, message)
            if index is None:
                n = self._bump("commit_misses")
                logger.error(
                    "[ImBridge] 提交时找不到刚处理的那条消息(key=%s,计 commit_misses=%d)"
                    " —— 可能已被写入方裁剪;如实计数,不冒充已提交",
                    key,
                    n,
                )
                return True
            del current[index]
            await self._write_back(key, current)
            self._bump("committed")
            return True
        except Exception as e:
            n = self._bump("commit_errors")
            logger.error(
                "[ImBridge] 提交摘除失败(key=%s,计 commit_errors=%d): %s —— 消息留在队列待重投",
                key,
                n,
                e,
            )
            return False

    async def _park_dead_message(
        self, key: str, message: dict[str, Any], reason: str, attempts: int
    ) -> bool:
        """投递次数达上限:先落死信 key,再摘活动队列(顺序反了就等于"吃掉消息")。

        死信写成功而摘除失败时,该条会同时存在于两处并被重投(at-least-once),
        由 commit_errors 点名 —— 宁可重投,不可静默丢。
        """
        dead_key = _DEAD_KEY_PREFIX + key[len(_INBOUND_KEY_PREFIX) :]
        entry: dict[str, Any] = {
            "queueKey": key,
            "reason": reason,
            "attempts": attempts,
            "message": message,
        }
        try:
            existing_raw = await self._redis.get(dead_key)
            items: list[Any] = []
            if existing_raw:
                parsed = json.loads(existing_raw)
                items = parsed if isinstance(parsed, list) else [parsed]
            items.append(entry)
            if len(items) > _DEAD_LIST_MAX:
                items = items[-_DEAD_LIST_MAX:]
            await self._redis.set(dead_key, json.dumps(items, ensure_ascii=False))
        except Exception as e:
            n = self._bump("dead_letter_errors")
            logger.error(
                "[ImBridge] 死信写入失败(%s,计 dead_letter_errors=%d): %s —— "
                "消息**留在活动队列**继续重投,不算已处理",
                dead_key,
                n,
                e,
            )
            return False

        n = self._bump("dead_lettered")
        logger.error(
            "[ImBridge] 消息连续 %d 次投递失败,已移入死信 %s(计 dead_lettered=%d,可人工重投): %s",
            attempts,
            dead_key,
            n,
            _canonical(message)[:200],
        )
        await self._commit_removal(key, message)
        return True

    async def _write_back(self, key: str, remaining: list[Any]) -> None:
        """把剩余列表写回队列;为空则删 key(与原实现同形态)。"""
        if remaining:
            await self._redis.set(key, json.dumps(remaining, ensure_ascii=False))
        else:
            await self._redis.delete(key)

    @staticmethod
    def _index_of_identity(items: list[Any], message: dict[str, Any]) -> int | None:
        """从右往左找与刚处理那条**逐字相同**的元素下标(读的就是最右那一条)。"""
        target = _canonical(message)
        for index in range(len(items) - 1, -1, -1):
            if _canonical(items[index]) == target:
                return index
        return None

    def _unreadable_count(self) -> int:
        """「取不到 / 坏内容」四格的累计数 —— 与 EMPTY 严格分开的一条可观测面。"""
        return sum(self._metrics.get(name, 0) for name in self._UNREADABLE_METRICS)

    # ------------------------------------------------------------------
    # 消息处理
    # ------------------------------------------------------------------

    async def _handle_message(self, queue_key: str, inbound: dict[str, Any]) -> bool:
        """处理单条入站消息:LLM 生成回复 → 调 im-gateway/send。

        Args:
            queue_key: Redis key,格式 `im:inbound:<userId>:<platform>`,
                       用于解析 userId 和 platform。
            inbound: ImInboundMessage 字典(与 apps/api 的 TS 类型同源)。

        Returns(G-815414 的关键契约):
            True  → 投递完成,调用方**可以**把这条消息从队列摘走;
            False → 投递未成功(异常/超时/空回复/发送失败/路由 4xx/5xx),
                    调用方**不得**摘走,消息留在队列等下一轮重投。
            本方法自身不抛异常(取消除外),失败一律靠返回值传达 ——
            把失败折成 None 就是"读不到被读成队列为空"的同一条病灶。
        """
        # 1. 从 key 解析 userId 和 platform
        # key 格式:im:inbound:<userId>:<platform>
        parts = queue_key.split(":")
        if len(parts) < 4:
            # 这种 key 永远处理不了:回 False 走重投→达上限进死信,而不是静默摘走
            logger.error("[ImBridge] 队列 key 格式异常,本次投递未成功: %s", queue_key)
            return False
        user_id = parts[2]
        platform = ":".join(parts[3:])  # platform 理论上不含冒号,容错处理

        # 2. 解析消息字段(参考 ImInboundMessage TS 类型)
        text = inbound.get("text") or ""
        chat_id = inbound.get("chatId") or inbound.get("chat_id") or ""
        if not text or not chat_id:
            # 不算投递失败:这条消息本身没什么可回复,重投也永远投不出去 —— 可 ACK。
            # 但必须计入 skipped_unanswered,不得与"已回复"混在同一格里静默通过。
            self._bump("skipped_unanswered")
            logger.info(
                "[ImBridge] 跳过无文本或无 chatId 的消息(key=%s,计 skipped_unanswered=%d)",
                queue_key,
                self._metrics.get("skipped_unanswered", 0),
            )
            return True

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
        except TimeoutError:
            logger.warning(
                "[ImBridge] LLM 调用超时(%ds,key=%s)—— 未回复,消息留在队列",
                _LLM_TIMEOUT_S,
                queue_key,
            )
            return False
        except Exception as e:
            logger.warning("[ImBridge] LLM 调用失败(key=%s): %s —— 未回复,消息留在队列", queue_key, e)
            return False

        reply_text = result.get("content") or ""
        if not reply_text or result.get("error"):
            logger.warning(
                "[ImBridge] LLM 返回空或错误(key=%s, error=%s)—— 未回复,消息留在队列",
                queue_key,
                result.get("error_message") or result.get("error"),
            )
            return False

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
                "[ImBridge] 调用 im-gateway/send 失败(url=%s): %s —— 未确认送达,消息留在队列",
                send_url,
                e,
            )
            return False

        if resp.status_code >= 400:
            logger.warning(
                "[ImBridge] im-gateway/send 返回 %d: %s —— 未确认送达,消息留在队列",
                resp.status_code,
                resp.text[:200],
            )
            return False

        logger.info(
            "[ImBridge] 已回复 IM 消息(platform=%s, chatId=%s, reply_len=%d)",
            platform,
            chat_id,
            len(reply_text),
        )
        return True


# 模块级单例
im_bridge_service = ImBridgeService()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

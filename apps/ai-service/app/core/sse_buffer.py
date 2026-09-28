# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""SSE 事件缓冲区。

为 SSE 流式端点提供断线重连支持:
- 每个 task_id 维护一个有序事件列表(带自增 event_id)
- 客户端重连时通过 Last-Event-ID 获取缺失事件并重放(三态判定,见下)
- 每 task 双上限(条数 + 估算字节),溢出丢最旧并计数
- 两条到期语义: 空闲 TTL(任务结束后仍可重放的窗口) + 存活上限(活跃任务也会到期)
- 进程内内存存储(单实例足够;多实例需 Redis 替换)

三处病灶与本页的修法(2026-09-27,全部为实测确认,不是假想风险):

1. **缓冲无界**: 旧 append 只做 ``self._buffers[task_id].append(...)``,每 task 的列表
   既无条数上限也无字节上限;而 ``routers/agents.py`` 收尾那记 ``clear(task_id)`` 只在流
   正常结束时才跑到 ⇒ 一条长任务(或一次没走到 finally 的异常流)把整轮事件永久留在内存。
   现按"条数 + 估算字节"双上限**丢最旧**(最新那条才是续传需要的尾部),丢弃数累计进
   ``_dropped``,并开三个可见出口: ① ``dropped_events(task_id)`` 属性、② 每次真正丢东西时
   的 ``logger.warning``、③ 重连时 start 帧的 ``resume.dropped_events``。
   本仓铁律: 静默变短等于伪造完整性 —— 少了多少必须说出来。

2. **续传未命中即全量重放**: 旧 ``replay_after`` 在找不到 last_event_id 时"返回全部(保守
   策略)",而它自己的 docstring 承诺的是"若 task_id 不存在或已过期,返回空列表" —— 两句
   直接矛盾,且错的那句在跑: 客户端带一个已被清理/已被丢弃的陈旧 Last-Event-ID 重连,
   整段事件史会被再灌一遍,前端按 id 追加就出现"会话内容翻倍"。
   现把判定抽成三态结局 ``ReplayOutcome.status``:
   ``hit``(锚点在缓冲内 ⇒ 只给其后事件)/ ``not_resumable``(锚点被丢弃、序号越界或不属
   于本 task ⇒ 空列表 + 原因 + 丢弃数,**不再重放历史**)/ ``unknown_task``(task 不存在或
   已到期)。上层要分辨三态请用 ``replay_outcome()``;``replay_after()`` 签名不变,只作为
   "命中事件"的投影保留,以免弄坏既有调用方。

3. **TTL 被每次 append 无限续期**: 旧 ``_timestamps`` 记的是"最后更新时间",清理判据却是
   ``now - ts > ttl`` ⇒ 只要任务还在发事件就永不过期,活跃长任务的整轮事件全留在内存。
   现拆成两个锚点: ``_started``(首事件时间,供**存活上限** ``max_lifetime_seconds`` 用,
   活跃任务照样到期)与 ``_timestamps``(最后活动时间,供**空闲 TTL** 用 —— 保留原意:
   任务结束后 ttl 秒内仍可重放)。任一到期即清理。

用法:
    buffer = SSEEventBuffer()
    eid = buffer.append("task-1", {"type": "chunk", "content": "hello"})
    outcome = buffer.replay_outcome("task-1", last_event_id)
    if outcome.status == REPLAY_HIT:
        for item in outcome.events:
            ...  # 逐帧下发
    else:
        ...      # 明确不可续传:让客户端走快照重取,而不是把历史再灌一遍
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Final

logger = logging.getLogger(__name__)

# 续传三态的唯一词汇表(上层按此分支;"空列表"不得冒充其中某一态)
REPLAY_HIT: Final[str] = "hit"
REPLAY_NOT_RESUMABLE: Final[str] = "not_resumable"
REPLAY_UNKNOWN_TASK: Final[str] = "unknown_task"

# 上限取值依据(对应病灶 1;两个数各挡一种溢出形态,缺一条都会漏整型):
# - 500 条: 一轮 AgentLoopV2 运行的事件量级 —— done 帧本身只 1 条,主要来源是
#   thinking.delta / plan.step / tool 三件套与 terminal_delta(D113 逐帧下发)。长任务
#   实测可上千条,而"断线→重连"真正需要的是秒级窗口内的尾部;500 条足够覆盖它,
#   同时把任何单 task 的列表长度钉成常数(挡的是**小而多**的事件流)。
# - 1 MiB: 真正的内存账按字节算 —— agents.py 在 2026-09-17 那笔改动里去掉了 done 帧的
#   ``[:2000]`` 截断(注释在案),一条 done / tool-result 就能是几十 KB,所以条数上限
#   挡不住体积。1 MiB/task 在几十个并发 run 的量级下是几十 MiB 上界,与 ai-service
#   其余进程内缓存同数量级(挡的是**大而少**的事件)。
DEFAULT_MAX_EVENTS_PER_TASK: Final[int] = 500
DEFAULT_MAX_BYTES_PER_TASK: Final[int] = 1024 * 1024
# 存活上限 30 分钟: 空闲 TTL(300s)兜"任务结束后还能重连"的原意,这一条兜"任务一直在
# 活动"——旧实现缺的正是这一条(病灶 3)。取值取自 AgentLoopV2 长任务的现实量级:再往上的
# run 应以 checkpoint 续跑(POST /agents/execute/resume)而不是靠 SSE 内存缓冲兜住。
DEFAULT_MAX_LIFETIME_SECONDS: Final[int] = 30 * 60

# 一帧除 data 载荷外还有 id: / event: 行与空行的开销,估算时按固定值计入。
_FRAME_OVERHEAD_BYTES: Final[int] = 64


@dataclass(frozen=True)
class _Entry:
    """缓冲区内单条事件的内部形态(对外一律经 ``_to_wire`` 投影成 {"id","event"})。"""

    seq: int
    id: str
    event: dict[str, Any]
    ts: float
    size: int


@dataclass(frozen=True)
class ReplayOutcome:
    """续传判定的三态结局(病灶 2)。"""

    status: str
    events: list[dict[str, Any]] = field(default_factory=list)
    dropped: int = 0
    reason: str | None = None

    @property
    def resumable(self) -> bool:
        """只有锚点真在缓冲内才算可续传。"""
        return self.status == REPLAY_HIT

    @property
    def truncated(self) -> bool:
        """该 task 至今是否丢过事件(丢了 ≠ 不可续传,但必须让上层知道)。"""
        return self.dropped > 0


def _to_wire(entry: _Entry) -> dict[str, Any]:
    """对外形态:只暴露 id 与事件载荷(内部 seq/size/ts 不外泄)。"""
    return {"id": entry.id, "event": entry.event}


def _estimate_size(event_id: str, event: dict[str, Any]) -> int:
    """估算一条事件占用的字节(头注病灶 1)。

    是**估算**不是精确账:量 data 段的 UTF-8 长度 + id 长度 + 每帧固定开销。刻意不与
    ``routers/agents.py`` 的 ``_format_sse`` 逐字节对齐 —— 这里要的是"量级正确且有界",
    把每层序列化开销算准并不会因此少丢一条,反而会把这条路径变成第二份序列化实现。
    """
    try:
        payload = json.dumps(event, ensure_ascii=False, default=str)
    except (TypeError, ValueError):  # 循环引用等不可序列化载荷
        payload = repr(event)
    return (
        len(event_id.encode("utf-8"))
        + len(payload.encode("utf-8"))
        + _FRAME_OVERHEAD_BYTES
    )


class SSEEventBuffer:
    """SSE 事件缓冲区(内存 + 双上限 + 双到期锚点)。"""

    def __init__(
        self,
        ttl_seconds: int = 300,
        cleanup_interval: int = 60,
        max_events_per_task: int = DEFAULT_MAX_EVENTS_PER_TASK,
        max_bytes_per_task: int = DEFAULT_MAX_BYTES_PER_TASK,
        max_lifetime_seconds: int = DEFAULT_MAX_LIFETIME_SECONDS,
    ) -> None:
        """初始化缓冲区。

        Args:
            ttl_seconds: **空闲** TTL —— 距最后一次写入超过即可被清理(默认 300 秒 /
                5 分钟)。语义按原意保留:任务结束后仍有 ttl 秒的重放窗口。
            cleanup_interval: 自动清理间隔秒数(惰性,在 append 时检查)。
            max_events_per_task: 单 task 条数上限,溢出丢最旧并计数。
            max_bytes_per_task: 单 task 估算字节上限,溢出丢最旧并计数。
            max_lifetime_seconds: 单 task **存活**上限(自首事件起算)—— 活跃任务也到期,
                这是旧实现把时间戳记成"最后更新时间"时丢掉的那一半(病灶 3)。
        """
        self._buffers: dict[str, list[_Entry]] = {}
        self._counters: dict[str, int] = {}
        self._timestamps: dict[str, float] = {}  # task_id -> 最后活动时间(空闲锚点)
        self._started: dict[str, float] = {}  # task_id -> 首事件时间(存活锚点)
        self._bytes: dict[str, int] = {}  # task_id -> 当前估算占用
        self._dropped: dict[str, int] = {}  # task_id -> 自首事件起累计丢弃条数
        self._ttl = ttl_seconds
        self._max_lifetime = max_lifetime_seconds
        self._max_events = max_events_per_task
        self._max_bytes = max_bytes_per_task
        self._cleanup_interval = cleanup_interval
        self._last_cleanup = time.monotonic()

    def append(self, task_id: str, event: dict[str, Any]) -> str:
        """追加事件到缓冲区,返回分配的 event_id(格式 ``{task_id}-{seq}``)。

        溢出策略 = 丢最旧并计数(病灶 1)。丢弃不是静默的:每次真正丢东西写一条
        ``logger.warning``,累计值随时可经 ``dropped_events(task_id)`` 读到,
        并由上层重连时的 ``resume.dropped_events`` 带到响应里。
        """
        now = time.monotonic()
        # 惰性清理: 超过间隔则清理到期 task
        if now - self._last_cleanup > self._cleanup_interval:
            self._cleanup()

        seq = self._counters.get(task_id, 0) + 1
        self._counters[task_id] = seq
        event_id = f"{task_id}-{seq}"

        entries = self._buffers.get(task_id)
        if entries is None:
            entries = []
            self._buffers[task_id] = entries
            self._started[task_id] = now  # 存活锚点: 只记首事件,不被后续 append 续期
            self._bytes[task_id] = 0
            self._dropped[task_id] = 0

        size = _estimate_size(event_id, event)
        entries.append(_Entry(seq=seq, id=event_id, event=event, ts=now, size=size))
        self._bytes[task_id] += size
        self._timestamps[task_id] = now  # 空闲锚点: 每次写入都刷新(这正是"结束后 ttl 内可重放")

        dropped = self._trim(task_id)
        if dropped:
            logger.warning(
                "SSE 缓冲溢出已丢最旧 %d 条: task=%s 累计丢弃=%d 上限=%d 条/%d B 现存=%d 条/%d B",
                dropped,
                task_id,
                self._dropped[task_id],
                self._max_events,
                self._max_bytes,
                len(entries),
                self._bytes[task_id],
            )
        return event_id

    def _trim(self, task_id: str) -> int:
        """按双上限从最旧端丢弃,返回本次丢弃条数(任何情况下至少保留最新 1 条)。

        "至少留 1 条"是必需的:一条本身就超限的巨型事件(不截断的 done 帧正是这种)若被
        自己挤出去,缓冲就永远为空,续传判定连锚点都不剩 —— 那是把"有界"做成"没有"。
        """
        entries = self._buffers[task_id]
        total = len(entries)
        excess = self._bytes[task_id] - self._max_bytes
        drop = 0
        while drop < total - 1 and (total - drop > self._max_events or excess > 0):
            excess -= entries[drop].size
            self._bytes[task_id] -= entries[drop].size
            drop += 1
        if drop:
            del entries[:drop]
            self._dropped[task_id] = self._dropped.get(task_id, 0) + drop
        return drop

    def replay_outcome(self, task_id: str, last_event_id: str | None) -> ReplayOutcome:
        """断线重连的三态判定(病灶 2 —— 未命中不得再返回全部历史)。

        Returns:
            ``ReplayOutcome``,status 三取一:

            - ``REPLAY_HIT``: 锚点在缓冲内 ⇒ events 为其后事件(last_event_id 为 None 时
              为现存全部);此时客户端按 id 追加是**连续**的。
            - ``REPLAY_NOT_RESUMABLE``: 锚点已被上限丢弃 / 序号越界 / id 不属于本 task
              ⇒ events 恒为空 + ``reason`` 说明是哪一种。**这是旧实现最错的一格** —— 它
              在这里返回整段历史,于是"翻倍"而不是"补齐"。
            - ``REPLAY_UNKNOWN_TASK``: task 从未写入、已到期清理或已 clear ⇒ events 为空,
              上层应当作"没有可续的流"(按既有语义另开一次 run)。

        任何一态都会把该 task 至今的累计丢弃数带在 ``dropped`` 里 —— 丢了不等于不可续,
        但"少了多少"必须让上层与客户端知道,不得让任何人把残缺读成完整。
        """
        entries = self._buffers.get(task_id) or []
        dropped = self._dropped.get(task_id, 0)
        if not entries:
            return ReplayOutcome(
                REPLAY_UNKNOWN_TASK,
                [],
                dropped,
                f"task {task_id!r} 不在缓冲中(从未写入 / 已到期清理 / 已 clear)",
            )
        if last_event_id is None:
            # 客户端没给锚点 = 主动要求从头重放现存缓冲;若已经丢过,原因里必须写明。
            return ReplayOutcome(
                REPLAY_HIT,
                [_to_wire(e) for e in entries],
                dropped,
                f"未提供 Last-Event-ID,重放现存缓冲{f'({dropped} 条更早事件已因上限丢弃)' if dropped else ''}",
            )

        seq = self._parse_seq(task_id, last_event_id)
        if seq is None:
            return ReplayOutcome(
                REPLAY_NOT_RESUMABLE,
                [],
                dropped,
                f"Last-Event-ID {last_event_id!r} 与 task {task_id!r} 的 id 形态不符",
            )
        # 序号连续且只从最旧端丢 ⇒ 首尾序号即可判定位次,不必线性扫描整表(旧 :84-86 那一遍)
        first, last = entries[0].seq, entries[-1].seq
        if seq < first:
            return ReplayOutcome(
                REPLAY_NOT_RESUMABLE,
                [],
                dropped,
                f"续传锚点 {last_event_id!r} 已被上限丢弃(缓冲现存首序号 {first})",
            )
        if seq > last:
            return ReplayOutcome(
                REPLAY_NOT_RESUMABLE,
                [],
                dropped,
                f"Last-Event-ID 序号 {seq} 不在本 task 区间 [{first}, {last}]",
            )
        return ReplayOutcome(REPLAY_HIT, [_to_wire(e) for e in entries[seq - first + 1 :]], dropped, None)

    def replay_after(self, task_id: str, last_event_id: str | None) -> list[dict[str, Any]]:
        """获取指定 task 在 last_event_id 之后的所有事件(兼容出口)。

        本方法签名与返回类型一字未动,以免弄坏既有调用方;它是 ``replay_outcome`` 的
        "命中事件"投影 —— 三态里只有 ``REPLAY_HIT`` 会给东西,不可续传与 task 不存在
        一律返回**空列表**(旧实现在这里返回全部,即病灶 2,已移除)。
        上层需要分辨三态时必须改用 ``replay_outcome``。

        Args:
            task_id: 任务/会话标识。
            last_event_id: 客户端最后收到的事件 ID(Last-Event-ID header);
                None 表示从头重放现存缓冲。

        Returns:
            事件列表,每个元素为 ``{"id": ..., "event": ...}``;
            task 不存在、已过期或续传锚点不可用时为空列表。
        """
        return self.replay_outcome(task_id, last_event_id).events

    def get_all(self, task_id: str) -> list[dict[str, Any]]:
        """获取指定 task 当前缓冲的全部事件(不含已被丢弃的部分)。"""
        return [_to_wire(e) for e in self._buffers.get(task_id, [])]

    def dropped_events(self, task_id: str) -> int:
        """该 task 自首事件起被上限丢弃的累计条数(0 = 从未丢)。

        这是"丢弃必须可见"三个出口里的属性出口;另有 logger.warning 与上层
        start 帧的 ``resume.dropped_events``。
        """
        return self._dropped.get(task_id, 0)

    def clear(self, task_id: str) -> None:
        """清除指定 task 的缓冲区(连同计数、两个时间锚点与丢弃账)。"""
        self._buffers.pop(task_id, None)
        self._counters.pop(task_id, None)
        self._timestamps.pop(task_id, None)
        self._started.pop(task_id, None)
        self._bytes.pop(task_id, None)
        self._dropped.pop(task_id, None)

    @staticmethod
    def _parse_seq(task_id: str, event_id: str) -> int | None:
        """从 ``{task_id}-{seq}`` 形态的 id 取序号(task_id 自身可以含 ``-``)。"""
        prefix = f"{task_id}-"
        if not event_id.startswith(prefix):
            return None
        suffix = event_id[len(prefix) :]
        return int(suffix) if suffix.isdigit() else None

    def _cleanup(self) -> None:
        """清掉到期 task —— 两条独立判据,任一成立即清理(病灶 3)。

        - **空闲 TTL**: ``now - 最后活动时间 > ttl_seconds``。保留原语义:任务结束后
          仍给 ttl 秒的重放窗口,超了就没必要再留着。
        - **存活上限**: ``now - 首事件时间 > max_lifetime_seconds``。这条是新增的,
          专为堵住"活跃任务被每次 append 无限续期 ⇒ TTL 永不触发 ⇒ 整轮事件常驻"。
          一次超过存活上限的长 run 会失去 SSE 续传锚点,这是取舍不是遗漏:长 run 的
          正确恢复通道是 checkpoint(``POST /api/agents/execute/resume``),不是内存缓冲。
        """
        now = time.monotonic()
        self._last_cleanup = now
        expired = [
            tid
            for tid, idle_ts in self._timestamps.items()
            if now - idle_ts > self._ttl
            or now - self._started.get(tid, idle_ts) > self._max_lifetime
        ]
        for tid in expired:
            self.clear(tid)


# 全局单例
sse_buffer = SSEEventBuffer()

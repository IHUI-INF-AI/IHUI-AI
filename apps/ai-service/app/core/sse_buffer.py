# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

4. **续传锚点只看序号、不看身份**(2026-10-05,台账票 G-998170;实测确认):
   ``clear()`` 把 ``_counters`` 一起弹掉,于是同一 ``task_id`` 的缓冲重建后 event_id
   的序号从 1 重起。客户端手里那个 ``<task>-3`` 在新缓冲里**又能命中**,但它当年看到的
   第 3 条与新缓冲的第 3 条**不是同一条事件** —— 身份换了、序号没换,旧实现只认序号。
   实测症状:``replay_outcome(task, "task-epoch-3")`` 返回 ``hit`` 并回灌新代次的第 4、5 条,
   客户端按 id 追加即拿到一段它从未见过、也不属于它那条流的内容。
   现引入 **epoch(代次)**:``clear()`` 使该 task 的 epoch 递增(含 TTL/存活上限触发的清理,
   那也是一代结束),序号仍**只在同一 epoch 内单调**。裸序号锚点 ``seq`` 只有在
   **高过所有已退役代次的序号上限**时才可能唯一属于当前代次 ⇒ 判 hit;否则身份不可辨 ⇒
   ``REPLAY_NOT_RESUMABLE``,原因写明"缓冲代次已更换(epoch A→B)"。终态不可逆:代次换过
   之后旧锚点不再被承认(不猜、不和稀泥)。
   epoch **不进 event_id**:既有测试与 ``routers/agents.py:1293`` 的
   ``last_event_id.rsplit("-", 1)[0]`` 把 id 形态钉死为 ``{task_id}-{seq}``,多塞一段会
   让上层取错 task_id 而退回 ``UNKNOWN_TASK``。代价是代次只能靠序号反推(见 ``_EpochState``)。

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

# 代次账的容量上限(病灶 4 的记账有代价:``clear()`` 刻意不清它,否则旧锚点的身份凭证
# 就消失了)。task_id 是每轮 run 的 id,长跑进程里会无界增长,因此按插入顺序淘汰最老的账。
# 淘汰只影响"该 task 的缓冲早已被 TTL 清理、且其 epoch 早已无人引用"的情形:真有活跃
# 缓冲或刚重连的客户端时,它的账必然是最近写入的那批,不会落到被淘汰的头部。
DEFAULT_MAX_EPOCH_RECORDS: Final[int] = 10_000

# 一帧除 data 载荷外还有 id: / event: 行与空行的开销,估算时按固定值计入。
_FRAME_OVERHEAD_BYTES: Final[int] = 64

# 已退役代次的水位线只保留"最高序号 + 它的代次"这一个数(病灶 4)。
# 为什么够用:裸锚点 ``task-N`` 若 N <= 这个水位线,则 N 在某一旧代次里出现过 —— 身份
# 不可辨(它可能指向旧代次的第 N 条,也可能指向当前代次第 N 条),一律判不可续传;
# N 高过水位线时它只可能属于当前代次(当前代次序号从 1 起单调增长,旧代次都没到过 N),
# 身份唯一 ⇒ 照旧续传。不必逐代留存历史,一个 max 就够判。

@dataclass(frozen=True)
class _EpochState:
    """单个 task 的代次账(病灶 4)。

    epoch **不进 event_id**:既有测试与 ``routers/agents.py:1293`` 的
    ``last_event_id.rsplit("-", 1)[0]`` 把 id 形态钉死为 ``{task_id}-{seq}``,多塞一段
    会让上层取错 task_id 而退回 ``UNKNOWN_TASK``。代价是代次不能随锚点往返,只能靠
    序号反推身份 —— 而这正是上面那两个水位线数字的用途。

    Attributes:
        epoch: 当前代次序号,``clear()`` 递增;从未清过的 task 记 1。
        retired_max: **所有已退役代次**里出现过的最高 event 序号(水位线)。
        retired_epoch: 那个最高序号所属的代次 —— 只为把"A→B"里的 A 写准。
    """

    epoch: int
    retired_max: int
    retired_epoch: int


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
        max_epoch_records: int = DEFAULT_MAX_EPOCH_RECORDS,
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
            max_epoch_records: 代次账条数上限(病灶 4),超出按插入顺序淘汰最老的账。
        """
        self._buffers: dict[str, list[_Entry]] = {}
        self._counters: dict[str, int] = {}
        self._epochs: dict[str, _EpochState] = {}  # task_id -> 代次账(病灶 4;clear 不清它)
        self._timestamps: dict[str, float] = {}  # task_id -> 最后活动时间(空闲锚点)
        self._started: dict[str, float] = {}  # task_id -> 首事件时间(存活锚点)
        self._bytes: dict[str, int] = {}  # task_id -> 当前估算占用
        self._dropped: dict[str, int] = {}  # task_id -> 自首事件起累计丢弃条数
        self._ttl = ttl_seconds
        self._max_lifetime = max_lifetime_seconds
        self._max_epoch_records = max_epoch_records
        self._max_events = max_events_per_task
        self._max_bytes = max_bytes_per_task
        self._cleanup_interval = cleanup_interval
        self._last_cleanup = time.monotonic()

    def epoch(self, task_id: str) -> int:
        """该 task 当前所处的代次(从未写入或从未清理过 ⇒ 1)。

        这是"身份 + 序号共同判定"里的**身份**那一半的可观测出口:同一 task_id 在缓冲
        被 ``clear()`` 重建后 epoch 递增,而序号又从 1 重起 —— 只看序号就分不出
        "客户端上次看到的第 N 条"和"这次缓冲里的第 N 条"是不是同一条。
        """
        state = self._epochs.get(task_id)
        return state.epoch if state is not None else 1

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
            - ``REPLAY_NOT_RESUMABLE``: 锚点已被上限丢弃 / 序号越界 / id 不属于本 task /
              **锚点序号属于已退役的代次**(病灶 4)
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
        # 身份这一半(病灶 4):裸序号 seq 若落在已退役代次的序号水位线以内,就无法证明
        # 它属于当前代次 —— 它当年可能指向旧代次的第 seq 条。终态不可逆:代次换过就
        # 不再承认旧锚点,不猜、不和稀泥。N 高过水位线 ⇒ 只可能属于当前代次(当前代次
        # 序号从 1 单调增长,旧代次都没到过 N),身份唯一,交由下面的区间判据处理。
        state = self._epochs.get(task_id)
        if state is not None and seq <= state.retired_max:
            return ReplayOutcome(
                REPLAY_NOT_RESUMABLE,
                [],
                dropped,
                f"缓冲代次已更换(epoch {state.retired_epoch}→{state.epoch}),"
                f"续传锚点 {last_event_id!r} 的序号 {seq} 在旧代次中已出现过,身份不可辨",
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
        """清除指定 task 的缓冲区(连同计数、两个时间锚点与丢弃账)。

        代次账 ``_epochs`` **刻意不清**:清掉它等于让旧锚点的身份凭证消失,下一次
        重建又从 epoch 1 重数,跨代续传会重新被放行 —— 那正是本方法在旧实现里埋的
        病灶。这里改成把当前代次**退役**:epoch 递增,并把这一代用过的最高序号记进水位线,
        使这些序号此后永远无法再作为有效锚点(终态不可逆)。
        TTL / 存活上限触发的清理也走本方法(那同样是一代结束),语义一致。
        """
        state = self._epochs.get(task_id)
        last_seq = self._counters.get(task_id, 0)
        if state is None:
            self._epochs[task_id] = _EpochState(epoch=2, retired_max=last_seq, retired_epoch=1)
        else:
            # 水位线只升不降:跨多代累计,任何被用过的序号都留在水位线以内
            self._epochs[task_id] = _EpochState(
                epoch=state.epoch + 1,
                retired_max=max(state.retired_max, last_seq),
                retired_epoch=state.epoch if last_seq > state.retired_max else state.retired_epoch,
            )
        self._evict_oldest_epochs()
        self._buffers.pop(task_id, None)
        self._counters.pop(task_id, None)
        self._timestamps.pop(task_id, None)
        self._started.pop(task_id, None)
        self._bytes.pop(task_id, None)
        self._dropped.pop(task_id, None)

    def _evict_oldest_epochs(self) -> None:
        """代次账超出容量上限时,按插入顺序淘汰最老的账(见 ``DEFAULT_MAX_EPOCH_RECORDS``)。

        dict 保插入序,所以 ``next(iter(...))`` 就是最老的一条;被淘汰者的缓冲早已被 TTL
        清理,它的 epoch 也不会再被引用(真有活跃缓冲的 task 记账是刚写入的,排在尾部)。
        """
        while len(self._epochs) > self._max_epoch_records:
            self._epochs.pop(next(iter(self._epochs)))

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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

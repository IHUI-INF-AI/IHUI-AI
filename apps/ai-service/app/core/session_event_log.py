# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""事件溯源会话日志(遵循统一工程规范)。

为什么要有这一份:IHUI 现有 agent 持久化是 `langgraph_checkpoint.py` 的
AsyncPostgresSaver **快照范式**——`snapshot.values` 存"某个时刻的完整状态",
`get_state_history` 只能给历史快照列表,丢事件流、不能从"事件=唯一真相源"重放。
对照对象 dsh-session 是 **append-only 事件流 + 重放投影**:
    Session = append-only log of typed SessionEvent
    模型可见历史 = 从事件流派生的投影(deriveMessages),增量 + 缓存
    重启/分叉 = replay 事件前缀重建,无外部 config
两种范式取舍:快照省空间但丢"每一步怎么来的";事件流天然审计可回放、可 fork,
代价是日志只增不减(用 compaction 隐藏被取代条目而非删除来控投影大小)。
本模块只复刻事件溯源的最小核心(2026-11-15 R11),刻意**不做**:
  - 不接管 Postgres/JSONL 持久化(那是 langgraph_checkpoint.py / 后续持久层的事);
  - 不做 dsh 的 plugin-owned message projection / format v0→v4 迁移链(超出本轮范围);
  - 不调模型、不碰网络(纯进程内数据结构)。

复刻的四条核心语义(逐条来自 dsh-session README 取证,见 .archify/deepseek-session-src/):
  1. append 原子性:候选先全量校验(JSON 安全 + surfaceOp 契约),任一非法则整批拒绝,
     日志/投影/事件订阅全不变(dsh:"array admission validates every candidate ... before
     changing the log");单条 append 同样先校验再落。
  2. JSON 安全:append 现场用 snapshot_json_value 读+校验+深拷贝一遍,有状态 getter 不能
     给校验一个值、给存储另一个值;BigInt/cycle/稀疏数组等非无损 JSON 在 append 现场拒。
  3. 重放投影 derive_messages:投影是派生的,缓存深冻结结果,replacement / plugin 变更才
     失效。compaction = 记 surface 隐藏区间,不删事件;被隐藏节点仍在日志里可审计。
  4. fork:拷贝一个 inclusive 事件前缀到新 Session,子端 inherited_event_count 只数拷贝的
     前缀;历史事件保留(审计),fork 不回放父历史为子事件。
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any, Literal

__all__ = [
    "SessionEvent",
    "SessionEventLog",
    "SessionJsonError",
    "AppendRejected",
    "snapshot_json_value",
    "SURFACE_EVENT_TYPES",
]


class SessionJsonError(ValueError):
    """payload 不是无损 JSON(循环引用 / BigInt / 非字符串键 / 非法值)。"""


class AppendRejected(ValueError):
    """append 候选非法(surface 契约 / replacement 覆盖不全 / 类型未知)。日志不变。"""


# surface 事件 = 会出现在模型可见投影里的事件;log-only 事件永不产生 message。
# dsh 取证:surface events (system/developer/user/assistant/message, tool/result)
# require surfaceOp in both typed events and append input.
SURFACE_EVENT_TYPES: frozenset[str] = frozenset(
    {
        "system/message",
        "developer/message",
        "user/message",
        "assistant/message",
        "tool/result",
    }
)

# JSON 安全:递归"读+校验+深拷贝"一遍(dsh snapshotJsonValue 语义)
_SNAPSHOT_MAX_DEPTH = 256
_SNAPSHOT_MAX_ITEMS = 100_000  # 防数组/容器爆炸(OOM 防线,对齐本仓 bounded_ttl_store 思路)


def snapshot_json_value(
    value: Any,
    *,
    _depth: int = 0,
    _seen: set[int] | None = None,
) -> Any:
    """读 + 校验 + 深拷贝一遍,返回冻结安全的纯 JSON 值。

    dsh 语义:"Each append uses the shared iterative snapshotJsonValue() pass, which
    reads, validates, and copies each nested value once, so a stateful getter cannot
    supply one value to validation and another to storage."
    → 同一份快照既用于校验也用于存储,杜绝 TOCTOU(校验时合法、存储时变样)。

    拒绝(对齐 dsh:"BigInt, cycles, sparse arrays, -0, exotic prototypes are
    rejected at the append site"):
      - 循环引用 / 超深 / 超量(进程内 OOM 防线)
      - 非字符串 dict 键(JSON object key 必须 str)
      - dict/list 之外的"异质容器"(set/tuple 视为非法,强制调用方显式转 list)
      - int 越界(超出 JSON number 安全域,避免 BigInt 语义)
    """
    if _seen is None:
        _seen = set()
    if _depth > _SNAPSHOT_MAX_DEPTH:
        raise SessionJsonError(f"JSON 嵌套过深(>{_SNAPSHOT_MAX_DEPTH})")
    # 原子类型直接返回;bool 要在 int 之前判(Python bool 是 int 子类)
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, int):
        # 2^53 安全整数域,超出即视为 BigInt 语义,拒
        if not (-(2**53) < value < 2**53):
            raise SessionJsonError(f"整数超出 JSON 安全域(2^53): {value}")
        return value
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            raise SessionJsonError("NaN/Inf 不是合法 JSON number")
        return value
    if isinstance(value, dict):
        oid = id(value)
        if oid in _seen:
            raise SessionJsonError("循环引用(检测到重复 dict)")
        _seen.add(oid)
        if len(value) > _SNAPSHOT_MAX_ITEMS:
            raise SessionJsonError(f"dict 过大(>{_SNAPSHOT_MAX_ITEMS} 键)")
        out: dict[str, Any] = {}
        for k, v in value.items():
            if not isinstance(k, str):
                raise SessionJsonError(f"JSON object 键必须为 str,得到 {type(k).__name__}")
            out[k] = snapshot_json_value(v, _depth=_depth + 1, _seen=_seen)
        _seen.discard(oid)
        return out
    if isinstance(value, (list, tuple)):
        # tuple 允许(常见不可变入参),但落库统一转 list(无损 JSON 数组)
        oid = id(value)
        if oid in _seen:
            raise SessionJsonError("循环引用(检测到重复 list)")
        _seen.add(oid)
        if len(value) > _SNAPSHOT_MAX_ITEMS:
            raise SessionJsonError(f"list 过大(>{_SNAPSHOT_MAX_ITEMS} 项)")
        out_list = [snapshot_json_value(v, _depth=_depth + 1, _seen=_seen) for v in value]
        _seen.discard(oid)
        return out_list
    # 其余一切(exotic prototype:set / 自定义对象 / 未知)拒绝
    raise SessionJsonError(f"不支持写入日志的类型: {type(value).__name__}")


@dataclass(frozen=True)
class SessionEvent:
    """一条已提交的会话事件(不可变)。seq 是它在日志里的 0 基位置。"""

    seq: int
    type: str
    data: dict[str, Any]  # 已 snapshot 的纯 JSON,调用方不得原地改
    surface_op: dict[str, Any] | None = None  # 仅 surface 事件有


@dataclass
class _SurfaceNode:
    """投影里的一个可见节点。hidden 表示被 compaction/replacement 遮蔽(事件仍在)。"""

    event_seq: int
    hidden: bool = False


class SessionEventLog:
    """append-only 事件日志 + 重放投影(线程安全,进程内)。

    设计取舍:
      - 投影 derive_messages() 是**派生**的:每次 append 后失效缓存,读时增量重建并缓存。
        compaction / replacement 只改"哪些节点可见",不删事件 → 永远可审计、可回放。
      - append 原子性:批量候选先全量校验,任一非法则整批抛 AppendRejected,
        日志/投影缓存/订阅者全不变(dsh array admission 语义)。
      - 加锁粒度:一把 RLock 保护 log + 缓存,足够(单进程内,不做分布式)。
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._events: list[SessionEvent] = []
        self._nodes: list[_SurfaceNode] = []  # 与 surface 事件一一对应的投影节点
        self._messages_cache: list[dict[str, Any]] | None = None
        self._subscribers: list[Any] = []  # 可选:事件订阅(为后续持久层预留)

    # ---- 读 ----
    @property
    def seq(self) -> int:
        """当前日志长度(= 下一条事件的 seq)。不 materialize 数组(dsh session.seq 语义)。"""
        with self._lock:
            return len(self._events)

    def event_at(self, seq: int) -> SessionEvent:
        """按 seq 读单条事件。越界抛 IndexError。"""
        with self._lock:
            if not (0 <= seq < len(self._events)):
                raise IndexError(f"seq {seq} 越界(日志长度 {len(self._events)})")
            return self._events[seq]

    def snapshot_events(
        self, from_seq: int = 0, to_seq_exclusive: int | None = None
    ) -> list[SessionEvent]:
        """物化一个半开区间 [from_seq, to_seq_exclusive) 的稳定快照(深拷贝)。"""
        with self._lock:
            end = len(self._events) if to_seq_exclusive is None else to_seq_exclusive
            if not (0 <= from_seq <= end <= len(self._events)):
                raise ValueError(f"非法区间 [{from_seq}, {end}) 日志长度 {len(self._events)}")
            return list(self._events[from_seq:end])

    # ---- 写 ----
    def append(
        self,
        event_type: str,
        data: dict[str, Any],
        *,
        surface_op: Literal["append", "replace"] | None = None,
        replace_range: tuple[int, int] | None = None,
    ) -> SessionEvent:
        """提交一条事件。先全量校验,非法抛 AppendRejected 且日志不变。

        surface 契约(dsh 取证):surface 事件必须带 surfaceOp;log-only 事件禁带。
        replacement 用 replace_range=(start_seq, end_seq),含端点,覆盖当前 surface 顺序。
        """
        with self._lock:
            return self._append_many([(event_type, data, surface_op, replace_range)])[0]

    def append_batch(
        self, inputs: list[tuple[str, dict[str, Any]]]
    ) -> list[SessionEvent]:
        """批量提交(原子):任一候选非法则整批拒绝,日志/投影/订阅全不变。

        dsh 语义:"array admission validates every candidate and synchronous dispatch
        before changing the log or message surface, so observers read the complete
        committed group."
        """
        with self._lock:
            return self._append_many([(t, d, None, None) for t, d in inputs])

    # ---- 投影 ----
    def derive_messages(self) -> list[dict[str, Any]]:
        """把事件流投影成模型可见 Message[](增量 + 缓存 + 深冻结语义)。

        空内容 system/developer 节点投影为无 message(dsh:"empty-content system and
        developer nodes project to no message");被 compaction/replacement 隐藏的节点
        不产出 message(事件仍在日志,可审计)。
        """
        with self._lock:
            if self._messages_cache is not None:
                # 返回浅拷贝,避免调用方改到缓存
                return [dict(m) for m in self._messages_cache]
            messages: list[dict[str, Any]] = []
            for node in self._nodes:
                if node.hidden:
                    continue
                ev = self._events[node.event_seq]
                content = ev.data.get("content")
                if ev.type in ("system/message", "developer/message") and not content:
                    continue  # 空系统/开发者节点不投影
                msg: dict[str, Any] = {"role": ev.type.split("/")[0], "type": ev.type}
                if content is not None:
                    msg["content"] = content
                # 把 event seq 记进去,便于审计回放定位
                msg["eventSeq"] = ev.seq
                messages.append(msg)
            self._messages_cache = messages
            return [dict(m) for m in messages]

    # ---- compaction / fork ----
    def compact(self, start_seq: int, end_seq: int) -> int:
        """隐藏 [start_seq, end_seq] 内的 surface 节点(不删事件)。返回隐藏节点数。

        dsh 语义:compaction hides superseded entries from the active conversation
        without deleting them。→ 控投影大小,日志仍完整可审计。
        """
        with self._lock:
            hidden = 0
            for node in self._nodes:
                if start_seq <= node.event_seq <= end_seq and not node.hidden:
                    node.hidden = True
                    hidden += 1
            if hidden:
                self._messages_cache = None
            return hidden

    def fork(self, boundary_seq: int | None = None) -> SessionEventLog:
        """从本日志的一个 inclusive 前缀分叉出新 Session(独立,拷贝前缀事件)。

        dsh 语义:fork copies an exact inclusive event prefix;inherited_event_count
        只数拷贝的前缀;历史事件保留(审计),fork 不回放父历史为子事件。
        boundary_seq=None 表示拷到当前末尾(含最后一条)。
        """
        with self._lock:
            end = len(self._events) if boundary_seq is None else boundary_seq + 1
            if not (0 <= end <= len(self._events)):
                raise ValueError(f"fork 边界 {boundary_seq} 越界(日志长度 {len(self._events)})")
            child = SessionEventLog()
            prefix = [self._events[i] for i in range(end)]
            # 直接重建子端内部状态(绕过 append 校验:前缀已合法)
            child._events = list(prefix)
            child._nodes = [_SurfaceNode(event_seq=ev.seq) for ev in prefix if ev.surface_op]
            child._messages_cache = None
            child._subscribers = list(self._subscribers)
            return child

    # ---- 内部 ----
    def _append_many(
        self,
        candidates: list[
            tuple[str, dict[str, Any], Literal["append", "replace"] | None, tuple[int, int] | None]
        ],
    ) -> list[SessionEvent]:
        """原子追加:全量校验通过才落,任一失败整批拒绝。调用方需持锁。"""
        # 阶段 1:全量校验候选(不改任何状态)
        validated: list[tuple[str, dict[str, Any], dict[str, Any] | None]] = []
        for event_type, data, surface_op, replace_range in candidates:
            if not isinstance(event_type, str) or not event_type:
                raise AppendRejected(f"事件类型必须为非空 str: {event_type!r}")
            is_surface = event_type in SURFACE_EVENT_TYPES
            if is_surface and surface_op is None:
                raise AppendRejected(f"surface 事件 {event_type} 必须带 surfaceOp")
            if not is_surface and surface_op is not None:
                raise AppendRejected(f"log-only 事件 {event_type} 禁带 surfaceOp")
            # snapshot:校验+深拷贝一份,杜绝 TOCTOU
            try:
                snap = snapshot_json_value(data if isinstance(data, dict) else {})
            except SessionJsonError as e:
                raise AppendRejected(f"事件 {event_type} payload 非法: {e}") from e
            if not isinstance(data, dict):
                raise AppendRejected(f"事件 {event_type} data 必须为 dict,得到 {type(data).__name__}")
            op_meta: dict[str, Any] | None = None
            if surface_op == "replace":
                if replace_range is None:
                    raise AppendRejected("surfaceOp=replace 必须给 replace_range=(start,end)")
                start, end = replace_range
                # replacement 必须覆盖当前 surface 顺序内的合法区间
                if not (0 <= start <= end):
                    raise AppendRejected(f"非法 replace_range {replace_range}")
                op_meta = {"op": "replace", "startSeq": start, "endSeq": end}
            elif surface_op == "append":
                op_meta = {"op": "append"}
            validated.append((event_type, snap, op_meta))
        # 阶段 2:校验全通过,真正落库
        committed: list[SessionEvent] = []
        for event_type, snap, op_meta in validated:
            seq = len(self._events)
            ev = SessionEvent(seq=seq, type=event_type, data=snap, surface_op=op_meta)
            self._events.append(ev)
            if event_type in SURFACE_EVENT_TYPES:
                node = _SurfaceNode(event_seq=seq)
                self._nodes.append(node)
                if op_meta and op_meta["op"] == "replace":
                    self._apply_replace(node, op_meta)
            committed.append(ev)
        if committed:
            self._messages_cache = None  # 投影失效,读时增量重建
            for cb in list(self._subscribers):
                for ev in committed:
                    try:
                        cb(ev)
                    except Exception:
                        pass  # 订阅者异常不回滚日志(持久层自己保证 durability)
        return committed

    def _apply_replace(self, node: _SurfaceNode, op_meta: dict[str, Any]) -> None:
        """replacement:把 [startSeq, endSeq] 内的旧节点标 hidden,新节点可见。"""
        start, end = op_meta["startSeq"], op_meta["endSeq"]
        for old in self._nodes:
            if start <= old.event_seq <= end:
                old.hidden = True

    def subscribe(self, callback: Any) -> None:
        """订阅已提交事件(为后续持久层预留;回调异常不影响日志)。"""
        with self._lock:
            self._subscribers.append(callback)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""OTel 日志通道原语(2026-11-23 立 B1-11)。

来由(五程序原生取证 B1-11):取证件把「会话事件日志」与「trace」分成两条独立通道 ——
trace 是采样稀疏的链路,日志是高频事件面;两者混在一条通道上时,**洪峰日志会把 trace 挤掉**
(批队列被日志填满,trace 只能丢)。本仓 `telemetry.py` 目前**只有 traces 一条腿**
(`/v1/traces`),没有任何日志通道,也没有「批多大、字节多宽」的界。

本模块只做**批语义与界**这一层(不 import OTel,可在无 SDK 环境测):

  ① 计数批:一次最多 `LOG_FLUSH_MAX_RECORDS` 条;
  ② 字节有界:一次最多 `LOG_FLUSH_MAX_BYTES` 字节(按 UTF-8 实算,不按字符数);
  ③ 时间到:距上次 flush 超过 `LOG_FLUSH_INTERVAL_S` 秒也 flush;
  ④ **超界不静默**:被截下的记录数与字节数都进 `BatchPlan`,并让通道状态落 `saturated`。

状态四态(§0.3):
  - `enabled`  :通道建好且从未丢过;
  - `saturated`:丢过(条数界或字节界触发过)—— 有界不等于无损;
  - `unjudged` :导出器缺失或发批失败 —— 取不到投递结果,不冒 enabled;
  - `disabled` :未配置端点。

诚实边界:本模块不判断"日志内容该不该上报"(那是脱敏层的事);它只保证**一次发多少、
超了多少、发失败了没有**。
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from enum import StrEnum

# 计数批上限。64 条是"一次网络请求还很小"的量级(单条约 100-200 字节时 ≈ 6-13KB)。
LOG_FLUSH_MAX_RECORDS = 64

# 字节界。32KB 保证单批不会撑爆代理/网关的请求体上限,也与 OTEL 默认批尺寸同量级。
LOG_FLUSH_MAX_BYTES = 32_768

# 时间界。10 秒:够把一次用户回合的日志攒成一批,又不会让单条日志在队列里过夜。
LOG_FLUSH_INTERVAL_S = 10.0


class ChannelState(StrEnum):
    """通道状态(封闭四态;测试 import 本枚举,不复制字面量,§0.6)。"""

    DISABLED = "disabled"
    ENABLED = "enabled"
    SATURATED = "saturated"
    UNJUDGED = "unjudged"


class BatchReason(StrEnum):
    """一批记录被如何结算(封闭四态,供日志与测试断言)。"""

    EMPTY = "empty"
    FITS = "fits"
    RECORDS_CAPPED = "records-capped"
    BYTES_CAPPED = "bytes-capped"


@dataclass(frozen=True)
class BatchPlan:
    """一次 flush 的结算:发出哪些、丢了几条、丢了几字节、为什么。"""

    send: tuple[str, ...]
    dropped_records: int
    dropped_bytes: int
    reason: BatchReason

    @property
    def ok(self) -> bool:
        """是否"无损发完"。空批不算 flush(返回 False)。"""
        return self.reason is BatchReason.FITS


def encode_size(text: str) -> int:
    """按 UTF-8 实算字节数 —— 中文一个字符 3 字节,不能按 `len(str)` 计。"""
    return len(text.encode("utf-8"))


def build_batch(
    records: Sequence[str],
    *,
    max_records: int = LOG_FLUSH_MAX_RECORDS,
    max_bytes: int = LOG_FLUSH_MAX_BYTES,
) -> BatchPlan:
    """把待发记录切成"一趟能发完"的一批。

    先到界者先停:条数到顶或再加一条就超字节,两条界任一触发都不再继续。
    被截下的**全部**计入 dropped(不是只计第一条超界的) —— 调用方据此知道"这趟丢了这么多"。
    界本身非法(<=0)属编程错,直接 ValueError:静默吞掉会变成"永远发不出去的通道"。
    """
    if max_records <= 0 or max_bytes <= 0:
        raise ValueError("max_records / max_bytes 必须为正")

    if not records:
        return BatchPlan(send=(), dropped_records=0, dropped_bytes=0, reason=BatchReason.EMPTY)

    sizes = [encode_size(r) for r in records]
    send: list[str] = []
    used = 0
    reason = BatchReason.FITS
    for index, (record, size) in enumerate(zip(records, sizes, strict=True)):
        if len(send) >= max_records:
            reason = BatchReason.RECORDS_CAPPED
        elif used + size > max_bytes:
            reason = BatchReason.BYTES_CAPPED
        if reason is not BatchReason.FITS:
            rest = records[index:]
            return BatchPlan(
                send=tuple(send),
                dropped_records=len(rest),
                dropped_bytes=sum(sizes[index:]),
                reason=reason,
            )
        send.append(record)
        used += size
    return BatchPlan(send=tuple(send), dropped_records=0, dropped_bytes=0, reason=BatchReason.FITS)


def should_flush(*, pending_records: int, pending_bytes: int, age_s: float) -> bool:
    """三界任一触发即 flush(计数 / 字节 / 时间)。非法输入一律 **不 flush**:
    一次错算的 flush 会把半批日志提前发出去,而漏一次 flush 只等下一拍。"""
    if pending_records <= 0:
        return False
    if pending_records >= LOG_FLUSH_MAX_RECORDS:
        return True
    if pending_bytes >= LOG_FLUSH_MAX_BYTES:
        return True
    return age_s >= LOG_FLUSH_INTERVAL_S


@dataclass
class ChannelStats:
    """通道计数只增(诊断用,不作判据)。"""

    sent_batches: int = 0
    sent_records: int = 0
    sent_bytes: int = 0
    dropped_records: int = 0
    dropped_bytes: int = 0
    failures: int = 0


@dataclass
class LogChannel:
    """一条日志通道:攒批 + 发批 + 记账。

    `exporter` 为 None = 通道没建起来(缺依赖/未配置) ⇒ 状态恒 `unjudged`,
    且 `emit` 仍然收(不抛) —— 日志层崩掉不得影响业务。
    """

    exporter: Callable[[Sequence[str]], None] | None
    configured: bool = True
    stats: ChannelStats = field(default_factory=ChannelStats)
    _pending: list[str] = field(default_factory=list, repr=False)

    def state(self) -> ChannelState:
        if not self.configured:
            return ChannelState.DISABLED
        if self.exporter is None or self.stats.failures > 0:
            return ChannelState.UNJUDGED
        if self.stats.dropped_records > 0:
            return ChannelState.SATURATED
        return ChannelState.ENABLED

    def emit(self, record: str) -> None:
        self._pending.append(record)

    @property
    def pending_records(self) -> int:
        return len(self._pending)

    @property
    def pending_bytes(self) -> int:
        return sum(encode_size(r) for r in self._pending)

    def flush(self) -> BatchPlan:
        """发一批。**无论成败都清空待发区**:失败还留着会无限涨,
        而失败本身以 `failures` + dropped 记账,不静默。"""
        plan = build_batch(self._pending)
        self._pending.clear()
        self.stats.dropped_records += plan.dropped_records
        self.stats.dropped_bytes += plan.dropped_bytes
        if not plan.send:
            # 空批(真的没攒到)与"整批都被界截下"(send 空但 dropped>0)都走这里;
            # 后者已在上面的 dropped 记账里体现,不需要再发一趟空请求。
            return plan
        if self.exporter is None:
            self.stats.failures += 1
            self.stats.dropped_records += len(plan.send)
            self.stats.dropped_bytes += sum(encode_size(r) for r in plan.send)
            return plan
        try:
            self.exporter(list(plan.send))
        except Exception:  # noqa: BLE001 — 导出失败只记账,绝不打断业务
            self.stats.failures += 1
            self.stats.dropped_records += len(plan.send)
            self.stats.dropped_bytes += sum(encode_size(r) for r in plan.send)
            return plan
        self.stats.sent_batches += 1
        self.stats.sent_records += len(plan.send)
        self.stats.sent_bytes += sum(encode_size(r) for r in plan.send)
        return plan


def disabled_channel() -> LogChannel:
    """未配置端点时的通道(状态 disabled;emit 收但永不发)。"""
    return LogChannel(exporter=None, configured=False)


__all__ = [
    "BatchPlan",
    "BatchReason",
    "ChannelState",
    "ChannelStats",
    "LOG_FLUSH_INTERVAL_S",
    "LOG_FLUSH_MAX_BYTES",
    "LOG_FLUSH_MAX_RECORDS",
    "LogChannel",
    "build_batch",
    "disabled_channel",
    "encode_size",
    "should_flush",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

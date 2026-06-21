"""Bug-123: 流式窗口聚合器.

设计:
  - 三种窗口: 滚动 (tumbling) / 滑动 (sliding) / 会话 (session)
  - 水位线 (watermark): 推进超过 event-time, 关闭过期窗口
  - 迟到数据: 允许配置 allowed_lateness
  - 聚合函数: sum/avg/count/min/max (可注入)
  - 分组 key: 按 (group_key, window) 隔离
"""

import enum
import logging
import math
import threading
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class WindowType(enum.StrEnum):
    TUMBLING = "tumbling"  # 固定大小, 无重叠
    SLIDING = "sliding"  # 固定大小, 步长 < size, 有重叠
    SESSION = "session"  # 按 gap 分组


@dataclass
class StreamEvent:
    key: str
    value: float
    event_time: float
    group: str = ""


@dataclass
class WindowResult:
    group: str
    window_start: float
    window_end: float
    count: int
    sum: float
    avg: float
    min: float
    max: float
    closed: bool = False


@dataclass
class WindowSpec:
    type: str = WindowType.TUMBLING.value
    size_sec: float = 60.0
    slide_sec: float = 60.0
    session_gap_sec: float = 30.0
    allowed_lateness_sec: float = 5.0
    watermark_delay_sec: float = 0.0


class StreamWindowAggregator:
    """流式窗口聚合器."""

    def __init__(self, spec: WindowSpec | None = None):
        self._lock = threading.RLock()
        self._spec = spec or WindowSpec()
        # 活动窗口: (group, start) -> [values]
        self._windows: dict[tuple[str, float], list[StreamEvent]] = {}
        # 窗口结束时间缓存
        self._ends: dict[tuple[str, float], float] = {}
        # 已关闭窗口结果
        self._closed: list[WindowResult] = []
        # 水位线: 每 group 维护
        self._watermarks: dict[str, float] = {}
        # 总事件数
        self._total_events = 0
        self._total_late = 0
        self._total_dropped = 0

    def configure(self, spec: WindowSpec) -> None:
        with self._lock:
            self._spec = spec

    def add(self, event: StreamEvent) -> list[WindowResult]:
        """添加一条事件, 返回本次新关闭窗口的结果列表."""
        with self._lock:
            self._total_events += 1
            # 推进水位线: 取 group 中最大 event_time - delay
            cur_wm = self._watermarks.get(event.group, 0.0)
            new_wm = event.event_time - self._spec.watermark_delay_sec
            if new_wm > cur_wm:
                self._watermarks[event.group] = new_wm
            # 迟到判断
            if event.event_time < cur_wm - self._spec.allowed_lateness_sec:
                self._total_late += 1
                return []
            # 找到该事件归属的窗口
            belongs = self._find_belongs(event)
            for w_key in belongs:
                arr = self._windows.setdefault(w_key, [])
                arr.append(event)
                self._ends[w_key] = self._calc_end(w_key)
            # 关闭过期窗口
            closed = self._close_expired(event.group)
            return closed

    def add_batch(self, events: list[StreamEvent]) -> list[WindowResult]:
        closed: list[WindowResult] = []
        for e in events:
            closed.extend(self.add(e))
        return closed

    def _find_belongs(self, event: StreamEvent) -> list[tuple[str, float]]:
        """找出事件归属的窗口 key 列表."""
        spec = self._spec
        t = event.event_time
        g = event.group
        if spec.type == WindowType.TUMBLING.value:
            start = math.floor(t / spec.size_sec) * spec.size_sec
            return [(g, start)]
        if spec.type == WindowType.SLIDING.value:
            slide = spec.slide_sec
            size = spec.size_sec
            if slide <= 0:
                slide = size
            # 从 t 所在 tumble 窗口往回找, 找所有包含 t 的窗口
            # 简化: 找 [-size+slide, t] 内的所有 slide 起点
            tumbles_start = math.floor(t / slide) * slide
            result = []
            start = tumbles_start
            while start > t - size:
                if start + size > t and start <= t:
                    result.append((g, start))
                start -= slide
            return result
        if spec.type == WindowType.SESSION.value:
            # 找最近一个窗口, gap 内则合并, 否则新开
            gap = spec.session_gap_sec
            for (gk, wstart), wend in list(self._ends.items()):
                if gk != g:
                    continue
                if t >= wstart and t <= wend + gap:
                    # 扩展窗口
                    new_start = min(wstart, t)
                    new_end = max(wend, t)
                    old_key = (g, wstart)
                    events = self._windows.pop(old_key, [])
                    self._ends.pop(old_key, None)
                    new_key = (g, new_start)
                    self._windows[new_key] = events
                    self._ends[new_key] = new_end
                    return [new_key]
            # 新开
            return [(g, t)]
        return [(g, math.floor(t / spec.size_sec) * spec.size_sec)]

    def _calc_end(self, w_key: tuple[str, float]) -> float:
        spec = self._spec
        _g, start = w_key
        if spec.type == WindowType.SESSION.value:
            return start
        return start + spec.size_sec

    def _close_expired(self, group: str) -> list[WindowResult]:
        spec = self._spec
        wm = self._watermarks.get(group, 0.0)
        to_close: list[tuple[tuple[str, float], float]] = []
        for (g, wstart), wend in self._ends.items():
            if g != group:
                continue
            # 水位线超过窗口结束, 关闭
            if wm >= wend + spec.allowed_lateness_sec:
                to_close.append(((g, wstart), wend))
        closed_results: list[WindowResult] = []
        for w_key, wend in to_close:
            events = self._windows.pop(w_key, [])
            self._ends.pop(w_key, None)
            if not events:
                continue
            res = self._build_result(w_key[0], w_key[1], wend, events)
            res.closed = True
            self._closed.append(res)
            closed_results.append(res)
        return closed_results

    def _build_result(self, group: str, start: float, end: float, events: list[StreamEvent]) -> WindowResult:
        vals = [e.value for e in events]
        return WindowResult(
            group=group,
            window_start=start,
            window_end=end,
            count=len(vals),
            sum=sum(vals),
            avg=sum(vals) / len(vals) if vals else 0.0,
            min=min(vals) if vals else 0.0,
            max=max(vals) if vals else 0.0,
        )

    def force_close(self, group: str) -> list[WindowResult]:
        """强制关闭某 group 的所有未关闭窗口."""
        with self._lock:
            to_close: list[tuple[tuple[str, float], float]] = []
            for (g, wstart), wend in self._ends.items():
                if g == group:
                    to_close.append(((g, wstart), wend))
            closed = []
            for w_key, wend in to_close:
                events = self._windows.pop(w_key, [])
                self._ends.pop(w_key, None)
                if not events:
                    continue
                res = self._build_result(w_key[0], w_key[1], wend, events)
                res.closed = True
                self._closed.append(res)
                closed.append(res)
            return closed

    def list_active(self, group: str | None = None) -> list[tuple[tuple[str, float], int]]:
        with self._lock:
            items = []
            for k, evs in self._windows.items():
                if group is None or k[0] == group:
                    items.append((k, len(evs)))
            return items

    def list_closed(self, group: str | None = None, limit: int = 100) -> list[WindowResult]:
        with self._lock:
            arr = list(self._closed)
        if group:
            arr = [r for r in arr if r.group == group]
        return arr[-limit:]

    def watermark(self, group: str) -> float:
        with self._lock:
            return self._watermarks.get(group, 0.0)

    def stats(self) -> dict:
        with self._lock:
            return {
                "total_events": self._total_events,
                "late_events": self._total_late,
                "dropped": self._total_dropped,
                "active_windows": len(self._windows),
                "closed_count": len(self._closed),
                "group_count": len({k[0] for k in self._windows}),
            }


# 全局单例
stream_window = StreamWindowAggregator()

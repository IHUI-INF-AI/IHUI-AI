# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/turn_timing.py
"""回合计时画像(2026-09-19 第二十六批,对标 Codex turn_timing.rs)。

Codex 的 turn_timing 为每个回合维护两类状态:

1. **TTFT / TTFM**(time-to-first-token / time-to-first-message):
   首个流式可见输出(文本增量/推理摘要/工具调用等)相对回合开始的耗时,
   以及首条完整助手消息的耗时。重复记录被忽略(只记第一次)。
2. **TurnProfile 阶段画像**:把回合时间归入六个互斥桶——
   before_first_sampling(首采前)、sampling(模型采样)、compaction(压缩)、
   between_sampling_overhead(采样间隙开销)、tool_blocking(工具阻塞)、
   after_last_sampling(末采后收尾),外加采样请求次数与重试次数。
   阶段经 TimingGuard 进入/退出,未归类时间在 complete() 时按"收尾时
   所处阶段"回填(四舍五入兜底),保证各桶之和 == 总时长。

Python 侧以 threading.Lock 保证线程安全(引擎事件循环 + 工具线程都可写)。
模块零依赖,不感知具体事件枚举:TTFT 资格由调用方判定
(见 ``records_turn_ttft_for_text_delta`` 等便捷判定),保持与 Codex
"response_event_records_turn_ttft" 相同的语义分层。
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


def now_unix_timestamp_ms() -> int:
    """当前 Unix 毫秒(Codex now_unix_timestamp_ms 对应)。"""
    return int(time.time() * 1000)


class TurnProfilePhase(str, Enum):
    """回合阶段(对标 TurnProfilePhase)。"""

    SAMPLING = "sampling"
    COMPACTION = "compaction"
    TOOL_BLOCKING = "tool_blocking"


@dataclass
class TurnProfile:
    """完成的回合画像(对标 analytics TurnProfile,毫秒桶)。"""

    before_first_sampling_ms: int = 0
    sampling_ms: int = 0
    compaction_ms: int = 0
    between_sampling_overhead_ms: int = 0
    tool_blocking_ms: int = 0
    after_last_sampling_ms: int = 0
    sampling_request_count: int = 0
    sampling_retry_count: int = 0

    def total_classified_ms(self) -> int:
        return (
            self.before_first_sampling_ms
            + self.sampling_ms
            + self.compaction_ms
            + self.between_sampling_overhead_ms
            + self.tool_blocking_ms
            + self.after_last_sampling_ms
        )

    def as_dict(self) -> dict[str, int]:
        return {
            "beforeFirstSamplingMs": self.before_first_sampling_ms,
            "samplingMs": self.sampling_ms,
            "compactionMs": self.compaction_ms,
            "betweenSamplingOverheadMs": self.between_sampling_overhead_ms,
            "toolBlockingMs": self.tool_blocking_ms,
            "afterLastSamplingMs": self.after_last_sampling_ms,
            "samplingRequestCount": self.sampling_request_count,
            "samplingRetryCount": self.sampling_retry_count,
        }


class TurnProfileTimingGuard:
    """阶段计时守卫(RAII,对标 TurnProfileTimingGuard 的 Drop 语义)。

    用法::

        with timing.begin_sampling():
            ...  # 模型采样
    离开 with 块自动 end_phase;若 begin 未激活(返回 inactive),
    守卫退出时不动任何状态。
    """

    def __init__(self, timing: "TurnTimingState", phase: TurnProfilePhase, active: bool) -> None:
        self._timing = timing
        self._phase = phase
        self._active = active

    @property
    def active(self) -> bool:
        return self._active

    def __enter__(self) -> "TurnProfileTimingGuard":
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        if self._active:
            self._timing._end_phase(time.perf_counter(), self._phase)


class TurnTimingState:
    """单回合计时状态(对标 TurnTimingState + TurnTimingStateInner + TurnProfileState)。

    生命周期:mark_turn_started → (各 record/begin_*) → complete_profile_and_duration。
    complete 之后所有写入均为 no-op(幂等,可安全重复调用)。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # ---- 内层状态(state) ----
        self._started_at: Optional[float] = None  # perf_counter
        self._started_at_unix_secs: Optional[int] = None
        self._item_started_at_ms: dict[str, int] = {}
        self._first_token_at: Optional[float] = None
        self._first_message_at: Optional[float] = None
        # ---- 画像状态(profile) ----
        self._profile_started_at: Optional[float] = None
        self._last_transition_at: Optional[float] = None
        self._active_phase: Optional[TurnProfilePhase] = None
        self._seen_sampling = False
        self._before_first_sampling = 0.0
        self._sampling = 0.0
        self._compaction = 0.0
        self._between_sampling_overhead = 0.0
        self._tool_blocking = 0.0
        self._pending_idle_after_sampling = 0.0
        self._sampling_request_count = 0
        self._sampling_retry_count = 0
        self._completed_profile: Optional[TurnProfile] = None

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------
    def mark_turn_started(self, started_at: Optional[float] = None) -> int:
        """回合开始;返回开始时刻的 Unix 毫秒(Codex 同名语义)。"""
        perf = started_at if started_at is not None else time.perf_counter()
        unix_ms = now_unix_timestamp_ms()
        with self._lock:
            self._started_at = perf
            self._started_at_unix_secs = unix_ms // 1000
            self._item_started_at_ms.clear()
            self._first_token_at = None
            self._first_message_at = None
            # profile.start
            self._profile_started_at = perf
            self._last_transition_at = perf
            self._active_phase = None
            self._seen_sampling = False
            self._before_first_sampling = 0.0
            self._sampling = 0.0
            self._compaction = 0.0
            self._between_sampling_overhead = 0.0
            self._tool_blocking = 0.0
            self._pending_idle_after_sampling = 0.0
            self._sampling_request_count = 0
            self._sampling_retry_count = 0
            self._completed_profile = None
        return unix_ms

    def started_at_unix_secs(self) -> Optional[int]:
        with self._lock:
            return self._started_at_unix_secs

    # ------------------------------------------------------------------
    # item 级计时(工具调用等单项耗时)
    # ------------------------------------------------------------------
    def record_item_started(self, item_id: str, started_at_ms: Optional[int] = None) -> int:
        """记录 item 开始时间;重复记录保留首个(Codex entry().or_insert)。"""
        ms = started_at_ms if started_at_ms is not None else now_unix_timestamp_ms()
        with self._lock:
            return self._item_started_at_ms.setdefault(item_id, ms)

    def take_item_started(self, item_id: str) -> Optional[int]:
        """取走并删除 item 开始时间;不存在返回 None。"""
        with self._lock:
            return self._item_started_at_ms.pop(item_id, None)

    # ------------------------------------------------------------------
    # TTFT / TTFM
    # ------------------------------------------------------------------
    def record_turn_ttft(self) -> Optional[int]:
        """记录首个可见输出;重复记录返回 None(不覆盖首值)。"""
        now = time.perf_counter()
        with self._lock:
            if self._first_token_at is not None or self._started_at is None:
                return None
            self._first_token_at = now
            return self._elapsed_ms(self._started_at, now)

    def record_turn_ttfm(self) -> Optional[int]:
        """记录首条完整助手消息;重复记录返回 None。"""
        now = time.perf_counter()
        with self._lock:
            if self._first_message_at is not None or self._started_at is None:
                return None
            self._first_message_at = now
            return self._elapsed_ms(self._started_at, now)

    def time_to_first_token_ms(self) -> Optional[int]:
        with self._lock:
            if self._first_token_at is None or self._started_at is None:
                return None
            return self._elapsed_ms(self._started_at, self._first_token_at)

    def time_to_first_message_ms(self) -> Optional[int]:
        with self._lock:
            if self._first_message_at is None or self._started_at is None:
                return None
            return self._elapsed_ms(self._started_at, self._first_message_at)

    # ------------------------------------------------------------------
    # 阶段画像
    # ------------------------------------------------------------------
    def begin_sampling(self) -> TurnProfileTimingGuard:
        return TurnProfileTimingGuard(self, TurnProfilePhase.SAMPLING, self._begin_phase(TurnProfilePhase.SAMPLING))

    def begin_compaction(self) -> TurnProfileTimingGuard:
        return TurnProfileTimingGuard(self, TurnProfilePhase.COMPACTION, self._begin_phase(TurnProfilePhase.COMPACTION))

    def begin_tool_blocking(self) -> TurnProfileTimingGuard:
        return TurnProfileTimingGuard(self, TurnProfilePhase.TOOL_BLOCKING, self._begin_phase(TurnProfilePhase.TOOL_BLOCKING))

    def record_sampling_retry(self) -> None:
        with self._lock:
            if self._completed_profile is None and self._profile_started_at is not None:
                self._sampling_retry_count += 1

    def complete_profile(self) -> TurnProfile:
        """完成画像并冻结(Codex TurnProfileState::complete)。"""
        now = time.perf_counter()
        with self._lock:
            return self._complete_locked(now)

    def complete_profile_and_duration_ms(self) -> tuple[Optional[int], Optional[int], TurnProfile]:
        """返回 (completed_at_unix_secs, duration_ms, profile)。"""
        now = time.perf_counter()
        with self._lock:
            profile = self._complete_locked(now)
            duration_ms = None
            if self._started_at is not None:
                duration_ms = self._elapsed_ms(self._started_at, now)
            completed_at = int(time.time())
            return completed_at, duration_ms, profile

    # ------------------------------------------------------------------
    # 内部:相位推进
    # ------------------------------------------------------------------
    def _begin_phase(self, phase: TurnProfilePhase) -> bool:
        now = time.perf_counter()
        with self._lock:
            if (
                self._completed_profile is not None
                or self._profile_started_at is None
                or self._active_phase is not None
            ):
                return False
            self._advance_locked(now)
            if phase is TurnProfilePhase.SAMPLING:
                if self._seen_sampling:
                    self._between_sampling_overhead += self._pending_idle_after_sampling
                    self._pending_idle_after_sampling = 0.0
                self._seen_sampling = True
                self._sampling_request_count += 1
            self._active_phase = phase
            return True

    def _end_phase(self, now: float, phase: TurnProfilePhase) -> None:
        with self._lock:
            if self._completed_profile is not None or self._active_phase is not phase:
                return
            self._advance_locked(now)
            self._active_phase = None

    def _advance_locked(self, now: float) -> None:
        previous = self._last_transition_at
        self._last_transition_at = now
        if previous is None:
            return
        elapsed = max(0.0, now - previous)
        if self._active_phase is TurnProfilePhase.SAMPLING:
            self._sampling += elapsed
        elif self._active_phase is TurnProfilePhase.COMPACTION:
            self._compaction += elapsed
        elif self._active_phase is TurnProfilePhase.TOOL_BLOCKING:
            self._tool_blocking += elapsed
        elif self._seen_sampling:
            self._pending_idle_after_sampling += elapsed
        else:
            self._before_first_sampling += elapsed

    def _complete_locked(self, now: float) -> TurnProfile:
        if self._completed_profile is not None:
            return self._completed_profile
        final_phase = self._active_phase
        self._advance_locked(now)
        after_last = self._pending_idle_after_sampling if self._seen_sampling else 0.0
        self._pending_idle_after_sampling = 0.0

        profile = TurnProfile(
            before_first_sampling_ms=int(self._before_first_sampling * 1000),
            sampling_ms=int(self._sampling * 1000),
            compaction_ms=int(self._compaction * 1000),
            between_sampling_overhead_ms=int(self._between_sampling_overhead * 1000),
            tool_blocking_ms=int(self._tool_blocking * 1000),
            after_last_sampling_ms=int(after_last * 1000),
            sampling_request_count=self._sampling_request_count,
            sampling_retry_count=self._sampling_retry_count,
        )
        total_ms = 0
        if self._profile_started_at is not None:
            total_ms = int(max(0.0, now - self._profile_started_at) * 1000)
        classified = profile.total_classified_ms()
        rounding = max(0, total_ms - classified)
        # 未归类残差按收尾时所处阶段回填(Codex 同款)
        if final_phase is TurnProfilePhase.SAMPLING:
            profile.sampling_ms += rounding
        elif final_phase is TurnProfilePhase.COMPACTION:
            profile.compaction_ms += rounding
        elif final_phase is TurnProfilePhase.TOOL_BLOCKING:
            profile.tool_blocking_ms += rounding
        elif self._seen_sampling:
            profile.after_last_sampling_ms += rounding
        else:
            profile.before_first_sampling_ms += rounding

        self._active_phase = None
        self._completed_profile = profile
        return profile

    @staticmethod
    def _elapsed_ms(start: float, end: float) -> int:
        return int(max(0.0, end - start) * 1000)


# ----------------------------------------------------------------------
# TTFT 资格判定便捷函数(对标 response_event_records_turn_ttft 分层)
# ----------------------------------------------------------------------
def records_turn_ttft_for_text_delta(text: str) -> bool:
    """输出文本增量 → 记 TTFT(Codex OutputTextDelta 分支)。"""
    return True


def records_turn_ttft_for_reasoning_delta(text: str) -> bool:
    """推理摘要增量 → 记 TTFT(Codex ReasoningSummaryDelta 分支)。"""
    return True


def records_turn_ttft_for_message_item(text: Optional[str]) -> bool:
    """完整消息 item:仅当助手正文非空才记 TTFT(Codex Message 分支)。"""
    return bool(text)


def records_turn_ttft_for_tool_item() -> bool:
    """工具调用 item → 记 TTFT(Codex LocalShellCall/FunctionCall 分支)。"""
    return True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

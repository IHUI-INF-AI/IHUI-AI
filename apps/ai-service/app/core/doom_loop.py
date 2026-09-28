# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""Doom-loop / stuck detection —— ai-service 侧等价实现(V3 #54,2026-09-28 立)。

TS 唯一算法源:`packages/shared/src/agent/doom-loop-detector.ts`。
本文件是它的 Python 等价实现,被主聊天执行链路
`app/services/agent_loop_v2.py` 消费(DoomLoopSentinel)。

**等值约束**(由 scripts/check-doom-loop-parity.mjs 钉死,漂开即判红):
  - 数值常量:DOOM_LOOP_WINDOW_SIZE / DOOM_LOOP_REPEAT_THRESHOLD /
    DOOM_LOOP_COOLDOWN_MS / DOOM_ALERT_ROUNDS_TO_TERMINATE /
    STUCK_CONSECUTIVE_THRESHOLD / FAILURE_STREAK_STRATEGY_THRESHOLD /
    ERROR_SIGNATURE_MAX_LEN / DOOM_LOOP_HASH_ALGORITHM
  - 清单:DOOM_LOOP_STATES(状态机状态)、DOOM_LOOP_STRATEGY_ACTIONS(换策略动作集合)
  改任何一侧必须同一枚提交改另一侧;不得只放宽判据或改注释消红。

零平台依赖:仅 stdlib(hashlib/json/re/time),无 DB、无网络、无第三方。
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from collections import deque
from collections.abc import Mapping, Sequence
from typing import Any

# ---------------------------------------------------------------------------
# 策略常量 —— 与 TS 共享层逐名逐值等值(parity 判据的输入)
# ---------------------------------------------------------------------------

DOOM_LOOP_WINDOW_SIZE = 10
DOOM_LOOP_REPEAT_THRESHOLD = 3
DOOM_LOOP_COOLDOWN_MS = 0
DOOM_ALERT_ROUNDS_TO_TERMINATE = 2
STUCK_CONSECUTIVE_THRESHOLD = 3
FAILURE_STREAK_STRATEGY_THRESHOLD = 3
ERROR_SIGNATURE_MAX_LEN = 120
DOOM_LOOP_HASH_ALGORITHM = 'sha256'

DOOM_LOOP_STATES = ['observing', 'reflecting', 'terminating']
DOOM_LOOP_STRATEGY_ACTIONS = ['inject_reflection', 'skip_tool_execution', 'terminate_loop']

# 序列化兜底占位串(不含任何入参原文)—— 与 TS SERIALIZE_FALLBACK 同值
_SERIALIZE_FALLBACK = '{"__doom_loop_unserializable__":true}'
_DIGITS_RE = re.compile(r'\d+')


# ---------------------------------------------------------------------------
# 规范化序列化与摘要
# ---------------------------------------------------------------------------

def _normalize(value: Any, ancestors: frozenset[int] = frozenset()) -> Any:
    """把任意入参折成 JSON 规范形状(与 TS stableSerialize 同语义)。

    循环引用只对**当前祖先链**判 '[Circular]'(兄弟分支同对象属 DAG,正常序列化),
    与 TS 侧祖先集合语义一致。
    """
    if value is None or isinstance(value, bool | int | str):
        return value
    if isinstance(value, float):
        return value if value == value and value not in (float('inf'), float('-inf')) else None
    if isinstance(value, Mapping | list | tuple):
        if id(value) in ancestors:
            return '[Circular]'
        inner = ancestors | {id(value)}
        if isinstance(value, Mapping):
            return {str(k): _normalize(v, inner) for k, v in value.items()}
        return [_normalize(v, inner) for v in value]
    # set/datetime/自定义对象等 → 稳定字符串表示(不抛错,不泄漏 repr 之外的结构)
    return str(value)


def canonical_serialize(value: Any) -> str:
    """确定性、永不抛错的规范化序列化:键排序 + 紧凑分隔符(与 TS stableSerializeSafe 同语义)。"""
    try:
        return json.dumps(
            _normalize(value), sort_keys=True, separators=(',', ':'), ensure_ascii=False,
            allow_nan=False,
        )
    except (TypeError, ValueError, RecursionError):
        # NaN/Infinity 已在 _normalize 挡掉;极端深度爆栈等走到这里 → 固定占位串(不含原文)
        return _SERIALIZE_FALLBACK


def hash_args(args: Any) -> str:
    """工具入参 → 定长摘要(算法名取 DOOM_LOOP_HASH_ALGORITHM,与 TS 侧一致)。"""
    hasher = hashlib.new(DOOM_LOOP_HASH_ALGORITHM)
    hasher.update(canonical_serialize(args).encode('utf-8'))
    return hasher.hexdigest()


# ---------------------------------------------------------------------------
# 滑动窗口检测器(尾部连续相同 工具名+入参摘要)
# ---------------------------------------------------------------------------

class DoomLoopWindow:
    """窗口尾部**连续**相同调用计数;中间夹任何不同调用即打断(2026-09-03 语义)。"""

    def __init__(
        self,
        window_size: int = DOOM_LOOP_WINDOW_SIZE,
        repeat_threshold: int = DOOM_LOOP_REPEAT_THRESHOLD,
        cooldown_ms: int = DOOM_LOOP_COOLDOWN_MS,
    ) -> None:
        self._window_size = window_size
        self._repeat_threshold = repeat_threshold
        self._cooldown_ms = cooldown_ms
        self._entries: deque[tuple[str, str, float]] = deque()
        self._unique: set[tuple[str, str]] = set()
        self._total = 0

    def record(self, tool_name: str, input_hash: str) -> dict[str, Any] | None:
        now = time.monotonic() * 1000.0
        while len(self._entries) >= self._window_size:
            self._entries.popleft()
        if self._cooldown_ms > 0:
            while self._entries and now - self._entries[0][2] > self._cooldown_ms:
                self._entries.popleft()
        self._entries.append((tool_name, input_hash, now))
        self._total += 1
        self._unique.add((tool_name, input_hash))
        repeat = 0
        for name, digest, _ts in reversed(self._entries):
            if name == tool_name and digest == input_hash:
                repeat += 1
            else:
                break
        if repeat >= self._repeat_threshold:
            return {
                'tool_name': tool_name,
                'input_hash': input_hash,
                'repeat_count': repeat,
            }
        return None

    def reset(self) -> None:
        self._entries.clear()
        self._unique.clear()
        self._total = 0

    def get_stats(self) -> dict[str, float]:
        if self._total == 0:
            return {'totalCalls': 0, 'uniqueCalls': 0, 'repeatRate': 0.0}
        return {
            'totalCalls': self._total,
            'uniqueCalls': len(self._unique),
            'repeatRate': 1 - len(self._unique) / self._total,
        }


# ---------------------------------------------------------------------------
# stuck 检测器(连续相同错误签名 / 连续相同 tool_call 轮次模式)
# ---------------------------------------------------------------------------

def normalize_error_signature(message: str) -> str:
    """错误签名归一:首行 + 数字→N + trim + 截断(与 TS normalizeErrorSignature 同语义)。"""
    first_line = message.split('\n', 1)[0]
    return _DIGITS_RE.sub('N', first_line).strip()[:ERROR_SIGNATURE_MAX_LEN]


def tool_call_round_signature(calls: Sequence[tuple[str, str]]) -> str:
    """一轮 tool_call 的轮次签名(排序拼接,与调用顺序无关)。"""
    return '|'.join(sorted(f'{name}({args_hash})' for name, args_hash in calls))


class StuckSignatureDetector:
    threshold: int

    def __init__(self, threshold: int = STUCK_CONSECUTIVE_THRESHOLD) -> None:
        self.threshold = threshold
        self._last_error_sig = ''
        self._consecutive_errors = 0
        self._last_round_sig = ''
        self._consecutive_rounds = 0

    def record_error(self, error_message: str) -> None:
        sig = normalize_error_signature(error_message)
        if sig == self._last_error_sig:
            self._consecutive_errors += 1
        else:
            self._last_error_sig = sig
            self._consecutive_errors = 1

    def record_tool_calls(self, calls: Sequence[tuple[str, Any]]) -> None:
        sig = tool_call_round_signature(
            [(name, hash_args(args)) for name, args in calls],
        )
        if sig == self._last_round_sig:
            self._consecutive_rounds += 1
        else:
            self._last_round_sig = sig
            self._consecutive_rounds = 1

    def is_stuck(self) -> bool:
        return (
            self._consecutive_errors >= self.threshold
            or self._consecutive_rounds >= self.threshold
        )

    def reset(self) -> None:
        self._last_error_sig = ''
        self._consecutive_errors = 0
        self._last_round_sig = ''
        self._consecutive_rounds = 0


# ---------------------------------------------------------------------------
# failure-streak 跟踪器(同一工具连续失败 → 换策略)
# ---------------------------------------------------------------------------

class FailureStreakTracker:
    """同工具连续失败达阈值 ⇒ change_strategy;返回时计数自动清零(与 TS 同语义)。"""

    threshold: int

    def __init__(self, threshold: int = FAILURE_STREAK_STRATEGY_THRESHOLD) -> None:
        self.threshold = threshold
        self._streaks: dict[str, int] = {}

    def record(self, tool_name: str, ok: bool) -> tuple[int, bool]:
        if ok:
            self._streaks[tool_name] = 0
            return (0, False)
        streak = self._streaks.get(tool_name, 0) + 1
        if streak >= self.threshold:
            self._streaks[tool_name] = 0
            return (streak, True)
        self._streaks[tool_name] = streak
        return (streak, False)

    def reset(self) -> None:
        self._streaks.clear()


# ---------------------------------------------------------------------------
# 报警轮次升级决策(纯函数,与 TS planDoomAlertResponse 等价)
# ---------------------------------------------------------------------------

def plan_doom_alert_response(
    consecutive_alert_rounds: int,
) -> tuple[list[str], str]:
    """返回 (actions, state)。actions ⊆ DOOM_LOOP_STRATEGY_ACTIONS。"""
    if consecutive_alert_rounds >= DOOM_ALERT_ROUNDS_TO_TERMINATE:
        return (['terminate_loop'], 'terminating')
    if consecutive_alert_rounds >= 1:
        return (['inject_reflection', 'skip_tool_execution'], 'reflecting')
    return ([], 'observing')


# ---------------------------------------------------------------------------
# 组合哨兵(agent_loop_v2 主链路唯一入口)
# ---------------------------------------------------------------------------

class DoomLoopSentinel:
    """把 窗口/stuck/失败连击 三件套组合成主链路两个观测点。

    - observe_calls:执行工具前 —— 记录 tool_call 轮次与滑动窗口,返回
      (actions, reminders);actions 含 terminate_loop 时主链路应中断,
      含 skip_tool_execution 时应跳过本轮真实执行(注入反思提示)。
    - observe_results:执行工具后 —— 记录失败与错误签名,返回
      (reminders, fatal_reason);fatal_reason 非 None 时主链路应中断。
    """

    def __init__(self) -> None:
        self._window = DoomLoopWindow()
        self._stuck = StuckSignatureDetector()
        self._failure = FailureStreakTracker()
        self._alert_rounds = 0
        self._state = 'observing'

    @property
    def state(self) -> str:
        return self._state

    def observe_calls(
        self, calls: Sequence[tuple[str, Any]],
    ) -> tuple[list[str], list[str]]:
        self._stuck.record_tool_calls(calls)
        reminders: list[str] = []
        had_alert = False
        for name, args in calls:
            fact = self._window.record(name, hash_args(args))
            if fact is not None:
                had_alert = True
                reminders.append(
                    f'[DOOM_LOOP_ALERT] 工具 {name} 已连续 {fact["repeat_count"]} 次'
                    f'以完全相同参数被调用,可能陷入死循环。'
                    f'请检查工具返回值,或换用其他工具/方法。',
                )
        self._alert_rounds = self._alert_rounds + 1 if had_alert else 0
        actions, state = plan_doom_alert_response(self._alert_rounds)
        if self._stuck.is_stuck():
            actions, state = ['terminate_loop'], 'terminating'
        self._state = state
        return (actions, reminders)

    def observe_results(
        self, results: Sequence[tuple[str, bool, str | None]],
    ) -> tuple[list[str], str | None]:
        """results: (工具名, 是否成功, 错误文本|None)。返回 (反思提示, 终止原因)。"""
        reminders: list[str] = []
        for name, ok, error in results:
            if not ok and error:
                self._stuck.record_error(error)
            streak, change_strategy = self._failure.record(name, ok)
            if change_strategy:
                reminders.append(
                    f'工具 {name} 已连续失败 {streak} 次。'
                    f'请反思:参数是否正确?是否应该换一种工具或方案?'
                    f'当前失败原因:{error or "未知"}',
                )
        if self._stuck.is_stuck():
            self._state = 'terminating'
            return (
                reminders,
                f'doom loop detected: 连续 {self._stuck.threshold} 次相同错误签名'
                f'或相同 tool_call 模式,判定卡死,中断本轮执行链路',
            )
        if reminders:
            self._state = 'reflecting'
        elif self._state != 'terminating':
            self._state = 'observing'
        return (reminders, None)

    def reset(self) -> None:
        self._window.reset()
        self._stuck.reset()
        self._failure.reset()
        self._alert_rounds = 0
        self._state = 'observing'

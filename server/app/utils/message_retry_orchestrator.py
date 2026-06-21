"""Bug-124: 消息重试编排器.

设计:
  - 指数退避 + 抖动 (jitter)
  - 最大重试次数, 超过入死信
  - 重试调度: 同步 / 异步
  - 注入: handler 失败回调
  - 死信队列: 持久化记录失败消息
  - 熔断: 连续失败超阈值暂停
"""

import enum
import logging
import random
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


class RetryState(enum.StrEnum):
    PENDING = "pending"
    IN_FLIGHT = "in_flight"
    RETRY_SCHEDULED = "retry_scheduled"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"
    CIRCUIT_OPEN = "circuit_open"


@dataclass
class RetryPolicy:
    max_attempts: int = 5
    initial_delay_sec: float = 1.0
    max_delay_sec: float = 60.0
    backoff_multiplier: float = 2.0
    jitter: float = 0.2  # 0~1, 抖动比例
    failure_threshold: int = 10  # 熔断触发
    circuit_reset_sec: float = 30.0


@dataclass
class Message:
    id: str
    payload: Any
    attempts: int = 0
    next_retry_at: float = 0.0
    state: str = RetryState.PENDING.value
    last_error: str = ""
    history: list[dict[str, Any]] = field(default_factory=list)
    created_at: float = 0.0
    finished_at: float = 0.0


@dataclass
class DeadLetter:
    msg: Message
    reason: str
    ts: float


class MessageRetryOrchestrator:
    """消息重试编排器."""

    def __init__(self, policy: RetryPolicy | None = None):
        self._lock = threading.RLock()
        self._policy = policy or RetryPolicy()
        # 待处理消息
        self._messages: dict[str, Message] = {}
        # 死信
        self._dead_letters: deque[DeadLetter] = deque(maxlen=2000)
        # 熔断
        self._consecutive_failures = 0
        self._circuit_opened_at = 0.0
        # handler 注入
        self._handler: Callable[[Any], bool] | None = None
        # 统计
        self._total_received = 0
        self._total_succeeded = 0
        self._total_failed = 0
        self._total_dead = 0
        self._total_circuit_breaks = 0

    def configure(self, policy: RetryPolicy) -> None:
        with self._lock:
            self._policy = policy

    def set_handler(self, fn: Callable[[Any], bool]) -> None:
        with self._lock:
            self._handler = fn

    def submit(self, msg_id: str, payload: Any) -> Message:
        """提交一条新消息."""
        with self._lock:
            self._total_received += 1
            m = Message(id=msg_id, payload=payload, created_at=time.time())
            self._messages[msg_id] = m
            return m

    def attempt(self, msg_id: str) -> Message:
        """执行一次尝试. handler 失败时按策略安排下次重试."""
        with self._lock:
            m = self._messages.get(msg_id)
            if m is None:
                raise KeyError(f"msg not found: {msg_id}")
            # 熔断检查
            if self._is_circuit_open():
                m.state = RetryState.CIRCUIT_OPEN.value
                self._total_circuit_breaks += 1
                return m
            if m.attempts >= self._policy.max_attempts:
                m.state = RetryState.DEAD_LETTER.value
                self._dead_letters.append(DeadLetter(m, "max_attempts", time.time()))
                self._total_dead += 1
                m.finished_at = time.time()
                return m
            m.attempts += 1
            m.state = RetryState.IN_FLIGHT.value
            handler = self._handler
        err = ""
        ok = False
        if handler is None:
            # 默认: 总是成功
            ok = True
        else:
            try:
                ok = bool(handler(m.payload))
            except Exception as e:
                ok = False
                err = str(e)
        with self._lock:
            m.history.append(
                {
                    "attempt": m.attempts,
                    "ok": ok,
                    "err": err,
                    "ts": time.time(),
                }
            )
            if ok:
                m.state = RetryState.SUCCEEDED.value
                m.finished_at = time.time()
                self._total_succeeded += 1
                self._consecutive_failures = 0
                return m
            m.last_error = err
            self._consecutive_failures += 1
            if m.attempts >= self._policy.max_attempts:
                m.state = RetryState.DEAD_LETTER.value
                self._dead_letters.append(DeadLetter(m, err or "max_attempts", time.time()))
                self._total_dead += 1
                m.finished_at = time.time()
                return m
            # 安排重试
            delay = self._calc_delay(m.attempts)
            m.next_retry_at = time.time() + delay
            m.state = RetryState.RETRY_SCHEDULED.value
            self._total_failed += 1
            # 熔断触发
            if self._consecutive_failures >= self._policy.failure_threshold:
                self._circuit_opened_at = time.time()
            return m

    def _calc_delay(self, attempts: int) -> float:
        p = self._policy
        base = p.initial_delay_sec * (p.backoff_multiplier ** (attempts - 1))
        base = min(p.max_delay_sec, base)
        if p.jitter > 0:
            jitter_range = base * p.jitter
            base = base + random.uniform(-jitter_range, jitter_range)
        return max(0.0, base)

    def _is_circuit_open(self) -> bool:
        if self._circuit_opened_at == 0.0:
            return False
        if time.time() - self._circuit_opened_at >= self._policy.circuit_reset_sec:
            # 重置
            self._circuit_opened_at = 0.0
            self._consecutive_failures = 0
            return False
        return True

    def ready_for_retry(self) -> list[Message]:
        """获取当前可重试的消息 (next_retry_at <= now)."""
        with self._lock:
            now = time.time()
            return [
                m
                for m in self._messages.values()
                if m.state == RetryState.RETRY_SCHEDULED.value and m.next_retry_at <= now
            ]

    def list_dead_letters(self, limit: int = 100) -> list[DeadLetter]:
        with self._lock:
            return list(self._dead_letters)[-limit:]

    def get(self, msg_id: str) -> Message | None:
        with self._lock:
            return self._messages.get(msg_id)

    def list_messages(self, state: str | None = None) -> list[Message]:
        with self._lock:
            arr = list(self._messages.values())
        if state:
            arr = [m for m in arr if m.state == state]
        return arr

    def circuit_state(self) -> dict:
        with self._lock:
            return {
                "open": self._circuit_opened_at > 0.0,
                "consecutive_failures": self._consecutive_failures,
                "opened_at": self._circuit_opened_at,
            }

    def reset_circuit(self) -> None:
        with self._lock:
            self._circuit_opened_at = 0.0
            self._consecutive_failures = 0

    def stats(self) -> dict:
        with self._lock:
            return {
                "total_received": self._total_received,
                "total_succeeded": self._total_succeeded,
                "total_failed": self._total_failed,
                "total_dead": self._total_dead,
                "total_circuit_breaks": self._total_circuit_breaks,
                "active_count": sum(
                    1
                    for m in self._messages.values()
                    if m.state not in (RetryState.SUCCEEDED.value, RetryState.DEAD_LETTER.value)
                ),
                "dead_letter_count": len(self._dead_letters),
                "circuit_state": self.circuit_state(),
            }


# 全局单例
message_retry = MessageRetryOrchestrator()

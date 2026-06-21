"""Bug-152: 连接池监控.

监控 DB / Redis / HTTP 连接池:
- 已用 / 空闲 / 等待数
- 借出/归还耗时
- 借出超时熔断
- 饱和度告警
"""

import enum
import threading
import time
from collections import deque
from dataclasses import dataclass, field


class BorrowState(enum.StrEnum):
    OK = "OK"
    TIMEOUT = "TIMEOUT"
    POOL_EXHAUSTED = "POOL_EXHAUSTED"


@dataclass
class PoolConfig:
    max_size: int = 20
    borrow_timeout_sec: float = 5.0
    max_idle_sec: int = 300
    saturation_warn: float = 0.85
    saturation_crit: float = 0.95


@dataclass
class BorrowRecord:
    state: BorrowState
    wait_ms: float
    used_ms: float
    ts: float = field(default_factory=time.time)


@dataclass
class ConnStub:
    id: int
    borrowed_at: float
    pool: "ConnPool"


class ConnPool:
    """连接池: 借/还 + 监控 + 饱和度告警."""

    def __init__(self, name: str, config: PoolConfig | None = None):
        self.name = name
        self.config = config or PoolConfig()
        self._lock = threading.Lock()
        self._cond = threading.Condition(self._lock)
        self._all: list[ConnStub] = []
        self._idle: list[ConnStub] = []
        self._next_id = 1
        self._records: deque[BorrowRecord] = deque(maxlen=500)
        self._saturated = False

    def _new_conn(self) -> ConnStub:
        c = ConnStub(id=self._next_id, borrowed_at=0.0, pool=self)
        self._next_id += 1
        return c

    def _saturation(self) -> float:
        cfg = self.config
        return (cfg.max_size - len(self._idle)) / cfg.max_size if cfg.max_size else 0.0

    def borrow(self) -> ConnStub:
        cfg = self.config
        start = time.time()
        with self._cond:
            if not self._idle and len(self._all) >= cfg.max_size:
                # 等待归还
                waited = self._cond.wait(timeout=cfg.borrow_timeout_sec)
                if not self._idle:
                    self._records.append(
                        BorrowRecord(
                            state=BorrowState.TIMEOUT if waited is False else BorrowState.POOL_EXHAUSTED,
                            wait_ms=(time.time() - start) * 1000,
                            used_ms=0,
                        )
                    )
                    raise TimeoutError(f"pool {self.name} exhausted")
            if self._idle:
                c = self._idle.pop()
            else:
                c = self._new_conn()
                self._all.append(c)
            c.borrowed_at = time.time()
            _wait_ms = (time.time() - start) * 1000
            sat = self._saturation()
            if sat >= cfg.saturation_crit:
                self._saturated = True
            return c

    def release(self, c: ConnStub) -> None:
        with self._cond:
            if c in self._all:
                self._idle.append(c)
            used_ms = (time.time() - c.borrowed_at) * 1000 if c.borrowed_at else 0
            self._records.append(
                BorrowRecord(
                    state=BorrowState.OK,
                    wait_ms=0,
                    used_ms=used_ms,
                )
            )
            self._cond.notify()

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "name": self.name,
                "size": len(self._all),
                "idle": len(self._idle),
                "in_use": len(self._all) - len(self._idle),
                "saturation": self._saturation(),
                "saturated": self._saturated,
                "samples": len(self._records),
            }

    def is_saturated(self) -> bool:
        with self._lock:
            return self._saturated

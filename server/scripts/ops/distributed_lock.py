"""Phase 20 建议 4: 分布式锁增强 - Redlock + 续约 + 看门狗 + 公平锁.

目的:
  - 单后端分布式锁 (acquire/release/renew)
  - Redlock 多后端多数派获取
  - 看门狗自动续约 (防止业务未完锁过期)
  - 公平锁 (FIFO 排队)
  - 锁监控 metrics

设计:
  LockBackend (协议):
    set(key, value, ttl_ms) -> bool
    delete(key, value) -> bool       # CAS 删除
    renew(key, value, ttl_ms) -> bool
    ping() -> bool

  InMemoryLockBackend (内存版, 模拟 Redis)

  Lock: 单 key 锁, 持有令牌
  Redlock: N 个 backend, 多数派 (>=N/2+1) 算成功
  Watchdog: 周期性续约, 锁失效时回调
  FairLockQueue: 排队 FIFO, 按获取顺序给锁
  LockManager: 统一管理 + 监控
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

# ---------------------------------------------------------------------------
# 1. 异常
# ---------------------------------------------------------------------------


class LockError(Exception):
    pass


class LockNotAcquiredError(LockError):
    pass


class LockLostError(LockError):
    pass


# ---------------------------------------------------------------------------
# 2. 后端接口与实现
# ---------------------------------------------------------------------------


class LockBackend(Protocol):
    def set(self, key: str, value: str, ttl_ms: int) -> bool: ...
    def delete(self, key: str, value: str) -> bool: ...
    def renew(self, key: str, value: str, ttl_ms: int) -> bool: ...
    def ping(self) -> bool: ...


class InMemoryLockBackend:
    """内存版锁后端, 模拟 Redis setnx + del + expire."""

    def __init__(self, name: str = "memory"):
        self.name = name
        self._store: dict[str, tuple[str, float]] = {}  # key -> (value, expire_at)
        self._lock = threading.Lock()
        self.metrics = {"set_ok": 0, "set_fail": 0, "delete_ok": 0, "delete_fail": 0, "renew_ok": 0, "renew_fail": 0}

    def _now(self) -> float:
        return time.time() * 1000

    def _expired(self, key: str) -> bool:
        if key not in self._store:
            return True
        _, exp = self._store[key]
        return self._now() >= exp

    def set(self, key: str, value: str, ttl_ms: int) -> bool:
        with self._lock:
            if key in self._store and not self._expired(key):
                self.metrics["set_fail"] += 1
                return False
            self._store[key] = (value, self._now() + ttl_ms)
            self.metrics["set_ok"] += 1
            return True

    def delete(self, key: str, value: str) -> bool:
        with self._lock:
            if self._expired(key):
                self._store.pop(key, None)
                self.metrics["delete_fail"] += 1
                return False
            v, _ = self._store[key]
            if v != value:
                self.metrics["delete_fail"] += 1
                return False
            del self._store[key]
            self.metrics["delete_ok"] += 1
            return True

    def renew(self, key: str, value: str, ttl_ms: int) -> bool:
        with self._lock:
            if self._expired(key):
                self.metrics["renew_fail"] += 1
                return False
            v, _ = self._store[key]
            if v != value:
                self.metrics["renew_fail"] += 1
                return False
            self._store[key] = (value, self._now() + ttl_ms)
            self.metrics["renew_ok"] += 1
            return True

    def ping(self) -> bool:
        return True

    def is_locked(self, key: str) -> bool:
        with self._lock:
            return not self._expired(key)


# ---------------------------------------------------------------------------
# 3. 锁对象
# ---------------------------------------------------------------------------


@dataclass
class Lock:
    """单 key 锁."""

    key: str
    backend: LockBackend
    value: str = ""
    ttl_ms: int = 30000
    auto_renew: bool = False
    renew_interval_ms: int = 10000

    def __post_init__(self):
        if not self.value:
            self.value = str(uuid.uuid4())

    def acquire(self, timeout_ms: int = 0) -> bool:
        if self.backend.set(self.key, self.value, self.ttl_ms):
            return True
        if timeout_ms <= 0:
            return False
        deadline = time.time() * 1000 + timeout_ms
        while time.time() * 1000 < deadline:
            time.sleep(0.01)
            if self.backend.set(self.key, self.value, self.ttl_ms):
                return True
        return False

    def release(self) -> bool:
        return self.backend.delete(self.key, self.value)

    def renew(self) -> bool:
        return self.backend.renew(self.key, self.value, self.ttl_ms)

    def is_held(self) -> bool:
        return self.backend.is_locked(self.key)


# ---------------------------------------------------------------------------
# 4. Redlock (多后端多数派)
# ---------------------------------------------------------------------------


class Redlock:
    """Redlock 算法: N 个独立后端, 多数派 (>=N//2+1) 获取成功.

    有效时间 = ttl_ms - (获取耗时)
    """

    def __init__(
        self, backends: list[LockBackend], key: str, ttl_ms: int = 30000, clock: Callable[[], float] | None = None
    ):
        if not backends:
            raise ValueError("至少需要一个后端")
        self.backends = backends
        self.key = key
        self.ttl_ms = ttl_ms
        self.value = str(uuid.uuid4())
        self._majority = len(backends) // 2 + 1
        self._clock = clock or (lambda: time.time() * 1000)
        self._valid_until_ms: float = 0.0

    def acquire(self, timeout_ms: int = 0) -> bool:
        deadline = self._clock() + timeout_ms if timeout_ms > 0 else None
        start = self._clock()
        while True:
            ok_count = 0
            for b in self.backends:
                if b.set(self.key, self.value, self.ttl_ms):
                    ok_count += 1
            elapsed = self._clock() - start
            valid_ms = self.ttl_ms - elapsed
            if ok_count >= self._majority and valid_ms > 0:
                self._valid_until_ms = self._clock() + valid_ms
                return True
            # 失败, 回滚已获取的
            for b in self.backends:
                b.delete(self.key, self.value)
            if deadline is None or self._clock() >= deadline:
                return False
            time.sleep(0.01)

    def release(self) -> bool:
        ok = 0
        for b in self.backends:
            if b.delete(self.key, self.value):
                ok += 1
        return ok >= self._majority

    def valid_until_ms(self) -> float:
        return self._valid_until_ms

    def is_valid(self) -> bool:
        return self._clock() < self._valid_until_ms


# ---------------------------------------------------------------------------
# 5. 看门狗 (自动续约)
# ---------------------------------------------------------------------------


class Watchdog:
    """看门狗: 周期性为锁续约, 业务完成时停止.

    续约失败 (锁丢失) 时触发 on_lost 回调.
    """

    def __init__(
        self,
        lock: Lock,
        on_lost: Callable[[], None] | None = None,
        clock: Callable[[], float] | None = None,
        renew_interval_ms: int | None = None,
    ):
        self.lock = lock
        self.on_lost = on_lost
        self._clock = clock or (lambda: time.time() * 1000)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.lost = False
        if renew_interval_ms is not None:
            self.lock.renew_interval_ms = renew_interval_ms

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self) -> None:
        while not self._stop.wait(self.lock.renew_interval_ms / 1000.0):
            if not self.lock.renew():
                self.lost = True
                if self.on_lost is not None:
                    try:
                        self.on_lost()
                    except Exception:
                        pass
                return

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=1.0)


# ---------------------------------------------------------------------------
# 6. 公平锁 (FIFO 排队)
# ---------------------------------------------------------------------------


class FairLockQueue:
    """单后端公平锁: 按 acquire 调用顺序获取锁.

    内部维护 FIFO 队列, 通过条件变量通知下一个等待者.
    """

    def __init__(self, backend: LockBackend, key: str, ttl_ms: int = 30000):
        self.backend = backend
        self.key = key
        self.ttl_ms = ttl_ms
        self._queue: deque = deque()
        self._cond = threading.Condition()
        self._current_holder: str | None = None

    def acquire(self, timeout_ms: int = 0) -> Lock | None:
        token = str(uuid.uuid4())
        with self._cond:
            self._queue.append(token)
            deadline = None
            if timeout_ms > 0:
                deadline = time.time() * 1000 + timeout_ms
            while self._queue[0] != token or self._current_holder is not None:
                if deadline is not None and time.time() * 1000 >= deadline:
                    self._queue.remove(token)
                    return None
                self._cond.wait(timeout=0.05)
            # 轮到我了, 实际去 backend 拿
            lock = Lock(key=self.key, backend=self.backend, value=token, ttl_ms=self.ttl_ms)
            if not self.backend.set(self.key, token, self.ttl_ms):
                # 后端已被别人持有 (跨进程), 让出
                self._queue.remove(token)
                self._current_holder = None
                self._cond.notify_all()
                return None
            self._current_holder = token
            return lock

    def release(self, lock: Lock) -> None:
        with self._cond:
            if self._current_holder == lock.value:
                self.backend.delete(self.key, lock.value)
                self._current_holder = None
                self._queue.popleft()
                self._cond.notify_all()

    def queue_length(self) -> int:
        with self._cond:
            return len(self._queue)


# ---------------------------------------------------------------------------
# 7. 锁管理器
# ---------------------------------------------------------------------------


class LockManager:
    """锁管理器: 注册/创建锁 + 监控 metrics."""

    def __init__(self):
        self._locks: dict[str, Lock] = {}
        self._watchdogs: dict[str, Watchdog] = {}
        self.metrics = {
            "acquire_ok": 0,
            "acquire_fail": 0,
            "release_ok": 0,
            "release_fail": 0,
            "renew_ok": 0,
            "renew_fail": 0,
            "watchdog_lost": 0,
        }
        self._lock = threading.Lock()

    def make_lock(self, key: str, backend: LockBackend, ttl_ms: int = 30000) -> Lock:
        lock = Lock(key=key, backend=backend, ttl_ms=ttl_ms)
        with self._lock:
            self._locks[key] = lock
        return lock

    def acquire(self, key: str, backend: LockBackend, ttl_ms: int = 30000, timeout_ms: int = 0) -> Lock | None:
        lock = self.make_lock(key, backend, ttl_ms)
        ok = lock.acquire(timeout_ms=timeout_ms)
        with self._lock:
            if ok:
                self.metrics["acquire_ok"] += 1
            else:
                self.metrics["acquire_fail"] += 1
        return lock if ok else None

    def release(self, lock: Lock) -> bool:
        ok = lock.release()
        with self._lock:
            if ok:
                self.metrics["release_ok"] += 1
            else:
                self.metrics["release_fail"] += 1
        return ok

    def start_watchdog(
        self, key: str, on_lost: Callable[[], None] | None = None, renew_interval_ms: int = 10000
    ) -> Watchdog | None:
        with self._lock:
            lock = self._locks.get(key)
            if lock is None:
                return None
            wd = Watchdog(lock, on_lost=self._on_watchdog_lost, renew_interval_ms=renew_interval_ms)
            self._watchdogs[key] = wd
        wd.start()
        return wd

    def _on_watchdog_lost(self) -> None:
        with self._lock:
            self.metrics["watchdog_lost"] += 1

    def stop_watchdog(self, key: str) -> None:
        with self._lock:
            wd = self._watchdogs.pop(key, None)
        if wd is not None:
            wd.stop()

    def report(self) -> dict:
        with self._lock:
            return {
                "locks": list(self._locks.keys()),
                "watchdogs": list(self._watchdogs.keys()),
                "metrics": dict(self.metrics),
            }


# ---------------------------------------------------------------------------
# 8. CLI
# ---------------------------------------------------------------------------


def _demo() -> dict:
    backend_a = InMemoryLockBackend("a")
    backend_b = InMemoryLockBackend("b")
    backend_c = InMemoryLockBackend("c")
    redlock = Redlock([backend_a, backend_b, backend_c], key="redlock:1", ttl_ms=5000)
    ok = redlock.acquire()
    valid_ms = redlock.valid_until_ms() - time.time() * 1000
    redlock.release()
    mgr = LockManager()
    lock = mgr.acquire("simple:1", backend_a, ttl_ms=2000)
    mgr.release(lock)  # type: ignore[arg-type]
    fair = FairLockQueue(backend_a, key="fair:1", ttl_ms=2000)
    l1 = fair.acquire(timeout_ms=100)
    fair.release(l1)  # type: ignore[arg-type]
    return {
        "redlock_acquire": ok,
        "redlock_valid_ms": round(valid_ms, 2) if ok else 0,
        "simple_lock_released": True,
        "fair_queue_length": fair.queue_length(),
        "manager": mgr.report(),
        "backends": {
            "a": backend_a.metrics,
            "b": backend_b.metrics,
            "c": backend_c.metrics,
        },
    }


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="分布式锁增强")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("demo")
    args = p.parse_args(argv)
    if args.cmd == "demo":
        out = _demo()
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())

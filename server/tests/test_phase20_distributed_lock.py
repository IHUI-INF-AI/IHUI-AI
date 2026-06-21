"""Phase 20 建议 4 测试: 分布式锁增强."""

from __future__ import annotations

import json
import sys
import threading
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from distributed_lock import (
        FairLockQueue,
        InMemoryLockBackend,
        Lock,
        LockError,
        LockManager,
        Redlock,
        Watchdog,
        main,
    )

    HAS_MODULE = True
except Exception:  # pragma: no cover
    HAS_MODULE = False


pytestmark = pytest.mark.skipif(not HAS_MODULE, reason="module not importable")


def _last_json(text: str):
    text = text.strip()
    candidates: list[str] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch not in "{[":
            i += 1
            continue
        open_ch = ch
        close_ch = "}" if ch == "{" else "]"
        depth = 0
        in_str = False
        escape = False
        for j in range(i, len(text)):
            c = text[j]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if in_str:
                if c == '"':
                    in_str = False
                continue
            if c == '"':
                in_str = True
                continue
            if c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    candidate = text[i : j + 1]
                    try:
                        json.loads(candidate)
                        candidates.append(candidate)
                    except json.JSONDecodeError:
                        pass
                    i = j + 1
                    break
        else:
            i += 1
    return json.loads(candidates[-1])


# ---------------------------------------------------------------------------
# 1. 异常
# ---------------------------------------------------------------------------


def test_lock_error_is_exception():
    assert issubclass(LockError, Exception)


# ---------------------------------------------------------------------------
# 2. InMemoryLockBackend
# ---------------------------------------------------------------------------


def test_backend_set():
    b = InMemoryLockBackend()
    assert b.set("k", "v", 1000) is True
    assert b.is_locked("k") is True


def test_backend_set_twice_fails():
    b = InMemoryLockBackend()
    assert b.set("k", "v1", 1000) is True
    assert b.set("k", "v2", 1000) is False


def test_backend_delete():
    b = InMemoryLockBackend()
    b.set("k", "v", 1000)
    assert b.delete("k", "v") is True
    assert b.is_locked("k") is False


def test_backend_delete_wrong_value():
    b = InMemoryLockBackend()
    b.set("k", "v1", 1000)
    assert b.delete("k", "v2") is False


def test_backend_renew():
    b = InMemoryLockBackend()
    b.set("k", "v", 1000)
    assert b.renew("k", "v", 5000) is True


def test_backend_renew_wrong_value():
    b = InMemoryLockBackend()
    b.set("k", "v1", 1000)
    assert b.renew("k", "v2", 5000) is False


def test_backend_ttl_expiry():
    b = InMemoryLockBackend()
    b.set("k", "v", 50)  # 50ms
    time.sleep(0.1)
    assert b.is_locked("k") is False
    # 现在可以重新 set
    assert b.set("k", "v2", 1000) is True


def test_backend_ping():
    b = InMemoryLockBackend()
    assert b.ping() is True


# ---------------------------------------------------------------------------
# 3. Lock
# ---------------------------------------------------------------------------


def test_lock_acquire_release():
    b = InMemoryLockBackend()
    lock = Lock(key="k", backend=b, ttl_ms=1000)
    assert lock.acquire() is True
    assert lock.release() is True


def test_lock_acquire_timeout():
    b = InMemoryLockBackend()
    b.set("k", "other", 5000)
    lock = Lock(key="k", backend=b, ttl_ms=1000)
    assert lock.acquire(timeout_ms=100) is False


def test_lock_acquire_with_wait():
    b = InMemoryLockBackend()
    b.set("k", "other", 50)
    lock = Lock(key="k", backend=b, ttl_ms=1000)
    assert lock.acquire(timeout_ms=500) is True


def test_lock_renew():
    b = InMemoryLockBackend()
    lock = Lock(key="k", backend=b, ttl_ms=1000)
    lock.acquire()
    assert lock.renew() is True


def test_lock_renew_after_release():
    b = InMemoryLockBackend()
    lock = Lock(key="k", backend=b, ttl_ms=1000)
    lock.acquire()
    lock.release()
    assert lock.renew() is False


def test_lock_is_held():
    b = InMemoryLockBackend()
    lock = Lock(key="k", backend=b, ttl_ms=1000)
    lock.acquire()
    assert lock.is_held() is True
    lock.release()
    assert lock.is_held() is False


# ---------------------------------------------------------------------------
# 4. Redlock
# ---------------------------------------------------------------------------


def test_redlock_acquire_release():
    backs = [InMemoryLockBackend(f"b{i}") for i in range(3)]
    r = Redlock(backs, key="k", ttl_ms=5000)
    assert r.acquire() is True
    assert r.is_valid() is True
    assert r.release() is True


def test_redlock_majority():
    """2/3 后端 OK 时仍能获取 (多数派)."""
    backs = [InMemoryLockBackend(f"b{i}") for i in range(3)]
    # 预占用其中 1 个
    backs[0].set("k", "other", 5000)
    r = Redlock(backs, key="k", ttl_ms=5000)
    # 2/3 OK, 仍能获取
    assert r.acquire() is True


def test_redlock_fail_no_majority():
    """少于多数派时获取失败."""
    backs = [InMemoryLockBackend(f"b{i}") for i in range(3)]
    backs[0].set("k", "other", 5000)
    backs[1].set("k", "other", 5000)
    r = Redlock(backs, key="k", ttl_ms=5000)
    assert r.acquire(timeout_ms=100) is False


def test_redlock_validity():
    backs = [InMemoryLockBackend(f"b{i}") for i in range(3)]
    r = Redlock(backs, key="k", ttl_ms=2000)
    r.acquire()
    assert r.is_valid() is True
    valid = r.valid_until_ms()
    assert valid > 0


def test_redlock_minimum_backends():
    with pytest.raises(ValueError):
        Redlock([], key="k", ttl_ms=1000)


# ---------------------------------------------------------------------------
# 5. Watchdog
# ---------------------------------------------------------------------------


def test_watchdog_renews():
    b = InMemoryLockBackend()
    lock = Lock(key="k", backend=b, ttl_ms=2000)
    lock.acquire()
    wd = Watchdog(lock, renew_interval_ms=100)
    wd.start()
    time.sleep(0.3)  # 至少续约 2 次
    wd.stop()
    # 锁应该还活着
    assert lock.is_held() is True


def test_watchdog_detects_lost():
    b = InMemoryLockBackend()
    lock = Lock(key="k", backend=b, ttl_ms=100)
    lock.acquire()
    # 主动释放, 让 watchdog 续约失败
    lost_called = threading.Event()
    wd = Watchdog(
        lock, on_lost=lambda: lost_called.set(), clock=lambda: __import__("time").time() * 1000, renew_interval_ms=50
    )
    wd.start()
    time.sleep(0.1)
    lock.release()
    time.sleep(0.3)  # 等 watchdog 检测
    wd.stop()
    assert lost_called.is_set() is True or wd.lost is True


# ---------------------------------------------------------------------------
# 6. FairLockQueue
# ---------------------------------------------------------------------------


def test_fair_lock_basic():
    b = InMemoryLockBackend()
    fair = FairLockQueue(b, key="k", ttl_ms=2000)
    lock = fair.acquire(timeout_ms=100)
    assert lock is not None
    fair.release(lock)
    assert fair.queue_length() == 0


def test_fair_lock_fifo():
    """两个并发获取, 第二个会等第一个释放."""
    b = InMemoryLockBackend()
    fair = FairLockQueue(b, key="k", ttl_ms=2000)
    l1 = fair.acquire(timeout_ms=100)
    assert l1 is not None
    results = []

    def worker():
        l2 = fair.acquire(timeout_ms=2000)
        if l2 is not None:
            results.append("got")
            fair.release(l2)
        else:
            results.append("timeout")

    t = threading.Thread(target=worker)
    t.start()
    time.sleep(0.1)  # 让 worker 进入等待
    fair.release(l1)
    t.join(timeout=2.0)
    assert "got" in results


def test_fair_lock_queue_length():
    b = InMemoryLockBackend()
    fair = FairLockQueue(b, key="k", ttl_ms=2000)
    l1 = fair.acquire(timeout_ms=100)
    assert l1 is not None
    assert fair.queue_length() == 1
    fair.release(l1)
    assert fair.queue_length() == 0


# ---------------------------------------------------------------------------
# 7. LockManager
# ---------------------------------------------------------------------------


def test_manager_acquire_release():
    b = InMemoryLockBackend()
    mgr = LockManager()
    lock = mgr.acquire("k", b, ttl_ms=2000)
    assert lock is not None
    assert mgr.release(lock) is True


def test_manager_metrics():
    b = InMemoryLockBackend()
    mgr = LockManager()
    lock = mgr.acquire("k", b, ttl_ms=2000)
    mgr.release(lock)
    rep = mgr.report()
    assert rep["metrics"]["acquire_ok"] == 1
    assert rep["metrics"]["release_ok"] == 1


def test_manager_acquire_fail():
    b = InMemoryLockBackend()
    b.set("k", "other", 5000)
    mgr = LockManager()
    lock = mgr.acquire("k", b, ttl_ms=1000, timeout_ms=50)
    assert lock is None
    assert mgr.report()["metrics"]["acquire_fail"] == 1


def test_manager_watchdog():
    b = InMemoryLockBackend()
    mgr = LockManager()
    lock = mgr.acquire("k", b, ttl_ms=2000)
    assert lock is not None
    wd = mgr.start_watchdog("k", renew_interval_ms=100)
    assert wd is not None
    time.sleep(0.2)
    mgr.stop_watchdog("k")
    assert lock.is_held() is True


# ---------------------------------------------------------------------------
# 8. CLI
# ---------------------------------------------------------------------------


def test_cli_demo(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["redlock_acquire"] is True
    assert data["redlock_valid_ms"] > 0
    assert "b" in data["backends"]

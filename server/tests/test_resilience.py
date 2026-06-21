"""测试服务韧性模块 — 熔断 / 限流 / 降级 / 隔离 / 超时."""

import asyncio
import time

import pytest

from app.resilience import (
    CircuitBreaker,
    CircuitBreakerOpen,
    TokenBucketRateLimit,
    bulkhead,
    circuit,
    degraded_mode,
    get_bulkhead,
    get_circuit,
    get_limiter,
    rate_limit,
    with_timeout,
)

# ---------------------------------------------------------------------------
# CircuitBreaker
# ---------------------------------------------------------------------------


class TestCircuitBreaker:
    def test_closed_initially(self):
        cb = CircuitBreaker("test-cb-1")
        assert cb.state == "closed"
        assert cb.allow() is True

    def test_open_after_threshold(self):
        cb = CircuitBreaker("test-cb-2", failure_threshold=3, reset_timeout=10)
        for _ in range(3):
            cb.record_failure()
        assert cb.state == "open"
        assert cb.allow() is False

    def test_half_open_after_timeout(self):
        cb = CircuitBreaker("test-cb-3", failure_threshold=1, reset_timeout=0.05, success_threshold=1)
        cb.record_failure()
        assert cb.state == "open"
        time.sleep(0.06)
        # 再次 allow 会触发 HALF_OPEN
        assert cb.allow() is True
        assert cb.state == "half_open"

    def test_half_open_to_closed_on_success(self):
        cb = CircuitBreaker("test-cb-4", failure_threshold=1, reset_timeout=0.05, success_threshold=1)
        cb.record_failure()
        time.sleep(0.06)
        cb.allow()  # → HALF_OPEN
        cb.record_success()
        assert cb.state == "closed"

    def test_half_open_to_open_on_failure(self):
        cb = CircuitBreaker("test-cb-5", failure_threshold=1, reset_timeout=0.05, success_threshold=1)
        cb.record_failure()
        time.sleep(0.06)
        cb.allow()  # HALF_OPEN
        cb.record_failure()
        assert cb.state == "open"

    def test_call_sync_function_success(self):
        cb = CircuitBreaker("test-cb-6", failure_threshold=2)
        r = cb.call(lambda: 42)
        assert r == 42
        assert cb.state == "closed"

    def test_call_sync_function_failure(self):
        cb = CircuitBreaker("test-cb-7", failure_threshold=1)
        with pytest.raises(ValueError):
            cb.call(lambda: (_ for _ in ()).throw(ValueError("boom")))
        assert cb.state == "open"

    def test_call_rejected_when_open(self):
        cb = CircuitBreaker("test-cb-8", failure_threshold=1)
        cb.record_failure()
        with pytest.raises(CircuitBreakerOpen):
            cb.call(lambda: 42)

    async def test_acall_async(self):
        cb = CircuitBreaker("test-cb-9", failure_threshold=2)
        r = await cb.acall(lambda: asyncio.sleep(0, result=10))
        assert r == 10
        assert cb.state == "closed"

    async def test_acall_failure_then_open(self):
        cb = CircuitBreaker("test-cb-10", failure_threshold=1)

        async def boom():
            raise RuntimeError("downstream down")

        with pytest.raises(RuntimeError):
            await cb.acall(boom)
        assert cb.state == "open"

    def test_reset(self):
        cb = CircuitBreaker("test-cb-11", failure_threshold=1)
        cb.record_failure()
        assert cb.state == "open"
        cb.reset()
        assert cb.state == "closed"
        assert cb.allow() is True

    def test_snapshot(self):
        cb = CircuitBreaker("test-cb-12")
        snap = cb.snapshot()
        assert snap["name"] == "test-cb-12"
        assert snap["state"] == "closed"
        assert "stats" in snap

    def test_circuit_decorator_sync(self):
        from app.resilience import _CIRCUITS

        _CIRCUITS.pop("decorator-test-sync", None)

        @circuit("decorator-test-sync", failure_threshold=2)
        def work(x):
            if x < 0:
                raise ValueError("neg")
            return x * 2

        assert work(2) == 4
        with pytest.raises(ValueError):
            work(-1)
        with pytest.raises(ValueError):
            work(-2)  # 第 2 次失败
        # 第 3 次调用应被熔断拒绝
        with pytest.raises(CircuitBreakerOpen):
            work(5)

    def test_circuit_decorator_async(self):
        from app.resilience import _CIRCUITS

        _CIRCUITS.pop("decorator-test-async", None)

        @circuit("decorator-test-async", failure_threshold=2)
        async def work(x):
            if x < 0:
                raise ValueError("neg")
            return x * 2

        async def run():
            assert await work(2) == 4
            with pytest.raises(ValueError):
                await work(-1)
            with pytest.raises(ValueError):
                await work(-2)
            with pytest.raises(CircuitBreakerOpen):
                await work(5)

        asyncio.run(run())

    def test_get_circuit_singleton(self):
        c1 = get_circuit("singleton-test")
        c2 = get_circuit("singleton-test")
        assert c1 is c2


# ---------------------------------------------------------------------------
# TokenBucketRateLimit
# ---------------------------------------------------------------------------


class TestRateLimit:
    def test_initial_tokens_full(self):
        rl = TokenBucketRateLimit("rl-1", capacity=5, refill_rate=1)
        for _ in range(5):
            assert rl.acquire() is True
        # 第 6 次被拒
        assert rl.acquire() is False

    def test_refill(self):
        rl = TokenBucketRateLimit("rl-2", capacity=2, refill_rate=10)  # 100ms 1 个
        rl.acquire()
        rl.acquire()
        assert rl.acquire() is False
        time.sleep(0.15)
        assert rl.acquire() is True  # 补充了 1+

    def test_burst(self):
        rl = TokenBucketRateLimit("rl-3", capacity=10, refill_rate=1)
        # 一次性扣 5 个
        assert rl.acquire(5) is True
        assert rl.acquire(5) is True
        assert rl.acquire(1) is False

    async def test_aacquire(self):
        rl = TokenBucketRateLimit("rl-4", capacity=1, refill_rate=100)
        assert await rl.aacquire() is True
        assert await rl.aacquire() is False

    def test_get_limiter_singleton(self):
        l1 = get_limiter("singleton-rl")
        l2 = get_limiter("singleton-rl")
        assert l1 is l2

    def test_rate_limit_decorator_sync(self):
        from app.resilience import _LIMITERS

        _LIMITERS.pop("rl-deco-sync", None)
        counter = {"n": 0}

        @rate_limit("rl-deco-sync", capacity=2, refill_rate=0.001)
        def hot():
            counter["n"] += 1
            return counter["n"]

        assert hot() == 1
        assert hot() == 2
        with pytest.raises(RuntimeError, match="rate limit"):
            hot()

    def test_rate_limit_decorator_with_fallback(self):
        from app.resilience import _LIMITERS

        _LIMITERS.pop("rl-deco-fb", None)
        rl = get_limiter("rl-deco-fb", capacity=1, refill_rate=0.001)
        rl.acquire()  # 用完

        @rate_limit("rl-deco-fb", capacity=1, refill_rate=0.001, on_reject=lambda: "fallback")
        def hot():
            return "real"

        assert hot() == "fallback"

    def test_snapshot(self):
        from app.resilience import _LIMITERS

        _LIMITERS.pop("rl-snap-fresh", None)
        rl = TokenBucketRateLimit("rl-snap-fresh", capacity=10, refill_rate=1)
        rl.acquire(3)
        snap = rl.snapshot()
        assert snap["capacity"] == 10
        assert snap["stats"]["allowed"] == 3
        assert 6.0 < snap["current_tokens"] < 8.0  # 7 左右


# ---------------------------------------------------------------------------
# degraded_mode
# ---------------------------------------------------------------------------


class TestDegradedMode:
    def test_sync_success(self):
        @degraded_mode(fallback="FB")
        def work(x):
            return x * 2

        assert work(2) == 4

    def test_sync_failure_returns_fallback(self):
        @degraded_mode(fallback="FB", exceptions=(ValueError,))
        def work():
            raise ValueError("boom")

        assert work() == "FB"

    def test_sync_other_exception_propagates(self):
        @degraded_mode(fallback="FB", exceptions=(ValueError,))
        def work():
            raise RuntimeError("different")

        with pytest.raises(RuntimeError):
            work()

    async def test_async_success(self):
        @degraded_mode(fallback=[])
        async def fetch():
            return [1, 2, 3]

        assert await fetch() == [1, 2, 3]

    async def test_async_failure(self):
        @degraded_mode(fallback=[], exceptions=(ConnectionError,))
        async def fetch():
            raise ConnectionError("net down")

        assert await fetch() == []


# ---------------------------------------------------------------------------
# bulkhead
# ---------------------------------------------------------------------------


class TestBulkhead:
    async def test_limits_concurrency(self):
        sem = get_bulkhead("bh-test", max_concurrent=2)
        # 释放已有 sem (其他测试可能占用)
        # 这里用一个新名字
        from app.resilience import _BULKHEADS

        _BULKHEADS["bh-test-2"] = asyncio.Semaphore(2)

        active = 0
        max_active = 0

        @bulkhead("bh-test-2", max_concurrent=2)
        async def slow():
            nonlocal active, max_active
            active += 1
            max_active = max(max_active, active)
            await asyncio.sleep(0.05)
            active -= 1
            return 1

        # 并发 5 个, 应当被限到 2 个
        await asyncio.gather(*[slow() for _ in range(5)])
        assert max_active == 2, f"max active should be 2, got {max_active}"


# ---------------------------------------------------------------------------
# with_timeout
# ---------------------------------------------------------------------------


class TestWithTimeout:
    async def test_success(self):
        @with_timeout(0.5)
        async def fast():
            await asyncio.sleep(0.01)
            return "ok"

        assert await fast() == "ok"

    async def test_timeout(self):
        @with_timeout(0.05)
        async def slow():
            await asyncio.sleep(1)
            return "too late"

        with pytest.raises(asyncio.TimeoutError):
            await slow()


# ---------------------------------------------------------------------------
# /resilience 端点
# ---------------------------------------------------------------------------


class TestResilienceEndpoint:
    async def test_resilience_snapshot(self, client):
        resp = await client.get("/resilience")
        assert resp.status_code == 200
        data = resp.json()
        assert "circuits" in data
        assert "limiters" in data

    async def test_reset_circuit(self, client):
        # 先创建一个熔断器
        cb = get_circuit("reset-test", failure_threshold=1)
        cb.record_failure()
        assert cb.state == "open"

        resp = await client.post("/resilience/reset/reset-test")
        assert resp.status_code == 200
        data = resp.json()
        assert data["reset"] == "reset-test"
        assert data["state"] == "closed"

    async def test_reset_unknown_circuit(self, client):
        resp = await client.post("/resilience/reset/nonexistent")
        assert resp.status_code == 404

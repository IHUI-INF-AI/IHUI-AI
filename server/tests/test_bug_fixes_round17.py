"""第十七轮 灾备与韧性 Bug 主动巡检 - 单元测试 (Bug-167 ~ Bug-184).

6 维度 18 个 Bug 全部覆盖.
"""

import time
import unittest


# =====================================================================
# 维度 1: 混沌测试 (Bug-167/168/169)
# =====================================================================
class TestBug167Chaos(unittest.TestCase):
    def test_add_and_disable(self):
        from app.utils.chaos import ChaosInjector, FaultRule, FaultType

        g = ChaosInjector(seed=1)
        g.add(FaultRule(target="svc.a", fault=FaultType.LATENCY, latency_ms=5, probability=1.0))
        g.disable("svc.a")
        # 禁用后 wrap 不抛
        r = g.wrap("svc.a", lambda: 42)
        self.assertEqual(r, 42)

    def test_latency_inject(self):
        from app.utils.chaos import ChaosInjector, FaultRule, FaultType

        g = ChaosInjector(seed=1)
        g.add(FaultRule(target="svc.b", fault=FaultType.LATENCY, latency_ms=20, probability=1.0))
        start = time.time()
        g.wrap("svc.b", lambda: None)
        elapsed = (time.time() - start) * 1000
        self.assertGreaterEqual(elapsed, 18)

    def test_exception_inject(self):
        from app.utils.chaos import ChaosInjector, FaultRule, FaultType

        g = ChaosInjector(seed=1)
        g.add(
            FaultRule(
                target="svc.c",
                fault=FaultType.EXCEPTION,
                exception_cls=ValueError,
                exception_msg="boom",
                probability=1.0,
            )
        )
        with self.assertRaises(ValueError):
            g.wrap("svc.c", lambda: 1)

    def test_stats(self):
        from app.utils.chaos import ChaosInjector, FaultRule, FaultType

        g = ChaosInjector(seed=1)
        g.add(
            FaultRule(
                target="x", fault=FaultType.EXCEPTION, probability=1.0, exception_cls=RuntimeError, exception_msg="x"
            )
        )
        try:
            g.wrap("x", lambda: None)
        except Exception:
            pass
        try:
            g.wrap("x", lambda: None)
        except Exception:
            pass
        st = g.stats()
        self.assertEqual(st["x"]["hit"], 2)


class TestBug168Degrade(unittest.TestCase):
    def test_full_path(self):
        from app.utils.degrade import DegradeChain

        g = DegradeChain("x")
        r = g.execute(lambda: "primary")
        self.assertEqual(r.value, "primary")
        self.assertEqual(r.level.value, "FULL")

    def test_fallback_default(self):
        from app.utils.degrade import DegradeChain

        g = DegradeChain("x", default="DEFAULT-VAL")
        r = g.execute(lambda: (_ for _ in ()).throw(RuntimeError("boom")))
        self.assertEqual(r.level.value, "DEFAULT")
        self.assertEqual(r.value, "DEFAULT-VAL")

    def test_fallback_cache(self):
        from app.utils.degrade import DegradeChain

        g = DegradeChain("x", cache_get=lambda: "CACHED", default="D")
        r = g.execute(lambda: (_ for _ in ()).throw(RuntimeError("boom")))
        self.assertEqual(r.level.value, "CACHE")
        self.assertEqual(r.value, "CACHED")

    def test_fail(self):
        from app.utils.degrade import DegradeChain

        g = DegradeChain("x")
        r = g.execute(lambda: (_ for _ in ()).throw(RuntimeError("boom")))
        self.assertEqual(r.level.value, "FAIL")
        self.assertIn("RuntimeError", r.err)


class TestBug169Retry(unittest.TestCase):
    def test_success_first_try(self):
        from app.utils.retry import Retrier, RetryConfig

        g = Retrier(RetryConfig(max_attempts=3))
        r = g.call(lambda: 42)
        self.assertTrue(r.ok)
        self.assertEqual(r.attempts, 1)

    def test_retry_then_success(self):
        from app.utils.retry import Retrier, RetryConfig

        counter = {"n": 0}

        def fn():
            counter["n"] += 1
            if counter["n"] < 3:
                raise RuntimeError("retry")
            return "ok"

        g = Retrier(RetryConfig(max_attempts=5, base_delay_ms=1, max_delay_ms=2))
        r = g.call(fn)
        self.assertTrue(r.ok)
        self.assertEqual(r.attempts, 3)
        self.assertEqual(len(r.delays_ms), 2)

    def test_exhausted(self):
        from app.utils.retry import Retrier, RetryConfig

        g = Retrier(RetryConfig(max_attempts=3, base_delay_ms=1))
        r = g.call(lambda: (_ for _ in ()).throw(RuntimeError("always")))
        self.assertFalse(r.ok)
        self.assertEqual(r.attempts, 3)
        self.assertEqual(g.stats()["exhausted"], 1)

    def test_non_retriable(self):
        from app.utils.retry import Retrier, RetryConfig

        g = Retrier(RetryConfig(max_attempts=3, retriable=(ValueError,)))
        r = g.call(lambda: (_ for _ in ()).throw(KeyError("k")))
        self.assertFalse(r.ok)
        self.assertEqual(r.attempts, 1)
        self.assertEqual(g.stats()["non_retriable"], 1)


# =====================================================================
# 维度 2: 数据库容灾 (Bug-170/171/172)
# =====================================================================
class TestBug170DbFailover(unittest.TestCase):
    def test_init_with_master(self):
        from app.utils.db_failover import DbRole, FailoverManager

        m = FailoverManager()
        m.add("db1", role=DbRole.MASTER, priority=100)
        m.add("db2", role=DbRole.SLAVE, priority=90)
        st = m.status()
        self.assertEqual(st["db1"]["role"], "MASTER")
        self.assertEqual(st["db2"]["role"], "SLAVE")

    def test_failover_on_master_down(self):
        from app.utils.db_failover import DbRole, FailoverManager

        m = FailoverManager()
        m.add("db1", role=DbRole.MASTER, priority=100)
        m.add("db2", role=DbRole.SLAVE, priority=90)
        # 模拟主库连续失败
        for _ in range(3):
            m.heartbeat("db1", ok=False)
        st = m.status()
        self.assertEqual(st["db2"]["role"], "MASTER")

    def test_force_failover(self):
        from app.utils.db_failover import DbRole, FailoverManager

        m = FailoverManager()
        m.add("db1", role=DbRole.MASTER, priority=100)
        m.add("db2", role=DbRole.SLAVE, priority=50)
        m.add("db3", role=DbRole.SLAVE, priority=80)
        new = m.force_failover()
        self.assertEqual(new, "db3")  # 优先级 80 最高
        self.assertEqual(m.status()["db3"]["role"], "MASTER")


class TestBug171ReplicaRouter(unittest.TestCase):
    def test_write_to_master(self):
        from app.utils.replica_router import QueryType, ReplicaRouter

        r = ReplicaRouter()
        r.set_nodes("m1", ["f1", "f2"])
        d = r.route(QueryType.WRITE)
        self.assertTrue(d.is_master)
        self.assertEqual(d.target, "m1")

    def test_read_to_follower(self):
        from app.utils.replica_router import QueryType, ReplicaRouter

        r = ReplicaRouter()
        r.set_nodes("m1", ["f1", "f2"])
        d = r.route(QueryType.READ)
        self.assertFalse(d.is_master)
        self.assertIn(d.target, ("f1", "f2"))

    def test_consistency_force_master(self):
        from app.utils.replica_router import QueryType, ReplicaRouter

        r = ReplicaRouter()
        r.set_nodes("m1", ["f1"])
        d = r.route(QueryType.READ, consistency=True)
        self.assertTrue(d.is_master)

    def test_follower_down_fallback(self):
        from app.utils.replica_router import QueryType, ReplicaRouter

        r = ReplicaRouter()
        r.set_nodes("m1", ["f1", "f2"])
        r.update_health("f1", healthy=False)
        r.update_health("f2", healthy=False)
        d = r.route(QueryType.READ)
        self.assertEqual(d.target, "m1")
        self.assertEqual(d.reason, "follower-fallback")


class TestBug172FollowerGuard(unittest.TestCase):
    def test_acquire_release(self):
        from app.utils.follower_guard import FollowerGuard, FollowerGuardConfig

        cfg = FollowerGuardConfig(max_lag_sec=5, max_inflight=10)
        g = FollowerGuard(cfg)
        self.assertTrue(g.acquire("f1"))
        g.release("f1")
        self.assertTrue(g.acquire("f1"))

    def test_lag_blocked(self):
        from app.utils.follower_guard import FollowerGuard, FollowerGuardConfig

        cfg = FollowerGuardConfig(max_lag_sec=5, max_inflight=10, recovery_sec=100)
        g = FollowerGuard(cfg)
        self.assertTrue(g.report_lag("f1", 0.5))
        self.assertFalse(g.report_lag("f1", 100.0))  # 阻断
        self.assertFalse(g.acquire("f1"))

    def test_inflight_limit(self):
        from app.utils.follower_guard import FollowerGuard, FollowerGuardConfig

        cfg = FollowerGuardConfig(max_inflight=2)
        g = FollowerGuard(cfg)
        self.assertTrue(g.acquire("f1"))
        self.assertTrue(g.acquire("f1"))
        self.assertFalse(g.acquire("f1"))  # 超限
        g.release("f1")
        self.assertTrue(g.acquire("f1"))


# =====================================================================
# 维度 3: Redis 容灾 (Bug-173/174/175)
# =====================================================================
class TestBug173SingleFlight(unittest.TestCase):
    def test_merged(self):
        from app.utils.singleflight import SingleFlight

        g = SingleFlight()
        v1, from_cache1 = g.do("k1", lambda: "v")
        v2, from_cache2 = g.do("k1", lambda: "DIFFERENT")
        self.assertEqual(v1, "v")
        self.assertEqual(v2, "v")
        self.assertFalse(from_cache1)
        self.assertTrue(from_cache2)
        st = g.stats()
        self.assertEqual(st["executed"], 1)
        self.assertGreaterEqual(st["merged"], 1)


class TestBug174Avalanche(unittest.TestCase):
    def test_jitter(self):
        from app.utils.avalanche import AvalancheConfig, AvalancheGuard

        g = AvalancheGuard(AvalancheConfig(base_ttl=300, jitter_pct=0.2))
        results = {g.ttl("k") for _ in range(100)}
        # TTL 抖动至少产生 2 个不同值
        self.assertGreater(len(results), 1)

    def test_register_and_tick(self):
        from app.utils.avalanche import AvalancheConfig, AvalancheGuard

        g = AvalancheGuard(AvalancheConfig(base_ttl=300, preload_ahead_sec=1))
        g.register("k1", ttl=300)  # 300 秒后过期, 离 preload 提前量 1 秒太远
        out = g.tick()
        self.assertEqual(out, [])
        g.register("k2", ttl=0)  # 立即过期
        out2 = g.tick()
        self.assertIn("k2", out2)

    def test_stats(self):
        from app.utils.avalanche import AvalancheGuard

        g = AvalancheGuard()
        g.register("k1", ttl=300)
        st = g.stats()
        self.assertEqual(st["tracked"], 1)


class TestBug175RedisSentinel(unittest.TestCase):
    def test_init_master(self):
        from app.utils.redis_sentinel import RedisSentinel

        g = RedisSentinel()
        g.add("m1", is_master=True)
        g.add("r1")
        g.add("r2")
        self.assertEqual(g.get_master(), "m1")

    def test_failover(self):
        from app.utils.redis_sentinel import RedisSentinel

        g = RedisSentinel()
        g.add("m1", is_master=True)
        g.add("r1")
        g.add("r2")
        ev = g.report("m1", ok=False)
        self.assertIsNotNone(ev)
        self.assertEqual(ev.new_master in ("r1", "r2"), True)
        self.assertNotEqual(g.get_master(), "m1")

    def test_attach(self):
        from app.utils.redis_sentinel import RedisSentinel

        g = RedisSentinel()
        g.add("m1", is_master=True)
        m = g.attach("client1")
        self.assertEqual(m, "m1")


# =====================================================================
# 维度 4: 多活容灾 (Bug-176/177/178)
# =====================================================================
class TestBug176GeoRouter(unittest.TestCase):
    def test_local(self):
        from app.utils.geo_router import GeoRouter, Region

        g = GeoRouter()
        g.add(Region(id="cn", distance={"us": 12000}))
        g.add(Region(id="us", distance={"cn": 12000}))
        r = g.route("cn")
        self.assertEqual(r.target_region, "cn")
        self.assertEqual(r.reason, "local")

    def test_fallback(self):
        from app.utils.geo_router import GeoRouter, Region

        g = GeoRouter()
        g.add(Region(id="cn", distance={"us": 12000}))
        g.add(Region(id="us", distance={"cn": 12000}))
        g.set_health("cn", False)
        r = g.route("cn")
        self.assertEqual(r.target_region, "us")
        self.assertEqual(r.reason, "nearest-healthy")

    def test_no_healthy(self):
        from app.utils.geo_router import GeoRouter, Region

        g = GeoRouter()
        g.add(Region(id="cn"))
        g.set_health("cn", False)
        with self.assertRaises(RuntimeError):
            g.route("cn")


class TestBug177Replication(unittest.TestCase):
    def test_write_replicate(self):
        from app.utils.replication import CrossRegionReplicator

        g = CrossRegionReplicator()
        g.write("k1", "v1", region="cn")
        log = next(iter([l for l in [g.read("k1")] if l]), None)
        self.assertEqual(log.value, "v1")
        self.assertEqual(log.source, "cn")

    def test_replicate_drops_old(self):
        from app.utils.replication import CrossRegionReplicator, ReplicaLog

        g = CrossRegionReplicator()
        g.write("k1", "v1", region="cn")
        # 同 region 同 version 的旧日志应被丢
        old = ReplicaLog(key="k1", value="v0", version=0, source="cn")
        self.assertFalse(g.replicate(old))

    def test_conflict(self):
        from app.utils.replication import CrossRegionReplicator, ReplicaLog

        g = CrossRegionReplicator()
        g.write("k1", "v1", region="cn")
        g.write("k1", "v2", region="us")
        # 远端 us 再写一次, 与 cn 冲突
        log = ReplicaLog(key="k1", value="v3", version=3, source="us")
        self.assertTrue(g.replicate(log))
        self.assertGreaterEqual(g.stats()["conflicts"], 1)


class TestBug178Consistency(unittest.TestCase):
    def test_force_master_after_write(self):
        from app.utils.consistency_window import ConsistencyConfig, ConsistencyWindow

        cfg = ConsistencyConfig(window_sec=10)
        g = ConsistencyWindow(cfg)
        g.mark("k1", region="cn")
        self.assertFalse(g.can_read_follower("k1", region="us"))
        self.assertTrue(g.can_read_follower("k1", region="cn"))

    def test_window_expire(self):
        from app.utils.consistency_window import ConsistencyConfig, ConsistencyWindow

        cfg = ConsistencyConfig(window_sec=0.1)
        g = ConsistencyWindow(cfg)
        g.mark("k1", region="cn")
        time.sleep(0.2)
        self.assertTrue(g.can_read_follower("k1", region="us"))

    def test_no_mark(self):
        from app.utils.consistency_window import ConsistencyWindow

        g = ConsistencyWindow()
        self.assertTrue(g.can_read_follower("k1", region="us"))


# =====================================================================
# 维度 5: 限流降级 (Bug-179/180/181)
# =====================================================================
class TestBug179TokenBucket(unittest.TestCase):
    def test_burst_then_throttle(self):
        from app.utils.token_bucket import TokenBucketConfig, TokenBucketLimiter

        cfg = TokenBucketConfig(capacity=5, refill_rate=1)
        g = TokenBucketLimiter(cfg)
        # 突发 5 个全过
        for _ in range(5):
            self.assertTrue(g.acquire("k"))
        # 第 6 个应被拒
        self.assertFalse(g.acquire("k"))
        st = g.stats()
        self.assertEqual(st["allowed"], 5)
        self.assertEqual(st["denied"], 1)

    def test_refill(self):
        from app.utils.token_bucket import TokenBucketConfig, TokenBucketLimiter

        cfg = TokenBucketConfig(capacity=10, refill_rate=100)
        g = TokenBucketLimiter(cfg)
        for _ in range(10):
            g.acquire("k")
        time.sleep(0.05)  # ~5 tokens
        self.assertTrue(g.acquire("k"))


class TestBug180SlidingWindow(unittest.TestCase):
    def test_basic(self):
        from app.utils.sliding_window import SlidingWindowConfig, SlidingWindowLimiter

        cfg = SlidingWindowConfig(window_sec=1.0, max_count=3)
        g = SlidingWindowLimiter(cfg)
        self.assertTrue(g.acquire("k"))
        self.assertTrue(g.acquire("k"))
        self.assertTrue(g.acquire("k"))
        self.assertFalse(g.acquire("k"))  # 第 4 个被拒

    def test_window_slide(self):
        from app.utils.sliding_window import SlidingWindowConfig, SlidingWindowLimiter

        cfg = SlidingWindowConfig(window_sec=0.1, max_count=2)
        g = SlidingWindowLimiter(cfg)
        self.assertTrue(g.acquire("k"))
        self.assertTrue(g.acquire("k"))
        self.assertFalse(g.acquire("k"))
        time.sleep(0.15)
        self.assertTrue(g.acquire("k"))


class TestBug181Adaptive(unittest.TestCase):
    def test_initial_qps(self):
        from app.utils.adaptive import AdaptiveLimiter

        g = AdaptiveLimiter()
        # 默认 100, 100 个全过
        for _ in range(100):
            self.assertTrue(g.acquire())
        self.assertFalse(g.acquire())

    def test_step_down(self):
        from app.utils.adaptive import AdaptiveConfig, AdaptiveLimiter

        cfg = AdaptiveConfig(initial_qps=100, p99_target_ms=100, step_down=0.5, cooldown_sec=0)
        g = AdaptiveLimiter(cfg)
        # 上报高 P99
        g.report(p99_ms=500, err_rate=0.0)
        # qps 应降低
        st = g.stats()
        self.assertLess(st["qps"], 100)

    def test_step_up(self):
        from app.utils.adaptive import AdaptiveConfig, AdaptiveLimiter

        cfg = AdaptiveConfig(initial_qps=10, max_qps=1000, p99_target_ms=200, step_up=2.0, cooldown_sec=0)
        g = AdaptiveLimiter(cfg)
        g.report(p99_ms=10, err_rate=0.0)
        st = g.stats()
        self.assertGreater(st["qps"], 10)


# =====================================================================
# 维度 6: 优雅生命周期 (Bug-182/183/184)
# =====================================================================
class TestBug182GracefulShutdown(unittest.TestCase):
    def test_in_flight_counter(self):
        from app.utils.graceful_shutdown import GracefulShutdown

        g = GracefulShutdown(drain_timeout_sec=0.5)
        self.assertTrue(g.in_flight_begin())
        self.assertTrue(g.in_flight_begin())
        g.in_flight_end()
        g.in_flight_end()
        st = g.stats()
        self.assertEqual(st["inflight"], 0)

    def test_register_and_shutdown(self):
        from app.utils.graceful_shutdown import GracefulShutdown, ShutdownHook, ShutdownState

        g = GracefulShutdown(drain_timeout_sec=0.5)
        results = []

        def hook1():
            results.append("h1")

        g.register(ShutdownHook(name="h1", fn=hook1, timeout_sec=1))
        g.register(ShutdownHook(name="h2", fn=lambda: results.append("h2")))
        r = g.shutdown()
        self.assertIn("h1", r)
        self.assertIn("h2", r)
        self.assertEqual(results, ["h1", "h2"])
        self.assertEqual(g.state(), ShutdownState.CLOSED)

    def test_refuse_after_draining(self):
        from app.utils.graceful_shutdown import GracefulShutdown

        g = GracefulShutdown(drain_timeout_sec=0.5)
        g.shutdown()
        # 关闭后不再接受
        self.assertFalse(g.in_flight_begin())


class TestBug183HotConfig(unittest.TestCase):
    def test_set_and_get(self):
        from app.utils.hot_config import HotConfigCenter

        g = HotConfigCenter()
        g.set("k1", "v1")
        self.assertEqual(g.get("k1"), "v1")

    def test_subscribe(self):
        from app.utils.hot_config import HotConfigCenter

        g = HotConfigCenter()
        received = []
        g.subscribe("k1", lambda ch: received.append(ch.new))
        g.set("k1", "v1")
        g.set("k1", "v2")
        self.assertEqual(received, ["v1", "v2"])

    def test_no_change_no_notify(self):
        from app.utils.hot_config import HotConfigCenter

        g = HotConfigCenter()
        g.set("k1", "v1")
        received = []
        g.subscribe("k1", lambda ch: received.append("x"))
        ch = g.set("k1", "v1")  # 同值, 无变更
        self.assertIsNone(ch)
        self.assertEqual(received, [])

    def test_diff(self):
        from app.utils.hot_config import HotConfigCenter

        g = HotConfigCenter()
        g.set("k1", "v1")
        diff = g.diff({"k1": "v2", "k2": "new"})
        self.assertEqual(len(diff), 2)


class TestBug184StartupProbe(unittest.TestCase):
    def test_all_ok(self):
        from app.utils.startup_probe import StartupProbe

        g = StartupProbe()
        g.register("db", lambda: True)
        g.register("cache", lambda: True)
        self.assertTrue(g.run_all())
        self.assertTrue(g.is_ready())

    def test_partial_failed(self):
        from app.utils.startup_probe import StartupProbe

        g = StartupProbe()
        g.register("db", lambda: True)
        g.register("cache", lambda: False)
        self.assertFalse(g.run_all())

    def test_progress(self):
        from app.utils.startup_probe import StartupProbe

        g = StartupProbe()
        g.progress(2)
        g.progress(3)
        st = g.stats()
        self.assertEqual(st["progress"], 5)


if __name__ == "__main__":
    unittest.main()

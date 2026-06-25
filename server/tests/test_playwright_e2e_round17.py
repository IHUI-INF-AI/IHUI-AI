"""第十七轮 灾备与韧性 端到端测试 (Bug-167 ~ Bug-184).

6 维度巡检端到端验证:
  - 混沌测试:    Bug-167 注入 / Bug-168 降级 / Bug-169 重试
  - 数据库容灾:  Bug-170 主从切换 / Bug-171 读写路由 / Bug-172 从库保护
  - Redis 容灾:  Bug-173 singleflight / Bug-174 雪崩 / Bug-175 sentinel
  - 多活容灾:    Bug-176 地域路由 / Bug-177 跨地域复制 / Bug-178 一致性窗口
  - 限流降级:    Bug-179 令牌桶 / Bug-180 滑动窗口 / Bug-181 自适应
  - 优雅生命周期: Bug-182 优雅停机 / Bug-183 热配置 / Bug-184 启动探针
"""

import os
import sys
import time
from pathlib import Path

os.environ.setdefault("ENV", "test")
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# =====================================================================
# 维度 1: 混沌测试
# =====================================================================
class TestChaosE2E:
    def test_bug167_inject_and_disable(self):
        from app.utils.chaos import ChaosInjector, FaultRule, FaultType

        g = ChaosInjector(seed=1)
        # 默认情况下注入异常
        g.add(FaultRule(target="db", fault=FaultType.EXCEPTION, exception_cls=RuntimeError, probability=1.0))
        raised = False
        try:
            g.wrap("db", lambda: 1)
        except RuntimeError:
            raised = True
        assert raised
        # 禁用后恢复
        g.disable("db")
        v = g.wrap("db", lambda: 42)
        assert v == 42

    def test_bug168_degrade_ladder(self):
        from app.utils.degrade import DegradeChain

        # 完整 -> 默认 -> 失败
        g = DegradeChain("svc", cache_get=lambda: None, default="DEF")
        r1 = g.execute(lambda: "FULL-VAL")
        assert r1.level.value == "FULL"
        # 抛异常, 走默认
        r2 = g.execute(lambda: (_ for _ in ()).throw(RuntimeError("e")))
        assert r2.level.value == "DEFAULT"
        assert r2.value == "DEF"

    def test_bug169_retry_with_backoff(self):
        from app.utils.retry import Retrier, RetryConfig

        n = {"c": 0}

        def fn():
            n["c"] += 1
            if n["c"] < 3:
                raise RuntimeError("retry")
            return "ok"

        g = Retrier(RetryConfig(max_attempts=5, base_delay_ms=1, max_delay_ms=2))
        r = g.call(fn)
        assert r.ok
        assert r.attempts == 3
        assert len(r.delays_ms) == 2


# =====================================================================
# 维度 2: 数据库容灾
# =====================================================================
class TestDbDR_E2E:
    def test_bug170_failover(self):
        from app.utils.db_failover import DbRole, FailoverManager

        g = FailoverManager()
        g.add("m", role=DbRole.MASTER, priority=100)
        g.add("s1", role=DbRole.SLAVE, priority=80)
        g.add("s2", role=DbRole.SLAVE, priority=90)
        # 主库连续失败 -> 应自动提升 s2 (优先级 90 > 80)
        for _ in range(3):
            g.heartbeat("m", ok=False)
        st = g.status()
        assert st["s2"]["role"] == "MASTER"
        assert st["m"]["role"] == "OFFLINE"

    def test_bug171_router(self):
        from app.utils.replica_router import QueryType, ReplicaRouter

        g = ReplicaRouter()
        g.set_nodes("m", ["f1", "f2"])
        # 写走主
        wd = g.route(QueryType.WRITE)
        assert wd.is_master and wd.target == "m"
        # 读走从
        rd = g.route(QueryType.READ)
        assert not rd.is_master
        # 一致性读强制主
        cd = g.route(QueryType.READ, consistency=True)
        assert cd.is_master

    def test_bug172_follower_lag(self):
        from app.utils.follower_guard import FollowerGuard, FollowerGuardConfig

        g = FollowerGuard(FollowerGuardConfig(max_lag_sec=2, recovery_sec=100))
        assert g.report_lag("f1", 0.5)  # 健康
        assert not g.report_lag("f1", 10.0)  # 滞后被阻断
        assert not g.acquire("f1")  # 阻断期间不可用


# =====================================================================
# 维度 3: Redis 容灾
# =====================================================================
class TestRedisDR_E2E:
    def test_bug173_singleflight(self):
        from app.utils.singleflight import SingleFlight

        g = SingleFlight()
        n = {"c": 0}

        def fn():
            n["c"] += 1
            time.sleep(0.01)
            return "v"

        results = [g.do("k", fn) for _ in range(5)]
        # 只有第一次执行
        assert n["c"] == 1
        for v, _ in results:
            assert v == "v"

    def test_bug174_avalanche_ttl_jitter(self):
        from app.utils.avalanche import AvalancheConfig, AvalancheGuard

        g = AvalancheGuard(AvalancheConfig(base_ttl=300, jitter_pct=0.3))
        samples = {g.ttl("k") for _ in range(50)}
        assert len(samples) > 1  # TTL 抖动产生多个不同值

    def test_bug175_sentinel_failover(self):
        from app.utils.redis_sentinel import RedisSentinel

        g = RedisSentinel()
        g.add("m", is_master=True)
        g.add("r1")
        g.add("r2")
        ev = g.report("m", ok=False)
        assert ev is not None
        assert g.get_master() != "m"
        # 客户端重连到新主
        new = g.attach("client1")
        assert new is not None
        assert new != "m"


# =====================================================================
# 维度 4: 多活容灾
# =====================================================================
class TestMultiRegionE2E:
    def test_bug176_geo_route(self):
        from app.utils.geo_router import GeoRouter, Region

        g = GeoRouter()
        g.add(Region(id="cn", distance={"us": 12000, "eu": 8000}))
        g.add(Region(id="us", distance={"cn": 12000, "eu": 7000}))
        g.add(Region(id="eu", distance={"cn": 8000, "us": 7000}))
        # 本地优先
        r1 = g.route("cn")
        assert r1.target_region == "cn"
        # cn 故障, 选距离最近的
        g.set_health("cn", False)
        r2 = g.route("cn")
        assert r2.target_region in ("eu", "us")

    def test_bug177_replication(self):
        from app.utils.replication import CrossRegionReplicator, ReplicaLog

        g = CrossRegionReplicator()
        g.write("k1", "v1", region="cn")
        g.write("k1", "v2", region="us")
        # 远端 us 版本 3, 与 cn 冲突
        log = ReplicaLog(key="k1", value="v3", version=3, source="us")
        g.replicate(log)
        st = g.stats()
        assert st["conflicts"] >= 1

    def test_bug178_consistency(self):
        from app.utils.consistency_window import ConsistencyConfig, ConsistencyWindow

        g = ConsistencyWindow(ConsistencyConfig(window_sec=5))
        g.mark("k1", region="cn")
        # 一致性窗口内其他 region 读 follower 应被拒
        assert not g.can_read_follower("k1", region="us")
        # 同 region 可以
        assert g.can_read_follower("k1", region="cn")


# =====================================================================
# 维度 5: 限流降级
# =====================================================================
class TestRateLimitE2E:
    def test_bug179_token_bucket_burst(self):
        from app.utils.token_bucket import TokenBucketConfig, TokenBucketLimiter

        g = TokenBucketLimiter(TokenBucketConfig(capacity=5, refill_rate=100))
        # 突发 5 个全过
        for _ in range(5):
            assert g.acquire("k")
        # 第 6 个被拒
        assert not g.acquire("k")
        # 等 50ms, 至少补 5 个
        time.sleep(0.05)
        for _ in range(5):
            assert g.acquire("k")

    def test_bug180_sliding_window(self):
        from app.utils.sliding_window import SlidingWindowConfig, SlidingWindowLimiter

        g = SlidingWindowLimiter(SlidingWindowConfig(window_sec=0.2, max_count=3))
        for _ in range(3):
            assert g.acquire("k")
        assert not g.acquire("k")
        time.sleep(0.25)
        assert g.acquire("k")

    def test_bug181_adaptive(self):
        from app.utils.adaptive import AdaptiveConfig, AdaptiveLimiter

        g = AdaptiveLimiter(AdaptiveConfig(initial_qps=10, p99_target_ms=100, step_down=0.5, cooldown_sec=0))
        # 持续高 P99, qps 应下降
        for _ in range(20):
            g.report(p99_ms=500, err_rate=0.0)
        assert g.stats()["qps"] < 10


# =====================================================================
# 维度 6: 优雅生命周期
# =====================================================================
class TestLifecycleE2E:
    def test_bug182_graceful_shutdown(self):
        from app.utils.graceful_shutdown import GracefulShutdown, ShutdownHook, ShutdownState

        g = GracefulShutdown(drain_timeout_sec=0.5)
        # 注册 3 个钩子
        results = []
        g.register(ShutdownHook(name="flush", fn=lambda: results.append("flush"), timeout_sec=1))
        g.register(ShutdownHook(name="close_db", fn=lambda: results.append("close_db")))
        g.register(ShutdownHook(name="close_redis", fn=lambda: results.append("close_redis")))
        # in-flight 任务
        assert g.in_flight_begin()
        g.in_flight_end()
        r = g.shutdown()
        assert "flush" in r
        assert "close_db" in r
        assert "close_redis" in r
        assert results == ["flush", "close_db", "close_redis"]
        assert g.state() == ShutdownState.CLOSED

    def test_bug183_hot_config_diff(self):
        from app.utils.hot_config import HotConfigCenter

        g = HotConfigCenter()
        g.set("rate_limit", 100)
        g.set("timeout", 5)
        # 远端推送差异
        diff = g.diff({"rate_limit": 200, "timeout": 5, "new_key": "v"})
        keys = [d.key for d in diff]
        assert "rate_limit" in keys
        assert "new_key" in keys
        # 订阅变更
        received = []
        g.subscribe("rate_limit", lambda ch: received.append((ch.old, ch.new)))
        g.set("rate_limit", 300)
        assert received == [(100, 300)]

    def test_bug184_startup_probe(self):
        from app.utils.startup_probe import ProbeState, StartupProbe

        g = StartupProbe()
        g.register("db", lambda: True)
        g.register("cache", lambda: True)
        g.register("queue", lambda: True)
        assert g.run_all()
        assert g.is_ready()
        st = g.stats()
        for name in ("db", "cache", "queue"):
            assert st["results"][name] == ProbeState.OK.value

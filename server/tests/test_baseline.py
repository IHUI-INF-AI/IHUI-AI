"""性能基线测试 — 给后续优化做对比.

覆盖:
- 关键端点 P95 响应时间基线
- WS 广播吞吐量基线
- 慢 SQL 阈值触发计数
- 韧性模块在负载下的开销
"""

import statistics
import time

import pytest
from starlette.websockets import WebSocketState

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# HTTP 端点响应基线
# ---------------------------------------------------------------------------


class TestHttpBaseline:
    """核心端点 P95 响应时间基线 (ms)."""

    async def test_health_baseline(self, client):
        times = []
        for _ in range(50):
            t0 = time.perf_counter()
            r = await client.get("/healthz")
            times.append((time.perf_counter() - t0) * 1000)
            assert r.status_code == 200
        p95 = statistics.quantiles(times, n=20)[18]  # 95th percentile
        avg = statistics.mean(times)
        print(f"\n[baseline] /healthz  avg={avg:.2f}ms  p95={p95:.2f}ms  max={max(times):.2f}ms")
        # 健康检查应 < 50ms
        assert p95 < 50, f"/healthz P95 退化: {p95:.2f}ms"

    async def test_metrics_endpoint(self, client):
        t0 = time.perf_counter()
        r = await client.get("/metrics")
        elapsed = (time.perf_counter() - t0) * 1000
        assert r.status_code == 200
        print(f"\n[baseline] /metrics  {elapsed:.2f}ms")
        assert elapsed < 500  # /metrics 可能慢一些

    async def test_resilience_endpoint(self, client):
        t0 = time.perf_counter()
        r = await client.get("/resilience")
        elapsed = (time.perf_counter() - t0) * 1000
        assert r.status_code == 200
        print(f"\n[baseline] /resilience  {elapsed:.2f}ms")
        assert elapsed < 200


# ---------------------------------------------------------------------------
# WS 广播吞吐
# ---------------------------------------------------------------------------


class TestWsThroughput:
    async def test_broadcast_throughput(self, client):
        """单实例内 100 个连接, 1 次广播, 应当 < 500ms."""
        from app.ws.manager import ConnectionManager

        mgr = ConnectionManager()
        mgr._instance_id = "throughput-test"

        class FakeWS:
            def __init__(self, wid):
                self.id = wid
                self._sent: list = []
                self.client_state = WebSocketState.CONNECTED

            async def accept(self):
                pass

            async def send_text(self, data):
                self._sent.append(data)

            async def close(self):
                self.client_state = WebSocketState.DISCONNECTED

        # 加 100 个连接
        for i in range(100):
            ws = FakeWS(f"t-{i}")
            mgr._connections[f"t-{i}"] = ws

        t0 = time.perf_counter()
        await mgr.broadcast_all_local({"data": "x" * 200})  # 200B 消息
        elapsed = (time.perf_counter() - t0) * 1000
        print(f"\n[baseline] broadcast 100 conns  {elapsed:.2f}ms")
        assert elapsed < 500, f"广播退化: {elapsed:.2f}ms"

    async def test_sequential_broadcasts(self, client):
        from app.ws.manager import ConnectionManager

        mgr = ConnectionManager()
        mgr._instance_id = "seq-test"

        class FakeWS:
            def __init__(self, wid):
                self.id = wid
                self._sent: list = []
                self.client_state = WebSocketState.CONNECTED

            async def accept(self):
                pass

            async def send_text(self, data):
                self._sent.append(data)

            async def close(self):
                self.client_state = WebSocketState.DISCONNECTED

        ws = FakeWS("seq")
        mgr._connections["seq"] = ws

        t0 = time.perf_counter()
        for _ in range(1000):
            await mgr.broadcast_all_local({"i": _})
        elapsed = (time.perf_counter() - t0) * 1000
        avg = elapsed / 1000
        print(f"\n[baseline] 1000 broadcasts  total={elapsed:.2f}ms  avg={avg:.3f}ms")
        # 单广播应 < 1ms
        assert avg < 1.0, f"单广播平均 {avg:.3f}ms 退化"


# ---------------------------------------------------------------------------
# 慢 SQL 监控开销
# ---------------------------------------------------------------------------


class TestSqlMonitoringOverhead:
    async def test_install_no_error(self, client):
        """SQL 事件安装必须不抛错."""
        from app.database import ENGINES
        from app.monitoring import install_sql_events

        # 重复安装应当幂等
        try:
            install_sql_events(ENGINES)
        except Exception as e:
            pytest.fail(f"install_sql_events 失败: {e}")


# ---------------------------------------------------------------------------
# 韧性模块开销
# ---------------------------------------------------------------------------


class TestResilienceOverhead:
    async def test_circuit_breaker_overhead(self):
        """每次 call 额外开销 < 1ms."""
        from app.resilience import CircuitBreaker

        cb = CircuitBreaker("overhead-test", failure_threshold=100)

        def work():
            return 1 + 1

        # 预热
        for _ in range(10):
            cb.call(work)

        times = []
        for _ in range(1000):
            t0 = time.perf_counter()
            cb.call(work)
            times.append((time.perf_counter() - t0) * 1000)
        avg = statistics.mean(times)
        p95 = statistics.quantiles(times, n=20)[18]
        print(f"\n[baseline] CB call  avg={avg:.3f}ms  p95={p95:.3f}ms")
        assert avg < 0.5, f"熔断器平均开销 {avg:.3f}ms 过高"

    async def test_rate_limit_overhead(self):
        from app.resilience import TokenBucketRateLimit

        rl = TokenBucketRateLimit("rl-overhead", capacity=10000, refill_rate=1000)
        times = []
        for _ in range(1000):
            t0 = time.perf_counter()
            rl.acquire()
            times.append((time.perf_counter() - t0) * 1000)
        avg = statistics.mean(times)
        print(f"\n[baseline] RL acquire  avg={avg:.3f}ms")
        assert avg < 0.1

    async def test_degraded_mode_overhead(self):
        from app.resilience import degraded_mode

        @degraded_mode(fallback=None)
        def work(x):
            return x

        for _ in range(10):
            work(1)
        times = []
        for i in range(1000):
            t0 = time.perf_counter()
            work(i)
            times.append((time.perf_counter() - t0) * 1000)
        avg = statistics.mean(times)
        print(f"\n[baseline] degraded_mode  avg={avg:.4f}ms")
        assert avg < 0.05


# ---------------------------------------------------------------------------
# Prometheus 指标完整性
# ---------------------------------------------------------------------------


class TestPrometheusCoverage:
    async def test_metrics_has_all_counters(self, client):
        r = await client.get("/metrics")
        body = r.text
        for name in [
            "zhs_http_requests_total",
            "zhs_http_request_duration_seconds",
            "zhs_active_connections",
            "zhs_websocket_connections",
            "zhs_db_pool_in_use",
            "zhs_sql_query_duration_seconds",
            "zhs_sql_queries_total",
            "zhs_sql_slow_queries_total",
        ]:
            assert name in body, f"指标 {name} 缺失"
        print(f"\n[baseline] /metrics body size: {len(body)} bytes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

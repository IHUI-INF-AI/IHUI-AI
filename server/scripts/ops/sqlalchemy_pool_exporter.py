"""Phase 15 建议 2: SQLAlchemy 连接池 Prometheus exporter + 慢查询自动 kill.

目的:
  把 SQLAlchemy 连接池状态和查询性能暴露为 Prometheus 指标,
  并对超慢查询自动 cancel (kill) 防止雪崩.

设计:
  1. PoolMetrics          持有 engine + prometheus_client 指标
     - collect()          从 engine.pool 读最新值
     - Gauge: pool_size / checkedout / overflow / checkedin
     - Gauge: pool_utilization_ratio (checkedout / pool_size)
     - Counter: query_total / slow_query_total / killed_query_total
     - Histogram: query_duration_seconds (可选)
  2. SlowQueryKiller      SQLAlchemy event hook
     - before_cursor_execute 记录开始时间
     - after_cursor_execute 计算耗时, > threshold 计数
     - 独立线程轮询: 找出 > hard_kill_threshold 的连接并 cancel

用法:
  from sqlalchemy import create_engine
  from sqlalchemy_pool_exporter import PoolMetrics, SlowQueryKiller

  engine = create_engine("postgresql://...", pool_size=20)
  metrics = PoolMetrics(engine, slow_query_threshold_s=1.0)
  killer = SlowQueryKiller(engine, hard_kill_threshold_s=30.0, poll_interval_s=5.0)
  killer.start()

  # 启动时在 /metrics 端点 expose
  from prometheus_client import generate_latest
  # metrics.render() -> str
"""

from __future__ import annotations

import sys
import threading
import time
from typing import Any

try:
    from prometheus_client import Counter, Gauge, Histogram

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

try:
    from prometheus_client import REGISTRY, generate_latest
except ImportError:
    generate_latest = None  # type: ignore
    REGISTRY = None  # type: ignore


# ---------------------------------------------------------------------------
# 1. PoolMetrics
# ---------------------------------------------------------------------------


class PoolMetrics:
    """SQLAlchemy 池 Prometheus 指标."""

    def __init__(
        self,
        engine: Any,
        slow_query_threshold_s: float = 1.0,
        pool_name: str = "default",
        registry: Any = None,
    ):
        self.engine = engine
        self.slow_query_threshold_s = slow_query_threshold_s
        self.pool_name = pool_name
        self._registry = registry
        self._event_hooks_installed = False
        self._query_starts: dict[int, float] = {}

        if PROMETHEUS_AVAILABLE:
            self._registry = registry if registry is not None else REGISTRY
            self._g_size = self._make_gauge("zhs_sqlalchemy_pool_size", "连接池大小", ["pool"])
            self._g_checkedout = self._make_gauge("zhs_sqlalchemy_pool_checkedout", "已签出连接数", ["pool"])
            self._g_checkedin = self._make_gauge("zhs_sqlalchemy_pool_checkedin", "可用连接数", ["pool"])
            self._g_overflow = self._make_gauge(
                "zhs_sqlalchemy_pool_overflow", "溢出连接数 (超过 pool_size 的部分)", ["pool"]
            )
            self._g_utilization = self._make_gauge(
                "zhs_sqlalchemy_pool_utilization_ratio", "利用率 (checkedout / (size + overflow))", ["pool"]
            )
            self._c_query = self._make_counter("zhs_sqlalchemy_query_total", "SQL 查询总数", ["pool", "result"])
            self._c_slow = self._make_counter(
                "zhs_sqlalchemy_slow_query_total", f"超过 {slow_query_threshold_s}s 的慢查询数", ["pool"]
            )
            self._h_duration = self._make_histogram(
                "zhs_sqlalchemy_query_duration_seconds",
                "SQL 查询耗时分布",
                ["pool"],
                buckets=(0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0, 30.0),
            )

        # 装 SQLAlchemy event hook
        self._install_event_hooks()

    def _make_gauge(self, name: str, doc: str, labels: list[str]):
        return self._safe_register(name, lambda: Gauge(name, doc, labels, registry=self._registry))

    def _make_counter(self, name: str, doc: str, labels: list[str]):
        return self._safe_register(name, lambda: Counter(name, doc, labels, registry=self._registry))

    def _make_histogram(self, name: str, doc: str, labels: list[str], **kw):
        return self._safe_register(name, lambda: Histogram(name, doc, labels, registry=self._registry, **kw))

    def _safe_register(self, name: str, factory):
        """注册指标, 已存在则从 registry 移除旧的再注册 (测试隔离)."""
        if not PROMETHEUS_AVAILABLE:
            return None
        try:
            return factory()
        except ValueError:
            # 重复注册: 移除同名指标后重试
            try:
                from prometheus_client import REGISTRY as DEFAULT_REG

                target_reg = self._registry if self._registry is not None else DEFAULT_REG
                # prometheus_client 0.20+: 用 unregister; 旧版用 _names_to_collectors
                to_unregister = []
                # 收集与该 name 相关的 collector
                names_map = getattr(target_reg, "_names_to_collectors", {})
                for n, coll in list(names_map.items()):
                    if n == name or n.startswith(name + "_"):
                        to_unregister.append(coll)
                for coll in set(to_unregister):
                    try:
                        target_reg.unregister(coll)
                    except Exception:
                        pass
                return factory()
            except Exception:
                return None

    def _install_event_hooks(self) -> None:
        if self._event_hooks_installed:
            return
        try:
            from sqlalchemy import event
        except ImportError:
            return
        try:
            event.listen(self.engine, "before_cursor_execute", self._before_execute)
            event.listen(self.engine, "after_cursor_execute", self._after_execute)
            self._event_hooks_installed = True
        except Exception:
            pass

    def _before_execute(self, conn, cursor, statement, parameters, context, executemany) -> None:
        self._query_starts[id(conn)] = time.time()

    def _after_execute(self, conn, cursor, statement, parameters, context, executemany) -> None:
        start = self._query_starts.pop(id(conn), None)
        if start is None or not PROMETHEUS_AVAILABLE:
            return
        duration = time.time() - start
        try:
            self._h_duration.labels(pool=self.pool_name).observe(duration)
            if duration >= self.slow_query_threshold_s:
                self._c_slow.labels(pool=self.pool_name).inc()
                self._c_query.labels(pool=self.pool_name, result="slow").inc()
            else:
                self._c_query.labels(pool=self.pool_name, result="ok").inc()
        except Exception:
            pass

    def collect(self) -> None:
        """从 engine.pool 读最新值写入指标."""
        if not PROMETHEUS_AVAILABLE:
            return
        try:
            pool = self.engine.pool
            size = getattr(pool, "size", lambda: 0)()
            checkedout = getattr(pool, "checkedout", lambda: 0)()
            overflow = getattr(pool, "overflow", lambda: 0)()
            # checkedin 可能在某些 pool 上没有, 估算
            try:
                checkedin = pool.checkedin()
            except (AttributeError, Exception):
                checkedin = max(0, size + overflow - checkedout)
            util = checkedout / max(1, size + overflow)
            self._g_size.labels(pool=self.pool_name).set(size)
            self._g_checkedout.labels(pool=self.pool_name).set(checkedout)
            self._g_checkedin.labels(pool=self.pool_name).set(checkedin)
            self._g_overflow.labels(pool=self.pool_name).set(overflow)
            self._g_utilization.labels(pool=self.pool_name).set(util)
        except Exception:
            # 池不可读 (engine 已 dispose), 跳过
            pass

    def render(self) -> str:
        """渲染当前指标文本 (用于 /metrics 端点)."""
        if not PROMETHEUS_AVAILABLE:
            return ""
        self.collect()
        from prometheus_client import generate_latest

        if self._registry is not None:
            return generate_latest(self._registry).decode("utf-8")
        return ""

    def snapshot(self) -> dict:
        """返回当前池快照 (dict, 不依赖 prometheus_client)."""
        try:
            pool = self.engine.pool
            return {
                "size": getattr(pool, "size", lambda: 0)(),
                "checkedout": getattr(pool, "checkedout", lambda: 0)(),
                "overflow": getattr(pool, "overflow", lambda: 0)(),
                "slow_query_total": (
                    int(self._c_slow.labels(pool=self.pool_name)._value.get()) if PROMETHEUS_AVAILABLE else 0
                ),
            }
        except Exception as e:
            return {"error": str(e)}


# ---------------------------------------------------------------------------
# 2. SlowQueryKiller
# ---------------------------------------------------------------------------


class SlowQueryKiller:
    """监控并自动 cancel 慢查询 (hard kill).

    设计:
      - SQLAlchemy before/after cursor execute hook 记录每连接开始时间
      - 用 WeakValueDictionary 跟踪 conn 对象引用 (不依赖 SQLAlchemy 内部结构)
      - 独立线程轮询, 找出 duration > hard_kill_threshold 的连接
      - 用 connection.invalidate() 强制关闭 (SQLite/PG 通用)
    """

    def __init__(
        self,
        engine: Any,
        hard_kill_threshold_s: float = 30.0,
        poll_interval_s: float = 5.0,
        pool_name: str = "default",
    ):
        if hard_kill_threshold_s <= 0:
            raise ValueError(f"hard_kill_threshold_s 必须 > 0, 实际 {hard_kill_threshold_s}")
        if poll_interval_s <= 0:
            raise ValueError(f"poll_interval_s 必须 > 0, 实际 {poll_interval_s}")
        self.engine = engine
        self.hard_kill_threshold_s = hard_kill_threshold_s
        self.poll_interval_s = poll_interval_s
        self.pool_name = pool_name
        # 用 WeakValueDictionary 跟踪 conn 对象, 自动 GC 已关闭的连接
        try:
            import weakref

            self._query_starts: dict[int, float] = {}
            self._conn_refs: weakref.WeakValueDictionary[int, Any] = weakref.WeakValueDictionary()
        except Exception:
            self._query_starts = {}
            self._conn_refs = {}
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._killed_count = 0
        self._killed_lock = threading.Lock()
        # 可选 prom 指标
        if PROMETHEUS_AVAILABLE:
            self._c_killed = self._make_killed_counter(
                "zhs_sqlalchemy_killed_query_total", "被自动 kill 的慢查询数", ["pool"]
            )
        else:
            self._c_killed = None
        self._install_event_hooks()

    def _make_killed_counter(self, name: str, doc: str, labels: list[str]):
        """注册 killed counter, 重复时清理后重试."""
        if not PROMETHEUS_AVAILABLE:
            return None
        try:
            return Counter(name, doc, labels)
        except ValueError:
            try:
                from prometheus_client import REGISTRY as DEFAULT_REG

                names_map = getattr(DEFAULT_REG, "_names_to_collectors", {})
                to_unregister = []
                for n, coll in list(names_map.items()):
                    if n == name or n.startswith(name + "_"):
                        to_unregister.append(coll)
                for coll in set(to_unregister):
                    try:
                        DEFAULT_REG.unregister(coll)
                    except Exception:
                        pass
                return Counter(name, doc, labels)
            except Exception:
                return None

    def _install_event_hooks(self) -> None:
        try:
            from sqlalchemy import event

            event.listen(self.engine, "before_cursor_execute", self._before_execute)
            event.listen(self.engine, "after_cursor_execute", self._after_execute)
        except Exception:
            pass

    def _before_execute(self, conn, cursor, statement, parameters, context, executemany) -> None:
        self._query_starts[id(conn)] = time.time()
        try:
            self._conn_refs[id(conn)] = conn
        except TypeError:
            # 弱引用不支持的对象 (某些 mock), 跳过
            pass

    def _after_execute(self, conn, cursor, statement, parameters, context, executemany) -> None:
        self._query_starts.pop(id(conn), None)

    def _check_and_kill(self) -> int:
        """检查并 kill 超时连接, 返回 kill 数."""
        now = time.time()
        killed: list[tuple[int, float]] = []
        for conn_id, start in list(self._query_starts.items()):
            if now - start >= self.hard_kill_threshold_s:
                killed.append((conn_id, start))
        for conn_id, start in killed:
            try:
                conn = self._conn_refs.get(conn_id)
                if conn is not None:
                    self._kill_connection(conn)
            except Exception:
                pass
            self._query_starts.pop(conn_id, None)
        if killed and self._c_killed is not None:
            self._c_killed.labels(pool=self.pool_name).inc(len(killed))
        with self._killed_lock:
            self._killed_count += len(killed)
        return len(killed)

    def _find_connection(self, conn_id: int) -> Any:
        """通过 id 找 conn 对象 (从 WeakValueDictionary)."""
        try:
            return self._conn_refs.get(conn_id)
        except Exception:
            return None

    def _kill_connection(self, conn: Any) -> None:
        """强制关闭连接."""
        try:
            conn.invalidate()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass

    def start(self) -> None:
        """启动后台轮询线程."""
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name=f"slow-query-killer-{self.pool_name}")
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=self.poll_interval_s * 2)
            self._thread = None

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._check_and_kill()
            except Exception:
                pass
            self._stop_event.wait(timeout=self.poll_interval_s)

    @property
    def killed_count(self) -> int:
        with self._killed_lock:
            return self._killed_count

    def status(self) -> dict:
        return {
            "running": self._thread is not None and self._thread.is_alive(),
            "hard_kill_threshold_s": self.hard_kill_threshold_s,
            "poll_interval_s": self.poll_interval_s,
            "killed_count": self.killed_count,
            "active_tracking": len(self._query_starts),
        }


# ---------------------------------------------------------------------------
# 3. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    """演示."""
    import argparse

    from sqlalchemy import create_engine, text

    p = argparse.ArgumentParser(description="SQLAlchemy 池 exporter 演示")
    p.add_argument("--url", default="sqlite:///:memory:", help="DB URL")
    p.add_argument("--slow-threshold", type=float, default=1.0)
    p.add_argument("--hard-kill-threshold", type=float, default=30.0)
    p.add_argument("--poll-interval", type=float, default=5.0)
    p.add_argument("--seconds", type=int, default=0, help="跑几秒后退出 (0=立即)")
    p.add_argument("--pool-size", type=int, default=5)
    p.add_argument("--max-overflow", type=int, default=10)
    args = p.parse_args(argv)

    # SQLite 默认 SingletonThreadPool 不支持 pool_size/max_overflow,
    # 显式用 QueuePool 才能让监控/限流生效
    engine_kwargs: dict = {"pool_size": args.pool_size, "max_overflow": args.max_overflow}
    if args.url.startswith("sqlite"):
        from sqlalchemy.pool import QueuePool

        engine_kwargs["poolclass"] = QueuePool
        engine_kwargs["connect_args"] = {"check_same_thread": False}

    engine = create_engine(args.url, **engine_kwargs)
    metrics = PoolMetrics(engine, slow_query_threshold_s=args.slow_threshold)
    killer = SlowQueryKiller(
        engine,
        hard_kill_threshold_s=args.hard_kill_threshold,
        poll_interval_s=args.poll_interval,
    )
    killer.start()
    try:
        # 执行几个查询
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.execute(text("SELECT 2"))
        metrics.collect()
        print("snapshot:", metrics.snapshot())
        print("status:", killer.status())
        if args.seconds > 0:
            time.sleep(args.seconds)
    finally:
        killer.stop()
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Bug-67: 数据库主从自动故障切换 + 读写分离路由.

设计:
  - 每个逻辑名 (ai/center/course) 注册一个 master + 0..N slave
  - 写: 走 master
  - 读: 优先走 slave, 失败/延迟高时降级到 master
  - 健康检查: 周期性 ping, 标记 unhealthy
  - 自动切换: master 失败 N 次 → 选延迟最低的 slave 升主
  - 通过 hot_config 读 SLAVE_URLS / SLAVE_FAILOVER_* 阈值

使用:
    from app.utils.db_router import db_router, with_master, with_slave

    # 注册 (启动时)
    db_router.register("ai", master_url=MASTER, slave_urls=[S1, S2])

    # 业务代码
    with with_master("ai") as engine:
        db.execute(...)
    with with_slave("ai") as engine:
        result = db.execute(...)
"""

import logging
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

DEFAULT_LATENCY_FAILOVER_MS = 100
DEFAULT_FAIL_THRESHOLD = 3  # 连续 N 次失败 → 标 unhealthy
DEFAULT_RECOVERY_CHECK_SEC = 30  # 多久再试一次
DEFAULT_HEALTH_CHECK_INTERVAL = 5


@dataclass
class NodeHealth:
    is_master: bool = False
    healthy: bool = True
    fail_count: int = 0
    last_fail_ts: float = 0.0
    last_check_ts: float = 0.0
    latency_ms: float = 0.0
    last_ping_ts: float = 0.0

    def to_dict(self) -> dict:
        return {
            "is_master": self.is_master,
            "healthy": self.healthy,
            "fail_count": self.fail_count,
            "last_fail_ts": self.last_fail_ts,
            "last_check_ts": self.last_check_ts,
            "latency_ms": round(self.latency_ms, 2),
            "last_ping_ts": self.last_ping_ts,
        }


@dataclass
class DbNode:
    name: str  # 逻辑名 (ai/center/course)
    role: str  # "master" / "slave"
    url: str
    health: NodeHealth = field(default_factory=NodeHealth)


class DbRouter:
    """数据库主从路由器."""

    def __init__(self):
        self._nodes: dict[str, list[DbNode]] = {}  # name -> [master, slave1, slave2]
        self._lock = threading.Lock()
        self._last_health_check = 0.0
        self._failover_events: list[dict] = []

    # ----- 注册 -----
    def register(self, name: str, master_url: str, slave_urls: list[str] | None = None) -> None:
        nodes: list[DbNode] = [
            DbNode(
                name=name,
                role="master",
                url=master_url,
                health=NodeHealth(is_master=True, healthy=True),
            )
        ]
        if slave_urls:
            for url in slave_urls:
                nodes.append(
                    DbNode(
                        name=name,
                        role="slave",
                        url=url,
                        health=NodeHealth(is_master=False, healthy=True),
                    )
                )
        with self._lock:
            self._nodes[name] = nodes

    def unregister(self, name: str) -> None:
        with self._lock:
            self._nodes.pop(name, None)

    # ----- 选择 -----
    def _healthy_slave(self, name: str) -> DbNode | None:
        with self._lock:
            nodes = self._nodes.get(name, [])
        slaves = [n for n in nodes if n.role == "slave" and n.health.healthy]
        if not slaves:
            return None
        # 优先延迟最低
        slaves.sort(key=lambda n: n.health.latency_ms)
        return slaves[0]

    def _master(self, name: str) -> DbNode | None:
        with self._lock:
            nodes = self._nodes.get(name, [])
        for n in nodes:
            if n.role == "master":
                return n
        return None

    def get_master(self, name: str) -> DbNode | None:
        return self._master(name)

    def get_slave(self, name: str) -> DbNode | None:
        """拿一个健康 slave, 没有就 fallback 到 master."""
        s = self._healthy_slave(name)
        if s is not None:
            return s
        return self._master(name)

    def pick_for_read(self, name: str) -> DbNode | None:
        """读路由: slave 优先, fallback master."""
        return self.get_slave(name)

    def pick_for_write(self, name: str) -> DbNode | None:
        """写路由: 必须 master."""
        return self._master(name)

    # ----- 健康管理 -----
    def report_success(self, node: DbNode, latency_ms: float = 0.0) -> None:
        with self._lock:
            node.health.healthy = True
            node.health.fail_count = 0
            node.health.last_check_ts = time.time()
            node.health.last_ping_ts = time.time()
            node.health.latency_ms = latency_ms

    def report_failure(self, node: DbNode, error: str | None = None) -> None:
        need_failover = False
        with self._lock:
            node.health.fail_count += 1
            node.health.last_fail_ts = time.time()
            node.health.last_check_ts = time.time()
            if node.health.fail_count >= self._hot_fail_threshold():
                if node.health.healthy:
                    node.health.healthy = False
                    logger.warning(f"db node unhealthy: {node.name}/{node.role} fail_count={node.health.fail_count}")
                # master 失败 → 触发 failover (在锁外调用避免可重入锁死锁)
                if node.role == "master":
                    need_failover = True
        if need_failover:
            self._try_failover(node.name)

    def _try_failover(self, name: str) -> DbNode | None:
        """从 slaves 选延迟最低健康的 → 升 master."""
        with self._lock:
            nodes = self._nodes.get(name, [])
            slaves = [n for n in nodes if n.role == "slave" and n.health.healthy]
            if not slaves:
                logger.error(f"db failover fail: no healthy slave for {name}")
                return None
            slaves.sort(key=lambda n: n.health.latency_ms)
            new_master = slaves[0]
            # 原 master 降 slave, 新 master 升级
            for n in nodes:
                if n.role == "master":
                    n.role = "slave"
                    n.health.is_master = False
            new_master.role = "master"
            new_master.health.is_master = True
        self._failover_events.append(
            {
                "ts": time.time(),
                "name": name,
                "new_master": new_master.url,
            }
        )
        try:
            from app.utils.alert_router import alert_critical

            alert_critical(
                f"db_failover:{name}",
                f"Master failed for {name}, promoted slave to master: {new_master.url}",
            )
        except Exception:
            logger.warning("Caught unexpected exception")
        logger.warning(f"db failover {name}: promoted slave to master")
        return new_master

    def try_recover(self, name: str) -> None:
        """探测恢复: 把 unhealthy 的 master 重置回 slave, 健康后考虑再次升主."""
        with self._lock:
            nodes = self._nodes.get(name, [])
        changed = False
        for n in nodes:
            if not n.health.healthy:
                age = time.time() - n.health.last_fail_ts
                if age >= self._hot_recovery_sec():
                    # 允许一次试探
                    n.health.healthy = True
                    n.health.fail_count = 0
                    changed = True
        if changed:
            logger.info(f"db recover probed: {name}")

    # ----- 周期健康检查 -----
    def tick_health(self) -> dict[str, dict]:
        """调用一次, 返回所有 name 的健康快照."""
        if time.time() - self._last_health_check < DEFAULT_HEALTH_CHECK_INTERVAL:
            return {}
        self._last_health_check = time.time()
        out: dict[str, dict] = {}
        with self._lock:
            names = list(self._nodes.keys())
        for name in names:
            self.try_recover(name)
            nodes = self._get_nodes(name)
            if not nodes:
                continue
            out[name] = {
                "nodes": [
                    {
                        "role": n.role,
                        "url": n.url,
                        **n.health.to_dict(),
                    }
                    for n in nodes
                ],
                "failover_events_count": sum(1 for e in self._failover_events if e.get("name") == name),
            }
        return out

    def _get_nodes(self, name: str) -> list[DbNode]:
        with self._lock:
            return list(self._nodes.get(name, []))

    # ----- hot config -----
    def _hot_fail_threshold(self) -> int:
        try:
            from app.utils.hot_config import hot_get

            v = hot_get("DB_FAILOVER_THRESHOLD", DEFAULT_FAIL_THRESHOLD)
            return int(v)
        except Exception:
            return DEFAULT_FAIL_THRESHOLD

    def _hot_recovery_sec(self) -> float:
        try:
            from app.utils.hot_config import hot_get

            v = hot_get("DB_FAILOVER_RECOVERY_SEC", DEFAULT_RECOVERY_CHECK_SEC)
            return float(v)
        except Exception:
            return DEFAULT_RECOVERY_CHECK_SEC

    def _hot_latency_threshold(self) -> float:
        try:
            from app.utils.hot_config import hot_get

            v = hot_get("DB_SLAVE_MAX_LATENCY_MS", DEFAULT_LATENCY_FAILOVER_MS)
            return float(v)
        except Exception:
            return DEFAULT_LATENCY_FAILOVER_MS

    # ----- 统计 -----
    def stats(self) -> dict:
        with self._lock:
            out = {
                "groups": {},
                "total_failover_events": len(self._failover_events),
            }
            for name, nodes in self._nodes.items():
                out["groups"][name] = [{"role": n.role, "url": n.url, **n.health.to_dict()} for n in nodes]  # type: ignore[index]
        return out


# 全局单例
db_router = DbRouter()


# ---------------------------------------------------------------------------
# Context manager
# ---------------------------------------------------------------------------


@contextmanager
def with_master(name: str):
    """拿 master engine, 退出时上报结果."""
    node = db_router.pick_for_write(name)
    if node is None:
        raise RuntimeError(f"no master registered for {name}")
    start = time.perf_counter()
    err: Exception | None = None
    try:
        yield node
    except Exception as e:
        err = e
        raise
    finally:
        latency = (time.perf_counter() - start) * 1000
        if err is None:
            db_router.report_success(node, latency_ms=latency)
        else:
            db_router.report_failure(node, error=str(err))


@contextmanager
def with_slave(name: str):
    """拿 slave (或 fallback master) engine."""
    node = db_router.pick_for_read(name)
    if node is None:
        raise RuntimeError(f"no node for {name}")
    start = time.perf_counter()
    err: Exception | None = None
    try:
        yield node
    except Exception as e:
        err = e
        raise
    finally:
        latency = (time.perf_counter() - start) * 1000
        if err is None:
            db_router.report_success(node, latency_ms=latency)
        else:
            db_router.report_failure(node, error=str(err))

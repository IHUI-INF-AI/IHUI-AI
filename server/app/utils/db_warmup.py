"""Bug-75: 数据库连接预热 + 健康探针.

设计:
  - 启动时预热 N 条连接, 避免首个请求慢查询
  - 周期性健康探针 (select 1), 5s 内感知故障
  - 与 db_router 协同: 不健康节点标 unhealthy, 健康节点可被复用
  - 预热失败重试, 指数退避, 最终告警
  - 不引入第三方依赖, 直接用 SQLAlchemy 文本执行

使用:
    from app.utils.db_warmup import db_warmup

    # 注册要预热的引擎
    db_warmup.register("ai", engine)
    db_warmup.register("center", engine)

    # 启动时一次性预热
    db_warmup.warmup_all()

    # 后台启动周期探针
    db_warmup.start_health_loop(interval_sec=5)
"""

import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import text

logger = logging.getLogger(__name__)

DEFAULT_WARMUP_SIZE = 3
DEFAULT_PROBE_INTERVAL = 5.0
DEFAULT_PROBE_TIMEOUT = 2.0
DEFAULT_RETRY_BACKOFF = 1.5
DEFAULT_MAX_RETRIES = 3


@dataclass
class NodeStatus:
    name: str
    healthy: bool = True
    last_probe_ts: float = 0.0
    last_success_ts: float = 0.0
    last_fail_ts: float = 0.0
    last_error: str = ""
    consecutive_fails: int = 0
    total_probes: int = 0
    total_failures: int = 0
    warmup_attempts: int = 0
    warmup_success: int = 0

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "healthy": self.healthy,
            "last_probe_ts": round(self.last_probe_ts, 3),
            "last_success_ts": round(self.last_success_ts, 3),
            "last_fail_ts": round(self.last_fail_ts, 3),
            "last_error": self.last_error,
            "consecutive_fails": self.consecutive_fails,
            "total_probes": self.total_probes,
            "total_failures": self.total_failures,
            "warmup_attempts": self.warmup_attempts,
            "warmup_success": self.warmup_success,
        }


class DbWarmup:
    """数据库预热 + 健康探针."""

    def __init__(
        self,
        warmup_size: int = DEFAULT_WARMUP_SIZE,
        probe_interval: float = DEFAULT_PROBE_INTERVAL,
        probe_timeout: float = DEFAULT_PROBE_TIMEOUT,
    ):
        self._engines: dict[str, object] = {}
        self._status: dict[str, NodeStatus] = {}
        self._lock = threading.Lock()
        self._warmup_size = warmup_size
        self._probe_interval = probe_interval
        self._probe_timeout = probe_timeout
        self._probe_thread: threading.Thread | None = None
        self._stop_flag = False
        self._on_unhealthy: Callable | None = None

    def set_unhealthy_callback(self, cb: Callable) -> None:
        """节点从不健康→健康切换, 或健康→不健康时回调. cb(name, healthy)."""
        self._on_unhealthy = cb

    def register(self, name: str, engine) -> None:
        with self._lock:
            self._engines[name] = engine
            if name not in self._status:
                self._status[name] = NodeStatus(name=name)

    def unregister(self, name: str) -> None:
        with self._lock:
            self._engines.pop(name, None)
            self._status.pop(name, None)

    def get_status(self, name: str) -> NodeStatus | None:
        return self._status.get(name)

    def all_status(self) -> dict:
        with self._lock:
            return {n: s.to_dict() for n, s in self._status.items()}

    # ----- 预热 -----
    def warmup_one(self, name: str) -> bool:
        """对单个引擎预热 warmup_size 条连接."""
        with self._lock:
            engine = self._engines.get(name)
        if engine is None:
            logger.warning(f"db_warmup: engine {name} not registered")
            return False
        ok = 0
        for _i in range(self._warmup_size):
            attempt = 0
            while attempt < DEFAULT_MAX_RETRIES:
                attempt += 1
                with self._lock:
                    if name in self._status:
                        self._status[name].warmup_attempts += 1
                try:
                    with engine.connect() as conn:  # type: ignore[attr-defined]
                        from sqlalchemy import text

                        conn.execute(text("SELECT 1"))
                    ok += 1
                    with self._lock:
                        if name in self._status:
                            self._status[name].warmup_success += 1
                    break
                except Exception as e:
                    wait = DEFAULT_RETRY_BACKOFF**attempt * 0.1
                    logger.debug(f"db_warmup[{name}] attempt {attempt} fail: {e!r}, retry in {wait:.2f}s")
                    time.sleep(wait)
            else:
                logger.error(f"db_warmup[{name}] all retries exhausted")
        return ok == self._warmup_size

    def warmup_all(self) -> dict[str, bool]:
        """对所有注册引擎预热. 返回 {name: success}."""
        with self._lock:
            names = list(self._engines.keys())
        result = {}
        for n in names:
            result[n] = self.warmup_one(n)
        return result

    # ----- 健康探针 -----
    def probe_one(self, name: str) -> bool:
        """对单个引擎执行一次 SELECT 1, 返回是否健康."""
        with self._lock:
            engine = self._engines.get(name)
            st = self._status.get(name)
        if engine is None or st is None:
            return False
        st.total_probes += 1
        try:
            with engine.connect() as conn:  # type: ignore[attr-defined]
                conn.execute(text("SELECT 1"))
            now = time.time()
            was_unhealthy = not st.healthy
            st.healthy = True
            st.last_success_ts = now
            st.last_probe_ts = now
            st.consecutive_fails = 0
            st.last_error = ""
            if was_unhealthy and self._on_unhealthy is not None:
                try:
                    self._on_unhealthy(name, True)
                except Exception:
                    logger.warning("Caught unexpected exception")
            return True
        except Exception as e:
            now = time.time()
            was_healthy = st.healthy
            st.healthy = False
            st.last_fail_ts = now
            st.last_probe_ts = now
            st.consecutive_fails += 1
            st.total_failures += 1
            st.last_error = repr(e)[:200]
            if was_healthy and self._on_unhealthy is not None:
                try:
                    self._on_unhealthy(name, False)
                except Exception:
                    logger.warning("Caught unexpected exception")
            return False

    def probe_all(self) -> dict[str, bool]:
        with self._lock:
            names = list(self._engines.keys())
        return {n: self.probe_one(n) for n in names}

    # ----- 后台探针循环 -----
    def start_health_loop(self, interval_sec: float | None = None) -> None:
        if self._probe_thread is not None and self._probe_thread.is_alive():
            return
        self._stop_flag = False
        if interval_sec is not None:
            self._probe_interval = interval_sec

        def loop() -> None:
            while not self._stop_flag:
                self.probe_all()
                # 简单 sleep 配合 stop_flag 快速响应
                end = time.time() + self._probe_interval
                while time.time() < end and not self._stop_flag:
                    time.sleep(0.2)

        self._probe_thread = threading.Thread(target=loop, name="db-warmup-probe", daemon=True)
        self._probe_thread.start()
        logger.info(f"db_warmup: probe loop started interval={self._probe_interval}s")

    def stop_health_loop(self) -> None:
        self._stop_flag = True
        if self._probe_thread is not None:
            self._probe_thread.join(timeout=2.0)
            self._probe_thread = None
        logger.info("db_warmup: probe loop stopped")

    def stats(self) -> dict:
        with self._lock:
            nodes = {n: s.to_dict() for n, s in self._status.items()}
        return {
            "warmup_size": self._warmup_size,
            "probe_interval": self._probe_interval,
            "probe_running": self._probe_thread is not None and self._probe_thread.is_alive(),
            "nodes": nodes,
        }


# 全局单例
db_warmup = DbWarmup()

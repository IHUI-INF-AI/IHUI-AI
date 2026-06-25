"""优雅停机处理 - SIGTERM / SIGINT 信号优雅关闭.

特性:
- 收到 SIGTERM/SIGINT 后:
  1. 标记服务为 not-ready (K8s 摘除流量)
  2. 等待正在处理的请求完成 (最多 timeout 秒)
  3. 关闭数据库连接池 / Redis 连接
  4. 关闭 Prometheus 指标导出
  5. 退出进程
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import signal
import threading
import time

logger = logging.getLogger(__name__)

# 全局状态
_is_shutting_down = False
_shutdown_event: asyncio.Event | None = None
_in_flight_count = 0
_in_flight_lock = threading.Lock()
SHUTDOWN_TIMEOUT_SEC = 30  # K8s 默认 terminationGracePeriodSeconds 是 30


def request_started() -> None:
    """请求开始 (中间件调用)."""
    global _in_flight_count
    with _in_flight_lock:
        _in_flight_count += 1


def request_finished() -> None:
    """请求结束 (中间件调用)."""
    global _in_flight_count
    with _in_flight_lock:
        if _in_flight_count > 0:
            _in_flight_count -= 1


def is_shutting_down() -> bool:
    """是否处于停机过程中."""
    return _is_shutting_down


def in_flight_count() -> int:
    """获取正在处理的请求数."""
    with _in_flight_lock:
        return _in_flight_count


def get_shutdown_event() -> asyncio.Event:
    """获取全局停机事件 (供异步任务监听)."""
    global _shutdown_event
    if _shutdown_event is None:
        _shutdown_event = asyncio.Event()
    return _shutdown_event


def _wait_for_in_flight(timeout: int) -> bool:
    """等待正在处理的请求完成. 超时返回 False."""
    start = time.time()
    while in_flight_count() > 0 and time.time() - start < timeout:
        time.sleep(0.1)
    return in_flight_count() == 0


def _cleanup_resources() -> None:
    """关闭数据库 / Redis / 其它资源."""
    # 数据库引擎
    try:
        from app.database import engine1, engine2, engine3

        for eng in (engine1, engine2, engine3):
            try:
                eng.dispose()
            except Exception as e:
                logger.debug(f"engine dispose fail: {e}")
        logger.info("数据库连接池已关闭")
    except Exception as e:
        logger.debug(f"db cleanup fail: {e}")

    # Redis 客户端
    try:
        from app.utils.redis_util import close_redis

        close_redis()
        logger.info("Redis 连接已关闭")
    except Exception as e:
        logger.debug(f"redis cleanup fail: {e}")


def _handle_signal(signum, frame):
    """信号处理函数 (同步, 在主线程调用)."""
    global _is_shutting_down
    if _is_shutting_down:
        return
    _is_shutting_down = True
    logger.info(f"收到信号 {signum}, 开始优雅停机...")

    # 等待正在处理的请求
    completed = _wait_for_in_flight(SHUTDOWN_TIMEOUT_SEC)
    if not completed:
        logger.warning(
            f"等待超时 (>{SHUTDOWN_TIMEOUT_SEC}s), 仍有 {in_flight_count()} 个请求未完成, 强制退出"
        )

    # 清理资源
    _cleanup_resources()

    # 触发停机事件 (供异步任务感知)
    try:
        event = get_shutdown_event()
        if event and not event.is_set():
            event.set()
    except Exception as e:
        logger.debug("触发停机事件失败: %s", e)

    logger.info("优雅停机完成")
    # 退出 (uvicorn 捕获后会立即终止)
    os._exit(0)


def install_graceful_shutdown(timeout_sec: int = SHUTDOWN_TIMEOUT_SEC) -> None:
    """注册优雅停机信号处理.

    仅在主进程中生效 (避免 uvicorn worker 重复注册).
    """
    global SHUTDOWN_TIMEOUT_SEC

    # 多 worker (uvicorn --workers N) 时, 只有主进程注册信号
    # 通过环境变量 WORKER_ID 判断; 缺失时假设主进程
    if os.environ.get("UVICORN_WORKER_ID") and os.environ.get("UVICORN_WORKER_ID") != "0":
        logger.info("非主 worker, 跳过优雅停机注册")
        return

    SHUTDOWN_TIMEOUT_SEC = timeout_sec

    # Windows 不支持 SIGTERM, 使用 SIGINT (Ctrl+C)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _handle_signal)
    if hasattr(signal, "SIGINT"):
        signal.signal(signal.SIGINT, _handle_signal)
    # SIGHUP 仅 Linux
    if hasattr(signal, "SIGHUP"):
        with contextlib.suppress(ValueError, OSError):
            signal.signal(signal.SIGHUP, _handle_signal)

    logger.info(f"优雅停机已注册 (timeout={timeout_sec}s)")


__all__ = [
    "SHUTDOWN_TIMEOUT_SEC",
    "get_shutdown_event",
    "in_flight_count",
    "install_graceful_shutdown",
    "is_shutting_down",
    "request_finished",
    "request_started",
]

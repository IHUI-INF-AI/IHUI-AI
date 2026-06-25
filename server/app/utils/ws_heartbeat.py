"""Bug-74: WebSocket 心跳与重连退避.

服务端 (PingHeart):
  - 周期性发 ping frame
  - 超过 N 秒无 pong → 判定死链 → 关闭
  - 超过 N 个 ping 失败 → 上报告警

客户端 (ReconnectBackoff):
  - 指数退避: 1s, 2s, 4s, 8s, ... + 抖动
  - 最大间隔 (默认 30s)
  - 触发重连条件: 连接 close / ping 超时 / 业务错误
  - 提供 server-friendly 配置参数

使用 (服务端):
    from app.utils.ws_heartbeat import PingHeart

    async with PingHeart(ws, timeout=30) as heart:
        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
            heart.on_recv()

使用 (客户端):
    from app.utils.ws_heartbeat import ReconnectBackoff

    bo = ReconnectBackoff(initial=1, max_wait=30, jitter=0.3)
    while not stop:
        try:
            await connect()
            bo.reset()
            await listen()
        except (Disconnect, TimeoutError):
            wait = bo.next_wait()
            await asyncio.sleep(wait)
"""

import asyncio
import logging
import random
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

DEFAULT_PING_INTERVAL = 20.0  # 每 20s 发一次 ping
DEFAULT_PING_TIMEOUT = 60.0  # 60s 没收到任何东西 (含 pong) → 死链
DEFAULT_BACKOFF_INITIAL = 1.0
DEFAULT_BACKOFF_MAX = 30.0
DEFAULT_BACKOFF_JITTER = 0.3
DEFAULT_BACKOFF_MULTIPLIER = 2.0
MAX_CONSECUTIVE_FAILURES = 10


class PingHeart:
    """服务端 WS 心跳."""

    def __init__(
        self,
        ws,
        ping_interval: float = DEFAULT_PING_INTERVAL,
        ping_timeout: float = DEFAULT_PING_TIMEOUT,
        on_dead: Callable | None = None,
    ):
        self.ws = ws
        self.ping_interval = ping_interval
        self.ping_timeout = ping_timeout
        self.on_dead = on_dead
        self._last_recv_ts = time.time()
        self._last_ping_ts = 0.0
        self._stopped = False
        self._task: asyncio.Task | None = None
        self._missed_pings = 0
        self._max_missed_pings = 3

    def on_recv(self) -> None:
        """业务收到任意消息时调一次, 刷新心跳时间戳."""
        self._last_recv_ts = time.time()
        self._missed_pings = 0

    async def __aenter__(self) -> "PingHeart":
        self._task = asyncio.create_task(self._loop())
        return self

    async def __aexit__(self, *exc) -> None:
        self._stopped = True
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                logger.info("任务被取消,正在退出")
                raise
            except Exception as e:
                logger.warning("任务异常: %s", e, exc_info=True)

    async def _loop(self) -> None:
        try:
            while not self._stopped:
                await asyncio.sleep(self.ping_interval)
                if self._stopped:
                    return
                # 检查超时
                now = time.time()
                idle = now - self._last_recv_ts
                if idle > self.ping_timeout:
                    self._missed_pings += 1
                    if self._missed_pings >= self._max_missed_pings:
                        logger.warning(f"ws heart dead: idle={idle:.1f}s > timeout={self.ping_timeout}")
                        if self.on_dead is not None:
                            try:
                                await self.on_dead()
                            except Exception:
                                logger.warning("Caught unexpected exception")
                        try:
                            await self.ws.close(code=1011, reason="ping_timeout")
                        except Exception:
                            logger.warning("Caught unexpected exception")
                        return
                # 发 ping
                try:
                    await self.ws.send_text("ping")
                    self._last_ping_ts = now
                except Exception as e:
                    logger.debug(f"ws send ping fail: {e}")
                    return
        except asyncio.CancelledError:
            return
        except Exception as e:
            logger.debug(f"ws heart loop err: {e}")


class ReconnectBackoff:
    """客户端 WS 重连退避策略."""

    def __init__(
        self,
        initial: float = DEFAULT_BACKOFF_INITIAL,
        max_wait: float = DEFAULT_BACKOFF_MAX,
        multiplier: float = DEFAULT_BACKOFF_MULTIPLIER,
        jitter: float = DEFAULT_BACKOFF_JITTER,
    ):
        self.initial = initial
        self.max_wait = max_wait
        self.multiplier = multiplier
        self.jitter = jitter
        self._attempt = 0
        self._total_failures = 0
        self._last_wait = 0.0
        self._last_reset_ts: float | None = None
        self._max_consecutive = MAX_CONSECUTIVE_FAILURES
        self._consecutive_failures = 0

    def reset(self) -> None:
        """连接成功时重置."""
        self._attempt = 0
        self._consecutive_failures = 0
        self._last_reset_ts = time.time()

    def record_failure(self) -> None:
        self._total_failures += 1
        self._consecutive_failures += 1

    def next_wait(self) -> float:
        """计算下一次重连等待时间 (含 jitter)."""
        if self._consecutive_failures > self._max_consecutive:
            # 超过上限, 给一个"很长"等待
            base = self.max_wait * 5
        else:
            base = self.initial * (self.multiplier**self._attempt)
            base = min(base, self.max_wait)
        self._attempt += 1
        # jitter: ± jitter * base
        if self.jitter > 0:
            delta = base * self.jitter
            base = base + random.uniform(-delta, delta)
        base = max(0.1, base)
        self._last_wait = base
        return base

    def stats(self) -> dict:
        return {
            "attempt": self._attempt,
            "consecutive_failures": self._consecutive_failures,
            "total_failures": self._total_failures,
            "last_wait": round(self._last_wait, 2),
            "max_consecutive": self._max_consecutive,
            "last_reset_ts": self._last_reset_ts,
        }

    def is_giving_up(self) -> bool:
        """是否已放弃 (超过最大连续失败)."""
        return self._consecutive_failures > self._max_consecutive


@dataclass
class WsConnectionState:
    """连接状态 (用于监控/UI 展示)."""

    url: str = ""
    connected: bool = False
    last_connected_at: float | None = None
    last_disconnected_at: float | None = None
    last_ping_at: float | None = None
    last_pong_at: float | None = None
    attempt: int = 0
    total_connects: int = 0
    total_disconnects: int = 0
    backoff_history: list[float] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "connected": self.connected,
            "last_connected_at": self.last_connected_at,
            "last_disconnected_at": self.last_disconnected_at,
            "last_ping_at": self.last_ping_at,
            "last_pong_at": self.last_pong_at,
            "attempt": self.attempt,
            "total_connects": self.total_connects,
            "total_disconnects": self.total_disconnects,
            "backoff_history": self.backoff_history[-20:],
        }


# 全局状态注册表 (按 url 区分)
_states: dict = {}

_states_lock = threading.Lock()


def get_state(url: str) -> WsConnectionState:
    with _states_lock:
        st = _states.get(url)
        if st is None:
            st = WsConnectionState(url=url)
            _states[url] = st
        return st


def all_states() -> dict:
    with _states_lock:
        return {u: s.to_dict() for u, s in _states.items()}

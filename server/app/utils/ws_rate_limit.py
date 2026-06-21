"""Bug-55: WebSocket 流量控制 (rate limit per connection).

每个 WS 连接每秒最多 N 条入向消息 (默认 30), 超过则丢帧 + 计数.
可通过 hot_config.HOT_WS_RATE_PER_SEC 调阈值.
"""

import time
from collections import defaultdict, deque

# 默认阈值 (msg/sec/conn)
DEFAULT_RATE_PER_SEC = 30
DEFAULT_BURST = 50  # 允许短时突发

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        from app.utils.redis_client import get_redis as _gr

        _redis_client = _gr()
    except Exception:
        pass  # intentionally ignored
    return _redis_client


def _threshold() -> tuple[int, int]:
    """从 hot_config 读取阈值, 缺省 (30, 50)."""
    rate = DEFAULT_RATE_PER_SEC
    burst = DEFAULT_BURST
    try:
        from app.utils.hot_config import hot_get

        r = hot_get("WS_RATE_PER_SEC")
        if r is not None:
            rate = int(r)
        b = hot_get("WS_BURST")
        if b is not None:
            burst = int(b)
    except Exception:
        pass  # intentionally ignored
    return rate, burst


# ---------------------------------------------------------------------------
# 进程内限流 (主): 滑窗
# ---------------------------------------------------------------------------


class ConnRateLimiter:
    """每连接令牌桶 + 滑窗计数.

    用 deque 存最近 1s 内的消息时间戳, 超过 rate 丢帧.
    允许短时突发 burst 个.
    """

    def __init__(self):
        self._windows: defaultdict[str, deque[float]] = defaultdict(deque)
        self._dropped: defaultdict[str, int] = defaultdict(int)
        self._total_allowed: defaultdict[str, int] = defaultdict(int)

    def allow(self, conn_id: str) -> tuple[bool, int]:
        """是否放行本条消息.

        Returns:
            (allow, dropped_count)
        """
        rate, burst = _threshold()
        now = time.time()
        win = self._windows[conn_id]
        # 弹出 1s 之前的
        while win and now - win[0] > 1.0:
            win.popleft()
        if len(win) < rate:
            win.append(now)
            self._total_allowed[conn_id] += 1
            return True, self._dropped[conn_id]
        # 突发窗口 (rate < win_len <= burst) 放行但记录
        if len(win) < burst:
            win.append(now)
            self._total_allowed[conn_id] += 1
            return True, self._dropped[conn_id]
        # 丢帧
        self._dropped[conn_id] += 1
        return False, self._dropped[conn_id]

    def reset(self, conn_id: str) -> None:
        self._windows.pop(conn_id, None)
        self._dropped.pop(conn_id, None)
        self._total_allowed.pop(conn_id, None)

    def stats(self, conn_id: str) -> dict:
        return {
            "in_window": len(self._windows.get(conn_id, [])),
            "dropped": self._dropped.get(conn_id, 0),
            "allowed_total": self._total_allowed.get(conn_id, 0),
        }


# 全局单例
limiter = ConnRateLimiter()


def should_drop_message(conn_id: str) -> tuple[bool, int]:
    """便捷接口: 业务端每收到一条消息时调用."""
    return limiter.allow(conn_id)


# ---------------------------------------------------------------------------
# 跨实例限流 (从 Redis): 每用户每秒全局 N 条
# ---------------------------------------------------------------------------


def _user_key(user_uuid: str) -> str:
    return f"zhs:ws:user_rate:{user_uuid}"


def user_rate_check(user_uuid: str) -> bool:
    """跨实例用户级限流, 返回 True 表示放行."""
    r = _get_redis()
    if r is None or not user_uuid:
        return True
    rate, _ = _threshold()
    try:
        key = _user_key(user_uuid)
        count = r.incr(key)
        if count == 1:
            r.expire(key, 2)  # 2s 窗口
        return count <= rate * 2  # 跨实例允许 2x 阈值
    except Exception:
        return True

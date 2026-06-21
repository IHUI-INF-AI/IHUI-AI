"""Bug-63: WebSocket 集群消息回放.

场景: 客户端连接 node A, 收到 server 推的消息 msg_id=5. 客户端因网络断开
      重连到 node B. node B 不知道 msg_id 5, 客户端丢消息.
解决:
  1. 每条 server→client 消息都分配全局递增的 msg_id
  2. msg_id 持久化到 Redis LIST (zhs:ws:replay:<topic>), 保留最近 N 条 / N 分钟
  3. 客户端重连时携带 last_msg_id, server 从 last_msg_id+1 开始补发
  4. 客户端 ack 推进 last_msg_id (可选, 避免长期累积)

使用:
    from app.utils.ws_replay_buffer import replay_buffer, ReplayMessage

    # 发送时:
    msg_id = replay_buffer.append(topic="room_xxx", data={"text": "hi"})
    await ws.send_json({"msg_id": msg_id, "data": ...})

    # 重连时:
    msgs = replay_buffer.fetch_since(topic="room_xxx", since_id=last_msg_id)
    for m in msgs:
        await ws.send_json(m.to_envelope())
"""

import json
import logging
import os
import threading
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# 默认参数 (可被 hot_config 覆盖)
DEFAULT_MAX_PER_TOPIC = 500
DEFAULT_TTL_SEC = 30 * 60  # 30 分钟
LOCAL_INCR_KEY = "zhs:ws:msg_id_counter"


@dataclass
class ReplayMessage:
    msg_id: int
    topic: str
    payload: dict
    timestamp: float
    sender_node: str = ""

    def to_envelope(self) -> dict:
        return {
            "msg_id": self.msg_id,
            "topic": self.topic,
            "ts": self.timestamp,
            "data": self.payload,
            "from_replay": True,
        }


class WsReplayBuffer:
    """集群 WS 消息回放缓冲.

    存储: Redis LIST (zhs:ws:replay:<topic>)
      - 写入: RPUSH <json>
      - 读取: LRANGE 0 -1 (业务侧过滤 msg_id > since_id)
      - 淘汰: LTRIM (保留最近 max 条)
      - TTL: 每条 EXPIRE 一次 (简单的 30 分钟过期)
    msg_id: 全局自增, 用 Redis INCR 保证多实例唯一
    """

    def __init__(self):
        self._local_cache: dict[str, list[ReplayMessage]] = {}
        self._lock = threading.Lock()
        self._node_id = os.environ.get("NODE_ID", f"node-{os.getpid()}")
        self._max_per_topic = DEFAULT_MAX_PER_TOPIC
        self._ttl_sec = DEFAULT_TTL_SEC

    def _get_redis(self):
        try:
            from app.utils.redis_client import get_redis

            return get_redis()
        except Exception as e:
            logger.debug(f"ws_replay_buffer redis unavailable: {e}")
            return None

    def _hot_config(self) -> tuple[int, int]:
        try:
            from app.utils.hot_config import hot_get

            mx = hot_get("WS_REPLAY_MAX_PER_TOPIC", DEFAULT_MAX_PER_TOPIC)
            ttl = hot_get("WS_REPLAY_TTL_SEC", DEFAULT_TTL_SEC)
            return int(mx), int(ttl)
        except Exception:
            return self._max_per_topic, self._ttl_sec

    def _list_key(self, topic: str) -> str:
        return f"zhs:ws:replay:{topic}"

    def _next_msg_id(self) -> int:
        """分配全局递增 msg_id (Redis INCR)."""
        r = self._get_redis()
        if r is not None:
            try:
                return int(r.incr(LOCAL_INCR_KEY))
            except Exception:
                logger.warning("Caught unexpected exception")
        # 降级: 单调递增 (高 40 位 ts 微秒, 低 24 位递增计数)
        with self._lock:
            cur = getattr(self, "_local_counter", 0)
            cur += 1
            self._local_counter = cur
            ts = int(time.time() * 1_000_000) & 0xFFFFFFFFFF000000
            return ts | (cur & 0xFFFFFF)

    # ----- 写入 -----
    def append(self, topic: str, payload: dict) -> int:
        """记录一条消息到回放缓冲, 返回 msg_id."""
        msg_id = self._next_msg_id()
        msg = ReplayMessage(
            msg_id=msg_id,
            topic=topic,
            payload=payload,
            timestamp=time.time(),
            sender_node=self._node_id,
        )
        # Redis 持久化
        r = self._get_redis()
        max_per_topic, ttl_sec = self._hot_config()
        if r is not None:
            try:
                key = self._list_key(topic)
                r.rpush(key, json.dumps(msg.__dict__, ensure_ascii=False))
                r.ltrim(key, -max_per_topic, -1)
                r.expire(key, ttl_sec)
            except Exception as e:
                logger.debug(f"ws_replay_buffer.append redis fail: {e}")
        # 本地缓存 (兜底)
        with self._lock:
            buf = self._local_cache.setdefault(topic, [])
            buf.append(msg)
            if len(buf) > max_per_topic:
                self._local_cache[topic] = buf[-max_per_topic:]
        return msg_id

    # ----- 读取 -----
    def fetch_since(self, topic: str, since_id: int = 0, limit: int = 100) -> list[ReplayMessage]:
        """从 since_id+1 开始取消息 (since_id=0 表示从头)."""
        r = self._get_redis()
        out: list[ReplayMessage] = []
        if r is not None:
            try:
                key = self._list_key(topic)
                raw = r.lrange(key, 0, -1)
                for item in raw:
                    try:
                        d = json.loads(item)
                        m = ReplayMessage(
                            msg_id=int(d["msg_id"]),
                            topic=d["topic"],
                            payload=d.get("payload", {}),
                            timestamp=float(d.get("timestamp", 0)),
                            sender_node=d.get("sender_node", ""),
                        )
                        if m.msg_id > since_id:
                            out.append(m)
                    except Exception:
                        continue
                if out:
                    out.sort(key=lambda x: x.msg_id)
                    return out[:limit]
            except Exception as e:
                logger.debug(f"ws_replay_buffer.fetch redis fail: {e}")
        # 降级本地
        with self._lock:
            local = list(self._local_cache.get(topic, []))
        local = [m for m in local if m.msg_id > since_id]
        local.sort(key=lambda x: x.msg_id)
        return local[:limit]

    # ----- 工具 -----
    def get_latest_id(self, topic: str) -> int:
        """拿 topic 当前最大 msg_id."""
        msgs = self.fetch_since(topic, since_id=0)
        if not msgs:
            return 0
        return msgs[-1].msg_id

    def clear_topic(self, topic: str) -> None:
        """清空某 topic 的缓冲 (管理员用)."""
        r = self._get_redis()
        if r is not None:
            try:
                r.delete(self._list_key(topic))
            except Exception:
                logger.warning("Caught unexpected exception")
        with self._lock:
            self._local_cache.pop(topic, None)

    def stats(self) -> dict:
        return {
            "node_id": self._node_id,
            "local_topics": len(self._local_cache),
            "max_per_topic": self._max_per_topic,
            "ttl_sec": self._ttl_sec,
        }


# 全局单例
replay_buffer = WsReplayBuffer()

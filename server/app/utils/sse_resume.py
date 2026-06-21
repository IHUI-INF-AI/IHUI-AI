"""Bug-76: 大模型流式响应 (SSE) 断点续传.

设计:
  - LLM 流式输出逐 token 写入 Redis 列表 (maxlen=N)
  - 客户端断线重连, 携带 last_seq 请求断点
  - 服务端从 last_seq+1 续推剩余内容
  - 完成后归档到历史 (供回看)
  - 兼容纯文本 (text/event-stream) 格式

使用:
    from app.utils.sse_resume import sse_resume

    sid = sse_resume.start_stream(topic="chat:u1:c1")
    sse_resume.append(sid, "token1")
    sse_resume.append(sid, "token2")
    sse_resume.finish(sid)

    # 客户端断线后, 传入 last_seq
    events = sse_resume.resume(sid, last_seq=10)
"""

import logging
import threading
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

DEFAULT_MAX_BUFFER = 2000
DEFAULT_TTL_SEC = 3600
EVENT_FIELDS = ("id", "event", "data")


@dataclass
class SseEvent:
    seq: int
    data: str
    event: str = "message"
    ts: float = field(default_factory=time.time)

    def encode(self) -> str:
        # 标准 SSE 格式
        lines = []
        if self.event and self.event != "message":
            lines.append(f"event: {self.event}")
        lines.append(f"id: {self.seq}")
        # data 多行按规范前缀
        for chunk in self.data.split("\n"):
            lines.append(f"data: {chunk}")
        lines.append("")
        lines.append("")
        return "\n".join(lines)


@dataclass
class StreamState:
    sid: str
    topic: str = ""
    finished: bool = False
    created_at: float = field(default_factory=time.time)
    finished_at: float | None = None
    total_events: int = 0
    buffer: list[SseEvent] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "sid": self.sid,
            "topic": self.topic,
            "finished": self.finished,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
            "total_events": self.total_events,
            "buffer_len": len(self.buffer),
        }


class SseResume:
    """SSE 流断点续传管理."""

    def __init__(
        self,
        max_buffer: int = DEFAULT_MAX_BUFFER,
        ttl_sec: int = DEFAULT_TTL_SEC,
    ):
        self._streams: dict[str, StreamState] = {}
        self._lock = threading.Lock()
        self._max_buffer = max_buffer
        self._ttl_sec = ttl_sec
        self._total_streams = 0
        self._total_events = 0
        self._total_resumes = 0
        self._counter = 0

    def _next_seq(self) -> int:
        self._counter += 1
        return self._counter

    def start_stream(self, sid: str | None = None, topic: str = "") -> str:
        if not sid:
            sid = f"stream_{int(time.time() * 1000)}_{self._next_seq()}"
        with self._lock:
            if sid in self._streams:
                return sid
            self._streams[sid] = StreamState(sid=sid, topic=topic)
            self._total_streams += 1
        logger.debug(f"sse_resume: start sid={sid} topic={topic}")
        return sid

    def append(self, sid: str, data: str, event: str = "message") -> int:
        seq = self._next_seq()
        ev = SseEvent(seq=seq, data=data, event=event)
        with self._lock:
            st = self._streams.get(sid)
            if st is None:
                st = StreamState(sid=sid)
                self._streams[sid] = st
                self._total_streams += 1
            st.buffer.append(ev)
            st.total_events += 1
            # 环形 buffer
            if len(st.buffer) > self._max_buffer:
                st.buffer = st.buffer[-self._max_buffer :]
            self._total_events += 1
        return seq

    def finish(self, sid: str) -> None:
        with self._lock:
            st = self._streams.get(sid)
            if st is None:
                return
            st.finished = True
            st.finished_at = time.time()

    def resume(self, sid: str, last_seq: int = 0) -> list[SseEvent]:
        """从 last_seq+1 开始拿事件."""
        with self._lock:
            st = self._streams.get(sid)
            if st is None:
                return []
            events = [e for e in st.buffer if e.seq > last_seq]
            self._total_resumes += 1
        return events

    def get_state(self, sid: str) -> StreamState | None:
        with self._lock:
            return self._streams.get(sid)

    def encode_events(self, events: list[SseEvent]) -> str:
        return "".join(e.encode() for e in events)

    def drop(self, sid: str) -> None:
        with self._lock:
            self._streams.pop(sid, None)

    def cleanup_expired(self) -> int:
        """清理 ttl 之外已完成的流."""
        now = time.time()
        dropped = 0
        with self._lock:
            for sid in list(self._streams.keys()):
                st = self._streams[sid]
                anchor = st.finished_at or st.created_at
                if st.finished and now - anchor > self._ttl_sec:
                    self._streams.pop(sid, None)
                    dropped += 1
        return dropped

    def stats(self) -> dict:
        with self._lock:
            return {
                "active_streams": len(self._streams),
                "total_streams": self._total_streams,
                "total_events": self._total_events,
                "total_resumes": self._total_resumes,
                "max_buffer": self._max_buffer,
                "ttl_sec": self._ttl_sec,
            }


# 全局单例
sse_resume = SseResume()

"""Logstash TCP sink -- 把日志直接推送到 ELK 接收端.

用法:
    from app.utils.logstash_sink import install_logstash_sink
    install_logstash_sink("logstash.internal:5044")

环境变量 (推荐):
    LOGSTASH_HOST=logstash.internal
    LOGSTASH_PORT=5044
    LOGSTASH_ENABLED=1

设计:
  - 单线程 socket, 避免阻塞主请求
  - 失败时降级 (本地 stdout 仍工作)
  - 自动重连 (指数退避)
"""

import contextlib
import os
import socket
import threading
import time

from loguru import logger

try:
    from app.utils.elk_formatter import elk_format
    from app.utils.log_mask import _mask_value
    from app.utils.logstash_jsonl import record_to_jsonl
except Exception:
    _mask_value = None
    elk_format = None
    record_to_jsonl = None


class LogstashSink:
    """Logstash TCP sink -- 后台线程异步推送日志到 Logstash."""

    def __init__(self, host: str, port: int = 5044, queue_size: int = 1000):
        self.host = host
        self.port = port
        self.queue_size = queue_size
        self._queue: list[str] = []
        self._lock = threading.Lock()
        self._sock: socket.socket | None = None
        self._closed = False
        self._reconnect_delay = 1.0
        self._max_reconnect_delay = 60.0
        self._sent = 0
        self._dropped = 0
        self._errors = 0
        # 后台 worker
        self._thread = threading.Thread(target=self._worker, daemon=True, name="logstash-sink")
        self._thread.start()
        logger.info(f"LogstashSink started: {host}:{port}")

    def write(self, message: str) -> None:
        """loguru sink 入口: 接收格式化后的 record."""
        if self._closed:
            return
        record = message.record if hasattr(message, "record") else None
        if record is None:
            return
        # 用 jsonl codec 序列化 (兼容 Logstash json_lines)
        try:
            payload = record_to_jsonl(record) if record_to_jsonl else (elk_format(record) if elk_format else str(message))
        except Exception:
            payload = str(message)
        with self._lock:
            if len(self._queue) >= self.queue_size:
                self._dropped += 1
                return
            self._queue.append(payload)

    def _connect(self) -> bool:
        """建立 TCP 连接, 失败返回 False."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3)
            s.connect((self.host, self.port))
            s.settimeout(None)
            self._sock = s
            self._reconnect_delay = 1.0
            return True
        except Exception as e:
            logger.debug(f"Logstash connect {self.host}:{self.port} failed: {e}")
            self._sock = None
            return False

    def _worker(self) -> None:
        """后台 worker: 持续推送队列消息."""
        while not self._closed:
            if self._sock is None and not self._connect():
                time.sleep(self._reconnect_delay)
                self._reconnect_delay = min(self._reconnect_delay * 2, self._max_reconnect_delay)
                continue
            # 取一条
            payload = None
            with self._lock:
                if self._queue:
                    payload = self._queue.pop(0)
            if payload is None:
                time.sleep(0.1)
                continue
            # 推送
            try:
                self._sock.sendall((payload + "\n").encode("utf-8"))
                self._sent += 1
            except Exception as e:
                logger.debug(f"Logstash send error: {e}")
                self._errors += 1
                with contextlib.suppress(Exception):
                    self._sock.close()
                self._sock = None

    def stats(self) -> dict:
        """返回 sink 统计信息 (供 /healthz 查询)."""
        return {
            "host": self.host,
            "port": self.port,
            "queue_size": len(self._queue),
            "sent": self._sent,
            "dropped": self._dropped,
            "errors": self._errors,
            "connected": self._sock is not None,
        }

    def close(self) -> None:
        self._closed = True
        if self._sock:
            with contextlib.suppress(Exception):
                self._sock.close()


_sink_instance: LogstashSink | None = None


def install_logstash_sink(host: str | None = None, port: int | None = None) -> LogstashSink | None:
    """安装 Logstash sink. 返回 sink 实例, 失败返回 None.

    Args:
        host: Logstash host, 默认从 LOGSTASH_HOST 环境变量读
        port: Logstash port, 默认从 LOGSTASH_PORT 环境变量读 (5044)
    """
    global _sink_instance
    if _sink_instance is not None:
        return _sink_instance

    h = host or os.environ.get("LOGSTASH_HOST", "")
    if not h:
        logger.debug("Logstash sink not installed (no host)")
        return None
    p = port or int(os.environ.get("LOGSTASH_PORT", "5044"))

    try:
        sink = LogstashSink(h, p)
        # 注册到 loguru
        logger.add(sink.write, level="INFO", enqueue=False)
        _sink_instance = sink
        return sink
    except Exception as e:
        logger.warning(f"Logstash sink install failed: {e}")
        return None


def get_logstash_sink() -> LogstashSink | None:
    """获取当前 Logstash sink 实例 (供 /healthz 查询)."""
    return _sink_instance

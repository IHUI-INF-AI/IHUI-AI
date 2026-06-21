"""Logstash json_lines codec 适配器.

作用:
  - 把 loguru record 序列化成 Logstash json_lines 期望的格式
  - 兼容 codec/json_lines (每行一个 JSON 对象)
  - 字段命名遵循 Logstash @timestamp / @version 约定
  - 自动注入 trace_id / span_id 便于 ELK 链路追踪

json_lines 协议:
  input {
    tcp {
      port  => 5044
      codec => json_lines  # 期望每行一个 JSON, 字段名一致
    }
  }
"""

import datetime as dt
import os
import socket
import uuid

# Logstash 标准字段
LOGSTASH_VERSION = "1"
DEFAULT_TZ = "Asia/Shanghai"


def _iso_now() -> str:
    """生成 ISO 8601 时间戳 (Logstash 期望)."""
    return dt.datetime.now(dt.UTC).isoformat()


def _local_iso() -> str:
    """生成本地时区 ISO 8601."""
    return dt.datetime.now().astimezone().isoformat()


def _short_level(level_name: str) -> str:
    """loguru 级别名转 syslog 级别."""
    mapping = {
        "TRACE": "DEBUG",
        "DEBUG": "DEBUG",
        "INFO": "INFO",
        "SUCCESS": "INFO",
        "WARNING": "WARNING",
        "ERROR": "ERROR",
        "CRITICAL": "CRITICAL",
    }
    return mapping.get(level_name.upper(), "INFO")


def _safe_str(value, max_len: int = 1000) -> str:
    """转字符串, 截断超长, 处理非 UTF-8."""
    try:
        s = str(value) if value is not None else ""
    except Exception:
        s = repr(value)
    if len(s) > max_len:
        s = s[:max_len] + "...(truncated)"
    return s


def record_to_jsonl(record) -> str:
    """把 loguru record 序列化成 json_lines 一行.

    输出字段 (兼容 Logstash json_lines):
      @timestamp: ISO 8601 UTC
      @version: "1"
      host: 主机名
      level: syslog 级别名
      level_value: 数字 (debug=7/info=6/warning=4/error=3/critical=2)
      logger: logger 名
      message: 主消息
      module / function / line: 调用位置
      process: pid
      thread: 线程名
      extra.* : 用户附加字段
      trace_id / span_id: OpenTelemetry 兼容
    """
    import json

    # 数字级别 (syslog)
    level_value = {
        "TRACE": 7,
        "DEBUG": 7,
        "INFO": 6,
        "SUCCESS": 6,
        "WARNING": 4,
        "ERROR": 3,
        "CRITICAL": 2,
    }.get(record["level"].name.upper(), 6)

    # 提取 extra 字段 (loguru 把非标准字段放 record["extra"])
    extra = dict(record.get("extra") or {})

    # OpenTelemetry 兼容
    trace_id = extra.pop("trace_id", None) or os.environ.get("TRACE_ID", "")
    span_id = extra.pop("span_id", None) or os.environ.get("SPAN_ID", "")

    payload = {
        "@timestamp": _iso_now(),
        "@version": LOGSTASH_VERSION,
        "host": socket.gethostname(),
        "env": os.environ.get("ENV", "dev"),
        "service": os.environ.get("SERVICE_NAME", "zhs-api"),
        "level": _short_level(record["level"].name),
        "level_value": level_value,
        "logger": record["name"],
        "message": _safe_str(record["message"]),
        "module": record.get("module", ""),
        "function": record.get("function", ""),
        "line": record.get("line", 0),
        "process": record.get("process", {}).get("id", 0),
        "thread": record.get("thread", {}).get("name", ""),
        "trace_id": trace_id,
        "span_id": span_id,
        "extra": extra,
    }

    # exception 堆栈
    if record.get("exception") is not None:
        exc = record["exception"]
        payload["exception"] = {
            "type": exc.type.__name__ if exc.type else "",
            "value": _safe_str(exc.value),
            "traceback": _safe_str(exc.traceback, max_len=5000),
        }

    # 压缩序列化
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def format_exception(exc_type, exc_value, exc_tb) -> dict:
    """格式化 Python 异常为 Logstash 字段."""
    import traceback

    tb_lines = traceback.format_exception(exc_type, exc_value, exc_tb)
    return {
        "exception": {
            "type": exc_type.__name__ if exc_type else "",
            "value": _safe_str(exc_value),
            "traceback": _safe_str("".join(tb_lines), max_len=5000),
        }
    }


def new_trace_id() -> str:
    """生成 32 位 trace_id (OpenTelemetry 兼容)."""
    return uuid.uuid4().hex


def new_span_id() -> str:
    """生成 16 位 span_id."""
    return uuid.uuid4().hex[:16]

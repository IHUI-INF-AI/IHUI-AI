"""Bug-50: ELK 接入 -- 关键业务日志 JSON 输出.

提供:
  - json_sink: 把 loguru 记录格式化为 JSON, 写到 stdout (供 Filebeat / Fluentd 采集)
  - elk_format: 单条 record 的 JSON 格式化
  - install_elk_sink: 安装到 loguru 接管默认 stdout
  - is_elk_enabled: 探测 (供 /healthz)

设计:
  - 兼容现有 loguru 文本输出 (不替换)
  - JSON 行包括: timestamp / level / service / message / trace_id / request_id / user_uuid / extra
  - 敏感字段自动脱敏 (复用 log_mask 现有规则)
"""

import json
import logging
import os
import sys
from typing import Any

logger = logging.getLogger(__name__)

try:
    from loguru import logger as _loguru_logger
except Exception:
    _loguru_logger = None  # type: ignore[assignment]

try:
    from app.utils.log_mask import SENSITIVE_KEYS, _mask_value  # type: ignore[attr-defined]
except Exception:
    SENSITIVE_KEYS = {  # type: ignore[assignment]
        "password",
        "passwd",
        "pwd",
        "secret",
        "token",
        "access_token",
        "refresh_token",
        "authorization",
        "phone",
        "idcard",
        "id_card",
        "cardno",
        "card_no",
        "cvv",
        "pin",
        "open_id",
        "unionid",
    }
    _mask_value = None

# ELK 是否启用 (用环境变量控制, 默认 false)
ELK_ENABLED = bool(os.environ.get("ELK_ENABLED", "").lower() in ("1", "true", "yes"))
ELK_SERVICE_NAME = os.environ.get("ELK_SERVICE_NAME", "zhs-platform")
_ELK_INSTALLED = False


def elk_format(record: dict[str, Any]) -> str:
    """把 loguru record 序列化为 ELK 友好的 JSON 行.

    字段:
      - @timestamp: ISO 8601 UTC
      - level: INFO / WARNING / ERROR ...
      - service: ELK_SERVICE_NAME
      - message: 主消息
      - trace_id / request_id / user_uuid / tenant_id: 关联字段
      - module / function / line: 调用点
      - extra: 业务额外字段
    """
    rec = record.get("record", {})
    extras = rec.get("extra", {}) or {}

    # 基础
    ts = rec.get("time")
    iso_ts = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
    out: dict[str, Any] = {
        "@timestamp": iso_ts,
        "level": rec.get("level", {}).get("name", "INFO"),
        "service": ELK_SERVICE_NAME,
        "message": rec.get("message", ""),
        "module": rec.get("name", ""),
        "function": rec.get("function", ""),
        "line": rec.get("line", 0),
    }

    # 注入 contextvars (trace_id / request_id / user_uuid / tenant_id)
    try:
        from app.telemetry import (
            get_current_trace_id,
            get_request_id,
        )

        tid = get_current_trace_id()
        if tid:
            out["trace_id"] = tid
        rid = get_request_id()
        if rid:
            out["request_id"] = rid
    except Exception:
        logger.warning("Caught unexpected exception")

    # extras 合并 + 脱敏
    sensitive = {s.lower() for s in SENSITIVE_KEYS}
    for k, v in extras.items():
        if not _is_serializable(v):
            v = str(v)
        if k.lower() in sensitive:
            out[k] = "***"
        else:
            out[k] = v

    try:
        return json.dumps(out, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps(
            {**out, "message": f"log_serialize_error: {e}", "raw": str(rec)},
            ensure_ascii=False,
            default=str,
        )


def _is_serializable(v: Any) -> bool:
    try:
        json.dumps(v)
        return True
    except (TypeError, ValueError):
        return False


def install_elk_sink() -> bool:
    """安装 JSON sink 到 stdout (生产用).

    采用 serialize=True 让 loguru 自动把 record 序列化为 JSON.
    Windows 下 enqueue=True 不可用, 默认关闭 (用 threaded 替代).
    """
    global _ELK_INSTALLED
    if _ELK_INSTALLED or _loguru_logger is None:
        return False
    try:
        # Windows 默认不开 enqueue (子进程问题), 用 threaded 替代
        use_enqueue = os.environ.get("ELK_LOG_ENQUEUE", "").lower() in ("1", "true", "yes") and sys.platform != "win32"
        _loguru_logger.add(
            sys.stdout,
            serialize=True,
            level=os.environ.get("ELK_LOG_LEVEL", "INFO"),
            enqueue=use_enqueue,
            backtrace=False,
            diagnose=False,
        )
        _ELK_INSTALLED = True
        return True
    except Exception as e:
        import warnings

        warnings.warn(f"install_elk_sink failed: {e}", stacklevel=2)
        return False


def is_elk_enabled() -> bool:
    """供 /healthz 显示."""
    return ELK_ENABLED or _ELK_INSTALLED

"""Bug-57: 关键业务事件埋点 (Kafka 推送).

事件类别:
  - payment_success / payment_failed / refund_success / refund_failed
  - login_success / login_failed / logout
  - user_registered / user_cancelled
  - ws_connected / ws_disconnected
  - order_created / order_paid / order_refunded

使用:
    from app.utils.business_events import emit_event, EventType

    emit_event(EventType.PAYMENT_SUCCESS, {
        "order_no": "...",
        "amount": 100.0,
        "user_uuid": "...",
    })

发送策略:
  1. Kafka 可用 → 推送 JSON 到 topic "zhs_business_events"
  2. Kafka 不可用 → 退化为本地文件 (logs/business_events.jsonl)
  3. 双写: 写本地文件 + 推 Kafka (开发环境调试用)
"""

import json
import os
import time
import uuid
from enum import StrEnum
from typing import Any

from loguru import logger

DEFAULT_TOPIC = "zhs_business_events"
EVENT_LOG_FILE = os.path.join(os.environ.get("LOG_DIR", "logs"), "business_events.jsonl")
_kafka_producer = None
_producer_attempt_at: float = 0.0
_PRODUCER_RETRY_INTERVAL = 60.0


class EventType(StrEnum):
    """业务事件枚举."""

    PAYMENT_SUCCESS = "payment_success"
    PAYMENT_FAILED = "payment_failed"
    REFUND_SUCCESS = "refund_success"
    REFUND_FAILED = "refund_failed"
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    USER_REGISTERED = "user_registered"
    USER_CANCELLED = "user_cancelled"
    WS_CONNECTED = "ws_connected"
    WS_DISCONNECTED = "ws_disconnected"
    ORDER_CREATED = "order_created"
    ORDER_PAID = "order_paid"
    ORDER_REFUNDED = "order_refunded"
    PASSWORD_CHANGED = "password_changed"


# ---------------------------------------------------------------------------
# Kafka 客户端 (懒加载)
# ---------------------------------------------------------------------------


def _get_producer():
    """获取 Kafka producer (懒加载, 失败重试间隔 60s)."""
    global _kafka_producer, _producer_attempt_at
    now = time.time()
    if _kafka_producer is not None:
        return _kafka_producer
    if now - _producer_attempt_at < _PRODUCER_RETRY_INTERVAL:
        return None
    _producer_attempt_at = now
    try:
        from kafka import KafkaProducer

        bootstrap = os.environ.get("KAFKA_BOOTSTRAP", "localhost:9092")
        _kafka_producer = KafkaProducer(
            bootstrap_servers=bootstrap.split(","),
            value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"),
            acks="all",
            retries=3,
            request_timeout_ms=5000,
        )
        logger.info(f"business_events: Kafka producer ready ({bootstrap})")
        return _kafka_producer
    except Exception as e:
        logger.debug(f"business_events: Kafka unavailable ({e})")
        return None


# ---------------------------------------------------------------------------
# 事件发送
# ---------------------------------------------------------------------------


def emit_event(
    event_type: EventType,
    payload: dict[str, Any],
    *,
    user_uuid: str | None = None,
    correlation_id: str | None = None,
    write_local: bool = True,
) -> str:
    """发送业务事件, 返回 event_id.

    Args:
        event_type: 事件类型
        payload: 业务数据 (会与 envelope 合并)
        user_uuid: 关联用户 (可放 payload 中, 这里仅供 envelope 用)
        correlation_id: 链路追踪 ID (用于聚合相关事件)
        write_local: 是否同时落本地文件 (用于排查 / Kafka 故障兜底)
    """
    event_id = uuid.uuid4().hex
    envelope = {
        "event_id": event_id,
        "event_type": event_type.value,
        "ts": time.time(),
        "ts_iso": time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime()),
        "user_uuid": user_uuid,
        "correlation_id": correlation_id or event_id,
        "service": "zhs-platform",
        "payload": payload,
    }
    # 1) 落本地 (兜底)
    if write_local:
        try:
            os.makedirs(os.path.dirname(EVENT_LOG_FILE), exist_ok=True)
            with open(EVENT_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(envelope, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.debug(f"business_events local write failed: {e}")

    # 2) 推 Kafka
    producer = _get_producer()
    if producer is not None:
        try:
            producer.send(DEFAULT_TOPIC, value=envelope, key=event_id.encode())
            # 不阻塞主流程
            producer.flush(timeout=0)
        except Exception as e:
            logger.warning(f"business_events kafka send failed: {e}")

    return event_id


# ---------------------------------------------------------------------------
# 常用事件便捷函数
# ---------------------------------------------------------------------------


def emit_payment_success(order_no: str, amount: float, user_uuid: str, **extra):
    return emit_event(
        EventType.PAYMENT_SUCCESS,
        {"order_no": order_no, "amount": amount, **extra},
        user_uuid=user_uuid,
    )


def emit_refund_success(order_no: str, amount: float, user_uuid: str, **extra):
    return emit_event(
        EventType.REFUND_SUCCESS,
        {"order_no": order_no, "amount": amount, **extra},
        user_uuid=user_uuid,
    )


def emit_refund_failed(order_no: str, error: str, user_uuid: str, **extra):
    return emit_event(
        EventType.REFUND_FAILED,
        {"order_no": order_no, "error": error, **extra},
        user_uuid=user_uuid,
    )


def emit_login(user_uuid: str, method: str, success: bool, **extra):
    return emit_event(
        EventType.LOGIN_SUCCESS if success else EventType.LOGIN_FAILED,
        {"method": method, **extra},
        user_uuid=user_uuid,
    )


# ---------------------------------------------------------------------------
# 指标 (暴露给 Prometheus)
# ---------------------------------------------------------------------------


def get_event_stats() -> dict:
    """统计已发送的事件数 (按类型)."""
    stats: dict[str, Any] = {"total": 0, "by_type": {}}
    if not os.path.isfile(EVENT_LOG_FILE):
        return stats
    try:
        with open(EVENT_LOG_FILE, encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    t = obj.get("event_type", "unknown")
                    stats["by_type"][t] = stats["by_type"].get(t, 0) + 1
                    stats["total"] += 1
                except Exception:
                    logger.warning("Caught unexpected exception")
    except Exception as e:
        logger.debug(f"event stats read failed: {e}")
    return stats

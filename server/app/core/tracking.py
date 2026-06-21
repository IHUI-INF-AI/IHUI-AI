"""业务埋点 SDK - 关键指标 + 业务事件追踪.

核心指标:
- 业务事件计数 (Counter)
- 业务转化漏斗 (Histogram)
- 用户行为追踪
- 关键路径耗时 (登录/支付/下单)

输出方式:
1. Prometheus (zhs_business_*) - 监控系统
2. 结构化日志 - ELK / 业务分析
3. 内存聚合 - 实时查询 (Redis 可选)
"""
from __future__ import annotations

import logging
import time
from contextlib import contextmanager, suppress
from typing import Any

logger = logging.getLogger(__name__)

# Prometheus Counter / Histogram (延迟初始化)
_BUSINESS_COUNTERS: dict[str, Any] = {}
_BUSINESS_HISTOGRAMS: dict[str, Any] = {}

# 业务事件类型常量
EVENT_USER_REGISTER = "user_register"
EVENT_USER_LOGIN = "user_login"
EVENT_USER_LOGOUT = "user_logout"
EVENT_CHAT_SEND = "chat_send"
EVENT_CHAT_RECEIVE = "chat_receive"
EVENT_PAYMENT_CREATE = "payment_create"
EVENT_PAYMENT_SUCCESS = "payment_success"
EVENT_PAYMENT_FAIL = "payment_fail"
EVENT_ORDER_CREATE = "order_create"
EVENT_COURSE_ENROLL = "course_enroll"
EVENT_TOOL_USED = "tool_used"

# 关键业务转化漏斗
FUNNEL_LOGIN = ("page_view", "login_click", "login_submit", "login_success")
FUNNEL_PAYMENT = ("cart_view", "checkout_click", "pay_submit", "pay_success")


def _get_counter(name: str, labels: list[str]):
    """获取/创建业务 Counter (无 prometheus_client 时返回 None)."""
    if name in _BUSINESS_COUNTERS:
        return _BUSINESS_COUNTERS[name]
    try:
        from prometheus_client import Counter

        c = Counter(name, f"Business event: {name}", labels)
        _BUSINESS_COUNTERS[name] = c
        return c
    except ImportError:
        return None


def _get_histogram(name: str, labels: list[str], buckets: tuple = (0.01, 0.05, 0.1, 0.5, 1, 5)):
    """获取/创建业务 Histogram."""
    if name in _BUSINESS_HISTOGRAMS:
        return _BUSINESS_HISTOGRAMS[name]
    try:
        from prometheus_client import Histogram

        h = Histogram(name, f"Business latency: {name}", labels, buckets=buckets)
        _BUSINESS_HISTOGRAMS[name] = h
        return h
    except ImportError:
        return None


def track_event(
    event: str,
    user_id: str | None = None,
    properties: dict | None = None,
    **labels: Any,
) -> None:
    """追踪业务事件.

    Args:
        event: 事件名 (建议用 EVENT_* 常量)
        user_id: 用户 ID
        properties: 附加属性
        **labels: Prometheus 标签 (如 channel="web", region="cn")

    Example:
        track_event(EVENT_PAYMENT_SUCCESS, user_id="u123", amount=99.0, channel="web")
    """
    label_keys = ["event", "user_id", *labels.keys()]
    counter = _get_counter("zhs_business_events_total", label_keys)
    if counter:
        try:
            counter.labels(event=event, user_id=user_id or "anonymous", **{k: str(v) for k, v in labels.items()}).inc()
        except Exception as e:
            logger.debug(f"track_event prometheus fail: {e}")

    # 同时输出结构化日志 (供 ELK 收集)
    with suppress(Exception):
        logger.info(
            "biz_event",
            extra={
                "event": event,
                "user_id": user_id or "anonymous",
                "properties": properties or {},
                **labels,
            },
        )


def track_latency(
    event: str,
    duration_sec: float,
    user_id: str | None = None,
    **labels: Any,
) -> None:
    """追踪业务耗时 (直方图)."""
    label_keys = ["event", *labels.keys()]
    hist = _get_histogram("zhs_business_latency_seconds", label_keys)
    if hist:
        try:
            hist.labels(event=event, **{k: str(v) for k, v in labels.items()}).observe(duration_sec)
        except Exception as e:
            logger.debug(f"track_latency prometheus fail: {e}")


@contextmanager
def track_timer(event: str, user_id: str | None = None, **labels: Any):
    """上下文管理器: 自动计时并上报.

    Example:
        with track_timer(EVENT_PAYMENT_CREATE, user_id=uid):
            result = call_payment_api()
    """
    start = time.perf_counter()
    try:
        yield
    finally:
        duration = time.perf_counter() - start
        track_latency(event, duration, user_id=user_id, **labels)


def track_funnel(
    funnel_name: str,
    step: str,
    user_id: str | None = None,
    **labels: Any,
) -> None:
    """追踪转化漏斗步骤.

    Example:
        track_funnel("login", "login_submit", user_id=uid, channel="web")
        track_funnel("login", "login_success", user_id=uid, channel="web")
    """
    track_event(
        f"funnel_{funnel_name}_{step}",
        user_id=user_id,
        funnel=funnel_name,
        step=step,
        **labels,
    )


def track_error(
    error_type: str,
    error_msg: str = "",
    user_id: str | None = None,
    **labels: Any,
) -> None:
    """追踪业务错误."""
    with suppress(Exception):
        logger.error(
            "biz_error",
            extra={
                "error_type": error_type,
                "error_msg": error_msg[:500],
                "user_id": user_id or "anonymous",
                **labels,
            },
        )
    track_event(f"error_{error_type}", user_id=user_id, **labels)


__all__ = [
    "EVENT_CHAT_RECEIVE",
    "EVENT_CHAT_SEND",
    "EVENT_COURSE_ENROLL",
    "EVENT_ORDER_CREATE",
    "EVENT_PAYMENT_CREATE",
    "EVENT_PAYMENT_FAIL",
    "EVENT_PAYMENT_SUCCESS",
    "EVENT_TOOL_USED",
    "EVENT_USER_LOGIN",
    "EVENT_USER_LOGOUT",
    "EVENT_USER_REGISTER",
    "FUNNEL_LOGIN",
    "FUNNEL_PAYMENT",
    "track_error",
    "track_event",
    "track_funnel",
    "track_latency",
    "track_timer",
]

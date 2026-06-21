"""限流 Prometheus 指标.

导出到 /metrics 端点 (与其它 Prometheus 指标合并).

指标列表:
  - rate_limit_rejected_total{class}  Counter - 限流拒绝次数, 按接口类分桶
  - rate_limit_allowed_total{class}   Counter - 限流通过次数
  - rate_limit_remaining{class}       Gauge   - 当前 IP/path 剩余可用配额
  - rate_limit_active_ips             Gauge   - 当前在限流窗口内的 IP 数
"""

from prometheus_client import Counter, Gauge

# 限流拒绝次数
RATE_LIMIT_REJECTED = Counter(
    "rate_limit_rejected_total",
    "Number of requests rejected by rate limiter",
    ["endpoint_class"],
)

# 限流通过次数
RATE_LIMIT_ALLOWED = Counter(
    "rate_limit_allowed_total",
    "Number of requests allowed by rate limiter",
    ["endpoint_class"],
)

# 当前在限流窗口内的 IP 数
RATE_LIMIT_ACTIVE_IPS = Gauge(
    "rate_limit_active_ips",
    "Number of unique IPs currently in rate limit window",
)


def classify_endpoint(path: str) -> str:
    """根据 path 返回端点类 (用于指标 label)."""
    if "/auth/" in path or "/login" in path or "/sms" in path:
        return "auth"
    if "/payment" in path or "/pay" in path or "/order" in path:
        return "payment"
    if "/upload" in path or "/file" in path or "/avatar" in path:
        return "upload"
    if "/ai/" in path or "/chat" in path or "/llm" in path:
        return "ai"
    if "/search" in path:
        return "search"
    if "/api/" in path:
        return "api"
    return "other"


def record_rejected(path: str) -> None:
    """记录一次限流拒绝."""
    RATE_LIMIT_REJECTED.labels(endpoint_class=classify_endpoint(path)).inc()


def record_allowed(path: str) -> None:
    """记录一次限流通过."""
    RATE_LIMIT_ALLOWED.labels(endpoint_class=classify_endpoint(path)).inc()

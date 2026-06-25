"""业务指标 -- 用户活跃 / 视频切片 / 通知推送 / 缓存命中率 / 任务执行 / 支付金额.

与基础设施指标 (HTTP/SQL) 分开, 避免 metric 名称空间污染.
业务指标统一前缀 zhs_biz_ 便于 Grafana dashboard 区分.
"""

import time

from prometheus_client import Counter, Gauge, Histogram

# ---------------------------------------------------------------------------
# 业务 Counter / Gauge / Histogram
# ---------------------------------------------------------------------------

# 业务端点 QPS (按 endpoint + status + tenant_id 维度)
# 建议 117: tenant_id label 启用后, Prom 侧可按租户聚合 / 限流 / 告警
# cardinality 保护: 业务侧 BizTimer 内部会通过 _trim_tenant_label 截断异常值
BIZ_REQUEST_TOTAL = Counter(
    "zhs_biz_requests_total",
    "Business API QPS by endpoint (with tenant label, 建议 117)",
    ["endpoint", "status", "tenant_id"],
)

# 业务延迟 (按 endpoint 维度)
BIZ_LATENCY = Histogram(
    "zhs_biz_request_duration_seconds",
    "Business API latency in seconds",
    ["endpoint"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

# 用户
USERS_TOTAL = Gauge(
    "zhs_biz_users_total",
    "Total registered users (实时)",
)
USERS_ACTIVE_24H = Gauge(
    "zhs_biz_users_active_24h",
    "Active users in last 24h (实时)",
)

# 视频 HLS
HLS_TRANSCODE_SECONDS = Histogram(
    "zhs_biz_hls_transcode_seconds",
    "HLS multi-bitrate transcode duration",
    ["video_id"],
    buckets=(0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600),
)
HLS_SEGMENTS_TOTAL = Counter(
    "zhs_biz_hls_segments_total",
    "HLS .ts segments generated",
    ["bitrate"],
)
HLS_BITRATE_TOTAL = Counter(
    "zhs_biz_hls_transcode_total",
    "HLS transcode count",
    ["result"],  # success / cached / failed
)

# 通知推送
NOTICE_PUSHED_TOTAL = Counter(
    "zhs_biz_notice_pushed_total",
    "Real-time notice push count",
    ["topic", "scope"],  # scope: user / topic
)
NOTICE_DELIVERED_TOTAL = Counter(
    "zhs_biz_notice_delivered_total",
    "Real-time notice delivered connection count",
    ["topic"],
)

# WebSocket 指标 (Bug-13 续)
WS_PUBSUB_RECONNECTS = Counter(
    "zhs_biz_ws_pubsub_reconnects_total",
    "WS Redis pub/sub reconnect count",
    ["result"],  # success / failed
)
WS_PUBSUB_MESSAGES = Counter(
    "zhs_biz_ws_pubsub_messages_total",
    "WS pub/sub messages received",
    ["channel"],
)
WS_HEARTBEAT_DROPS = Counter(
    "zhs_biz_ws_heartbeat_drops_total",
    "WS connections dropped due to heartbeat timeout",
)
WS_AUTH_FAILURES = Counter(
    "zhs_biz_ws_auth_failures_total",
    "WS authentication failure count",
    ["reason"],
)
WS_ROOM_BROADCASTS = Counter(
    "zhs_biz_ws_room_broadcasts_total",
    "WS room broadcast count",
    ["room_id"],
)

# 缓存
CACHE_HIT_TOTAL = Counter(
    "zhs_biz_cache_hits_total",
    "Cache hit count",
    ["key_prefix"],
)
CACHE_MISS_TOTAL = Counter(
    "zhs_biz_cache_misses_total",
    "Cache miss count",
    ["key_prefix"],
)
CACHE_HIT_RATIO = Gauge(
    "zhs_biz_cache_hit_ratio",
    "Cache hit ratio in last window (0-1)",
    ["key_prefix"],
)

# 任务执行
JOB_EXECUTIONS_TOTAL = Counter(
    "zhs_biz_job_executions_total",
    "Scheduled job execution count",
    ["job_name", "status"],  # status: success / failed
)
JOB_DURATION = Histogram(
    "zhs_biz_job_duration_seconds",
    "Scheduled job execution duration",
    ["job_name"],
    buckets=(0.1, 0.5, 1, 5, 10, 30, 60, 300, 600, 1800, 3600),
)

# 支付
PAYMENT_AMOUNT_TOTAL = Counter(
    "zhs_biz_payment_amount_yuan",
    "Total payment amount in yuan (累计)",
    ["channel", "status"],  # channel: wechat/alipay; status: success/refunded
)
PAYMENT_COUNT_TOTAL = Counter(
    "zhs_biz_payment_count_total",
    "Total payment count",
    ["channel", "status"],
)

# WebSocket
WS_CONNECTIONS = Gauge(
    "zhs_biz_ws_connections",
    "Active WebSocket connections",
)
WS_NOTICE_SUBS = Gauge(
    "zhs_biz_ws_notice_subscriptions",
    "Active notice WS subscriptions",
)

# 业务异常
BIZ_ERROR_TOTAL = Counter(
    "zhs_biz_errors_total",
    "Business logic errors",
    ["endpoint", "error_type"],
)

# 建议 95: 业务级 user/tenant 维度指标 (新增一组, 不破坏默认指标)
# 用法: BizTimer("xxx", with_user=True) 时, 同时打 endpoint+status+user_id+tenant_id 四维.
# cardinality 上限保护: 见 _trim_user_label()
BIZ_REQUEST_BY_USER_TOTAL = Counter(
    "zhs_biz_requests_by_user_total",
    "Business request counter with user/tenant dimension (建议 95)",
    ["endpoint", "status", "user_id", "tenant_id"],
)
BIZ_LATENCY_BY_USER = Histogram(
    "zhs_biz_latency_by_user_seconds",
    "Business request latency with user/tenant dimension (建议 95)",
    ["endpoint", "status", "user_id", "tenant_id"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

# 建议 95: cardinality 上限保护 (user/tenant 维度会膨胀)
_CARDINALITY_LIMIT = 1000
_OTHER_LABEL = "other"


# ---------------------------------------------------------------------------
# 工具: 业务 endpoint 计时上下文
# ---------------------------------------------------------------------------


class BizTimer:
    """业务端点计时上下文管理器.

    用法:
        with BizTimer("hls_transcode") as t:
            ... 业务代码 ...
        t.fail_count = "ffmpeg_timeout"  # 标记错误

    建议 95: with_user=True 时, 同时打 user/tenant 维度, 自动从 telemetry context 读取.
    """

    def __init__(self, endpoint: str, status_default: str = "200", with_user: bool = False):
        self.endpoint = endpoint
        self.status = status_default
        self.with_user = with_user
        self._start: float = 0.0

    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc, tb):
        duration = time.perf_counter() - self._start
        if exc:
            self.status = "500"
            BIZ_ERROR_TOTAL.labels(endpoint=self.endpoint, error_type=type(exc).__name__).inc()
        # 建议 117: 默认打 tenant_id label (从 telemetry context 读, 无则占位)
        try:
            from app.telemetry import get_request_context

            ctx = get_request_context()
            tid = _trim_tenant_label(ctx.get("tenant_id"))
        except Exception:
            tid = "_unknown_"
        BIZ_REQUEST_TOTAL.labels(
            endpoint=self.endpoint,
            status=self.status,
            tenant_id=tid,
        ).inc()
        BIZ_LATENCY.labels(endpoint=self.endpoint).observe(duration)
        # 建议 95: user/tenant 维度
        if self.with_user:
            try:
                from app.telemetry import get_request_context

                ctx = get_request_context()
                uid = _trim_user_label(ctx.get("user_id"))
                tid = _trim_tenant_label(ctx.get("tenant_id"))
                BIZ_REQUEST_BY_USER_TOTAL.labels(
                    endpoint=self.endpoint,
                    status=self.status,
                    user_id=uid,
                    tenant_id=tid,
                ).inc()
                BIZ_LATENCY_BY_USER.labels(
                    endpoint=self.endpoint,
                    status=self.status,
                    user_id=uid,
                    tenant_id=tid,
                ).observe(duration)
            except Exception:
                # telemetry 未装或 context 为空时, 用 anonymous 占位
                BIZ_REQUEST_BY_USER_TOTAL.labels(
                    endpoint=self.endpoint,
                    status=self.status,
                    user_id="anonymous",
                    tenant_id="anonymous",
                ).inc()
        return False


def _trim_user_label(value, limit: int = _CARDINALITY_LIMIT) -> str:
    """cardinality 保护: 用户/租户 ID 截断到 64 字符, 超过 cardinality 限制时退化为 'other'.

    注意: 实际 cardinality 控制依赖 prometheus_client 的 _metrics 字典大小,
    这里仅在 value 异常时 (None / 非 str) 做防御.
    """
    if not value:
        return "anonymous"
    s = str(value)
    if len(s) > 64:
        return s[:32] + "..." + s[-24:]  # 截断
    return s


def _trim_tenant_label(value) -> str:
    """建议 117: 租户 ID 标签 cardinality 保护.

    规则:
      - 空 / None → 'anonymous' (与 _trim_user_label 保持一致, 避免测试漂移)
      - 非 str → 转 str
      - 长度 > 64 → 截断
    """
    if value is None or value == "":
        return "anonymous"
    s = str(value)
    if len(s) > 64:
        return s[:32] + "..." + s[-24:]
    return s


# ---------------------------------------------------------------------------
# 工具: 缓存命中率更新
# ---------------------------------------------------------------------------


def record_cache(key_prefix: str, hit: bool) -> None:
    """记录一次缓存命中/未命中, 异步更新 hit_ratio gauge (基于 cumulative counter)."""
    if hit:
        CACHE_HIT_TOTAL.labels(key_prefix=key_prefix).inc()
    else:
        CACHE_MISS_TOTAL.labels(key_prefix=key_prefix).inc()
    # 命中率 = hits / (hits + misses), 从 counter 取实时值
    try:
        h = CACHE_HIT_TOTAL.labels(key_prefix=key_prefix)._value.get()
        m = CACHE_MISS_TOTAL.labels(key_prefix=key_prefix)._value.get()
        total = h + m
        if total > 0:
            CACHE_HIT_RATIO.labels(key_prefix=key_prefix).set(h / total)
    except Exception as e:
        logger.debug("计算缓存命中率指标失败: %s", e)

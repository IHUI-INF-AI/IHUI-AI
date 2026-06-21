"""Canary 指标源抽象 (建议 144) - app/canary_metrics_source.py.

设计:
  - MetricsSource 协议: get_error_rate / get_traffic_count / get_stage
  - InMemoryMetricsSource: 默认, 走 canary_metrics 全局 gauge + 应用层 outcomes
  - PrometheusMetricsSource: 通过 Prometheus HTTP API 抓取真实数据
  - CanaryAutoPromoter 可注入任意 MetricsSource

用法:
    from app.canary_metrics_source import (
        InMemoryMetricsSource, PrometheusMetricsSource,
    )

    # 默认本地 (in-process)
    promoter.feed_from_metrics(InMemoryMetricsSource())

    # 远程 Prometheus
    src = PrometheusMetricsSource(
        url="http://prometheus:9090",
        service="zhs-platform",
    )
    promoter.feed_from_metrics(src)
"""

from __future__ import annotations

import logging
import os
from typing import Protocol

import httpx

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 协议 (Protocol)
# ---------------------------------------------------------------------------


class MetricsSource(Protocol):
    """指标源协议. 所有实现需提供 3 个方法."""

    def get_error_rate(self, window_seconds: float = 600.0) -> float: ...
    def get_traffic_count(self, window_seconds: float = 600.0) -> int: ...
    def get_stage(self) -> str: ...


# ---------------------------------------------------------------------------
# InMemoryMetricsSource (默认)
# ---------------------------------------------------------------------------


class InMemoryMetricsSource:
    """本地进程内指标源: 用 canary_metrics 暴露的 gauge.

    数据来源:
      - error_rate:  走 CanaryAutoPromoter._outcomes 滑动窗口
      - traffic_count: 同上
      - stage:       优先用注入的 controller, 否则用全局 default controller
    """

    def __init__(self, promoter=None, controller=None):
        """promoter: 可选, 注入时优先用其内部 outcomes.

        controller: 可选, 注入时优先用其 current_stage(), 否则走 get_default_controller().
        """
        self._promoter = promoter
        self._controller = controller

    def get_error_rate(self, window_seconds: float = 600.0) -> float:
        if self._promoter is not None:
            return self._promoter.get_recent_error_rate(window_seconds=window_seconds)
        # 无 promoter, 返回 0
        return 0.0

    def get_traffic_count(self, window_seconds: float = 600.0) -> int:
        if self._promoter is not None:
            return self._promoter.get_recent_traffic_count(window_seconds=window_seconds)
        return 0

    def get_stage(self) -> str:
        try:
            ctrl = self._controller
            if ctrl is None:
                from app.canary_stages import get_default_controller

                ctrl = get_default_controller()
            return ctrl.current_stage().value
        except Exception:
            return "0%"


# ---------------------------------------------------------------------------
# PrometheusMetricsSource (远程抓取)
# ---------------------------------------------------------------------------


class PrometheusMetricsSource:
    """远程 Prometheus 指标源.

    PromQL 查询:
      - 错误率: sum(rate(zhs_canary_errors_total[1m])) / sum(rate(zhs_canary_traffic_total[1m]))
      - 流量:   sum(increase(zhs_canary_traffic_total[1m]))
      - 阶段:   zhs_canary_stage_ratio
    """

    def __init__(
        self,
        url: str = "http://prometheus:9090",
        service: str = "zhs-platform",
        version: str = "v2",
        timeout_seconds: float = 5.0,
    ):
        self._url = url.rstrip("/")
        self._service = service
        self._version = version
        self._timeout = timeout_seconds
        self._client: httpx.Client | None = None

    def _get_client(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(timeout=self._timeout)
        return self._client

    def _query(self, promql: str) -> float:
        """执行 PromQL instant query, 返回 scalar 结果."""
        try:
            resp = self._get_client().get(
                f"{self._url}/api/v1/query",
                params={"query": promql},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") != "success":
                logger.warning(f"prometheus query failed: {data.get('error', '?')}")
                return 0.0
            result = data.get("data", {}).get("result", [])
            if not result:
                return 0.0
            # 第一个 result 的 value
            value = result[0].get("value", [None, "0"])[1]
            return float(value)
        except Exception as e:
            logger.warning(f"prometheus query exception: {e}")
            return 0.0

    def get_error_rate(self, window_seconds: float = 600.0) -> float:
        window = f"{int(window_seconds)}s"
        promql = (
            f'sum(rate(zhs_canary_errors_total{{service="{self._service}",version="{self._version}"}}[{window}])) '
            f'/ sum(rate(zhs_canary_traffic_total{{service="{self._service}",version="{self._version}"}}[{window}]))'
        )
        rate = self._query(promql)
        # Prometheus 返回 NaN 当分母为 0, 处理
        if rate != rate:  # NaN
            return 0.0
        return max(0.0, min(1.0, rate))

    def get_traffic_count(self, window_seconds: float = 600.0) -> int:
        window = f"{int(window_seconds)}s"
        promql = (
            f'sum(increase(zhs_canary_traffic_total{{service="{self._service}",version="{self._version}"}}[{window}]))'
        )
        val = self._query(promql)
        return int(val) if val > 0 else 0

    def get_stage(self) -> str:
        promql = f'zhs_canary_stage_ratio{{service="{self._service}"}}'
        ratio = self._query(promql)
        if ratio <= 0.0:
            return "0%"
        elif ratio <= 0.011:
            return "1%"
        elif ratio <= 0.11:
            return "10%"
        elif ratio <= 0.51:
            return "50%"
        else:
            return "100%"

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None


# ---------------------------------------------------------------------------
# 自动选择 (工厂)
# ---------------------------------------------------------------------------


def auto_detect_source(promoter=None) -> MetricsSource:
    """根据环境变量自动选择指标源.

    规则:
      - PROMETHEUS_URL 设置且非空 → PrometheusMetricsSource
      - 否则 → InMemoryMetricsSource
    """
    url = os.environ.get("PROMETHEUS_URL", "").strip()
    if url:
        service = os.environ.get("PROMETHEUS_SERVICE", "zhs-platform")
        return PrometheusMetricsSource(url=url, service=service)
    return InMemoryMetricsSource(promoter=promoter)


# ---------------------------------------------------------------------------
# 集成钩子
# ---------------------------------------------------------------------------


def feed_promoter_from_source(promoter, source: MetricsSource) -> int:
    """从 source 抓取数据并喂给 promoter.

    Returns:
        喂入的 outcome 数量 (traffic_count).
    """
    traffic = source.get_traffic_count()
    error_rate = source.get_error_rate()
    if traffic <= 0:
        return 0
    # 用错误率生成 success/failure outcomes
    errors = int(traffic * error_rate)
    successes = traffic - errors
    # 注: 时间戳为 now, window 内的滑动窗口会读到
    for _ in range(successes):
        promoter.record_outcome(success=True, version="v2")
    for _ in range(errors):
        promoter.record_outcome(success=False, version="v2")
    logger.info(f"[promoter feed] traffic={traffic} errors={errors} rate={error_rate:.2%}")
    return traffic

"""Canary 切流指标 (建议 123) - app/canary_metrics.py.

设计:
  - 命中计数: zhs_canary_decisions_total{version, tenant_id}
  - 错误计数: zhs_canary_errors_total{version, tenant_id, endpoint}
  - 错误率派生: 错误 / 命中 (Prometheus rate() 计算)
  - v1 vs v2 错误率对比: Grafana 面板 / 告警 (建议 119 配合)
  - 建议 134: 增加 zhs_canary_stage_ratio / zhs_shadow_ratio gauge
    把 CanaryStageController 的当前阶段比例 + CanaryShadowLink 的当前 shadow 比例
    暴露给 Prometheus, 方便 Grafana 绘制 "放量进度" 面板.

使用:
    from app.canary import choose_version
    from app.canary_metrics import record_canary_decision, record_canary_error

    version = choose_version(tenant_id=1, endpoint="GET /api/v1/orders")
    try:
        do_stuff(version)
        record_canary_decision(version="v1", tenant_id=1, endpoint="GET /api/v1/orders")
    except Exception:
        record_canary_error(version="v1", tenant_id=1, endpoint="GET /api/v1/orders")
"""

from __future__ import annotations

import contextlib
import logging
import threading
import time
from collections import defaultdict

logger = logging.getLogger(__name__)

try:
    from prometheus_client import Counter, Gauge

    CANARY_DECISIONS = Counter(
        "zhs_canary_decisions_total",
        "Canary decisions by version and tenant (建议 123)",
        ["version", "tenant_id"],
    )
    CANARY_ERRORS = Counter(
        "zhs_canary_errors_total",
        "Canary errors by version and tenant (建议 123)",
        ["version", "tenant_id", "endpoint"],
    )
    CANARY_RATIO_GAUGE = Gauge(
        "zhs_canary_v2_ratio_current",
        "Current canary v2 ratio (建议 123)",
    )
    CANARY_ROLLBACK_GAUGE = Gauge(
        "zhs_canary_rollback_active",
        "Canary rollback active flag (1=true, 0=false) (建议 123)",
    )
    # 建议 134: 新增两个 gauge, 把 CanaryStageController + CanaryShadowLink
    # 的当前比例直接暴露给 Prometheus
    CANARY_STAGE_RATIO_GAUGE = Gauge(
        "zhs_canary_stage_ratio",
        "Current canary stage ratio (0/0.01/0.10/0.50/1.0) (建议 134)",
        ["stage"],
    )
    SHADOW_RATIO_GAUGE = Gauge(
        "zhs_shadow_ratio",
        "Current shadow traffic ratio (0~1.0) (建议 134)",
    )

    # Phase 5-A: Backfill 持久化 + Canary 审计落库 闭环告警 metric
    BACKFILL_PERSISTER_WRITES = Counter(
        "zhs_backfill_persister_writes_total",
        "Backfill persister writes (save_snapshot/append_event/clear) by operation+result",
        ["operation", "result"],
    )
    BACKFILL_PERSISTER_READS_FAILED = Counter(
        "zhs_backfill_persister_reads_failed_total",
        "Backfill persister reads failure count by operation",
        ["operation"],
    )
    BACKFILL_PERSISTER_TAIL_COUNT = Gauge(
        "zhs_backfill_persister_tail_count",
        "Current backfill events tail count (most recent appended)",
    )
    BACKFILL_PERSISTER_DB_BYTES = Gauge(
        "zhs_backfill_persister_db_bytes",
        "Backfill persister sqlite db file size in bytes (sampled)",
    )
    CANARY_AUDIT_WRITES = Counter(
        "zhs_canary_audit_writes_total",
        "Canary audit append writes by result (success/failed)",
        ["result"],
    )
    CANARY_AUDIT_RETENTION_CLEANED = Counter(
        "zhs_canary_audit_retention_cleaned_total",
        "Canary audit retention cleanup total deleted rows",
    )
    CANARY_AUDIT_ROWS = Gauge(
        "zhs_canary_audit_rows",
        "Current canary audit table row count (sampled)",
    )
except Exception as e:
    logger.warning(f"prometheus_client init failed: {e}")
    CANARY_DECISIONS = None
    CANARY_ERRORS = None
    CANARY_RATIO_GAUGE = None
    CANARY_ROLLBACK_GAUGE = None
    CANARY_STAGE_RATIO_GAUGE = None
    SHADOW_RATIO_GAUGE = None
    BACKFILL_PERSISTER_WRITES = None
    BACKFILL_PERSISTER_READS_FAILED = None
    BACKFILL_PERSISTER_TAIL_COUNT = None
    BACKFILL_PERSISTER_DB_BYTES = None
    CANARY_AUDIT_WRITES = None
    CANARY_AUDIT_RETENTION_CLEANED = None
    CANARY_AUDIT_ROWS = None


# ---------------------------------------------------------------------------
# 内存级聚合 (Prometheus 不可用时降级)
# ---------------------------------------------------------------------------

_DECISION_COUNTS: dict[tuple[str, str], int] = defaultdict(int)
_ERROR_COUNTS: dict[tuple[str, str, str], int] = defaultdict(int)
_LOCK = threading.RLock()
# get_error_rate 的 window_sec 暂未生效, 仅警告一次
_WINDOW_SEC_WARNED = False


def _trim_label(value: str, max_len: int = 64) -> str:
    if value is None:
        return "anonymous"
    s = str(value)
    if len(s) > max_len:
        return s[:32] + "..." + s[-24:]
    return s


def record_canary_decision(version: str, tenant_id: int | None = None, endpoint: str | None = None) -> None:
    """记录一次 canary 切流命中."""
    # 兼容 CanaryVersion 枚举
    v = str(version.value) if hasattr(version, "value") else str(version)
    tid = _trim_label(tenant_id if tenant_id is not None else "anonymous")
    key = (v, tid)
    with _LOCK:
        _DECISION_COUNTS[key] += 1
    if CANARY_DECISIONS is not None:
        with contextlib.suppress(Exception):
            CANARY_DECISIONS.labels(version=v, tenant_id=tid).inc()


def record_canary_error(version: str, tenant_id: int | None = None, endpoint: str | None = None) -> None:
    """记录一次 canary 错误."""
    v = str(version.value) if hasattr(version, "value") else str(version)
    tid = _trim_label(tenant_id if tenant_id is not None else "anonymous")
    ep = _trim_label(endpoint or "_global_", max_len=128)
    key = (v, tid, ep)
    with _LOCK:
        _ERROR_COUNTS[key] += 1
    if CANARY_ERRORS is not None:
        with contextlib.suppress(Exception):
            CANARY_ERRORS.labels(version=v, tenant_id=tid, endpoint=ep).inc()


def get_error_rate(version: str, tenant_id: int | None = None, window_sec: float = 300.0) -> float:
    """计算某 version / tenant 的错误率 (近 window_sec 窗口).

    注意: 当前实现为全期累计, window_sec 暂未生效.
    内存计数器 (_DECISION_COUNTS / _ERROR_COUNTS) 未保留时间戳, 无法按窗口过滤;
    实际生产用 Prometheus rate() 更精确.
    TODO: 为计数器增加时间戳维度后, 按 window_sec 过滤.
    """
    global _WINDOW_SEC_WARNED
    if not _WINDOW_SEC_WARNED:
        _WINDOW_SEC_WARNED = True
        logger.warning(
            "get_error_rate: window_sec not effective, current impl is full-period cumulative"
        )
    v = str(version)
    tid = _trim_label(tenant_id if tenant_id is not None else "anonymous")
    with _LOCK:
        # 错误率 = 错误数 / 命中数 (粗略, 全期累计)
        errs = 0
        for (vv, tt, _ep), n in _ERROR_COUNTS.items():
            if vv == v and tt == tid:
                errs += n
        total = _DECISION_COUNTS.get((v, tid), 0)
    if total == 0:
        return 0.0
    return errs / total


def get_recent_error_rate(window_sec: float = 300.0) -> float:
    """v2 错误率 (供 ShadowRatioController 用)."""
    return get_error_rate("v2", tenant_id="anonymous", window_sec=window_sec)


def get_metrics_snapshot() -> dict:
    """快照: 监控 / 排障用."""
    with _LOCK:
        decisions = {f"{v}/{t}": n for (v, t), n in _DECISION_COUNTS.items()}
        errors = {f"{v}/{t}/{e}": n for (v, t, e), n in _ERROR_COUNTS.items()}
    return {
        "timestamp": time.time(),
        "decisions": decisions,
        "errors": errors,
        "decision_total": sum(_DECISION_COUNTS.values()),
        "error_total": sum(_ERROR_COUNTS.values()),
    }


def reset_metrics() -> None:
    """清空 (测试 / 紧急重置)."""
    with _LOCK:
        _DECISION_COUNTS.clear()
        _ERROR_COUNTS.clear()


# ---------------------------------------------------------------------------
# 同步 canary 状态到 gauge
# ---------------------------------------------------------------------------


def sync_canary_gauges(controller) -> None:
    """把 CanaryController 当前状态写到 Prometheus gauge.

    兼容性:
      - CanaryController (app.canary.CanaryController): 有 .rollback, .v2_ratio
      - CanaryStageController (app.canary_stages.CanaryStageController): 没有这些,
        try/except 优雅跳过
    """
    if CANARY_RATIO_GAUGE is not None:
        with contextlib.suppress(Exception):
            CANARY_RATIO_GAUGE.set(getattr(controller, "v2_ratio", 0.0))
    if CANARY_ROLLBACK_GAUGE is not None:
        # 建议 138: 用 callable() 检查 + isinstance bool 精确判定, 避免 method 对象 truthy
        try:
            rb = getattr(controller, "rollback", None)
            rb_val = 0.0 if callable(rb) else 1.0 if rb else 0.0
            CANARY_ROLLBACK_GAUGE.set(rb_val)
        except Exception as e:
            logger.debug("同步 canary rollback gauge 失败: %s", e)


# ---------------------------------------------------------------------------
# 建议 134: Canary stage + shadow 比例 gauge
# ---------------------------------------------------------------------------


def sync_canary_stage_gauges(controller) -> None:
    """把 CanaryStageController 当前阶段比例写到 zhs_canary_stage_ratio{stage}.

    实现:
      - 当前阶段的 label{stage=<当前>} 设为 current_ratio
      - 其他阶段的 label 设为 0
      - 这样 Grafana 只需要 sum(zhs_canary_stage_ratio) 就能拿到当前比例

    Args:
        controller: CanaryStageController 实例
    """
    if CANARY_STAGE_RATIO_GAUGE is None:
        return
    try:
        cur_stage = controller.current_stage()
        cur_ratio = controller.current_ratio()
        # 建议 134: 把所有 stage label 重置, 然后给当前 stage 设置真实值
        for stage_value in ("0%", "1%", "10%", "50%", "100%"):
            if stage_value == cur_stage.value:
                CANARY_STAGE_RATIO_GAUGE.labels(stage=stage_value).set(cur_ratio)
            else:
                CANARY_STAGE_RATIO_GAUGE.labels(stage=stage_value).set(0.0)
    except Exception as e:
        logger.debug("同步 canary stage ratio gauge 失败: %s", e)


def sync_shadow_gauges(shadow_or_link) -> None:
    """把 ShadowRouter / CanaryShadowLink 当前 shadow 比例写到 zhs_shadow_ratio.

    Args:
        shadow_or_link: ShadowRouter (有 .ratio 属性) 或 CanaryShadowLink 实例
    """
    if SHADOW_RATIO_GAUGE is None:
        return
    try:
        # CanaryShadowLink 有 .shadow 属性; ShadowRouter 本身就是 router
        ratio = shadow_or_link.shadow.ratio if hasattr(shadow_or_link, "shadow") else shadow_or_link.ratio
        SHADOW_RATIO_GAUGE.set(ratio)
    except Exception as e:
        logger.debug("同步 shadow ratio gauge 失败: %s", e)


def sync_canary_shadow_all(controller, link=None) -> None:
    """一键同步 canary stage + shadow 比例 (建议 134 一站式 helper).

    Args:
        controller: CanaryStageController
        link: 可选, CanaryShadowLink (None 时只同步 canary stage)
    """
    sync_canary_stage_gauges(controller)
    if link is not None:
        sync_shadow_gauges(link)


def get_canary_stage_ratio_snapshot(controller) -> dict:
    """快照: 当前 canary 阶段 + ratio (供调试 / 排障)."""
    return {
        "current_stage": controller.current_stage().value,
        "current_ratio": controller.current_ratio(),
    }


def get_shadow_ratio_snapshot(shadow_or_link) -> dict:
    """快照: 当前 shadow 比例."""
    if hasattr(shadow_or_link, "shadow"):
        ratio = shadow_or_link.shadow.ratio
        is_link = True
    else:
        ratio = shadow_or_link.ratio
        is_link = False
    return {
        "shadow_ratio": ratio,
        "shadow_active": ratio > 0,
        "source": "CanaryShadowLink" if is_link else "ShadowRouter",
    }

# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""压缩生产指标采集(1-3,2026-09-12 立,PROJECT_PLAN H7)。

每次真实压缩事件记录结构化指标,量化 H7 三项观测:
- 压缩比(compressed/original)与压缩耗时
- 回捞命中率(压缩后语义检索命中 / 查询总数)
- 压缩后任务是否继续成功执行(run 维度 outcome)

双通道上报:
1. Prometheus(参照 agent_metrics.py 模式,全局注册表经 Instrumentator 暴露
   /metrics,无需额外挂载);
2. 进程内聚合存储(有界 deque + 锁),供 GET /api/context-compaction/metrics-report
   查询/报告端点读取(H7 要求指标"进入报告")。

另提供 build_comparison_report() 纯函数:开启压缩 vs 关闭压缩的任务成功率
差异对比(bench A/B 脚本与注入式评估共用),验证「成功率下降 ≤2%」可量化。

fail-open 契约:所有 record_* 上报失败仅 log,绝不影响压缩/主循环链路。
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import deque
from typing import Any

from prometheus_client import Counter, Histogram

logger = logging.getLogger(__name__)

# =============================================================================
# Prometheus 指标(与 middleware/agent_metrics.py 同模式)
# =============================================================================

# 压缩事件计数(按 trigger: ratio/absolute/truncated/llm… + 是否 LLM 语义摘要)
compaction_events_total = Counter(
    "ihui_compaction_events_total",
    "Total context compaction events",
    ["trigger", "llm_summary"],
)

# 压缩比(compressed/original)分布;0.88 触发 → 0.6 目标,桶覆盖 0.1~1.0
compaction_ratio = Histogram(
    "ihui_compaction_ratio",
    "Compression ratio (compressed/original tokens) distribution",
    buckets=(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0),
)

# 压缩耗时分布(秒;确定性压缩为毫秒级,LLM 语义压缩为秒级)
compaction_duration_seconds = Histogram(
    "ihui_compaction_duration_seconds",
    "Compaction wall-clock duration in seconds",
    buckets=(0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0),
)

# 发生过压缩的 agent run 结果计数(success/failure = 压缩后任务是否继续成功)
compaction_run_outcomes_total = Counter(
    "ihui_compaction_run_outcomes_total",
    "Agent run outcomes for runs that had at least one compaction event",
    ["outcome"],
)

# 语义回捞查询计数(hit=检索到 ≥1 条被压缩内容 / miss=空结果)
context_recall_queries_total = Counter(
    "ihui_context_recall_queries_total",
    "Context recall queries by whether any compacted content was retrieved",
    ["hit"],
)

# =============================================================================
# 进程内结构化存储(有界,线程安全)
# =============================================================================

# 事件/结果/回捞记录上限(进程内防无界增长;超限丢最旧)
MAX_EVENTS = 1000
MAX_RUN_OUTCOMES = 1000
MAX_RECALL_RECORDS = 2000

_lock = threading.Lock()
_events: deque[dict[str, Any]] = deque(maxlen=MAX_EVENTS)
_run_outcomes: deque[dict[str, Any]] = deque(maxlen=MAX_RUN_OUTCOMES)
_recall_records: deque[dict[str, Any]] = deque(maxlen=MAX_RECALL_RECORDS)

# 累计计数器(Prometheus 之外的进程内总数,报告端点直接读取)
_totals: dict[str, int] = {
    "events": 0,
    "recall_queries": 0,
    "recall_hits": 0,
}


def _ratio(original: int, compressed: int) -> float:
    """压缩比 = compressed / original;original ≤ 0 时返回 0(不可压缩/无意义)。"""
    if original <= 0:
        return 0.0
    return round(compressed / original, 4)


def record_compaction_event(
    *,
    session_id: str,
    info: dict[str, Any],
    source: str = "agent_loop",
    run_id: str = "",
    duration_ms: float = 0.0,
) -> dict[str, Any]:
    """记录一次真实压缩事件(Prometheus + 进程内双通道)。

    Args:
        session_id: 会话标识(报告聚合维度)。
        info: compress_messages_if_needed / compact_with_llm 返回的 info dict,
            读取 compressed/original_tokens/trigger/llm_summary/quality 字段。
        source: 采集点标识("agent_loop" 主循环 / "llm_router" llm.py 兜底压缩)。
        run_id: agent run 标识(把事件与 run outcome 关联;路由层采集可空)。
        duration_ms: 本次压缩耗时(毫秒)。

    Returns:
        结构化指标 dict(同时进入进程内存储);任何异常吞掉返回空 dict(fail-open)。
    """
    try:
        original_tokens = int(info.get("original_tokens") or 0)
        compressed_tokens = int(info.get("compressed_tokens") or 0)
        llm_summary = bool(info.get("llm_summary"))
        # trigger 归一:LLM 语义压缩(llm_summary=True)统一记为 "llm",
        # 其余沿用压缩器的机制标签(ratio/absolute/truncated/none…)
        trigger = "llm" if llm_summary else str(info.get("trigger") or "unknown")
        ratio = _ratio(original_tokens, compressed_tokens)
        quality = info.get("quality")
        retention = None
        if isinstance(quality, dict):
            report = quality.get("report")
            if isinstance(report, dict):
                raw = report.get("retention_ratio")
                if isinstance(raw, int | float):
                    retention = round(float(raw), 4)
        metric: dict[str, Any] = {
            "event_id": f"cme-{uuid.uuid4().hex[:12]}",
            "session_id": session_id,
            "run_id": run_id,
            "source": source,
            "trigger": trigger,
            "llm_summary": llm_summary,
            "original_tokens": original_tokens,
            "compressed_tokens": compressed_tokens,
            "ratio": ratio,
            "duration_ms": round(float(duration_ms), 3),
            "retention_ratio": retention,
            "recorded_at": time.time(),
        }
        # Prometheus 通道
        compaction_events_total.labels(trigger=trigger, llm_summary=str(llm_summary)).inc()
        if original_tokens > 0:
            compaction_ratio.observe(ratio)
        compaction_duration_seconds.observe(max(0.0, float(duration_ms)) / 1000.0)
        # 进程内通道
        with _lock:
            _events.append(metric)
            _totals["events"] += 1
        return metric
    except Exception as e:  # noqa: BLE001 - 指标上报绝不影响主链路
        logger.warning("compaction 指标上报失败(不影响主流程): %s", e)
        return {}


def record_compaction_run_outcome(
    *,
    run_id: str,
    session_id: str,
    success: bool,
    event_count: int = 0,
) -> dict[str, Any]:
    """记录发生过压缩的 agent run 最终结果(压缩后任务是否继续成功执行)。

    仅对 len(compaction_events) ≥ 1 的 run 调用;success=False 即"压缩后任务失败",
    是 H7「真实任务成功率下降 ≤2%」的 run 维度观测输入。
    """
    try:
        rec: dict[str, Any] = {
            "run_id": run_id,
            "session_id": session_id,
            "success": bool(success),
            "compaction_events": int(event_count),
            "recorded_at": time.time(),
        }
        compaction_run_outcomes_total.labels(
            outcome="success" if success else "failure"
        ).inc()
        with _lock:
            _run_outcomes.append(rec)
        return rec
    except Exception as e:  # noqa: BLE001 - 指标上报绝不影响主链路
        logger.warning("compaction run outcome 上报失败(不影响主流程): %s", e)
        return {}


def record_recall_query(
    *,
    session_id: str | None,
    hit: bool,
    result_count: int = 0,
) -> None:
    """记录一次语义回捞查询(hit=检索到 ≥1 条被压缩内容)。

    由 ContextRecallService.recall 内部调用;命中率 = recall_hits / recall_queries
    进入指标报告(H7 回捞命中率)。
    """
    try:
        context_recall_queries_total.labels(hit="true" if hit else "false").inc()
        with _lock:
            _recall_records.append(
                {
                    "session_id": session_id or "",
                    "hit": bool(hit),
                    "result_count": int(result_count),
                    "recorded_at": time.time(),
                }
            )
            _totals["recall_queries"] += 1
            if hit:
                _totals["recall_hits"] += 1
    except Exception as e:  # noqa: BLE001 - 指标上报绝不影响主链路
        logger.warning("context_recall 指标上报失败(不影响主流程): %s", e)


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


def get_compaction_metrics_report(limit: int = 50) -> dict[str, Any]:
    """压缩生产指标汇总(H7:压缩比 / 回捞命中率 / 压缩后任务成功率进入报告)。

    Returns:
        {events_total, avg_ratio, avg_duration_ms, avg_retention_ratio,
         by_trigger, recall: {queries, hits, hit_rate},
         runs: {total, success, success_rate},
         recent_events(最新 limit 条)}。
    """
    with _lock:
        events = list(_events)
        outcomes = list(_run_outcomes)
        totals = dict(_totals)
    ratios = [e["ratio"] for e in events if isinstance(e.get("ratio"), int | float)]
    durations = [
        e["duration_ms"] for e in events if isinstance(e.get("duration_ms"), int | float)
    ]
    retentions = [
        e["retention_ratio"]
        for e in events
        if isinstance(e.get("retention_ratio"), int | float)
    ]
    by_trigger: dict[str, int] = {}
    for e in events:
        by_trigger[str(e.get("trigger", "unknown"))] = (
            by_trigger.get(str(e.get("trigger", "unknown")), 0) + 1
        )
    runs_total = len(outcomes)
    runs_success = sum(1 for r in outcomes if r.get("success"))
    queries = totals["recall_queries"]
    hits = totals["recall_hits"]
    return {
        "events_total": totals["events"],
        "avg_ratio": _avg(ratios),
        "avg_duration_ms": _avg(durations),
        "avg_retention_ratio": _avg(retentions),
        "by_trigger": by_trigger,
        "recall": {
            "queries": queries,
            "hits": hits,
            "hit_rate": round(hits / queries, 4) if queries > 0 else 0.0,
        },
        "runs": {
            "total": runs_total,
            "success": runs_success,
            "success_rate": (
                round(runs_success / runs_total, 4) if runs_total > 0 else 0.0
            ),
        },
        "recent_events": list(reversed(events))[: max(1, min(int(limit), MAX_EVENTS))],
    }


def build_comparison_report(
    off_results: list[dict[str, Any]],
    on_results: list[dict[str, Any]],
    *,
    max_drop: float = 0.02,
) -> dict[str, Any]:
    """开启压缩 vs 关闭压缩的任务成功率对比(H7:下降 ≤2% 可量化)。

    Args:
        off_results / on_results: bench 任务结果列表,每项至少含
            {"id": str, "pass": bool}(bench run_bench 任务结果原生形态)。
        max_drop: 允许的最大成功率下降(默认 0.02 = 2%)。

    Returns:
        {off: {total, passed, pass_rate}, on: {...},
         success_rate_drop, within_threshold, max_drop}。
         off/on 任务数不一致时 comparison_valid=False(不构成有效对比)。
    """
    def _summary(results: list[dict[str, Any]]) -> dict[str, Any]:
        total = len(results)
        passed = sum(1 for r in results if r.get("pass"))
        return {
            "total": total,
            "passed": passed,
            "pass_rate": round(passed / total, 4) if total > 0 else 0.0,
        }

    off_summary = _summary(off_results)
    on_summary = _summary(on_results)
    drop = round(off_summary["pass_rate"] - on_summary["pass_rate"], 4)
    valid = off_summary["total"] > 0 and off_summary["total"] == on_summary["total"]
    return {
        "off": off_summary,
        "on": on_summary,
        "success_rate_drop": drop,
        "within_threshold": valid and drop <= max_drop,
        "max_drop": max_drop,
        "comparison_valid": valid,
    }


def reset_compaction_metrics() -> None:
    """清空进程内存储与累计计数(测试隔离用;Prometheus 计数器不清零)。"""
    with _lock:
        _events.clear()
        _run_outcomes.clear()
        _recall_records.clear()
        _totals.update({"events": 0, "recall_queries": 0, "recall_hits": 0})
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

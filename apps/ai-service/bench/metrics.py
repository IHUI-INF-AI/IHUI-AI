# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IHUI-Bench 指标面：把逐任务记录聚合成可对外引用的读数。

为什么单独一层：
    执行器（`run_bench.py`）此前只报通过率，逐任务表里散着迭代数与耗时，
    但没有任何聚合读数，也没有失败分类 —— 于是"这版比上版好在哪"只能靠人眼
    逐行比表，对不出 p50/p99，也说不清失败是"没调工具"还是"调了没修对"。
    本模块只做纯函数聚合，不碰网络、不碰磁盘、不依赖执行器，便于用合成记录
    做确定性断言。

口径（写死在代码里，避免各处各算一套）：
    - iterations   = 工具轮次（`LoopIteration` 条数，纯文本终轮也计入，因为它是
                     "模型多花了一轮"的真实成本）
    - tokens       = 执行器自报 `total_tokens_used`（估算值；golden 档恒 0，
                     统计时 0 值不参与均值/分位数，只计入总数，避免把"没跑模型"
                     当成"跑了 0 token"拉低均值）
    - duration_ms  = 单任务墙钟（含工具执行与 pytest 检查）
    - 分位数       = 线性插值（与 numpy 默认口径一致）；样本 <2 时退化为该值本身
    - 失败分类     = 一条记录只归一类，判序见 `classify_failure`
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from typing import Any

# 失败分类的闭集。新增分类必须同时改这里与 `classify_failure`，否则测试会红。
FAILURE_CLASSES: tuple[str, ...] = (
    "pass",
    "execution_error",
    "timeout",
    "cancelled",
    "budget_exceeded",
    "iteration_exhausted",
    "no_tool_calls",
    "no_checks",
    "checks_failed",
)

# stop_reason → 失败分类的直接映射（顺序无关，命中即用）。
_STOP_REASON_CLASS: dict[str, str] = {
    "error": "execution_error",
    "timeout": "timeout",
    "cancelled": "cancelled",
    "budget_exceeded": "budget_exceeded",
    "max_iterations": "iteration_exhausted",
}


def percentile(values: Sequence[float], p: float) -> float:
    """线性插值分位数（p 取 0~100）。空样本返回 0.0，单样本返回其本身。"""
    if not values:
        return 0.0
    if len(values) == 1:
        return float(values[0])
    ordered = sorted(float(v) for v in values)
    rank = (len(ordered) - 1) * (max(0.0, min(100.0, float(p))) / 100.0)
    lower = int(rank)
    upper = min(lower + 1, len(ordered) - 1)
    weight = rank - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * weight


def _distribution(values: Sequence[float]) -> dict[str, float]:
    """一组样本 → p50/p90/p99/mean/max/total。空样本全 0，不抛异常。"""
    if not values:
        return {"p50": 0.0, "p90": 0.0, "p99": 0.0, "mean": 0.0, "max": 0.0, "total": 0.0}
    return {
        "p50": round(percentile(values, 50), 2),
        "p90": round(percentile(values, 90), 2),
        "p99": round(percentile(values, 99), 2),
        "mean": round(sum(values) / len(values), 2),
        "max": round(max(values), 2),
        "total": round(sum(values), 2),
    }


def classify_failure(record: Mapping[str, Any]) -> str:
    """一条任务记录 → 唯一失败分类。

    判序（先判"跑没跑成"，再判"改没改动"，最后判"改得对不对"）：
        1. pass 为真                      → pass
        2. 记录带 error 或 stop_reason=error → execution_error
        3. stop_reason 命中映射表          → 对应类（timeout/cancelled/预算/迭代耗尽）
        4. 工具调用数 0 且非 golden 档     → no_tool_calls（模型没动手）
        5. 检查项 0 条                    → no_checks（题目自身没判据）
        6. 其余                            → checks_failed（动了手但没改对）
    """
    if record.get("pass"):
        return "pass"
    if record.get("error") or record.get("stop_reason") == "error":
        return "execution_error"
    stop_reason = str(record.get("stop_reason") or "")
    mapped = _STOP_REASON_CLASS.get(stop_reason)
    if mapped:
        return mapped
    if stop_reason == "golden":
        # 参考答案直评档不跑循环，工具调用数天然为 0，不能归成"没动手"。
        return "no_checks" if int(record.get("checks_total") or 0) == 0 else "checks_failed"
    if int(record.get("tool_calls") or 0) == 0:
        return "no_tool_calls"
    if int(record.get("checks_total") or 0) == 0:
        return "no_checks"
    return "checks_failed"


def _failure_detail(record: Mapping[str, Any]) -> str:
    """失败记录的一句话细节：点名红了哪几类检查。"""
    failed_types = [
        str(c.get("type"))
        for c in (record.get("checks") or [])
        if isinstance(c, Mapping) and not c.get("pass")
    ]
    if failed_types:
        return "失败检查: " + ",".join(sorted(set(failed_types)))
    if record.get("error"):
        return str(record["error"])[:120]
    return str(record.get("stop_reason") or "")


def summarize(results: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    """逐任务记录 → 汇总读数（通过率、三组分布、失败分类、分类别）。"""
    records = list(results)
    total = len(records)
    passed = sum(1 for r in records if r.get("pass"))
    pass_rate = round(passed / total, 4) if total else 0.0

    iterations = [float(r.get("iterations") or 0) for r in records]
    durations = [float(r.get("duration_ms") or 0) for r in records]
    # token 只统计"真的跑了模型"的记录：golden/stub 档 tokens 恒 0，
    # 计入会把 p50 压成 0，读数变成"每任务 0 token"的笑话。
    tokens = [
        float(r.get("tokens_used") or 0)
        for r in records
        if float(r.get("tokens_used") or 0) > 0
    ]
    tool_calls = [float(r.get("tool_calls") or 0) for r in records]

    taxonomy: dict[str, int] = dict.fromkeys(FAILURE_CLASSES, 0)
    failures: list[dict[str, str]] = []
    for r in records:
        cls = classify_failure(r)
        taxonomy[cls] = taxonomy.get(cls, 0) + 1
        if cls != "pass":
            failures.append(
                {
                    "id": str(r.get("id")),
                    "category": str(r.get("category") or ""),
                    "class": cls,
                    "detail": _failure_detail(r),
                }
            )

    by_category: dict[str, dict[str, Any]] = {}
    for r in records:
        cat = str(r.get("category") or "unknown")
        bucket = by_category.setdefault(
            cat, {"total": 0, "passed": 0, "iterations": []}
        )
        bucket["total"] += 1
        if r.get("pass"):
            bucket["passed"] += 1
        bucket["iterations"].append(float(r.get("iterations") or 0))
    for bucket in by_category.values():
        n = bucket["total"]
        bucket["pass_rate"] = round(bucket["passed"] / n, 4) if n else 0.0
        bucket["iterations_p50"] = round(percentile(bucket.pop("iterations"), 50), 2)

    return {
        "total": total,
        "passed": passed,
        "pass_rate": pass_rate,
        "iterations": _distribution(iterations),
        "duration_ms": _distribution(durations),
        "tokens": {
            **_distribution(tokens),
            "samples": len(tokens),
            "tasks_with_zero_tokens": total - len(tokens),
        },
        "tool_calls": {
            **_distribution(tool_calls),
            "tasks_with_zero_calls": sum(1 for v in tool_calls if v == 0),
        },
        "failure_taxonomy": taxonomy,
        "failures": failures,
        "by_category": by_category,
    }


def render_markdown(metrics: Mapping[str, Any]) -> list[str]:
    """读数 → markdown 行（供 `run_bench._write_reports` 直接拼接）。"""
    lines: list[str] = ["## 指标面", ""]
    lines.append("| 维度 | p50 | p90 | p99 | 均值 | 最大 | 合计 |")
    lines.append("|---|---|---|---|---|---|---|")
    for key, label in (
        ("iterations", "工具轮次"),
        ("duration_ms", "耗时(ms)"),
        ("tokens", "token(估算)"),
        ("tool_calls", "工具调用数"),
    ):
        dist = metrics.get(key) or {}
        lines.append(
            f"| {label} | {dist.get('p50', 0)} | {dist.get('p90', 0)} | "
            f"{dist.get('p99', 0)} | {dist.get('mean', 0)} | "
            f"{dist.get('max', 0)} | {dist.get('total', 0)} |"
        )
    lines.append("")
    tokens = metrics.get("tokens") or {}
    if tokens.get("samples"):
        lines.append(
            f"- token 样本: {tokens.get('samples')} 条（"
            f"{tokens.get('tasks_with_zero_tokens', 0)} 条为 0，未参与均值/分位）"
        )
    else:
        lines.append("- token 样本: 0 条（本档未跑模型，token 读数不适用）")
    calls = metrics.get("tool_calls") or {}
    lines.append(
        f"- 零工具调用任务: {calls.get('tasks_with_zero_calls', 0)} / "
        f"{metrics.get('total', 0)}"
    )
    lines.append("")
    lines.append("### 失败分类")
    lines.append("")
    taxonomy = metrics.get("failure_taxonomy") or {}
    for name, count in taxonomy.items():
        if count:
            lines.append(f"- `{name}`: {count}")
    lines.append("")
    failures = metrics.get("failures") or []
    if failures:
        lines.append("### 失败明细")
        lines.append("")
        for item in failures:
            lines.append(
                f"- `{item['id']}`（{item['category']}）→ `{item['class']}`：{item['detail']}"
            )
        lines.append("")
    by_category = metrics.get("by_category") or {}
    if by_category:
        lines.append("### 分类别")
        lines.append("")
        lines.append("| 类别 | 通过/总数 | 通过率 | 轮次 p50 |")
        lines.append("|---|---|---|---|")
        for cat, bucket in sorted(by_category.items()):
            lines.append(
                f"| {cat} | {bucket['passed']}/{bucket['total']} | "
                f"{bucket['pass_rate']:.1%} | {bucket['iterations_p50']} |"
            )
        lines.append("")
    return lines
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

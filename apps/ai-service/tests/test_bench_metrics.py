# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P1 指标面的锁:分位数、失败分类、汇总读数、报告接线。

钉四组:
  A. 分位数口径（线性插值、单样本、空样本）
  B. 失败分类闭集（每类至少一条记录命中，且判序不被"跑成"与"改对"混淆）
  C. 汇总读数（token 零值不拉低均值、分类合计守恒、分类别通过率）
  D. 报告接线（`_write_reports` 产出的 JSON 带 metrics、markdown 带指标面段落）
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from bench.metrics import (
    FAILURE_CLASSES,
    classify_failure,
    percentile,
    render_markdown,
    summarize,
)

# ---------------------------------------------------------------------------
# A. 分位数
# ---------------------------------------------------------------------------

def test_percentile_linear_interpolation() -> None:
    values = [1, 2, 3, 4, 5]
    assert percentile(values, 50) == 3.0
    assert percentile(values, 90) == pytest.approx(4.6)
    assert percentile(values, 99) == pytest.approx(4.96)
    assert percentile(values, 0) == 1.0
    assert percentile(values, 100) == 5.0


def test_percentile_degrades_safely() -> None:
    assert percentile([], 50) == 0.0
    assert percentile([7], 99) == 7.0
    # 乱序输入不应影响读数
    assert percentile([5, 1, 3, 2, 4], 50) == 3.0


def test_summarize_distribution_ordering() -> None:
    metrics = summarize(
        [
            {"id": "a", "iterations": 2, "duration_ms": 10.0, "pass": True},
            {"id": "b", "iterations": 9, "duration_ms": 200.0, "pass": False},
            {"id": "c", "iterations": 4, "duration_ms": 50.0, "pass": True},
        ]
    )
    it = metrics["iterations"]
    assert it["p50"] <= it["p90"] <= it["p99"] <= it["max"]
    assert it["max"] == 9.0
    assert it["total"] == 15.0


# ---------------------------------------------------------------------------
# B. 失败分类
# ---------------------------------------------------------------------------

def test_failure_classes_are_covered() -> None:
    samples = {
        "pass": {"pass": True},
        "execution_error": {"pass": False, "error": "boom"},
        "timeout": {"pass": False, "stop_reason": "timeout"},
        "cancelled": {"pass": False, "stop_reason": "cancelled"},
        "budget_exceeded": {"pass": False, "stop_reason": "budget_exceeded"},
        "iteration_exhausted": {"pass": False, "stop_reason": "max_iterations"},
        "no_tool_calls": {"pass": False, "stop_reason": "completed", "tool_calls": 0},
        "no_checks": {"pass": False, "stop_reason": "golden", "checks_total": 0},
        "checks_failed": {
            "pass": False,
            "stop_reason": "completed",
            "tool_calls": 3,
            "checks_total": 2,
        },
    }
    assert set(samples) == set(FAILURE_CLASSES)
    for expected, record in samples.items():
        assert classify_failure(record) == expected


def test_classify_error_precedes_stop_reason() -> None:
    # 记录同时带 error 与 max_iterations：归"执行异常"，不归"迭代耗尽"
    assert (
        classify_failure(
            {"pass": False, "error": "tool crashed", "stop_reason": "max_iterations"}
        )
        == "execution_error"
    )


def test_golden_zero_tool_calls_is_not_no_tool_calls() -> None:
    # golden 档不跑循环，工具调用恒 0；失败只能归因到检查面
    rec = {
        "pass": False,
        "stop_reason": "golden",
        "tool_calls": 0,
        "checks_total": 1,
    }
    assert classify_failure(rec) == "checks_failed"


# ---------------------------------------------------------------------------
# C. 汇总读数
# ---------------------------------------------------------------------------

def _sample_results() -> list[dict]:
    return [
        {
            "id": "fix-1",
            "title": "修好一号",
            "category": "fix",
            "fixture": "fixture_calculator",
            "pass": True,
            "iterations": 3,
            "duration_ms": 100.0,
            "tokens_used": 1200,
            "tool_calls": 4,
            "tool_errors": 0,
            "self_heal_runs": 0,
            "checks_passed": 2,
            "checks_total": 2,
            "checks": [],
            "stop_reason": "completed",
        },
        {
            "id": "fix-2",
            "title": "修好二号",
            "category": "fix",
            "fixture": "fixture_calculator",
            "pass": False,
            "iterations": 8,
            "duration_ms": 900.0,
            "tokens_used": 4800,
            "tool_calls": 6,
            "tool_errors": 0,
            "self_heal_runs": 0,
            "checks_passed": 1,
            "checks_total": 2,
            "checks": [
                {"type": "pytest_pass", "pass": False, "detail": "1 failed"},
                {"type": "file_contains", "pass": True, "detail": "ok"},
            ],
            "stop_reason": "max_iterations",
        },
        {
            "id": "test-1",
            "title": "补测试一号",
            "category": "test",
            "fixture": "fixture_text_utils",
            "pass": True,
            "iterations": 2,
            "duration_ms": 40.0,
            "tokens_used": 0,  # golden 档：不参与 token 均值
            "tool_calls": 0,
            "tool_errors": 0,
            "self_heal_runs": 0,
            "checks_passed": 1,
            "checks_total": 1,
            "checks": [],
            "stop_reason": "golden",
        },
    ]


def test_summarize_pass_rate_and_tokens() -> None:
    metrics = summarize(_sample_results())
    assert metrics["total"] == 3
    assert metrics["passed"] == 2
    assert metrics["pass_rate"] == pytest.approx(0.6667, abs=1e-4)
    # 只有 2 条真实 token 样本，golden 的 0 不参与
    tokens = metrics["tokens"]
    assert tokens["samples"] == 2
    assert tokens["tasks_with_zero_tokens"] == 1
    assert tokens["p50"] == pytest.approx(3000.0)
    assert tokens["total"] == pytest.approx(6000.0)


def test_summarize_taxonomy_is_conserved() -> None:
    metrics = summarize(_sample_results())
    taxonomy = metrics["failure_taxonomy"]
    assert sum(taxonomy.values()) == metrics["total"]
    assert taxonomy["pass"] == 2
    assert taxonomy["iteration_exhausted"] == 1
    assert metrics["failures"] == [
        {
            "id": "fix-2",
            "category": "fix",
            "class": "iteration_exhausted",
            "detail": "失败检查: pytest_pass",
        }
    ]


def test_summarize_by_category() -> None:
    metrics = summarize(_sample_results())
    fix = metrics["by_category"]["fix"]
    assert fix["total"] == 2
    assert fix["passed"] == 1
    assert fix["pass_rate"] == pytest.approx(0.5)
    assert fix["iterations_p50"] == pytest.approx(5.5)
    assert metrics["by_category"]["test"]["pass_rate"] == pytest.approx(1.0)


def test_summarize_empty_is_safe() -> None:
    metrics = summarize([])
    assert metrics["total"] == 0
    assert metrics["pass_rate"] == 0.0
    assert metrics["failures"] == []
    assert all(v == 0 for v in metrics["failure_taxonomy"].values())


def test_render_markdown_contains_readouts() -> None:
    lines = render_markdown(summarize(_sample_results()))
    text = "\n".join(lines)
    assert "## 指标面" in text
    assert "工具轮次" in text
    assert "### 失败分类" in text
    assert "`iteration_exhausted`: 1" in text
    assert "### 分类别" in text


# ---------------------------------------------------------------------------
# D. 报告接线
# ---------------------------------------------------------------------------

def test_write_reports_embeds_metrics(tmp_path: Path) -> None:
    from bench.run_bench import _write_reports

    report = tmp_path / "out.md"
    summary = _write_reports(_sample_results(), report)
    assert "metrics" in summary
    assert summary["metrics"]["total"] == 3

    payload = json.loads((tmp_path / "out.json").read_text(encoding="utf-8"))
    assert payload["metrics"]["failure_taxonomy"]["iteration_exhausted"] == 1

    markdown = report.read_text(encoding="utf-8")
    assert "## 指标面" in markdown
    assert "p99" in markdown
    # 既有逐任务表仍在（指标面是新段落，不是替换）
    assert "| 任务ID | 类别 | 夹具 | 迭代 | 耗时(ms) | 检查 | 结果 |" in markdown
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

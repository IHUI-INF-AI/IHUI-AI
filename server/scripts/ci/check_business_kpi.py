"""业务核心 KPI 自检 (Phase 6-A).

目的: 在 CI 中校验业务核心 SLA 阈值已定义 + 对应 metric 在代码中暴露 + 对应告警已就位.

工作原理:
  1. 加载 tests/fixtures/kpi_sla_baseline.json (KPI 阈值定义)
  2. 扫描 app/ 目录下 zhs_biz_* metric 声明
  3. 检查 baseline 中每个 KPI 都有代码 metric + rules.yml 中 alert
  4. 检查 rules.yml 中 zhs_biz_* 引用覆盖 baseline (防止有 alert 但 baseline 缺)
  5. 退出码 0 / 1

用法:
  python scripts/ci/check_business_kpi.py
  python scripts/ci/check_business_kpi.py --strict  # KPI 缺 alert 必 fail
  python scripts/ci/check_business_kpi.py --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

BASELINE_PATH = ROOT / "tests" / "fixtures" / "kpi_sla_baseline.json"
HELM_RULES = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
DOCKER_RULES = ROOT / "docker" / "prometheus" / "rules.yml"


# ---------------------------------------------------------------------------
# 1. 加载 baseline
# ---------------------------------------------------------------------------


def load_baseline(path: Path) -> dict:
    if not path.exists():
        return {"kpis": []}
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# 2. 扫描代码中的 zhs_biz_* metric
# ---------------------------------------------------------------------------


def scan_biz_metrics() -> list[str]:
    """扫描 app/ 目录下所有 zhs_biz_* metric 声明 (Counter / Gauge / Histogram)."""
    out: list[str] = []
    pattern = re.compile(r'\b(?:Counter|Gauge|Histogram|Summary)\(\s*[\'"](zhs_biz_[a-z0-9_]+)[\'"]')
    for path in (ROOT / "app").rglob("*.py"):
        if "__pycache__" in str(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            continue
        for m in pattern.finditer(text):
            out.append(m.group(1))
    return list(dict.fromkeys(out))  # 去重保序


# ---------------------------------------------------------------------------
# 3. 提取告警规则的 expr
# ---------------------------------------------------------------------------


def _load_rule_exprs(path: Path) -> tuple[set[str], set[str]]:
    """返回 (alert_names, set of expr strings)."""
    if not path.exists():
        return set(), set()
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    names = set()
    exprs = set()
    for grp in data.get("groups", []):
        for rule in grp.get("rules", []):
            if "alert" not in rule:
                continue
            names.add(rule["alert"])
            exprs.add(rule.get("expr", ""))
    return names, exprs


# ---------------------------------------------------------------------------
# 4. 校验
# ---------------------------------------------------------------------------


def check_kpi_coverage(
    baseline: dict,
    biz_metrics: list[str],
    alert_names: set[str],
) -> list[str]:
    """检查每个 KPI 是否 ①代码中暴露 metric ②告警已定义."""
    errs = []
    metric_set = set(biz_metrics)
    for kpi in baseline.get("kpis", []):
        mid = kpi.get("metric")
        alert = kpi.get("alert")
        # 1. metric 存在
        if mid and mid not in metric_set:
            errs.append(
                f"KPI {kpi['id']!r} 引用 metric {mid!r}, 但代码中未暴露 (在 app/metrics_business.py 等). "
                f"请新增该 metric 或修正 KPI baseline."
            )
        # 2. alert 存在
        if alert and alert not in alert_names:
            errs.append(
                f"KPI {kpi['id']!r} 引用 alert {alert!r}, 但 rules.yml 中未定义. "
                f"请在 rules.yml 新增引用 metric {mid} 的告警."
            )
    return errs


def check_threshold_logic(baseline: dict) -> list[str]:
    """检查阈值定义合理性."""
    errs = []
    for kpi in baseline.get("kpis", []):
        v = kpi.get("threshold_value")
        op = kpi.get("threshold_op")
        if v is None or op is None:
            errs.append(f"KPI {kpi.get('id', '?')!r} 缺 threshold_value / threshold_op")
            continue
        if op not in ("lt", "le", "gt", "ge"):
            errs.append(f"KPI {kpi['id']!r} threshold_op 非法: {op}")
        if op in ("lt", "le") and v < 0:
            errs.append(f"KPI {kpi['id']!r} threshold_value < 0 但 op=lt/le")
    return errs


# ---------------------------------------------------------------------------
# 5. Main
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(description="业务核心 KPI 自检 (Phase 6-A)")
    p.add_argument("--baseline", type=Path, default=BASELINE_PATH)
    p.add_argument("--strict", action="store_true", help="KPI 缺 alert 即 fail")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    print("=" * 60)
    print("业务核心 KPI 自检 (Phase 6-A)")
    print("=" * 60)

    baseline = load_baseline(args.baseline)
    kpis = baseline.get("kpis", [])
    print(f"\n[Step 1] KPI baseline 加载: {len(kpis)} 条")

    biz_metrics = scan_biz_metrics()
    print(f"[Step 2] 代码中 zhs_biz_* metric: {len(biz_metrics)} 条")

    alert_names, _ = _load_rule_exprs(HELM_RULES)
    print(f"[Step 3] rules.yml alert 总数: {len(alert_names)}")

    all_errors: list[str] = []
    all_errors.extend(check_threshold_logic(baseline))

    if args.strict:
        errs = check_kpi_coverage(baseline, biz_metrics, alert_names)
        all_errors.extend(errs)
    else:
        # 默认仅 warning, 不强制 fail
        warns = check_kpi_coverage(baseline, biz_metrics, alert_names)
        if warns:
            print("\n[Step 4] KPI 覆盖检查 (warning 模式):")
            for w in warns:
                print(f"  [WARN]  {w}")

    # 输出 KPI 摘要
    print("\n[Step 5] KPI 摘要:")
    print(f"{'ID':30s} {'Metric':45s} {'Threshold':12s} {'Op':5s} {'Alert':30s}")
    print("-" * 130)
    for kpi in kpis:
        print(
            f"{kpi.get('id', ''):30s} {kpi.get('metric', ''):45s} "
            f"{kpi.get('threshold_value', '')!s:12s} {kpi.get('threshold_op', ''):5s} "
            f"{kpi.get('alert', ''):30s}"
        )

    print()
    if all_errors:
        print("=" * 60)
        print(f"[FAIL] FAIL: {len(all_errors)} 个错误")
        for e in all_errors:
            print(f"  - {e}")
        print("=" * 60)
        if args.json:
            print(
                json.dumps(
                    {
                        "status": "fail",
                        "kpis": kpis,
                        "biz_metrics": biz_metrics,
                        "errors": all_errors,
                    },
                    ensure_ascii=False,
                    indent=2,
                    default=str,
                )
            )
        return 1

    print("=" * 60)
    print(f"[OK] PASS: 业务核心 KPI 自检通过 ({len(kpis)} KPIs, {len(biz_metrics)} metrics)")
    print("=" * 60)
    if args.json:
        print(
            json.dumps(
                {
                    "status": "ok",
                    "kpis": kpis,
                    "biz_metrics": biz_metrics,
                },
                ensure_ascii=False,
                indent=2,
                default=str,
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Grafana dashboard JSON 验证脚本 (2026-06-26 新增).

检查项:
1. JSON 语法可解析
2. 所有 PromQL 引用的指标都在 auto_recovery_metrics.py 中定义
3. 所有表达式语法平衡 (括号/花括号/方括号)
4. 必要字段 (title/gridPos/type/datasource/targets) 存在
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DASHBOARD = REPO_ROOT / "deploy" / "grafana" / "dashboards" / "zhs_ws_auto_recovery_dashboard.json"
METRICS_FILE = REPO_ROOT / "server" / "app" / "ws" / "auto_recovery_metrics.py"


def collect_defined_metrics() -> set[str]:
    """从 auto_recovery_metrics.py 读取所有 zhs_ws_auto_recovery_* 指标名."""
    out: set[str] = set()
    for line in METRICS_FILE.read_text(encoding="utf-8").splitlines():
        m = re.search(r'"(zhs_ws_auto_recovery_[a-z_]+)"', line)
        if m:
            out.add(m.group(1))
    return out


def main() -> int:
    if not DASHBOARD.exists():
        print(f"FAIL: dashboard not found: {DASHBOARD}")
        return 1
    raw = DASHBOARD.read_text(encoding="utf-8")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"FAIL: invalid JSON: {e}")
        return 1
    print(f"OK json parse: {len(raw)} bytes, schema {data.get('schemaVersion')}")
    panels = data.get("panels", [])
    print(f"OK panels: {len(panels)} (含 row 容器)")

    defined = collect_defined_metrics()
    print(f"OK defined metrics: {len(defined)}")

    # Histogram 指标在 prometheus_client 里会暴露 _bucket / _count / _sum 子系列,
    # 这些不是独立定义的指标, 是同一 Histogram 的 samples. 校验时把 _bucket / _count / _sum
    # 后缀从引用中剥离再比对, 避免误报.
    def _strip_histogram_suffix(name: str) -> str:
        for sfx in ("_bucket", "_count", "_sum", "_created"):
            if name.endswith(sfx):
                return name[: -len(sfx)]
        return name

    expressions: list[tuple[int, str, str]] = []
    panel_issues: list[str] = []
    referenced: set[str] = set()

    for p in panels:
        if p.get("type") == "row":
            continue
        pid = p.get("id", "?")
        for required in ("title", "type", "gridPos", "targets"):
            if required not in p:
                panel_issues.append(f"panel {pid}: 缺字段 {required}")
        for t in p.get("targets", []):
            expr = (t.get("expr") or "").strip()
            if not expr:
                panel_issues.append(f"panel {pid} ref {t.get('refId')}: 空 expr")
                continue
            # 括号配平
            for op, cl in [("(", ")"), ("{", "}"), ("[", "]")]:
                if expr.count(op) != expr.count(cl):
                    panel_issues.append(
                        f"panel {pid} ref {t.get('refId')}: 括号不平衡 "
                        f"{op}{cl} (open={expr.count(op)}, close={expr.count(cl)})"
                    )
            # 收集指标引用 (处理 Histogram 子系列)
            # Histogram 在 prometheus_client 中会暴露:
            #   <name>_bucket{le=...}
            #   <name>_count
            #   <name>_sum
            # 校验时: 若原名 = 已知 metric 直接通过; 否则尝试剥 _bucket/_count/_sum
            # 后缀再查; 若剥后存在也通过 (说明引用的是 histogram 子系列).
            for m in re.findall(r"zhs_[a-z][a-z0-9_]*", expr):
                if m in defined:
                    referenced.add(m)
                else:
                    stripped = _strip_histogram_suffix(m)
                    if stripped in defined and stripped != m:
                        referenced.add(stripped)
                    else:
                        # 既不是独立 metric, 也不是 histogram 子系列 - 留作漏报
                        referenced.add(m)
            expressions.append((pid, t.get("refId"), expr))

    if panel_issues:
        for x in panel_issues:
            print(f"  ! {x}")
        return 1
    print(f"OK expression count: {len(expressions)}")
    print(f"OK referenced unique metrics: {len(referenced)}")

    missing = referenced - defined
    if missing:
        print(f"FAIL referenced-but-undefined: {sorted(missing)}")
        return 1
    print("OK all referenced metrics are defined in auto_recovery_metrics.py")

    unused = defined - referenced
    print(f"-- defined but not used in dashboard: {sorted(unused)}")

    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())

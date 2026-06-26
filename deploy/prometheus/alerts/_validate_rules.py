"""Prometheus 告警规则结构性校验 (2026-06-26 新增).

校验项:
1. YAML 可解析
2. group / rule 必备字段齐全 (alert / expr / labels / annotations)
3. severity 必须是合法级别
4. expr 括号/花括号/方括号配平
5. 引用指标必须 = auto_recovery_metrics.py 中已定义
6. 标签名称必须是合法 Prometheus 标识符

注意: 完整的 PromQL 语法校验 (label matching / operator 合法性等) 由 promtool 完成
      见 deploy/prometheus/alerts/CHECK.md
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
RULES_FILE = REPO_ROOT / "deploy" / "prometheus" / "alerts" / "ws_auto_recovery.yml"
METRICS_FILE = REPO_ROOT / "server" / "app" / "ws" / "auto_recovery_metrics.py"

import yaml

VALID_SEVERITIES = {"info", "warning", "critical"}
LABEL_NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def collect_defined_metrics() -> set[str]:
    out: set[str] = set()
    for line in METRICS_FILE.read_text(encoding="utf-8").splitlines():
        m = re.search(r'"(zhs_ws_auto_recovery_[a-z_]+)"', line)
        if m:
            out.add(m.group(1))
    return out


def main() -> int:
    if not RULES_FILE.exists():
        print(f"FAIL: rules not found: {RULES_FILE}")
        return 1
    try:
        data = yaml.safe_load(RULES_FILE.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        print(f"FAIL: invalid YAML: {e}")
        return 1
    if not isinstance(data, dict) or "groups" not in data:
        print("FAIL: missing top-level 'groups' key")
        return 1
    groups = data["groups"]
    if not isinstance(groups, list) or not groups:
        print("FAIL: 'groups' must be non-empty list")
        return 1
    print(f"OK yaml parse: {len(groups)} group(s)")

    defined = collect_defined_metrics()
    print(f"OK defined metrics: {len(defined)}")

    issues: list[str] = []
    total_rules = 0
    referenced: set[str] = set()
    severities: set[str] = set()
    label_names: set[str] = set()

    def strip_hist_suffix(name: str) -> str:
        for sfx in ("_bucket", "_count", "_sum", "_created"):
            if name.endswith(sfx):
                return name[: -len(sfx)]
        return name

    for gi, g in enumerate(groups):
        if not isinstance(g, dict):
            issues.append(f"group[{gi}]: not a dict")
            continue
        if "name" not in g or "rules" not in g:
            issues.append(f"group[{gi}]: missing 'name' or 'rules'")
            continue
        if not isinstance(g["rules"], list) or not g["rules"]:
            issues.append(f"group[{gi}] '{g.get('name')}': rules must be non-empty list")
            continue
        for ri, r in enumerate(g["rules"]):
            total_rules += 1
            alert = r.get("alert")
            expr = (r.get("expr") or "").strip()
            if not alert:
                issues.append(f"group[{g['name']}] rule[{ri}]: missing 'alert'")
            if not expr:
                issues.append(f"group[{g['name']}] rule[{ri}] '{alert}': missing 'expr'")
                continue
            # 括号配平
            for op, cl in [("(", ")"), ("{", "}"), ("[", "]")]:
                if expr.count(op) != expr.count(cl):
                    issues.append(
                        f"group[{g['name']}] '{alert}': 括号不平衡 "
                        f"{op}{cl} (open={expr.count(op)}, close={expr.count(cl)})"
                    )
            # 引用指标
            for m in re.findall(r"zhs_[a-z][a-z0-9_]*", expr):
                if m in defined:
                    referenced.add(m)
                else:
                    base = strip_hist_suffix(m)
                    if base in defined:
                        referenced.add(base)
                    else:
                        issues.append(f"group[{g['name']}] '{alert}': 引用未定义指标 {m}")
            # labels
            labels = r.get("labels") or {}
            for k, v in labels.items():
                if not LABEL_NAME_RE.match(k):
                    issues.append(f"group[{g['name']}] '{alert}': 非法 label 名 {k}")
                label_names.add(k)
            sev = labels.get("severity")
            if sev:
                severities.add(sev)
                if sev not in VALID_SEVERITIES:
                    issues.append(
                        f"group[{g['name']}] '{alert}': 非法 severity '{sev}' (合法: {sorted(VALID_SEVERITIES)})"
                    )
            # annotations 必备
            ann = r.get("annotations") or {}
            if "summary" not in ann:
                issues.append(f"group[{g['name']}] '{alert}': annotations 缺 'summary'")
            if "description" not in ann:
                issues.append(f"group[{g['name']}] '{alert}': annotations 缺 'description'")
            # for 时长
            if "for" in r and not re.match(r"^\d+[smhd]$", str(r["for"])):
                issues.append(f"group[{g['name']}] '{alert}': 'for' 必须形如 5m/30s/1h, 实际: {r['for']}")

    if issues:
        for x in issues:
            print(f"  ! {x}")
        return 1
    print(f"OK total rules: {total_rules}")
    print(f"OK referenced unique metrics: {len(referenced)}")
    print(f"OK severities: {sorted(severities)}")
    print(f"OK label names: {sorted(label_names)}")
    missing = defined - referenced
    if missing:
        print(f"-- defined metrics never referenced in rules: {sorted(missing)}")
    else:
        print("OK all defined metrics are covered by at least one rule")
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Prometheus 告警规则规范化检查 (建议 110).

功能:
  - 验证 docker/prometheus/rules.yml 中所有告警有 service=zhs-platform 标签
  - 验证所有告警有 severity 标签 (critical / warning / info)
  - 验证 summary / description 注解存在
  - 验证告警 expr 基础健全性
  - 验证 helm chart 副本与主副本一致

退出码 0 (PASS) / 1 (FAIL).

CI 用法:
  python scripts/ci/check_alert_rules.py
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

RULES_PATH = ROOT / "docker" / "prometheus" / "rules.yml"
HELM_RULES_PATH = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
REQUIRED_SERVICE = "zhs-platform"
REQUIRED_SEVERITIES = {"critical", "warning", "info"}
PROMQL_KEYWORDS = (
    "sum",
    "rate",
    "increase",
    "topk",
    "count",
    "avg",
    "max",
    "min",
    "histogram_quantile",
    "abs",
    "irate",
    "by ",
    "without ",
)
COMPARE_OPS = (">", "<", "==", "!=", ">=", "<=", "=~", "!~")


def _load_rules(path: Path) -> list:
    """加载告警规则列表 (每条 {group, name, expr, labels, annotations})."""
    import yaml

    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    out = []
    for grp in data.get("groups", []):
        for rule in grp.get("rules", []):
            if "alert" not in rule:
                continue
            out.append(
                {
                    "group": grp.get("name", "?"),
                    "name": rule["alert"],
                    "expr": rule.get("expr", ""),
                    "labels": rule.get("labels", {}),
                    "annotations": rule.get("annotations", {}),
                }
            )
    return out


def check_labels(rules: list) -> list:
    """检查 service / severity 标签."""
    errors = []
    for r in rules:
        if r["labels"].get("service") != REQUIRED_SERVICE:
            errors.append(
                f"{r['name']}: 缺/错 service label (期望 {REQUIRED_SERVICE}, 实际 {r['labels'].get('service')!r})"
            )
        sev = r["labels"].get("severity")
        if sev not in REQUIRED_SEVERITIES:
            errors.append(f"{r['name']}: severity 应是 {REQUIRED_SEVERITIES} 之一, 实际 {sev!r}")
    return errors


def check_annotations(rules: list) -> list:
    """检查 summary / description annotation."""
    errors = []
    for r in rules:
        if "summary" not in r["annotations"] and "description" not in r["annotations"]:
            errors.append(f"{r['name']}: 缺 summary / description annotation")
    return errors


def check_expr_syntax(rules: list) -> list:
    """检查 expr 基础健全性: 非空 + 含 PromQL 关键字或比较运算符."""
    errors = []
    for r in rules:
        expr = r["expr"]
        if not expr or not isinstance(expr, str):
            errors.append(f"{r['name']}: expr 为空或非字符串")
            continue
        expr_norm = expr.replace("\n", " ").replace("\t", " ").strip()
        expr_lower = expr_norm.lower()
        has_kw = any(kw in expr_lower for kw in PROMQL_KEYWORDS)
        has_cmp = any(op in expr_norm for op in COMPARE_OPS)
        if not (has_kw or has_cmp):
            errors.append(f"{r['name']}: expr 既无 PromQL 关键字也无比较运算符 (疑似无效)")
    return errors


def check_helm_consistency() -> list:
    """检查 helm 副本与主副本一致."""
    errors = []
    if not HELM_RULES_PATH.exists():
        errors.append(f"helm 副本不存在: {HELM_RULES_PATH}")
        return errors
    main_text = RULES_PATH.read_text(encoding="utf-8")
    helm_text = HELM_RULES_PATH.read_text(encoding="utf-8")
    if main_text != helm_text:
        errors.append("helm 副本与主副本不一致, 请运行 scripts/ci/sync_observability_config.py")
    return errors


def main() -> int:
    p = argparse.ArgumentParser(description="Prometheus 告警规则规范化检查 (建议 110)")
    p.add_argument("--path", default=str(RULES_PATH), help="rules.yml 路径 (默认 docker/prometheus/rules.yml)")
    p.add_argument("--no-helm-check", action="store_true", help="跳过 helm 副本一致性检查")
    args = p.parse_args()

    print("=" * 60)
    print("Prometheus 告警规则规范化检查 (建议 110)")
    print("=" * 60)
    print(f"规则文件: {args.path}")

    rules = _load_rules(Path(args.path))
    print(f"\n[Step 1] 加载告警规则: {len(rules)} 条")

    all_errors = []
    errs = check_labels(rules)
    if errs:
        all_errors.extend(errs)
        print(f"\n[Step 2] labels 检查: ❌ {len(errs)} 个错误")
        for e in errs[:5]:
            print(f"  - {e}")
    else:
        print(f"\n[Step 2] labels 检查: ✅ 所有 {len(rules)} 条告警都有 service=zhs-platform + 合法 severity")

    errs = check_annotations(rules)
    if errs:
        all_errors.extend(errs)
        print(f"\n[Step 3] annotations 检查: ❌ {len(errs)} 个错误")
    else:
        print("\n[Step 3] annotations 检查: ✅ 所有告警都有 summary/description")

    errs = check_expr_syntax(rules)
    if errs:
        all_errors.extend(errs)
        print(f"\n[Step 4] expr 健全性检查: ❌ {len(errs)} 个错误")
        for e in errs[:5]:
            print(f"  - {e}")
    else:
        print("\n[Step 4] expr 健全性检查: ✅ 所有 expr 合法")

    if not args.no_helm_check:
        errs = check_helm_consistency()
        if errs:
            all_errors.extend(errs)
            print("\n[Step 5] helm 副本一致性: ❌")
            for e in errs:
                print(f"  - {e}")
        else:
            print("\n[Step 5] helm 副本一致性: ✅")
    else:
        print("\n[Step 5] helm 副本一致性: 跳过 (--no-helm-check)")

    print()
    if all_errors:
        print("=" * 60)
        print(f"❌ FAIL: {len(all_errors)} 个错误")
        print("=" * 60)
        return 1
    print("=" * 60)
    print("✅ PASS: 告警规则规范化检查通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

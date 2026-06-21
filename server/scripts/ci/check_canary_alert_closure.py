"""Canary / Backfill / Shadow 闭环告警一致性自检 (建议 Phase 4-C).

功能:
  1. 从代码中自动提取所有 prometheus 暴露的 canary / backfill / shadow 相关 metric
     (扫描 app/canary_metrics.py 等模块的 Counter/Gauge/Histogram 声明)
  2. 从告警规则中提取所有 alert 的 expr, 验证关键 metric 都有 alert 覆盖
  3. 验证 alertmanager 抑制规则覆盖了 canary 紧急回滚 (ZHSRollbackActive)
  4. 验证 helm 副本与主副本一致

退出码 0 (PASS) / 1 (FAIL).

CI 用法:
  python scripts/ci/check_canary_alert_closure.py
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

RULES_PATH = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "rules.yml"
DOCKER_RULES_PATH = ROOT / "docker" / "prometheus" / "rules.yml"
ALERTMANAGER_PATH = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml"

# 关键 metric: 这些 metric 必须有 alert 覆盖 (业务上"如果不告警 = 业务黑洞")
# Phase 5-A: 新增 backfill / canary_audit 闭环告警
KEY_METRICS = (
    "zhs_canary_rollback_active",  # 紧急回滚标志
    "zhs_canary_stage_ratio",  # 当前 canary 阶段
    "zhs_shadow_ratio",  # 影子流量比例
    "zhs_backfill_persister_writes_total",  # Backfill 持久化写入 (Phase 5-A)
    "zhs_backfill_persister_reads_failed_total",  # Backfill 读失败 (Phase 5-A)
    "zhs_canary_audit_writes_total",  # Canary 审计写入 (Phase 5-A)
)


# ---------------------------------------------------------------------------
# 1. 提取代码中暴露的 metric
# ---------------------------------------------------------------------------


def extract_metrics_from_canary_module() -> list[str]:
    """从 app/canary_metrics.py 解析所有 Counter/Gauge 名称."""
    src = (ROOT / "app" / "canary_metrics.py").read_text(encoding="utf-8")
    out: list[str] = []
    # Counter("zhs_xxx", ...) 或 Gauge("zhs_xxx", ...)
    for m in re.finditer(r'\b(?:Counter|Gauge|Histogram|Summary)\(\s*[\'"](zhs_[a-z0-9_]+)[\'"]', src):
        out.append(m.group(1))
    return out


def extract_metrics_from_app() -> list[str]:
    """扫描 app/ 目录下所有 .py, 提取 zhs_canary_* / zhs_shadow_* / zhs_backfill_* metric 声明."""
    out: list[str] = []
    pattern = re.compile(
        r'\b(?:Counter|Gauge|Histogram|Summary)\(\s*[\'"](zhs_(?:canary|shadow|backfill)[a-z0-9_]*)[\'"]'
    )
    for path in (ROOT / "app").rglob("*.py"):
        # 跳过 __pycache__
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
# 2. 提取告警规则
# ---------------------------------------------------------------------------


def _load_rules(path: Path) -> list[dict]:
    if not path.exists():
        return []
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    out = []
    for grp in data.get("groups", []):
        for rule in grp.get("rules", []):
            if "alert" not in rule:
                continue
            out.append(
                {
                    "name": rule["alert"],
                    "expr": rule.get("expr", "") or "",
                    "labels": rule.get("labels", {}) or {},
                }
            )
    return out


# ---------------------------------------------------------------------------
# 3. 检查关键 metric 覆盖
# ---------------------------------------------------------------------------


def check_key_metric_coverage(rules: list[dict], metrics: list[str]) -> list[str]:
    """每个 KEY_METRICS 必须有 ≥1 条 alert 引用."""
    errors = []
    exprs_joined = "\n".join(r["expr"] for r in rules)
    for km in KEY_METRICS:
        if km not in exprs_joined:
            errors.append(f"关键 metric {km!r} 没有 alert 覆盖. " f"请在 rules.yml 添加引用 {km} 的告警.")
    return errors


def check_metric_alert_closure(metrics: list[str], rules: list[dict]) -> list[dict]:
    """返回每个 metric 是否有 alert 覆盖."""
    exprs_joined = "\n".join(r["expr"] for r in rules)
    return [{"metric": m, "covered": m in exprs_joined} for m in metrics]


def _build_closure(metrics: list[str], rules: list[dict]) -> list[dict]:
    exprs_joined = "\n".join(r["expr"] for r in rules)
    return [{"metric": m, "covered": m in exprs_joined} for m in metrics]


# ---------------------------------------------------------------------------
# 4. 抑制规则覆盖
# ---------------------------------------------------------------------------


def check_rollback_inhibited(am_path: Path) -> list[str]:
    """alertmanager.yml 的抑制规则应能覆盖 ZHSRollbackActive (作为 source)."""
    if not am_path.exists():
        return [f"alertmanager.yml 不存在: {am_path}"]
    data = yaml.safe_load(am_path.read_text(encoding="utf-8"))
    inhib = data.get("inhibit_rules", []) or []
    for rule in inhib:
        src = rule.get("source_match", {}) or {}
        if src.get("alertname") == "ZHSRollbackActive":
            return []  # 找到了
    return ["ZHSRollbackActive 没有作为 source 出现在抑制规则中"]


# ---------------------------------------------------------------------------
# 5. Helm / Docker 副本一致
# ---------------------------------------------------------------------------


def check_helm_consistency() -> list[str]:
    if not DOCKER_RULES_PATH.exists() or not RULES_PATH.exists():
        return []
    if RULES_PATH.read_text(encoding="utf-8") != DOCKER_RULES_PATH.read_text(encoding="utf-8"):
        return ["helm 副本与 docker 副本不一致, 请运行 scripts/ci/sync_observability_config.py"]
    return []


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(description="Canary / Backfill 告警闭环一致性自检 (Phase 4-C)")
    p.add_argument("--json", action="store_true", help="JSON 输出")
    p.add_argument("--no-helm-check", action="store_true", help="跳过 helm 一致性")
    args = p.parse_args()

    print("=" * 60)
    print("Canary / Backfill 告警闭环一致性自检 (Phase 4-C)")
    print("=" * 60)

    metrics = extract_metrics_from_app()
    print(f"\n[Step 1] 代码中暴露的 canary/backfill/shadow metric: {len(metrics)} 条")
    for m in metrics:
        print(f"  - {m}")

    rules = _load_rules(RULES_PATH)
    print(f"\n[Step 2] rules.yml 中告警规则: {len(rules)} 条")

    all_errors: list[str] = []
    closure = check_metric_alert_closure(metrics, rules)
    missing = [c for c in closure if not c["covered"]]
    if missing:
        print(f"\n[Step 3] metric 覆盖检查: [WARN]  {len(missing)} 条 metric 无 alert")
        for c in missing:
            print(f"  - {c['metric']}")
        # 业务建议: 不强制 fail, 只警告 (有些 metric 仅供监控不需要告警)
    else:
        print(f"\n[Step 3] metric 覆盖检查: [OK] 全部 {len(metrics)} 条 metric 都有 alert 覆盖")

    errs = check_key_metric_coverage(rules, metrics)
    if errs:
        all_errors.extend(errs)
        print(f"\n[Step 4] 关键 metric 强制覆盖: [FAIL] {len(errs)} 个错误")
        for e in errs:
            print(f"  - {e}")
    else:
        print(f"\n[Step 4] 关键 metric 强制覆盖: [OK] {len(KEY_METRICS)} 条关键 metric 都有 alert")

    errs = check_rollback_inhibited(ALERTMANAGER_PATH)
    if errs:
        all_errors.extend(errs)
        print("\n[Step 5] 抑制规则覆盖 ZHSRollbackActive: [FAIL]")
        for e in errs:
            print(f"  - {e}")
    else:
        print("\n[Step 5] 抑制规则覆盖 ZHSRollbackActive: [OK]")

    if not args.no_helm_check:
        errs = check_helm_consistency()
        if errs:
            all_errors.extend(errs)
            print("\n[Step 6] helm / docker 副本一致: [FAIL]")
            for e in errs:
                print(f"  - {e}")
        else:
            print("\n[Step 6] helm / docker 副本一致: [OK]")
    else:
        print("\n[Step 6] helm / docker 副本一致: 跳过")

    print()
    if all_errors:
        print("=" * 60)
        print(f"[FAIL] FAIL: {len(all_errors)} 个错误")
        print("=" * 60)
        if args.json:
            import json

            print(
                json.dumps(
                    {"errors": all_errors, "metrics": metrics, "closure": closure},
                    indent=2,
                    ensure_ascii=False,
                    default=str,
                )
            )
        return 1
    print("=" * 60)
    print("[OK] PASS: Canary / Backfill 告警闭环一致性检查通过")
    print("=" * 60)
    if args.json:
        import json

        print(json.dumps({"metrics": metrics, "closure": closure}, indent=2, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())

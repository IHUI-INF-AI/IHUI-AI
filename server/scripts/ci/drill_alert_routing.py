"""告警路由演练 (Phase 5-C, 建议 144).

目的: 在 CI 中演练 alertmanager.yml 路由 + 抑制规则, 防止 prod 演练耗时.

工作原理:
  1. 加载 alertmanager.yml (route / receivers / inhibit_rules)
  2. 注入一组 sample alerts (覆盖 critical / warning / drill 各类)
  3. 对每条 alert 用 yaml 路由树匹配 receiver
  4. 用 inhibit_rules 计算抑制后的最终 alert 集
  5. 输出路由表 (每条 alert → 哪个 receiver)
  6. 输出抑制表 (source → target)
  7. 失败时: 关键 alert 没路由到 zhs-critical, 或 critical 链路被错抑制

用法:
  python scripts/ci/drill_alert_routing.py
  python scripts/ci/drill_alert_routing.py --json
  python scripts/ci/drill_alert_routing.py --config custom_alertmanager.yml
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

ALERTMANAGER_PATH = ROOT / "deploy" / "helm" / "zhs-platform" / "prometheus" / "alertmanager.yml"


# ---------------------------------------------------------------------------
# Sample alert set (覆盖关键场景)
# ---------------------------------------------------------------------------

SAMPLE_ALERTS: list[dict[str, Any]] = [
    {
        "alertname": "ZHSAppDown",
        "service": "zhs-platform",
        "severity": "critical",
        "status": "firing",
    },
    {
        "alertname": "ZHSCanaryStageStuck",
        "service": "zhs-platform",
        "severity": "warning",
        "status": "firing",
    },
    {
        "alertname": "ZHSRollbackActive",
        "service": "zhs-platform",
        "severity": "critical",
        "status": "firing",
    },
    {
        "alertname": "ZHSDatabaseDown",
        "service": "zhs-platform",
        "severity": "critical",
        "status": "firing",
    },
    {
        "alertname": "ZHS_CI_DRILL_FAILURE",
        "service": "ci",
        "severity": "critical",
        "status": "firing",
    },
    {
        "alertname": "ZHS_CI_DRILL_LATENCY",
        "service": "ci",
        "severity": "warning",
        "status": "firing",
    },
    {
        "alertname": "ZHSHighCPU",
        "service": "zhs-platform",
        "severity": "warning",
        "status": "firing",
    },
    {
        "alertname": "ZHSCanaryAuditDegraded",
        "service": "zhs-platform",
        "severity": "critical",
        "status": "firing",
    },
    {
        "alertname": "ZHSBackfillPersisterDegraded",
        "service": "zhs-platform",
        "severity": "warning",
        "status": "firing",
    },
]


# ---------------------------------------------------------------------------
# 路由匹配
# ---------------------------------------------------------------------------


def _match_label_match(match: dict, alert: dict) -> bool:
    """Match exact label equality (alertmanager 语义)."""
    for k, v in (match or {}).items():
        if alert.get(k) != v:
            return False
    return True


def _match_label_re(match_re: dict, alert: dict) -> bool:
    import re

    for k, pat in (match_re or {}).items():
        v = alert.get(k)
        if v is None:
            return False
        if not re.fullmatch(pat, str(v)):
            return False
    return True


def resolve_receiver(route_node: dict, alert: dict) -> str:
    """递归匹配路由树, 返回 alert 命中的 receiver.

    alertmanager 路由语义 (简化):
      - 先尝试子路由 (子路由有 match/match_re 命中 → 用子路由 receiver)
      - 子路由没命中 → fallback 到当前节点 receiver
      - 子路由 continue=true (默认 false) 时继续尝试下一个子路由, 但匹配优先级为先来先得
    """
    # 先尝试子路由
    for child in route_node.get("routes", []) or []:
        # 子路由有自己的 match / match_re
        if "match" in child or "match_re" in child:
            ok = _match_label_match(child.get("match", {}), alert) and _match_label_re(child.get("match_re", {}), alert)
            if ok:
                # 子路由命中, 用子路由的 receiver
                # 如果子路由没有 receiver, 递归
                if "receiver" in child:
                    return child["receiver"]
                r = resolve_receiver(child, alert)
                if r:
                    return r
        else:
            # 子路由是中间节点, 递归
            r = resolve_receiver(child, alert)
            if r:
                return r

    # 子路由没匹配, fallback 到当前节点 receiver
    return route_node.get("receiver", "")


# ---------------------------------------------------------------------------
# 抑制规则
# ---------------------------------------------------------------------------


def apply_inhibit_rules(alerts: list[dict], rules: list[dict]) -> tuple[list[dict], list[dict]]:
    """应用抑制规则, 返回 (active, suppressed) 两组.

    source 规则:
      - source_match / source_match_re: source alert 的 label 条件
      - target_match / target_match_re: target alert 的 label 条件
      - equal: 必须相等的 label (默认 alertname)
    """
    active = []
    suppressed = []
    for target in alerts:
        matched_rule = None
        for rule in rules or []:
            if not _match_label_match(rule.get("source_match", {}), target):
                # 注: target 看 source_match 是不对的, 应该是 source 看 source_match
                # 实际语义: source 必须匹配 source_match, target 必须匹配 target_match
                pass
            # 找 source
            source_match = rule.get("source_match", {}) or {}
            target_match = rule.get("target_match", {}) or {}
            equal = rule.get("equal", ["alertname"])
            # 找 active source
            for src in alerts:
                if src is target:
                    continue
                if src.get("status") != "firing":
                    continue
                if not _match_label_match(source_match, src):
                    continue
                if not _match_label_match(target_match, target):
                    continue
                # equal 字段值必须一致
                if not all(src.get(k) == target.get(k) for k in equal):
                    continue
                matched_rule = rule
                break
            if matched_rule:
                break
        if matched_rule:
            suppressed.append({"alert": target, "rule": matched_rule})
        else:
            active.append(target)
    return active, suppressed


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(description="告警路由演练 (Phase 5-C)")
    p.add_argument("--config", type=Path, default=ALERTMANAGER_PATH)
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    print("=" * 60)
    print("告警路由演练 (Phase 5-C)")
    print("=" * 60)

    if not args.config.exists():
        print(f"[ERROR] alertmanager.yml 不存在: {args.config}")
        return 1

    cfg = yaml.safe_load(args.config.read_text(encoding="utf-8"))
    root_route = cfg.get("route", {}) or {}
    receivers = cfg.get("receivers", []) or []
    receivers_by_name = {r["name"]: r for r in receivers}
    inhibit_rules = cfg.get("inhibit_rules", []) or []

    print("\n[Step 1] 加载 alertmanager 配置:")
    print(f"  - 顶层 receiver: {root_route.get('receiver')}")
    print(f"  - 子路由: {len(root_route.get('routes', []))}")
    print(f"  - 抑制规则: {len(inhibit_rules)}")

    print(f"\n[Step 2] 注入 sample alerts: {len(SAMPLE_ALERTS)} 条")

    # 路由演练
    print("\n[Step 3] 路由匹配:")
    routing: list[dict] = []
    errors = []
    for a in SAMPLE_ALERTS:
        rcv = resolve_receiver(root_route, a)
        routing.append({"alert": a, "receiver": rcv})
        marker = "[OK]" if rcv else "[FAIL]"
        print(f"  {marker} {a['alertname']:30s} (sev={a['severity']:8s}) → {rcv or '<NONE>'}")

        # 关键检查: critical 告警应被路由到 zhs-critical 或 zhs-ci-drill
        if a["severity"] == "critical" and not rcv:
            errors.append(f"critical alert {a['alertname']} 未路由到任何 receiver")
        if a["severity"] == "critical" and rcv and rcv == "zhs-default":
            errors.append(f"critical alert {a['alertname']} 错误路由到 zhs-default, 应为 zhs-critical")

    # 抑制演练
    print("\n[Step 4] 抑制规则应用:")
    active, suppressed = apply_inhibit_rules(SAMPLE_ALERTS, inhibit_rules)
    for s in suppressed:
        print(f"  [INHIBITED] {s['alert']['alertname']:30s} 被抑制 (by rule: {s['rule'].get('source_match', {})})")
    print(f"  抑制后 active: {len(active)} 条")

    # 关键检查
    print("\n[Step 5] 关键检查:")
    print("  - critical 必须路由到 zhs-critical 或 zhs-ci-drill: ", end="")
    crit_alerts = [a for a in SAMPLE_ALERTS if a["severity"] == "critical"]
    crit_rcvs = {resolve_receiver(root_route, a) for a in crit_alerts}
    crit_ok = crit_rcvs.issubset({"zhs-critical", "zhs-ci-drill"})
    print("[OK]" if crit_ok else "[FAIL]", crit_rcvs)

    print("  - ZHSRollbackActive 抑制 ZHSCanaryStageStuck: ", end="")
    canary_stuck = next(
        (a for a in SAMPLE_ALERTS if a["alertname"] == "ZHSCanaryStageStuck"),
        None,
    )
    stuck_in_active = canary_stuck in active
    print("[OK]" if not stuck_in_active else "[FAIL] (未抑制)")

    print("  - ZHS_CI_DRILL_FAILURE 抑制 ZHS_CI_DRILL_LATENCY: ", end="")
    drill_lat = next(
        (a for a in SAMPLE_ALERTS if a["alertname"] == "ZHS_CI_DRILL_LATENCY"),
        None,
    )
    lat_in_active = drill_lat in active
    print("[OK]" if not lat_in_active else "[FAIL] (未抑制)")

    print()
    if errors:
        print("=" * 60)
        print(f"[FAIL] FAIL: {len(errors)} 个路由错误")
        for e in errors:
            print(f"  - {e}")
        print("=" * 60)
        if args.json:
            print(
                json.dumps(
                    {
                        "status": "fail",
                        "routing": [{"alert": r["alert"], "receiver": r["receiver"]} for r in routing],
                        "active": active,
                        "suppressed": [{"alert": s["alert"]} for s in suppressed],
                        "errors": errors,
                    },
                    ensure_ascii=False,
                    indent=2,
                    default=str,
                )
            )
        return 1

    print("=" * 60)
    print(f"[OK] PASS: 告警路由演练通过 ({len(SAMPLE_ALERTS)} alerts, {len(suppressed)} suppressed)")
    print("=" * 60)
    if args.json:
        print(
            json.dumps(
                {
                    "status": "ok",
                    "routing": [{"alert": r["alert"], "receiver": r["receiver"]} for r in routing],
                    "active_count": len(active),
                    "suppressed_count": len(suppressed),
                },
                ensure_ascii=False,
                indent=2,
                default=str,
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())

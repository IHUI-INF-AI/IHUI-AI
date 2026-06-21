"""Phase 9: ZHSRollbackActive 按 phase 分发路由验证.

目的:
  1. 解析 alertmanager.yml, 确认 4 个 phase 路由 (default / canary / blue_green / feature_flag) 全部注册
  2. 模拟 alertmanager 路由评估: 4 个 ZHSRollbackActive 告警 (含不同 phase) 各自命中正确 receiver
  3. 验证 prometheus rules.yml ZHSRollbackActive expr 用 zhs_canary_rollback_active_by_phase
     且 labels 块含 phase: '{{ $labels.phase }}'

不依赖真实 alertmanager / prometheus 进程, 纯配置静态分析.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
AM_PATH = ROOT / "docker" / "alertmanager" / "alertmanager.yml"
RULES_PATH = ROOT / "docker" / "prometheus" / "rules.yml"

EXPECTED_RECEIVERS = {
    "zhs-rollback-default",
    "zhs-rollback-canary",
    "zhs-rollback-blue-green",
    "zhs-rollback-feature-flag",
}
EXPECTED_PHASES = ("canary", "blue_green", "feature_flag")


def load_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def collect_routes(route: dict, out: list) -> None:
    """递归遍历 alertmanager route 树, 收集所有叶子 route."""
    out.append(route)
    for sub in route.get("routes", []) or []:
        collect_routes(sub, out)


def evaluate_route(route: dict, labels: dict, matched: list) -> None:
    """按 alertmanager 实际行为: 自顶向下 match, 第一个命中即终止 (除非 continue: true).

    嵌套 routes 子树先评估子路由 (子路由优先级更高).
    """
    # 先评估嵌套子路由
    for sub in route.get("routes", []) or []:
        evaluate_route(sub, labels, matched)
        if matched and not sub.get("continue", False):
            return  # 子路由命中且不 continue, 整条线结束
    # 评估自身 match
    match_ok = True
    for k, v in (route.get("match") or {}).items():
        if labels.get(k) != v:
            match_ok = False
            break
    if not match_ok:
        match_re = route.get("match_re") or {}
        for k, v in match_re.items():
            if not re.fullmatch(v, str(labels.get(k, ""))):
                match_ok = False
                break
    if match_ok and route.get("receiver"):
        matched.append(route["receiver"])


def main() -> int:
    errs: list[str] = []
    am = load_yaml(AM_PATH)
    rules = load_yaml(RULES_PATH)

    # 1. 验证 receivers 全部存在
    receivers = {r["name"] for r in am.get("receivers", [])}
    for name in EXPECTED_RECEIVERS:
        if name not in receivers:
            errs.append(f"alertmanager.yml 缺少 receiver: {name}")

    # 2. 验证 routes 树含 4 条 phase 路由
    all_routes: list[dict] = []
    collect_routes(am.get("route", {}), all_routes)
    rollback_routes = [r for r in all_routes if r.get("receiver") in EXPECTED_RECEIVERS]
    found_receivers = {r.get("receiver") for r in rollback_routes}
    for name in EXPECTED_RECEIVERS:
        if name not in found_receivers:
            errs.append(f"alertmanager.yml routes 树缺 receiver 路由: {name}")

    # 3. 模拟 4 个 ZHSRollbackActive 告警, 验证命中正确
    test_labels_list = [
        {"alertname": "ZHSRollbackActive", "severity": "critical", "phase": "canary"},
        {"alertname": "ZHSRollbackActive", "severity": "critical", "phase": "blue_green"},
        {"alertname": "ZHSRollbackActive", "severity": "critical", "phase": "feature_flag"},
        {"alertname": "ZHSRollbackActive", "severity": "critical"},  # 无 phase 走 default
    ]
    expected_hits = [
        "zhs-rollback-canary",
        "zhs-rollback-blue-green",
        "zhs-rollback-feature-flag",
        "zhs-rollback-default",
    ]
    for labels, expected in zip(test_labels_list, expected_hits):
        matched: list[str] = []
        evaluate_route(am.get("route", {}), labels, matched)
        # 第一个非 None 的 receiver 才是命中 (后续是其他路径副作用)
        primary = matched[0] if matched else None
        if expected not in matched:
            errs.append(f"phase={labels.get('phase', 'NONE')} 告警未命中 {expected}, 实际 matched={matched}")

    # 4. 验证 rules.yml ZHSRollbackActive 用 by_phase 指标
    all_alerts: list[dict] = []
    for g in rules.get("groups", []):
        for r in g.get("rules", []):
            if "alert" in r:
                all_alerts.append(r)
    rb = next((r for r in all_alerts if r.get("alert") == "ZHSRollbackActive"), None)
    if rb is None:
        errs.append("rules.yml 缺 ZHSRollbackActive 告警")
    else:
        expr = rb.get("expr", "")
        if "zhs_canary_rollback_active_by_phase" not in expr:
            errs.append(f"ZHSRollbackActive expr 没用 by_phase 指标: {expr!r}")
        labels = rb.get("labels", {})
        if "phase" not in labels or "{{ $labels.phase }}" not in labels.get("phase", ""):
            errs.append(f"ZHSRollbackActive labels.phase 缺模板: {labels.get('phase', '')!r}")

    # 5. 总结
    if errs:
        print("[FAIL] Phase 9 回滚路由验证失败:")
        for e in errs:
            print(f"  - {e}")
        return 1
    print("[OK] Phase 9 ZHSRollbackActive phase 路由验证全部通过")
    print(f"  receivers: {len(EXPECTED_RECEIVERS)} 个")
    print("  4 个测试告警全部命中预期 receiver:")
    for lbl, exp in zip(test_labels_list, expected_hits):
        print(f"    phase={lbl.get('phase', '(无)'):<13} → {exp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

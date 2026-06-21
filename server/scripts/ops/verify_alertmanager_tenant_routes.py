"""Alertmanager 多租户路由验证 (建议 2 落地测试).

校验:
  1. phase8 closure 路由存在
  2. tenant_id=tenant_alpha / beta 子路由存在
  3. 3 个租户接收方都已注册
  4. 模拟 4 类告警走通路由 (default/alpha/beta 各自命中自己的 receiver)
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
AM = ROOT / "docker" / "alertmanager" / "alertmanager.yml"


def _walk_routes(routes: list, path: str = "") -> list[tuple[str, dict]]:
    """递归遍历所有路由, 返回 [(路径, 路由dict), ...]."""
    out = []
    for r in routes or []:
        match = r.get("match", {}) or {}
        match_re = r.get("match_re", {}) or {}
        match_str = " & ".join(f"{k}={v}" for k, v in match.items())
        match_re_str = " & ".join(f"{k}~{v}" for k, v in match_re.items())
        seg = " | ".join(filter(None, [match_str, match_re_str])) or "*"
        out.append((f"{path}/{seg}", r))
        out.extend(_walk_routes(r.get("routes", []), f"{path}/{seg}"))
    return out


def route_match(route: dict, labels: dict) -> bool:
    """看 labels 是否命中这条路由 (含 match + match_re)."""
    m = route.get("match", {}) or {}
    for k, v in m.items():
        if labels.get(k) != v:
            return False
    mre = route.get("match_re", {}) or {}
    import re as _re

    for k, pat in mre.items():
        val = labels.get(k, "")
        if not _re.match(pat, str(val)):
            return False
    return True


def simulate(am: dict, labels: dict) -> str:
    """按 alertmanager 实际行为: 自顶向下 evaluate routes 列表 (非 flat)."""

    def _eval(routes: list, fallback: str) -> str:
        for r in routes or []:
            if route_match(r, labels):
                # 命中: 先评估子路由
                sub = r.get("routes", [])
                if sub:
                    sub_res = _eval(sub, r.get("receiver", fallback))
                    if sub_res:
                        return sub_res
                if not r.get("continue", False):
                    return r.get("receiver", fallback)
                else:
                    # continue: true, 后续 siblings 还会评估, 但优先返回当前
                    current = r.get("receiver", fallback)
                    # 继续匹配后续 routes
                    for r2 in routes:
                        if r2 is r:
                            continue
                        if route_match(r2, labels):
                            if not r2.get("continue", False):
                                return r2.get("receiver", current)
                    return current
        return fallback

    return _eval(am.get("route", {}).get("routes", []), am.get("route", {}).get("receiver", "?"))


def main() -> int:
    if not AM.exists():
        print(f"✗ 找不到 {AM}")
        return 1
    am = yaml.safe_load(AM.read_text(encoding="utf-8"))

    # 1) 检查 routes 结构
    routes = am.get("route", {}).get("routes", [])
    all_routes = _walk_routes(routes)
    print(f"总路由数: {len(all_routes)}")
    phase8_found = False
    alpha_found = False
    beta_found = False
    for path, r in all_routes:
        m = r.get("match", {}) or {}
        if m.get("closure") == "phase8":
            phase8_found = True
            sub = r.get("routes", [])
            print(f"  phase8 路由 receiver={r.get('receiver')}, 子路由={len(sub)}")
        if m.get("tenant_id") == "tenant_alpha":
            alpha_found = True
        if m.get("tenant_id") == "tenant_beta":
            beta_found = True
    ok = True
    for name, found in [("phase8", phase8_found), ("tenant_alpha", alpha_found), ("tenant_beta", beta_found)]:
        if not found:
            print(f"  ✗ 缺 {name} 路由")
            ok = False
        else:
            print(f"  ✓ {name} 路由存在")

    # 2) 检查 receivers
    receivers = [r.get("name") for r in am.get("receivers", [])]
    print(f"receivers: {receivers}")
    for need in ("zhs-monitor-ops", "zhs-monitor-ops-tenant-alpha", "zhs-monitor-ops-tenant-beta"):
        if need not in receivers:
            print(f"  ✗ 缺 receiver {need}")
            ok = False
        else:
            print(f"  ✓ receiver {need} 已注册")

    # 3) 模拟路由
    cases = [
        ({"closure": "phase8", "alertname": "ZHSMonitorDown", "tenant_id": "default"}, "zhs-monitor-ops"),
        (
            {"closure": "phase8", "alertname": "ZHSMonitorDown", "tenant_id": "tenant_alpha"},
            "zhs-monitor-ops-tenant-alpha",
        ),
        (
            {"closure": "phase8", "alertname": "ZHSMonitorDown", "tenant_id": "tenant_beta"},
            "zhs-monitor-ops-tenant-beta",
        ),
        ({"alertname": "DiskWillFillIn4Hours"}, "zhs-default"),
    ]
    print("\n路由模拟:")
    for labels, expected in cases:
        got = simulate(am, labels)
        mark = "✓" if got == expected else "✗"
        if got != expected:
            ok = False
        print(f"  {mark} labels={labels} → {got} (期望 {expected})")
    if ok:
        print("\n✓ 全部通过, 多租户路由就位")
    else:
        print("\n✗ 有失败项")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

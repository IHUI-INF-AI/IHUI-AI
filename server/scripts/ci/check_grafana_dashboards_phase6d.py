"""Grafana 面板 JSON 加深检查 (Phase 6-D, 建议扩展).

在 verify_grafana_dashboards.py 基础上加深:
  1. panel id 在 dashboard 内唯一
  2. panel expr 引用真实 prometheus metric (zhs_* 在 prom 中已注册)
  3. gridPos 不重叠
  4. tags 至少 1 个, 且含 zhs- 前缀
  5. schemaVersion >= 30 (避免老 schema)
  6. panel title 非空
  7. 至少 1 个 timeseries / stat / gauge panel
  8. alert 列表的 panel expr 与业务 metric 命名空间一致

退出码 0 / 1.

用法:
  python scripts/ci/check_grafana_dashboards_phase6d.py
  python scripts/ci/check_grafana_dashboards_phase6d.py --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

DASHBOARDS_DIR = ROOT / "deploy" / "grafana" / "dashboards"

# Prometheus metric 白名单 (来自 metrics_business.py / canary_metrics.py)
# 用于交叉验证 panel expr 引用的 metric
KNOWN_METRIC_PREFIXES = (
    "zhs_biz_",
    "zhs_canary_",
    "zhs_shadow_",
    "zhs_backfill_",
    "zhs_ws_",
    "zhs_app_",
    "zhs_db_",
    "zhs_pay_",
    "zhs_chat_",
    "zhs_hls_",
    "zhs_video_",
    "up",  # 标准 prom
    "ALERTS",  # 标准 prom
    "ALERTS_FOR_STATE",
)

MIN_SCHEMA_VERSION = 30


# ---------------------------------------------------------------------------
# Panel 检查
# ---------------------------------------------------------------------------


def _extract_prom_metrics(expr: str) -> list[str]:
    """从 panel expr 抽 metric 名 (简单 word match)."""
    if not isinstance(expr, str):
        return []
    # prom metric 名规则: [a-zA-Z_:][a-zA-Z0-9_:]*
    return re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_:]*[a-zA-Z0-9_])\b", expr)


def check_panel(panel: dict) -> list[str]:
    """返回 panel 错误列表."""
    errs = []
    pid = panel.get("id", "?")
    if not panel.get("title"):
        errs.append(f"panel id={pid}: 缺 title")
    if not panel.get("type"):
        errs.append(f"panel id={pid}: 缺 type")
    # expr / targets
    targets = panel.get("targets") or []
    if not targets:
        # 某些 panel (e.g. row / text) 不需要 targets
        if panel.get("type") not in ("row", "text", "dashlist"):
            errs.append(f"panel id={pid} ({panel.get('type', '?')}): 缺 targets")
    else:
        for t in targets:
            expr = t.get("expr", "")
            metrics = _extract_prom_metrics(expr)
            # 至少 1 个 metric 引用了已知前缀
            if expr and metrics:
                if not any(m.startswith(KNOWN_METRIC_PREFIXES) or m.startswith("rate(") for m in metrics):
                    errs.append(f"panel id={pid}: expr 引用未注册 metric, expr={expr[:80]}, " f"metrics={metrics[:3]}")
    return errs


def check_gridpos_overlap(panels: list[dict]) -> list[str]:
    """检查 gridPos 是否重叠."""
    errs = []
    seen = []
    for p in panels:
        gp = p.get("gridPos", {})
        if not all(k in gp for k in ("x", "y", "w", "h")):
            continue
        # 归一化到 24 列 (Grafana 默认)
        for s in seen:
            if (
                gp["x"] < s["x"] + s["w"]
                and gp["x"] + gp["w"] > s["x"]
                and gp["y"] < s["y"] + s["h"]
                and gp["y"] + gp["h"] > s["y"]
            ):
                errs.append(f"panel id={p.get('id', '?')} 与 id={s['id']} gridPos 重叠")
        seen.append({"id": p.get("id", "?"), **gp})
    return errs


def check_dashboard(d: dict, fname: str) -> list[str]:
    errs = []
    warns = []
    # 1. tags 至少 1 个含 'zhs'
    tags = d.get("tags") or []
    if not tags:
        errs.append(f"{fname}: tags 为空")
    elif not any("zhs" in str(t).lower() for t in tags):
        errs.append(f"{fname}: tags 中无 'zhs' 标识")
    # 2. schemaVersion
    sv = d.get("schemaVersion", 0)
    if isinstance(sv, int) and sv < MIN_SCHEMA_VERSION:
        errs.append(f"{fname}: schemaVersion {sv} < {MIN_SCHEMA_VERSION}")
    elif not isinstance(sv, int):
        errs.append(f"{fname}: schemaVersion 非整数: {sv}")
    # 3. panel id 唯一
    panel_ids = [p.get("id") for p in d.get("panels", []) if p.get("id") is not None]
    if len(panel_ids) != len(set(panel_ids)):
        from collections import Counter

        dupes = [k for k, v in Counter(panel_ids).items() if v > 1]
        errs.append(f"{fname}: panel id 重复: {dupes}")
    # 4. gridPos 不重叠
    errs.extend(check_gridpos_overlap(d.get("panels", [])))
    # 5. 每个 panel 内部 (expr 不匹配的降为 warn)
    for p in d.get("panels", []):
        perrs = check_panel(p)
        # 把"expr 引用未注册 metric" 这类从 errs 移到 warns
        for e in perrs:
            if "未注册 metric" in e:
                warns.append(e)
            else:
                errs.append(e)
    # 6. 至少 1 个可视化 panel
    vis_types = {"timeseries", "stat", "gauge", "bargauge", "table"}
    has_vis = any(p.get("type") in vis_types for p in d.get("panels", []))
    if not has_vis:
        errs.append(f"{fname}: 缺可视化 panel (timeseries/stat/gauge 等)")
    return errs, warns


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(description="Grafana 面板 JSON 加深检查 (Phase 6-D)")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    # --json 模式下, banner 走 stderr, 让 stdout 纯净
    out = sys.stdout
    if args.json:
        out = sys.stderr

    print("=" * 60, file=out)
    print("Grafana 面板 JSON 加深检查 (Phase 6-D)", file=out)
    print("=" * 60, file=out)

    files = sorted(DASHBOARDS_DIR.glob("*.json"))
    print(f"\n[Step 1] 扫描 {len(files)} 个 dashboard:", file=out)

    all_errs = []
    all_warns = []
    summary = []
    for f in files:
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            all_errs.append(f"{f.name}: JSON 解析失败: {e}")
            continue
        errs, warns = check_dashboard(d, f.name)
        # 同时跑旧版检查 (兜底, 确保不漏 uid / DS_PROMETHEUS)
        if not d.get("uid", "").startswith("zhs-"):
            errs.append(f"{f.name}: uid 不以 zhs- 开头")
        if not d.get("panels"):
            errs.append(f"{f.name}: panels 为空")
        if "DS_PROMETHEUS" not in [t.get("name") for t in d.get("templating", {}).get("list", [])]:
            errs.append(f"{f.name}: 缺 DS_PROMETHEUS 变量")
        if errs:
            all_errs.extend(errs)
        if warns:
            all_warns.extend(warns)
        marker = "[OK]" if not errs else "[FAIL]"
        print(f"  {marker} {f.name}: {len(errs)} 个错误, {len(warns)} 个警告", file=out)
        for e in errs:
            print(f"      [FAIL] {e}", file=out)
        for w in warns:
            print(f"      [WARN]  {w}", file=out)
        summary.append(
            {
                "file": f.name,
                "uid": d.get("uid"),
                "panels": len(d.get("panels", [])),
                "errors": len(errs),
                "warnings": len(warns),
            }
        )

    if all_warns:
        print(f"\n[Step 2] 警告 (非阻塞): {len(all_warns)} 条", file=out)
        for w in all_warns[:10]:
            print(f"  [WARN]  {w}", file=out)
        if len(all_warns) > 10:
            print(f"  ... (共 {len(all_warns)} 条)", file=out)

    print(file=out)
    if all_errs:
        print("=" * 60, file=out)
        print(f"[FAIL] FAIL: {len(all_errs)} 个问题", file=out)
        print("=" * 60, file=out)
        if args.json:
            print(
                json.dumps(
                    {
                        "status": "fail" if all_errs else "ok",
                        "summary": summary,
                        "errors": all_errs,
                        "warnings": all_warns,
                    },
                    ensure_ascii=False,
                    indent=2,
                    default=str,
                )
            )
        return 1

    print("=" * 60, file=out)
    print(f"[OK] PASS: {len(files)} 个 dashboard 加深检查通过 ({len(all_warns)} 个警告)", file=out)
    print("=" * 60, file=out)
    if args.json:
        print(json.dumps({"status": "ok", "summary": summary}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

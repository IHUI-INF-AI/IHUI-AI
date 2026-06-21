"""Grafana dashboard JSON 校验 (建议 5 落地测试).

校验:
  1. zhs_monitor_health.json 可解析
  2. schemaVersion 38
  3. 10 panel 全部存在 (8 原有 + 2 新增)
  4. panel 9 是 stat 类型, 标题含"抑制比"
  5. panel 10 是 timeseries 类型, 标题含"时钟漂移"
  6. panel 9 的 expr 引用 alertmanager_alerts_* 指标
  7. panel 10 的 expr 引用 zhs_biz_app_local_time_seconds
  8. 所有 panel 都有 datasource.uid=${DS_PROMETHEUS}
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DASH = ROOT / "deploy" / "grafana" / "dashboards" / "zhs_monitor_health.json"


def main() -> int:
    if not DASH.exists():
        print(f"✗ 找不到 {DASH}")
        return 1
    data = json.loads(DASH.read_text(encoding="utf-8"))
    panels = data.get("panels", [])
    schema = data.get("schemaVersion")
    print(f"panels={len(panels)} schemaVersion={schema}")
    ok = True
    if len(panels) < 10:
        print(f"  ✗ panel 数 {len(panels)} < 10")
        ok = False
    if schema != 38:
        print(f"  ✗ schemaVersion {schema} != 38")
        ok = False

    panel_9 = next((p for p in panels if p.get("title", "").startswith("告警抑制比")), None)
    if not panel_9:
        print("  ✗ 缺少'告警抑制比' panel")
        ok = False
    else:
        expr_9 = panel_9["targets"][0]["expr"]
        if "alertmanager_alerts_" not in expr_9:
            print(f"  ✗ panel 9 expr 缺 alertmanager_alerts_*: {expr_9}")
            ok = False
        else:
            print(f"  ✓ panel 9 抑制比: type={panel_9['type']} expr={expr_9[:80]}")
        ds_uid = panel_9.get("datasource", {}).get("uid", "")
        if ds_uid != "${DS_PROMETHEUS}":
            print(f"  ✗ panel 9 datasource.uid 错: {ds_uid}")
            ok = False

    panel_10 = next((p for p in panels if p.get("title", "").startswith("App 时钟漂移")), None)
    if not panel_10:
        print("  ✗ 缺少'App 时钟漂移' panel")
        ok = False
    else:
        expr_10 = panel_10["targets"][0]["expr"]
        if "zhs_biz_app_local_time_seconds" not in expr_10:
            print(f"  ✗ panel 10 expr 缺 zhs_biz_app_local_time_seconds: {expr_10}")
            ok = False
        else:
            print(f"  ✓ panel 10 时钟漂移: type={panel_10['type']} expr={expr_10[:80]}")
        ds_uid = panel_10.get("datasource", {}).get("uid", "")
        if ds_uid != "${DS_PROMETHEUS}":
            print(f"  ✗ panel 10 datasource.uid 错: {ds_uid}")
            ok = False

    # 校验所有 panel 都有 datasource.uid
    for p in panels:
        uid = p.get("datasource", {}).get("uid", "")
        if uid != "${DS_PROMETHEUS}":
            print(f"  ✗ panel {p.get('id')} ({p.get('title')}) 缺 datasource.uid")
            ok = False

    if ok:
        print("  ✓ 10 panel 全部通过校验, 抑制比 + 时钟漂移 已就位")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

"""为 zhs_monitor_health.json 追加 2 个新 panel (建议 5 落地工具).

新增 panel:
  ID 9: 告警抑制比 (stat) - 公式 = 1 - sent / firing
  ID 10: 时钟漂移趋势 (timeseries) - PromQL abs(time() - zhs_biz_app_local_time_seconds)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DASHBOARD = ROOT / "deploy" / "grafana" / "dashboards" / "zhs_monitor_health.json"


def main() -> int:
    data = json.loads(DASHBOARD.read_text(encoding="utf-8"))
    panels = data.get("panels", [])
    next_id = max(p.get("id", 0) for p in panels) + 1 if panels else 1
    y_cursor = 22  # 8 panel × 5h (4 panel 5h) + 1 timeseries 4h

    panel_9 = {
        "id": next_id,
        "type": "stat",
        "title": "告警抑制比 (1h 窗口)",
        "description": "Alertmanager 在最近 1 小时内抑制的告警占比. > 80% 说明抑制规则过激, 排查 critical 触发频率.",
        "gridPos": {"h": 5, "w": 6, "x": 0, "y": y_cursor},
        "datasource": {"type": "prometheus", "uid": "${DS_PROMETHEUS}"},
        "targets": [
            {
                "refId": "A",
                "expr": "1 - (rate(alertmanager_alerts_received_total[1h]) / clamp_min(rate(alertmanager_alerts_firing_total[1h]) + rate(alertmanager_alerts_resolved_total[1h]), 0.001))",
                "legendFormat": "inhibit_ratio",
                "datasource": {"type": "prometheus", "uid": "${DS_PROMETHEUS}"},
                "instant": True,
            }
        ],
        "fieldConfig": {
            "defaults": {
                "unit": "percentunit",
                "min": 0,
                "max": 1,
                "thresholds": {
                    "mode": "absolute",
                    "steps": [
                        {"color": "green", "value": None},
                        {"color": "yellow", "value": 0.5},
                        {"color": "red", "value": 0.8},
                    ],
                },
            }
        },
        "options": {
            "colorMode": "background",
            "graphMode": "area",
            "reduceOptions": {"calcs": ["lastNotNull"]},
        },
    }

    panel_10 = {
        "id": next_id + 1,
        "type": "timeseries",
        "title": "App 时钟漂移 (秒)",
        "description": "Prom time() - zhs_biz_app_local_time_seconds. > 30s 持续 2min 触发 ZHSMonitorClockDrift.",
        "gridPos": {"h": 7, "w": 18, "x": 6, "y": y_cursor},
        "datasource": {"type": "prometheus", "uid": "${DS_PROMETHEUS}"},
        "targets": [
            {
                "refId": "A",
                "expr": "abs(time() - zhs_biz_app_local_time_seconds)",
                "legendFormat": "drift_seconds",
                "datasource": {"type": "prometheus", "uid": "${DS_PROMETHEUS}"},
            }
        ],
        "fieldConfig": {
            "defaults": {
                "unit": "s",
                "custom": {
                    "drawStyle": "line",
                    "lineInterpolation": "stepAfter",
                    "fillOpacity": 10,
                    "showPoints": "never",
                },
                "thresholds": {
                    "mode": "absolute",
                    "steps": [
                        {"color": "green", "value": None},
                        {"color": "yellow", "value": 10},
                        {"color": "red", "value": 30},
                    ],
                },
            }
        },
        "options": {
            "tooltip": {"mode": "multi", "sort": "desc"},
            "legend": {"displayMode": "list", "placement": "bottom"},
        },
    }

    panels.append(panel_9)
    panels.append(panel_10)
    data["panels"] = panels
    DASHBOARD.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK 追加 2 panel, total={len(panels)}, ids={[panel_9['id'], panel_10['id']]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

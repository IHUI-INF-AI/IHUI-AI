"""把 CI 演练结果回写到 Grafana Annotations (建议 5).

Grafana 9+ 提供 HTTP API:
  POST /api/annotations
  Body: { time, timeEnd, tags, text, dashboardId, panelId, data }

Phase 9 建议 4 增强:
  1. 每次演练生成 Incident-<date>-<short_hash> 唯一短链 ID
  2. 每个 annotation 跳板到 runbook URL (按 job 映射不同)
  3. text 含 incident_id + runbook + related dashboards + 跳转 hint
  4. 失败 job 自动关联到抑制工单或告警面板

演练结束后调用, 把 5 个 job 的结果写到 zhs-monitor-health dashboard
的 4 个 panel 上, 方便事后追溯.

用法:
  python scripts/ops/push_drill_annotations.py \
    --grafana-url https://grafana.zhs.top \
    --token glsa_xxx \
    --date 20260616 \
    --run-id 12345 \
    --results '{"check-alert-rules":"success","canary-bridge-drill":"failure",...}'
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent.parent


PANEL_MAP = {
    # job → panel_id 映射 (在 zhs-monitor-health dashboard 里)
    "check-alert-rules": 9,  # 告警抑制比
    "clock-drift-tests": 10,  # 时钟漂移
    "canary-bridge-drill": 1,  # 监听器运行状态
    "dingtalk-webhook": 9,
    "dashboard-screenshots": 9,
}

DASHBOARD_UID = "zhs-monitor-health"

# Phase 9 建议 4: runbook 跳板 - 按 job 映射到不同 runbook 路径
# 在 wiki.zhs.top/runbook/<job> 维护各 job 的应急手册
RUNBOOK_BASE = "https://wiki.zhs.top/runbook"
RUNBOOK_MAP = {
    "check-alert-rules": "phase8/alert-rules-normalize",
    "clock-drift-tests": "phase8/clock-drift",
    "canary-bridge-drill": "phase8/canary-bridge",
    "dingtalk-webhook": "phase8/dingtalk-webhook",
    "dashboard-screenshots": "phase8/dashboard-render",
}

# 失败时跳板到的工单系统 / 告警面板
TICKET_BASE = "https://jira.zhs.top/browse"
INCIDENT_BASE = "https://status.zhs.top/incidents"


def make_incident_id(date: str, run_id: str) -> str:
    """生成 Incident-<date>-<short_hash> 唯一短链.

    hash 基于 date + run_id + 演练名, 6 字符足够, 概率碰撞 1/16M.
    """
    seed = f"phase8-drill:{date}:{run_id}".encode()
    short = hashlib.sha1(seed).hexdigest()[:6].upper()
    return f"INC-{date}-{short}"


def build_runbook_url(job: str) -> str:
    """构造 runbook 跳板 URL."""
    path = RUNBOOK_MAP.get(job, "phase8/general")
    return f"{RUNBOOK_BASE}/{path}"


def build_ticket_url(incident_id: str) -> str:
    """工单跳板 URL - 失败时一键开单."""
    return f"{TICKET_BASE}/ZHS-{incident_id}"


def build_status_url(incident_id: str) -> str:
    """status page 公开页面 - 业务方查可见性."""
    return f"{INCIDENT_BASE}/{incident_id}"


def build_annotations(
    date: str,
    results: dict,
    run_url: str,
    run_id: str = "",
) -> list[dict]:
    """构造 annotations 列表 (含 incident 短链 + runbook 跳板)."""
    out = []
    now_ms = int(time.time() * 1000)
    success_count = sum(1 for v in results.values() if v == "success")
    total = len(results)
    incident_id = make_incident_id(date, run_id or date)
    summary = f"Phase 8 周演练 {date} ({success_count}/{total} 通过)"

    # 跳板 URL 集合 (供各 annotation 引用)
    incident_url = build_status_url(incident_id)
    ticket_url = build_ticket_url(incident_id)

    for job, status in results.items():
        is_fail = status != "success"
        panel_id = PANEL_MAP.get(job, 9)
        runbook = build_runbook_url(job)
        text_lines = [
            f"### {job}",
            f"**Incident**: `{incident_id}`",
            f"**状态**: {status}",
            f"**日期**: {date}",
            f"**汇总**: {summary}",
            f"**详情**: [GitHub Actions Run]({run_url})",
            f"**Runbook**: [{job}]({runbook})",
            f"**Status Page**: [公开可见性]({incident_url})",
        ]
        # 失败时附 ticket / 抑制工单 跳板
        if is_fail:
            text_lines.append(f"**开单**: [新建工单]({ticket_url})")
            text_lines.append(
                f"**抑制工单**: [logs/inhibit_tickets/{date}.md]" f"(file://{ROOT}/logs/inhibit_tickets/{date}.md)"
            )
        # data 字段存结构化 (供 Grafana 跳转变量)
        data = {
            "incident_id": incident_id,
            "job": job,
            "status": status,
            "date": date,
            "run_id": run_id,
            "run_url": run_url,
            "runbook_url": runbook,
            "ticket_url": ticket_url if is_fail else "",
        }
        out.append(
            {
                "dashboardUID": DASHBOARD_UID,
                "panelId": panel_id,
                "time": now_ms,
                "timeEnd": now_ms,
                "tags": ["phase8-drill", job, status, f"incident:{incident_id}"],
                "text": "\n".join(text_lines),
                "data": data,
            }
        )

    # 总览 annotation - 跨 panel 跳板
    out.insert(
        0,
        {
            "dashboardUID": DASHBOARD_UID,
            "time": now_ms,
            "timeEnd": now_ms,
            "tags": [
                "phase8-drill",
                "summary",
                "success" if success_count == total else "partial",
                f"incident:{incident_id}",
            ],
            "text": (
                f"## {summary}\n\n"
                f"**Incident**: `{incident_id}`\n"
                f"**Status Page**: [公开链接]({incident_url})\n"
                f"**Run URL**: [GitHub Actions]({run_url})\n"
                f"**汇总**: {success_count}/{total} job 通过\n"
                f"**Runbook 索引**: [所有 phase8 runbook]({RUNBOOK_BASE}/phase8)"
            ),
            "data": {
                "incident_id": incident_id,
                "date": date,
                "summary": summary,
                "success_count": success_count,
                "total": total,
            },
        },
    )
    return out


def push(grafana_url: str, token: str, annotations: list[dict]) -> int:
    """推 annotations 到 Grafana. 失败 1 个不算整体失败."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    success = 0
    for a in annotations:
        try:
            r = requests.post(
                f"{grafana_url}/api/annotations",
                json=a,
                headers=headers,
                timeout=10,
            )
            if r.status_code in (200, 201):
                success += 1
                ann_id = ""
                try:
                    ann_id = r.json().get("id", "")
                except Exception:
                    pass
                tag = a.get("tags", ["?"])[1] if len(a.get("tags", [])) > 1 else "?"
                print(f"  [OK]   {tag:<25} → annotation_id={ann_id}")
            else:
                print(f"  [WARN] {a.get('tags', ['?'])[1]}: {r.status_code} {r.text[:100]}")
        except Exception as e:
            print(f"  [ERR] {a.get('tags', ['?'])[1]}: {e}")
    print(f"[push] {success}/{len(annotations)} annotations OK")
    return 0 if success == len(annotations) else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="CI 演练结果回写 Grafana Annotations")
    parser.add_argument("--grafana-url", required=True, help="Grafana URL")
    parser.add_argument("--token", help="Grafana API token (留空用 GRAFANA_TOKEN env)")
    parser.add_argument("--date", required=True, help="演练日期 YYYYMMDD")
    parser.add_argument("--run-id", default="", help="GitHub Actions run id (用于 incident 短链)")
    parser.add_argument("--results", help="JSON 字符串 {job: status}")
    parser.add_argument("--report", help="drill_report.md 路径 (自动解析结果)")
    parser.add_argument("--run-url", help="GitHub Actions run URL (默认组装)")
    parser.add_argument("--dry-run", action="store_true", help="只打印不推送")
    args = parser.parse_args()

    if args.results:
        results = json.loads(args.results)
    elif args.report:
        # 解析 drill_report.md, 找 "- jobname: status" 行
        text = Path(args.report).read_text(encoding="utf-8")
        results = {}
        for line in text.splitlines():
            if line.strip().startswith("- "):
                parts = line.strip()[2:].split(":", 1)
                if len(parts) == 2:
                    results[parts[0].strip()] = parts[1].strip()
    else:
        print("✗ 必须指定 --results 或 --report")
        return 2

    if not results:
        print("✗ 未解析到任何 job 结果")
        return 2

    run_url = args.run_url or f"https://github.com/zhs-platform/actions/runs/{args.date}"
    annotations = build_annotations(args.date, results, run_url, args.run_id)
    incident_id = make_incident_id(args.date, args.run_id or args.date)
    print(f"[build] {len(annotations)} annotations")
    print(f"        incident_id: {incident_id}")
    print(f"        jobs: {list(results.keys())}")
    if args.dry_run:
        for a in annotations[:3]:
            print(f"  - tags={a['tags']} text={a['text'][:120]}")
        print(f"  ... ({len(annotations)} total)")
        return 0

    token = args.token or ""
    if not token:
        print("✗ 缺 --token")
        return 2
    return push(args.grafana_url, token, annotations)


if __name__ == "__main__":
    sys.exit(main())

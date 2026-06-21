"""Prometheus Alertmanager -> 8 通道端到端演练.

流程:
1. 构造 Alertmanager v4 格式 webhook payload (1 firing + 1 resolved 告警)
2. POST 到后端 /api/v1/monitor/alerts/webhook
3. 后端 alertmanager_webhook handler:
   - 应用抑制规则
   - 对每条 firing 告警调 push_alert() 推 8 通道
4. 验证 mock receiver 收到 8 通道的请求

输出: 8 通道端到端 JSON 报告
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

SERVER_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_ROOT))

BACKEND = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000")
WEBHOOK_URL = f"{BACKEND}/api/v1/monitor/alerts/webhook"


def build_alertmanager_payload() -> dict:
    """构造符合 Alertmanager v4 webhook 格式的 payload.

    1 条 firing critical 告警 (PostgreSQLDown) + 1 条 resolved info 告警.
    """
    return {
        "version": "4",
        "groupKey": "{}:{alertname=\"PostgreSQLDown\"}",
        "status": "firing",
        "receiver": "zhs-platform-webhook",
        "groupLabels": {"alertname": "PostgreSQLDown"},
        "commonLabels": {
            "alertname": "PostgreSQLDown",
            "severity": "critical",
            "service": "postgresql",
            "instance": "pg-primary.zhs.svc.cluster.local:5432",
        },
        "commonAnnotations": {
            "summary": "PostgreSQL primary instance is down",
            "description": "pg-primary has been unreachable for 5+ minutes. Failover may be in progress.",
        },
        "externalURL": "http://alertmanager.zhs.svc.cluster.local:9093",
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "PostgreSQLDown",
                    "severity": "critical",
                    "service": "postgresql",
                    "instance": "pg-primary.zhs.svc.cluster.local:5432",
                },
                "annotations": {
                    "summary": "PostgreSQL primary instance is down",
                    "description": "pg-primary has been unreachable for 5+ minutes",
                },
                "startsAt": datetime.now(timezone.utc).isoformat(),
                "endsAt": "0001-01-01T00:00:00Z",
                "generatorURL": "http://prometheus.zhs.svc/graph?g0.expr=up%3D%3D0",
                "fingerprint": "abc123def456",
            },
            {
                "status": "resolved",
                "labels": {
                    "alertname": "HighCPUUsage",
                    "severity": "warning",
                    "service": "api-gateway",
                    "instance": "api-gateway-7d8b9.zhs.svc:8080",
                },
                "annotations": {
                    "summary": "API gateway CPU usage returned to normal",
                    "description": "CPU usage dropped below 70% threshold",
                },
                "startsAt": "2026-06-18T03:00:00Z",
                "endsAt": datetime.now(timezone.utc).isoformat(),
                "generatorURL": "http://prometheus.zhs.svc/graph?g0.expr=rate(cpu)",
                "fingerprint": "xyz789ghi012",
            },
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="logs/prom_alert_e2e.json")
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()

    print(f"[e2e] 目标后端: {BACKEND}")
    print(f"[e2e] webhook URL: {WEBHOOK_URL}")

    # 演练前: 记录 mock receiver 各 channel jsonl 行数
    mock_log_dir = SERVER_ROOT / "logs" / "mock_webhook"
    channels = ["dingtalk", "wechat_work", "feishu", "email", "pagerduty", "slack", "teams", "generic"]
    before_counts = {}
    for ch in channels:
        log_file = mock_log_dir / f"{ch}.jsonl"
        before_counts[ch] = sum(1 for _ in log_file.open(encoding="utf-8")) if log_file.exists() else 0
    print(f"[e2e] 演练前 mock receiver 计数: {before_counts}")

    payload = build_alertmanager_payload()
    print(f"[e2e] payload: {len(payload['alerts'])} alerts (1 firing critical + 1 resolved warning)")

    t0 = time.perf_counter()
    try:
        with httpx.Client(timeout=args.timeout) as client:
            resp = client.post(WEBHOOK_URL, json=payload)
        duration = time.perf_counter() - t0
    except Exception as e:
        print(f"[e2e] FAIL: {e}")
        return 1

    print(f"[e2e] HTTP {resp.status_code} ({duration:.2f}s)")
    print(f"[e2e] 响应: {resp.text[:500]}")

    if resp.status_code != 200:
        print(f"[e2e] FAIL: 后端返回非 200")
        return 1

    try:
        body = resp.json()
    except Exception as e:
        print(f"[e2e] FAIL: 响应 JSON 解析失败: {e}")
        return 1

    data = body.get("data", body)
    received = data.get("received", 0)
    firing = data.get("firing", 0)
    pushed = data.get("pushed", 0)
    suppressed = data.get("suppressed", 0)

    print(f"\n[e2e] 后端 webhook 处理汇总:")
    print(f"  received={received}, firing={firing}, pushed={pushed}, suppressed={suppressed}")

    if firing == 0:
        print(f"[e2e] FAIL: 没有 firing 告警, 后端未处理")
        return 1

    if pushed == 0:
        print(f"[e2e] FAIL: 后端没推送任何告警, 抑制规则可能误杀")
        return 1

    # 演练后: 等待 mock receiver 写入 + 重新统计
    time.sleep(1.0)
    after_counts = {}
    for ch in channels:
        log_file = mock_log_dir / f"{ch}.jsonl"
        after_counts[ch] = sum(1 for _ in log_file.open(encoding="utf-8")) if log_file.exists() else 0
    print(f"[e2e] 演练后 mock receiver 计数: {after_counts}")

    # 每个 firing 告警应推到 8 通道, 计算每个 channel 增量
    deltas = {ch: after_counts[ch] - before_counts[ch] for ch in channels}
    print(f"\n[e2e] 8 通道增量:")
    for ch, d in deltas.items():
        marker = "OK  " if d > 0 else "MISS"
        print(f"  [{marker}] {ch:12s}  delta={d}")

    # 验证 8 通道都收到 (delta > 0)
    missing = [ch for ch, d in deltas.items() if d == 0]
    if missing:
        print(f"\n[e2e] FAIL: {len(missing)} 通道未收到请求: {missing}")
        result = "FAIL"
    else:
        print(f"\n[e2e] 8 通道全部收到端到端告警")
        result = "PASS"

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": round(duration, 2),
        "webhook_url": WEBHOOK_URL,
        "payload_alerts": len(payload["alerts"]),
        "backend_response": {
            "status_code": resp.status_code,
            "received": received,
            "firing": firing,
            "pushed": pushed,
            "suppressed": suppressed,
            "dry_run": data.get("dry_run", False),
        },
        "channel_deltas": deltas,
        "channel_total_received": after_counts,
        "result": result,
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[e2e] 报告: {out_path}")
    print(f"[e2e] 结论: {result}")

    return 0 if result == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())

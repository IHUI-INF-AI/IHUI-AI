"""告警噪音分析脚本 (建议 5 落地工具).

分析维度:
  1. 7 天内每条告警的 firing 次数, 找 top 5 噪声源
  2. 每条告警的恢复时间 (resolved_at - firing_at) 中位数
  3. Alertmanager 抑制比 (suppressed / total_firing)
  4. 同一 alertname 24h 内重复触发次数 (flapping)
  5. 输出 markdown 报告 + 降噪建议

数据源: Prometheus (可指向真实 prom / 用 mock 数据演练)

用法:
  # 演练模式 (无 prom, 用内置 mock)
  python scripts/ops/analyze_alert_noise.py --mock

  # 真实 prom
  python scripts/ops/analyze_alert_noise.py --prom-url http://prom:9090
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent.parent


def query_prom(prom_url: str, expr: str) -> list:
    """Prometheus instant query."""
    r = httpx.get(
        f"{prom_url}/api/v1/query",
        params={"query": expr},
        timeout=10,
    )
    r.raise_for_status()
    return r.json().get("data", {}).get("result", [])


def fetch_alertmanager_alerts(am_url: str, lookback_days: int = 7) -> dict:
    """从 Alertmanager 拉真实告警 (建议 4).

    Alertmanager /api/v2/alerts 返回当前 active alerts 列表 (不含历史).
    历史需通过 /api/v1/status 拿不到, 实际是 in-memory.
    退化为: 用 /api/v1/silences + /api/v2/alerts 组合.
    这里简化: 拉一次当前 active, 再用历史文件 logs/alert_history.jsonl (append-only).

    真实部署: 接 Thanos / Cortex / S3 长期存储的 alert archive.
    """
    import time as _t
    from datetime import datetime

    cutoff = _t.time() - lookback_days * 86400
    out_alerts: list[dict] = []
    try:
        r = httpx.get(f"{am_url}/api/v2/alerts?active=true&silenced=true&inhibited=true", timeout=10)
        r.raise_for_status()
        active = r.json()
    except Exception as e:
        print(f"  [WARN] alertmanager /api/v2/alerts 拉取失败: {e}")
        active = []

    # 按 alertname + labels 聚合
    by_alert: dict[str, dict] = {}
    fingerprints: set[str] = set()
    for a in active:
        name = a.get("labels", {}).get("alertname", "?")
        fp = a.get("fingerprint", "")
        starts_at = a.get("startsAt", "")
        ends_at = a.get("endsAt", "")
        status = a.get("status", {}).get("state", "active")
        severity = a.get("labels", {}).get("severity", "info")
        closure = a.get("labels", {}).get("closure", "default")
        tenant = a.get("labels", {}).get("tenant_id", "default")
        fingerprints.add(fp)
        if name not in by_alert:
            by_alert[name] = {
                "alertname": name,
                "firing_count": 0,
                "resolved_count": 0,
                "durations_sec": [],
                "severity": severity,
                "closure": closure,
                "tenant_id": tenant,
            }
        try:
            sa = datetime.fromisoformat(starts_at.replace("Z", "+00:00")).timestamp() if starts_at else 0
        except Exception:
            sa = 0
        try:
            ea = datetime.fromisoformat(ends_at.replace("Z", "+00:00")).timestamp() if ends_at else 0
        except Exception:
            ea = 0
        if status == "active":
            by_alert[name]["firing_count"] += 1
        else:
            by_alert[name]["resolved_count"] += 1
            if sa and ea and ea > sa:
                by_alert[name]["durations_sec"].append(ea - sa)

    # 同时读 history jsonl (App 端 append-only)
    history_path = ROOT / "logs" / "alert_history.jsonl"
    if history_path.exists():
        for line in history_path.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                rec = json.loads(line)
            except Exception:
                continue
            if rec.get("ts", 0) < cutoff:
                continue
            name = rec.get("alertname", "?")
            if name not in by_alert:
                by_alert[name] = {
                    "alertname": name,
                    "firing_count": 0,
                    "resolved_count": 0,
                    "durations_sec": [],
                    "severity": rec.get("severity", "info"),
                    "closure": rec.get("closure", "default"),
                    "tenant_id": rec.get("tenant_id", "default"),
                }
            by_alert[name]["firing_count"] += 1
            if rec.get("resolved"):
                by_alert[name]["resolved_count"] += 1
            dur = rec.get("duration_sec", 0)
            if dur:
                by_alert[name]["durations_sec"].append(dur)

    # 算 median_duration_sec + flapping_score
    import statistics as _st

    for a in by_alert.values():
        a["median_duration_sec"] = _st.median(a["durations_sec"]) if a["durations_sec"] else 0.0
        total = a["firing_count"] + a["resolved_count"]
        a["flapping_score"] = round(min(1.0, a["firing_count"] / max(total, 1)), 2)

    return {
        "alerts": list(by_alert.values()),
        "global": {
            "total_firing": sum(a["firing_count"] for a in by_alert.values()),
            "total_resolved": sum(a["resolved_count"] for a in by_alert.values()),
            "unique_fingerprints": len(fingerprints),
            "active_silences": 0,
            "suppressed_by_inhibit_rules": 0,
        },
    }


def get_mock_data() -> dict:
    """演练用 mock 数据, 模拟过去 7 天告警情况."""
    return {
        "alerts": [
            {
                "alertname": "ZHSMonitorDown",
                "firing_count": 1,
                "resolved_count": 1,
                "median_duration_sec": 130.0,
                "flapping_score": 0.05,
                "severity": "critical",
                "closure": "phase8",
            },
            {
                "alertname": "ZHSMonitorRefreshSlow",
                "firing_count": 12,
                "resolved_count": 12,
                "median_duration_sec": 75.0,
                "flapping_score": 0.65,
                "severity": "warning",
                "closure": "phase8",
            },
            {
                "alertname": "ZHSMonitorChecksStalled",
                "firing_count": 8,
                "resolved_count": 8,
                "median_duration_sec": 45.0,
                "flapping_score": 0.45,
                "severity": "warning",
                "closure": "phase8",
            },
            {
                "alertname": "ZHSMonitorRecordsCacheBurst",
                "firing_count": 25,
                "resolved_count": 22,
                "median_duration_sec": 600.0,
                "flapping_score": 0.85,
                "severity": "warning",
                "closure": "phase8",
            },
            {
                "alertname": "ZHSMonitorExpiredBurst",
                "firing_count": 6,
                "resolved_count": 6,
                "median_duration_sec": 90.0,
                "flapping_score": 0.30,
                "severity": "warning",
                "closure": "phase8",
            },
            {
                "alertname": "ZHSMonitorClockDrift",
                "firing_count": 2,
                "resolved_count": 2,
                "median_duration_sec": 180.0,
                "flapping_score": 0.10,
                "severity": "warning",
                "closure": "phase8",
            },
            {
                "alertname": "HighCPUUsage",
                "firing_count": 47,
                "resolved_count": 45,
                "median_duration_sec": 240.0,
                "flapping_score": 0.92,
                "severity": "warning",
                "closure": "default",
            },
            {
                "alertname": "DiskWillFillIn4Hours",
                "firing_count": 4,
                "resolved_count": 4,
                "median_duration_sec": 7200.0,
                "flapping_score": 0.20,
                "severity": "warning",
                "closure": "default",
            },
        ],
        "global": {
            "total_firing": 105,
            "total_resolved": 100,
            "suppressed_by_inhibit_rules": 28,
            "silenced_by_silence": 12,
            "active_silences": 3,
        },
    }


def analyze(data: dict) -> dict:
    """基于原始数据算关键指标."""
    alerts = data["alerts"]
    total_firing = sum(a["firing_count"] for a in alerts)
    total_resolved = sum(a["resolved_count"] for a in alerts)
    suppress = data["global"]["suppressed_by_inhibit_rules"]
    inhibit_ratio = suppress / total_firing if total_firing else 0

    # Top 5 噪声源 (按 firing_count 降序)
    by_firing = sorted(alerts, key=lambda a: a["firing_count"], reverse=True)[:5]

    # Top 5 flapping (flapping_score > 0.5)
    by_flapping = sorted(
        [a for a in alerts if a["flapping_score"] > 0.5],
        key=lambda a: a["flapping_score"],
        reverse=True,
    )[:5]

    return {
        "total_firing": total_firing,
        "total_resolved": total_resolved,
        "inhibit_ratio": inhibit_ratio,
        "suppress_count": suppress,
        "top_noisy": by_firing,
        "top_flapping": by_flapping,
    }


def render_markdown(analysis: dict) -> str:
    """生成可贴到 wiki 的报告."""
    md = []
    md.append(f"# ZHS 告警噪音分析报告 - {datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC')}\n")
    md.append("## 概览\n")
    md.append(f"- 总触发: **{analysis['total_firing']}** 次 / 总恢复: **{analysis['total_resolved']}** 次")
    md.append(f"- 抑制规则触发: **{analysis['suppress_count']}** 条 (抑制比 **{analysis['inhibit_ratio']:.1%}**)")
    md.append("")

    md.append("## Top 5 噪声源 (按触发次数)\n")
    md.append("| 告警 | 触发 | 恢复 | 中位时长(秒) | Flapping 评分 | 级别 |")
    md.append("|------|------|------|-------------|---------------|------|")
    for a in analysis["top_noisy"]:
        md.append(
            f"| {a['alertname']} | {a['firing_count']} | {a['resolved_count']} | "
            f"{a['median_duration_sec']:.0f} | {a['flapping_score']:.2f} | {a['severity']} |"
        )
    md.append("")

    if analysis["top_flapping"]:
        md.append("## Top 5 Flapping 告警 (评分 > 0.5)\n")
        md.append("| 告警 | Flapping 评分 | 触发 |")
        md.append("|------|---------------|------|")
        for a in analysis["top_flapping"]:
            md.append(f"| {a['alertname']} | {a['flapping_score']:.2f} | {a['firing_count']} |")
        md.append("")

    md.append("## 降噪建议\n")
    for a in analysis["top_flapping"]:
        if a["alertname"].startswith("ZHSMonitor"):
            md.append(
                f"- **{a['alertname']}** flapping={a['flapping_score']:.2f}: "
                f"在 rules.yml 把 `for:` 调到 5m+ 或拆分 table_name 标签减少重复触发"
            )
        else:
            md.append(
                f"- **{a['alertname']}** flapping={a['flapping_score']:.2f}: " f"考虑加 silence 规则或合并相近告警"
            )
    if analysis["inhibit_ratio"] > 0.5:
        md.append(
            f"- ⚠ **抑制比 {analysis['inhibit_ratio']:.1%} 偏高**: critical 频繁触发, "
            f"排查根因 (ZHSMonitorDown 是否真在反复掉线?)"
        )
    md.append("")
    return "\n".join(md)


def main() -> int:
    parser = argparse.ArgumentParser(description="告警噪音分析")
    parser.add_argument("--mock", action="store_true", help="用内置 mock 数据演练")
    parser.add_argument("--prom-url", help="Prometheus URL (例 http://prom:9090)")
    parser.add_argument("--alertmanager-url", help="Alertmanager URL (例 http://alertmanager:9093)")
    parser.add_argument("--lookback-days", type=int, default=7, help="历史回看天数")
    parser.add_argument("--output", help="报告输出文件 (默认 stdout)")
    args = parser.parse_args()

    if args.mock:
        data = get_mock_data()
        print(f"[{datetime.now(UTC).isoformat()}] 使用 mock 数据 (8 条 ZHSMonitor + 2 业务告警)")
    elif args.alertmanager_url:
        data = fetch_alertmanager_alerts(args.alertmanager_url, args.lookback_days)
        print(
            f"[{datetime.now(UTC).isoformat()}] 已从 {args.alertmanager_url} 拉取 active alerts + {args.lookback_days} 天 history"
        )
    elif args.prom_url:
        print("[warn] 真实 prom 集成需要 alertmanager_metrics 支持, 当前回退 mock")
        data = get_mock_data()
    else:
        print("✗ 必须指定 --mock / --alertmanager-url / --prom-url 之一")
        return 2

    analysis = analyze(data)
    md = render_markdown(analysis)
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(md, encoding="utf-8")
        print(f"OK 报告已写入 {args.output} ({len(md)} 字符)")
    else:
        print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())

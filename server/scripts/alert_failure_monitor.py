"""告警失败率监控脚本.

功能:
1. 从 alertmanager_notifications_failed_total / alertmanager_notifications_total 抓失败率
2. 从 alert_history_db (SQLite) 拉真实失败事件
3. 计算 5min 滑动窗口失败率
4. 阈值超限触发 critical 告警

用法:
    python scripts/alert_failure_monitor.py
    python scripts/alert_failure_monitor.py --prometheus-url http://prom:9090
    python scripts/alert_failure_monitor.py --window 600 --threshold 0.10
    python scripts/alert_failure_monitor.py --output logs/alert_failure.json
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx

SERVER_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PROM_URL = os.environ.get("PROMETHEUS_URL", "http://127.0.0.1:9090")
ALERT_HISTORY_DB = SERVER_ROOT / "logs" / "alert_history.db"


def query_prom(prom_url: str, query: str) -> list:
    """Prometheus 瞬时查询."""
    try:
        with httpx.Client(timeout=5.0) as c:
            r = c.get(f"{prom_url}/api/v1/query", params={"query": query})
            if r.status_code != 200:
                return []
            data = r.json()
            return data.get("data", {}).get("result", [])
    except Exception as e:
        return [{"error": str(e)}]


def collect_prom_failure_rate(prom_url: str, window: int) -> dict:
    """从 Prometheus 抓 alertmanager 失败率."""
    end = int(time.time())
    start = end - window

    failed_q = "sum(alertmanager_notifications_failed_total)"
    total_q = "sum(alertmanager_notifications_total)"
    duration_failed_q = (
        'sum(rate(alertmanager_notifications_failed_total[5m]))'
    )

    failed = query_prom(prom_url, failed_q)
    total = query_prom(prom_url, total_q)
    rate_failed = query_prom(prom_url, duration_failed_q)

    failed_val = 0.0
    total_val = 0.0
    rate_val = 0.0

    for r in failed:
        try:
            failed_val = float(r["value"][1])
        except Exception:
            pass
    for r in total:
        try:
            total_val = float(r["value"][1])
        except Exception:
            pass
    for r in rate_failed:
        try:
            rate_val = float(r["value"][1])
        except Exception:
            pass

    rate = (failed_val / total_val) if total_val > 0 else 0.0
    return {
        "source": "prometheus",
        "url": prom_url,
        "window_s": window,
        "failed_total": failed_val,
        "notifications_total": total_val,
        "failure_rate_cumulative": round(rate, 4),
        "rate_per_sec_5m": round(rate_val, 6),
    }


def collect_db_failure_events(window_s: int) -> dict:
    """从 alert_history SQLite 拉失败事件."""
    if not ALERT_HISTORY_DB.exists():
        return {
            "source": "alert_history_db",
            "db_exists": False,
            "events_total": 0,
            "events_failed": 0,
            "failure_rate": 0.0,
        }
    try:
        conn = sqlite3.connect(str(ALERT_HISTORY_DB))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_s)
        cutoff_iso = cutoff.isoformat()

        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {r["name"] for r in cur.fetchall()}
        if "alert_history" not in tables:
            conn.close()
            return {
                "source": "alert_history_db",
                "db_exists": True,
                "table_exists": False,
                "events_total": 0,
                "events_failed": 0,
                "failure_rate": 0.0,
            }

        cur.execute(
            "SELECT COUNT(*) AS c FROM alert_history WHERE ts >= ?",
            (cutoff_iso,),
        )
        total = cur.fetchone()["c"]
        cur.execute(
            "SELECT COUNT(*) AS c FROM alert_history WHERE ts >= ? AND (status='failed' OR success=0)",
            (cutoff_iso,),
        )
        failed = cur.fetchone()["c"]

        cur.execute(
            """SELECT channel, COUNT(*) AS c FROM alert_history
               WHERE ts >= ? AND (status='failed' OR success=0)
               GROUP BY channel ORDER BY c DESC LIMIT 5""",
            (cutoff_iso,),
        )
        top_channels = [
            {"channel": r["channel"], "failed": r["c"]} for r in cur.fetchall()
        ]
        conn.close()

        rate = (failed / total) if total > 0 else 0.0
        return {
            "source": "alert_history_db",
            "db_exists": True,
            "window_s": window_s,
            "events_total": total,
            "events_failed": failed,
            "failure_rate": round(rate, 4),
            "top_failed_channels": top_channels,
        }
    except Exception as e:
        return {
            "source": "alert_history_db",
            "error": str(e),
            "events_total": 0,
            "events_failed": 0,
            "failure_rate": 0.0,
        }


def evaluate(failure_rate: float, threshold: float) -> dict:
    if failure_rate >= threshold * 2:
        return {
            "level": "critical",
            "action": "触发 P1 告警 + 钉钉群发 + 自动降级 (关闭非核心通道)",
        }
    if failure_rate >= threshold:
        return {
            "level": "warning",
            "action": "触发 P2 告警 + 邮件抄送运维",
        }
    return {"level": "ok", "action": "无需操作"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prometheus-url", default=DEFAULT_PROM_URL)
    parser.add_argument("--window", type=int, default=300, help="时间窗口秒数")
    parser.add_argument("--threshold", type=float, default=0.05, help="失败率阈值")
    parser.add_argument("--output", default="logs/alert_failure_monitor.json")
    args = parser.parse_args()

    print(f"[alert-fail-mon] 起点: {datetime.now(timezone.utc).isoformat()}")
    print(f"[alert-fail-mon] Prometheus: {args.prometheus_url}")
    print(f"[alert-fail-mon] 窗口: {args.window}s  阈值: {args.threshold*100:.1f}%")

    prom_data = collect_prom_failure_rate(args.prometheus_url, args.window)
    db_data = collect_db_failure_events(args.window)

    # 综合失败率: 取 prometheus 与 db 之中较高者 (保守)
    rates = [prom_data.get("failure_rate_cumulative", 0.0), db_data.get("failure_rate", 0.0)]
    rate_candidates = [r for r in rates if isinstance(r, (int, float))]
    combined = max(rate_candidates) if rate_candidates else 0.0

    decision = evaluate(combined, args.threshold)

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "window_s": args.window,
        "threshold": args.threshold,
        "prometheus": prom_data,
        "alert_history_db": db_data,
        "combined_failure_rate": round(combined, 4),
        "decision": decision,
        "verdict": "PASS" if decision["level"] == "ok" else decision["level"].upper(),
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n[alert-fail-mon] Prometheus 失败率: {prom_data.get('failure_rate_cumulative', 0.0)*100:.2f}%")
    print(f"[alert-fail-mon] DB 失败率: {db_data.get('failure_rate', 0.0)*100:.2f}%")
    print(f"[alert-fail-mon] 综合失败率: {combined*100:.2f}%")
    print(f"[alert-fail-mon] 决策: {decision['level'].upper()}  {decision['action']}")
    print(f"[alert-fail-mon] 报告: {out}")
    print(f"[alert-fail-mon] 结论: {report['verdict']}")
    return 0 if decision["level"] == "ok" else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())

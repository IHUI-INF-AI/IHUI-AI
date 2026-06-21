#!/usr/bin/env python3
"""金丝雀自动回滚 (Prometheus 指标驱动)

功能:
  - 监控 Prometheus 关键指标
  - 触发自动回滚阈值
  - 集成 canary_release.sh
  - 报告自动回滚事件

触发回滚的条件 (任一):
  1. 错误率上升 > 5% (error_rate > 0.05)
  2. P95 延迟 > 200ms 增加 > 50%
  3. QPS 下降 > 50% (qps_drop > 0.5)
  4. 5xx 错误数 > 10 / 分钟
  5. Pod 启动失败 (CrashLoopBackOff)

用法:
  # 启动监控 (后台)
  python scripts/canary_auto_rollback.py monitor --service zhs-app --version v1.2.3

  # 单次检查
  python scripts/canary_auto_rollback.py check --service zhs-app

  # 触发回滚 (手动)
  python scripts/canary_auto_rollback.py rollback --service zhs-app --reason "manual_test"

  # 列出回滚历史
  python scripts/canary_auto_rollback.py history
"""
import os
import re
import sys
import json
import time
import sqlite3
import argparse
import subprocess
import threading
from pathlib import Path
from datetime import datetime, timezone, timedelta
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = LOG_DIR / "canary_rollback.db"
HISTORY_FILE = LOG_DIR / "canary_rollback_history.json"

PROMETHEUS_URL = os.environ.get("PROMETHEUS_URL", "http://prometheus:9090")
CANARY_RELEASE_SH = SCRIPTS_DIR / "canary_release.sh"

# 触发回滚的阈值
THRESHOLDS = {
    "error_rate": 0.05,        # 错误率 > 5%
    "p95_latency_ms": 200,     # P95 延迟 > 200ms
    "p95_increase_pct": 50,    # P95 延迟增加 > 50%
    "qps_drop_pct": 50,        # QPS 下降 > 50%
    "http_5xx_per_min": 10,    # 5xx 错误 > 10/分钟
    "crash_loop_count": 3,     # CrashLoopBackOff > 3 个 pod
}


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    _init_schema(conn)
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS rollback_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            service TEXT NOT NULL,
            version TEXT,
            reason TEXT NOT NULL,
            triggered_by TEXT NOT NULL,
            details TEXT,
            status TEXT,
            duration_ms INTEGER,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_rollback_ts ON rollback_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_rollback_service ON rollback_events(service);
    """)
    conn.commit()


def query_prometheus(promql: str) -> list[dict]:
    """查询 Prometheus"""
    url = f"{PROMETHEUS_URL}/api/v1/query?query={promql}"
    try:
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") != "success":
                return []
            return data.get("data", {}).get("result", [])
    except (URLError, HTTPError, json.JSONDecodeError) as e:
        log(f"❌ Prometheus 查询失败: {e}")
        return []


def get_metric_value(promql: str) -> float:
    """获取单个指标值 (无结果时返回 0)"""
    results = query_prometheus(promql)
    if not results:
        return 0.0
    try:
        return float(results[0]["value"][1])
    except (KeyError, IndexError, ValueError):
        return 0.0


def collect_metrics(service: str) -> dict:
    """采集金丝雀所需指标"""
    metrics = {}

    # 1. 错误率
    metrics["error_rate"] = get_metric_value(
        f'sum(rate(http_requests_total{{service="{service}",status=~"5.."}}[5m])) / '
        f'sum(rate(http_requests_total{{service="{service}"}}[5m]))'
    )

    # 2. P95 延迟 (ms)
    metrics["p95_latency_ms"] = get_metric_value(
        f'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{{service="{service}"}}[5m])) by (le)) * 1000'
    )

    # 3. P95 延迟增加 (vs baseline)
    metrics["p95_latency_baseline_ms"] = get_metric_value(
        f'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{{service="{service}"}}[1h])) by (le)) * 1000'
    )
    if metrics["p95_latency_baseline_ms"] > 0:
        metrics["p95_increase_pct"] = (
            (metrics["p95_latency_ms"] - metrics["p95_latency_baseline_ms"])
            / metrics["p95_latency_baseline_ms"] * 100
        )
    else:
        metrics["p95_increase_pct"] = 0.0

    # 4. QPS
    metrics["current_qps"] = get_metric_value(
        f'sum(rate(http_requests_total{{service="{service}"}}[5m]))'
    )
    metrics["baseline_qps"] = get_metric_value(
        f'sum(rate(http_requests_total{{service="{service}"}}[1h]))'
    )
    if metrics["baseline_qps"] > 0:
        metrics["qps_drop_pct"] = max(0.0, (1 - metrics["current_qps"] / metrics["baseline_qps"]) * 100)
    else:
        metrics["qps_drop_pct"] = 0.0

    # 5. 5xx 错误数 (每分钟)
    metrics["http_5xx_per_min"] = get_metric_value(
        f'sum(increase(http_requests_total{{service="{service}",status=~"5.."}}[1m]))'
    )

    # 6. CrashLoopBackOff pod 数
    metrics["crash_loop_count"] = get_metric_value(
        f'count(kube_pod_container_status_waiting_reason{{reason="CrashLoopBackOff",namespace=~".*"}})'
    )

    return metrics


def evaluate_thresholds(metrics: dict) -> list[dict]:
    """评估是否触发回滚"""
    triggered = []

    if metrics["error_rate"] > THRESHOLDS["error_rate"]:
        triggered.append({
            "rule": "error_rate",
            "value": metrics["error_rate"],
            "threshold": THRESHOLDS["error_rate"],
            "message": f"错误率 {metrics['error_rate']:.2%} 超过阈值 {THRESHOLDS['error_rate']:.0%}",
        })

    if metrics["p95_latency_ms"] > THRESHOLDS["p95_latency_ms"] and metrics["p95_increase_pct"] > THRESHOLDS["p95_increase_pct"]:
        triggered.append({
            "rule": "p95_latency",
            "value": metrics["p95_latency_ms"],
            "threshold": THRESHOLDS["p95_latency_ms"],
            "message": f"P95 延迟 {metrics['p95_latency_ms']:.0f}ms 增加 {metrics['p95_increase_pct']:.1f}%",
        })

    if metrics["qps_drop_pct"] > THRESHOLDS["qps_drop_pct"]:
        triggered.append({
            "rule": "qps_drop",
            "value": metrics["qps_drop_pct"],
            "threshold": THRESHOLDS["qps_drop_pct"],
            "message": f"QPS 下降 {metrics['qps_drop_pct']:.1f}%",
        })

    if metrics["http_5xx_per_min"] > THRESHOLDS["http_5xx_per_min"]:
        triggered.append({
            "rule": "5xx_errors",
            "value": metrics["http_5xx_per_min"],
            "threshold": THRESHOLDS["http_5xx_per_min"],
            "message": f"5xx 错误 {metrics['http_5xx_per_min']:.0f} 超过阈值 {THRESHOLDS['http_5xx_per_min']}",
        })

    if metrics["crash_loop_count"] > THRESHOLDS["crash_loop_count"]:
        triggered.append({
            "rule": "crash_loop",
            "value": metrics["crash_loop_count"],
            "threshold": THRESHOLDS["crash_loop_count"],
            "message": f"CrashLoopBackOff Pod {metrics['crash_loop_count']:.0f} 超过阈值",
        })

    return triggered


def trigger_rollback(service: str, version: str, reason: str, triggered_by: str, details: dict) -> dict:
    """触发回滚 (调用 canary_release.sh)"""
    log(f"🚨 触发自动回滚: {service} {version or '(latest)'}, 原因: {reason}")

    start = time.time()
    canary_result = {"rc": 0, "stdout": "", "stderr": ""}

    if CANARY_RELEASE_SH.exists():
        try:
            cmd = ["bash", str(CANARY_RELEASE_SH), "--service", service, "--rollback"]
            if version:
                cmd.extend(["--version", version])
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=str(SERVER_DIR),
            )
            canary_result["rc"] = result.returncode
            canary_result["stdout"] = result.stdout
            canary_result["stderr"] = result.stderr
        except subprocess.TimeoutExpired:
            canary_result["rc"] = -1
            canary_result["stderr"] = "timeout"
    else:
        log(f"⚠️ canary_release.sh 不存在: {CANARY_RELEASE_SH}")
        canary_result["stderr"] = "script_not_found"

    duration_ms = int((time.time() - start) * 1000)
    status = "rolled_back" if canary_result["rc"] == 0 else "rollback_failed"

    # 记录事件
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO rollback_events (
            timestamp, service, version, reason, triggered_by, details, status, duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now(timezone.utc).isoformat(),
        service,
        version or "",
        reason,
        triggered_by,
        json.dumps(details, ensure_ascii=False),
        status,
        duration_ms,
    ))
    conn.commit()
    event_id = cur.lastrowid
    conn.close()

    return {
        "event_id": event_id,
        "status": status,
        "duration_ms": duration_ms,
        "canary_rc": canary_result["rc"],
        "canary_stderr": canary_result["stderr"][:200],
    }


def cmd_check(args) -> int:
    """单次检查"""
    log(f"检查服务 {args.service} 指标...")
    metrics = collect_metrics(args.service)
    log(f"  error_rate:    {metrics['error_rate']:.2%}")
    log(f"  p95_latency:   {metrics['p95_latency_ms']:.0f}ms (增加 {metrics['p95_increase_pct']:.1f}%)")
    log(f"  qps_drop:      {metrics['qps_drop_pct']:.1f}%")
    log(f"  5xx_per_min:   {metrics['http_5xx_per_min']:.0f}")
    log(f"  crash_loop:    {metrics['crash_loop_count']:.0f}")

    triggered = evaluate_thresholds(metrics)

    if triggered:
        log(f"🚨 触发回滚条件 ({len(triggered)} 项):")
        for t in triggered:
            log(f"  - {t['rule']}: {t['message']}")

        if args.auto_rollback:
            result = trigger_rollback(
                service=args.service,
                version=args.version or "",
                reason="; ".join([t["rule"] for t in triggered]),
                triggered_by="auto",
                details={"metrics": metrics, "triggered": triggered},
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0 if result["status"] == "rolled_back" else 1
        else:
            print(json.dumps({"would_rollback": True, "triggered": triggered, "metrics": metrics}, ensure_ascii=False, indent=2))
            return 0

    print(json.dumps({"would_rollback": False, "metrics": metrics}, ensure_ascii=False, indent=2))
    return 0


def cmd_rollback(args) -> int:
    """手动回滚"""
    result = trigger_rollback(
        service=args.service,
        version=args.version or "",
        reason=args.reason,
        triggered_by="manual",
        details={"args": vars(args)},
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "rolled_back" else 1


def cmd_history(args) -> int:
    """回滚历史"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, timestamp, service, version, reason, triggered_by, status, duration_ms
        FROM rollback_events
        ORDER BY id DESC LIMIT ?
    """, (args.limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    return 0


def monitor_loop(args) -> int:
    """监控循环 (后台)"""
    log(f"🔄 启动金丝雀自动回滚监控: {args.service} {args.version or '(latest)'}")
    log(f"  间隔: {args.interval}s, 阈值: error_rate > {THRESHOLDS['error_rate']:.0%}, qps_drop > {THRESHOLDS['qps_drop_pct']:.0f}%")

    last_alert = None
    while True:
        try:
            metrics = collect_metrics(args.service)
            triggered = evaluate_thresholds(metrics)

            if triggered:
                reason = "; ".join([t["rule"] for t in triggered])
                # 防止重复触发 (60s 内不重复)
                if last_alert != reason or (last_alert == reason and time.time() - getattr(monitor_loop, "_last_trigger", 0) > 60):
                    log(f"🚨 自动回滚触发: {reason}")
                    result = trigger_rollback(
                        service=args.service,
                        version=args.version or "",
                        reason=reason,
                        triggered_by="auto",
                        details={"metrics": metrics, "triggered": triggered},
                    )
                    log(f"  结果: {result['status']} (耗时 {result['duration_ms']}ms)")
                    last_alert = reason
                    monitor_loop._last_trigger = time.time()

                    if result["status"] == "rolled_back":
                        log("✅ 自动回滚完成, 停止监控")
                        return 0
            else:
                if last_alert:
                    log("  指标恢复正常")
                    last_alert = None
        except Exception as e:
            log(f"❌ 监控异常: {e}")

        time.sleep(args.interval)


def main() -> int:
    parser = argparse.ArgumentParser(description="金丝雀自动回滚")
    sub = parser.add_subparsers(dest="command")

    # check
    check_p = sub.add_parser("check", help="单次检查")
    check_p.add_argument("--service", required=True)
    check_p.add_argument("--version")
    check_p.add_argument("--auto-rollback", action="store_true")

    # rollback
    rb_p = sub.add_parser("rollback", help="手动回滚")
    rb_p.add_argument("--service", required=True)
    rb_p.add_argument("--version")
    rb_p.add_argument("--reason", default="manual")

    # history
    hist_p = sub.add_parser("history", help="回滚历史")
    hist_p.add_argument("--limit", type=int, default=20)

    # monitor
    mon_p = sub.add_parser("monitor", help="启动监控")
    mon_p.add_argument("--service", required=True)
    mon_p.add_argument("--version")
    mon_p.add_argument("--interval", type=int, default=30)

    args = parser.parse_args()

    if args.command == "check":
        return cmd_check(args)
    if args.command == "rollback":
        return cmd_rollback(args)
    if args.command == "history":
        return cmd_history(args)
    if args.command == "monitor":
        return monitor_loop(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

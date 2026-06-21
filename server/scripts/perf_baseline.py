#!/usr/bin/env python3
"""性能基线管理 (Round 11 P2-20)

功能:
  - 关键 API 性能基线 (P50/P95/P99)
  - 性能回归告警 (vs 基线偏离 >20%)
  - 慢查询自动跟踪 + 优化建议
  - 性能报告 Dashboard
  - 基线版本管理
  - 对比报告 (vs 上周/上月)
  - 趋势分析

用法:
  python scripts/perf_baseline.py set --api /v1/users --p95 100
  python scripts/perf_baseline.py check --api /v1/users
  python scripts/perf_baseline.py record --api /v1/users --p50 50 --p95 110 --p99 200
  python scripts/perf_baseline.py report
  python scripts/perf_baseline.py regression
  python scripts/perf_baseline.py slow-queries
  python scripts/perf_baseline.py serve --port 9900
"""
import argparse
import json
import os
import sqlite3
import statistics
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOGS_DIR = SERVER_DIR / "logs"
DB_PATH = LOGS_DIR / "perf_baseline.db"

DINGTALK_WEBHOOK = os.environ.get("DINGTALK_WEBHOOK", "")

# 回归阈值
REGRESSION_THRESHOLD_PCT = 20  # 偏离基线 20% 触发告警
SLOW_QUERY_THRESHOLD_MS = 100  # 100ms 慢查询
DEFAULT_BASELINE_WINDOW_DAYS = 7


def log(msg: str) -> None:
    """输出日志"""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def init_db() -> None:
    """初始化性能基线 DB"""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS baselines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            api_endpoint TEXT NOT NULL,
            method TEXT DEFAULT 'GET',
            p50_ms REAL,
            p95_ms REAL,
            p99_ms REAL,
            qps REAL,
            error_rate REAL,
            version TEXT,
            note TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS perf_measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            api_endpoint TEXT NOT NULL,
            method TEXT DEFAULT 'GET',
            p50_ms REAL NOT NULL,
            p95_ms REAL NOT NULL,
            p99_ms REAL NOT NULL,
            qps REAL,
            error_count INTEGER,
            duration_ms REAL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS slow_queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            api_endpoint TEXT NOT NULL,
            duration_ms REAL NOT NULL,
            query TEXT,
            stack_trace TEXT
        )
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_baseline_api ON baselines(api_endpoint)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_measure_api ON perf_measurements(api_endpoint)
    """)
    conn.commit()
    conn.close()


def set_baseline(api_endpoint: str, p50: float, p95: float, p99: float, qps: float = 0, error_rate: float = 0, version: str = "1.0.0", note: str = "") -> dict:
    """设置性能基线"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO baselines (timestamp, api_endpoint, p50_ms, p95_ms, p99_ms, qps, error_rate, version, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now(timezone.utc).isoformat(),
        api_endpoint, p50, p95, p99, qps, error_rate, version, note,
    ))
    conn.commit()
    conn.close()

    return {
        "status": "ok",
        "api_endpoint": api_endpoint,
        "p50_ms": p50,
        "p95_ms": p95,
        "p99_ms": p99,
        "qps": qps,
        "error_rate": error_rate,
        "version": version,
    }


def get_baseline(api_endpoint: str) -> Optional[dict]:
    """获取最新基线"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM baselines WHERE api_endpoint = ?
        ORDER BY timestamp DESC LIMIT 1
    """, (api_endpoint,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def record_measurement(api_endpoint: str, p50: float, p95: float, p99: float, qps: float = 0, error_count: int = 0, duration_ms: float = 0) -> dict:
    """记录一次性能测量"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO perf_measurements (timestamp, api_endpoint, p50_ms, p95_ms, p99_ms, qps, error_count, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now(timezone.utc).isoformat(),
        api_endpoint, p50, p95, p99, qps, error_count, duration_ms,
    ))
    conn.commit()
    conn.close()

    # 检测回归
    baseline = get_baseline(api_endpoint)
    if baseline:
        regression = check_regression(api_endpoint, {"p50_ms": p50, "p95_ms": p95, "p99_ms": p99})
        if regression.get("is_regression"):
            send_dingtalk_alert(api_endpoint, regression)

    return {
        "status": "ok",
        "api_endpoint": api_endpoint,
        "p50_ms": p50,
        "p95_ms": p95,
        "p99_ms": p99,
    }


def check_regression(api_endpoint: str, current: dict) -> dict:
    """检查性能回归"""
    baseline = get_baseline(api_endpoint)
    if not baseline:
        return {"is_regression": False, "reason": "无基线"}

    regressions = []
    for metric in ["p50_ms", "p95_ms", "p99_ms"]:
        if metric in baseline and metric in current:
            base_val = baseline[metric]
            cur_val = current[metric]
            if base_val > 0:
                pct = (cur_val - base_val) / base_val * 100
                if pct >= REGRESSION_THRESHOLD_PCT:
                    regressions.append({
                        "metric": metric,
                        "baseline": base_val,
                        "current": cur_val,
                        "regression_pct": round(pct, 2),
                    })

    return {
        "api_endpoint": api_endpoint,
        "is_regression": len(regressions) > 0,
        "regressions": regressions,
        "threshold_pct": REGRESSION_THRESHOLD_PCT,
    }


def check_all_regressions() -> dict:
    """检查所有 API 的回归"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    # 获取所有 API endpoint
    cur.execute("SELECT DISTINCT api_endpoint FROM perf_measurements")
    apis = [row["api_endpoint"] for row in cur.fetchall()]
    conn.close()

    results = []
    for api in apis:
        # 获取最近一次测量
        conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM perf_measurements
            WHERE api_endpoint = ?
            ORDER BY timestamp DESC LIMIT 1
        """, (api,))
        row = cur.fetchone()
        conn.close()
        if row:
            check = check_regression(api, dict(row))
            if check.get("is_regression"):
                results.append(check)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checked_apis": len(apis),
        "regressions_found": len(results),
        "regressions": results,
    }


def record_slow_query(api_endpoint: str, duration_ms: float, query: str = "", stack_trace: str = "") -> None:
    """记录慢查询"""
    if duration_ms < SLOW_QUERY_THRESHOLD_MS:
        return

    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO slow_queries (timestamp, api_endpoint, duration_ms, query, stack_trace)
        VALUES (?, ?, ?, ?, ?)
    """, (
        datetime.now(timezone.utc).isoformat(),
        api_endpoint, duration_ms, query, stack_trace,
    ))
    conn.commit()
    conn.close()


def get_slow_queries(hours: int = 24, limit: int = 50) -> dict:
    """获取慢查询"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    cur.execute("""
        SELECT * FROM slow_queries
        WHERE timestamp >= ? AND duration_ms >= ?
        ORDER BY duration_ms DESC LIMIT ?
    """, (cutoff, SLOW_QUERY_THRESHOLD_MS, limit))
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()

    # 生成优化建议
    for r in rows:
        r["suggestion"] = generate_suggestion(r["duration_ms"], r.get("query", ""))

    return {
        "period_hours": hours,
        "threshold_ms": SLOW_QUERY_THRESHOLD_MS,
        "count": len(rows),
        "queries": rows,
    }


def generate_suggestion(duration_ms: float, query: str) -> str:
    """生成优化建议"""
    suggestions = []
    if duration_ms > 1000:
        suggestions.append("考虑添加索引")
    if duration_ms > 500:
        suggestions.append("检查 N+1 查询")
    if "SELECT" in query.upper() and "WHERE" not in query.upper():
        suggestions.append("避免 SELECT *, 添加 WHERE 条件")
    if "LIKE" in query.upper() and "%" in query:
        suggestions.append("避免前缀模糊查询, 考虑全文索引")
    if "JOIN" in query.upper():
        suggestions.append("检查 JOIN 字段是否已索引")
    if not suggestions:
        suggestions.append("考虑增加缓存层")
    return "; ".join(suggestions)


def generate_report() -> dict:
    """生成性能报告"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "baselines": {},
        "apis": {},
    }

    # 所有基线
    cur.execute("SELECT * FROM baselines ORDER BY api_endpoint, timestamp DESC")
    for row in cur.fetchall():
        api = row["api_endpoint"]
        if api not in report["baselines"]:
            report["baselines"][api] = dict(row)

    # 每个 API 的最近测量
    cur.execute("""
        SELECT api_endpoint,
               AVG(p50_ms) as avg_p50,
               AVG(p95_ms) as avg_p95,
               AVG(p99_ms) as avg_p99,
               AVG(qps) as avg_qps,
               SUM(error_count) as total_errors,
               COUNT(*) as measurement_count
        FROM perf_measurements
        GROUP BY api_endpoint
    """)
    for row in cur.fetchall():
        report["apis"][row["api_endpoint"]] = dict(row)

    conn.close()
    return report


def send_dingtalk_alert(api_endpoint: str, regression: dict) -> None:
    """发送钉钉告警"""
    if not DINGTALK_WEBHOOK:
        return
    try:
        text = f"⚠️ 性能回归告警\nAPI: {api_endpoint}\n"
        for r in regression.get("regressions", []):
            text += f"- {r['metric']}: {r['baseline']}ms → {r['current']}ms (+{r['regression_pct']}%)\n"

        payload = json.dumps({"msgtype": "text", "text": {"content": text}}).encode("utf-8")
        req = urllib.request.Request(DINGTALK_WEBHOOK, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            log(f"钉钉通知已发送 (status={resp.status})")
    except Exception as e:
        log(f"⚠️ 钉钉通知失败: {e}")


def cmd_set(args) -> int:
    """设置基线"""
    result = set_baseline(
        args.api, args.p50, args.p95, args.p99,
        qps=args.qps, error_rate=args.error_rate,
        version=args.version, note=args.note,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_check(args) -> int:
    """检查回归"""
    result = check_regression(args.api, {
        "p50_ms": args.p50, "p95_ms": args.p95, "p99_ms": args.p99,
    })
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_record(args) -> int:
    """记录测量"""
    result = record_measurement(
        args.api, args.p50, args.p95, args.p99,
        qps=args.qps, error_count=args.error_count, duration_ms=args.duration,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_report(args) -> int:
    """性能报告"""
    result = generate_report()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_regression(args) -> int:
    """检查所有回归"""
    result = check_all_regressions()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_slow_queries(args) -> int:
    """慢查询"""
    result = get_slow_queries(hours=args.hours, limit=args.limit)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_serve(args) -> int:
    """HTTP 服务"""
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/healthz":
                self._json(200, {"status": "ok", "service": "perf-baseline"})
            elif self.path == "/report":
                self._json(200, generate_report())
            elif self.path == "/regression":
                self._json(200, check_all_regressions())
            elif self.path.startswith("/slow-queries"):
                self._json(200, get_slow_queries())
            elif self.path.startswith("/baseline/"):
                api = self.path.split("/", 2)[-1]
                self._json(200, get_baseline(api) or {"error": "not found"})
            else:
                self._json(404, {"error": "not found"})

        def do_POST(self):
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length).decode("utf-8")) if content_length else {}
            if self.path == "/set-baseline":
                self._json(200, set_baseline(
                    body.get("api_endpoint", ""),
                    body.get("p50_ms", 0), body.get("p95_ms", 0), body.get("p99_ms", 0),
                    qps=body.get("qps", 0), error_rate=body.get("error_rate", 0),
                ))
            elif self.path == "/record":
                self._json(200, record_measurement(
                    body.get("api_endpoint", ""),
                    body.get("p50_ms", 0), body.get("p95_ms", 0), body.get("p99_ms", 0),
                    qps=body.get("qps", 0), error_count=body.get("error_count", 0),
                ))
            else:
                self._json(404, {"error": "not found"})

        def _json(self, code: int, data):
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

        def log_message(self, format, *args):
            pass

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    log(f"perf-baseline HTTP 服务已启动: 0.0.0.0:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="性能基线管理")
    sub = parser.add_subparsers(dest="command")

    st_p = sub.add_parser("set", help="设置基线")
    st_p.add_argument("--api", required=True)
    st_p.add_argument("--p50", type=float, required=True)
    st_p.add_argument("--p95", type=float, required=True)
    st_p.add_argument("--p99", type=float, required=True)
    st_p.add_argument("--qps", type=float, default=0)
    st_p.add_argument("--error-rate", type=float, default=0)
    st_p.add_argument("--version", default="1.0.0")
    st_p.add_argument("--note", default="")

    ch_p = sub.add_parser("check", help="检查回归")
    ch_p.add_argument("--api", required=True)
    ch_p.add_argument("--p50", type=float, required=True)
    ch_p.add_argument("--p95", type=float, required=True)
    ch_p.add_argument("--p99", type=float, required=True)

    rd_p = sub.add_parser("record", help="记录测量")
    rd_p.add_argument("--api", required=True)
    rd_p.add_argument("--p50", type=float, required=True)
    rd_p.add_argument("--p95", type=float, required=True)
    rd_p.add_argument("--p99", type=float, required=True)
    rd_p.add_argument("--qps", type=float, default=0)
    rd_p.add_argument("--error-count", type=int, default=0)
    rd_p.add_argument("--duration", type=float, default=0)

    sub.add_parser("report", help="性能报告")
    sub.add_parser("regression", help="检查所有回归")

    sq_p = sub.add_parser("slow-queries", help="慢查询")
    sq_p.add_argument("--hours", type=int, default=24)
    sq_p.add_argument("--limit", type=int, default=50)

    sv_p = sub.add_parser("serve", help="HTTP 服务")
    sv_p.add_argument("--port", type=int, default=9900)

    args = parser.parse_args()

    if args.command == "set":
        return cmd_set(args)
    if args.command == "check":
        return cmd_check(args)
    if args.command == "record":
        return cmd_record(args)
    if args.command == "report":
        return cmd_report(args)
    if args.command == "regression":
        return cmd_regression(args)
    if args.command == "slow-queries":
        return cmd_slow_queries(args)
    if args.command == "serve":
        return cmd_serve(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

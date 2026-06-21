#!/usr/bin/env python3
"""告警历史集成层

功能:
  - 接收 Alertmanager webhook 格式数据
  - 自动解析为标准格式, 写入 alert_history DB
  - 暴露 Prometheus 指标 (alert_history_total / by_level / by_source / by_status / by_day)
  - 重复告警合并 (相同 alertname + service + region 5 分钟内)
  - 关键词升级 (outage/failover -> critical)
  - 自动清理 (90 天过期)

用法:
  # 启动 webhook 服务 (端口 9090)
  python scripts/alert_history_integration.py serve --port 9090

  # 接收单个 Alertmanager 格式的 payload
  python scripts/alert_history_integration.py ingest --payload '{"alerts":[...]}'

  # 列出最近的告警
  python scripts/alert_history_integration.py list --limit 20

  # 触发清理
  python scripts/alert_history_integration.py cleanup --days 90

  # 暴露 Prometheus 指标
  python scripts/alert_history_integration.py metrics
"""
import os
import sys
import json
import time
import sqlite3
import argparse
import hashlib
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = LOG_DIR / "alert_history.db"

# 关键词升级规则
KEYWORD_ESCALATION = {
    "outage": "critical",
    "failover": "critical",
    "down": "critical",
    "crash": "critical",
    "loss": "critical",
}

# 告警合并窗口 (秒)
DEDUP_WINDOW_SEC = 300

# Prometheus 指标缓存 (避免每次查询 SQLite)
_metrics_cache = {"data": "", "timestamp": 0.0}
_metrics_lock = threading.Lock()


def get_connection() -> sqlite3.Connection:
    """获取 SQLite 连接"""
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    _init_schema(conn)
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    """初始化表结构 (含降噪合并所需字段)"""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS alert_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            source TEXT,
            tags TEXT,
            channels TEXT,
            status TEXT,
            alertname TEXT,
            service TEXT,
            region TEXT,
            cluster TEXT,
            fingerprint TEXT,
            extra TEXT,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_alert_history_ts ON alert_history(timestamp);
        CREATE INDEX IF NOT EXISTS idx_alert_history_level ON alert_history(level);
        CREATE INDEX IF NOT EXISTS idx_alert_history_source ON alert_history(source);
        CREATE INDEX IF NOT EXISTS idx_alert_history_fingerprint ON alert_history(fingerprint);
        CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
    """)
    conn.commit()


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def compute_fingerprint(alert: dict) -> str:
    """计算告警指纹 (用于去重)

    指纹 = alertname + service + region + cluster
    """
    labels = alert.get("labels", {})
    parts = [
        labels.get("alertname", ""),
        labels.get("service", ""),
        labels.get("region", ""),
        labels.get("cluster", ""),
    ]
    raw = "|".join(parts)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:16]


def escalate_level(level: str, alertname: str) -> str:
    """关键词升级: outage/failover -> critical"""
    alertname_lower = alertname.lower()
    for keyword, target_level in KEYWORD_ESCALATION.items():
        if keyword in alertname_lower:
            return target_level
    return level


def find_duplicate(conn: sqlite3.Connection, fingerprint: str, window_sec: int) -> Optional[dict]:
    """查找时间窗口内的重复告警"""
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=window_sec)).isoformat()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM alert_history
        WHERE fingerprint = ? AND timestamp >= ?
        ORDER BY id DESC LIMIT 1
    """, (fingerprint, cutoff))
    return cur.fetchone()


def record_alert(alert: dict, channels: str = "alertmanager") -> dict:
    """记录单个告警

    Returns:
        dict: {"action": "inserted" | "merged" | "updated", "id": int}
    """
    labels = alert.get("labels", {})
    annotations = alert.get("annotations", {})

    alertname = labels.get("alertname", "unknown")
    service = labels.get("service", "")
    region = labels.get("region", "")
    cluster = labels.get("cluster", "")
    level = labels.get("severity", "warning")
    status = alert.get("status", "firing")

    # 关键词升级
    original_level = level
    level = escalate_level(level, alertname)
    escalated = original_level != level

    title = annotations.get("summary", alertname)
    content = annotations.get("description", "")

    # 标签
    tags_dict = {k: v for k, v in labels.items() if k not in ["alertname", "service", "region", "cluster", "severity"]}
    tags = ",".join([f"{k}={v}" for k, v in tags_dict.items()])

    source = labels.get("source", service or "alertmanager")
    fingerprint = compute_fingerprint(alert)

    conn = get_connection()
    try:
        # 去重检查
        dup = find_duplicate(conn, fingerprint, DEDUP_WINDOW_SEC)
        if dup and status == "firing":
            # 重复告警: 更新计数和时间
            cur = conn.cursor()
            cur.execute("""
                UPDATE alert_history
                SET timestamp = ?, status = ?, content = ?
                WHERE id = ?
            """, (
                datetime.now(timezone.utc).isoformat(),
                status,
                content,
                dup["id"],
            ))
            conn.commit()
            return {"action": "merged", "id": dup["id"], "fingerprint": fingerprint}

        # 插入新告警
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO alert_history (
                timestamp, level, title, content, source, tags, channels, status,
                alertname, service, region, cluster, fingerprint, extra
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datetime.now(timezone.utc).isoformat(),
            level,
            title,
            content,
            source,
            tags,
            channels,
            status,
            alertname,
            service,
            region,
            cluster,
            fingerprint,
            json.dumps({
                "annotations": annotations,
                "escalated": escalated,
                "original_level": original_level,
            }, ensure_ascii=False),
        ))
        conn.commit()
        alert_id = cur.lastrowid
        return {"action": "inserted", "id": alert_id, "fingerprint": fingerprint, "escalated": escalated}
    finally:
        conn.close()


def cmd_ingest(args) -> int:
    """接收 Alertmanager webhook payload"""
    if args.payload:
        try:
            data = json.loads(args.payload)
        except json.JSONDecodeError as e:
            log(f"❌ JSON 解析失败: {e}")
            return 1
    elif args.file:
        try:
            data = json.loads(Path(args.file).read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError) as e:
            log(f"❌ 读取文件失败: {e}")
            return 1
    else:
        log("❌ 必须提供 --payload 或 --file")
        return 1

    alerts = data.get("alerts", [])
    if not alerts:
        log("⚠️ payload 中无 alerts")
        return 0

    results = {"inserted": 0, "merged": 0, "total": len(alerts)}
    for alert in alerts:
        r = record_alert(alert)
        if r["action"] == "inserted":
            results["inserted"] += 1
        elif r["action"] == "merged":
            results["merged"] += 1

    log(f"✅ 处理完成: 插入 {results['inserted']}, 合并 {results['merged']}, 总计 {results['total']}")
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


def cmd_list(args) -> int:
    """列出告警"""
    conn = get_connection()
    cur = conn.cursor()

    where = []
    params = []
    if args.level:
        where.append("level = ?")
        params.append(args.level)
    if args.status:
        where.append("status = ?")
        params.append(args.status)

    sql = "SELECT id, timestamp, level, title, source, status, alertname, service, region, fingerprint FROM alert_history"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(int(args.limit))

    cur.execute(sql, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    print(json.dumps(rows, ensure_ascii=False, indent=2))
    log(f"返回 {len(rows)} 条记录")
    return 0


def cmd_cleanup(args) -> int:
    """清理过期告警"""
    conn = get_connection()
    cur = conn.cursor()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.days)).isoformat()
    cur.execute("DELETE FROM alert_history WHERE timestamp < ?", (cutoff,))
    deleted = cur.rowcount
    conn.commit()
    conn.close()
    log(f"✅ 清理完成: 删除 {deleted} 条超过 {args.days} 天的记录")
    print(json.dumps({"deleted": deleted, "retention_days": args.days}, ensure_ascii=False))
    return 0


def cmd_stats(args) -> int:
    """统计告警"""
    conn = get_connection()
    cur = conn.cursor()
    since = (datetime.now(timezone.utc) - timedelta(days=args.days)).isoformat()

    cur.execute("SELECT level, COUNT(*) as c FROM alert_history WHERE timestamp >= ? GROUP BY level", (since,))
    by_level = {r["level"]: r["c"] for r in cur.fetchall()}

    cur.execute("SELECT COALESCE(NULLIF(source, ''), 'unknown') as s, COUNT(*) as c FROM alert_history WHERE timestamp >= ? GROUP BY s ORDER BY c DESC LIMIT 10", (since,))
    by_source = {r["s"]: r["c"] for r in cur.fetchall()}

    cur.execute("SELECT substr(timestamp, 1, 10) as d, COUNT(*) as c FROM alert_history WHERE timestamp >= ? GROUP BY d ORDER BY d DESC", (since,))
    by_day = {r["d"]: r["c"] for r in cur.fetchall()}

    cur.execute("SELECT status, COUNT(*) as c FROM alert_history WHERE timestamp >= ? GROUP BY status", (since,))
    by_status = {r["status"]: r["c"] for r in cur.fetchall()}

    cur.execute("SELECT COUNT(*) as c FROM alert_history WHERE timestamp >= ?", (since,))
    total = cur.fetchone()["c"]

    conn.close()
    print(json.dumps({
        "total": total,
        "days": args.days,
        "by_level": by_level,
        "by_source": by_source,
        "by_day": by_day,
        "by_status": by_status,
    }, ensure_ascii=False, indent=2))
    return 0


def render_prometheus_metrics() -> str:
    """渲染 Prometheus 格式指标"""
    conn = get_connection()
    cur = conn.cursor()
    since_7d = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    lines = []

    # 1. alert_history_total
    cur.execute("SELECT COUNT(*) as c FROM alert_history WHERE timestamp >= ?", (since_7d,))
    total_7d = cur.fetchone()["c"]
    lines.append("# HELP alert_history_total Total alerts in period")
    lines.append("# TYPE alert_history_total counter")
    lines.append(f'alert_history_total{{period="7d"}} {total_7d}')

    # 2. alert_history_by_level
    cur.execute("SELECT level, COUNT(*) as c FROM alert_history WHERE timestamp >= ? GROUP BY level", (since_7d,))
    lines.append("# HELP alert_history_by_level Alerts grouped by level")
    lines.append("# TYPE alert_history_by_level counter")
    for r in cur.fetchall():
        lines.append(f'alert_history_by_level{{level="{r["level"]}"}} {r["c"]}')

    # 3. alert_history_by_source
    cur.execute("SELECT COALESCE(NULLIF(source, ''), 'unknown') as s, COUNT(*) as c FROM alert_history WHERE timestamp >= ? GROUP BY s", (since_7d,))
    lines.append("# HELP alert_history_by_source Alerts grouped by source")
    lines.append("# TYPE alert_history_by_source counter")
    for r in cur.fetchall():
        lines.append(f'alert_history_by_source{{source="{r["s"]}"}} {r["c"]}')

    # 4. alert_history_by_day
    cur.execute("SELECT substr(timestamp, 1, 10) as d, COUNT(*) as c FROM alert_history WHERE timestamp >= ? GROUP BY d", (since_7d,))
    lines.append("# HELP alert_history_by_day Alerts grouped by day")
    lines.append("# TYPE alert_history_by_day counter")
    for r in cur.fetchall():
        lines.append(f'alert_history_by_day{{day="{r["d"]}"}} {r["c"]}')

    # 5. alert_history_by_status
    cur.execute("SELECT status, COUNT(*) as c FROM alert_history WHERE timestamp >= ? GROUP BY status", (since_7d,))
    lines.append("# HELP alert_history_by_status Alerts grouped by status")
    lines.append("# TYPE alert_history_by_status counter")
    for r in cur.fetchall():
        lines.append(f'alert_history_by_status{{status="{r["status"]}"}} {r["c"]}')

    conn.close()
    return "\n".join(lines) + "\n"


def cmd_metrics(args) -> int:
    """输出 Prometheus 指标"""
    print(render_prometheus_metrics())
    return 0


class AlertHandler(BaseHTTPRequestHandler):
    """HTTP handler: 接收 Alertmanager webhook"""

    def do_POST(self):
        if self.path == "/webhook":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                results = {"inserted": 0, "merged": 0}
                for alert in data.get("alerts", []):
                    r = record_alert(alert)
                    if r["action"] == "inserted":
                        results["inserted"] += 1
                    elif r["action"] == "merged":
                        results["merged"] += 1
                self._send_json(200, {"ok": True, **results})
            except json.JSONDecodeError:
                self._send_json(400, {"ok": False, "error": "invalid_json"})
        elif self.path == "/metrics":
            self._send_text(200, render_prometheus_metrics())
        elif self.path == "/healthz":
            self._send_json(200, {"status": "ok"})
        else:
            self._send_json(404, {"error": "not_found"})

    def do_GET(self):
        if self.path == "/metrics":
            self._send_text(200, render_prometheus_metrics())
        elif self.path == "/healthz":
            self._send_json(200, {"status": "ok"})
        else:
            self._send_json(404, {"error": "not_found"})

    def _send_json(self, code: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, code: int, text: str):
        body = text.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; version=0.0.4")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # 静默默认日志
        pass


def cmd_serve(args) -> int:
    """启动 HTTP 服务"""
    server = HTTPServer(("0.0.0.0", args.port), AlertHandler)
    log(f"✅ 告警历史服务启动: http://0.0.0.0:{args.port}")
    log(f"  POST /webhook   接收 Alertmanager 告警")
    log(f"  GET  /metrics   Prometheus 指标")
    log(f"  GET  /healthz   健康检查")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("服务停止")
        server.shutdown()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="告警历史集成层")
    sub = parser.add_subparsers(dest="command")

    # ingest
    ingest_p = sub.add_parser("ingest", help="接收 payload")
    ingest_p.add_argument("--payload", help="JSON 字符串")
    ingest_p.add_argument("--file", help="JSON 文件路径")

    # list
    list_p = sub.add_parser("list", help="列出告警")
    list_p.add_argument("--level", choices=["info", "warning", "critical"])
    list_p.add_argument("--status", choices=["firing", "resolved"])
    list_p.add_argument("--limit", type=int, default=20)

    # cleanup
    cleanup_p = sub.add_parser("cleanup", help="清理过期")
    cleanup_p.add_argument("--days", type=int, default=90)

    # stats
    stats_p = sub.add_parser("stats", help="告警统计")
    stats_p.add_argument("--days", type=int, default=7)

    # metrics
    sub.add_parser("metrics", help="Prometheus 指标")

    # serve
    serve_p = sub.add_parser("serve", help="启动 HTTP 服务")
    serve_p.add_argument("--port", type=int, default=9090)

    args = parser.parse_args()

    if args.command == "ingest":
        return cmd_ingest(args)
    if args.command == "list":
        return cmd_list(args)
    if args.command == "cleanup":
        return cmd_cleanup(args)
    if args.command == "stats":
        return cmd_stats(args)
    if args.command == "metrics":
        return cmd_metrics(args)
    if args.command == "serve":
        return cmd_serve(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

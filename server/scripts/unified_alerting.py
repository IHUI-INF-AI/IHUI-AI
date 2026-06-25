#!/usr/bin/env python3
"""
P0-66 统一告警接入
将 Round 13/14 新增服务告警接入 Round 8 P0-3 统一告警体系
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "unified_alerting.db")
HTTP_PORT = 10460

CHANNELS = ["dingtalk", "feishu", "wechat", "email", "sms", "webhook"]
SEVERITIES = ["critical", "warning", "info", "debug"]
ROUTE_ACTIONS = ["send", "aggregate", "suppress", "escalate", "drop"]


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS alert_routes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            route_name TEXT NOT NULL UNIQUE,
            service_pattern TEXT,
            severity TEXT,
            channel TEXT NOT NULL,
            recipients TEXT,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS alert_history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            alert_id TEXT NOT NULL,
            service_name TEXT NOT NULL,
            severity TEXT,
            title TEXT,
            message TEXT,
            channels_sent TEXT,
            sent_at TEXT,
            status TEXT DEFAULT 'pending'
        );
        CREATE TABLE IF NOT EXISTS channel_configs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            channel_name TEXT NOT NULL UNIQUE,
            webhook_url TEXT,
            secret TEXT,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS alert_rules (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            rule_name TEXT NOT NULL UNIQUE,
            service_name TEXT NOT NULL,
            condition_expr TEXT,
            severity TEXT,
            action TEXT DEFAULT 'send',
            target_route TEXT,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS alert_aggregations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            aggregation_key TEXT NOT NULL,
            count INTEGER DEFAULT 1,
            services TEXT,
            first_seen TEXT,
            last_seen TEXT,
            severity TEXT
        );
        CREATE TABLE IF NOT EXISTS alert_dedup_state (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            dedup_key TEXT NOT NULL UNIQUE,
            last_fired TEXT,
            count INTEGER DEFAULT 1
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def create_route(route_name: str, service_pattern: str, severity: str,
                  channel: str, recipients: Optional[List[str]] = None) -> str:
    """创建告警路由"""
    if channel not in CHANNELS:
        channel = "email"
    if severity not in SEVERITIES:
        severity = "warning"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO alert_routes
            (id,timestamp,route_name,service_pattern,severity,channel,recipients,enabled)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), route_name, service_pattern, severity, channel,
             json.dumps(recipients or [], ensure_ascii=False), 1))
    return rid


def configure_channel(channel_name: str, webhook_url: str = "",
                       secret: str = "") -> str:
    """配置渠道"""
    if channel_name not in CHANNELS:
        channel_name = "email"
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO channel_configs
            (id,timestamp,channel_name,webhook_url,secret,enabled)
            VALUES (?,?,?,?,?,?)""",
            (cid, _now(), channel_name, webhook_url, secret, 1))
    return cid


def create_rule(rule_name: str, service_name: str, condition_expr: str,
                 severity: str = "warning", action: str = "send",
                 target_route: str = "") -> str:
    """创建告警规则"""
    if severity not in SEVERITIES:
        severity = "warning"
    if action not in ROUTE_ACTIONS:
        action = "send"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO alert_rules
            (id,timestamp,rule_name,service_name,condition_expr,severity,action,target_route,enabled)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), rule_name, service_name, condition_expr,
             severity, action, target_route, 1))
    return rid


def fire_alert(service_name: str, severity: str, title: str, message: str,
                dedup_key: str = "") -> Dict:
    """触发告警"""
    if severity not in SEVERITIES:
        severity = "warning"
    alert_id = "alert-" + uuid.uuid4().hex[:12]
    if not dedup_key:
        dedup_key = f"{service_name}:{title}"
    dedup_state = "new"
    with _conn_lock, _conn() as c:
        existing = c.execute("""SELECT * FROM alert_dedup_state WHERE dedup_key=?""",
                              (dedup_key,)).fetchone()
        if existing:
            last = existing["last_fired"]
            c.execute("""UPDATE alert_dedup_state SET count=count+1, last_fired=?
                WHERE dedup_key=?""", (_now(), dedup_key))
            dedup_state = "deduped"
            count = existing["count"] + 1
        else:
            c.execute("""INSERT INTO alert_dedup_state
                (id,timestamp,dedup_key,last_fired,count)
                VALUES (?,?,?,?,?)""",
                (str(uuid.uuid4()), _now(), dedup_key, _now(), 1))
            count = 1
    routes_matched = []
    channels_sent = []
    with _conn() as c:
        routes = c.execute("""SELECT * FROM alert_routes WHERE enabled=1""").fetchall()
    for r in routes:
        if r["severity"] == severity and (r["service_pattern"] == "*" or
                                            service_name.startswith(r["service_pattern"]) or
                                            r["service_pattern"] in service_name):
            routes_matched.append(r["channel"])
            channels_sent.append(r["channel"])
    hid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO alert_history
            (id,timestamp,alert_id,service_name,severity,title,message,
             channels_sent,sent_at,status)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (hid, _now(), alert_id, service_name, severity, title, message,
             json.dumps(channels_sent, ensure_ascii=False), _now(), "sent"))
    return {
        "alert_id": alert_id,
        "dedup_state": dedup_state,
        "count": count,
        "routes_matched": routes_matched,
        "channels_sent": channels_sent,
    }


def aggregate_alerts(aggregation_key: str, services: List[str],
                      severity: str = "warning") -> str:
    """聚合告警"""
    if severity not in SEVERITIES:
        severity = "warning"
    aid = str(uuid.uuid4())
    with _conn() as c:
        existing = c.execute("""SELECT * FROM alert_aggregations WHERE aggregation_key=?""",
                              (aggregation_key,)).fetchone()
    if existing:
        with _conn_lock, _conn() as c:
            c.execute("""UPDATE alert_aggregations SET count=count+1, last_seen=?
                WHERE aggregation_key=?""", (_now(), aggregation_key))
        return existing["id"]
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO alert_aggregations
            (id,timestamp,aggregation_key,count,services,first_seen,last_seen,severity)
            VALUES (?,?,?,?,?,?,?,?)""",
            (aid, _now(), aggregation_key, 1,
             json.dumps(services, ensure_ascii=False), _now(), _now(), severity))
    return aid


def get_alerting_report() -> Dict:
    """告警报告"""
    with _conn() as c:
        routes = c.execute("""SELECT COUNT(*) as c FROM alert_routes""").fetchone()["c"]
        channels = c.execute("""SELECT COUNT(*) as c FROM channel_configs""").fetchone()["c"]
        rules = c.execute("""SELECT COUNT(*) as c FROM alert_rules""").fetchone()["c"]
        sent = c.execute("""SELECT COUNT(*) as c FROM alert_history""").fetchone()["c"]
        dedup = c.execute("""SELECT COUNT(*) as c FROM alert_dedup_state""").fetchone()["c"]
        dedup_count = c.execute("""SELECT COALESCE(SUM(count),0) as s FROM alert_dedup_state""").fetchone()["s"]
        aggs = c.execute("""SELECT COUNT(*) as c FROM alert_aggregations""").fetchone()["c"]
    dedup_rate = 0
    if dedup_count > sent:
        dedup_rate = (dedup_count - sent) / dedup_count * 100
    return {
        "total_routes": routes,
        "total_channels": channels,
        "total_rules": rules,
        "alerts_sent": sent,
        "dedup_keys": dedup,
        "total_alert_attempts": dedup_count,
        "dedup_rate_pct": dedup_rate,
        "aggregations": aggs,
    }


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _send(self, code: int, data: Any) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        u = urlparse(self.path)
        if u.path == "/api/health":
            self._send(200, {"status": "ok", "port": HTTP_PORT})
        elif u.path == "/api/report":
            self._send(200, get_alerting_report())
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        u = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except Exception:
            data = {}
        if u.path == "/api/route":
            rid = create_route(
                data.get("route_name", "route-" + uuid.uuid4().hex[:6]),
                data.get("service_pattern", "*"),
                data.get("severity", "warning"),
                data.get("channel", "email"),
                data.get("recipients"),
            )
            self._send(200, {"route_id": rid})
        elif u.path == "/api/channel":
            cid = configure_channel(
                data.get("channel_name", "email"),
                data.get("webhook_url", ""),
                data.get("secret", ""),
            )
            self._send(200, {"channel_id": cid})
        elif u.path == "/api/rule":
            rid = create_rule(
                data.get("rule_name", "rule-" + uuid.uuid4().hex[:6]),
                data.get("service_name", "default"),
                data.get("condition_expr", ""),
                data.get("severity", "warning"),
                data.get("action", "send"),
                data.get("target_route", ""),
            )
            self._send(200, {"rule_id": rid})
        elif u.path == "/api/fire":
            result = fire_alert(
                data.get("service_name", "default"),
                data.get("severity", "warning"),
                data.get("title", "alert"),
                data.get("message", ""),
                data.get("dedup_key", ""),
            )
            self._send(200, result)
        elif u.path == "/api/aggregate":
            aid = aggregate_alerts(
                data.get("aggregation_key", "default"),
                data.get("services", []),
                data.get("severity", "warning"),
            )
            self._send(200, {"aggregation_id": aid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P0-66 统一告警接入")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"统一告警 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_alerting_report(), ensure_ascii=False, indent=2))

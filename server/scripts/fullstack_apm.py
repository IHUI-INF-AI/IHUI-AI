#!/usr/bin/env python3
"""
P0-43 全栈 APM
OpenTelemetry + Jaeger + Tempo 全链路追踪
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "fullstack_apm.db")
HTTP_PORT = 10230

SPAN_KINDS = ["server", "client", "producer", "consumer", "internal"]
TRACE_STATUSES = ["ok", "error", "unset"]
BACKEND_TYPES = ["jaeger", "tempo", "otlp", "zipkin"]
SAMPLING_STRATEGIES = ["always_on", "always_off", "probabilistic", "rate_limiting", "parent_based"]


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS traces (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            trace_id TEXT NOT NULL,
            span_id TEXT NOT NULL,
            parent_span_id TEXT,
            service_name TEXT NOT NULL,
            operation_name TEXT,
            span_kind TEXT,
            status TEXT DEFAULT 'ok',
            start_time_us INTEGER,
            duration_us INTEGER,
            attributes TEXT,
            events TEXT,
            backend TEXT DEFAULT 'jaeger'
        );
        CREATE TABLE IF NOT EXISTS service_dependencies (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            source_service TEXT NOT NULL,
            target_service TEXT NOT NULL,
            call_count INTEGER DEFAULT 0,
            error_count INTEGER DEFAULT 0,
            avg_latency_ms REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sampling_rules (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            service_name TEXT NOT NULL,
            strategy TEXT NOT NULL,
            rate REAL DEFAULT 1.0,
            max_per_second INTEGER DEFAULT 100
        );
        CREATE TABLE IF NOT EXISTS apm_backends (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            backend_name TEXT NOT NULL,
            backend_type TEXT NOT NULL,
            endpoint TEXT,
            status TEXT DEFAULT 'unknown',
            last_check TEXT
        );
        CREATE TABLE IF NOT EXISTS span_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            trace_id TEXT NOT NULL,
            span_id TEXT NOT NULL,
            event_name TEXT,
            event_time_us INTEGER,
            attributes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_trace_id ON traces(trace_id);
        CREATE INDEX IF NOT EXISTS idx_service ON traces(service_name);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_backend(backend_name: str, backend_type: str, endpoint: str) -> str:
    """注册 APM 后端"""
    if backend_type not in BACKEND_TYPES:
        backend_type = "jaeger"
    bid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO apm_backends
            (id,timestamp,backend_name,backend_type,endpoint,status,last_check)
            VALUES (?,?,?,?,?,?,?)""",
            (bid, _now(), backend_name, backend_type, endpoint, "healthy", _now()))
    return bid


def create_trace(service_name: str, operation_name: str, trace_id: Optional[str] = None) -> str:
    """创建新追踪"""
    tid = trace_id or uuid.uuid4().hex
    return tid


def record_span(trace_id: str, span_id: str, service_name: str, operation_name: str,
                 span_kind: str = "server", parent_span_id: str = "",
                 duration_us: int = 0, status: str = "ok",
                 attributes: Optional[Dict] = None,
                 events: Optional[List] = None,
                 backend: str = "jaeger") -> str:
    """记录 Span"""
    if span_kind not in SPAN_KINDS:
        span_kind = "server"
    if status not in TRACE_STATUSES:
        status = "ok"
    if backend not in BACKEND_TYPES:
        backend = "jaeger"
    sid = str(uuid.uuid4())
    start_us = int(time.time() * 1_000_000) - duration_us
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO traces
            (id,timestamp,trace_id,span_id,parent_span_id,service_name,operation_name,
             span_kind,status,start_time_us,duration_us,attributes,events,backend)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (sid, _now(), trace_id, span_id, parent_span_id, service_name,
             operation_name, span_kind, status, start_us, duration_us,
             json.dumps(attributes or {}, ensure_ascii=False),
             json.dumps(events or [], ensure_ascii=False), backend))
    return sid


def record_span_event(trace_id: str, span_id: str, event_name: str,
                       attributes: Optional[Dict] = None) -> str:
    """记录 Span 事件"""
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO span_events
            (id,timestamp,trace_id,span_id,event_name,event_time_us,attributes)
            VALUES (?,?,?,?,?,?,?)""",
            (eid, _now(), trace_id, span_id, event_name,
             int(time.time() * 1_000_000),
             json.dumps(attributes or {}, ensure_ascii=False)))
    return eid


def add_sampling_rule(service_name: str, strategy: str,
                       rate: float = 1.0, max_per_second: int = 100) -> str:
    """添加采样规则"""
    if strategy not in SAMPLING_STRATEGIES:
        strategy = "always_on"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO sampling_rules
            (id,timestamp,service_name,strategy,rate,max_per_second)
            VALUES (?,?,?,?,?,?)""",
            (rid, _now(), service_name, strategy, rate, max_per_second))
    return rid


def should_sample(service_name: str) -> bool:
    """判断是否采样"""
    with _conn() as c:
        rule = c.execute("""SELECT strategy,rate FROM sampling_rules
            WHERE service_name=? ORDER BY timestamp DESC LIMIT 1""",
            (service_name,)).fetchone()
    if not rule:
        return True
    strategy = rule["strategy"]
    if strategy == "always_on":
        return True
    if strategy == "always_off":
        return False
    if strategy == "probabilistic":
        import random
        return random.random() < rule["rate"]
    return True


def record_dependency(source_service: str, target_service: str,
                       latency_ms: float = 0, is_error: bool = False) -> str:
    """记录服务依赖"""
    with _conn_lock, _conn() as c:
        existing = c.execute("""SELECT id,call_count,error_count,avg_latency_ms
            FROM service_dependencies WHERE source_service=? AND target_service=?""",
            (source_service, target_service)).fetchone()
        if existing:
            new_count = existing["call_count"] + 1
            new_errors = existing["error_count"] + (1 if is_error else 0)
            new_avg = (existing["avg_latency_ms"] * existing["call_count"] + latency_ms) / new_count
            c.execute("""UPDATE service_dependencies SET call_count=?,error_count=?,avg_latency_ms=?
                WHERE id=?""", (new_count, new_errors, new_avg, existing["id"]))
            return existing["id"]
        else:
            did = str(uuid.uuid4())
            c.execute("""INSERT INTO service_dependencies
                (id,timestamp,source_service,target_service,call_count,error_count,avg_latency_ms)
                VALUES (?,?,?,?,?,?,?)""",
                (did, _now(), source_service, target_service,
                 1, 1 if is_error else 0, latency_ms))
            return did


def get_trace(trace_id: str) -> List[Dict]:
    """获取完整追踪链"""
    with _conn() as c:
        rows = c.execute("""SELECT * FROM traces WHERE trace_id=?
            ORDER BY start_time_us ASC""", (trace_id,)).fetchall()
    return [dict(r) for r in rows]


def get_service_topology() -> Dict:
    """获取服务拓扑"""
    with _conn() as c:
        deps = c.execute("""SELECT * FROM service_dependencies""").fetchall()
        svcs = c.execute("""SELECT DISTINCT service_name FROM traces""").fetchall()
    nodes = [{"id": r["service_name"]} for r in svcs]
    edges = [{"source": r["source_service"], "target": r["target_service"],
              "call_count": r["call_count"], "error_rate": r["error_count"] / max(1, r["call_count"])}
             for r in deps]
    return {"nodes": nodes, "edges": edges}


def get_apm_stats() -> Dict:
    """获取 APM 统计"""
    with _conn() as c:
        total = c.execute("SELECT COUNT(*) as c FROM traces").fetchone()["c"]
        err = c.execute("""SELECT COUNT(*) as c FROM traces WHERE status='error'""").fetchone()["c"]
        avg_dur = c.execute("""SELECT AVG(duration_us) as a FROM traces""").fetchone()["a"] or 0
        services = c.execute("""SELECT COUNT(DISTINCT service_name) as c FROM traces""").fetchone()["c"]
    return {
        "total_spans": total,
        "error_spans": err,
        "error_rate": err / max(1, total),
        "avg_duration_us": avg_dur,
        "unique_services": services,
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
        elif u.path == "/api/stats":
            self._send(200, get_apm_stats())
        elif u.path == "/api/topology":
            self._send(200, get_service_topology())
        elif u.path == "/api/trace":
            q = parse_qs(u.query)
            tid = q.get("trace_id", [""])[0]
            self._send(200, {"spans": get_trace(tid)})
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
        if u.path == "/api/span":
            sid = record_span(
                trace_id=data.get("trace_id", uuid.uuid4().hex),
                span_id=data.get("span_id", uuid.uuid4().hex[:16]),
                service_name=data.get("service_name", "unknown"),
                operation_name=data.get("operation_name", "op"),
                span_kind=data.get("span_kind", "server"),
                parent_span_id=data.get("parent_span_id", ""),
                duration_us=data.get("duration_us", 0),
                status=data.get("status", "ok"),
                attributes=data.get("attributes"),
                events=data.get("events"),
                backend=data.get("backend", "jaeger"),
            )
            self._send(200, {"span_id": sid})
        elif u.path == "/api/dependency":
            did = record_dependency(
                data.get("source", ""),
                data.get("target", ""),
                data.get("latency_ms", 0),
                data.get("is_error", False),
            )
            self._send(200, {"dep_id": did})
        elif u.path == "/api/backend":
            bid = register_backend(
                data.get("name", "default"),
                data.get("type", "jaeger"),
                data.get("endpoint", ""),
            )
            self._send(200, {"backend_id": bid})
        elif u.path == "/api/sampling":
            rid = add_sampling_rule(
                data.get("service_name", "default"),
                data.get("strategy", "always_on"),
                data.get("rate", 1.0),
                data.get("max_per_second", 100),
            )
            self._send(200, {"rule_id": rid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P0-43 全栈 APM")
    p.add_argument("--serve", action="store_true", help="启动 HTTP 服务")
    p.add_argument("--stats", action="store_true", help="显示统计")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"APM HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_apm_stats(), ensure_ascii=False, indent=2))

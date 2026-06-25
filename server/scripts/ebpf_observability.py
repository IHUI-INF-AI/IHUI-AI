#!/usr/bin/env python3
"""
eBPF 网络可观测性 (Cilium Tetragon 集成)
P0-21: 零侵入 L7 协议解析, 安全事件检测, trace 增强
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from collections import defaultdict
from datetime import timedelta
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "ebpf_observability.db")
HTTP_PORT = 10010
TETRAGON_NAMESPACE = "kube-system"
TETRAGON_DEPLOYMENT = "tetragon"

L7_PROTOCOLS = ["http", "grpc", "redis", "kafka", "mysql", "postgresql"]
SECURITY_EVENT_TYPES = [
    "privilege_escalation",
    "network_policy_violation",
    "sensitive_file_access",
    "unexpected_syscall",
    "process_exec_abnormal",
    "binary_execution_blocked",
]

# 协议端口识别
PROTOCOL_PORTS = {
    80: "http", 443: "http", 8080: "http", 8443: "http",
    6379: "redis", 6380: "redis",
    9092: "kafka", 9093: "kafka",
    3306: "mysql",
    5432: "postgresql",
    50051: "grpc", 50052: "grpc",
}

# trace_id 注入规则
TRACE_INJECTION_RULES = {
    "http": ["x-request-id", "x-trace-id", "traceparent", "x-b3-traceid"],
    "grpc": ["x-request-id", "grpc-trace-bin", "x-trace-id"],
    "redis": ["x-trace-id", "x-request-id"],
    "kafka": ["x-trace-id", "x-request-id"],
}


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS l7_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            protocol TEXT NOT NULL,
            src_pod TEXT,
            dst_pod TEXT,
            src_ip TEXT,
            dst_ip TEXT,
            src_port INTEGER,
            dst_port INTEGER,
            method TEXT,
            path TEXT,
            status_code INTEGER,
            latency_us INTEGER,
            trace_id TEXT,
            span_id TEXT
        );
        CREATE TABLE IF NOT EXISTS security_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            pod TEXT,
            namespace TEXT,
            process TEXT,
            syscall TEXT,
            args TEXT,
            blocked INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS trace_correlation (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            trace_id TEXT NOT NULL,
            pod TEXT,
            span_count INTEGER,
            ebpf_events INTEGER,
            app_spans INTEGER,
            correlation_score REAL
        );
        CREATE TABLE IF NOT EXISTS kprobe_status (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            hook TEXT NOT NULL,
            function TEXT NOT NULL,
            attached INTEGER,
            events_per_sec INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_l7_timestamp ON l7_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_l7_trace ON l7_events(trace_id);
        CREATE INDEX IF NOT EXISTS idx_security_timestamp ON security_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_correlation_trace ON trace_correlation(trace_id);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def detect_protocol(port: int, payload: str = "") -> str:
    """协议识别"""
    if port in PROTOCOL_PORTS:
        return PROTOCOL_PORTS[port]
    pl = payload.lower().lstrip()
    if not pl:
        return "unknown"
    if pl.startswith("get ") or pl.startswith("post ") or pl.startswith("put ") \
            or pl.startswith("delete ") or pl.startswith("head ") \
            or pl.startswith("http/"):
        return "http"
    if pl.startswith("*"):
        return "redis"
    if pl.startswith("$"):
        return "redis"
    if pl[:4] in ("ping", "subs", "auth", "quit", "echo", "info"):
        return "redis"
    if "grpc" in pl[:50] or pl.startswith("\x00\x00\x00"):
        return "grpc"
    return "unknown"


def extract_trace_id(protocol: str, headers: Dict[str, str]) -> Optional[str]:
    """从协议头提取 trace_id"""
    # traceparent: 00-{trace_id}-{parent_id}-{flags}, 提取第二段
    tp = headers.get("traceparent", "").strip()
    if tp:
        parts = tp.split("-")
        if len(parts) >= 2 and len(parts[1]) == 32:
            return parts[1]
    rules = TRACE_INJECTION_RULES.get(protocol, [])
    for key in rules:
        if key == "traceparent":
            continue
        v = headers.get(key, "").strip()
        if v and len(v) >= 16:
            return v[:32]
    return None


def record_l7_event(protocol: str, src_pod: str, dst_pod: str,
                    src_ip: str, dst_ip: str, src_port: int, dst_port: int,
                    method: str = "", path: str = "", status_code: int = 0,
                    latency_us: int = 0, trace_id: str = "",
                    span_id: str = "") -> str:
    """记录 L7 事件"""
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO l7_events
            (id,timestamp,protocol,src_pod,dst_pod,src_ip,dst_ip,
             src_port,dst_port,method,path,status_code,latency_us,trace_id,span_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (eid, _now(), protocol, src_pod, dst_pod, src_ip, dst_ip,
             src_port, dst_port, method, path, status_code, latency_us, trace_id, span_id))
    return eid


def record_security_event(event_type: str, severity: str,
                          pod: str, namespace: str, process: str,
                          syscall: str = "", args: str = "",
                          blocked: bool = False) -> str:
    """记录安全事件"""
    if event_type not in SECURITY_EVENT_TYPES:
        event_type = "unexpected_syscall"
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO security_events
            (id,timestamp,event_type,severity,pod,namespace,
             process,syscall,args,blocked)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (eid, _now(), event_type, severity, pod, namespace,
             process, syscall, args, 1 if blocked else 0))
    return eid


def correlate_trace(trace_id: str, pod: str,
                    ebpf_events: int, app_spans: int) -> float:
    """trace 关联打分, 返回相关度 (0.0-1.0)"""
    if not trace_id:
        return 0.0
    total = ebpf_events + app_spans
    if total == 0:
        return 0.0
    ebpf_ratio = ebpf_events / total
    score = 0.4 + 0.6 * ebpf_ratio
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO trace_correlation
            (id,timestamp,trace_id,pod,span_count,ebpf_events,app_spans,correlation_score)
            VALUES (?,?,?,?,?,?,?,?)""",
            (cid, _now(), trace_id, pod, total, ebpf_events, app_spans, score))
    return round(score, 4)


def register_kprobe(hook: str, function: str,
                    attached: bool = True, events_per_sec: int = 0) -> str:
    """注册 kprobe 状态"""
    kid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO kprobe_status
            (id,timestamp,hook,function,attached,events_per_sec)
            VALUES (?,?,?,?,?,?)""",
            (kid, _now(), hook, function, 1 if attached else 0, events_per_sec))
    return kid


def get_protocol_stats(minutes: int = 60) -> Dict[str, Any]:
    """协议统计"""
    since = (utcnow() - timedelta(minutes=minutes)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT protocol, COUNT(*) as cnt,
            AVG(latency_us) as avg_latency
            FROM l7_events WHERE timestamp >= ?
            GROUP BY protocol ORDER BY cnt DESC""", (since,)).fetchall()
    return {r["protocol"]: {
        "count": r["cnt"],
        "avg_latency_us": round(r["avg_latency"] or 0, 2),
    } for r in rows}


def get_security_summary(hours: int = 24) -> Dict[str, Any]:
    """安全事件汇总"""
    since = (utcnow() - timedelta(hours=hours)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT event_type, severity, COUNT(*) as cnt,
            SUM(blocked) as blocked_cnt
            FROM security_events WHERE timestamp >= ?
            GROUP BY event_type, severity ORDER BY cnt DESC""", (since,)).fetchall()
    total = sum(r["cnt"] for r in rows)
    blocked = sum(r["blocked_cnt"] or 0 for r in rows)
    return {
        "total_events": total,
        "blocked_events": blocked,
        "block_rate": round(blocked / total, 4) if total else 0.0,
        "by_type": [
            {"event_type": r["event_type"], "severity": r["severity"],
             "count": r["cnt"], "blocked": r["blocked_cnt"] or 0}
            for r in rows
        ],
    }


def get_top_talkers(minutes: int = 5, limit: int = 10) -> List[Dict[str, Any]]:
    """流量 Top N"""
    since = (utcnow() - timedelta(minutes=minutes)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT src_pod, dst_pod, protocol, COUNT(*) as cnt,
            AVG(latency_us) as avg_latency
            FROM l7_events WHERE timestamp >= ?
            GROUP BY src_pod, dst_pod, protocol
            ORDER BY cnt DESC LIMIT ?""", (since, limit)).fetchall()
    return [dict(r) for r in rows]


def get_tetragon_status() -> Dict[str, Any]:
    """tetragon 部署状态"""
    return {
        "namespace": TETRAGON_NAMESPACE,
        "deployment": TETRAGON_DEPLOYMENT,
        "hooks": ["kprobe", "tracepoint", "uprobe", "lsm"],
        "l7_protocols": L7_PROTOCOLS,
    }


def get_active_probes() -> List[Dict[str, Any]]:
    """活跃 kprobe 列表"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT hook, function, MAX(timestamp) as last_seen,
            AVG(events_per_sec) as avg_eps
            FROM kprobe_status
            WHERE attached = 1
            GROUP BY hook, function ORDER BY hook""").fetchall()
    return [{"hook": r["hook"], "function": r["function"],
             "last_seen": r["last_seen"], "avg_events_per_sec": round(r["avg_eps"] or 0, 2)}
            for r in rows]


def _send_dingtalk(title: str, content: str) -> None:
    """发送钉钉告警 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "title": title, "content": content,
            "source": "ebpf_observability",
        }, ensure_ascii=False) + "\n")


def detect_anomaly(protocol: str) -> bool:
    """异常检测: 错误率超过 10% 触发告警"""
    since = (utcnow() - timedelta(minutes=5)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        total = c.execute("""SELECT COUNT(*) as cnt FROM l7_events
            WHERE protocol = ? AND timestamp >= ?""", (protocol, since)).fetchone()["cnt"]
        errors = c.execute("""SELECT COUNT(*) as cnt FROM l7_events
            WHERE protocol = ? AND status_code >= 500 AND timestamp >= ?""",
            (protocol, since)).fetchone()["cnt"]
    if total >= 50 and errors / total > 0.1:
        _send_dingtalk(f"eBPF 异常: {protocol}", f"5xx 错误率 {round(errors/total*100, 2)}%")
        return True
    return False


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def _json(self, code: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        u = urlparse(self.path)
        path = u.path
        qs = parse_qs(u.query)
        if path == "/health":
            self._json(200, {"status": "ok", "service": "ebpf_observability"})
        elif path == "/api/l7/stats":
            minutes = int(qs.get("minutes", ["60"])[0])
            self._json(200, get_protocol_stats(minutes))
        elif path == "/api/security/summary":
            hours = int(qs.get("hours", ["24"])[0])
            self._json(200, get_security_summary(hours))
        elif path == "/api/l7/top-talkers":
            minutes = int(qs.get("minutes", ["5"])[0])
            limit = int(qs.get("limit", ["10"])[0])
            self._json(200, get_top_talkers(minutes, limit))
        elif path == "/api/tetragon/status":
            self._json(200, get_tetragon_status())
        elif path == "/api/probes/active":
            self._json(200, {"probes": get_active_probes()})
        else:
            self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        u = urlparse(self.path)
        path = u.path
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
        if path == "/api/l7/event":
            eid = record_l7_event(
                protocol=data.get("protocol", "http"),
                src_pod=data.get("src_pod", ""),
                dst_pod=data.get("dst_pod", ""),
                src_ip=data.get("src_ip", ""),
                dst_ip=data.get("dst_ip", ""),
                src_port=data.get("src_port", 0),
                dst_port=data.get("dst_port", 0),
                method=data.get("method", ""),
                path=data.get("path", ""),
                status_code=data.get("status_code", 0),
                latency_us=data.get("latency_us", 0),
                trace_id=data.get("trace_id", ""),
                span_id=data.get("span_id", ""),
            )
            self._json(201, {"id": eid})
        elif path == "/api/security/event":
            eid = record_security_event(
                event_type=data.get("event_type", "unexpected_syscall"),
                severity=data.get("severity", "low"),
                pod=data.get("pod", ""),
                namespace=data.get("namespace", "default"),
                process=data.get("process", ""),
                syscall=data.get("syscall", ""),
                args=data.get("args", ""),
                blocked=data.get("blocked", False),
            )
            self._json(201, {"id": eid})
        elif path == "/api/trace/correlate":
            score = correlate_trace(
                trace_id=data.get("trace_id", ""),
                pod=data.get("pod", ""),
                ebpf_events=data.get("ebpf_events", 0),
                app_spans=data.get("app_spans", 0),
            )
            self._json(200, {"correlation_score": score})
        elif path == "/api/probe/register":
            kid = register_kprobe(
                hook=data.get("hook", "kprobe"),
                function=data.get("function", ""),
                attached=data.get("attached", True),
                events_per_sec=data.get("events_per_sec", 0),
            )
            self._json(201, {"id": kid})
        elif path == "/api/anomaly/detect":
            protocol = data.get("protocol", "http")
            triggered = detect_anomaly(protocol)
            self._json(200, {"triggered": triggered})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"eBPF Observability service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_record_l7(args: List[str]) -> None:
    fields = ["protocol", "src_pod", "dst_pod", "src_ip", "dst_ip",
              "src_port", "dst_port", "method", "path", "status_code",
              "latency_us", "trace_id", "span_id"]
    data = {f: (args[i] if i < len(args) else "") for i, f in enumerate(fields)}
    eid = record_l7_event(
        protocol=data["protocol"] or "http",
        src_pod=data["src_pod"], dst_pod=data["dst_pod"],
        src_ip=data["src_ip"], dst_ip=data["dst_ip"],
        src_port=int(data["src_port"] or 0),
        dst_port=int(data["dst_port"] or 0),
        method=data["method"], path=data["path"],
        status_code=int(data["status_code"] or 0),
        latency_us=int(data["latency_us"] or 0),
        trace_id=data["trace_id"], span_id=data["span_id"],
    )
    print(json.dumps({"id": eid, "status": "recorded"}, ensure_ascii=False))


def cmd_record_security(args: List[str]) -> None:
    fields = ["event_type", "severity", "pod", "namespace",
              "process", "syscall", "args", "blocked"]
    data = {f: (args[i] if i < len(args) else "") for i, f in enumerate(fields)}
    eid = record_security_event(
        event_type=data["event_type"] or "unexpected_syscall",
        severity=data["severity"] or "low",
        pod=data["pod"], namespace=data["namespace"] or "default",
        process=data["process"], syscall=data["syscall"],
        args=data["args"], blocked=data["blocked"].lower() == "true",
    )
    print(json.dumps({"id": eid, "status": "recorded"}, ensure_ascii=False))


def cmd_stats(args: List[str]) -> None:
    minutes = int(args[0]) if args else 60
    print(json.dumps(get_protocol_stats(minutes), ensure_ascii=False, indent=2))


def cmd_security(args: List[str]) -> None:
    hours = int(args[0]) if args else 24
    print(json.dumps(get_security_summary(hours), ensure_ascii=False, indent=2))


def cmd_top(args: List[str]) -> None:
    minutes = int(args[0]) if args else 5
    limit = int(args[1]) if len(args) > 1 else 10
    print(json.dumps(get_top_talkers(minutes, limit), ensure_ascii=False, indent=2))


def cmd_probes(_args: List[str]) -> None:
    print(json.dumps(get_active_probes(), ensure_ascii=False, indent=2))


def cmd_status(_args: List[str]) -> None:
    print(json.dumps(get_tetragon_status(), ensure_ascii=False, indent=2))


def cmd_detect(args: List[str]) -> None:
    protocol = args[0] if args else "http"
    triggered = detect_anomaly(protocol)
    print(json.dumps({"protocol": protocol, "triggered": triggered}, ensure_ascii=False))


def cmd_register_probe(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: register-probe <hook> <function> [eps]")
        return
    eps = int(args[2]) if len(args) > 2 else 0
    kid = register_kprobe(args[0], args[1], True, eps)
    print(json.dumps({"id": kid, "status": "registered"}, ensure_ascii=False))


def cmd_detect_port(args: List[str]) -> None:
    if not args:
        print("usage: detect-port <port> [payload]")
        return
    port = int(args[0])
    payload = args[1] if len(args) > 1 else ""
    print(detect_protocol(port, payload))


def cmd_extract_trace(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: extract-trace <protocol> <header_json>")
        return
    try:
        headers = json.loads(args[1])
    except json.JSONDecodeError:
        headers = {}
    print(extract_trace_id(args[0], headers) or "")


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "record-l7": cmd_record_l7,
        "record-security": cmd_record_security, "stats": cmd_stats,
        "security": cmd_security, "top": cmd_top, "probes": cmd_probes,
        "status": cmd_status, "detect": cmd_detect,
        "register-probe": cmd_register_probe, "detect-port": cmd_detect_port,
        "extract-trace": cmd_extract_trace,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

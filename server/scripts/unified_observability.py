#!/usr/bin/env python3
"""
全局可观测性大盘
P0-32: 统一 SLO/SLI 大盘, 业务+技术双视图, 服务注册, 健康聚合, 告警统一路由
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from datetime import timedelta
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "unified_observability.db")
HTTP_PORT = 10120

SLO_TARGETS = ["availability", "latency_p99", "error_rate", "throughput"]
DASHBOARD_VIEWS = ["business", "technical", "executive", "ops"]
ALERT_SEVERITIES = ["critical", "warning", "info"]


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            service_name TEXT NOT NULL UNIQUE,
            endpoint TEXT,
            port INTEGER,
            tier TEXT,
            owner TEXT,
            tags TEXT,
            status TEXT DEFAULT 'unknown',
            last_health_check TEXT
        );
        CREATE TABLE IF NOT EXISTS sli_metrics (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            service_name TEXT NOT NULL,
            metric_type TEXT NOT NULL,
            value REAL,
            unit TEXT,
            window_seconds INTEGER DEFAULT 60
        );
        CREATE TABLE IF NOT EXISTS slo_records (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            service_name TEXT NOT NULL,
            slo_name TEXT NOT NULL,
            target REAL,
            actual REAL,
            compliance_pct REAL,
            error_budget_remaining REAL
        );
        CREATE TABLE IF NOT EXISTS alert_routes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            alert_name TEXT NOT NULL,
            severity TEXT,
            target_service TEXT,
            route_path TEXT,
            condition_expr TEXT,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS alert_history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            alert_name TEXT,
            severity TEXT,
            service_name TEXT,
            message TEXT,
            value REAL,
            threshold REAL,
            status TEXT DEFAULT 'firing'
        );
        CREATE TABLE IF NOT EXISTS dashboards (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            dashboard_name TEXT NOT NULL UNIQUE,
            view_type TEXT,
            panels TEXT,
            refresh_interval INTEGER DEFAULT 30,
            owner TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sli_service ON sli_metrics(service_name);
        CREATE INDEX IF NOT EXISTS idx_alert_history_service ON alert_history(service_name);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_service(service_name: str, endpoint: str, port: int,
                      tier: str = "backend", owner: str = "",
                      tags: Optional[List[str]] = None) -> str:
    """注册服务到可观测性平台"""
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO services
            (id,timestamp,service_name,endpoint,port,tier,owner,tags,status,last_health_check)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (sid, _now(), service_name, endpoint, port, tier, owner,
             json.dumps(tags or [], ensure_ascii=False), "unknown", ""))
    return sid


def record_sli(service_name: str, metric_type: str, value: float,
                unit: str = "", window_seconds: int = 60) -> str:
    """记录 SLI 指标"""
    if metric_type not in SLO_TARGETS:
        metric_type = "availability"
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO sli_metrics
            (id,timestamp,service_name,metric_type,value,unit,window_seconds)
            VALUES (?,?,?,?,?,?,?)""",
            (mid, _now(), service_name, metric_type, value, unit, window_seconds))
    return mid


def record_slo(service_name: str, slo_name: str, target: float,
                actual: float) -> str:
    """记录 SLO 合规性"""
    if target > 0:
        compliance = min(100.0, (actual / target) * 100) if slo_name != "error_rate" else max(0, 100 - (actual / target) * 100)
    else:
        compliance = 100.0
    error_budget = max(0.0, 100.0 - compliance)
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO slo_records
            (id,timestamp,service_name,slo_name,target,actual,compliance_pct,error_budget_remaining)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), service_name, slo_name, target, actual,
             compliance, error_budget))
    return rid


def create_alert_route(alert_name: str, severity: str, target_service: str,
                        route_path: str, condition_expr: str = "") -> str:
    """创建告警路由"""
    if severity not in ALERT_SEVERITIES:
        severity = "warning"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO alert_routes
            (id,timestamp,alert_name,severity,target_service,route_path,condition_expr,enabled)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), alert_name, severity, target_service, route_path,
             condition_expr, 1))
    return rid


def fire_alert(alert_name: str, severity: str, service_name: str,
                message: str, value: float = 0, threshold: float = 0) -> str:
    """触发告警"""
    if severity not in ALERT_SEVERITIES:
        severity = "warning"
    aid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO alert_history
            (id,timestamp,alert_name,severity,service_name,message,value,threshold,status)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (aid, _now(), alert_name, severity, service_name, message,
             value, threshold, "firing"))
    return aid


def resolve_alert(alert_id: str) -> bool:
    """解决告警"""
    with _conn_lock, _conn() as c:
        cur = c.execute("""UPDATE alert_history SET status = 'resolved'
            WHERE id = ?""", (alert_id,))
        return cur.rowcount > 0


def check_health(service_name: str) -> Dict[str, Any]:
    """检查服务健康"""
    import urllib.request
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM services WHERE service_name = ?""",
                          (service_name,)).fetchone()
    if not row:
        return {"service": service_name, "status": "unknown", "error": "not_registered"}
    url = f"http://{row['endpoint']}:{row['port']}/health"
    start = time.time()
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            latency = (time.time() - start) * 1000
            data = r.read().decode("utf-8")
            status = "healthy" if r.status == 200 else "degraded"
            with _conn_lock, _conn() as c:
                c.execute("""UPDATE services SET status = ?, last_health_check = ?
                    WHERE service_name = ?""", (status, _now(), service_name))
            return {"service": service_name, "status": status,
                    "latency_ms": round(latency, 2), "endpoint": url}
    except Exception as e:
        with _conn_lock, _conn() as c:
            c.execute("""UPDATE services SET status = ?, last_health_check = ?
                WHERE service_name = ?""", ("unhealthy", _now(), service_name))
        return {"service": service_name, "status": "unhealthy", "error": str(e)[:200],
                "endpoint": url}


def create_dashboard(dashboard_name: str, view_type: str, panels: List[Dict],
                      refresh_interval: int = 30, owner: str = "") -> str:
    """创建大盘"""
    if view_type not in DASHBOARD_VIEWS:
        view_type = "technical"
    did = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO dashboards
            (id,timestamp,dashboard_name,view_type,panels,refresh_interval,owner)
            VALUES (?,?,?,?,?,?,?)""",
            (did, _now(), dashboard_name, view_type,
             json.dumps(panels, ensure_ascii=False), refresh_interval, owner))
    return did


def get_dashboard(dashboard_name: str) -> Optional[Dict[str, Any]]:
    """获取大盘"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM dashboards WHERE dashboard_name = ?""",
                          (dashboard_name,)).fetchone()
    if not row:
        return None
    return {"name": row["dashboard_name"], "view_type": row["view_type"],
            "panels": json.loads(row["panels"] or "[]"),
            "refresh_interval": row["refresh_interval"], "owner": row["owner"]}


def get_overview() -> Dict[str, Any]:
    """获取全局概览"""
    with _conn_lock, _conn() as c:
        total = c.execute("SELECT COUNT(*) as c FROM services").fetchone()["c"]
        healthy = c.execute("SELECT COUNT(*) as c FROM services WHERE status = 'healthy'").fetchone()["c"]
        unhealthy = c.execute("SELECT COUNT(*) as c FROM services WHERE status = 'unhealthy'").fetchone()["c"]
        firing = c.execute("SELECT COUNT(*) as c FROM alert_history WHERE status = 'firing'").fetchone()["c"]
        critical = c.execute("""SELECT COUNT(*) as c FROM alert_history
            WHERE status = 'firing' AND severity = 'critical'""").fetchone()["c"]
        warning = c.execute("""SELECT COUNT(*) as c FROM alert_history
            WHERE status = 'firing' AND severity = 'warning'""").fetchone()["c"]
    return {
        "total_services": total,
        "healthy_services": healthy,
        "unhealthy_services": unhealthy,
        "firing_alerts": firing,
        "critical_alerts": critical,
        "warning_alerts": warning,
        "health_score": round((healthy / total * 100) if total > 0 else 0, 2),
    }


def get_service_summary() -> List[Dict[str, Any]]:
    """获取服务摘要"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT service_name, tier, status, last_health_check
            FROM services ORDER BY service_name""").fetchall()
    return [{"name": r["service_name"], "tier": r["tier"],
             "status": r["status"], "last_check": r["last_health_check"]}
            for r in rows]


def evaluate_slo_compliance() -> Dict[str, Any]:
    """评估 SLO 合规"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT service_name, AVG(compliance_pct) as avg_compliance,
            AVG(error_budget_remaining) as avg_budget
            FROM slo_records GROUP BY service_name""").fetchall()
    services = [{"service": r["service_name"],
                 "avg_compliance": round(r["avg_compliance"] or 0, 2),
                 "avg_error_budget": round(r["avg_budget"] or 0, 2)} for r in rows]
    return {"services": services, "total": len(services)}


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "unified_observability"}, ensure_ascii=False) + "\n")


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
            self._json(200, {"status": "ok", "service": "unified_observability"})
        elif path == "/api/overview":
            self._json(200, get_overview())
        elif path == "/api/services":
            self._json(200, {"services": get_service_summary()})
        elif path == "/api/slo/compliance":
            self._json(200, evaluate_slo_compliance())
        elif path.startswith("/api/dashboard/"):
            name = path[15:]
            d = get_dashboard(name)
            if d:
                self._json(200, d)
            else:
                self._json(404, {"error": "not_found"})
        elif path.startswith("/api/health/"):
            svc = path[13:]
            self._json(200, check_health(svc))
        elif path == "/api/alerts/firing":
            with _conn_lock, _conn() as c:
                rows = c.execute("""SELECT * FROM alert_history
                    WHERE status = 'firing' ORDER BY timestamp DESC LIMIT 100""").fetchall()
            self._json(200, {"alerts": [dict(r) for r in rows]})
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
        if path == "/api/service/register":
            sid = register_service(
                service_name=data.get("service_name", ""),
                endpoint=data.get("endpoint", "127.0.0.1"),
                port=data.get("port", 0),
                tier=data.get("tier", "backend"),
                owner=data.get("owner", ""),
                tags=data.get("tags", []),
            )
            self._json(201, {"id": sid})
        elif path == "/api/sli/record":
            mid = record_sli(
                service_name=data.get("service_name", ""),
                metric_type=data.get("metric_type", "availability"),
                value=data.get("value", 0.0),
                unit=data.get("unit", ""),
                window_seconds=data.get("window_seconds", 60),
            )
            self._json(201, {"id": mid})
        elif path == "/api/slo/record":
            rid = record_slo(
                service_name=data.get("service_name", ""),
                slo_name=data.get("slo_name", ""),
                target=data.get("target", 0.0),
                actual=data.get("actual", 0.0),
            )
            self._json(201, {"id": rid})
        elif path == "/api/alert/route":
            rid = create_alert_route(
                alert_name=data.get("alert_name", ""),
                severity=data.get("severity", "warning"),
                target_service=data.get("target_service", ""),
                route_path=data.get("route_path", ""),
                condition_expr=data.get("condition_expr", ""),
            )
            self._json(201, {"id": rid})
        elif path == "/api/alert/fire":
            aid = fire_alert(
                alert_name=data.get("alert_name", ""),
                severity=data.get("severity", "warning"),
                service_name=data.get("service_name", ""),
                message=data.get("message", ""),
                value=data.get("value", 0.0),
                threshold=data.get("threshold", 0.0),
            )
            self._json(201, {"id": aid})
        elif path == "/api/alert/resolve":
            ok = resolve_alert(data.get("alert_id", ""))
            self._json(200, {"resolved": ok})
        elif path == "/api/dashboard/create":
            did = create_dashboard(
                dashboard_name=data.get("dashboard_name", ""),
                view_type=data.get("view_type", "technical"),
                panels=data.get("panels", []),
                refresh_interval=data.get("refresh_interval", 30),
                owner=data.get("owner", ""),
            )
            self._json(201, {"id": did})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Unified Observability service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_register(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: register <name> <endpoint> <port> [tier] [owner]")
        return
    tier = args[3] if len(args) > 3 else "backend"
    owner = args[4] if len(args) > 4 else ""
    sid = register_service(args[0], args[1], int(args[2]), tier, owner)
    print(json.dumps({"id": sid}, ensure_ascii=False))


def cmd_sli(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: sli <service> <metric_type> <value> [unit]")
        return
    unit = args[4] if len(args) > 4 else ""
    mid = record_sli(args[0], args[1], float(args[2]), unit)
    print(json.dumps({"id": mid}, ensure_ascii=False))


def cmd_slo(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: slo <service> <name> <target> <actual>")
        return
    rid = record_slo(args[0], args[1], float(args[2]), float(args[3]))
    print(json.dumps({"id": rid}, ensure_ascii=False))


def cmd_fire(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: fire <alert_name> <severity> <service> <message>")
        return
    aid = fire_alert(args[0], args[1], args[2], args[3])
    print(json.dumps({"id": aid}, ensure_ascii=False))


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_overview(), ensure_ascii=False, indent=2))


def cmd_services(_args: List[str]) -> None:
    print(json.dumps(get_service_summary(), ensure_ascii=False, indent=2))


def cmd_compliance(_args: List[str]) -> None:
    print(json.dumps(evaluate_slo_compliance(), ensure_ascii=False, indent=2))


def cmd_health(args: List[str]) -> None:
    if not args:
        print("usage: health <service_name>")
        return
    print(json.dumps(check_health(args[0]), ensure_ascii=False, indent=2))


def cmd_route(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: route <alert_name> <severity> <target_service> <route_path>")
        return
    rid = create_alert_route(args[0], args[1], args[2], args[3])
    print(json.dumps({"id": rid}, ensure_ascii=False))


def cmd_dashboard(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: dashboard <name> <view_type> [panels_json_file]")
        return
    view = args[1] if len(args) > 1 else "technical"
    panels = [{"title": "Default", "type": "graph", "targets": []}]
    did = create_dashboard(args[0], view, panels)
    print(json.dumps({"id": did}, ensure_ascii=False))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "register": cmd_register, "sli": cmd_sli,
            "slo": cmd_slo, "fire": cmd_fire, "overview": cmd_overview,
            "services": cmd_services, "compliance": cmd_compliance,
            "health": cmd_health, "route": cmd_route, "dashboard": cmd_dashboard}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

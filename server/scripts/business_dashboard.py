#!/usr/bin/env python3
"""
业务监控大盘
P1-25: 业务指标, 用户行为漏斗, 实时大屏, 自定义告警规则
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "business_dashboard.db")
HTTP_PORT = 10050

METRIC_TYPES = ["counter", "gauge", "histogram", "summary"]
FUNNEL_STAGES = ["visit", "browse", "cart", "checkout", "payment", "complete"]
BUSINESS_METRICS = [
    "order_count", "payment_success_rate", "register_count",
    "active_users", "revenue", "cart_abandonment_rate", "avg_order_value",
    "conversion_rate", "bounce_rate", "session_duration",
]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS business_metrics (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            metric_name TEXT NOT NULL,
            metric_type TEXT,
            value REAL,
            dimensions TEXT
        );
        CREATE TABLE IF NOT EXISTS funnel_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            user_id TEXT,
            session_id TEXT,
            stage TEXT,
            value REAL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS dashboard_panels (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            panel_id TEXT NOT NULL UNIQUE,
            title TEXT,
            panel_type TEXT,
            query TEXT,
            config TEXT,
            position INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS custom_alerts (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            name TEXT NOT NULL UNIQUE,
            metric_name TEXT,
            condition TEXT,
            threshold REAL,
            duration_seconds INTEGER,
            severity TEXT,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS screen_layouts (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            screen_id TEXT NOT NULL UNIQUE,
            name TEXT,
            panels TEXT,
            refresh_interval INTEGER DEFAULT 30
        );
        CREATE INDEX IF NOT EXISTS idx_bm_ts ON business_metrics(timestamp);
        CREATE INDEX IF NOT EXISTS idx_bm_name ON business_metrics(metric_name);
        CREATE INDEX IF NOT EXISTS idx_funnel_ts ON funnel_events(timestamp);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def record_metric(metric_name: str, value: float, metric_type: str = "gauge",
                   dimensions: Optional[Dict[str, str]] = None) -> str:
    """记录业务指标"""
    if metric_type not in METRIC_TYPES:
        metric_type = "gauge"
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO business_metrics
            (id,timestamp,metric_name,metric_type,value,dimensions)
            VALUES (?,?,?,?,?,?)""",
            (mid, _now(), metric_name, metric_type, value,
             json.dumps(dimensions or {}, ensure_ascii=False)))
    return mid


def get_metric_latest(metric_name: str) -> Optional[Dict[str, Any]]:
    """获取指标最新值"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM business_metrics
            WHERE metric_name = ? ORDER BY timestamp DESC LIMIT 1""",
            (metric_name,)).fetchone()
    if not row:
        return None
    return {"metric_name": row["metric_name"],
            "value": row["value"],
            "metric_type": row["metric_type"],
            "timestamp": row["timestamp"],
            "dimensions": json.loads(row["dimensions"] or "{}")}


def get_metric_history(metric_name: str, hours: int = 24,
                        limit: int = 1000) -> List[Dict[str, Any]]:
    """获取指标历史"""
    since = (datetime.utcnow() - timedelta(hours=hours)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT timestamp, value FROM business_metrics
            WHERE metric_name = ? AND timestamp >= ?
            ORDER BY timestamp ASC LIMIT ?""",
            (metric_name, since, limit)).fetchall()
    return [{"timestamp": r["timestamp"], "value": r["value"]} for r in rows]


def calculate_metric_stats(metric_name: str, hours: int = 24) -> Dict[str, Any]:
    """计算指标统计"""
    since = (datetime.utcnow() - timedelta(hours=hours)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT COUNT(*) as cnt,
            AVG(value) as avg_v, MIN(value) as min_v, MAX(value) as max_v
            FROM business_metrics
            WHERE metric_name = ? AND timestamp >= ?""",
            (metric_name, since)).fetchone()
    return {
        "metric_name": metric_name,
        "count": row["cnt"] or 0,
        "avg": round(row["avg_v"] or 0, 4),
        "min": round(row["min_v"] or 0, 4),
        "max": round(row["max_v"] or 0, 4),
    }


def record_funnel_event(user_id: str, session_id: str, stage: str,
                         value: float = 1) -> str:
    """记录漏斗事件"""
    if stage not in FUNNEL_STAGES:
        return ""
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO funnel_events
            (id,timestamp,user_id,session_id,stage,value)
            VALUES (?,?,?,?,?,?)""",
            (eid, _now(), user_id, session_id, stage, value))
    return eid


def calculate_funnel(hours: int = 24) -> Dict[str, Any]:
    """计算漏斗转化"""
    since = (datetime.utcnow() - timedelta(hours=hours)).isoformat() + "Z"
    result = {"window_hours": hours, "stages": []}
    prev_count = 0
    with _conn_lock, _conn() as c:
        for stage in FUNNEL_STAGES:
            row = c.execute("""SELECT COUNT(DISTINCT user_id) as users,
                COUNT(*) as events FROM funnel_events
                WHERE stage = ? AND timestamp >= ?""", (stage, since)).fetchone()
            count = row["users"] or 0
            events = row["events"] or 0
            conversion = round(count / prev_count * 100, 2) if prev_count else 100.0
            result["stages"].append({
                "stage": stage,
                "users": count,
                "events": events,
                "conversion_from_previous": conversion,
            })
            prev_count = count if count else prev_count
    overall = result["stages"][-1]["users"] if result["stages"] else 0
    initial = result["stages"][0]["users"] if result["stages"] else 1
    result["overall_conversion"] = round(overall / initial * 100, 2) if initial else 0.0
    return result


def create_dashboard_panel(panel_id: str, title: str, panel_type: str,
                            query: str, config: Optional[Dict[str, Any]] = None,
                            position: int = 0) -> str:
    """创建仪表盘面板"""
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO dashboard_panels
            (id,timestamp,panel_id,title,panel_type,query,config,position)
            VALUES (?,?,?,?,?,?,?,?)""",
            (pid, _now(), panel_id, title, panel_type, query,
             json.dumps(config or {}, ensure_ascii=False), position))
    return pid


def list_dashboard_panels() -> List[Dict[str, Any]]:
    """列出所有面板"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT * FROM dashboard_panels
            ORDER BY position ASC""").fetchall()
    return [{"panel_id": r["panel_id"], "title": r["title"],
             "panel_type": r["panel_type"], "query": r["query"],
             "config": json.loads(r["config"] or "{}"),
             "position": r["position"]} for r in rows]


def create_custom_alert(name: str, metric_name: str, condition: str,
                         threshold: float, duration_seconds: int = 300,
                         severity: str = "warning") -> str:
    """创建自定义告警"""
    aid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO custom_alerts
            (id,timestamp,name,metric_name,condition,threshold,
             duration_seconds,severity,enabled)
            VALUES (?,?,?,?,?,?,?,?,1)""",
            (aid, _now(), name, metric_name, condition,
             threshold, duration_seconds, severity))
    return aid


def evaluate_condition(value: float, condition: str, threshold: float) -> bool:
    """评估条件"""
    if condition == "gt":
        return value > threshold
    if condition == "lt":
        return value < threshold
    if condition == "gte":
        return value >= threshold
    if condition == "lte":
        return value <= threshold
    if condition == "eq":
        return value == threshold
    if condition == "ne":
        return value != threshold
    return False


def check_custom_alerts() -> List[Dict[str, Any]]:
    """检查自定义告警"""
    triggered = []
    with _conn_lock, _conn() as c:
        alerts = c.execute("""SELECT * FROM custom_alerts WHERE enabled = 1""").fetchall()
    for a in alerts:
        latest = get_metric_latest(a["metric_name"])
        if not latest:
            continue
        if evaluate_condition(latest["value"], a["condition"], a["threshold"]):
            triggered.append({
                "alert_name": a["name"],
                "metric_name": a["metric_name"],
                "current_value": latest["value"],
                "threshold": a["threshold"],
                "condition": a["condition"],
                "severity": a["severity"],
            })
    return triggered


def create_screen(screen_id: str, name: str, panels: List[str],
                   refresh_interval: int = 30) -> str:
    """创建大屏布局"""
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO screen_layouts
            (id,timestamp,screen_id,name,panels,refresh_interval)
            VALUES (?,?,?,?,?,?)""",
            (sid, _now(), screen_id, name,
             json.dumps(panels), refresh_interval))
    return sid


def get_screen(screen_id: str) -> Optional[Dict[str, Any]]:
    """获取大屏"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM screen_layouts WHERE screen_id = ?""",
                          (screen_id,)).fetchone()
    if not row:
        return None
    return {"screen_id": row["screen_id"], "name": row["name"],
            "panels": json.loads(row["panels"] or "[]"),
            "refresh_interval": row["refresh_interval"]}


def get_dashboard_overview() -> Dict[str, Any]:
    """仪表盘总览"""
    with _conn_lock, _conn() as c:
        total_metrics = c.execute("SELECT COUNT(*) as cnt FROM business_metrics").fetchone()["cnt"]
        total_funnel = c.execute("SELECT COUNT(*) as cnt FROM funnel_events").fetchone()["cnt"]
        total_panels = c.execute("SELECT COUNT(*) as cnt FROM dashboard_panels").fetchone()["cnt"]
        total_alerts = c.execute("SELECT COUNT(*) as cnt FROM custom_alerts WHERE enabled=1").fetchone()["cnt"]
        total_screens = c.execute("SELECT COUNT(*) as cnt FROM screen_layouts").fetchone()["cnt"]
    return {
        "total_metrics_records": total_metrics,
        "total_funnel_events": total_funnel,
        "total_panels": total_panels,
        "active_alerts": total_alerts,
        "total_screens": total_screens,
    }


def _send_dingtalk(title: str, content: str) -> None:
    """发送钉钉告警 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "title": title, "content": content,
            "source": "business_dashboard",
        }, ensure_ascii=False) + "\n")


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
            self._json(200, {"status": "ok", "service": "business_dashboard"})
        elif path == "/api/dashboard/overview":
            self._json(200, get_dashboard_overview())
        elif path == "/api/panels":
            self._json(200, {"panels": list_dashboard_panels()})
        elif path == "/api/funnel":
            hours = int(qs.get("hours", ["24"])[0])
            self._json(200, calculate_funnel(hours))
        elif path == "/api/alerts/check":
            self._json(200, {"triggered": check_custom_alerts()})
        elif path.startswith("/api/metric/") and "/history" in path:
            metric = path[12:].split("/")[0]
            hours = int(qs.get("hours", ["24"])[0])
            self._json(200, {"history": get_metric_history(metric, hours)})
        elif path.startswith("/api/metric/") and "/stats" in path:
            metric = path[12:].split("/")[0]
            hours = int(qs.get("hours", ["24"])[0])
            self._json(200, calculate_metric_stats(metric, hours))
        elif path.startswith("/api/metric/"):
            metric = path[12:]
            m = get_metric_latest(metric)
            if m:
                self._json(200, m)
            else:
                self._json(404, {"error": "not_found"})
        elif path.startswith("/api/screen/"):
            screen_id = path[12:]
            s = get_screen(screen_id)
            if s:
                self._json(200, s)
            else:
                self._json(404, {"error": "not_found"})
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
        if path == "/api/metric/record":
            mid = record_metric(
                metric_name=data.get("metric_name", ""),
                value=data.get("value", 0.0),
                metric_type=data.get("metric_type", "gauge"),
                dimensions=data.get("dimensions", {}),
            )
            self._json(201, {"id": mid})
        elif path == "/api/funnel/event":
            eid = record_funnel_event(
                user_id=data.get("user_id", ""),
                session_id=data.get("session_id", ""),
                stage=data.get("stage", "visit"),
                value=data.get("value", 1.0),
            )
            self._json(201, {"id": eid})
        elif path == "/api/panel/create":
            pid = create_dashboard_panel(
                panel_id=data.get("panel_id", ""),
                title=data.get("title", ""),
                panel_type=data.get("panel_type", "line"),
                query=data.get("query", ""),
                config=data.get("config", {}),
                position=data.get("position", 0),
            )
            self._json(201, {"id": pid})
        elif path == "/api/alert/create":
            aid = create_custom_alert(
                name=data.get("name", ""),
                metric_name=data.get("metric_name", ""),
                condition=data.get("condition", "gt"),
                threshold=data.get("threshold", 0.0),
                duration_seconds=data.get("duration_seconds", 300),
                severity=data.get("severity", "warning"),
            )
            self._json(201, {"id": aid})
        elif path == "/api/alert/check":
            triggered = check_custom_alerts()
            if triggered:
                _send_dingtalk("业务告警",
                                f"触发 {len(triggered)} 条自定义告警")
            self._json(200, {"triggered": triggered})
        elif path == "/api/screen/create":
            sid = create_screen(
                screen_id=data.get("screen_id", ""),
                name=data.get("name", ""),
                panels=data.get("panels", []),
                refresh_interval=data.get("refresh_interval", 30),
            )
            self._json(201, {"id": sid})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Business Dashboard service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_record_metric(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: record-metric <name> <value> [type] [dimensions_json]")
        return
    mtype = args[2] if len(args) > 2 else "gauge"
    dims = json.loads(args[3]) if len(args) > 3 else {}
    mid = record_metric(args[0], float(args[1]), mtype, dims)
    print(json.dumps({"id": mid}, ensure_ascii=False))


def cmd_latest(args: List[str]) -> None:
    if not args:
        print("usage: latest <metric_name>")
        return
    m = get_metric_latest(args[0])
    print(json.dumps(m or {}, ensure_ascii=False, indent=2))


def cmd_history(args: List[str]) -> None:
    if not args:
        print("usage: history <metric_name> [hours] [limit]")
        return
    hours = int(args[1]) if len(args) > 1 else 24
    limit = int(args[2]) if len(args) > 2 else 1000
    h = get_metric_history(args[0], hours, limit)
    print(json.dumps({"count": len(h), "history": h[:10]}, ensure_ascii=False))


def cmd_stats(args: List[str]) -> None:
    if not args:
        print("usage: stats <metric_name> [hours]")
        return
    hours = int(args[1]) if len(args) > 1 else 24
    print(json.dumps(calculate_metric_stats(args[0], hours), ensure_ascii=False, indent=2))


def cmd_funnel_event(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: funnel-event <user_id> <session_id> <stage> [value]")
        return
    value = float(args[3]) if len(args) > 3 else 1.0
    eid = record_funnel_event(args[0], args[1], args[2], value)
    print(json.dumps({"id": eid}, ensure_ascii=False))


def cmd_funnel(args: List[str]) -> None:
    hours = int(args[0]) if args else 24
    print(json.dumps(calculate_funnel(hours), ensure_ascii=False, indent=2))


def cmd_panel_create(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: panel-create <panel_id> <title> <type> <query> [config_json] [position]")
        return
    config = json.loads(args[4]) if len(args) > 4 else {}
    position = int(args[5]) if len(args) > 5 else 0
    pid = create_dashboard_panel(args[0], args[1], args[2], args[3], config, position)
    print(json.dumps({"id": pid}, ensure_ascii=False))


def cmd_panels(_args: List[str]) -> None:
    print(json.dumps(list_dashboard_panels(), ensure_ascii=False, indent=2))


def cmd_alert_create(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: alert-create <name> <metric> <condition> <threshold> [duration] [severity]")
        return
    duration = int(args[4]) if len(args) > 4 else 300
    severity = args[5] if len(args) > 5 else "warning"
    aid = create_custom_alert(args[0], args[1], args[2], float(args[3]),
                                duration, severity)
    print(json.dumps({"id": aid}, ensure_ascii=False))


def cmd_alerts_check(_args: List[str]) -> None:
    print(json.dumps(check_custom_alerts(), ensure_ascii=False, indent=2))


def cmd_screen_create(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: screen-create <screen_id> <name> <panels_csv> [refresh]")
        return
    panels = args[2].split(",")
    refresh = int(args[3]) if len(args) > 3 else 30
    sid = create_screen(args[0], args[1], panels, refresh)
    print(json.dumps({"id": sid}, ensure_ascii=False))


def cmd_screen_get(args: List[str]) -> None:
    if not args:
        print("usage: screen-get <screen_id>")
        return
    s = get_screen(args[0])
    print(json.dumps(s or {}, ensure_ascii=False, indent=2))


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_dashboard_overview(), ensure_ascii=False, indent=2))


def cmd_eval_condition(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: eval-condition <value> <condition> <threshold>")
        return
    result = evaluate_condition(float(args[0]), args[1], float(args[2]))
    print(json.dumps({"result": result}, ensure_ascii=False))


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "record-metric": cmd_record_metric,
        "latest": cmd_latest, "history": cmd_history, "stats": cmd_stats,
        "funnel-event": cmd_funnel_event, "funnel": cmd_funnel,
        "panel-create": cmd_panel_create, "panels": cmd_panels,
        "alert-create": cmd_alert_create, "alerts-check": cmd_alerts_check,
        "screen-create": cmd_screen_create, "screen-get": cmd_screen_get,
        "overview": cmd_overview, "eval-condition": cmd_eval_condition,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
P1-48 自适应混沌工程
智能场景选择 + 爆炸半径控制 + 自动恢复
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

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "adaptive_chaos.db")
HTTP_PORT = 10280

CHAOS_TYPES = ["pod_kill", "cpu_stress", "memory_stress", "network_delay",
                "network_loss", "disk_fill", "dns_error", "process_kill"]
CHAOS_STATUSES = ["pending", "running", "completed", "aborted", "failed"]
SAFETY_LEVELS = ["low", "medium", "high", "critical"]
RECOVERY_ACTIONS = ["auto", "manual", "rollback", "failover"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS chaos_experiments (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            experiment_name TEXT NOT NULL,
            chaos_type TEXT NOT NULL,
            target_service TEXT,
            target_resource TEXT,
            safety_level TEXT DEFAULT 'low',
            status TEXT DEFAULT 'pending',
            duration_seconds INTEGER DEFAULT 60,
            blast_radius_pct REAL DEFAULT 10.0,
            started_at TEXT,
            completed_at TEXT,
            result_summary TEXT
        );
        CREATE TABLE IF NOT EXISTS experiment_metrics (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            experiment_id TEXT NOT NULL,
            metric_name TEXT,
            metric_value REAL,
            metric_unit TEXT
        );
        CREATE TABLE IF NOT EXISTS steady_state_checks (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            experiment_id TEXT NOT NULL,
            check_name TEXT,
            expected_value REAL,
            actual_value REAL,
            passed INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS safety_rules (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            rule_name TEXT NOT NULL UNIQUE,
            max_blast_radius_pct REAL DEFAULT 50.0,
            forbidden_services TEXT,
            time_window_start TEXT,
            time_window_end TEXT,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS recovery_actions_log (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            experiment_id TEXT NOT NULL,
            action_type TEXT NOT NULL,
            success INTEGER DEFAULT 1,
            duration_seconds REAL DEFAULT 0,
            details TEXT
        );
        CREATE TABLE IF NOT EXISTS adaptive_recommendations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            service_name TEXT NOT NULL,
            recommended_chaos_type TEXT,
            priority TEXT,
            reason TEXT,
            confidence REAL DEFAULT 0
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def create_experiment(experiment_name: str, chaos_type: str,
                       target_service: str = "default",
                       target_resource: str = "",
                       safety_level: str = "low",
                       duration: int = 60,
                       blast_radius: float = 10.0) -> str:
    """创建混沌实验"""
    if chaos_type not in CHAOS_TYPES:
        chaos_type = "pod_kill"
    if safety_level not in SAFETY_LEVELS:
        safety_level = "low"
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO chaos_experiments
            (id,timestamp,experiment_name,chaos_type,target_service,target_resource,
             safety_level,status,duration_seconds,blast_radius_pct,started_at,completed_at,result_summary)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (eid, _now(), experiment_name, chaos_type, target_service,
             target_resource, safety_level, "pending", duration, blast_radius,
             "", "", ""))
    return eid


def start_experiment(experiment_id: str) -> bool:
    """启动实验"""
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE chaos_experiments SET status='running', started_at=?
            WHERE id=?""", (_now(), experiment_id))
        return c.total_changes > 0


def complete_experiment(experiment_id: str, result: str = "") -> bool:
    """完成实验"""
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE chaos_experiments SET status='completed', completed_at=?,
            result_summary=? WHERE id=?""", (_now(), result, experiment_id))
        return c.total_changes > 0


def abort_experiment(experiment_id: str, reason: str = "") -> bool:
    """中止实验"""
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE chaos_experiments SET status='aborted', completed_at=?,
            result_summary=? WHERE id=?""", (_now(), reason, experiment_id))
        return c.total_changes > 0


def record_metric(experiment_id: str, metric_name: str, value: float,
                   unit: str = "") -> str:
    """记录指标"""
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO experiment_metrics
            (id,timestamp,experiment_id,metric_name,metric_value,metric_unit)
            VALUES (?,?,?,?,?,?)""",
            (mid, _now(), experiment_id, metric_name, value, unit))
    return mid


def add_steady_state_check(experiment_id: str, check_name: str,
                              expected: float, actual: float) -> str:
    """稳态检查"""
    passed = 1 if abs(expected - actual) / max(1, abs(expected)) < 0.1 else 0
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO steady_state_checks
            (id,timestamp,experiment_id,check_name,expected_value,actual_value,passed)
            VALUES (?,?,?,?,?,?,?)""",
            (sid, _now(), experiment_id, check_name, expected, actual, passed))
    return sid


def create_safety_rule(rule_name: str, max_blast: float = 50.0,
                        forbidden: Optional[List[str]] = None,
                        start_time: str = "", end_time: str = "") -> str:
    """安全规则"""
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO safety_rules
            (id,timestamp,rule_name,max_blast_radius_pct,forbidden_services,
             time_window_start,time_window_end,enabled)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), rule_name, max_blast,
             json.dumps(forbidden or [], ensure_ascii=False),
             start_time, end_time, 1))
    return rid


def check_safety(target_service: str, blast_radius: float) -> Dict:
    """安全检查"""
    with _conn() as c:
        rules = c.execute("""SELECT * FROM safety_rules WHERE enabled=1""").fetchall()
    violations = []
    for r in rules:
        if blast_radius > r["max_blast_radius_pct"]:
            violations.append(f"爆炸半径 {blast_radius}% 超过 {r['max_blast_radius_pct']}%")
        forbidden = json.loads(r["forbidden_services"] or "[]")
        if target_service in forbidden:
            violations.append(f"服务 {target_service} 禁止混沌")
    return {"safe": len(violations) == 0, "violations": violations}


def log_recovery(experiment_id: str, action_type: str, success: bool = True,
                  duration: float = 0, details: str = "") -> str:
    """记录恢复"""
    if action_type not in RECOVERY_ACTIONS:
        action_type = "auto"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO recovery_actions_log
            (id,timestamp,experiment_id,action_type,success,duration_seconds,details)
            VALUES (?,?,?,?,?,?,?)""",
            (rid, _now(), experiment_id, action_type,
             1 if success else 0, duration, details))
    return rid


def recommend_chaos(service_name: str) -> str:
    """智能推荐"""
    with _conn() as c:
        recent = c.execute("""SELECT chaos_type, COUNT(*) as c FROM chaos_experiments
            WHERE target_service=? GROUP BY chaos_type ORDER BY c DESC LIMIT 1""",
            (service_name,)).fetchone()
    if recent:
        chaos_type = recent["chaos_type"]
        reason = f"该服务历史最常测试类型: {chaos_type}"
    else:
        chaos_type = "pod_kill"
        reason = "首次测试, 推荐基础场景"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO adaptive_recommendations
            (id,timestamp,service_name,recommended_chaos_type,priority,reason,confidence)
            VALUES (?,?,?,?,?,?,?)""",
            (rid, _now(), service_name, chaos_type, "medium", reason, 0.8))
    return rid


def get_chaos_report() -> Dict:
    """混沌报告"""
    with _conn() as c:
        total = c.execute("""SELECT COUNT(*) as c FROM chaos_experiments""").fetchone()["c"]
        completed = c.execute("""SELECT COUNT(*) as c FROM chaos_experiments WHERE status='completed'""").fetchone()["c"]
        aborted = c.execute("""SELECT COUNT(*) as c FROM chaos_experiments WHERE status='aborted'""").fetchone()["c"]
        recoveries = c.execute("""SELECT COUNT(*) as c FROM recovery_actions_log""").fetchone()["c"]
        success = c.execute("""SELECT COUNT(*) as c FROM recovery_actions_log WHERE success=1""").fetchone()["c"]
        checks = c.execute("""SELECT COUNT(*) as c FROM steady_state_checks WHERE passed=1""").fetchone()["c"]
    return {
        "total_experiments": total,
        "completed": completed,
        "aborted": aborted,
        "total_recoveries": recoveries,
        "successful_recoveries": success,
        "steady_state_passed": checks,
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
            self._send(200, get_chaos_report())
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
        if u.path == "/api/experiment":
            eid = create_experiment(
                data.get("name", "exp-" + uuid.uuid4().hex[:6]),
                data.get("chaos_type", "pod_kill"),
                data.get("target_service", "default"),
                data.get("target_resource", ""),
                data.get("safety_level", "low"),
                data.get("duration", 60),
                data.get("blast_radius", 10.0),
            )
            self._send(200, {"experiment_id": eid})
        elif u.path == "/api/experiment/start":
            ok = start_experiment(data.get("experiment_id", ""))
            self._send(200, {"ok": ok})
        elif u.path == "/api/experiment/complete":
            ok = complete_experiment(data.get("experiment_id", ""), data.get("result", ""))
            self._send(200, {"ok": ok})
        elif u.path == "/api/experiment/abort":
            ok = abort_experiment(data.get("experiment_id", ""), data.get("reason", ""))
            self._send(200, {"ok": ok})
        elif u.path == "/api/metric":
            mid = record_metric(
                data.get("experiment_id", ""),
                data.get("metric_name", "cpu"),
                data.get("value", 0),
                data.get("unit", ""),
            )
            self._send(200, {"metric_id": mid})
        elif u.path == "/api/steady":
            sid = add_steady_state_check(
                data.get("experiment_id", ""),
                data.get("check_name", "default"),
                data.get("expected", 100),
                data.get("actual", 100),
            )
            self._send(200, {"check_id": sid})
        elif u.path == "/api/safety":
            result = check_safety(
                data.get("target_service", "default"),
                data.get("blast_radius", 10.0),
            )
            self._send(200, result)
        elif u.path == "/api/safety/rule":
            rid = create_safety_rule(
                data.get("rule_name", "default"),
                data.get("max_blast", 50.0),
                data.get("forbidden"),
                data.get("start_time", ""),
                data.get("end_time", ""),
            )
            self._send(200, {"rule_id": rid})
        elif u.path == "/api/recovery":
            rid = log_recovery(
                data.get("experiment_id", ""),
                data.get("action_type", "auto"),
                data.get("success", True),
                data.get("duration", 0),
                data.get("details", ""),
            )
            self._send(200, {"recovery_id": rid})
        elif u.path == "/api/recommend":
            rid = recommend_chaos(data.get("service_name", "default"))
            self._send(200, {"rec_id": rid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P1-48 自适应混沌工程")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"混沌工程 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_chaos_report(), ensure_ascii=False, indent=2))

#!/usr/bin/env python3
"""
安全态势感知 (SOC)
P2-30: 威胁情报, UEBA (用户实体行为分析), 自动响应剧本
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "soc.db")
HTTP_PORT = 10100

THREAT_LEVELS = ["low", "medium", "high", "critical"]
THREAT_CATEGORIES = ["malware", "phishing", "brute_force", "data_exfiltration",
                      "privilege_escalation", "insider_threat", "ddos", "ransomware"]
RESPONSE_ACTIONS = ["block_ip", "disable_user", "quarantine_file", "isolate_host",
                     "notify_soc", "create_ticket", "collect_forensics", "rollback"]
RISK_LEVELS = ["safe", "low_risk", "medium_risk", "high_risk", "critical_risk"]
PLAYBOOK_STATUS = ["draft", "active", "paused", "deprecated"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS threat_intel (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            ioc_type TEXT NOT NULL,
            ioc_value TEXT NOT NULL,
            threat_type TEXT,
            source TEXT,
            confidence REAL,
            first_seen TEXT,
            last_seen TEXT,
            tags TEXT
        );
        CREATE TABLE IF NOT EXISTS security_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            severity TEXT,
            user_id TEXT,
            source_ip TEXT,
            target TEXT,
            description TEXT,
            ioc_matched TEXT,
            risk_score REAL
        );
        CREATE TABLE IF NOT EXISTS ueba_profiles (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            user_id TEXT NOT NULL,
            baseline_login_hours TEXT,
            baseline_locations TEXT,
            baseline_resources TEXT,
            current_risk_score REAL,
            anomalies TEXT
        );
        CREATE TABLE IF NOT EXISTS playbooks (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            name TEXT NOT NULL UNIQUE,
            trigger_event TEXT,
            actions TEXT,
            severity TEXT,
            status TEXT DEFAULT 'active',
            execution_count INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS playbook_executions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            playbook_id TEXT,
            trigger_event_id TEXT,
            actions_executed TEXT,
            status TEXT,
            result TEXT,
            duration_ms INTEGER
        );
        CREATE TABLE IF NOT EXISTS soc_alerts (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            severity TEXT,
            threat_type TEXT,
            title TEXT,
            description TEXT,
            source_ip TEXT,
            user_id TEXT,
            status TEXT DEFAULT 'open',
            assigned_to TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sec_events_user ON security_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_threat_ioc ON threat_intel(ioc_value);
    """)
    conn.close()


_conn_lock = threading.Lock()
_db_ready = False


def _ensure_db() -> None:
    global _db_ready
    if not _db_ready:
        _init_db()
        _db_ready = True


@contextmanager
def _conn():
    _ensure_db()
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()


def add_threat_intel(ioc_type: str, ioc_value: str, threat_type: str,
                      source: str, confidence: float = 0.5,
                      tags: Optional[List[str]] = None) -> str:
    """添加威胁情报"""
    tid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO threat_intel
            (id,timestamp,ioc_type,ioc_value,threat_type,source,confidence,
             first_seen,last_seen,tags)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (tid, _now(), ioc_type, ioc_value, threat_type, source, confidence,
             _now(), _now(), json.dumps(tags or [], ensure_ascii=False)))
    return tid


def check_ioc(ioc_type: str, ioc_value: str) -> Optional[Dict[str, Any]]:
    """检查 IOC 是否命中"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM threat_intel
            WHERE ioc_type = ? AND ioc_value = ?""",
            (ioc_type, ioc_value)).fetchone()
    if not row:
        return None
    return {
        "id": row["id"], "ioc_type": row["ioc_type"],
        "ioc_value": row["ioc_value"], "threat_type": row["threat_type"],
        "source": row["source"], "confidence": row["confidence"],
        "tags": json.loads(row["tags"] or "[]"),
    }


def record_security_event(event_type: str, severity: str,
                           user_id: str = "", source_ip: str = "",
                           target: str = "", description: str = "",
                           ioc_matched: str = "", risk_score: float = 0.0) -> str:
    """记录安全事件"""
    if severity not in THREAT_LEVELS:
        severity = "medium"
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO security_events
            (id,timestamp,event_type,severity,user_id,source_ip,target,
             description,ioc_matched,risk_score)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (eid, _now(), event_type, severity, user_id, source_ip, target,
             description, ioc_matched, risk_score))
    return eid


def update_ueba_profile(user_id: str, login_hour: int, location: str,
                         resource: str) -> Dict[str, Any]:
    """更新 UEBA 基线并检测异常"""
    with _conn_lock, _conn() as c:
        profile = c.execute("""SELECT * FROM ueba_profiles
            WHERE user_id = ?""", (user_id,)).fetchone()
    anomalies = []
    if not profile:
        new_id = str(uuid.uuid4())
        with _conn_lock, _conn() as c:
            c.execute("""INSERT INTO ueba_profiles
                (id,timestamp,user_id,baseline_login_hours,baseline_locations,
                 baseline_resources,current_risk_score,anomalies)
                VALUES (?,?,?,?,?,?,?,?)""",
                (new_id, _now(), user_id, json.dumps([login_hour]),
                 json.dumps([location]), json.dumps([resource]), 0.0, "[]"))
        return {"user_id": user_id, "is_new": True, "anomalies": [],
                "risk_score": 0.0}
    login_hours = json.loads(profile["baseline_login_hours"] or "[]")
    locations = json.loads(profile["baseline_locations"] or "[]")
    resources = json.loads(profile["baseline_resources"] or "[]")
    if login_hour not in login_hours:
        anomalies.append(f"非常规登录时间: {login_hour}时")
    if location not in locations:
        anomalies.append(f"新地理位置: {location}")
    if resource not in resources:
        anomalies.append(f"访问新资源: {resource}")
    risk_score = min(1.0, len(anomalies) * 0.3)
    if login_hour not in login_hours:
        login_hours.append(login_hour)
    if location not in locations:
        locations.append(location)
    if resource not in resources:
        resources.append(resource)
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE ueba_profiles SET
            baseline_login_hours = ?, baseline_locations = ?,
            baseline_resources = ?, current_risk_score = ?, anomalies = ?
            WHERE user_id = ?""",
            (json.dumps(login_hours), json.dumps(locations),
             json.dumps(resources), risk_score,
             json.dumps(anomalies, ensure_ascii=False), user_id))
    return {
        "user_id": user_id,
        "is_new": False,
        "anomalies": anomalies,
        "risk_score": round(risk_score, 2),
    }


def create_playbook(name: str, trigger_event: str, actions: List[str],
                     severity: str = "high") -> str:
    """创建响应剧本"""
    if severity not in THREAT_LEVELS:
        severity = "high"
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO playbooks
            (id,timestamp,name,trigger_event,actions,severity,status,execution_count)
            VALUES (?,?,?,?,?,?,?,0)""",
            (pid, _now(), name, trigger_event, json.dumps(actions),
             severity, "active"))
    return pid


def list_playbooks() -> List[Dict[str, Any]]:
    """列出剧本"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT * FROM playbooks ORDER BY timestamp DESC""").fetchall()
    return [{"id": r["id"], "name": r["name"],
             "trigger": r["trigger_event"],
             "actions": json.loads(r["actions"] or "[]"),
             "severity": r["severity"], "status": r["status"],
             "executions": r["execution_count"]} for r in rows]


def execute_playbook(playbook_id: str, trigger_event_id: str) -> Dict[str, Any]:
    """执行剧本"""
    with _conn_lock, _conn() as c:
        pb = c.execute("""SELECT * FROM playbooks WHERE id = ?""",
                        (playbook_id,)).fetchone()
        if not pb:
            return {"status": "failed", "error": "not_found"}
        if pb["status"] != "active":
            return {"status": "failed", "error": "not_active"}
        actions = json.loads(pb["actions"] or "[]")
    start = time.time()
    eid = str(uuid.uuid4())
    executed = []
    for action in actions:
        if action in RESPONSE_ACTIONS:
            executed.append(action)
    duration = int((time.time() - start) * 1000)
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO playbook_executions
            (id,timestamp,playbook_id,trigger_event_id,actions_executed,
             status,result,duration_ms)
            VALUES (?,?,?,?,?,?,?,?)""",
            (eid, _now(), playbook_id, trigger_event_id,
             json.dumps(executed), "completed",
             json.dumps({"triggered_actions": len(executed)}), duration))
        c.execute("""UPDATE playbooks SET execution_count = execution_count + 1
            WHERE id = ?""", (playbook_id,))
    return {
        "execution_id": eid,
        "playbook_id": playbook_id,
        "status": "completed",
        "actions_executed": executed,
        "duration_ms": duration,
    }


def create_soc_alert(severity: str, threat_type: str, title: str,
                      description: str, source_ip: str = "",
                      user_id: str = "") -> str:
    """创建 SOC 告警"""
    if severity not in THREAT_LEVELS:
        severity = "medium"
    aid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO soc_alerts
            (id,timestamp,severity,threat_type,title,description,source_ip,user_id,status)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (aid, _now(), severity, threat_type, title, description,
             source_ip, user_id, "open"))
    return aid


def analyze_threat_landscape(hours: int = 24) -> Dict[str, Any]:
    """威胁态势分析"""
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat().replace("+00:00", "Z")
    with _conn_lock, _conn() as c:
        total_events = c.execute("""SELECT COUNT(*) as cnt FROM security_events
            WHERE timestamp >= ?""", (since,)).fetchone()["cnt"]
        by_severity = c.execute("""SELECT severity, COUNT(*) as cnt
            FROM security_events WHERE timestamp >= ?
            GROUP BY severity""", (since,)).fetchall()
        by_type = c.execute("""SELECT event_type, COUNT(*) as cnt
            FROM security_events WHERE timestamp >= ?
            GROUP BY event_type ORDER BY cnt DESC LIMIT 10""",
            (since,)).fetchall()
        ioc_count = c.execute("""SELECT COUNT(*) as cnt FROM threat_intel""").fetchone()["cnt"]
        open_alerts = c.execute("""SELECT COUNT(*) as cnt FROM soc_alerts
            WHERE status = 'open'""").fetchone()["cnt"]
    return {
        "window_hours": hours,
        "total_events": total_events,
        "ioc_count": ioc_count,
        "open_alerts": open_alerts,
        "by_severity": [{"severity": r["severity"], "count": r["cnt"]}
                         for r in by_severity],
        "top_threats": [{"type": r["event_type"], "count": r["cnt"]}
                         for r in by_type],
    }


def _send_dingtalk(title: str, content: str) -> None:
    """发送钉钉告警 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "title": title, "content": content,
            "source": "soc",
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
            self._json(200, {"status": "ok", "service": "soc"})
        elif path == "/api/soc/landscape":
            hours = int(qs.get("hours", ["24"])[0])
            self._json(200, analyze_threat_landscape(hours))
        elif path == "/api/playbooks":
            self._json(200, {"playbooks": list_playbooks()})
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
        if path == "/api/threat/add":
            tid = add_threat_intel(
                ioc_type=data.get("ioc_type", "ip"),
                ioc_value=data.get("ioc_value", ""),
                threat_type=data.get("threat_type", "malware"),
                source=data.get("source", ""),
                confidence=data.get("confidence", 0.5),
                tags=data.get("tags", []),
            )
            self._json(201, {"id": tid})
        elif path == "/api/threat/check":
            result = check_ioc(
                ioc_type=data.get("ioc_type", "ip"),
                ioc_value=data.get("ioc_value", ""),
            )
            if result:
                _send_dingtalk("IOC 命中", f"{result['threat_type']}: {result['ioc_value']}")
            self._json(200, result or {"matched": False})
        elif path == "/api/event/record":
            eid = record_security_event(
                event_type=data.get("event_type", ""),
                severity=data.get("severity", "medium"),
                user_id=data.get("user_id", ""),
                source_ip=data.get("source_ip", ""),
                target=data.get("target", ""),
                description=data.get("description", ""),
                ioc_matched=data.get("ioc_matched", ""),
                risk_score=data.get("risk_score", 0.0),
            )
            self._json(201, {"id": eid})
        elif path == "/api/ueba/update":
            result = update_ueba_profile(
                user_id=data.get("user_id", ""),
                login_hour=int(data.get("login_hour", 12)),
                location=data.get("location", ""),
                resource=data.get("resource", ""),
            )
            self._json(200, result)
        elif path == "/api/playbook/create":
            pid = create_playbook(
                name=data.get("name", ""),
                trigger_event=data.get("trigger_event", ""),
                actions=data.get("actions", []),
                severity=data.get("severity", "high"),
            )
            self._json(201, {"id": pid})
        elif path == "/api/playbook/execute":
            result = execute_playbook(
                playbook_id=data.get("playbook_id", ""),
                trigger_event_id=data.get("trigger_event_id", ""),
            )
            self._json(200, result)
        elif path == "/api/alert/create":
            aid = create_soc_alert(
                severity=data.get("severity", "medium"),
                threat_type=data.get("threat_type", ""),
                title=data.get("title", ""),
                description=data.get("description", ""),
                source_ip=data.get("source_ip", ""),
                user_id=data.get("user_id", ""),
            )
            self._json(201, {"id": aid})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("127.0.0.1", HTTP_PORT), _Handler)
    print(f"SOC service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_threat_add(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: threat-add <ioc_type> <ioc_value> <threat_type> <source> [confidence]")
        return
    confidence = float(args[4]) if len(args) > 4 else 0.5
    tid = add_threat_intel(args[0], args[1], args[2], args[3], confidence)
    print(json.dumps({"id": tid}, ensure_ascii=False))


def cmd_threat_check(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: threat-check <ioc_type> <ioc_value>")
        return
    result = check_ioc(args[0], args[1])
    print(json.dumps(result or {"matched": False}, ensure_ascii=False, indent=2))


def cmd_event(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: event <event_type> <severity> [user_id] [source_ip]")
        return
    eid = record_security_event(args[0], args[1],
                                   args[2] if len(args) > 2 else "",
                                   args[3] if len(args) > 3 else "")
    print(json.dumps({"id": eid}, ensure_ascii=False))


def cmd_ueba(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: ueba <user_id> <login_hour> <location> <resource>")
        return
    print(json.dumps(update_ueba_profile(args[0], int(args[1]), args[2], args[3]),
                      ensure_ascii=False, indent=2))


def cmd_playbook_create(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: playbook-create <name> <trigger> <actions_csv> [severity]")
        return
    actions = args[2].split(",")
    severity = args[3] if len(args) > 3 else "high"
    pid = create_playbook(args[0], args[1], actions, severity)
    print(json.dumps({"id": pid}, ensure_ascii=False))


def cmd_playbook_list(_args: List[str]) -> None:
    print(json.dumps(list_playbooks(), ensure_ascii=False, indent=2))


def cmd_playbook_execute(args: List[str]) -> None:
    if len(args) < 1:
        print("usage: playbook-execute <playbook_id> [trigger_event_id]")
        return
    trigger = args[1] if len(args) > 1 else "manual"
    print(json.dumps(execute_playbook(args[0], trigger), ensure_ascii=False, indent=2))


def cmd_alert(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: alert <severity> <threat_type> <title> [description]")
        return
    desc = args[3] if len(args) > 3 else ""
    aid = create_soc_alert(args[0], args[1], args[2], desc)
    print(json.dumps({"id": aid}, ensure_ascii=False))


def cmd_landscape(args: List[str]) -> None:
    hours = int(args[0]) if args else 24
    print(json.dumps(analyze_threat_landscape(hours), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "threat-add": cmd_threat_add,
        "threat-check": cmd_threat_check, "event": cmd_event,
        "ueba": cmd_ueba, "playbook-create": cmd_playbook_create,
        "playbook-list": cmd_playbook_list, "playbook-execute": cmd_playbook_execute,
        "alert": cmd_alert, "landscape": cmd_landscape,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

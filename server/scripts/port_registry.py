#!/usr/bin/env python3
"""
P1-69 端口分配检测
端口冲突检测 + 分配合规性 + 范围管理
"""
import json
import os
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "port_registry.db")
HTTP_PORT = 10490
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))

PORT_RANGES = {
    "core": (10000, 10100),
    "monitoring": (10100, 10200),
    "platform": (10200, 10400),
    "integration": (10400, 10600),
    "extension": (10600, 10800),
    "reserved": (10800, 11000),
    "system": (20000, 21000),
}


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS port_allocations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            port INTEGER NOT NULL UNIQUE,
            service_name TEXT NOT NULL,
            category TEXT,
            round_label TEXT,
            purpose TEXT,
            registered_at TEXT
        );
        CREATE TABLE IF NOT EXISTS port_scans (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            scan_type TEXT,
            total_scanned INTEGER DEFAULT 0,
            conflicts_found INTEGER DEFAULT 0,
            violations INTEGER DEFAULT 0,
            duration_ms REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS port_reservations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            port_start INTEGER NOT NULL,
            port_end INTEGER NOT NULL,
            category TEXT NOT NULL,
            description TEXT
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _categorize_port(port: int) -> str:
    for cat, (start, end) in PORT_RANGES.items():
        if start <= port < end:
            return cat
    return "out_of_range"


def register_port(port: int, service_name: str, category: str = "",
                   round_label: str = "", purpose: str = "") -> str:
    """注册端口"""
    if port < 1 or port > 65535:
        port = 0
    if not category:
        category = _categorize_port(port)
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO port_allocations
            (id,timestamp,port,service_name,category,round_label,purpose,registered_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), port, service_name, category, round_label, purpose, _now()))
    return rid


def get_allocation(port: int) -> Optional[Dict]:
    """获取分配"""
    with _conn() as c:
        row = c.execute("""SELECT * FROM port_allocations WHERE port=?""",
                         (port,)).fetchone()
    return dict(row) if row else None


def detect_conflicts() -> List[Dict]:
    """检测冲突"""
    with _conn() as c:
        rows = c.execute("""SELECT port, COUNT(*) as c FROM port_allocations
            GROUP BY port HAVING c > 1""").fetchall()
    return [{"port": r["port"], "count": r["c"]} for r in rows]


def scan_source_for_ports() -> List[Dict]:
    """扫描源文件中的 HTTP_PORT 定义"""
    pattern = re.compile(r"HTTP_PORT\s*=\s*(\d+)")
    found = []
    if not os.path.isdir(SCRIPTS_DIR):
        return found
    for f in os.listdir(SCRIPTS_DIR):
        if not f.endswith(".py"):
            continue
        fp = os.path.join(SCRIPTS_DIR, f)
        try:
            with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                for i, line in enumerate(fh, 1):
                    m = pattern.search(line)
                    if m:
                        port = int(m.group(1))
                        found.append({"file": f, "line": i, "port": port})
        except Exception:
            pass
    return found


def check_range_violation() -> List[Dict]:
    """范围违规检查"""
    with _conn() as c:
        rows = c.execute("""SELECT * FROM port_allocations""").fetchall()
    violations = []
    for r in rows:
        cat = _categorize_port(r["port"])
        if cat == "out_of_range":
            violations.append({"port": r["port"], "service": r["service_name"],
                                "category": cat, "issue": "out_of_range"})
        elif r["category"] and r["category"] != cat:
            violations.append({"port": r["port"], "service": r["service_name"],
                                "registered": r["category"], "actual": cat,
                                "issue": "category_mismatch"})
    return violations


def run_full_scan() -> Dict:
    """运行完整扫描"""
    start = time.time()
    sid = str(uuid.uuid4())
    source_ports = scan_source_for_ports()
    with _conn_lock, _conn() as c:
        for sp in source_ports:
            existing = c.execute("""SELECT * FROM port_allocations WHERE port=?""",
                                  (sp["port"],)).fetchone()
            if not existing:
                register_port(sp["port"], sp["file"].replace(".py", "").replace("test_", ""),
                                round_label="auto-scan", purpose=f"auto-detected at line {sp['line']}")
    conflicts = detect_conflicts()
    violations = check_range_violation()
    duration = (time.time() - start) * 1000
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO port_scans
            (id,timestamp,scan_type,total_scanned,conflicts_found,violations,duration_ms)
            VALUES (?,?,?,?,?,?,?)""",
            (sid, _now(), "full", len(source_ports), len(conflicts), len(violations), duration))
    return {
        "total_scanned": len(source_ports),
        "conflicts": conflicts,
        "violations": violations,
        "duration_ms": duration,
    }


def reserve_range(port_start: int, port_end: int, category: str, description: str = "") -> str:
    """预留范围"""
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO port_reservations
            (id,timestamp,port_start,port_end,category,description)
            VALUES (?,?,?,?,?,?)""",
            (rid, _now(), port_start, port_end, category, description))
    return rid


def get_port_report() -> Dict:
    """端口报告"""
    with _conn() as c:
        total = c.execute("""SELECT COUNT(*) as c FROM port_allocations""").fetchone()["c"]
        categories = c.execute("""SELECT category, COUNT(*) as c FROM port_allocations
            GROUP BY category""").fetchall()
        reservations = c.execute("""SELECT COUNT(*) as c FROM port_reservations""").fetchone()["c"]
        scans = c.execute("""SELECT COUNT(*) as c FROM port_scans""").fetchone()["c"]
    return {
        "total_allocated": total,
        "by_category": {r["category"]: r["c"] for r in categories},
        "reservations": reservations,
        "total_scans": scans,
        "ranges": PORT_RANGES,
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
            self._send(200, get_port_report())
        elif u.path == "/api/conflicts":
            self._send(200, {"conflicts": detect_conflicts()})
        elif u.path == "/api/violations":
            self._send(200, {"violations": check_range_violation()})
        elif u.path == "/api/scan":
            self._send(200, run_full_scan())
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
        if u.path == "/api/register":
            rid = register_port(
                data.get("port", 0),
                data.get("service_name", "default"),
                data.get("category", ""),
                data.get("round_label", ""),
                data.get("purpose", ""),
            )
            self._send(200, {"register_id": rid})
        elif u.path == "/api/reserve":
            rid = reserve_range(
                data.get("port_start", 10000),
                data.get("port_end", 11000),
                data.get("category", "core"),
                data.get("description", ""),
            )
            self._send(200, {"reservation_id": rid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P1-69 端口分配检测")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"端口检测 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_port_report(), ensure_ascii=False, indent=2))

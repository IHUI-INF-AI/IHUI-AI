#!/usr/bin/env python3
"""
绿色计算
P2-39: PUE 监控, 碳排放跟踪, 节能策略, 资源利用率优化, 可持续性报告
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

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "green_computing.db")
HTTP_PORT = 10190

ENERGY_SOURCES = ["grid", "solar", "wind", "hydro", "nuclear", "coal", "natural_gas"]
CARBON_INTENSITY = {  # gCO2eq/kWh
    "grid": 500, "solar": 50, "wind": 30, "hydro": 20,
    "nuclear": 15, "coal": 900, "natural_gas": 450,
}
EFFICIENCY_LEVELS = ["A+++", "A++", "A+", "A", "B", "C", "D"]
PUE_LEVELS = {"excellent": 1.2, "good": 1.5, "average": 1.8, "poor": 2.0}


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS energy_meters (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            meter_id TEXT NOT NULL UNIQUE,
            location TEXT,
            source TEXT,
            power_kw REAL,
            voltage_v REAL,
            current_a REAL,
            cumulative_kwh REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS carbon_records (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            record_id TEXT NOT NULL,
            source TEXT,
            energy_kwh REAL,
            co2_kg REAL,
            period TEXT
        );
        CREATE TABLE IF NOT EXISTS pue_records (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            record_id TEXT NOT NULL,
            datacenter TEXT,
            total_power_kw REAL,
            it_power_kw REAL,
            pue REAL,
            efficiency_level TEXT
        );
        CREATE TABLE IF NOT EXISTS efficiency_policies (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            policy_id TEXT NOT NULL UNIQUE,
            name TEXT,
            policy_type TEXT,
            target TEXT,
            rules TEXT,
            enabled INTEGER DEFAULT 1,
            saved_kwh REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sustainability_reports (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            report_id TEXT NOT NULL UNIQUE,
            period TEXT,
            total_energy_kwh REAL,
            total_co2_kg REAL,
            avg_pue REAL,
            green_score REAL,
            summary TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_energy_meters_source ON energy_meters(source);
        CREATE INDEX IF NOT EXISTS idx_carbon_source ON carbon_records(source);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_energy_meter(meter_id: str, location: str, source: str,
                            power_kw: float = 0, voltage_v: float = 220,
                            current_a: float = 0) -> str:
    """注册电表"""
    if source not in ENERGY_SOURCES:
        source = "grid"
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO energy_meters
            (id,timestamp,meter_id,location,source,power_kw,voltage_v,
             current_a,cumulative_kwh)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (mid, _now(), meter_id, location, source, power_kw, voltage_v,
             current_a, 0.0))
    return mid


def record_energy_consumption(meter_id: str, energy_kwh: float) -> bool:
    """记录能耗"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM energy_meters
            WHERE meter_id = ?""", (meter_id,)).fetchone()
        if not row:
            return False
        new_total = (row["cumulative_kwh"] or 0) + energy_kwh
        cur = c.execute("""UPDATE energy_meters
            SET cumulative_kwh = ?, power_kw = ?
            WHERE meter_id = ?""",
            (new_total, energy_kwh, meter_id))
    return cur.rowcount > 0


def record_carbon(source: str, energy_kwh: float,
                   period: str = "monthly") -> str:
    """记录碳排放"""
    if source not in ENERGY_SOURCES:
        source = "grid"
    intensity = CARBON_INTENSITY.get(source, 500)
    co2_kg = (energy_kwh * intensity) / 1000.0
    rid = str(uuid.uuid4())
    record_id = f"carbon-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO carbon_records
            (id,timestamp,record_id,source,energy_kwh,co2_kg,period)
            VALUES (?,?,?,?,?,?,?)""",
            (rid, _now(), record_id, source, energy_kwh, co2_kg, period))
    return record_id


def record_pue(datacenter: str, total_power_kw: float, it_power_kw: float) -> str:
    """记录 PUE"""
    if it_power_kw <= 0:
        return ""
    pue = total_power_kw / it_power_kw
    if pue < 1.2:
        level = "excellent"
    elif pue < 1.5:
        level = "good"
    elif pue < 1.8:
        level = "average"
    else:
        level = "poor"
    rid = str(uuid.uuid4())
    record_id = f"pue-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO pue_records
            (id,timestamp,record_id,datacenter,total_power_kw,it_power_kw,
             pue,efficiency_level)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), record_id, datacenter, total_power_kw, it_power_kw,
             round(pue, 3), level))
    return record_id


def create_policy(policy_id: str, name: str, policy_type: str,
                   target: str, rules: Optional[Dict] = None) -> str:
    """创建节能策略"""
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO efficiency_policies
            (id,timestamp,policy_id,name,policy_type,target,rules,enabled,saved_kwh)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (pid, _now(), policy_id, name, policy_type, target,
             json.dumps(rules, ensure_ascii=False), 1, 0.0))
    return pid


def record_policy_savings(policy_id: str, saved_kwh: float) -> bool:
    """记录策略节能"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM efficiency_policies
            WHERE policy_id = ?""", (policy_id,)).fetchone()
        if not row:
            return False
        new_saved = (row["saved_kwh"] or 0) + saved_kwh
        cur = c.execute("""UPDATE efficiency_policies SET saved_kwh = ?
            WHERE policy_id = ?""", (new_saved, policy_id))
    return cur.rowcount > 0


def calculate_green_score() -> float:
    """计算绿色分数"""
    with _conn_lock, _conn() as c:
        total_carbon = c.execute("""SELECT COALESCE(SUM(co2_kg), 0) as s
            FROM carbon_records""").fetchone()["s"]
        total_energy = c.execute("""SELECT COALESCE(SUM(energy_kwh), 0) as s
            FROM carbon_records""").fetchone()["s"]
        renewable = c.execute("""SELECT COALESCE(SUM(energy_kwh), 0) as s
            FROM carbon_records WHERE source IN ('solar','wind','hydro')""").fetchone()["s"]
        avg_pue = c.execute("""SELECT COALESCE(AVG(pue), 1.0) as s
            FROM pue_records""").fetchone()["s"]
    if total_energy == 0:
        return 0.0
    renewable_pct = renewable / total_energy
    pue_score = max(0, (2.0 - avg_pue) / 0.8)
    green_pct = renewable_pct
    score = (green_pct * 0.5 + pue_score * 0.3 + 0.2) * 100
    return round(min(100, max(0, score)), 2)


def generate_sustainability_report(period: str = "monthly") -> str:
    """生成可持续性报告"""
    with _conn_lock, _conn() as c:
        total_energy = c.execute("""SELECT COALESCE(SUM(energy_kwh), 0) as s
            FROM carbon_records""").fetchone()["s"]
        total_co2 = c.execute("""SELECT COALESCE(SUM(co2_kg), 0) as s
            FROM carbon_records""").fetchone()["s"]
        avg_pue = c.execute("""SELECT COALESCE(AVG(pue), 1.0) as s
            FROM pue_records""").fetchone()["s"]
    score = calculate_green_score()
    summary = {
        "period": period,
        "total_energy_kwh": round(total_energy, 2),
        "total_co2_kg": round(total_co2, 2),
        "avg_pue": round(avg_pue, 3),
        "green_score": score,
        "verdict": "excellent" if score >= 80 else "good" if score >= 60 else "needs_improvement",
    }
    rid = str(uuid.uuid4())
    report_id = f"report-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO sustainability_reports
            (id,timestamp,report_id,period,total_energy_kwh,total_co2_kg,
             avg_pue,green_score,summary)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), report_id, period, total_energy, total_co2,
             round(avg_pue, 3), score, json.dumps(summary, ensure_ascii=False)))
    return report_id


def get_overview() -> Dict[str, Any]:
    """获取绿色概览"""
    with _conn_lock, _conn() as c:
        meters = c.execute("SELECT COUNT(*) as c FROM energy_meters").fetchone()["c"]
        total_energy = c.execute("""SELECT COALESCE(SUM(cumulative_kwh), 0) as s
            FROM energy_meters""").fetchone()["s"]
        total_co2 = c.execute("""SELECT COALESCE(SUM(co2_kg), 0) as s
            FROM carbon_records""").fetchone()["s"]
        avg_pue = c.execute("""SELECT COALESCE(AVG(pue), 0) as s
            FROM pue_records""").fetchone()["s"]
        policies = c.execute("SELECT COUNT(*) as c FROM efficiency_policies").fetchone()["c"]
    return {"meters": meters, "total_energy_kwh": round(total_energy, 2),
            "total_co2_kg": round(total_co2, 2),
            "avg_pue": round(avg_pue, 3), "active_policies": policies,
            "green_score": calculate_green_score()}


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "green_computing"}, ensure_ascii=False) + "\n")


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
        if path == "/health":
            self._json(200, {"status": "ok", "service": "green_computing"})
        elif path == "/api/overview":
            self._json(200, get_overview())
        elif path == "/api/green-score":
            self._json(200, {"score": calculate_green_score()})
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
        if path == "/api/meter/register":
            mid = register_energy_meter(
                meter_id=data.get("meter_id", ""),
                location=data.get("location", ""),
                source=data.get("source", "grid"),
                power_kw=data.get("power_kw", 0.0),
                voltage_v=data.get("voltage_v", 220.0),
                current_a=data.get("current_a", 0.0),
            )
            self._json(201, {"id": mid})
        elif path == "/api/energy/record":
            ok = record_energy_consumption(
                meter_id=data.get("meter_id", ""),
                energy_kwh=data.get("energy_kwh", 0.0),
            )
            self._json(200, {"recorded": ok})
        elif path == "/api/carbon/record":
            rid = record_carbon(
                source=data.get("source", "grid"),
                energy_kwh=data.get("energy_kwh", 0.0),
                period=data.get("period", "monthly"),
            )
            self._json(201, {"record_id": rid})
        elif path == "/api/pue/record":
            rid = record_pue(
                datacenter=data.get("datacenter", ""),
                total_power_kw=data.get("total_power_kw", 0.0),
                it_power_kw=data.get("it_power_kw", 1.0),
            )
            self._json(201, {"record_id": rid})
        elif path == "/api/policy/create":
            pid = create_policy(
                policy_id=data.get("policy_id", ""),
                name=data.get("name", ""),
                policy_type=data.get("policy_type", ""),
                target=data.get("target", ""),
                rules=data.get("rules", {}),
            )
            self._json(201, {"policy_id": pid})
        elif path == "/api/policy/savings":
            ok = record_policy_savings(
                policy_id=data.get("policy_id", ""),
                saved_kwh=data.get("saved_kwh", 0.0),
            )
            self._json(200, {"recorded": ok})
        elif path == "/api/report/generate":
            rid = generate_sustainability_report(period=data.get("period", "monthly"))
            self._json(201, {"report_id": rid})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Green Computing service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_register(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: register <meter_id> <location> <source>")
        return
    source = args[2] if len(args) > 2 else "grid"
    mid = register_energy_meter(args[0], args[1], source)
    print(json.dumps({"id": mid}, ensure_ascii=False))


def cmd_record_energy(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: record-energy <meter_id> <kwh>")
        return
    print(json.dumps({"recorded": record_energy_consumption(args[0], float(args[1]))},
                       ensure_ascii=False))


def cmd_carbon(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: carbon <source> <kwh>")
        return
    rid = record_carbon(args[0], float(args[1]))
    print(json.dumps({"record_id": rid}, ensure_ascii=False))


def cmd_pue(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: pue <datacenter> <total> <it>")
        return
    rid = record_pue(args[0], float(args[1]), float(args[2]))
    print(json.dumps({"record_id": rid}, ensure_ascii=False))


def cmd_policy(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: policy <id> <name> <type> [target]")
        return
    ptype = args[2] if len(args) > 2 else "auto_scaling"
    target = args[3] if len(args) > 3 else "all"
    pid = create_policy(args[0], args[1], ptype, target)
    print(json.dumps({"policy_id": pid}, ensure_ascii=False))


def cmd_savings(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: savings <policy_id> <kwh>")
        return
    print(json.dumps({"recorded": record_policy_savings(args[0], float(args[1]))},
                       ensure_ascii=False))


def cmd_report(args: List[str]) -> None:
    period = args[0] if args else "monthly"
    print(json.dumps({"report_id": generate_sustainability_report(period)},
                       ensure_ascii=False))


def cmd_score(_args: List[str]) -> None:
    print(json.dumps({"score": calculate_green_score()}, ensure_ascii=False))


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_overview(), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "register": cmd_register,
            "record-energy": cmd_record_energy, "carbon": cmd_carbon,
            "pue": cmd_pue, "policy": cmd_policy, "savings": cmd_savings,
            "report": cmd_report, "score": cmd_score, "overview": cmd_overview}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
数字孪生
P1-38: 系统状态实时镜像, 仿真推演, 风险预演, 容量推演, 故障预演
"""
import json
import os
import random
import sqlite3
import threading
import time
import uuid
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "digital_twin.db")
HTTP_PORT = 10180

SCENARIO_TYPES = ["load", "failure", "capacity", "disaster", "scale"]
ENTITY_TYPES = ["service", "database", "queue", "cache", "load_balancer", "node", "pod", "container"]
SIMULATION_STATUS = ["pending", "running", "completed", "failed"]
PREDICTION_TYPES = ["risk", "capacity", "failure", "performance"]


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS twin_entities (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            entity_id TEXT NOT NULL UNIQUE,
            name TEXT,
            entity_type TEXT,
            properties TEXT,
            state TEXT,
            parent_id TEXT,
            last_sync TEXT
        );
        CREATE TABLE IF NOT EXISTS twin_state_snapshots (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            snapshot_id TEXT NOT NULL UNIQUE,
            total_entities INTEGER,
            payload TEXT,
            sync_status TEXT DEFAULT 'synced'
        );
        CREATE TABLE IF NOT EXISTS simulations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            simulation_id TEXT NOT NULL UNIQUE,
            name TEXT,
            scenario_type TEXT,
            parameters TEXT,
            status TEXT DEFAULT 'pending',
            started_at TEXT,
            finished_at TEXT,
            results TEXT
        );
        CREATE TABLE IF NOT EXISTS predictions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            prediction_id TEXT NOT NULL,
            target_entity TEXT,
            prediction_type TEXT,
            predicted_value REAL,
            confidence REAL,
            time_horizon_hours INTEGER DEFAULT 24,
            factors TEXT
        );
        CREATE TABLE IF NOT EXISTS capacity_forecasts (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            forecast_id TEXT NOT NULL,
            resource_type TEXT,
            current_usage REAL,
            predicted_usage REAL,
            capacity_limit REAL,
            time_to_exhaustion_hours INTEGER,
            recommendation TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_simulations_status ON simulations(status);
        CREATE INDEX IF NOT EXISTS idx_entities_type ON twin_entities(entity_type);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_entity(entity_id: str, name: str, entity_type: str,
                     properties: Optional[Dict] = None,
                     state: Optional[Dict] = None,
                     parent_id: str = "") -> str:
    """注册数字孪生实体"""
    if entity_type not in ENTITY_TYPES:
        entity_type = "service"
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO twin_entities
            (id,timestamp,entity_id,name,entity_type,properties,state,parent_id,last_sync)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (eid, _now(), entity_id, name, entity_type,
             json.dumps(properties or {}, ensure_ascii=False),
             json.dumps(state or {}, ensure_ascii=False),
             parent_id, _now()))
    return eid


def update_entity_state(entity_id: str, state: Dict) -> bool:
    """更新实体状态"""
    with _conn_lock, _conn() as c:
        cur = c.execute("""UPDATE twin_entities SET state = ?, last_sync = ?
            WHERE entity_id = ?""",
            (json.dumps(state, ensure_ascii=False), _now(), entity_id))
    return cur.rowcount > 0


def create_snapshot() -> str:
    """创建全局快照"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT * FROM twin_entities""").fetchall()
        total = len(rows)
        payload = json.dumps([dict(r) for r in rows], ensure_ascii=False)
    sid = str(uuid.uuid4())
    snap_id = f"snap-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO twin_state_snapshots
            (id,timestamp,snapshot_id,total_entities,payload,sync_status)
            VALUES (?,?,?,?,?,?)""",
            (sid, _now(), snap_id, total, payload, "synced"))
    return snap_id


def start_simulation(name: str, scenario_type: str,
                      parameters: Optional[Dict] = None) -> str:
    """启动仿真"""
    if scenario_type not in SCENARIO_TYPES:
        scenario_type = "load"
    sid = str(uuid.uuid4())
    sim_id = f"sim-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO simulations
            (id,timestamp,simulation_id,name,scenario_type,parameters,
             status,started_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            (sid, _now(), sim_id, name, scenario_type,
             json.dumps(parameters or {}, ensure_ascii=False),
             "running", _now()))
    return sim_id


def finish_simulation(sim_id: str, results: Dict) -> bool:
    """完成仿真"""
    with _conn_lock, _conn() as c:
        cur = c.execute("""UPDATE simulations SET status = ?, finished_at = ?,
            results = ? WHERE simulation_id = ?""",
            ("completed", _now(), json.dumps(results, ensure_ascii=False), sim_id))
    return cur.rowcount > 0


def run_load_simulation(sim_id: str, duration_seconds: int = 60,
                          rps: int = 1000) -> Dict[str, Any]:
    """负载仿真"""
    points = []
    for t in range(0, duration_seconds, 10):
        cpu = 30 + random.randint(0, 50)
        memory = 40 + random.randint(0, 40)
        latency = 50 + random.randint(0, 100)
        points.append({"t": t, "cpu": cpu, "memory": memory, "latency_ms": latency})
    avg_cpu = sum(p["cpu"] for p in points) / len(points)
    max_cpu = max(p["cpu"] for p in points)
    avg_latency = sum(p["latency_ms"] for p in points) / len(points)
    results = {
        "scenario": "load", "duration_seconds": duration_seconds, "rps": rps,
        "points": points, "avg_cpu": round(avg_cpu, 2),
        "max_cpu": max_cpu, "avg_latency_ms": round(avg_latency, 2),
        "verdict": "ok" if max_cpu < 90 else "degraded",
    }
    finish_simulation(sim_id, results)
    return results


def run_failure_simulation(sim_id: str, failure_type: str = "node_crash") -> Dict[str, Any]:
    """故障仿真"""
    affected = random.randint(1, 5)
    recovery_time = random.randint(30, 300)
    cascade_risk = round(random.uniform(0.1, 0.9), 2)
    results = {
        "scenario": "failure", "failure_type": failure_type,
        "affected_entities": affected, "recovery_seconds": recovery_time,
        "cascade_risk": cascade_risk,
        "verdict": "manageable" if cascade_risk < 0.5 else "high_risk",
    }
    finish_simulation(sim_id, results)
    return results


def run_capacity_simulation(sim_id: str, growth_rate: float = 0.1,
                              horizon_days: int = 30) -> Dict[str, Any]:
    """容量仿真"""
    series = []
    current = 50.0
    for d in range(horizon_days):
        current = min(100, current * (1 + growth_rate + random.uniform(-0.02, 0.02)))
        series.append({"day": d, "usage_pct": round(current, 2)})
    final = series[-1]["usage_pct"]
    days_to_90 = next((s["day"] for s in series if s["usage_pct"] >= 90), horizon_days)
    results = {
        "scenario": "capacity", "growth_rate": growth_rate,
        "horizon_days": horizon_days, "series": series,
        "final_usage_pct": final, "days_to_90pct": days_to_90,
        "verdict": "ok" if final < 80 else "warning",
    }
    finish_simulation(sim_id, results)
    return results


def predict_risk(target_entity: str, factors: Dict) -> Dict[str, Any]:
    """风险预测"""
    base = 0.0
    base += min(factors.get("cpu", 0) / 100, 0.4)
    base += min(factors.get("memory", 0) / 100, 0.3)
    base += min(factors.get("error_rate", 0) / 10, 0.3)
    risk = min(base, 1.0)
    confidence = 0.6 + (len(factors) * 0.05)
    confidence = min(confidence, 0.95)
    pid = str(uuid.uuid4())
    pred_id = f"pred-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO predictions
            (id,timestamp,prediction_id,target_entity,prediction_type,
             predicted_value,confidence,factors)
            VALUES (?,?,?,?,?,?,?,?)""",
            (pid, _now(), pred_id, target_entity, "risk",
             round(risk, 3), round(confidence, 3),
             json.dumps(factors, ensure_ascii=False)))
    return {"target": target_entity, "risk_score": round(risk, 3),
            "confidence": round(confidence, 3)}


def forecast_capacity(resource_type: str, current_usage: float,
                        capacity_limit: float, growth_rate: float = 0.05) -> Dict[str, Any]:
    """容量预测"""
    if capacity_limit <= 0:
        return {"error": "invalid_capacity"}
    remaining = capacity_limit - current_usage
    if growth_rate <= 0:
        time_to_exhaustion = 99999
    else:
        time_to_exhaustion = int(remaining / (capacity_limit * growth_rate) * 24)
    predicted = current_usage * (1 + growth_rate * 30)
    if predicted > capacity_limit * 0.9:
        rec = "scale_out_immediately"
    elif predicted > capacity_limit * 0.75:
        rec = "plan_scale_out"
    else:
        rec = "no_action"
    fid = str(uuid.uuid4())
    forecast_id = f"fc-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO capacity_forecasts
            (id,timestamp,forecast_id,resource_type,current_usage,
             predicted_usage,capacity_limit,time_to_exhaustion_hours,recommendation)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (fid, _now(), forecast_id, resource_type, current_usage,
             round(predicted, 2), capacity_limit, time_to_exhaustion, rec))
    return {"resource": resource_type, "current": current_usage,
            "predicted_30d": round(predicted, 2),
            "time_to_exhaustion_hours": time_to_exhaustion,
            "recommendation": rec}


def get_twin_overview() -> Dict[str, Any]:
    """获取孪生概览"""
    with _conn_lock, _conn() as c:
        entities = c.execute("SELECT COUNT(*) as c FROM twin_entities").fetchone()["c"]
        snaps = c.execute("SELECT COUNT(*) as c FROM twin_state_snapshots").fetchone()["c"]
        sims = c.execute("""SELECT COUNT(*) as c FROM simulations
            WHERE status = 'running'""").fetchone()["c"]
        risks = c.execute("""SELECT COUNT(*) as c FROM predictions
            WHERE predicted_value > 0.7""").fetchone()["c"]
    return {"total_entities": entities, "snapshots": snaps,
            "running_simulations": sims, "high_risk_predictions": risks}


def get_entity_list(entity_type: str = "") -> List[Dict[str, Any]]:
    """获取实体列表"""
    with _conn_lock, _conn() as c:
        if entity_type:
            rows = c.execute("""SELECT * FROM twin_entities
                WHERE entity_type = ? ORDER BY entity_id""", (entity_type,)).fetchall()
        else:
            rows = c.execute("""SELECT * FROM twin_entities
                ORDER BY entity_id""").fetchall()
    return [dict(r) for r in rows]


def get_simulation(sim_id: str) -> Optional[Dict[str, Any]]:
    """获取仿真"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM simulations
            WHERE simulation_id = ?""", (sim_id,)).fetchone()
    if not row:
        return None
    r = dict(row)
    if r.get("results"):
        r["results"] = json.loads(r["results"])
    if r.get("parameters"):
        r["parameters"] = json.loads(r["parameters"])
    return r


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "digital_twin"}, ensure_ascii=False) + "\n")


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
            self._json(200, {"status": "ok", "service": "digital_twin"})
        elif path == "/api/overview":
            self._json(200, get_twin_overview())
        elif path == "/api/entities":
            etype = qs.get("type", [""])[0]
            self._json(200, {"entities": get_entity_list(etype)})
        elif path.startswith("/api/simulation/"):
            sid = path[15:]
            sim = get_simulation(sid)
            if sim:
                self._json(200, sim)
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
        if path == "/api/entity/register":
            eid = register_entity(
                entity_id=data.get("entity_id", ""),
                name=data.get("name", ""),
                entity_type=data.get("entity_type", "service"),
                properties=data.get("properties"),
                state=data.get("state"),
                parent_id=data.get("parent_id", ""),
            )
            self._json(201, {"id": eid})
        elif path == "/api/entity/update":
            ok = update_entity_state(
                entity_id=data.get("entity_id", ""),
                state=data.get("state", {}),
            )
            self._json(200, {"updated": ok})
        elif path == "/api/snapshot":
            snap_id = create_snapshot()
            self._json(201, {"snapshot_id": snap_id})
        elif path == "/api/simulation/start":
            sid = start_simulation(
                name=data.get("name", ""),
                scenario_type=data.get("scenario_type", "load"),
                parameters=data.get("parameters"),
            )
            self._json(201, {"simulation_id": sid})
        elif path == "/api/simulation/load":
            sid = start_simulation(
                name=data.get("name", "load-sim"),
                scenario_type="load",
            )
            results = run_load_simulation(
                sid,
                duration_seconds=data.get("duration", 60),
                rps=data.get("rps", 1000),
            )
            self._json(200, {"simulation_id": sid, "results": results})
        elif path == "/api/simulation/failure":
            sid = start_simulation(
                name=data.get("name", "failure-sim"),
                scenario_type="failure",
            )
            results = run_failure_simulation(
                sid,
                failure_type=data.get("failure_type", "node_crash"),
            )
            self._json(200, {"simulation_id": sid, "results": results})
        elif path == "/api/simulation/capacity":
            sid = start_simulation(
                name=data.get("name", "capacity-sim"),
                scenario_type="capacity",
            )
            results = run_capacity_simulation(
                sid,
                growth_rate=data.get("growth_rate", 0.1),
                horizon_days=data.get("horizon_days", 30),
            )
            self._json(200, {"simulation_id": sid, "results": results})
        elif path == "/api/predict/risk":
            result = predict_risk(
                target_entity=data.get("target_entity", ""),
                factors=data.get("factors", {}),
            )
            self._json(200, result)
        elif path == "/api/forecast/capacity":
            result = forecast_capacity(
                resource_type=data.get("resource_type", "cpu"),
                current_usage=data.get("current_usage", 50.0),
                capacity_limit=data.get("capacity_limit", 100.0),
                growth_rate=data.get("growth_rate", 0.05),
            )
            self._json(200, result)
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Digital Twin service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_register(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: register <entity_id> <name> <type>")
        return
    eid = register_entity(args[0], args[1], args[2])
    print(json.dumps({"id": eid}, ensure_ascii=False))


def cmd_update(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: update <entity_id> <state_json>")
        return
    state = json.loads(args[1])
    print(json.dumps({"updated": update_entity_state(args[0], state)},
                       ensure_ascii=False))


def cmd_snapshot(_args: List[str]) -> None:
    print(json.dumps({"snapshot_id": create_snapshot()}, ensure_ascii=False))


def cmd_simulate(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: simulate <scenario> <name> [params_json]")
        return
    scenario = args[0]
    name = args[1]
    params = json.loads(args[2]) if len(args) > 2 else {}
    sid = start_simulation(name, scenario, params)
    if scenario == "load":
        results = run_load_simulation(sid)
    elif scenario == "failure":
        results = run_failure_simulation(sid)
    elif scenario == "capacity":
        results = run_capacity_simulation(sid)
    else:
        results = {}
    print(json.dumps({"simulation_id": sid, "results": results},
                       ensure_ascii=False, indent=2))


def cmd_predict(args: List[str]) -> None:
    if not args:
        print("usage: predict <target> [factors_json]")
        return
    factors = json.loads(args[1]) if len(args) > 1 else {}
    print(json.dumps(predict_risk(args[0], factors),
                       ensure_ascii=False, indent=2))


def cmd_forecast(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: forecast <resource> <current> <limit> [growth_rate]")
        return
    growth = float(args[3]) if len(args) > 3 else 0.05
    print(json.dumps(forecast_capacity(args[0], float(args[1]),
                                          float(args[2]), growth),
                       ensure_ascii=False, indent=2))


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_twin_overview(), ensure_ascii=False, indent=2))


def cmd_entities(args: List[str]) -> None:
    etype = args[0] if args else ""
    print(json.dumps(get_entity_list(etype), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "register": cmd_register, "update": cmd_update,
            "snapshot": cmd_snapshot, "simulate": cmd_simulate,
            "predict": cmd_predict, "forecast": cmd_forecast,
            "overview": cmd_overview, "entities": cmd_entities}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

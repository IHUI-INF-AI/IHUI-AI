#!/usr/bin/env python3
"""
P2-53 数字孪生城市
城市仿真 + 流量预测 + 应急推演
"""
import json
import math
import os
import sqlite3
import threading
import time
import uuid
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "digital_twin_city.db")
HTTP_PORT = 10330

ENTITY_TYPES = ["building", "road", "bridge", "park", "sensor", "vehicle", "citizen"]
SCENARIO_STATUSES = ["draft", "running", "completed", "failed"]
PREDICTION_TYPES = ["traffic", "pollution", "energy", "crowd", "noise"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS city_entities (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            name TEXT,
            latitude REAL,
            longitude REAL,
            properties TEXT,
            status TEXT DEFAULT 'active'
        );
        CREATE TABLE IF NOT EXISTS simulation_scenarios (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            scenario_name TEXT NOT NULL,
            scenario_type TEXT,
            duration_minutes INTEGER DEFAULT 60,
            status TEXT DEFAULT 'draft',
            result TEXT,
            created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS city_sensors (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            sensor_id TEXT NOT NULL UNIQUE,
            entity_id TEXT,
            sensor_type TEXT,
            latitude REAL,
            longitude REAL,
            last_value REAL
        );
        CREATE TABLE IF NOT EXISTS sensor_readings (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            sensor_id TEXT NOT NULL,
            value REAL,
            unit TEXT
        );
        CREATE TABLE IF NOT EXISTS city_predictions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            prediction_type TEXT NOT NULL,
            region TEXT,
            predicted_value REAL,
            confidence REAL,
            time_horizon_hours INTEGER,
            model_name TEXT
        );
        CREATE TABLE IF NOT EXISTS emergency_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            location_lat REAL,
            location_lon REAL,
            severity TEXT,
            affected_population INTEGER DEFAULT 0,
            response_status TEXT DEFAULT 'pending',
            resolved_at TEXT
        );
        CREATE TABLE IF NOT EXISTS traffic_flow (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            road_id TEXT NOT NULL,
            vehicle_count INTEGER DEFAULT 0,
            avg_speed_kmh REAL DEFAULT 0,
            congestion_level TEXT DEFAULT 'low'
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def add_city_entity(entity_id: str, entity_type: str, name: str = "",
                     latitude: float = 0.0, longitude: float = 0.0,
                     properties: Optional[Dict] = None) -> str:
    """添加城市实体"""
    if entity_type not in ENTITY_TYPES:
        entity_type = "building"
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO city_entities
            (id,timestamp,entity_id,entity_type,name,latitude,longitude,properties,status)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (eid, _now(), entity_id, entity_type, name, latitude, longitude,
             json.dumps(properties or {}, ensure_ascii=False), "active"))
    return eid


def create_scenario(scenario_name: str, scenario_type: str = "drill",
                     duration_minutes: int = 60,
                     created_by: str = "system") -> str:
    """创建仿真场景"""
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO simulation_scenarios
            (id,timestamp,scenario_name,scenario_type,duration_minutes,status,result,created_by)
            VALUES (?,?,?,?,?,?,?,?)""",
            (sid, _now(), scenario_name, scenario_type, duration_minutes,
             "draft", "", created_by))
    return sid


def run_scenario(scenario_id: str) -> Dict:
    """运行仿真"""
    with _conn() as c:
        scenario = c.execute("""SELECT * FROM simulation_scenarios WHERE id=?""",
                              (scenario_id,)).fetchone()
        if not scenario:
            return {"error": "scenario not found"}
        entities = c.execute("""SELECT COUNT(*) as c FROM city_entities""").fetchone()["c"]
    steps = min(10, scenario["duration_minutes"] // 6)
    result = {
        "scenario_id": scenario_id,
        "scenario_name": scenario["scenario_name"],
        "duration_minutes": scenario["duration_minutes"],
        "steps_simulated": steps,
        "entities_affected": entities,
        "metrics": {
            "avg_traffic": 45.0,
            "avg_pollution": 35.0,
            "energy_consumption": 1200.0,
        }
    }
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE simulation_scenarios SET status='completed', result=?
            WHERE id=?""", (json.dumps(result, ensure_ascii=False), scenario_id))
    return result


def register_city_sensor(sensor_id: str, entity_id: str = "",
                          sensor_type: str = "traffic",
                          latitude: float = 0.0,
                          longitude: float = 0.0) -> str:
    """注册城市传感器"""
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO city_sensors
            (id,timestamp,sensor_id,entity_id,sensor_type,latitude,longitude,last_value)
            VALUES (?,?,?,?,?,?,?,?)""",
            (sid, _now(), sensor_id, entity_id, sensor_type,
             latitude, longitude, 0))
    return sid


def record_sensor_reading(sensor_id: str, value: float, unit: str = "") -> str:
    """记录传感器读数"""
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO sensor_readings
            (id,timestamp,sensor_id,value,unit)
            VALUES (?,?,?,?,?)""",
            (rid, _now(), sensor_id, value, unit))
        c.execute("""UPDATE city_sensors SET last_value=? WHERE sensor_id=?""",
                   (value, sensor_id))
    return rid


def predict_city(prediction_type: str, region: str = "downtown",
                  horizon_hours: int = 24, model: str = "lstm") -> str:
    """城市预测"""
    if prediction_type not in PREDICTION_TYPES:
        prediction_type = "traffic"
    base_values = {"traffic": 50, "pollution": 30, "energy": 1000,
                    "crowd": 500, "noise": 60}
    pred_value = base_values[prediction_type]
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO city_predictions
            (id,timestamp,prediction_type,region,predicted_value,confidence,time_horizon_hours,model_name)
            VALUES (?,?,?,?,?,?,?,?)""",
            (pid, _now(), prediction_type, region, pred_value,
             0.85, horizon_hours, model))
    return pid


def report_emergency(event_type: str, lat: float, lon: float,
                      severity: str = "medium",
                      affected_population: int = 0) -> str:
    """上报应急事件"""
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO emergency_events
            (id,timestamp,event_type,location_lat,location_lon,severity,
             affected_population,response_status,resolved_at)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (eid, _now(), event_type, lat, lon, severity,
             affected_population, "pending", ""))
    return eid


def resolve_emergency(event_id: str) -> bool:
    """解决应急事件"""
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE emergency_events SET response_status='resolved',
            resolved_at=? WHERE id=?""", (_now(), event_id))
        return c.total_changes > 0


def record_traffic(road_id: str, vehicle_count: int, avg_speed: float) -> str:
    """记录交通流量"""
    if avg_speed > 60:
        level = "low"
    elif avg_speed > 30:
        level = "medium"
    elif avg_speed > 10:
        level = "high"
    else:
        level = "severe"
    tid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO traffic_flow
            (id,timestamp,road_id,vehicle_count,avg_speed_kmh,congestion_level)
            VALUES (?,?,?,?,?,?)""",
            (tid, _now(), road_id, vehicle_count, avg_speed, level))
    return tid


def get_digital_twin_report() -> Dict:
    """数字孪生报告"""
    with _conn() as c:
        entities = c.execute("""SELECT COUNT(*) as c FROM city_entities""").fetchone()["c"]
        sensors = c.execute("""SELECT COUNT(*) as c FROM city_sensors""").fetchone()["c"]
        scenarios = c.execute("""SELECT COUNT(*) as c FROM simulation_scenarios""").fetchone()["c"]
        completed = c.execute("""SELECT COUNT(*) as c FROM simulation_scenarios WHERE status='completed'""").fetchone()["c"]
        predictions = c.execute("""SELECT COUNT(*) as c FROM city_predictions""").fetchone()["c"]
        emergencies = c.execute("""SELECT COUNT(*) as c FROM emergency_events""").fetchone()["c"]
        resolved = c.execute("""SELECT COUNT(*) as c FROM emergency_events WHERE response_status='resolved'""").fetchone()["c"]
    return {
        "total_entities": entities,
        "total_sensors": sensors,
        "total_scenarios": scenarios,
        "completed_scenarios": completed,
        "total_predictions": predictions,
        "total_emergencies": emergencies,
        "resolved_emergencies": resolved,
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
            self._send(200, get_digital_twin_report())
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
        if u.path == "/api/entity":
            eid = add_city_entity(
                data.get("entity_id", "ent-" + uuid.uuid4().hex[:6]),
                data.get("entity_type", "building"),
                data.get("name", ""),
                data.get("latitude", 0.0),
                data.get("longitude", 0.0),
                data.get("properties"),
            )
            self._send(200, {"entity_id": eid})
        elif u.path == "/api/scenario":
            sid = create_scenario(
                data.get("scenario_name", "sc-" + uuid.uuid4().hex[:6]),
                data.get("scenario_type", "drill"),
                data.get("duration_minutes", 60),
                data.get("created_by", "system"),
            )
            self._send(200, {"scenario_id": sid})
        elif u.path == "/api/scenario/run":
            result = run_scenario(data.get("scenario_id", ""))
            self._send(200, result)
        elif u.path == "/api/sensor":
            sid = register_city_sensor(
                data.get("sensor_id", "s-" + uuid.uuid4().hex[:6]),
                data.get("entity_id", ""),
                data.get("sensor_type", "traffic"),
                data.get("latitude", 0.0),
                data.get("longitude", 0.0),
            )
            self._send(200, {"sensor_id": sid})
        elif u.path == "/api/reading":
            rid = record_sensor_reading(
                data.get("sensor_id", ""),
                data.get("value", 0),
                data.get("unit", ""),
            )
            self._send(200, {"reading_id": rid})
        elif u.path == "/api/predict":
            pid = predict_city(
                data.get("prediction_type", "traffic"),
                data.get("region", "downtown"),
                data.get("horizon_hours", 24),
                data.get("model", "lstm"),
            )
            self._send(200, {"prediction_id": pid})
        elif u.path == "/api/emergency":
            eid = report_emergency(
                data.get("event_type", "fire"),
                data.get("latitude", 0.0),
                data.get("longitude", 0.0),
                data.get("severity", "medium"),
                data.get("affected_population", 0),
            )
            self._send(200, {"event_id": eid})
        elif u.path == "/api/emergency/resolve":
            ok = resolve_emergency(data.get("event_id", ""))
            self._send(200, {"ok": ok})
        elif u.path == "/api/traffic":
            tid = record_traffic(
                data.get("road_id", ""),
                data.get("vehicle_count", 0),
                data.get("avg_speed", 0),
            )
            self._send(200, {"traffic_id": tid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P2-53 数字孪生城市")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"数字孪生城市 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_digital_twin_report(), ensure_ascii=False, indent=2))

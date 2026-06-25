#!/usr/bin/env python3
"""
P2-51 卫星运维
轨道预测 + 通信链路 + 地面站管理
"""
import json
import math
import os
import sqlite3
import threading
import time
import uuid
from datetime import datetime
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "satellite_ops.db")
HTTP_PORT = 10310

ORBIT_TYPES = ["LEO", "MEO", "GEO", "HEO", "SSO"]
SAT_STATUSES = ["operational", "degraded", "safe_hold", "offline", "commissioning"]
GROUND_STATION_STATUSES = ["online", "offline", "maintenance", "tracking"]


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS satellites (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            satellite_id TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            orbit_type TEXT,
            altitude_km REAL,
            inclination_deg REAL,
            period_minutes REAL,
            status TEXT DEFAULT 'operational',
            launch_date TEXT,
            operator TEXT
        );
        CREATE TABLE IF NOT EXISTS orbit_predictions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            satellite_id TEXT NOT NULL,
            prediction_time TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            altitude_km REAL,
            velocity_kms REAL
        );
        CREATE TABLE IF NOT EXISTS ground_stations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            station_id TEXT NOT NULL UNIQUE,
            name TEXT,
            latitude REAL,
            longitude REAL,
            altitude_m REAL,
            status TEXT DEFAULT 'online',
            antenna_count INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS communication_passes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            satellite_id TEXT NOT NULL,
            station_id TEXT NOT NULL,
            aos_time TEXT,
            los_time TEXT,
            max_elevation REAL,
            duration_seconds INTEGER DEFAULT 0,
            signal_quality REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS telemetry (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            satellite_id TEXT NOT NULL,
            subsystem TEXT,
            parameter TEXT,
            value REAL,
            unit TEXT
        );
        CREATE TABLE IF NOT EXISTS command_log (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            satellite_id TEXT NOT NULL,
            command TEXT NOT NULL,
            executed_by TEXT,
            success INTEGER DEFAULT 1,
            response TEXT
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_satellite(satellite_id: str, name: str, orbit_type: str = "LEO",
                        altitude_km: float = 500.0,
                        inclination: float = 45.0,
                        launch_date: str = "",
                        operator: str = "default") -> str:
    """注册卫星"""
    if orbit_type not in ORBIT_TYPES:
        orbit_type = "LEO"
    if orbit_type == "LEO":
        period = 90.0
    elif orbit_type == "MEO":
        period = 360.0
    elif orbit_type == "GEO":
        period = 1436.0
    elif orbit_type == "HEO":
        period = 720.0
    else:
        period = 95.0
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO satellites
            (id,timestamp,satellite_id,name,orbit_type,altitude_km,inclination_deg,
             period_minutes,status,launch_date,operator)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (sid, _now(), satellite_id, name, orbit_type, altitude_km,
             inclination, period, "operational", launch_date, operator))
    return sid


def predict_orbit(satellite_id: str, minutes_ahead: int = 90) -> str:
    """轨道预测"""
    with _conn() as c:
        sat = c.execute("""SELECT * FROM satellites WHERE satellite_id=?""",
                         (satellite_id,)).fetchone()
    if not sat:
        return ""
    pid = str(uuid.uuid4())
    n_points = max(1, minutes_ahead // 5)
    base_lat = 0.0
    base_lon = 0.0
    with _conn_lock, _conn() as c:
        for i in range(n_points):
            t = i * 5
            phase = (t / sat["period_minutes"]) * 2 * math.pi
            lat = math.sin(phase) * sat["inclination_deg"]
            lon = (base_lon + t * (360.0 / max(1, sat["period_minutes"]))) % 360
            if lon > 180:
                lon -= 360
            pred_id = str(uuid.uuid4())
            c.execute("""INSERT INTO orbit_predictions
                (id,timestamp,satellite_id,prediction_time,latitude,longitude,altitude_km,velocity_kms)
                VALUES (?,?,?,?,?,?,?,?)""",
                (pred_id, _now(), satellite_id, _now(),
                 lat, lon, sat["altitude_km"], 7.5))
    return pid


def register_ground_station(station_id: str, name: str, lat: float = 0.0,
                              lon: float = 0.0, alt: float = 0.0,
                              antennas: int = 1) -> str:
    """注册地面站"""
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO ground_stations
            (id,timestamp,station_id,name,latitude,longitude,altitude_m,status,antenna_count)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (sid, _now(), station_id, name, lat, lon, alt, "online", antennas))
    return sid


def schedule_pass(satellite_id: str, station_id: str, aos: str, los: str,
                   max_elev: float = 45.0) -> str:
    """安排过境"""
    try:
        aos_dt = datetime.fromisoformat(aos.replace("Z", ""))
        los_dt = datetime.fromisoformat(los.replace("Z", ""))
        duration = int((los_dt - aos_dt).total_seconds())
    except Exception:
        duration = 600
    pid = str(uuid.uuid4())
    quality = max(0.0, 1.0 - (90 - max_elev) / 90.0)
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO communication_passes
            (id,timestamp,satellite_id,station_id,aos_time,los_time,max_elevation,duration_seconds,signal_quality)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (pid, _now(), satellite_id, station_id, aos, los, max_elev, duration, quality))
    return pid


def record_telemetry(satellite_id: str, subsystem: str, parameter: str,
                      value: float, unit: str = "") -> str:
    """记录遥测"""
    tid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO telemetry
            (id,timestamp,satellite_id,subsystem,parameter,value,unit)
            VALUES (?,?,?,?,?,?,?)""",
            (tid, _now(), satellite_id, subsystem, parameter, value, unit))
    return tid


def send_command(satellite_id: str, command: str, executed_by: str = "system",
                  success: bool = True, response: str = "") -> str:
    """发送指令"""
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO command_log
            (id,timestamp,satellite_id,command,executed_by,success,response)
            VALUES (?,?,?,?,?,?,?)""",
            (cid, _now(), satellite_id, command, executed_by,
             1 if success else 0, response))
    return cid


def get_satellite_report() -> Dict:
    """卫星报告"""
    with _conn() as c:
        sats = c.execute("""SELECT COUNT(*) as c FROM satellites""").fetchone()["c"]
        operational = c.execute("""SELECT COUNT(*) as c FROM satellites WHERE status='operational'""").fetchone()["c"]
        stations = c.execute("""SELECT COUNT(*) as c FROM ground_stations""").fetchone()["c"]
        online_st = c.execute("""SELECT COUNT(*) as c FROM ground_stations WHERE status='online'""").fetchone()["c"]
        passes = c.execute("""SELECT COUNT(*) as c FROM communication_passes""").fetchone()["c"]
        commands = c.execute("""SELECT COUNT(*) as c FROM command_log""").fetchone()["c"]
        success = c.execute("""SELECT COUNT(*) as c FROM command_log WHERE success=1""").fetchone()["c"]
    return {
        "total_satellites": sats,
        "operational_satellites": operational,
        "total_ground_stations": stations,
        "online_stations": online_st,
        "total_passes": passes,
        "total_commands": commands,
        "successful_commands": success,
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
            self._send(200, get_satellite_report())
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
        if u.path == "/api/satellite":
            sid = register_satellite(
                data.get("satellite_id", "sat-" + uuid.uuid4().hex[:6]),
                data.get("name", "default"),
                data.get("orbit_type", "LEO"),
                data.get("altitude_km", 500.0),
                data.get("inclination", 45.0),
                data.get("launch_date", ""),
                data.get("operator", "default"),
            )
            self._send(200, {"satellite_id": sid})
        elif u.path == "/api/orbit/predict":
            pid = predict_orbit(
                data.get("satellite_id", ""),
                data.get("minutes_ahead", 90),
            )
            self._send(200, {"prediction_id": pid})
        elif u.path == "/api/station":
            sid = register_ground_station(
                data.get("station_id", "gs-" + uuid.uuid4().hex[:6]),
                data.get("name", "default"),
                data.get("latitude", 0.0),
                data.get("longitude", 0.0),
                data.get("altitude", 0.0),
                data.get("antennas", 1),
            )
            self._send(200, {"station_id": sid})
        elif u.path == "/api/pass":
            pid = schedule_pass(
                data.get("satellite_id", ""),
                data.get("station_id", ""),
                data.get("aos", ""),
                data.get("los", ""),
                data.get("max_elevation", 45.0),
            )
            self._send(200, {"pass_id": pid})
        elif u.path == "/api/telemetry":
            tid = record_telemetry(
                data.get("satellite_id", ""),
                data.get("subsystem", ""),
                data.get("parameter", ""),
                data.get("value", 0),
                data.get("unit", ""),
            )
            self._send(200, {"telemetry_id": tid})
        elif u.path == "/api/command":
            cid = send_command(
                data.get("satellite_id", ""),
                data.get("command", ""),
                data.get("executed_by", "system"),
                data.get("success", True),
                data.get("response", ""),
            )
            self._send(200, {"command_id": cid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P2-51 卫星运维")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"卫星运维 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_satellite_report(), ensure_ascii=False, indent=2))

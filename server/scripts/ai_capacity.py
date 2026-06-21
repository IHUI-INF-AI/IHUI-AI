#!/usr/bin/env python3
"""
P0-44 AI 容量规划
时序预测 + 自动扩缩容
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

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "ai_capacity.db")
HTTP_PORT = 10240

METRIC_TYPES = ["cpu", "memory", "disk", "network", "qps", "latency"]
FORECAST_ALGORITHMS = ["linear", "exponential", "arima", "prophet", "lstm"]
SCALING_ACTIONS = ["scale_out", "scale_in", "no_action", "alert_only"]
RESOURCE_TYPES = ["pod", "vm", "node", "container"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS metric_history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            metric_type TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT
        );
        CREATE TABLE IF NOT EXISTS forecast_results (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            metric_type TEXT NOT NULL,
            algorithm TEXT NOT NULL,
            forecast_horizon_hours INTEGER,
            predicted_value REAL,
            confidence_lower REAL,
            confidence_upper REAL,
            generated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS scaling_recommendations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            action TEXT NOT NULL,
            current_capacity INTEGER,
            recommended_capacity INTEGER,
            reason TEXT,
            priority TEXT DEFAULT 'medium',
            applied INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS capacity_policies (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            policy_name TEXT NOT NULL UNIQUE,
            resource_type TEXT NOT NULL,
            min_capacity INTEGER DEFAULT 1,
            max_capacity INTEGER DEFAULT 100,
            target_utilization REAL DEFAULT 70.0,
            scale_out_threshold REAL DEFAULT 80.0,
            scale_in_threshold REAL DEFAULT 30.0
        );
        CREATE TABLE IF NOT EXISTS scaling_history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            from_capacity INTEGER,
            to_capacity INTEGER,
            action TEXT,
            success INTEGER DEFAULT 1,
            note TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_metric_resource ON metric_history(resource_id);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def record_metric(resource_id: str, metric_type: str, value: float, unit: str = "%") -> str:
    """记录指标"""
    if metric_type not in METRIC_TYPES:
        metric_type = "cpu"
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO metric_history
            (id,timestamp,resource_id,metric_type,value,unit)
            VALUES (?,?,?,?,?,?)""",
            (mid, _now(), resource_id, metric_type, value, unit))
    return mid


def create_policy(policy_name: str, resource_type: str,
                   min_capacity: int = 1, max_capacity: int = 100,
                   target_utilization: float = 70.0,
                   scale_out_threshold: float = 80.0,
                   scale_in_threshold: float = 30.0) -> str:
    """创建容量策略"""
    if resource_type not in RESOURCE_TYPES:
        resource_type = "pod"
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO capacity_policies
            (id,timestamp,policy_name,resource_type,min_capacity,max_capacity,target_utilization,
             scale_out_threshold,scale_in_threshold)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (pid, _now(), policy_name, resource_type,
             min_capacity, max_capacity, target_utilization,
             scale_out_threshold, scale_in_threshold))
    return pid


def _linear_forecast(values: List[float], horizon: int) -> List[float]:
    """线性预测"""
    if not values:
        return [0.0] * horizon
    n = len(values)
    avg = sum(values) / n
    if n > 1:
        slope = (values[-1] - values[0]) / (n - 1)
    else:
        slope = 0
    return [avg + slope * (n + i) for i in range(1, horizon + 1)]


def _exponential_forecast(values: List[float], horizon: int, alpha: float = 0.3) -> List[float]:
    """指数平滑预测"""
    if not values:
        return [0.0] * horizon
    s = values[0]
    for v in values[1:]:
        s = alpha * v + (1 - alpha) * s
    return [s] * horizon


def generate_forecast(resource_id: str, metric_type: str, algorithm: str = "linear",
                       horizon_hours: int = 24) -> str:
    """生成预测"""
    if algorithm not in FORECAST_ALGORITHMS:
        algorithm = "linear"
    if metric_type not in METRIC_TYPES:
        metric_type = "cpu"
    with _conn() as c:
        rows = c.execute("""SELECT value FROM metric_history
            WHERE resource_id=? AND metric_type=? ORDER BY timestamp ASC""",
            (resource_id, metric_type)).fetchall()
    values = [r["value"] for r in rows[-100:]]
    if algorithm == "linear":
        preds = _linear_forecast(values, horizon_hours)
    elif algorithm == "exponential":
        preds = _exponential_forecast(values, horizon_hours)
    else:
        preds = _linear_forecast(values, horizon_hours)
    pred_value = sum(preds) / max(1, len(preds))
    std = 0
    if len(preds) > 1:
        mean = pred_value
        std = (sum((p - mean) ** 2 for p in preds) / len(preds)) ** 0.5
    fid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO forecast_results
            (id,timestamp,resource_id,metric_type,algorithm,forecast_horizon_hours,
             predicted_value,confidence_lower,confidence_upper,generated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (fid, _now(), resource_id, metric_type, algorithm, horizon_hours,
             pred_value, pred_value - 1.96 * std, pred_value + 1.96 * std, _now()))
    return fid


def recommend_scaling(resource_id: str, current_capacity: int = 1) -> str:
    """生成扩缩容建议"""
    with _conn() as c:
        latest = c.execute("""SELECT value FROM metric_history
            WHERE resource_id=? AND metric_type='cpu' ORDER BY timestamp DESC LIMIT 1""",
            (resource_id,)).fetchone()
        policy = c.execute("""SELECT * FROM capacity_policies LIMIT 1""").fetchone()
    if not latest:
        action = "no_action"
        recommended = current_capacity
        reason = "无数据"
    else:
        v = latest["value"]
        if policy:
            scale_out_t = policy["scale_out_threshold"]
            scale_in_t = policy["scale_in_threshold"]
            max_cap = policy["max_capacity"]
            min_cap = policy["min_capacity"]
        else:
            scale_out_t = 80.0
            scale_in_t = 30.0
            max_cap = 100
            min_cap = 1
        if v >= scale_out_t:
            action = "scale_out"
            recommended = min(max_cap, current_capacity + max(1, current_capacity // 2))
            reason = f"CPU={v:.1f}% >= {scale_out_t}%"
        elif v <= scale_in_t:
            action = "scale_in"
            recommended = max(min_cap, current_capacity - 1)
            reason = f"CPU={v:.1f}% <= {scale_in_t}%"
        else:
            action = "no_action"
            recommended = current_capacity
            reason = f"CPU={v:.1f}% 在阈值内"
    rid = str(uuid.uuid4())
    priority = "high" if action == "scale_out" else "low" if action == "scale_in" else "medium"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO scaling_recommendations
            (id,timestamp,resource_id,action,current_capacity,recommended_capacity,reason,priority,applied)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), resource_id, action, current_capacity, recommended,
             reason, priority, 0))
    return rid


def apply_scaling(resource_id: str, from_cap: int, to_cap: int, action: str) -> str:
    """应用扩缩容"""
    if action not in SCALING_ACTIONS:
        action = "no_action"
    hid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO scaling_history
            (id,timestamp,resource_id,from_capacity,to_capacity,action,success,note)
            VALUES (?,?,?,?,?,?,?,?)""",
            (hid, _now(), resource_id, from_cap, to_cap, action, 1, "applied"))
        c.execute("""UPDATE scaling_recommendations SET applied=1
            WHERE resource_id=? AND action=? AND applied=0""",
            (resource_id, action))
    return hid


def get_recommendations(limit: int = 50) -> List[Dict]:
    """获取建议"""
    with _conn() as c:
        rows = c.execute("""SELECT * FROM scaling_recommendations
            ORDER BY timestamp DESC LIMIT ?""", (limit,)).fetchall()
    return [dict(r) for r in rows]


def get_forecast(resource_id: str, metric_type: str = "cpu") -> List[Dict]:
    """获取预测"""
    with _conn() as c:
        rows = c.execute("""SELECT * FROM forecast_results
            WHERE resource_id=? AND metric_type=? ORDER BY generated_at DESC LIMIT 10""",
            (resource_id, metric_type)).fetchall()
    return [dict(r) for r in rows]


def get_capacity_report() -> Dict:
    """获取容量报告"""
    with _conn() as c:
        rec_count = c.execute("""SELECT COUNT(*) as c FROM scaling_recommendations""").fetchone()["c"]
        scale_out = c.execute("""SELECT COUNT(*) as c FROM scaling_recommendations WHERE action='scale_out'""").fetchone()["c"]
        scale_in = c.execute("""SELECT COUNT(*) as c FROM scaling_recommendations WHERE action='scale_in'""").fetchone()["c"]
        forecasts = c.execute("""SELECT COUNT(*) as c FROM forecast_results""").fetchone()["c"]
        resources = c.execute("""SELECT COUNT(DISTINCT resource_id) as c FROM metric_history""").fetchone()["c"]
    return {
        "total_recommendations": rec_count,
        "scale_out_count": scale_out,
        "scale_in_count": scale_in,
        "total_forecasts": forecasts,
        "monitored_resources": resources,
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
            self._send(200, get_capacity_report())
        elif u.path == "/api/recommendations":
            self._send(200, {"items": get_recommendations()})
        elif u.path == "/api/forecast":
            q = parse_qs(u.query)
            self._send(200, {"items": get_forecast(
                q.get("resource_id", ["default"])[0],
                q.get("metric_type", ["cpu"])[0])})
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
        if u.path == "/api/metric":
            mid = record_metric(
                data.get("resource_id", "default"),
                data.get("metric_type", "cpu"),
                data.get("value", 0),
                data.get("unit", "%"),
            )
            self._send(200, {"metric_id": mid})
        elif u.path == "/api/policy":
            pid = create_policy(
                data.get("policy_name", "default"),
                data.get("resource_type", "pod"),
                data.get("min_capacity", 1),
                data.get("max_capacity", 100),
                data.get("target_utilization", 70.0),
                data.get("scale_out_threshold", 80.0),
                data.get("scale_in_threshold", 30.0),
            )
            self._send(200, {"policy_id": pid})
        elif u.path == "/api/forecast":
            fid = generate_forecast(
                data.get("resource_id", "default"),
                data.get("metric_type", "cpu"),
                data.get("algorithm", "linear"),
                data.get("horizon_hours", 24),
            )
            self._send(200, {"forecast_id": fid})
        elif u.path == "/api/recommend":
            rid = recommend_scaling(
                data.get("resource_id", "default"),
                data.get("current_capacity", 1),
            )
            self._send(200, {"rec_id": rid})
        elif u.path == "/api/apply":
            hid = apply_scaling(
                data.get("resource_id", "default"),
                data.get("from_cap", 0),
                data.get("to_cap", 0),
                data.get("action", "no_action"),
            )
            self._send(200, {"history_id": hid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P0-44 AI 容量规划")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"容量规划 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_capacity_report(), ensure_ascii=False, indent=2))

#!/usr/bin/env python3
"""
P0-65 统一大盘集成
将 Round 13/14 全部服务注册到统一可观测性平台
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

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "unified_integration.db")
HTTP_PORT = 10450

INTEGRATION_STATUSES = ["pending", "registered", "healthy", "degraded", "offline"]

ROUND14_SERVICES = [
    ("fullstack_apm", 10230, "P0-43", "全栈 APM"),
    ("ai_capacity", 10240, "P0-44", "AI 容量规划"),
    ("zero_trust", 10250, "P0-45", "零信任安全"),
    ("edge_federation", 10260, "P1-46", "边缘 AI 联邦推理"),
    ("llm_alert_dedup", 10270, "P1-47", "智能告警降噪"),
    ("adaptive_chaos", 10280, "P1-48", "自适应混沌工程"),
    ("faas_platform", 10290, "P1-49", "Serverless FaaS"),
    ("neuromorphic", 10300, "P2-50", "神经形态计算"),
    ("satellite_ops", 10310, "P2-51", "卫星运维"),
    ("bci_monitor", 10320, "P2-52", "脑机接口监控"),
    ("digital_twin_city", 10330, "P2-53", "数字孪生城市"),
]

ROUND13_SERVICES = [
    ("unified_observability", 10120, "P0-32", "统一可观测性"),
    ("multi_cloud", 10130, "P0-33", "跨云多活"),
    ("api_gateway", 10140, "P0-34", "API 网关"),
    ("edge_computing", 10150, "P1-35", "边缘计算"),
    ("ai_testing", 10160, "P1-36", "智能测试平台"),
    ("blockchain_audit", 10170, "P1-37", "区块链审计"),
    ("digital_twin", 10180, "P1-38", "数字孪生"),
    ("green_computing", 10190, "P2-39", "绿色计算"),
    ("quantum_crypto", 10200, "P2-40", "量子加密"),
    ("privacy_computing", 10210, "P2-41", "隐私计算"),
    ("metaverse_ops", 10220, "P2-42", "元宇宙运维"),
]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS integrated_services (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            service_name TEXT NOT NULL UNIQUE,
            service_id TEXT NOT NULL,
            port INTEGER NOT NULL,
            round_label TEXT,
            description TEXT,
            status TEXT DEFAULT 'pending',
            last_health_check TEXT,
            registered_at TEXT
        );
        CREATE TABLE IF NOT EXISTS integration_log (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            service_name TEXT NOT NULL,
            action TEXT NOT NULL,
            result TEXT,
            details TEXT
        );
        CREATE TABLE IF NOT EXISTS sync_metrics (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            service_name TEXT NOT NULL,
            metric_name TEXT,
            metric_value REAL,
            synced INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS dashboard_bindings (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            dashboard_name TEXT NOT NULL,
            service_name TEXT NOT NULL,
            panel_type TEXT,
            priority INTEGER DEFAULT 0
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_integration(service_name: str, service_id: str, port: int,
                          round_label: str = "", description: str = "") -> str:
    """注册集成服务"""
    if port < 1 or port > 65535:
        port = 0
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO integrated_services
            (id,timestamp,service_name,service_id,port,round_label,description,status,last_health_check,registered_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (sid, _now(), service_name, service_id, port, round_label,
             description, "registered", _now(), _now()))
    return sid


def batch_register_round(round_num: int) -> Dict:
    """批量注册整轮服务"""
    if round_num == 14:
        services = ROUND14_SERVICES
    elif round_num == 13:
        services = ROUND13_SERVICES
    else:
        services = []
    registered = 0
    for name, port, label, desc in services:
        register_integration(name, label, port, label, desc)
        registered += 1
    return {"round": round_num, "registered": registered, "total": len(services)}


def log_integration(service_name: str, action: str, result: str = "",
                      details: str = "") -> str:
    """记录集成日志"""
    lid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO integration_log
            (id,timestamp,service_name,action,result,details)
            VALUES (?,?,?,?,?,?)""",
            (lid, _now(), service_name, action, result, details))
    return lid


def sync_metric(service_name: str, metric_name: str, value: float) -> str:
    """同步指标"""
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO sync_metrics
            (id,timestamp,service_name,metric_name,metric_value,synced)
            VALUES (?,?,?,?,?,?)""",
            (mid, _now(), service_name, metric_name, value, 1))
    return mid


def update_status(service_name: str, status: str) -> bool:
    """更新服务状态"""
    if status not in INTEGRATION_STATUSES:
        status = "pending"
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE integrated_services SET status=?, last_health_check=?
            WHERE service_name=?""", (status, _now(), service_name))
        return c.total_changes > 0


def bind_dashboard(dashboard_name: str, service_name: str,
                    panel_type: str = "metric", priority: int = 0) -> str:
    """绑定大盘面板"""
    bid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO dashboard_bindings
            (id,timestamp,dashboard_name,service_name,panel_type,priority)
            VALUES (?,?,?,?,?,?)""",
            (bid, _now(), dashboard_name, service_name, panel_type, priority))
    return bid


def health_check_all() -> Dict:
    """批量健康检查"""
    with _conn() as c:
        rows = c.execute("""SELECT service_name,port,status FROM integrated_services""").fetchall()
    results = {}
    for r in rows:
        results[r["service_name"]] = {
            "port": r["port"],
            "status": r["status"],
            "checked_at": _now(),
        }
    return results


def get_integration_report() -> Dict:
    """集成报告"""
    with _conn() as c:
        total = c.execute("""SELECT COUNT(*) as c FROM integrated_services""").fetchone()["c"]
        healthy = c.execute("""SELECT COUNT(*) as c FROM integrated_services WHERE status='healthy'""").fetchone()["c"]
        registered = c.execute("""SELECT COUNT(*) as c FROM integrated_services WHERE status='registered'""").fetchone()["c"]
        logs = c.execute("""SELECT COUNT(*) as c FROM integration_log""").fetchone()["c"]
        metrics = c.execute("""SELECT COUNT(*) as c FROM sync_metrics""").fetchone()["c"]
        bindings = c.execute("""SELECT COUNT(*) as c FROM dashboard_bindings""").fetchone()["c"]
        round14 = c.execute("""SELECT COUNT(*) as c FROM integrated_services WHERE round_label LIKE 'P0-4%' OR round_label LIKE 'P1-4%' OR round_label LIKE 'P2-5%'""").fetchone()["c"]
    return {
        "total_services": total,
        "healthy_services": healthy,
        "registered_services": registered,
        "integration_logs": logs,
        "synced_metrics": metrics,
        "dashboard_bindings": bindings,
        "round14_services": round14,
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
            self._send(200, get_integration_report())
        elif u.path == "/api/healthcheck":
            self._send(200, health_check_all())
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
            sid = register_integration(
                data.get("service_name", "svc-" + uuid.uuid4().hex[:6]),
                data.get("service_id", "P0-XX"),
                data.get("port", 0),
                data.get("round_label", ""),
                data.get("description", ""),
            )
            self._send(200, {"integration_id": sid})
        elif u.path == "/api/batch":
            result = batch_register_round(data.get("round", 14))
            self._send(200, result)
        elif u.path == "/api/status":
            ok = update_status(data.get("service_name", ""), data.get("status", "registered"))
            self._send(200, {"ok": ok})
        elif u.path == "/api/log":
            lid = log_integration(
                data.get("service_name", ""),
                data.get("action", ""),
                data.get("result", ""),
                data.get("details", ""),
            )
            self._send(200, {"log_id": lid})
        elif u.path == "/api/metric":
            mid = sync_metric(
                data.get("service_name", ""),
                data.get("metric_name", ""),
                data.get("value", 0),
            )
            self._send(200, {"metric_id": mid})
        elif u.path == "/api/binding":
            bid = bind_dashboard(
                data.get("dashboard_name", "default"),
                data.get("service_name", ""),
                data.get("panel_type", "metric"),
                data.get("priority", 0),
            )
            self._send(200, {"binding_id": bid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P0-65 统一大盘集成")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"统一大盘集成 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_integration_report(), ensure_ascii=False, indent=2))

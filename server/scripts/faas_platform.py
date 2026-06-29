#!/usr/bin/env python3
"""
P1-49 Serverless FaaS 平台
函数注册 + 冷启动优化 + 事件触发 + 弹性扩缩
"""
import hashlib
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

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "faas_platform.db")
HTTP_PORT = 10290

RUNTIMES = ["python3", "nodejs18", "go120", "java17", "ruby31"]
TRIGGERS = ["http", "schedule", "queue", "event", "manual"]
INVOCATION_STATUSES = ["success", "error", "timeout", "throttled"]
FUNCTION_STATUSES = ["active", "inactive", "deploying", "error"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS functions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            function_name TEXT NOT NULL UNIQUE,
            runtime TEXT NOT NULL,
            handler TEXT,
            code_path TEXT,
            memory_mb INTEGER DEFAULT 128,
            timeout_seconds INTEGER DEFAULT 30,
            status TEXT DEFAULT 'active',
            version TEXT DEFAULT '1.0.0',
            env_vars TEXT
        );
        CREATE TABLE IF NOT EXISTS invocations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            function_name TEXT NOT NULL,
            trigger_type TEXT,
            status TEXT,
            duration_ms REAL DEFAULT 0,
            cold_start INTEGER DEFAULT 0,
            memory_used_mb REAL DEFAULT 0,
            request_id TEXT,
            error_message TEXT
        );
        CREATE TABLE IF NOT EXISTS triggers (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            trigger_name TEXT NOT NULL UNIQUE,
            function_name TEXT NOT NULL,
            trigger_type TEXT NOT NULL,
            config TEXT,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS warm_pool (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            function_name TEXT NOT NULL,
            instance_id TEXT NOT NULL,
            warmed_at TEXT,
            last_used TEXT
        );
        CREATE TABLE IF NOT EXISTS resource_quotas (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            max_invocations_per_minute INTEGER DEFAULT 1000,
            max_concurrent INTEGER DEFAULT 100,
            max_memory_mb INTEGER DEFAULT 10240,
            current_usage INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS deployments (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            function_name TEXT NOT NULL,
            version TEXT NOT NULL,
            deployed_by TEXT,
            deployment_status TEXT DEFAULT 'success',
            duration_seconds REAL DEFAULT 0
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_function(function_name: str, runtime: str, handler: str = "index.handler",
                       code_path: str = "", memory_mb: int = 128,
                       timeout: int = 30, env_vars: Optional[Dict] = None) -> str:
    """注册函数"""
    if runtime not in RUNTIMES:
        runtime = "python3"
    fid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO functions
            (id,timestamp,function_name,runtime,handler,code_path,memory_mb,timeout_seconds,
             status,version,env_vars)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (fid, _now(), function_name, runtime, handler, code_path,
             memory_mb, timeout, "active", "1.0.0",
             json.dumps(env_vars or {}, ensure_ascii=False)))
    return fid


def update_function_status(function_name: str, status: str, version: str = "") -> bool:
    """更新函数状态"""
    if status not in FUNCTION_STATUSES:
        status = "active"
    with _conn_lock, _conn() as c:
        if version:
            c.execute("""UPDATE functions SET status=?, version=?
                WHERE function_name=?""", (status, version, function_name))
        else:
            c.execute("""UPDATE functions SET status=?
                WHERE function_name=?""", (status, function_name))
        return c.total_changes > 0


def create_trigger(trigger_name: str, function_name: str, trigger_type: str,
                    config: Optional[Dict] = None) -> str:
    """创建触发器"""
    if trigger_type not in TRIGGERS:
        trigger_type = "manual"
    tid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO triggers
            (id,timestamp,trigger_name,function_name,trigger_type,config,enabled)
            VALUES (?,?,?,?,?,?,?)""",
            (tid, _now(), trigger_name, function_name, trigger_type,
             json.dumps(config or {}, ensure_ascii=False), 1))
    return tid


def invoke_function(function_name: str, trigger_type: str = "manual",
                     payload: Optional[Dict] = None) -> Dict:
    """调用函数"""
    if trigger_type not in TRIGGERS:
        trigger_type = "manual"
    payload = payload or {}
    start = time.time()
    with _conn() as c:
        func = c.execute("""SELECT * FROM functions WHERE function_name=?""",
                          (function_name,)).fetchone()
        warm = c.execute("""SELECT * FROM warm_pool WHERE function_name=?
            ORDER BY last_used DESC LIMIT 1""", (function_name,)).fetchone()
    cold_start = 0 if warm else 1
    if not func:
        duration = (time.time() - start) * 1000
        return {"status": "error", "error": "function not found", "duration_ms": duration}
    base_ms = 50 if cold_start else 10
    payload_size = len(json.dumps(payload))
    duration = base_ms + payload_size * 0.1
    memory_used = min(func["memory_mb"], 50 + payload_size * 0.5)
    request_id = hashlib.sha256(f"{function_name}-{time.time()}".encode()).hexdigest()[:16]
    iid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO invocations
            (id,timestamp,function_name,trigger_type,status,duration_ms,cold_start,
             memory_used_mb,request_id,error_message)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (iid, _now(), function_name, trigger_type, "success", duration,
             cold_start, memory_used, request_id, ""))
    return {
        "request_id": request_id,
        "status": "success",
        "duration_ms": duration,
        "cold_start": bool(cold_start),
        "memory_used_mb": memory_used,
    }


def warm_instance(function_name: str) -> str:
    """预热实例"""
    iid = str(uuid.uuid4())
    instance_id = "inst-" + uuid.uuid4().hex[:8]
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO warm_pool
            (id,timestamp,function_name,instance_id,warmed_at,last_used)
            VALUES (?,?,?,?,?,?)""",
            (iid, _now(), function_name, instance_id, _now(), _now()))
    return iid


def set_quota(tenant_id: str, max_per_min: int = 1000,
               max_concurrent: int = 100, max_memory: int = 10240) -> str:
    """设置配额"""
    qid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO resource_quotas
            (id,timestamp,tenant_id,max_invocations_per_minute,max_concurrent,max_memory_mb,current_usage)
            VALUES (?,?,?,?,?,?,?)""",
            (qid, _now(), tenant_id, max_per_min, max_concurrent, max_memory, 0))
    return qid


def deploy_function(function_name: str, version: str, deployed_by: str = "system") -> str:
    """部署函数"""
    start = time.time()
    did = str(uuid.uuid4())
    duration = time.time() - start
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO deployments
            (id,timestamp,function_name,version,deployed_by,deployment_status,duration_seconds)
            VALUES (?,?,?,?,?,?,?)""",
            (did, _now(), function_name, version, deployed_by, "success", duration))
        c.execute("""UPDATE functions SET version=? WHERE function_name=?""",
                   (version, function_name))
    return did


def get_faas_report() -> Dict:
    """FaaS 报告"""
    with _conn() as c:
        funcs = c.execute("""SELECT COUNT(*) as c FROM functions""").fetchone()["c"]
        active = c.execute("""SELECT COUNT(*) as c FROM functions WHERE status='active'""").fetchone()["c"]
        invs = c.execute("""SELECT COUNT(*) as c FROM invocations""").fetchone()["c"]
        cold = c.execute("""SELECT COUNT(*) as c FROM invocations WHERE cold_start=1""").fetchone()["c"]
        avg_dur = c.execute("""SELECT AVG(duration_ms) as a FROM invocations""").fetchone()["a"] or 0
        triggers = c.execute("""SELECT COUNT(*) as c FROM triggers WHERE enabled=1""").fetchone()["c"]
        warm = c.execute("""SELECT COUNT(*) as c FROM warm_pool""").fetchone()["c"]
    cold_rate = cold / max(1, invs) * 100
    return {
        "total_functions": funcs,
        "active_functions": active,
        "total_invocations": invs,
        "cold_start_rate_pct": cold_rate,
        "avg_duration_ms": avg_dur,
        "active_triggers": triggers,
        "warm_instances": warm,
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
            self._send(200, get_faas_report())
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
        if u.path == "/api/function":
            fid = register_function(
                data.get("function_name", "func-" + uuid.uuid4().hex[:6]),
                data.get("runtime", "python3"),
                data.get("handler", "index.handler"),
                data.get("code_path", ""),
                data.get("memory_mb", 128),
                data.get("timeout", 30),
                data.get("env_vars"),
            )
            self._send(200, {"function_id": fid})
        elif u.path == "/api/function/status":
            ok = update_function_status(
                data.get("function_name", ""),
                data.get("status", "active"),
                data.get("version", ""),
            )
            self._send(200, {"ok": ok})
        elif u.path == "/api/trigger":
            tid = create_trigger(
                data.get("trigger_name", "trig-" + uuid.uuid4().hex[:6]),
                data.get("function_name", "default"),
                data.get("trigger_type", "manual"),
                data.get("config"),
            )
            self._send(200, {"trigger_id": tid})
        elif u.path == "/api/invoke":
            result = invoke_function(
                data.get("function_name", "default"),
                data.get("trigger_type", "manual"),
                data.get("payload"),
            )
            self._send(200, result)
        elif u.path == "/api/warm":
            iid = warm_instance(data.get("function_name", "default"))
            self._send(200, {"instance_id": iid})
        elif u.path == "/api/quota":
            qid = set_quota(
                data.get("tenant_id", "default"),
                data.get("max_per_min", 1000),
                data.get("max_concurrent", 100),
                data.get("max_memory", 10240),
            )
            self._send(200, {"quota_id": qid})
        elif u.path == "/api/deploy":
            did = deploy_function(
                data.get("function_name", ""),
                data.get("version", "1.0.0"),
                data.get("deployed_by", "system"),
            )
            self._send(200, {"deploy_id": did})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P1-49 Serverless FaaS")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"FaaS HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_faas_report(), ensure_ascii=False, indent=2))

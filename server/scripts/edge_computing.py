#!/usr/bin/env python3
"""
边缘计算
P1-35: CDN 边缘节点, 边缘函数, 数据本地化, 边缘 AI 推理, 边缘监控
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

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "edge_computing.db")
HTTP_PORT = 10150

EDGE_REGIONS = ["cn-north", "cn-east", "cn-south", "us-west", "us-east", "eu-west", "ap-south", "ap-east"]
NODE_STATUS = ["online", "offline", "degraded", "maintenance"]
EDGE_FUNCTION_RUNTIMES = ["python", "nodejs", "go", "wasm"]
INFERENCE_TYPES = ["classification", "detection", "nlp", "recommendation", "anomaly"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS edge_nodes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            node_id TEXT NOT NULL UNIQUE,
            region TEXT,
            zone TEXT,
            endpoint TEXT,
            capacity_cpu REAL,
            capacity_memory_mb INTEGER,
            status TEXT DEFAULT 'online',
            last_heartbeat TEXT,
            latency_ms REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS edge_functions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            function_id TEXT NOT NULL UNIQUE,
            function_name TEXT,
            runtime TEXT,
            code TEXT,
            memory_mb INTEGER DEFAULT 128,
            timeout_seconds INTEGER DEFAULT 10,
            target_regions TEXT
        );
        CREATE TABLE IF NOT EXISTS function_invocations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            function_id TEXT,
            node_id TEXT,
            cold_start_ms REAL,
            execution_ms REAL,
            success INTEGER DEFAULT 1,
            response_size INTEGER
        );
        CREATE TABLE IF NOT EXISTS data_localization (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            data_id TEXT NOT NULL,
            data_type TEXT,
            region TEXT,
            policy TEXT,
            compliance TEXT,
            stored_size_mb REAL
        );
        CREATE TABLE IF NOT EXISTS edge_inference (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            inference_id TEXT NOT NULL,
            model_name TEXT,
            model_version TEXT,
            inference_type TEXT,
            input_size_bytes INTEGER,
            output_class TEXT,
            confidence REAL,
            node_id TEXT,
            latency_ms REAL
        );
        CREATE INDEX IF NOT EXISTS idx_inference_node ON edge_inference(node_id);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_node(node_id: str, region: str, zone: str = "",
                   endpoint: str = "", capacity_cpu: float = 4.0,
                   capacity_memory_mb: int = 8192) -> str:
    """注册边缘节点"""
    if region not in EDGE_REGIONS:
        region = "cn-north"
    nid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO edge_nodes
            (id,timestamp,node_id,region,zone,endpoint,capacity_cpu,
             capacity_memory_mb,status,last_heartbeat,latency_ms)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (nid, _now(), node_id, region, zone, endpoint, capacity_cpu,
             capacity_memory_mb, "online", _now(), 0.0))
    return nid


def heartbeat(node_id: str, status: str = "online", latency_ms: float = 0) -> bool:
    """心跳"""
    if status not in NODE_STATUS:
        status = "online"
    with _conn_lock, _conn() as c:
        cur = c.execute("""UPDATE edge_nodes
            SET last_heartbeat = ?, status = ?, latency_ms = ?
            WHERE node_id = ?""", (_now(), status, latency_ms, node_id))
        return cur.rowcount > 0


def deploy_function(function_id: str, function_name: str, runtime: str,
                      code: str, memory_mb: int = 128,
                      timeout_seconds: int = 10,
                      target_regions: Optional[List[str]] = None) -> str:
    """部署边缘函数"""
    if runtime not in EDGE_FUNCTION_RUNTIMES:
        runtime = "python"
    fid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO edge_functions
            (id,timestamp,function_id,function_name,runtime,code,
             memory_mb,timeout_seconds,target_regions)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (fid, _now(), function_id, function_name, runtime, code,
             memory_mb, timeout_seconds,
             json.dumps(target_regions or [], ensure_ascii=False)))
    return fid


def invoke_function(function_id: str, node_id: str = "",
                     input_data: Optional[Dict] = None) -> Dict[str, Any]:
    """调用边缘函数"""
    cold_start = round(time.time() % 1 * 100, 2) if not node_id else 0
    start = time.time()
    with _conn_lock, _conn() as c:
        fn = c.execute("""SELECT * FROM edge_functions
            WHERE function_id = ?""", (function_id,)).fetchone()
    if not fn:
        return {"success": False, "error": "function_not_found"}
    exec_ms = round((time.time() - start) * 1000, 2) + 5.0
    iid = str(uuid.uuid4())
    response = {"output": f"Result for {input_data}", "status": 200}
    response_size = len(json.dumps(response))
    actual_node = node_id or "auto"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO function_invocations
            (id,timestamp,function_id,node_id,cold_start_ms,execution_ms,
             success,response_size)
            VALUES (?,?,?,?,?,?,?,?)""",
            (iid, _now(), function_id, actual_node, cold_start, exec_ms, 1,
             response_size))
    return {"success": True, "function_id": function_id, "node": actual_node,
            "cold_start_ms": cold_start, "execution_ms": exec_ms,
            "response": response}


def store_data_local(data_id: str, data_type: str, region: str,
                      policy: str = "strict", compliance: str = "GDPR",
                      size_mb: float = 0.0) -> str:
    """数据本地化存储"""
    if region not in EDGE_REGIONS:
        region = "cn-north"
    if policy not in ["strict", "loose", "replicate", "none"]:
        policy = "strict"
    did = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO data_localization
            (id,timestamp,data_id,data_type,region,policy,compliance,stored_size_mb)
            VALUES (?,?,?,?,?,?,?,?)""",
            (did, _now(), data_id, data_type, region, policy, compliance, size_mb))
    return did


def edge_inference(inference_id: str, model_name: str, model_version: str,
                    inference_type: str, input_size: int,
                    node_id: str = "auto") -> Dict[str, Any]:
    """边缘 AI 推理"""
    if inference_type not in INFERENCE_TYPES:
        inference_type = "classification"
    start = time.time()
    classes = ["cat", "dog", "bird", "car", "person", "tree", "building"]
    output_class = classes[hash(model_name + inference_id) % len(classes)]
    confidence = round((hash(inference_id) % 100) / 100, 2)
    latency = round((time.time() - start) * 1000 + 50, 2)
    iid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO edge_inference
            (id,timestamp,inference_id,model_name,model_version,inference_type,
             input_size_bytes,output_class,confidence,node_id,latency_ms)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (iid, _now(), inference_id, model_name, model_version,
             inference_type, input_size, output_class, confidence,
             node_id, latency))
    return {"inference_id": inference_id, "output_class": output_class,
            "confidence": confidence, "latency_ms": latency,
            "model": model_name, "version": model_version}


def select_optimal_node(region: str = "cn-north") -> Optional[Dict[str, Any]]:
    """选择最优节点"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT * FROM edge_nodes
            WHERE region = ? AND status = 'online'
            ORDER BY latency_ms ASC LIMIT 1""", (region,)).fetchall()
    if not rows:
        rows = c.execute("""SELECT * FROM edge_nodes
            WHERE status = 'online' ORDER BY latency_ms ASC LIMIT 1""").fetchall()
    if not rows:
        return None
    n = rows[0]
    return {"node_id": n["node_id"], "region": n["region"],
            "endpoint": n["endpoint"], "latency_ms": n["latency_ms"]}


def get_edge_overview() -> Dict[str, Any]:
    """获取边缘概览"""
    with _conn_lock, _conn() as c:
        total = c.execute("SELECT COUNT(*) as c FROM edge_nodes").fetchone()["c"]
        online = c.execute("SELECT COUNT(*) as c FROM edge_nodes WHERE status = 'online'").fetchone()["c"]
        functions = c.execute("SELECT COUNT(*) as c FROM edge_functions").fetchone()["c"]
        invocations = c.execute("SELECT COUNT(*) as c FROM function_invocations").fetchone()["c"]
        inferences = c.execute("SELECT COUNT(*) as c FROM edge_inference").fetchone()["c"]
        data = c.execute("SELECT COUNT(*) as c FROM data_localization").fetchone()["c"]
    return {"total_nodes": total, "online_nodes": online,
            "deployed_functions": functions, "invocations": invocations,
            "inferences": inferences, "localized_data": data}


def get_node_stats() -> List[Dict[str, Any]]:
    """获取节点统计"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT node_id, region, status, latency_ms
            FROM edge_nodes ORDER BY node_id""").fetchall()
    return [{"node": r["node_id"], "region": r["region"],
             "status": r["status"], "latency_ms": r["latency_ms"]} for r in rows]


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "edge_computing"}, ensure_ascii=False) + "\n")


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
            self._json(200, {"status": "ok", "service": "edge_computing"})
        elif path == "/api/overview":
            self._json(200, get_edge_overview())
        elif path == "/api/nodes":
            self._json(200, {"nodes": get_node_stats()})
        elif path.startswith("/api/optimal-node/"):
            region = path[18:]
            node = select_optimal_node(region)
            if node:
                self._json(200, node)
            else:
                self._json(404, {"error": "no_node"})
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
        if path == "/api/node/register":
            nid = register_node(
                node_id=data.get("node_id", ""),
                region=data.get("region", "cn-north"),
                zone=data.get("zone", ""),
                endpoint=data.get("endpoint", ""),
                capacity_cpu=data.get("capacity_cpu", 4.0),
                capacity_memory_mb=data.get("capacity_memory_mb", 8192),
            )
            self._json(201, {"id": nid})
        elif path == "/api/node/heartbeat":
            ok = heartbeat(
                node_id=data.get("node_id", ""),
                status=data.get("status", "online"),
                latency_ms=data.get("latency_ms", 0.0),
            )
            self._json(200, {"ok": ok})
        elif path == "/api/function/deploy":
            fid = deploy_function(
                function_id=data.get("function_id", ""),
                function_name=data.get("function_name", ""),
                runtime=data.get("runtime", "python"),
                code=data.get("code", ""),
                memory_mb=data.get("memory_mb", 128),
                timeout_seconds=data.get("timeout_seconds", 10),
                target_regions=data.get("target_regions"),
            )
            self._json(201, {"id": fid})
        elif path == "/api/function/invoke":
            result = invoke_function(
                function_id=data.get("function_id", ""),
                node_id=data.get("node_id", ""),
                input_data=data.get("input"),
            )
            self._json(200, result)
        elif path == "/api/data/store":
            did = store_data_local(
                data_id=data.get("data_id", ""),
                data_type=data.get("data_type", "user"),
                region=data.get("region", "cn-north"),
                policy=data.get("policy", "strict"),
                compliance=data.get("compliance", "GDPR"),
                size_mb=data.get("size_mb", 0.0),
            )
            self._json(201, {"id": did})
        elif path == "/api/inference":
            result = edge_inference(
                inference_id=data.get("inference_id", ""),
                model_name=data.get("model_name", "default"),
                model_version=data.get("model_version", "1.0"),
                inference_type=data.get("inference_type", "classification"),
                input_size=data.get("input_size", 0),
                node_id=data.get("node_id", "auto"),
            )
            self._json(200, result)
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Edge Computing service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_register_node(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: register-node <id> <region> [zone] [endpoint]")
        return
    zone = args[2] if len(args) > 2 else ""
    endpoint = args[3] if len(args) > 3 else ""
    nid = register_node(args[0], args[1], zone, endpoint)
    print(json.dumps({"id": nid}, ensure_ascii=False))


def cmd_heartbeat(args: List[str]) -> None:
    if not args:
        print("usage: heartbeat <node_id> [status] [latency_ms]")
        return
    status = args[1] if len(args) > 1 else "online"
    latency = float(args[2]) if len(args) > 2 else 0
    print(json.dumps({"ok": heartbeat(args[0], status, latency)}, ensure_ascii=False))


def cmd_deploy(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: deploy <function_id> <name> <runtime> <code>")
        return
    fid = deploy_function(args[0], args[1], args[2], args[3])
    print(json.dumps({"id": fid}, ensure_ascii=False))


def cmd_invoke(args: List[str]) -> None:
    if not args:
        print("usage: invoke <function_id> [node_id]")
        return
    node = args[1] if len(args) > 1 else ""
    print(json.dumps(invoke_function(args[0], node, {"x": 1}),
                       ensure_ascii=False, indent=2))


def cmd_store(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: store <data_id> <data_type> <region>")
        return
    did = store_data_local(args[0], args[1], args[2])
    print(json.dumps({"id": did}, ensure_ascii=False))


def cmd_inference(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: inference <inference_id> <model> <type>")
        return
    print(json.dumps(edge_inference(args[0], args[1], "1.0", args[2], 1024),
                       ensure_ascii=False, indent=2))


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_edge_overview(), ensure_ascii=False, indent=2))


def cmd_nodes(_args: List[str]) -> None:
    print(json.dumps(get_node_stats(), ensure_ascii=False, indent=2))


def cmd_optimal(args: List[str]) -> None:
    region = args[0] if args else "cn-north"
    print(json.dumps(select_optimal_node(region), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "register-node": cmd_register_node,
            "heartbeat": cmd_heartbeat, "deploy": cmd_deploy,
            "invoke": cmd_invoke, "store": cmd_store, "inference": cmd_inference,
            "overview": cmd_overview, "nodes": cmd_nodes, "optimal": cmd_optimal}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

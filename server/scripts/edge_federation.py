#!/usr/bin/env python3
"""
P1-46 边缘 AI 联邦推理
边缘节点协调 + 隐私保护聚合
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

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "edge_federation.db")
HTTP_PORT = 10260

NODE_STATUSES = ["online", "offline", "training", "inferring", "syncing"]
AGGREGATION_METHODS = ["fedavg", "fedprox", "fednova", "secure_agg"]
MODEL_STATUSES = ["draft", "training", "ready", "deploying", "deprecated"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS edge_nodes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            node_id TEXT NOT NULL UNIQUE,
            region TEXT,
            cpu_cores INTEGER DEFAULT 4,
            memory_mb INTEGER DEFAULT 8192,
            gpu_available INTEGER DEFAULT 0,
            status TEXT DEFAULT 'offline',
            last_heartbeat TEXT
        );
        CREATE TABLE IF NOT EXISTS models (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            model_name TEXT NOT NULL,
            version TEXT NOT NULL,
            framework TEXT DEFAULT 'onnx',
            size_mb REAL DEFAULT 0,
            accuracy REAL DEFAULT 0,
            status TEXT DEFAULT 'draft',
            created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS training_rounds (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            round_number INTEGER NOT NULL,
            model_name TEXT NOT NULL,
            aggregation_method TEXT,
            participating_nodes TEXT,
            global_accuracy REAL,
            loss_value REAL,
            started_at TEXT,
            completed_at TEXT,
            status TEXT DEFAULT 'pending'
        );
        CREATE TABLE IF NOT EXISTS gradients (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            round_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            gradient_hash TEXT,
            sample_count INTEGER DEFAULT 0,
            loss_value REAL DEFAULT 0,
            noise_applied INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS inference_logs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            node_id TEXT NOT NULL,
            model_name TEXT,
            input_hash TEXT,
            prediction TEXT,
            confidence REAL,
            latency_ms REAL
        );
        CREATE TABLE IF NOT EXISTS node_metrics (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            node_id TEXT NOT NULL,
            cpu_usage REAL,
            memory_usage REAL,
            inference_count INTEGER DEFAULT 0
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_node(node_id: str, region: str = "default",
                   cpu_cores: int = 4, memory_mb: int = 8192,
                   gpu: bool = False) -> str:
    """注册边缘节点"""
    nid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO edge_nodes
            (id,timestamp,node_id,region,cpu_cores,memory_mb,gpu_available,status,last_heartbeat)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (nid, _now(), node_id, region, cpu_cores, memory_mb,
             1 if gpu else 0, "online", _now()))
    return nid


def heartbeat(node_id: str, status: str = "online") -> bool:
    """心跳上报"""
    if status not in NODE_STATUSES:
        status = "online"
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE edge_nodes SET last_heartbeat=?, status=?
            WHERE node_id=?""", (_now(), status, node_id))
        if c.total_changes == 0:
            return False
    return True


def create_model(model_name: str, version: str, framework: str = "onnx",
                  size_mb: float = 0, created_by: str = "system") -> str:
    """创建模型"""
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO models
            (id,timestamp,model_name,version,framework,size_mb,accuracy,status,created_by)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (mid, _now(), model_name, version, framework, size_mb, 0.0, "draft", created_by))
    return mid


def update_model_status(model_name: str, version: str, status: str,
                          accuracy: float = 0) -> bool:
    """更新模型状态"""
    if status not in MODEL_STATUSES:
        status = "ready"
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE models SET status=?, accuracy=?
            WHERE model_name=? AND version=?""", (status, accuracy, model_name, version))
        return c.total_changes > 0


def start_training_round(model_name: str, round_number: int,
                          method: str = "fedavg",
                          nodes: Optional[List[str]] = None) -> str:
    """开始训练轮次"""
    if method not in AGGREGATION_METHODS:
        method = "fedavg"
    rid = str(uuid.uuid4())
    nodes_str = ",".join(nodes or [])
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO training_rounds
            (id,timestamp,round_number,model_name,aggregation_method,participating_nodes,
             global_accuracy,loss_value,started_at,completed_at,status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), round_number, model_name, method, nodes_str,
             0, 0, _now(), "", "running"))
    return rid


def submit_gradient(round_id: str, node_id: str, sample_count: int = 0,
                     loss: float = 0, noise: bool = True) -> str:
    """提交梯度"""
    gid = str(uuid.uuid4())
    grad_hash = hashlib.sha256(f"{round_id}-{node_id}-{time.time()}".encode()).hexdigest()[:16]
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO gradients
            (id,timestamp,round_id,node_id,gradient_hash,sample_count,loss_value,noise_applied)
            VALUES (?,?,?,?,?,?,?,?)""",
            (gid, _now(), round_id, node_id, grad_hash, sample_count, loss,
             1 if noise else 0))
    return gid


def complete_training_round(round_id: str, global_acc: float, loss: float) -> bool:
    """完成训练"""
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE training_rounds SET global_accuracy=?, loss_value=?,
            completed_at=?, status='completed' WHERE id=?""",
            (global_acc, loss, _now(), round_id))
        return c.total_changes > 0


def aggregate_gradients(round_id: str, method: str = "fedavg") -> Dict:
    """聚合梯度"""
    if method not in AGGREGATION_METHODS:
        method = "fedavg"
    with _conn() as c:
        grads = c.execute("""SELECT * FROM gradients WHERE round_id=?""",
                           (round_id,)).fetchall()
    if not grads:
        return {"aggregated": 0, "node_count": 0, "method": method, "avg_loss": 0}
    total_samples = sum(g["sample_count"] for g in grads) or 1
    avg_loss = sum(g["loss_value"] * g["sample_count"] for g in grads) / total_samples
    return {
        "method": method,
        "node_count": len(grads),
        "total_samples": total_samples,
        "avg_loss": avg_loss,
        "noise_applied_count": sum(1 for g in grads if g["noise_applied"]),
    }


def record_inference(node_id: str, model_name: str, input_data: str,
                      prediction: str = "", confidence: float = 0,
                      latency_ms: float = 0) -> str:
    """记录推理"""
    iid = str(uuid.uuid4())
    input_hash = hashlib.sha256(input_data.encode()).hexdigest()[:16]
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO inference_logs
            (id,timestamp,node_id,model_name,input_hash,prediction,confidence,latency_ms)
            VALUES (?,?,?,?,?,?,?,?)""",
            (iid, _now(), node_id, model_name, input_hash, prediction, confidence, latency_ms))
    return iid


def record_node_metric(node_id: str, cpu: float = 0, memory: float = 0,
                        inf_count: int = 0) -> str:
    """记录节点指标"""
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO node_metrics
            (id,timestamp,node_id,cpu_usage,memory_usage,inference_count)
            VALUES (?,?,?,?,?,?)""",
            (mid, _now(), node_id, cpu, memory, inf_count))
    return mid


def get_federation_report() -> Dict:
    """联邦报告"""
    with _conn() as c:
        nodes = c.execute("""SELECT COUNT(*) as c FROM edge_nodes""").fetchone()["c"]
        online = c.execute("""SELECT COUNT(*) as c FROM edge_nodes WHERE status='online'""").fetchone()["c"]
        models = c.execute("""SELECT COUNT(*) as c FROM models""").fetchone()["c"]
        ready = c.execute("""SELECT COUNT(*) as c FROM models WHERE status='ready'""").fetchone()["c"]
        rounds = c.execute("""SELECT COUNT(*) as c FROM training_rounds""").fetchone()["c"]
        completed = c.execute("""SELECT COUNT(*) as c FROM training_rounds WHERE status='completed'""").fetchone()["c"]
        inferences = c.execute("""SELECT COUNT(*) as c FROM inference_logs""").fetchone()["c"]
    return {
        "total_nodes": nodes,
        "online_nodes": online,
        "total_models": models,
        "ready_models": ready,
        "training_rounds": rounds,
        "completed_rounds": completed,
        "total_inferences": inferences,
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
            self._send(200, get_federation_report())
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
        if u.path == "/api/node":
            nid = register_node(
                data.get("node_id", "node-" + uuid.uuid4().hex[:6]),
                data.get("region", "default"),
                data.get("cpu_cores", 4),
                data.get("memory_mb", 8192),
                data.get("gpu", False),
            )
            self._send(200, {"node_id": nid})
        elif u.path == "/api/heartbeat":
            ok = heartbeat(data.get("node_id", ""), data.get("status", "online"))
            self._send(200, {"ok": ok})
        elif u.path == "/api/model":
            mid = create_model(
                data.get("model_name", "default"),
                data.get("version", "1.0"),
                data.get("framework", "onnx"),
                data.get("size_mb", 0),
                data.get("created_by", "system"),
            )
            self._send(200, {"model_id": mid})
        elif u.path == "/api/model/status":
            ok = update_model_status(
                data.get("model_name", ""),
                data.get("version", "1.0"),
                data.get("status", "ready"),
                data.get("accuracy", 0),
            )
            self._send(200, {"ok": ok})
        elif u.path == "/api/round/start":
            rid = start_training_round(
                data.get("model_name", "default"),
                data.get("round_number", 1),
                data.get("method", "fedavg"),
                data.get("nodes"),
            )
            self._send(200, {"round_id": rid})
        elif u.path == "/api/gradient":
            gid = submit_gradient(
                data.get("round_id", ""),
                data.get("node_id", ""),
                data.get("sample_count", 0),
                data.get("loss", 0),
                data.get("noise", True),
            )
            self._send(200, {"gradient_id": gid})
        elif u.path == "/api/round/complete":
            ok = complete_training_round(
                data.get("round_id", ""),
                data.get("global_acc", 0),
                data.get("loss", 0),
            )
            self._send(200, {"ok": ok})
        elif u.path == "/api/aggregate":
            result = aggregate_gradients(
                data.get("round_id", ""),
                data.get("method", "fedavg"),
            )
            self._send(200, result)
        elif u.path == "/api/inference":
            iid = record_inference(
                data.get("node_id", ""),
                data.get("model_name", "default"),
                data.get("input_data", ""),
                data.get("prediction", ""),
                data.get("confidence", 0),
                data.get("latency_ms", 0),
            )
            self._send(200, {"inference_id": iid})
        elif u.path == "/api/metric":
            mid = record_node_metric(
                data.get("node_id", ""),
                data.get("cpu", 0),
                data.get("memory", 0),
                data.get("inf_count", 0),
            )
            self._send(200, {"metric_id": mid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P1-46 边缘 AI 联邦推理")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"联邦推理 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_federation_report(), ensure_ascii=False, indent=2))

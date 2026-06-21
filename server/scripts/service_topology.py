#!/usr/bin/env python3
"""
P1-68 跨服务依赖图
自动发现 + 拓扑构建 + 关键路径分析 + 循环依赖检测
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "service_topology.db")
HTTP_PORT = 10480

EDGE_TYPES = ["sync_call", "async_call", "event", "database", "cache", "queue"]
NODE_STATUSES = ["active", "inactive", "degraded", "maintenance"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS topology_nodes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            node_id TEXT NOT NULL UNIQUE,
            service_name TEXT NOT NULL,
            port INTEGER,
            round_label TEXT,
            status TEXT DEFAULT 'active',
            criticality TEXT DEFAULT 'medium',
            tags TEXT
        );
        CREATE TABLE IF NOT EXISTS topology_edges (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            source_node TEXT NOT NULL,
            target_node TEXT NOT NULL,
            edge_type TEXT DEFAULT 'sync_call',
            call_count INTEGER DEFAULT 0,
            avg_latency_ms REAL DEFAULT 0,
            error_rate REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS critical_paths (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            path_name TEXT NOT NULL,
            nodes TEXT,
            total_latency_ms REAL DEFAULT 0,
            hop_count INTEGER DEFAULT 0,
            risk_level TEXT
        );
        CREATE TABLE IF NOT EXISTS cycle_detections (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            cycle_nodes TEXT,
            cycle_edges TEXT,
            severity TEXT
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def add_node(node_id: str, service_name: str, port: int = 0,
              round_label: str = "", status: str = "active",
              criticality: str = "medium",
              tags: Optional[List[str]] = None) -> str:
    """添加节点"""
    if status not in NODE_STATUSES:
        status = "active"
    nid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO topology_nodes
            (id,timestamp,node_id,service_name,port,round_label,status,criticality,tags)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (nid, _now(), node_id, service_name, port, round_label,
             status, criticality, json.dumps(tags or [], ensure_ascii=False)))
    return nid


def add_edge(source: str, target: str, edge_type: str = "sync_call",
              latency_ms: float = 0, error_rate: float = 0) -> str:
    """添加边"""
    if edge_type not in EDGE_TYPES:
        edge_type = "sync_call"
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO topology_edges
            (id,timestamp,source_node,target_node,edge_type,call_count,avg_latency_ms,error_rate)
            VALUES (?,?,?,?,?,?,?,?)""",
            (eid, _now(), source, target, edge_type, 0, latency_ms, error_rate))
    return eid


def increment_call(source: str, target: str, latency_ms: float = 0,
                    is_error: bool = False) -> bool:
    """增加调用次数"""
    with _conn() as c:
        existing = c.execute("""SELECT * FROM topology_edges
            WHERE source_node=? AND target_node=?""",
            (source, target)).fetchone()
    if not existing:
        add_edge(source, target)
        return increment_call(source, target, latency_ms, is_error)
    with _conn_lock, _conn() as c:
        new_count = existing["call_count"] + 1
        new_errors = existing["error_rate"] * existing["call_count"] + (1 if is_error else 0)
        new_rate = new_errors / new_count
        new_latency = (existing["avg_latency_ms"] * existing["call_count"] + latency_ms) / new_count
        c.execute("""UPDATE topology_edges SET call_count=?, avg_latency_ms=?, error_rate=?
            WHERE source_node=? AND target_node=?""",
            (new_count, new_latency, new_rate, source, target))
    return True


def get_topology() -> Dict:
    """获取拓扑"""
    with _conn() as c:
        nodes = c.execute("""SELECT * FROM topology_nodes""").fetchall()
        edges = c.execute("""SELECT * FROM topology_edges""").fetchall()
    return {
        "nodes": [
            {"id": n["node_id"], "service": n["service_name"], "port": n["port"],
             "status": n["status"], "criticality": n["criticality"],
             "tags": json.loads(n["tags"] or "[]")}
            for n in nodes
        ],
        "edges": [
            {"source": e["source_node"], "target": e["target_node"],
             "type": e["edge_type"], "calls": e["call_count"],
             "latency_ms": e["avg_latency_ms"], "error_rate": e["error_rate"]}
            for e in edges
        ],
    }


def find_critical_paths(source: str, target: str, max_hops: int = 5) -> List[List[str]]:
    """查找关键路径 (DFS)"""
    with _conn() as c:
        edges = c.execute("""SELECT * FROM topology_edges""").fetchall()
    adj: Dict[str, List[str]] = {}
    for e in edges:
        adj.setdefault(e["source_node"], []).append(e["target_node"])
    paths: List[List[str]] = []

    def dfs(node: str, path: List[str], visited: Set[str]) -> None:
        if len(path) > max_hops:
            return
        if node == target and len(path) > 1:
            paths.append(list(path))
            return
        for nxt in adj.get(node, []):
            if nxt not in visited:
                visited.add(nxt)
                path.append(nxt)
                dfs(nxt, path, visited)
                path.pop()
                visited.remove(nxt)
    if source in adj or source == target:
        dfs(source, [source], {source})
    return paths[:20]


def detect_cycles() -> List[List[str]]:
    """检测循环依赖"""
    with _conn() as c:
        edges = c.execute("""SELECT * FROM topology_edges""").fetchall()
    adj: Dict[str, List[str]] = {}
    for e in edges:
        adj.setdefault(e["source_node"], []).append(e["target_node"])
    cycles: List[List[str]] = []
    visited: Set[str] = set()
    rec_stack: Set[str] = set()
    path: List[str] = []

    def dfs(node: str) -> None:
        visited.add(node)
        rec_stack.add(node)
        path.append(node)
        for nxt in adj.get(node, []):
            if nxt not in visited:
                dfs(nxt)
            elif nxt in rec_stack:
                idx = path.index(nxt)
                cycle = path[idx:] + [nxt]
                cycles.append(cycle)
        path.pop()
        rec_stack.remove(node)
    for n in list(adj.keys()):
        if n not in visited:
            dfs(n)
    return cycles


def record_critical_path(path_name: str, nodes: List[str], total_latency: float,
                          risk_level: str = "medium") -> str:
    """记录关键路径"""
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO critical_paths
            (id,timestamp,path_name,nodes,total_latency_ms,hop_count,risk_level)
            VALUES (?,?,?,?,?,?,?)""",
            (pid, _now(), path_name, json.dumps(nodes, ensure_ascii=False),
             total_latency, len(nodes) - 1, risk_level))
    return pid


def record_cycle(cycle_nodes: List[str]) -> str:
    """记录循环"""
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO cycle_detections
            (id,timestamp,cycle_nodes,cycle_edges,severity)
            VALUES (?,?,?,?,?)""",
            (cid, _now(), json.dumps(cycle_nodes, ensure_ascii=False), "", "high"))
    return cid


def get_topology_report() -> Dict:
    """拓扑报告"""
    topo = get_topology()
    cycles = detect_cycles()
    with _conn() as c:
        paths = c.execute("""SELECT COUNT(*) as c FROM critical_paths""").fetchone()["c"]
    return {
        "node_count": len(topo["nodes"]),
        "edge_count": len(topo["edges"]),
        "cycle_count": len(cycles),
        "cycles": cycles,
        "critical_paths": paths,
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
            self._send(200, get_topology_report())
        elif u.path == "/api/topology":
            self._send(200, get_topology())
        elif u.path == "/api/cycles":
            self._send(200, {"cycles": detect_cycles()})
        elif u.path == "/api/paths":
            q = parse_qs(u.query)
            paths = find_critical_paths(
                q.get("source", [""])[0],
                q.get("target", [""])[0],
                int(q.get("max_hops", ["5"])[0]),
            )
            self._send(200, {"paths": paths})
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
            nid = add_node(
                data.get("node_id", "node-" + uuid.uuid4().hex[:6]),
                data.get("service_name", "default"),
                data.get("port", 0),
                data.get("round_label", ""),
                data.get("status", "active"),
                data.get("criticality", "medium"),
                data.get("tags"),
            )
            self._send(200, {"node_id": nid})
        elif u.path == "/api/edge":
            eid = add_edge(
                data.get("source", ""),
                data.get("target", ""),
                data.get("edge_type", "sync_call"),
                data.get("latency_ms", 0),
                data.get("error_rate", 0),
            )
            self._send(200, {"edge_id": eid})
        elif u.path == "/api/call":
            ok = increment_call(
                data.get("source", ""),
                data.get("target", ""),
                data.get("latency_ms", 0),
                data.get("is_error", False),
            )
            self._send(200, {"ok": ok})
        elif u.path == "/api/path":
            pid = record_critical_path(
                data.get("path_name", "path-" + uuid.uuid4().hex[:6]),
                data.get("nodes", []),
                data.get("total_latency", 0),
                data.get("risk_level", "medium"),
            )
            self._send(200, {"path_id": pid})
        elif u.path == "/api/cycle/record":
            cid = record_cycle(data.get("cycle", []))
            self._send(200, {"cycle_id": cid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P1-68 跨服务依赖图")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"依赖图 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_topology_report(), ensure_ascii=False, indent=2))

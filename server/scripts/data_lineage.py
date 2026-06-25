#!/usr/bin/env python3
"""
数据血缘追踪
P2-31: 字段级血缘, 影响分析, 数据资产可视化, GDPR 数据导出/删除
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from collections import defaultdict
from datetime import timedelta
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "data_lineage.db")
HTTP_PORT = 10110

LINEAGE_TYPES = ["table_to_table", "column_to_column", "etl_job",
                  "api_to_table", "table_to_api", "dashboard_to_table"]
GDPR_ACTIONS = ["export", "delete", "anonymize", "restrict", "portability"]
ASSET_TYPES = ["table", "column", "view", "etl_job", "dashboard", "report", "api"]
PII_CATEGORIES = ["email", "phone", "id_card", "name", "address", "birthday",
                   "gender", "ip", "device_id", "biometric"]


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS data_assets (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            asset_id TEXT NOT NULL UNIQUE,
            asset_type TEXT,
            name TEXT,
            schema_name TEXT,
            database_name TEXT,
            description TEXT,
            owner TEXT,
            tags TEXT,
            pii_categories TEXT
        );
        CREATE TABLE IF NOT EXISTS lineage_edges (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            source_asset TEXT NOT NULL,
            target_asset TEXT NOT NULL,
            lineage_type TEXT,
            transformation TEXT,
            job_name TEXT,
            confidence REAL
        );
        CREATE TABLE IF NOT EXISTS gdpr_requests (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            request_id TEXT NOT NULL UNIQUE,
            subject_id TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            affected_assets TEXT,
            result TEXT
        );
        CREATE TABLE IF NOT EXISTS impact_analysis (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            source_asset TEXT NOT NULL,
            direction TEXT,
            affected_assets TEXT,
            depth INTEGER,
            total_count INTEGER
        );
        CREATE TABLE IF NOT EXISTS pii_classifications (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            asset_id TEXT NOT NULL,
            column_name TEXT,
            pii_category TEXT,
            sensitivity_level TEXT,
            tags TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_lineage_source ON lineage_edges(source_asset);
        CREATE INDEX IF NOT EXISTS idx_lineage_target ON lineage_edges(target_asset);
        CREATE INDEX IF NOT EXISTS idx_gdpr_subject ON gdpr_requests(subject_id);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_asset(asset_id: str, asset_type: str, name: str,
                    schema: str = "", database: str = "",
                    description: str = "", owner: str = "",
                    tags: Optional[List[str]] = None,
                    pii_categories: Optional[List[str]] = None) -> str:
    """注册数据资产"""
    if asset_type not in ASSET_TYPES:
        asset_type = "table"
    aid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO data_assets
            (id,timestamp,asset_id,asset_type,name,schema_name,database_name,
             description,owner,tags,pii_categories)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (aid, _now(), asset_id, asset_type, name, schema, database,
             description, owner, json.dumps(tags or [], ensure_ascii=False),
             json.dumps(pii_categories or [], ensure_ascii=False)))
    return aid


def add_lineage(source_asset: str, target_asset: str, lineage_type: str,
                 transformation: str = "", job_name: str = "",
                 confidence: float = 1.0) -> str:
    """添加血缘关系"""
    if lineage_type not in LINEAGE_TYPES:
        lineage_type = "table_to_table"
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO lineage_edges
            (id,timestamp,source_asset,target_asset,lineage_type,
             transformation,job_name,confidence)
            VALUES (?,?,?,?,?,?,?,?)""",
            (eid, _now(), source_asset, target_asset, lineage_type,
             transformation, job_name, confidence))
    return eid


def trace_upstream(asset_id: str, max_depth: int = 10) -> List[Dict[str, Any]]:
    """向上追踪"""
    visited: Set[str] = set()
    result = []
    queue = [(asset_id, 0)]
    while queue:
        current, depth = queue.pop(0)
        if current in visited or depth > max_depth:
            continue
        visited.add(current)
        with _conn_lock, _conn() as c:
            rows = c.execute("""SELECT * FROM lineage_edges
                WHERE target_asset = ?""", (current,)).fetchall()
        for r in rows:
            result.append({
                "source": r["source_asset"], "target": r["target_asset"],
                "type": r["lineage_type"], "transformation": r["transformation"],
                "job": r["job_name"], "depth": depth + 1,
            })
            queue.append((r["source_asset"], depth + 1))
    return result


def trace_downstream(asset_id: str, max_depth: int = 10) -> List[Dict[str, Any]]:
    """向下追踪"""
    visited: Set[str] = set()
    result = []
    queue = [(asset_id, 0)]
    while queue:
        current, depth = queue.pop(0)
        if current in visited or depth > max_depth:
            continue
        visited.add(current)
        with _conn_lock, _conn() as c:
            rows = c.execute("""SELECT * FROM lineage_edges
                WHERE source_asset = ?""", (current,)).fetchall()
        for r in rows:
            result.append({
                "source": r["source_asset"], "target": r["target_asset"],
                "type": r["lineage_type"], "transformation": r["transformation"],
                "job": r["job_name"], "depth": depth + 1,
            })
            queue.append((r["target_asset"], depth + 1))
    return result


def impact_analysis(asset_id: str, direction: str = "downstream",
                      max_depth: int = 5) -> Dict[str, Any]:
    """影响分析"""
    if direction == "downstream":
        edges = trace_downstream(asset_id, max_depth)
    else:
        edges = trace_upstream(asset_id, max_depth)
    affected = set()
    for e in edges:
        if direction == "downstream":
            affected.add(e["target"])
        else:
            affected.add(e["source"])
    affected.discard(asset_id)
    aid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO impact_analysis
            (id,timestamp,source_asset,direction,affected_assets,depth,total_count)
            VALUES (?,?,?,?,?,?,?)""",
            (aid, _now(), asset_id, direction,
             json.dumps(list(affected), ensure_ascii=False), max_depth,
             len(affected)))
    return {
        "source_asset": asset_id,
        "direction": direction,
        "max_depth": max_depth,
        "affected_assets": list(affected),
        "total_count": len(affected),
        "edges": edges,
    }


def classify_pii(asset_id: str, column_name: str, pii_category: str,
                  sensitivity: str = "high") -> str:
    """分类 PII"""
    if pii_category not in PII_CATEGORIES:
        pii_category = "name"
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO pii_classifications
            (id,timestamp,asset_id,column_name,pii_category,sensitivity_level,tags)
            VALUES (?,?,?,?,?,?,?)""",
            (cid, _now(), asset_id, column_name, pii_category, sensitivity, "[]"))
    return cid


def get_pii_for_asset(asset_id: str) -> List[Dict[str, Any]]:
    """获取资产 PII 分类"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT * FROM pii_classifications
            WHERE asset_id = ?""", (asset_id,)).fetchall()
    return [{"column": r["column_name"], "category": r["pii_category"],
             "sensitivity": r["sensitivity_level"]} for r in rows]


def create_gdpr_request(subject_id: str, action: str) -> str:
    """创建 GDPR 请求"""
    if action not in GDPR_ACTIONS:
        action = "export"
    rid = str(uuid.uuid4())
    req_id = f"GDPR-{int(time.time())}-{uuid.uuid4().hex[:8]}"
    with _conn_lock, _conn() as c:
        # 查找包含此 subject_id 的所有资产
        assets = c.execute("""SELECT asset_id FROM data_assets""").fetchall()
        affected = [a["asset_id"] for a in assets]
        c.execute("""INSERT INTO gdpr_requests
            (id,timestamp,request_id,subject_id,action,status,
             affected_assets,result)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), req_id, subject_id, action, "pending",
             json.dumps(affected), ""))
    return req_id


def process_gdpr_request(request_id: str) -> Dict[str, Any]:
    """处理 GDPR 请求"""
    with _conn_lock, _conn() as c:
        req = c.execute("""SELECT * FROM gdpr_requests WHERE request_id = ?""",
                          (request_id,)).fetchone()
        if not req:
            return {"status": "failed", "error": "not_found"}
        affected = json.loads(req["affected_assets"] or "[]")
        c.execute("""UPDATE gdpr_requests SET status = 'processing' WHERE request_id = ?""",
                   (request_id,))
    result = {"action": req["action"], "subject_id": req["subject_id"],
              "affected_assets": affected, "count": len(affected)}
    if req["action"] == "export":
        result["export_data"] = {
            "subject_id": req["subject_id"],
            "records": [{"asset": a, "data": f"<data for {req['subject_id']}>"}
                         for a in affected],
        }
    elif req["action"] == "delete":
        result["deleted_assets"] = affected
    elif req["action"] == "anonymize":
        result["anonymized_assets"] = affected
    elif req["action"] == "restrict":
        result["restricted_assets"] = affected
    elif req["action"] == "portability":
        result["export_data"] = {"format": "json", "records": affected}
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE gdpr_requests SET status = 'completed', result = ?
            WHERE request_id = ?""",
            (json.dumps(result, ensure_ascii=False), request_id))
    return {"status": "completed", "request_id": request_id, **result}


def visualize_lineage(asset_id: str, direction: str = "downstream",
                       max_depth: int = 3) -> Dict[str, Any]:
    """可视化血缘"""
    nodes = {asset_id: {"id": asset_id, "type": "root"}}
    edges = []
    if direction == "downstream":
        lineage = trace_downstream(asset_id, max_depth)
    else:
        lineage = trace_upstream(asset_id, max_depth)
    for e in lineage:
        if e["source"] not in nodes:
            nodes[e["source"]] = {"id": e["source"], "type": "upstream" if direction == "upstream" else "intermediate"}
        if e["target"] not in nodes:
            nodes[e["target"]] = {"id": e["target"], "type": "intermediate"}
        edges.append({"from": e["source"], "to": e["target"],
                       "type": e["type"], "label": e.get("transformation", "")})
    return {"nodes": list(nodes.values()), "edges": edges,
            "node_count": len(nodes), "edge_count": len(edges)}


def get_lineage_stats() -> Dict[str, Any]:
    """血缘统计"""
    with _conn_lock, _conn() as c:
        assets = c.execute("SELECT COUNT(*) as cnt FROM data_assets").fetchone()["cnt"]
        edges = c.execute("SELECT COUNT(*) as cnt FROM lineage_edges").fetchone()["cnt"]
        pii = c.execute("SELECT COUNT(*) as cnt FROM pii_classifications").fetchone()["cnt"]
        gdpr = c.execute("""SELECT action, COUNT(*) as cnt FROM gdpr_requests
            GROUP BY action""").fetchall()
    return {
        "total_assets": assets,
        "total_lineage_edges": edges,
        "total_pii_columns": pii,
        "gdpr_requests": {r["action"]: r["cnt"] for r in gdpr},
    }


def _send_dingtalk(title: str, content: str) -> None:
    """发送钉钉告警 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "title": title, "content": content,
            "source": "data_lineage",
        }, ensure_ascii=False) + "\n")


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
            self._json(200, {"status": "ok", "service": "data_lineage"})
        elif path == "/api/lineage/stats":
            self._json(200, get_lineage_stats())
        elif path.startswith("/api/lineage/upstream/"):
            asset = path[21:]
            depth = int(qs.get("depth", ["10"])[0])
            self._json(200, {"edges": trace_upstream(asset, depth)})
        elif path.startswith("/api/lineage/downstream/"):
            asset = path[22:]
            depth = int(qs.get("depth", ["10"])[0])
            self._json(200, {"edges": trace_downstream(asset, depth)})
        elif path.startswith("/api/lineage/visualize/"):
            asset = path[23:]
            direction = qs.get("direction", ["downstream"])[0]
            depth = int(qs.get("depth", ["3"])[0])
            self._json(200, visualize_lineage(asset, direction, depth))
        elif path.startswith("/api/pii/"):
            asset = path[9:]
            self._json(200, {"pii": get_pii_for_asset(asset)})
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
        if path == "/api/asset/register":
            aid = register_asset(
                asset_id=data.get("asset_id", ""),
                asset_type=data.get("asset_type", "table"),
                name=data.get("name", ""),
                schema=data.get("schema", ""),
                database=data.get("database", ""),
                description=data.get("description", ""),
                owner=data.get("owner", ""),
                tags=data.get("tags", []),
                pii_categories=data.get("pii_categories", []),
            )
            self._json(201, {"id": aid})
        elif path == "/api/lineage/add":
            eid = add_lineage(
                source_asset=data.get("source_asset", ""),
                target_asset=data.get("target_asset", ""),
                lineage_type=data.get("lineage_type", "table_to_table"),
                transformation=data.get("transformation", ""),
                job_name=data.get("job_name", ""),
                confidence=data.get("confidence", 1.0),
            )
            self._json(201, {"id": eid})
        elif path == "/api/impact/analyze":
            result = impact_analysis(
                asset_id=data.get("asset_id", ""),
                direction=data.get("direction", "downstream"),
                max_depth=data.get("max_depth", 5),
            )
            self._json(200, result)
        elif path == "/api/pii/classify":
            cid = classify_pii(
                asset_id=data.get("asset_id", ""),
                column_name=data.get("column_name", ""),
                pii_category=data.get("pii_category", "name"),
                sensitivity=data.get("sensitivity", "high"),
            )
            self._json(201, {"id": cid})
        elif path == "/api/gdpr/request":
            req_id = create_gdpr_request(
                subject_id=data.get("subject_id", ""),
                action=data.get("action", "export"),
            )
            self._json(201, {"request_id": req_id})
        elif path == "/api/gdpr/process":
            result = process_gdpr_request(data.get("request_id", ""))
            self._json(200, result)
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Data Lineage service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_register_asset(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: register-asset <asset_id> <name> [type] [owner]")
        return
    asset_type = args[2] if len(args) > 2 else "table"
    owner = args[3] if len(args) > 3 else ""
    aid = register_asset(args[0], asset_type, args[1], owner=owner)
    print(json.dumps({"id": aid}, ensure_ascii=False))


def cmd_add_lineage(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: add-lineage <source> <target> [type] [job]")
        return
    ltype = args[2] if len(args) > 2 else "table_to_table"
    job = args[3] if len(args) > 3 else ""
    eid = add_lineage(args[0], args[1], ltype, "", job)
    print(json.dumps({"id": eid}, ensure_ascii=False))


def cmd_upstream(args: List[str]) -> None:
    if not args:
        print("usage: upstream <asset_id> [depth]")
        return
    depth = int(args[1]) if len(args) > 1 else 10
    print(json.dumps(trace_upstream(args[0], depth), ensure_ascii=False, indent=2))


def cmd_downstream(args: List[str]) -> None:
    if not args:
        print("usage: downstream <asset_id> [depth]")
        return
    depth = int(args[1]) if len(args) > 1 else 10
    print(json.dumps(trace_downstream(args[0], depth), ensure_ascii=False, indent=2))


def cmd_impact(args: List[str]) -> None:
    if not args:
        print("usage: impact <asset_id> [direction] [depth]")
        return
    direction = args[1] if len(args) > 1 else "downstream"
    depth = int(args[2]) if len(args) > 2 else 5
    print(json.dumps(impact_analysis(args[0], direction, depth),
                      ensure_ascii=False, indent=2))


def cmd_pii_classify(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: pii-classify <asset_id> <column> <category> [sensitivity]")
        return
    sensitivity = args[3] if len(args) > 3 else "high"
    cid = classify_pii(args[0], args[1], args[2], sensitivity)
    print(json.dumps({"id": cid}, ensure_ascii=False))


def cmd_pii_get(args: List[str]) -> None:
    if not args:
        print("usage: pii-get <asset_id>")
        return
    print(json.dumps(get_pii_for_asset(args[0]), ensure_ascii=False, indent=2))


def cmd_gdpr_request(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: gdpr-request <subject_id> <action>")
        return
    req_id = create_gdpr_request(args[0], args[1])
    print(json.dumps({"request_id": req_id}, ensure_ascii=False))


def cmd_gdpr_process(args: List[str]) -> None:
    if not args:
        print("usage: gdpr-process <request_id>")
        return
    print(json.dumps(process_gdpr_request(args[0]), ensure_ascii=False, indent=2))


def cmd_visualize(args: List[str]) -> None:
    if not args:
        print("usage: visualize <asset_id> [direction] [depth]")
        return
    direction = args[1] if len(args) > 1 else "downstream"
    depth = int(args[2]) if len(args) > 2 else 3
    print(json.dumps(visualize_lineage(args[0], direction, depth),
                      ensure_ascii=False, indent=2))


def cmd_stats(_args: List[str]) -> None:
    print(json.dumps(get_lineage_stats(), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "register-asset": cmd_register_asset,
        "add-lineage": cmd_add_lineage, "upstream": cmd_upstream,
        "downstream": cmd_downstream, "impact": cmd_impact,
        "pii-classify": cmd_pii_classify, "pii-get": cmd_pii_get,
        "gdpr-request": cmd_gdpr_request, "gdpr-process": cmd_gdpr_process,
        "visualize": cmd_visualize, "stats": cmd_stats,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

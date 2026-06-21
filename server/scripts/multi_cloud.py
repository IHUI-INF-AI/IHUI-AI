#!/usr/bin/env python3
"""
跨云多活架构
P0-33: 阿里云+华为云+AWS 东京三活, 数据双向同步, DNS 智能解析, 故障秒级切换
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

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "multi_cloud.db")
HTTP_PORT = 10130

CLOUD_PROVIDERS = ["aliyun", "huawei", "aws_tokyo", "azure", "gcp", "tencent"]
SYNC_MODES = ["async", "sync", "semi_sync"]
REPLICATION_TYPES = ["logical", "physical", "streaming"]
DNS_STRATEGIES = ["geo", "latency", "weighted", "failover"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS cloud_regions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            region_id TEXT NOT NULL UNIQUE,
            provider TEXT,
            region_name TEXT,
            zone TEXT,
            role TEXT,
            endpoint TEXT,
            rto_seconds INTEGER DEFAULT 30,
            rpo_seconds INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            last_health_check TEXT
        );
        CREATE TABLE IF NOT EXISTS replication_links (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            link_id TEXT NOT NULL UNIQUE,
            source_region TEXT,
            target_region TEXT,
            replication_type TEXT,
            sync_mode TEXT,
            lag_ms INTEGER DEFAULT 0,
            state TEXT DEFAULT 'streaming',
            throughput_mbps REAL DEFAULT 0.0
        );
        CREATE TABLE IF NOT EXISTS dns_routes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            hostname TEXT NOT NULL,
            strategy TEXT,
            records TEXT,
            health_check_id TEXT,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS consistency_checks (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            check_id TEXT NOT NULL,
            region_a TEXT,
            region_b TEXT,
            table_name TEXT,
            rows_a INTEGER,
            rows_b INTEGER,
            conflicts INTEGER,
            resolution TEXT
        );
        CREATE TABLE IF NOT EXISTS failover_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            event_id TEXT NOT NULL,
            from_region TEXT,
            to_region TEXT,
            reason TEXT,
            rto_actual_seconds INTEGER,
            rpo_actual_seconds INTEGER,
            status TEXT DEFAULT 'in_progress'
        );
        CREATE INDEX IF NOT EXISTS idx_replication_source ON replication_links(source_region);
        CREATE INDEX IF NOT EXISTS idx_failover_event ON failover_events(event_id);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_region(region_id: str, provider: str, region_name: str,
                     zone: str = "", role: str = "primary",
                     endpoint: str = "",
                     rto_seconds: int = 30, rpo_seconds: int = 0) -> str:
    """注册云区域"""
    if provider not in CLOUD_PROVIDERS:
        provider = "aliyun"
    if role not in ["primary", "secondary", "dr", "edge"]:
        role = "primary"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO cloud_regions
            (id,timestamp,region_id,provider,region_name,zone,role,endpoint,
             rto_seconds,rpo_seconds,status,last_health_check)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), region_id, provider, region_name, zone, role,
             endpoint, rto_seconds, rpo_seconds, "active", ""))
    return rid


def create_replication_link(source_region: str, target_region: str,
                              replication_type: str = "logical",
                              sync_mode: str = "async") -> str:
    """创建复制链路"""
    if replication_type not in REPLICATION_TYPES:
        replication_type = "logical"
    if sync_mode not in SYNC_MODES:
        sync_mode = "async"
    link_id = f"link-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO replication_links
            (id,timestamp,link_id,source_region,target_region,
             replication_type,sync_mode,lag_ms,state,throughput_mbps)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), link_id, source_region, target_region,
             replication_type, sync_mode, 0, "streaming", 0.0))
    return link_id


def update_replication_lag(link_id: str, lag_ms: int, throughput_mbps: float = 0) -> bool:
    """更新复制延迟"""
    with _conn_lock, _conn() as c:
        cur = c.execute("""UPDATE replication_links SET lag_ms = ?, throughput_mbps = ?
            WHERE link_id = ?""", (lag_ms, throughput_mbps, link_id))
        return cur.rowcount > 0


def setup_dns_route(hostname: str, strategy: str, records: List[Dict],
                     health_check_id: str = "") -> str:
    """设置 DNS 路由"""
    if strategy not in DNS_STRATEGIES:
        strategy = "failover"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO dns_routes
            (id,timestamp,hostname,strategy,records,health_check_id,enabled)
            VALUES (?,?,?,?,?,?,?)""",
            (rid, _now(), hostname, strategy,
             json.dumps(records, ensure_ascii=False), health_check_id, 1))
    return rid


def resolve_dns(hostname: str, client_region: str = "") -> Optional[Dict[str, Any]]:
    """解析 DNS"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM dns_routes
            WHERE hostname = ? AND enabled = 1""", (hostname,)).fetchone()
    if not row:
        return None
    records = json.loads(row["records"] or "[]")
    strategy = row["strategy"]
    selected = None
    if strategy == "geo" and client_region:
        for r in records:
            if r.get("region") == client_region and r.get("healthy", True):
                selected = r
                break
    elif strategy == "weighted":
        total = sum(r.get("weight", 1) for r in records)
        pos = (hash(client_region or "") % total) if records else 0
        cur = 0
        for r in records:
            cur += r.get("weight", 1)
            if pos < cur:
                selected = r
                break
    elif strategy == "failover":
        for r in records:
            if r.get("primary", False) and r.get("healthy", True):
                selected = r
                break
        if not selected:
            for r in records:
                if r.get("healthy", True):
                    selected = r
                    break
    else:
        for r in records:
            if r.get("healthy", True):
                selected = r
                break
    if not selected and records:
        selected = records[0]
    return {"hostname": hostname, "strategy": strategy, "client_region": client_region,
            "selected": selected, "total_records": len(records)}


def check_consistency(region_a: str, region_b: str, table_name: str,
                        rows_a: int, rows_b: int) -> Dict[str, Any]:
    """一致性检查"""
    conflicts = abs(rows_a - rows_b)
    if conflicts == 0:
        resolution = "consistent"
    elif conflicts < 10:
        resolution = "auto_resolve"
    else:
        resolution = "manual_review"
    cid = str(uuid.uuid4())
    check_id = f"check-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO consistency_checks
            (id,timestamp,check_id,region_a,region_b,table_name,
             rows_a,rows_b,conflicts,resolution)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (cid, _now(), check_id, region_a, region_b, table_name,
             rows_a, rows_b, conflicts, resolution))
    return {"check_id": check_id, "conflicts": conflicts, "resolution": resolution}


def trigger_failover(from_region: str, to_region: str, reason: str) -> str:
    """触发故障切换"""
    event_id = f"failover-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO failover_events
            (id,timestamp,event_id,from_region,to_region,reason,
             rto_actual_seconds,rpo_actual_seconds,status)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (eid, _now(), event_id, from_region, to_region, reason,
             0, 0, "in_progress"))
    return event_id


def complete_failover(event_id: str, rto_seconds: int, rpo_seconds: int) -> bool:
    """完成故障切换"""
    with _conn_lock, _conn() as c:
        cur = c.execute("""UPDATE failover_events
            SET status = 'completed', rto_actual_seconds = ?, rpo_actual_seconds = ?
            WHERE event_id = ?""", (rto_seconds, rpo_seconds, event_id))
        return cur.rowcount > 0


def get_region_health(region_id: str) -> Dict[str, Any]:
    """获取区域健康"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM cloud_regions WHERE region_id = ?""",
                          (region_id,)).fetchone()
        if not row:
            return {"region": region_id, "status": "unknown"}
        replications = c.execute("""SELECT * FROM replication_links
            WHERE source_region = ? OR target_region = ?""",
            (region_id, region_id)).fetchall()
    avg_lag = sum(r["lag_ms"] for r in replications) / len(replications) if replications else 0
    return {"region": region_id, "status": row["status"],
            "provider": row["provider"], "role": row["role"],
            "rto_target": row["rto_seconds"], "rpo_target": row["rpo_seconds"],
            "replication_links": len(replications), "avg_lag_ms": round(avg_lag, 2)}


def get_topology() -> Dict[str, Any]:
    """获取全局拓扑"""
    with _conn_lock, _conn() as c:
        regions = c.execute("""SELECT region_id, provider, role, status
            FROM cloud_regions""").fetchall()
        links = c.execute("""SELECT * FROM replication_links""").fetchall()
    return {"regions": [dict(r) for r in regions],
            "replication_links": [dict(l) for l in links]}


def compute_data_hash(payload: str) -> str:
    """计算数据 hash (用于一致性校验)"""
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "multi_cloud"}, ensure_ascii=False) + "\n")


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
            self._json(200, {"status": "ok", "service": "multi_cloud"})
        elif path == "/api/topology":
            self._json(200, get_topology())
        elif path.startswith("/api/region/") and path.endswith("/health"):
            region = path[12:-7]
            self._json(200, get_region_health(region))
        elif path == "/api/dns/resolve":
            hostname = qs.get("hostname", [""])[0]
            region = qs.get("client_region", [""])[0]
            result = resolve_dns(hostname, region)
            if result:
                self._json(200, result)
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
        if path == "/api/region/register":
            rid = register_region(
                region_id=data.get("region_id", ""),
                provider=data.get("provider", "aliyun"),
                region_name=data.get("region_name", ""),
                zone=data.get("zone", ""),
                role=data.get("role", "primary"),
                endpoint=data.get("endpoint", ""),
                rto_seconds=data.get("rto_seconds", 30),
                rpo_seconds=data.get("rpo_seconds", 0),
            )
            self._json(201, {"id": rid})
        elif path == "/api/replication/link":
            link_id = create_replication_link(
                source_region=data.get("source_region", ""),
                target_region=data.get("target_region", ""),
                replication_type=data.get("replication_type", "logical"),
                sync_mode=data.get("sync_mode", "async"),
            )
            self._json(201, {"link_id": link_id})
        elif path == "/api/replication/lag":
            ok = update_replication_lag(
                link_id=data.get("link_id", ""),
                lag_ms=data.get("lag_ms", 0),
                throughput_mbps=data.get("throughput_mbps", 0.0),
            )
            self._json(200, {"updated": ok})
        elif path == "/api/dns/route":
            rid = setup_dns_route(
                hostname=data.get("hostname", ""),
                strategy=data.get("strategy", "failover"),
                records=data.get("records", []),
                health_check_id=data.get("health_check_id", ""),
            )
            self._json(201, {"id": rid})
        elif path == "/api/consistency/check":
            result = check_consistency(
                region_a=data.get("region_a", ""),
                region_b=data.get("region_b", ""),
                table_name=data.get("table_name", ""),
                rows_a=data.get("rows_a", 0),
                rows_b=data.get("rows_b", 0),
            )
            self._json(200, result)
        elif path == "/api/failover/trigger":
            event_id = trigger_failover(
                from_region=data.get("from_region", ""),
                to_region=data.get("to_region", ""),
                reason=data.get("reason", ""),
            )
            self._json(201, {"event_id": event_id})
        elif path == "/api/failover/complete":
            ok = complete_failover(
                event_id=data.get("event_id", ""),
                rto_seconds=data.get("rto_seconds", 0),
                rpo_seconds=data.get("rpo_seconds", 0),
            )
            self._json(200, {"completed": ok})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Multi-Cloud service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_register_region(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: register-region <id> <provider> [name] [role] [rto] [rpo]")
        return
    name = args[2] if len(args) > 2 else args[0]
    role = args[3] if len(args) > 3 else "primary"
    rto = int(args[4]) if len(args) > 4 else 30
    rpo = int(args[5]) if len(args) > 5 else 0
    rid = register_region(args[0], args[1], name, "", role, "", rto, rpo)
    print(json.dumps({"id": rid}, ensure_ascii=False))


def cmd_link(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: link <source> <target> [type] [mode]")
        return
    rtype = args[2] if len(args) > 2 else "logical"
    mode = args[3] if len(args) > 3 else "async"
    link_id = create_replication_link(args[0], args[1], rtype, mode)
    print(json.dumps({"link_id": link_id}, ensure_ascii=False))


def cmd_lag(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: lag <link_id> <lag_ms> [throughput_mbps]")
        return
    tput = float(args[2]) if len(args) > 2 else 0.0
    ok = update_replication_lag(args[0], int(args[1]), tput)
    print(json.dumps({"updated": ok}, ensure_ascii=False))


def cmd_dns(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: dns <hostname> <strategy> [records_json]")
        return
    strategy = args[1] if len(args) > 1 else "failover"
    records = [{"region": "aliyun-shanghai", "primary": True, "weight": 80, "healthy": True},
               {"region": "huawei-guangzhou", "primary": False, "weight": 20, "healthy": True}]
    rid = setup_dns_route(args[0], strategy, records)
    print(json.dumps({"id": rid}, ensure_ascii=False))


def cmd_resolve(args: List[str]) -> None:
    if not args:
        print("usage: resolve <hostname> [client_region]")
        return
    region = args[1] if len(args) > 1 else ""
    print(json.dumps(resolve_dns(args[0], region), ensure_ascii=False, indent=2))


def cmd_consistency(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: consistency <region_a> <region_b> <table> <rows_a> <rows_b>")
        return
    print(json.dumps(check_consistency(args[0], args[1], args[2],
                                          int(args[3]), int(args[4])),
                       ensure_ascii=False, indent=2))


def cmd_failover(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: failover <from> <to> <reason>")
        return
    eid = trigger_failover(args[0], args[1], args[2])
    print(json.dumps({"event_id": eid}, ensure_ascii=False))


def cmd_complete(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: complete <event_id> <rto_seconds> <rpo_seconds>")
        return
    ok = complete_failover(args[0], int(args[1]), int(args[2]))
    print(json.dumps({"completed": ok}, ensure_ascii=False))


def cmd_health(args: List[str]) -> None:
    if not args:
        print("usage: health <region_id>")
        return
    print(json.dumps(get_region_health(args[0]), ensure_ascii=False, indent=2))


def cmd_topology(_args: List[str]) -> None:
    print(json.dumps(get_topology(), ensure_ascii=False, indent=2))


def cmd_hash(args: List[str]) -> None:
    if not args:
        print("usage: hash <data>")
        return
    print(json.dumps({"hash": compute_data_hash(args[0])}, ensure_ascii=False))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "register-region": cmd_register_region,
            "link": cmd_link, "lag": cmd_lag, "dns": cmd_dns, "resolve": cmd_resolve,
            "consistency": cmd_consistency, "failover": cmd_failover,
            "complete": cmd_complete, "health": cmd_health, "topology": cmd_topology,
            "hash": cmd_hash}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

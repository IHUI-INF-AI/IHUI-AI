#!/usr/bin/env python3
"""
Service Mesh 完整集成 (Istio 风格)
P0-22: mTLS, 流量分割, 故障注入, 路由规则
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from datetime import timedelta
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "service_mesh.db")
HTTP_PORT = 10020

MESH_TYPE = "istio"
MTLS_MODES = ["STRICT", "PERMISSIVE", "DISABLE"]
TRAFFIC_SPLIT_TYPES = ["canary", "blue_green", "ab_test", "mirror"]
FAULT_TYPES = ["abort", "delay", "rate_limit"]
MATCH_TYPES = ["header", "uri", "method", "source_label", "source_namespace"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS mtls_policies (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            name TEXT NOT NULL UNIQUE,
            namespace TEXT,
            mode TEXT NOT NULL,
            targets TEXT
        );
        CREATE TABLE IF NOT EXISTS traffic_splits (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            name TEXT NOT NULL UNIQUE,
            namespace TEXT,
            split_type TEXT,
            subsets TEXT,
            weights TEXT,
            active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS fault_injections (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            name TEXT NOT NULL,
            namespace TEXT,
            fault_type TEXT,
            target_subset TEXT,
            config TEXT,
            duration_seconds INTEGER,
            active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS virtual_services (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            name TEXT NOT NULL,
            namespace TEXT,
            host TEXT,
            http_routes TEXT,
            active INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS mesh_telemetry (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            source_service TEXT,
            dest_service TEXT,
            protocol TEXT,
            mtls_enabled INTEGER,
            rtt_ms REAL,
            bytes_sent INTEGER,
            bytes_received INTEGER,
            status_code INTEGER
        );
        CREATE TABLE IF NOT EXISTS certificates (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            serial TEXT NOT NULL UNIQUE,
            service_identity TEXT,
            not_before TEXT,
            not_after TEXT,
            status TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_mesh_telemetry_ts ON mesh_telemetry(timestamp);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def create_mtls_policy(name: str, namespace: str, mode: str,
                       targets: List[str]) -> str:
    """创建 mTLS 策略"""
    if mode not in MTLS_MODES:
        mode = "PERMISSIVE"
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO mtls_policies
            (id,timestamp,name,namespace,mode,targets)
            VALUES (?,?,?,?,?,?)""",
            (pid, _now(), name, namespace, mode, json.dumps(targets)))
    return pid


def list_mtls_policies() -> List[Dict[str, Any]]:
    """列出 mTLS 策略"""
    with _conn_lock, _conn() as c:
        rows = c.execute("SELECT * FROM mtls_policies ORDER BY timestamp DESC").fetchall()
    return [{"id": r["id"], "name": r["name"], "namespace": r["namespace"],
             "mode": r["mode"], "targets": json.loads(r["targets"] or "[]")}
            for r in rows]


def create_traffic_split(name: str, namespace: str, split_type: str,
                         subsets: List[str], weights: List[int]) -> str:
    """创建流量分割"""
    if split_type not in TRAFFIC_SPLIT_TYPES:
        split_type = "canary"
    if len(subsets) != len(weights):
        raise ValueError("subsets 和 weights 长度必须相同")
    if sum(weights) != 100:
        # 自动归一化
        total = sum(weights) or 1
        weights = [int(w * 100 / total) for w in weights]
    tid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO traffic_splits
            (id,timestamp,name,namespace,split_type,subsets,weights,active)
            VALUES (?,?,?,?,?,?,?,1)""",
            (tid, _now(), name, namespace, split_type,
             json.dumps(subsets), json.dumps(weights)))
    return tid


def select_subset(weights: List[int]) -> int:
    """根据权重选择子集索引"""
    import random
    if not weights or sum(weights) == 0:
        return 0
    rnd = random.randint(1, sum(weights))
    acc = 0
    for i, w in enumerate(weights):
        acc += w
        if rnd <= acc:
            return i
    return len(weights) - 1


def create_fault_injection(name: str, namespace: str, fault_type: str,
                            target_subset: str, config: Dict[str, Any],
                            duration_seconds: int = 300) -> str:
    """创建故障注入"""
    if fault_type not in FAULT_TYPES:
        fault_type = "delay"
    fid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO fault_injections
            (id,timestamp,name,namespace,fault_type,target_subset,
             config,duration_seconds,active)
            VALUES (?,?,?,?,?,?,?,?,1)""",
            (fid, _now(), name, namespace, fault_type, target_subset,
             json.dumps(config), duration_seconds))
    return fid


def apply_fault(fault: Dict[str, Any]) -> Dict[str, Any]:
    """应用故障, 返回处理结果"""
    ftype = fault["fault_type"]
    config = fault["config"] if isinstance(fault["config"], dict) else json.loads(fault["config"] or "{}")
    if ftype == "abort":
        return {"abort": True, "status_code": config.get("http_status", 503),
                "percentage": config.get("percentage", 100)}
    if ftype == "delay":
        return {"delay": True, "delay_ms": config.get("fixed_delay_ms", 1000),
                "percentage": config.get("percentage", 100)}
    if ftype == "rate_limit":
        return {"rate_limit": True, "rps": config.get("rps", 10),
                "burst": config.get("burst", 20)}
    return {}


def create_virtual_service(name: str, namespace: str, host: str,
                            http_routes: List[Dict[str, Any]]) -> str:
    """创建 VirtualService"""
    vid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO virtual_services
            (id,timestamp,name,namespace,host,http_routes,active)
            VALUES (?,?,?,?,?,?,1)""",
            (vid, _now(), name, namespace, host, json.dumps(http_routes)))
    return vid


def match_request(route_match: Dict[str, Any], request: Dict[str, Any]) -> bool:
    """检查请求是否匹配路由规则"""
    for key, expected in route_match.items():
        mtype = key
        if mtype == "uri" and expected.get("prefix"):
            if not request.get("path", "").startswith(expected["prefix"]):
                return False
        elif mtype == "method":
            if request.get("method", "").upper() != expected.upper():
                return False
        elif mtype == "header":
            for hk, hv in expected.items():
                if request.get("headers", {}).get(hk, "") != hv:
                    return False
        elif mtype == "source_label":
            if request.get("source_labels", {}).get("app", "") != expected.get("app"):
                return False
        elif mtype == "source_namespace":
            if request.get("source_namespace", "") != expected:
                return False
    return True


def route_request(vs: Dict[str, Any], request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """根据 VirtualService 路由请求"""
    routes = vs["http_routes"] if isinstance(vs["http_routes"], list) \
        else json.loads(vs["http_routes"] or "[]")
    for r in routes:
        if match_request(r.get("match", {}), request):
            return r.get("route", {})
    return None


def record_mesh_telemetry(source_service: str, dest_service: str,
                          protocol: str, mtls_enabled: bool,
                          rtt_ms: float, bytes_sent: int,
                          bytes_received: int, status_code: int) -> str:
    """记录 mesh 遥测"""
    tid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO mesh_telemetry
            (id,timestamp,source_service,dest_service,protocol,
             mtls_enabled,rtt_ms,bytes_sent,bytes_received,status_code)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (tid, _now(), source_service, dest_service, protocol,
             1 if mtls_enabled else 0, rtt_ms, bytes_sent, bytes_received, status_code))
    return tid


def issue_certificate(serial: str, service_identity: str,
                      validity_days: int = 90) -> str:
    """签发 SPIFFE 证书 (Stub)"""
    cid = str(uuid.uuid4())
    now = datetime.utcnow()
    not_before = now.isoformat() + "Z"
    not_after = (now + timedelta(days=validity_days)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO certificates
            (id,timestamp,serial,service_identity,not_before,not_after,status)
            VALUES (?,?,?,?,?,?,?)""",
            (cid, _now(), serial, service_identity, not_before, not_after, "active"))
    return cid


def get_telemetry_summary(minutes: int = 60) -> Dict[str, Any]:
    """遥测汇总"""
    since = (datetime.utcnow() - timedelta(minutes=minutes)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT source_service, dest_service,
            COUNT(*) as cnt, AVG(rtt_ms) as avg_rtt,
            SUM(bytes_sent) as total_sent,
            SUM(bytes_received) as total_recv,
            SUM(mtls_enabled) as mtls_cnt
            FROM mesh_telemetry WHERE timestamp >= ?
            GROUP BY source_service, dest_service""", (since,)).fetchall()
    return {"window_minutes": minutes, "flows": [
        {"source": r["source_service"], "dest": r["dest_service"],
         "request_count": r["cnt"],
         "avg_rtt_ms": round(r["avg_rtt"] or 0, 2),
         "bytes_sent": r["total_sent"] or 0,
         "bytes_received": r["total_recv"] or 0,
         "mtls_rate": round((r["mtls_cnt"] or 0) / r["cnt"], 4) if r["cnt"] else 0.0}
        for r in rows
    ]}


def get_mesh_overview() -> Dict[str, Any]:
    """网格总览"""
    with _conn_lock, _conn() as c:
        mtls_count = c.execute("SELECT COUNT(*) as cnt FROM mtls_policies").fetchone()["cnt"]
        split_count = c.execute("SELECT COUNT(*) as cnt FROM traffic_splits WHERE active=1").fetchone()["cnt"]
        fault_count = c.execute("SELECT COUNT(*) as cnt FROM fault_injections WHERE active=1").fetchone()["cnt"]
        vs_count = c.execute("SELECT COUNT(*) as cnt FROM virtual_services WHERE active=1").fetchone()["cnt"]
        cert_count = c.execute("SELECT COUNT(*) as cnt FROM certificates WHERE status='active'").fetchone()["cnt"]
    return {
        "mesh_type": MESH_TYPE,
        "mtls_policies": mtls_count,
        "active_traffic_splits": split_count,
        "active_fault_injections": fault_count,
        "active_virtual_services": vs_count,
        "active_certificates": cert_count,
    }


def _send_dingtalk(title: str, content: str) -> None:
    """发送钉钉告警 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "title": title, "content": content,
            "source": "service_mesh",
        }, ensure_ascii=False) + "\n")


def check_mtls_compliance(window_minutes: int = 60) -> bool:
    """检查 mTLS 合规性"""
    since = (utcnow() - timedelta(minutes=window_minutes)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        total = c.execute("""SELECT COUNT(*) as cnt FROM mesh_telemetry
            WHERE timestamp >= ?""", (since,)).fetchone()["cnt"]
        mtls = c.execute("""SELECT COUNT(*) as cnt FROM mesh_telemetry
            WHERE timestamp >= ? AND mtls_enabled = 1""", (since,)).fetchone()["cnt"]
    if total == 0:
        return True
    rate = mtls / total
    if rate < 0.95:
        _send_dingtalk("mTLS 合规告警", f"mTLS 启用率 {round(rate*100, 2)}% 低于 95%")
        return False
    return True


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
            self._json(200, {"status": "ok", "service": "service_mesh"})
        elif path == "/api/mtls/policies":
            self._json(200, {"policies": list_mtls_policies()})
        elif path == "/api/mesh/overview":
            self._json(200, get_mesh_overview())
        elif path == "/api/telemetry/summary":
            self._json(200, get_telemetry_summary())
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
        if path == "/api/mtls/policy":
            pid = create_mtls_policy(
                name=data.get("name", ""),
                namespace=data.get("namespace", "default"),
                mode=data.get("mode", "PERMISSIVE"),
                targets=data.get("targets", []),
            )
            self._json(201, {"id": pid})
        elif path == "/api/traffic/split":
            tid = create_traffic_split(
                name=data.get("name", ""),
                namespace=data.get("namespace", "default"),
                split_type=data.get("split_type", "canary"),
                subsets=data.get("subsets", []),
                weights=data.get("weights", []),
            )
            self._json(201, {"id": tid})
        elif path == "/api/traffic/select":
            idx = select_subset(data.get("weights", []))
            subsets = data.get("subsets", [])
            self._json(200, {"subset": subsets[idx] if idx < len(subsets) else ""})
        elif path == "/api/fault/inject":
            fid = create_fault_injection(
                name=data.get("name", ""),
                namespace=data.get("namespace", "default"),
                fault_type=data.get("fault_type", "delay"),
                target_subset=data.get("target_subset", ""),
                config=data.get("config", {}),
                duration_seconds=data.get("duration_seconds", 300),
            )
            self._json(201, {"id": fid})
        elif path == "/api/fault/apply":
            result = apply_fault(data)
            self._json(200, result)
        elif path == "/api/virtualservice":
            vid = create_virtual_service(
                name=data.get("name", ""),
                namespace=data.get("namespace", "default"),
                host=data.get("host", ""),
                http_routes=data.get("http_routes", []),
            )
            self._json(201, {"id": vid})
        elif path == "/api/route/match":
            vs = {"http_routes": data.get("http_routes", [])}
            route = route_request(vs, data.get("request", {}))
            self._json(200, {"route": route})
        elif path == "/api/telemetry/record":
            tid = record_mesh_telemetry(
                source_service=data.get("source_service", ""),
                dest_service=data.get("dest_service", ""),
                protocol=data.get("protocol", "http"),
                mtls_enabled=data.get("mtls_enabled", False),
                rtt_ms=data.get("rtt_ms", 0.0),
                bytes_sent=data.get("bytes_sent", 0),
                bytes_received=data.get("bytes_received", 0),
                status_code=data.get("status_code", 200),
            )
            self._json(201, {"id": tid})
        elif path == "/api/certificate/issue":
            cid = issue_certificate(
                serial=data.get("serial", str(uuid.uuid4())),
                service_identity=data.get("service_identity", ""),
                validity_days=data.get("validity_days", 90),
            )
            self._json(201, {"id": cid})
        elif path == "/api/mtls/check":
            ok = check_mtls_compliance()
            self._json(200, {"compliant": ok})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Service Mesh service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_mtls_create(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: mtls-create <name> <mode> [namespace] [targets_csv]")
        return
    name, mode = args[0], args[1]
    ns = args[2] if len(args) > 2 else "default"
    targets = args[3].split(",") if len(args) > 3 else []
    pid = create_mtls_policy(name, ns, mode, targets)
    print(json.dumps({"id": pid, "name": name, "mode": mode}, ensure_ascii=False))


def cmd_split_create(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: split-create <name> <type> <subsets_csv> <weights_csv>")
        return
    name = args[0]
    stype = args[1]
    subsets = args[2].split(",")
    weights = [int(w) for w in args[3].split(",")]
    tid = create_traffic_split(name, "default", stype, subsets, weights)
    print(json.dumps({"id": tid, "name": name, "subsets": subsets,
                      "weights": weights}, ensure_ascii=False))


def cmd_split_select(args: List[str]) -> None:
    if not args:
        print("usage: split-select <weights_csv>")
        return
    weights = [int(w) for w in args[0].split(",")]
    idx = select_subset(weights)
    print(json.dumps({"selected_index": idx}, ensure_ascii=False))


def cmd_fault_create(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: fault-create <name> <type> <target_subset> [config_json] [duration]")
        return
    name = args[0]
    ftype = args[1]
    target = args[2]
    config = json.loads(args[3]) if len(args) > 3 else {}
    duration = int(args[4]) if len(args) > 4 else 300
    fid = create_fault_injection(name, "default", ftype, target, config, duration)
    print(json.dumps({"id": fid, "name": name}, ensure_ascii=False))


def cmd_fault_apply(args: List[str]) -> None:
    if not args:
        print("usage: fault-apply <config_json>")
        return
    config = json.loads(args[0])
    fault = {"fault_type": config.get("fault_type", "delay"), "config": config}
    result = apply_fault(fault)
    print(json.dumps(result, ensure_ascii=False))


def cmd_vs_create(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: vs-create <name> <host> [http_routes_json]")
        return
    name = args[0]
    host = args[1]
    routes = json.loads(args[2]) if len(args) > 2 else []
    vid = create_virtual_service(name, "default", host, routes)
    print(json.dumps({"id": vid, "name": name, "host": host}, ensure_ascii=False))


def cmd_telemetry(args: List[str]) -> None:
    minutes = int(args[0]) if args else 60
    print(json.dumps(get_telemetry_summary(minutes), ensure_ascii=False, indent=2))


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_mesh_overview(), ensure_ascii=False, indent=2))


def cmd_cert_issue(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: cert-issue <serial> <service_identity> [validity_days]")
        return
    serial = args[0]
    identity = args[1]
    days = int(args[2]) if len(args) > 2 else 90
    cid = issue_certificate(serial, identity, days)
    print(json.dumps({"id": cid, "serial": serial}, ensure_ascii=False))


def cmd_match(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: match <route_match_json> <request_json>")
        return
    match = json.loads(args[0])
    request = json.loads(args[1])
    print(match_request(match, request))


def cmd_route(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: route <http_routes_json> <request_json>")
        return
    routes = json.loads(args[0])
    request = json.loads(args[1])
    vs = {"http_routes": routes}
    route = route_request(vs, request)
    print(json.dumps({"route": route}, ensure_ascii=False))


def cmd_record_telemetry(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: record-telemetry <source> <dest> <rtt_ms> <status_code> [mtls]")
        return
    mtls = len(args) > 4 and args[4].lower() == "true"
    tid = record_mesh_telemetry(args[0], args[1], "http", mtls,
                                  float(args[2]), 0, 0, int(args[3]))
    print(json.dumps({"id": tid}, ensure_ascii=False))


def cmd_check_mtls(_args: List[str]) -> None:
    ok = check_mtls_compliance()
    print(json.dumps({"compliant": ok}, ensure_ascii=False))


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "mtls-create": cmd_mtls_create,
        "split-create": cmd_split_create, "split-select": cmd_split_select,
        "fault-create": cmd_fault_create, "fault-apply": cmd_fault_apply,
        "vs-create": cmd_vs_create, "telemetry": cmd_telemetry,
        "overview": cmd_overview, "cert-issue": cmd_cert_issue,
        "match": cmd_match, "route": cmd_route,
        "record-telemetry": cmd_record_telemetry, "check-mtls": cmd_check_mtls,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
API 网关统一治理
P0-34: 限流/熔断/降级, 灰度路由, 统一认证, 插件管理, 流量录制
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

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "api_gateway.db")
HTTP_PORT = 10140

LIMIT_TYPES = ["second", "minute", "hour", "day"]
CIRCUIT_STATES = ["closed", "open", "half_open"]
AUTH_TYPES = ["jwt", "basic", "api_key", "oauth2", "hmac"]
GRADIENT_TYPES = ["canary", "blue_green", "ab_test", "mirror"]
PLUGIN_TYPES = ["rate_limit", "auth", "cors", "log", "transform", "security"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS routes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            route_name TEXT NOT NULL UNIQUE,
            path TEXT NOT NULL,
            methods TEXT,
            upstream TEXT,
            plugins TEXT,
            strip_path INTEGER DEFAULT 1,
            preserve_host INTEGER DEFAULT 0,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            service_name TEXT NOT NULL UNIQUE,
            host TEXT,
            port INTEGER,
            protocol TEXT,
            routes TEXT,
            health_check TEXT,
            weight INTEGER DEFAULT 100
        );
        CREATE TABLE IF NOT EXISTS consumers (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            consumer_id TEXT NOT NULL UNIQUE,
            username TEXT,
            auth_type TEXT,
            credentials TEXT,
            tags TEXT,
            rate_limit_tier TEXT
        );
        CREATE TABLE IF NOT EXISTS rate_limits (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            route_name TEXT,
            consumer_id TEXT,
            limit_type TEXT,
            limit_count INTEGER,
            window_seconds INTEGER,
            current_count INTEGER DEFAULT 0,
            reset_at TEXT
        );
        CREATE TABLE IF NOT EXISTS circuit_breakers (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            route_name TEXT NOT NULL,
            failure_threshold INTEGER DEFAULT 5,
            timeout_seconds INTEGER DEFAULT 30,
            half_open_requests INTEGER DEFAULT 3,
            state TEXT DEFAULT 'closed',
            failures INTEGER DEFAULT 0,
            last_failure TEXT
        );
        CREATE TABLE IF NOT EXISTS gradient_routes (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            route_name TEXT NOT NULL,
            gradient_type TEXT,
            rules TEXT,
            traffic_pct INTEGER DEFAULT 100,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS traffic_records (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            route_name TEXT,
            request_id TEXT,
            method TEXT,
            path TEXT,
            status_code INTEGER,
            latency_ms REAL,
            size_bytes INTEGER,
            matched_route TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_rate_consumer ON rate_limits(consumer_id);
        CREATE INDEX IF NOT EXISTS idx_traffic_route ON traffic_records(route_name);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def create_route(route_name: str, path: str, upstream: str,
                 methods: Optional[List[str]] = None,
                 plugins: Optional[Dict] = None,
                 strip_path: bool = True) -> str:
    """创建路由"""
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO routes
            (id,timestamp,route_name,path,methods,upstream,plugins,
             strip_path,preserve_host,enabled)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), route_name, path,
             json.dumps(methods or ["GET"]), upstream,
             json.dumps(plugins or {}, ensure_ascii=False),
             1 if strip_path else 0, 0, 1))
    return rid


def create_service(service_name: str, host: str, port: int,
                    protocol: str = "http") -> str:
    """创建服务"""
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO services
            (id,timestamp,service_name,host,port,protocol,weight)
            VALUES (?,?,?,?,?,?,?)""",
            (sid, _now(), service_name, host, port, protocol, 100))
    return sid


def create_consumer(consumer_id: str, username: str,
                      auth_type: str = "jwt",
                      credentials: Optional[Dict] = None) -> str:
    """创建消费者"""
    if auth_type not in AUTH_TYPES:
        auth_type = "jwt"
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO consumers
            (id,timestamp,consumer_id,username,auth_type,credentials,tags,rate_limit_tier)
            VALUES (?,?,?,?,?,?,?,?)""",
            (cid, _now(), consumer_id, username, auth_type,
             json.dumps(credentials or {}, ensure_ascii=False), "[]", "default"))
    return cid


def check_rate_limit(route_name: str, consumer_id: str,
                      limit_type: str, limit_count: int,
                      window_seconds: int = 60) -> Dict[str, Any]:
    """检查限流"""
    if limit_type not in LIMIT_TYPES:
        limit_type = "second"
    key = f"{route_name}:{consumer_id}:{limit_type}"
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM rate_limits
            WHERE route_name = ? AND consumer_id = ? AND limit_type = ?
            ORDER BY timestamp DESC LIMIT 1""",
            (route_name, consumer_id, limit_type)).fetchone()
    if not row:
        rid = str(uuid.uuid4())
        with _conn_lock, _conn() as c:
            c.execute("""INSERT INTO rate_limits
                (id,timestamp,route_name,consumer_id,limit_type,
                 limit_count,window_seconds,current_count,reset_at)
                VALUES (?,?,?,?,?,?,?,?,?)""",
                (rid, _now(), route_name, consumer_id, limit_type,
                 limit_count, window_seconds, 1,
                 datetime.utcfromtimestamp(time.time() + window_seconds).isoformat()))
        return {"allowed": True, "remaining": limit_count - 1, "limit": limit_count}
    count = row["current_count"] + 1
    reset_at = row["reset_at"]
    if count > limit_count:
        return {"allowed": False, "remaining": 0, "limit": limit_count,
                "retry_after": window_seconds}
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE rate_limits SET current_count = ? WHERE id = ?""",
                   (count, row["id"]))
    return {"allowed": True, "remaining": limit_count - count, "limit": limit_count}


def circuit_breaker_record(route_name: str, success: bool,
                           failure_threshold: int = 5,
                           timeout_seconds: int = 30) -> Dict[str, Any]:
    """熔断器记录"""
    with _conn_lock, _conn() as c:
        cb = c.execute("""SELECT * FROM circuit_breakers
            WHERE route_name = ?""", (route_name,)).fetchone()
    if not cb:
        cid = str(uuid.uuid4())
        with _conn_lock, _conn() as c:
            c.execute("""INSERT INTO circuit_breakers
                (id,timestamp,route_name,failure_threshold,timeout_seconds,
                 half_open_requests,state,failures)
                VALUES (?,?,?,?,?,?,?,?)""",
                (cid, _now(), route_name, failure_threshold, timeout_seconds,
                 3, "closed", 0 if success else 1))
        return {"state": "closed", "action": "initialized"}
    state = cb["state"]
    failures = cb["failures"]
    action = "none"
    if state == "closed":
        if not success:
            failures += 1
            if failures >= failure_threshold:
                state = "open"
                action = "tripped"
            with _conn_lock, _conn() as c:
                c.execute("""UPDATE circuit_breakers
                    SET failures = ?, state = ?, last_failure = ?
                    WHERE route_name = ?""",
                    (failures, state, _now(), route_name))
    elif state == "open":
        if time.time() - datetime.fromisoformat(cb["last_failure"].replace("Z", "+00:00")).timestamp() > timeout_seconds:
            state = "half_open"
            action = "half_open"
            with _conn_lock, _conn() as c:
                c.execute("""UPDATE circuit_breakers SET state = ?
                    WHERE route_name = ?""", (state, route_name))
    elif state == "half_open":
        if success:
            state = "closed"
            failures = 0
            action = "reset"
            with _conn_lock, _conn() as c:
                c.execute("""UPDATE circuit_breakers
                    SET state = ?, failures = ? WHERE route_name = ?""",
                    (state, failures, route_name))
        else:
            state = "open"
            action = "tripped"
            with _conn_lock, _conn() as c:
                c.execute("""UPDATE circuit_breakers
                    SET state = ?, last_failure = ? WHERE route_name = ?""",
                    (state, _now(), route_name))
    return {"state": state, "action": action, "failures": failures}


def create_gradient_route(route_name: str, gradient_type: str,
                           rules: List[Dict]) -> str:
    """创建灰度路由"""
    if gradient_type not in GRADIENT_TYPES:
        gradient_type = "canary"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO gradient_routes
            (id,timestamp,route_name,gradient_type,rules,traffic_pct,enabled)
            VALUES (?,?,?,?,?,?,?)""",
            (rid, _now(), route_name, gradient_type,
             json.dumps(rules, ensure_ascii=False), 100, 1))
    return rid


def evaluate_gradient(route_name: str, request_context: Dict) -> Dict[str, Any]:
    """评估灰度路由"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM gradient_routes
            WHERE route_name = ? AND enabled = 1""",
            (route_name,)).fetchone()
    if not row:
        return {"route": route_name, "target": "primary", "traffic_pct": 100}
    rules = json.loads(row["rules"] or "[]")
    gradient_type = row["gradient_type"]
    for rule in rules:
        if gradient_type == "canary":
            weight = rule.get("weight", 0)
            bucket = rule.get("bucket", "")
            tag = request_context.get("tag", "")
            if tag == bucket:
                return {"route": route_name, "target": "canary",
                        "weight": weight, "rule": rule}
        elif gradient_type == "ab_test":
            group = request_context.get("group", "A")
            if rule.get("group") == group:
                return {"route": route_name, "target": rule.get("upstream", "primary"),
                        "group": group}
    return {"route": route_name, "target": "primary",
            "traffic_pct": row["traffic_pct"]}


def record_traffic(route_name: str, request_id: str, method: str,
                    path: str, status_code: int, latency_ms: float) -> str:
    """记录流量"""
    tid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO traffic_records
            (id,timestamp,route_name,request_id,method,path,
             status_code,latency_ms,size_bytes,matched_route)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (tid, _now(), route_name, request_id, method, path,
             status_code, latency_ms, 0, route_name))
    return tid


def get_route_stats(route_name: str) -> Dict[str, Any]:
    """获取路由统计"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT status_code, COUNT(*) as cnt,
            AVG(latency_ms) as avg_latency
            FROM traffic_records
            WHERE route_name = ?
            GROUP BY status_code""", (route_name,)).fetchall()
        total = c.execute("""SELECT COUNT(*) as c FROM traffic_records
            WHERE route_name = ?""", (route_name,)).fetchone()["c"]
    status_dist = {str(r["status_code"]): r["cnt"] for r in rows}
    avg_latency = sum(r["avg_latency"] or 0 for r in rows) / len(rows) if rows else 0
    return {"route": route_name, "total_requests": total,
            "status_distribution": status_dist,
            "avg_latency_ms": round(avg_latency, 2)}


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "api_gateway"}, ensure_ascii=False) + "\n")


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
            self._json(200, {"status": "ok", "service": "api_gateway"})
        elif path.startswith("/api/routes/"):
            name = path[11:]
            with _conn_lock, _conn() as c:
                row = c.execute("""SELECT * FROM routes WHERE route_name = ?""",
                                  (name,)).fetchone()
            if row:
                self._json(200, {"route_name": row["route_name"],
                                 "path": row["path"],
                                 "upstream": row["upstream"],
                                 "methods": json.loads(row["methods"]),
                                 "plugins": json.loads(row["plugins"])})
            else:
                self._json(404, {"error": "not_found"})
        elif path == "/api/services":
            with _conn_lock, _conn() as c:
                rows = c.execute("SELECT * FROM services").fetchall()
            self._json(200, {"services": [dict(r) for r in rows]})
        elif path == "/api/consumers":
            with _conn_lock, _conn() as c:
                rows = c.execute("SELECT * FROM consumers").fetchall()
            self._json(200, {"consumers": [dict(r) for r in rows]})
        elif path.startswith("/api/stats/"):
            route = path[12:]
            self._json(200, get_route_stats(route))
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
        if path == "/api/route/create":
            rid = create_route(
                route_name=data.get("route_name", ""),
                path=data.get("path", "/"),
                upstream=data.get("upstream", "127.0.0.1:8000"),
                methods=data.get("methods"),
                plugins=data.get("plugins"),
                strip_path=data.get("strip_path", True),
            )
            self._json(201, {"id": rid})
        elif path == "/api/service/create":
            sid = create_service(
                service_name=data.get("service_name", ""),
                host=data.get("host", "127.0.0.1"),
                port=data.get("port", 8000),
                protocol=data.get("protocol", "http"),
            )
            self._json(201, {"id": sid})
        elif path == "/api/consumer/create":
            cid = create_consumer(
                consumer_id=data.get("consumer_id", ""),
                username=data.get("username", ""),
                auth_type=data.get("auth_type", "jwt"),
                credentials=data.get("credentials"),
            )
            self._json(201, {"id": cid})
        elif path == "/api/rate/check":
            result = check_rate_limit(
                route_name=data.get("route_name", ""),
                consumer_id=data.get("consumer_id", ""),
                limit_type=data.get("limit_type", "second"),
                limit_count=data.get("limit_count", 100),
                window_seconds=data.get("window_seconds", 60),
            )
            self._json(200, result)
        elif path == "/api/circuit/record":
            result = circuit_breaker_record(
                route_name=data.get("route_name", ""),
                success=data.get("success", True),
                failure_threshold=data.get("failure_threshold", 5),
                timeout_seconds=data.get("timeout_seconds", 30),
            )
            self._json(200, result)
        elif path == "/api/gradient/create":
            rid = create_gradient_route(
                route_name=data.get("route_name", ""),
                gradient_type=data.get("gradient_type", "canary"),
                rules=data.get("rules", []),
            )
            self._json(201, {"id": rid})
        elif path == "/api/gradient/evaluate":
            result = evaluate_gradient(
                route_name=data.get("route_name", ""),
                request_context=data.get("context", {}),
            )
            self._json(200, result)
        elif path == "/api/traffic/record":
            tid = record_traffic(
                route_name=data.get("route_name", ""),
                request_id=data.get("request_id", str(uuid.uuid4())),
                method=data.get("method", "GET"),
                path=data.get("path", "/"),
                status_code=data.get("status_code", 200),
                latency_ms=data.get("latency_ms", 0.0),
            )
            self._json(201, {"id": tid})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"API Gateway service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_route(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: route <name> <path> <upstream>")
        return
    rid = create_route(args[0], args[1], args[2])
    print(json.dumps({"id": rid}, ensure_ascii=False))


def cmd_service(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: service <name> <host> <port>")
        return
    sid = create_service(args[0], args[1], int(args[2]))
    print(json.dumps({"id": sid}, ensure_ascii=False))


def cmd_consumer(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: consumer <id> <username> [auth_type]")
        return
    auth = args[2] if len(args) > 2 else "jwt"
    cid = create_consumer(args[0], args[1], auth)
    print(json.dumps({"id": cid}, ensure_ascii=False))


def cmd_rate(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: rate <route> <consumer> <limit_count> [type]")
        return
    rtype = args[3] if len(args) > 3 else "second"
    print(json.dumps(check_rate_limit(args[0], args[1], rtype, int(args[2])),
                       ensure_ascii=False, indent=2))


def cmd_circuit(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: circuit <route> <success|failed>")
        return
    ok = args[1].lower() == "success"
    print(json.dumps(circuit_breaker_record(args[0], ok),
                       ensure_ascii=False, indent=2))


def cmd_gradient(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: gradient <route> <type> [rules_json]")
        return
    rules = json.loads(args[2]) if len(args) > 2 else []
    rid = create_gradient_route(args[0], args[1], rules)
    print(json.dumps({"id": rid}, ensure_ascii=False))


def cmd_eval_gradient(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: eval-gradient <route> [tag|group]")
        return
    ctx = {"tag": args[1]} if len(args) > 1 else {}
    print(json.dumps(evaluate_gradient(args[0], ctx),
                       ensure_ascii=False, indent=2))


def cmd_stats(args: List[str]) -> None:
    if not args:
        print("usage: stats <route_name>")
        return
    print(json.dumps(get_route_stats(args[0]), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "route": cmd_route, "service": cmd_service,
            "consumer": cmd_consumer, "rate": cmd_rate, "circuit": cmd_circuit,
            "gradient": cmd_gradient, "eval-gradient": cmd_eval_gradient,
            "stats": cmd_stats}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
全链路灰度发布
P0-23: OTel tag 传播, 灰度规则引擎, 自动回滚集成
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

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "gray_release.db")
HTTP_PORT = 10030

GRAY_TYPES = ["canary", "blue_green", "ab_test", "feature_flag", "shadow"]
RULE_OPERATORS = ["eq", "ne", "in", "not_in", "regex", "gt", "lt", "contains"]
GRAY_DIMENSIONS = ["tenant", "user", "region", "version", "header", "cookie",
                    "device", "platform", "tag"]
RELEASE_STAGES = ["init", "baseline", "canary_5", "canary_25", "canary_50",
                   "canary_100", "completed", "rolled_back", "paused"]
AUTO_ROLLBACK_THRESHOLDS = {
    "error_rate_pct": 5.0,
    "p99_latency_ms": 2000,
    "success_rate_pct": 95.0,
    "min_sample_size": 100,
}


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS releases (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            name TEXT NOT NULL UNIQUE,
            service TEXT,
            gray_type TEXT,
            stage TEXT,
            baseline_version TEXT,
            canary_version TEXT,
            rules TEXT,
            start_time TEXT,
            end_time TEXT,
            status TEXT DEFAULT 'active'
        );
        CREATE TABLE IF NOT EXISTS gray_rules (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            release_id TEXT,
            dimension TEXT,
            operator TEXT,
            match_values TEXT,
            weight INTEGER DEFAULT 100
        );
        CREATE TABLE IF NOT EXISTS tag_propagation (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            release_id TEXT,
            trace_id TEXT,
            service TEXT,
            tags TEXT,
            stage TEXT
        );
        CREATE TABLE IF NOT EXISTS gray_metrics (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            release_id TEXT,
            version TEXT,
            request_count INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            error_count INTEGER DEFAULT 0,
            p50_latency_ms REAL DEFAULT 0,
            p95_latency_ms REAL DEFAULT 0,
            p99_latency_ms REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS rollback_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            release_id TEXT,
            trigger_metric TEXT,
            trigger_value REAL,
            threshold_value REAL,
            reason TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_gray_metrics_release ON gray_metrics(release_id);
        CREATE INDEX IF NOT EXISTS idx_tag_propagation_trace ON tag_propagation(trace_id);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def evaluate_rule(dimension: str, operator: str, expected: List[str],
                  context: Dict[str, Any]) -> bool:
    """评估单条灰度规则"""
    value = context.get(dimension, "")
    if value is None:
        value = ""
    sval = str(value)
    if operator == "eq":
        return sval in expected
    if operator == "ne":
        return sval not in expected
    if operator == "in":
        return sval in expected
    if operator == "not_in":
        return sval not in expected
    if operator == "contains":
        return any(e in sval for e in expected)
    if operator == "regex":
        import re
        return any(re.match(e, sval) for e in expected)
    if operator == "gt":
        try:
            return float(sval) > float(expected[0])
        except (ValueError, IndexError):
            return False
    if operator == "lt":
        try:
            return float(sval) < float(expected[0])
        except (ValueError, IndexError):
            return False
    return False


def evaluate_release(rules: List[Dict[str, Any]], context: Dict[str, Any]) -> bool:
    """评估整个灰度规则集, 任何规则匹配则返回 True"""
    for r in rules:
        if evaluate_rule(r.get("dimension", ""), r.get("operator", "eq"),
                          r.get("values", []), context):
            return True
    return False


def create_release(name: str, service: str, gray_type: str,
                    baseline_version: str, canary_version: str,
                    rules: List[Dict[str, Any]]) -> str:
    """创建灰度发布"""
    if gray_type not in GRAY_TYPES:
        gray_type = "canary"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO releases
            (id,timestamp,name,service,gray_type,stage,
             baseline_version,canary_version,rules,start_time,status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), name, service, gray_type, "init",
             baseline_version, canary_version, json.dumps(rules),
             _now(), "active"))
        for r in rules:
            gr_id = str(uuid.uuid4())
            c.execute("""INSERT OR REPLACE INTO gray_rules
                (id,timestamp,release_id,dimension,operator,match_values,weight)
                VALUES (?,?,?,?,?,?,?)""",
                (gr_id, _now(), rid, r.get("dimension", ""),
                 r.get("operator", "eq"), json.dumps(r.get("values", [])),
                 r.get("weight", 100)))
    return rid


def advance_stage(release_id: str, target_stage: str) -> str:
    """推进灰度阶段"""
    if target_stage not in RELEASE_STAGES:
        target_stage = "canary_5"
    with _conn_lock, _conn() as c:
        c.execute("UPDATE releases SET stage = ? WHERE id = ?",
                   (target_stage, release_id))
    return target_stage


def get_release(release_id: str) -> Optional[Dict[str, Any]]:
    """获取发布详情"""
    with _conn_lock, _conn() as c:
        row = c.execute("SELECT * FROM releases WHERE id = ?",
                          (release_id,)).fetchone()
        if not row:
            return None
        rules = c.execute("SELECT * FROM gray_rules WHERE release_id = ?",
                            (release_id,)).fetchall()
    return {
        "id": row["id"], "name": row["name"], "service": row["service"],
        "gray_type": row["gray_type"], "stage": row["stage"],
        "baseline_version": row["baseline_version"],
        "canary_version": row["canary_version"],
        "rules": [{"dimension": r["dimension"], "operator": r["operator"],
                    "values": json.loads(r["match_values"] or "[]"),
                    "weight": r["weight"]} for r in rules],
        "status": row["status"],
    }


def propagate_tag(release_id: str, trace_id: str, service: str,
                   tags: Dict[str, str], stage: str) -> str:
    """OTel tag 传播"""
    tid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO tag_propagation
            (id,timestamp,release_id,trace_id,service,tags,stage)
            VALUES (?,?,?,?,?,?,?)""",
            (tid, _now(), release_id, trace_id, service,
             json.dumps(tags), stage))
    return tid


def should_route_to_canary(context: Dict[str, Any], rules: List[Dict[str, Any]],
                            weight: int = 100) -> bool:
    """决定请求是否路由到 canary"""
    import random
    if not rules:
        return random.randint(1, 100) <= weight
    matched = evaluate_release(rules, context)
    if not matched:
        return False
    return random.randint(1, 100) <= weight


def record_metric(release_id: str, version: str, request_count: int,
                   success_count: int, error_count: int,
                   p50: float, p95: float, p99: float) -> str:
    """记录灰度指标"""
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO gray_metrics
            (id,timestamp,release_id,version,request_count,success_count,
             error_count,p50_latency_ms,p95_latency_ms,p99_latency_ms)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (mid, _now(), release_id, version, request_count, success_count,
             error_count, p50, p95, p99))
    return mid


def get_release_metrics(release_id: str) -> Dict[str, Any]:
    """获取发布指标"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT version,
            SUM(request_count) as total_req,
            SUM(success_count) as total_succ,
            SUM(error_count) as total_err,
            AVG(p50_latency_ms) as avg_p50,
            AVG(p95_latency_ms) as avg_p95,
            AVG(p99_latency_ms) as avg_p99
            FROM gray_metrics WHERE release_id = ?
            GROUP BY version""", (release_id,)).fetchall()
    result = {}
    for r in rows:
        total = r["total_req"] or 0
        succ = r["total_succ"] or 0
        err = r["total_err"] or 0
        result[r["version"]] = {
            "total_requests": total,
            "success_count": succ,
            "error_count": err,
            "success_rate": round(succ / total * 100, 2) if total else 0.0,
            "error_rate": round(err / total * 100, 2) if total else 0.0,
            "p50_ms": round(r["avg_p50"] or 0, 2),
            "p95_ms": round(r["avg_p95"] or 0, 2),
            "p99_ms": round(r["avg_p99"] or 0, 2),
        }
    return result


def check_auto_rollback(release_id: str) -> Optional[Dict[str, Any]]:
    """检查是否需要自动回滚"""
    metrics = get_release_metrics(release_id)
    canary = metrics.get("canary", {})
    if not canary:
        return None
    if canary.get("total_requests", 0) < AUTO_ROLLBACK_THRESHOLDS["min_sample_size"]:
        return None
    triggers = []
    if canary.get("error_rate", 0) > AUTO_ROLLBACK_THRESHOLDS["error_rate_pct"]:
        triggers.append({
            "metric": "error_rate_pct",
            "value": canary["error_rate"],
            "threshold": AUTO_ROLLBACK_THRESHOLDS["error_rate_pct"],
        })
    if canary.get("p99_ms", 0) > AUTO_ROLLBACK_THRESHOLDS["p99_latency_ms"]:
        triggers.append({
            "metric": "p99_latency_ms",
            "value": canary["p99_ms"],
            "threshold": AUTO_ROLLBACK_THRESHOLDS["p99_latency_ms"],
        })
    if canary.get("success_rate", 100) < AUTO_ROLLBACK_THRESHOLDS["success_rate_pct"]:
        triggers.append({
            "metric": "success_rate_pct",
            "value": canary["success_rate"],
            "threshold": AUTO_ROLLBACK_THRESHOLDS["success_rate_pct"],
        })
    if not triggers:
        return None
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO rollback_events
            (id,timestamp,release_id,trigger_metric,trigger_value,
             threshold_value,reason)
            VALUES (?,?,?,?,?,?,?)""",
            (rid, _now(), release_id, triggers[0]["metric"],
             triggers[0]["value"], triggers[0]["threshold"],
             f"Auto rollback triggered by {len(triggers)} threshold(s)"))
        c.execute("""UPDATE releases SET stage = 'rolled_back', status = 'rolled_back'
            WHERE id = ?""", (release_id,))
    return {"rolled_back": True, "release_id": release_id, "triggers": triggers}


def list_active_releases() -> List[Dict[str, Any]]:
    """列出活跃发布"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT id, name, service, gray_type, stage,
            start_time FROM releases WHERE status = 'active' ORDER BY timestamp DESC""").fetchall()
    return [dict(r) for r in rows]


def _send_dingtalk(title: str, content: str) -> None:
    """发送钉钉告警 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "title": title, "content": content,
            "source": "gray_release",
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
        if path == "/health":
            self._json(200, {"status": "ok", "service": "gray_release"})
        elif path == "/api/release/active":
            self._json(200, {"releases": list_active_releases()})
        elif path.startswith("/api/release/") and len(path) > 14:
            rid = path[14:]
            r = get_release(rid)
            if r:
                r["metrics"] = get_release_metrics(rid)
                self._json(200, r)
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
        if path == "/api/release/create":
            rid = create_release(
                name=data.get("name", ""),
                service=data.get("service", ""),
                gray_type=data.get("gray_type", "canary"),
                baseline_version=data.get("baseline_version", "v1"),
                canary_version=data.get("canary_version", "v2"),
                rules=data.get("rules", []),
            )
            self._json(201, {"id": rid})
        elif path == "/api/release/advance":
            stage = advance_stage(data.get("release_id", ""),
                                    data.get("target_stage", "canary_5"))
            self._json(200, {"stage": stage})
        elif path == "/api/rule/evaluate":
            matched = evaluate_rule(
                data.get("dimension", ""),
                data.get("operator", "eq"),
                data.get("values", []),
                data.get("context", {}),
            )
            self._json(200, {"matched": matched})
        elif path == "/api/release/evaluate":
            matched = evaluate_release(data.get("rules", []),
                                        data.get("context", {}))
            self._json(200, {"matched": matched})
        elif path == "/api/route/canary":
            routed = should_route_to_canary(
                data.get("context", {}),
                data.get("rules", []),
                data.get("weight", 100),
            )
            self._json(200, {"to_canary": routed})
        elif path == "/api/tag/propagate":
            tid = propagate_tag(
                release_id=data.get("release_id", ""),
                trace_id=data.get("trace_id", ""),
                service=data.get("service", ""),
                tags=data.get("tags", {}),
                stage=data.get("stage", "init"),
            )
            self._json(201, {"id": tid})
        elif path == "/api/metric/record":
            mid = record_metric(
                release_id=data.get("release_id", ""),
                version=data.get("version", "canary"),
                request_count=data.get("request_count", 0),
                success_count=data.get("success_count", 0),
                error_count=data.get("error_count", 0),
                p50=data.get("p50", 0),
                p95=data.get("p95", 0),
                p99=data.get("p99", 0),
            )
            self._json(201, {"id": mid})
        elif path == "/api/rollback/check":
            result = check_auto_rollback(data.get("release_id", ""))
            self._json(200, result or {"rolled_back": False})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Gray Release service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_create(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: create <name> <service> <baseline> <canary> [type]")
        return
    name, service, baseline, canary = args[0], args[1], args[2], args[3]
    gtype = args[4] if len(args) > 4 else "canary"
    rid = create_release(name, service, gtype, baseline, canary, [])
    print(json.dumps({"id": rid, "name": name}, ensure_ascii=False))


def cmd_advance(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: advance <release_id> <target_stage>")
        return
    stage = advance_stage(args[0], args[1])
    print(json.dumps({"stage": stage}, ensure_ascii=False))


def cmd_evaluate(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: evaluate <dimension> <operator> <values_csv> <context_json>")
        return
    values = args[2].split(",")
    context = json.loads(args[3])
    matched = evaluate_rule(args[0], args[1], values, context)
    print(json.dumps({"matched": matched}, ensure_ascii=False))


def cmd_release_eval(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: release-eval <rules_json> <context_json>")
        return
    rules = json.loads(args[0])
    context = json.loads(args[1])
    matched = evaluate_release(rules, context)
    print(json.dumps({"matched": matched}, ensure_ascii=False))


def cmd_route(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: route <rules_json> <context_json> [weight]")
        return
    rules = json.loads(args[0])
    context = json.loads(args[1])
    weight = int(args[2]) if len(args) > 2 else 100
    routed = should_route_to_canary(context, rules, weight)
    print(json.dumps({"to_canary": routed}, ensure_ascii=False))


def cmd_tag_propagate(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: tag-propagate <release_id> <trace_id> <service> <tags_json> [stage]")
        return
    tags = json.loads(args[3]) if len(args) > 3 else {}
    stage = args[4] if len(args) > 4 else "init"
    tid = propagate_tag(args[0], args[1], args[2], tags, stage)
    print(json.dumps({"id": tid}, ensure_ascii=False))


def cmd_record(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: record <release_id> <version> <request_count> [success] [error]")
        return
    rid = args[0]
    version = args[1]
    rc = int(args[2])
    sc = int(args[3]) if len(args) > 3 else rc
    ec = int(args[4]) if len(args) > 4 else 0
    mid = record_metric(rid, version, rc, sc, ec, 50.0, 150.0, 300.0)
    print(json.dumps({"id": mid}, ensure_ascii=False))


def cmd_metrics(args: List[str]) -> None:
    if not args:
        print("usage: metrics <release_id>")
        return
    print(json.dumps(get_release_metrics(args[0]), ensure_ascii=False, indent=2))


def cmd_rollback_check(args: List[str]) -> None:
    if not args:
        print("usage: rollback-check <release_id>")
        return
    result = check_auto_rollback(args[0])
    print(json.dumps(result or {"rolled_back": False}, ensure_ascii=False))


def cmd_active(_args: List[str]) -> None:
    print(json.dumps(list_active_releases(), ensure_ascii=False, indent=2))


def cmd_get(args: List[str]) -> None:
    if not args:
        print("usage: get <release_id>")
        return
    r = get_release(args[0])
    if r:
        r["metrics"] = get_release_metrics(args[0])
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print("not found")


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "create": cmd_create, "advance": cmd_advance,
        "evaluate": cmd_evaluate, "release-eval": cmd_release_eval,
        "route": cmd_route, "tag-propagate": cmd_tag_propagate,
        "record": cmd_record, "metrics": cmd_metrics,
        "rollback-check": cmd_rollback_check, "active": cmd_active,
        "get": cmd_get,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

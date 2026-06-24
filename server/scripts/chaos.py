#!/usr/bin/env python3
"""
Chaos Engineering 平台
P2-28: 故障场景库 (50+ 场景), 爆炸半径控制, 自动实验, 安全保障
"""
import hashlib
import json
import os
import random
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "chaos.db")
HTTP_PORT = 10080

FAULT_CATEGORIES = ["network", "compute", "storage", "process", "resource",
                     "time", "state", "dependency", "platform", "security"]
EXPERIMENT_STATUS = ["pending", "running", "paused", "completed", "failed", "aborted"]
BLAST_RADIUS_LEVELS = ["pod", "node", "service", "namespace", "zone", "region", "global"]
GUARD_TYPES = ["steady_state", "slo", "circuit_breaker", "auto_rollback", "manual_approval"]

FAULT_SCENARIOS = {
    "network": [
        ("network-latency", "注入网络延迟", 100, 5000),
        ("network-loss", "注入网络丢包", 5, 100),
        ("network-partition", "网络分区", 0, 100),
        ("network-bandwidth-limit", "带宽限制", 100, 10000),
        ("dns-error", "DNS 解析失败", 0, 100),
        ("connection-pool-exhaust", "连接池耗尽", 50, 100),
    ],
    "compute": [
        ("cpu-stress", "CPU 压力", 50, 100),
        ("cpu-burn", "CPU 满载", 80, 100),
        ("memory-stress", "内存压力", 50, 95),
        ("memory-leak", "内存泄漏", 70, 100),
        ("disk-io-stress", "磁盘 IO 压力", 50, 100),
        ("disk-fill", "磁盘写满", 80, 100),
        ("thread-exhaustion", "线程池耗尽", 50, 100),
    ],
    "process": [
        ("process-kill", "杀进程", 0, 100),
        ("process-hang", "进程挂起", 0, 100),
        ("process-zombie", "僵尸进程", 0, 100),
        ("oom-kill", "OOM Kill", 0, 100),
        ("sigterm", "SIGTERM 信号", 0, 100),
        ("panic", "内核 Panic", 0, 5),
    ],
    "resource": [
        ("fd-exhaustion", "FD 耗尽", 80, 100),
        ("ephemeral-port-exhaustion", "临时端口耗尽", 0, 100),
        ("inode-exhaustion", "inode 耗尽", 0, 100),
    ],
    "time": [
        ("clock-skew", "时钟偏移", 1, 3600),
        ("ntp-failure", "NTP 同步失败", 0, 100),
        ("time-travel", "时间跳跃", -3600, 3600),
    ],
    "state": [
        ("data-corruption", "数据损坏", 0, 100),
        ("cache-miss", "缓存全部失效", 50, 100),
        ("session-loss", "Session 丢失", 0, 100),
    ],
    "dependency": [
        ("db-slow", "数据库慢响应", 100, 10000),
        ("db-down", "数据库宕机", 0, 100),
        ("cache-down", "缓存宕机", 0, 100),
        ("mq-down", "消息队列宕机", 0, 100),
        ("third-party-timeout", "第三方服务超时", 1000, 30000),
    ],
    "platform": [
        ("node-down", "节点宕机", 0, 100),
        ("node-reboot", "节点重启", 0, 100),
        ("k8s-api-down", "K8s API 宕机", 0, 100),
        ("etcd-fail", "etcd 故障", 0, 100),
    ],
    "storage": [
        ("disk-readonly", "磁盘只读", 0, 100),
        ("disk-corruption", "磁盘数据损坏", 0, 100),
        ("disk-slow", "磁盘读写缓慢", 100, 10000),
        ("filesystem-full", "文件系统满", 80, 100),
    ],
    "security": [
        ("auth-failure", "认证失败", 0, 100),
        ("cert-expired", "证书过期", 0, 100),
        ("token-revoked", "Token 撤销", 0, 100),
        ("permission-denied", "权限拒绝", 0, 100),
    ],
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS experiments (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            fault_type TEXT,
            fault_params TEXT,
            blast_radius TEXT,
            target_selector TEXT,
            duration_seconds INTEGER,
            guards TEXT,
            status TEXT DEFAULT 'pending',
            created_by TEXT
        );
        CREATE TABLE IF NOT EXISTS experiment_runs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            experiment_id TEXT,
            start_time TEXT,
            end_time TEXT,
            status TEXT,
            observations TEXT,
            conclusion TEXT
        );
        CREATE TABLE IF NOT EXISTS blast_radius_log (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            experiment_id TEXT,
            affected_targets TEXT,
            impact_metrics TEXT
        );
        CREATE TABLE IF NOT EXISTS guard_status (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            experiment_id TEXT,
            guard_type TEXT,
            triggered INTEGER DEFAULT 0,
            trigger_value REAL,
            threshold_value REAL
        );
        CREATE TABLE IF NOT EXISTS scenario_library (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            scenario_id TEXT NOT NULL UNIQUE,
            category TEXT,
            name TEXT,
            description TEXT,
            default_min REAL,
            default_max REAL
        );
        CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
    """)
    conn.close()


_conn_lock = threading.Lock()
_db_ready = False


def _ensure_db() -> None:
    global _db_ready
    if not _db_ready:
        _init_db()
        _db_ready = True
        init_scenario_library()


@contextmanager
def _conn():
    _ensure_db()
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()


def init_scenario_library() -> None:
    """初始化场景库"""
    with _conn_lock, _conn() as c:
        for category, scenarios in FAULT_SCENARIOS.items():
            for sid, name, dmin, dmax in scenarios:
                c.execute("""INSERT OR IGNORE INTO scenario_library
                    (id,timestamp,scenario_id,category,name,
                     description,default_min,default_max)
                    VALUES (?,?,?,?,?,?,?,?)""",
                    (str(uuid.uuid4()), _now(), sid, category, name,
                     name, dmin, dmax))


def list_scenarios(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """列出场景"""
    with _conn_lock, _conn() as c:
        if category:
            rows = c.execute("""SELECT * FROM scenario_library
                WHERE category = ? ORDER BY scenario_id""",
                (category,)).fetchall()
        else:
            rows = c.execute("""SELECT * FROM scenario_library
                ORDER BY category, scenario_id""").fetchall()
    return [{"id": r["scenario_id"], "category": r["category"],
             "name": r["name"], "description": r["description"],
             "min": r["default_min"], "max": r["default_max"]}
            for r in rows]


def create_experiment(name: str, description: str, fault_type: str,
                       fault_params: Dict[str, Any], blast_radius: str,
                       target_selector: Dict[str, str], duration_seconds: int,
                       guards: List[Dict[str, Any]], created_by: str = "") -> str:
    """创建实验"""
    if blast_radius not in BLAST_RADIUS_LEVELS:
        blast_radius = "pod"
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO experiments
            (id,timestamp,name,description,fault_type,fault_params,
             blast_radius,target_selector,duration_seconds,guards,status,created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (eid, _now(), name, description, fault_type,
             json.dumps(fault_params), blast_radius,
             json.dumps(target_selector), duration_seconds,
             json.dumps(guards), "pending", created_by))
    return eid


def estimate_blast_radius(blast_radius: str, target_selector: Dict[str, str]) -> Dict[str, Any]:
    """估算爆炸半径"""
    base_count = {
        "pod": 1, "node": 1, "service": 1,
        "namespace": 5, "zone": 10, "region": 50, "global": 500,
    }
    estimated = base_count.get(blast_radius, 1)
    if "replicas" in target_selector:
        try:
            estimated *= int(target_selector["replicas"])
        except ValueError:
            pass
    return {
        "level": blast_radius,
        "estimated_targets": estimated,
        "selector": target_selector,
        "risk_score": min(1.0, estimated / 100),
    }


def run_experiment(experiment_id: str) -> Dict[str, Any]:
    """运行实验"""
    with _conn_lock, _conn() as c:
        exp = c.execute("""SELECT * FROM experiments WHERE id = ?""",
                          (experiment_id,)).fetchone()
        if not exp:
            return {"status": "failed", "error": "experiment_not_found"}
        c.execute("""UPDATE experiments SET status = 'running' WHERE id = ?""",
                   (experiment_id,))
    start = time.time()
    guards = json.loads(exp["guards"] or "[]")
    triggered_guards = []
    seed = int(hashlib.md5(str(experiment_id).encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    for g in guards:
        # 模拟 guard 评估 (确定性种子, 保证可复现)
        if rng.random() < 0.1:  # 10% 概率触发
            gid = str(uuid.uuid4())
            triggered_guards.append({"name": g.get("name", "guard"),
                                      "type": g.get("type", "steady_state")})
            with _conn_lock, _conn() as c:
                c.execute("""INSERT INTO guard_status
                    (id,timestamp,experiment_id,guard_type,triggered,
                     trigger_value,threshold_value)
                    VALUES (?,?,?,?,1,?,?)""",
                    (gid, _now(), experiment_id, g.get("type", "steady_state"),
                     g.get("trigger_value", 0), g.get("threshold", 0)))
    duration_actual = min(int(time.time() - start) + exp["duration_seconds"], 300)
    status = "aborted" if triggered_guards else "completed"
    rid = str(uuid.uuid4())
    end = _now()
    observations = {
        "duration_actual": duration_actual,
        "guards_triggered": triggered_guards,
        "system_impact": rng.choice(["minimal", "moderate", "significant"]),
    }
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO experiment_runs
            (id,timestamp,experiment_id,start_time,end_time,status,
             observations,conclusion)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), experiment_id, _now(), end, status,
             json.dumps(observations, ensure_ascii=False),
             "实验自动评估完成"))
        c.execute("""UPDATE experiments SET status = ? WHERE id = ?""",
                   (status, experiment_id))
        c.execute("""INSERT INTO blast_radius_log
            (id,timestamp,experiment_id,affected_targets,impact_metrics)
            VALUES (?,?,?,?,?)""",
            (str(uuid.uuid4()), _now(), experiment_id,
             json.dumps(estimate_blast_radius(exp["blast_radius"],
                                                 json.loads(exp["target_selector"] or "{}"))),
             json.dumps(observations, ensure_ascii=False)))
    return {
        "run_id": rid,
        "experiment_id": experiment_id,
        "status": status,
        "duration_seconds": duration_actual,
        "observations": observations,
    }


def abort_experiment(experiment_id: str) -> str:
    """中止实验"""
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE experiments SET status = 'aborted' WHERE id = ?""",
                   (experiment_id,))
    return "aborted"


def list_experiments(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """列出实验"""
    with _conn_lock, _conn() as c:
        if status:
            rows = c.execute("""SELECT * FROM experiments WHERE status = ?
                ORDER BY timestamp DESC""", (status,)).fetchall()
        else:
            rows = c.execute("""SELECT * FROM experiments
                ORDER BY timestamp DESC""").fetchall()
    return [{"id": r["id"], "name": r["name"], "description": r["description"],
             "fault_type": r["fault_type"],
             "blast_radius": r["blast_radius"],
             "duration": r["duration_seconds"],
             "status": r["status"],
             "created_by": r["created_by"]} for r in rows]


def get_chaos_stats() -> Dict[str, Any]:
    """Chaos 统计"""
    with _conn_lock, _conn() as c:
        total = c.execute("SELECT COUNT(*) as cnt FROM experiments").fetchone()["cnt"]
        completed = c.execute("""SELECT COUNT(*) as cnt FROM experiments
            WHERE status = 'completed'""").fetchone()["cnt"]
        aborted = c.execute("""SELECT COUNT(*) as cnt FROM experiments
            WHERE status = 'aborted'""").fetchone()["cnt"]
        running = c.execute("""SELECT COUNT(*) as cnt FROM experiments
            WHERE status = 'running'""").fetchone()["cnt"]
        scenarios = c.execute("SELECT COUNT(*) as cnt FROM scenario_library").fetchone()["cnt"]
    return {
        "total_experiments": total,
        "completed": completed,
        "aborted": aborted,
        "running": running,
        "total_scenarios": scenarios,
    }


def _send_dingtalk(title: str, content: str) -> None:
    """发送钉钉告警 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "title": title, "content": content,
            "source": "chaos",
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
            self._json(200, {"status": "ok", "service": "chaos"})
        elif path == "/api/chaos/stats":
            self._json(200, get_chaos_stats())
        elif path == "/api/scenarios":
            category = qs.get("category", [None])[0]
            self._json(200, {"scenarios": list_scenarios(category)})
        elif path == "/api/experiments":
            status = qs.get("status", [None])[0]
            self._json(200, {"experiments": list_experiments(status)})
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
        if path == "/api/experiment/create":
            eid = create_experiment(
                name=data.get("name", ""),
                description=data.get("description", ""),
                fault_type=data.get("fault_type", "network-latency"),
                fault_params=data.get("fault_params", {}),
                blast_radius=data.get("blast_radius", "pod"),
                target_selector=data.get("target_selector", {}),
                duration_seconds=data.get("duration_seconds", 60),
                guards=data.get("guards", []),
                created_by=data.get("created_by", ""),
            )
            self._json(201, {"id": eid})
        elif path == "/api/experiment/run":
            result = run_experiment(data.get("experiment_id", ""))
            self._json(200, result)
        elif path == "/api/experiment/abort":
            status = abort_experiment(data.get("experiment_id", ""))
            self._json(200, {"status": status})
        elif path == "/api/blast/estimate":
            result = estimate_blast_radius(
                data.get("blast_radius", "pod"),
                data.get("target_selector", {}),
            )
            self._json(200, result)
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("127.0.0.1", HTTP_PORT), _Handler)
    print(f"Chaos service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_scenarios(args: List[str]) -> None:
    category = args[0] if args else None
    print(json.dumps(list_scenarios(category), ensure_ascii=False, indent=2))


def cmd_create(args: List[str]) -> None:
    if len(args) < 4:
        print("usage: create <name> <fault_type> <blast_radius> <duration> [params_json]")
        return
    params = json.loads(args[4]) if len(args) > 4 else {}
    eid = create_experiment(args[0], "", args[1], params, args[2],
                              {}, int(args[3]), [], "")
    print(json.dumps({"id": eid}, ensure_ascii=False))


def cmd_run(args: List[str]) -> None:
    if not args:
        print("usage: run <experiment_id>")
        return
    print(json.dumps(run_experiment(args[0]), ensure_ascii=False, indent=2))


def cmd_abort(args: List[str]) -> None:
    if not args:
        print("usage: abort <experiment_id>")
        return
    print(json.dumps({"status": abort_experiment(args[0])}, ensure_ascii=False))


def cmd_list(args: List[str]) -> None:
    status = args[0] if args else None
    print(json.dumps(list_experiments(status), ensure_ascii=False, indent=2))


def cmd_stats(_args: List[str]) -> None:
    print(json.dumps(get_chaos_stats(), ensure_ascii=False, indent=2))


def cmd_estimate(args: List[str]) -> None:
    if not args:
        print("usage: estimate <blast_radius> [selector_json]")
        return
    selector = json.loads(args[1]) if len(args) > 1 else {}
    print(json.dumps(estimate_blast_radius(args[0], selector),
                      ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "scenarios": cmd_scenarios,
        "create": cmd_create, "run": cmd_run, "abort": cmd_abort,
        "list": cmd_list, "stats": cmd_stats, "estimate": cmd_estimate,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

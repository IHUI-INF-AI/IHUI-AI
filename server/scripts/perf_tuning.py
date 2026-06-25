#!/usr/bin/env python3
"""
自动化性能调优
P1-26: PostgreSQL 参数调优, 连接池大小动态调整, 索引自动推荐, 查询计划分析
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
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "perf_tuning.db")
HTTP_PORT = 10060

PG_PARAMS = [
    "shared_buffers", "work_mem", "maintenance_work_mem", "effective_cache_size",
    "max_connections", "random_page_cost", "effective_io_concurrency",
    "max_worker_processes", "max_parallel_workers", "wal_buffers",
    "checkpoint_completion_target", "default_statistics_target",
]
WORKLOAD_TYPES = ["oltp", "olap", "mixed", "write_heavy", "read_heavy"]
INDEX_TYPES = ["btree", "hash", "gin", "gist", "brin", "partial"]
PLAN_OPS = ["SeqScan", "IndexScan", "IndexOnlyScan", "HashJoin", "NestedLoop",
             "MergeJoin", "Sort", "Aggregate", "Limit", "Append"]


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS pg_params (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            param_name TEXT NOT NULL,
            original_value TEXT,
            new_value TEXT,
            workload_type TEXT,
            reason TEXT,
            applied INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS pool_config (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            service TEXT NOT NULL,
            min_size INTEGER,
            max_size INTEGER,
            current_size INTEGER,
            target_size INTEGER,
            reason TEXT
        );
        CREATE TABLE IF NOT EXISTS index_recommendations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            table_name TEXT NOT NULL,
            columns TEXT,
            index_type TEXT,
            estimated_improvement REAL,
            reason TEXT,
            sql_ddl TEXT,
            applied INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS query_plans (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            query_hash TEXT NOT NULL,
            query_sql TEXT,
            plan_json TEXT,
            execution_time_ms REAL,
            rows_examined INTEGER,
            plan_cost REAL
        );
        CREATE TABLE IF NOT EXISTS tuning_history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            action_type TEXT,
            target TEXT,
            before_value TEXT,
            after_value TEXT,
            performance_delta REAL,
            success INTEGER DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_pg_params_name ON pg_params(param_name);
        CREATE INDEX IF NOT EXISTS idx_query_plans_hash ON query_plans(query_hash);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def recommend_pg_params(workload_type: str) -> Dict[str, Any]:
    """根据工作负载类型推荐 PG 参数"""
    if workload_type not in WORKLOAD_TYPES:
        workload_type = "mixed"
    recommendations = {
        "oltp": {
            "shared_buffers": "256MB",
            "work_mem": "16MB",
            "maintenance_work_mem": "256MB",
            "effective_cache_size": "1GB",
            "max_connections": 200,
            "random_page_cost": 1.1,
            "wal_buffers": "16MB",
        },
        "olap": {
            "shared_buffers": "1GB",
            "work_mem": "128MB",
            "maintenance_work_mem": "1GB",
            "effective_cache_size": "4GB",
            "max_connections": 50,
            "random_page_cost": 1.0,
            "max_parallel_workers": 8,
        },
        "mixed": {
            "shared_buffers": "512MB",
            "work_mem": "64MB",
            "maintenance_work_mem": "512MB",
            "effective_cache_size": "2GB",
            "max_connections": 100,
            "random_page_cost": 1.0,
        },
        "write_heavy": {
            "shared_buffers": "512MB",
            "wal_buffers": "32MB",
            "checkpoint_completion_target": 0.9,
            "max_wal_size": "4GB",
        },
        "read_heavy": {
            "shared_buffers": "2GB",
            "effective_cache_size": "6GB",
            "random_page_cost": 1.0,
            "effective_io_concurrency": 200,
        },
    }
    return {"workload_type": workload_type,
            "recommendations": recommendations[workload_type]}


def apply_pg_param(param_name: str, new_value: str, workload_type: str,
                     reason: str = "") -> str:
    """应用 PG 参数"""
    if param_name not in PG_PARAMS:
        param_name = "shared_buffers"
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO pg_params
            (id,timestamp,param_name,original_value,new_value,workload_type,reason,applied)
            VALUES (?,?,?,?,?,?,?,0)""",
            (pid, _now(), param_name, "", new_value, workload_type, reason))
    return pid


def get_pg_recommendations(workload_type: str) -> List[Dict[str, Any]]:
    """获取 PG 参数推荐"""
    rec = recommend_pg_params(workload_type)
    return [{"param": k, "value": v, "workload": workload_type}
            for k, v in rec["recommendations"].items()]


def calculate_pool_size(current_load: float, avg_latency_ms: float,
                         target_latency_ms: float = 100.0) -> Dict[str, Any]:
    """动态计算连接池大小"""
    if avg_latency_ms <= 0:
        return {"min": 5, "max": 20, "target": 10, "reason": "invalid_latency"}
    load_factor = current_load / 100.0
    if avg_latency_ms > target_latency_ms:
        target_size = max(5, int(10 * (1 + load_factor * 2)))
        reason = "high_latency_expansion"
    else:
        target_size = max(5, int(10 * (1 + load_factor * 0.5)))
        reason = "normal_load"
    target_size = min(target_size, 200)
    return {"min": 5, "max": max(20, target_size * 2),
            "target": target_size, "reason": reason}


def update_pool_config(service: str, current_size: int, target_size: int,
                        reason: str = "") -> str:
    """更新连接池配置"""
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO pool_config
            (id,timestamp,service,min_size,max_size,current_size,target_size,reason)
            VALUES (?,?,?,?,?,?,?,?)""",
            (pid, _now(), service, 5, max(20, target_size * 2),
             current_size, target_size, reason))
    return pid


def recommend_index(table_name: str, columns: List[str],
                     query_pattern: str = "", estimated_rows: int = 0) -> Dict[str, Any]:
    """推荐索引"""
    cols_str = ",".join(columns)
    index_type = "btree"
    if any("LIKE '%...%'" in query_pattern for _ in [1]):
        index_type = "gin"
    if len(columns) == 1 and "=" in query_pattern:
        index_type = "btree"
    elif len(columns) > 1:
        index_type = "btree"  # 复合索引
    if "WHERE" in query_pattern and "LIKE" in query_pattern:
        index_type = "gin"
    estimated_improvement = 0.0
    if estimated_rows > 100000:
        estimated_improvement = 0.7
    elif estimated_rows > 10000:
        estimated_improvement = 0.5
    elif estimated_rows > 1000:
        estimated_improvement = 0.3
    else:
        estimated_improvement = 0.1
    ddl = f"CREATE INDEX CONCURRENTLY idx_{table_name}_{cols_str.replace(',', '_')} ON {table_name} ({cols_str})"
    return {
        "table": table_name,
        "columns": columns,
        "index_type": index_type,
        "estimated_improvement": round(estimated_improvement, 2),
        "ddl": ddl,
        "reason": f"rows={estimated_rows}, pattern={query_pattern[:50]}",
    }


def save_index_recommendation(table_name: str, columns: List[str],
                                index_type: str, estimated_improvement: float,
                                reason: str, sql_ddl: str) -> str:
    """保存索引推荐"""
    if index_type not in INDEX_TYPES:
        index_type = "btree"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO index_recommendations
            (id,timestamp,table_name,columns,index_type,
             estimated_improvement,reason,sql_ddl,applied)
            VALUES (?,?,?,?,?,?,?,?,0)""",
            (rid, _now(), table_name, ",".join(columns), index_type,
             estimated_improvement, reason, sql_ddl))
    return rid


def list_index_recommendations(applied: Optional[bool] = None) -> List[Dict[str, Any]]:
    """列出索引推荐"""
    sql = "SELECT * FROM index_recommendations"
    params: List[Any] = []
    if applied is not None:
        sql += " WHERE applied = ?"
        params.append(1 if applied else 0)
    sql += " ORDER BY estimated_improvement DESC"
    with _conn_lock, _conn() as c:
        rows = c.execute(sql, params).fetchall()
    return [{"id": r["id"], "table": r["table_name"],
             "columns": r["columns"].split(","),
             "type": r["index_type"],
             "improvement": r["estimated_improvement"],
             "reason": r["reason"],
             "ddl": r["sql_ddl"],
             "applied": bool(r["applied"])} for r in rows]


def analyze_query_plan(query_sql: str, plan: Dict[str, Any],
                        execution_time_ms: float) -> Dict[str, Any]:
    """分析查询计划"""
    query_hash = str(hash(query_sql) & 0xFFFFFFFF)
    issues = []
    plan_str = json.dumps(plan)
    if "SeqScan" in plan_str:
        issues.append("检测到全表扫描, 建议添加索引")
    if "NestedLoop" in plan_str and plan.get("NestedLoop", {}).get("rows", 0) > 10000:
        issues.append("NestedLoop 处理大量行, 建议使用 HashJoin")
    if execution_time_ms > 1000:
        issues.append("查询耗时过长, 需优化")
    if "Sort" in plan_str and "IndexScan" not in plan_str:
        issues.append("存在排序操作, 但无索引扫描, 建议添加索引")
    qid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO query_plans
            (id,timestamp,query_hash,query_sql,plan_json,
             execution_time_ms,rows_examined,plan_cost)
            VALUES (?,?,?,?,?,?,?,?)""",
            (qid, _now(), query_hash, query_sql,
             json.dumps(plan, ensure_ascii=False), execution_time_ms,
             plan.get("rows_examined", 0), plan.get("cost", 0.0)))
    return {
        "query_hash": query_hash,
        "issues": issues,
        "execution_time_ms": execution_time_ms,
        "plan_cost": plan.get("cost", 0.0),
    }


def get_slow_queries(threshold_ms: float = 1000.0,
                      limit: int = 50) -> List[Dict[str, Any]]:
    """获取慢查询"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT query_hash, query_sql, execution_time_ms,
            plan_cost, MAX(timestamp) as last_seen
            FROM query_plans WHERE execution_time_ms >= ?
            GROUP BY query_hash ORDER BY execution_time_ms DESC LIMIT ?""",
            (threshold_ms, limit)).fetchall()
    return [{"query_hash": r["query_hash"], "query_sql": r["query_sql"],
             "execution_time_ms": r["execution_time_ms"],
             "plan_cost": r["plan_cost"], "last_seen": r["last_seen"]}
            for r in rows]


def record_tuning_action(action_type: str, target: str, before: str,
                          after: str, performance_delta: float) -> str:
    """记录调优动作"""
    aid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO tuning_history
            (id,timestamp,action_type,target,before_value,after_value,
             performance_delta,success)
            VALUES (?,?,?,?,?,?,?,1)""",
            (aid, _now(), action_type, target, before, after,
             performance_delta))
    return aid


def get_tuning_summary(days: int = 30) -> Dict[str, Any]:
    """调优汇总"""
    since = (utcnow() - timedelta(days=days)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        params = c.execute("""SELECT COUNT(*) as cnt FROM pg_params
            WHERE timestamp >= ?""", (since,)).fetchone()["cnt"]
        pools = c.execute("""SELECT COUNT(*) as cnt FROM pool_config
            WHERE timestamp >= ?""", (since,)).fetchone()["cnt"]
        idxs = c.execute("""SELECT COUNT(*) as cnt FROM index_recommendations
            WHERE timestamp >= ?""", (since,)).fetchone()["cnt"]
        actions = c.execute("""SELECT COUNT(*) as cnt, AVG(performance_delta) as avg_delta
            FROM tuning_history WHERE timestamp >= ?""", (since,)).fetchone()
    return {
        "window_days": days,
        "param_changes": params,
        "pool_updates": pools,
        "index_recommendations": idxs,
        "total_actions": actions["cnt"] or 0,
        "avg_performance_delta": round(actions["avg_delta"] or 0, 4),
    }


def _send_dingtalk(title: str, content: str) -> None:
    """发送钉钉告警 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "title": title, "content": content,
            "source": "perf_tuning",
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
            self._json(200, {"status": "ok", "service": "perf_tuning"})
        elif path == "/api/tuning/summary":
            self._json(200, get_tuning_summary())
        elif path.startswith("/api/pg/recommend/"):
            workload = path[19:]
            self._json(200, get_pg_recommendations(workload))
        elif path == "/api/index/recommendations":
            self._json(200, {"recommendations": list_index_recommendations()})
        elif path == "/api/slow/queries":
            self._json(200, {"queries": get_slow_queries()})
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
        if path == "/api/pg/param/apply":
            pid = apply_pg_param(
                param_name=data.get("param_name", "shared_buffers"),
                new_value=str(data.get("new_value", "")),
                workload_type=data.get("workload_type", "mixed"),
                reason=data.get("reason", ""),
            )
            self._json(201, {"id": pid})
        elif path == "/api/pool/calculate":
            result = calculate_pool_size(
                current_load=data.get("current_load", 50.0),
                avg_latency_ms=data.get("avg_latency_ms", 50.0),
                target_latency_ms=data.get("target_latency_ms", 100.0),
            )
            self._json(200, result)
        elif path == "/api/pool/update":
            pid = update_pool_config(
                service=data.get("service", "default"),
                current_size=data.get("current_size", 10),
                target_size=data.get("target_size", 20),
                reason=data.get("reason", ""),
            )
            self._json(201, {"id": pid})
        elif path == "/api/index/recommend":
            result = recommend_index(
                table_name=data.get("table_name", "users"),
                columns=data.get("columns", []),
                query_pattern=data.get("query_pattern", ""),
                estimated_rows=data.get("estimated_rows", 0),
            )
            self._json(200, result)
        elif path == "/api/index/save":
            rid = save_index_recommendation(
                table_name=data.get("table_name", ""),
                columns=data.get("columns", []),
                index_type=data.get("index_type", "btree"),
                estimated_improvement=data.get("estimated_improvement", 0.0),
                reason=data.get("reason", ""),
                sql_ddl=data.get("sql_ddl", ""),
            )
            self._json(201, {"id": rid})
        elif path == "/api/plan/analyze":
            result = analyze_query_plan(
                query_sql=data.get("query_sql", ""),
                plan=data.get("plan", {}),
                execution_time_ms=data.get("execution_time_ms", 0.0),
            )
            self._json(200, result)
        elif path == "/api/tuning/record":
            aid = record_tuning_action(
                action_type=data.get("action_type", ""),
                target=data.get("target", ""),
                before=str(data.get("before", "")),
                after=str(data.get("after", "")),
                performance_delta=data.get("performance_delta", 0.0),
            )
            self._json(201, {"id": aid})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"Perf Tuning service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_pg_recommend(args: List[str]) -> None:
    if not args:
        print("usage: pg-recommend <workload>")
        return
    print(json.dumps(recommend_pg_params(args[0]), ensure_ascii=False, indent=2))


def cmd_pg_apply(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: pg-apply <param> <value> <workload> [reason]")
        return
    reason = args[3] if len(args) > 3 else ""
    pid = apply_pg_param(args[0], args[1], args[2], reason)
    print(json.dumps({"id": pid}, ensure_ascii=False))


def cmd_pool_calc(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: pool-calc <current_load> <avg_latency> [target_latency]")
        return
    target = float(args[2]) if len(args) > 2 else 100.0
    print(json.dumps(calculate_pool_size(float(args[0]), float(args[1]), target),
                      ensure_ascii=False, indent=2))


def cmd_pool_update(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: pool-update <service> <current_size> <target_size> [reason]")
        return
    reason = args[3] if len(args) > 3 else ""
    pid = update_pool_config(args[0], int(args[1]), int(args[2]), reason)
    print(json.dumps({"id": pid}, ensure_ascii=False))


def cmd_index_recommend(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: index-recommend <table> <cols_csv> [pattern] [rows]")
        return
    columns = args[1].split(",")
    pattern = args[2] if len(args) > 2 else ""
    rows = int(args[3]) if len(args) > 3 else 0
    print(json.dumps(recommend_index(args[0], columns, pattern, rows),
                      ensure_ascii=False, indent=2))


def cmd_index_save(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: index-save <table> <cols_csv> <type> [improvement] [reason] [ddl]")
        return
    improvement = float(args[3]) if len(args) > 3 else 0.0
    reason = args[4] if len(args) > 4 else ""
    ddl = args[5] if len(args) > 5 else ""
    rid = save_index_recommendation(args[0], args[1].split(","), args[2],
                                       improvement, reason, ddl)
    print(json.dumps({"id": rid}, ensure_ascii=False))


def cmd_index_list(_args: List[str]) -> None:
    print(json.dumps(list_index_recommendations(), ensure_ascii=False, indent=2))


def cmd_plan_analyze(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: plan-analyze <query_sql> <plan_json> <execution_time_ms>")
        return
    plan = json.loads(args[1])
    result = analyze_query_plan(args[0], plan, float(args[2]))
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_slow_queries(_args: List[str]) -> None:
    print(json.dumps(get_slow_queries(), ensure_ascii=False, indent=2))


def cmd_tuning_record(args: List[str]) -> None:
    if len(args) < 5:
        print("usage: tuning-record <action> <target> <before> <after> <delta>")
        return
    aid = record_tuning_action(args[0], args[1], args[2], args[3], float(args[4]))
    print(json.dumps({"id": aid}, ensure_ascii=False))


def cmd_tuning_summary(args: List[str]) -> None:
    days = int(args[0]) if args else 30
    print(json.dumps(get_tuning_summary(days), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "pg-recommend": cmd_pg_recommend,
        "pg-apply": cmd_pg_apply, "pool-calc": cmd_pool_calc,
        "pool-update": cmd_pool_update, "index-recommend": cmd_index_recommend,
        "index-save": cmd_index_save, "index-list": cmd_index_list,
        "plan-analyze": cmd_plan_analyze, "slow-queries": cmd_slow_queries,
        "tuning-record": cmd_tuning_record, "tuning-summary": cmd_tuning_summary,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

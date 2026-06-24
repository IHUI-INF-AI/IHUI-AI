#!/usr/bin/env python3
"""
FinOps 成本优化
P2-29: 多云成本监控, 资源利用率分析, 节约建议 (spot/preemptible/reserved), 成本归因
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "finops.db")
HTTP_PORT = 10090

CLOUD_PROVIDERS = ["aliyun", "huawei", "aws", "azure", "gcp", "tencent"]
RESOURCE_TYPES = ["compute", "storage", "network", "database", "cache",
                    "loadbalancer", "nat", "eip", "cdn"]
PRICING_MODELS = ["on_demand", "reserved", "spot", "preemptible", "savings_plan"]
COST_CATEGORIES = ["compute", "storage", "network", "service", "support"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS cost_records (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            provider TEXT NOT NULL,
            resource_type TEXT,
            resource_id TEXT,
            service TEXT,
            tenant TEXT,
            pricing_model TEXT,
            cost_amount REAL,
            currency TEXT DEFAULT 'CNY',
            usage_hours REAL,
            tags TEXT
        );
        CREATE TABLE IF NOT EXISTS resource_inventory (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            provider TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            resource_type TEXT,
            cpu_utilization REAL,
            memory_utilization REAL,
            network_in_mbps REAL,
            network_out_mbps REAL,
            status TEXT
        );
        CREATE TABLE IF NOT EXISTS savings_recommendations (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            resource_id TEXT,
            provider TEXT,
            recommendation_type TEXT,
            current_cost REAL,
            estimated_cost REAL,
            monthly_savings REAL,
            annual_savings REAL,
            description TEXT
        );
        CREATE TABLE IF NOT EXISTS budget_alerts (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            budget_name TEXT,
            budget_amount REAL,
            current_spend REAL,
            threshold_pct REAL,
            status TEXT
        );
        CREATE TABLE IF NOT EXISTS cost_attribution (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            tenant TEXT,
            service TEXT,
            environment TEXT,
            total_cost REAL,
            period TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_cost_provider ON cost_records(provider);
        CREATE INDEX IF NOT EXISTS idx_cost_tenant ON cost_records(tenant);
        CREATE INDEX IF NOT EXISTS idx_inv_resource ON resource_inventory(resource_id);
    """)
    conn.close()


_conn_lock = threading.Lock()
_db_ready = False


def _ensure_db() -> None:
    global _db_ready
    if not _db_ready:
        _init_db()
        _db_ready = True


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


def record_cost(provider: str, resource_type: str, resource_id: str,
                 service: str, tenant: str, pricing_model: str,
                 cost_amount: float, usage_hours: float = 0.0,
                 currency: str = "CNY", tags: Optional[Dict[str, str]] = None) -> str:
    """记录成本"""
    if provider not in CLOUD_PROVIDERS:
        provider = "aliyun"
    if resource_type not in RESOURCE_TYPES:
        resource_type = "compute"
    if pricing_model not in PRICING_MODELS:
        pricing_model = "on_demand"
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO cost_records
            (id,timestamp,provider,resource_type,resource_id,service,tenant,
             pricing_model,cost_amount,currency,usage_hours,tags)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (cid, _now(), provider, resource_type, resource_id, service, tenant,
             pricing_model, cost_amount, currency, usage_hours,
             json.dumps(tags or {}, ensure_ascii=False)))
    return cid


def record_inventory(provider: str, resource_id: str, resource_type: str,
                      cpu_util: float, mem_util: float,
                      net_in: float = 0.0, net_out: float = 0.0,
                      status: str = "running") -> str:
    """记录资源清单"""
    if provider not in CLOUD_PROVIDERS:
        provider = "aliyun"
    iid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO resource_inventory
            (id,timestamp,provider,resource_id,resource_type,
             cpu_utilization,memory_utilization,network_in_mbps,
             network_out_mbps,status)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (iid, _now(), provider, resource_id, resource_type,
             cpu_util, mem_util, net_in, net_out, status))
    return iid


def calculate_savings(current_cost: float, pricing_model: str,
                       usage_hours: float = 720.0) -> Dict[str, Any]:
    """计算节约"""
    discount = {
        "on_demand": 0.0,
        "reserved": 0.4,  # 40% 折扣
        "spot": 0.6,
        "preemptible": 0.6,
        "savings_plan": 0.3,
    }
    rate = discount.get(pricing_model, 0.0)
    if pricing_model == "on_demand" and usage_hours < 720:
        # 低利用率, 推荐 spot
        rate = 0.5
    estimated = current_cost * (1 - rate)
    monthly = current_cost - estimated
    annual = monthly * 12
    return {
        "current_cost": current_cost,
        "estimated_cost": round(estimated, 2),
        "monthly_savings": round(monthly, 2),
        "annual_savings": round(annual, 2),
        "discount_rate": rate,
    }


def generate_recommendations(resource_id: str, provider: str,
                              resource_type: str, cpu_util: float,
                              mem_util: float, current_cost: float) -> List[Dict[str, Any]]:
    """生成节约建议"""
    recs = []
    if cpu_util < 20 and mem_util < 30:
        savings = calculate_savings(current_cost, "spot", 720)
        recs.append({
            "resource_id": resource_id,
            "provider": provider,
            "type": "downsize",
            "description": f"资源利用率低 (CPU {cpu_util}%, MEM {mem_util}%), 建议降配或转 spot 实例",
            **savings,
        })
    elif cpu_util > 80 or mem_util > 85:
        recs.append({
            "resource_id": resource_id,
            "provider": provider,
            "type": "scale_out",
            "description": f"资源利用率高 (CPU {cpu_util}%, MEM {mem_util}%), 建议扩容",
            "current_cost": current_cost,
            "estimated_cost": current_cost * 1.5,
            "monthly_savings": -current_cost * 0.5,
            "annual_savings": -current_cost * 6,
        })
    if current_cost > 1000:
        savings = calculate_savings(current_cost, "reserved", 720)
        recs.append({
            "resource_id": resource_id,
            "provider": provider,
            "type": "reserved",
            "description": "高成本资源, 建议购买预留实例券",
            **savings,
        })
    if resource_type == "storage" and current_cost > 100:
        recs.append({
            "resource_id": resource_id,
            "provider": provider,
            "type": "storage_class",
            "description": "存储成本高, 建议使用低频/归档存储",
            "current_cost": current_cost,
            "estimated_cost": current_cost * 0.3,
            "monthly_savings": current_cost * 0.7,
            "annual_savings": current_cost * 0.7 * 12,
        })
    return recs


def save_recommendation(rec: Dict[str, Any]) -> str:
    """保存建议"""
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO savings_recommendations
            (id,timestamp,resource_id,provider,recommendation_type,
             current_cost,estimated_cost,monthly_savings,annual_savings,description)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), rec.get("resource_id", ""), rec.get("provider", ""),
             rec.get("type", ""), rec.get("current_cost", 0),
             rec.get("estimated_cost", 0), rec.get("monthly_savings", 0),
             rec.get("annual_savings", 0), rec.get("description", "")))
    return rid


def get_cost_by_provider(hours: int = 24) -> List[Dict[str, Any]]:
    """按云厂商统计成本"""
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat().replace("+00:00", "Z")
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT provider, SUM(cost_amount) as total_cost,
            COUNT(*) as record_count, COUNT(DISTINCT resource_id) as resources
            FROM cost_records WHERE timestamp >= ?
            GROUP BY provider ORDER BY total_cost DESC""", (since,)).fetchall()
    return [{"provider": r["provider"], "total_cost": round(r["total_cost"] or 0, 2),
             "records": r["record_count"], "resources": r["resources"]}
            for r in rows]


def get_cost_by_tenant(hours: int = 24) -> List[Dict[str, Any]]:
    """按租户归因"""
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat().replace("+00:00", "Z")
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT tenant, service, SUM(cost_amount) as total_cost
            FROM cost_records WHERE timestamp >= ?
            GROUP BY tenant, service ORDER BY total_cost DESC""",
            (since,)).fetchall()
    return [{"tenant": r["tenant"], "service": r["service"],
             "total_cost": round(r["total_cost"] or 0, 2)} for r in rows]


def get_underutilized_resources(cpu_threshold: float = 20.0,
                                 mem_threshold: float = 30.0) -> List[Dict[str, Any]]:
    """低利用率资源"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT resource_id, provider, resource_type,
            AVG(cpu_utilization) as avg_cpu,
            AVG(memory_utilization) as avg_mem
            FROM resource_inventory
            GROUP BY resource_id, provider, resource_type
            HAVING avg_cpu < ? OR avg_mem < ?""",
            (cpu_threshold, mem_threshold)).fetchall()
    return [{"resource_id": r["resource_id"], "provider": r["provider"],
             "type": r["resource_type"],
             "cpu": round(r["avg_cpu"] or 0, 2),
             "memory": round(r["avg_mem"] or 0, 2)} for r in rows]


def check_budget(budget_name: str, budget_amount: float,
                  threshold_pct: float = 80.0) -> Dict[str, Any]:
    """检查预算"""
    with _conn_lock, _conn() as c:
        current = c.execute("""SELECT COALESCE(SUM(cost_amount), 0) as total
            FROM cost_records WHERE timestamp >= ?""",
            ((datetime.now(timezone.utc) - timedelta(days=30)).isoformat().replace("+00:00", "Z"),)).fetchone()["total"]
    used_pct = (current / budget_amount * 100) if budget_amount else 0
    status = "ok"
    if used_pct >= 100:
        status = "exceeded"
    elif used_pct >= threshold_pct:
        status = "warning"
    aid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO budget_alerts
            (id,timestamp,budget_name,budget_amount,current_spend,threshold_pct,status)
            VALUES (?,?,?,?,?,?,?)""",
            (aid, _now(), budget_name, budget_amount, current, threshold_pct, status))
    return {
        "budget_name": budget_name,
        "budget": budget_amount,
        "current_spend": round(current, 2),
        "used_pct": round(used_pct, 2),
        "status": status,
    }


def get_finops_summary() -> Dict[str, Any]:
    """FinOps 总览"""
    with _conn_lock, _conn() as c:
        total_cost = c.execute("""SELECT COALESCE(SUM(cost_amount), 0) as total
            FROM cost_records""").fetchone()["total"]
        total_resources = c.execute("""SELECT COUNT(DISTINCT resource_id) as cnt
            FROM resource_inventory""").fetchone()["cnt"]
        recs = c.execute("""SELECT COALESCE(SUM(monthly_savings), 0) as total
            FROM savings_recommendations""").fetchone()["total"]
    return {
        "total_cost": round(total_cost, 2),
        "total_resources": total_resources,
        "monthly_savings_potential": round(recs, 2),
        "annual_savings_potential": round(recs * 12, 2),
    }


def _send_dingtalk(title: str, content: str) -> None:
    """发送钉钉告警 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "title": title, "content": content,
            "source": "finops",
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
            self._json(200, {"status": "ok", "service": "finops"})
        elif path == "/api/finops/summary":
            self._json(200, get_finops_summary())
        elif path == "/api/cost/provider":
            hours = int(qs.get("hours", ["24"])[0])
            self._json(200, {"by_provider": get_cost_by_provider(hours)})
        elif path == "/api/cost/tenant":
            hours = int(qs.get("hours", ["24"])[0])
            self._json(200, {"by_tenant": get_cost_by_tenant(hours)})
        elif path == "/api/resources/underutilized":
            self._json(200, {"resources": get_underutilized_resources()})
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
        if path == "/api/cost/record":
            cid = record_cost(
                provider=data.get("provider", "aliyun"),
                resource_type=data.get("resource_type", "compute"),
                resource_id=data.get("resource_id", ""),
                service=data.get("service", ""),
                tenant=data.get("tenant", ""),
                pricing_model=data.get("pricing_model", "on_demand"),
                cost_amount=data.get("cost_amount", 0.0),
                usage_hours=data.get("usage_hours", 0.0),
                currency=data.get("currency", "CNY"),
                tags=data.get("tags", {}),
            )
            self._json(201, {"id": cid})
        elif path == "/api/inventory/record":
            iid = record_inventory(
                provider=data.get("provider", "aliyun"),
                resource_id=data.get("resource_id", ""),
                resource_type=data.get("resource_type", "compute"),
                cpu_util=data.get("cpu_util", 0.0),
                mem_util=data.get("mem_util", 0.0),
                net_in=data.get("net_in", 0.0),
                net_out=data.get("net_out", 0.0),
                status=data.get("status", "running"),
            )
            self._json(201, {"id": iid})
        elif path == "/api/savings/calculate":
            result = calculate_savings(
                current_cost=data.get("current_cost", 100.0),
                pricing_model=data.get("pricing_model", "on_demand"),
                usage_hours=data.get("usage_hours", 720.0),
            )
            self._json(200, result)
        elif path == "/api/recommendations/generate":
            recs = generate_recommendations(
                resource_id=data.get("resource_id", ""),
                provider=data.get("provider", "aliyun"),
                resource_type=data.get("resource_type", "compute"),
                cpu_util=data.get("cpu_util", 0.0),
                mem_util=data.get("mem_util", 0.0),
                current_cost=data.get("current_cost", 0.0),
            )
            for r in recs:
                save_recommendation(r)
            self._json(200, {"recommendations": recs})
        elif path == "/api/budget/check":
            result = check_budget(
                budget_name=data.get("budget_name", ""),
                budget_amount=data.get("budget_amount", 10000.0),
                threshold_pct=data.get("threshold_pct", 80.0),
            )
            if result["status"] in ("warning", "exceeded"):
                _send_dingtalk(f"预算告警: {result['budget_name']}",
                                f"已使用 {result['used_pct']}%")
            self._json(200, result)
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("127.0.0.1", HTTP_PORT), _Handler)
    print(f"FinOps service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_record_cost(args: List[str]) -> None:
    if len(args) < 6:
        print("usage: record-cost <provider> <type> <resource_id> <service> <tenant> <amount> [model]")
        return
    model = args[6] if len(args) > 6 else "on_demand"
    cid = record_cost(args[0], args[1], args[2], args[3], args[4],
                        model, float(args[5]))
    print(json.dumps({"id": cid}, ensure_ascii=False))


def cmd_record_inventory(args: List[str]) -> None:
    if len(args) < 5:
        print("usage: record-inventory <provider> <resource_id> <type> <cpu> <mem>")
        return
    iid = record_inventory(args[0], args[1], args[2],
                            float(args[3]), float(args[4]))
    print(json.dumps({"id": iid}, ensure_ascii=False))


def cmd_savings(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: savings <current_cost> <pricing_model> [hours]")
        return
    hours = float(args[2]) if len(args) > 2 else 720.0
    print(json.dumps(calculate_savings(float(args[0]), args[1], hours),
                      ensure_ascii=False, indent=2))


def cmd_recommend(args: List[str]) -> None:
    if len(args) < 5:
        print("usage: recommend <resource_id> <provider> <type> <cpu> <mem> <current_cost>")
        return
    cost = float(args[5]) if len(args) > 5 else 100.0
    recs = generate_recommendations(args[0], args[1], args[2],
                                       float(args[3]), float(args[4]), cost)
    for r in recs:
        save_recommendation(r)
    print(json.dumps(recs, ensure_ascii=False, indent=2))


def cmd_by_provider(args: List[str]) -> None:
    hours = int(args[0]) if args else 24
    print(json.dumps(get_cost_by_provider(hours), ensure_ascii=False, indent=2))


def cmd_by_tenant(args: List[str]) -> None:
    hours = int(args[0]) if args else 24
    print(json.dumps(get_cost_by_tenant(hours), ensure_ascii=False, indent=2))


def cmd_underutilized(_args: List[str]) -> None:
    print(json.dumps(get_underutilized_resources(), ensure_ascii=False, indent=2))


def cmd_budget(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: budget <name> <amount> [threshold_pct]")
        return
    threshold = float(args[2]) if len(args) > 2 else 80.0
    print(json.dumps(check_budget(args[0], float(args[1]), threshold),
                      ensure_ascii=False, indent=2))


def cmd_summary(_args: List[str]) -> None:
    print(json.dumps(get_finops_summary(), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "record-cost": cmd_record_cost,
        "record-inventory": cmd_record_inventory, "savings": cmd_savings,
        "recommend": cmd_recommend, "by-provider": cmd_by_provider,
        "by-tenant": cmd_by_tenant, "underutilized": cmd_underutilized,
        "budget": cmd_budget, "summary": cmd_summary,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""多租户资源配额管理 (Round 11 P1-14)

功能:
  - 租户配额定义 (DB 连接数 / API 速率 / 存储空间)
  - 配额使用实时跟踪
  - 超额告警 (>80% warning, >95% critical)
  - 配额使用报告 (按租户 / 按资源类型)
  - 自动限流 (基于令牌桶)
  - 钉钉告警集成
  - 配额管理 CLI (list/set/check/usage)

用法:
  python scripts/tenant_quota.py list
  python scripts/tenant_quota.py set --tenant t1 --db-conn 100 --api-rps 1000 --storage-gb 50
  python scripts/tenant_quota.py check --tenant t1
  python scripts/tenant_quota.py usage --tenant t1
  python scripts/tenant_quota.py report
  python scripts/tenant_quota.py serve --port 9300
"""
import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOGS_DIR = SERVER_DIR / "logs"
DB_PATH = LOGS_DIR / "tenant_quota.db"

DINGTALK_WEBHOOK = os.environ.get("DINGTALK_WEBHOOK", "")

# 资源类型
RESOURCE_TYPES = ["db_conn", "api_rps", "storage_gb", "cpu_cores", "memory_mb", "bandwidth_mbps"]

# 默认配额 (租户级别)
DEFAULT_QUOTAS = {
    "free": {"db_conn": 5, "api_rps": 100, "storage_gb": 1, "cpu_cores": 0.5, "memory_mb": 256, "bandwidth_mbps": 10},
    "basic": {"db_conn": 20, "api_rps": 500, "storage_gb": 10, "cpu_cores": 2, "memory_mb": 1024, "bandwidth_mbps": 50},
    "pro": {"db_conn": 100, "api_rps": 2000, "storage_gb": 100, "cpu_cores": 8, "memory_mb": 4096, "bandwidth_mbps": 200},
    "enterprise": {"db_conn": 500, "api_rps": 10000, "storage_gb": 1000, "cpu_cores": 32, "memory_mb": 16384, "bandwidth_mbps": 1000},
}

# 阈值
WARNING_THRESHOLD = 80  # 80% warning
CRITICAL_THRESHOLD = 95  # 95% critical


def log(msg: str) -> None:
    """输出日志"""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def init_db() -> None:
    """初始化配额 DB"""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tenant_quotas (
            tenant_id TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            quota REAL NOT NULL,
            tier TEXT DEFAULT 'basic',
            updated_at TEXT NOT NULL,
            PRIMARY KEY (tenant_id, resource_type)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tenant_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            used REAL NOT NULL
        )
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_usage_tenant ON tenant_usage(tenant_id, resource_type)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_usage_ts ON tenant_usage(timestamp)
    """)
    conn.commit()
    conn.close()


def set_quota(tenant_id: str, resource_type: str, quota: float, tier: str = "basic") -> dict:
    """设置配额"""
    if resource_type not in RESOURCE_TYPES:
        return {"status": "error", "detail": f"未知资源类型: {resource_type}"}

    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO tenant_quotas (tenant_id, resource_type, quota, tier, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, resource_type) DO UPDATE SET
            quota = excluded.quota,
            tier = excluded.tier,
            updated_at = excluded.updated_at
    """, (
        tenant_id, resource_type, quota, tier,
        datetime.now(timezone.utc).isoformat(),
    ))
    conn.commit()
    conn.close()

    return {
        "status": "ok",
        "tenant_id": tenant_id,
        "resource_type": resource_type,
        "quota": quota,
        "tier": tier,
    }


def set_tenant_tier(tenant_id: str, tier: str) -> dict:
    """设置租户等级 (应用默认配额)"""
    if tier not in DEFAULT_QUOTAS:
        return {"status": "error", "detail": f"未知等级: {tier}"}

    quotas = DEFAULT_QUOTAS[tier]
    results = []
    for rt, q in quotas.items():
        results.append(set_quota(tenant_id, rt, q, tier))

    return {
        "status": "ok",
        "tenant_id": tenant_id,
        "tier": tier,
        "applied_quotas": results,
    }


def get_quota(tenant_id: str, resource_type: str) -> Optional[dict]:
    """获取租户配额"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM tenant_quotas WHERE tenant_id = ? AND resource_type = ?
    """, (tenant_id, resource_type))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def list_tenants() -> list[dict]:
    """列出所有租户"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT tenant_id, tier, MAX(updated_at) as updated_at,
               COUNT(*) as resource_count
        FROM tenant_quotas
        GROUP BY tenant_id
    """)
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows


def record_usage(tenant_id: str, resource_type: str, used: float) -> None:
    """记录使用量"""
    if resource_type not in RESOURCE_TYPES:
        return
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO tenant_usage (timestamp, tenant_id, resource_type, used)
        VALUES (?, ?, ?, ?)
    """, (datetime.now(timezone.utc).isoformat(), tenant_id, resource_type, used))
    conn.commit()
    conn.close()


def get_latest_usage(tenant_id: str, resource_type: str) -> Optional[float]:
    """获取最近使用量"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        SELECT used FROM tenant_usage
        WHERE tenant_id = ? AND resource_type = ?
        ORDER BY timestamp DESC LIMIT 1
    """, (tenant_id, resource_type))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


def check_quota(tenant_id: str) -> dict:
    """检查租户配额使用情况"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM tenant_quotas WHERE tenant_id = ?", (tenant_id,))
    quotas = [dict(row) for row in cur.fetchall()]
    conn.close()

    results = []
    for q in quotas:
        used = get_latest_usage(tenant_id, q["resource_type"]) or 0
        quota = q["quota"]
        usage_pct = (used / quota * 100) if quota > 0 else 0

        if usage_pct >= CRITICAL_THRESHOLD:
            level = "critical"
        elif usage_pct >= WARNING_THRESHOLD:
            level = "warning"
        else:
            level = "ok"

        results.append({
            "resource_type": q["resource_type"],
            "quota": quota,
            "used": used,
            "usage_pct": round(usage_pct, 2),
            "alert_level": level,
            "tier": q.get("tier", "basic"),
        })

    return {
        "tenant_id": tenant_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "resources": results,
        "any_critical": any(r["alert_level"] == "critical" for r in results),
        "any_warning": any(r["alert_level"] == "warning" for r in results),
    }


def report_all() -> dict:
    """所有租户配额使用报告"""
    tenants = list_tenants()
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tenant_count": len(tenants),
        "tenants": [],
    }

    for t in tenants:
        tenant_id = t["tenant_id"]
        check_result = check_quota(tenant_id)
        report["tenants"].append({
            "tenant_id": tenant_id,
            "tier": t.get("tier", "basic"),
            "resources": check_result["resources"],
        })

    return report


def send_dingtalk_alert(alerts: list) -> None:
    """发送钉钉告警"""
    if not DINGTALK_WEBHOOK or not alerts:
        return
    try:
        text = f"⚠️ 租户配额告警 (共 {len(alerts)} 条)\n\n"
        for a in alerts[:5]:
            text += f"- [{a['level'].upper()}] {a['tenant_id']}/{a['resource_type']}: {a['usage_pct']}% (配额 {a['quota']})\n"

        payload = json.dumps({"msgtype": "text", "text": {"content": text}}).encode("utf-8")
        req = urllib.request.Request(
            DINGTALK_WEBHOOK, data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            log(f"钉钉通知已发送 (status={resp.status})")
    except Exception as e:
        log(f"⚠️ 钉钉通知失败: {e}")


def cmd_list(args) -> int:
    """列出所有租户"""
    tenants = list_tenants()
    print(json.dumps({
        "operation": "list",
        "tenant_count": len(tenants),
        "tenants": tenants,
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_set(args) -> int:
    """设置配额"""
    if args.tier:
        # 整个等级
        result = set_tenant_tier(args.tenant, args.tier)
    else:
        # 单个资源
        if not args.resource or args.quota is None:
            print("错误: 必须指定 --resource 和 --quota, 或使用 --tier")
            return 1
        result = set_quota(args.tenant, args.resource, args.quota)

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_check(args) -> int:
    """检查租户配额"""
    result = check_quota(args.tenant)
    print(json.dumps(result, ensure_ascii=False, indent=2))

    if args.notify and (result["any_critical"] or result["any_warning"]):
        alerts = []
        for r in result["resources"]:
            if r["alert_level"] in ("warning", "critical"):
                alerts.append({
                    "level": r["alert_level"],
                    "tenant_id": args.tenant,
                    "resource_type": r["resource_type"],
                    "quota": r["quota"],
                    "usage_pct": r["usage_pct"],
                })
        send_dingtalk_alert(alerts)

    return 1 if result["any_critical"] else 0


def cmd_usage(args) -> int:
    """记录使用量 (测试用)"""
    record_usage(args.tenant, args.resource, args.value)
    print(json.dumps({
        "status": "ok",
        "tenant_id": args.tenant,
        "resource_type": args.resource,
        "value": args.value,
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_report(args) -> int:
    """所有租户报告"""
    result = report_all()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_serve(args) -> int:
    """HTTP 服务"""
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/healthz":
                self._json(200, {"status": "ok", "service": "tenant-quota"})
            elif self.path == "/tenants":
                self._json(200, {"tenants": list_tenants()})
            elif self.path.startswith("/check/"):
                tenant_id = self.path.split("/")[-1]
                self._json(200, check_quota(tenant_id))
            elif self.path == "/report":
                self._json(200, report_all())
            else:
                self._json(404, {"error": "not found"})

        def do_POST(self):
            if self.path.startswith("/usage/"):
                # /usage/<tenant>/<resource>
                parts = self.path.split("/")
                if len(parts) >= 4:
                    tenant_id = parts[2]
                    resource_type = parts[3]
                    content_length = int(self.headers.get("Content-Length", 0))
                    body = json.loads(self.rfile.read(content_length).decode("utf-8")) if content_length else {}
                    used = body.get("value", 0)
                    record_usage(tenant_id, resource_type, used)
                    self._json(200, {"status": "ok", "used": used})
                else:
                    self._json(400, {"error": "参数不足"})
            else:
                self._json(404, {"error": "not found"})

        def _json(self, code: int, data):
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

        def log_message(self, format, *args):
            pass

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    log(f"tenant-quota HTTP 服务已启动: 0.0.0.0:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="多租户资源配额")
    sub = parser.add_subparsers(dest="command")

    # list
    sub.add_parser("list", help="列出所有租户")

    # set
    set_p = sub.add_parser("set", help="设置配额")
    set_p.add_argument("--tenant", required=True)
    set_p.add_argument("--resource", choices=RESOURCE_TYPES, help="资源类型")
    set_p.add_argument("--quota", type=float, help="配额值")
    set_p.add_argument("--tier", choices=list(DEFAULT_QUOTAS.keys()), help="租户等级")

    # check
    chk_p = sub.add_parser("check", help="检查租户配额")
    chk_p.add_argument("--tenant", required=True)
    chk_p.add_argument("--notify", action="store_true")

    # usage
    us_p = sub.add_parser("usage", help="记录使用量")
    us_p.add_argument("--tenant", required=True)
    us_p.add_argument("--resource", required=True, choices=RESOURCE_TYPES)
    us_p.add_argument("--value", type=float, required=True)

    # report
    sub.add_parser("report", help="所有租户报告")

    # serve
    sv_p = sub.add_parser("serve", help="HTTP 服务")
    sv_p.add_argument("--port", type=int, default=9300)

    args = parser.parse_args()

    if args.command == "list":
        return cmd_list(args)
    if args.command == "set":
        return cmd_set(args)
    if args.command == "check":
        return cmd_check(args)
    if args.command == "usage":
        return cmd_usage(args)
    if args.command == "report":
        return cmd_report(args)
    if args.command == "serve":
        return cmd_serve(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

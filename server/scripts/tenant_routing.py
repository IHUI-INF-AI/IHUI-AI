#!/usr/bin/env python3
"""多租户 schema 路由 Python 中间件

职责: 解析 HTTP 请求头 X-Tenant-Id, 调用 PostgreSQL 函数 set_tenant_search_path 隔离数据
支持框架: FastAPI / Flask / Django (通过统一接口)
配合 SQL: scripts/tenant_routing.sql (含 set_tenant_search_path 函数)

用法 (FastAPI):
    from fastapi import FastAPI, Request
    from scripts.tenant_routing import TenantRoutingMiddleware

    app = FastAPI()
    app.add_middleware(TenantRoutingMiddleware)

用法 (CLI):
    python scripts/tenant_routing.py route --tenant zhs
    python scripts/tenant_routing.py health --tenant demo
    python scripts/tenant_routing.py list
"""
import os
import re
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from contextlib import contextmanager

SERVER_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
ROUTING_LOG = LOG_DIR / f"tenant_routing_{datetime.now(timezone.utc).strftime('%Y%m%d')}.log"
ROUTING_HISTORY = LOG_DIR / "tenant_routing_history.jsonl"

# 租户 ID 白名单 (生产环境从配置中心加载, 默认示例)
DEFAULT_TENANT_WHITELIST = {
    "zhs": "production",
    "demo": "demo",
    "test": "test",
}

# 数据库连接配置
DB_HOST = os.environ.get("PGHOST", "localhost")
DB_PORT = int(os.environ.get("PGPORT", "5432"))
DB_NAME = os.environ.get("PGDATABASE", "zhs")
DB_USER = os.environ.get("PGUSER", "postgres")
DB_PASSWORD = os.environ.get("PGPASSWORD", "")

# 租户 ID 校验正则
TENANT_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_]{1,64}$")


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(ROUTING_LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def append_history(event: dict) -> None:
    """追加路由历史到 JSONL 文件"""
    event["timestamp"] = datetime.now(timezone.utc).isoformat()
    with open(ROUTING_HISTORY, "a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def validate_tenant_id(tenant_id: str) -> tuple[bool, str]:
    """校验租户 ID 格式"""
    if not tenant_id:
        return False, "tenant_id 不能为空"
    if not TENANT_ID_PATTERN.match(tenant_id):
        return False, f"tenant_id 格式不合法: {tenant_id} (只允许字母数字下划线, 1-64 字符)"
    return True, ""


def is_tenant_allowed(tenant_id: str, whitelist: Optional[dict] = None) -> tuple[bool, str]:
    """校验租户是否在白名单内"""
    wl = whitelist or DEFAULT_TENANT_WHITELIST
    if tenant_id not in wl:
        return False, f"租户 {tenant_id} 不在白名单中"
    return True, ""


def build_schema_name(tenant_id: str) -> str:
    """构造 schema 名"""
    return f"tenant_{tenant_id}"


@contextmanager
def get_db_connection():
    """获取数据库连接 (懒加载 psycopg2)"""
    try:
        import psycopg2
        from psycopg2 import pool as pg_pool
    except ImportError:
        log("⚠️  psycopg2 未安装, 使用 mock 模式")
        yield None
        return

    conn = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=5,
        )
        yield conn
    except Exception as e:
        log(f"⚠️  数据库连接失败: {e}")
        yield None
    finally:
        if conn is not None:
            conn.close()


def route_to_tenant(tenant_id: str, dry_run: bool = False) -> dict:
    """将当前连接路由到指定租户 schema"""
    # 1. 校验格式
    valid, err = validate_tenant_id(tenant_id)
    if not valid:
        return {"status": "failed", "stage": "validation", "error": err, "tenant_id": tenant_id}

    # 2. 校验白名单
    allowed, err = is_tenant_allowed(tenant_id)
    if not allowed:
        return {"status": "failed", "stage": "whitelist", "error": err, "tenant_id": tenant_id}

    # 3. 构造 schema 名
    schema_name = build_schema_name(tenant_id)

    # 4. dry-run 模式: 不实际执行 SQL
    if dry_run:
        result = {
            "status": "dry_run",
            "stage": "completed",
            "tenant_id": tenant_id,
            "schema_name": schema_name,
            "search_path": f"{schema_name}, shared, public",
        }
        log(f"[DRY-RUN] 路由: {tenant_id} -> {schema_name}")
        append_history({"operation": "route", **result})
        return result

    # 5. 实际调用 set_tenant_search_path
    with get_db_connection() as conn:
        if conn is None:
            return {
                "status": "failed",
                "stage": "connection",
                "error": "数据库连接不可用",
                "tenant_id": tenant_id,
                "schema_name": schema_name,
            }
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT set_tenant_search_path(%s);", (tenant_id,))
                cur.execute("SHOW search_path;")
                actual_path = cur.fetchone()[0]
            conn.commit()
            result = {
                "status": "success",
                "stage": "completed",
                "tenant_id": tenant_id,
                "schema_name": schema_name,
                "search_path": actual_path,
            }
            log(f"✅ 路由成功: {tenant_id} -> {actual_path}")
            append_history({"operation": "route", **result})
            return result
        except Exception as e:
            conn.rollback()
            result = {
                "status": "failed",
                "stage": "sql_execution",
                "error": str(e),
                "tenant_id": tenant_id,
                "schema_name": schema_name,
            }
            log(f"❌ 路由失败: {tenant_id} - {e}")
            append_history({"operation": "route", **result})
            return result


def check_tenant_health(tenant_id: str) -> dict:
    """检查租户健康状态"""
    valid, err = validate_tenant_id(tenant_id)
    if not valid:
        return {"status": "failed", "error": err, "tenant_id": tenant_id}

    schema_name = build_schema_name(tenant_id)

    with get_db_connection() as conn:
        if conn is None:
            return {
                "status": "unreachable",
                "tenant_id": tenant_id,
                "schema_name": schema_name,
                "table_count": 0,
                "function_count": 0,
                "health_status": "unknown",
                "note": "数据库不可用, 跳过健康检查",
            }
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM check_tenant_health(%s);",
                    (tenant_id,),
                )
                row = cur.fetchone()
                if row is None:
                    return {
                        "status": "unknown",
                        "tenant_id": tenant_id,
                        "schema_name": schema_name,
                    }
                return {
                    "status": "success",
                    "tenant_id": row[0],
                    "schema_name": row[1],
                    "table_count": row[2],
                    "function_count": row[3],
                    "health_status": row[4],
                }
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e),
                "tenant_id": tenant_id,
                "schema_name": schema_name,
            }


def list_tenants() -> list[dict]:
    """列出所有租户"""
    return [
        {"tenant_id": tid, "tier": tier, "schema_name": build_schema_name(tid)}
        for tid, tier in DEFAULT_TENANT_WHITELIST.items()
    ]


class TenantRoutingMiddleware:
    """FastAPI / WSGI 通用中间件

    使用方式 (FastAPI):
        from fastapi import FastAPI
        app = FastAPI()
        app.add_middleware(TenantRoutingMiddleware, db_pool=pool)
    """

    def __init__(self, app=None, db_pool=None, default_tenant: Optional[str] = None):
        self.app = app
        self.db_pool = db_pool
        self.default_tenant = default_tenant
        self.routing_stats = {"total": 0, "success": 0, "failed": 0}

    def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return self.app(scope, receive, send) if self.app else None

        # 解析 X-Tenant-Id 头
        headers = dict(scope.get("headers", []))
        tenant_id = None
        for name, value in headers.items():
            if name.lower() == b"x-tenant-id":
                tenant_id = value.decode("utf-8", errors="replace")
                break

        if not tenant_id and self.default_tenant:
            tenant_id = self.default_tenant

        self.routing_stats["total"] += 1
        if tenant_id:
            result = route_to_tenant(tenant_id, dry_run=(self.db_pool is None))
            if result.get("status") == "success" or result.get("status") == "dry_run":
                self.routing_stats["success"] += 1
            else:
                self.routing_stats["failed"] += 1
            # 将租户信息注入 scope
            scope["tenant_id"] = tenant_id
            scope["tenant_schema"] = build_schema_name(tenant_id)
            scope["routing_result"] = result

        return self.app(scope, receive, send) if self.app else None


def cmd_route(args) -> int:
    """路由到指定租户"""
    result = route_to_tenant(args.tenant, dry_run=args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") in ("success", "dry_run") else 1


def cmd_health(args) -> int:
    """检查租户健康状态"""
    result = check_tenant_health(args.tenant)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("health_status") in ("healthy", "empty", "warning", "unreachable") else 1


def cmd_list(args) -> int:
    """列出所有租户"""
    tenants = list_tenants()
    print(json.dumps(tenants, ensure_ascii=False, indent=2))
    return 0


def cmd_validate(args) -> int:
    """校验租户 ID 格式"""
    valid, err = validate_tenant_id(args.tenant)
    result = {"tenant_id": args.tenant, "valid": valid, "error": err or None}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if valid else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="多租户 schema 路由")
    sub = parser.add_subparsers(dest="command")

    route_p = sub.add_parser("route", help="路由到租户")
    route_p.add_argument("--tenant", required=True, help="租户 ID")
    route_p.add_argument("--dry-run", action="store_true", help="仅校验不执行 SQL")

    health_p = sub.add_parser("health", help="检查租户健康")
    health_p.add_argument("--tenant", required=True, help="租户 ID")

    sub.add_parser("list", help="列出所有租户")

    validate_p = sub.add_parser("validate", help="校验租户 ID 格式")
    validate_p.add_argument("--tenant", required=True, help="租户 ID")

    args = parser.parse_args()

    if args.command == "route":
        return cmd_route(args)
    if args.command == "health":
        return cmd_health(args)
    if args.command == "list":
        return cmd_list(args)
    if args.command == "validate":
        return cmd_validate(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

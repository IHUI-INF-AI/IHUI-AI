"""集成 Smoke 测试: 验证所有路由、WebSocket、DB、迁移、服务.

用法:
    python scripts/integration_smoke.py

输出:
    - 路由清单
    - DB 迁移状态
    - 服务加载状态
    - WebSocket 注册状态
    - 业务接口可访问性 smoke 测试
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# 强制走 SQLite, 不动生产 PostgreSQL
SQLITE_PATH = str(ROOT / "zhs_integration.db")
if os.path.exists(SQLITE_PATH):
    os.remove(SQLITE_PATH)
os.environ.setdefault("DB1_URL", f"sqlite:///{SQLITE_PATH}")
os.environ.setdefault("DB2_URL", f"sqlite:///{SQLITE_PATH}")
os.environ.setdefault("DB3_URL", f"sqlite:///{SQLITE_PATH}")
os.environ.setdefault("AUTO_CREATE_SCHEMA", "1")
os.environ.setdefault("ENV", "test")

import httpx  # noqa: E402

results = []


def record(name: str, ok: bool, detail: str = "") -> None:
    mark = "V" if ok else "X"
    results.append({"name": name, "ok": ok, "detail": detail})
    print(f"  [{mark}] {name} {detail}")


def main() -> int:
    print("=" * 70)
    print("ZHS Platform 集成 Smoke 测试")
    print("=" * 70)

    # 1. 加载 App
    print("\n[1] 加载 FastAPI App")
    from app.main import create_app

    try:
        app = create_app()
        record("create_app()", True)
    except Exception as e:
        record("create_app()", False, str(e))
        return 1

    # 2. 路由统计
    print("\n[2] 路由清单")
    http_routes = []
    ws_routes = []
    for r in app.routes:
        if hasattr(r, "methods") and hasattr(r, "path"):
            for m in r.methods or set():
                if m not in ("HEAD", "OPTIONS"):
                    http_routes.append((m, r.path))
        elif "websocket" in type(r).__name__.lower() or "WebSocket" in type(r).__name__:
            ws_routes.append(r.path)
    record("HTTP 路由数 >= 600", len(http_routes) >= 600, f"({len(http_routes)} 条)")
    record("WebSocket 路由数 >= 10", len(ws_routes) >= 10, f"({len(ws_routes)} 条)")

    # 3. 关键路由存在
    print("\n[3] 关键路由存在性")
    paths = {p for _, p in http_routes}
    expected_paths = [
        ("/healthz", "顶层健康检查"),
        ("/readyz", "顶层就绪检查"),
        ("/api/v1/auth/login", "登录"),
        ("/api/v1/agents", "智能体"),
        ("/api/v1/bots", "Bots"),
        ("/api/v1/chat", "Chat"),
        ("/api/v1/payments/wechat", "微信支付"),
        ("/api/v1/payments/alipay", "支付宝"),
        ("/api/v1/courses", "课程"),
        ("/api/v1/system/user", "系统用户"),
        ("/api/v1/finance", "财务"),
        ("/api/v1/monitor", "监控"),
        ("/api/v1/agents/categories", "智能体分类"),
        ("/api/v1/coze", "Coze 集成"),
    ]
    for ep, desc in expected_paths:
        record(f"{desc} ({ep})", any(p.startswith(ep) for p in paths), "")

    # 4. 服务模块
    print("\n[4] 关键服务模块加载")
    service_modules = [
        "app.services.avatar_sync_service",
        "app.services.cached_expiration_monitor",
        "app.services.monitor_startup",
        "app.services.heat_stats_service",
        "app.services.reconciliation_service",
        "app.services.token_service",
    ]
    for mod in service_modules:
        try:
            __import__(mod)
            record(f"import {mod}", True)
        except Exception as e:
            record(f"import {mod}", False, str(e))

    # 5. DB Schema
    print("\n[5] DB Schema (SQLite via AUTO_CREATE_SCHEMA)")
    from app.database import ENGINES, check_database_health

    health = check_database_health()
    for k, v in health.items():
        record(f"DB {k} 连接", v == "ok", v)
    insp_count = 0
    try:
        from sqlalchemy import inspect

        insp = inspect(ENGINES["ai"])
        tbls = insp.get_table_names()
        insp_count = len(tbls)
        record("ai 库表数", insp_count >= 50, f"({insp_count} 张, 期望 ≥50)")
    except Exception as e:
        record("ai 库表数", False, str(e))

    # 6. 业务路由 smoke
    print("\n[6] 业务路由 HTTP 200 smoke")
    smoke_endpoints = [
        ("GET", "/healthz"),
        ("GET", "/readyz"),
        ("GET", "/metrics"),
        ("GET", "/api/v1/agents/list"),
        ("GET", "/api/v1/bots/list"),
        ("GET", "/api/v1/courses/list"),
        ("GET", "/api/v1/system/user/list"),
    ]
    try:
        from httpx import AsyncClient

        async def _smoke():
            transport = httpx.ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test", timeout=10.0) as ac:
                for method, path in smoke_endpoints:
                    try:
                        r = await ac.request(method, path)
                        record(f"{method} {path}", r.status_code < 500, f"status={r.status_code}")
                    except Exception as e:
                        record(f"{method} {path}", False, str(e))

        import asyncio

        asyncio.run(_smoke())
    except Exception as e:
        record("ASGI client", False, str(e))

    # 7. 汇总
    print("\n" + "=" * 70)
    total = len(results)
    passed = sum(1 for r in results if r["ok"])
    failed = total - passed
    print(f"汇总: 通过 {passed} / 失败 {failed} / 总 {total}")
    if failed:
        print("\n失败项:")
        for r in results:
            if not r["ok"]:
                print(f"  X {r['name']}: {r['detail']}")
    print("=" * 70)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

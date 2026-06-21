#!/usr/bin/env python3
"""租户路由 FastAPI 集成示例

将 tenant_routing.py 中间件挂载到 FastAPI 应用
端到端测试: HTTP 请求带 X-Tenant-Id 头 → 中间件解析 → 路由到 schema

用法:
  python scripts/tenant_fastapi_integration.py demo
  python scripts/tenant_fastapi_integration.py test
  python scripts/tenant_fastapi_integration.py serve --port 8000
"""
import os
import sys
import json
import argparse
import threading
import time
from pathlib import Path
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.request import Request as URLRequest
from urllib.error import HTTPError

SERVER_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
INTEGRATION_LOG = LOG_DIR / f"tenant_fastapi_integration_{datetime.now(timezone.utc).strftime('%Y%m%d')}.log"


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(INTEGRATION_LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


class FastAPIDemoHandler(BaseHTTPRequestHandler):
    """模拟 FastAPI 应用处理器

    集成 tenant_routing.TenantRoutingMiddleware 逻辑
    实际使用时直接:
        from fastapi import FastAPI
        from scripts.tenant_routing import TenantRoutingMiddleware
        app = FastAPI()
        app.add_middleware(TenantRoutingMiddleware)
    """

    def _send_json(self, status: int, body: dict) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        # 解析 X-Tenant-Id 头
        tenant_id = None
        for name, value in self.headers.items():
            if name.lower() == "x-tenant-id":
                tenant_id = value
                break

        # 模拟中间件路由
        if self.path == "/health":
            self._send_json(200, {"status": "ok"})
            return

        if self.path == "/":
            self._send_json(200, {
                "service": "zhs-api",
                "tenant_routing_enabled": True,
                "message": "请在请求头添加 X-Tenant-Id",
            })
            return

        if self.path.startswith("/api/"):
            if not tenant_id:
                self._send_json(400, {"error": "missing_tenant_id", "detail": "请求头 X-Tenant-Id 必填"})
                return
            schema_name = f"tenant_{tenant_id}"
            self._send_json(200, {
                "tenant_id": tenant_id,
                "schema_name": schema_name,
                "search_path": f"{schema_name}, shared, public",
                "data": f"来自 {schema_name} 的模拟数据",
            })
            return

        self._send_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path == "/api/orders":
            tenant_id = None
            for name, value in self.headers.items():
                if name.lower() == "x-tenant-id":
                    tenant_id = value
                    break
            if not tenant_id:
                self._send_json(400, {"error": "missing_tenant_id"})
                return
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = {}
            self._send_json(201, {
                "order_id": 12345,
                "tenant_id": tenant_id,
                "schema_name": f"tenant_{tenant_id}",
                "received": payload,
            })
            return
        self._send_json(404, {"error": "not_found"})

    def log_message(self, format, *args):
        pass


def cmd_demo(args) -> int:
    """演示集成代码"""
    demo_code = '''
# === FastAPI 集成示例 ===

from fastapi import FastAPI, Request, Header, HTTPException
from typing import Optional
from scripts.tenant_routing import (
    TenantRoutingMiddleware,
    route_to_tenant,
    validate_tenant_id,
    is_tenant_allowed,
    build_schema_name,
)

app = FastAPI(title="ZHS API")

# 方式 1: 挂载全局中间件 (推荐)
app.add_middleware(
    TenantRoutingMiddleware,
    db_pool=None,  # 生产环境传入 psycopg2.pool.ThreadedConnectionPool
    default_tenant=None,  # 可选默认值
)

# 方式 2: 路由级依赖
@app.get("/api/users")
async def get_users(
    request: Request,
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id"),
):
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-Id header required")

    valid, err = validate_tenant_id(x_tenant_id)
    if not valid:
        raise HTTPException(status_code=400, detail=err)

    allowed, err = is_tenant_allowed(x_tenant_id)
    if not allowed:
        raise HTTPException(status_code=403, detail=err)

    schema_name = build_schema_name(x_tenant_id)
    routing_result = route_to_tenant(x_tenant_id, dry_run=False)

    return {
        "tenant_id": x_tenant_id,
        "schema_name": schema_name,
        "routing_status": routing_result.get("status"),
    }
'''
    print(demo_code)
    log("✅ 已输出 FastAPI 集成示例代码")
    return 0


def cmd_serve(args) -> int:
    """启动 HTTP 服务 (用于端到端测试)"""
    server = HTTPServer(("0.0.0.0", args.port), FastAPIDemoHandler)
    log(f"✅ 演示服务监听 0.0.0.0:{args.port}")
    log(f"  - GET  /                服务信息")
    log(f"  - GET  /health          健康检查")
    log(f"  - GET  /api/anything    需 X-Tenant-Id 头")
    log(f"  - POST /api/orders      需 X-Tenant-Id 头")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("停止服务")
    return 0


def cmd_test(args) -> int:
    """端到端集成测试"""
    log("=" * 60)
    log("FastAPI 集成端到端测试")
    log("=" * 60)

    port = args.port
    base_url = f"http://127.0.0.1:{port}"

    # 启动后台服务
    server = HTTPServer(("127.0.0.1", port), FastAPIDemoHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    log(f"  服务已启动: {base_url}")
    time.sleep(0.5)

    results = {"passed": 0, "failed": 0}

    def assert_eq(name: str, actual, expected) -> None:
        if actual == expected:
            results["passed"] += 1
            log(f"  ✅ {name}: {actual}")
        else:
            results["failed"] += 1
            log(f"  ❌ {name}: 期望 {expected}, 实际 {actual}")

    def http_get(path: str, headers: dict | None = None) -> tuple[int, dict]:
        req = URLRequest(f"{base_url}{path}")
        if headers:
            for k, v in headers.items():
                req.add_header(k, v)
        try:
            with __import__("urllib.request", fromlist=["urlopen"]).urlopen(req, timeout=5) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except HTTPError as e:
            body = e.read().decode("utf-8")
            try:
                return e.code, json.loads(body)
            except json.JSONDecodeError:
                return e.code, {"raw": body}

    def http_post(path: str, body: dict, headers: dict | None = None) -> tuple[int, dict]:
        data = json.dumps(body).encode("utf-8")
        req = URLRequest(f"{base_url}{path}", data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        if headers:
            for k, v in headers.items():
                req.add_header(k, v)
        try:
            with __import__("urllib.request", fromlist=["urlopen"]).urlopen(req, timeout=5) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except HTTPError as e:
            return e.code, json.loads(e.read().decode("utf-8"))

    try:
        # 1. 服务信息
        code, body = http_get("/")
        assert_eq("1.1 GET / 状态", code, 200)
        assert_eq("1.2 GET / 服务名", body.get("service"), "zhs-api")
        assert_eq("1.3 GET / 中间件启用", body.get("tenant_routing_enabled"), True)

        # 2. 健康检查
        code, body = http_get("/health")
        assert_eq("2.1 GET /health 状态", code, 200)
        assert_eq("2.2 GET /health status", body.get("status"), "ok")

        # 3. API 路径缺 tenant_id 头
        code, body = http_get("/api/orders")
        assert_eq("3.1 缺 tenant 头被拒绝", code, 400)
        assert_eq("3.2 错误码 missing_tenant_id", body.get("error"), "missing_tenant_id")

        # 4. API 路径带 tenant_id 头
        code, body = http_get("/api/orders", headers={"X-Tenant-Id": "zhs"})
        assert_eq("4.1 带 tenant 头访问", code, 200)
        assert_eq("4.2 响应含 tenant_id", body.get("tenant_id"), "zhs")
        assert_eq("4.3 响应含 schema_name", body.get("schema_name"), "tenant_zhs")
        assert_eq("4.4 响应含 search_path", "tenant_zhs" in body.get("search_path", ""), True)

        # 5. 多租户隔离
        for tenant in ["zhs", "demo", "test"]:
            code, body = http_get("/api/data", headers={"X-Tenant-Id": tenant})
            assert_eq(f"5.1 租户 {tenant}", code, 200)
            assert_eq(f"5.2 schema_{tenant}", body.get("schema_name"), f"tenant_{tenant}")

        # 6. POST 创建订单
        code, body = http_post(
            "/api/orders",
            {"item": "book", "amount": 99.9},
            headers={"X-Tenant-Id": "demo"},
        )
        assert_eq("6.1 POST 状态", code, 201)
        assert_eq("6.2 order_id", body.get("order_id"), 12345)
        assert_eq("6.3 tenant_id", body.get("tenant_id"), "demo")
        assert_eq("6.4 schema_name", body.get("schema_name"), "tenant_demo")

        # 7. POST 缺 tenant
        code, body = http_post("/api/orders", {"item": "x"})
        assert_eq("7.1 POST 缺 tenant", code, 400)

        # 8. 404 路径
        code, body = http_get("/not_exist")
        assert_eq("8.1 不存在路径", code, 404)

    finally:
        server.shutdown()
        server.server_close()

    log("=" * 60)
    log(f"测试结果: 通过 {results['passed']} / 失败 {results['failed']}")
    log("=" * 60)
    return 0 if results["failed"] == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="租户路由 FastAPI 集成")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("demo", help="输出 FastAPI 集成示例代码")

    serve_p = sub.add_parser("serve", help="启动演示 HTTP 服务")
    serve_p.add_argument("--port", type=int, default=8765, help="监听端口")

    test_p = sub.add_parser("test", help="端到端测试")
    test_p.add_argument("--port", type=int, default=8765, help="测试服务端口")

    args = parser.parse_args()

    if args.command == "demo":
        return cmd_demo(args)
    if args.command == "serve":
        return cmd_serve(args)
    if args.command == "test":
        return cmd_test(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

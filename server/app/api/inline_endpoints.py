"""Inline endpoints extracted from create_app() in app/main.py.

These endpoints were previously defined inline inside the FastAPI application
factory (app/main.py::create_app). They are gathered into a single APIRouter
so that create_app() stays focused on wiring/middleware while the endpoint
logic lives in a testable module.

Registration order note: this router is included in create_app() right after
the Java mock routers block, preserving the original relative ordering of
`/api/mock/status` against the mock catch-all routes. All other endpoints
here live at root paths (/metrics, /admin, /healthz, /ready, ...) that are
not shadowed by the mock catch-all.

app references that used the closure-captured `app` variable inside
create_app() are now resolved through `request.app` (the Starlette
application bound to the request), which is the canonical way to access
app.state / app.title / app.routes from within a router.
"""

import os
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["System"])


# ---------------------------------------------------------------------------
# Mock status (运维查询, 上线前必查)
# ---------------------------------------------------------------------------
@router.get("/api/mock/status", tags=["Mock"], include_in_schema=False)
async def mock_status(request: Request):
    # 延迟导入 app.api.mock 的 router, 与原 create_app() 内联逻辑一致
    from app.api.mock import api_router as _a
    from app.api.mock import coze_router as _c
    from app.api.mock import prod_router as _p

    return {
        "enabled": getattr(request.app.state, "mock_enabled", False),
        "env": getattr(request.app.state, "mock_env", "unknown"),
        "routes": {
            "/api": len(_a.routes),
            "/prod-api": len(_p.routes),
            "/coze": len(_c.routes),
        },
    }


# ---------------------------------------------------------------------------
# OpenAPI 按 tag 拆分端点 - 减小单文档大小, 方便前端按需加载
# ---------------------------------------------------------------------------
@router.get("/openapi/tags", tags=["OpenAPI"], include_in_schema=False)
async def openapi_tags(request: Request):
    """列出所有 OpenAPI tag 及其端点数."""
    from fastapi.openapi.utils import get_openapi

    app = request.app
    schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )
    # 统计每个 tag 的端点数
    tag_counts: dict[str, int] = {}
    for path_data in schema.get("paths", {}).values():
        for method_data in path_data.values():
            for tag in method_data.get("tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
    return {
        "total_paths": len(schema.get("paths", {})),
        "total_tags": len(tag_counts),
        "tags": dict(sorted(tag_counts.items(), key=lambda x: -x[1])),
    }


@router.get("/openapi/tag/{tag_name}", tags=["OpenAPI"], include_in_schema=False)
async def openapi_by_tag(tag_name: str, request: Request):
    """获取指定 tag 的 OpenAPI 子文档."""
    from fastapi.openapi.utils import get_openapi

    app = request.app
    schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )
    # 过滤 paths: 只保留包含指定 tag 的端点
    filtered_paths: dict[str, Any] = {}
    for path, path_data in schema.get("paths", {}).items():
        for method, method_data in path_data.items():
            if tag_name in method_data.get("tags", []):
                if path not in filtered_paths:
                    filtered_paths[path] = {}
                filtered_paths[path][method] = method_data
    if not filtered_paths:
        return JSONResponse(
            status_code=404,
            content={"code": "404000", "msg": f"tag '{tag_name}' not found"},
        )
    # 输出过滤后的 schema
    new_schema = dict(schema)
    new_schema["paths"] = filtered_paths
    return new_schema


# ---------------------------------------------------------------------------
# Prometheus /metrics endpoint
# ---------------------------------------------------------------------------
@router.get("/metrics", tags=["Monitor"], include_in_schema=False)
async def metrics():
    from app.monitoring import render_metrics

    return render_metrics()


# ---------------------------------------------------------------------------
# Admin /admin static page (avoid SPA catch-all)
# ---------------------------------------------------------------------------
@router.get("/admin", include_in_schema=False)
async def admin_page():
    from fastapi.responses import FileResponse

    # static 目录位于 <server>/app/static; 本模块位于 <server>/app/api/,
    # 因此需要向上一级 (..) 再进入 static.
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    index = os.path.join(static_dir, "admin", "index.html")
    if os.path.isfile(index):
        return FileResponse(index)
    return {"message": "Admin UI not found"}


# ---------------------------------------------------------------------------
# Circuit breaker status / reset (容错与故障恢复)
# ---------------------------------------------------------------------------
@router.get("/resilience", include_in_schema=False)
async def resilience_status():
    from app.resilience import all_snapshots

    return all_snapshots()


@router.post("/resilience/reset/{circuit_name}", include_in_schema=False)
async def reset_circuit(circuit_name: str):
    from app.resilience import _CIRCUITS

    cb = _CIRCUITS.get(circuit_name)
    if not cb:
        return JSONResponse(
            status_code=404,
            content={"error": "circuit not found", "name": circuit_name},
        )
    cb.reset()
    return {"reset": circuit_name, "state": cb.state}


# ---------------------------------------------------------------------------
# Health checks (K8s liveness / readiness probes, 兼容旧 /healthz)
# ---------------------------------------------------------------------------
@router.get(
    "/healthz",
    tags=["Health"],
    summary="Health check (K8s livenessProbe)",
    include_in_schema=False,
)
async def healthz():
    """For Docker HEALTHCHECK / K8s livenessProbe / load balancer health checks."""
    try:
        from app.telemetry import is_telemetry_enabled

        telemetry_on = is_telemetry_enabled()
    except Exception:
        telemetry_on = False
    return {
        "status": "ok",
        "service": "zhs-platform",
        "version": "1.0.0",
        "telemetry": "enabled" if telemetry_on else "disabled",
    }


@router.get(
    "/ready",
    tags=["Health"],
    summary="Readiness check (K8s readinessProbe)",
    include_in_schema=False,
)
async def ready():
    """深度检查: DB / Redis / 关键模型.

    任意核心依赖失败 → 返回 503, K8s 不会把流量打过来.
    """
    checks: dict = {}
    overall_ok = True

    # 1) DB 连通性
    try:
        from sqlalchemy import text

        from app.database import engine1

        with engine1.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as e:
        checks["database"] = {"status": "fail", "error": str(e)[:200]}
        overall_ok = False

    # 2) Redis 连通性
    try:
        from app.utils.redis_util import check_health

        redis_ok = check_health()
        checks["redis"] = {"status": "ok" if redis_ok else "fail"}
        if not redis_ok:
            overall_ok = False
    except Exception as e:
        checks["redis"] = {"status": "fail", "error": str(e)[:200]}
        overall_ok = False

    # 3) Liveness 信号
    checks["service"] = {"status": "ok", "version": "1.0.0"}

    status_code = 200 if overall_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ok" if overall_ok else "degraded", "checks": checks},
    )

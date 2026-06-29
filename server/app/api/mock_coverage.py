"""Mock 路由覆盖率报告.

端点: /api/mock/coverage
返回:
  - 总 v1 路由数
  - 总 mock 路由数
  - 哪些 v1 端点有 mock 覆盖, 哪些没有
  - 哪些 mock 端点没有对应 v1 端点 (孤儿 mock)
"""

from fastapi import APIRouter

router = APIRouter(tags=["Mock"])


def _normalize_path(path: str) -> str:
    """规范化路径用于匹配 (兼容 /api/v1/xxx 和 /api/xxx).

    规则:
      1. 移除 /api/v1 前缀 -> 路径变为 /xxx
      2. 把数字和 UUID 替换为占位符
      3. mock 路径 (如 /api/xxx) 移除 /api 前缀 -> 同样变为 /xxx
      这样 /api/v1/auth/login 和 /api/auth/login 可视为同类
    """
    import re

    # 移除前缀 (顺序: 长前缀先)
    for prefix in ("/api/v1", "/prod-api", "/coze", "/api"):
        if path.startswith(prefix):
            path = path[len(prefix):]
            break
    # 数字 / uuid -> {id}
    path = re.sub(r"/[0-9a-f]{8}-[0-9a-f-]{27,}", "/{uuid}", path)
    path = re.sub(r"/\d+", "/{id}", path)
    return path.rstrip("/")


def _normalize_param_path(path: str) -> str:
    """把 /api/v1/users/{user_id} 形式保留为模板."""
    return path


def _collect_routes(app_or_router) -> list[tuple[str, str]]:
    """递归收集所有路由 (method, path_template)."""
    routes = []
    if hasattr(app_or_router, "routes"):
        for r in app_or_router.routes:
            if hasattr(r, "routes"):
                # 子 router
                routes.extend(_collect_routes(r))
            elif hasattr(r, "path") and hasattr(r, "methods"):
                for m in r.methods:
                    if m == "HEAD":
                        continue
                    routes.append((m, r.path))
    return routes


@router.get("/api/mock/coverage", summary="Mock 路由覆盖率报告", include_in_schema=False)
async def mock_coverage():
    """对比 v1 路由 vs mock 路由, 输出覆盖率报告.

    设计:
      - 比较按 规范化 path (e.g. /api/v1/auth/exist/138xxx 和 /api/v1/auth/auth/exist/{phone} 视为同类)
      - 输出未覆盖的 v1 端点 (建议添加 mock)
      - 输出孤儿 mock 端点 (v1 没有对应实现, 可能是遗留)
      - 通用 catch-all 路由 (如 /api/{path:path}) 视为全覆盖
    """

    from app.api.mock import api_router as mock_api
    from app.api.mock import coze_router as mock_coze
    from app.api.mock import prod_router as mock_prod
    from app.main import app

    # 收集 v1 路由
    v1_routes = _collect_routes(app)
    v1_paths = {p for _, p in v1_routes if p.startswith("/api/v1/")}

    # 收集 mock 路由
    mock_paths = set()
    catch_all_paths = set()
    for r in _collect_routes(mock_api) + _collect_routes(mock_prod) + _collect_routes(mock_coze):
        # 识别 catch-all: 含 {path:path} 占位符
        if "{path:path}" in r[1] or "{full_path:path}" in r[1]:
            catch_all_paths.add(r[1])
        else:
            mock_paths.add(r[1])

    # 规范化对比
    v1_norm = {_normalize_path(p) for p in v1_paths}
    mock_norm = {_normalize_path(p) for p in mock_paths}

    # v1 中没被 mock 覆盖的
    uncovered = v1_norm - mock_norm
    # mock 中没对应 v1 的 (孤儿)
    orphan = mock_norm - v1_norm
    # 公共 (覆盖)
    covered = v1_norm & mock_norm

    # 存在 catch-all 时, 视为全覆盖 (catch-all 任意 /api/* 都能兜底)
    has_catch_all = bool(catch_all_paths)
    effective_coverage = 100.0 if has_catch_all else round(len(covered) * 100 / max(len(v1_norm), 1), 1)

    return {
        "v1_total": len(v1_paths),
        "mock_total": len(mock_paths) + len(catch_all_paths),
        "mock_explicit": len(mock_paths),
        "mock_catchall": len(catch_all_paths),
        "v1_normalized": len(v1_norm),
        "mock_normalized": len(mock_norm),
        "covered": len(covered),
        "uncovered": len(uncovered),
        "orphan": len(orphan),
        "coverage_rate": effective_coverage,
        "explicit_coverage_rate": round(len(covered) * 100 / max(len(v1_norm), 1), 1),
        "has_catch_all": has_catch_all,
        "catch_all_samples": sorted(catch_all_paths)[:5],
        "uncovered_samples": sorted(uncovered)[:20],
        "orphan_samples": sorted(orphan)[:20],
    }

"""App 启动冒烟: 统计路由 / 前缀分布 / 关键接口健康."""
import sys

# 导入主应用
from app.main import app as fastapi_app
import app.models  # 触发模型注册

# 路由统计
api_routes = [r for r in fastapi_app.routes if hasattr(r, "path") and r.path.startswith("/api/")]
print(f"API 路由数: {len(api_routes)}")
print(f"总路由数: {len(fastapi_app.routes)}")

# 路径前缀分布
prefixes: dict[str, int] = {}
for r in api_routes:
    parts = r.path.split("/")
    p = parts[2] if len(parts) > 2 else "root"
    prefixes[p] = prefixes.get(p, 0) + 1

print("\nAPI 前缀 Top 15:")
for k, v in sorted(prefixes.items(), key=lambda x: -x[1])[:15]:
    print(f"  /api/{k}/... -> {v}")

# 关键接口存在性检查
critical_paths = [
    "/health",
    "/api/v1/auth/login",
    "/api/v1/auth/logout",
    "/api/v1/user/info",
    "/api/v1/system/dict/type/list",
    "/api/v1/user-fund-info/list",
    "/api/v1/agents/category-link/list",
    "/api/v1/user-auth-info/list",
]
all_paths = {r.path for r in fastapi_app.routes}
print("\n关键接口存在性检查:")
for p in critical_paths:
    status = "OK" if p in all_paths else "MISS"
    print(f"  [{status}] {p}")

# 测试用例路由
test_paths = ["/api/v1/user-auth-info/list"]
matched = [p for p in test_paths if p in all_paths]
print(f"\n匹配测试路由: {len(matched)}/{len(test_paths)}")

# 退出码
sys.exit(0 if not [p for p in critical_paths if p not in all_paths] else 1)

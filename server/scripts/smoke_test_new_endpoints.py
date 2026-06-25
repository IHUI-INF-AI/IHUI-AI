"""端到端冒烟测试新端点 - 2026-06-26 对接联调修复后版本"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("=== 端到端冒烟测试 (对接联调修复后) ===")
print()

# 测试健康检查
print("[1] 健康检查")
r = client.get("/health/live")
print(f"    /health/live: {r.status_code}")
assert r.status_code == 200
print("    [OK]")

# 测试 OpenAPI 可访问
print()
print("[2] OpenAPI 可访问性")
r = client.get("/openapi.json")
print(f"    /openapi.json: {r.status_code}")
assert r.status_code == 200
paths = r.json().get("paths", {})
print(f"    总路径数: {len(paths)}")
print("    [OK]")

# 测试新端点路径存在于 OpenAPI 中
print()
print("[3] 新端点路径存在性")
new_path_keywords = [
    "/user/fund",                    # fund_info.py (原 /user-fund-info)
    "/agents/category-link",         # category_link.py
    "/system/dict",                  # dictionary.py
    "/auth_info",                    # legacy_supplement.py (原 /user-auth-info)
    "/auth_accounts",                # legacy_supplement.py (原 /user-third-party-account)
    "/coursePayLog",                 # legacy_supplement.py (原 /course-pay-log)
]
found = 0
for keyword in new_path_keywords:
    matches = [p for p in paths.keys() if keyword in p]
    if matches:
        found += 1
        print(f"    [OK] {keyword}: {len(matches)} 个端点")
    else:
        print(f"    [FAIL] {keyword}: 未找到")
print(f"    找到 {found}/{len(new_path_keywords)} 个关键词")

# 测试具体新端点（需要认证的会返回 401/403/422，证明路由存在）
print()
print("[4] 路由注册验证（未认证应返回 401/403/422，证明路由存在）")
test_endpoints = [
    # fund_info.py (路径改为 /user/fund)
    ("GET", "/api/v1/user/fund"),           # 新增: 当前用户资金信息
    ("GET", "/api/v1/user/fund/list"),      # 列表
    # category_link.py
    ("GET", "/api/v1/agents/category-link/list"),
    # dictionary.py
    ("GET", "/api/v1/system/dict/type/list"),
    ("GET", "/api/v1/system/dict/data/list"),
    ("GET", "/api/v1/system/dict/type/optionselect"),  # 静态路径前置验证
    ("POST", "/api/v1/system/dict/type/export"),       # 新增端点
    # legacy_supplement.py (路径改为对齐前端)
    ("GET", "/api/v1/auth_info/list"),
    ("GET", "/api/v1/auth_accounts/list"),
    ("GET", "/api/v1/coursePayLog/list"),
]
registered = 0
for method, path in test_endpoints:
    try:
        if method == "GET":
            r = client.get(path)
        elif method == "POST":
            r = client.post(path)
        # 401/403/422 都说明路由已注册（只是需要认证或参数）
        if r.status_code in (401, 403, 422, 200, 503):
            registered += 1
            print(f"    [OK] {method} {path}: {r.status_code} (路由已注册)")
        elif r.status_code == 404:
            print(f"    [FAIL] {method} {path}: 404 (路由未注册)")
        else:
            print(f"    [?] {method} {path}: {r.status_code}")
    except Exception as e:
        print(f"    [FAIL] {method} {path}: {e}")
print(f"    {registered}/{len(test_endpoints)} 个端点路由已注册")

print()
print("=== 冒烟测试总结 ===")
print(f"健康检查: OK")
print(f"OpenAPI 路径数: {len(paths)}")
print(f"新端点路由注册: {registered}/{len(test_endpoints)}")
if registered == len(test_endpoints):
    print("[OK] 冒烟测试通过")
else:
    print("[WARN] 部分端点未注册")

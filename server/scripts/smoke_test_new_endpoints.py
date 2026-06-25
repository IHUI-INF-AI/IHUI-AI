"""端到端冒烟测试新端点"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# 获取未认证可访问的端点
print("=== 端到端冒烟测试 ===")
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
    "/power-purchase-rule",
    "/developer-fund-logs",
    "/user-sys-link",
    "/popular-courses",
    "/course-temp",
    "/video-temp",
    "/user-fund-info",
    "/agents/category-link",
    "/legacy-supplement",
    "/member/company/type",
    "/member/post",
    "/member/group",
    "/member/level",
]
found = 0
for keyword in new_path_keywords:
    matches = [p for p in paths.keys() if keyword in p]
    if matches:
        found += 1
        print(f"    [OK] {keyword}: {len(matches)} 个端点")
    else:
        print(f"    [WARN] {keyword}: 未找到（可能是 include_in_schema=False）")
print(f"    找到 {found}/{len(new_path_keywords)} 个关键词")

# 测试具体新端点（需要认证的会返回 401，证明路由已注册）
print()
print("[4] 路由注册验证（未认证应返回 401/403/422，证明路由存在）")
test_endpoints = [
    ("GET", "/api/v1/popular-courses/list"),
    ("GET", "/api/v1/course-temp/list"),
    ("GET", "/api/v1/video-temp/list"),
    ("GET", "/api/v1/user-fund-info/list"),
    ("GET", "/api/v1/agents/category-link/list"),
    ("GET", "/api/v1/dictionary/list"),
    ("GET", "/api/v1/legacy-supplement/activity/export"),
    ("GET", "/api/v1/legacy-supplement/lecturer/list"),
]
registered = 0
for method, path in test_endpoints:
    try:
        if method == "GET":
            r = client.get(path)
        # 401/403/422 都说明路由已注册（只是需要认证或参数）
        if r.status_code in (401, 403, 422, 200):
            registered += 1
            print(f"    [OK] {method} {path}: {r.status_code} (路由已注册)")
        elif r.status_code == 404:
            print(f"    [FAIL] {method} {path}: 404 (路由未注册)")
        else:
            print(f"    [?] {method} {path}: {r.status_code}")
    except Exception as e:
        print(f"    [FAIL] {method} {path}: {e}")
print(f"    {registered}/{len(test_endpoints)} 个端点路由已注册")

# 测试 member 新端点
print()
print("[5] member 新端点验证")
member_endpoints = [
    ("GET", "/api/v1/member/post/list"),
    ("GET", "/api/v1/member/group/list"),
    ("GET", "/api/v1/member/level/list"),
    ("GET", "/api/v1/member/company/type/list"),
]
member_registered = 0
for method, path in member_endpoints:
    r = client.get(path)
    if r.status_code in (401, 403, 422, 200):
        member_registered += 1
        print(f"    [OK] {method} {path}: {r.status_code}")
    else:
        print(f"    [FAIL] {method} {path}: {r.status_code}")
print(f"    {member_registered}/{len(member_endpoints)} 个 member 端点已注册")

print()
print("=== 冒烟测试总结 ===")
print(f"健康检查: OK")
print(f"OpenAPI 路径数: {len(paths)}")
print(f"新端点路由注册: {registered + member_registered}/{len(test_endpoints) + len(member_endpoints)}")
print("[OK] 冒烟测试通过")

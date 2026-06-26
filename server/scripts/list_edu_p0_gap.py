"""导出 70 P0 端点清单 - 用于补迁移."""
import re
from collections import defaultdict
import httpx
import json

# 当前 Python /api/v1/edu/ 端点
r = httpx.get("http://127.0.0.1:8000/openapi.json", timeout=30.0)
spec = r.json()
py_edu_paths = set()
for p in spec.get("paths", {}).keys():
    if "/api/v1/edu/" in p:
        py_edu_paths.add(p)

# ZHS Java legacy 端点
with open(r"g:\IHUI-AI\server\app\api\v1\zhs_server_java_legacy.py", "r", encoding="utf-8") as f:
    content = f.read()
zhs_routes = re.findall(r'@router\.(get|post|put|delete)\(\"([^\"]+)\"', content)

# P0 关键词
P0_KEYWORDS = [
    "pay", "login", "auth", "token", "user", "order", "withdraw", "commission",
    "course", "member", "balance", "recharge", "transfer", "refund", "wx",
    "feedback", "distribution",
]

# 已实现的 P0 edu 端点
py_p0 = set()
for p in py_edu_paths:
    if any(kw in p.lower() for kw in P0_KEYWORDS):
        py_p0.add(p)
print(f"Python /api/v1/edu/ 中 P0 端点: {len(py_p0)}")

# ZHS Java legacy 中 P0 edu 相关端点 (去重映射到 /api/v1/edu/)
zhs_p0 = []
seen = set()
for m, p in zhs_routes:
    if any(kw in p.lower() for kw in P0_KEYWORDS):
        # 映射到 /api/v1/edu/ 路径
        # 简化: /api/{path} -> /api/v1/edu/{path}  保留后段
        # 例如 /api/course/list -> /api/v1/edu/course/list
        # 例如 /api/pay/initiatePay -> /api/v1/edu/pay/initiatePay
        new_path = f"/api/v1/edu{p}"
        key = (m, new_path)
        if key in seen:
            continue
        seen.add(key)
        zhs_p0.append((m, new_path, p))
print(f"ZHS Java legacy 中 P0 edu 端点: {len(zhs_p0)}")

# 对比: ZHS 中的 P0 edu 端点, 哪些 Python edu 还没实现
to_migrate = []
for m, new_path, original in zhs_p0:
    if new_path not in py_edu_paths:
        to_migrate.append((m, new_path, original))

print(f"\n=== 需补迁移 P0 端点: {len(to_migrate)} ===")
for m, np, op in to_migrate:
    print(f"  {m.upper()} {np}  (原: {op})")

# 写入清单
with open("logs/edu_p0_to_migrate.json", "w", encoding="utf-8") as f:
    json.dump({
        "py_p0_count": len(py_p0),
        "zhs_p0_count": len(zhs_p0),
        "to_migrate_count": len(to_migrate),
        "to_migrate": [{"method": m, "new_path": np, "original_path": op} for m, np, op in to_migrate],
    }, f, ensure_ascii=False, indent=2)
print(f"\n清单已写入 logs/edu_p0_to_migrate.json")

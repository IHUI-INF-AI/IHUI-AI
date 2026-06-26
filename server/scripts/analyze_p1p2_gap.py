"""分析 P1/P2 edu 端点缺失来源."""
import re
from collections import defaultdict
import httpx
import json

# 1. 当前 Python /api/v1/edu/ 端点
r = httpx.get("http://127.0.0.1:8000/openapi.json", timeout=30.0)
spec = r.json()
py_edu_paths = set()
for p in spec.get("paths", {}).keys():
    if "/api/v1/edu/" in p:
        py_edu_paths.add(p)
print(f"=== 当前 Python /api/v1/edu/ 端点: {len(py_edu_paths)} ===")

# 2. ZHS Java legacy 端点全集
with open(r"g:/IHUI-AI/server/app/api/v1/zhs_server_java_legacy.py", "r", encoding="utf-8") as f:
    content = f.read()
zhs_routes = re.findall(r'@router\.(get|post|put|delete)\(\"([^\"]+)\"', content)
print(f"=== ZHS Java legacy 端点: {len(zhs_routes)} ===")

# 3. RuoYi legacy 端点
with open(r"g:/IHUI-AI/server/app/api/v1/ruoyi_legacy_supplement.py", "r", encoding="utf-8") as f:
    content2 = f.read()
ruoyi_routes = re.findall(r'@router\.(get|post|put|delete)\(\"([^\"]+)\"', content2)
print(f"=== RuoYi legacy 端点: {len(ruoyi_routes)} ===")

# 4. RuoYi CRUD batch 端点
with open(r"g:/IHUI-AI/server/app/api/v1/ruoyi_legacy_crud_batch.py", "r", encoding="utf-8") as f:
    content3 = f.read()
ruoyi_crud_routes = re.findall(r'@router\.(get|post|put|delete)\(\"([^\"]+)\"', content3)
print(f"=== RuoYi CRUD batch 端点: {len(ruoyi_crud_routes)} ===")

# 5. edu_legacy_supplement_v2 端点
with open(r"g:/IHUI-AI/server/app/api/v1/edu_legacy_supplement_v2.py", "r", encoding="utf-8") as f:
    content4 = f.read()
edu_v2_routes = re.findall(r'@router\.(get|post|put|delete)\(\"([^\"]+)\"', content4)
print(f"=== edu_legacy_supplement_v2 端点: {len(edu_v2_routes)} ===")

# 6. P1/P2 端点候选: ZHS 中非 P0 关键词的端点
P0_KEYWORDS = [
    "pay", "login", "auth", "token", "user", "order", "withdraw", "commission",
    "course", "member", "balance", "recharge", "transfer", "refund", "wx",
    "feedback", "distribution",
]

# 7. P1/P2 edu 端点
p1p2_edu = []
seen = set()
for m, p in zhs_routes:
    # edu 相关: 涉及课程/学习/认证/订单/支付/用户/分销
    if not any(kw in p.lower() for kw in P0_KEYWORDS):
        new_path = f"/api/v1/edu{p}"
        key = (m, new_path)
        if key in seen:
            continue
        seen.add(key)
        p1p2_edu.append((m, new_path, p))
print(f"\n=== ZHS 中 P1/P2 edu 端点: {len(p1p2_edu)} ===")
for m, np, op in p1p2_edu[:30]:
    print(f"  {m.upper()} {np}")

# 8. RuoYi legacy edu 相关
ruoyi_edu = []
seen = set()
for m, p in ruoyi_routes:
    if any(kw in p.lower() for kw in P0_KEYWORDS + ["agent", "knowledge", "category", "list", "search", "info", "profile", "log", "stat", "export", "import", "config", "setting"]):
        new_path = f"/api/v1/edu{p}"
        key = (m, new_path)
        if key in seen:
            continue
        seen.add(key)
        ruoyi_edu.append((m, new_path, p))
print(f"\n=== RuoYi legacy 中 edu 相关端点: {len(ruoyi_edu)} ===")
for m, np, op in ruoyi_edu[:30]:
    print(f"  {m.upper()} {np}")

# 9. RuoYi CRUD batch edu 相关
ruoyi_crud_edu = []
seen = set()
for m, p in ruoyi_crud_routes:
    if any(kw in p.lower() for kw in P0_KEYWORDS + ["agent", "knowledge", "category", "list", "search", "info", "profile", "log", "stat", "export", "import", "config", "setting", "tag", "dict", "type", "data", "menu", "role", "user", "dept", "post", "notice"]):
        new_path = f"/api/v1/edu{p}"
        key = (m, new_path)
        if key in seen:
            continue
        seen.add(key)
        ruoyi_crud_edu.append((m, new_path, p))
print(f"\n=== RuoYi CRUD batch 中 edu 相关端点: {len(ruoyi_crud_edu)} ===")
for m, np, op in ruoyi_crud_edu[:30]:
    print(f"  {m.upper()} {np}")
print(f"  ... (总 {len(ruoyi_crud_edu)} 个)")

# 10. edu_legacy_supplement_v2 (8 端点)
print(f"\n=== edu_legacy_supplement_v2 (8) ===")
for m, p in edu_v2_routes:
    new_path = f"/api/v1/edu{p}"
    print(f"  {m.upper()} {new_path}")

# 11. 总结
total_candidate = len(p1p2_edu) + len(ruoyi_edu) + len(ruoyi_crud_edu) + len(edu_v2_routes)
print(f"\n=== 总结 ===")
print(f"  ZHS P1/P2 edu: {len(p1p2_edu)}")
print(f"  RuoYi legacy edu: {len(ruoyi_edu)}")
print(f"  RuoYi CRUD edu: {len(ruoyi_crud_edu)}")
print(f"  edu_legacy v2: {len(edu_v2_routes)}")
print(f"  总候选: {total_candidate}")

# 写入
with open(r"g:/IHUI-AI/server/logs/edu_p1p2_candidates.json", "w", encoding="utf-8") as f:
    json.dump({
        "zhs_p1p2": [{"method": m, "new_path": np, "original": op} for m, np, op in p1p2_edu],
        "ruoyi_legacy": [{"method": m, "new_path": np, "original": op} for m, np, op in ruoyi_edu],
        "ruoyi_crud": [{"method": m, "new_path": np, "original": op} for m, np, op in ruoyi_crud_edu],
        "edu_v2": [{"method": m, "new_path": np, "original": op} for m, p in edu_v2_routes for np in [f"/api/v1/edu{p}"]],
        "total_candidate": total_candidate,
    }, f, ensure_ascii=False, indent=2)
print(f"\n候选清单已写入 logs/edu_p1p2_candidates.json")

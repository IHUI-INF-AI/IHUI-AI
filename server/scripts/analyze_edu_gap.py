"""分析 edu 端点覆盖 - 完整对比."""
import re
from collections import defaultdict
import httpx

# 1. 当前 Python /api/v1/edu/ 端点
r = httpx.get("http://127.0.0.1:8000/openapi.json", timeout=30.0)
spec = r.json()
py_edu_paths = set()
for p in spec.get("paths", {}).keys():
    if "/api/v1/edu/" in p:
        py_edu_paths.add(p)
print(f"=== 当前 Python /api/v1/edu/ 端点: {len(py_edu_paths)} ===")

# 2. ZHS Java legacy 端点全集
with open(r"g:\IHUI-AI\server\app\api\v1\zhs_server_java_legacy.py", "r", encoding="utf-8") as f:
    content = f.read()
zhs_routes = re.findall(r'@router\.(get|post|put|delete)\(\"([^\"]+)\"', content)
print(f"=== ZHS Java legacy 端点: {len(zhs_routes)} ===")

# 3. edu 子域内端点 (按 P0/P1/P2 划分)
# P0: 核心业务 (支付/认证/订单/账户/关键数据)
P0_KEYWORDS = [
    "pay", "login", "auth", "token", "user", "order", "withdraw", "commission",
    "course", "member", "balance", "recharge", "transfer", "refund", "wx",
]
# P1: 重要业务
P1_KEYWORDS = ["agent", "knowledge", "category", "list", "search", "info", "profile"]
# P2: 辅助/统计
P2_KEYWORDS = ["stat", "log", "export", "import", "report", "config", "setting"]

# 4. 当前 Python edu 端点 (P0/P1/P2 分类)
py_p0 = set()
py_p1 = set()
py_p2 = set()
for p in py_edu_paths:
    # 按子域分类
    parts = p.split("/")
    domain = parts[4] if len(parts) > 4 else "root"
    # 简化: 所有 edu 域都算 P0-P2 待定
    if any(kw in p.lower() for kw in P0_KEYWORDS):
        py_p0.add(p)
    elif any(kw in p.lower() for kw in P1_KEYWORDS):
        py_p1.add(p)
    else:
        py_p2.add(p)
print(f"\n=== Python edu 端点分类 ===")
print(f"  P0 (含核心业务关键词): {len(py_p0)}")
print(f"  P1 (含重要业务关键词): {len(py_p1)}")
print(f"  P2 (其它): {len(py_p2)}")

# 5. 列出已注册的所有 edu 子域端点
print(f"\n=== 按子域 ===")
by_domain = defaultdict(int)
for p in py_edu_paths:
    parts = p.split("/")
    domain = parts[4] if len(parts) > 4 else "root"
    by_domain[domain] += 1
for d, n in sorted(by_domain.items()):
    print(f"  {d}: {n}")

# 6. edu P0 端点已覆盖数量 (基于 ZHS Java legacy 中的 edu 相关路径对比)
print(f"\n=== ZHS Java legacy 中 edu 相关端点 (按主题) ===")
zhs_edu_p0 = []
for m, p in zhs_routes:
    if any(kw in p.lower() for kw in P0_KEYWORDS):
        zhs_edu_p0.append((m, p))
print(f"edu P0 相关 (在 ZHS Java legacy): {len(zhs_edu_p0)}")
for m, p in zhs_edu_p0:
    print(f"  {m.upper()} /api{p}")

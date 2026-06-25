"""统计 legacy_compat.py 中所有剩余 stub 端点 (按 Service 域分布)."""
import re
from collections import Counter, defaultdict
from pathlib import Path

t = Path("g:/IHUI-AI/server/app/api/legacy_compat.py").read_text(encoding="utf-8")
matches = re.findall(r'"Legacy stub: ([^"]+) \(([^)]+)\)"', t)
by_svc = Counter()
for path, ctrl in matches:
    by_svc[ctrl] += 1
print(f"Total remaining stubs: {len(matches)}")
print(f"Total unique controllers: {len(by_svc)}")
print("\n按 Controller 分布 (前 30):")
for n, cnt in sorted(by_svc.items(), key=lambda x: -x[1])[:30]:
    print(f"  {cnt:4d}  {n}")

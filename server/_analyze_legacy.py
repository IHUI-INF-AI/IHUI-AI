"""统计 legacy_compat.py 中各 Controller 的 stub 数量."""
import re
from collections import Counter
from pathlib import Path

t = Path("app/api/legacy_compat.py").read_text(encoding="utf-8")
matches = re.findall(r'"Legacy stub: ([^"]+) \(([^)]+)\)"', t)
c = Counter(x[1] for x in matches)
print(f"Total stubs: {len(matches)}")
print(f"Total controllers: {len(c)}")
print("\n按 Controller 统计:")
for n, cnt in sorted(c.items(), key=lambda x: -x[1]):
    print(f"  {cnt:4d}  {n}")

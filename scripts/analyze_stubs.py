#!/usr/bin/env python3
"""分析 legacy_compat.py 中的 stub 端点分布."""
import re
import pathlib
from collections import Counter

t = pathlib.Path(r"g:\IHUI-AI\server\app\api\legacy_compat.py").read_text(encoding="utf-8")

# 提取所有 stub 调用 _not_implemented("path", "Controller")
stubs = re.findall(r'_not_implemented\(["\']([^"\']+)["\']\s*,\s*["\']([^"\']+)["\']\)', t)
print(f"总 stub 端点数: {len(stubs)}")
print(f"去重 stub 端点数: {len(set(stubs))}")
print()
c = Counter([s[1] for s in stubs])
print("按 Controller 分布:")
for k, v in c.most_common():
    print(f"  {k}: {v}")
print()
print("去重后按 path -> method 统计:")
unique_paths = sorted(set([s[0] for s in stubs]))
print(f"  unique paths: {len(unique_paths)}")
print()
# 展示每个 Controller 的所有 path
from collections import defaultdict
by_ctrl = defaultdict(set)
for path, ctrl in stubs:
    by_ctrl[ctrl].add(path)
for ctrl in sorted(by_ctrl.keys(), key=lambda k: -len(by_ctrl[k])):
    print(f"--- {ctrl} ({len(by_ctrl[ctrl])} unique paths) ---")
    for p in sorted(by_ctrl[ctrl]):
        print(f"  {p}")
    print()

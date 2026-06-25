"""从 legacy_compat.py 中删除 MemberController 及其 8 个子 Controller 的 stub 路由.

这些 stub 路由已被 v1/member_legacy.py 真实实现替代, 不再需要.
"""
import re
from pathlib import Path

LEGACY = Path("app/api/legacy_compat.py")
text = LEGACY.read_text(encoding="utf-8")
original_lines = text.count("\n")

# 需要清除的 Controller 列表 (已实现到 member_legacy.py)
CONTROLLERS = [
    "MemberController",
    "MemberCompanyController",
    "MemberCompanyTypeController",
    "MemberLevelController",
    "MemberPostController",
    "MemberGroupController",
    "MemberTagController",
    "CheckInController",
    "FollowController",
]

# 删除 stub 块: 匹配 "@router.xxx("/xxx"...)" + "async def legacy_stub_...()" + 文档 + "_not_implemented(...)" + 空行
# 一个完整 stub 是 5 行: decorator, def, docstring, body, blank
pattern = re.compile(
    r'@router\.(get|post|put|delete)\s*\([^)]*?["\']([^"\']+)["\'][^)]*\)\s*\n'
    r'async def legacy_stub_\w+\(request: Request\):\s*\n'
    r'\s+"""Legacy stub: [^"]+ \('
    + '|'.join(CONTROLLERS)
    + r'\)"""\s*\n'
    r'\s+return _not_implemented\([^)]+\)\s*\n\n',
    re.MULTILINE,
)

new_text, count = pattern.subn("", text)
print(f"删除 stub 块: {count} 个")

# 删除未使用的 import (member_legacy 中的 handler)
# 找出所有 import 行
imports_section = re.search(r'(# === 路由定义.*?)\n', new_text)
if imports_section:
    print("保留路由定义段")

# 重新生成统计
stubs_remaining = re.findall(r'"Legacy stub: ([^"]+) \(([^)]+)\)"', new_text)
from collections import Counter
c = Counter(x[1] for x in stubs_remaining)
print(f"\n剩余 stub: {len(stubs_remaining)}")
print(f"剩余 Controller: {len(c)}")
for n, cnt in sorted(c.items(), key=lambda x: -x[1])[:15]:
    print(f"  {cnt:4d}  {n}")

# 写回
LEGACY.write_text(new_text, encoding="utf-8")
print(f"\n已更新: {LEGACY}")
print(f"原行数: {original_lines} -> 新行数: {new_text.count(chr(10))}")

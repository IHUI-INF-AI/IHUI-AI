"""从 legacy_compat.py 中删除 MemberController 及其 8 个子 Controller 的 stub 路由.

按行解析, 安全删除完整 5 行 stub 块.
"""
import re
from pathlib import Path

LEGACY = Path("app/api/legacy_compat.py")
lines = LEGACY.read_text(encoding="utf-8").splitlines(keepends=False)

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
ctrl_pattern = "|".join(re.escape(c) for c in CONTROLLERS)

# stub 块: 5 行
# Line 1: @router.METHOD("path", include_in_schema=False)
# Line 2: async def legacy_stub_XXXX(request: Request):
# Line 3:     """Legacy stub: PATH (CONTROLLER)"""
# Line 4:     return _not_implemented(...)
# Line 5: (空行)

i = 0
removed = 0
out = []
while i < len(lines):
    # 尝试匹配 5 行 stub 块
    if (
        i + 4 < len(lines)
        and re.match(r'@router\.(get|post|put|delete)\s*\(', lines[i])
        and re.match(r'async def legacy_stub_\w+\(request: Request\):', lines[i + 1])
        and re.match(r'\s+"""Legacy stub: ([^"]+) \(([^)]+)\)"""', lines[i + 2])
        and re.match(r'\s+return _not_implemented\(', lines[i + 3])
    ):
        m = re.match(r'\s+"""Legacy stub: ([^"]+) \(([^)]+)\)"""', lines[i + 2])
        if m and re.match(r'^(' + ctrl_pattern + r')$', m.group(2)):
            # 确认是空行
            if i + 4 >= len(lines) or lines[i + 4].strip() == "":
                # 删除这 5 行 (含尾随空行)
                i += 5
                removed += 1
                continue
    out.append(lines[i])
    i += 1

new_text = "\n".join(out) + "\n"
print(f"删除 stub 块: {removed} 个")
print(f"原行数: {len(lines)} -> 新行数: {len(out)}")

# 验证剩余
stubs_remaining = re.findall(r'"Legacy stub: ([^"]+) \(([^)]+)\)"', new_text)
from collections import Counter
c = Counter(x[1] for x in stubs_remaining)
print(f"\n剩余 stub: {len(stubs_remaining)}")
for n, cnt in sorted(c.items(), key=lambda x: -x[1])[:20]:
    print(f"  {cnt:4d}  {n}")

# 验证语法
import ast
try:
    ast.parse(new_text)
    print("\n[OK] Python 语法检查通过")
except SyntaxError as e:
    print(f"\n[ERROR] 语法错误: {e}")

LEGACY.write_text(new_text, encoding="utf-8")
print(f"\n已更新: {LEGACY}")

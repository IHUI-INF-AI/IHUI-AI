"""验证 test_e2e_login.py 的 OUT_DIR 路径不会在 G:\\1/G:\\dev/G:\\tmp 创建."""
import os
import re
import sys

# 模拟 test_e2e_login.py 路径生成
_SERVER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath("tests/test_e2e_login.py")))
OUT_DIR = os.environ.get("ZHS_E2E_OUT_DIR") or os.path.join(_SERVER_ROOT, "pw-output")

print(f"SERVER_ROOT = {_SERVER_ROOT}")
print(f"OUT_DIR     = {OUT_DIR}")

# 关键检查: 路径不能是 G:\1/...\G:\dev/...\G:\tmp\... (盘根下的子目录)
# 注意: G:\IHUI-AI\... 是合法的项目目录, 不算违规
FORBIDDEN_PATTERNS = [
    re.compile(r"^G:\\1(\\|/|$)"),
    re.compile(r"^G:/1(/|$)"),
    re.compile(r"^G:\\dev(\\|/|$)"),
    re.compile(r"^G:/dev(/|$)"),
    re.compile(r"^G:\\tmp(\\|/|$)"),
    re.compile(r"^G:/tmp(/|$)"),
]

is_forbidden = any(p.search(OUT_DIR) for p in FORBIDDEN_PATTERNS)
print(f"在 G:\\1/G:\\dev/G:\\tmp? = {is_forbidden}  (期望 False)")

assert not is_forbidden, f"FAIL: OUT_DIR {OUT_DIR} 命中 G 盘根禁止模式!"
print("PASS: OUT_DIR 不会在 G:\\1/G:\\dev/G:\\tmp 创建")

# 验证目录可写
os.makedirs(OUT_DIR, exist_ok=True)
print(f"OUT_DIR 可写: True (路径: {OUT_DIR})")

# 确认 G 盘根目录现在不存在这些空目录
for p in ["G:\\1", "G:\\dev", "G:\\tmp"]:
    print(f"  {p} exists = {os.path.exists(p)}")

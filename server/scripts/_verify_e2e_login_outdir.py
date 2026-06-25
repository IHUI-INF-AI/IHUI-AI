"""2026-06-25 验证: 模拟导入 test_e2e_login, 确认 OUT_DIR 解析正确, 不再指向 G:\\1\\pw-output"""
import sys
import os
import importlib.util
from pathlib import Path

G1_PREFIX = "g:" + "\\" + "1"  # 避免 f-string 转义问题
G1_PREFIX_LOWER = G1_PREFIX.lower()

TEST_FILE = Path(r"g:\IHUI-AI\server\tests\test_e2e_login.py")

# 读源码, 提取 OUT_DIR 计算逻辑 (避免 import 触发依赖)
text = TEST_FILE.read_text(encoding="utf-8")
# 看 OUT_DIR 是否硬编码 G:\1
hardcoded_str = "r" + '"' + "g:" + "\\" + "1" + "\\" + "pw-output" + '"'
has_hardcoded_g1 = hardcoded_str in text
print(f"test_e2e_login.py 是否还硬编码 G:\\1\\pw-output: {has_hardcoded_g1}")

# 用 importlib 真正加载, 看运行时 OUT_DIR 是什么
spec = importlib.util.spec_from_file_location("test_e2e_login", TEST_FILE)
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
except Exception as e:
    print(f"加载异常 (可能 playwright 缺失): {e}")
    sys.exit(0)

# 检查 OUT_DIR
out_dir = Path(mod.OUT_DIR)
print(f"运行时 OUT_DIR: {out_dir}")
out_dir_str_lower = str(out_dir).lower()
print(f"OUT_DIR 是否在 G:\\1 下: {out_dir_str_lower.startswith(G1_PREFIX_LOWER)}")
print(f"OUT_DIR 父目录是否存在: {out_dir.parent.exists()}")
print(f"OUT_DIR 自身是否存在: {out_dir.exists()}")
print(f"期望路径: g:\\IHUI-AI\\server\\pw-output")
expected = Path(r"g:\IHUI-AI\server\pw-output")
print(f"匹配期望: {out_dir == expected}")

# 检查 G:\1 是否还存在
g1 = Path("G:/1")
print(f"\nG:\\1 是否还存在: {g1.exists()}")
g1_pw = Path("G:/1/pw-output")
print(f"G:\\1\\pw-output 是否还存在: {g1_pw.exists()}")

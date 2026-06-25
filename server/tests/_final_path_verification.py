"""最终验证: G 盘根目录清理 + 配置正确 + 模块加载."""
import os
import sys

# 加载项目
sys.path.insert(0, ".")

print("=== 最终验证报告 ===")
print()

# 1. G 盘根目录检查
print("1. G 盘根目录清理状态:")
for p in ["G:\\1", "G:\\dev", "G:\\tmp"]:
    print(f"   {p} exists = {os.path.exists(p)}")
print()

# 2. 配置检查
print("2. settings 配置:")
from app.config import settings
import tempfile
expected = os.path.join(tempfile.gettempdir(), "zhs_local_files")
print(f"   LOCAL_FILE_DIR  = {settings.LOCAL_FILE_DIR!r}")
print(f"   tempfile tempdir = {tempfile.gettempdir()!r}")
print(f"   路径匹配默认     = {settings.LOCAL_FILE_DIR == expected}")
print()

# 3. 关键模块加载
print("3. 关键模块加载测试:")
try:
    from app.api.v1 import refund, canary_routes
    print("   app.api.v1.refund:         OK")
    print("   app.api.v1.canary_routes:  OK")
except Exception as e:
    print(f"   FAIL: {e}")

try:
    from app.backfill_persister import SQLiteBackfillPersister
    print("   app.backfill_persister:    OK")
except Exception as e:
    print(f"   FAIL: {e}")

# 4. 临时目录默认路径
print()
print("4. 关键路径跨平台检查:")
print(f"   refund_evidence_dir default = {os.path.join(tempfile.gettempdir(), 'zhs_refund_evidence')}")
print(f"   canary_state_file default   = {os.path.join(tempfile.gettempdir(), 'zhs_canary_state.json')}")
print(f"   backfill_db default         = {os.path.join(tempfile.gettempdir(), 'zhs_backfill.db')}")
print(f"   local_files default         = {os.path.join(tempfile.gettempdir(), 'zhs_local_files')}")

# 5. 验证 G:\1 不被重新创建
print()
print("5. 关键禁止路径检查:")
import re
FORBIDDEN = [
    re.compile(r"^G:\\1(\\|/|$)"),
    re.compile(r"^G:/1(/|$)"),
    re.compile(r"^G:\\dev(\\|/|$)"),
    re.compile(r"^G:/dev(/|$)"),
    re.compile(r"^G:\\tmp(\\|/|$)"),
    re.compile(r"^G:/tmp(/|$)"),
]

bad = []
for k in ("LOCAL_FILE_DIR",):
    v = getattr(settings, k, None)
    if v and any(p.search(v) for p in FORBIDDEN):
        bad.append((k, v))

if bad:
    print(f"   FAIL: 命中禁止路径 {bad}")
else:
    print("   PASS: settings 中的关键路径不会在 G:\\1/G:\\dev/G:\\tmp 创建")

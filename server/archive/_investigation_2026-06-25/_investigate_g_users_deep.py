"""深度调查 G:\\Users\\Administrator 内容."""
import os
from pathlib import Path
import datetime

p = Path("G:/Users/Administrator")
print(f"G:\\Users\\Administrator exists: {p.exists()}")
print(f"  mtime: {datetime.datetime.fromtimestamp(p.stat().st_mtime)}")
print(f"  ctime: {datetime.datetime.fromtimestamp(p.stat().st_ctime)}")
print()

print("=== 完整内容树 ===")
for root, dirs, files in os.walk(str(p)):
    rel = os.path.relpath(root, str(p))
    indent = "  " * (rel.count(os.sep) if rel != "." else 0)
    print(f"{indent}{os.path.basename(root) or 'Administrator'}/")
    for f in files:
        fp = os.path.join(root, f)
        try:
            size = os.path.getsize(fp)
            mt = datetime.datetime.fromtimestamp(os.path.getmtime(fp))
            print(f"{indent}  {f}  ({size} bytes, mtime={mt})")
        except OSError as e:
            print(f"{indent}  {f}  (ERROR: {e})")
print()

# 读取所有文件内容（前 1000 字节）
print("=== 文件内容预览 ===")
for root, dirs, files in os.walk(str(p)):
    for f in files:
        fp = os.path.join(root, f)
        try:
            content = Path(fp).read_text(encoding="utf-8", errors="ignore")
            print(f"--- {fp} (前 1000 字符) ---")
            print(content[:1000])
            print()
        except Exception as e:
            print(f"--- {fp} ---")
            print(f"ERROR: {e}")
            print()

"""调查 G:\\Users 目录来源."""
import os
import sys
from pathlib import Path

p = Path("G:/Users")
print(f"G:\\Users exists: {p.exists()}")
if p.exists():
    print(f"G:\\Users is dir: {p.is_dir()}")
    print()
    print("=== 目录内容 ===")
    try:
        for entry in p.iterdir():
            size = "DIR" if entry.is_dir() else f"{entry.stat().st_size} bytes"
            mtime = entry.stat().st_mtime
            import datetime
            mt = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
            print(f"  {entry.name:50s} {size:>15s}  mtime={mt}")
    except PermissionError as e:
        print(f"  PermissionError: {e}")
    print()

    # 找最大的文件/目录
    print("=== 最大子项 ===")
    try:
        items = list(p.iterdir())
        items.sort(key=lambda x: x.stat().st_size if x.is_file() else 0, reverse=True)
        for item in items[:5]:
            if item.is_file():
                print(f"  FILE {item.name}: {item.stat().st_size} bytes")
            else:
                # 递归统计目录大小
                total = 0
                count = 0
                for root, dirs, files in os.walk(str(item)):
                    for f in files:
                        try:
                            total += os.path.getsize(os.path.join(root, f))
                            count += 1
                        except OSError:
                            pass
                print(f"  DIR  {item.name}: {count} files, {total} bytes total")
    except Exception as e:
        print(f"  ERROR: {e}")
else:
    print("G:\\Users 不存在")

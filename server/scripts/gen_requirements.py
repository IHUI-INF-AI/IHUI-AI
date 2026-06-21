"""生成 requirements.txt 与 requirements.lock.txt"""
import subprocess
import sys
from pathlib import Path

req = Path("requirements.txt")
req_lock = Path("requirements.lock.txt")

# 使用 importlib.metadata（Python 3.8+）获取所有已安装包
try:
    from importlib.metadata import distributions
    lines = []
    for dist in sorted(distributions(), key=lambda d: d.metadata["Name"].lower()):
        name = dist.metadata["Name"]
        version = dist.version
        if name and version:
            lines.append(f"{name}=={version}")
    content = "\n".join(lines) + "\n"
    req.write_text(content, encoding="utf-8")
    req_lock.write_text(content, encoding="utf-8")
    print(f"OK 写入 {len(lines)} 个包到 {req} 和 {req_lock}")
except Exception as e:
    print(f"ERROR {e}")
    sys.exit(1)

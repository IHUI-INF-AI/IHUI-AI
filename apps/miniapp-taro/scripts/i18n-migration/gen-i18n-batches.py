"""生成 i18n 全量迁移批次清单 + 提取每个文件硬编码中文行明细。"""
import re
import os
import io
import json

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
OUT = r"G:/IHUI-AI/tmp/i18n-batch"
os.makedirs(OUT, exist_ok=True)

cjk = re.compile(r"[\u4e00-\u9fff]{2,}")
skip_line = re.compile(r"(tt\(|t\(|tList\(|//|/\*|\* |logger|console\.|^import |from '|\$t\()")

files = []
for root, dirs, fs in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in {"assets", "static"}]
    for f in fs:
        if not f.endswith((".tsx", ".ts")):
            continue
        p = os.path.join(root, f).replace(os.sep, "/")
        lines = io.open(p, encoding="utf-8").read().split("\n")
        hits = [i + 1 for i, ln in enumerate(lines) if cjk.search(ln.strip()) and not skip_line.search(ln.strip())]
        if hits:
            files.append({"file": p.replace(SRC + "/", ""), "count": len(hits), "lines": hits})

files.sort(key=lambda x: -x["count"])
io.open(f"{OUT}/manifest.json", "w", encoding="utf-8").write(
    json.dumps(files, ensure_ascii=False, indent=2)
)
total = sum(f["count"] for f in files)
print(f"文件: {len(files)}, 硬编码行: {total}")
# 前 5 预览
for f in files[:5]:
    print(f"  {f['count']:4d}  {f['file']}")

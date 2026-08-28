"""扫描 miniapp-taro 源码中绕过 i18n 的硬编码中文文本(启发式)。"""
import re
import os
import io

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
cjk = re.compile(r"[\u4e00-\u9fff]{2,}")
skip_line = re.compile(
    r"(tt\(|t\(|tList\(|//|/\*|\* |logger|console\.|^import |from '|\$t\()"
)
results = []
total = 0
for root, dirs, files in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in {"assets", "static"}]
    for f in files:
        if not f.endswith((".tsx", ".ts")):
            continue
        p = os.path.join(root, f).replace(os.sep, "/")
        lines = io.open(p, encoding="utf-8").read().split("\n")
        cnt = 0
        for ln in lines:
            s = ln.strip()
            if not cjk.search(s):
                continue
            if skip_line.search(s):
                continue
            cnt += 1
        if cnt:
            results.append((cnt, p))
            total += cnt
results.sort(reverse=True)
print(f"疑似硬编码中文行总数: {total}, 涉及文件: {len(results)}")
print()
for c, p in results[:30]:
    print(f"{c:4d}  {p.replace(SRC, '')}")

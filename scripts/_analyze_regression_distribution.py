"""按文件统计 zh-CN 回归问题数量."""
import re
from pathlib import Path

REPORT = Path(r"g:/IHUI-AI/_zh_cn_full.txt")
content = REPORT.read_text(encoding="utf-8")

files = re.split(r"## locales\\modules\\zh-CN\\", content)[1:]
counts = {}
for f in files:
    name = f.split(".json")[0]
    lines = [l for l in f.split("\n") if re.search(r"\[(zh-en-mixed|value-equals-key)\]", l)]
    counts[name] = len(lines)

print("Top 30 files with most regression:")
for n, c in sorted(counts.items(), key=lambda x: -x[1])[:30]:
    print(f"  {c:4d}  {n}.json")
print()
print("Total files:", len([c for c in counts.values() if c > 0]))
print("Total regressions:", sum(counts.values()))

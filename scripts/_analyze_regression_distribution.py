"""分析 zh-CN 回归报告."""
import json
from collections import Counter
from pathlib import Path

REPORT = Path(r"g:\IHUI-AI\scripts\reports\zh_cn_regression.json")
d = json.loads(REPORT.read_text(encoding="utf-8"))
bf = d["by_file"]

print("=== Top 30 文件 (按总问题数排序) ===")
ranked = sorted(bf.items(), key=lambda x: -len(x[1]))[:30]
for f, items in ranked:
    mix = sum(1 for i in items if i["type"] == "zh-en-mixed")
    eq = sum(1 for i in items if i["type"] == "value-equals-key")
    print(f"  {len(items):3d}  mix={mix:3d}  eq={eq:3d}  {f}")

print()
print("=== value-equals-key 样本 (前 30 个) ===")
all_eq = []
for f, items in bf.items():
    for i in items:
        if i["type"] == "value-equals-key":
            all_eq.append((f, i))
for f, i in all_eq[:30]:
    print(f"  {f}  {i['key']} = {i['value']!r}")
print(f"(共 {len(all_eq)} 个 value-equals-key)")

print()
print("=== zh-en-mixed 样本 (前 30 个) ===")
all_mix = []
for f, items in bf.items():
    for i in items:
        if i["type"] == "zh-en-mixed":
            all_mix.append((f, i))
for f, i in all_mix[:30]:
    print(f"  {f}  {i['key']} = {i['value']!r}")
print(f"(共 {len(all_mix)} 个 zh-en-mixed)")

print()
print("=== zh-en-mixed 类型分布 ===")
mix_types = Counter()
for f, i in all_mix:
    v = i["value"]
    # 分类: 
    # 1. 大写英文词 + 中文 (e.g. "AI基础设施")
    # 2. 中文 + 小写英文 (e.g. "全部 subscription")
    # 3. 纯中文 (排除)
    # 4. 英文 + 中文
    import re
    has_cap_en = bool(re.search(r"[A-Z][A-Za-z0-9]+", v))
    has_lower_en = bool(re.search(r"[a-z][a-z0-9]{2,}", v))
    has_zh = bool(re.search(r"[\u4e00-\u9fa5]", v))
    if has_cap_en and has_zh and not has_lower_en:
        mix_types["A: CapEn+Zh (e.g. AI基础设施)"] += 1
    elif has_lower_en and has_zh and not has_cap_en:
        mix_types["B: LowerEn+Zh (e.g. subscription 已删除)"] += 1
    elif has_cap_en and has_zh and has_lower_en:
        mix_types["C: Mixed (e.g. 全部 subscriptions cleared)"] += 1
    else:
        mix_types["D: Other"] += 1
for k, c in mix_types.most_common():
    print(f"  {c:4d}  {k}")

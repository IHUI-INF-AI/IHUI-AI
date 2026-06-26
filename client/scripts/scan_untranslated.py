"""扫描所有 locale 中"未翻译"的 key (值为英文原文/占位符/等于 key 名)."""
import json
import os
import re
import sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(r"G:\IHUI-AI\client\src\locales\modules")
LOCALES = ["zh-CN", "zh-TW", "en", "ja", "ko"]

# 占位符/未翻译模式
PLACEHOLDER_PATTERN = re.compile(r"^\[ZH:.*\]$|^TODO|^FIXME|^TBD$|^xxx$|^XXX$|^placeholder$")
C2E = re.compile(r"[\u4e00-\u9fff]")  # 中文字符

def is_untranslated(key: str, value: str, locale: str) -> str | None:
    """返回未翻译原因, 翻译正常返回 None."""
    if not isinstance(value, str):
        return "non-string"
    if PLACEHOLDER_PATTERN.match(value):
        return "placeholder"
    # zh-CN 不做 literal-key 检测 (中文 key 配中文 value 是正常的)
    if locale != "zh-CN":
        # 值为 key 名 (e.g. key=foo, value=foo) - 在非 zh-CN 中可能表示未翻译
        if value == key or value == key.split(".")[-1]:
            # 但 key 含中文时不算 (因为 fallback 显示中文是合理的)
            if not C2E.search(value):
                return "literal-key"
    return None

def scan_locale(locale_dir: Path) -> dict[str, list[tuple[str, str, str]]]:
    """返回 module -> [(key, value, reason)]."""
    result: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for f in sorted(locale_dir.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        module = f.stem
        # 递归收集 leaf
        def walk(obj, prefix):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    walk(v, f"{prefix}.{k}" if prefix else k)
            else:
                reason = is_untranslated(prefix, str(obj), locale_dir.name)
                if reason:
                    result[module].append((prefix, str(obj), reason))
        walk(data, "")
    return result

# 加载 5 语言
all_data: dict[str, dict[str, list[tuple[str, str, str]]]] = {}
for loc in LOCALES:
    loc_dir: Path = ROOT / loc
    if not loc_dir.exists():
        # 尝试小写
        alt = ROOT / loc.lower()
        if alt.exists():
            loc_dir = alt
    if not loc_dir.exists():
        print(f"⚠️  {loc} 目录不存在")
        continue
    all_data[loc] = scan_locale(loc_dir)

# 输出统计
print("=" * 70)
print("未翻译/翻译异常 扫描报告")
print("=" * 70)
total_by_locale = {loc: 0 for loc in LOCALES}
for loc in LOCALES:
    if loc not in all_data:
        continue
    cnt = sum(len(v) for v in all_data[loc].values())
    total_by_locale[loc] = cnt
    print(f"\n{loc}: {cnt} 处翻译异常 (跨 {len(all_data[loc])} 个 module)")
    # Top 10 module
    top = sorted(all_data[loc].items(), key=lambda x: -len(x[1]))[:15]
    for mod, items in top:
        print(f"  {mod}: {len(items)}")
        for key, val, reason in items[:3]:
            print(f"    - [{reason}] {key} = '{val[:60]}'")

# 计算"5 语言全未翻译"的 key (核心遗漏)
print("\n" + "=" * 70)
print("5 语言全未翻译的 key (核心遗漏, 优先级最高)")
print("=" * 70)
untranslated_in_all: dict[str, int] = defaultdict(int)
for loc in LOCALES:
    if loc not in all_data:
        continue
    for mod, items in all_data[loc].items():
        for key, val, reason in items:
            untranslated_in_all[key] += 1

truly_untranslated = sorted([k for k, v in untranslated_in_all.items() if v >= 4])  # 至少 4 个语言未翻译
print(f"\n至少 4 个语言都未翻译的 key: {len(truly_untranslated)} 个")
# 按 module 统计
by_mod: dict[str, list[str]] = defaultdict(list)
for k in truly_untranslated:
    by_mod[k.split(".")[0]].append(k)
for mod, keys in sorted(by_mod.items(), key=lambda x: -len(x[1])):
    print(f"  {mod}: {len(keys)}")

# 保存详细报告
report_path = Path(r"G:\IHUI-AI\client\scripts\reports\untranslated-keys-report.json")
report_path.parent.mkdir(parents=True, exist_ok=True)
report = {
    "generatedAt": "2026-06-26T12:30:00Z",
    "summary": {
        "totalUntranslatedByLocale": total_by_locale,
        "trulyUntranslatedCount": len(truly_untranslated),
        "byModule": {mod: len(keys) for mod, keys in by_mod.items()},
    },
    "byLocale": {loc: {mod: [{"key": k, "value": v, "reason": r} for k, v, r in items] for mod, items in data.items()} for loc, data in all_data.items()},
    "trulyUntranslatedKeys": truly_untranslated,
}
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n📝 详细报告: {report_path}")

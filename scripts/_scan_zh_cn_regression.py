"""扫描 zh-CN 翻译回归并输出 JSON 报告 (按问题类型 + 文件归类).

输出到 scripts/reports/zh_cn_regression.json:
{
  "stats": {
    "total_files": 430,
    "bad_files": 281,
    "zh_en_mixed": 1956,
    "value_equals_key": 634,
    "residual_zh": 0
  },
  "by_file": {
    "about.json": [
      {"key": "AI基础设施", "value": "AI基础设施", "type": "zh-en-mixed", "leaf": "AI基础设施"},
      ...
    ]
  }
}
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(r"g:\IHUI-AI\client\src\locales\modules\zh-CN")
OUT_PATH = Path(r"g:\IHUI-AI\scripts\reports\zh_cn_regression.json")
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

if not ROOT.exists():
    print(f"[FATAL] zh-CN 模块目录不存在: {ROOT}", file=sys.stderr)
    sys.exit(1)

# 允许的纯英文短词 (合理术语)
ALLOWED_PURE_ENGLISH = {
    "id", "Id", "ID", "ip", "IP", "ai", "AI", "ui", "UI", "url", "URL", "uri", "URI",
    "json", "JSON", "xml", "XML", "html", "HTML", "css", "CSS", "js", "JS", "ts", "TS",
    "vue", "Vue", "VUE", "react", "React", "node", "Node", "npm", "NPM",
    "ok", "OK", "no", "No", "NO", "yes", "Yes", "YES",
    "title", "name", "type", "status", "code", "msg", "data", "time", "date",
    "user", "admin", "token", "icon", "logo", "tag", "tags", "label", "value",
    "true", "false", "null", "undefined",
    "min", "max", "total", "page", "size", "limit", "offset",
    "asc", "desc",
    "row", "col", "rowIndex", "colIndex", "rowKey",
    "rowClassName", "headerRowClassName", "cellClassName", "headerCellClassName",
    "showOverflowTooltip", "formatter",
    "PC", "Mac", "iOS", "Android", "Windows", "Linux", "Web", "App", "H5",
    "VIP", "USD", "CNY", "EUR", "JPY", "KRW", "TWD", "RMB", "UUID",
    "am", "pm", "AM", "PM",
    "Step", "Step1", "Step2", "Step3",
    "bi", "Bi", "BI",
    "edu", "Edu", "EDU",
    "k12", "K12",
    "Vip", "vip",
    "ot", "OT",
    "to", "from", "by", "at", "in", "of",
    "Sub", "sub",
    "titleEn", "subtitleEn", "descEn",
}


def is_zh_en_mixed(value: str) -> bool:
    """值含中文 + 英文混杂."""
    has_zh = bool(re.search(r"[\u4e00-\u9fa5]", value))
    has_en = bool(re.search(r"[A-Za-z]", value))
    return has_zh and has_en


def is_pure_english_key_like(value: str) -> bool:
    """值是纯英文 (camelCase/PascalCase 形式), 不在允许列表中."""
    if not re.match(r"^[A-Za-z][A-Za-z0-9]*$", value):
        return False
    if value in ALLOWED_PURE_ENGLISH:
        return False
    return True


def walk(obj, prefix: str, results: list):
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_prefix = f"{prefix}.{k}" if prefix else k
            walk(v, new_prefix, results)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            new_prefix = f"{prefix}[{i}]"
            walk(v, new_prefix, results)
    else:
        results.append((prefix, obj))


by_file: dict[str, list[dict]] = {}
total_files = 0
total_zh_en_mixed = 0
total_value_equals_key = 0

for json_path in sorted(ROOT.rglob("*.json")):
    total_files += 1
    try:
        with json_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[ERROR] 解析失败 {json_path}: {e}")
        continue
    leaves: list[tuple[str, object]] = []
    walk(data, "", leaves)
    bad: list[dict] = []
    for full_key, value in leaves:
        if not isinstance(value, str):
            continue
        leaf_key = full_key.split(".")[-1] if "." in full_key else full_key
        if is_zh_en_mixed(value):
            bad.append({
                "key": full_key,
                "value": value,
                "type": "zh-en-mixed",
                "leaf": leaf_key,
            })
            total_zh_en_mixed += 1
        elif is_pure_english_key_like(value):
            bad.append({
                "key": full_key,
                "value": value,
                "type": "value-equals-key",
                "leaf": leaf_key,
            })
            total_value_equals_key += 1
    if bad:
        rel = json_path.relative_to(ROOT.parent).as_posix()
        by_file[rel] = bad

report = {
    "stats": {
        "total_files": total_files,
        "bad_files": len(by_file),
        "zh_en_mixed": total_zh_en_mixed,
        "value_equals_key": total_value_equals_key,
        "total": total_zh_en_mixed + total_value_equals_key,
    },
    "by_file": by_file,
}

OUT_PATH.write_text(
    json.dumps(report, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

print(f"扫描完成: {total_files} 个 zh-CN 模块")
print(f"发现回归: {len(by_file)} 个文件")
print(f"  zh-en-mixed:    {total_zh_en_mixed}")
print(f"  value-equals-key: {total_value_equals_key}")
print(f"  total:          {total_zh_en_mixed + total_value_equals_key}")
print(f"\n报告写入: {OUT_PATH}")

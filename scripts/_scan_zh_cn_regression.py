"""更精准的 zh-CN 翻译回归扫描器.

修复了 _scan_zh_cn_regression.py 的过宽匹配问题:
- {count} {amount} {name} 等占位符不视为混杂
- AI/API/ID/URL 等通用缩写视为合法
- 时间/数字单位 (min/max/sec/...) 不视为混杂
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

# 通用英文缩写 (允许出现)
ALLOWED_ABBREVIATIONS = {
    "id", "Id", "ID", "ip", "IP", "ai", "AI", "ui", "UI", "ux", "UX",
    "url", "URL", "uri", "URI", "uuid", "UUID",
    "json", "JSON", "xml", "XML", "html", "HTML", "css", "CSS", "scss", "SCSS",
    "js", "JS", "ts", "TS", "jsx", "tsx", "vue", "Vue", "VUE",
    "react", "React", "node", "Node", "npm", "NPM", "yarn", "Yarn",
    "ok", "OK", "no", "No", "NO", "yes", "Yes", "YES",
    "og", "OG", "seo", "SEO",
    "api", "API", "rpc", "RPC", "rest", "REST",
    "sdk", "SDK", "cli", "CLI", "gui", "GUI", "ide", "IDE",
    "vip", "VIP", "vip", "Vip",
    "pc", "PC", "mac", "Mac", "ios", "iOS", "android", "Android",
    "windows", "Windows", "linux", "Linux", "web", "Web", "app", "App", "h5", "H5",
    "mini", "Mini",
    "pwa", "PWA", "spa", "SPA", "ssr", "SSR", "csr", "CSR",
    "to", "To", "by", "By", "of", "Of", "in", "In", "on", "On", "at", "At",
    "for", "For", "and", "And", "or", "Or", "as", "As",
    "min", "Min", "max", "Max", "avg", "Avg", "sum", "Sum", "cnt", "Cnt",
    "p", "P", "i", "I", "n", "N", "k", "K", "m", "M", "b", "B",
    "kb", "KB", "mb", "MB", "gb", "GB", "tb", "TB",
    "px", "em", "rem", "fr",
    "am", "pm", "AM", "PM",
    "Step", "step",
    "bi", "Bi", "BI",
    "edu", "Edu", "EDU",
    "k12", "K12", "k-12", "K-12",
    "v", "V", "r", "R",
    "asc", "desc",
    "row", "col", "Row", "Col", "idx", "Idx",
    "plus", "Plus", "minus", "Minus",
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "h", "H", "m", "M", "s", "S", "d", "D", "w", "W",
    "x", "X", "y", "Y", "z", "Z",
    "ipAddress", "ip_address", "ipaddress",
    "href", "Href", "src", "Src", "alt", "Alt",
    "titleEn", "subtitleEn", "descEn",
    "rl", "RL",
    "OT", "ot",
    "sub", "Sub",
    "notarize", "notarized",
    "AI", "it", "IT", "PR", "pr",
    "JR", "jr", "SR", "sr",
    "HD", "hd", "SD", "sd", "FHD", "fhd", "4K", "8K",
    "g", "G", "kg", "KG", "mg", "MG", "cm", "CM", "mm", "MM",
    "3D", "3d", "2D", "2d",
    "OAuth", "JWT", "SSO", "CDN", "DNS", "HTTP", "HTTPS", "TCP", "UDP",
    "AES", "DES", "RSA", "SHA", "MD5",
    "EU", "US", "UK", "JP", "KR",
    "ATM", "POS", "CRM", "ERP", "OA",
    "B2B", "B2C", "C2C", "B2G", "G2B", "G2C",
    "PC", "TV", "AR", "VR", "MR", "XR",
    "BPM", "KPI", "ROI", "GMV", "ARPU", "DAU", "MAU",
    "Q1", "Q2", "Q3", "Q4",
    "H5", "P5",
    "5G", "4G", "3G", "2G",
    "PDF", "Word", "Excel", "PPT",
    "VIP", "vip",
}

# 占位符/变量名模式 (允许英文)
PLACEHOLDER_PATTERN = re.compile(r"\{[^{}]*?\}")
VARIABLE_PATTERN = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_.\-]*(?::[^}]+)?\}")
URL_PATTERN = re.compile(r"https?://\S+|/[a-zA-Z][\w./\-]+")


def strip_allowed(value: str) -> str:
    """剥离开放的英文缩写 + 占位符 + URL, 只保留剩余文本."""
    # 1. 移除 {xxx} 占位符
    v = PLACEHOLDER_PATTERN.sub(" ", value)
    # 2. 移除 URL
    v = URL_PATTERN.sub(" ", v)
    # 3. 把连续大写缩写替换掉 (如 AI API VIP)
    # 匹配: 连续 2-6 个大写字母, 紧跟边界
    v = re.sub(r"\b[A-Z][A-Z0-9]{1,5}\b", " ", v)
    # 4. 把单个数字 + 字母 (如 4K, 3D) 替换掉
    v = re.sub(r"\b\d+[A-Za-z]{1,3}\b", " ", v)
    # 5. 把常见的允许缩写替换掉 (作为单词匹配)
    for ab in sorted(ALLOWED_ABBREVIATIONS, key=len, reverse=True):
        v = re.sub(rf"\b{re.escape(ab)}\b", " ", v, flags=re.IGNORECASE)
    return v


def is_zh_en_mixed(value: str) -> bool:
    """剥离允许内容后仍有中英混杂."""
    stripped = strip_allowed(value)
    has_zh = bool(re.search(r"[\u4e00-\u9fa5]", stripped))
    has_en = bool(re.search(r"[A-Za-z]{2,}", stripped))
    return has_zh and has_en


def is_pure_english_key_like(value: str) -> bool:
    """值是纯英文 (camelCase/PascalCase 形式), 不在允许列表中."""
    if not re.match(r"^[A-Za-z][A-Za-z0-9]*$", value):
        return False
    if value in ALLOWED_ABBREVIATIONS:
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

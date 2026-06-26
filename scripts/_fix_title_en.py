"""批量修复 home.json 中所有 titleEn 回归: 恢复为纯英文紧凑形式."""
import re
import sys
from pathlib import Path

# 已知需要修复的 titleEn 模式: 含有 CJK 字符 + " · " + 英文
# 直接把所有 titleEn 中包含 CJK 字符的值还原为纯英文
PATTERN = re.compile(r'"titleEn"\s*:\s*"([^"]*)"')

# 修复表: 路径 -> 期望的纯英文值
# 通过原始 en/home.json 确定期望值
EN_HOME = Path(r"g:\IHUI-AI\client\src\locales\modules\en\home.json")

import json
en_data = json.loads(EN_HOME.read_text(encoding="utf-8"))


def collect_title_en(obj, prefix, results):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "titleEn" and isinstance(v, str):
                results.append((prefix, v))
            collect_title_en(v, prefix + "." + k if prefix else k, results)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            collect_title_en(v, prefix + f"[{i}]", results)


en_title_ens = {}
collect_title_en(en_data, "", [(p, v) for p, v in []])

# 收集所有 en/home.json 中的 titleEn 路径和值
en_titles = []
collect_title_en(en_data, "", en_titles)
en_path_to_value = {p: v for p, v in en_titles}
print(f"en/home.json titleEn 数量: {len(en_path_to_value)}")

# 期望的纯英文值
EXPECTED = {}
for p, v in en_titles:
    EXPECTED[p] = v
    # 一些变体: 嵌套 key 路径

# 修复 4 个文件
for lang in ["zh-CN", "zh-TW", "ja", "ko"]:
    p = Path(rf"g:\IHUI-AI\client\src\locales\modules\{lang}\home.json")
    if not p.exists():
        print(f"[SKIP] {p} 不存在")
        continue
    data = json.loads(p.read_text(encoding="utf-8"))
    # 递归修复
    fixed = 0
    def fix_title_en(obj, prefix=""):
        global fixed
        if isinstance(obj, dict):
            for k, v in list(obj.items()):
                if k == "titleEn" and isinstance(v, str):
                    has_cjk = bool(re.search(r"[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]", v))
                    if has_cjk:
                        # 找对应 en 的值
                        if prefix in en_path_to_value:
                            obj[k] = en_path_to_value[prefix]
                            fixed += 1
                            print(f"  [{lang}] {prefix}.titleEn: {v!r} -> {obj[k]!r}")
                        else:
                            # 取英文部分
                            en_part = v.split("·")[-1].strip() if "·" in v else v
                            obj[k] = en_part
                            fixed += 1
                            print(f"  [{lang}] {prefix}.titleEn: {v!r} -> {obj[k]!r} (fallback)")
                fix_title_en(v, prefix + "." + k if prefix else k)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                fix_title_en(v, prefix + f"[{i}]")
    fix_title_en(data)
    # 写回
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[OK] {lang} 修复了 {fixed} 处")

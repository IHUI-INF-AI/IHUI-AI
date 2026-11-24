# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""pass8(收尾):处理剩余可迁移尾料。
1) 模块级 return '中文' / 赋值 '中文'
2) 同行富文本 moreText/text: '中文<span...>'
3) JSX 动态拼接 {var}中文 → {var}{tt('key','中文')}
4) 参数默认值 title = '中文' → 模块级 t()
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, r"G:/IHUI-AI/tmp")
from codemod_common import load_existing_value_map, ns_from_file

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
FRAG = r"G:/IHUI-AI/tmp/i18n-batch/frag-codemod8.json"

CJK = re.compile(r"[\u4e00-\u9fff]")
RE_RETURN = re.compile(r"(\breturn\s+)(')((?:[^'\\]|\\.)*[\u4e00-\u9fff](?:[^'\\]|\\.)*)\2")
RE_FIELD_RICH = re.compile(r"(\b(?:moreText|text|content|title|desc|label|name):\s*)(')((?:[^'\\]|\\.)*[\u4e00-\u9fff](?:[^'\\]|\\.)*)\2")
RE_DEFAULT = re.compile(r"^(\s*)([A-Za-z0-9_]+)\s*=\s*(')((?:[^'\\]|\\.)*[\u4e00-\u9fff](?:[^'\\]|\\.)*)\3(\s*,?\s*)$")
RE_JSX_SUFFIX = re.compile(r"(\}\s*)([^<>{}\n]*[\u4e00-\u9fff][^<>{}\n]*)$")


def main():
    manifest = json.load(io.open(r"G:/IHUI-AI/tmp/i18n-batch/manifest.json", encoding="utf-8"))
    existing = load_existing_value_map()
    frag = {}
    touched = 0
    for entry in manifest:
        rel = entry["file"]
        if re.match(r"^(i18n/|.*\.config\.ts$|.*__tests__/.*)", rel):
            continue
        path = f"{SRC}/{rel}"
        if not os.path.exists(path):
            continue
        lines = io.open(path, encoding="utf-8").read().split("\n")
        ns = ns_from_file(rel)
        seq = [0]
        used_t = [False]

        def get_key(txt):
            t = txt.strip()
            if t in existing:
                return existing[t]
            seq[0] += 1
            key = f"{ns}.z{seq[0]}"
            frag[key] = t
            return key

        changed = False
        for i, l in enumerate(lines):
            s = l.strip()
            if not CJK.search(s) or s.startswith(("//", "*", "/*")):
                continue
            if re.search(r"(tt\(|t\(|tf\(|tr\(|useTt|useI18n|TtFn)", s):
                continue
            new = l
            # 1) return '中文'
            new = RE_RETURN.sub(
                lambda m: (used_t.__setitem__(0, True), f"{m.group(1)}t('{get_key(m.group(3))}')")[1], new
            )
            # 2) 同行富文本字段
            new = RE_FIELD_RICH.sub(
                lambda m: (used_t.__setitem__(0, True), f"{m.group(1)}t('{get_key(m.group(3))}')")[1], new
            )
            # 3) 参数默认值(仅组件签名区域,用模块级 t)
            dm = RE_DEFAULT.match(l)
            if dm and dm.group(4):
                used_t[0] = True
                new = f"{dm.group(1)}{dm.group(2)} = t('{get_key(dm.group(4))}'){dm.group(5)}"
            # 4) JSX 后缀 {expr}中文(跳过模板字符串行)
            if "`" not in l:
                new = RE_JSX_SUFFIX.sub(
                    lambda m: (used_t.__setitem__(0, True), f"{m.group(1)}{{tt('{get_key(m.group(2))}', '{m.group(2)}')}}")[1], new
                )
            if new != l:
                lines[i] = new
                changed = True
        if changed:
            src = "\n".join(lines)
            if used_t[0]:
                has_t = any(
                    re.search(r"(^|,)\s*t\s*(,|$)", x.split("}")[0])
                    for x in lines if x.startswith("import ") and "from '@/i18n'" in x
                )
                if not has_t:
                    ls = src.split("\n")
                    last = max((j for j, x in enumerate(ls) if x.startswith("import ")), default=-1)
                    ls.insert(last + 1, "import { t } from '@/i18n'")
                    src = "\n".join(ls)
            io.open(path, "w", encoding="utf-8", newline="\n").write(src)
            touched += 1
    io.open(FRAG, "w", encoding="utf-8").write(json.dumps(frag, ensure_ascii=False, indent=2))
    print(f"pass8 处理文件: {touched}, 新增 key: {len(frag)}")


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

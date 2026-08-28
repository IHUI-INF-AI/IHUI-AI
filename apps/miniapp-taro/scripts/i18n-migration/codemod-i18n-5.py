"""
i18n codemod 第五遍(收尾):
1) 模块级嵌套数组/对象中的 '中文' 字符串 → t('ns.key')(模块级 t);
2) VipBenefitsPopup 富文本 content(跨行字符串,含 span) → tt('ns.key', '原文')(工厂内 tt)。
幂等:已含 t(/tt( 的行跳过。
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, r"G:/IHUI-AI/tmp")
from codemod_common import load_existing_value_map, ns_from_file

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
OUT = r"G:/IHUI-AI/tmp/i18n-batch"
FRAG = f"{OUT}/frag-codemod5.json"

CJK = re.compile(r"[\u4e00-\u9fff]")
# 通用字符串值: (?:key:|[   ,  ) '中文'
RE_STR = re.compile(r"(:|\{|,|\()\s*(['\"])([^'\"\n]*[\u4e00-\u9fff][^'\"\n]*)\2")
# 跨行富文本 content: content: 换行 '....<span>...'
RE_CONTENT_OPEN = re.compile(r"^\s*(content|description|text|title):\s*$")
RE_STR_LINE = re.compile(r"^\s*(['\"])([^'\"\n]*[\u4e00-\u9fff][^'\"\n]*)\2\s*,?\s*$")


def main():
    manifest = json.load(io.open(f"{OUT}/manifest.json", encoding="utf-8"))
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
        src = io.open(path, encoding="utf-8").read()
        if "TtFn" in src:
            fn = "tt"
            need_hook = False  # 工厂参数已有 tt;组件内也可能需要
        else:
            fn = "t"
        ns = ns_from_file(rel)
        seq = [0]
        used_fn = [False]

        def get_key(text, prefix="q"):
            t = text.strip()
            if t in existing:
                return existing[t]
            seq[0] += 1
            key = f"{ns}.{prefix}{seq[0]}"
            frag[key] = t
            return key

        lines = src.split("\n")
        changed = False
        i = 0
        while i < len(lines):
            s = lines[i].strip()
            if not CJK.search(s):
                i += 1
                continue
            if s.startswith(("//", "*", "/*")) or re.search(r"(tt\(|t\(|tf\(|tr\(|useTt)", s):
                i += 1
                continue
            if re.search(r"\$\{", s):  # 模板插值跳过
                i += 1
                continue
            # 1) 通用字符串值(模块级/组件内均可,用 t 或 tt)
            def repl(mm):
                used_fn[0] = True
                return f"{mm.group(1)} {fn}('{get_key(mm.group(3))}')"
            new = RE_STR.sub(repl, lines[i])
            if new != lines[i]:
                lines[i] = new
                changed = True
                i += 1
                continue
            # 2) 跨行富文本: content: 后一行是 '.....'
            if RE_CONTENT_OPEN.match(lines[i]) and i + 1 < len(lines):
                m = RE_STR_LINE.match(lines[i + 1])
                if m and "<span" in m.group(2):
                    txt = m.group(2)
                    key = get_key(txt)
                    if fn == "tt":
                        lines[i + 1] = f"        {fn}('{key}', '{txt}')," if m.group(3) else f"        {fn}('{key}', '{txt}')"
                    else:
                        lines[i + 1] = f"        {fn}('{key}')," if m.group(3) else f"        {fn}('{key}')"
                    changed = True
                    i += 2
                    continue
            i += 1

        if changed:
            out = "\n".join(lines)
            if used_fn[0]:
                if fn == "tt":
                    from codemod_common import ensure_tt
                    out, _ = ensure_tt(out, False)
                else:
                    if "import { t } from '@/i18n'" not in out:
                        ls = out.split("\n")
                        last = max((i2 for i2, l2 in enumerate(ls) if l2.startswith("import ")), default=-1)
                        ls.insert(last + 1, "import { t } from '@/i18n'")
                        out = "\n".join(ls)
            io.open(path, "w", encoding="utf-8", newline="\n").write(out)
            touched += 1

    io.open(FRAG, "w", encoding="utf-8").write(json.dumps(frag, ensure_ascii=False, indent=2))
    print(f"第五遍处理文件: {touched}, 新增 key: {len(frag)}")


if __name__ == "__main__":
    main()

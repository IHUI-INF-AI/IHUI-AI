"""
i18n codemod 第六遍(最终收尾):覆盖 pass1-5 未命中的剩余模式
1) 数组字面量 ['中文' 形式(group1 增加 [)
2) 跨行富文本 content: 下一行单引号长字符串(含 span,允许内部双引号)
3) 纯中文模板字符串(无 ${} 插值)整体转换
幂等:已含 tt(/t(/tf(/tr( 的行跳过
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, r"G:/IHUI-AI/tmp")
from codemod_common import (
    RE_COMPONENT_START,
    ensure_tt,
    load_existing_value_map,
    ns_from_file,
)

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
OUT = r"G:/IHUI-AI/tmp/i18n-batch"
FRAG = f"{OUT}/frag-codemod6.json"

CJK = re.compile(r"[\u4e00-\u9fff]")
RE_STR = re.compile(r"(^|:|\||\[|\{|,|\()\s*(['\"])([^'\"\n]*[\u4e00-\u9fff][^'\"\n]*)\2")
MULTI_CALL = re.compile(r"(tt|t|tf|tr|tList)\(\s*$")
RE_CONTENT_OPEN = re.compile(r"^\s*(content|description|text|title|label|subtitle|tip|desc):\s*$")
RE_SINGLE_LONG = re.compile(r"^\s*'((?:[^'\\]|\\.)*[\u4e00-\u9fff](?:[^'\\]|\\.)*)'\s*,?\s*$")
RE_BACKTICK = re.compile(r"^(\s*)(`)([^`]*[\u4e00-\u9fff][^`]*)\2\s*,?\s*$")


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
        lines = io.open(path, encoding="utf-8").read().split("\n")
        ns = ns_from_file(rel)
        seq = [0]
        used = {"tt": False, "t": False}

        def get_key(text):
            t = text.strip()
            if t in existing:
                return existing[t]
            seq[0] += 1
            key = f"{ns}.r{seq[0]}"
            frag[key] = t
            return key
        # 作用域
        scope = []
        ctx = "module"
        for l in lines:
            if l and not l[0].isspace():
                if l.startswith("}"):
                    if ctx == "param":
                        ctx = "component" if "{" in l else "param"
                    scope.append(ctx)
                    continue
                if RE_COMPONENT_START.match(l):
                    ctx = "param" if l.rstrip().endswith("({") else "component"
                else:
                    ctx = "module"
                scope.append(ctx)
            else:
                scope.append(ctx)
        changed = False
        i = 0
        while i < len(lines):
            s = lines[i].strip()
            if not CJK.search(s):
                i += 1
                continue
            if s.startswith(("//", "*", "/*")) or re.search(r"(tt\(|t\(|tf\(|tr\(|useTt|useI18n)", s):
                i += 1
                continue
            if re.search(r"\$\{", s):
                i += 1
                continue
            # 多行 i18n 调用参数行(向上 3 行内)(tt|t|tf|tr|tList)( 结尾)跳过
            if any(MULTI_CALL.search(lines[j].strip()) for j in range(max(0, i - 3), i)):
                i += 1
                continue
            in_comp = scope[i] == "component"
            fn = "tt" if in_comp else "t"

            def repl(mm):
                used[fn] = True
                key = get_key(mm.group(3))
                if fn == "tt":
                    return f"{mm.group(1)} {fn}('{key}', '{mm.group(3)}')"
                return f"{mm.group(1)} {fn}('{key}')"
            new = RE_STR.sub(repl, lines[i])
            if new != lines[i]:
                lines[i] = new
                changed = True
                i += 1
                continue
            # 跨行富文本/长字符串
            if RE_CONTENT_OPEN.match(lines[i]) and i + 1 < len(lines):
                m = RE_SINGLE_LONG.match(lines[i + 1])
                if m:
                    txt = m.group(1)
                    key = get_key(txt)
                    comma = "," if lines[i + 1].rstrip().endswith(",") else ""
                    if fn == "tt":
                        lines[i + 1] = f"        {fn}('{key}', '{txt}'){comma}"
                    else:
                        lines[i + 1] = f"        {fn}('{key}'){comma}"
                    changed = True
                    i += 2
                    continue
            # 纯中文反引号模板
            m = RE_BACKTICK.match(lines[i])
            if m:
                txt = m.group(3)
                key = get_key(txt)
                comma = "," if lines[i].rstrip().endswith(",") else ""
                if fn == "tt":
                    lines[i] = f"{m.group(1)}{{{fn}('{key}', '{txt}')}}{comma}"
                else:
                    lines[i] = f"{m.group(1)}{{{fn}('{key}')}}{comma}"
                changed = True
                i += 1
                continue
            i += 1

        if changed:
            out = "\n".join(lines)
            if used["tt"]:
                out, _ = ensure_tt(out, False)
            if used["t"] and "import { t } from '@/i18n'" not in out and "useI18n, t" not in out and "useTt, t" not in out and ", t }" not in out:
                ls = out.split("\n")
                last = max((i2 for i2, l2 in enumerate(ls) if l2.startswith("import ")), default=-1)
                ls.insert(last + 1, "import { t } from '@/i18n'")
                out = "\n".join(ls)
            io.open(path, "w", encoding="utf-8", newline="\n").write(out)
            touched += 1

    io.open(FRAG, "w", encoding="utf-8").write(json.dumps(frag, ensure_ascii=False, indent=2))
    print(f"第六遍处理文件: {touched}, 新增 key: {len(frag)}")


if __name__ == "__main__":
    main()

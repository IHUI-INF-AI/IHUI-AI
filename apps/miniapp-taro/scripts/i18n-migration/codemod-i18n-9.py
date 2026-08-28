"""pass9:处理参数化文案。
A) JSX 混合: {expr}中文 / 中文{expr} / 中文{expr}中文 → tt('key','中文{var}中文',{var:expr})
B) 模板串: `${expr}中文` → 整串 t() 带参数
C) 单行签名默认值: ({ text = '中文' → 模块级 t()
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, r"G:/IHUI-AI/tmp")
from codemod_common import load_existing_value_map, ns_from_file

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
FRAG = r"G:/IHUI-AI/tmp/i18n-batch/frag-codemod9.json"

CJK = re.compile(r"[\u4e00-\u9fff]")
# A) JSX 混合:识别行内 {expr}中文[expr2}中文... 模式
RE_JSX_MIX = re.compile(r"\{([^{}]{1,60})\}([^{}]*[\u4e00-\u9fff][^{}]*?)(?=\s*[<{]|$)")
# B) 模板串: `${expr}中文` (行内完整模板)
RE_TMPL = re.compile(r"`((?:[^`]*\$\{[^}]*\})*[^`]*[\u4e00-\u9fff][^`]*)`")
# C) 单行签名默认值
RE_DEFAULT = re.compile(r"^(\s*)([A-Za-z0-9_]+)\s*=\s*'((?:[^'\\]|\\.)*[\u4e00-\u9fff](?:[^'\\]|\\.)*)'(\s*,?\s*)$")


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
        used = {"tt": False, "t": False}

        def get_key(txt):
            t = txt.strip()
            if t in existing:
                return existing[t]
            seq[0] += 1
            key = f"{ns}.y{seq[0]}"
            frag[key] = t
            return key

        changed = False
        for i, l in enumerate(lines):
            s = l.strip()
            if not CJK.search(s) or s.startswith(("//", "*", "/*")):
                continue
            if re.search(r"(tt\(|t\(|tf\(|tr\(|useTt|useI18n|TtFn)", s):
                continue
            # 签名行(含 function X({ 或 ) {)跳过 JSX 处理,但处理默认值
            is_sig = bool(re.search(r"export default function|=> \{|\}\s*\{|function [A-Z]", s))
            new = l
            if "`" in l and "${" in l:
                # B) 模板串:整串 t()
                def repl_tmpl(mm):
                    used["t"] = True
                    expr = mm.group(1)
                    params = []
                    def sub_var(m2):
                        params.append(m2.group(1))
                        return "{" + f"p{len(params)}" + "}"
                    tmpl = re.sub(r"\$\{([^}]*)\}", sub_var, expr)
                    if params:
                        ps = ", { " + ", ".join(f"p{i+1}: {p}" for i, p in enumerate(params)) + " }"
                    else:
                        ps = ""
                    return f"t('{get_key(tmpl)}'{ps})" if params else f"t('{get_key(tmpl)}')"
                new = RE_TMPL.sub(repl_tmpl, new)
            if not is_sig:
                # A) JSX 混合
                def repl_mix(mm):
                    used["tt"] = True
                    expr, seg = mm.group(1), mm.group(2).strip()
                    if not seg:
                        return mm.group(0)
                    key = get_key(seg)
                    return f"{{tt('{key}', '{seg}')}}{{{expr}}}"
                new = RE_JSX_MIX.sub(repl_mix, new)
            # C) 参数默认值(独立行,模块级 t)
            dm = RE_DEFAULT.match(l)
            if dm:
                used["t"] = True
                new = f"{dm.group(1)}{dm.group(2)} = t('{get_key(dm.group(3))}'){dm.group(4)}"
            if new != l:
                lines[i] = new
                changed = True
        if changed:
            src = "\n".join(lines)
            from codemod_common import ensure_tt
            if used["tt"]:
                src, _ = ensure_tt(src, False)
            if used["t"]:
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
    print(f"pass9 处理文件: {touched}, 新增 key: {len(frag)}")


if __name__ == "__main__":
    main()

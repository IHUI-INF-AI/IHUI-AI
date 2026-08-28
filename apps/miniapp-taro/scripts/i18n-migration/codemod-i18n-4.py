"""
i18n codemod 第四遍:处理模板字符串/条件表达式/JSX 混合文本等零散文案。
规则(组件内用 tt,模块级用 t):
  1) 三元条件: ? '中文'  / : '中文'  → ? tt('k','中文') / : tt('k','中文')
  2) 空值合并/或: ?? '中文' / || '中文' → 同上
  3) 模板字符串内的纯中文片段: `${x}中文` / `中文${x}` → 模板内嵌 {tt('k','中文')}
  4) 其他行内中文(赋值/return/比较): = '中文' / return '中文' → 同上
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
FRAG = f"{OUT}/frag-codemod4.json"

CJK = re.compile(r"[\u4e00-\u9fff]")
# 1) 三元/空值合并/或 分支的中文字符串
RE_BRANCH = re.compile(r"(\?\s*|\?\?\s*|\|\|\s*|&&\s*)(['\"])([^'\"\n]*[\u4e00-\u9fff][^'\"\n]*)\2")
# 2) 行内赋值/返回: (?:return |[^标识符]=|===|!==)\s*'中文'(排除 JSX 属性 attr="中文")
RE_ASSIGN = re.compile(r"(\breturn\s+|[^A-Za-z0-9_'\"]\s*=|===|!==)\s*(['\"])([^'\"\n]*[\u4e00-\u9fff][^'\"\n]*)\2")
# 3) 模板字符串内中文(已被 ${} 包围的上下文)
RE_TEMPLATE_SEG = re.compile(r"(`[^`]*)\$?\{?([^`{}]*[\u4e00-\u9fff][^`{}]*)\}?([^`]*`)")
# 4) 冒号形式(对象属性已在早期处理,这里是三元 false 分支等): 行内 " : '中文'" 且前一个非空白字符不是字母数字_
RE_COLON = re.compile(r"([^A-Za-z0-9_'\"]\s*:\s*)(['\"])([^'\"\n]*[\u4e00-\u9fff][^'\"\n]*)\2")


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
            key = f"{ns}.p{seq[0]}"
            frag[key] = t
            return key

        # 作用域
        scope = []
        signature = [False] * len(lines)
        ctx = "module"
        for li, l in enumerate(lines):
            if RE_COMPONENT_START.match(l):
                signature[li] = True
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

        changed = False
        for k, l in enumerate(lines):
            s = l.strip()
            if not CJK.search(s) or s.startswith(("//", "*", "/*")):
                continue
            if re.search(r"(tt\(|t\(|tf\(|tr\(|useTt|useI18n)", s):
                continue
            # 跳过已有 i18n 的工厂函数行(避免嵌套)
            if "(tt: TtFn)" in s or "const tt = useTt()" in s:
                continue
            if "`" in l and "${" in l:
                continue  # 模板字符串含插值,跳过(动态文案 i18n 价值低且易破坏)
            if signature[k] or scope[k] != "component":
                continue
            in_comp = True
            fn = "tt"
            used[fn] = True
            new = l
            # 1) 三元/合并/或
            def repl_branch(mm):
                return f"{mm.group(1)}{fn}('{get_key(mm.group(3))}', '{mm.group(3)}')" if in_comp else f"{mm.group(1)}{fn}('{get_key(mm.group(3))}')"
            new = RE_BRANCH.sub(repl_branch, new)
            # 2) 赋值/返回
            def repl_assign(mm):
                return f"{mm.group(1)} {fn}('{get_key(mm.group(3))}', '{mm.group(3)}')" if in_comp else f"{mm.group(1)} {fn}('{get_key(mm.group(3))}')"
            new = RE_ASSIGN.sub(repl_assign, new)

            # 4) 冒号分支(仅组件内,避免误伤对象)
            if in_comp:
                def repl_colon(mm):
                    return f"{mm.group(1)}{fn}('{get_key(mm.group(3))}', '{mm.group(3)}')"
                new = RE_COLON.sub(repl_colon, new)
            if new != l:
                lines[k] = new
                changed = True

        if changed:
            src = "\n".join(lines)
            src, _ = ensure_tt(src, False)
            if used["t"] and "import { t } from '@/i18n'" not in src:
                ls = src.split("\n")
                last = max((i2 for i2, l2 in enumerate(ls) if l2.startswith("import ")), default=-1)
                ls.insert(last + 1, "import { t } from '@/i18n'")
                src = "\n".join(ls)
            io.open(path, "w", encoding="utf-8", newline="\n").write(src)
            touched += 1

    io.open(FRAG, "w", encoding="utf-8").write(json.dumps(frag, ensure_ascii=False, indent=2))
    print(f"第四遍处理文件: {touched}, 新增 key: {len(frag)}")


if __name__ == "__main__":
    main()

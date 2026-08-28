"""
i18n codemod 第三遍:处理模块级普通数组/对象的字符串文案 → t('ns.key','中文')。
- 仅处理非工厂的 indent-0 模块级 const 数组/对象(如 const NICKNAMES = [...]),
  块内 '中文' → t('ns.key', '中文');需要 import { t } from '@/i18n'。
- JSX 属性 title="中文" / placeholder='中文' → {tt('ns.key','中文')}(组件内)。
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, r"G:/IHUI-AI/tmp")
from codemod_common import (
    RE_COMPONENT_START,
    ensure_imports,
    ensure_tt,
    load_existing_value_map,
    ns_from_file,
)

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
OUT = r"G:/IHUI-AI/tmp/i18n-batch"
FRAG = f"{OUT}/frag-codemod3.json"

CJK = re.compile(r"[\u4e00-\u9fff]")
DECL = re.compile(r"^(?:export )?const ([A-Za-z_][A-Za-z0-9_]*)\s*(:\s*[^=]+?)?\s*=\s*(\[|\{)\s*$")
RE_STR_VAL = re.compile(r"(:|\[|,)\s*'([^']*[\u4e00-\u9fff][^']*)'")
RE_ATTR = re.compile(r"\b(placeholder|title|label|text|desc|okText|cancelText|confirmText)=(\"|')([^\"']*[\u4e00-\u9fff][^\"']*)(\"|')")
RE_TEMPLATE = re.compile(r"(?:\?\s*|:\s*|\.\s*)'([^']*[\u4e00-\u9fff][^']*)'")


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
        used_module_t = [False]

        def get_key(text, prefix="m"):
            t = text.strip()
            if t in existing:
                return existing[t]
            seq[0] += 1
            key = f"{ns}.{prefix}{seq[0]}"
            frag[key] = t
            return key

        # 1) 模块级普通数组/对象字符串(非工厂)
        i = 0
        changed = False
        while i < len(lines):
            m = DECL.match(lines[i])
            if not m:
                i += 1
                continue
            name, typ, brack = m.group(1), (m.group(2) or "").strip(), m.group(3)
            close = "]" if brack == "[" else "}"
            j = i + 1
            end = None
            while j < len(lines):
                s = lines[j].strip()
                if s.startswith(close):
                    end = j
                    break
                if lines[j] and not lines[j][0].isspace() and j > i and not s.startswith(close):
                    break  # 未闭合(嵌套复杂),放弃
                j += 1
            if end is None:
                i += 1
                continue
            block = "\n".join(lines[i + 1 : end])
            if not CJK.search(block) or "tt(" in block or "t(" in block:
                i = end + 1
                continue

            def repl(mm):
                used_module_t[0] = True
                key = get_key(mm.group(2))
                return f"{mm.group(1)} t('{key}')"
            for k in range(i + 1, end):
                new = RE_STR_VAL.sub(repl, lines[k])
                if new != lines[k]:
                    lines[k] = new
                    changed = True
            i = end + 1

        # 2) JSX 属性 title="中文"(组件内)
        scope = []
        ctx = "module"
        for l in lines:
            if l and not l[0].isspace() and not l.startswith("}"):
                ctx = "component" if RE_COMPONENT_START.match(l) else "module"
            scope.append(ctx)
        for k, l in enumerate(lines):
            if scope[k] != "component" or not CJK.search(l):
                continue
            if re.search(r"^\s*(//|\*)", l.strip()):
                continue

            def repl_attr(mm):
                key = get_key(mm.group(3))
                inner = f"tt('{key}', '{mm.group(3)}')"
                return f"{mm.group(1)}={{{inner}}}"
            new = RE_ATTR.sub(repl_attr, l)
            if new != l:
                lines[k] = new
                changed = True

        if changed:
            src = "\n".join(lines)
            # 组件内属性转换需要 tt hook;模块级数据需要模块级 t
            src, _ = ensure_tt(src, False)
            if used_module_t[0] and "import { t } from '@/i18n'" not in src:
                ls = src.split("\n")
                last = max((i2 for i2, l2 in enumerate(ls) if l2.startswith("import ")), default=-1)
                ls.insert(last + 1, "import { t } from '@/i18n'")
                src = "\n".join(ls)
            io.open(path, "w", encoding="utf-8", newline="\n").write(src)
            touched += 1

    io.open(FRAG, "w", encoding="utf-8").write(json.dumps(frag, ensure_ascii=False, indent=2))
    print(f"第三遍处理文件: {touched}, 新增 key: {len(frag)}")


if __name__ == "__main__":
    main()

"""简单版 i18n import 修复:
1. 删除全部 '@/i18n' import 行,按正文实际出现的符号重建唯一一行。
2. 删除正文无 tt( 调用的 `const tt = useTt()`。
3. 工厂声明块内无 tt( → 恢复普通声明,并回改 NAME(tt) → NAME。
"""
import io
import os
import re

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
KNOWN = ("useTt", "useI18n", "I18nProvider", "TtFn", "Locale", "Messages")
I18N_FROM = re.compile(r"from\s+['\"](?:@/i18n|\.\.?/i18n)['\"]")
IMPORT_RE = re.compile(r"^import\s+")
FACTORY_RE = re.compile(
    r"^(\s*)(?:export )?const ([A-Za-z0-9_]+)(:\s*[^=]+?)?\s*=\s*\(tt: TtFn\)\s*=>\s*(\[|\()"
)
TT_USE = re.compile(r"\btt\(")
CHANGED = 0


def used_pat(sym):
    return re.compile(rf"\b{sym}\b")


def fix(path):
    global CHANGED
    lines = io.open(path, encoding="utf-8").read().split("\n")
    changed = False
    # ---- 1. 删除全部 i18n import(支持多行 import) ----
    drop = set()
    for i, l in enumerate(lines):
        if I18N_FROM.search(l):
            j = i
            while j > 0 and not IMPORT_RE.match(lines[j]):
                j -= 1
            for k in range(j, i + 1):
                drop.add(k)
    lines = [l for i, l in enumerate(lines) if i not in drop]
    # ---- 2. 删除无使用的 const tt = useTt() ----
    body = "\n".join(l for l in lines if not l.startswith("import "))
    used_tt = bool(TT_USE.search(body))
    if not used_tt:
        lines = [l for l in lines if not re.match(r"^\s*const tt = useTt\(\)\s*$", l)]
    # ---- 3. 工厂恢复(块内无 tt( 时) ----
    fixed = []
    i = 0
    while i < len(lines):
        m = FACTORY_RE.match(lines[i])
        if not m:
            fixed.append(lines[i])
            i += 1
            continue
        indent, name, typ, brack = m.group(1), m.group(2), m.group(3) or "", m.group(4)
        close = "]" if brack == "[" else ")"
        j = i + 1
        end = None
        while j < len(lines):
            s = lines[j].strip()
            if brack == "[" and s.startswith("]"):
                end = j
                break
            if brack == "(" and s.startswith("})"):
                end = j
                break
            j += 1
        if end is None:
            fixed.append(lines[i])
            i += 1
            continue
        block = "\n".join(lines[i + 1 : end])
        if TT_USE.search(block):
            fixed.append(lines[i])  # 保留工厂
            i += 1
            continue
        fixed.append(f"{indent}const {name}{typ} = {brack}")
        fixed.extend(lines[i + 1 : end + 1])
        for k in range(end + 1, len(lines)):
            lines[k] = re.sub(rf"\b{name}\(tt\)", name, lines[k])
        i = end + 1
    lines = fixed
    # ---- 4. 重建 '@/i18n' import(排除注释行避免误判) ----
    body = "\n".join(
        l
        for l in lines
        if not l.startswith("import ") and not l.strip().startswith(("//", "*", "/*"))
    )
    specs = [s for s in KNOWN if used_pat(s).search(body)]
    if specs:
        idx = next((i for i, l in enumerate(lines) if l.startswith("import ")), None)
        line = "import { " + ", ".join(specs) + " } from '@/i18n'"
        if idx is None:
            lines.insert(0, line)
        else:
            lines.insert(idx, line)
    out = "\n".join(lines)
    if out != "\n".join(io.open(path, encoding="utf-8").read().split("\n")):
        io.open(path, "w", encoding="utf-8", newline="\n").write(out)
        CHANGED += 1


for root, dirs, files in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in {"assets", "static", "dist", "i18n"}]
    for f in files:
        if f.endswith((".tsx", ".ts")):
            fix(os.path.join(root, f))

print(f"修复文件数: {CHANGED}")

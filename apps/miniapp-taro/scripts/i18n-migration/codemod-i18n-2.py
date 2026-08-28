"""
i18n codemod 第二遍:模块级数据常量(含中文文案)→ 工厂函数 (tt) => 数据。

例:
  const TIERS: Tier[] = [ { nf: '普通会员' } ]
→
  const TIERS = (tt: TtFn): Tier[] => [ { nf: tt('benefits.vip1', '普通会员') } ]
调用点: TIERS.map(...) → TIERS(tt).map(...)

约束:只处理非 export 的顶层常量(避免跨文件用法遗漏);跨文件导出的记入 skip 报告。
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, r'G:/IHUI-AI/tmp')
SKIP_PATH_RE = re.compile(r"^(i18n/|.*\.config\.ts$|.*__tests__/.*)")
from codemod_common import (  # noqa: E402
    RE_COMPONENT_START,
    ensure_tt,
    find_body_start,
    load_existing_value_map,
    ns_from_file,
    tt_call,
)

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
OUT = r"G:/IHUI-AI/tmp/i18n-batch"
MSG = r"G:/IHUI-AI/packages/i18n/messages"
FRAG = f"{OUT}/frag-codemod2.json"
SKIP = f"{OUT}/skip-codemod2.md"

CJK = re.compile(r"[\u4e00-\u9fff]")
DECL = re.compile(r"^const ([A-Za-z_][A-Za-z0-9_]*)\s*(:\s*([^=]+?))?\s*=\s*(\[|\{)\s*$")


RE_STR_VAL = re.compile(r"(:\s*)'([^']*[\u4e00-\u9fff][^']*)'")  # key: '中文'
RE_ARR_STR = re.compile(r"([\[,]\s*)'([^']*[\u4e00-\u9fff][^']*)'")  # ['中文', ...]
RE_JSX_TEXT = re.compile(r"(>)([^<>{}]*[\u4e00-\u9fff][^<>{}]*)(<)")




def main():
    only = sys.argv[1:]
    manifest = json.load(io.open(f"{OUT}/manifest.json", encoding="utf-8"))
    existing = load_existing_value_map()
    frag, skips = {}, []
    touched = 0

    for entry in manifest:
        rel = entry["file"]
        if SKIP_PATH_RE.match(rel):
            continue
        if only and not any(o in rel for o in only):
            continue
        path = f"{SRC}/{rel}"
        if not os.path.exists(path):
            continue
        src = io.open(path, encoding="utf-8").read()
        lines = src.split("\n")
        ns = ns_from_file(rel)
        seq = [0]

        def get_key(text):
            t = text.strip()
            if t in existing:
                return existing[t]
            seq[0] += 1
            key = f"{ns}.d{seq[0]}"
            frag[key] = t
            return key

        changed = False
        i = 0
        while i < len(lines):
            m = DECL.match(lines[i])
            if not m or not lines[i].startswith("const "):
                i += 1
                continue
            name, typ, brack = m.group(1), (m.group(3) or "").strip(), m.group(4)
            close = "]" if brack == "[" else "}"
            # 找结束行(缩进 0 的 close 开头)
            j = i + 1
            end = None
            while j < len(lines):
                if lines[j] and not lines[j][0].isspace() and lines[j].lstrip().startswith(close):
                    end = j
                    break
                if lines[j] and not lines[j][0].isspace() and j > i:
                    break
                j += 1
            if end is None:
                i += 1
                continue
            block = lines[i : end + 1]
            body = "\n".join(block)
            if not CJK.search(body):
                i = end + 1
                continue
            # 跳过含注释中文的块(如类型注释)——仅当没有任何引号字符串含中文
            if not (RE_STR_VAL.search(body) or RE_ARR_STR.search(body)):
                skips.append(f"{rel}:{i+1} 块内无字符串文案(仅注释/类型),跳过")
                i = end + 1
                continue
            # 改造声明行:数组 → => [ ;对象字面量 → => ({
            ret = f": {typ}" if typ else ""
            if brack == "{":
                lines[i] = f"const {name} = (tt: TtFn){ret} => ({{"
            else:
                lines[i] = f"const {name} = (tt: TtFn){ret} => {brack}"
            # 改造块内文案
            for k in range(i + 1, end):
                line = lines[k]
                s = line.strip()
                if s.startswith(("//", "*", "/*")):
                    continue

                def repl_val(mm):
                    return f"{mm.group(1)}{tt_call(get_key(mm.group(2)), mm.group(2))}"
                new = RE_STR_VAL.sub(repl_val, line)
                if new == line:  # 仅当属性形式未命中时,才处理数组内裸字符串(避免嵌套替换)
                    new = RE_ARR_STR.sub(
                        lambda mm: f"{mm.group(1)}{tt_call(get_key(mm.group(2)), mm.group(2))}",
                        line,
                    )
                new = RE_JSX_TEXT.sub(
                    lambda mm: (
                        f"{mm.group(1)}{{{tt_call(get_key(mm.group(2)), mm.group(2))}}}{mm.group(3)}"
                        if mm.group(2).strip()
                        and '<span' not in line
                        and '</span>' not in line
                        and (line[: mm.start()].count("'") + line[: mm.start()].count('"')) % 2 == 0
                        else mm.group(0)
                    ),
                    new,
                )
                if new != line:
                    lines[k] = new
                    changed = True
            # 结束行:对象字面量需补回圆括号(} → }),保留原有后缀(, ;)
            if brack == "{":
                lines[end] = re.sub(r"^\}(\s*[,;]?)\s*$", r"})\1", lines[end])
                changed = True
            # 调用点替换 NAME → NAME(tt),仅限组件函数体内;
            # 若常量在组件参数默认值中被引用(早于函数体,tt 尚不可用),放弃改造该常量
            body = find_body_start(lines)
            if body is not None and any(
                re.search(rf"{name}", l)
                for j, l in enumerate(lines[:body])
                if not (i <= j <= end)
            ):
                skips.append(f"{rel}:{i+1} {name} 在组件参数默认值中引用,跳过改造")
                i = end + 1
                continue
            for k in range(max(end + 1, body or 0), len(lines)):
                line = lines[k]
                if re.search(rf"\b{name}\b", line) and f"{name}(" not in line:
                    lines[k] = re.sub(rf"\b{name}\b(?!\s*\()", f"{name}(tt)", line)
                    changed = True
            i = end + 1

        if changed:
            out = "\n".join(lines)
            if "import { useTt } from '@/i18n'" not in out:
                last_import = max(
                    (i2 for i2, l in enumerate(out.split("\n")) if l.startswith("import ")),
                    default=-1,
                )
                ls = out.split("\n")
                ls.insert(last_import + 1, "import { useTt } from '@/i18n'")
                out = "\n".join(ls)
            if "type TtFn" not in out:
                out = out.replace(
                    "import { useTt } from '@/i18n'",
                    "import { useTt, type TtFn } from '@/i18n'",
                    1,
                )
            out, _ = ensure_tt(out, True)
            io.open(path, "w", encoding="utf-8", newline="\n").write(out)
            touched += 1

    io.open(FRAG, "w", encoding="utf-8").write(json.dumps(frag, ensure_ascii=False, indent=2))
    io.open(SKIP, "w", encoding="utf-8").write(
        "# codemod2 跳过明细\n\n" + "\n".join(f"- {s}" for s in skips)
    )
    print(f"第二遍处理文件: {touched}, 新增 key: {len(frag)}")


if __name__ == "__main__":
    main()

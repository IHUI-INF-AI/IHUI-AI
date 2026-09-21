# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""i18n codemod 公共工具(两遍脚本共用)。"""
import io
import json
import re

MSG_DIR = r"G:/IHUI-AI/packages/i18n/messages"

RE_COMPONENT_START = re.compile(
    r"^(export default function|export default \(|(?:export )?function [A-Z]"
    r"|(?:export )?const [A-Z][A-Za-z0-9]* = \((?!tt: TtFn\))(?:[^)]*\) =>)"
    r"|(?:export )?const [A-Z][A-Za-z0-9]*: (?:React\.)?FC"
    r"|(?:export )?const [A-Z][A-Za-z0-9]* = function)"
)
RE_HOOK_LINE = re.compile(r"^\s{2}(const \[|const .* = use[A-Z]|use[A-Z][a-zA-Z]*\()")
RE_TT_DECL = re.compile(r"^\s*const tt\s*=")


def load_existing_value_map():
    def flat(o, p=""):
        for k, v in o.items():
            key = f"{p}.{k}" if p else k
            if isinstance(v, dict):
                yield from flat(v, key)
            elif isinstance(v, str):
                yield v, key

    m = {}
    for d in ("miniapp-taro", "shared"):
        with io.open(f"{MSG_DIR}/{d}/zh-CN.json", encoding="utf-8") as f:
            for v, k in flat(json.load(f)):
                m.setdefault(v, k)
    return m


def ns_from_file(rel):
    base = rel.rsplit(".", 1)[0]
    parts = [p for p in base.split("/") if p not in ("pages", "components", "index")]
    if not parts:
        parts = [base.replace("/", "")]
    name = "".join(p[0].upper() + p[1:] if i else p for i, p in enumerate(parts))
    return re.sub(r"[^A-Za-z0-9]", "", name)


def tt_call(key, text):
    t = text.strip().replace("\\", "\\\\").replace("'", "\\'")
    return f"tt('{key}', '{t}')"


def find_body_start(lines):
    """组件函数体起始行索引(跳过多行解构参数列表)。"""
    start = next((i for i, l in enumerate(lines) if RE_COMPONENT_START.match(l)), None)
    if start is None:
        return None
    for j in range(start, min(start + 80, len(lines))):
        s = lines[j]
        if not s.strip() or s[0].isspace():
            continue
        if not s.rstrip().endswith("{"):
            continue
        if j == start and s.rstrip().endswith("({"):
            continue  # 多行参数起点,继续找 `}: Props) {`
        return j + 1
    return None


def ensure_imports(lines, need_hook, need_type):
    """确保 '@/i18n' 的 import 含所需符号(useTt / type TtFn),不引入未使用项。"""
    want = []
    if need_hook:
        want.append("useTt")
    if need_type:
        want.append("type TtFn")

    idx = [i for i, l in enumerate(lines) if l.startswith("import ") and "from '@/i18n'" in l]
    if idx:
        line = lines[idx[0]]
        m = re.match(r"^import\s+(?:type\s+)?\{([^}]*)\}\s+from '@/i18n'$", line)
        if m:
            specs = [s.strip() for s in m.group(1).split(",") if s.strip()]
            for w in want:
                if w not in specs:
                    specs.append(w)
            lines[idx[0]] = "import { " + ", ".join(specs) + " } from '@/i18n'"
            return lines
        # 形如 import X from '@/i18n' 的默认导入:另起一行
        insert_at = idx[0] + 1
        lines.insert(insert_at, "import { " + ", ".join(want) + " } from '@/i18n'")
        return lines

    if not want:
        return lines
    last_import = max((i for i, l in enumerate(lines) if l.startswith("import ")), default=-1)
    lines.insert(last_import + 1, "import { " + ", ".join(want) + " } from '@/i18n'")
    return lines


def ensure_tt(src, need_type):
    """确保组件内有可用的 tt(已有自定义 tt 则复用,不重复声明);返回 (新源码, 是否插入了 hook)。"""
    lines = src.split("\n")
    inserted = False
    if not any(RE_TT_DECL.match(l) for l in lines):
        anchor = find_body_start(lines)
        if anchor is None:
            anchor = next((j for j, l in enumerate(lines) if RE_HOOK_LINE.match(l)), None)
        if anchor is not None:
            lines.insert(anchor, "  const tt = useTt()")
            inserted = True
    lines = ensure_imports(lines, inserted, need_type)
    return "\n".join(lines), inserted
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

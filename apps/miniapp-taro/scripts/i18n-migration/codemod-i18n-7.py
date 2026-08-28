"""pass7(最终):处理同行富文本 content 与 adapters FALLBACK 常量 → 模块级 t()。"""
import io
import json
import os
import re

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
FRAG = r"G:/IHUI-AI/tmp/i18n-batch/frag-codemod7.json"

CJK = re.compile(r"[\u4e00-\u9fff]")
# 同行富文本: content: '...中文<span...>...' 或 { id: 9, content: '...' }
RE_INLINE_RICH = re.compile(r"(\bcontent:\s*)(')((?:[^'\\]|\\.)*[\u4e00-\u9fff](?:[^'\\]|\\.)*)\2")
# FALLBACK 常量: const X = '中文' / return '中文' / (): string => '中文'
RE_FB = re.compile(r"(const [A-Za-z0-9_]+ = |=> )(')((?:[^'\\]|\\.)*[\u4e00-\u9fff](?:[^'\\]|\\.)*)\2")

TARGETS = [
    "components/VipBenefitsPopup.tsx",
    "components/adapters/UserInfoCard.taro.tsx",
    "components/adapters/PayButton.taro.tsx",
]


def main():
    frag = {}
    seq = [0]
    existing = {}
    import sys
    sys.path.insert(0, r"G:/IHUI-AI/tmp")
    from codemod_common import load_existing_value_map
    existing = load_existing_value_map()
    touched = 0
    for rel in TARGETS:
        path = f"{SRC}/{rel}"
        if not os.path.exists(path):
            continue
        lines = io.open(path, encoding="utf-8").read().split("\n")
        changed = False
        for i, l in enumerate(lines):
            s = l.strip()
            if not CJK.search(s) or s.startswith(("//", "*", "/*")):
                continue
            if re.search(r"(tt\(|t\(|tf\(|tr\(|useTt)", s):
                continue

            def get_key(txt):
                t = txt.strip()
                if t in existing:
                    return existing[t]
                seq[0] += 1
                key = f"last.{seq[0]}"
                frag[key] = t
                return key

            new = RE_INLINE_RICH.sub(
                lambda m: f"{m.group(1)}t('{get_key(m.group(3))}')", l
            )
            if new == l:
                new = RE_FB.sub(
                    lambda m: f"{m.group(1)}t('{get_key(m.group(3))}')", l
                )
            if new != l:
                lines[i] = new
                changed = True
        if changed:
            src = "\n".join(lines)
            has_t = any(
                re.search(r"(^|,)\s*t\s*(,|$)", x.split("}")[0])
                for x in lines
                if x.startswith("import ") and "from '@/i18n'" in x
            )
            if not has_t:
                ls = src.split("\n")
                last = max((j for j, x in enumerate(ls) if x.startswith("import ")), default=-1)
                ls.insert(last + 1, "import { t } from '@/i18n'")
                src = "\n".join(ls)
            io.open(path, "w", encoding="utf-8", newline="\n").write(src)
            touched += 1
    io.open(FRAG, "w", encoding="utf-8").write(json.dumps(frag, ensure_ascii=False, indent=2))
    print(f"pass7 处理文件: {touched}, 新增 key: {len(frag)}")


if __name__ == "__main__":
    main()

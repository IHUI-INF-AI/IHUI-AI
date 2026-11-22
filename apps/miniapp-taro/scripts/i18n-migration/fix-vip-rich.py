# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""专项:VipBenefitsPopup 富文本 content 跨行字符串 → tt('key', '原文')。"""
import io
import re

PATH = r"G:/IHUI-AI/apps/miniapp-taro/src/components/VipBenefitsPopup.tsx"
OUT = r"G:/IHUI-AI/tmp/i18n-batch/frag-vip.json"

# 富文本行: 行首 '...中文...含 span...' 且上一行是 content:
RE_CONTENT = re.compile(r"^(\s*)(content|description|text|title|label|desc):\s*$")
RE_STR = re.compile(r"^(\s*)'((?:[^'\\]|\\.)*[\u4e00-\u9fff](?:[^'\\]|\\.)*)'\s*,?\s*$")

lines = io.open(PATH, encoding="utf-8").read().split("\n")
frag = {}
seq = [0]
changed = False
i = 0
while i < len(lines):
    m = RE_CONTENT.match(lines[i])
    if m and i + 1 < len(lines):
        sm = RE_STR.match(lines[i + 1])
        if sm:
            txt = sm.group(2)
            seq[0] += 1
            key = f"VipBenefitsPopup.rich{seq[0]}"
            frag[key] = txt
            comma = "," if lines[i + 1].rstrip().endswith(",") else ""
            # 保留原缩进,替换为 tt 调用(工厂内 tt 可用)
            indent = sm.group(1)
            # 模块级普通数组:用模块级 t('key')(fallback 链自动回退 zh-CN)
            lines[i + 1] = f"{indent}t('{key}'){comma}"
            changed = True
            i += 2
            continue
    i += 1

if changed:
    src = "\n".join(lines)
    # 模块级 t 需要 import { t }(检测 import 行是否已含独立 t 符号)
    has_t = any(
        re.search(r"(^|,)\s*t\s*(,|$)", l.split("}")[0])
        for l in lines
        if l.startswith("import ") and "from '@/i18n'" in l
    )
    if not has_t:
        ls = src.split("\n")
        last = max((j for j, l in enumerate(ls) if l.startswith("import ")), default=-1)
        ls.insert(last + 1, "import { t } from '@/i18n'")
        src = "\n".join(ls)
    io.open(PATH, "w", encoding="utf-8", newline="\n").write(src)
    print("VipBenefitsPopup 富文本已转换:", len(frag), "条")
else:
    print("无富文本可转换")

io.open(OUT, "w", encoding="utf-8").write(
    __import__("json").dumps(frag, ensure_ascii=False, indent=2)
)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

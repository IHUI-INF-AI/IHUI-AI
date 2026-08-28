"""为缺失 setNavigationBarTitle 的页面补运行时多语言标题。"""
import io
import json
import os
import re
import sys

sys.path.insert(0, r"G:/IHUI-AI/tmp")
from codemod_common import load_existing_value_map, ns_from_file

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
FRAG = r"G:/IHUI-AI/tmp/i18n-batch/frag-nav.json"
CUSTOM = {"/pages/forgot-password/index", "/pages/index/index", "/pages/login/login", "/pages/user/index"}

existing = load_existing_value_map()
frag = {}
touched = 0

# 收集 config 标题
configs = {}
for root, dirs, fs in os.walk(SRC):
    if "dist" in root or "node_modules" in root:
        continue
    for f in fs:
        if f.endswith(".config.ts"):
            p = os.path.join(root, f).replace(os.sep, "/")
            src = io.open(p, encoding="utf-8").read()
            m = re.search(r"navigationBarTitleText:\s*'([^']+)'", src)
            if m:
                rel = p.replace(SRC, "").replace(".config.ts", "")
                configs[rel] = m.group(1)

for rel, title in configs.items():
    if rel in CUSTOM or rel == "/app":
        continue
    # 定位页面文件
    page = None
    for cand in (f"{SRC}{rel}.tsx", f"{SRC}{rel}/index.tsx"):
        if os.path.exists(cand):
            page = cand
            break
    if not page:
        print("NO PAGE:", rel)
        continue
    src = io.open(page, encoding="utf-8").read()
    if "setNavigationBarTitle" in src:
        continue  # 已有运行时设置
    ns = ns_from_file(rel.lstrip("/"))
    seq = [0]

    def get_key(text):
        if text in existing:
            return existing[text]
        seq[0] += 1
        key = f"{ns}.title"
        # 若 ns.title 冲突(已存在且不同值),追加序号
        frag[key] = text
        return key

    key = get_key(title.strip())
    use_tt = "tt" in src  # 页面是否有 tt 可用
    call = f"{{ title: {('tt' if use_tt else 't')}('{key}', '{title}') }}"
    block = f"  useDidShow(() => {{\n    Taro.setNavigationBarTitle({call})\n  }})\n"
    changed = False
    # 1) 确保 useDidShow import
    if "useDidShow" not in src.split("\n")[0:20]:
        m = re.search(r"(import Taro[^\n]*from '@tarojs/taro')", src)
        if m:
            src = src.replace(m.group(1), "import Taro, { useDidShow } from '@tarojs/taro'", 1)
        else:
            src = "import { useDidShow } from '@tarojs/taro'\n" + src
    # 2) 总是新增 useDidShow 块(组件声明行下一行插入;hooks 可多个)
    lines = src.split("\n")
    from codemod_common import RE_COMPONENT_START
    body_idx = None
    for i, l in enumerate(lines):
        if l and not l[0].isspace() and RE_COMPONENT_START.match(l):
            body_idx = i + 1
            break
    if body_idx is not None and body_idx < len(lines):
        lines.insert(body_idx, block.rstrip("\n"))
        changed = True

    if changed:
        io.open(page, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
        touched += 1
    else:
        print("INSERT FAIL:", rel)

io.open(FRAG, "w", encoding="utf-8").write(json.dumps(frag, ensure_ascii=False, indent=2))
print(f"补标题页面: {touched}, 新增 key: {len(frag)}")

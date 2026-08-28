"""反操作:删除 nav 脚本插入的 setNavigationBarTitle 行与空 useDidShow 块。"""
import io
import os
import re

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"

RE_NAV_LINE = re.compile(r"^\s*Taro\.setNavigationBarTitle\(\{ title: (tt|t)\('")
RE_DS_OPEN = re.compile(r"^\s*useDidShow\(\(\) => \{\s*$")
RE_DS_CLOSE = re.compile(r"^\s*\}\)\s*$")
RE_EMPTY_DS = re.compile(r"useDidShow\(\(\) => \{\s*\}\)")


def fix(path):
    lines = io.open(path, encoding="utf-8").read().split("\n")
    changed = False
    # 1) 删除 nav 插入行
    out = []
    for l in lines:
        if RE_NAV_LINE.match(l):
            changed = True
            continue
        out.append(l)
    # 2) 删除只含 setNavigationBarTitle 的 useDidShow 块
    i = 0
    out2 = []
    while i < len(out):
        if RE_DS_OPEN.match(out[i]):
            # 看块内是否只有 nav 行(已删)或空
            j = i + 1
            body = []
            while j < len(out) and not RE_DS_CLOSE.match(out[j]):
                body.append(out[j])
                j += 1
            if j < len(out) and all(not l.strip() for l in body):
                # 空块(内容只有空行/已删的 nav 行) → 删除整块
                i = j + 1
                changed = True
                continue
            out2.extend(out[i : j + 1])
            i = j + 1
            continue
        out2.append(out[i])
        i += 1
    # 3) 单行空 useDidShow: useDidShow(() => {}) 或 useDidShow(() => { }) → 删
    out3 = []
    for l in out2:
        if RE_EMPTY_DS.search(l):
            changed = True
            continue
        out3.append(l)
    if changed:
        io.open(path, "w", encoding="utf-8", newline="\n").write("\n".join(out3))
        return True
    return False


touched = 0
for root, dirs, fs in os.walk(SRC):
    if "dist" in root or "node_modules" in root:
        continue
    for f in fs:
        if f.endswith((".tsx", ".ts")):
            if fix(os.path.join(root, f)):
                touched += 1
print(f"反操作修改: {touched} 文件")

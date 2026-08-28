"""
miniapp-taro i18n codemod:把 JSX/调用中的硬编码中文文案改为 tt('ns.key', '中文') 调用,
并把新增 key 写入 tmp/i18n-batch/frag-codemod.json(扁平 {key: 中文})。

设计原则(保守、可编译):
1. 只处理缩进 >= 2 空格的行(默认位于 JSX / 组件内),顶层模块常量不处理(避免编译错误),记入 skip 报告。
2. 已存在词典 key(按中文值精确匹配)直接复用,不新增 key。
3. 未命中则按文件命名空间生成语义 key(常见词映射 + 顺序兜底)。
4. 自动补 import { useTt } 与 const tt = useTt();若文件是纯模块无组件,跳过该文件。
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
    load_existing_value_map,
    ns_from_file,
    tt_call,
)

SRC = r"G:/IHUI-AI/apps/miniapp-taro/src"
OUT = r"G:/IHUI-AI/tmp/i18n-batch"
MSG = r"G:/IHUI-AI/packages/i18n/messages"
MANIFEST = f"{OUT}/manifest.json"
FRAG = f"{OUT}/frag-codemod.json"
SKIP = f"{OUT}/skip-codemod.md"

CJK = re.compile(r"[\u4e00-\u9fff]")

# 常见词 → 语义 key 片段
WORD_MAP = {
    "确定": "confirm", "确认": "confirm", "取消": "cancel", "关闭": "close", "返回": "back",
    "提示": "hint", "加载中": "loading", "暂无": "empty", "更多": "more", "搜索": "search",
    "全部": "all", "保存": "save", "删除": "delete", "编辑": "edit", "提交": "submit",
    "成功": "success", "失败": "failed", "设置": "settings", "我的": "mine", "首页": "home",
    "复制": "copy", "分享": "share", "评论": "comment", "点赞": "like", "收藏": "favorite",
    "登录": "login", "注册": "register", "退出": "logout", "立即": "now", "查看": "view",
    "详情": "detail", "列表": "list", "数量": "count", "价格": "price", "订单": "order",
    "支付": "pay", "余额": "balance", "积分": "points", "会员": "vip", "课程": "course",
    "直播": "live", "老师": "teacher", "学生": "student", "时间": "time", "日期": "date",
    "姓名": "name", "手机": "phone", "邮箱": "email", "地址": "address", "备注": "remark",
    "上传": "upload", "下载": "download", "刷新": "refresh", "重试": "retry", "清空": "clear",
    "请选择": "pleaseSelect", "请输入": "pleaseInput", "暂无数据": "noData", "加载失败": "loadFailed",
    "已完成": "done", "待处理": "pending", "已取消": "canceled", "继续": "continue", "下一步": "next",
    "已": "done",
}




def slug(text, seq):
    t = text.strip()
    if t in WORD_MAP:
        return WORD_MAP[t]
    hit = [w for w in WORD_MAP if w in t and len(w) >= 2]
    if hit:
        base = WORD_MAP[max(hit, key=len)]
        return f"{base}{seq}"
    if len(t) > 24:
        return f"para{seq}"
    return f"text{seq}"


# ---------- 变换规则 ----------
RE_JSX_TEXT = re.compile(r"(>)([^<>{}]*[\u4e00-\u9fff][^<>{}]*)(<)")
RE_PURE_TEXT = re.compile(r"^(\s+)([^<>{}`'\"]*[\u4e00-\u9fff][^<>{}`'\"]*)(\s*)$")
RE_ATTR = re.compile(
    r"\b(placeholder|title|confirmText|cancelText|label|text|okText|emptyText|desc|description|subTitle|buttonText|content)"
    r"=(\"|\{')([^\"']*[\u4e00-\u9fff][^\"']*)(\"'|'\})"
)
RE_OBJ_PROP = re.compile(r"\b([A-Za-z][A-Za-z0-9_]*):\s*'([^']*[\u4e00-\u9fff][^']*)'")
RE_COMPONENT_START = re.compile(
    r"^(export default function|export default \(|export function [A-Z]|function [A-Z]"
    r"|export const [A-Z][A-Za-z0-9]* = \(|const [A-Z][A-Za-z0-9]* = \((?!tt: TtFn\))(?:[^)]*\) =>)"
    r"|const [A-Z][A-Za-z0-9]*: (?:React\.)?FC|const [A-Z][A-Za-z0-9]* = function)"
)
RE_CODE_CHARS = re.compile(r"[;:,=\[\](){}]|//|=>")


def main():
    import sys
    manifest = json.load(io.open(MANIFEST, encoding="utf-8"))
    only = sys.argv[1:]
    if only:
        manifest = [m for m in manifest if any(o in m["file"] for o in only)]
    existing = load_existing_value_map()
    frag = {}
    skips = []
    touched = 0
    total_keys = 0

    for entry in manifest:
        rel = entry["file"]
        if SKIP_PATH_RE.match(rel):
            continue
        path = f"{SRC}/{rel}"
        if not os.path.exists(path):
            continue
        src = io.open(path, encoding="utf-8").read()
        lines = src.split("\n")
        ns = ns_from_file(rel)
        # 逐行判定作用域:最近一个顶层(indent 0)语句是组件声明 → 组件内;
        # 是模块级常量/类型 → 模块级(tt 无法在 hook 外调用,跳过)
        scope = []
        ctx = "module"
        for l in lines:
            # 多行解构参数闭合行(如 `}: Props) {`)不重置作用域
            if l and not l[0].isspace() and not l.startswith("}"):
                ctx = "component" if RE_COMPONENT_START.match(l) else "module"
            scope.append(ctx)
        seq = 0
        changed = False
        key_count = 0

        def get_key(text):
            nonlocal seq, key_count
            t = text.strip()
            if t in existing:
                return existing[t], True
            seq += 1
            key_count += 1
            key = f"{ns}.{slug(t, seq)}"
            frag[key] = t
            return key, False

        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or not CJK.search(line):
                continue
            if stripped.startswith(("//", "*", "/*", "import ", "export *", "type ", "interface ")):
                continue
            if re.match(r"^\s*(logger|console)\.", stripped):
                continue
            indent = len(line) - len(line.lstrip())
            if indent < 2 or scope[i] != "component":
                skips.append(f"{rel}:{i+1} 顶层/模块级行未处理: {stripped[:60]}")
                continue
            new_line = line

            # 1) JSX 文本节点:>中文<(跳过字符串字面量内部,如 HTML 片段)
            def repl_jsx(m):
                text = m.group(2)
                if not text.strip() or '<span' in line or '</span>' in line:
                    return m.group(0)
                if (line[: m.start()].count("'") + line[: m.start()].count('"')) % 2 == 1:
                    return m.group(0)  # 位于字符串字面量内,不改写
                key, _ = get_key(text)
                return f"{m.group(1)}{{{tt_call(key, text)}}}{m.group(3)}"
            new_line = RE_JSX_TEXT.sub(repl_jsx, new_line)

            # 2) JSX 属性 placeholder="中文" / title={'中文'}
            def repl_attr(m):
                key, _ = get_key(m.group(3))
                return f"{m.group(1)}={{{tt_call(key, m.group(3))}}}"
            new_line = RE_ATTR.sub(repl_attr, new_line)

            # 3) 对象属性 title: '中文'
            def repl_obj(m):
                key, _ = get_key(m.group(2))
                return f"{m.group(1)}: {tt_call(key, m.group(2))}"
            new_line = RE_OBJ_PROP.sub(repl_obj, new_line)

            # 4) 纯中文独立行(JSX 多行文本节点):必须是纯文本,不含代码符号/行尾注释,
            #    且上一非空行以 '>' 结尾(位于开标签之后)
            prev = next(
                (lines[j] for j in range(i - 1, -1, -1) if lines[j].strip()), ""
            )
            m = RE_PURE_TEXT.match(new_line)
            if (
                m
                and m.group(2).strip()
                and new_line == line
                and not RE_CODE_CHARS.search(m.group(2))
                and prev.rstrip().endswith(">")
            ):
                text = m.group(2).strip()
                key, _ = get_key(text)
                new_line = f"{m.group(1)}{{{tt_call(key, text)}}}"

            if new_line != line:
                lines[i] = new_line
                changed = True

        if changed:
            out = "\n".join(lines)
            out, _ = ensure_tt(out, False)
            io.open(path, "w", encoding="utf-8", newline="\n").write(out)
            touched += 1
            total_keys += key_count

    io.open(FRAG, "w", encoding="utf-8").write(json.dumps(frag, ensure_ascii=False, indent=2))
    io.open(SKIP, "w", encoding="utf-8").write(
        "# codemod 跳过明细\n\n" + "\n".join(f"- {s}" for s in skips)
    )
    print(f"处理文件: {touched}, 新增 key: {total_keys}, 跳过行: {len(skips)}")





if __name__ == "__main__":
    main()

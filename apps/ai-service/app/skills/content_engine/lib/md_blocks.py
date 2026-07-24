# -*- coding: utf-8 -*-
"""
md_blocks.py — 公众号 / DOCX 流水线【唯一】markdown 语法解析源。

设计原则（彻底杜绝"双编译器"）：
    原先 HTML 渲染器(moyu_green_renderer) 与 DOCX 构建器(build_gpt56_sol)
    各自实现了一遍完整的 markdown 语法解析，语法只在某一处修复时必然出现
    "HTML 对、DOCX 残"的回归（已多次踩坑）。本模块把 markdown 语法解析
    收敛为唯一一处 parse_blocks()，HTML 与 DOCX 都消费同一份解析结果，
    结构上不可能再不同步。任何语法变更只改这一处。

块类型(type)与字段：
    h1           text                       （封面已渲染，renderer 忽略其正文段落样式）
    chapter       num(可选), zh              ## 01 标题 / ## 标题
    subtitle      text                       ### 小标题
    paragraph     text                       普通段落（inline ** 加粗保留，由 renderer 展开）
    ul            items:[str]                无序列表
    ol            items:[str]                有序列表
    quote         lines:[str]                引用块（> 多行）
    code          lang, code                 代码块（``` 或 :::code）
    image         alt, src, is_end_support   图片（点赞/关注图 is_end_support=True）
    colon         btype, args, body:[str]     :::oneliner/quote/tip/warning/note
    editor        title, children:[block], end_support  智汇AI悄悄话/编者按/悄悄话/写在最后
"""

import re

# 编辑按语段标题前缀（startswith 对齐 HTML 渲染器的判定口径）
_EDITOR_PREFIXES = ('## 智汇AI悄悄话', '## 编者按', '## 悄悄话', '## 写在最后')
END_SUPPORT_HINTS = ('点赞', '关注')


def _is_end_support(src):
    return any(hint in (src or '') for hint in END_SUPPORT_HINTS)


def parse_blocks(md_text):
    """解析 markdown 文本为语义块列表（唯一语法解析源）。

    解析语义严格对齐已充分验证的 HTML 渲染器主循环，确保下游 renderer
    改写后产物与旧版一致。
    """
    blocks = []
    lines = (md_text or '').splitlines()
    n = len(lines)
    i = 0
    editor = None  # {'type':'editor','title':str,'children':[block],'end_support':bool}

    def close_editor():
        nonlocal editor
        if editor is not None:
            blocks.append(editor)
            editor = None

    while i < n:
        raw = lines[i]
        line = raw.rstrip()

        # 空行：自然间距，不产块
        if not line:
            i += 1
            continue

        # H1 标题：封面已渲染，仅记录供 renderer 选择忽略
        if line.startswith('# ') and not line.startswith('## '):
            blocks.append({'type': 'h1', 'text': line[2:].strip()})
            i += 1
            continue

        # 编辑按语段标题（智汇AI悄悄话 / 编者按 / 悄悄话 / 写在最后）
        if any(line.startswith(p) for p in _EDITOR_PREFIXES):
            close_editor()
            editor = {'type': 'editor', 'title': line[3:].strip(),
                      'children': [], 'end_support': False}
            i += 1
            continue

        # 编辑按语段内部：逐行收集为段落 / 图片
        if editor is not None:
            # 遇到新 H2 章节标题 → 结束 editor 段，交回主流程重新判断此行
            if line.startswith('## ') and not line.startswith('### '):
                close_editor()
                continue
            m = re.match(r'!\[(.*?)\]\((.*?)\)', line)
            if m:
                is_es = _is_end_support(m.group(2) or '')
                editor['children'].append(
                    {'type': 'image', 'alt': m.group(1), 'src': m.group(2), 'is_end_support': is_es})
                if is_es:
                    # 旧逻辑：遇到点赞/关注图即 emit 双按钮并结束 editor 段
                    editor['end_support'] = True
                    close_editor()
                i += 1
                continue
            editor['children'].append({'type': 'paragraph', 'text': line})
            i += 1
            continue

        # H2 章节标题
        if line.startswith('## ') and not line.startswith('### '):
            close_editor()
            heading = line[3:].strip()
            m = re.match(r'^(\d{2})\s+(.+)$', heading)
            if m:
                blocks.append({'type': 'chapter', 'num': m.group(1), 'zh': m.group(2)})
            else:
                blocks.append({'type': 'chapter', 'num': None, 'zh': heading})
            i += 1
            continue

        # H3 小标题
        if line.startswith('### '):
            blocks.append({'type': 'subtitle', 'text': line[4:].strip()})
            i += 1
            continue

        # ::: 块（oneliner/quote/tip/warning/note/code）
        if line.startswith(':::') and not line.startswith('::::'):
            bm = re.match(r'^:::\s*(\w+)(?:\s+(.*))?$', line)
            if bm:
                btype = bm.group(1)
                barg = (bm.group(2) or '').strip()
                # 单行 oneliner/quote：内容同行且源稿通常无闭合 :::，立即成块
                if btype in ('oneliner', 'quote') and barg:
                    blocks.append({'type': 'colon', 'btype': btype, 'args': '', 'body': [barg]})
                    i += 1
                    continue
                # 多行块：收集直到闭合 :::（EOF 无闭合也接受，不丢内容）
                buf = []
                i += 1
                while i < n and lines[i].rstrip() != ':::':
                    buf.append(lines[i])
                    i += 1
                if i < n and lines[i].rstrip() == ':::':
                    i += 1  # 跳过闭合
                if btype == 'code':
                    blocks.append({'type': 'code', 'lang': barg or 'text', 'code': '\n'.join(buf)})
                else:
                    blocks.append({'type': 'colon', 'btype': btype, 'args': barg, 'body': buf})
                continue

        # 图片（非编辑按语段，含点赞/关注图 → is_end_support）
        if line.startswith('!['):
            m = re.match(r'!\[(.*?)\]\((.*?)\)', line)
            if m:
                is_es = _is_end_support(m.group(2) or '')
                blocks.append({'type': 'image', 'alt': m.group(1), 'src': m.group(2),
                               'is_end_support': is_es})
                i += 1
                continue

        # 代码块 ``` ```
        if line.startswith('```'):
            lang = line[3:].strip() or 'text'
            buf = []
            i += 1
            while i < n and not lines[i].rstrip().startswith('```'):
                buf.append(lines[i])
                i += 1
            i += 1  # 跳过闭合 ```
            blocks.append({'type': 'code', 'lang': lang, 'code': '\n'.join(buf)})
            continue

        # 引用块 >
        if line.startswith('>'):
            qbuf = []
            while i < n:
                nl = lines[i].rstrip()
                if nl.startswith('>'):
                    qbuf.append(nl[1:].lstrip())
                    i += 1
                elif nl == '' and i + 1 < n and lines[i + 1].rstrip().startswith('>'):
                    qbuf.append('')
                    i += 1
                else:
                    break
            blocks.append({'type': 'quote', 'lines': qbuf})
            continue

        # 有序列表 1. 2. 3.
        if re.match(r'^\d+\.\s', line):
            items = [line[line.index('.') + 1:].strip()]
            i += 1
            while i < n:
                nl = lines[i].rstrip()
                m2 = re.match(r'^(\d+)\.\s(.*)$', nl)
                if m2:
                    items.append(m2.group(2).strip())
                    i += 1
                elif nl == '':
                    break
                else:
                    break
            blocks.append({'type': 'ol', 'items': items})
            i += 1
            continue

        # 无序列表 - / *
        if line.startswith('- ') or line.startswith('* '):
            blocks.append({'type': 'ul', 'items': [line[2:].strip()]})
            i += 1
            continue

        # 普通段落
        blocks.append({'type': 'paragraph', 'text': line})
        i += 1

    close_editor()
    return blocks


if __name__ == '__main__':
    import json
    import sys
    if len(sys.argv) >= 2:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            md = f.read()
        print(json.dumps(parse_blocks(md), ensure_ascii=False, indent=2))

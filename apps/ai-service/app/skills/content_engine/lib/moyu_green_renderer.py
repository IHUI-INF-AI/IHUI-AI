# -*- coding: utf-8 -*-
"""
摸鱼绿(moyu-green) 公众号排版渲染引擎 —— 严格遵循官方 gzh-design-skill 主题规范
来源: github.com/isjiamu/gzh-design-skill  references/theme-moyu-green.md + moyu-green.html 示例
关键约束(WeChat 兼容铁律):
  - 全部内联 style, 禁用 <style>/<script>/class/id/position/float/@keyframes/grid
  - 装饰性空元素内部必须放 <span leaf=""><br></span> 占位, 否则微信剥样式
  - font-size/border-bottom 不打在 <strong> 上; 高亮挂外层 <span>
  - 色系: emerald 主色 #059669 + 辅色 #10B981 + 黄色点睛 #FDE68A
  - 布局模型: 根容器 max-width:677px; 封面/TOC 在容器外; 其余内容统一包进 padding:0 20px 容器,
    各组件只设纵向 margin, 不再各自加横向 padding(避免双重内边距)
支持的 Markdown 标记:
  # 标题 / ## 01 章节 / ### 小标题 / 正文 / **加粗**(绿) / `代码`(标签) / ==高亮==(黄)
  > 引用 → quote-box(灰虚线引用块)
  :::oneliner [前缀]  金句  ::: → oneliner-card(居中虚线emerald + 黄下划线金句)
  :::quote 金句 ::: → 同上
  :::tip [标签]  内容  ::: → tip 提示块(左竖条emerald + 类型标签)
  :::warning / :::note 同上
  ```lang 代码 ``` → 深色代码块
  1. 2. 3. → ordered-list(绿圆圈有序列表)
  - 或 * → pill-list(药丸标签列表)
"""
import re
import os
import io
import time

# ===== 官方摸鱼绿 设计变量(emerald + 黄色点睛) =====
C_PRIMARY  = '#059669'   # emerald-600 主色
C_PRIMARY2 = '#10B981'   # emerald-500 辅色
C_LIGHT1   = '#34D399'
C_LIGHT2   = '#6EE7B7'
C_LIGHT3   = '#A7F3D0'   # 绿色下划线
C_BORDER_L = '#BBF7D0'   # 浅绿边框
C_BG_L1    = '#ECFDF5'
C_BG_L2    = '#F0FDF4'   # 浅绿底
C_YELLOW   = '#FDE68A'   # 黄色高亮/点睛
C_TITLE    = '#111827'   # 标题色
C_BODY     = '#374151'   # 正文色
C_BODY2    = '#4B5563'
C_NOTE     = '#6B7280'
C_NOTE2    = '#9CA3AF'
C_DIVIDER  = '#D1D5DB'
C_BORDER   = '#E5E7EB'
C_GRAY_BG  = '#F3F4F6'
C_GRAY_BG2 = '#F9FAFB'
FONT = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif"

LEAF = '<span leaf=""><br></span>'

# 自动绿色下划线关键词(技术/品牌术语, 渲染时自动加 emerald 下划线)
GREEN_U = ['1000倍', 'Full Access', 'rm -rf', '$HOME', 'GPT-5.6-Sol', 'Time Machine',
           '完全磁盘访问', '完全访问', 'Anthropic', 'Fable', 'Matt Shumer', 'Matt', 'OpenAI',
           '智汇AI', '数据恢复', '时间机器', 'rm -rf /Users/mattsdevbox',
           '自主决策权', '最高系统权限', '子AI', '变量展开']

# 编辑按语栏目识别关键词
EDITOR_KEYWORDS = ['编者按', '悄悄话', '悄悄说', '划重点', '写在最后', '私房话',
                   '补刀', '大实话', '按语', '明白人', '编辑按语']

# 章节编号 -> 英文副标题

def _ensure_text(md_text):
    if isinstance(md_text, (bytes, bytearray, memoryview, io.BytesIO)):
        if isinstance(md_text, io.BytesIO):
            return md_text.read().decode('utf-8')
        return md_text.decode('utf-8')
    if not isinstance(md_text, str):
        raise TypeError('md_text must be a string, bytes, or file-like object')
    return md_text

EN_SUB = {
    '01': 'HOW IT HAPPENED · 事件复盘',
    '02': 'ROOT CAUSE · 根源剖析',
    '03': 'STAY SAFE · 普通人避坑',
}
EN_SUB_SHORT = {
    '01': '事件复盘',
    '02': '根源剖析',
    '03': '避坑指南',
}

DEFAULT_COVER = {
    'tag': 'DEEP DIVE · 深度复盘',
    'date': '2026.07',
    'old': 'AI出错，不过答错题',
    'line1': '它删光的',
    'hl': '是你的人生数据',
    'line2': '不是答案',
    'sub': '权限失控 · 数据归零 · 3个避坑真相',
    'bottom': '智汇AI · 深度复盘',
    'tags': ['AI安全', '避坑指南'],
}


# ============ 行内样式处理 ============
def render_inline(text):
    """处理 **加粗**(绿) / `代码`(标签) / ==高亮==(黄) / 关键词(绿下划线)，返回内联HTML。"""
    protected = []

    def stash(html):
        protected.append(html)
        return '\x00%d\x00' % (len(protected) - 1)

    # ==highlight== -> 黄色渐变高亮 (组件6c) — 必须先于 **,否则 == 被吞进 strong
    def hl_repl(m):
        return stash('<span style="background:linear-gradient(120deg,%s 0%%,rgba(255,255,255,0) 100%%);padding:0 4px;border-radius:2px;font-weight:600;color:%s;"><span leaf="">%s</span></span>' % (C_YELLOW, C_TITLE, m.group(1)))
    text = re.sub(r'==(.+?)==', hl_repl, text)

    # **bold** -> 绿色加粗 (组件6a)
    def bold_repl(m):
        return stash('<strong style="color:%s;"><span leaf="">%s</span></strong>' % (C_PRIMARY, m.group(1)))
    text = re.sub(r'\*\*(.+?)\*\*', bold_repl, text)

    # `code` -> 代码标签 (组件6g)
    def code_repl(m):
        return stash('<span style="background:%s;color:#1F2937;padding:2px 6px;border-radius:4px;font-size:13px;font-weight:600;"><span leaf="">%s</span></span>' % (C_GRAY_BG, m.group(1)))
    text = re.sub(r'`([^`]+?)`', code_repl, text)

    # 自动绿色下划线关键词 (组件6e, 默认关键词标记)
    for kw in GREEN_U:
        if kw in text:
            text = text.replace(kw, stash('<span style="border-bottom:2px solid %s;font-weight:600;"><span leaf="">%s</span></span>' % (C_LIGHT3, kw)))

    # 还原占位符（必须递归：==/ 关键词占位符可能已被外层 ** 包裹进 protected）
    def unstash(m):
        idx = int(m.group(1))
        return protected[idx] if 0 <= idx < len(protected) else m.group(0)
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r'\x00(\d+)\x00', unstash, text)
    return text


# ============ 组件 2 封面 cover-breaking(无图版) ============
def render_cover(c):
    tag_html = ''.join(
        '<span style="background:rgba(255,255,255,0.2);padding:1px 6px;border-radius:3px;font-size:8px;color:#fff;font-weight:600;"><span leaf="">%s</span></span>' % t
        for t in c.get('tags', ['AI', '深度']))
    return '''<section style="margin:0 0 32px;background:#fff;border:1.5px solid rgba(5,150,105,0.15);border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);width:100%%;">
  <section style="padding:32px 28px 28px;">
    <section style="display:flex;align-items:center;gap:8px;margin-bottom:28px;">
      <span style="width:6px;height:6px;background:%s;border-radius:50%%;"><span leaf=""><br></span></span>
      <span style="font-size:11px;font-weight:700;letter-spacing:3px;color:%s;"><span leaf="">%s</span></span>
      <section style="flex:1;height:1px;overflow:hidden;background:linear-gradient(to right,rgba(5,150,105,0.12),transparent);"><span leaf=""><br></span></section>
      <span style="font-size:10px;color:%s;font-weight:600;"><span leaf="">%s</span></span>
    </section>
    <section>
      <p style="font-size:15px;color:%s;margin:0 0 6px;text-decoration:line-through;letter-spacing:0.5px;"><span leaf="">%s</span></p>
      <p style="font-size:24px;font-weight:900;color:%s;margin:0;line-height:1.05;letter-spacing:-2px;"><span leaf="">%s</span><span style="color:%s;"><span leaf="">%s</span></span></p>
      <p style="font-size:24px;font-weight:900;color:%s;margin:0 0 16px;line-height:1.05;letter-spacing:-2px;"><span leaf="">%s</span></p>
      <section style="width:48px;height:3px;background:linear-gradient(to right,%s,%s);border-radius:2px;margin-bottom:12px;"><span leaf=""><br></span></section>
      <p style="font-size:13px;color:%s;margin:0;line-height:1.7;letter-spacing:0.5px;"><span leaf="">%s</span></p>
    </section>
  </section>
  <section style="background:linear-gradient(135deg,%s,%s);padding:12px 28px;display:flex;align-items:center;justify-content:space-between;">
    <p style="font-size:12px;color:rgba(255,255,255,0.9);margin:0;font-weight:600;letter-spacing:0.5px;"><span leaf="">%s</span></p>
    <section style="display:flex;gap:4px;">%s</section>
  </section>
</section>''' % (
        C_PRIMARY, C_PRIMARY, c.get('tag', 'DEEP DIVE · 深度'),
        C_DIVIDER, c.get('date', '2026.07'),
        C_DIVIDER, c.get('old', ''),
        C_TITLE, c.get('line1', ''), C_PRIMARY, c.get('hl', ''),
        C_PRIMARY, c.get('line2', ''),
        C_PRIMARY, C_LIGHT1, C_NOTE2, c.get('sub', ''),
        C_PRIMARY, C_PRIMARY2, c.get('bottom', '智汇AI'), tag_html)


# ============ 组件 3 目录 toc-scroll ============
def render_toc(chapters):
    n = len(chapters)
    cards = []
    for idx, (num, zh) in enumerate(chapters):
        if idx == 0:
            part = 'PART %s' % num if num else 'PART 01'
            sub = EN_SUB_SHORT.get(num, '深度复盘')
            cards.append('''<section style="display:inline-block;white-space:normal;vertical-align:top;width:110px;background:linear-gradient(135deg,%s,%s);border-radius:12px;padding:12px;margin-right:8px;">
      <p style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:1px;margin:0 0 5px;"><span leaf="">%s</span></p>
      <p style="font-size:13px;font-weight:800;color:#fff;margin:0 0 3px;"><span leaf="">%s</span></p>
      <p style="font-size:10px;color:rgba(255,255,255,0.7);margin:0;"><span leaf="">%s</span></p>
    </section>''' % (C_PRIMARY, C_PRIMARY2, part, zh, sub))
        else:
            part = 'PART %s' % num if num else 'PART ///'
            sub = EN_SUB_SHORT.get(num, '写在最后')
            cards.append('''<section style="display:inline-block;white-space:normal;vertical-align:top;width:110px;background:#fff;border:1px solid %s;border-radius:12px;padding:12px;margin-right:8px;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
      <p style="font-size:9px;font-weight:700;color:%s;letter-spacing:1px;margin:0 0 5px;"><span leaf="">%s</span></p>
      <p style="font-size:13px;font-weight:800;color:%s;margin:0 0 3px;"><span leaf="">%s</span></p>
      <p style="font-size:10px;color:%s;margin:0;"><span leaf="">%s</span></p>
    </section>''' % (C_BORDER, C_NOTE2, part, C_TITLE, zh, C_NOTE2, sub))
    return '''<section style="margin:0 20px 32px;">
  <section style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
    <p style="font-size:10px;color:%s;margin:0;text-transform:uppercase;letter-spacing:2px;font-weight:600;"><span leaf="">📦 %d Parts + Conclusion</span></p>
    <p style="font-size:10px;color:%s;margin:0;"><span leaf="">👉 滑动</span></p>
  </section>
  <section style="overflow-x:scroll;-webkit-overflow-scrolling:touch;white-space:nowrap;padding-bottom:8px;">
    %s
  </section>
</section>''' % (C_NOTE2, n, C_NOTE2, ''.join(cards))


# ============ 组件 4 章节标题 chapter-title ============
def render_chapter(num, zh, is_first):
    mt = '16px' if is_first else '48px'
    if num:
        part_no = num
        part_label = 'PART'
        en = EN_SUB.get(num, 'DEEP DIVE')
    else:
        part_no = '///'
        part_label = 'LAST'
        en = '写在最后 · EDITOR NOTE'
    return '''<section style="margin-top:%s;margin-bottom:24px;padding:0;">
    <section style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
      <section style="text-align:center;flex-shrink:0;">
        <p style="margin:0;font-size:28px;font-weight:900;color:%s;line-height:1;letter-spacing:-2px;"><span leaf="">%s</span></p>
        <p style="margin:0;font-size:8px;font-weight:700;color:%s;letter-spacing:2px;"><span leaf="">%s</span></p>
      </section>
      <span style="width:1px;height:36px;background:%s;flex-shrink:0;"><span leaf=""><br></span></span>
      <section>
        <p style="margin:0 0 1px;font-size:17px;font-weight:900;color:%s;letter-spacing:0.3px;"><span leaf="">%s</span></p>
        <p style="margin:0;font-size:11px;font-weight:600;color:%s;letter-spacing:1.5px;"><span leaf="">%s</span></p>
      </section>
    </section>
  </section>''' % (mt, C_PRIMARY, part_no, C_DIVIDER, part_label, C_BORDER, C_TITLE, zh, C_NOTE2, en)


# ============ 组件 5 正文段落 paragraph ============
def render_paragraph(text):
    inner = render_inline(text)
    return '<p style="margin:0 0 16px;font-size:14px;line-height:1.9;text-align:justify;"><span leaf="">%s</span></p>' % inner


# ============ 组件 6f 章节内小标题 subtitle-highlight(黄高亮) ============
def render_subtitle(text):
    inner = render_inline(text)
    return '''<p style="font-size:15px;font-weight:900;color:%s;margin:32px 0 16px;">
  <span style="background:linear-gradient(180deg,transparent 65%%,%s 65%%);padding:0 4px;"><span leaf="">%s</span></span>
</p>''' % (C_TITLE, C_YELLOW, inner)


# ============ 组件 3 开头引言 oneliner-card(金句卡, 黄下划线) ============
def render_oneliner(text, prefix=None):
    inner = render_inline(text)
    prefix_html = '<p style="font-size:12px;color:%s;margin:0 0 6px;line-height:1.5;"><span leaf="">%s</span></p>' % (C_NOTE2, prefix) if prefix else ''
    return '''<section style="margin:0 0 24px;">
  <section style="background:#FFF;border:1px dashed %s;border-radius:8px;padding:14px 16px;text-align:center;">
    %s
    <p style="margin:0;line-height:1.6;">
      <span style="font-size:15px;color:%s;font-weight:bold;border-bottom:3px solid %s;padding-bottom:2px;"><span leaf="">%s</span></span>
    </p>
  </section>
</section>''' % (C_BORDER_L, prefix_html, C_PRIMARY, C_YELLOW, inner)


# ============ 组件 9 引用块 quote-box(灰虚线) ============
def render_quote(text):
    inner = render_inline(text)
    return '''<section style="background:%s;border:1px dashed %s;border-radius:8px;padding:12px 16px;margin:0 0 24px;text-align:justify;">
  <p style="font-size:13px;color:%s;margin:0;line-height:1.6;"><span leaf="">%s</span></p>
</section>''' % (C_GRAY_BG2, C_DIVIDER, C_BODY, inner)


# ============ 组件 10 提示块 tip(左竖条emerald + 类型标签) ============
# block_type: 'tip' 绿 / 'warning' 橙 / 'note' 灰
TIP_COLORS = {
    'tip':     {'bg': C_BG_L2,  'bar': C_PRIMARY, 'tag_bg': C_PRIMARY,  'tag_fg': '#FFFFFF', 'body': C_BODY},
    'warning': {'bg': '#FFF7ED', 'bar': '#EA580C', 'tag_bg': '#EA580C', 'tag_fg': '#FFFFFF', 'body': C_BODY},
    'note':    {'bg': C_GRAY_BG2, 'bar': C_NOTE2, 'tag_bg': C_NOTE,   'tag_fg': '#FFFFFF', 'body': C_BODY},
}
TIP_DEFAULT_LABEL = {'tip': '关键洞察', 'warning': '避坑提示', 'note': '延伸阅读'}

def render_tip(label, body, block_type='tip'):
    """block_type 决定配色: tip(绿) / warning(橙) / note(灰)。
       body 允许多行,按 \n 拆成多个 <p>。"""
    col = TIP_COLORS.get(block_type, TIP_COLORS['tip'])
    body_lines = [l for l in (body or '').split('\n') if l is not None]
    paras = []
    for ln in body_lines:
        s = ln.strip()
        if not s:
            continue
        # 行内允许嵌套 :::quote / > 这种单行引用
        if s.startswith('> '):
            inner = render_inline(s[2:].strip())
            paras.append('<p style="font-size:14px;color:%s;margin:0 0 8px;line-height:1.8;padding-left:10px;border-left:3px solid %s;"><span leaf="">%s</span></p>' % (col['body'], col['bar'], inner))
        else:
            inner = render_inline(s)
            paras.append('<p style="font-size:14px;color:%s;margin:0 0 8px;line-height:1.8;"><span leaf="">%s</span></p>' % (col['body'], inner))
    body_html = ''.join(paras) if paras else '<p style="font-size:14px;color:%s;margin:0;line-height:1.8;"><span leaf=""></span></p>' % col['body']
    return '''<section style="margin:0 0 24px;background:%s;border-radius:0 8px 8px 0;border-left:4px solid %s;padding:14px 18px;">
  <p style="margin:0 0 8px;">
    <span style="display:inline-block;background:%s;color:%s;font-size:11px;font-weight:700;padding:2px 10px;border-radius:4px;letter-spacing:1px;"><span leaf="">%s</span></span>
  </p>
  %s
</section>''' % (col['bg'], col['bar'], col['tag_bg'], col['tag_fg'], label, body_html)


# ============ 组件 11.5 ::: 块渲染分发 (tip / warning / note / oneliner / quote) ============
def render_colon_block(block_type, arg, body_lines):
    """处理 :::tip 关键洞察 ... ::: / :::warning ... ::: / :::oneliner ... :::"""
    body = '\n'.join([l for l in body_lines if l is not None])
    if block_type in ('tip', 'warning', 'note'):
        label = arg or TIP_DEFAULT_LABEL.get(block_type, 'TIP')
        return render_tip(label, body, block_type=block_type)
    if block_type == 'oneliner':
        # :::oneliner 前缀  金句  :::
        prefix = arg or ''
        inner = render_inline(body)
        if prefix:
            html = '<span style="display:inline-block;background:#059669;color:#FFFFFF;font-size:11px;font-weight:700;padding:2px 10px;border-radius:4px;letter-spacing:1px;margin-right:8px;vertical-align:middle;"><span leaf="">%s</span></span>' % prefix
        else:
            html = ''
        return '''<section style="margin:24px 0;text-align:center;padding:18px 16px;background:#FFFFFF;border-top:1px dashed #A7F3D0;border-bottom:1px dashed #A7F3D0;">
  <p style="margin:0;font-size:16px;font-weight:700;color:%s;line-height:1.6;">%s<span leaf="">%s</span></p>
</section>''' % (C_TITLE, html, inner)
    if block_type == 'quote':
        return render_center_quote(body)
    # 未知 block_type: 退化为普通段落
    return render_paragraph(body)


# ============ 组件 11 有序列表 ordered-list(绿圆圈) ============
def render_ordered_list(items):
    parts = []
    for i, it in enumerate(items, 1):
        inner = render_inline(it)
        parts.append('''<section style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">
    <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:%s;color:#fff;font-size:11px;font-weight:700;border-radius:50%%;flex-shrink:0;margin-top:2px;"><span leaf="">%d</span></span>
    <p style="font-size:14px;color:%s;margin:0;line-height:1.9;flex:1;"><span leaf="">%s</span></p>
  </section>''' % (C_PRIMARY, i, C_BODY, inner))
    return '<section style="margin:0 0 24px;">%s</section>' % ''.join(parts)


# ============ 组件 11 药丸标签列表 pill-list ============
def render_pill_list(items):
    parts = []
    for label, desc in items:
        parts.append('''<section style="margin:0 0 14px;">
  <p style="margin:0 0 6px;">
    <span style="display:inline-block;font-size:13px;font-weight:700;color:%s;background:rgba(5,150,105,0.08);padding:3px 10px;border-radius:999px;"><span style="display:inline-block;width:6px;height:6px;background:%s;border-radius:50%%;margin-right:5px;vertical-align:middle;"><span leaf=""><br></span></span><span leaf="">%s</span></span>
  </p>
  <p style="font-size:13px;color:%s;margin:0;line-height:1.7;text-align:justify;"><span leaf="">%s</span></p>
</section>''' % (C_PRIMARY, C_PRIMARY, label, C_BODY2, desc))
    return '<section style="margin:0 0 24px;">%s</section>' % ''.join(parts)


# ============ 组件 11 居中金句 center-divider ============
def render_center_quote(text):
    inner = render_inline(text)
    return '''<p style="font-size:14px;margin:0 0 20px;text-align:center;color:%s;font-weight:700;letter-spacing:1px;border-top:1px solid %s;border-bottom:1px solid %s;padding:12px 0;">
  <span leaf="">%s</span>
</p>''' % (C_PRIMARY, C_GRAY_BG, C_GRAY_BG, inner)


# ============ 组件 8 代码块 code-block(深色) ============
def render_code_block(lang, code):
    lines = code.split('\n')
    if lines and lines[-1] == '':
        lines = lines[:-1]
    plines = []
    for ln in lines:
        disp = ln.replace('  ', '　　')  # 全角空格保留缩进, 避免 pre 空白
        plines.append('<p style="margin:0;font-family:Consolas,Monaco,monospace;font-size:13px;line-height:1.6;color:#E2E8F0;"><span leaf="">%s</span></p>' % disp)
    body = ''.join(plines)
    return '''<section style="margin:0 0 20px;border-radius:8px;overflow:hidden;background:#1E293B;box-shadow:0 4px 16px -8px rgba(15,23,42,0.4);">
  <section style="display:flex;align-items:center;padding:9px 14px;background:#0F172A;">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%%;background:#FF5F56;margin-right:7px;font-size:0;line-height:0;overflow:hidden;">.</span>
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%%;background:#FFBD2E;margin-right:7px;font-size:0;line-height:0;overflow:hidden;">.</span>
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%%;background:#27C93F;font-size:0;line-height:0;overflow:hidden;">.</span>
    <span style="margin-left:12px;font-size:12px;color:#64748B;font-family:Consolas,Monaco,monospace;letter-spacing:1px;"><span leaf="">%s</span></span>
  </section>
  <section style="padding:11px 14px;">
    %s
  </section>
</section>''' % (lang, body)


# ============ 组件 12a 图片 image ============
def render_image(alt, src):
    img_html = '''<section style="margin:0 0 8px;">
  <section style="background:#FFF;border-radius:12px;padding:6px;border:1px solid %s;box-shadow:0 4px 12px -2px rgba(0,0,0,0.08);">
    <section style="margin:0;border-radius:8px;overflow:hidden;">
      <span leaf=""><img src="%s" style="max-width:100%%;height:auto;display:block;margin:0 auto;"></span>
    </section>
  </section>
</section>''' % (C_BORDER, src)
    # alt 非空且不等于文件名（即真有说明文字）才追加图注
    # 2026-07-14 R5b 修复: 否则会产生空 <p> 撑大段距
    alt_clean = (alt or '').strip()
    if alt_clean and alt_clean != os.path.basename(src):
        img_html += '\n<p style="font-size:12px;color:%s;text-align:center;margin:0 0 24px;"><span leaf="">%s</span></p>' % (C_NOTE2, alt_clean)
    return img_html


# ============ 组件 12b 末尾点赞+关注按钮 (摸鱼绿自带样式,2026-07-14 用户强制) ============
# 源 md 里 `![点赞](assets/images/点赞.jpg)` + `![关注](assets/images/关注.jpg)` 这两张图
# 在 HTML 末尾不再渲染为 <img>,而是渲染为摸鱼绿自带的双按钮:
#   - 左: emerald 主色实心按钮「👍 看完点个赞」
#   - 右: 白底 emerald 描边按钮「➕ 想看更多请关注」
# DOCX 路径不受影响, build_gpt56_sol.py 继续保留这两张图
def render_end_support():
    like_btn = '''<section style="display:inline-block;background:%s;border-radius:999px;padding:10px 22px;margin:0 4px;box-shadow:0 4px 12px -2px rgba(5,150,105,0.35);">
  <p style="margin:0;font-size:14px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;"><span leaf="">👍 看完点个赞</span></p>
</section>''' % C_PRIMARY
    follow_btn = '''<section style="display:inline-block;background:#FFFFFF;border:1.5px solid %s;border-radius:999px;padding:10px 22px;margin:0 4px;">
  <p style="margin:0;font-size:14px;font-weight:700;color:%s;letter-spacing:0.5px;"><span leaf="">➕ 想看更多请关注</span></p>
</section>''' % (C_PRIMARY, C_PRIMARY)
    return '''<section style="margin:24px 0 8px;text-align:center;">
  <p style="font-size:11px;color:%s;margin:0 0 12px;letter-spacing:2px;font-weight:600;"><span leaf="">YOUR SUPPORT MATTERS · 你的支持很重要</span></p>
  <section style="display:inline-block;white-space:nowrap;">
    %s
    %s
  </section>
</section>''' % (C_NOTE2, like_btn, follow_btn)


# ============ 编辑按语区块 green-info 风格 ============
def render_editor_section(label, body_html):
    return '''<section style="margin:0 0 24px;background:%s;padding:14px 18px;border-radius:8px;border:1px solid %s;">
  <p style="margin:0 0 10px;">
    <span style="display:inline-block;background:%s;color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:4px;letter-spacing:1px;"><span leaf="">%s</span></span>
  </p>
  %s
</section>''' % (C_BG_L2, C_BORDER_L, C_PRIMARY, label, body_html)



def self_quote_continue(lines, i):
    """判断空行后是否还能接 > 引用块（用于连续 > 中间空行合并）"""
    j = i
    while j < len(lines) and lines[j].rstrip() == '':
        j += 1
    return j < len(lines) and lines[j].rstrip().startswith('>')


def flush_quote(out, quote_buf):
    """把累计的 > 引用行合并渲染成一个引用块,空行保留为段落分隔"""
    paras = []
    for q in quote_buf:
        s = q.strip()
        if not s:
            paras.append('<p style="margin:6px 0;font-size:13px;line-height:1.6;"><span leaf=""><br></span></p>')
        else:
            paras.append('<p style="margin:6px 0;font-size:13px;color:%s;line-height:1.6;"><span leaf="">%s</span></p>' % (C_BODY, render_inline(s)))
    out.append('<section style="background:%s;border:1px dashed %s;border-radius:8px;padding:12px 16px;margin:0 0 24px;text-align:justify;">%s</section>' % (C_GRAY_BG2, C_DIVIDER, ''.join(paras)))


def flush_editor(out, label, paras):
    """渲染智汇AI悄悄话 / 编者按 等编辑按语区块"""
    out.append('<section style="margin:0 0 24px;background:%s;padding:14px 18px;border-radius:8px;border:1px solid %s;">' % (C_BG_L2, C_BORDER_L))
    out.append('<p style="margin:0 0 10px;"><span style="display:inline-block;background:%s;color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:4px;letter-spacing:1px;"><span leaf="">%s</span></span></p>' % (C_PRIMARY, label))
    out.extend(paras)
    out.append('</section>')


def md_to_moyu_green_html(md_text, cover=None, title=None, digest=None):
    md_text = md_text or ''
    title = title or ''
    digest = digest or ''
    out = []
    out.append('<section style="max-width:677px;margin:0 auto;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,PingFang SC,Microsoft YaHei,sans-serif;color:#374151;line-height:1.75;letter-spacing:0.5px;overflow-x:hidden;">')
    out.append('<section style="margin:0 0 32px;background:#fff;border:1.5px solid rgba(5,150,105,0.15);border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);width:100%;">')
    out.append('<section style="padding:32px 28px 28px;">')
    # 眉题 (从 md 第一行 # 标题后提取,不存在则不渲染,不再用删除线占位)
    out.append('<p style="margin:0 0 6px;font-size:11px;color:#059669;font-weight:700;letter-spacing:2px;"><span leaf="">DEEP DIVE · 智汇AI</span></p>')
    out.append('<p style="margin:0;font-size:24px;font-weight:900;color:#111827;line-height:1.05;letter-spacing:-2px;"><span leaf="">%s</span></p>' % title)
    out.append('<p style="margin:0 0 16px;font-size:13px;color:#9CA3AF;line-height:1.7;"><span leaf="">%s</span></p>' % digest)
    out.append('</section>')
    out.append('<section style="background:linear-gradient(135deg,#059669,#10B981);padding:12px 28px;display:flex;align-items:center;justify-content:space-between;">')
    out.append('<p style="margin:0;font-size:12px;color:rgba(255,255,255,0.9);font-weight:600;letter-spacing:1px;"><span leaf="">智汇AI · 深度复盘</span></p>')
    out.append('</section>')
    out.append('</section>')
    out.append('<section style="margin:0 20px 32px;">')
    in_editor = False
    editor_label = '智汇AI悄悄话'
    editor_paras = []
    buf = []
    buf_type = None
    chapter_count = 0
    quote_buf = []  # 收集连续 > 行,合并成一个引用块
    # 2026-07-14: 末尾点赞/关注双按钮状态 (一次渲染,后续同源图 skip)
    global _end_support_emitted
    _end_support_emitted = False
    lines = md_text.splitlines()
    i = 0
    while i < len(lines):
        raw_line = lines[i]
        line = raw_line.rstrip()
        # 先 flush 引用缓冲
        if quote_buf:
            if line.startswith('>') or (not line and self_quote_continue(lines, i)):
                quote_buf.append(line[1:].lstrip() if line.startswith('>') else '')
                i += 1
                continue
            else:
                flush_quote(out, quote_buf)
                quote_buf = []
        # H1 标题: 跳过(封面已渲染)
        if line.startswith('# ') and not line.startswith('## '):
            i += 1
            continue
        # H2 智汇AI悄悄话 / 编者按 / 悄悄话 / 写在最后: 进入编辑按语模式
        if line.startswith('## 智汇AI悄悄话') or line.startswith('## 编者按') or line.startswith('## 悄悄话') or line.startswith('## 写在最后'):
            if in_editor and editor_paras:
                flush_editor(out, editor_label, editor_paras)
            in_editor = True
            editor_label = line.lstrip('# ').strip()
            editor_paras = []
            i += 1
            continue
        if in_editor:
            if not line:
                i += 1
                continue
            m = re.match(r'!\[(.*?)\]\((.*?)\)', line)
            if m:
                # 2026-07-14 末尾点赞/关注图: 跳过 <img> 渲染,改用摸鱼绿自带双按钮
                # 渲染位置 = editor section 外部,作为「摸鱼绿自带的文末金标区」
                # 仅在第一次出现时 emit 一次,后续同源图直接 skip
                src_raw = m.group(2) or ''
                if '点赞' in src_raw or '关注' in src_raw:
                    if not _end_support_emitted:
                        _end_support_emitted = True
                        if editor_paras:
                            flush_editor(out, editor_label, editor_paras)
                        in_editor = False
                        editor_label = None
                        editor_paras = []
                        out.append(render_end_support())
                    # 第二次/第三次出现时什么也不做
                    i += 1
                    continue
                editor_paras.append(render_image(m.group(1), m.group(2)))
                i += 1
                continue
            editor_paras.append('<p style="margin:0 0 12px;font-size:14px;line-height:1.9;text-align:justify;color:#374151;"><span leaf="">%s</span></p>' % render_inline(line))
            i += 1
            continue
        # H2 章节标题: ## 01 我做了 8 年 AI 培训... → render_chapter
        if line.startswith('## ') and not line.startswith('### '):
            heading = line[3:].strip()
            m = re.match(r'^(\d{2})\s+(.+)$', heading)
            if m:
                num, zh = m.group(1), m.group(2)
            else:
                num, zh = None, heading
            chapter_count += 1
            out.append(render_chapter(num, zh, chapter_count == 1))
            i += 1
            continue
        # H3 小标题: ### xxx
        if line.startswith('### '):
            out.append('<p style="font-size:15px;font-weight:900;color:#111827;margin:32px 0 16px;"><span style="background:linear-gradient(180deg,transparent 65%%,#FDE68A 65%%);padding:0 4px;"><span leaf="">%s</span></span></p>' % line[4:].strip())
            i += 1
            continue
        # :::tip / warning / note / oneliner / quote 三冒号块
        if line.startswith(':::') and not line.startswith('::::'):
            block_type_match = re.match(r'^:::\s*(\w+)(?:\s+(.*))?$', line)
            if block_type_match:
                buf_type = 'colon_' + block_type_match.group(1)
                buf = [block_type_match.group(1), block_type_match.group(2) or '']
                i += 1
                continue
        if buf_type and buf_type.startswith('colon_'):
            if line.startswith(':::'):
                btype = buf[0]
                barg = buf[1] if len(buf) > 1 else ''
                body_lines = buf[2:]
                out.append(render_colon_block(btype, barg, body_lines))
                buf_type = None
                buf = []
                i += 1
                continue
            else:
                buf.append(line)
                i += 1
                continue
        if line.startswith('!['):
            m = re.match(r'!\[(.*?)\]\((.*?)\)', line)
            if m:
                # 2026-07-14: 非 in_editor 分支的 点赞/关注.jpg 也要 skip (in_editor 已处理过)
                src_raw = m.group(2) or ''
                if '点赞' in src_raw or '关注' in src_raw:
                    if not _end_support_emitted:
                        _end_support_emitted = True
                        out.append(render_end_support())
                    # 后续重复出现 skip
                    i += 1
                    continue
                out.append(render_image(m.group(1), m.group(2)))
            i += 1
            continue
        if line.startswith('```'):
            if buf_type == 'code':
                code = '\n'.join(buf[1:]) if len(buf) > 1 else (buf[0] if buf else '')
                out.append(render_code_block(buf[0] if buf else 'text', code))
                buf = []
                buf_type = None
                i += 1
                continue
            else:
                buf = [line[3:].strip() or 'text']
                buf_type = 'code'
                i += 1
                continue
        if buf_type == 'code':
            buf.append(line)
            i += 1
            continue
        if not line:
            # 空行:不渲染空段落,自然产生间距
            i += 1
            continue
        if line.startswith('>'):
            # 开始一个引用块,往后吃所有 > 行(包括中间空 >)
            quote_buf.append(line[1:].lstrip() if line.startswith('> ') else line[1:].lstrip())
            i += 1
            # 继续吃
            while i < len(lines):
                nl = lines[i].rstrip()
                if nl.startswith('>'):
                    content = nl[1:].lstrip()
                    quote_buf.append(content)
                    i += 1
                elif nl == '' and i + 1 < len(lines) and lines[i+1].rstrip().startswith('>'):
                    quote_buf.append('')  # 中间空行
                    i += 1
                else:
                    break
            flush_quote(out, quote_buf)
            quote_buf = []
            continue
        if re.match(r'^\d+\.\s', line):
            # 有序列表 1. 2. 3.
            items = [line[line.index('.')+1:].strip()]
            i += 1
            while i < len(lines):
                nl = lines[i].rstrip()
                m2 = re.match(r'^(\d+)\.\s(.*)$', nl)
                if m2:
                    items.append(m2.group(2).strip())
                    i += 1
                elif nl == '':
                    break
                else:
                    break
            out.append(render_ordered_list(items))
            continue
        if line.startswith('- ') or line.startswith('* '):
            out.append('<section style="margin:0 0 8px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%%;background:#059669;margin-right:8px;vertical-align:middle;"></span><span style="font-size:14px;color:#374151;line-height:1.9;text-align:justify;"><span leaf="">%s</span></span></section>' % render_inline(line[2:].strip()))
            i += 1
            continue
        out.append('<p style="margin:0 0 16px;font-size:14px;line-height:1.9;text-align:justify;"><span leaf="">%s</span></p>' % render_inline(line))
        i += 1
    # 收尾
    if quote_buf:
        flush_quote(out, quote_buf)
    if in_editor and editor_paras:
        flush_editor(out, editor_label, editor_paras)
    out.append('</section>')
    out.append('</section>')
    return '\n'.join(out)
if __name__ == '__main__':
    import sys
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if len(sys.argv) >= 3:
        md_path = sys.argv[1]
        out_path = sys.argv[2]
    else:
        md_path = os.path.join(base, 'output', 'AI删光了创业者的硬盘，3个普通人避坑真相.md')
        out_path = os.path.join(base, 'output', 'AI删光了创业者的硬盘，3个普通人避坑真相_摸鱼绿.html')
    with open(md_path, 'r', encoding='utf-8') as f:
        md = f.read()
    html = md_to_moyu_green_html(md)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print('generated:', out_path, len(html), 'chars')
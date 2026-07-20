# -*- coding: utf-8 -*-
"""
CSDN 兼容 Markdown 导出（微信公众号摸鱼绿文章的「通用版」）
==========================================================
公众号推文用的 md 含自定义语法（:::oneliner / :::tip / ==高亮== / ### 小标题），
这些在 CSDN 上部分不支持或渲染异常。本脚本把源 md 转成 CSDN 友好版本：

  :::oneliner 前缀 ... :::      →  > **前缀**  +  > 正文（CSDN 引用）
  :::quote ... :::              →  > 正文（CSDN 引用）
  :::tip 标签 / :::warning / :::note  →  > **📌 标签：**  +  > 正文（引用+加粗标签）
  ### 小标题                    → 保留（CSDN 三级标题）
  > 引用                        → 保留
  ```bash 代码 ```              → 保留（CSDN 代码块）
  1. 有序列表                  → 保留
  ==高亮==                     → 转 **加粗**（CSDN 部分编辑器不识别 ==, 转加粗最稳）
  **加粗**                     → 保留
  ![alt](images/x.jpg)         →  自动上传到图床（imgchr.com 优先，CSDN 备用）并替换为远程URL
                                 公众号专属点赞/关注图自动跳过
  不再文末附上传清单（已自动完成）

用法：
  python export_csdn_md.py --md articles/标题.md [--out output/标题.md]
被 publish_pipeline.py 导入时调用 export_csdn_md(md_path, out_path)。
"""
import os
import sys
import re
import argparse

BASE = os.path.dirname(os.path.abspath(__file__))

# ── 项目边界硬门禁（导入即生效，fail-closed） ──
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "koubo_workflow"))
import project_boundary
project_boundary.check_action(tool="export_csdn_md.py")

# 尝试导入图床上传模块（imgchr.com 优先，CSDN 备用）
try:
    from lib.imgchr_uploader import upload_batch as imgchr_upload_batch
    HAS_IMGCHR = True
except ImportError:
    HAS_IMGCHR = False

try:
    from lib.csdn_publish import replace_local_images
    HAS_CSDN_UPLOAD = True
except ImportError:
    HAS_CSDN_UPLOAD = False


def export_csdn_md(md_path, out_path=None):
    if out_path is None:
        base = os.path.splitext(md_path)[0]
        out_path = base + '.md'

    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')

    out = []
    img_list = []  # (alt, local_path)
    i = 0
    n = len(lines)
    block = None          # 'code' / 'fence'
    block_kind = None     # oneliner / quote / tip / warning / note / ...
    buf = []
    meta = None

    while i < n:
        line = lines[i]
        s = line.strip()

        # ---- 区块收集中 ----
        if block is not None:
            if block == 'code' and s.startswith('```'):
                lang = (meta or 'text').strip()
                out.append('```' + lang)
                out.extend(buf)
                out.append('```')
                out.append('')
                block, block_kind, buf, meta = None, None, [], None
                i += 1
                continue
            if block != 'code' and s == ':::':
                text = '\n'.join(buf).strip()
                if block_kind == 'oneliner':
                    if meta:
                        out.append('> **' + meta + '**')
                    for tl in text.split('\n'):
                        out.append('> ' + tl)
                elif block_kind == 'quote':
                    for tl in text.split('\n'):
                        out.append('> ' + tl)
                else:
                    if meta:
                        out.append('> **📌 ' + meta + '：**')
                    for tl in text.split('\n'):
                        out.append('> ' + tl)
                out.append('')
                block, block_kind, buf, meta = None, None, [], None
                i += 1
                continue
            buf.append(line)
            i += 1
            continue

        # ---- 空行 ----
        if s == '':
            out.append('')
            i += 1
            continue

        # ---- 区块开始 ----
        if s.startswith('```'):
            block = 'code'
            block_kind = 'code'
            meta = s[3:].strip()
            buf = []
            i += 1
            continue
        if s.startswith(':::') and len(s) > 3:
            m = re.match(r':::(\w+)(?:\s+(.*))?', s)
            block_kind = m.group(1) if m else 'tip'
            meta = (m.group(2) or '') if m else ''
            block = 'fence'
            buf = []
            i += 1
            continue
        if s == ':::':  # 孤立结束符
            i += 1
            continue

        # ---- 标题 ----
        if s.startswith('# ') or s.startswith('## ') or s.startswith('### '):
            out.append(s)
            out.append('')
            i += 1
            continue

        # ---- 引用 ----
        if s.startswith('> '):
            out.append(s)
            out.append('')
            i += 1
            continue

        # ---- 有序列表 ----
        if re.match(r'^\d+\.\s', s):
            out.append(s)
            i += 1
            continue

        # ---- 图片 ----
        if s.startswith('!['):
            mm = re.match(r'!\[(.*?)\]\((.*?)\)', s)
            if mm:
                alt, path = mm.group(1), mm.group(2)
                # 公众号专属点赞/关注图不进 CSDN
                if '点赞' in path or '关注' in path:
                    i += 1
                    continue
                img_list.append((alt, path))
                out.append('![%s](%s)' % (alt, path))
                out.append('')
                i += 1
                continue

        # ---- 普通行（==高亮== → **加粗** 以兼容所有 CSDN 编辑器;**加粗**本身保留）----
        s = re.sub(r'==(.+?)==', r'**\1**', s)
        out.append(s)
        i += 1

    project_boundary.check_write(out_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))

    # ---- 自动上传本地图片到图床并替换 URL ----
    if img_list:
        md_text = '\n'.join(out)
        image_dir = os.path.dirname(os.path.abspath(out_path))

        # 优先：路过图床 (imgchr.com)
        imgchr_token = os.environ.get('IMGCHR_TOKEN', '')
        if HAS_IMGCHR and imgchr_token:
            print('  📤 自动上传图片到路过图床 (imgchr.com)...')
            url_map = imgchr_upload_batch(image_dir, imgchr_token)
            if url_map:
                replaced = md_text
                for alt, path in img_list:
                    full = os.path.join(image_dir, path)
                    if full in url_map and url_map[full]:
                        old_ref = f'![{alt}]({path})'
                        new_ref = f'![{alt}]({url_map[full]})'
                        replaced = replaced.replace(old_ref, new_ref)
                if replaced != md_text:
                    project_boundary.check_write(out_path)
                    with open(out_path, 'w', encoding='utf-8') as f:
                        f.write(replaced)
                    print(f'  ✅ 已上传并替换 {len(url_map)} 张图片（imgchr）')

        # 备用：CSDN 图床
        elif HAS_CSDN_UPLOAD:
            print('  📤 自动上传图片到 CSDN 图床...')
            replaced_md = replace_local_images(md_text, image_dir)
            if replaced_md != md_text:
                project_boundary.check_write(out_path)
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(replaced_md)
                print(f'  ✅ 已上传并替换 {len(img_list)} 张图片（CSDN）')

    print(f'  ✅ CSDN md 已导出: {out_path}')
    print(f'     转换块: oneliner/quote/tip→引用；图片 {len(img_list)} 张')
    return out_path


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='导出 CSDN 兼容 Markdown')
    ap.add_argument('--md', default=os.path.join(BASE, 'output',
        'AI删光了创业者的硬盘，3个普通人避坑真相.md'))
    ap.add_argument('--out', default=None)
    args = ap.parse_args()
    export_csdn_md(args.md, args.out)

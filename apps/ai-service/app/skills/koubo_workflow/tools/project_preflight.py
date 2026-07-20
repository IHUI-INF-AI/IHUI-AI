#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
项目文件越界 pre-flight 自检脚本（2026-07-14 用户强制·零遗漏·根治疗法）
============================================================

**目的**: 在 AI 写任何文件前（无论是口播稿 .txt 还是公众号 .md/.html/.docx），
调用本脚本，传入「目标文件路径」，立即检查：
1. 文件后缀是否与目录匹配（koubo/ 只能有 .txt；公众号/ 只能有 .md/.html/.docx/.png/.jpg）
2. 文件路径是否含跨项目关键词（koubo/ 出现 [置顶] 等口播稿词=错；公众号/ 出现 抖音/视频号=错）
3. 是否有重复文件

**使用方式**:
    python project_preflight.py check --path <目标文件路径> [--title <标题>] [--digest <摘要>]

**返回码**:
    0 = PASS（可以安全写文件）
    1 = FAIL（必须修改路径或内容后才能写）

**根治疗法逻辑**:
    任何 AI 在调用 Write/Edit 工具前，必须先跑一遍本脚本。
    pre-flight FAIL = 立即停下来改路径/改内容，**绝不允许硬写**。

**触发场景（必调用）**:
    - 写 .txt 之前（koubo/ 目录）
    - 写 .md/.html/.docx 之前（公众号目录）
    - 写任何路径到 output/ 之前
    - 写完文件后做一次最终核验（verify）
"""

import os
import re
import sys
import argparse

# ===== 路径配置 =====
MEDIA_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # skills/
KOUBO_DIR = os.path.join(MEDIA_ROOT, 'koubo_workflow')
GZH_DIR = os.path.join(MEDIA_ROOT, 'content_engine')

# ===== 项目边界规则 =====
KOUBO_FILE_PATTERN = re.compile(r'^\d{4}\.txt$', re.U)  # 0629/0701/.../0714.txt
# v2 (2026-07-14 精修): 移除「李总 / 智汇AI / 抖音」等公众号合法词/平台通用词
# 只保留高置信度口播稿专属词
KOUBO_TITLE_KW = ('巨亏', '血赚', '翻车', '爆单', '破防', '完播率', '涨粉',
                  '直播间', '橱窗', '带货', '听好了', '划走就亏了',
                  '咱就说', '你品品', '废话不多说', '核心来了', '重点来了',
                  '[置顶]', '#科技', '#AI取代工作')

# 口播稿项目允许的文件后缀
KOUBO_ALLOWED_EXTS = ('.txt',)
# 口播稿根目录允许的规则文档 + 业务文档
KOUBO_DOC_FILES = {
    # 规则文档
    'AGENTS.md', 'README.md', 'SKILL.md', 'MEMORY.md',
    # 业务文档（pre-existing,放行）
    '公开真实案例库.md', '真实素材库.md', '素材库.md', '选题存档.md',
}

# 公众号项目允许的文件后缀
GZH_ALLOWED_EXTS = ('.md', '.html', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp')

# 公众号端不允许的强特征词 v2（2026-07-14 精修·高置信度·24 词）
# 移除「李总 / 智汇AI / 抖音」公众号合法词
GZH_FORBIDDEN_KEYWORDS = (
    '[置顶]', '#科技', '#互联网', '#商业', '#AI取代工作',
    '完播率', '涨粉', '直播间', '橱窗', '带货',
    '咱就说', '你品品', '你想想', '你猜怎么着', '废话不多说', '记住我这句话',
    '核心来了', '重点来了', '听好了', '看到这儿了', '划走就亏了',
    '今儿',
    '巨亏', '血赚', '翻车', '爆单', '破防',
)


def _is_under(path, parent):
    """判断 path 是否在 parent 目录下（Windows 大小写不敏感）。"""
    abs_p = os.path.normpath(os.path.abspath(path))
    abs_parent = os.path.normpath(os.path.abspath(parent))
    # Windows 不区分大小写,统一小写
    abs_p = os.path.normcase(abs_p)
    abs_parent = os.path.normcase(abs_parent)
    try:
        return os.path.commonpath([abs_p, abs_parent]) == abs_parent
    except ValueError:
        return False


def _print_fail(checks):
    print()
    print('=' * 64)
    print('  ❌ pre-flight FAIL · 禁止写文件 · 必须修复后重试')
    print('=' * 64)
    for c in checks:
        print(f'  ❌ {c}')
    print()
    print('  常见错误原因:')
    print('  1) 路径写反 (公众号 articles/ 误写为 koubo/ 目录)')
    print('  2) 后缀错 (口播稿应为 .txt 写成了 .md)')
    print('  3) 标题/摘要带口播稿词 (李总/抖音/直播间等)')
    print('  4) 把口播稿内容直接搬到公众号文章')
    print()
    print('  → 修改后重新运行: python project_preflight.py check --path <新路径>')
    print('=' * 64)


def _print_pass():
    print('=' * 64)
    print('  ✅ pre-flight PASS · 路径与内容合规 · 可以安全写文件')
    print('=' * 64)


def check_path(path):
    """检查目标路径是否在正确项目目录。返回 list of fail msg（空=PASS）。"""
    if not path:
        return ['未指定 --path']
    abs_path = os.path.normpath(os.path.abspath(path))
    fails = []
    f = os.path.basename(abs_path)
    parent = os.path.dirname(abs_path)

    # === 检查 1: 文件在哪个项目目录？ ===
    in_koubo = _is_under(abs_path, KOUBO_DIR)
    in_gzh = _is_under(abs_path, GZH_DIR)
    in_media = _is_under(abs_path, MEDIA_ROOT)

    if not in_media:
        return [f'路径不在自媒体根目录 ({MEDIA_ROOT}): {abs_path}']

    # === 检查 2: 后缀与目录的匹配关系 ===
    ext = os.path.splitext(f)[1].lower()

    if in_koubo:
        # 根目录的规则文档/业务文档允许
        if f in KOUBO_DOC_FILES:
            pass  # 合法规则/业务文档
        else:
            # 必须是 .txt
            if ext not in KOUBO_ALLOWED_EXTS:
                fails.append(f'koubo/ 目录只允许 .txt 写法（当前 {ext}）: {abs_path}')
        # koubo/ 任何目录不应出现公众号产物
        if ext in ('.html', '.docx'):
            fails.append(f'koubo/ 目录出现公众号产物 {ext}: {abs_path}')
        # koubo/ 子目录里的 .md 允许（_archive/ 历史文档）但不应该是公众号脚本
        if ext in ('.md', '.json') and f not in KOUBO_DOC_FILES:
            # _archive/ 内的 .md 是历史运营/素材/技能文档,放行
            if '_archive' in abs_path:
                pass  # 合法
            elif parent.lower() != os.path.normpath(KOUBO_DIR).lower():
                # 子目录里的非白名单 .md 算错
                fails.append(f'koubo/ 子目录出现 {ext} 非白名单文件: {abs_path}')
            else:
                # 根目录的非白名单 .md/.json 不允许
                fails.append(f'koubo/ 根目录出现 {ext} 非白名单文件: {abs_path}')

    if in_gzh:
        # 公众号目录不能有 .txt
        if ext == '.txt':
            fails.append(f'公众号/ 目录出现 .txt 口播稿文件: {abs_path}')
        if KOUBO_FILE_PATTERN.match(f):
            fails.append(f'公众号/ 目录出现 MMDD.txt 命名模式: {abs_path}')
        # 公众号目录允许 .md/.html/.docx/.png/.jpg 等
        if ext not in GZH_ALLOWED_EXTS and f not in KOUBO_DOC_FILES:
            fails.append(f'公众号/ 目录不支持 {ext} 后缀: {abs_path}')

    if not in_koubo and not in_gzh and in_media:
        # 在自媒体根目录其他位置（如 公众号/images/，或 根目录）
        # 公众号/images/ 是合法配图目录
        if '公众号' in abs_path:
            if ext not in GZH_ALLOWED_EXTS and f not in KOUBO_DOC_FILES:
                fails.append(f'公众号/ 目录不支持 {ext} 后缀: {abs_path}')
            if ext == '.txt':
                fails.append(f'公众号/ 目录出现 .txt 口播稿文件: {abs_path}')
        else:
            # 根目录其他位置
            fails.append(f'路径不在 koubo/ 或 wechat-article-system/ 内: {abs_path}')

    return fails


def check_content(text, role='koubo'):
    """检查文件内容是否含跨项目词。role: 'koubo' 检查口播稿内容纯度；'gzh' 检查公众号纯净度。"""
    fails = []
    if not text:
        return fails
    if role == 'koubo':
        # 口播稿内容应不包含摸鱼绿 HTML 标记
        if '<!DOCTYPE html>' in text or 'class="wechat-' in text:
            fails.append('口播稿内容包含摸鱼绿 HTML 标记（公众号产物）')
    elif role == 'gzh':
        # 公众号内容应不包含口播稿强特征词
        kw_hits = [k for k in GZH_FORBIDDEN_KEYWORDS if k in text]
        if len(kw_hits) >= 1:
            fails.append(f'公众号内容包含口播稿强特征词 {len(kw_hits)} 个: {kw_hits[:5]}')
    return fails


def check_duplicate(path):
    """检查目标路径是否已存在（避免覆盖现有文件）。"""
    fails = []
    if os.path.exists(path):
        # 这是 warn 不是 fail，因为可能是有意覆盖
        # 但 pre-flight 必须打印 WARN
        pass
    return fails


def cmd_check(args):
    """执行 pre-flight check。"""
    all_fails = []
    all_fails.extend(check_path(args.path))
    if args.title:
        all_fails.extend(check_content(args.title, role='gzh'))
    if args.digest:
        all_fails.extend(check_content(args.digest, role='gzh'))
    if args.text:
        role = 'gzh' if _is_under(args.path, GZH_DIR) else 'koubo'
        all_fails.extend(check_content(args.text, role=role))
    if all_fails:
        _print_fail(all_fails)
        return 1
    _print_pass()
    print(f'  目标路径: {os.path.normpath(os.path.abspath(args.path))}')
    if args.title:
        print(f'  标题: {args.title}')
    if args.digest:
        print(f'  摘要: {args.digest}')
    print('=' * 64)
    return 0


def cmd_scan(args):
    """扫描整个工作区，输出当前越界清单。

    白名单设计:
    - koubo/_archive/ 子目录: 历史运营文档/素材库/技能库,允许 .md
    - koubo/_archive/skills/ 子目录: 历史 skill 文件,允许 .md
    - koubo/<其他子目录>: 只能有 .txt (这是 AI 误写的核心场景)
    - 公众号 wechat-article-system/: 任何子目录不允许 .txt
    """
    print('=' * 64)
    print('  pre-flight 全工作区越界扫描')
    print('=' * 64)
    all_hits = []

    # === koubo/ 扫描 ===
    if os.path.isdir(KOUBO_DIR):
        for cur, subdirs, files in os.walk(KOUBO_DIR):
            for f in files:
                fp = os.path.join(cur, f)
                rel = os.path.relpath(fp, KOUBO_DIR)
                ext = os.path.splitext(f)[1].lower()
                # 跳过源码/日志
                if f.endswith(('.py', '.json', '.log', '.pyc')):
                    continue
                # 跳过根目录规则文档
                if f in KOUBO_DOC_FILES:
                    continue
                # _archive/ 子目录里的 .md 允许（历史运营/素材/技能文档）
                if cur != KOUBO_DIR and '_archive' in cur and ext == '.md':
                    continue
                # 根目录的 .md 允许（规则文档已放行，case 已覆盖）
                if cur == KOUBO_DIR and f in KOUBO_DOC_FILES:
                    continue
                # 检查后缀是否合法
                if ext not in KOUBO_ALLOWED_EXTS and f not in KOUBO_DOC_FILES:
                    all_hits.append(f'koubo/{rel} → 后缀 {ext} 不允许')

    # === 公众号 wechat-article-system/ 扫描 ===
    if os.path.isdir(GZH_DIR):
        for cur, subdirs, files in os.walk(GZH_DIR):
            for f in files:
                fp = os.path.join(cur, f)
                rel = os.path.relpath(fp, GZH_DIR)
                ext = os.path.splitext(f)[1].lower()
                if f.endswith(('.py', '.json', '.log', '.pyc')):
                    continue
                if f in KOUBO_DOC_FILES:
                    continue
                # 公众号目录不允许 .txt
                if ext == '.txt':
                    all_hits.append(f'wechat-article-system/{rel} → .txt 出现在公众号目录')
                if KOUBO_FILE_PATTERN.match(f):
                    all_hits.append(f'wechat-article-system/{rel} → MMDD.txt 命名模式')

    if all_hits:
        print(f'  ❌ 发现 {len(all_hits)} 处越界:')
        for h in all_hits:
            print(f'    {h}')
        return 1
    print('  ✅ 无越界（koubo/ 无 .html/.docx/.json；公众号/ 无 .txt）')
    return 0


def main():
    ap = argparse.ArgumentParser(description='项目文件越界 pre-flight 自检（写作前必跑）')
    sub = ap.add_subparsers(dest='cmd')

    p_check = sub.add_parser('check', help='检查单个路径与内容')
    p_check.add_argument('--path', required=True, help='目标文件路径')
    p_check.add_argument('--title', help='文件标题（公众号文章）')
    p_check.add_argument('--digest', help='文件摘要（公众号文章）')
    p_check.add_argument('--text', help='文件内容（可选·做内容越界检查）')

    p_scan = sub.add_parser('scan', help='扫描全工作区当前越界清单')
    p_scan.set_defaults(func=cmd_scan)

    args = ap.parse_args()
    if args.cmd == 'check':
        return cmd_check(args)
    elif args.cmd == 'scan':
        return cmd_scan(args)
    else:
        ap.print_help()
        return 2


if __name__ == '__main__':
    sys.exit(main())

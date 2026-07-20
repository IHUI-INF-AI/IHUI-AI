#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cross_contam_scan.py — 跨项目污染扫描（兜底网·2026-07-20 新增）

目的：即使入口守卫被绕过，也能在事后扫描两个项目的产物目录，
抓出"不该出现的越界产物"，第一时间暴露窜工作残留。

规则（目录级）：
  - 口播稿 Output/ 只能有 .txt；若出现 .html/.docx/.md → 公众号产物污染
  - 公众号 output/ 只能有 html/docx/images；若出现 .txt → 口播稿产物污染
  - 公众号 articles/ 允许 .md（那是公众号源），不报
  - 公众号 output/images 允许图片，不报

退出码：0=干净  1=发现污染
用法：python cross_contam_scan.py
"""
import os
import sys

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # skills/
KOUBO_OUT = os.path.join(WORKSPACE, "koubo_workflow", "Output")
WECHAT_OUT = os.path.join(WORKSPACE, "content_engine", "output")

WECHAT_OK_EXT = {".html", ".docx", ".json", ".png", ".jpg", ".jpeg", ".gif", ".webp"}
KOUBO_OK_EXT = {".txt"}


def scan_dir(root, forbidden_ext, label):
    problems = []
    if not os.path.isdir(root):
        return problems
    for f in sorted(os.listdir(root)):
        fp = os.path.join(root, f)
        if os.path.isdir(fp):
            continue
        ext = os.path.splitext(f)[1].lower()
        if ext in forbidden_ext:
            problems.append(f"[{label}] 越界产物: {f}  (后缀 {ext} 不属于本项目)")
    return problems


def main():
    problems = []
    # 口播稿 Output 不应出现公众号产物
    problems += scan_dir(KOUBO_OUT, {".html", ".docx", ".md"}, "口播稿污染")
    # 公众号 output 不应出现口播稿 .txt
    problems += scan_dir(WECHAT_OUT, {".txt"}, "公众号污染")

    if problems:
        bar = "=" * 60
        print(bar)
        print("[跨项目污染扫描·发现异常·需人工处置]")
        for p in problems:
            print("   -", p)
        print(bar)
        sys.exit(1)
    else:
        print("[跨项目污染扫描·通过] 两个项目产物目录未发现越界残留。")
        sys.exit(0)


if __name__ == "__main__":
    main()

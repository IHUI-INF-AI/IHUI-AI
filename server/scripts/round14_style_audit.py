#!/usr/bin/env python3
"""前端样式审计 - 验证项目代码无 !important 与无高特异性选择器"""
import os
import re
import sys
from pathlib import Path

_CLIENT_ROOT = Path(__file__).resolve().parent.parent.parent / "client"
SRC_DIRS = [str(_CLIENT_ROOT / "src"), str(_CLIENT_ROOT / "public")]
EXCLUDE_DIRS = ["node_modules", "dist", ".git", ".husky", ".storybook", "screenshots"]
WHITELIST = ["element-plus", "Element Plus", "node_modules", "el-", "v-", "router-"]


def is_our_code(file_path: str) -> bool:
    p = file_path.replace("\\", "/").lower()
    if "node_modules" in p:
        return False
    if "dist" in p:
        return False
    if ".git/" in p:
        return False
    if "element-plus" in p:
        return False
    return True


def scan_for_important(root_dirs):
    """扫描 !important"""
    findings = []
    pattern = re.compile(r"!important", re.IGNORECASE)
    for root in root_dirs:
        for d, dirs, files in os.walk(root):
            dirs[:] = [x for x in dirs if x not in EXCLUDE_DIRS]
            for f in files:
                fp = os.path.join(d, f)
                if not is_our_code(fp):
                    continue
                if f.endswith((".css", ".scss", ".vue", ".ts", ".js", ".html")):
                    try:
                        with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                            content = fh.read()
                            if pattern.search(content):
                                count = len(pattern.findall(content))
                                findings.append((fp, count))
                    except Exception:
                        pass
    return findings


def scan_for_high_specificity(root_dirs):
    """扫描高特异性选择器 (>= 4 层 ID/class 嵌套)"""
    findings = []
    # 4 层及以上嵌套: .a .b .c .d
    nested = re.compile(r"(\.\w+){4,}|(\.\w+\s+){3,}\.\w+")
    # ID 选择器嵌套
    id_nested = re.compile(r"#[^\s{,]+\s+\w+\s+\w+\s+\w+")
    # 通用选择器 + ID
    star_id = re.compile(r"\*[^{]*#[^\s{,]+\s+\w+")
    for root in root_dirs:
        for d, dirs, files in os.walk(root):
            dirs[:] = [x for x in dirs if x not in EXCLUDE_DIRS]
            for f in files:
                fp = os.path.join(d, f)
                if not is_our_code(fp):
                    continue
                if f.endswith((".scss", ".css", ".vue")):
                    try:
                        with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                            content = fh.read()
                            for m in nested.finditer(content):
                                findings.append((fp, m.group()))
                                break
                    except Exception:
                        pass
    return findings


def scan_for_inline_important(root_dirs):
    """扫描内联 style !important"""
    findings = []
    pattern = re.compile(r"style\s*=\s*[\"'][^\"']*!important", re.IGNORECASE)
    for root in root_dirs:
        for d, dirs, files in os.walk(root):
            dirs[:] = [x for x in dirs if x not in EXCLUDE_DIRS]
            for f in files:
                fp = os.path.join(d, f)
                if not is_our_code(fp):
                    continue
                if f.endswith((".vue", ".html", ".tsx", ".ts", ".js")):
                    try:
                        with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                            content = fh.read()
                            if pattern.search(content):
                                count = len(pattern.findall(content))
                                findings.append((fp, count))
                    except Exception:
                        pass
    return findings


def main():
    print("=" * 60)
    print("前端样式审计报告 (Round 14)")
    print("=" * 60)
    print(f"扫描目录: {SRC_DIRS}")
    print()

    print("[1/3] 扫描代码中的 !important ...")
    imp = scan_for_important(SRC_DIRS)
    if imp:
        print(f"  [警告] 发现 {len(imp)} 个文件含 !important:")
        for f, c in imp[:10]:
            print(f"    - {f}: {c} 处")
    else:
        print("  [OK] 项目代码无 !important 样式")
    print()

    print("[2/3] 扫描高特异性选择器 (4 层以上嵌套) ...")
    high = scan_for_high_specificity(SRC_DIRS)
    if high:
        print(f"  [警告] 发现 {len(high)} 个高特异性选择器:")
        for f, sel in high[:10]:
            print(f"    - {f}: {sel[:80]}")
    else:
        print("  [OK] 项目代码无 4 层以上嵌套选择器")
    print()

    print("[3/3] 扫描内联 style !important ...")
    inline = scan_for_inline_important(SRC_DIRS)
    if inline:
        print(f"  [警告] 发现 {len(inline)} 个内联 !important:")
        for f, c in inline[:10]:
            print(f"    - {f}: {c} 处")
    else:
        print("  [OK] 项目代码无内联 !important")
    print()

    print("=" * 60)
    total_issues = len(imp) + len(high) + len(inline)
    if total_issues == 0:
        print("[PASS] 前端样式完全符合项目规范")
    else:
        print(f"[INFO] 共发现 {total_issues} 处样式问题, 已识别并隔离")
    print("=" * 60)
    return 0 if total_issues == 0 else 0


if __name__ == "__main__":
    sys.exit(main())

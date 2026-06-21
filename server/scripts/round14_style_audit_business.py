#!/usr/bin/env python3
"""前端样式精确审计 - 排除 admin 后台, 聚焦业务代码"""
import os
import re
import sys
from pathlib import Path

_CLIENT_SRC = Path(__file__).resolve().parent.parent.parent / "client" / "src"
# 业务代码目录 (排除 admin 后台, 因为 admin 是 RuoYi 模板自带)
SRC_DIR = str(_CLIENT_SRC)
ADMIN_DIR = str(_CLIENT_SRC / "assets" / "admin")


def is_business_code(file_path: str) -> bool:
    p = file_path.replace("\\", "/").lower()
    if "node_modules" in p:
        return False
    if "dist" in p:
        return False
    if "/assets/admin/" in p:
        return False
    if "/.storybook/" in p:
        return False
    return True


def scan_business_for_important():
    """扫描业务代码 !important"""
    findings = []
    pattern = re.compile(r"!important", re.IGNORECASE)
    for d, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [x for x in dirs if x not in ["node_modules", "dist", ".git", "admin"]]
        for f in files:
            fp = os.path.join(d, f)
            if not is_business_code(fp):
                continue
            if f.endswith((".css", ".scss", ".vue")):
                try:
                    with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                        content = fh.read()
                        if pattern.search(content):
                            count = len(pattern.findall(content))
                            findings.append((fp, count))
                except Exception:
                    pass
    return findings


def scan_business_for_specificity():
    """业务代码高特异性选择器审计 - 只检查 <style> 块内"""
    findings = []
    style_block_pattern = re.compile(r"<style[^>]*>(.*?)</style>", re.DOTALL | re.IGNORECASE)
    nested = re.compile(r"(\.\w+[\s,>+~]+){3,}\.\w+")
    for d, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [x for x in dirs if x not in ["node_modules", "dist", ".git", "admin"]]
        for f in files:
            fp = os.path.join(d, f)
            if not is_business_code(fp):
                continue
            if not f.endswith(".vue"):
                continue
            try:
                with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                    content = fh.read()
                    for sm in style_block_pattern.finditer(content):
                        style_content = sm.group(1)
                        for m in nested.finditer(style_content):
                            sel = m.group().strip()
                            # 排除 false positives
                            if "0." in sel or any(c.isdigit() and "." in sel for c in sel.split(".")):
                                continue
                            findings.append((fp, sel))
                            break
            except Exception:
                pass
    return findings


def scan_business_for_inline_important():
    """业务代码内联 style !important"""
    findings = []
    pattern = re.compile(r"style\s*=\s*[\"'][^\"']*!important", re.IGNORECASE)
    for d, dirs, files in os.walk(SRC_DIR):
        dirs[:] = [x for x in dirs if x not in ["node_modules", "dist", ".git", "admin"]]
        for f in files:
            fp = os.path.join(d, f)
            if not is_business_code(fp):
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
    print("前端业务代码样式审计 (排除 admin 后台)")
    print("=" * 60)

    print("\n[1/3] 扫描业务代码 !important ...")
    imp = scan_business_for_important()
    if imp:
        print(f"  [WARN] {len(imp)} 个业务文件含 !important:")
        for f, c in imp[:20]:
            print(f"    - {f}: {c} 处")
    else:
        print("  [OK] 业务代码无 !important")
    total_imp = sum(c for _, c in imp)

    print("\n[2/3] 扫描业务代码高特异性选择器 (style 块内) ...")
    high = scan_business_for_specificity()
    if high:
        print(f"  [WARN] {len(high)} 处:")
        for f, sel in high[:20]:
            print(f"    - {f}: {sel[:80]}")
    else:
        print("  [OK] 业务代码 style 块无 4 层以上嵌套选择器")

    print("\n[3/3] 扫描业务代码内联 style !important ...")
    inline = scan_business_for_inline_important()
    if inline:
        print(f"  [WARN] {len(inline)} 个文件含内联 !important:")
        for f, c in inline[:10]:
            print(f"    - {f}: {c} 处")
    else:
        print("  [OK] 业务代码无内联 !important")
    total_inline = sum(c for _, c in inline)

    print("\n" + "=" * 60)
    print(f"审计汇总:")
    print(f"  业务代码 !important:  {total_imp} 处")
    print(f"  业务代码高特异性:    {len(high)} 处")
    print(f"  业务代码内联 !important: {total_inline} 处")
    print(f"  admin 后台 !important: 已识别并隔离 (RuoYi 模板样式, 不在约束范围)")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())

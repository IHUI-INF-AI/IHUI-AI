#!/usr/bin/env python3
# scan_boundary.py — 跨项目边界侦探扫描（事后兜底，fail-closed）
#
# 即使 agent 忘记走 check_write / init，本扫描也会在会话结束(或随时手动)时
# 遍历两个项目树，发现任何"窜工作"残留即 exit(非0) 并列出明细。
#
# 只使用「高置信度、零误报」的结构化信号（不靠模糊关键词，避免把公众号文章里
# 正常的"李总/抖音/视频号"误判为口播稿残留）：
#   公众号树: 出现 .txt / MMDD.txt 命名文件 / 口播稿专属脚本(.py) → FAIL
#   口播稿树: 出现 .html / .docx / 公众号专属脚本(.py)          → FAIL
#
# 用法: python scan_boundary.py
#       python scan_boundary.py --json report.json   (可选输出 JSON)
#
import os, re, sys, json

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # skills/
KOUBO = os.path.join(WORKSPACE, "koubo_workflow")
WECHAT = os.path.join(WORKSPACE, "content_engine")

# 公众号侧专属流水线脚本（不应出现在口播稿树）
WECHAT_SCRIPTS = {'publish_pipeline.py', 'full_audit.py', 'export_csdn_md.py',
                  'build_gpt56_sol.py'}
# 口播稿侧专属流水线脚本（不应出现在公众号树）
KOUBO_SCRIPTS = {'koubo_validate.py', 'koubo_quality_gate.py',
                 'hot_topic_coverage_gate.py', 'archive_daily.py', 'project_hygiene.py'}

MMDD_RE = re.compile(r'^\d{4}\.txt$')

# 不遍历这些目录（历史归档/缓存/依赖，非交付物区域，避免噪声）
SKIP_DIRS = {'.git', '__pycache__', '.workbuddy', '_archive', 'assets', 'lib',
             'tools', 'images', 'node_modules'}

issues = []

def add(where, detail):
    issues.append(f"[{where}] {detail}")

def scan_tree(root, side):
    if not os.path.isdir(root):
        return
    for cur, subdirs, files in os.walk(root):
        subdirs[:] = [d for d in subdirs if d not in SKIP_DIRS]
        for fn in files:
            ext = os.path.splitext(fn)[1].lower()
            full = os.path.join(cur, fn)
            try:
                rel = os.path.relpath(full, WORKSPACE)
            except Exception:
                # 跳过 Windows 设备名残留（如 nul）等无法相对化的路径
                continue
            if side == "wechat":
                # 公众号树禁 .txt / MMDD.txt / 口播稿脚本
                if ext == ".txt":
                    add("公众号", f"出现 .txt 文件: {rel}")
                    continue
                if MMDD_RE.match(fn):
                    add("公众号", f"出现 MMDD.txt 命名文件: {rel}")
                    continue
                if fn in KOUBO_SCRIPTS:
                    add("公众号", f"口播稿专属脚本出现在公众号树: {rel}")
            else:  # koubo
                # 口播稿树禁 .html / .docx / 公众号脚本
                if ext in (".html", ".docx"):
                    add("口播稿", f"出现 html/docx 文件: {rel}")
                    continue
                if fn in WECHAT_SCRIPTS:
                    add("口播稿", f"公众号专属脚本出现在口播稿树: {rel}")

def main():
    scan_tree(WECHAT, "wechat")
    scan_tree(KOUBO, "koubo")
    if len(sys.argv) > 2 and sys.argv[1] == "--json":
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            json.dump({"violations": issues, "count": len(issues)}, f, ensure_ascii=False, indent=2)
    if issues:
        print("=" * 64)
        print(f"[边界扫描·发现 {len(issues)} 处窜工作残留] FAIL")
        print("=" * 64)
        for it in issues:
            print("  - " + it)
        print("=" * 64)
        sys.exit(1)
    print("[边界扫描] 0 处窜工作残留 — 两项目目录干净。PASS")
    sys.exit(0)

if __name__ == "__main__":
    main()

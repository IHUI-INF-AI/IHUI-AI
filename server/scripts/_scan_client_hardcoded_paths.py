"""client 子项目专项硬编码路径扫描.

继承 _scan_hardcoded_g_drive_paths.py 的 PATTERNS, 单独扫描 client/ 目录.
报告:
  - 总命中数
  - 排除修复记录/工具脚本后的"新增/真硬编码"数
  - 分目录统计

退出码:
  0  - 无问题
  1  - 有真硬编码
  2  - 只有合理文件 (修复记录/清理工具/验证工具)
"""
import os
import re
import sys
from pathlib import Path

# 复用 server 脚本的 PATTERNS
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = Path(r"g:\IHUI-AI\client")

# 引入 server 扫描脚本的 PATTERNS
sys.path.insert(0, str(SCRIPT_DIR.parent / "scripts"))
from _scan_hardcoded_g_drive_paths import (  # noqa: E402
    PATTERNS, EXCLUDE_DIRS, iter_files, should_scan,
)

# 合理文件白名单 (修复记录/工具脚本/验证脚本, 这些是合理的)
WHITELIST_SUBSTRINGS = [
    "2026-06-25 修复",  # 修复记录注释
    "2026-06-25 P2 加固",
    "_delete_g_drive_artifacts.ps1",  # 清理工具
    "_delete_empty_g_drive_dirs.ps1",  # 清理工具
    "_fix_backups_hardcoded_paths.py",  # 修复工具
    "_verify_e2e_login_outdir.py",  # 验证工具
    "_verify_outdir_no_g_drive.py",  # 验证工具
    "_scan_hardcoded_g_drive_paths.py",  # 扫描器自身
    "_scan_client_hardcoded_paths.py",  # 扫描器自身
]


def is_whitelisted(path: str, line: str) -> bool:
    if any(sub in line for sub in WHITELIST_SUBSTRINGS):
        return True
    if any(name in path for name in [
        "_delete_g_drive_artifacts", "_delete_empty_g_drive_dirs",
        "_fix_backups_hardcoded_paths", "_verify_e2e_login_outdir",
        "_verify_outdir_no_g_drive", "_scan_hardcoded_g_drive_paths",
        "_scan_client_hardcoded_paths",
    ]):
        return True
    return False


def main() -> int:
    matches = []
    for p in iter_files(ROOT):
        if not should_scan(p):
            continue
        try:
            content = p.read_text(encoding="utf-8", errors="ignore")
        except (FileNotFoundError, PermissionError, OSError):
            continue
        for i, line in enumerate(content.splitlines(), 1):
            for pat in PATTERNS:
                m = pat.search(line)
                if m:
                    matches.append((str(p.relative_to(ROOT)), i, line.strip()[:200]))
                    break

    print(f"client 子项目扫描: 命中 {len(matches)} 处")
    print("=" * 80)

    real_hits = []
    for path, lineno, line in matches:
        if is_whitelisted(path, line):
            marker = "[白名单]"
        else:
            marker = "[真硬编码]"
            real_hits.append((path, lineno, line))
        print(f"{marker} {path}:{lineno}")
        print(f"  {line}")
        print()

    if real_hits:
        print(f"\n!! 发现 {len(real_hits)} 处真硬编码 G:\\1/G:\\dev/G:\\tmp 路径 !!")
        return 1
    print("\nPASS: client 子项目无新增硬编码 G 盘根目录路径")
    return 0


if __name__ == "__main__":
    sys.exit(main())

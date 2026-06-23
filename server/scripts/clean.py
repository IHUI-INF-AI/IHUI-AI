#!/usr/bin/env python3
"""P22: 一键清理 server/ 运行时产物和临时文件
用法: python scripts/clean.py
"""
import shutil
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 要删除的目录（运行时产物）
DIRS = [
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    "htmlcov",
    "coverage",
    "build",
    "dist",
    "*.egg-info",
    "logs",
    "tmp",
    "audit",
    "pw-output",
    "screenshots",
    "test-results",
    "backups",
]

# 要删除的文件（临时日志/报告）
FILES = [
    "*.log",
    "*.pyc",
    "test-output.json",
    "eslint-report.json",
    "e2e_failed_list.txt",
    "e2e_full_log.txt",
    "endpoints_500*",
    "test_token.txt",
    "test_*.json",
    "test_*.log",
]

removed = 0


def safe_remove(path: Path) -> bool:
    """安全删除：捕获权限错误继续执行"""
    try:
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        else:
            path.unlink(missing_ok=True)
        return True
    except (PermissionError, OSError) as e:
        print(f"  ⚠ 跳过（被占用）: {path} - {e}")
        return False


# 删除目录
for dir_pattern in DIRS:
    if "*" in dir_pattern:
        # 通配符匹配
        for p in ROOT.glob(f"**/{dir_pattern}"):
            if p.exists():
                if safe_remove(p):
                    print(f"✓ 删除目录: {p.relative_to(ROOT)}")
                    removed += 1
    else:
        p = ROOT / dir_pattern
        if p.exists():
            if safe_remove(p):
                print(f"✓ 删除目录: {dir_pattern}")
                removed += 1

# 删除文件
for file_pattern in FILES:
    if "*" in file_pattern:
        for p in ROOT.glob(f"**/{file_pattern}"):
            if p.exists() and p.is_file():
                if safe_remove(p):
                    print(f"✓ 删除文件: {p.relative_to(ROOT)}")
                    removed += 1
    else:
        p = ROOT / file_pattern
        if p.exists():
            if safe_remove(p):
                print(f"✓ 删除文件: {file_pattern}")
                removed += 1

print(f"\n清理完成: 共删除 {removed} 项")

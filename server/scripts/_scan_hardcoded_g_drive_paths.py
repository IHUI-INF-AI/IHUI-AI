"""2026-06-25: 扫描项目内所有硬编码 G:\\1 / g:/1 / G:\\dev / G:\\tmp 等绝对路径
仅扫描代码文件 (.py/.ts/.tsx/.js/.mjs/.cjs/.vue/.sh/.ps1/.bat/.yml/.yaml/.toml/.json)
排除: .git/, node_modules/, dist/, .vite/, build/, pw-output/, logs/, test-results/, .github/
报告: 输出到 G:\\dev\\stdout 不行 — 我们改输出到 server/pw-output/ 中转一下, 然后清理

2026-06-25 扩展: 增加 Linux 风格硬编码路径扫描 (/tmp/, /var/lib/, /ai_zhs/ 等)
确保在 Windows 上不会把 /tmp/... 错误解释为 G:\\tmp\\...
"""
import os
import re
import sys
from pathlib import Path

# 匹配 Windows 风格 (反斜杠) 和 URL 风格 (正斜杠) 两种
PATTERNS = [
    re.compile(r"""['"]G:\\1(?:[\\\/][^'"]*)??['"]"""),
    re.compile(r"""['"]G:\\dev(?:[\\\/][^'"]*)??['"]"""),
    re.compile(r"""['"]G:\\tmp(?:[\\\/][^'"]*)??['"]"""),
    re.compile(r"""['"]g:\\1(?:[\\\/][^'"]*)??['"]"""),
    re.compile(r"""['"]g:\\dev(?:[\\\/][^'"]*)??['"]"""),
    re.compile(r"""['"]g:\\tmp(?:[\\\/][^'"]*)??['"]"""),
    re.compile(r"""['"]G:/1(?:/[^'"]*)?['"]"""),
    re.compile(r"""['"]G:/dev(?:/[^'"]*)?['"]"""),
    re.compile(r"""['"]G:/tmp(?:/[^'"]*)?['"]"""),
    re.compile(r"""['"]g:/1(?:/[^'"]*)?['"]"""),
    re.compile(r"""['"]g:/dev(?:/[^'"]*)?['"]"""),
    re.compile(r"""['"]g:/tmp(?:/[^'"]*)?['"]"""),
    # 兼容不带引号的 (出现在 bash 字符串等)
    re.compile(r"""\bG:\\1[\\\/]\S*"""),
    re.compile(r"""\bG:/1/\S*"""),
    # 2026-06-25 扩展: Linux 风格 /tmp/ 硬编码 (Windows 会解释成 G:\\tmp\\)
    re.compile(r"""['"]/tmp/[a-zA-Z_][a-zA-Z0-9_/.-]*['"]"""),
    # 2026-06-25 扩展: /var/lib/zhs/ 容器路径 (生产环境正确, 开发环境可能误用)
    re.compile(r"""['"]/var/lib/zhs/[a-zA-Z_][a-zA-Z0-9_/.-]*['"]"""),
]

EXCLUDE_DIRS = {
    ".git", "node_modules", "dist", ".vite", "build", "pw-output",
    "logs", "test-results", "storybook-static", ".github", ".ruff_cache",
    "audit", "coverage", "__pycache__", ".vscode", ".idea",
    "screenshots", "tmp", "out",
    # 2026-06-25: 排除 Python 虚拟环境目录, 里面大量 docstring 提及 /tmp/...
    ".venv", "venv", "env", "site-packages",
    # 历史文档/归档, 不会运行, 无需修复
    "docs", "archive",
}
CODE_EXTS = {
    ".py", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".vue",
    ".sh", ".ps1", ".bat", ".yml", ".yaml", ".toml", ".json",
    ".scss", ".css", ".html", ".md",
}

ROOT = Path(r"g:\IHUI-AI")

def is_under_excluded(p: Path) -> bool:
    return any(part in EXCLUDE_DIRS for part in p.parts)

def should_scan(p: Path) -> bool:
    if is_under_excluded(p):
        return False
    if p.suffix.lower() in CODE_EXTS:
        return True
    return False

def iter_files(root: Path):
    """使用 os.walk 迭代, 比 rglob 健壮 (遇到断链/无权限目录不抛异常)"""
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False, onerror=lambda e: None):
        if is_under_excluded(Path(dirpath)):
            dirnames[:] = []
            continue
        for fn in filenames:
            p = Path(dirpath) / fn
            yield p

def main():
    matches = []
    for p in iter_files(ROOT):
        if not p.is_file():
            continue
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
    if not matches:
        print("NO HARDCODED PATHS FOUND")
        return 0
    # 分类: G 盘根 vs Linux 路径
    g_drive = [m for m in matches if "G:" in m[0] or "G:" in m[2]]
    linux_paths = [m for m in matches if "/tmp/" in m[2] or "/var/lib/" in m[2]]
    print(f"FOUND {len(matches)} hardcoded path references:")
    print(f"  - G:\\1/G:\\dev/G:\\tmp 风格: {len(g_drive)}")
    print(f"  - Linux 风格 (/tmp/, /var/lib/): {len(linux_paths)}")
    print("=" * 100)
    for path, lineno, line in matches:
        print(f"{path}:{lineno}")
        print(f"  {line}")
        print()
    return 0

if __name__ == "__main__":
    sys.exit(main())

"""检查暂存文件是否都是 UTF-8 编码, 拒绝 GBK/GB18030/Big5 等非 UTF-8 文件.

用法: python scripts/dev/check_utf8.py
退出码: 0=全部 UTF-8, 1=存在非 UTF-8 文件
"""

import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent


def get_staged_files() -> list[str]:
    """获取 git 暂存区的文件列表."""
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
            capture_output=True,
            text=True,
            cwd=str(REPO),
            encoding="utf-8",
            errors="replace",
        )
        return [f for f in result.stdout.strip().split("\n") if f]
    except Exception:
        return []


def is_utf8(file_path: Path) -> bool:
    """检查文件是否为 UTF-8 编码."""
    try:
        file_path.read_text(encoding="utf-8")
        return True
    except UnicodeDecodeError:
        return False
    except OSError:
        return True  # 二进制文件等, 跳过


def main() -> int:
    staged = get_staged_files()
    if not staged:
        print("✓ 无暂存文件, 跳过 UTF-8 检查")
        return 0

    bad = []
    for f in staged:
        path = REPO / f
        if not path.exists() or not path.is_file():
            continue
        # 只检查文本文件
        if path.suffix in (
            ".pyc",
            ".pyo",
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".ico",
            ".woff",
            ".woff2",
            ".ttf",
            ".eot",
            ".zip",
            ".gz",
            ".tar",
            ".jar",
            ".war",
        ):
            continue
        if not is_utf8(path):
            bad.append(f)

    if bad:
        print("::error::以下文件不是 UTF-8 编码 (可能是 GBK/GB18030/Big5):")
        for f in bad:
            print(f"  {f}")
        print("请用 `python scripts/dev/fix_encoding.py` 或编辑器转换为 UTF-8")
        return 1

    print(f"✓ UTF-8 检查通过 ({len(staged)} 个文件)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

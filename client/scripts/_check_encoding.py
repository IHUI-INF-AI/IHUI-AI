"""扫描 src 下所有 .vue/.ts/.js 文件, 检测非 UTF-8 编码文件.

检测策略:
  1. 尝试 UTF-8 严格解码
  2. 失败则尝试 GBK/GB2312 解码识别原编码
  3. 输出文件路径 + 原编码, 便于后续修复
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # client/
SRC = ROOT / "src"
EXTS = {".vue", ".ts", ".js", ".tsx", ".jsx", ".json", ".scss", ".css", ".less", ".html"}


def detect_encoding(path: Path) -> tuple[str, str]:
    """返回 (编码, 首个错误描述). 优先 UTF-8, 再 GBK, 再 GB18030."""
    raw = path.read_bytes()
    # 去 BOM
    if raw.startswith(b"\xef\xbb\xbf"):
        try:
            raw.decode("utf-8")
            return "utf-8-sig", ""
        except UnicodeDecodeError as e:
            return "utf-8-sig-broken", str(e)
    try:
        raw.decode("utf-8")
        return "utf-8", ""
    except UnicodeDecodeError as e1:
        # 尝试 GBK
        try:
            raw.decode("gbk")
            return "gbk", str(e1)
        except UnicodeDecodeError:
            # 尝试 GB18030 (GB18030 兼容 GBK)
            try:
                raw.decode("gb18030")
                return "gb18030", str(e1)
            except UnicodeDecodeError as e2:
                return "unknown", f"utf8:{e1}; gb18030:{e2}"


def main() -> int:
    bad = []
    total = 0
    for ext in EXTS:
        for p in SRC.rglob(f"*{ext}"):
            total += 1
            enc, err = detect_encoding(p)
            if enc not in ("utf-8", "utf-8-sig"):
                rel = p.relative_to(ROOT)
                bad.append((str(rel), enc, err[:80]))
    print(f"=== 扫描 {total} 个文件, 非 UTF-8: {len(bad)} 个 ===\n")
    for rel, enc, err in bad:
        print(f"  [{enc}] {rel}")
        if err:
            print(f"      err: {err}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

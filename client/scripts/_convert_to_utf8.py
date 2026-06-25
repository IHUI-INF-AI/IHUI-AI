"""将 src 下非 UTF-8 编码的源文件批量转换为 UTF-8 (无 BOM).

转换策略 (保守, 不丢数据):
  1. UTF-8 BOM -> 去 BOM 后 UTF-8
  2. UTF-8 -> 跳过 (已是 UTF-8)
  3. GBK -> 转 UTF-8
  4. GB18030 (兼容 GBK/GB2312, 最宽松) -> 转 UTF-8
  5. 全部失败 -> GB18030 + errors='replace' (少数非法字节替换为 U+FFFD, 并记录)

转换后所有文件均为 UTF-8 无 BOM, 保证 Vite/rolldown 能正确加载.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # client/
SRC = ROOT / "src"
EXTS = {".vue", ".ts", ".js", ".tsx", ".jsx", ".json", ".scss", ".css", ".less", ".html"}


def decode_best(raw: bytes) -> tuple[str, str, int]:
    """返回 (文本, 使用的编码, 替换字符数)."""
    # 去 UTF-8 BOM
    if raw.startswith(b"\xef\xbb\xbf"):
        try:
            return raw[3:].decode("utf-8"), "utf-8-sig", 0
        except UnicodeDecodeError:
            pass
    # 纯 UTF-8
    try:
        return raw.decode("utf-8"), "utf-8", 0
    except UnicodeDecodeError:
        pass
    # GBK
    try:
        return raw.decode("gbk"), "gbk", 0
    except UnicodeDecodeError:
        pass
    # GB18030 (最宽松)
    try:
        return raw.decode("gb18030"), "gb18030", 0
    except UnicodeDecodeError:
        pass
    # 兜底: GB18030 + replace
    text = raw.decode("gb18030", errors="replace")
    return text, "gb18030-replace", text.count("\ufffd")


def main() -> int:
    converted = []
    replaced = []
    skipped = 0
    total = 0

    for ext in EXTS:
        for p in SRC.rglob(f"*{ext}"):
            total += 1
            raw = p.read_bytes()
            text, enc, n_repl = decode_best(raw)
            if enc == "utf-8":
                skipped += 1
                continue
            # 写回 UTF-8 无 BOM
            p.write_bytes(text.encode("utf-8"))
            rel = str(p.relative_to(ROOT))
            if n_repl > 0:
                replaced.append((rel, enc, n_repl))
            else:
                converted.append((rel, enc))

    print(f"=== 扫描 {total} 个文件 ===")
    print(f"已是 UTF-8 (跳过): {skipped}")
    print(f"成功转换 (无损): {len(converted)}")
    print(f"转换 (含替换): {len(replaced)}")
    print()

    if converted:
        print("--- 无损转换 ---")
        for rel, enc in converted:
            print(f"  [{enc}] {rel}")
        print()

    if replaced:
        print("--- 含 U+FFFD 替换 (需人工核查) ---")
        for rel, enc, n in replaced:
            print(f"  [{enc}] {rel}  (替换 {n} 处)")
        print()

    return 0 if not replaced else 2  # 2 表示有替换, 需人工核查


if __name__ == "__main__":
    sys.exit(main())

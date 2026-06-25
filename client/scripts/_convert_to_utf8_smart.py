"""智能编码转换: 对每个非 UTF-8 文件, 比较 UTF-8 与 GB18030 的解码错误数,
选择错误更少的编码, 最大限度减少 U+FFFD 替换.

策略:
  1. 统计 raw.decode('utf-8', errors='replace') 的 U+FFFD 数 -> n_utf8
  2. 统计 raw.decode('gb18030', errors='replace') 的 U+FFFD 数 -> n_gb
  3. 去 BOM 后同理统计
  4. 选择 min(n_utf8, n_gb) 对应的编码
  5. 若仍有替换, 记录供人工核查
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # client/
SRC = ROOT / "src"
EXTS = {".vue", ".ts", ".js", ".tsx", ".jsx", ".json", ".scss", ".css", ".less", ".html"}


def count_fffd(raw: bytes, enc: str) -> int:
    return raw.decode(enc, errors="replace").count("\ufffd")


def smart_decode(raw: bytes) -> tuple[str, str, int]:
    """返回 (文本, 编码, 替换数)."""
    # 去 UTF-8 BOM
    bom = raw.startswith(b"\xef\xbb\xbf")
    body = raw[3:] if bom else raw
    # 严格 UTF-8?
    try:
        return body.decode("utf-8"), "utf-8-sig" if bom else "utf-8", 0
    except UnicodeDecodeError:
        pass
    # 严格 GBK?
    try:
        return raw.decode("gbk"), "gbk", 0
    except UnicodeDecodeError:
        pass
    # 严格 GB18030?
    try:
        return raw.decode("gb18030"), "gb18030", 0
    except UnicodeDecodeError:
        pass
    # 比较 UTF-8 vs GB18030 的替换数
    n_utf8 = count_fffd(body, "utf-8")
    n_gb = count_fffd(raw, "gb18030")
    if n_utf8 <= n_gb:
        text = body.decode("utf-8", errors="replace")
        return text, f"utf-8-replace({n_utf8})", n_utf8
    else:
        text = raw.decode("gb18030", errors="replace")
        return text, f"gb18030-replace({n_gb})", n_gb


def main() -> int:
    # 1. 先恢复所有被脚本改过的 src 文件 (git checkout)
    import subprocess
    print("=== 恢复 src 下所有被修改的文件 ===")
    r = subprocess.run(
        ["git", "checkout", "--", "src"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        print(f"git checkout 失败: {r.stderr}")
        return 1
    print("已恢复\n")

    # 2. 重新智能转换
    converted = []
    replaced = []
    skipped = 0
    total = 0

    for ext in EXTS:
        for p in SRC.rglob(f"*{ext}"):
            total += 1
            raw = p.read_bytes()
            text, enc, n_repl = smart_decode(raw)
            if enc in ("utf-8", "utf-8-sig"):
                if enc == "utf-8-sig":
                    # 去 BOM 写回
                    p.write_bytes(text.encode("utf-8"))
                    converted.append((str(p.relative_to(ROOT)), "utf-8-sig->utf-8"))
                else:
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

    return 0 if not replaced else 2


if __name__ == "__main__":
    sys.exit(main())

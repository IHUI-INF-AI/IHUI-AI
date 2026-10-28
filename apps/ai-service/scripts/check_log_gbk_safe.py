# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""日志文本编码体检 —— 防止"整行日志凭空消失"。

背景(2026-10-18 实证):ai-service 在 Windows 下由 nssm 托管,stdout 重定向到文件用的
是 **GBK(cp936)** 编码。任何不在 GBK 里的字符(如 `⇒` U+21D2、`✓` U+2713、`⚠` U+26A0)
在写盘时抛 UnicodeEncodeError,而 **logging 会把这个异常吞掉** —— 表现为:代码明明
执行到了 `logger.warning(...)`,却既没有报错、也没有日志,整行凭空消失。排查时极难发现,
因为"没日志"会被误读成"没执行"。

本脚本用 AST 精确取出所有 `logger.<level>(...)` 调用的格式串(隐式拼接已被解析器合并成
单个常量),逐个检查能否用 GBK 编码;不可编码的报出 文件:行 并 exit 1。

用法:
    python scripts/check_log_gbk_safe.py            # 扫 app/
    python scripts/check_log_gbk_safe.py app tests  # 指定目录
退出码: 0 = 全部可编码; 1 = 发现违规; 2 = 未判定(取不到输入,绝不写成"检查通过")。
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

LOG_LEVELS = {"debug", "info", "warning", "error", "critical", "exception", "log"}
ROOT = Path(__file__).resolve().parent.parent


def iter_log_format_strings(tree: ast.AST):
    """产出 (行号, 格式串)。只认 logger.<level>(...) / logging.<level>(...) 的第一实参。"""
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not isinstance(func, ast.Attribute) or func.attr not in LOG_LEVELS:
            continue
        if not node.args:
            continue
        first = node.args[0]
        if isinstance(first, ast.Constant) and isinstance(first.value, str):
            yield first.lineno, first.value


def non_gbk_chars(text: str) -> dict[str, int]:
    bad: dict[str, int] = {}
    for ch in text:
        if ord(ch) < 128:
            continue
        try:
            ch.encode("gbk")
        except UnicodeEncodeError:
            bad[ch] = bad.get(ch, 0) + 1
    return bad


def main(argv: list[str]) -> int:
    targets = argv[1:] or ["app"]
    files: list[Path] = []
    for t in targets:
        base = ROOT / t
        if not base.exists():
            print(f"[未判定] 目录不存在: {base}")
            return 2
        files.extend(sorted(base.rglob("*.py")))

    if not files:
        print("[未判定] 没有扫到任何 .py —— 判据面为空不算通过")
        return 2

    violations: list[tuple[str, int, dict[str, int]]] = []
    scanned = 0
    strings = 0
    for f in files:
        try:
            tree = ast.parse(f.read_text(encoding="utf-8"), filename=str(f))
        except SyntaxError as e:
            print(f"[未判定] {f} 解析失败: {e}")
            return 2
        scanned += 1
        for lineno, fmt in iter_log_format_strings(tree):
            strings += 1
            bad = non_gbk_chars(fmt)
            if bad:
                violations.append((str(f.relative_to(ROOT)), lineno, bad))

    print(f"已扫 {scanned} 个文件 / {strings} 条日志格式串")
    if not violations:
        print("✓ 全部日志格式串均可用 GBK 编码(不会静默丢行)")
        return 0

    print(f"✗ {len(violations)} 条日志格式串含 GBK 之外的字符 —— 运行到就会整行消失:")
    for path, lineno, bad in violations:
        shown = ", ".join(f"U+{ord(c):04X}({c!r})x{n}" for c, n in bad.items())
        print(f"  {path}:{lineno}  非 GBK 字符: {shown}")
    print("\n修法:把该字符换成 ASCII 或 GBK 覆盖的中文/标点(如 ⇒ 写成 =>,✓ 写成 OK)。")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

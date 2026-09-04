#!/usr/bin/env python
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IHUI-Bench gold-fix 注册表与任务可解性验证(2026-09-03 立,零 LLM)。

validate_bench.py 的健全性验证只证明一个方向 —— 「初始态必须 FAIL」,
即任务定义排除了"未修即通过"的假阳性。但它不证明另一个方向:
「任务真的可解」—— 若某任务无解、或验收方向写错(修对了也不 PASS),
基准分数依然不可信。

本模块为 20 个任务各提供一份【金标准修复】(gold fix):把 fixture 副本
改到权威正确状态,再对其运行任务的全部 checks,断言必须全 PASS。
两个方向合起来 = 任务定义双向自证:
    初始态全 FAIL(validate_bench) + 金标准修复后全 PASS(本模块)
⇒ 该任务的 fixture / 检查器 / 验收方向三者一致有效。

用法:
    python -m bench.validate_bench --gold           # 全量 20 任务 gold 验证
    python -m bench.validate_bench --task fix-calc-divzero --gold
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).resolve().parent
_AI_SERVICE_ROOT = _SCRIPT_DIR.parent
sys.path.insert(0, str(_AI_SERVICE_ROOT))
from bench.run_bench import (  # noqa: E402
    FIXTURES_ROOT,
    TASKS_FILE,
    _load_tasks,
    score_task,
)

GOLD_FIXES: dict[str, Callable[[Path], None]] = {}


def _register(tid: str) -> Callable[[Callable[[Path], None]], Callable[[Path], None]]:
    """注册某任务 id 的 gold fix(纯装饰器,便于一眼看出任务清单)。"""

    def deco(fn: Callable[[Path], None]) -> Callable[[Path], None]:
        GOLD_FIXES[tid] = fn
        return fn

    return deco


def _write(workdir: Path, rel: str, content: str) -> None:
    """整文件覆写(新文件或整体改写)。"""
    target = workdir / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def _replace(workdir: Path, rel: str, old: str, new: str) -> None:
    """文件内唯一文本替换;锚点缺失立即抛错(gold fix 自身缺陷要暴露)。"""
    target = workdir / rel
    text = target.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise AssertionError(
            f"gold-fix 锚点不唯一/缺失 ({rel}): {old.splitlines()[0][:60]!r} "
            f"count={text.count(old)}"
        )
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


# ---------------------------------------------------------------------------
# fix 类:最小修复(改 bug,不重构)
# ---------------------------------------------------------------------------

@_register("fix-calc-divzero")
def _fix_calc_divzero(wd: Path) -> None:
    _replace(
        wd, "calc.py",
        '"""两数相除(注:此处为故意埋设的 bug,除零未处理)。"""\n    return a / b',
        '"""两数相除,除零安全返回 0.0。"""\n    if b == 0:\n        return 0.0\n    return a / b',
    )


@_register("fix-calc-percent")
def _fix_calc_percent(wd: Path) -> None:
    _replace(
        wd, "calc.py",
        '"""计算 value 的 pct 百分比(注:此处为故意埋设的 bug,漏掉 /100)。"""\n'
        "    return value * pct",
        '"""计算 value 的 pct 百分比。"""\n'
        "    return value * pct / 100",
    )


@_register("fix-calc-multiply")
def _fix_calc_multiply(wd: Path) -> None:
    _replace(
        wd, "calc.py",
        '"""两数相乘(注:此处为故意埋设的 bug,正确应为 a * b)。"""\n    return a + b',
        '"""两数相乘。"""\n    return a * b',
    )


@_register("fix-cli-import")
def _fix_cli_import(wd: Path) -> None:
    _replace(
        wd, "cli.py",
        "# 注:此处为故意埋设的 bug —— 该模块不存在,会导致 ImportError,\n"
        "# 任何 `from cli import ...` 都会失败。应删除此行。\n"
        "import nonexistent_fake_module  # noqa: F401",
        "",
    )


@_register("fix-cli-deadcode")
def _fix_cli_deadcode(wd: Path) -> None:
    _replace(
        wd, "cli.py",
        "def dead_code_helper() -> int:\n"
        '    """注:此处为故意埋设的死代码,从未被调用,应删除。"""\n'
        "    x = 1\n"
        "    for i in range(10):\n"
        "        x += i\n"
        "    return x\n\n\n",
        "",
    )


@_register("fix-text-reverse")
def _fix_text_reverse(wd: Path) -> None:
    _replace(
        wd, "text_utils.py",
        '"""字符串反转(注:此处为故意埋设的 bug,步长应为 -1)。"""\n    return text[::1]',
        '"""字符串反转。"""\n    return text[::-1]',
    )


@_register("fix-report-avg")
def _fix_report_avg(wd: Path) -> None:
    _replace(
        wd, "report.py",
        "    return total / 1",
        "    return total / len(rows) if rows else 0.0",
    )


@_register("fix-report-total")
def _fix_report_total(wd: Path) -> None:
    _replace(
        wd, "report.py",
        "        # 注:此处为故意埋设的 bug —— 每次循环多 +1,合计应为 sum(amount)\n"
        "        total = total + 1",
        "        total += r[\"amount\"]",
    )


# ---------------------------------------------------------------------------
# test 类:补测试
# ---------------------------------------------------------------------------

_CALC_EDGE_TEST = '''"""calc 边界用例(边缘输入确定性测试,2026-09-03 gold fix)。"""

from calc import add, divide, percentage, average


def test_add_negative() -> None:
    assert add(-1, -2) == -3


def test_add_float() -> None:
    assert add(0.1, 0.2) == 0.30000000000000004


def test_divide_by_zero_zero_dividend() -> None:
    assert divide(0, 0) == 0.0


def test_percentage_full() -> None:
    assert percentage(200, 100) == 200.0


def test_average_single() -> None:
    assert average([42.0]) == 42.0
'''


@_register("test-calc-edge")
def _test_calc_edge(wd: Path) -> None:
    _write(wd, "tests/test_calc_edge.py", _CALC_EDGE_TEST)


_CLI_ERRORS_TEST = '''"""cli 错误路径用例(2026-09-03 gold fix)。"""

from cli import main


def test_main_no_args(capsys) -> None:
    rc = main([])
    assert rc == 1
    assert "usage" in capsys.readouterr().out
'''


@_register("test-cli-errors")
def _test_cli_errors(wd: Path) -> None:
    # 错误路径测试需要 cli 可被导入 → gold fix 顺带移除坏 import
    _replace(
        wd, "cli.py",
        "# 注:此处为故意埋设的 bug —— 该模块不存在,会导致 ImportError,\n"
        "# 任何 `from cli import ...` 都会失败。应删除此行。\n"
        "import nonexistent_fake_module  # noqa: F401",
        "",
    )
    _write(wd, "tests/test_cli_errors.py", _CLI_ERRORS_TEST)


_REPORT_EMPTY_TEST = '''"""report / aggregate 空输入行为用例(2026-09-03 gold fix)。"""

from report import generate_report
from aggregate import summarize


def test_generate_report_empty() -> None:
    out = generate_report([])
    assert "合计: ¥0.00" in out


def test_summarize_empty() -> None:
    assert summarize([]) == "¥0.00"
'''


@_register("test-report-empty")
def _test_report_empty(wd: Path) -> None:
    _write(wd, "tests/test_report_empty.py", _REPORT_EMPTY_TEST)


_WORDCOUNT_TEST = '''"""word_count 边界用例(2026-09-03 gold fix)。"""

from text_utils import word_count


def test_word_count_multiline() -> None:
    assert word_count("a\\nb\\nc") == 3


def test_word_count_punctuation() -> None:
    # 仅按空白切分,标点不切词
    assert word_count("hello, world!") == 2


def test_word_count_whitespace_only() -> None:
    assert word_count("   ") == 0
'''


@_register("test-text-wordcount")
def _test_text_wordcount(wd: Path) -> None:
    _write(wd, "tests/test_text_wordcount.py", _WORDCOUNT_TEST)


@_register("test-text-slugify")
def _test_text_slugify(wd: Path) -> None:
    _replace(
        wd, "tests/test_text_utils.py",
        "from text_utils import word_count, to_uppercase, reverse",
        "from text_utils import slugify, word_count, to_uppercase, reverse",
    )
    # 追加 test_slugify 到文件末尾
    p = wd / "tests/test_text_utils.py"
    text = p.read_text(encoding="utf-8")
    p.write_text(
        text.rstrip("\n") + '\n\n\ndef test_slugify() -> None:\n'
        '    assert slugify("Hello World Foo") == "hello-world-foo"\n',
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# refactor 类:结构重组(行为不变,测试仍全过)
# ---------------------------------------------------------------------------

_CALC_VALIDATED = '''"""迷你计算器模块(含内部校验,供 IHUI-Bench 重构任务使用)。"""

from typing import List


def _is_number(value: object) -> bool:
    """内部校验:是否为 int/float 数值。"""
    return isinstance(value, (int, float))


def add(a: float, b: float) -> float:
    """两数相加。"""
    return a + b


def subtract(a: float, b: float) -> float:
    """两数相减。"""
    return a - b


def multiply(a: float, b: float) -> float:
    """两数相乘。"""
    return a * b


def divide(a: float, b: float) -> float:
    """两数相除,除零或非数值除数安全返回 0.0。"""
    if not _is_number(b) or b == 0:
        return 0.0
    return a / b


def percentage(value: float, pct: float) -> float:
    """计算 value 的 pct 百分比。"""
    return value * pct / 100


def average(numbers: List[float]) -> float:
    """求平均值,空列表安全返回 0.0。"""
    if not numbers:
        return 0.0
    return sum(numbers) / len(numbers)
'''


@_register("refactor-calc-validate")
def _refactor_calc_validate(wd: Path) -> None:
    _write(wd, "calc.py", _CALC_VALIDATED)


_CLI_DISPATCH = '''"""命令行小工具(dispatch 分发,供 IHUI-Bench 重构任务使用)。"""

import sys


def greet(name: str) -> str:
    """返回问候语。"""
    return f"Hello, {name}!"


def dispatch(argv: list[str] | None = None) -> int:
    """命令分发:空参数打 usage,否则打印问候语。"""
    argv = argv if argv is not None else sys.argv[1:]
    if not argv:
        print("usage: cli <name>")
        return 1
    print(greet(argv[0]))
    return 0


def main(argv: list[str] | None = None) -> int:
    """CLI 入口(委托 dispatch)。"""
    return dispatch(argv)


if __name__ == "__main__":
    sys.exit(main())
'''


@_register("refactor-cli-dispatch")
def _refactor_cli_dispatch(wd: Path) -> None:
    _write(wd, "cli.py", _CLI_DISPATCH)


_TEXT_NORMALIZE = '''"""文本工具模块(normalize 归一化,供 IHUI-Bench 重构任务使用)。"""


def word_count(text: str) -> int:
    """统计词数(按空白切分)。"""
    return len(text.split())


def to_uppercase(text: str) -> str:
    """转为大写。"""
    return text.upper()


def normalize_whitespace(text: str) -> str:
    """把连续空白折叠为单个空格并去除首尾空白。"""
    return " ".join(text.split())


def slugify(text: str) -> str:
    """slug 化:归一化空白、小写、空格转连字符、去除空片段。"""
    normalized = normalize_whitespace(text).lower()
    parts = [p for p in normalized.split() if p]
    return "-".join(parts)


def reverse(text: str) -> str:
    """字符串反转。"""
    return text[::-1]
'''


@_register("refactor-text-normalize")
def _refactor_text_normalize(wd: Path) -> None:
    _write(wd, "text_utils.py", _TEXT_NORMALIZE)


_COMMON_PY = '''"""共享货币格式化模块(自 report/aggregate 提取,2026-09-03 gold fix)。"""


def format_currency(value: float) -> str:
    """格式化金额为 ¥ 字符串。"""
    return f"¥{value:.2f}"
'''

_REPORT_COMMON = '''"""数据汇总模块(共享格式化逻辑见 common.py)。"""

from common import format_currency


def generate_report(rows: list[dict]) -> str:
    """生成逐行报表并打印合计。"""
    lines = []
    total = 0.0
    for r in rows:
        total += r["amount"]
        lines.append(f"{r['name']}: {format_currency(r['amount'])}")
    lines.append(f"合计: {format_currency(total)}")
    return "\\n".join(lines)


def avg_amount(rows: list[dict]) -> float:
    """计算平均金额;空列表安全返回 0.0。"""
    if not rows:
        return 0.0
    total = 0.0
    for r in rows:
        total += r["amount"]
    return total / len(rows)
'''

_AGGREGATE_COMMON = '''"""聚合模块(格式化逻辑复用 common.format_currency)。"""

from common import format_currency


def summarize(rows: list[dict]) -> str:
    """对金额求和并以货币格式返回。"""
    total = 0.0
    for r in rows:
        total += r["amount"]
    return format_currency(total)
'''


@_register("refactor-report-common")
def _refactor_report_common(wd: Path) -> None:
    _write(wd, "common.py", _COMMON_PY)
    _write(wd, "report.py", _REPORT_COMMON)
    _write(wd, "aggregate.py", _AGGREGATE_COMMON)


# ---------------------------------------------------------------------------
# multifile 类:拆分为多文件(report/format/ops/parser 等新模块)
# ---------------------------------------------------------------------------

_FORMAT_PY = '''"""货币格式化模块(2026-09-03 gold fix)。"""


def format_currency(value: float) -> str:
    """格式化金额为 ¥ 字符串。"""
    return f"¥{value:.2f}"
'''

_DATA_PY = '''"""报表数据生成模块(generate_report 自 report 拆出)。"""

from format import format_currency


def generate_report(rows: list[dict]) -> str:
    """生成逐行报表并打印合计。"""
    lines = []
    total = 0.0
    for r in rows:
        total += r["amount"]
        lines.append(f"{r['name']}: {format_currency(r['amount'])}")
    lines.append(f"合计: {format_currency(total)}")
    return "\\n".join(lines)
'''

_REPORT_SPLIT = (
    '"""数据汇总模块(入口聚合:generate_report 见 data.py,'
    'format_currency 见 format.py)。"""\n'
    "\n"
    "from data import generate_report\n"
    "from format import format_currency\n"
    "\n"
    "\n"
    "def avg_amount(rows: list[dict]) -> float:\n"
    '    """计算平均金额;空列表安全返回 0.0。"""\n'
    "    if not rows:\n"
    "        return 0.0\n"
    "    total = 0.0\n"
    "    for r in rows:\n"
    '        total += r["amount"]\n'
    "    return total / len(rows)\n"
)

_AGGREGATE_SPLIT = '''"""聚合模块(格式化复用 format.format_currency)。"""

from format import format_currency


def summarize(rows: list[dict]) -> str:
    """对金额求和并以货币格式返回。"""
    total = 0.0
    for r in rows:
        total += r["amount"]
    return format_currency(total)
'''


@_register("multifile-report-split")
def _multifile_report_split(wd: Path) -> None:
    _write(wd, "format.py", _FORMAT_PY)
    _write(wd, "data.py", _DATA_PY)
    _write(wd, "report.py", _REPORT_SPLIT)
    _write(wd, "aggregate.py", _AGGREGATE_SPLIT)


_PARSER_PY = '''"""命令行参数解析模块(自 cli 拆出,2026-09-03 gold fix)。"""

import sys


def parse_args(argv: list[str] | None = None) -> list[str]:
    """返回参数列表(默认取 sys.argv[1:])。"""
    return argv if argv is not None else sys.argv[1:]
'''

_CLI_PARSER = '''"""命令行小工具(参数解析见 parser.py)。"""

import sys

from parser import parse_args


def greet(name: str) -> str:
    """返回问候语。"""
    return f"Hello, {name}!"


def main(argv: list[str] | None = None) -> int:
    """CLI 入口:空参数打 usage,否则打印问候语。"""
    args = parse_args(argv)
    if not args:
        print("usage: cli <name>")
        return 1
    print(greet(args[0]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
'''


@_register("multifile-cli-parser")
def _multifile_cli_parser(wd: Path) -> None:
    _write(wd, "parser.py", _PARSER_PY)
    _write(wd, "cli.py", _CLI_PARSER)


_OPS_PY = '''"""ops 运算模块(自 calc.py 拆出,含全部修复,2026-09-03 gold fix)。"""

from typing import List


def add(a: float, b: float) -> float:
    """两数相加。"""
    return a + b


def subtract(a: float, b: float) -> float:
    """两数相减。"""
    return a - b


def multiply(a: float, b: float) -> float:
    """两数相乘。"""
    return a * b


def divide(a: float, b: float) -> float:
    """两数相除,除零安全返回 0.0。"""
    if b == 0:
        return 0.0
    return a / b


def percentage(value: float, pct: float) -> float:
    """计算 value 的 pct 百分比。"""
    return value * pct / 100


def average(numbers: List[float]) -> float:
    """求平均值,空列表安全返回 0.0。"""
    if not numbers:
        return 0.0
    return sum(numbers) / len(numbers)
'''

_CALC_SPLIT = '''"""迷你计算器模块(入口:运算实现见 ops.py)。"""

from ops import add, subtract, multiply, divide, percentage, average

__all__ = ["add", "subtract", "multiply", "divide", "percentage", "average"]
'''


@_register("multifile-calc-split")
def _multifile_calc_split(wd: Path) -> None:
    _write(wd, "ops.py", _OPS_PY)
    _write(wd, "calc.py", _CALC_SPLIT)


# ---------------------------------------------------------------------------
# 可解性验证
# ---------------------------------------------------------------------------

def verify_task(task: dict[str, Any]) -> dict[str, Any]:
    """复制 fixture → 应用 gold fix → 重跑全部 checks → 必须全 PASS。"""
    tid = task["id"]
    fix = GOLD_FIXES.get(tid)
    base: dict[str, Any] = {
        "id": tid,
        "category": task.get("category", ""),
        "fixture": task.get("fixture", ""),
        "check_count": len(task.get("checks") or []),
        "gold": fix is not None,
        "apply_error": None,
        "checks_passed": 0,
        "checks_total": 0,
        "valid": False,
    }
    if fix is None:
        return base

    fixture = FIXTURES_ROOT / task["fixture"]
    with tempfile.TemporaryDirectory(prefix=f"ihui_bench_gold_{tid}_") as tmp:
        workdir = Path(tmp) / "src"
        shutil.copytree(fixture, workdir)
        try:
            fix(workdir)
        except Exception as e:  # noqa: BLE001 - gold fix 自身缺陷要作为 apply_error 上报
            base["apply_error"] = f"{type(e).__name__}: {e}"
            return base
        results, passed, total = score_task(task, workdir)
        base["checks_passed"] = passed
        base["checks_total"] = total
        base["valid"] = total > 0 and passed == total
        base["failing"] = [
            f"#{i} {r['type']}: {r.get('detail', '')}"
            for i, r in enumerate(results)
            if not r["pass"]
        ]
    return base


def verify_all(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """对任务列表执行 gold 可解性验证,返回逐任务 findings。"""
    return [verify_task(t) for t in tasks]


def main(argv: list[str] | None = None) -> int:
    """CLI 入口(供 python -m bench.gold_fixes 直接调用)。"""
    import argparse

    parser = argparse.ArgumentParser(description="IHUI-Bench gold-fix 可解性验证")
    parser.add_argument("--task", help="只验证指定任务 id")
    parser.add_argument("--json", action="store_true", help="输出机器可读 JSON")
    args = parser.parse_args(argv)

    tasks = _load_tasks(TASKS_FILE)
    if args.task:
        tasks = [t for t in tasks if t["id"] == args.task]
        if not tasks:
            print(f"任务不存在: {args.task}", file=sys.stderr)
            return 2

    missing = [t["id"] for t in tasks if t["id"] not in GOLD_FIXES]
    findings = verify_all(tasks)
    ok = sum(1 for f in findings if f["valid"])

    if args.json:
        print(json.dumps({
            "total": len(findings), "valid": ok,
            "missing_gold": missing, "tasks": findings,
        }, ensure_ascii=False, indent=1))
    else:
        for f in findings:
            if not f["gold"]:
                print(f"❌ {f['id']:<24} 无 gold fix 注册")
            elif f["apply_error"]:
                print(f"❌ {f['id']:<24} gold fix 应用失败: {f['apply_error']}")
            elif f["valid"]:
                print(
                    f"✅ {f['id']:<24} 可解 "
                    f"({f['checks_passed']}/{f['checks_total']} checks 全 PASS)"
                )
            else:
                print(
                    f"❌ {f['id']:<24} 修后仍 FAIL "
                    f"({f['checks_passed']}/{f['checks_total']})"
                )
                for line in f.get("failing", []):
                    print(f"      ↳ {line}")
        if missing:
            print(f"\n⚠️ {len(missing)} 个任务缺 gold fix: {missing}")
        print(f"\n{ok}/{len(findings)} 任务可解性验证通过")

    if missing or ok != len(findings):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D122 压缩评测报告的"重跑不漂移"常驻锁(2026-10-02 立)。

为什么值得单独一条锁:报告是 git 跟踪件,而提交链的 lint-staged 对 ``*.md`` 跑
``prettier --write``。生成器若不自带同一把格式化器,就会陷入"每次提交被重排 / 每次重跑
又写回未排版形态"的自冲突 —— 那份报告常年挂 `` M``,读起来像别人在飞的改动,实际是
自己的交付在自我打架(2026-10-02 实测到,数字逐字未变而表格空白在漂)。

三条用例各管一格,缺一不可:
- 重跑同字节:生成器自身的确定性(数字与排版都不抖)。
- 入库那份无需再排版:交付物与提交链同形,这条才是"不再挂 `` M``"的真判据。
- 判据有牙:把排版手动压扁后的副本必须 ``--check`` 失败,否则第二条可能是恒绿的空判据。
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = AI_SERVICE_ROOT.parents[1]
EVAL_SCRIPT = AI_SERVICE_ROOT / "scripts" / "eval_compaction.py"
OUTPUT_DIR = AI_SERVICE_ROOT / "scripts" / "compaction_eval" / "outputs"
PRETTIER = REPO_ROOT / "node_modules" / ".bin" / "prettier.CMD"
PRETTIER_CONFIG = REPO_ROOT / ".prettierrc"
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def _run_eval(out_dir: Path) -> Path:
    """把评测脚本跑一次并把报告落到指定目录,返回那份报告的绝对路径。"""
    proc = subprocess.run(
        [
            sys.executable,
            "-X",
            "utf8",
            str(EVAL_SCRIPT),
            "--output-dir",
            str(out_dir),
        ],
        cwd=AI_SERVICE_ROOT,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=900,
        creationflags=NO_WINDOW,
    )
    assert proc.returncode == 0, f"评测脚本 rc={proc.returncode}\n{proc.stdout[-1500:]}\n{proc.stderr[-1500:]}"
    produced = sorted(out_dir.glob("compaction-eval-baseline-*.md"))
    # 少于 1 个不能当成"通过":文件名漂了(改了命名规则而测试没跟)会让断言对着空气比。
    assert len(produced) == 1, f"期望恰好 1 份报告,实得 {len(produced)} 个:{[p.name for p in produced]}"
    return produced[0]


def _prettier_check(path: Path) -> int:
    """问 prettier"这份还需要排版吗":0 = 已与格式化器同形,1 = 还要改。

    显式带 ``--config``:临时目录在仓外,向上找不到本仓配置时会落到 prettier 默认档,
    默认档与本仓 ``.prettierrc`` 未必同形 —— 那时"通过"证明的不是提交链的那件事。
    """
    args = [str(PRETTIER)]
    if PRETTIER_CONFIG.exists():
        args += ["--config", str(PRETTIER_CONFIG)]
    proc = subprocess.run(
        [*args, "--check", str(path)],
        cwd=REPO_ROOT,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
        creationflags=NO_WINDOW,
    )
    return proc.returncode


def test_1_rerun_is_byte_identical(tmp_path: Path) -> None:
    """同一评测集连跑两次必须逐字节同形 —— "可重复运行"若不落成语句就只是叙述。"""
    first = _run_eval(tmp_path / "run-a")
    second = _run_eval(tmp_path / "run-b")
    a, b = first.read_bytes(), second.read_bytes()
    assert a == b, "两次重跑产出的报告不同形:报告里混进了与评测内容无关的不确定量(时刻/随机/排序)"


def test_2_tracked_report_needs_no_further_formatting() -> None:
    """入库那份报告已经就是提交链会产出的排版 ⇒ 重跑不会让它挂 `` M``。"""
    tracked = sorted(OUTPUT_DIR.glob("compaction-eval-baseline-*.md"))
    assert tracked, f"入库报告不在位({OUTPUT_DIR})—— 交付已丢,不是「这次没得比」"
    for path in tracked:
        assert _prettier_check(path) == 0, (
            f"{path.name} 仍需 prettier 重排:提交链会改它而生成器不产这个形态,"
            "于是每次提交与每次重跑互相顶,报告永久挂 M。修法只有一条:生成器自带同一把格式化器。"
        )


def test_3_check_arm_has_teeth(tmp_path: Path) -> None:
    """负向对照:把表格空白压扁后的副本必须判"还要排版",否则第二条可能是空判据。"""
    tracked = sorted(OUTPUT_DIR.glob("compaction-eval-baseline-*.md"))
    assert tracked, "没有入库报告可比,本条无从证明判据有牙"
    original = tracked[0].read_text(encoding="utf-8")
    flattened = "\n".join(line.replace("  ", " ") for line in original.split("\n"))
    assert flattened != original, "压扁后与原文件逐字相同 ⇒ 这份报告本来就没有对齐排版,第二条断言与格式化器无关"
    copy = tmp_path / "flattened-report.md"
    copy.write_text(flattened, encoding="utf-8")
    assert _prettier_check(copy) != 0, (
        "把排版压扁后 prettier --check 仍回 0 ⇒ 这条判据看不见排版差异"
        "(被 .prettierignore 命中或配置没生效时就是这个形状)"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

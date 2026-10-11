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

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = AI_SERVICE_ROOT.parents[1]
EVAL_SCRIPT = AI_SERVICE_ROOT / "scripts" / "eval_compaction.py"
OUTPUT_DIR = AI_SERVICE_ROOT / "scripts" / "compaction_eval" / "outputs"
PRETTIER_CONFIG = REPO_ROOT / ".prettierrc"
# 版本锚 = 根 package.json devDependencies 的 prettier(^3.9.6)。兜底走 npx 时
# 必须钉同一版本线:排版器不同形,"--check 通过"证明的就不是提交链那件事。
_PRETTIER_VERSION_ANCHOR = "3.9.6"
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

_PRETTIER_ARGV_CACHE: list[str] | None = None


def _prettier_argv() -> list[str]:
    """解析 prettier 入口(2026-10-11 修,CI run 38084051334 红因组)。

    原实现把入口硬编码成 ``node_modules/.bin/prettier.CMD`` —— 两头都断:
    ``.CMD`` 是 Windows-only 的 npm shim 文件名,Linux 上无论装没装 node_modules
    都 FileNotFoundError;而 CI 的 test-python job 本就只装 python 依赖,
    node_modules 不在位。判据(入库报告与提交链同一把格式化器同形)不变,
    解析顺序改为:

      1. 本仓 node_modules 的 bin 入口(Windows ``prettier.CMD`` / POSIX
         ``prettier``)—— 与提交链 lint-staged 用的**同一份安装**,首选;
      2. 本仓 node_modules 包内的 ``bin/prettier.cjs`` 直接以当前 node 驱动
         (bin 目录 shim 缺失但包在位时的同版本路径);
      3. ``npx --yes prettier@<版本锚>`` —— 干净树/CI 兜底(有网即得,
         版本由 _PRETTIER_VERSION_ANCHOR 钉死);
      4. PATH 上的 prettier。

    四级都落空 ⇒ pytest.fail(宁红不跳 —— 静默放行会让第三条判据退化成空判)。
    结果进程内缓存一次。
    """
    global _PRETTIER_ARGV_CACHE
    if _PRETTIER_ARGV_CACHE is not None:
        return _PRETTIER_ARGV_CACHE
    bin_dir = REPO_ROOT / "node_modules" / ".bin"
    for candidate in (bin_dir / "prettier.CMD", bin_dir / "prettier"):
        if candidate.is_file():
            _PRETTIER_ARGV_CACHE = [str(candidate)]
            return _PRETTIER_ARGV_CACHE
    pkg_bin = REPO_ROOT / "node_modules" / "prettier" / "bin" / "prettier.cjs"
    if pkg_bin.is_file():
        node = shutil.which("node")
        if node:
            _PRETTIER_ARGV_CACHE = [node, str(pkg_bin)]
            return _PRETTIER_ARGV_CACHE
    npx_exe = shutil.which("npx.CMD") or shutil.which("npx")
    if npx_exe:
        _PRETTIER_ARGV_CACHE = [npx_exe, "--yes", f"prettier@{_PRETTIER_VERSION_ANCHOR}"]
        return _PRETTIER_ARGV_CACHE
    on_path = shutil.which("prettier.CMD") or shutil.which("prettier")
    if on_path:
        _PRETTIER_ARGV_CACHE = [on_path]
        return _PRETTIER_ARGV_CACHE
    pytest.fail(
        "找不到可用的 prettier(node_modules bin / 包内 cjs / npx / PATH 四级全空):"
        "报告排版判据无法执行,宁红不跳。出路是给执行环境装 prettier"
        "(本仓 pnpm install 即得),不是放宽断言。"
    )


def _prettier_base_args() -> list[str]:
    args = _prettier_argv()
    if PRETTIER_CONFIG.exists():
        args += ["--config", str(PRETTIER_CONFIG)]
    return args


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
    proc = subprocess.run(
        [*_prettier_base_args(), "--check", str(path)],
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


def _prettier_file_info_ignored(path: Path) -> bool | None:
    """问 prettier 自己"这份被 .prettierignore 命中吗";取不到返回 None(不猜)。

    必须有这一维:被忽略的输入 ``--check`` 也回 0,单看退出码会把"没判"读成"判过了"。
    """
    proc = subprocess.run(
        [*_prettier_base_args(), "--file-info", str(path)],
        cwd=REPO_ROOT,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
        creationflags=NO_WINDOW,
    )
    if proc.returncode != 0:
        return None
    return '"ignored": true' in (proc.stdout or "")


def test_2_tracked_report_needs_no_further_formatting() -> None:
    """入库那份报告已经就是提交链会产出的排版 ⇒ 重跑不会让它挂 `` M``。"""
    tracked = sorted(OUTPUT_DIR.glob("compaction-eval-baseline-*.md"))
    assert tracked, f"入库报告不在位({OUTPUT_DIR})—— 交付已丢,不是「这次没得比」"
    for path in tracked:
        ignored = _prettier_file_info_ignored(path)
        assert ignored is False, (
            f"{path.name} 的「是否被 prettier 忽略」判不出或被忽略(实得 {ignored}):"
            "被忽略时 --check 恒回 0,本条会退化成空判据。出路是把它移出 .prettierignore 射程,"
            "不是放宽本断言。"
        )
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


def test_4_live_with_dead_channel_exits_undetermined(tmp_path: Path) -> None:
    """``--live`` 一次回答都没拿到时必须退出码 2(未判定),不得回 0 冒充"出数了"。

    通道指向本机 9 号端口(discard,连接被拒)⇒ 零外呼、零花费,只验退出码分流。
    这条是本会话实测逼出来的:keyless 免费通道今天回 402,而旧行为是"报告照写、RC=0"——
    读报告的人会把它登记成"当期数字已出"。
    """
    import json
    import os

    os.makedirs(tmp_path / "live-dead", exist_ok=True)
    # 只取评测集第一题:本题要证的是"零回答 ⇒ 退出码 2",与题量无关;
    # 拿全 10 题打一个必拒端口会让这条常驻用例白跑 40 次网络往返。
    full = json.loads((OUTPUT_DIR.parent / "tasks.json").read_text(encoding="utf-8"))
    subset = [full["tasks"][0]] if isinstance(full, dict) and full.get("tasks") else [full[0]]
    tasks_file = tmp_path / "one-task.json"
    tasks_file.write_text(json.dumps({"tasks": subset}, ensure_ascii=False), encoding="utf-8")

    env = {
        **os.environ,
        "EVAL_LLM_API_BASE": "http://127.0.0.1:9/v1/chat/completions",
        "EVAL_LLM_API_KEY": "probe-key-not-used",
        "EVAL_LLM_MODEL": "probe-model",
    }
    proc = subprocess.run(
        [
            sys.executable,
            "-X",
            "utf8",
            str(EVAL_SCRIPT),
            "--live",
            "--tasks",
            str(tasks_file),
            "--output-dir",
            str(tmp_path / "live-dead"),
            "--llm-timeout",
            "5",
        ],
        cwd=AI_SERVICE_ROOT,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=900,
        creationflags=NO_WINDOW,
        env=env,
    )
    blob = proc.stdout + proc.stderr
    assert proc.returncode == 2, (
        f"--live 零回答却回了 rc={proc.returncode}(期望 2=未判定)。"
        "把'没跑到'读成'跑过了'是本仓最贵的失效型\n---8<---\n" + blob[-1200:]
    )
    assert "未判定" in blob, f"rc=2 却没点名'未判定',调用方无法区分它与其他失败:\n{blob[-800:]}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

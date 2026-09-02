# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""IHUI-Bench v0 冒烟测试:stub 模式跑通完整链路(不断言通过率)。

通过子进程调用 `python -m bench.run_bench`,避免与测试进程共享 app 运行时
状态(conftest 的 monkeypatch 等),也确保 fixture 副本落在系统临时目录、
不会误收集 ai-service 自身的测试套件。
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest


def _run_bench(args: list[str]) -> subprocess.CompletedProcess:
    """以子进程运行 bench,继承当前 python 解释器与 cwd。"""
    return subprocess.run(
        [sys.executable, "-m", "bench.run_bench", *args],
        capture_output=True,
        text=True,
        timeout=300,
    )


def test_bench_help() -> None:
    """--help 必须可用且退出码为 0。"""
    proc = _run_bench(["--help"])
    assert proc.returncode == 0, proc.stderr
    # argparse 默认输出到 stdout,含 usage 字样
    assert "usage" in proc.stdout.lower() or "Usage" in proc.stdout


def test_bench_smoke_stub() -> None:
    """stub 模式 --limit 2 跑 bench,断言报告结构合法。"""
    with tempfile.TemporaryDirectory() as td:
        report = Path(td) / "report.md"
        proc = _run_bench([
            "--executor", "stub",
            "--limit", "2",
            "--report", str(report),
        ])
        # 脚本本身必须正常退出(bench 任务失败 ≠ 脚本报错)
        assert proc.returncode == 0, proc.stderr

        # markdown 报告存在
        assert report.exists(), proc.stdout
        md = report.read_text(encoding="utf-8")
        assert "IHUI-Bench" in md

        # JSON 汇总存在且结构合法
        json_path = report.with_suffix(".json")
        assert json_path.exists(), proc.stdout
        data = json.loads(json_path.read_text(encoding="utf-8"))

        # 恰好 2 个任务,且每个都有 id 与占位检查结果
        assert "tasks" in data
        assert len(data["tasks"]) == 2
        for t in data["tasks"]:
            assert "id" in t
            assert "category" in t
            assert "checks" in t
            assert isinstance(t["checks"], list)
            # 占位检查结果存在(可能全 fail,但结构必须在)
            assert len(t["checks"]) >= 1
            for c in t["checks"]:
                assert "type" in c
                assert "pass" in c

        # 明确不断言 pass_rate(本测试只验证链路与结构)

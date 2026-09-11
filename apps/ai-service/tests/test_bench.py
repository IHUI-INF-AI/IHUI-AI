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
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from app.core.llm_gateway import VENDOR_ENV_KEYS


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


def test_bench_smoke_self_healing() -> None:
    """self-healing 执行器结构冒烟:强制开自愈跑 1 任务,断言 self_heal_runs 字段。

    网络隔离:self-healing 走 loop_v2 真实 llm_gateway 路径,而 .env 含真实
    API key。子进程 cwd 换到临时目录(config 的 env_file=".env" 相对 cwd,
    读不到 → settings 无 key),同时清空全部 vendor key env(os.environ 层
    也无 key)→ gateway 落 stub 降级,不真实调网。
    """
    ai_service_root = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as td:
        report = Path(td) / "report.md"
        env = {
            k: v
            for k, v in os.environ.items()
            if k not in VENDOR_ENV_KEYS and k != "LLM_PROVIDERS"
        }
        env["PYTHONPATH"] = str(ai_service_root) + os.pathsep + env.get("PYTHONPATH", "")
        proc = subprocess.run(
            [
                sys.executable, "-m", "bench.run_bench",
                "--executor", "self-healing",
                "--limit", "1",
                "--report", str(report),
            ],
            capture_output=True,
            text=True,
            timeout=300,
            cwd=td,
            env=env,
        )
        assert proc.returncode == 0, proc.stderr

        assert report.exists(), proc.stdout
        data = json.loads(
            report.with_suffix(".json").read_text(encoding="utf-8")
        )
        assert len(data["tasks"]) == 1
        task = data["tasks"][0]
        # 评测闭环契约:结果必须携带自愈触发计数(stub 响应不产生失败测试
        # 信号,计数值应为 0,但字段必须存在且为 int)
        assert "self_heal_runs" in task
        assert isinstance(task["self_heal_runs"], int)

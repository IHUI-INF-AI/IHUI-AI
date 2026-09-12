# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""黄金 E2E runner(0-2)测试:golden 直评 + review/checkpoint 端到端断言。

- 子进程跑 runner 子集(与 test_bench 同款调用方式),断言 JSON 报告结构与
  --min-pass-rate 门禁退出码语义;
- 直接调用 runner 的断言函数,覆盖 review(step evidence / decision 完整性)
  与 checkpoint(产生 / 回滚恢复文件状态)逻辑本体。
"""

from __future__ import annotations

import asyncio
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from bench.run_bench import _load_tasks
from bench.run_golden_e2e import (
    _assert_checkpoint_roundtrip,
    _assert_review_evidence,
    _select_tasks,
)


def _run_e2e(args: list[str]) -> subprocess.CompletedProcess:
    """以子进程运行黄金 E2E runner,继承当前解释器与 cwd。"""
    return subprocess.run(
        [sys.executable, "-m", "bench.run_golden_e2e", *args],
        capture_output=True,
        text=True,
        timeout=600,
    )


# ---------------------------------------------------------------------------
# 任务子集选择
# ---------------------------------------------------------------------------

def test_select_tasks_default_subset_is_20() -> None:
    """默认取前 20 个任务(PROJECT_PLAN 0-2:复用 20 任务子集)。"""
    tasks = _load_tasks()
    selected = _select_tasks(tasks, type("Args", (), {"tasks": None, "all": False})())
    assert len(selected) == 20
    assert [t["id"] for t in selected] == [t["id"] for t in tasks[:20]]


def test_select_tasks_explicit_ids_and_all() -> None:
    """--tasks 按 id 选取且保序;--all 取全部;未知 id 报错退出。"""
    tasks = _load_tasks()
    by_id = {t["id"]: t for t in tasks}
    first, second = tasks[0]["id"], tasks[3]["id"]

    explicit = _select_tasks(
        tasks, type("Args", (), {"tasks": f" {second},{first} ", "all": False})()
    )
    assert [t["id"] for t in explicit] == [second, first]
    assert explicit[0] is by_id[second]

    everything = _select_tasks(tasks, type("Args", (), {"tasks": None, "all": True})())
    assert len(everything) == len(tasks)

    import pytest

    with pytest.raises(SystemExit):
        _select_tasks(tasks, type("Args", (), {"tasks": "no-such-task", "all": False})())


# ---------------------------------------------------------------------------
# review 断言逻辑
# ---------------------------------------------------------------------------

def test_assert_review_evidence_full_chain(tmp_path: Path) -> None:
    """review 断言:step evidence 存在、decision 字段完整、timeline meta 一致。"""
    task: dict[str, Any] = {
        "id": "e2e-review-probe",
        "title": "review 断言探针",
        "fixture": "fixture_calculator",
        "instructions": "探查 review 证据链",
    }
    ok, detail = _assert_review_evidence(task, tmp_path)
    assert ok, detail
    assert "decision" in detail

    # 证据文件确实落盘在任务工作目录(隔离,不污染全局 data/)
    steps_file = tmp_path / "step_records.json"
    assert steps_file.exists()
    persisted = json.loads(steps_file.read_text(encoding="utf-8"))
    steps = persisted["golden-e2e::e2e-review-probe"]["steps"]
    assert steps, "持久化的 step evidence 不应为空"
    for key in ("decision", "reason", "diff", "test", "rollback"):
        assert key in steps[0], f"持久化 step 缺少证据字段 {key}"
    assert steps[0]["decision"] == "proceed"


def test_assert_review_evidence_rejects_empty_replay(
    tmp_path: Path, monkeypatch: Any
) -> None:
    """replay 返回 0 步(evidence 缺失)必须断言失败,守住「evidence 存在」语义。"""
    from app.services.agent_step_recorder import AgentStepRecorder

    def _empty_replay(self: AgentStepRecorder, run_id: str, step_index: int | None = None) -> dict[str, Any]:
        return {"run_id": run_id, "steps": [], "total": 0}

    monkeypatch.setattr(AgentStepRecorder, "replay", _empty_replay)
    task: dict[str, Any] = {"id": "e2e-review-empty", "fixture": "fixture_calculator"}
    ok, detail = _assert_review_evidence(task, tmp_path)
    assert not ok
    assert "0 步" in detail


def test_assert_review_evidence_rejects_missing_decision(
    tmp_path: Path, monkeypatch: Any
) -> None:
    """step 缺 decision 字段时必须断言失败,守住「decision 完整」语义。"""
    from app.services.agent_step_recorder import AgentStepRecorder

    def _broken_replay(self: AgentStepRecorder, run_id: str, step_index: int | None = None) -> dict[str, Any]:
        return {"run_id": run_id, "steps": [{"type": "tool", "tool_name": "write_file"}], "total": 1}

    monkeypatch.setattr(AgentStepRecorder, "replay", _broken_replay)
    task: dict[str, Any] = {"id": "e2e-review-nodecision", "fixture": "fixture_calculator"}
    ok, detail = _assert_review_evidence(task, tmp_path)
    assert not ok
    assert "decision" in detail


# ---------------------------------------------------------------------------
# checkpoint 断言逻辑
# ---------------------------------------------------------------------------

def test_assert_checkpoint_roundtrip_restores_file(tmp_path: Path) -> None:
    """checkpoint 断言:产生 checkpoint 且回滚后文件内容恢复一致。"""
    workdir = tmp_path / "task_e2e-ckpt-probe"
    workdir.mkdir()
    target = workdir / "calc.py"
    original = "def add(a, b):\n    return a + b\n"
    target.write_text(original, encoding="utf-8")

    task: dict[str, Any] = {
        "id": "e2e-ckpt-probe",
        "title": "checkpoint 断言探针",
        "fixture": "fixture_calculator",
        "instructions": "探查 checkpoint 回滚链路",
    }
    ok, detail = asyncio.run(_assert_checkpoint_roundtrip(task, tmp_path))
    assert ok, detail
    assert "回滚恢复一致" in detail
    # 回滚后文件必须与原始内容逐字节一致(未被写坏残留)
    assert target.read_text(encoding="utf-8") == original


def test_assert_checkpoint_fails_without_files(tmp_path: Path) -> None:
    """工作目录无文件时必须断言失败(无可快照目标)。"""
    empty = tmp_path / "task_e2e-ckpt-empty"
    empty.mkdir()
    task: dict[str, Any] = {"id": "e2e-ckpt-empty", "fixture": "fixture_calculator"}
    ok, detail = asyncio.run(_assert_checkpoint_roundtrip(task, empty))
    assert not ok
    assert "无可快照" in detail


# ---------------------------------------------------------------------------
# runner 子进程(端到端)
# ---------------------------------------------------------------------------

def test_golden_e2e_runner_subset() -> None:
    """runner 子集端到端:三类断言全过 + JSON 报告结构合法。"""
    with tempfile.TemporaryDirectory() as td:
        report = Path(td) / "golden_e2e_report.json"
        proc = _run_e2e([
            "--tasks", "fix-calc-divzero,fix-cli-import",
            "--min-pass-rate", "1.0",
            "--report", str(report),
        ])
        assert proc.returncode == 0, proc.stderr
        assert "通过率 100.0%" in proc.stdout

        assert report.exists(), proc.stdout
        summary = json.loads(report.read_text(encoding="utf-8"))
        assert summary["runner"] == "golden-e2e"
        assert summary["total"] == 2
        assert summary["passed"] == 2
        assert summary["pass_rate"] == 1.0
        for key in ("golden", "review", "checkpoint"):
            assert summary["assertions"][key] == {"passed": 2, "total": 2}
        for rec in summary["tasks"]:
            assert rec["pass"] is True
            assert rec["golden"]["pass"] is True
            assert rec["review"]["pass"] is True
            assert rec["checkpoint"]["pass"] is True
            assert rec["review"]["detail"]
            assert rec["checkpoint"]["detail"]


def test_golden_e2e_pass_rate_gate_fails() -> None:
    """低于显式门槛时必须返回 1,供 CI 阻塞回归(与 run_bench 同语义)。"""
    with tempfile.TemporaryDirectory() as td:
        report = Path(td) / "golden_e2e_report.json"
        proc = _run_e2e([
            "--tasks", "fix-calc-divzero",
            "--min-pass-rate", "1.01",
            "--report", str(report),
        ])
        assert proc.returncode == 1
        assert "通过率低于门槛" in proc.stderr
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

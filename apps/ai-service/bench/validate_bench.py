#!/usr/bin/env python
"""IHUI-Bench 任务定义健全性验证器(2026-09-03 立,零 LLM 纯机械)。

背景:tasks_v0.json 定义了 20 个基准任务,但长期只跑通过 1 个
(fix-calc-divzero),其余 19 个任务的 fixture / checker / 参数从未被验证。
真实 LLM 评测受配额/时长限制无法频繁全量跑,而"任务定义本身是否正确"
可以用纯机械方式验证 —— 不需要 agent,不需要模型。

核心不变量:
1. 每个任务引用的 fixture 目录必须存在;
2. 每个 check 的 type 必须在 _CHECKERS 中,且 params 齐全;
3. 【最关键】每个任务在其 fixture 的【初始状态】上执行全部 checks,
   必须【全部 FAIL】—— 若有任何 check 在初始态 PASS,说明该任务
   "还没修就已经满足验收",属于无效任务,跑出来一定是假阳性分数。

用法:
    .venv/Scripts/python.exe bench/validate_bench.py            # 全量 20 任务
    .venv/Scripts/python.exe bench/validate_bench.py --task fix-calc-divzero
    .venv/Scripts/python.exe bench/validate_bench.py --json     # 机器可读输出

退出码:0=全部健全;1=发现无效任务/定义错误;2=内部错误。
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).resolve().parent
_AI_SERVICE_ROOT = _SCRIPT_DIR.parent
sys.path.insert(0, str(_AI_SERVICE_ROOT))
from bench.run_bench import (  # noqa: E402
    _CHECKERS,
    FIXTURES_ROOT,
    TASKS_FILE,
    _load_tasks,
    score_task,
)


def _validate_structure(task: dict[str, Any]) -> list[str]:
    """结构校验:fixture 存在、checker 类型与 params 合法。返回错误列表。"""
    errors: list[str] = []
    tid = task.get("id", "?")
    fixture = task.get("fixture")
    if not fixture:
        errors.append(f"{tid}: 缺 fixture 字段")
    elif not (FIXTURES_ROOT / fixture).is_dir():
        errors.append(f"{tid}: fixture 目录不存在: {fixture}")
    checks = task.get("checks") or []
    if not checks:
        errors.append(f"{tid}: 无任何 checks(任务必然恒 PASS,无效)")
    for i, chk in enumerate(checks):
        ctype = chk.get("type")
        if ctype not in _CHECKERS:
            errors.append(f"{tid} 检查#{i}: 未知 checker 类型 {ctype!r}")
            continue
        params = chk.get("params") or {}
        if ctype in ("file_contains", "file_not_contains") and (
            "path" not in params or "substring" not in params
        ):
            errors.append(f"{tid} 检查#{i}: {ctype} 缺 path/substring 参数")
        elif ctype in ("pytest_pass", "pytest_file_exists") and "path" not in params:
            errors.append(f"{tid} 检查#{i}: {ctype} 缺 path 参数")
    return errors


def _initial_state_must_fail(task: dict[str, Any]) -> list[str]:
    """复制 fixture 到临时目录,在【初始态】上跑全部 checks,断言全部 FAIL。

    若某 check 初始态 PASS → 任务"未修即通过",判定无效。
    """
    errors: list[str] = []
    tid = task["id"]
    fixture = FIXTURES_ROOT / task["fixture"]
    with tempfile.TemporaryDirectory(prefix=f"ihui_bench_check_{tid}_") as tmp:
        workdir = Path(tmp) / "src"
        shutil.copytree(fixture, workdir)
        results, passed, total = score_task(task, workdir)
        for r in results:
            if r["pass"]:
                errors.append(
                    f"{tid}: 初始态即通过检查 #{r['type']} —— 任务定义无效"
                    f"(detail: {r.get('detail', '')})"
                )
        if total == 0:
            errors.append(f"{tid}: checks 总数为 0,无法评分")
    return errors


def validate_tasks(
    tasks: list[dict[str, Any]], *, include_initial_state: bool = True
) -> list[dict[str, Any]]:
    """对任务列表执行健全性验证,返回逐任务 findings(纯函数,可被测试直接调用)。

    include_initial_state=False 时跳过耗时的初始态 FAIL 断言
    (pytest 子进程),仅做结构校验。
    """
    findings: list[dict[str, Any]] = []
    for task in tasks:
        struct_err = _validate_structure(task)
        init_err = (
            _initial_state_must_fail(task)
            if include_initial_state and not struct_err
            else []
        )
        findings.append({
            "id": task["id"],
            "category": task.get("category", ""),
            "fixture": task.get("fixture", ""),
            "check_count": len(task.get("checks") or []),
            "structure_errors": struct_err,
            "initial_state_errors": init_err,
            "valid": not struct_err and not init_err,
        })
    return findings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="IHUI-Bench 任务定义健全性验证")
    parser.add_argument("--task", help="只验证指定任务 id")
    parser.add_argument("--json", action="store_true", help="输出机器可读 JSON")
    args = parser.parse_args(argv)

    tasks = _load_tasks(TASKS_FILE)
    if args.task:
        tasks = [t for t in tasks if t["id"] == args.task]
        if not tasks:
            print(f"任务不存在: {args.task}", file=sys.stderr)
            return 2

    findings = validate_tasks(tasks)

    valid = sum(1 for f in findings if f["valid"])
    total = len(findings)

    if args.json:
        print(json.dumps({"total": total, "valid": valid, "tasks": findings},
                         ensure_ascii=False, indent=1))
    else:
        for f in findings:
            status = "✅ 健全" if f["valid"] else "❌ 无效"
            print(f"{status} {f['id']:<24} ({f['category']}, {f['check_count']} checks)")
            for e in f["structure_errors"] + f["initial_state_errors"]:
                print(f"      ↳ {e}")
        print(f"\n{valid}/{total} 任务定义健全")

    if valid != total:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

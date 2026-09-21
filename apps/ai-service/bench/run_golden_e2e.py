# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""黄金 E2E 回归 runner(PROJECT_PLAN 0-2 固化)。

把 IHUI-Bench 的 golden 执行器从 bench 内部能力固化为可独立运行的端到端回归:
- 复用 run_bench 的任务定义 / 检查器 / fixtures_golden 参考答案评分链路;
- 每任务除原有 pass/fail 检查(golden 直评)外,追加两类端到端断言,
  全部确定性构造、无 LLM / 网络依赖(CI 可跑):
  * review 断言:按 AgentLoopV2._maybe_record_step 的 step 证据结构写入
    AgentStepRecorder,断言 replay 后 step evidence 存在且 decision 字段
    完整(decision/reason/diff/test/rollback 证据键齐全、decision 非空),
    并经 agent_timeline 的 step 事件构造断言 timeline meta 携带完整 decision;
  * checkpoint 断言:对 golden 产物文件 snapshot → save_checkpoint(带
    file_snapshots)→ list_for_session 可见 → 模拟后续写坏文件 →
    restore 返回 file_versions → rollback_file 把文件内容恢复到快照一致。
- 输出结构化 JSON 报告;--min-pass-rate 低于门槛时以退出码 1 结束
  (语义与 run_bench 完全一致,供 CI 门禁)。

任务选择:
- 默认取 tasks_v1.json 前 20 个任务(确定性子集);
- --tasks id1,id2 按任务 id 显式指定;--all 取全部任务(当前 41 个)。

用法(在 apps/ai-service 目录下):
    python -m bench.run_golden_e2e
    python -m bench.run_golden_e2e --tasks fix-calc-divzero,fix-cli-import
    python -m bench.run_golden_e2e --all --min-pass-rate 1.0 --report golden_e2e_report.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from bench.run_bench import GOLDEN_FIXTURES_ROOT, _load_tasks, score_task

# 默认回归子集规模(PROJECT_PLAN 0-2:复用 20 任务)
DEFAULT_SUBSET_SIZE = 20


# ---------------------------------------------------------------------------
# 任务选择
# ---------------------------------------------------------------------------

def _select_tasks(all_tasks: list[dict[str, Any]], args: argparse.Namespace) -> list[dict[str, Any]]:
    """按 CLI 参数选取任务子集:--tasks 显式 id 列表 > --all 全量 > 默认前 20。"""
    if args.tasks:
        wanted = [t.strip() for t in args.tasks.split(",") if t.strip()]
        by_id = {t["id"]: t for t in all_tasks}
        unknown = [tid for tid in wanted if tid not in by_id]
        if unknown:
            raise SystemExit(f"未知任务 id: {', '.join(unknown)}(共 {len(all_tasks)} 个任务可用)")
        return [by_id[tid] for tid in wanted]
    if args.all:
        return list(all_tasks)
    return all_tasks[:DEFAULT_SUBSET_SIZE]


# ---------------------------------------------------------------------------
# review 断言:step evidence 存在且 decision 字段完整
# ---------------------------------------------------------------------------

def _assert_review_evidence(task: dict[str, Any], workdir: Path) -> tuple[bool, str]:
    """端到端校验 review 证据链:append_step → replay → timeline step 事件。

    golden executor 不跑 agent 循环,因此以与 AgentLoopV2._maybe_record_step
    同构的确定性 step 证据(含 decision/reason/diff)写入隔离的
    AgentStepRecorder(file_path 落在任务临时目录,不污染全局 data/),
    再断言证据读回完整 —— 覆盖「录制 → 归一化 → 持久化 → 回放 → timeline」
    全链路,任一环节回归都会在此暴露。
    """
    from app.services.agent_step_recorder import AgentStepRecorder
    from app.services.agent_timeline import _step_event

    recorder = AgentStepRecorder(file_path=workdir / "step_records.json")
    run_id = f"golden-e2e::{task['id']}"
    recorder.append_step(
        run_id,
        {
            "type": "tool",
            "tool_name": "write_file",
            "input_summary": f"应用 golden 参考答案: {task.get('fixture', '')}",
            "result_summary": "golden fixture applied",
            "status": "ok",
            "decision": "proceed",
            "reason": "golden 参考答案已落盘,任务检查应全部通过",
            "diff": {"fixture": task.get("fixture", "")},
        },
    )

    replayed = recorder.replay(run_id)
    steps = replayed.get("steps", [])
    if not steps:
        return False, "step evidence 缺失: replay 返回 0 步"
    step = steps[0]

    evidence_keys = ("decision", "reason", "diff", "test", "rollback")
    missing = [k for k in evidence_keys if k not in step]
    if missing:
        return False, f"step evidence 字段缺失: {missing}"
    if not step.get("decision"):
        return False, "decision 字段为空"

    # timeline 侧:step 事件 meta 必须携带完整 decision(前端结构化消费契约)
    event = _step_event(step)
    meta = event.get("meta") or {}
    if event.get("kind") != "step":
        return False, f"timeline 事件类型异常: {event.get('kind')!r}"
    if not meta.get("decision"):
        return False, "timeline step 事件 meta.decision 缺失"
    if meta.get("decision") != step["decision"]:
        return False, "timeline meta.decision 与 step evidence 不一致"

    return True, (
        f"step evidence {len(steps)} 步, decision={step['decision']!r}, "
        "timeline meta.decision 完整"
    )


# ---------------------------------------------------------------------------
# checkpoint 断言:执行产生 checkpoint 且可回滚恢复文件状态
# ---------------------------------------------------------------------------

def _pick_snapshot_target(workdir: Path) -> Path | None:
    """从 golden 产物中确定性挑选快照目标文件(优先 .py,其次任意文件)。"""
    py_files = sorted(workdir.rglob("*.py"))
    if py_files:
        return py_files[0]
    files = sorted(p for p in workdir.rglob("*") if p.is_file())
    return files[0] if files else None


async def _assert_checkpoint_roundtrip(
    task: dict[str, Any], workdir: Path
) -> tuple[bool, str]:
    """端到端校验 checkpoint 链路:snapshot → save → list → restore → 回滚恢复。

    使用独立的纯内存 AgentCheckpointManager(不触全局单例/Redis),
    模拟 AgentLoopV2 写盘前快照 + 带 file_snapshots 的 save_checkpoint,
    断言:list_for_session 可见、restore 返回 file_versions、
    rollback_file 能把被写坏的文件恢复到快照内容。
    """
    from app.services import file_editor
    from app.services.agent_checkpoint import AgentCheckpointManager

    session_id = f"golden-e2e::{task['id']}"
    target = _pick_snapshot_target(workdir)
    if target is None:
        return False, "工作目录无可快照的目标文件"
    original = target.read_text(encoding="utf-8")

    # 1. 写盘前快照(与 AgentLoopV2._snapshot_before_write 同构)
    snap = file_editor.snapshot_file(session_id, str(target))
    # 2. 保存 checkpoint(带文件快照引用)
    manager = AgentCheckpointManager()
    checkpoint_id = await manager.save_checkpoint(
        session_id,
        iteration=1,
        messages=[{"role": "user", "content": str(task.get("instructions", ""))}],
        tool_state={},
        status="running",
        file_snapshots=[{"path": snap["path"], "version_id": snap["version_id"]}],
    )
    # 3. 断言执行产生了 checkpoint
    metas = await manager.list_for_session(session_id)
    if not any(m.checkpoint_id == checkpoint_id for m in metas):
        return False, "执行未产生 checkpoint(list_for_session 为空)"
    # 4. 模拟执行后文件被改坏
    target.write_text(original + "\n# corrupted by golden-e2e\n", encoding="utf-8")
    # 5. restore 返回 file_versions,回滚恢复文件状态
    restored = await manager.restore(session_id, checkpoint_id)
    file_versions = restored.get("file_versions") or []
    if not file_versions:
        return False, "restore 未返回 file_versions"
    rollback = file_editor.rollback_file(
        session_id, str(target), version_id=str(file_versions[0]["version_id"])
    )
    if not rollback.get("ok"):
        return False, f"rollback_file 失败: {rollback}"
    if target.read_text(encoding="utf-8") != original:
        return False, "回滚后文件内容与快照不一致"

    return True, (
        f"checkpoint {checkpoint_id[:8]}… 保存/列举/restore 均通过, "
        f"{target.name} 回滚恢复一致"
    )


# ---------------------------------------------------------------------------
# 单任务执行
# ---------------------------------------------------------------------------

async def _run_task(task: dict[str, Any], base_workdir: Path) -> dict[str, Any]:
    """单任务黄金 E2E:golden 直评 + review 断言 + checkpoint 断言。"""
    workdir = base_workdir / f"task_{task['id']}"
    if workdir.exists():
        shutil.rmtree(workdir)
    shutil.copytree(GOLDEN_FIXTURES_ROOT / task["fixture"], workdir)

    start = time.time()
    # 1. golden 直评(复用 run_bench 检查器)
    checks, passed, total = score_task(task, workdir)
    golden_pass = total > 0 and passed == total

    # 2. review 断言
    review_ok, review_detail = _assert_review_evidence(task, workdir)
    # 3. checkpoint 断言
    ckpt_ok, ckpt_detail = await _assert_checkpoint_roundtrip(task, workdir)
    duration_ms = round((time.time() - start) * 1000, 1)

    return {
        "id": task["id"],
        "title": task.get("title", ""),
        "category": task.get("category", ""),
        "fixture": task.get("fixture", ""),
        "golden": {
            "pass": golden_pass,
            "checks_passed": passed,
            "checks_total": total,
            "checks": checks,
        },
        "review": {"pass": review_ok, "detail": review_detail},
        "checkpoint": {"pass": ckpt_ok, "detail": ckpt_detail},
        "pass": golden_pass and review_ok and ckpt_ok,
        "duration_ms": duration_ms,
        "workdir": str(workdir),
    }


async def _run_all(tasks: list[dict[str, Any]], base_workdir: Path) -> list[dict[str, Any]]:
    """顺序执行全部任务,逐条打印进度;单任务异常不中断整轮回归。"""
    results: list[dict[str, Any]] = []
    for task in tasks:
        try:
            rec = await _run_task(task, base_workdir)
        except Exception as e:  # noqa: BLE001 - 单任务异常不应中断整轮 E2E
            rec = {
                "id": task.get("id", ""),
                "title": task.get("title", ""),
                "category": task.get("category", ""),
                "fixture": task.get("fixture", ""),
                "golden": {"pass": False, "checks_passed": 0, "checks_total": 0, "checks": []},
                "review": {"pass": False, "detail": ""},
                "checkpoint": {"pass": False, "detail": ""},
                "pass": False,
                "duration_ms": 0.0,
                "workdir": "",
                "error": str(e),
            }
        results.append(rec)
        status = "PASS" if rec["pass"] else "FAIL"
        parts = [
            f"golden={'OK' if rec['golden']['pass'] else 'X'}",
            f"review={'OK' if rec['review']['pass'] else 'X'}",
            f"checkpoint={'OK' if rec['checkpoint']['pass'] else 'X'}",
        ]
        print(
            f"[{rec['id']}] {rec['title']} -> {status} ({', '.join(parts)}, "
            f"{rec['duration_ms']}ms)",
            flush=True,
        )
    return results


# ---------------------------------------------------------------------------
# JSON 报告
# ---------------------------------------------------------------------------

def _write_report(results: list[dict[str, Any]], report_path: Path) -> dict[str, Any]:
    """写出结构化 JSON 报告,返回汇总字典。"""
    total = len(results)
    passed = sum(1 for r in results if r.get("pass"))
    review_ok = sum(1 for r in results if r.get("review", {}).get("pass"))
    ckpt_ok = sum(1 for r in results if r.get("checkpoint", {}).get("pass"))
    golden_ok = sum(1 for r in results if r.get("golden", {}).get("pass"))
    summary = {
        "runner": "golden-e2e",
        "total": total,
        "passed": passed,
        "pass_rate": round(passed / total, 4) if total else 0.0,
        "assertions": {
            "golden": {"passed": golden_ok, "total": total},
            "review": {"passed": review_ok, "total": total},
            "checkpoint": {"passed": ckpt_ok, "total": total},
        },
        "tasks": results,
    }
    report_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return summary


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="黄金 E2E 回归 runner:golden 直评 + review/checkpoint 端到端断言",
    )
    parser.add_argument(
        "--tasks",
        type=str,
        default=None,
        help="逗号分隔的任务 id 列表(如 fix-calc-divzero,fix-cli-import);默认取前 20 个任务",
    )
    parser.add_argument("--all", action="store_true", help="运行全部任务(而非默认 20 任务子集)")
    parser.add_argument(
        "--min-pass-rate",
        type=float,
        default=None,
        help="CI 门禁:通过率低于该值(0.0~1.0)时向 stderr 报错并以退出码 1 结束",
    )
    parser.add_argument(
        "--report",
        type=str,
        default="golden_e2e_report.json",
        help="结构化 JSON 报告输出路径",
    )
    parser.add_argument("--workdir", type=str, default=None, help="临时目录根,默认系统临时目录")
    args = parser.parse_args(argv)

    tasks = _select_tasks(_load_tasks(), args)
    if not tasks:
        print("没有匹配的任务,退出。", flush=True)
        return 0

    base_workdir = (
        Path(args.workdir) if args.workdir else Path(tempfile.mkdtemp(prefix="ihui_golden_e2e_"))
    )
    base_workdir.mkdir(parents=True, exist_ok=True)

    print(
        f"Golden E2E runner: tasks={len(tasks)} workdir={base_workdir}",
        flush=True,
    )

    results = asyncio.run(_run_all(tasks, base_workdir))
    summary = _write_report(results, Path(args.report))
    print(
        f"完成: {summary['passed']}/{summary['total']} 通过, "
        f"通过率 {summary['pass_rate']:.1%} "
        f"(golden {summary['assertions']['golden']['passed']}/{summary['total']}, "
        f"review {summary['assertions']['review']['passed']}/{summary['total']}, "
        f"checkpoint {summary['assertions']['checkpoint']['passed']}/{summary['total']}); "
        f"报告: {args.report}",
        flush=True,
    )
    # 与 run_bench 相同的 CI 门禁语义:默认返回 0 便于收集报告;
    # 显式给出 --min-pass-rate 时,低于门槛必须以 1 退出阻塞回归。
    if args.min_pass_rate is not None and summary["pass_rate"] < args.min_pass_rate:
        print(
            f"通过率低于门槛: {summary['pass_rate']:.1%} < {args.min_pass_rate:.1%}",
            file=sys.stderr,
            flush=True,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

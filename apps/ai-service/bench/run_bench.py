# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""IHUI-Bench v0 — 自建 agent 能力基准执行器。

把确定性迷你仓库(fixtures)拷贝到独立临时工作目录,构造 AgentLoopV2 驱动
agent 执行任务,再逐条运行检查器评分,产出 markdown 报告 + JSON 汇总。

支持两种执行器:
- ``stub``  :确定性简化 LLM(无需 API key),驱动一次 list_files 探查后结束,
             用于验证完整链路(工具调用 → 结果回填 → 评分)在离线环境跑通。
- ``loop_v2``:真实 ``llm_gateway.complete`` 路径;无 key 时网关降级为 stub
             响应,行为与 stub 类似,但走完整 LLM 网关调用链。

使用:
    python -m bench.run_bench --executor stub --limit 2 --report out.md
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

BENCH_ROOT = Path(__file__).resolve().parent
FIXTURES_ROOT = BENCH_ROOT / "fixtures"
TASKS_FILE = BENCH_ROOT / "tasks_v0.json"

# stub 模式下允许 agent 探查工作目录所用的工具名
_PROBE_TOOL = "list_files"

# 默认工具白名单(任务 allowed_tools 是其子集,构造时按名过滤)
_DEFAULT_TOOLS = [
    "read_file",
    "list_files",
    "write_file",
    "file_edit",
    "run_command",
    "search_codebase",
]


# ---------------------------------------------------------------------------
# 任务加载
# ---------------------------------------------------------------------------

def _load_tasks(path: Path = TASKS_FILE) -> list[dict[str, Any]]:
    """加载任务定义 JSON,兼容顶层 list 或 ``{"tasks": [...]}`` 两种形态。"""
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "tasks" in data:
        return list(data["tasks"])
    return list(data)


# ---------------------------------------------------------------------------
# 检查器
# ---------------------------------------------------------------------------

def _read_text(workdir: Path, params: dict[str, Any]) -> tuple[bool, str, str]:
    """读取工作目录下目标文件,返回 (exists, text, error)。"""
    target = workdir / params["path"]
    if not target.exists():
        return False, "", f"文件不存在: {params['path']}"
    try:
        text = target.read_text(encoding=params.get("encoding", "utf-8"))
    except Exception as e:  # noqa: BLE001 - 读取失败也应作为检查失败上报
        return False, "", f"读取失败: {e}"
    return True, text, ""


def _check_file_contains(workdir: Path, params: dict[str, Any]) -> tuple[bool, str]:
    ok, text, err = _read_text(workdir, params)
    if not ok:
        return False, err
    needle = params["substring"]
    found = needle in text
    return found, ("包含" if found else "不包含") + f"子串: {needle!r}"


def _check_file_not_contains(workdir: Path, params: dict[str, Any]) -> tuple[bool, str]:
    ok, text, err = _read_text(workdir, params)
    if not ok:
        return False, err
    needle = params["substring"]
    absent = needle not in text
    return absent, ("不包含" if absent else "仍包含") + f"子串: {needle!r}"


def _check_pytest_file_exists(workdir: Path, params: dict[str, Any]) -> tuple[bool, str]:
    target = workdir / params["path"]
    ok = target.exists()
    return ok, ("存在" if ok else "不存在") + f": {params['path']}"


def _check_pytest_pass(workdir: Path, params: dict[str, Any]) -> tuple[bool, str]:
    """在工作目录副本上运行 pytest,要求全部用例通过(exit code == 0)。"""
    path = params.get("path", ".")
    node = params.get("test")
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        path,
        "-q",
        "--no-header",
        "-p",
        "no:cacheprovider",
        "--tb=short",
    ]
    if node:
        cmd.append(f"::{node}")
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(workdir),
            capture_output=True,
            text=True,
            timeout=180,
        )
    except subprocess.TimeoutExpired:
        return False, "pytest 执行超时(>180s)"
    except FileNotFoundError:
        return False, "未找到 pytest 可执行环境"
    ok = proc.returncode == 0
    tail = (proc.stdout or proc.stderr).strip().splitlines()[-1:] or [""]
    return ok, f"exit={proc.returncode} ({tail[0].strip()})"


_CHECKERS = {
    "file_contains": _check_file_contains,
    "file_not_contains": _check_file_not_contains,
    "pytest_file_exists": _check_pytest_file_exists,
    "pytest_pass": _check_pytest_pass,
}


def score_task(task: dict[str, Any], workdir: Path) -> tuple[list[dict[str, Any]], int, int]:
    """对单任务逐条运行检查器,返回 (逐条结果, 通过数, 总数)。"""
    results: list[dict[str, Any]] = []
    for chk in task.get("checks", []):
        ctype = chk.get("type")
        fn = _CHECKERS.get(ctype)
        if fn is None:
            results.append({
                "type": ctype,
                "pass": False,
                "detail": f"未知检查器类型: {ctype}",
            })
            continue
        try:
            ok, detail = fn(workdir, chk.get("params", {}))
        except Exception as e:  # noqa: BLE001 - 单条检查异常不应中断整体评分
            ok, detail = False, f"检查异常: {e}"
        results.append({"type": ctype, "pass": bool(ok), "detail": detail})
    passed = sum(1 for r in results if r["pass"])
    total = len(results)
    return results, passed, total


# ---------------------------------------------------------------------------
# 执行器构造
# ---------------------------------------------------------------------------

def _convert_tool_calls(tc_list: Any) -> Any:
    """OpenAI 格式 tool_calls → AgentLoopV2 格式(与 routers/agents.py 同构)。"""
    if not tc_list:
        return None
    out: list[dict[str, Any]] = []
    for tc in tc_list:
        if not isinstance(tc, dict):
            continue
        fn = tc.get("function") or {}
        args_raw = fn.get("arguments") or "{}"
        if isinstance(args_raw, str):
            try:
                args = json.loads(args_raw)
            except (ValueError, TypeError):
                args = {}
        else:
            args = args_raw
        out.append({"id": tc.get("id", ""), "name": fn.get("name", ""), "args": args})
    return out or None


def _build_stub_llm() -> Any:
    """确定性 stub LLM:首次调用探查目录,之后直接结束(不实际修改代码)。"""
    async def _llm(messages: list[dict[str, Any]], tools: Any) -> dict[str, Any]:
        tool_names = [t.get("function", {}).get("name") for t in (tools or [])]
        has_tool_msg = any(m.get("role") == "tool" for m in messages)
        if not has_tool_msg and _PROBE_TOOL in tool_names:
            return {
                "content": "先探查工作目录结构。",
                "tool_calls": [
                    {"id": "stub_call_1", "name": _PROBE_TOOL, "args": {"path": "."}}
                ],
            }
        return {
            "content": "stub 模式:不实际修改代码,任务结束。",
            "tool_calls": None,
        }

    return _llm


def _build_loop_v2_llm() -> Any:
    """真实 LLM 网关路径(无 key 时网关降级 stub 响应)。"""
    from app.core.llm_gateway import llm_gateway

    async def _llm(messages: list[dict[str, Any]], tools: Any) -> dict[str, Any]:
        result = await llm_gateway.complete(messages)
        return {
            "content": result.get("content", ""),
            "tool_calls": _convert_tool_calls(result.get("tool_calls")),
        }

    return _llm


def _build_tools(allowed_tools: list[str], workdir: Path) -> list[Any]:
    """按 allowed_tools 白名单把 MCP 工具包装为 AgentLoopV2 的 ToolDefinition。"""
    from app.services.agent_loop_v2 import ToolDefinition
    from app.services.mcp_server import mcp_server

    allowed = set(allowed_tools) if allowed_tools else set(_DEFAULT_TOOLS)
    tools: list[Any] = []
    # 仅保留 MCP 中真实存在的工具,避免不存在的工具名导致构造失败
    known = {mt.name: mt for mt in mcp_server.list_tools()}
    for name in allowed:
        handler = known.get(name)
        if handler is None:
            continue

        async def _exec(args: dict[str, Any], _name: str = name, _wd: Path = workdir) -> Any:
            call_args = dict(args or {})
            # run_command 默认落在工作目录副本内,避免误操作系统文件
            if _name == "run_command":
                call_args.setdefault("cwd", str(_wd))
            return await mcp_server.call_tool(_name, call_args, user_role=1)

        tools.append(
            ToolDefinition(
                name=name,
                description=handler.description,
                parameters=handler.input_schema,
                executor=_exec,
            )
        )
    return tools


async def _run_task(task: dict[str, Any], executor: str, base_workdir: Path) -> dict[str, Any]:
    """拷贝 fixture → 临时目录 → 构造 AgentLoopV2 执行 → 评分。"""
    from app.services.agent_loop_v2 import AgentLoopV2

    workdir = base_workdir / f"task_{task['id']}"
    if workdir.exists():
        shutil.rmtree(workdir)
    fixture = FIXTURES_ROOT / task["fixture"]
    shutil.copytree(fixture, workdir)

    # 工具路径校验依赖 MCP_WORKSPACE_ROOTS;指向本次副本,避免越权访问仓库真实代码
    prev_roots = os.environ.get("MCP_WORKSPACE_ROOTS")
    os.environ["MCP_WORKSPACE_ROOTS"] = str(workdir)
    try:
        llm = _build_stub_llm() if executor == "stub" else _build_loop_v2_llm()
        tools = _build_tools(task.get("allowed_tools", []), workdir)
        loop = AgentLoopV2(
            llm_complete_fn=llm,
            tools=tools,
            max_iterations=int(task.get("max_iterations", 8)),
            enable_checkpoint=False,
            enable_memory=False,
            approval_enabled=False,
        )
        start = time.time()
        result = await loop.run([{"role": "user", "content": task["instructions"]}])
        duration_ms = (time.time() - start) * 1000
        iterations = len(result.iterations)
        stop_reason = result.stop_reason
    finally:
        if prev_roots is None:
            os.environ.pop("MCP_WORKSPACE_ROOTS", None)
        else:
            os.environ["MCP_WORKSPACE_ROOTS"] = prev_roots

    checks, passed, total = score_task(task, workdir)
    task_pass = total > 0 and passed == total
    return {
        "id": task["id"],
        "title": task.get("title", ""),
        "category": task.get("category", ""),
        "fixture": task.get("fixture", ""),
        "iterations": iterations,
        "duration_ms": round(duration_ms, 1),
        "stop_reason": stop_reason,
        "checks": checks,
        "checks_passed": passed,
        "checks_total": total,
        "pass": task_pass,
        "workdir": str(workdir),
    }


async def _run_all(tasks: list[dict[str, Any]], executor: str, base_workdir: Path) -> list[dict[str, Any]]:
    """顺序执行所有(已过滤)任务,逐条打印进度并收集结果。"""
    results: list[dict[str, Any]] = []
    for task in tasks:
        try:
            rec = await _run_task(task, executor, base_workdir)
        except Exception as e:  # noqa: BLE001 - 单任务异常不应中断整轮 bench
            rec = {
                "id": task.get("id"),
                "title": task.get("title", ""),
                "category": task.get("category", ""),
                "fixture": task.get("fixture", ""),
                "iterations": 0,
                "duration_ms": 0.0,
                "stop_reason": "error",
                "checks": [],
                "checks_passed": 0,
                "checks_total": 0,
                "pass": False,
                "workdir": "",
                "error": str(e),
            }
        results.append(rec)
        status = "PASS" if rec["pass"] else "FAIL"
        print(
            f"[{rec['id']}] {rec['title']} -> {status} "
            f"({rec['checks_passed']}/{rec['checks_total']} checks, "
            f"{rec['iterations']} iters, {rec['duration_ms']}ms)",
            flush=True,
        )
    return results


# ---------------------------------------------------------------------------
# 报告
# ---------------------------------------------------------------------------

def _write_reports(results: list[dict[str, Any]], report_path: Path) -> dict[str, Any]:
    """写出 markdown 报告 + JSON 汇总,返回汇总字典。"""
    total = len(results)
    passed = sum(1 for r in results if r.get("pass"))
    pass_rate = (passed / total) if total else 0.0
    summary = {
        "total": total,
        "passed": passed,
        "pass_rate": round(pass_rate, 4),
        "tasks": results,
    }
    json_path = report_path.with_suffix(".json")
    json_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines: list[str] = []
    lines.append("# IHUI-Bench v0 报告")
    lines.append("")
    lines.append(f"- 任务总数: {total}")
    lines.append(f"- 通过: {passed}")
    lines.append(f"- 通过率: {pass_rate:.1%}")
    lines.append("")
    lines.append("| 任务ID | 类别 | 夹具 | 迭代 | 耗时(ms) | 检查 | 结果 |")
    lines.append("|---|---|---|---|---|---|---|")
    for r in results:
        checks = f"{r['checks_passed']}/{r['checks_total']}"
        mark = "PASS" if r.get("pass") else "FAIL"
        lines.append(
            f"| {r['id']} | {r['category']} | {r['fixture']} | "
            f"{r['iterations']} | {r['duration_ms']} | {checks} | {mark} |"
        )
    lines.append("")
    lines.append("## 逐任务检查明细")
    lines.append("")
    for r in results:
        lines.append(f"### {r['id']} — {r['title']}")
        lines.append("")
        lines.append(f"- 类别: {r['category']} / 夹具: {r['fixture']}")
        lines.append(
            f"- 迭代: {r['iterations']} / 停止原因: {r['stop_reason']} "
            f"/ 耗时: {r['duration_ms']}ms"
        )
        lines.append("")
        for c in r.get("checks", []):
            mark = "OK" if c["pass"] else "X"
            lines.append(f"- [{mark}] `{c['type']}`: {c['detail']}")
        if r.get("error"):
            lines.append(f"- 执行异常: {r['error']}")
        lines.append("")
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return summary


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="IHUI-Bench v0 自建 agent 能力基准执行器",
    )
    parser.add_argument("--limit", type=int, default=None, help="只运行前 N 个任务")
    parser.add_argument("--category", type=str, default=None, help="按 category 过滤(fix/test/refactor/multifile)")
    parser.add_argument(
        "--executor",
        choices=["loop_v2", "stub"],
        default="stub",
        help="执行器: stub=确定性简化 LLM(无需 key); loop_v2=真实 llm_gateway 路径",
    )
    parser.add_argument("--report", type=str, default="bench_report.md", help="markdown 报告输出路径(JSON 汇总同名 .json)")
    parser.add_argument("--workdir", type=str, default=None, help="临时目录根,默认系统临时目录")
    args = parser.parse_args(argv)

    tasks = _load_tasks()
    if args.category:
        tasks = [t for t in tasks if t.get("category") == args.category]
    if args.limit is not None:
        tasks = tasks[: max(0, args.limit)]

    if not tasks:
        print("没有匹配的任务,退出。", flush=True)
        return 0

    base_workdir = (
        Path(args.workdir) if args.workdir else Path(tempfile.mkdtemp(prefix="ihui_bench_"))
    )
    base_workdir.mkdir(parents=True, exist_ok=True)

    print(
        f"IHUI-Bench v0: executor={args.executor} tasks={len(tasks)} "
        f"workdir={base_workdir}",
        flush=True,
    )

    results = asyncio.run(_run_all(tasks, args.executor, base_workdir))
    summary = _write_reports(results, Path(args.report))
    print(
        f"完成: {summary['passed']}/{summary['total']} 通过, "
        f"通过率 {summary['pass_rate']:.1%}; 报告: {args.report}",
        flush=True,
    )
    # bench 任务失败 ≠ 脚本报错:始终返回 0,便于 CI 收集报告
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

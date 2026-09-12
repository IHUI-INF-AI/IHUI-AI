# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IHUI-Browser-Bench — 浏览器自动化回放成功率评测(H9 指标)。

对本地静态 fixture 页面(fixtures_browser/*.html,零外网依赖)回放录制好的
trace 步骤(navigate/type/select_option/click),再对最终 DOM 逐条运行检查器,
产出 markdown 报告 + JSON 汇总,支持 ``--min-success-rate`` CI 门禁。

任务通过 = 回放全部步骤 ok 且全部检查通过;否则记录失败差异
(element_not_found / timeout / assertion_failed / exception)供回放取证。

使用:
    python -m bench.run_browser_bench --min-success-rate 0.9 --report browser_bench.md
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Any

BENCH_ROOT = Path(__file__).resolve().parent
FIXTURES_ROOT = BENCH_ROOT / "fixtures_browser"
TASKS_FILE = BENCH_ROOT / "tasks_browser.json"

# fixture URL 占位符:运行时替换为 file:// 绝对地址(任务 JSON 保持可移植)
_FIXTURE_URL_PLACEHOLDER = "{fixture_url}"

# Chromium 启动参数(与 app/routers/computer_use.py 保持一致)
_LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-plugins",
    "--disable-default-apps",
]


# ---------------------------------------------------------------------------
# 任务加载与物化
# ---------------------------------------------------------------------------

def _load_tasks(path: Path = TASKS_FILE) -> list[dict[str, Any]]:
    """加载任务定义 JSON,兼容顶层 list 或 {"tasks": [...]} 两种形态。"""
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "tasks" in data:
        return list(data["tasks"])
    return list(data)


def _fixture_uri(fixture: str) -> str:
    """fixture 文件名 → file:// 绝对 URI。文件缺失直接报错(评测输入非法)。"""
    target = FIXTURES_ROOT / fixture
    if not target.is_file():
        raise FileNotFoundError(f"fixture 页面不存在: {target}")
    return target.resolve().as_uri()


def _materialize_steps(
    steps: list[dict[str, Any]], fixture_uri: str
) -> list[dict[str, Any]]:
    """把任务步骤中的 {fixture_url} 占位符替换为实际 URI(深拷贝,不污染任务定义)。"""
    out: list[dict[str, Any]] = []
    for step in steps:
        s = json.loads(json.dumps(step, ensure_ascii=False))
        params = s.get("params")
        if isinstance(params, dict) and params.get("url") == _FIXTURE_URL_PLACEHOLDER:
            params["url"] = fixture_uri
        out.append(s)
    return out


# ---------------------------------------------------------------------------
# 检查器(对回放结束后的最终页面状态逐条断言)
# ---------------------------------------------------------------------------

async def _check_selector_text_contains(
    driver: Any, params: dict[str, Any]
) -> tuple[bool, str]:
    text = await driver.selector_text(params["selector"])
    found = params["text"] in text
    return found, ("包含" if found else "不包含") + f" {params['text']!r} 于 {params['selector']}"


async def _check_selector_exists(
    driver: Any, params: dict[str, Any]
) -> tuple[bool, str]:
    exists = await driver.selector_exists(params["selector"])
    return exists, ("存在" if exists else "不存在") + f": {params['selector']}"


async def _check_input_value(
    driver: Any, params: dict[str, Any]
) -> tuple[bool, str]:
    value = await driver.input_value(params["selector"])
    match = value == params["value"]
    return match, f"{params['selector']} 值 {value!r} {'==' if match else '!='} {params['value']!r}"


async def _check_url_contains(
    driver: Any, params: dict[str, Any]
) -> tuple[bool, str]:
    url = await driver.current_url()
    found = params["text"] in url
    return found, ("包含" if found else "不包含") + f" {params['text']!r} 于 url"


_CHECKERS: dict[str, Any] = {
    "selector_text_contains": _check_selector_text_contains,
    "selector_exists": _check_selector_exists,
    "input_value": _check_input_value,
    "url_contains": _check_url_contains,
}


async def evaluate_checks(
    checks: list[dict[str, Any]], driver: Any
) -> list[dict[str, Any]]:
    """逐条运行检查器,返回 [{type, pass, detail}](未知类型按失败计)。"""
    results: list[dict[str, Any]] = []
    for check in checks:
        ctype = check.get("type")
        params = check.get("params") or {}
        checker = _CHECKERS.get(ctype or "")
        if checker is None:
            results.append(
                {"type": ctype, "pass": False, "detail": f"未知检查类型: {ctype}"}
            )
            continue
        try:
            ok, detail = await checker(driver, params)
        except Exception as e:  # noqa: BLE001 - 检查失败也应作为结果上报
            ok, detail = False, f"检查执行异常: {type(e).__name__}: {str(e)[:200]}"
        results.append({"type": ctype, "pass": ok, "detail": detail})
    return results


# ---------------------------------------------------------------------------
# 单任务执行:回放 + 检查
# ---------------------------------------------------------------------------

async def _run_task(task: dict[str, Any], driver: Any) -> dict[str, Any]:
    """在给定驱动上回放任务 trace 并运行检查,返回单任务结果。"""
    from app.services.browser_replay import replay_trace

    fixture_uri = _fixture_uri(task["fixture"])
    steps = _materialize_steps(list(task.get("steps", [])), fixture_uri)
    started = time.monotonic()

    replay = await replay_trace(steps, driver, stop_on_error=True)
    checks = await evaluate_checks(list(task.get("checks", [])), driver)
    checks_passed = sum(1 for c in checks if c["pass"])
    replay_all_ok = replay["ok"] == replay["total"] and replay["error"] == 0

    return {
        "id": task.get("id"),
        "title": task.get("title"),
        "category": task.get("category"),
        "fixture": task.get("fixture"),
        "steps_ok": replay["ok"],
        "steps_total": replay["total"],
        "replay_status": replay["status"],
        "checks_passed": checks_passed,
        "checks_total": len(checks),
        "pass": bool(replay_all_ok and checks_passed == len(checks)),
        "duration_ms": round((time.monotonic() - started) * 1000, 2),
        "replay": replay,
        "checks": checks,
    }


async def _run_all(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """启动 Chromium,逐任务(独立 context 隔离)回放+检查。"""
    from app.services.browser_replay import PageDriver

    try:
        from playwright.async_api import async_playwright
    except ImportError as e:
        print(
            "Playwright 未安装:请在 ai-service 目录执行 "
            "uv add playwright && uv run playwright install chromium",
            file=sys.stderr,
            flush=True,
        )
        raise SystemExit(2) from e

    results: list[dict[str, Any]] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=_LAUNCH_ARGS)
        try:
            for task in tasks:
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800}, locale="zh-CN"
                )
                page = await context.new_page()
                try:
                    results.append(await _run_task(task, PageDriver(page)))
                finally:
                    await context.close()
        finally:
            await browser.close()
    return results


# ---------------------------------------------------------------------------
# 报告与门禁
# ---------------------------------------------------------------------------

def _write_reports(results: list[dict[str, Any]], report_path: Path) -> dict[str, Any]:
    """写出 markdown 报告 + JSON 汇总,返回汇总字典。"""
    total = len(results)
    passed = sum(1 for r in results if r.get("pass"))
    success_rate = (passed / total) if total else 0.0
    summary = {
        "total": total,
        "passed": passed,
        "success_rate": round(success_rate, 4),
        "tasks": results,
    }
    json_path = report_path.with_suffix(".json")
    json_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    lines: list[str] = []
    lines.append("# IHUI-Browser-Bench 报告(浏览器自动化回放评测)")
    lines.append("")
    lines.append(f"- 任务总数: {total}")
    lines.append(f"- 通过: {passed}")
    lines.append(f"- 成功率: {success_rate:.1%}")
    lines.append("")
    lines.append("| 任务ID | 类别 | 夹具 | 回放步骤 | 检查 | 耗时(ms) | 结果 |")
    lines.append("|---|---|---|---|---|---|---|")
    for r in results:
        mark = "PASS" if r.get("pass") else "FAIL"
        lines.append(
            f"| {r['id']} | {r['category']} | {r['fixture']} | "
            f"{r['steps_ok']}/{r['steps_total']} | {r['checks_passed']}/{r['checks_total']} | "
            f"{r['duration_ms']} | {mark} |"
        )
    lines.append("")
    lines.append("## 逐任务失败明细(差异与检查)")
    lines.append("")
    for r in results:
        lines.append(f"### {r['id']} — {r['title']}")
        lines.append("")
        for s in r["replay"].get("steps", []):
            if s.get("status") == "error":
                diff = s.get("diff") or {}
                lines.append(
                    f"- [X] 步骤{s['step_index']} `{s['action']}` 失败: "
                    f"{diff.get('kind')}: {diff.get('message', '')[:200]}"
                )
        for c in r.get("checks", []):
            mark = "OK" if c["pass"] else "X"
            lines.append(f"- [{mark}] `{c['type']}`: {c['detail']}")
        lines.append("")
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return summary


# ---------------------------------------------------------------------------
# CLI 入口
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="IHUI-Browser-Bench 浏览器自动化回放成功率评测(本地 fixture,零外网)"
    )
    parser.add_argument("--limit", type=int, default=None, help="只运行前 N 个任务")
    parser.add_argument("--category", type=str, default=None, help="按 category 过滤(form/search)")
    parser.add_argument(
        "--min-success-rate",
        type=float,
        default=None,
        help="CI 门禁:成功率低于该值(0.0~1.0)时向 stderr 报错并以退出码 1 结束",
    )
    parser.add_argument(
        "--report", type=str, default="browser_bench_report.md", help="markdown 报告输出路径(JSON 汇总同名 .json)"
    )
    args = parser.parse_args(argv)

    tasks = _load_tasks()
    if args.category:
        tasks = [t for t in tasks if t.get("category") == args.category]
    if args.limit is not None:
        tasks = tasks[: max(0, args.limit)]
    if not tasks:
        print("没有匹配的任务,退出。", flush=True)
        return 0

    print(f"IHUI-Browser-Bench: tasks={len(tasks)}", flush=True)
    results = asyncio.run(_run_all(tasks))
    summary = _write_reports(results, Path(args.report))
    print(
        f"完成: {summary['passed']}/{summary['total']} 通过, "
        f"成功率 {summary['success_rate']:.1%}; 报告: {args.report}",
        flush=True,
    )
    # 评测失败 ≠ 脚本报错:默认始终返回 0,便于 CI 收集报告。
    # 显式给出 --min-success-rate 时作为 CI 门禁:低于门槛以 1 退出阻塞回归。
    if args.min_success_rate is not None and summary["success_rate"] < args.min_success_rate:
        print(
            f"成功率低于门槛: {summary['success_rate']:.1%} < {args.min_success_rate:.1%}",
            file=sys.stderr,
            flush=True,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""自愈测试用例的隔离执行(2026-10-31 立)。

现读缺陷:`self_healing.StaticRunner` 直接在主进程里 `exec/eval` 由 LLM 生成、
且受外部文章内容影响的 setup/assertion 字符串 —— 没有超时、没有隔离、异常只吞不记。
后果是三重的:一段 `while True:` 永久占住线程池里的一个线程(它是 `run_in_threadpool`
派发的);`SystemExit` / `KeyboardInterrupt` 这类 BaseException 会直接掀掉工作线程;
而这两类都不是"测试失败",是**服务端被输入拖死**。

本模块把执行搬到子进程:
    python -I -c <探针>        # -I = 隔离模式:不读 PYTHON* 环境变量、不加用户 site
用例经 stdin 送进去(不进命令行,避免出现在进程列表与日志里),结果以单行 JSON 回来。
超时即杀子进程并落 `timed_out`,由调用方映射成 timeout 归因。

失效方向(§0.3):子进程起不来(解释器缺失 / spawn 抛错)⇒ 抛 `SandboxUnavailable`,
由 `run_and_diagnose` 记成 `runner_error`(全红)。**绝不回落进程内执行** ——
"沙箱不可用"不是"允许裸跑"的理由。

已知边界(如实登记,不假称已封):同步路径拿不到 `core/proc_sandbox.apply_job_sandbox`
的能力(它收的是 asyncio 子进程),所以 Windows 上超时只杀直接子进程、不做 Job 级
后代收编;真正的 Job 收编在 `agent_engine.run_code` 那条异步链上已有。
"""

from __future__ import annotations

import json
import os
import subprocess  # noqa: S404 - 固定 argv、无 shell、不拼用户串
import sys
from collections.abc import Callable, Sequence
from typing import Any

#: 子进程探针。刻意保持自包含(不 import 本仓任何模块):子进程的工作目录与环境
#: 与主进程不同,依赖 repo 内模块会引入额外失败面。
_PROBE_SOURCE = r"""
import json, sys

records = []
raw = sys.stdin.read()
try:
    cases = json.loads(raw)
except Exception as exc:
    sys.stdout.write(json.dumps({"fatal": "bad payload: %s" % exc}))
    raise SystemExit(0)

for case in cases:
    cid = str(case.get("id", ""))
    rec = {"id": cid, "phase": "setup", "ok": False, "errorType": None, "errorMsg": None}
    ns = {"__name__": "selfhealing"}
    try:
        setup = case.get("setup") or ""
        if setup:
            exec(compile(setup, "<setup:%s>" % cid, "exec"), ns)
        rec["phase"] = "assert"
        assertion = case.get("assertion") or "False"
        rec["ok"] = bool(eval(compile(assertion, "<assert:%s>" % cid, "eval"), ns))
    except BaseException as exc:
        rec["errorType"] = type(exc).__name__
        rec["errorMsg"] = str(exc)[:500]
    records.append(rec)

sys.stdout.write(json.dumps(records))
"""


class SandboxUnavailable(RuntimeError):
    """子进程执行面不可用(不是"用例失败")。由调用方按 runner_error 降级处理。"""


CaseExecutor = Callable[[Sequence[dict[str, Any]], float], list[dict[str, Any]]]

#: 单批预算:每条 10s、整批封顶 120s。自愈场景里用例都是小断言,超过这个量级
#: 本身就是"这条用例有毒"的信号,不该继续占着线程。
_PER_CASE_TIMEOUT_S = 10.0
_BATCH_TIMEOUT_CAP_S = 120.0


def _resolve_timeout(case_count: int) -> float:
    return min(_BATCH_TIMEOUT_CAP_S, max(5.0, _PER_CASE_TIMEOUT_S * max(1, case_count)))


def run_cases_isolated(
    cases: Sequence[dict[str, Any]],
    timeout_s: float | None = None,
) -> list[dict[str, Any]]:
    """在隔离子进程里跑一批用例,返回逐条结果。

    Raises:
        SandboxUnavailable: 解释器起不来 / 派生失败 / 超时(超时按"用例有毒"算失败,
            但整批既已无结果,统一抛给调用方降级 —— 不在这里编造单条结论)。
    """
    payload = json.dumps([dict(c) for c in cases], ensure_ascii=False)
    timeout = timeout_s if timeout_s is not None else _resolve_timeout(len(cases))

    env = {
        "PYTHONIOENCODING": "utf-8",
        # 子进程不该继承宿主的凭据类环境变量:探针只做纯计算,不需要任何 key。
        "PATH": os.environ.get("PATH", ""),
        "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
    }

    try:
        proc = subprocess.Popen(  # noqa: S603 - argv 固定,无 shell
            [sys.executable, "-I", "-c", _PROBE_SOURCE],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except Exception as exc:  # noqa: BLE001 - 派生失败统一归为沙箱不可用
        raise SandboxUnavailable(f"无法派生隔离子进程: {exc}") from exc

    try:
        out, err = proc.communicate(payload, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        _kill(proc)
        raise SandboxUnavailable(f"用例执行超时(>{timeout:.0f}s),已终止子进程") from exc

    if proc.returncode != 0:
        detail = (err or "").strip().splitlines()[-1:] or []
        raise SandboxUnavailable(
            f"隔离子进程异常退出 rc={proc.returncode}"
            + (f":{detail[0][:200]}" if detail else "")
        )

    text = (out or "").strip()
    if not text:
        raise SandboxUnavailable("隔离子进程无输出")
    try:
        parsed = json.loads(text.splitlines()[-1])
    except ValueError as exc:
        raise SandboxUnavailable(f"隔离子进程输出不是合法 JSON: {text[:200]}") from exc
    if isinstance(parsed, dict) and "fatal" in parsed:
        raise SandboxUnavailable(f"隔离子进程拒绝载荷: {parsed['fatal']}")
    if not isinstance(parsed, list):
        raise SandboxUnavailable("隔离子进程输出形状不是数组")
    return [r for r in parsed if isinstance(r, dict)]


def _kill(proc: subprocess.Popen[str]) -> None:
    try:
        proc.kill()
    except Exception:  # noqa: BLE001 - 已退出/句柄失效,不影响结论
        pass
    try:
        proc.communicate(timeout=5)
    except Exception:  # noqa: BLE001 - 收尸失败不阻塞主链路
        pass


__test__ = {
    "run_cases_isolated": run_cases_isolated,
    "SandboxUnavailable": SandboxUnavailable,
    "PROBE_SOURCE": _PROBE_SOURCE,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

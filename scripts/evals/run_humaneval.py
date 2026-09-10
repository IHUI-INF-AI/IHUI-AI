#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#
# HumanEval 外部标准评测执行器 (OpenAI HumanEval, MIT)。
#
# 闭环: 数据集接入 (humaneval.jsonl) + 沙箱执行器 + 真实跑分报告。
# - 逐题将 prompt 发给 OpenRouter 模型, 提取首个 python 代码块;
# - 按官方 HumanEval check 结构拼装程序: prompt+completion / completion + test + check(entry_point);
# - 在沙箱子进程中执行 (env 清空禁网络, timeout 强杀 + 清理临时文件);
# - 逐题缓存 .cache/<task_id>.json 支持断点续跑;
# - 输出 report JSON(逐题明细) + Markdown(pass@1 / 平均时延 / 失败题清单)。
#
# 防作弊: 绝不把 canonical_solution 发给模型; 执行子进程禁网络(.env key 仅读取不打印)。
# 零编造: pass@1 只来自真实执行结果; .cache 与 report 不得手改。

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from openai import OpenAI
except ImportError as exc:  # noqa: BLE001
    print("[FATAL] 缺少 openai 依赖, 请使用 apps/ai-service/.venv 运行: pip install openai", file=sys.stderr)
    raise SystemExit(2) from exc

EVAL_DIR = Path(__file__).resolve().parent
DEFAULT_DATA = EVAL_DIR / "humaneval.jsonl"
DEFAULT_CACHE = EVAL_DIR / ".cache"
DEFAULT_ENV = Path("G:/IHUI-AI/apps/ai-service/.env")
DEFAULT_MODEL = "openai/gpt-4o-mini"
DEFAULT_BASE = "https://openrouter.ai/api/v1"
DEFAULT_TIMEOUT = 10.0
DEFAULT_WORKERS = 4
DEFAULT_TEMP = 0.0
MAX_TOKENS = 1024
PROMPT_VERSION = "chat-complete-fn-v1"

# 仅对“错误类”状态重试(网络/超时/抽取失败), 不对“测试未通过”重试以保 pass@1 诚实
RETRYABLE = {"api_error", "extraction_fail", "exe_error", "kill_timeout"}

_lock = threading.Lock()


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


# --------------------------------------------------------------------------- #
# 配置加载
# --------------------------------------------------------------------------- #
def load_api_key(env_path: Path, key_env: str = "OPENROUTER_API_KEY") -> str:
    """从 .env 读取指定 provider 的 API key (仅读取, 不打印)。"""
    if not env_path.exists():
        raise FileNotFoundError(f"未找到 .env: {env_path}")
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith(key_env):
            _, _, val = line.partition("=")
            key = val.strip().strip('"').strip("'")
            if key:
                return key
    raise KeyError(f"{key_env} 未在 .env 中找到")


def load_dataset(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"数据集不存在: {path} (先运行 download_humaneval.py)")
    rows: list[dict[str, Any]] = []
    for ln in path.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if ln:
            rows.append(json.loads(ln))
    return rows


# --------------------------------------------------------------------------- #
# 模型调用与代码抽取
# --------------------------------------------------------------------------- #
def call_model(client: OpenAI, model: str, temperature: float, prompt: str) -> tuple[str, float]:
    """调用模型, 返回 (文本内容, 时延 ms)。异常上抛由调用方归类。"""
    t0 = time.perf_counter()
    resp = client.chat.completions.create(
        model=model,
        temperature=temperature,
        max_tokens=MAX_TOKENS,
        messages=[
            {
                "role": "system",
                "content": (
                    "You solve Python programming tasks. Output ONLY a single Python code block "
                    "containing the COMPLETE implementation of the required function, including "
                    "its full signature line. Do not include explanations, test code, or example "
                    "usage outside the code block."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    )
    text = resp.choices[0].message.content or ""
    return text, (time.perf_counter() - t0) * 1000.0


_FENCE = re.compile(r"```(?:python|py)?\s*(.*?)```", re.DOTALL)


def extract_code(text: str) -> str | None:
    """提取首个完整 python 代码块; 无围栏时回退到首个 def/import 起的内容。"""
    m = _FENCE.search(text)
    if m:
        return m.group(1).strip()
    # 回退: 取首个 'def ' 或 'import '/'from ' 到文本末尾
    idx = -1
    for marker in ("def ", "import ", "from ", "class "):
        pos = text.find(marker)
        if pos != -1 and (idx == -1 or pos < idx):
            idx = pos
    if idx != -1:
        return text[idx:].strip()
    return None


def build_program(task: dict[str, Any], completion: str) -> str:
    """官方 HumanEval check 结构: prompt+completion + test + check(entry_point)。

    若模型返回的 completion 已包含该 entry_point 的 def 头(部分模型会补全全函数),
    则仅用 completion, 避免与 prompt 中的签名重复导致语法错误。
    """
    entry = task["entry_point"]
    if f"def {entry}" in completion:
        body = completion
    else:
        body = task["prompt"].rstrip() + "\n" + completion
    return body + "\n" + task["test"] + "\n" + f"check({entry})"


# --------------------------------------------------------------------------- #
# 沙箱执行 (子进程, env 清空禁网络, timeout 强杀)
# --------------------------------------------------------------------------- #
def _safe_env() -> dict[str, str]:
    """最小化环境: 保留运行 python 所需变量, 清除一切代理/网络相关变量。"""
    keep = ("PATH", "SYSTEMROOT", "SYSTEMDRIVE", "TEMP", "TMP", "USERPROFILE", "WINDIR", "COMSPEC")
    env: dict[str, str] = {k: os.environ[k] for k in keep if k in os.environ}
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["OMP_NUM_THREADS"] = "1"
    return env


def run_check(program: str, timeout: float, python_exe: str) -> dict[str, Any]:
    """在沙箱子进程中执行拼装程序, 返回 {status, reason}。强杀并清理临时文件。"""
    fd, path = tempfile.mkstemp(suffix=".py", prefix="he_")
    os.close(fd)
    try:
        Path(path).write_text(program, encoding="utf-8")
        with open(os.devnull, "w") as devnull:
            proc = subprocess.run(
                [python_exe, path],
                capture_output=True, text=True, timeout=timeout,
                env=_safe_env(), stdin=devnull,
            )
        if proc.returncode == 0:
            return {"status": "passed", "reason": ""}
        # 非 0 退出: check() 断言失败或其他异常
        stderr = (proc.stderr or "").strip().splitlines()
        tail = " | ".join(stderr[-3:]) if stderr else f"exit={proc.returncode}"
        return {"status": "failed", "reason": tail[:300]}
    except subprocess.TimeoutExpired:
        return {"status": "timeout", "reason": f"exceeded {timeout}s"}
    except Exception as exc:  # noqa: BLE001 - 子进程异常降级
        return {"status": "exe_error", "reason": f"{type(exc).__name__}: {exc}"}
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


# --------------------------------------------------------------------------- #
# 单题评测 + 缓存
# --------------------------------------------------------------------------- #
def _cache_path(cache_dir: Path, task_id: str) -> Path:
    safe = task_id.replace("/", "_").replace("\\", "_")
    return cache_dir / f"{safe}.json"


def _cache_valid(cache_file: Path, model: str, temperature: float) -> dict[str, Any] | None:
    if not cache_file.exists():
        return None
    try:
        obj = json.loads(cache_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    if (
        obj.get("model") == model
        and obj.get("temperature") == temperature
        and obj.get("prompt_version") == PROMPT_VERSION
        and "status" in obj
    ):
        return obj
    return None


def evaluate_task(
    task: dict[str, Any],
    *,
    client: OpenAI,
    model: str,
    temperature: float,
    timeout: float,
    python_exe: str,
    cache_dir: Path,
    max_retry: int = 1,
) -> dict[str, Any]:
    task_id = task["task_id"]
    cache_file = _cache_path(cache_dir, task_id)
    cached = _cache_valid(cache_file, model, temperature)
    if cached is not None:
        return cached

    completion: str | None = None
    status = "api_error"
    reason = ""
    latency_ms = 0.0
    attempts = 0

    for attempt in range(1 + max_retry):
        attempts = attempt + 1
        try:
            text, latency_ms = call_model(client, model, temperature, task["prompt"])
            completion = extract_code(text)
            if not completion:
                status, reason = "extraction_fail", "no code block extracted"
            else:
                prog = build_program(task, completion)
                res = run_check(prog, timeout, python_exe)
                status, reason = res["status"], res["reason"]
        except Exception as exc:  # noqa: BLE001 - API/网络异常归类
            status, reason = "api_error", f"{type(exc).__name__}: {str(exc)[:200]}"

        # 仅对错误类状态重试; 测试未通过/超时视为该题真实结果
        if status not in RETRYABLE or attempt >= max_retry:
            break
        log(f"  [{task_id}] 重试 (attempt {attempts}, status={status})")
        time.sleep(2.0)

    result = {
        "task_id": task_id,
        "entry_point": task["entry_point"],
        "model": model,
        "temperature": temperature,
        "prompt_version": PROMPT_VERSION,
        "completion": completion,
        "status": status,
        "reason": reason,
        "latency_ms": round(latency_ms, 1),
        "attempts": attempts,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    cache_file.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


# --------------------------------------------------------------------------- #
# 报告
# --------------------------------------------------------------------------- #
def write_reports(results: list[dict[str, Any]], *, model: str, temperature: float, out_dir: Path) -> tuple[Path, Path]:
    total = len(results)
    solved = sum(1 for r in results if r["status"] == "passed")
    latencies = [r["latency_ms"] for r in results if r["status"] in ("passed", "failed")]
    avg_latency = round(sum(latencies) / len(latencies), 1) if latencies else 0.0
    pass_at_1 = round(solved / total, 4) if total else 0.0
    date = datetime.now().strftime("%Y-%m-%d")
    model_tag = model.replace("/", "_")

    report = {
        "benchmark": "HumanEval",
        "license": "MIT (OpenAI HumanEval)",
        "date": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "temperature": temperature,
        "samples_per_problem": 1,
        "total": total,
        "solved": solved,
        "pass@1": pass_at_1,
        "avg_latency_ms": avg_latency,
        "status_breakdown": _breakdown(results),
        "results": results,
    }
    json_path = out_dir / f"report-humaneval-{model_tag}-{date}.json"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    failed = [r for r in results if r["status"] != "passed"]
    md_lines = [
        f"# HumanEval 评测报告",
        "",
        f"- **Benchmark**: HumanEval (OpenAI, MIT) — 164 题 pass@1 行业口径",
        f"- **Model**: `{model}`",
        f"- **Temperature**: {temperature}",
        f"- **Samples/problem**: 1（pass@1 ≈ solved/total，单样本）",
        f"- **Date**: {date}",
        "",
        "## 汇总",
        "",
        f"| 指标 | 值 |",
        f"| --- | --- |",
        f"| 总题数 | {total} |",
        f"| 通过 (passed) | {solved} |",
        f"| **pass@1** | **{pass_at_1:.4f}** ({solved}/{total}) |",
        f"| 平均时延 (ms) | {avg_latency} |",
        f"| 失败题数 | {len(failed)} |",
        "",
        "## 状态分布",
        "",
    ]
    for st, cnt in _breakdown(results).items():
        md_lines.append(f"- {st}: {cnt}")
    md_lines += ["", "## 失败题清单", ""]
    if failed:
        md_lines.append("| task_id | entry_point | status | reason |")
        md_lines.append("| --- | --- | --- | --- |")
        for r in failed:
            reason = (r.get("reason") or "").replace("|", "\\|").replace("\n", " ")
            md_lines.append(f"| {r['task_id']} | {r['entry_point']} | {r['status']} | {reason[:120]} |")
    else:
        md_lines.append("无（全部通过）。")
    md_lines += ["", "## 说明", ""]
    md_lines.append("- 数据集为 OpenAI 官方 HumanEval (MIT)，164 题；逐题仅将 prompt 发给模型，未发送 canonical_solution。")
    md_lines.append("- 执行在沙箱子进程内进行，环境清空（禁网络），单题超时强杀并清理临时文件。")
    md_lines.append("- pass@1 仅来自真实执行结果；.cache 与 report 均为程序生成未手改。")
    md_path = out_dir / f"report-humaneval-{model_tag}-{date}.md"
    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    return json_path, md_path


def _breakdown(results: list[dict[str, Any]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for r in results:
        out[r["status"]] = out.get(r["status"], 0) + 1
    return dict(sorted(out.items(), key=lambda kv: (-kv[1], kv[0])))


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def main() -> int:
    global MAX_TOKENS
    ap = argparse.ArgumentParser(description="HumanEval 外部标准评测执行器")
    ap.add_argument("--data", type=Path, default=DEFAULT_DATA)
    ap.add_argument("--env", type=Path, default=DEFAULT_ENV)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--key-env", default="OPENROUTER_API_KEY")
    ap.add_argument("--max-tokens", type=int, default=MAX_TOKENS)
    ap.add_argument("--temperature", type=float, default=DEFAULT_TEMP)
    ap.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    ap.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)
    ap.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    ap.add_argument("--out-dir", type=Path, default=EVAL_DIR)
    ap.add_argument("--limit", type=int, default=0, help="仅跑前 N 题 (smoke 用)")
    ap.add_argument("--retry", type=int, default=1, help="错误类状态重试次数")
    args = ap.parse_args()

    key = load_api_key(args.env, args.key_env)
    client = OpenAI(api_key=key, base_url=args.base)
    MAX_TOKENS = args.max_tokens
    tasks = load_dataset(args.data)
    if args.limit > 0:
        tasks = tasks[: args.limit]
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    python_exe = sys.executable

    log(f"模型={args.model} temp={args.temperature} 题数={len(tasks)} workers={args.workers} timeout={args.timeout}s")
    log(f"已缓存题数(可续跑): {sum(1 for t in tasks if _cache_valid(_cache_path(args.cache_dir, t['task_id']), args.model, args.temperature) is not None)}")

    results: list[dict[str, Any]] = []
    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {
            ex.submit(
                evaluate_task, t,
                client=client, model=args.model, temperature=args.temperature,
                timeout=args.timeout, python_exe=python_exe,
                cache_dir=args.cache_dir, max_retry=args.retry,
            ): t["task_id"]
            for t in tasks
        }
        for fut in as_completed(futures):
            r = fut.result()
            with _lock:
                results.append(r)
                done += 1
                tag = "PASS" if r["status"] == "passed" else r["status"].upper()
                log(f"[{r['task_id']}] {tag} ({r['latency_ms']}ms, attempts={r['attempts']}) — {done}/{len(tasks)}")
                if done % 20 == 0:
                    solved_now = sum(1 for x in results if x["status"] == "passed")
                    log(f"进度 {done}/{len(tasks)} 当前通过 {solved_now} ({(solved_now/done)*100:.1f}%)")

    # 按 task_id 排序输出
    results.sort(key=lambda x: x["task_id"])
    json_path, md_path = write_reports(results, model=args.model, temperature=args.temperature, out_dir=args.out_dir)
    solved = sum(1 for r in results if r["status"] == "passed")
    log(f"完成: {solved}/{len(results)} 通过  pass@1={solved/len(results):.4f}")
    log(f"报告: {json_path}")
    log(f"报告: {md_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

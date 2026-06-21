"""生产 step 自动重试 + 实时流式日志 (Phase 8 建议 1).

解决:
  - 生产 PostgreSQL 网络抖动时手动重试 step 太累, 失败 3 次后再放弃
  - 现有 drill_log.collect_step 用 subprocess.run, 一次收 stdout 看不到实时输出
  - 9 步全跑缺统一入口

特点:
  - 网络错误 (OperationalError / ConnectError / timeout) 自动重试 3 次, 退避 5/15/30s
  - 子进程 Popen 按行实时输出, 同步追加到 logs/zhs-migration/{date}.log
  - 单步失败可选 --continue-on-error 继续下一步
  - 统计总耗时 + 每步耗时 + 失败原因

用法:
  # 单步
  python scripts/ops/retry_drill_steps.py --date 20260615 --step upgrade --max-retry 3
  # 9 步全跑
  python scripts/ops/retry_drill_steps.py --date 20260615 --all --continue-on-error
  # 实时跑 dry-run + history + current (不连 DB 的)
  python scripts/ops/retry_drill_steps.py --date 20260615 --steps dry-run,history,current
"""

from __future__ import annotations

import argparse
import os
import re
import socket
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

# 日志根目录
LOG_ROOT_VAR = Path(os.environ.get("ZHS_DRILL_LOG_ROOT", "/var/log/zhs-migration"))
LOCAL_LOG_ROOT = ROOT / "logs" / "zhs-migration"

NETWORK_ERROR_PATTERNS = [
    re.compile(r"Can't connect to (?:PostgreSQL|server)", re.I),
    re.compile(r"Connection (?:refused|reset|timed out)", re.I),
    re.compile(r"Timeout connecting", re.I),
    re.compile(r"OperationalError.*2003", re.I),
    re.compile(r"ConnectError", re.I),
    re.compile(r"Network is unreachable", re.I),
    re.compile(r"timed out", re.I),
]


def get_log_root() -> Path:
    """优先 /var/log, 否则本地 logs/."""
    try:
        if os.access("/var/log", os.W_OK):
            return LOG_ROOT_VAR
    except Exception:
        pass
    return LOCAL_LOG_ROOT


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def is_network_error(text: str) -> bool:
    return any(p.search(text) for p in NETWORK_ERROR_PATTERNS)


def stream_cmd(cmd: list[str], cwd: Path, log_fh) -> tuple[int, float]:
    """实时流式执行, 同时把每行写日志. 返回 (rc, elapsed_sec)."""
    start = time.time()
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace",
    )
    for line in proc.stdout:  # type: ignore[union-attr]
        line = line.rstrip()
        print(f"  | {line}")
        log_fh.write(line + "\n")
        log_fh.flush()
    proc.wait()
    return proc.returncode, time.time() - start


def run_step_with_retry(
    step: str, cmd: list[str], cwd: Path, log_fh, max_retry: int, retry_delay: tuple[int, ...]
) -> tuple[int, float, int]:
    """单 step 跑 max_retry 次, 网络错才重试, 其他错立刻放弃."""
    delays = retry_delay[:max_retry]
    for attempt in range(1, max_retry + 1):
        sep = f"\n--- [{now_iso()}] STEP={step} ATTEMPT={attempt}/{max_retry} ---\n"
        log_fh.write(sep)
        log_fh.flush()
        print(sep.strip())
        rc, elapsed = stream_cmd(cmd, cwd, log_fh)
        if rc == 0:
            return rc, elapsed, attempt
        # 读本次 stdout/stderr 找网络错误关键字
        # 简化: 总是用 returncode + 显式网络错误关键字
        if attempt < max_retry:
            # 看日志末尾 4KB 找网络错误 (不要用 with, 否则 log_fh 会被关闭)
            log_fh.flush()
            with open(log_fh.name, encoding="utf-8", errors="replace") as f:
                f.seek(0, 2)
                size = f.tell()
                f.seek(max(0, size - 4096))
                tail = f.read()
            if is_network_error(tail) and attempt < max_retry:
                delay = delays[attempt - 1] if attempt - 1 < len(delays) else 30
                msg = f"  [RETRY] 网络错, 第 {attempt} 次失败, {delay}s 后重试 (剩余 {max_retry - attempt} 次)"
                print(msg)
                log_fh.write(msg + "\n")
                log_fh.flush()
                time.sleep(delay)
                continue
        return rc, elapsed, attempt
    return rc, elapsed, max_retry  # type: ignore[name-defined]


def cmd_for_step(step: str) -> list[str]:
    """映射 step → 子命令."""
    base = [sys.executable, "scripts/ci/alembic_ci.py"]
    if step in ("dry-run", "history", "current"):
        return base + [step, "--env", ".env.production"]
    if step == "upgrade":
        return base + ["upgrade", "--env", ".env.production"]
    if step == "reversibility":
        return base + ["reversibility", "--env", ".env.production"]
    if step == "downgrade-1":
        return base + ["downgrade", "-1", "--env", ".env.production"]
    if step == "smoke":
        return [
            sys.executable,
            "-c",
            "import httpx; r=httpx.get('http://127.0.0.1:8000/healthz', timeout=5); "
            "print(f'status={r.status_code} body={r.text}')",
        ]
    if step == "monitor-metrics":
        return [
            sys.executable,
            "-c",
            "import httpx; r=httpx.get('http://127.0.0.1:8000/metrics', timeout=5); "
            "ks=['zhs_biz_monitor_records_cached','zhs_biz_monitor_expired_total',"
            "'zhs_biz_monitor_refresh_seconds','zhs_biz_monitor_running',"
            "'zhs_biz_monitor_checks_total']; "
            "body=r.text; [print(f'{k}: ' + ('FOUND' if k in body else 'MISSING')) for k in ks]",
        ]
    raise ValueError(f"未知 step: {step}")


ALL_STEPS = ["dry-run", "history", "current", "upgrade", "reversibility", "downgrade-1", "smoke", "monitor-metrics"]


def main() -> int:
    parser = argparse.ArgumentParser(description="生产 step 自动重试 + 实时流式日志")
    parser.add_argument("--date", required=True, help="日期 YYYYMMDD")
    parser.add_argument("--step", help="单步 (例 upgrade / dry-run / smoke)")
    parser.add_argument("--steps", help="逗号分隔多步 (例 dry-run,history,current)")
    parser.add_argument("--all", action="store_true", help="跑全部 9 步")
    parser.add_argument("--max-retry", type=int, default=3, help="网络错最大重试次数")
    parser.add_argument("--retry-delay", default="5,15,30", help="重试退避秒数 (逗号分隔)")
    parser.add_argument("--continue-on-error", action="store_true", help="失败后继续下一步")
    parser.add_argument("--cwd", default=str(ROOT), help="项目根")
    args = parser.parse_args()

    if args.step:
        steps = [args.step]
    elif args.steps:
        steps = [s.strip() for s in args.steps.split(",") if s.strip()]
    elif args.all:
        steps = ALL_STEPS
    else:
        print("✗ 必须指定 --step / --steps / --all")
        return 2

    # 日志文件
    log_root = get_log_root()
    log_root.mkdir(parents=True, exist_ok=True)
    log_path = log_root / f"{args.date}.log"
    log_fh = log_path.open("a", encoding="utf-8")

    banner = (
        f"\n{'='*70}\n"
        f"[{now_iso()}] ZHS Platform 生产 step 自动重试 (date={args.date})\n"
        f"日志: {log_path}\n"
        f"steps: {', '.join(steps)}\n"
        f"max_retry={args.max_retry} retry_delay={args.retry_delay}s\n"
        f"主机: {socket.gethostname()}\n"
        f"{'='*70}\n"
    )
    log_fh.write(banner)
    log_fh.flush()
    print(banner)

    delays = tuple(int(x) for x in args.retry_delay.split(","))
    overall_start = time.time()
    results: list[tuple[str, int, float, int]] = []
    failed = 0

    for i, step in enumerate(steps, 1):
        try:
            cmd = cmd_for_step(step)
        except ValueError as e:
            print(f"  [SKIP] {e}")
            log_fh.write(f"  [SKIP] {e}\n")
            continue
        print(f"\n>>> [{i}/{len(steps)}] STEP = {step}")
        log_fh.write(f"\n>>> [{i}/{len(steps)}] STEP = {step}\n")
        log_fh.flush()
        try:
            rc, elapsed, attempt = run_step_with_retry(
                step,
                cmd,
                Path(args.cwd),
                log_fh,
                max_retry=args.max_retry,
                retry_delay=delays,
            )
        except FileNotFoundError as e:
            print(f"  [ERR] {e}")
            log_fh.write(f"  [ERR] {e}\n")
            rc, elapsed, attempt = 127, 0.0, 0
        mark = "✓" if rc == 0 else "✗"
        print(f"  {mark} step={step} rc={rc} 用时={elapsed:.1f}s 尝试={attempt}次")
        log_fh.write(f"  {mark} step={step} rc={rc} 用时={elapsed:.1f}s 尝试={attempt}次\n")
        log_fh.flush()
        results.append((step, rc, elapsed, attempt))
        if rc != 0:
            failed += 1
            if not args.continue_on_error:
                print("  [ABORT] 非 --continue-on-error, 停止")
                log_fh.write("  [ABORT] 失败后停止\n")
                break

    overall_elapsed = time.time() - overall_start
    summary = (
        f"\n{'='*70}\n"
        f"汇总 - date={args.date} 总耗时={overall_elapsed:.1f}s 失败={failed}/{len(results)}\n"
        f"{'-'*50}\n"
    )
    for step, rc, elapsed, attempt in results:
        mark = "✓" if rc == 0 else "✗"
        summary += f"  {mark} {step:<18} rc={rc:<4} {elapsed:6.1f}s  x{attempt}\n"
    summary += "=" * 70 + "\n"
    log_fh.write(summary)
    log_fh.close()
    print(summary)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

"""生产演练日志收集 + 模板初始化 (Phase 8 建议 1).

用法:
    # 1) 初始化当天演练日志 (按日期创建空模板)
    python scripts/ops/init_drill_log.py 20260615

    # 2) 收集一次演练结果 (输出到 stdout, 同时追加到日志文件)
    python scripts/ops/collect_drill.py 20260615 --step dry-run
    python scripts/ops/collect_drill.py 20260615 --step upgrade
    python scripts/ops/collect_drill.py 20260615 --step reversibility
    python scripts/ops/collect_drill.py 20260615 --step smoke

    # 3) 生成最终 checklist 报告
    python scripts/ops/collect_drill.py 20260615 --step report
"""

from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

# 2026-06-25 修复: 原硬编码 /var/log/zhs-migration 在 Windows 上会创建 G:\var\log\...
# 改用平台感知默认目录:
#   - Linux (生产): /var/log/zhs-migration
#   - Windows (开发): %TEMP%\zhs-migration
# 仍可由环境变量 ZHS_DRILL_LOG_ROOT 覆盖
if os.name == "nt":
    DEFAULT_LOG_ROOT = Path(tempfile.gettempdir()) / "zhs-migration"
else:
    DEFAULT_LOG_ROOT = Path("/var/log/zhs-migration")
LOG_ROOT = Path(os.environ.get("ZHS_DRILL_LOG_ROOT", str(DEFAULT_LOG_ROOT)))
LOCAL_LOG_ROOT = Path("logs/zhs-migration")  # 兜底, 写不进 /var 时用本地


def get_log_root() -> Path:
    """优先用 LOG_ROOT (生产规范), 否则 fallback 到本地 logs/."""
    try:
        LOG_ROOT.mkdir(parents=True, exist_ok=True)
        return LOG_ROOT
    except (OSError, PermissionError):
        return LOCAL_LOG_ROOT


def run_cmd(cmd: list[str], cwd: Path | None = None, timeout: int = 120) -> tuple[int, str, str]:
    """执行子命令, 返回 (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", f"timeout after {timeout}s"
    except FileNotFoundError as e:
        return 127, "", str(e)


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def init_drill_log(date: str) -> int:
    """初始化当天演练日志, 写入头部元信息."""
    root = get_log_root()
    root.mkdir(parents=True, exist_ok=True)
    log_path = root / f"{date}.log"

    if log_path.exists():
        print(f"⚠ 日志已存在, 追加模式: {log_path}")
    else:
        header = (
            f"# ZHS Platform 演练日志 - {date}\n"
            f"# 生成时间: {now_iso()}\n"
            f"# 操作人:  {os.environ.get('USER', os.environ.get('USERNAME', 'unknown'))}\n"
            f"# 主机:    {socket.gethostname()}\n"
            f"# 目标:    172.21.0.15:5432 (3 库: zhs_ai_project / zhs_center_project / zhs_educational_training)\n"
            f"#\n"
            f"# 步骤清单:\n"
            f"#   1. dry-run        - alembic 脚本链校验, 不连 DB\n"
            f"#   2. pg_dump        - 备份 3 库\n"
            f"#   3. upgrade        - alembic upgrade head (3 库)\n"
            f"#   4. show-tables    - 验证表结构\n"
            f"#   5. reversibility  - head -> -1 -> head 双向可逆\n"
            f"#   6. /healthz smoke - 启动 app, 健康检查\n"
            f"#   7. grafana        - 监控观察 30 分钟\n"
            f"#\n\n"
        )
        log_path.write_text(header, encoding="utf-8")
        print(f"✓ 已初始化: {log_path}")

    print(f"  路径: {log_path.absolute()}")
    return 0


def collect_step(date: str, step: str, cwd: Path) -> int:
    """跑指定 step, 输出追加到日志文件."""
    root = get_log_root()
    log_path = root / f"{date}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    if not log_path.exists():
        print(f"⚠ 日志不存在, 先初始化: {log_path}")
        init_drill_log(date)

    sep = f"\n\n{'='*70}\n[{now_iso()}] STEP: {step}\n{'='*70}\n"
    log_path.write_text(log_path.read_text(encoding="utf-8") + sep, encoding="utf-8")

    cmds = {
        "dry-run": [
            sys.executable,
            "scripts/ci/alembic_ci.py",
            "dry-run",
            "--env",
            ".env.production",
        ],
        "history": [
            sys.executable,
            "scripts/ci/alembic_ci.py",
            "history",
            "--env",
            ".env.production",
        ],
        "current": [
            sys.executable,
            "scripts/ci/alembic_ci.py",
            "current",
            "--env",
            ".env.production",
        ],
        "upgrade": [
            sys.executable,
            "scripts/ci/alembic_ci.py",
            "upgrade",
            "--env",
            ".env.production",
        ],
        "reversibility": [
            sys.executable,
            "scripts/ci/alembic_ci.py",
            "reversibility",
            "--env",
            ".env.production",
        ],
        "downgrade-1": [
            sys.executable,
            "scripts/ci/alembic_ci.py",
            "downgrade",
            "-1",
            "--env",
            ".env.production",
        ],
        "smoke": [
            sys.executable,
            "-c",
            "import httpx; r=httpx.get('http://127.0.0.1:8000/healthz', timeout=5); "
            "print(f'status={r.status_code} body={r.text}')",
        ],
        "monitor-metrics": [
            sys.executable,
            "-c",
            "import httpx; r=httpx.get('http://127.0.0.1:8000/metrics', timeout=5); "
            "ks=['zhs_biz_monitor_records_cached','zhs_biz_monitor_expired_total',"
            "'zhs_biz_monitor_refresh_seconds','zhs_biz_monitor_running',"
            "'zhs_biz_monitor_checks_total']; "
            "body=r.text; [print(f'{k}: ' + ('FOUND' if k in body else 'MISSING')) for k in ks]",
        ],
    }

    cmd = cmds.get(step)
    if not cmd:
        print(f"✗ 未知 step: {step}, 可选: {', '.join(cmds.keys())}")
        return 1

    print(f"  执行: {' '.join(cmd)}")
    rc, out, err = run_cmd(cmd, cwd=cwd, timeout=300)
    payload = f"\n--- cmd ---\n{' '.join(cmd)}\n--- rc ---\n{rc}\n--- stdout ---\n{out}\n--- stderr ---\n{err}\n"
    log_path.write_text(log_path.read_text(encoding="utf-8") + payload, encoding="utf-8")

    print(f"  rc={rc}")
    if out.strip():
        print(out[:500])
    if err.strip():
        print(f"  [stderr] {err[:200]}")
    print(f"  追加到: {log_path.absolute()}")
    return rc


def gen_report(date: str) -> int:
    """生成最终 checklist 报告, 输出到 stdout."""
    root = get_log_root()
    log_path = root / f"{date}.log"
    if not log_path.exists():
        print(f"✗ 日志不存在: {log_path}")
        return 1

    text = log_path.read_text(encoding="utf-8")
    steps_found = []
    for step in ["dry-run", "upgrade", "reversibility", "smoke", "monitor-metrics"]:
        if f"STEP: {step}" in text:
            steps_found.append((step, True))
        else:
            steps_found.append((step, False))

    print(f"\n{'='*70}")
    print(f"ZHS Platform 演练报告 - {date}")
    print(f"日志路径: {log_path.absolute()}")
    print(f"{'='*70}\n")
    print(f"{'Step':<20} {'Status':<10}")
    print(f"{'-'*30}")
    for step, ok in steps_found:
        mark = "✓ DONE" if ok else "✗ MISSING"
        print(f"{step:<20} {mark:<10}")
    print()
    print(f"详细见: {log_path.absolute()}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="生产演练日志收集 + 初始化")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init", help="初始化当天演练日志模板")
    p_init.add_argument("date", help="日期 YYYYMMDD")

    p_collect = sub.add_parser("collect", help="跑一个 step 并追加到日志")
    p_collect.add_argument("date", help="日期 YYYYMMDD")
    p_collect.add_argument(
        "--step",
        required=True,
        help="dry-run / upgrade / reversibility / smoke / monitor-metrics / current / history / downgrade-1",
    )
    p_collect.add_argument("--cwd", default=".", help="项目根")

    p_report = sub.add_parser("report", help="生成最终 checklist 报告")
    p_report.add_argument("date", help="日期 YYYYMMDD")

    args = parser.parse_args()
    if args.cmd == "init":
        return init_drill_log(args.date)
    elif args.cmd == "collect":
        return collect_step(args.date, args.step, Path(args.cwd))
    elif args.cmd == "report":
        return gen_report(args.date)
    return 1


if __name__ == "__main__":
    sys.exit(main())

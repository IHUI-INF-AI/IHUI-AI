"""Celery worker / beat 进程管理 (Windows 服务友好).

启动方式:
    # 启动 worker
    python scripts/celery_launcher.py worker

    # 启动 beat (调度器)
    python scripts/celery_launcher.py beat

    # 同时启 worker + beat (单进程, 适合开发)
    python scripts/celery_launcher.py both

    # 停所有 Celery 进程
    python scripts/celery_launcher.py stop

    # 查看状态
    python scripts/celery_launcher.py status
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

REDIS_URL = os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0"))


def _start_worker() -> subprocess.Popen:
    log = open(LOG_DIR / "celery_worker.log", "a", encoding="utf-8")
    print(f"[celery] starting worker, log -> {log.name}")
    return subprocess.Popen(
        [
            sys.executable, "-m", "celery",
            "-A", "app.celery_app",
            "worker",
            "-l", "info",
            "-Q", "default,reconcile",
            "--concurrency=2",
            "-n", f"worker@{os.uname().nodename if hasattr(os, 'uname') else 'localhost'}",
        ],
        cwd=SERVER_DIR,
        stdout=log, stderr=subprocess.STDOUT,
        env={**os.environ, "PYTHONPATH": str(SERVER_DIR)},
    )


def _start_beat() -> subprocess.Popen:
    log = open(LOG_DIR / "celery_beat.log", "a", encoding="utf-8")
    print(f"[celery] starting beat, log -> {log.name}")
    return subprocess.Popen(
        [
            sys.executable, "-m", "celery",
            "-A", "app.celery_app",
            "beat",
            "-l", "info",
            "--scheduler=celery.beat.PersistentScheduler",
        ],
        cwd=SERVER_DIR,
        stdout=log, stderr=subprocess.STDOUT,
        env={**os.environ, "PYTHONPATH": str(SERVER_DIR)},
    )


def _list_running() -> list[subprocess.Popen]:
    if not (LOG_DIR / "celery.pid").exists():
        return []
    try:
        import psutil
        out = []
        with open(LOG_DIR / "celery.pid") as f:
            for line in f:
                pid = int(line.strip())
                if psutil.pid_exists(pid):
                    out.append(psutil.Process(pid))
        return out
    except Exception as e:
        print(f"[celery] 查询进程失败: {e}")
        return []


def _save_pids(*procs: subprocess.Popen) -> None:
    with open(LOG_DIR / "celery.pid", "w") as f:
        for p in procs:
            f.write(f"{p.pid}\n")


def _stop_all() -> None:
    procs = _list_running()
    if not procs:
        print("[celery] 没有运行中的 Celery 进程")
        return
    for p in procs:
        print(f"[celery] 终止 pid={p.pid} ({p.name()})")
        try:
            p.terminate()
            p.wait(timeout=10)
        except Exception:
            p.kill()
    (LOG_DIR / "celery.pid").unlink(missing_ok=True)
    print("[celery] 全部已停止")


def _status() -> None:
    procs = _list_running()
    if not procs:
        print("[celery] 未运行")
        return
    for p in procs:
        print(f"[celery] pid={p.pid}  name={p.name()}  cmdline={' '.join(p.cmdline()[-3:])}")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    cmd = sys.argv[1].lower()

    if cmd == "worker":
        p = _start_worker()
        _save_pids(p)
        print(f"[celery] worker pid={p.pid}, 按 Ctrl+C 停止")
        try:
            p.wait()
        except KeyboardInterrupt:
            p.terminate()
        return 0

    if cmd == "beat":
        p = _start_beat()
        _save_pids(p)
        print(f"[celery] beat pid={p.pid}, 按 Ctrl+C 停止")
        try:
            p.wait()
        except KeyboardInterrupt:
            p.terminate()
        return 0

    if cmd == "both":
        w = _start_worker()
        time.sleep(2)
        b = _start_beat()
        _save_pids(w, b)
        print(f"[celery] worker={w.pid} beat={b.pid}, 按 Ctrl+C 停止")
        try:
            w.wait()
        except KeyboardInterrupt:
            w.terminate()
            b.terminate()
        return 0

    if cmd == "stop":
        _stop_all()
        return 0

    if cmd == "status":
        _status()
        return 0

    print(f"[celery] 未知子命令: {cmd}")
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())

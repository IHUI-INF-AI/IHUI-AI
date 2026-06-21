"""一键重启后端 uvicorn 服务 (windows / powershell 兼容).

流程:
1. 找到占用 .zhs_db_fallback_*.sqlite 的 python (uvicorn) 进程
2. 优雅停止 (SIGTERM via psutil)
3. 清理 sqlite 残留文件
4. 重新启动 uvicorn
5. 等待健康检查通过

用法:
    python scripts/restart_backend.py            # 重启 + 清理
    python scripts/restart_backend.py --no-start # 只停 + 清理, 不启动
    python scripts/restart_backend.py --no-clean # 只重启, 不清理
    python scripts/restart_backend.py --port 8000
"""
from __future__ import annotations

import argparse
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import psutil

SERVER_ROOT = Path(__file__).resolve().parent.parent
CWD = SERVER_ROOT
LOG_FILE = SERVER_ROOT / "logs" / "uvicorn_restart.log"
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)


def _is_uvicorn(proc: psutil.Process) -> bool:
    try:
        cmdline = proc.cmdline()
    except (psutil.AccessDenied, psutil.NoSuchProcess):
        return False
    if not cmdline:
        return False
    joined = " ".join(cmdline).lower()
    return "uvicorn" in joined and "app.main:app" in joined


def find_uvicorn() -> list[psutil.Process]:
    out: list[psutil.Process] = []
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            if _is_uvicorn(proc):
                out.append(proc)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return out


def stop_uvicorn(timeout: float = 10.0) -> list[int]:
    procs = find_uvicorn()
    killed: list[int] = []
    for proc in procs:
        try:
            print(f"[restart] 停止 uvicorn pid={proc.pid}")
            proc.terminate()
            try:
                proc.wait(timeout=timeout)
            except psutil.TimeoutExpired:
                print(f"[restart] pid={proc.pid} 未响应, kill")
                proc.kill()
                proc.wait(timeout=timeout)
            killed.append(proc.pid)
        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            print(f"[restart] pid={proc.pid} 停止失败: {e}")
    return killed


def clean_sqlite_residue() -> int:
    """清理 .zhs_db_fallback*.sqlite* 残留 (必须先停占用进程)."""
    patterns = [
        ".zhs_db_fallback*.sqlite",
        ".zhs_db_fallback*.sqlite-journal",
        ".zhs_db_fallback*.sqlite-wal",
        ".zhs_db_fallback*.sqlite-shm",
    ]
    roots = [CWD, CWD / "server", SERVER_ROOT]
    deleted = 0
    for root in roots:
        if not root.is_dir():
            continue
        for pat in patterns:
            for f in root.glob(pat):
                if f.is_file():
                    try:
                        f.unlink()
                        print(f"[clean] 删除 {f}")
                        deleted += 1
                    except Exception as e:
                        print(f"[clean] 失败 {f}: {e}")
    return deleted


def start_uvicorn(port: int) -> int:
    print(f"[start] 启动 uvicorn :{port} cwd={CWD}")
    log_fp = open(LOG_FILE, "ab", buffering=0)
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"],
        cwd=str(CWD), stdout=log_fp, stderr=log_fp,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    return proc.pid


def wait_health(port: int, timeout: float = 30.0) -> bool:
    """等待 /healthz 返回 200."""
    t0 = time.time()
    last_err = ""
    while time.time() - t0 < timeout:
        try:
            s = socket.create_connection(("127.0.0.1", port), timeout=2)
            s.sendall(b"GET /healthz HTTP/1.0\r\nHost: localhost\r\n\r\n")
            data = s.recv(1024).decode(errors="ignore")
            s.close()
            if "200 OK" in data and "status" in data:
                print(f"[health] OK in {time.time()-t0:.1f}s")
                return True
            last_err = data[:120]
        except Exception as e:
            last_err = str(e)
        time.sleep(0.5)
    print(f"[health] FAIL after {time.time()-t0:.1f}s, last_err={last_err}")
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-start", action="store_true",
                        help="只停止 + 清理, 不启动")
    parser.add_argument("--no-clean", action="store_true",
                        help="只重启, 不清理 sqlite")
    args = parser.parse_args()

    print(f"[restart] 服务: 127.0.0.1:{args.port}")

    killed = stop_uvicorn()
    print(f"[restart] 已停止 {len(killed)} 个 uvicorn 进程: {killed}")

    if not args.no_clean:
        n = clean_sqlite_residue()
        print(f"[restart] 已清理 {n} 个 sqlite 残留")

    if args.no_start:
        print("[restart] --no-start 模式, 不启动新进程")
        return 0

    pid = start_uvicorn(args.port)
    print(f"[restart] 新 uvicorn pid={pid}, log={LOG_FILE}")

    if wait_health(args.port, timeout=30.0):
        print("[restart] 完成")
        return 0
    print("[restart] 启动后健康检查失败, 请查看日志")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

"""清理 .zhs_db_fallback_*.sqlite 残留文件.

使用场景:
- pytest 进程退出后, 部分 .zhs_db_fallback_*.sqlite 残留
- 这些文件在 dev/test 环境是 SQLite fallback 数据库, 不影响生产
- 锁定中的文件需要先停止占用进程 (uvicorn/pytest) 才能删除

用法:
    python scripts/clean_sqlite_residue.py            # 尝试删除 (跳过锁住的文件)
    python scripts/clean_sqlite_residue.py --force     # 尝试强制关闭占用进程后删除
"""
from __future__ import annotations

import os
import sys
import glob
import psutil


def find_residue_files() -> list[str]:
    patterns = [
        ".zhs_db_fallback*.sqlite",          # 无后缀 + 数字后缀
        ".zhs_db_fallback*.sqlite-journal",
        ".zhs_db_fallback*.sqlite-wal",
        ".zhs_db_fallback*.sqlite-shm",
    ]
    roots = [os.getcwd(), os.path.join(os.getcwd(), "server"), os.path.dirname(os.getcwd())]
    found: list[str] = []
    for root in roots:
        if not os.path.isdir(root):
            continue
        for pat in patterns:
            for path in glob.glob(os.path.join(root, pat)):
                if os.path.isfile(path):
                    found.append(os.path.abspath(path))
    return sorted(set(found))


def can_delete(path: str) -> tuple[bool, str]:
    try:
        # 探测: 尝试以独占读打开
        with open(path, "rb") as f:
            pass
        return True, "ok"
    except PermissionError as e:
        return False, f"locked: {e}"
    except FileNotFoundError:
        return False, "not found"
    except Exception as e:
        return False, f"error: {e}"


def find_locking_processes(path: str) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    for proc in psutil.process_iter(["pid", "name", "cmdline", "open_files"]):
        try:
            of = proc.info.get("open_files") or []
            for f in of:
                if os.path.abspath(f.path) == os.path.abspath(path):
                    out.append((proc.info["pid"], proc.info.get("name", "")))
                    break
        except (psutil.AccessDenied, psutil.NoSuchProcess):
            continue
    return out


def main() -> int:
    force = "--force" in sys.argv[1:]
    files = find_residue_files()
    if not files:
        print("[clean] 无残留文件")
        return 0

    print(f"[clean] 发现 {len(files)} 个残留文件")
    deleted = 0
    skipped = 0
    for f in files:
        ok, msg = can_delete(f)
        if ok:
            try:
                os.remove(f)
                print(f"  [DELETED] {f}")
                deleted += 1
            except Exception as e:
                print(f"  [FAILED]  {f} -> {e}")
                skipped += 1
        else:
            lockers = find_locking_processes(f)
            extra = ""
            if lockers and force:
                for pid, name in lockers:
                    try:
                        p = psutil.Process(pid)
                        print(f"  [KILL]    pid={pid} name={name}")
                        p.terminate()
                        try:
                            p.wait(timeout=3)
                        except psutil.TimeoutExpired:
                            p.kill()
                    except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                        print(f"  [KILL FAIL] pid={pid} -> {e}")
                # 再试
                ok2, msg2 = can_delete(f)
                if ok2:
                    try:
                        os.remove(f)
                        print(f"  [DELETED] {f}")
                        deleted += 1
                        continue
                    except Exception as e:
                        print(f"  [STILL FAILED] {f} -> {e}")
                        skipped += 1
                        continue
            if lockers:
                extra = f"  locked by: {lockers}"
            print(f"  [SKIP]    {f}  ({msg}){extra}")
            skipped += 1

    print(f"\n[clean] 已删除 {deleted} / 跳过 {skipped}")
    return 0 if skipped == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

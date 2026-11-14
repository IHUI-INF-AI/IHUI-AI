# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""file_write_gate — 同文件写冲突治理门(票78「同文件写冲突治理:串行化」档)。

背景(mcp_server 三个写工具 write_file / file_edit / resolve_conflict):
- 多智能体并行子模式(agent_orchestrator.run_parallel,asyncio.gather 同进程并发)
  下,两个并行 agent 写同一文件时:file_edit / resolve_conflict 有 3-way base
  检测兜底,而 write_file 是整文件覆盖、写前无任何基线比对 → 盲覆盖丢改动。
- 本门提供三道治理,算法本体只在这一处实现(调用方只接线,不各写一份):
  1) per-path 进程内 asyncio 互斥锁 get_path_write_lock:同一 resolved_path 的
     写段互斥(键 normcase+normpath,Windows 大小写不敏感)。
  1b) 进程外文件锁:asyncio 锁内再取 OS 级排他锁(Windows msvcrt / POSIX flock),
     锁文件在系统临时目录(按路径哈希命名),超时显式 TimeoutError,进程死亡自动释放。
     覆盖 CLI、桌面宿主、多个 worker 同时写同一工作区的场景;读-改-写全程持锁。
  2) 写前基线漂移判定 classify_write_conflict(纯函数,五态):
       no-baseline — base 无记录(新文件/首次写)→ 放行
       clean       — 现盘 == base → 放行
       equivalent  — 现盘 == 拟写内容(幂等重写)→ 放行
       undecidable — 现盘读不了(二进制/权限)→ 放行(判不了不判死,如实上报)
       drifted     — 现盘 ≠ base 且 ≠ 拟写 → 并发修改,拦截(除非调用方 force)
- 注入式纪律(对齐 scripts/lib/stale-lock-claim.mjs):本模块不 import 任何
  app 模块、无 console、不碰 git;base 存储权威仍在 mcp_server._FILE_BASE_CONTENT,
  调用点把 disk / baseline / intended 三份 LF 归一化内容传进来。
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import tempfile
import time

if os.name == "nt":  # pragma: no cover - 平台分支
    import msvcrt
else:  # pragma: no cover - 平台分支
    import fcntl

# 进程外锁:超时前每 20ms 重试一次。测试可通过 env 或直接改模块常量缩短。
_CROSS_PROCESS_LOCK_TIMEOUT = float(os.environ.get("IHUI_WRITE_LOCK_TIMEOUT", "10"))
_CROSS_PROCESS_RETRY_S = 0.02
_CROSS_PROCESS_LOCK_DIR = os.path.join(tempfile.gettempdir(), "ihui-write-locks")

# per-path 锁注册表:键 = normcase(normpath(resolved_path))。
# 惰性创建;进程生命周期内不清(测试用 reset_path_write_locks 显式清)。
_PATH_WRITE_LOCKS: dict[str, _PathWriteLock] = {}


def _lock_key(resolved_path: str) -> str:
    """锁键规范化:Windows 大小写不敏感 + 分隔符归一,同一文件无论传法如何同键。"""
    return os.path.normcase(os.path.normpath(resolved_path))


def _os_lock_path(key: str) -> str:
    """锁文件路径:系统临时目录 + 路径哈希,不往被写工作区里落任何文件。"""
    digest = hashlib.sha256(key.encode("utf-8", "surrogatepass")).hexdigest()[:40]
    return os.path.join(_CROSS_PROCESS_LOCK_DIR, f"{digest}.lock")


def _try_lock_fd(fd: int) -> None:
    if os.name == "nt":
        msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
    else:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)


def _unlock_fd(fd: int) -> None:
    if os.name == "nt":
        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
    else:
        fcntl.flock(fd, fcntl.LOCK_UN)


def _acquire_os_lock_blocking(key: str, timeout_s: float) -> int:
    """阻塞式取 OS 排他锁,返回文件描述符;超时抛 TimeoutError。

    锁文件本身可以长期存在(空文件),锁的归属由 OS 维护:进程退出/句柄关闭
    即自动释放,不需要 stale-lock 回收,也不会因崩溃留下"死锁文件"。
    """
    os.makedirs(_CROSS_PROCESS_LOCK_DIR, exist_ok=True)
    fd = os.open(_os_lock_path(key), os.O_CREAT | os.O_RDWR, 0o600)
    deadline = time.monotonic() + max(0.0, timeout_s)
    while True:
        try:
            _try_lock_fd(fd)
            return fd
        except OSError:
            if time.monotonic() >= deadline:
                os.close(fd)
                raise TimeoutError(
                    f"路径写锁超时({timeout_s:.1f}s):另一个进程正在写同一文件,"
                    "已放弃本次写入,原文件保持不变"
                ) from None
            time.sleep(_CROSS_PROCESS_RETRY_S)


def _release_os_lock(fd: int) -> None:
    try:
        _unlock_fd(fd)
    except OSError:
        pass
    finally:
        try:
            os.close(fd)
        except OSError:
            pass


class _PathWriteLock(asyncio.Lock):
    """asyncio 互斥 + OS 文件锁的组合锁。

    继承 asyncio.Lock 是为了让现有 `async with get_path_write_lock(path)` 调用点
    零改动获得跨进程语义:进锁先拿协程锁,再在线程里等 OS 锁;退出时先放 OS 锁
    再放协程锁。OS 锁超时会释放协程锁并抛 TimeoutError,不会把路径永久卡死。
    """

    def __init__(self, key: str) -> None:
        super().__init__()
        self._key = key
        self._os_fd: int | None = None

    async def __aenter__(self) -> _PathWriteLock:
        await super().__aenter__()
        try:
            self._os_fd = await asyncio.to_thread(
                _acquire_os_lock_blocking, self._key, _CROSS_PROCESS_LOCK_TIMEOUT
            )
        except BaseException:
            self._os_fd = None
            await super().__aexit__(None, None, None)
            raise
        return self

    async def __aexit__(self, exc_type, exc, tb) -> bool | None:
        try:
            if self._os_fd is not None:
                _release_os_lock(self._os_fd)
                self._os_fd = None
        finally:
            released = await super().__aexit__(exc_type, exc, tb)
        return released


def get_path_write_lock(resolved_path: str) -> asyncio.Lock:
    """取(或惰性创建)该路径的写互斥锁。同一文件的写段必须全程持锁。

    返回对象同时持进程内 asyncio 锁与进程外 OS 文件锁。
    """
    key = _lock_key(resolved_path)
    lock = _PATH_WRITE_LOCKS.get(key)
    if lock is None:
        lock = _PathWriteLock(key)
        _PATH_WRITE_LOCKS[key] = lock
    return lock


def reset_path_write_locks() -> None:
    """清空锁注册表(仅测试隔离调用;运行期清锁会破坏互斥语义)。"""
    _PATH_WRITE_LOCKS.clear()


def classify_write_conflict(
    disk_lf: str | None,
    baseline_lf: str | None,
    intended_lf: str,
) -> str:
    """写前基线漂移判定(纯函数)。

    参数均为 LF 归一化内容(调用点负责,与 mcp_server._normalize_eol 同一口径):
      disk_lf     — 现盘内容;None = 文件不存在 或 读不了(二进制/IO 错误)
      baseline_lf — agent 视角 base(mcp_server._FILE_BASE_CONTENT);None = 无记录
      intended_lf — 本次拟写入的内容

    判定顺序(一步都不能少):
      1. baseline 缺席 → no-baseline(新文件/首次写是合法用例,放行);
      2. disk 缺席但 base 在 → undecidable(文件被外部删除或读不了;
         "被删除"与"读不了"此处同形,都判不了 → 放行但如实上报,不静默折成 clean);
      3. disk == baseline → clean(自 base 以来无外部改动);
      4. disk == intended → equivalent(幂等重写,覆盖的是同样内容);
      5. 其余 → drifted(并发修改:别人在我 base 之后改了盘,我要写的又与现状不同
         → 盲覆盖会丢别人的改动,拦截)。
    """
    if baseline_lf is None:
        return "no-baseline"
    if disk_lf is None:
        return "undecidable"
    if disk_lf == baseline_lf:
        return "clean"
    if disk_lf == intended_lf:
        return "equivalent"
    return "drifted"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

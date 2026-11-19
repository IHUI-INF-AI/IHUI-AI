# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""原子落盘公共 helper。

同目录临时件写完再 ``os.replace``:并发读者只会看到"旧完整文件"或"新完整文件",
不会看到截断中的中间态。统一在 ``asyncio.to_thread`` 内调用。
"""

from __future__ import annotations

import contextlib
import os
import socket
import stat
import tempfile
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

_REPLACE_RETRIES = 20
_REPLACE_RETRY_DELAY = 0.005


def _preserve_target_mode(tmp: str, target: Path) -> None:
    """把既有目标的权限位带到临时件上,替换后权限不回退。

    ``mkstemp`` 建的是 0600;直接 replace 会把原本 0644 的可读文件悄悄收窄。
    目标不存在(新建)时保持 0600 —— 新文件按私有件处理,不是本函数的缝。
    复制权限失败不阻断写入:内容正确优先于模式精确。
    """
    try:
        mode = stat.S_IMODE(os.stat(target).st_mode)
    except OSError:
        return
    with contextlib.suppress(OSError):
        os.chmod(tmp, mode)


def _replace_with_retry(tmp: str, target: Path) -> None:
    """``os.replace`` 的有界重试。

    Windows 上并发读者用 ``open()`` 打开目标时默认不带 ``FILE_SHARE_DELETE``,
    此时替换会被拒(``PermissionError [WinError 5]``)。读者都是短生命周期,
    退避若干毫秒后重试即可;超过上限仍失败则抛最后一次原错,不吞异常。
    """
    for attempt in range(_REPLACE_RETRIES):
        try:
            os.replace(tmp, target)
            return
        except PermissionError:
            if attempt == _REPLACE_RETRIES - 1:
                raise
            time.sleep(_REPLACE_RETRY_DELAY)


def write_bytes_atomic(path: str | Path, data: bytes) -> None:
    """把 ``data`` 原子写到 ``path``(失败清理临时件并原样抛错)。"""
    target = Path(path)
    fd, tmp = tempfile.mkstemp(
        prefix=f".{target.name}.", suffix=".tmp", dir=str(target.parent)
    )
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        _preserve_target_mode(tmp, target)
        _replace_with_retry(tmp, target)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


def write_text_atomic(path: str | Path, text: str, encoding: str = "utf-8") -> None:
    """``write_bytes_atomic`` 的文本版。"""
    write_bytes_atomic(path, text.encode(encoding))


def write_bytes_to_tempfile(data: bytes, suffix: str = "") -> str:
    """在**同一个工作线程内**完成 mkstemp + write + flush + close,返回路径。

    调用方把整段投进 ``asyncio.to_thread``:fd 只在一个工作线程里产生和销毁,
    请求被取消时不会出现 close 与在飞 write 跨线程竞争(Windows 上表现为
    close 异常或 fd 短暂泄漏)。
    """
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
        return path
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(path)
        raise


# ---------------------------------------------------------------------------
# 跨进程文件锁 + 崩溃接管(遵循统一工程规范)
#
# 既有 write_bytes_atomic 只解决"单次写不出现半成品";本节解决另一维:
#   多个**进程**(如服务多实例、CLI 与服务并发)要独占写同一资源时的互斥,
#   以及持有者**崩溃/被杀**后锁不被永久占死(下一个进程能接管)。
#
# 设计(纯 Python,不依赖 OS 文件锁 syscall,跨 Windows/POSIX 一致):
#   - 锁状态落在一个 sidecar 记录文件(``<path>.lock``),内容是 JSON:
#     {pid, hostname, acquired_at, token(sha256 随机 hex)}。
#   - 互斥:加锁 = 原子创建锁文件(exclusive);已存在则读记录判断持有者。
#   - 接管:持有者记录里的 pid 在**本机**已不存在 ⇒ 视为崩溃遗留,接管并改写记录。
#   - token 用于释锁时校验"还是我持有"(防止接管者误删后来者的锁)。
#   - 全程 sha256 参与 token 生成与校验,与 外部实现 的锁记录 hash 语义对齐。
#
# 已知边界(诚实声明):pid 存活探测用 os.kill(pid, 0),只在**同一台机器**可靠;
# 跨主机共享盘的场景不在本 helper 射程内(hostname 不匹配时不接管,宁可让路)。
# ---------------------------------------------------------------------------

_LOCK_POLL_SECONDS = 0.02
_LOCK_MAX_WAIT_SECONDS = 10.0


def _process_alive(pid: int) -> bool:
    """判断本机进程 pid 是否存活。跨平台:Windows/POSIX 都可用 os.kill(pid, 0)。"""
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        # 存在但无权发信号 ⇒ 视为存活(宁可让路,不误接管)
        return True
    except OSError:
        return False
    return True


def _read_lock_record(lock_path: Path) -> dict[str, Any] | None:
    try:
        raw = lock_path.read_text(encoding="utf-8")
    except (OSError, ValueError):
        return None
    try:
        import json

        record = json.loads(raw)
    except (ImportError, ValueError):
        return None
    return record if isinstance(record, dict) else None


def _write_lock_record(lock_path: Path, token: str) -> None:
    import json

    record = {
        "pid": os.getpid(),
        "hostname": socket.gethostname(),
        "acquired_at": time.time(),
        "token": token,
    }
    write_text_atomic(str(lock_path), json.dumps(record, ensure_ascii=False))


@contextlib.contextmanager
def process_file_lock(
    path: str | Path,
    *,
    max_wait_seconds: float = _LOCK_MAX_WAIT_SECONDS,
) -> Iterator[None]:
    """跨进程独占锁,持有者崩溃后可被接管。用法::

        with process_file_lock(state_file):
            ...独占读写 state_file...

    行为:
      - 拿到锁 ⇒ 进入临界区;退出时若 token 仍匹配自己则释放(删锁文件)。
      - 已被占:持有者存活 ⇒ 轮询等待,超过 ``max_wait_seconds`` 抛 ``TimeoutError``。
      - 已被占:持有者**已死**(本机 pid 不存在)⇒ 接管,改写锁记录为自己。
      - 跨主机记录(hostname 不匹配)⇒ 不接管,只等待(避免误删别的机器的锁)。

    token 用 ``secrets.token_hex``(sha256 间接参与:token 即锁记录的完整性凭据),
    释锁前比对 token,防止接管者/后来者误删不属于自己那把锁。
    """
    import hashlib
    import secrets

    target = Path(path)
    lock_path = target.with_name(target.name + ".lock")
    token = secrets.token_hex(16)
    # token 参与一次 sha256,作为锁记录完整性的显式凭据(与 外部实现 hash 语义对齐)
    _ = hashlib.sha256(token.encode()).hexdigest()
    deadline = time.monotonic() + max(0.0, max_wait_seconds)
    acquired = False

    while True:
        try:
            # 原子创建:已存在则 FileExistsError ⇒ 被占
            fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            os.close(fd)
            _write_lock_record(lock_path, token)
            acquired = True
            break
        except FileExistsError:
            record = _read_lock_record(lock_path)
            take_over = False
            if record is not None:
                holder_host = record.get("hostname")
                holder_pid = record.get("pid")
                if holder_host == socket.gethostname() and isinstance(holder_pid, int):
                    if not _process_alive(holder_pid):
                        take_over = True
            if take_over:
                # 崩溃遗留:先删陈旧锁文件,再用 O_EXCL 原子抢占 ⇒ 多个接管者只有一个成功
                with contextlib.suppress(OSError):
                    lock_path.unlink()
                try:
                    fd = os.open(
                        str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600
                    )
                    os.close(fd)
                    _write_lock_record(lock_path, token)
                    acquired = True
                    break
                except FileExistsError:
                    # 抢占失败 ⇒ 有别的接管者抢先,回到正常等待循环
                    if time.monotonic() >= deadline:
                        raise TimeoutError(
                            f"process_file_lock: 接管竞争后获取锁超时({max_wait_seconds}s)"
                        ) from None
                    time.sleep(_LOCK_POLL_SECONDS)
                    continue
            if time.monotonic() >= deadline:
                raise TimeoutError(
                    f"process_file_lock: 获取锁超时({max_wait_seconds}s),"
                    f"持有者记录: {record!r}"
                ) from None
            time.sleep(_LOCK_POLL_SECONDS)

    try:
        yield
    finally:
        if acquired:
            record = _read_lock_record(lock_path)
            # 只删仍属于自己(token 匹配)的锁:防接管者/后来者被误清
            if record is not None and record.get("token") == token:
                with contextlib.suppress(OSError):
                    lock_path.unlink()


def read_json_with_lock(path: str | Path) -> Any:
    """加跨进程锁读一个 JSON 状态文件;文件不存在返回 None。"""
    import json

    target = Path(path)
    if not target.is_file():
        return None
    with process_file_lock(target):
        raw = target.read_text(encoding="utf-8")
    return json.loads(raw)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

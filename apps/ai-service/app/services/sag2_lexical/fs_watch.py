# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""真文件系统监听（零依赖）。

对照程序 SAG Wiki 的 folder ingest 是「文件一变就能搜到」；本仓此前只有
**轮询**（默认 30s 一次，且默认关闭），语义是「最多晚 30 秒」，不是监听。
本模块用操作系统原生事件补上这一段：

- Windows：``ReadDirectoryChangesW``（``ctypes`` 直调 ``kernel32``，无第三方包）
- Linux：``inotify``（``ctypes`` 直调 ``libc``，无第三方包）
- 其它平台 / 调用失败：``start()`` 返回 ``"unavailable"``，由调用方**回退轮询**
  并把这一事实报给上层，绝不假装在监听。

设计取舍：
1. **只上报「变了」，不解释语义**。事件类型（新建/改名/删除）交给调用方的
   增量扫描用 mtime+size+sha256 重算 —— 事件只是「叫醒」，判据仍然只有一条
   真源（内容 hash）。两套判据必然漂移。
2. **合并抖动**：编辑器保存一次文件会产生多个事件（写临时文件 → 改名 → 改属性），
   ``debounce_ms`` 内的全部事件合并成一次回调，避免一次保存触发多次扫描。
3. **溢出即全量**：内核缓冲溢出（事件太多没来得及读）时 ``ReadDirectoryChangesW``
   返回 0 字节，此时按「整棵树都变了」处理，宁可多扫一次也不漏。

诚实边界：
- inotify 分支在本机（Windows 开发机）**无法实测**，代码就位但证据只在 Windows 侧；
  Linux 生产环境首次启用时须按 ``watch_mode`` 字段确认走的是 ``linux-inotify``。
- 网络盘 / SMB / 某些虚拟文件系统不上报事件，``start()`` 仍会返回成功但事件为零，
  这类目录请用轮询模式（``real=False``）。
"""

from __future__ import annotations

import ctypes
import logging
import os
import sys
import threading
import time
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)

# 上报口径：changed(paths) 里的 paths 是「发生了变化的路径」，空表示「整棵树都要看」。
ChangeCallback = Callable[[list[str]], None]

# Windows 常量（winnt.h）
_FILE_LIST_DIRECTORY = 0x0001
_FILE_SHARE_READ = 0x00000001
_FILE_SHARE_WRITE = 0x00000002
_FILE_SHARE_DELETE = 0x00000004
_OPEN_EXISTING = 3
_FILE_FLAG_BACKUP_SEMANTICS = 0x02000000
_NOTIFY_FILTER = 0x0001 | 0x0002 | 0x0008 | 0x0010  # 文件名 | 目录名 | 大小 | 最后写
_INVALID_HANDLE_VALUE = ctypes.c_void_p(-1).value
_ERROR_OPERATION_ABORTED = 995
_ERROR_NOTIFY_ENUM_DIR = 1022

# Linux inotify 常量（sys/inotify.h）
_IN_MODIFY = 0x00000002
_IN_ATTRIB = 0x00000004
_IN_CLOSE_WRITE = 0x00000008
_IN_MOVED_FROM = 0x00000040
_IN_MOVED_TO = 0x00000080
_IN_CREATE = 0x00000100
_IN_DELETE = 0x00000200
_IN_DELETE_SELF = 0x00000400
_IN_MOVE_SELF = 0x00000800
_IN_Q_OVERFLOW = 0x00004000
_IN_WATCH_MASK = (
    _IN_MODIFY
    | _IN_ATTRIB
    | _IN_CLOSE_WRITE
    | _IN_MOVED_FROM
    | _IN_MOVED_TO
    | _IN_CREATE
    | _IN_DELETE
    | _IN_DELETE_SELF
    | _IN_MOVE_SELF
)


class DirWatcher:
    """目录监听器：``start()`` 返回实际生效的模式，``stop()`` 可重复调用。"""

    def __init__(
        self,
        root: str,
        on_change: ChangeCallback,
        *,
        debounce_ms: int = 600,
        recursive: bool = True,
    ) -> None:
        self.root = os.path.abspath(root)
        self.on_change = on_change
        self.debounce_s = max(0.0, debounce_ms / 1000.0)
        self.recursive = recursive
        self._thread: threading.Thread | None = None
        self._flusher: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._pending: set[str] = set()
        self._dirty = False
        self._wake = threading.Event()
        self._mode = "unavailable"
        self._handle: int | None = None
        self._fd: int | None = None

    # -- 公共 API ----------------------------------------------------------

    @property
    def mode(self) -> str:
        return self._mode

    def start(self) -> str:
        """启动监听。返回 ``win32-rdc`` / ``linux-inotify`` / ``unavailable``。"""
        if not os.path.isdir(self.root):
            self._mode = "unavailable"
            return self._mode
        if sys.platform.startswith("win"):
            self._mode = self._start_win32()
        elif sys.platform.startswith("linux"):
            self._mode = self._start_inotify()
        else:
            self._mode = "unavailable"
        if self._mode == "unavailable":
            return self._mode

        self._stop.clear()
        target = self._loop_win32 if self._mode == "win32-rdc" else self._loop_inotify
        self._thread = threading.Thread(target=target, name="sag2-fswatch", daemon=True)
        self._flusher = threading.Thread(target=self._flush_loop, name="sag2-fswatch-flush", daemon=True)
        self._flusher.start()
        self._thread.start()
        return self._mode

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()
        if self._handle is not None:
            try:
                # ctypes 仅在 Windows 上暴露 windll；用 getattr 取值以便 mypy 在
                # Linux 上也能通过（非 Windows 上此分支不会命中，取到 None 时
                # 下面的属性访问会抛 AttributeError 并被下面的 except 吞掉）。
                windll: Any = getattr(ctypes, "windll", None)
                windll.kernel32.CancelIoEx(
                    ctypes.c_void_p(self._handle), None
                )
            except Exception:  # noqa: BLE001 - 关闭路径不许抛
                logger.debug("CancelIoEx 失败（忽略）", exc_info=True)
        if self._fd is not None:
            try:
                os.close(self._fd)
            except OSError:  # pragma: no cover - 已关闭
                pass
            self._fd = None
        for thread in (self._thread, self._flusher):
            if thread is not None and thread.is_alive():
                thread.join(timeout=2.0)
        self._thread = None
        self._flusher = None
        self._close_handle()

    # -- 平台启动 ----------------------------------------------------------

    def _start_win32(self) -> str:
        try:
            windll: Any = getattr(ctypes, "windll", None)
            kernel32 = windll.kernel32
            handle = kernel32.CreateFileW(
                ctypes.c_wchar_p(self.root),
                _FILE_LIST_DIRECTORY,
                _FILE_SHARE_READ | _FILE_SHARE_WRITE | _FILE_SHARE_DELETE,
                None,
                _OPEN_EXISTING,
                _FILE_FLAG_BACKUP_SEMANTICS,
                None,
            )
            if handle is None or handle == _INVALID_HANDLE_VALUE:
                logger.warning("CreateFileW 打开目录失败: %s", self.root)
                return "unavailable"
            self._handle = int(handle)
            return "win32-rdc"
        except Exception:  # noqa: BLE001 - 拿不到 API 就走轮询
            logger.warning("ReadDirectoryChangesW 不可用", exc_info=True)
            return "unavailable"

    def _start_inotify(self) -> str:
        try:
            libc = ctypes.CDLL("libc.so.6", use_errno=True)
            fd = libc.inotify_init1(int(getattr(os, "O_NONBLOCK", 0)))
            if fd < 0:
                return "unavailable"
            mask = _IN_WATCH_MASK
            wd = libc.inotify_add_watch(fd, self.root.encode(), mask)
            if wd < 0:
                os.close(fd)
                return "unavailable"
            self._fd = fd
            return "linux-inotify"
        except Exception:  # noqa: BLE001 - 容器里常禁 inotify
            logger.warning("inotify 不可用", exc_info=True)
            return "unavailable"

    # -- 事件循环 ----------------------------------------------------------

    def _loop_win32(self) -> None:
        # 只有 _start_win32 成功（Windows）才会进到这里，windll 必然存在。
        windll: Any = getattr(ctypes, "windll", None)
        kernel32 = windll.kernel32
        buf = ctypes.create_string_buffer(64 * 1024)
        returned = ctypes.c_ulong(0)
        while not self._stop.is_set():
            ok = kernel32.ReadDirectoryChangesW(
                ctypes.c_void_p(self._handle),
                buf,
                len(buf),
                bool(self.recursive),
                _NOTIFY_FILTER,
                ctypes.byref(returned),
                None,
                None,
            )
            if self._stop.is_set():
                break
            if not ok:
                err = int(kernel32.GetLastError())
                if err == _ERROR_OPERATION_ABORTED:
                    # stop() 用 CancelIoEx 打断阻塞读，正常退出路径。
                    break
                if err == _ERROR_NOTIFY_ENUM_DIR:
                    # 内核说「变化太多，自己去重扫」。
                    self._mark_all()
                    continue
                logger.info("ReadDirectoryChangesW 退出: err=%s", err)
                break
            size = int(returned.value)
            if size == 0:
                self._mark_all()
                continue
            for relative in _parse_notify(buf.raw[:size]):
                self._mark(os.path.join(self.root, relative))

    def _loop_inotify(self) -> None:
        while not self._stop.is_set():
            try:
                data = os.read(self._fd, 64 * 1024)  # type: ignore[arg-type]
            except BlockingIOError:
                time.sleep(0.05)
                continue
            except OSError:  # pragma: no cover - fd 被关
                break
            offset = 0
            while offset + 16 <= len(data):
                _wd, mask, _cookie, length = (
                    int.from_bytes(data[offset : offset + 4], "little", signed=True),
                    int.from_bytes(data[offset + 4 : offset + 8], "little"),
                    int.from_bytes(data[offset + 8 : offset + 12], "little"),
                    int.from_bytes(data[offset + 12 : offset + 16], "little"),
                )
                name = data[offset + 16 : offset + 16 + length].rstrip(b"\x00").decode(
                    "utf-8", "replace"
                )
                offset += 16 + length
                if mask & _IN_Q_OVERFLOW:
                    self._mark_all()
                    continue
                if name:
                    self._mark(os.path.join(self.root, name))

    # -- 抖动合并 ----------------------------------------------------------

    def _mark(self, path: str) -> None:
        with self._lock:
            self._pending.add(path)
        self._wake.set()

    def _mark_all(self) -> None:
        with self._lock:
            self._dirty = True
        self._wake.set()

    def _flush_loop(self) -> None:
        while not self._stop.is_set():
            if not self._wake.wait(timeout=0.2):
                continue
            self._wake.clear()
            if self._stop.is_set():
                break
            # 抖动窗口：事件停下来 debounce 之后才回调一次。
            if self.debounce_s:
                time.sleep(self.debounce_s)
            with self._lock:
                paths = sorted(self._pending)
                self._pending.clear()
                dirty = self._dirty
                self._dirty = False
            if not paths and not dirty:
                continue
            try:
                self.on_change([] if dirty else paths)
            except Exception:  # noqa: BLE001 - 回调抛错不许打死监听
                logger.exception("监听回调抛错（已吞，监听继续）")

    def _close_handle(self) -> None:
        if self._handle is None:
            return
        try:
            windll: Any = getattr(ctypes, "windll", None)
            windll.kernel32.CloseHandle(ctypes.c_void_p(self._handle))
        except Exception:  # noqa: BLE001 - 关闭路径不许抛
            logger.debug("CloseHandle 失败（忽略）", exc_info=True)
        self._handle = None


def _parse_notify(raw: bytes) -> list[str]:
    """解析 ``FILE_NOTIFY_INFORMATION`` 链表，返回相对路径列表。

    结构：``DWORD NextEntryOffset; DWORD Action; DWORD FileNameLength; WCHAR FileName[1]``。
    偏移 8 处的长度是**字节数**（非字符数），文件名不是 NUL 结尾。
    """
    names: list[str] = []
    offset = 0
    while offset + 12 <= len(raw):
        next_offset = int.from_bytes(raw[offset : offset + 4], "little")
        name_len = int.from_bytes(raw[offset + 8 : offset + 12], "little")
        start = offset + 12
        chunk = raw[start : start + name_len]
        if chunk:
            names.append(chunk.decode("utf-16-le", "replace").replace("\\", os.sep))
        if next_offset == 0:
            break
        offset += next_offset
    return names
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

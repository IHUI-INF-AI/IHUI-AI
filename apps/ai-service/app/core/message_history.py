# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""全局消息历史(2026-09-19 第二十三批,对标 Codex message-history crate)。

语义忠实移植:
- 全局追加式历史文件(~/.ihui/history.jsonl),一行一条 JSON:
  {"session_id": "...", "ts": <unix_seconds>, "text": "..."}
- 多进程防交错写入:进程内 threading.Lock + 跨进程文件锁
  (Windows msvcrt.locking / POSIX fcntl.flock),锁在整批写入期间持有
- append_batch:多条记录一次加锁批量落盘(对标 codex batch.rs,摊薄锁开销)
- 读取按行流式迭代,损坏行跳过不抛错(容错降级,尾部读支持 cursor)

取舍:codex 用 fs2 文件锁抽象;我方直接用标准库双平台原语,语义一致。
"""

from __future__ import annotations

import contextlib
import json
import os
import threading
import time
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Any

_LOCAL_LOCK = threading.Lock()

DEFAULT_HISTORY_DIR = Path(
    os.environ.get("IHUI_HOME") or Path.home() / ".ihui"
)
DEFAULT_HISTORY_PATH = DEFAULT_HISTORY_DIR / "history.jsonl"


def _lock_fileregion(fd: Any, length: int) -> None:
    if os.name == "nt":
        import msvcrt

        msvcrt.locking(fd.fileno(), msvcrt.LK_LOCK, max(1, length))
    else:
        fcntl: Any = _load_fcntl()
        fcntl.flock(fd.fileno(), fcntl.LOCK_EX)


def _unlock_fileregion(fd: Any, length: int) -> None:
    if os.name == "nt":
        import msvcrt

        with_state = fd.seek(0)
        assert with_state == 0
        msvcrt.locking(fd.fileno(), msvcrt.LK_UNLCK, max(1, length))
    else:
        fcntl: Any = _load_fcntl()
        fcntl.flock(fd.fileno(), fcntl.LOCK_UN)


def _load_fcntl() -> Any:
    import fcntl  # type: ignore[import-not-found,unused-ignore]

    return fcntl


class _CrossProcessLock:
    """专用锁文件 sidecar 上的字节 0 区间锁(跨平台,固定偏移无歧义)。

    Windows 用 msvcrt.locking 非阻塞重试(5ms 间隔,上限约 5s);POSIX 用
    fcntl.flock 阻塞语义。锁失败降级为直接放行(单机串行场景仍安全)。
    """

    def __init__(self, path: Path, timeout: float = 5.0) -> None:
        self._path = path.with_suffix(path.suffix + ".lock")
        self._timeout = timeout
        self._fd: Any = None

    def __enter__(self) -> "_CrossProcessLock":
        try:
            self._fd = open(self._path, "a+b")
            if os.name == "nt":
                import msvcrt

                deadline = time.monotonic() + self._timeout
                while True:
                    try:
                        self._fd.seek(0)
                        msvcrt.locking(self._fd.fileno(), msvcrt.LK_NBLCK, 1)
                        break
                    except OSError:
                        if time.monotonic() >= deadline:
                            break  # 降级放行
                        time.sleep(0.005)
            else:
                fcntl: Any = _load_fcntl()
                fcntl.flock(self._fd.fileno(), fcntl.LOCK_EX)
        except OSError:
            self._fd = None  # 锁不可用:降级放行
        return self

    def __exit__(self, *exc: object) -> None:
        if self._fd is None:
            return
        try:
            if os.name == "nt":
                import msvcrt

                self._fd.seek(0)
                with contextlib.suppress(OSError):
                    msvcrt.locking(self._fd.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl: Any = _load_fcntl()
                fcntl.flock(self._fd.fileno(), fcntl.LOCK_UN)
        finally:
            self._fd.close()
            self._fd = None


def append_history(
    path: Path,
    session_id: str,
    text: str,
    ts: float | None = None,
) -> dict[str, Any]:
    """追加单条历史(多进程安全)。"""
    return append_batch(path, [(session_id, text, ts)])[0]


def append_batch(
    path: Path,
    entries: Iterable[tuple[str, str, float | None]],
) -> list[dict[str, Any]]:
    """批量追加:一次加锁写多条(对标 codex append_batch 语义)。"""
    records: list[dict[str, Any]] = []
    for session_id, text, ts in entries:
        records.append(
            {
                "session_id": str(session_id),
                "ts": float(time.time() if ts is None else ts),
                "text": str(text),
            }
        )
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = "".join(
        json.dumps(r, ensure_ascii=False) + "\n" for r in records
    ).encode("utf-8")

    with _LOCAL_LOCK:
        with _CrossProcessLock(path):
            with open(path, "ab") as fd:
                fd.write(payload)
                fd.flush()
                os.fsync(fd.fileno())
    return records


def iter_history(path: Path, *, skip_corrupt: bool = True) -> Iterator[dict[str, Any]]:
    """全量流式读取;损坏行默认跳过(容错降级)。"""
    path = Path(path)
    if not path.exists():
        return
    with open(path, "r", encoding="utf-8", errors="replace") as fd:
        for line in fd:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                if skip_corrupt:
                    continue
                raise
            if isinstance(record, dict):
                yield record


def read_recent(path: Path, limit: int = 50) -> list[dict[str, Any]]:
    """读取最近 N 条(新→旧),供 recall 类 UX 使用。"""
    records = list(iter_history(path))
    return list(reversed(records[-limit:])) if limit > 0 else []


def purge_history(path: Path) -> bool:
    """清空历史文件(对标 codex history purge);文件不存在返回 False。"""
    path = Path(path)
    if not path.exists():
        return False
    with _LOCAL_LOCK:
        with _CrossProcessLock(path):
            with open(path, "r+b") as fd:
                fd.truncate(0)
                fd.flush()
                os.fsync(fd.fileno())
    return True

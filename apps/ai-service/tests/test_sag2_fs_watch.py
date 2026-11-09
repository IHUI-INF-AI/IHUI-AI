# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 真文件监听（fs_watch）真测试。

判据只认「真的发生了文件系统事件并真的回调了」：
Windows 侧直接对 ``tmp_path`` 建/改文件，等 ``ReadDirectoryChangesW`` 上报；
本机是 Windows 开发机，inotify 分支无法在此实测，故 Linux 用例按
``start()`` 的实际返回来 skip，不伪造通过。
"""

from __future__ import annotations

import os
import sys
import threading
import time

import pytest

from app.services.sag2_lexical.fs_watch import DirWatcher, _parse_notify

WINDOWS = sys.platform.startswith("win")


class Collector:
    """线程安全的事件收集器。"""

    def __init__(self) -> None:
        self.batches: list[list[str]] = []
        self._lock = threading.Lock()
        self._event = threading.Event()

    def __call__(self, paths: list[str]) -> None:
        with self._lock:
            self.batches.append(list(paths))
        self._event.set()

    def wait(self, timeout: float = 8.0) -> bool:
        return self._event.wait(timeout)

    def flat(self) -> list[str]:
        with self._lock:
            return [p for batch in self.batches for p in batch]

    def count(self) -> int:
        with self._lock:
            return len(self.batches)


def test_parse_notify_单条与链表都按字节长度切名() -> None:
    def entry(name: str, next_offset: int) -> bytes:
        encoded = name.encode("utf-16-le")
        return (
            next_offset.to_bytes(4, "little")
            + (1).to_bytes(4, "little")
            + len(encoded).to_bytes(4, "little")
            + encoded
        )

    single = entry("a.txt", 0)
    assert _parse_notify(single) == ["a.txt"]

    first = entry("dir", len(entry("dir", 0)))
    chained = first + entry(r"dir\b.md", 0)
    assert _parse_notify(chained) == ["dir", os.path.join("dir", "b.md")]


def test_不存在的目录直接报_unavailable(tmp_path) -> None:
    watcher = DirWatcher(str(tmp_path / "nope"), lambda _paths: None)
    assert watcher.start() == "unavailable"
    watcher.stop()  # 幂等，且未启动时也不许抛


@pytest.mark.skipif(not WINDOWS, reason="ReadDirectoryChangesW 仅在 Windows 实测")
def test_真监听_新建文件在抖动窗口后回调该路径(tmp_path) -> None:
    sink = Collector()
    watcher = DirWatcher(str(tmp_path), sink, debounce_ms=120)
    mode = watcher.start()
    try:
        assert mode == "win32-rdc"
        target = tmp_path / "真监听.md"
        target.write_text("第一条知识", encoding="utf-8")
        assert sink.wait(8.0), "8 秒内没有收到任何文件系统事件"
        flat = [os.path.basename(p) for p in sink.flat()]
        assert "真监听.md" in flat, flat
    finally:
        watcher.stop()


@pytest.mark.skipif(not WINDOWS, reason="ReadDirectoryChangesW 仅在 Windows 实测")
def test_抖动合并_一次保存的多个事件只回调一次(tmp_path) -> None:
    sink = Collector()
    watcher = DirWatcher(str(tmp_path), sink, debounce_ms=400)
    try:
        assert watcher.start() == "win32-rdc"
        target = tmp_path / "抖.md"
        target.write_text("a", encoding="utf-8")
        time.sleep(0.25)  # 落在同一个抖动窗口内
        target.write_text("ab", encoding="utf-8")
        assert sink.wait(8.0)
        time.sleep(1.2)  # 给第二个窗口留出时间，确认没有重复回调
        assert sink.count() == 1, sink.batches
    finally:
        watcher.stop()


@pytest.mark.skipif(not WINDOWS, reason="ReadDirectoryChangesW 仅在 Windows 实测")
def test_stop_之后不再回调且可重复调用(tmp_path) -> None:
    sink = Collector()
    watcher = DirWatcher(str(tmp_path), sink, debounce_ms=80)
    assert watcher.start() == "win32-rdc"
    watcher.stop()
    watcher.stop()  # 幂等
    before = sink.count()
    (tmp_path / "停止后.md").write_text("x", encoding="utf-8")
    time.sleep(1.0)
    assert sink.count() == before
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

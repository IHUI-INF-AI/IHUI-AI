# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 真实文件监听 → 增量入索引 的端到端真测试。

这条链路是本轮「监听」能力的唯一判据：
**真的写一个文件到磁盘 → 操作系统真的发事件 → 真的触发增量扫描 → 索引里真的多一条**。
不 mock 事件、不手动调 scan。

Windows 上走 ``ReadDirectoryChangesW``（本机实测）；其它平台本机无法实测，
按 ``start()`` 的真实返回 skip，不伪造通过。
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

from app.services.sag2_lexical import LexicalIndex, Sag2LexicalService
from app.services.sag2_lexical import folder_ingest as fi

WINDOWS = sys.platform.startswith("win")


def _service() -> Sag2LexicalService:
    return Sag2LexicalService(index=LexicalIndex())


async def _wait_documents(service: Sag2LexicalService, want: int, timeout_s: float = 12.0) -> int:
    deadline = asyncio.get_running_loop().time() + timeout_s
    while asyncio.get_running_loop().time() < deadline:
        count = int(service.status()["documents"])
        if count >= want:
            return count
        await asyncio.sleep(0.1)
    return int(service.status()["documents"])


@pytest.mark.skipif(not WINDOWS, reason="ReadDirectoryChangesW 仅在 Windows 实测")
async def test_真监听_新建文件自动进索引(tmp_path: Path) -> None:
    service = _service()
    folders = fi.FolderIngest(service)
    folders.register(str(tmp_path))
    folders.scan()
    assert service.status()["documents"] == 0

    started = folders.start_watch(str(tmp_path), real=True, debounce_ms=100)
    assert started["watching"] is True
    assert started["mode"] == "win32-rdc", started
    try:
        (tmp_path / "刚落地的知识.md").write_text("预算审批要走两级", encoding="utf-8")
        count = await _wait_documents(service, 1)
        assert count == 1
        # 内容真的进了索引，不只是文件计数变了。
        hit = service.search("预算审批", limit=5)
        assert hit["items"], hit
    finally:
        folders.stop_watch(str(tmp_path))


@pytest.mark.skipif(not WINDOWS, reason="ReadDirectoryChangesW 仅在 Windows 实测")
async def test_真监听_改内容后引用是新的(tmp_path: Path) -> None:
    service = _service()
    target = tmp_path / "改我.md"
    target.write_text("旧内容：报销上限 500", encoding="utf-8")
    folders = fi.FolderIngest(service)
    folders.register(str(tmp_path))
    folders.scan()
    assert service.status()["documents"] == 1
    old_hash = service.search("报销", limit=1)["items"][0]["citation"]["doc_hash"]

    folders.start_watch(str(tmp_path), real=True, debounce_ms=100)
    try:
        target.write_text("新内容：报销上限 2000", encoding="utf-8")
        deadline = asyncio.get_running_loop().time() + 12.0
        new_hash = old_hash
        while asyncio.get_running_loop().time() < deadline:
            items = service.search("报销", limit=1)["items"]
            if items and items[0]["citation"]["doc_hash"] != old_hash:
                new_hash = items[0]["citation"]["doc_hash"]
                break
            await asyncio.sleep(0.1)
        assert new_hash != old_hash, "改了内容但索引里的 doc_hash 没变"
        assert "2000" in str(service.search("报销", limit=1)["items"][0]["snippet"])
    finally:
        folders.stop_watch(str(tmp_path))


async def test_轮询兜底_模式如实上报且不谎称监听(tmp_path: Path) -> None:
    service = _service()
    folders = fi.FolderIngest(service)
    folders.register(str(tmp_path))

    started = folders.start_watch(str(tmp_path), real=False, interval_s=5.0)
    assert started["mode"] == "polling"
    assert "退化为轮询" in str(started.get("reason", ""))
    listed = folders.list_folders()
    assert listed["watch_modes"] == {str(tmp_path.resolve()): "polling"}
    folders.stop_watch(str(tmp_path))
    assert folders.list_folders()["watching"] == []


async def test_未登记目录开监听被拒(tmp_path: Path) -> None:
    folders = fi.FolderIngest(_service())
    result = folders.start_watch(str(tmp_path), real=True)
    assert result["watching"] is False
    assert "未登记" in str(result["reason"])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""上传体:先分块读到上限即断,而不是整包读进内存再判长度(2026-11-01 安全强化,高危)。

原缺陷:四个上传端点都是 `await file.read()` 之后才判 `len()`,其中
`/api/image/edits` 连上限都没有 ⇒ 单个请求可把 worker 内存打到 GB 级。

本文件钉:分块读取本体(边读边断)+ 四个端点**都改用**这份实现(形状锁,
防"改了实现没接线")。
"""

from __future__ import annotations

import inspect
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.routers import image_edit, media_tasks, publish, session_import
from app.utils.upload_read import read_capped


class _ChunkedUpload:
    """按 UploadFile 形状分块产出,并记录读了几次(测的是"边读边断")。"""

    def __init__(self, total: int, chunk: int = 1024 * 1024) -> None:
        self._remaining = total
        self._chunk = chunk
        self.read_calls = 0
        # 真正被交给调用方的字节数 —— "读完再判"会把这个值推到整个体量。
        self.consumed = 0

    async def read(self, size: int = -1) -> bytes:
        self.read_calls += 1
        if self._remaining <= 0:
            return b""
        take = min(self._chunk, size if size and size > 0 else self._chunk, self._remaining)
        self._remaining -= take
        self.consumed += take
        return b"a" * take


async def test_passes_under_limit() -> None:
    data = await read_capped(_ChunkedUpload(3 * 1024 * 1024), 10 * 1024 * 1024)
    assert data is not None and len(data) == 3 * 1024 * 1024


async def test_stops_as_soon_as_limit_is_exceeded() -> None:
    """2GB 的体只该读到上限附近 —— 摘掉分块读取(改回 read())这条立刻变红。

    判据刻意是"**被取走的字节数**",不是"read 调用次数":先 `read()` 再判长度的写法
    只调用一次 read,用调用次数根本区分不出来(实测变异:改回整包读,次数=1)。
    """
    limit = 4 * 1024 * 1024
    upload = _ChunkedUpload(2048 * 1024 * 1024)
    assert await read_capped(upload, limit) is None
    assert upload.consumed <= limit + 1024 * 1024, (
        f"取走了 {upload.consumed} 字节 —— 上限没有约束住峰值占用"
    )


async def test_exact_limit_is_allowed() -> None:
    limit = 2 * 1024 * 1024
    data = await read_capped(_ChunkedUpload(limit), limit)
    assert data is not None and len(data) == limit


# ---------------------------------------------------------------------------
# 端点接线(形状锁 + 一条行为断言)
# ---------------------------------------------------------------------------


def test_image_edit_uses_capped_reader_and_has_a_limit() -> None:
    src = Path(image_edit.__file__).read_text(encoding="utf-8")
    assert "read_capped" in src
    assert "image_bytes = await image.read()" not in src
    assert "MAX_IMAGE_EDIT_UPLOAD_BYTES" in src


def test_publish_and_session_import_and_media_tasks_use_capped_reader() -> None:
    for module in (publish, session_import, media_tasks):
        src = inspect.getsource(module)
        assert "read_capped" in src, f"{module.__name__} 仍是无上限 read"


class _Cfg:
    api_key = "test-key"
    api_base = "http://127.0.0.1:1"


async def test_image_edit_rejects_oversize_before_calling_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """超限在调用上游之前就被拦下(413),不会把整包读进内存再上传。"""
    monkeypatch.setattr(
        type(settings), "get_provider_config", lambda _self, *_a, **_kw: _Cfg()
    )

    class _Boom:
        def __init__(self, **_kw: object) -> None:
            pass

        async def images_edits(self, *_a: object, **_kw: object) -> dict:
            raise AssertionError("超限请求不得抵达 provider")

    import app.providers.token6688_provider as provider_mod

    monkeypatch.setattr(provider_mod, "Token6688Provider", _Boom)

    oversize = _ChunkedUpload(image_edit.MAX_IMAGE_EDIT_UPLOAD_BYTES + 2 * 1024 * 1024)
    with pytest.raises(HTTPException) as exc:
        await image_edit.image_edits(
            image=oversize,
            prompt="make it blue",
            mask=None,
            model=None,
            n=1,
            size=None,
            aspect_ratio=None,
            quality=None,
            output_format=None,
        )
    assert exc.value.status_code == 413

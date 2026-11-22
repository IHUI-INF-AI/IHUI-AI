# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""流式文档帧转发 iter_render_frames 的边界钉住(对齐 frame-forwarding)。

超越全量 render 的三个轴,每个都有测试钉住:
  ① 首帧早返回 —— 第一页渲染完即产出,不必等整份;
  ② 超预算保留已产出帧(partial)—— 全量 render 触顶会丢弃整批,流式保留已产出;
  ③ stop_after / 取消 —— 可提前收尾,已产出帧仍有效。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from PIL import Image

from app.tools import office_convert


class _FakePage:
    """伪造 pypdfium2 页:渲染出一幅真实 PNG,并记录 render 是否被调用过。"""

    def __init__(self, calls: list[int], w: int = 64, h: int = 48) -> None:
        self._calls = calls
        self._w = w
        self._h = h

    def get_size(self) -> tuple[float, float]:
        return float(self._w), float(self._h)

    def render(self, *, scale: float = 1.0) -> Any:
        """返回伪造位图对象(带 to_pil),与 pypdfium2 真实形状一致。"""
        self._calls.append(1)
        return _FakeBitmap(self._w, self._h)

    def close(self) -> None:
        pass


class _FakeBitmap:
    def __init__(self, w: int, h: int) -> None:
        self._w = w
        self._h = h

    def to_pil(self) -> Image.Image:
        return Image.new("RGB", (self._w, self._h), (10, 20, 30))

    def close(self) -> None:
        pass


class _FakeDoc:
    def __init__(self, pages: list[_FakePage]) -> None:
        self._pages = pages

    def __len__(self) -> int:
        return len(self._pages)

    def __getitem__(self, index: int) -> _FakePage:
        return self._pages[index]

    def close(self) -> None:
        pass


@pytest.fixture()
def enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MCP_OFFICE_TOOLS_ENABLED", "true")
    monkeypatch.setattr(office_convert, "find_soffice", lambda: ("/usr/bin/soffice", ""))


def _patch_pdf(monkeypatch: pytest.MonkeyPatch, n_pages: int, calls: list[int]) -> None:
    import sys
    import types

    fake_mod = types.ModuleType("pypdfium2")
    fake_mod.PdfDocument = lambda path: _FakeDoc([_FakePage(calls) for _ in range(n_pages)])  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "pypdfium2", fake_mod)


def _pdf_source(tmp_path: Path) -> Path:
    path = tmp_path / "doc.pdf"
    path.write_bytes(b"%PDF-1.4 fake")
    return path


def test_disabled_by_default_streams_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("MCP_OFFICE_TOOLS_ENABLED", raising=False)
    frames = list(office_convert.iter_render_frames(str(_pdf_source(tmp_path))))
    assert len(frames) == 1
    assert frames[0]["ok"] is False
    assert frames[0]["errorCode"] == "OFFICE_TOOLS_DISABLED"


def test_first_frame_yields_before_document_close(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, enabled: None
) -> None:
    """① 首帧早返回:第一页 yield 时文档尚未 close,且页 render 已发生。"""
    calls: list[int] = []
    _patch_pdf(monkeypatch, 5, calls)
    gen = office_convert.iter_render_frames(str(_pdf_source(tmp_path)))
    first = next(gen)
    assert first["seq"] == 0 and first["page"] == 1
    assert Path(first["path"]).is_file()
    assert Path(first["path"]).read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(calls) == 1  # 只渲染了第一页 —— 惰性推进
    gen.close()


def test_budget_preserves_emitted_frames_partial(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, enabled: None
) -> None:
    """② 超预算保留已产出帧:给一个只够 ~2 帧的预算,先前产出的帧必须保留。"""
    calls: list[int] = []
    _patch_pdf(monkeypatch, 20, calls)
    # 每帧 PNG 约 200-400B;给 1000B 预算 ⇒ 产出若干帧后 partial 收尾
    frames = list(
        office_convert.iter_render_frames(
            str(_pdf_source(tmp_path)), max_total_bytes=1000
        )
    )
    done = frames[-1]
    body = [f for f in frames[:-1] if "path" in f]
    assert done["done"] is True
    assert done["partial"] is True
    assert done["stopReason"] == "budget"
    assert done["frameCount"] == len(body) >= 1
    # 已产出的帧文件真实存在且非空
    for f in body:
        p = Path(f["path"])
        assert p.is_file() and p.stat().st_size > 0


def test_stop_after_early_finish(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, enabled: None
) -> None:
    """③ stop_after 提前收尾:只渲染 stop_after 帧,已完成帧保留。"""
    calls: list[int] = []
    _patch_pdf(monkeypatch, 10, calls)
    frames = list(
        office_convert.iter_render_frames(str(_pdf_source(tmp_path)), stop_after=3)
    )
    done = frames[-1]
    body = [f for f in frames[:-1] if "path" in f]
    assert done["done"] is True
    assert done["stopReason"] == "stop_after"
    assert done["partial"] is False
    assert done["frameCount"] == 3 == len(body)
    assert len(calls) == 3  # 只渲染了 3 页


def test_close_cancels_without_exhausting(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, enabled: None
) -> None:
    """取消:取到第一帧后 close,不再渲染后续页。"""
    calls: list[int] = []
    _patch_pdf(monkeypatch, 10, calls)
    gen = office_convert.iter_render_frames(str(_pdf_source(tmp_path)))
    next(gen)
    gen.close()
    assert len(calls) == 1


def test_invalid_pages_streams_structured_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, enabled: None
) -> None:
    calls: list[int] = []
    _patch_pdf(monkeypatch, 3, calls)
    frames = list(
        office_convert.iter_render_frames(str(_pdf_source(tmp_path)), pages="99")
    )
    assert frames[-1]["ok"] is False
    assert frames[-1]["errorCode"] == "INVALID_REQUEST"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

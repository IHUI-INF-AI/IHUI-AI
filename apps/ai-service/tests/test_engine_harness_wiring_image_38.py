# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# view_image × image_preparation 提示图像预算接线测试 — 第三十八批
# (对标 Codex load_data_url_for_prompt 在 view_image 落地通道的强制点)
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import base64
import io

import pytest

from test_engine_harness_fifth import _engine, _rpc, _find_builtin  # 复用第五批助手


def _png_bytes(width: int, height: int) -> bytes:
    """生成指定尺寸的测试 PNG(纯色图,Lanczos 降采样安全)。"""
    from PIL import Image

    img = Image.new("RGB", (width, height), (30, 120, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _bmp_bytes(width: int, height: int) -> bytes:
    from PIL import Image

    img = Image.new("RGB", (width, height), (200, 30, 60))
    buf = io.BytesIO()
    img.save(buf, format="BMP")
    return buf.getvalue()


def _data_url_size(data_url: str) -> tuple[int, int]:
    """解码 dataUrl 返回 (width, height)。"""
    from PIL import Image

    assert data_url.startswith("data:")
    b64 = data_url.split(",", 1)[1]
    from test_engine_harness_fifth import _engine as _e  # noqa: F401 (保持导入一致性)

    raw = base64.b64decode(b64)
    img = Image.open(io.BytesIO(raw))
    return img.size


async def _view_image(tmp_path, name: str, payload: bytes):
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"workspace": str(tmp_path)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "view_image")
    (tmp_path / name).write_bytes(payload)
    return await tool.executor({"path": name})


@pytest.mark.asyncio
async def test_small_image_within_budget_unchanged(tmp_path):
    """预算内小图:行为与接线前完全一致(dataUrl 原样,无降采样标注)。"""
    result = await _view_image(tmp_path, "small.png", _png_bytes(64, 48))
    assert "error" not in result
    w, h = _data_url_size(result["dataUrl"])
    assert (w, h) == (64, 48)
    assert "降采样" not in result["note"]
    assert result["dataUrl"].startswith("data:image/png;base64,")


@pytest.mark.asyncio
async def test_large_image_downsampled_to_budget(tmp_path):
    """超大图:按 high 档预算(2048px/2500 patch)降采样并标注。"""
    result = await _view_image(tmp_path, "big.png", _png_bytes(4000, 3000))
    assert "error" not in result
    w, h = _data_url_size(result["dataUrl"])
    # 预算上限:最长边 ≤2048 且 32px patch 总量 ≤2500
    assert max(w, h) <= 2048
    assert -(-w // 32) * -(-h // 32) <= 2500
    assert (w, h) != (4000, 3000)
    assert "降采样" in result["note"]
    assert "4000x3000" in result["note"]


@pytest.mark.asyncio
async def test_bmp_resized_converts_to_png(tmp_path):
    """非保留格式的 BMP 被降采样时按 Codex 语义转为 PNG dataUrl。"""
    result = await _view_image(tmp_path, "pic.bmp", _bmp_bytes(2200, 1200))
    assert "error" not in result
    assert result["dataUrl"].startswith("data:image/png;base64,")
    w, h = _data_url_size(result["dataUrl"])
    assert max(w, h) <= 2048


@pytest.mark.asyncio
async def test_corrupt_image_falls_back_to_raw(tmp_path):
    """损坏图像字节:失败安全,回退原始 dataUrl 行为而非报错。"""
    fake = b"\x89PNG\r\n\x1a\n" + b"this is not really a png image" * 10
    result = await _view_image(tmp_path, "broken.png", fake)
    assert "error" not in result
    assert result["dataUrl"].startswith("data:image/png;base64,")
    assert base64.b64decode(result["dataUrl"].split(",", 1)[1]) == fake
    assert "降采样" not in result["note"]


@pytest.mark.asyncio
async def test_path_escape_still_rejected(tmp_path):
    """回归:越出工作区的路径仍被拒绝(接线不改变既有安全边界)。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"workspace": str(tmp_path)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "view_image")
    result = await tool.executor({"path": "../outside.png"})
    assert "error" in result


@pytest.mark.asyncio
async def test_unsupported_type_still_rejected(tmp_path):
    """回归:不支持的图片类型仍被拒绝。"""
    (tmp_path / "doc.svg").write_text("<svg/>", encoding="utf-8")
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"workspace": str(tmp_path)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "view_image")
    result = await tool.executor({"path": "doc.svg"})
    assert "error" in result and "不支持的图片类型" in result["error"]

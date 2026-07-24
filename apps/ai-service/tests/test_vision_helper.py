"""vision_helper.analyze_image 测试(2026-07-24 立,对标 Trae Work vision)。

覆盖:
- 本地文件路径(PNG)→ source=local_file
- data URI → source=data_uri
- URL → source=url(download_image mock)
- 文件不存在 → FILE_NOT_FOUND
- 文件 > 10MB → FILE_TOO_LARGE
- 不支持格式(.txt)→ UNSUPPORTED_FORMAT
- 下载失败 → DOWNLOAD_FAILED
- LLM 失败 → LLM_FAILED
- stub 模式 → stub=True
- 辅助函数 is_local_path / is_data_uri / is_url / encode_base64 / read_local_image mime 推断
"""
from __future__ import annotations

import base64
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services import vision_helper
from app.services.vision_helper import (
    analyze_image,
    encode_base64,
    is_data_uri,
    is_local_path,
    is_url,
    read_local_image,
)


def _make_png(path: Path, size_bytes: int = 200) -> None:
    png_sig = b"\x89PNG\r\n\x1a\n"
    path.write_bytes(png_sig + b"\x00" * max(0, size_bytes - len(png_sig)))


async def test_analyze_image_local_file(tmp_path):
    """本地 PNG → source=local_file,llm_gateway 收到 data URI 且 base64 可解码回原文件。"""
    img = tmp_path / "test.png"
    _make_png(img, 200)
    with patch("app.services.vision_helper.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value={"content": "a cat", "model": "gpt-4o", "stub": False})
        out = await analyze_image(str(img), prompt="describe")
    assert out["ok"] is True
    assert out["source"] == "local_file"
    assert out["analysis"] == "a cat"
    messages = gw_mock.complete.call_args.args[0]
    img_url = messages[0]["content"][1]["image_url"]["url"]
    assert img_url.startswith("data:image/png;base64,")
    assert base64.b64decode(img_url.split(",", 1)[1]) == img.read_bytes()


async def test_analyze_image_data_uri():
    """data URI → source=data_uri,直接透传给 LLM。"""
    data_uri = "data:image/png;base64,iVBORw0KGgo="
    with patch("app.services.vision_helper.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value={"content": "x", "model": "m"})
        out = await analyze_image(data_uri, prompt="t")
    assert out["ok"] is True
    assert out["source"] == "data_uri"
    img_url = gw_mock.complete.call_args.args[0][0]["content"][1]["image_url"]["url"]
    assert img_url == data_uri


async def test_analyze_image_url():
    """URL → source=url,通过 download_image 下载并转 data URI。"""
    fake_bytes = b"\x89PNG\r\n\x1a\nfake"
    with patch("app.services.vision_helper.download_image", new=AsyncMock(return_value=(fake_bytes, "image/png"))), \
         patch("app.services.vision_helper.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value={"content": "remote pic", "model": "m"})
        out = await analyze_image("https://example.com/a.png", prompt="t")
    assert out["ok"] is True
    assert out["source"] == "url"
    img_url = gw_mock.complete.call_args.args[0][0]["content"][1]["image_url"]["url"]
    assert img_url.startswith("data:image/png;base64,")
    assert base64.b64decode(img_url.split(",", 1)[1]) == fake_bytes


async def test_analyze_image_file_not_found(tmp_path):
    """本地文件不存在 → FILE_NOT_FOUND。"""
    missing = tmp_path / "nope.png"
    out = await analyze_image(str(missing), prompt="t")
    assert out["ok"] is False
    assert out["errorCode"] == "FILE_NOT_FOUND"


async def test_analyze_image_too_large(tmp_path):
    """文件 > 10MB → FILE_TOO_LARGE。"""
    img = tmp_path / "big.png"
    img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * (11 * 1024 * 1024))
    out = await analyze_image(str(img), prompt="t")
    assert out["ok"] is False
    assert out["errorCode"] == "FILE_TOO_LARGE"


async def test_analyze_image_unsupported_format(tmp_path):
    """不支持格式(.txt)→ UNSUPPORTED_FORMAT。"""
    img = tmp_path / "note.txt"
    img.write_bytes(b"hello")
    out = await analyze_image(str(img), prompt="t")
    assert out["ok"] is False
    assert out["errorCode"] == "UNSUPPORTED_FORMAT"


async def test_analyze_image_download_failed():
    """download_image 抛异常 → DOWNLOAD_FAILED。"""
    with patch("app.services.vision_helper.download_image", new=AsyncMock(side_effect=httpx_error())):
        out = await analyze_image("https://example.com/broken.png", prompt="t")
    assert out["ok"] is False
    assert out["errorCode"] == "DOWNLOAD_FAILED"


async def test_analyze_image_llm_failed(tmp_path):
    """LLM 返回 error → LLM_FAILED。"""
    img = tmp_path / "a.png"
    _make_png(img, 100)
    with patch("app.services.vision_helper.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value={
            "content": "", "model": "m", "error": True,
            "error_message": "rate limited", "errorCode": "LLM_ERROR",
        })
        out = await analyze_image(str(img), prompt="t")
    assert out["ok"] is False
    assert out["errorCode"] == "LLM_FAILED"
    assert "rate limited" in out["message"]


async def test_analyze_image_stub_mode(tmp_path):
    """LLM 返回 stub=True → result.stub 透传,ok=True。"""
    img = tmp_path / "a.png"
    _make_png(img, 100)
    with patch("app.services.vision_helper.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value={
            "content": "[stub] simulated", "model": "m", "stub": True,
        })
        out = await analyze_image(str(img), prompt="t")
    assert out["ok"] is True
    assert out["stub"] is True
    assert out["analysis"] == "[stub] simulated"


def test_helpers_source_detection():
    """辅助函数正确识别 3 种来源。"""
    assert is_data_uri("data:image/png;base64,xxx")
    assert not is_data_uri("https://e.com/a.png")
    assert is_url("https://e.com/a.png")
    assert is_url("http://e.com/a.png")
    assert not is_url("data:image/png;base64,xxx")
    assert is_local_path("/tmp/a.png")
    assert is_local_path("C:\\Users\\a.png")
    assert is_local_path("D:/pics/a.png")
    assert not is_local_path("https://e.com/a.png")
    assert not is_local_path("data:image/png;base64,xxx")
    assert not is_local_path("")


def test_encode_base64_and_read_local_mime(tmp_path):
    """encode_base64 返回 data URI;read_local_image 按后缀推断 MIME。"""
    png = tmp_path / "p.png"
    _make_png(png, 50)
    data, mime = read_local_image(str(png))
    assert mime == "image/png"
    uri = encode_base64(data, mime)
    assert uri.startswith("data:image/png;base64,")
    # jpg/jpeg mime 推断
    jpg = tmp_path / "photo.jpg"
    jpg.write_bytes(b"\xff\xd8\xff\xe0")
    assert read_local_image(str(jpg))[1] == "image/jpeg"
    jpeg = tmp_path / "p.jpeg"
    jpeg.write_bytes(b"\xff\xd8\xff\xe0")
    assert read_local_image(str(jpeg))[1] == "image/jpeg"


def httpx_error():
    """构造一个用于 download_image side_effect 的异常。"""
    import httpx
    return httpx.ConnectError("connection refused")

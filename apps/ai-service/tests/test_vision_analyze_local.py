"""vision_analyze 本地文件 image_path 支持测试(2026-07-24 立,对标 Trae Work vision)。

覆盖:
- image_path 有效 PNG → 转 base64 data URL,返回 source=local_file + file_path
- 文件不存在 → FILE_NOT_FOUND
- 文件 > 10MB → IMAGE_TOO_LARGE
- 不支持格式(.bmp) → UNSUPPORTED_IMAGE_FORMAT
- 路径不在工作区白名单 → PATH_NOT_IN_WORKSPACE
- 优先级 image_path > image_base64
- legacy image 参数向后兼容
- 无任何图片来源 → ok=False
"""
from __future__ import annotations

import base64
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services.mcp_server import _tool_vision_analyze


def _make_png(path: Path, size_bytes: int = 200) -> None:
    """创建一个最小 PNG 文件(PNG 签名 + 填充到指定大小)。"""
    png_sig = b"\x89PNG\r\n\x1a\n"
    path.write_bytes(png_sig + b"\x00" * max(0, size_bytes - len(png_sig)))


async def test_image_path_valid_png(tmp_path):
    """image_path 指向有效 PNG → 转 base64 data URL,返回 source=local_file + file_path。"""
    img = tmp_path / "test.png"
    _make_png(img, 200)
    fake_result = {"content": "a cat", "model": "gpt-4o", "stub": False}
    with patch("app.services.mcp_server._validate_path_in_workspace", return_value=(True, str(img))), \
         patch("app.core.llm_gateway.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value=fake_result)
        out = await _tool_vision_analyze({"image_path": str(img), "task": "describe"})

    assert out["ok"] is True
    assert out["source"] == "local_file"
    assert out["file_path"] == str(img)
    assert out["analysis"] == "a cat"
    # 验证传给 llm_gateway 的 image_url 是 data URL 且 base64 可解码回原文件
    messages = gw_mock.complete.call_args.args[0]
    img_url = messages[0]["content"][1]["image_url"]["url"]
    assert img_url.startswith("data:image/png;base64,")
    b64_part = img_url.split(",", 1)[1]
    assert base64.b64decode(b64_part) == img.read_bytes()


async def test_image_path_jpeg_mime(tmp_path):
    """image_path 后缀 .jpg → MIME 推断为 image/jpeg。"""
    img = tmp_path / "photo.jpg"
    img.write_bytes(b"\xff\xd8\xff\xe0")
    with patch("app.services.mcp_server._validate_path_in_workspace", return_value=(True, str(img))), \
         patch("app.core.llm_gateway.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value={"content": "x", "model": "m"})
        await _tool_vision_analyze({"image_path": str(img), "task": "t"})
    img_url = gw_mock.complete.call_args.args[0][0]["content"][1]["image_url"]["url"]
    assert img_url.startswith("data:image/jpeg;base64,")


async def test_image_path_file_not_found(tmp_path):
    """image_path 文件不存在 → FILE_NOT_FOUND。"""
    missing = tmp_path / "nope.png"
    with patch("app.services.mcp_server._validate_path_in_workspace", return_value=(True, str(missing))):
        out = await _tool_vision_analyze({"image_path": str(missing), "task": "describe"})
    assert out["ok"] is False
    assert out["errorCode"] == "FILE_NOT_FOUND"


async def test_image_path_too_large(tmp_path):
    """image_path 文件 > 10MB → IMAGE_TOO_LARGE。"""
    img = tmp_path / "big.png"
    img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * (11 * 1024 * 1024))
    with patch("app.services.mcp_server._validate_path_in_workspace", return_value=(True, str(img))):
        out = await _tool_vision_analyze({"image_path": str(img), "task": "describe"})
    assert out["ok"] is False
    assert out["errorCode"] == "IMAGE_TOO_LARGE"


async def test_image_path_unsupported_format(tmp_path):
    """image_path 后缀 .bmp → UNSUPPORTED_IMAGE_FORMAT。"""
    img = tmp_path / "pic.bmp"
    img.write_bytes(b"BM")
    with patch("app.services.mcp_server._validate_path_in_workspace", return_value=(True, str(img))):
        out = await _tool_vision_analyze({"image_path": str(img), "task": "describe"})
    assert out["ok"] is False
    assert out["errorCode"] == "UNSUPPORTED_IMAGE_FORMAT"


async def test_image_path_outside_workspace(tmp_path):
    """image_path 不在工作区白名单 → PATH_NOT_IN_WORKSPACE。"""
    img = tmp_path / "out.png"
    _make_png(img, 100)
    with patch("app.services.mcp_server._validate_path_in_workspace", return_value=(False, "路径不在工作区白名单内")):
        out = await _tool_vision_analyze({"image_path": str(img), "task": "describe"})
    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_IN_WORKSPACE"


async def test_priority_image_path_over_base64(tmp_path):
    """优先级:image_path > image_base64(image_path 存在时忽略 image_base64)。"""
    img = tmp_path / "a.png"
    _make_png(img, 100)
    with patch("app.services.mcp_server._validate_path_in_workspace", return_value=(True, str(img))), \
         patch("app.core.llm_gateway.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value={"content": "x", "model": "m"})
        out = await _tool_vision_analyze({
            "image_path": str(img), "image_base64": "SHOULD_BE_IGNORED", "task": "t",
        })
    assert out["source"] == "local_file"
    img_url = gw_mock.complete.call_args.args[0][0]["content"][1]["image_url"]["url"]
    assert img_url.startswith("data:image/png;base64,")


async def test_image_base64_source():
    """image_base64 参数 → source=base64。"""
    with patch("app.core.llm_gateway.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value={"content": "x", "model": "m"})
        out = await _tool_vision_analyze({"image_base64": "aGVsbG8=", "task": "t"})
    assert out["ok"] is True
    assert out["source"] == "base64"


async def test_image_url_source():
    """image_url 参数 → source=url。"""
    with patch("app.core.llm_gateway.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value={"content": "x", "model": "m"})
        out = await _tool_vision_analyze({"image_url": "https://example.com/a.png", "task": "t"})
    assert out["ok"] is True
    assert out["source"] == "url"


async def test_legacy_image_still_works():
    """legacy image 参数(URL 或 base64)向后兼容,source=legacy。"""
    with patch("app.core.llm_gateway.llm_gateway") as gw_mock:
        gw_mock.complete = AsyncMock(return_value={"content": "x", "model": "m"})
        out = await _tool_vision_analyze({"image": "https://example.com/a.png", "task": "t"})
    assert out["ok"] is True
    assert out["source"] == "legacy"


async def test_no_image_source_returns_error():
    """无任何图片来源 → ok=False。"""
    out = await _tool_vision_analyze({"task": "describe"})
    assert out["ok"] is False


async def test_missing_task_returns_error(tmp_path):
    """有图片来源但无 task → ok=False。"""
    img = tmp_path / "a.png"
    _make_png(img, 100)
    with patch("app.services.mcp_server._validate_path_in_workspace", return_value=(True, str(img))):
        out = await _tool_vision_analyze({"image_path": str(img)})
    assert out["ok"] is False
    assert "task" in out["error"]

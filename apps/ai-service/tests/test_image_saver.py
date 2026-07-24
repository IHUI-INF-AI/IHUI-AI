"""image_saver.py 测试 — 图片保存器。

覆盖维度:
1. save_image:base64 / data URI / URL / 无效 base64 / 无效格式 / 路径白名单
2. validate_save_path:允许 / 禁止目录 / 白名单外
3. decode_base64:正常 / data URI / 无效
4. download_image:无效协议 / HTTP 错误
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.services.image_saver import (
    _ALLOWED_FORMATS,
    decode_base64,
    download_image,
    save_image,
    validate_save_path,
)


# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture
def isolated_paths(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """隔离 image_saver 路径常量到 tmp_path,避免污染 workspace。"""
    monkeypatch.setattr("app.services.image_saver._WORKSPACE_ROOT", tmp_path)
    monkeypatch.setattr("app.services.image_saver._ALLOWED_ROOTS", [tmp_path])
    monkeypatch.setattr("app.services.image_saver._DEFAULT_IMAGE_DIR", tmp_path / "images")
    return tmp_path


# =============================================================================
# decode_base64
# =============================================================================


class TestDecodeBase64:
    def test_plain_base64(self):
        data = base64.b64encode(b"hello").decode()
        assert decode_base64(data) == b"hello"

    def test_data_uri(self):
        data = "data:image/png;base64," + base64.b64encode(b"hello").decode()
        assert decode_base64(data) == b"hello"

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="空数据"):
            decode_base64("")

    def test_invalid_raises(self):
        with pytest.raises(ValueError, match="base64"):
            decode_base64("@@@invalid@@@")


# =============================================================================
# validate_save_path
# =============================================================================


class TestValidateSavePath:
    def test_allowed_relative(self, isolated_paths: Path):
        ok, resolved = validate_save_path("sub/test.png")
        assert ok
        assert "test.png" in resolved

    def test_forbidden_node_modules(self, isolated_paths: Path):
        ok, reason = validate_save_path("node_modules/x")
        assert not ok
        assert "禁止" in reason

    def test_forbidden_git(self, isolated_paths: Path):
        ok, reason = validate_save_path(".git/config")
        assert not ok
        assert "禁止" in reason

    def test_outside_whitelist(self, isolated_paths: Path, tmp_path_factory: pytest.TempPathFactory):
        outside = tmp_path_factory.mktemp("outside")
        ok, _ = validate_save_path(str(outside / "evil.png"))
        assert not ok

    def test_empty_rejected(self):
        ok, _ = validate_save_path("")
        assert not ok

    def test_absolute_under_allowed(self, isolated_paths: Path):
        ok, resolved = validate_save_path(str(isolated_paths / "test.png"))
        assert ok
        assert "test.png" in resolved


# =============================================================================
# save_image
# =============================================================================


class TestSaveImage:
    async def test_base64_auto_path(self, isolated_paths: Path):
        data = base64.b64encode(b"fake-png-bytes").decode()
        result = await save_image(data, format="png")
        assert result["ok"] is True
        assert result["size_bytes"] == len(b"fake-png-bytes")
        assert result["format"] == "png"
        assert Path(result["saved_path"]).exists()
        assert Path(result["saved_path"]).read_bytes() == b"fake-png-bytes"

    async def test_data_uri(self, isolated_paths: Path):
        data = "data:image/png;base64," + base64.b64encode(b"x").decode()
        result = await save_image(data)
        assert result["ok"] is True
        assert result["size_bytes"] == 1
        assert Path(result["saved_path"]).exists()

    async def test_url_download(self, isolated_paths: Path, monkeypatch: pytest.MonkeyPatch):
        async def mock_download(url: str, timeout: int = 30) -> bytes:
            return b"downloaded-bytes"
        monkeypatch.setattr("app.services.image_saver.download_image", mock_download)

        result = await save_image("https://example.com/img.png")
        assert result["ok"] is True
        assert result["size_bytes"] == len(b"downloaded-bytes")
        assert Path(result["saved_path"]).exists()

    async def test_invalid_base64(self, isolated_paths: Path):
        result = await save_image("@@@invalid@@@", format="png")
        assert result["ok"] is False
        assert result["errorCode"] == "INVALID_BASE64"

    async def test_invalid_format(self, isolated_paths: Path):
        data = base64.b64encode(b"x").decode()
        result = await save_image(data, format="tiff")
        assert result["ok"] is False
        assert result["errorCode"] == "INVALID_FORMAT"

    async def test_path_not_allowed(self, isolated_paths: Path, tmp_path_factory: pytest.TempPathFactory):
        outside = tmp_path_factory.mktemp("outside")
        data = base64.b64encode(b"x").decode()
        result = await save_image(data, save_path=str(outside / "evil.png"))
        assert result["ok"] is False
        assert result["errorCode"] == "PATH_NOT_ALLOWED"

    async def test_explicit_allowed_path(self, isolated_paths: Path):
        data = base64.b64encode(b"y").decode()
        result = await save_image(data, save_path="sub/test.png")
        assert result["ok"] is True
        assert (isolated_paths / "sub" / "test.png").exists()

    async def test_url_download_failure(self, isolated_paths: Path, monkeypatch: pytest.MonkeyPatch):
        async def mock_download(url: str, timeout: int = 30) -> bytes:
            raise httpx.ConnectError("connection failed")
        monkeypatch.setattr("app.services.image_saver.download_image", mock_download)

        result = await save_image("https://example.com/img.png")
        assert result["ok"] is False
        assert result["errorCode"] == "DOWNLOAD_FAILED"

    def test_allowed_formats_includes_common(self):
        for fmt in ("png", "jpg", "jpeg", "gif", "webp"):
            assert fmt in _ALLOWED_FORMATS


# =============================================================================
# download_image
# =============================================================================


class TestDownloadImage:
    async def test_invalid_scheme(self):
        with pytest.raises(ValueError, match="协议"):
            await download_image("file:///etc/passwd")

    async def test_missing_hostname(self):
        with pytest.raises(ValueError, match="hostname"):
            await download_image("http://")

    async def test_http_error(self, monkeypatch: pytest.MonkeyPatch):
        class _FailingClient:
            async def __aenter__(self) -> "_FailingClient":
                return self

            async def __aexit__(self, *a: object) -> bool:
                return False

            async def get(self, url: str) -> Any:
                raise httpx.ConnectError("connection failed")

        monkeypatch.setattr(
            "app.services.image_saver.httpx.AsyncClient",
            lambda **kw: _FailingClient(),
        )
        with pytest.raises(httpx.HTTPError):
            await download_image("https://example.com/img.png")

    async def test_success(self, monkeypatch: pytest.MonkeyPatch):
        class _OkClient:
            async def __aenter__(self) -> "_OkClient":
                return self

            async def __aexit__(self, *a: object) -> bool:
                return False

            async def get(self, url: str) -> Any:
                resp = type("R", (), {"content": b"img-bytes", "status_code": 200})()
                resp.raise_for_status = lambda: None
                return resp

        monkeypatch.setattr(
            "app.services.image_saver.httpx.AsyncClient",
            lambda **kw: _OkClient(),
        )
        data = await download_image("https://example.com/img.png")
        assert data == b"img-bytes"

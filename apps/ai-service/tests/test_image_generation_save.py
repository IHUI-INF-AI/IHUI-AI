"""image_generation save_path 落地 + provider 集成单元测试。

测试覆盖(2026-07-24 升级):
- save_path 参数:校验 + 文件写入 + saved_path/file_size_bytes 返回
- _validate_image_save_path:工作区白名单 + 后缀(.png/.jpg/.jpeg/.webp)
- _persist_image_to_disk:写入磁盘 + 5MB 限制 + OSError 处理
- _fetch_image_bytes:b64_json 解码 + URL 下载 + 失败处理
- provider 选择:stepfun / agnes / fallback(stepfun 无 key → agnes,反之)
- 错误码:MISSING_PARAMS / INVALID_PROVIDER / PROVIDER_NOT_CONFIGURED / DEP_MISSING /
  PROVIDER_ERROR / EMPTY_RESULT / IMAGE_FETCH_FAILED / INVALID_EXTENSION /
  PATH_NOT_ALLOWED / IMAGE_TOO_LARGE / WRITE_FAILED / GENERATION_FAILED
- httpx mock(mock post + get 响应)
"""

from __future__ import annotations

import base64
import sys
import types
from pathlib import Path
from typing import Any

import pytest

from app.services.mcp_server import (
    _MAX_IMAGE_BYTES,
    _IMAGE_EXTENSIONS,
    _fetch_image_bytes,
    _persist_image_to_disk,
    _tool_image_generation,
    _validate_image_save_path,
)


# =============================================================================
# Fake httpx(mock 图片生成 API 响应)
# =============================================================================


class _FakeResponse:
    """模拟 httpx.Response。"""

    def __init__(
        self, status_code: int = 200, json_data: Any = None,
        text: str = "", content: bytes = b"",
    ):
        self.status_code = status_code
        self._json = json_data if json_data is not None else {}
        self.text = text
        self.content = content

    def json(self):
        return self._json


class _FakeImageClient:
    """模拟 httpx.AsyncClient,支持 post(provider API)和 get(URL 下载)。"""

    def __init__(
        self, post_response: _FakeResponse | None = None,
        get_response: _FakeResponse | None = None,
    ):
        self._post_resp = post_response or _FakeResponse(200, {"data": []})
        self._get_resp = get_response or _FakeResponse(200, content=b"image_bytes")
        self.post_calls: list[tuple] = []
        self.get_calls: list[str] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def post(self, url, json=None, headers=None):
        self.post_calls.append((url, json, headers))
        return self._post_resp

    async def get(self, url):
        self.get_calls.append(url)
        return self._get_resp


class _FakeHttpxModule:
    """Fake httpx module. AsyncClient() 工厂创建 _FakeImageClient 实例。

    所有创建的 client 实例共享相同的 post/get 响应配置,
    存储在 self.clients 供测试断言 post_calls/get_calls。
    """

    def __init__(
        self, post_response: _FakeResponse | None = None,
        get_response: _FakeResponse | None = None,
    ):
        self._post = post_response
        self._get = get_response
        self.clients: list[_FakeImageClient] = []

    def AsyncClient(self, **kwargs):
        c = _FakeImageClient(self._post, self._get)
        self.clients.append(c)
        return c


def _inject_fake_httpx(
    monkeypatch,
    post_response: _FakeResponse | None = None,
    get_response: _FakeResponse | None = None,
) -> _FakeHttpxModule:
    """注入 fake httpx 模块到 sys.modules,返回 fake module 供断言。

    用法:
        fake_mod = _inject_fake_httpx(monkeypatch, post_resp)
        out = await _tool_image_generation(...)
        client = fake_mod.clients[0]  # 首个创建的 AsyncClient 实例
        assert client.post_calls[0] == ...
    """
    fake_mod = _FakeHttpxModule(post_response, get_response)
    monkeypatch.setitem(sys.modules, "httpx", fake_mod)
    return fake_mod


@pytest.fixture
def stepfun_configured(monkeypatch):
    """配置 stepfun provider(settings 已被 conftest 清空,需重新设置)。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "stepfun_api_key", "test_stepfun_key")
    monkeypatch.setattr(settings, "stepfun_api_base", "https://api.stepfun.com/step_plan/v1")
    monkeypatch.setattr(settings, "agnes_api_key", "")
    monkeypatch.setattr(settings, "agnes_api_base", "")


@pytest.fixture
def agnes_configured(monkeypatch):
    """配置 agnes provider。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "stepfun_api_key", "")
    monkeypatch.setattr(settings, "stepfun_api_base", "")
    monkeypatch.setattr(settings, "agnes_api_key", "test_agnes_key")
    monkeypatch.setattr(settings, "agnes_api_base", "https://apihub.agnes-ai.com/v1")


@pytest.fixture
def both_configured(monkeypatch):
    """同时配置两个 provider。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "stepfun_api_key", "test_stepfun_key")
    monkeypatch.setattr(settings, "stepfun_api_base", "https://api.stepfun.com/step_plan/v1")
    monkeypatch.setattr(settings, "agnes_api_key", "test_agnes_key")
    monkeypatch.setattr(settings, "agnes_api_base", "https://apihub.agnes-ai.com/v1")


@pytest.fixture
def allow_workspace_path(monkeypatch):
    """绕过工作区白名单校验(tmp_path 不在白名单内)。"""
    monkeypatch.setattr(
        "app.services.mcp_server._validate_path_in_workspace",
        lambda p: (True, str(p)),
    )


# =============================================================================
# _validate_image_save_path helper
# =============================================================================


def test_validate_save_path_empty():
    """空 save_path → MISSING_PARAMS。"""
    ok, resolved, err = _validate_image_save_path("")
    assert ok is False
    assert err == "MISSING_PARAMS"


def test_validate_save_path_none():
    """None save_path → MISSING_PARAMS。"""
    ok, resolved, err = _validate_image_save_path(None)
    assert ok is False
    assert err == "MISSING_PARAMS"


def test_validate_save_path_invalid_extension():
    """非图片后缀 → INVALID_EXTENSION。"""
    ok, resolved, err = _validate_image_save_path("/tmp/test.txt")
    assert ok is False
    assert err == "INVALID_EXTENSION"


def test_validate_save_path_gif_invalid():
    """.gif 不在允许列表 → INVALID_EXTENSION。"""
    ok, resolved, err = _validate_image_save_path("/tmp/test.gif")
    assert ok is False
    assert err == "INVALID_EXTENSION"


def test_validate_save_path_png_valid(allow_workspace_path, tmp_path):
    """.png 后缀 + 工作区内 → ok=True。"""
    path = str(tmp_path / "test.png")
    ok, resolved, err = _validate_image_save_path(path)
    assert ok is True
    assert err is None
    assert resolved == path


def test_validate_save_path_jpg_valid(allow_workspace_path, tmp_path):
    """.jpg 后缀 → ok=True。"""
    path = str(tmp_path / "test.jpg")
    ok, resolved, err = _validate_image_save_path(path)
    assert ok is True


def test_validate_save_path_jpeg_valid(allow_workspace_path, tmp_path):
    """.jpeg 后缀 → ok=True。"""
    path = str(tmp_path / "test.jpeg")
    ok, resolved, err = _validate_image_save_path(path)
    assert ok is True


def test_validate_save_path_webp_valid(allow_workspace_path, tmp_path):
    """.webp 后缀 → ok=True。"""
    path = str(tmp_path / "test.webp")
    ok, resolved, err = _validate_image_save_path(path)
    assert ok is True


def test_validate_save_path_uppercase_ext(allow_workspace_path, tmp_path):
    """大写后缀 .PNG → ok=True(大小写不敏感)。"""
    path = str(tmp_path / "test.PNG")
    ok, resolved, err = _validate_image_save_path(path)
    assert ok is True


def test_validate_save_path_path_not_allowed(monkeypatch):
    """路径不在工作区白名单 → PATH_NOT_ALLOWED。"""
    monkeypatch.setattr(
        "app.services.mcp_server._validate_path_in_workspace",
        lambda p: (False, "路径不在工作区白名单内"),
    )
    ok, resolved, err = _validate_image_save_path("/outside/workspace/test.png")
    assert ok is False
    assert err == "PATH_NOT_ALLOWED"


# =============================================================================
# _persist_image_to_disk helper
# =============================================================================


async def test_persist_image_writes_file(tmp_path):
    """正常写入:创建文件 + 返回 size。"""
    image_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    save_path = str(tmp_path / "output.png")
    ok, saved_path, size, err = await _persist_image_to_disk(image_bytes, save_path)
    assert ok is True
    assert err is None
    assert saved_path == save_path
    assert size == len(image_bytes)
    assert Path(save_path).exists()
    assert Path(save_path).read_bytes() == image_bytes


async def test_persist_image_creates_parent_dirs(tmp_path):
    """父目录不存在时自动创建。"""
    image_bytes = b"test image data"
    save_path = str(tmp_path / "subdir" / "deep" / "output.png")
    ok, saved_path, size, err = await _persist_image_to_disk(image_bytes, save_path)
    assert ok is True
    assert Path(save_path).exists()


async def test_persist_image_overwrites_existing(tmp_path):
    """覆盖已存在的文件。"""
    save_path = tmp_path / "existing.png"
    save_path.write_bytes(b"old content")
    new_bytes = b"new content longer"
    ok, saved_path, size, err = await _persist_image_to_disk(
        new_bytes, str(save_path)
    )
    assert ok is True
    assert size == len(new_bytes)
    assert save_path.read_bytes() == new_bytes


async def test_persist_image_too_large():
    """图片 > 5MB → IMAGE_TOO_LARGE。"""
    large_bytes = b"\x00" * (_MAX_IMAGE_BYTES + 1)
    ok, saved_path, size, err = await _persist_image_to_disk(
        large_bytes, "/tmp/too_large.png"
    )
    assert ok is False
    assert err == "IMAGE_TOO_LARGE"
    assert size == 0


async def test_persist_image_at_boundary_5mb(tmp_path):
    """图片恰好 5MB → ok=True(边界值)。"""
    exact_bytes = b"\x00" * _MAX_IMAGE_BYTES
    save_path = str(tmp_path / "exact.png")
    ok, saved_path, size, err = await _persist_image_to_disk(
        exact_bytes, save_path
    )
    assert ok is True
    assert size == _MAX_IMAGE_BYTES


async def test_persist_image_write_failed(monkeypatch, tmp_path):
    """OSError → WRITE_FAILED。"""
    def _raise_oserror(*args, **kwargs):
        raise OSError("disk full")

    monkeypatch.setattr("builtins.open", _raise_oserror)
    image_bytes = b"test"
    save_path = str(tmp_path / "fail.png")
    ok, saved_path, size, err = await _persist_image_to_disk(image_bytes, save_path)
    assert ok is False
    assert err == "WRITE_FAILED"


# =============================================================================
# _fetch_image_bytes helper
# =============================================================================


async def test_fetch_image_bytes_b64_json():
    """b64_json 存在 → 解码返回 bytes。"""
    original = b"image binary data here"
    b64 = base64.b64encode(original).decode()
    item = {"b64_json": b64}
    result = await _fetch_image_bytes(item, f"data:image/png;base64,{b64}", None)
    assert result == original


async def test_fetch_image_bytes_url_download():
    """无 b64_json,有 URL → 下载返回 bytes。"""
    item = {}
    image_url = "https://cdn.example.com/image.png"

    class _FakeDlClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def get(self, url):
            return _FakeResponse(200, content=b"downloaded image bytes")

    fake_httpx = types.ModuleType("httpx")
    fake_httpx.AsyncClient = lambda **kw: _FakeDlClient()

    result = await _fetch_image_bytes(item, image_url, fake_httpx)
    assert result == b"downloaded image bytes"


async def test_fetch_image_bytes_url_download_404():
    """URL 下载 404 → 返回 None。"""
    item = {}
    image_url = "https://cdn.example.com/notfound.png"

    class _FakeDlClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def get(self, url):
            return _FakeResponse(404, b"", "not found")

    fake_httpx = types.ModuleType("httpx")
    fake_httpx.AsyncClient = lambda **kw: _FakeDlClient()

    result = await _fetch_image_bytes(item, image_url, fake_httpx)
    assert result is None


async def test_fetch_image_bytes_invalid_b64():
    """无效 b64_json → 返回 None。"""
    item = {"b64_json": "!!!invalid base64!!!"}
    result = await _fetch_image_bytes(item, "data:image/png;base64,!!!invalid", None)
    assert result is None


async def test_fetch_image_bytes_empty():
    """无 b64 也无 URL → 返回 None。"""
    item = {}
    result = await _fetch_image_bytes(item, "", None)
    assert result is None


async def test_fetch_image_bytes_data_url_no_b64():
    """data: URL 但无 b64_json → 返回 None(不走 URL 下载)。"""
    item = {}
    image_url = "data:image/png;base64,"
    result = await _fetch_image_bytes(item, image_url, None)
    assert result is None


# =============================================================================
# _tool_image_generation:参数校验
# =============================================================================


async def test_image_gen_missing_prompt():
    """空 prompt → MISSING_PARAMS。"""
    out = await _tool_image_generation({"prompt": ""})
    assert out["tool"] == "image_generation"
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"
    assert out["saved_path"] is None


async def test_image_gen_missing_prompt_key():
    """无 prompt key → MISSING_PARAMS。"""
    out = await _tool_image_generation({})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"


async def test_image_gen_invalid_provider(stepfun_configured):
    """未知 provider → INVALID_PROVIDER。"""
    out = await _tool_image_generation({
        "prompt": "test image", "provider": "unknown_provider",
    })
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PROVIDER"


async def test_image_gen_provider_not_configured(monkeypatch):
    """两个 provider 都无 key → PROVIDER_NOT_CONFIGURED。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "stepfun_api_key", "")
    monkeypatch.setattr(settings, "agnes_api_key", "")

    out = await _tool_image_generation({"prompt": "test", "provider": "stepfun"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"
    assert out["saved_path"] is None


# =============================================================================
# _tool_image_generation:provider fallback
# =============================================================================


async def test_image_gen_stepfun_fallback_to_agnes(agnes_configured, monkeypatch):
    """stepfun 无 key → 自动降级到 agnes。"""
    b64 = base64.b64encode(b"image_data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "test", "provider": "stepfun",
    })
    assert out["ok"] is True
    assert out["provider"] == "agnes"  # 降级后 provider 变为 agnes


async def test_image_gen_agnes_fallback_to_stepfun(stepfun_configured, monkeypatch):
    """agnes 无 key → 自动降级到 stepfun。"""
    b64 = base64.b64encode(b"image_data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "test", "provider": "agnes",
    })
    assert out["ok"] is True
    assert out["provider"] == "stepfun"


# =============================================================================
# _tool_image_generation:provider API 错误
# =============================================================================


async def test_image_gen_provider_error_400(stepfun_configured, monkeypatch):
    """provider 返回 4xx → PROVIDER_ERROR。"""
    post_resp = _FakeResponse(400, {"error": "bad request"}, "Bad Request")
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "stepfun"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_ERROR"
    assert out["saved_path"] is None


async def test_image_gen_provider_error_500(stepfun_configured, monkeypatch):
    """provider 返回 500 → PROVIDER_ERROR。"""
    post_resp = _FakeResponse(500, {}, "Internal Server Error")
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "stepfun"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_ERROR"


async def test_image_gen_empty_data(stepfun_configured, monkeypatch):
    """provider 返回空 data → EMPTY_RESULT。"""
    post_resp = _FakeResponse(200, {"data": []})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "stepfun"})
    assert out["ok"] is False
    assert out["errorCode"] == "EMPTY_RESULT"


async def test_image_gen_no_url_no_b64(stepfun_configured, monkeypatch):
    """data 项无 url 无 b64_json → EMPTY_RESULT。"""
    post_resp = _FakeResponse(200, {"data": [{"other_field": "value"}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "stepfun"})
    assert out["ok"] is False
    assert out["errorCode"] == "EMPTY_RESULT"


# =============================================================================
# _tool_image_generation:成功(无 save_path)
# =============================================================================


async def test_image_gen_success_b64_no_save(stepfun_configured, monkeypatch):
    """成功生成(b64_json,无 save_path)→ 返回 image_url + saved_path=None。"""
    original_bytes = b"\x89PNG test image data"
    b64 = base64.b64encode(original_bytes).decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "a cat", "provider": "stepfun", "size": "512x512",
    })
    assert out["ok"] is True
    assert out["provider"] == "stepfun"
    assert out["saved_path"] is None
    assert out["file_size_bytes"] == 0  # 无 save_path 时为 0
    assert "image_url" in out
    assert "data:image/png;base64," in out["image_url"]
    assert out["size"] == "512x512"


async def test_image_gen_success_url_no_save(stepfun_configured, monkeypatch):
    """成功生成(URL,无 save_path)→ 返回 image_url。"""
    post_resp = _FakeResponse(200, {
        "data": [{"url": "https://cdn.example.com/generated.png"}]
    })
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "a dog", "provider": "stepfun"})
    assert out["ok"] is True
    assert out["saved_path"] is None
    assert out["image_url"] == "https://cdn.example.com/generated.png"


# =============================================================================
# _tool_image_generation:save_path 落地
# =============================================================================


async def test_image_gen_save_b64_to_file(
    stepfun_configured, monkeypatch, allow_workspace_path, tmp_path,
):
    """save_path + b64_json → 写入文件 + 返回 saved_path + file_size_bytes。"""
    original_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200
    b64 = base64.b64encode(original_bytes).decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    save_path = str(tmp_path / "saved_image.png")
    out = await _tool_image_generation({
        "prompt": "test image", "provider": "stepfun",
        "save_path": save_path,
    })
    assert out["ok"] is True
    assert out["saved_path"] == save_path
    assert out["file_size_bytes"] == len(original_bytes)
    # 验证文件确实写入
    assert Path(save_path).exists()
    assert Path(save_path).read_bytes() == original_bytes


async def test_image_gen_save_url_to_file(
    stepfun_configured, monkeypatch, allow_workspace_path, tmp_path,
):
    """save_path + URL → 下载并写入文件。"""
    image_bytes = b"downloaded image content here"
    post_resp = _FakeResponse(200, {
        "data": [{"url": "https://cdn.example.com/image.png"}]
    })
    get_resp = _FakeResponse(200, content=image_bytes)
    _inject_fake_httpx(monkeypatch, post_resp, get_resp)

    save_path = str(tmp_path / "url_saved.png")
    out = await _tool_image_generation({
        "prompt": "url test", "provider": "stepfun",
        "save_path": save_path,
    })
    assert out["ok"] is True
    assert out["saved_path"] == save_path
    assert out["file_size_bytes"] == len(image_bytes)
    assert Path(save_path).exists()
    assert Path(save_path).read_bytes() == image_bytes


async def test_image_gen_save_creates_parent_dirs(
    stepfun_configured, monkeypatch, allow_workspace_path, tmp_path,
):
    """save_path 父目录不存在时自动创建。"""
    original_bytes = b"image data"
    b64 = base64.b64encode(original_bytes).decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    save_path = str(tmp_path / "subdir" / "deep" / "output.png")
    out = await _tool_image_generation({
        "prompt": "test", "provider": "stepfun",
        "save_path": save_path,
    })
    assert out["ok"] is True
    assert Path(save_path).exists()


async def test_image_gen_save_invalid_extension(
    stepfun_configured, monkeypatch,
):
    """save_path 后缀非图片格式 → INVALID_EXTENSION。"""
    b64 = base64.b64encode(b"data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "test", "provider": "stepfun",
        "save_path": "/tmp/test.txt",
    })
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_EXTENSION"
    assert out["saved_path"] is None


async def test_image_gen_save_path_not_allowed(
    stepfun_configured, monkeypatch,
):
    """save_path 不在工作区 → PATH_NOT_ALLOWED。"""
    b64 = base64.b64encode(b"data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    # _validate_path_in_workspace 未被 mock → 默认返回 False(因为 /outside 不在白名单)
    out = await _tool_image_generation({
        "prompt": "test", "provider": "stepfun",
        "save_path": "/outside/workspace/test.png",
    })
    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_ALLOWED"


async def test_image_gen_save_image_too_large(
    stepfun_configured, monkeypatch, allow_workspace_path, tmp_path,
):
    """图片 > 5MB → IMAGE_TOO_LARGE。"""
    large_bytes = b"\x00" * (_MAX_IMAGE_BYTES + 1)
    b64 = base64.b64encode(large_bytes).decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    save_path = str(tmp_path / "too_large.png")
    out = await _tool_image_generation({
        "prompt": "big", "provider": "stepfun",
        "save_path": save_path,
    })
    assert out["ok"] is False
    assert out["errorCode"] == "IMAGE_TOO_LARGE"
    assert out["saved_path"] is None


async def test_image_gen_save_fetch_failed(
    stepfun_configured, monkeypatch, allow_workspace_path, tmp_path,
):
    """save_path 指定但图片字节获取失败(b64 无效 + URL 下载失败)→ IMAGE_FETCH_FAILED。"""
    # b64_json 无效 + URL 下载 404
    post_resp = _FakeResponse(200, {
        "data": [{"b64_json": "!!!invalid!!!", "url": "https://cdn.example.com/404.png"}]
    })
    get_resp = _FakeResponse(404, b"", "not found")
    _inject_fake_httpx(monkeypatch, post_resp, get_resp)

    save_path = str(tmp_path / "fetch_fail.png")
    out = await _tool_image_generation({
        "prompt": "test", "provider": "stepfun",
        "save_path": save_path,
    })
    assert out["ok"] is False
    assert out["errorCode"] == "IMAGE_FETCH_FAILED"
    assert out["saved_path"] is None


# =============================================================================
# _tool_image_generation:httpx 缺失
# =============================================================================


async def test_image_gen_httpx_missing(stepfun_configured, monkeypatch):
    """httpx 未安装 → DEP_MISSING。"""
    monkeypatch.setitem(sys.modules, "httpx", None)
    out = await _tool_image_generation({"prompt": "test", "provider": "stepfun"})
    assert out["ok"] is False
    assert out["errorCode"] == "DEP_MISSING"


# =============================================================================
# _tool_image_generation:异常处理
# =============================================================================


async def test_image_gen_exception_handled(stepfun_configured, monkeypatch):
    """httpx 异常 → GENERATION_FAILED。"""
    class _ExplodingClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def post(self, *a, **kw):
            raise ConnectionError("network down")

    fake_mod = types.ModuleType("httpx")
    fake_mod.AsyncClient = lambda **kw: _ExplodingClient()
    monkeypatch.setitem(sys.modules, "httpx", fake_mod)

    out = await _tool_image_generation({"prompt": "test", "provider": "stepfun"})
    assert out["ok"] is False
    assert out["errorCode"] == "GENERATION_FAILED"


# =============================================================================
# _tool_image_generation:provider API 调用参数
# =============================================================================


async def test_image_gen_api_post_params(stepfun_configured, monkeypatch):
    """验证 post 请求参数(endpoint + json + headers)。"""
    b64 = base64.b64encode(b"data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "a landscape", "provider": "stepfun", "size": "1024x1024",
    })
    assert out["ok"] is True
    assert len(fake_mod.clients) >= 1
    client = fake_mod.clients[0]
    assert len(client.post_calls) == 1
    url, json_body, headers = client.post_calls[0]
    # endpoint 应包含 /images/generations
    assert "/images/generations" in url
    # json body 含 prompt + model + size
    assert json_body["prompt"] == "a landscape"
    assert json_body["size"] == "1024x1024"
    assert "model" in json_body
    # headers 含 Bearer auth
    assert headers["Authorization"] == "Bearer test_stepfun_key"


async def test_image_gen_agnes_provider_endpoint(agnes_configured, monkeypatch):
    """agnes provider 使用 agnes api_base。"""
    b64 = base64.b64encode(b"data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "agnes"})
    assert out["ok"] is True
    assert out["provider"] == "agnes"
    client = fake_mod.clients[0]
    url, _, _ = client.post_calls[0]
    assert "agnes-ai.com" in url


# =============================================================================
# _tool_image_generation:返回结构完整性
# =============================================================================


async def test_image_gen_success_return_fields(stepfun_configured, monkeypatch):
    """成功返回包含所有必需字段。"""
    b64 = base64.b64encode(b"img").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "test", "provider": "stepfun",
        "size": "512x512", "quality": "hd", "style": "artistic",
    })
    assert out["ok"] is True
    assert out["tool"] == "image_generation"
    assert out["prompt"] == "test"
    assert out["image_url"] is not None
    assert out["size"] == "512x512"
    assert out["quality"] == "hd"
    assert out["style"] == "artistic"
    assert out["provider"] == "stepfun"
    assert "model" in out
    assert out["saved_path"] is None
    assert "file_size_bytes" in out
    assert "created_at" in out
    assert "message" in out


# =============================================================================
# 常量验证
# =============================================================================


def test_max_image_bytes_is_5mb():
    """_MAX_IMAGE_BYTES = 5 * 1024 * 1024 = 5242880。"""
    assert _MAX_IMAGE_BYTES == 5 * 1024 * 1024
    assert _MAX_IMAGE_BYTES == 5242880


def test_image_extensions():
    """_IMAGE_EXTENSIONS 包含 .png/.jpg/.jpeg/.webp。"""
    assert ".png" in _IMAGE_EXTENSIONS
    assert ".jpg" in _IMAGE_EXTENSIONS
    assert ".jpeg" in _IMAGE_EXTENSIONS
    assert ".webp" in _IMAGE_EXTENSIONS

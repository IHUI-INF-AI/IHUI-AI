# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""image_generation save_path 落地 + provider 集成单元测试。

被测语义(mcp_server.py:4277 `_tool_image_generation` / 4110 `_image_generate_once`
/ 4067 `_image_provider_chain`,2026-09-21 对齐 stepfun 剔除后的现状):
- save_path 参数:校验 + 文件写入 + saved_path/file_size_bytes 返回
- _validate_image_save_path:工作区白名单 + 后缀(.png/.jpg/.jpeg/.webp)
- _persist_image_to_disk:写入磁盘 + 5MB 限制 + OSError 处理
- _fetch_image_bytes:b64_json 解码 + URL 下载 + 失败处理
- provider 选择:链序 token6688 → agnes → kling → jimeng,只保留已配凭据的;
  显式 provider 已配 → 提到链首,未配 → 回落自动链(stepfun 已不在 _ALLOWED)
- payload 差异:token6688 发 {prompt, model, n}(官方 gpt-image-2.5 参数表无 size);
  agnes 发 {prompt, model, size, n};quality/style 自 2026-09-21 起彻底不读
- 错误码:MISSING_PARAMS / INVALID_PROVIDER / PROVIDER_NOT_CONFIGURED / INVALID_PARAMS /
  DEP_MISSING / PROVIDER_ERROR / EMPTY_RESULT / IMAGE_FETCH_FAILED / INVALID_EXTENSION /
  PATH_NOT_ALLOWED / IMAGE_TOO_LARGE / WRITE_FAILED / GENERATION_FAILED
- httpx mock(mock post + get 响应)

链序矩阵与运行时 failover_attempts 的纯函数级断言在 tests/test_media_auto_routing.py
::TestImageProviderChain / ::TestImageRuntimeFailover,本文件只测穿过真实
`_image_generate_once` 的 HTTP 层行为。
"""

from __future__ import annotations

import base64
import json
import sys
import types
from pathlib import Path
from typing import Any

import pytest

from app.services.mcp_server import (
    _IMAGE_EXTENSIONS,
    _MAX_IMAGE_BYTES,
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


@pytest.fixture(autouse=True)
def _isolate_image_chain_inputs(monkeypatch):
    """钉住链序与上游元数据来源(宿主环境/生产库都会让断言漂移)。

    为什么:conftest 的 _isolate_llm_env 只清 VENDOR_ENV_KEYS(kling/ark 在内),
    而 token6688 的凭据走 `TOKEN6688_API_KEY`(free_provider_registry.py:811 登记的
    真实键位)、链序走 `IMAGE_PROVIDER`、模型名走 `TOKEN6688_IMAGE_MODEL` /
    `AGNES_IMAGE_MODEL`(mcp_server.py:4097 与 4127/4141)—— 宿主 .env 或 shell 一旦
    配了这些键,本文件的链序与 payload 断言就随机器漂移。

    get_model_metadata 必须 mock:token6688 分支提交前查 ai_model_config_models
    (mcp_server.py:4161 → app.core.db_pool.get_shared_pool),而 conftest 只隔离了
    model_sync 那份绑定式导入。返回 None 是生产已有的降级路径(元数据未同步 →
    跳过校验),不改变被测行为。
    """
    for key in (
        "IMAGE_PROVIDER", "TOKEN6688_API_KEY", "TOKEN6688_BASE_URL",
        "TOKEN6688_IMAGE_MODEL", "AGNES_IMAGE_MODEL",
    ):
        monkeypatch.delenv(key, raising=False)

    async def _metadata_unavailable(model_id: str):
        return None

    monkeypatch.setattr(
        "app.services.token6688_catalog.get_model_metadata", _metadata_unavailable,
    )


@pytest.fixture
def token6688_configured(monkeypatch):
    """只配 token6688(`_ALLOWED` 首位 / 默认 provider,mcp_server.py:4298)。

    密钥形状取真实读取路径 `settings.get_provider_config("token6688")`
    (config.py:285 读 LLM_PROVIDERS JSON);api_base 不带 /v1 —— 代码在
    mcp_server.py:4124 补齐,所以真实配置就是这个形态。
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "token6688": {"api_key": "test_token6688_key", "api_base": "https://k.token6688.com"},
        "agnes": {"api_key": "", "api_base": ""},
    }))


@pytest.fixture
def agnes_configured(monkeypatch):
    """只配 agnes(token6688 无 key):测显式指定 token6688 时的自动链兜底。

    agnes 的 api_base 自带 /v1:该分支不补前缀(mcp_server.py:4134 直接用
    cfg.api_base),与 .env LLM_PROVIDERS 的实际值一致。
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "token6688": {"api_key": "", "api_base": ""},
        "agnes": {"api_key": "test_agnes_key", "api_base": "https://apihub.agnes-ai.com/v1"},
    }))


@pytest.fixture
def both_configured(monkeypatch):
    """两家都配:缺省链序即 _image_provider_chain 的 token6688 → agnes。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "token6688": {"api_key": "test_token6688_key", "api_base": "https://k.token6688.com"},
        "agnes": {"api_key": "test_agnes_key", "api_base": "https://apihub.agnes-ai.com/v1"},
    }))


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


async def test_image_gen_invalid_provider(token6688_configured, monkeypatch):
    """未知 provider → INVALID_PROVIDER,且不发起任何 HTTP(校验在链构造之前)。"""
    fake_mod = _inject_fake_httpx(monkeypatch)
    out = await _tool_image_generation({
        "prompt": "test image", "provider": "unknown_provider",
    })
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PROVIDER"
    assert fake_mod.clients == []


async def test_image_gen_stepfun_removed_from_allowed(token6688_configured, monkeypatch):
    """stepfun 传入必须 INVALID_PROVIDER —— 钉住 2026-09-21 的剔除不回潮。

    为什么:stepfun 官方 /v1/models 实测无文生图模型(唯一图像类 step-image-edit-2
    是图像编辑),原硬编码的 step-1v-8k 不在售,走 stepfun 生图必失败,故它已从
    _ALLOWED(mcp_server.py:4298)与缺省链序(4098)一并移除。
    """
    fake_mod = _inject_fake_httpx(monkeypatch)
    out = await _tool_image_generation({"prompt": "test", "provider": "stepfun"})
    assert out["ok"] is False
    # 拒绝理由是"不在允许清单"而非"未配凭据":stepfun 即使配了 key 也不给走
    assert out["errorCode"] == "INVALID_PROVIDER"
    assert "stepfun" not in out["error"].split("允许")[-1]
    assert fake_mod.clients == []


async def test_image_gen_provider_not_configured(monkeypatch):
    """全链无凭据 → PROVIDER_NOT_CONFIGURED。

    为什么不报 INVALID_PROVIDER:token6688 在允许清单内,4299 的校验放过,
    是 _image_provider_chain 过滤掉无凭据的厂商后得到空链(4317-4325);
    provider 字段回显"入参优先、缺省 auto"。
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "token6688": {"api_key": ""},
        "agnes": {"api_key": ""},
    }))
    fake_mod = _inject_fake_httpx(monkeypatch)

    out = await _tool_image_generation({"prompt": "test", "provider": "token6688"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"
    assert out["provider"] == "token6688"
    assert out["saved_path"] is None

    auto = await _tool_image_generation({"prompt": "test"})
    assert auto["ok"] is False
    assert auto["errorCode"] == "PROVIDER_NOT_CONFIGURED"
    assert auto["provider"] == "auto"
    assert fake_mod.clients == []


# =============================================================================
# _tool_image_generation:provider 链序(显式厂商无凭据时的兜底 / 有凭据时提前)
# =============================================================================


async def test_image_gen_token6688_without_key_falls_back_to_agnes(
    agnes_configured, monkeypatch,
):
    """显式要 token6688 但它没凭据 → 兜底到链里唯一有凭据的 agnes。

    为什么没有 failover_attempts:兜底发生在 _image_provider_chain 的凭据过滤阶段
    (mcp_server.py:4101-4106,显式厂商没凭据就不插到链首),token6688 从未被尝试;
    failover_attempts 只记"真打过上游又失败"(4331-4338)。
    """
    b64 = base64.b64encode(b"image_data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "test", "provider": "token6688",
    })
    assert out["ok"] is True
    assert out["provider"] == "agnes"
    assert "failover_attempts" not in out
    assert len(fake_mod.clients) == 1
    assert "agnes-ai.com" in fake_mod.clients[0].post_calls[0][0]


async def test_image_gen_agnes_without_key_falls_back_to_token6688(
    token6688_configured, monkeypatch,
):
    """显式要 agnes 但它没凭据 → 兜底到代码实际会选的那一家:token6688。

    链序缺省 token6688 → agnes → kling → jimeng(mcp_server.py:4098-4100),
    此刻只有 token6688 有凭据 → 它是唯一入选者(不是 agnes 的"下一级"兜底,
    而是整条链只剩它)。
    """
    b64 = base64.b64encode(b"image_data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "test", "provider": "agnes",
    })
    assert out["ok"] is True
    assert out["provider"] == "token6688"
    # token6688 不发 size → 回显 None(payload.get("size"),mcp_server.py:4261),
    # 不再是"入参原样回显"的旧语义
    assert out["size"] is None
    assert fake_mod.clients[0].post_calls[0][0].endswith("/v1/images/generations")


async def test_image_gen_explicit_configured_provider_goes_first(
    both_configured, monkeypatch,
):
    """两家都有凭据 + 显式 agnes → agnes 提到链首,失败后才轮到 token6688。

    与上两条的区别:显式厂商有凭据时是"提前"而非"被过滤",所以它一定先挨一次
    (mcp_server.py:4103-4104),failover_attempts 也才有它的记录。
    """
    post_resp = _FakeResponse(400, {"error": "bad request"}, "Bad Request")
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "agnes"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_ERROR"
    assert [a["provider"] for a in out["failover_attempts"]] == ["agnes", "token6688"]
    assert len(fake_mod.clients) == 2


async def test_image_gen_token6688_key_read_from_env_var(monkeypatch):
    """token6688 的第二条真实凭据通道:env TOKEN6688_API_KEY + 缺省 base。

    为什么要单独测:本机 .env 的 LLM_PROVIDERS 里**没有** token6688 条目,
    生产真实形态就是 free_provider_registry.py:811 登记的 key_env_vars
    (mcp_server.py:4121-4127 cfg 取不到时才落到 env / TOKEN6688_BASE_URL)。
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "llm_providers", "")
    monkeypatch.setenv("TOKEN6688_API_KEY", "sk-t6688-env")
    b64 = base64.b64encode(b"image_data").decode()
    fake_mod = _inject_fake_httpx(monkeypatch, _FakeResponse(200, {
        "data": [{"b64_json": b64}]
    }))

    out = await _tool_image_generation({"prompt": "test"})
    assert out["ok"] is True
    assert out["provider"] == "token6688"
    url, _, headers = fake_mod.clients[0].post_calls[0]
    assert url == "https://k.token6688.com/v1/images/generations"
    assert headers["Authorization"] == "Bearer sk-t6688-env"


# =============================================================================
# _tool_image_generation:provider API 错误
# =============================================================================


async def test_image_gen_provider_error_400(token6688_configured, monkeypatch):
    """provider 返回 4xx → PROVIDER_ERROR。"""
    post_resp = _FakeResponse(400, {"error": "bad request"}, "Bad Request")
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "token6688"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_ERROR"
    assert out["saved_path"] is None


async def test_image_gen_provider_error_500(token6688_configured, monkeypatch):
    """provider 返回 500 → PROVIDER_ERROR。"""
    post_resp = _FakeResponse(500, {}, "Internal Server Error")
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "token6688"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_ERROR"


async def test_image_gen_empty_data(token6688_configured, monkeypatch):
    """provider 返回空 data → EMPTY_RESULT。"""
    post_resp = _FakeResponse(200, {"data": []})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "token6688"})
    assert out["ok"] is False
    assert out["errorCode"] == "EMPTY_RESULT"


async def test_image_gen_body_error_with_http_200(token6688_configured, monkeypatch):
    """HTTP 200 但 body.error 非空 → PROVIDER_ERROR(只看状态码会把失败当成功)。

    为什么单独一条:token6688 同步端点 40s 后开始发保活字节,状态码已固定 200,
    上游生成失败也改不回 4xx → 必须查 body.error(mcp_server.py:4207-4216,
    源码引的是官方指南)。
    """
    post_resp = _FakeResponse(200, {"error": {"message": "余额不足"}})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "token6688"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_ERROR"
    assert "余额不足" in out["error"]


async def test_image_gen_token6688_precheck_blocks_before_upstream(
    token6688_configured, monkeypatch,
):
    """目录元数据判参数非法 → INVALID_PARAMS,且一次上游都不发。

    为什么测它:token6688 分支提交前拿 ai_model_config_models.param_schema 做
    fail-fast(mcp_server.py:4158-4179),这是整条图片链上唯一"钱还没花就被拦"的
    错误码,也是 get_model_metadata 在测试里必须被 mock 的那个调用点。
    """
    async def _strict_meta(model_id: str):
        return {"param_schema": {"_max_prompt_chars": 3}, "max_prompt_chars": 3}

    monkeypatch.setattr(
        "app.services.token6688_catalog.get_model_metadata", _strict_meta,
    )
    fake_mod = _inject_fake_httpx(monkeypatch, _FakeResponse(200, {"data": []}))

    out = await _tool_image_generation({
        "prompt": "这段提示词明显超过了三个字符的上限", "provider": "token6688",
    })
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_PARAMS"
    assert "不产生费用" in out["error"]
    # 链上只此一家 → 出参是编排层的汇总响应(4341-4348),只保留 errorCode/error,
    # 单家分支独有的 model/hint 不进汇总,尝试明细在 failover_attempts 里
    assert [a["errorCode"] for a in out["failover_attempts"]] == ["INVALID_PARAMS"]
    assert fake_mod.clients == []


async def test_image_gen_no_url_no_b64(token6688_configured, monkeypatch):
    """data 项无 url 无 b64_json → EMPTY_RESULT。"""
    post_resp = _FakeResponse(200, {"data": [{"other_field": "value"}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "test", "provider": "token6688"})
    assert out["ok"] is False
    assert out["errorCode"] == "EMPTY_RESULT"


# =============================================================================
# _tool_image_generation:成功(无 save_path)
# =============================================================================


async def test_image_gen_success_b64_no_save(token6688_configured, monkeypatch):
    """成功生成(b64_json,无 save_path)→ 返回 image_url + saved_path=None。"""
    original_bytes = b"\x89PNG test image data"
    b64 = base64.b64encode(original_bytes).decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "a cat", "provider": "token6688", "size": "512x512",
    })
    assert out["ok"] is True
    assert out["provider"] == "token6688"
    assert out["saved_path"] is None
    assert out["file_size_bytes"] == 0  # 无 save_path 时为 0
    assert "image_url" in out
    assert "data:image/png;base64," in out["image_url"]
    # size 回显来自 payload(mcp_server.py:4261 payload.get("size")),token6688
    # 官方参数表没有 size(用 aspect_ratio/resolution)→ 传了也不发,回显 None
    assert out["size"] is None


async def test_image_gen_success_agnes_echoes_size(agnes_configured, monkeypatch):
    """agnes 分支保留 size 参数并原样回显 —— 与 token6688 的唯一 payload 差异。"""
    b64 = base64.b64encode(b"\x89PNG agnes image").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "a cat", "provider": "agnes", "size": "512x512",
    })
    assert out["ok"] is True
    assert out["provider"] == "agnes"
    assert out["size"] == "512x512"


async def test_image_gen_success_url_no_save(token6688_configured, monkeypatch):
    """成功生成(URL,无 save_path)→ 返回 image_url。"""
    post_resp = _FakeResponse(200, {
        "data": [{"url": "https://cdn.example.com/generated.png"}]
    })
    _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({"prompt": "a dog", "provider": "token6688"})
    assert out["ok"] is True
    assert out["saved_path"] is None
    assert out["image_url"] == "https://cdn.example.com/generated.png"


# =============================================================================
# _tool_image_generation:save_path 落地
# =============================================================================


async def test_image_gen_save_b64_to_file(
    token6688_configured, monkeypatch, allow_workspace_path, tmp_path,
):
    """save_path + b64_json → 写入文件 + 返回 saved_path + file_size_bytes。"""
    original_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200
    b64 = base64.b64encode(original_bytes).decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    save_path = str(tmp_path / "saved_image.png")
    out = await _tool_image_generation({
        "prompt": "test image", "provider": "token6688",
        "save_path": save_path,
    })
    assert out["ok"] is True
    assert out["saved_path"] == save_path
    assert out["file_size_bytes"] == len(original_bytes)
    # 验证文件确实写入
    assert Path(save_path).exists()
    assert Path(save_path).read_bytes() == original_bytes


async def test_image_gen_save_url_to_file(
    token6688_configured, monkeypatch, allow_workspace_path, tmp_path,
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
        "prompt": "url test", "provider": "token6688",
        "save_path": save_path,
    })
    assert out["ok"] is True
    assert out["saved_path"] == save_path
    assert out["file_size_bytes"] == len(image_bytes)
    assert Path(save_path).exists()
    assert Path(save_path).read_bytes() == image_bytes


async def test_image_gen_save_creates_parent_dirs(
    token6688_configured, monkeypatch, allow_workspace_path, tmp_path,
):
    """save_path 父目录不存在时自动创建。"""
    original_bytes = b"image data"
    b64 = base64.b64encode(original_bytes).decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    save_path = str(tmp_path / "subdir" / "deep" / "output.png")
    out = await _tool_image_generation({
        "prompt": "test", "provider": "token6688",
        "save_path": save_path,
    })
    assert out["ok"] is True
    assert Path(save_path).exists()


async def test_image_gen_save_invalid_extension(
    token6688_configured, monkeypatch,
):
    """save_path 后缀非图片格式 → INVALID_EXTENSION,且不发上游请求。

    为什么不花这次调用:save_path 的格式/白名单错误与厂商无关,校验前置在链构造
    之前 fail-fast(mcp_server.py:4305-4315),省掉一次付费出图。
    """
    b64 = base64.b64encode(b"data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "test", "provider": "token6688",
        "save_path": "/tmp/test.txt",
    })
    assert out["ok"] is False
    assert out["errorCode"] == "INVALID_EXTENSION"
    assert out["saved_path"] is None
    assert fake_mod.clients == []


async def test_image_gen_save_path_not_allowed(
    token6688_configured, monkeypatch,
):
    """save_path 不在工作区 → PATH_NOT_ALLOWED(同样是发请求前的前置校验)。"""
    b64 = base64.b64encode(b"data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    # _validate_path_in_workspace 走真实实现:/outside/... 不在 MCP_WORKSPACE_ROOTS 内
    out = await _tool_image_generation({
        "prompt": "test", "provider": "token6688",
        "save_path": "/outside/workspace/test.png",
    })
    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_ALLOWED"
    assert fake_mod.clients == []


async def test_image_gen_save_image_too_large(
    token6688_configured, monkeypatch, allow_workspace_path, tmp_path,
):
    """图片 > 5MB → IMAGE_TOO_LARGE。"""
    large_bytes = b"\x00" * (_MAX_IMAGE_BYTES + 1)
    b64 = base64.b64encode(large_bytes).decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    _inject_fake_httpx(monkeypatch, post_resp)

    save_path = str(tmp_path / "too_large.png")
    out = await _tool_image_generation({
        "prompt": "big", "provider": "token6688",
        "save_path": save_path,
    })
    assert out["ok"] is False
    assert out["errorCode"] == "IMAGE_TOO_LARGE"
    assert out["saved_path"] is None


async def test_image_gen_save_fetch_failed(
    token6688_configured, monkeypatch, allow_workspace_path, tmp_path,
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
        "prompt": "test", "provider": "token6688",
        "save_path": save_path,
    })
    assert out["ok"] is False
    assert out["errorCode"] == "IMAGE_FETCH_FAILED"
    assert out["saved_path"] is None


# =============================================================================
# _tool_image_generation:httpx 缺失
# =============================================================================


async def test_image_gen_httpx_missing(token6688_configured, monkeypatch):
    """httpx 未安装 → DEP_MISSING。"""
    monkeypatch.setitem(sys.modules, "httpx", None)
    out = await _tool_image_generation({"prompt": "test", "provider": "token6688"})
    assert out["ok"] is False
    assert out["errorCode"] == "DEP_MISSING"


# =============================================================================
# _tool_image_generation:异常处理
# =============================================================================


async def test_image_gen_exception_handled(token6688_configured, monkeypatch):
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

    out = await _tool_image_generation({"prompt": "test", "provider": "token6688"})
    assert out["ok"] is False
    assert out["errorCode"] == "GENERATION_FAILED"


# =============================================================================
# _tool_image_generation:provider API 调用参数
# =============================================================================


async def test_image_gen_token6688_payload_omits_size(token6688_configured, monkeypatch):
    """token6688 的 post 请求:补 /v1 的端点 + payload 严格三键 + Bearer 鉴权。

    为什么断 payload 的键集合:官方 gpt-image-2.5 系列参数表里没有 size(用
    aspect_ratio/resolution),旧版固定注入 size 会被提交前校验拦截,2026-09-21 起
    不再发送(mcp_server.py:4128-4130);再塞回去就是线上生图失败。
    """
    b64 = base64.b64encode(b"data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "a landscape", "provider": "token6688", "size": "1024x1024",
    })
    assert out["ok"] is True
    client = fake_mod.clients[0]
    assert len(client.post_calls) == 1
    url, json_body, headers = client.post_calls[0]
    # fixture 的 api_base 不带 /v1,代码补齐后才是真实端点(mcp_server.py:4121-4125)
    assert url == "https://k.token6688.com/v1/images/generations"
    assert json_body == {
        "prompt": "a landscape", "model": "gpt-image-2", "n": 1,
    }
    assert headers["Authorization"] == "Bearer test_token6688_key"
    assert out["model"] == "gpt-image-2"


async def test_image_gen_agnes_payload_carries_size(agnes_configured, monkeypatch):
    """agnes 的 post 请求:端点原样用 cfg.api_base,payload 带 size。

    与 token6688 相反:agnes-image-2.5-flash 认 size,所以它保留(mcp_server.py:4143);
    默认模型名 2026-09-20 修过一次(原硬编码 agnes-image-v1 是无效 ID,生图必失败)。
    """
    b64 = base64.b64encode(b"data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "a landscape", "provider": "agnes", "size": "768x1024",
    })
    assert out["ok"] is True
    url, json_body, headers = fake_mod.clients[0].post_calls[0]
    assert url == "https://apihub.agnes-ai.com/v1/images/generations"
    assert json_body == {
        "prompt": "a landscape", "model": "agnes-image-2.5-flash",
        "size": "768x1024", "n": 1,
    }
    assert headers["Authorization"] == "Bearer test_agnes_key"


async def test_image_gen_agnes_model_argument_overrides_default(
    agnes_configured, monkeypatch,
):
    """arguments.model 覆盖 agnes 默认模型(mcp_server.py:4139-4142)。"""
    b64 = base64.b64encode(b"data").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "test", "provider": "agnes", "model": "agnes-image-2.1-flash",
    })
    assert out["ok"] is True
    assert out["model"] == "agnes-image-2.1-flash"
    _, json_body, _ = fake_mod.clients[0].post_calls[0]
    assert json_body["model"] == "agnes-image-2.1-flash"


# =============================================================================
# _tool_image_generation:返回结构完整性
# =============================================================================


async def test_image_gen_success_return_fields(token6688_configured, monkeypatch):
    """成功返回结构钉死为 11 个字段,不多不少。

    为什么要 set(out) 相等而不是逐个 in:quality/style 自 2026-09-21 起既不进 payload
    也不再伪回显(mcp_server.py:4130 成型 payload + 4259-4267 返回体;旧实现用
    result.setdefault 把入参原样吐回去,看着像生效、上游其实没收到),
    image_generation 的 input_schema 也已移除这两个键 —— 仍带 quality 的是
    image_edit(它真实转发)。传进来只会被丢掉。
    """
    b64 = base64.b64encode(b"img").decode()
    post_resp = _FakeResponse(200, {"data": [{"b64_json": b64}]})
    fake_mod = _inject_fake_httpx(monkeypatch, post_resp)

    out = await _tool_image_generation({
        "prompt": "test", "provider": "token6688",
        "size": "512x512", "quality": "hd", "style": "artistic",
    })
    assert out["ok"] is True
    assert set(out) == {
        "tool", "ok", "prompt", "image_url", "size", "provider", "model",
        "saved_path", "file_size_bytes", "created_at", "message",
    }
    assert out["prompt"] == "test"
    assert out["image_url"].startswith("data:image/png;base64,")
    assert out["provider"] == "token6688"
    assert out["saved_path"] is None
    assert out["file_size_bytes"] == 0
    _, json_body, _ = fake_mod.clients[0].post_calls[0]
    assert "quality" not in json_body
    assert "style" not in json_body


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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

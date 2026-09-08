# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""token6688_provider.py 单元测试。

Token6688 聚合网关(https://k.token6688.com)适配器:OpenAI 兼容单 key 全模态。

测试覆盖:
- __init__:默认 base_url / 自定义 api_base / configured 属性
- _api_base_v1:/v1 后缀自动兼容(不重复拼接)
- generate_image:成功(url/b64_json)/ 空结果抛 ProviderError
- tts:成功返回音频字节 / 非 audio 响应抛 ProviderError
- stt:multipart 成功 / 4xx 抛 ProviderError
- embeddings:成功提取向量
- generate_video:同步直返形态 / job 提交+轮询形态 / 任务失败 / 无 task_id
- _extract_video_url / _extract_task_id 提取逻辑
- 接线:get_provider 路由 / llm_gateway 前缀映射 / free_provider_registry 注册
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.providers import get_provider
from app.providers.base_provider import ProviderError
from app.providers.openai_provider import OpenAIProvider
from app.providers.token6688_provider import Token6688Provider


@contextmanager
def _patch_http_client(fake_client: Any) -> Iterator[None]:
    """Patch get_http_client in base_provider(_request 用)和 token6688_provider(tts/stt 用)。"""
    with patch("app.providers.base_provider.get_http_client", return_value=fake_client), \
         patch("app.providers.token6688_provider.get_http_client", return_value=fake_client):
        yield


def _json_resp(status_code: int = 200, data: Any = None) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = data
    resp.headers = {"content-type": "application/json"}
    resp.text = str(data)
    resp.content = b"{}"
    return resp


# =============================================================================
# __init__ / URL 构造
# =============================================================================


def test_init_default_base_url():
    p = Token6688Provider(api_key="tk-1")
    assert p.base_url == "https://k.token6688.com"
    assert p.api_key == "tk-1"
    assert p.timeout == 120.0


def test_init_custom_api_base():
    p = Token6688Provider(api_key="k", api_base="https://gw.example.com")
    assert p.base_url == "https://gw.example.com"


def test_configured_property():
    assert Token6688Provider(api_key="k").configured is True
    assert Token6688Provider(api_key="").configured is False


def test_inherits_openai_provider():
    assert isinstance(Token6688Provider(api_key="k"), OpenAIProvider)


def test_api_base_v1_appends():
    assert Token6688Provider("k")._api_base_v1() == "https://k.token6688.com/v1"


def test_api_base_v1_no_double_append():
    p = Token6688Provider("k", api_base="https://k.token6688.com/v1")
    assert p._api_base_v1() == "https://k.token6688.com/v1"


def test_headers_bearer():
    headers = Token6688Provider("tk-secret")._headers()
    assert headers["Authorization"] == "Bearer tk-secret"


# =============================================================================
# generate_image
# =============================================================================


async def test_generate_image_url_success():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"data": [{"url": "https://img.example.com/a.png"}]}))
    with _patch_http_client(client):
        result = await p.generate_image("一只猫", size="1024x1024")
    assert result["provider"] == "token6688"
    assert result["images"] == [{"url": "https://img.example.com/a.png"}]


async def test_generate_image_b64_success():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"data": [{"b64_json": "AAAA"}]}))
    with _patch_http_client(client):
        result = await p.generate_image("test")
    assert result["images"] == [{"b64_json": "AAAA"}]


async def test_generate_image_empty_raises():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"data": []}))
    with _patch_http_client(client):
        with pytest.raises(ProviderError):
            await p.generate_image("test")


async def test_generate_image_uses_default_model_and_url():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"data": [{"url": "https://x/y.png"}]}))
    with _patch_http_client(client):
        await p.generate_image("test")
    args, kwargs = client.request.call_args
    assert args[0] == "POST"
    assert args[1] == "https://k.token6688.com/v1/images/generations"
    assert kwargs["json"]["model"] == "gpt-image-1"


# =============================================================================
# tts / stt / embeddings
# =============================================================================


async def test_tts_success_returns_audio_bytes():
    p = Token6688Provider("k")
    client = MagicMock()
    resp = MagicMock()
    resp.status_code = 200
    resp.headers = {"content-type": "audio/mpeg"}
    resp.content = b"ID3fakeaudio"
    client.post = AsyncMock(return_value=resp)
    with _patch_http_client(client):
        audio, content_type = await p.tts("你好", voice="alloy")
    assert audio == b"ID3fakeaudio"
    assert content_type == "audio/mpeg"
    args, _ = client.post.call_args
    assert args[0] == "https://k.token6688.com/v1/audio/speech"


async def test_tts_error_response_raises():
    p = Token6688Provider("k")
    client = MagicMock()
    resp = MagicMock()
    resp.status_code = 401
    resp.headers = {"content-type": "application/json"}
    resp.text = '{"error": "invalid key"}'
    resp.content = b"x"
    client.post = AsyncMock(return_value=resp)
    with _patch_http_client(client):
        with pytest.raises(ProviderError):
            await p.tts("你好")


async def test_stt_success():
    p = Token6688Provider("k")
    client = MagicMock()
    client.post = AsyncMock(return_value=_json_resp(200, {"text": "识别结果"}))
    with _patch_http_client(client):
        result = await p.stt(b"audiobytes", "a.wav", language="zh")
    assert result["text"] == "识别结果"
    args, kwargs = client.post.call_args
    assert args[0] == "https://k.token6688.com/v1/audio/transcriptions"
    assert kwargs["data"]["model"] == "whisper-1"
    assert kwargs["files"]["file"][0] == "a.wav"


async def test_stt_4xx_raises():
    p = Token6688Provider("k")
    client = MagicMock()
    client.post = AsyncMock(return_value=_json_resp(400, {"error": "bad"}))
    with _patch_http_client(client):
        with pytest.raises(ProviderError):
            await p.stt(b"x")


async def test_embeddings_success():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(
        return_value=_json_resp(200, {"data": [{"embedding": [0.1, 0.2]}, {"embedding": [0.3]}]})
    )
    with _patch_http_client(client):
        result = await p.embeddings(["a", "b"])
    assert result["embeddings"] == [[0.1, 0.2], [0.3]]


# =============================================================================
# generate_video(同步直返 / job 轮询两种形态)
# =============================================================================


async def test_generate_video_sync_url_shape():
    """提交响应直接含视频 URL → 同步直返,不轮询。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"video_url": "https://cdn.example.com/v.mp4"}))
    with _patch_http_client(client):
        result = await p.generate_video("火柴人跳舞", "", duration=5)
    assert result["provider"] == "token6688"
    assert result["video_url"] == "https://cdn.example.com/v.mp4"
    assert result["duration"] == 5
    # 只应有一次提交请求,无轮询
    assert client.request.call_count == 1


async def test_generate_video_job_polling_shape():
    """提交返回 task_id → 轮询 GET 至 succeeded。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(side_effect=[
        _json_resp(200, {"task_id": "job-42"}),
        _json_resp(200, {"status": "processing"}),
        _json_resp(200, {"status": "succeeded", "data": [{"url": "https://cdn/x.mp4"}]}),
    ])
    with _patch_http_client(client):
        result = await p.generate_video("cat", "pixverse-c1", duration=8)
    assert result["task_id"] == "job-42"
    assert result["video_url"] == "https://cdn/x.mp4"
    assert result["model"] == "pixverse-c1"


async def test_generate_video_job_failed_status():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(side_effect=[
        _json_resp(200, {"id": "job-9"}),
        _json_resp(200, {"status": "failed", "error": "content blocked"}),
    ])
    with _patch_http_client(client):
        with pytest.raises(ProviderError, match="failed"):
            await p.generate_video("x", "")


async def test_generate_video_no_task_id_raises():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"foo": "bar"}))
    with _patch_http_client(client):
        with pytest.raises(ProviderError, match="task_id"):
            await p.generate_video("x", "")


def test_extract_task_id_variants():
    assert Token6688Provider._extract_task_id({"task_id": "t1"}) == "t1"
    assert Token6688Provider._extract_task_id({"jobId": 77}) == "77"
    assert Token6688Provider._extract_task_id({"data": {"id": "inner"}}) == "inner"
    assert Token6688Provider._extract_task_id({"none": 1}) == ""


def test_extract_video_url_variants():
    assert Token6688Provider._extract_video_url({"url": "https://a/v.mp4"}) == "https://a/v.mp4"
    assert Token6688Provider._extract_video_url({"output": [{"video_url": "https://b/v.mp4"}]}) == "https://b/v.mp4"
    assert Token6688Provider._extract_video_url({"status": "ok"}) == ""


# =============================================================================
# 接线验证(get_provider / llm_gateway / free_provider_registry)
# =============================================================================


def test_get_provider_routes_t6688_prefix():
    p = get_provider("t6688/gm-3.8-flash", "k", None)
    assert isinstance(p, Token6688Provider)


def test_llm_gateway_prefix_mapping():
    from app.core.llm_gateway import _model_to_provider_code

    assert _model_to_provider_code("t6688/gm-3.8-flash") == "token6688"


def test_llm_gateway_resolve_provider():
    from app.core.llm_gateway import LLMGateway

    api_key, api_base, litellm_model = LLMGateway._resolve_provider("t6688/gm-3.8-flash")
    assert api_base == "https://k.token6688.com"
    assert litellm_model == "openai/gm-3.8-flash"


def test_free_provider_registry_contains_token6688():
    from app.services.free_provider_registry import free_provider_registry

    entry = free_provider_registry.get_by_code("token6688")
    assert entry is not None
    assert entry.key_env_vars == ["TOKEN6688_API_KEY"]
    assert entry.default_base_url == "https://k.token6688.com"


def test_provider_caps_registered():
    from app.core.provider_caps import get_provider_cap

    cap = get_provider_cap("token6688")
    assert cap.supports_vision is True
    assert cap.default_timeout == 120


def test_video_orchestration_instantiates_token6688(monkeypatch):
    """token6688 + key 已配置 → 实例化成功且进入默认优先级首位。"""
    from app.services import video_generation as vg

    monkeypatch.setenv("TOKEN6688_API_KEY", "tk-test")
    monkeypatch.delenv("VIDEO_PROVIDER", raising=False)
    inst = vg._instantiate("token6688")
    assert isinstance(inst, Token6688Provider)
    names = [n for n, _ in vg._configured_providers()]
    assert names[0] == "token6688"


def test_video_orchestration_skips_when_unconfigured(monkeypatch):
    from app.services import video_generation as vg

    monkeypatch.delenv("TOKEN6688_API_KEY", raising=False)
    # .env 占位里 LLM_PROVIDERS.token6688.api_key 为空 → 应跳过(不进 fallback 链)
    assert vg._instantiate("token6688") is None

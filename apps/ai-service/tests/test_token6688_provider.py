# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""token6688_provider.py 单元测试(按官方 /v1/skills/guide v2026-07-11 校准)。

测试覆盖:
- __init__:默认 base_url / 自定义 api_base / configured 属性
- _api_base_v1:/v1 后缀自动兼容(不重复拼接)
- list_models:/v1/skills/models 免鉴权映射 OpenAI 风格 + 降级 /v1/models
- generate_image:同步成功 / 200+body.error 抛错(官方同步端点特有) / 空结果
- generate_video:扁平形状断言(mode/images/client_request_id/prompt 必填)
  + 同步直返 / job 轮询(/v1/tasks/{id},is_final+state+output_url) / 失败
- generate_music / upload_file / get_balance / list_voices
- tts:成功返回音频字节 / 非 audio 响应抛错
- stt / embeddings:透传(平台暂无端点,保留备用)
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
# list_models(免鉴权 /v1/skills/models)
# =============================================================================


async def test_list_models_from_skills_catalog():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"models": [
        {"name": "gpt-5.4", "display_name": "GT-5.4", "api_endpoint": "/v1/chat/completions",
         "capabilities": ["text"]},
        {"name": "seedance-2-5", "display_name": "Seedance 2.5", "api_endpoint": None,
         "capabilities": ["文生视频", "图生视频"]},
    ]}))
    with _patch_http_client(client):
        models = await p.list_models()
    assert [m["id"] for m in models] == ["gpt-5.4", "seedance-2-5"]
    assert models[0]["owned_by"] == "token6688"
    args, _ = client.request.call_args
    assert args[1].endswith("/v1/skills/models")


# =============================================================================
# generate_image(同步 OpenAI Images;200 必查 body.error)
# =============================================================================


async def test_generate_image_url_success():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"data": [{"url": "https://img.example.com/a.png"}]}))
    with _patch_http_client(client):
        result = await p.generate_image("一只猫", size="1024x1024")
    assert result["provider"] == "token6688"
    assert result["images"] == [{"url": "https://img.example.com/a.png"}]


async def test_generate_image_body_error_on_200_raises():
    """官方指南:同步端点 200 不等于成功,必须检查 body.error。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(
        200, {"error": {"message": "内容被安全策略拦截", "class": "content_policy_violation"}}))
    with _patch_http_client(client):
        with pytest.raises(ProviderError, match="安全策略"):
            await p.generate_image("x")


async def test_generate_image_default_model_gpt_image_2():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"data": [{"url": "https://x/y.png"}]}))
    with _patch_http_client(client):
        await p.generate_image("test")
    args, kwargs = client.request.call_args
    assert args[0] == "POST"
    assert args[1] == "https://k.token6688.com/v1/images/generations"
    assert kwargs["json"]["model"] == "gpt-image-2"


async def test_generate_image_empty_raises():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"data": []}))
    with _patch_http_client(client):
        with pytest.raises(ProviderError):
            await p.generate_image("test")


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
    args, kwargs = client.post.call_args
    assert args[0] == "https://k.token6688.com/v1/audio/speech"
    # 官方 schema:voice ∈ {alloy,echo,fable,onyx,nova,shimmer},response_format 默认 mp3
    assert kwargs["json"]["voice"] == "alloy"
    assert kwargs["json"]["response_format"] == "mp3"
    assert kwargs["json"]["model"] == "tts-1-hd"


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


async def test_stt_passthrough():
    p = Token6688Provider("k")
    client = MagicMock()
    client.post = AsyncMock(return_value=_json_resp(200, {"text": "识别结果"}))
    with _patch_http_client(client):
        result = await p.stt(b"audiobytes", "a.wav", language="zh")
    assert result["text"] == "识别结果"


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
# generate_video(扁平形状 → /v1/tasks/{id} 轮询)
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
    assert client.request.call_count == 1


async def test_generate_video_flat_payload_and_poll():
    """官方校准:扁平形状(mode/duration/images 顶层)+ 轮询 GET /v1/tasks/{id} 读 output_url。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(side_effect=[
        _json_resp(200, {"task_id": "job-42"}),
        _json_resp(200, {"is_final": False, "status": "processing", "progress": 30}),
        _json_resp(200, {"is_final": True, "state": "success", "status": "completed",
                          "output_url": "https://cdn/x.mp4"}),
    ])
    with _patch_http_client(client):
        result = await p.generate_video("猫在草地上奔跑", "seedance-2-5", duration=8)
    assert result["task_id"] == "job-42"
    assert result["video_url"] == "https://cdn/x.mp4"
    assert result["model"] == "seedance-2-5"
    # 提交体断言:扁平形状 + prompt 必填 + 幂等 id + 默认模型
    submit_args, submit_kwargs = client.request.call_args_list[0]
    assert submit_args[0] == "POST"
    assert submit_args[1] == "https://k.token6688.com/v1/videos/generations"
    body = submit_kwargs["json"]
    assert body["model"] == "seedance-2-5"
    assert body["prompt"] == "猫在草地上奔跑"
    assert body["mode"] == "text-to-video"
    assert body["duration"] == "8"
    assert body.get("client_request_id")
    assert "params" not in body  # 扁平形状,严禁信封
    # 轮询 URL 断言:/v1/tasks/{task_id}
    poll_args, _ = client.request.call_args_list[-1]
    assert poll_args[1] == "https://k.token6688.com/v1/tasks/job-42"


async def test_generate_video_image_to_first_frame_mode():
    """传图自动切 first-frame 模式,images 数组扁平透传。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(side_effect=[
        _json_resp(200, {"task_id": "j2"}),
        _json_resp(200, {"is_final": True, "state": "success",
                          "result": {"videos": [{"url": "https://cdn/i2v.mp4"}]}}),
    ])
    with _patch_http_client(client):
        result = await p.generate_video("让画面动起来", "", duration=5,
                                        image="https://pub.example.com/frame.jpg")
    assert result["video_url"] == "https://cdn/i2v.mp4"
    body = client.request.call_args_list[0][1]["json"]
    assert body["mode"] == "first-frame"
    assert body["images"] == ["https://pub.example.com/frame.jpg"]


async def test_generate_video_job_failed_status():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(side_effect=[
        _json_resp(200, {"task_id": "job-9"}),
        _json_resp(200, {"is_final": True, "state": "failed", "status": "failed",
                          "error": "content blocked"}),
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


def test_extract_media_url_variants():
    assert Token6688Provider._extract_media_url({"output_url": "https://a/v.mp4"}) == "https://a/v.mp4"
    assert Token6688Provider._extract_media_url({"result_url": "https://r/img.png"}) == "https://r/img.png"
    assert Token6688Provider._extract_media_url({"result": {"videos": [{"url": "https://b/v.mp4"}]}}) == "https://b/v.mp4"
    assert Token6688Provider._extract_media_url({"status": "ok"}) == ""


# =============================================================================
# music / upload_file / balance / voices
# =============================================================================


async def test_generate_music_task_flow():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(side_effect=[
        _json_resp(200, {"task_id": "m-1"}),
        _json_resp(200, {"is_final": True, "state": "success", "output_url": "https://cdn/song.mp3"}),
    ])
    with _patch_http_client(client):
        result = await p.generate_music("欢快的电子乐", style="EDM", title="Test")
    assert result["audio_url"] == "https://cdn/song.mp3"
    body = client.request.call_args_list[0][1]["json"]
    assert body["model"] == "music"
    assert body["style"] == "EDM"


async def test_upload_file_returns_url():
    p = Token6688Provider("k")
    client = MagicMock()
    client.post = AsyncMock(return_value=_json_resp(200, {"url": "https://cdn.6688.com/f/abc.png"}))
    with _patch_http_client(client):
        url = await p.upload_file(b"imgbytes", "cat.png")
    assert url == "https://cdn.6688.com/f/abc.png"
    args, kwargs = client.post.call_args
    assert args[0] == "https://k.token6688.com/v1/files"
    assert kwargs["files"]["file"][0] == "cat.png"


async def test_get_balance_parses_formatted_strings():
    """官方:balance/available_balance/frozen 为 '$49.964555' 格式字符串。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(
        200, {"balance": "$49.964555", "available_balance": "$40.00", "frozen": "$9.964555"}))
    with _patch_http_client(client):
        result = await p.get_balance()
    assert result["balance"] == pytest.approx(49.964555)
    assert result["available_balance"] == 40.0
    assert result["frozen"] == pytest.approx(9.964555)


async def test_list_voices():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"data": [{"voice_id": "v1", "name": "my-voice"}]}))
    with _patch_http_client(client):
        voices = await p.list_voices()
    assert voices[0]["voice_id"] == "v1"


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
    """gateway t6688/ 解析:api_base 必须以 /v1 结尾(LiteLLM openai/ 直连要求,
    2026-09-08 假 key 实测无 /v1 会打到网站首页 HTML)。"""
    from app.core.llm_gateway import LLMGateway

    api_key, api_base, litellm_model = LLMGateway._resolve_provider("t6688/gm-3.8-flash")
    assert api_base == "https://k.token6688.com/v1"
    assert litellm_model == "openai/gm-3.8-flash"


def test_free_provider_registry_contains_token6688():
    from app.services.free_provider_registry import free_provider_registry

    entry = free_provider_registry.get_by_code("token6688")
    assert entry is not None
    assert entry.key_env_vars == ["TOKEN6688_API_KEY"]
    assert entry.default_base_url == "https://k.token6688.com"
    assert entry.default_models[0].startswith("t6688/")


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

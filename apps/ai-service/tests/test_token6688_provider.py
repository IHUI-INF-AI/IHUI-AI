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

import hashlib
import hmac
import json
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
    """Patch get_http_client 的全部引用点(base/_request、token6688(tts/stt/upload)、
    openai(astream/complete 流式)、openai_provider 内部直引)。"""
    with patch("app.providers.base_provider.get_http_client", return_value=fake_client), \
         patch("app.providers.openai_provider.get_http_client", return_value=fake_client), \
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
# 多模态输入归一化(data: URI → /v1/files 公网 URL;官方多模态只收 URL)
# =============================================================================


def _vision_messages(data_uri: str) -> list[dict[str, Any]]:
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "描述这张图"},
                {"type": "image_url", "image_url": {"url": data_uri}},
            ],
        }
    ]


_DATA_URI = "data:image/png;base64,aGVsbG8="


async def test_normalize_converts_data_uri_to_public_url():
    p = Token6688Provider("k")
    client = MagicMock()
    client.post = AsyncMock(return_value=_json_resp(200, {"url": "https://f.example.com/v.png"}))
    with _patch_http_client(client):
        out = await p._normalize_vision_inputs(_vision_messages(_DATA_URI))
    part = out[0]["content"][1]
    assert part["image_url"]["url"] == "https://f.example.com/v.png"
    # 上传走 POST /v1/files
    args, _ = client.post.call_args
    assert args[0].endswith("/v1/files")


async def test_normalize_http_url_untouched_and_no_upload():
    p = Token6688Provider("k")
    client = MagicMock()
    client.post = AsyncMock()
    msgs = _vision_messages("https://img.example.com/a.jpg")
    with _patch_http_client(client):
        out = await p._normalize_vision_inputs(msgs)
    assert out[0]["content"][1]["image_url"]["url"] == "https://img.example.com/a.jpg"
    client.post.assert_not_called()


async def test_normalize_upload_failure_keeps_data_uri():
    p = Token6688Provider("k")
    client = MagicMock()
    client.post = AsyncMock(return_value=_json_resp(401, {"error": "invalid key"}))
    with _patch_http_client(client):
        out = await p._normalize_vision_inputs(_vision_messages(_DATA_URI))
    assert out[0]["content"][1]["image_url"]["url"] == _DATA_URI


async def test_normalize_no_mutation_of_caller_messages():
    p = Token6688Provider("k")
    client = MagicMock()
    client.post = AsyncMock(return_value=_json_resp(200, {"url": "https://f.example.com/v.png"}))
    msgs = _vision_messages(_DATA_URI)
    with _patch_http_client(client):
        await p._normalize_vision_inputs(msgs)
    assert msgs[0]["content"][1]["image_url"]["url"] == _DATA_URI


async def test_normalize_no_data_uri_short_circuit_returns_same_object():
    p = Token6688Provider("k")
    msgs = [{"role": "user", "content": "纯文本"}]
    out = await p._normalize_vision_inputs(msgs)
    assert out is msgs


async def test_complete_swaps_data_uri_before_send():
    """complete 集成:payload 里 image_url 应为上传后的公网 URL。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.post = AsyncMock(return_value=_json_resp(200, {"url": "https://f.example.com/v.png"}))
    client.request = AsyncMock(
        return_value=_json_resp(200, {"choices": [{"message": {"content": "ok"}}], "usage": {}})
    )
    with _patch_http_client(client):
        result = await p.complete(_vision_messages(_DATA_URI), "gpt-5.4")
    assert result["content"] == "ok"
    args, kwargs = client.request.call_args
    sent_content = kwargs["json"]["messages"][0]["content"]
    assert sent_content[1]["image_url"]["url"] == "https://f.example.com/v.png"


async def test_astream_normalizes_before_stream():
    """astream 也走归一化(不校验流式细节,只断言上传被调用)。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.post = AsyncMock(return_value=_json_resp(200, {"url": "https://f.example.com/v.png"}))
    # client.stream 上下文管理器:模拟一个空 SSE 流
    import contextlib as _cl

    resp = MagicMock()
    resp.status_code = 200

    @ _cl.asynccontextmanager
    async def fake_stream(*a, **k):
        yield resp

    async def _aiter_lines():
        return
        yield  # pragma: no cover

    resp.aiter_lines = _aiter_lines
    client.stream = fake_stream
    with _patch_http_client(client):
        events = [ev async for ev in p.astream(_vision_messages(_DATA_URI), "gpt-5.4")]
    client.post.assert_awaited_once()
    assert any(ev.get("type") == "done" for ev in events)


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


@pytest.mark.asyncio
async def test_generate_video_callback_fields_reach_submit_body():
    """官方 webhook:kwargs 里的 callback_url/callback_secret 透传到提交体(扁平形状)。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"task_id": "job-cb"}))
    with _patch_http_client(client):
        await p.generate_video(
            "猫跑", "seedance-2-5", wait=False,
            callback_url="https://aizhs.top/api/video/token6688-callback",
            callback_secret="sec-9",
        )
    args, kwargs = client.request.call_args
    body = kwargs["json"]
    assert body["callback_url"] == "https://aizhs.top/api/video/token6688-callback"
    assert body["callback_secret"] == "sec-9"


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


@pytest.mark.asyncio
async def test_model_availability_parses_t6688_dollar_balance(monkeypatch):
    """model_availability _query_balance:token6688 美元字符串("$49.96")→ float USD。"""
    from app.services.model_availability import model_availability

    class _FakeResp:
        status_code = 200

        def json(self):
            return {"balance": "$49.964555", "available_balance": "$40.00", "frozen": "$9.96"}

    class _FakeClient:
        async def get(self, *a, **kw):
            return _FakeResp()

    balance, currency, err_type, _msg = await model_availability._query_balance(
        _FakeClient(), "token6688", "https://k.token6688.com/v1/skills/balance", "k",
    )
    assert balance == pytest.approx(49.964555)
    assert currency == "USD"
    assert err_type.value == "none"


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


# =============================================================================
# 长任务:提交即返回(wait=False)与任务状态查询(get_task_status)
# 2026-09-08 立:官方视频 p90 55~75 分钟,同步轮询会卡死 MCP 对话/worker
# =============================================================================


@pytest.mark.asyncio
async def test_generate_video_wait_false_returns_submitted():
    """wait=False 提交后不轮询,立即返回 task_id + poll_url。"""
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"task_id": "job-77"}))
    p = Token6688Provider("k")
    with _patch_http_client(client):
        result = await p.generate_video("猫跑", "seedance-2-5", duration=8, wait=False)
    assert result["status"] == "submitted"
    assert result["task_id"] == "job-77"
    assert result["poll_url"] == "https://k.token6688.com/v1/tasks/job-77"
    assert "video_url" not in result
    # 仅一次提交请求,无轮询 GET
    assert client.request.await_count == 1


@pytest.mark.asyncio
async def test_get_task_status_completed():
    """get_task_status:终态 success → ok=True + video_url。"""
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {
        "is_final": True, "state": "success", "status": "completed",
        "output_url": "https://cdn/x.mp4", "progress": 100,
    }))
    p = Token6688Provider("k")
    with _patch_http_client(client):
        st = await p.get_task_status("job-77")
    assert st["ok"] is True
    assert st["failed"] is False
    assert st["is_final"] is True
    assert st["video_url"] == "https://cdn/x.mp4"
    assert st["status"] == "completed"


@pytest.mark.asyncio
async def test_get_task_status_processing_and_failed():
    """get_task_status:processing 非终态 ok=False;failed 终态 failed=True。"""
    p = Token6688Provider("k")

    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {
        "is_final": False, "state": "running", "status": "processing", "progress": 30,
    }))
    with _patch_http_client(client):
        st = await p.get_task_status("job-77")
    assert st["ok"] is False and st["failed"] is False and st["status"] == "processing"

    client2 = MagicMock()
    client2.request = AsyncMock(return_value=_json_resp(200, {
        "is_final": True, "state": "failed", "status": "failed",
        "error": "content policy",
    }))
    with _patch_http_client(client2):
        st2 = await p.get_task_status("job-77")
    assert st2["failed"] is True and st2["ok"] is False
    assert "content policy" in (st2["error"] or "")


@pytest.mark.asyncio
async def test_mcp_video_tool_query_mode(monkeypatch):
    """video_generation 工具查询模式:只传 task_id → 返回任务状态(不校验 prompt)。"""
    from app.services import mcp_server

    class _FakeP:
        async def get_task_status(self, task_id):
            return {"status": "completed", "is_final": True, "ok": True,
                    "failed": False, "video_url": "https://cdn/done.mp4",
                    "progress": 100, "error": None, "raw": {}}

    import app.services.video_generation as vg
    monkeypatch.setattr(vg, "_instantiate", lambda name: _FakeP() if name == "token6688" else None)
    from app.services.mcp_server import mcp_server as mcp_inst
    out = await mcp_inst.call_tool("video_generation", {"task_id": "job-77"})
    assert out["ok"] is True
    assert out["completed"] is True
    assert out["video_url"] == "https://cdn/done.mp4"
    assert out["task_id"] == "job-77"


# =============================================================================
# 音乐生成(2026-09-08):wait=False 提交即返回 + MCP music_generation 工具
# =============================================================================


@pytest.mark.asyncio
async def test_generate_music_wait_false_returns_submitted():
    """generate_music wait=False:提交后不轮询,立即返回 task_id + poll_url。"""
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"task_id": "m-99"}))
    p = Token6688Provider("k")
    with _patch_http_client(client):
        result = await p.generate_music("欢快的电子乐", style="EDM", wait=False)
    assert result["status"] == "submitted"
    assert result["task_id"] == "m-99"
    assert result["poll_url"] == "https://k.token6688.com/v1/tasks/m-99"
    assert "audio_url" not in result
    assert client.request.await_count == 1


@pytest.mark.asyncio
async def test_mcp_music_tool_query_mode(monkeypatch):
    """music_generation 工具查询模式:只传 task_id → 返回成曲状态(不校验 prompt)。"""
    class _FakeP:
        async def get_task_status(self, task_id):
            return {"status": "completed", "is_final": True, "ok": True,
                    "failed": False, "video_url": "https://cdn/song.mp3",
                    "progress": 100, "error": None, "raw": {}}

    import app.services.video_generation as vg
    monkeypatch.setattr(vg, "_instantiate", lambda name: _FakeP() if name == "token6688" else None)
    from app.services.mcp_server import mcp_server as mcp_inst
    out = await mcp_inst.call_tool("music_generation", {"task_id": "m-99"})
    assert out["ok"] is True
    assert out["completed"] is True
    assert out["audio_url"] == "https://cdn/song.mp3"
    assert out["task_id"] == "m-99"


@pytest.mark.asyncio
async def test_mcp_music_tool_submit_unconfigured(monkeypatch):
    """music_generation 未配置 key → PROVIDER_NOT_CONFIGURED,不误标成功。"""
    import app.services.video_generation as vg
    monkeypatch.setattr(vg, "_instantiate", lambda name: None)
    from app.services.mcp_server import mcp_server as mcp_inst
    out = await mcp_inst.call_tool("music_generation", {"prompt": "欢快的电子乐"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"


@pytest.mark.asyncio
async def test_mcp_music_tool_registered_and_schema():
    """music_generation 已注册:_TOOLS/_TOOL_HANDLERS 均存在且 schema 形状正确。"""
    from app.services.mcp_server import _TOOLS, _TOOL_HANDLERS, mcp_server as mcp_inst

    tool = next(t for t in _TOOLS if t.name == "music_generation")
    assert "prompt" in tool.input_schema["properties"]
    assert "task_id" in tool.input_schema["properties"]
    assert "music_generation" in _TOOL_HANDLERS
    # list_tools 聚合层也能看到(同步方法)
    names = [t.name for t in mcp_inst.list_tools()]
    assert "music_generation" in names


# =============================================================================
# voice_tts MCP 工具(2026-09-08):对话内文本转语音,edge 零成本默认 / token6688 引擎
# =============================================================================


def _patch_edge_tts(monkeypatch, audio: bytes = b"ID3fake-tts"):
    """monkeypatch edge_tts 模块:Communicate.stream 返回固定音频块。"""
    import sys
    from unittest.mock import MagicMock as _M

    fake_mod = _M()

    class _FakeCommunicate:
        def __init__(self, text, voice=None, rate=None):
            pass

        async def stream(self):
            yield {"type": "audio", "data": audio}

    fake_mod.Communicate = _FakeCommunicate
    monkeypatch.setitem(sys.modules, "edge_tts", fake_mod)
    return audio


@pytest.mark.asyncio
async def test_mcp_voice_tts_edge_default_returns_data_uri(monkeypatch):
    """engine=edge(默认):返回 data URI,前端 <audio> 可直接播放。"""
    audio = _patch_edge_tts(monkeypatch)
    from app.services.mcp_server import mcp_server as mcp_inst

    out = await mcp_inst.call_tool("voice_tts", {"text": "你好,世界"})
    assert out["ok"] is True
    assert out["engine"] == "edge"
    assert out["audio_url"].startswith("data:audio/mpeg;base64,")
    import base64 as _b

    assert _b.b64decode(out["audio_url"].split(",", 1)[1]) == audio


@pytest.mark.asyncio
async def test_mcp_voice_tts_token6688_engine(monkeypatch):
    """engine=token6688:走网关 provider.tts,voice 透传。"""
    import base64 as _b

    class _FakeP:
        async def tts(self, text, *, voice="alloy", **kw):
            assert voice == "nova"
            return b"ID3gateway", "audio/mpeg"

    import app.services.video_generation as vg
    monkeypatch.setattr(vg, "_instantiate", lambda name: _FakeP() if name == "token6688" else None)
    from app.services.mcp_server import mcp_server as mcp_inst

    out = await mcp_inst.call_tool(
        "voice_tts", {"text": "网关语音", "engine": "token6688", "voice": "nova"},
    )
    assert out["ok"] is True
    assert out["provider"] == "token6688"
    assert out["voice"] == "nova"
    assert _b.b64decode(out["audio_url"].split(",", 1)[1]) == b"ID3gateway"


@pytest.mark.asyncio
async def test_mcp_voice_tts_token6688_unconfigured(monkeypatch):
    """token6688 未配置 → PROVIDER_NOT_CONFIGURED(提示可改用 edge)。"""
    import app.services.video_generation as vg
    monkeypatch.setattr(vg, "_instantiate", lambda name: None)
    from app.services.mcp_server import mcp_server as mcp_inst

    out = await mcp_inst.call_tool("voice_tts", {"text": "你好", "engine": "token6688"})
    assert out["ok"] is False
    assert out["errorCode"] == "PROVIDER_NOT_CONFIGURED"
    assert "edge" in out["error"]


@pytest.mark.asyncio
async def test_mcp_voice_tts_save_path_lands_file(monkeypatch, tmp_path):
    """save_path 落地:文件写入工作区,返回 saved_path。"""
    audio = _patch_edge_tts(monkeypatch)
    from app.services.mcp_server import mcp_server as mcp_inst
    import app.services.mcp_server as mcp_mod

    target = tmp_path / "out.mp3"
    monkeypatch.setattr(
        mcp_mod, "_validate_audio_save_path",
        lambda p: (True, str(target), None), raising=False,
    )
    out = await mcp_inst.call_tool("voice_tts", {"text": "落地测试", "save_path": str(target)})
    assert out["ok"] is True
    assert out["saved_path"] == str(target)
    assert target.read_bytes() == audio


@pytest.mark.asyncio
async def test_mcp_voice_tts_text_too_long():
    """text>5000 硬上限:TEXT_TOO_LONG(2000<text≤5000 已改为自动切异步 TTS,不在此断言)。"""
    from app.services.mcp_server import mcp_server as mcp_inst

    out = await mcp_inst.call_tool("voice_tts", {"text": "啊" * 5001})
    assert out["ok"] is False
    assert out["errorCode"] == "TEXT_TOO_LONG"


@pytest.mark.asyncio
async def test_mcp_voice_tts_empty_text():
    from app.services.mcp_server import mcp_server as mcp_inst

    out = await mcp_inst.call_tool("voice_tts", {"text": "   "})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"


@pytest.mark.asyncio
async def test_mcp_voice_tts_unknown_engine():
    from app.services.mcp_server import mcp_server as mcp_inst

    out = await mcp_inst.call_tool("voice_tts", {"text": "你好", "engine": "azure"})
    assert out["ok"] is False
    assert out["errorCode"] == "BAD_PARAMS"


@pytest.mark.asyncio
async def test_mcp_voice_tts_registered_and_schema():
    """voice_tts 已注册:_TOOLS/_TOOL_HANDLERS 均存在。

    2026-09-09 深度增强后 schema 契约:text 不再 required(task_id 查询模式只传 task_id),
    properties 须含 text/task_id/engine。
    """
    from app.services.mcp_server import _TOOLS, _TOOL_HANDLERS, mcp_server as mcp_inst

    tool = next(t for t in _TOOLS if t.name == "voice_tts")
    assert tool.input_schema["required"] == []
    assert "text" in tool.input_schema["properties"]
    assert "task_id" in tool.input_schema["properties"]
    assert "engine" in tool.input_schema["properties"]
    assert "voice_tts" in _TOOL_HANDLERS
    names = [t.name for t in mcp_inst.list_tools()]
    assert "voice_tts" in names


# =============================================================================
# 2026-09-08 文档全量校准新增:9 端点方法 + 调度头 + 退避重试 + music 完整参数
# =============================================================================


async def test_get_model_params_maps_params_array():
    """单模型参数详情(免鉴权):params 数组 options[].value/is_default。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"name": "seedance-2-5", "params": [
        {"name": "mode", "label": "生成模式", "options": [
            {"value": "text-to-video", "is_default": False},
            {"value": "first-frame", "is_default": True},
        ]},
    ]}))
    with _patch_http_client(client):
        data = await p.get_model_params("seedance-2-5")
    assert data["name"] == "seedance-2-5"
    args, _ = client.request.call_args
    assert args[1].endswith("/v1/skills/models/seedance-2-5")


async def test_get_model_pricing_free_auth():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"channel_groups": [{"base_price": 0.36}]}))
    with _patch_http_client(client):
        data = await p.get_model_pricing("seedance-2-5")
    assert data["channel_groups"][0]["base_price"] == 0.36
    args, _ = client.request.call_args
    assert args[1].endswith("/pricing")


async def test_list_logical_models():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"models": [{"name": "wan-3-0", "param_schema": {}}]}))
    with _patch_http_client(client):
        models = await p.list_logical_models()
    assert models[0]["name"] == "wan-3-0"
    args, _ = client.request.call_args
    assert args[1].endswith("/v1/logical-models")


async def test_estimate_pricing_envelope_shape():
    """估价:信封形状(params 收在 params 里)+ kwargs 合并。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"effective_total_rmb": 4.5}))
    with _patch_http_client(client):
        data = await p.estimate_pricing(
            "seedance-2-5", "一只猫", params={"mode": "text-to-video", "duration": 5},
        )
    assert data["effective_total_rmb"] == 4.5
    args, kwargs = client.request.call_args
    assert args[1].endswith("/v1/pricing-estimate")
    body = kwargs["json"]
    assert body["params"]["mode"] == "text-to-video"  # 信封形状
    assert body["model"] == "seedance-2-5"


async def test_batch_estimate():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"results": []}))
    with _patch_http_client(client):
        await p.batch_estimate([{"model": "music", "prompt": "a"}, {"model": "music", "prompt": "b"}])
    args, kwargs = client.request.call_args
    assert args[1].endswith("/v1/pricing-estimate/batch")
    assert len(kwargs["json"]["estimates"]) == 2


async def test_get_voice_single():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"voice_id": "v-1", "status": "ready"}))
    with _patch_http_client(client):
        data = await p.get_voice("v-1")
    assert data["voice_id"] == "v-1"
    args, _ = client.request.call_args
    assert args[1].endswith("/v1/audio/voices/v-1")


async def test_query_task_status_alt_query_param():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"status": "生成中", "state": "processing"}))
    with _patch_http_client(client):
        await p.query_task_status_alt("job-9")
    args, _ = client.request.call_args
    assert args[1].endswith("/v1/skills/task-status?task_id=job-9")


async def test_media_generate_envelope_submitted():
    """统一媒体入口:信封形状 → task_id 提交即返。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"task_id": "mg-1"}))
    with _patch_http_client(client):
        out = await p.media_generate("veo-3.1", "一只猫", params={"duration": 8})
    assert out["status"] == "submitted"
    assert out["task_id"] == "mg-1"
    args, kwargs = client.request.call_args
    assert args[1].endswith("/v1/media/generate")
    assert kwargs["json"]["params"]["duration"] == 8  # 信封
    assert kwargs["json"]["model"] == "veo-3.1"


async def test_media_generate_body_error_raises():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"error": {"message": "内容被拦截"}}))
    with _patch_http_client(client):
        with pytest.raises(ProviderError, match="拦截"):
            await p.media_generate("veo-3.1", "x")


async def test_media_generate_sync_image_shape():
    """image 走 media/generate 是同步的:直接有媒体 URL 无 task_id → completed。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"url": "https://cdn.example.com/i.png"}))
    with _patch_http_client(client):
        out = await p.media_generate("gpt-image-2", "一只猫", params={"mode": "text-to-image"})
    assert out["status"] == "completed"
    assert out["media_url"] == "https://cdn.example.com/i.png"


async def test_tts_async_submit_and_poll():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(side_effect=[
        _json_resp(200, {"task_id": "tts-a1"}),
        _json_resp(200, {"is_final": True, "state": "success", "status": "completed", "output_url": "https://cdn.example.com/s.mp3"}),
    ])
    with _patch_http_client(client):
        out = await p.tts_async("你好", voice="alloy")
    assert out["audio_url"] == "https://cdn.example.com/s.mp3"
    assert out["task_id"] == "tts-a1"
    first_args, first_kwargs = client.request.call_args_list[0]
    assert first_args[1].endswith("/v1/audio/speech/async")
    assert first_kwargs["json"]["input"] == "你好"


async def test_tts_async_nowait_returns_submitted():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"task_id": "tts-a2"}))
    with _patch_http_client(client):
        out = await p.tts_async("你好", wait=False)
    assert out["status"] == "submitted"
    assert out["poll_url"].endswith("/v1/tasks/tts-a2")


async def test_generate_music_full_params_passthrough():
    """music 完整参数:operation/negative_tags/version 透传(官方枚举实测)。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {"task_id": "m-9"}))
    with _patch_http_client(client):
        await p.generate_music(
            "一首歌", operation="cover", cover_clip_id="clip-src-1",
            negative_tags="重金属", version="chirp-v5-5", wait=False,
        )
    args, kwargs = client.request.call_args
    body = kwargs["json"]
    assert body["operation"] == "cover"
    assert body["cover_clip_id"] == "clip-src-1"
    assert body["negative_tags"] == "重金属"
    assert body["version"] == "chirp-v5-5"


def test_headers_schedule_strategy_injected(monkeypatch):
    """X-Schedule-Strategy:合法 env 值注入请求头,非法值忽略。"""
    monkeypatch.setenv("TOKEN6688_SCHEDULE_STRATEGY", "cost_first")
    h = Token6688Provider("k")._headers()
    assert h["X-Schedule-Strategy"] == "cost_first"
    monkeypatch.setenv("TOKEN6688_SCHEDULE_STRATEGY", "bogus")
    h2 = Token6688Provider("k")._headers()
    assert "X-Schedule-Strategy" not in h2


@pytest.mark.asyncio
async def test_request_retries_on_429_then_enriches():
    """429 限频:退避重试 1 次;仍失败则 error 语义增强。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(side_effect=[
        ProviderError("Token6688Provider 调用失败: 429 rate_limit_error", 429),
        _json_resp(200, {"ok": 1}),
    ])
    with _patch_http_client(client):
        with patch("app.providers.token6688_provider.asyncio.sleep", new=AsyncMock()) as _s:
            data = await p._request("GET", "https://k.token6688.com/v1/skills/balance")
    assert data == {"ok": 1}
    assert client.request.call_count == 2


@pytest.mark.asyncio
async def test_request_enriches_402_insufficient_funds():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(side_effect=ProviderError(
        "调用失败: 402 {\"error\":{\"code\":\"insufficient_funds\"}}", 402))
    with _patch_http_client(client):
        with pytest.raises(ProviderError, match="余额不足"):
            await p._request("POST", "https://k.token6688.com/v1/videos/generations", json={})


@pytest.mark.asyncio
async def test_request_enriches_content_policy():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(side_effect=ProviderError(
        "调用失败: 403 {\"error\":{\"type\":\"content_policy_violation\"}}", 403))
    with _patch_http_client(client):
        with pytest.raises(ProviderError, match="安全策略"):
            await p._request("POST", "https://k.token6688.com/v1/images/generations", json={})


async def test_get_task_status_extracts_stage_error_class_cost():
    """get_task_status 新字段:status_zh/stage/error_class/actual_cost。"""
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {
        "is_final": True, "state": "failed", "status": "failed", "status_zh": "生成失败",
        "error": "上游异常", "error_class": "generation_failed", "actual_cost_micro_usd": 0,
    }))
    with _patch_http_client(client):
        st = await p.get_task_status("job-x")
    assert st["failed"] is True
    assert st["status_zh"] == "生成失败"
    assert st["error_class"] == "generation_failed"
    assert st["actual_cost"] == 0


@pytest.mark.asyncio
async def test_poll_task_failed_with_error_class_hint():
    p = Token6688Provider("k")
    client = MagicMock()
    client.request = AsyncMock(return_value=_json_resp(200, {
        "is_final": True, "state": "failed", "status": "failed",
        "error": "素材被拒", "error_class": "content_blocked",
    }))
    with _patch_http_client(client):
        with pytest.raises(ProviderError, match="content_blocked"):
            await p._poll_task("https://k.token6688.com/v1/tasks/x")


@pytest.mark.asyncio
async def test_mcp_token6688_model_info_missing_model():
    from app.services.mcp_server import mcp_server as mcp_inst

    out = await mcp_inst.call_tool("token6688_model_info", {})
    assert out["ok"] is False
    assert out["errorCode"] == "MISSING_PARAMS"


@pytest.mark.asyncio
async def test_mcp_token6688_model_info_registered():
    from app.services.mcp_server import _TOOLS, _TOOL_HANDLERS, mcp_server as mcp_inst

    tool = next(t for t in _TOOLS if t.name == "token6688_model_info")
    # model 已改可选:action=models(目录清单)无需传模型 ID → 不进 required
    assert "model" not in tool.input_schema.get("required", [])
    assert set(tool.input_schema["properties"]["action"]["enum"]) == {
        "models", "estimate", "params", "pricing",
    }
    assert "modality" in tool.input_schema["properties"]
    assert "token6688_model_info" in _TOOL_HANDLERS
    names = [t.name for t in mcp_inst.list_tools()]
    assert "token6688_model_info" in names


# =============================================================================
# 官方 webhook 回调(guide 2026-07-11):X-TokenGo-Event +
# X-TokenGo-Signature: sha256=HMAC_SHA256(callback_secret, body)
# handler 幂等互斥:只认 processing 行;端点验签 401 / 2xx 确认语义
# =============================================================================


def _cb_snapshot(state: str = "success", url: str = "https://cdn/x.mp4") -> dict[str, Any]:
    return {
        "task_id": "job-cb-1", "is_final": True, "state": state,
        "status": "completed" if state == "success" else "failed",
        "output_url": url,
    }


def _cb_row(task_id: str = "job-cb-1") -> dict[str, Any]:
    return {
        "id": 7,
        "result": json.dumps(
            {"poll_via": "token6688", "task_id": task_id,
             "model": "seedance-2-5", "duration": 5},
        ),
    }


def _fake_conn(rows: list[dict[str, Any]]) -> MagicMock:
    conn = MagicMock()
    conn.fetch = AsyncMock(return_value=rows)
    conn.close = AsyncMock()
    return conn


@pytest.mark.asyncio
async def test_callback_handler_missing_task_id():
    from app.services import video_generation as vg

    out = await vg.handle_token6688_callback({"state": "success"})
    assert out["ok"] is False


@pytest.mark.asyncio
async def test_callback_handler_success_lands_succeed(monkeypatch):
    from app.services import video_generation as vg

    set_status = AsyncMock()
    monkeypatch.setattr(vg, "get_db_conn", AsyncMock(return_value=_fake_conn([_cb_row()])))
    monkeypatch.setattr(vg, "_set_status", set_status)
    out = await vg.handle_token6688_callback(_cb_snapshot())
    assert out == {"ok": True, "matched": 1}
    set_status.assert_awaited_once()
    row_id, status, payload = set_status.await_args.args
    assert row_id == 7 and status == "succeed"
    body = json.loads(payload)
    assert body["url"] == "https://cdn/x.mp4" and body["via"] == "callback"
    assert body["task_id"] == "job-cb-1"


@pytest.mark.asyncio
async def test_callback_handler_failed_lands_failed(monkeypatch):
    from app.services import video_generation as vg

    set_status = AsyncMock()
    monkeypatch.setattr(vg, "get_db_conn", AsyncMock(return_value=_fake_conn([_cb_row()])))
    monkeypatch.setattr(vg, "_set_status", set_status)
    out = await vg.handle_token6688_callback(_cb_snapshot(state="failed", url=""))
    assert out["matched"] == 1
    row_id, status, err = set_status.await_args.args
    assert status == "failed" and err


@pytest.mark.asyncio
async def test_callback_handler_non_final_ignored(monkeypatch):
    from app.services import video_generation as vg

    set_status = AsyncMock()
    monkeypatch.setattr(vg, "get_db_conn", AsyncMock(return_value=_fake_conn([_cb_row()])))
    monkeypatch.setattr(vg, "_set_status", set_status)
    snap = _cb_snapshot()
    snap.update({"is_final": False, "state": "processing", "status": "processing", "output_url": ""})
    out = await vg.handle_token6688_callback(snap)
    assert out == {"ok": True, "matched": 0, "ignored": "non-final"}
    set_status.assert_not_awaited()


@pytest.mark.asyncio
async def test_callback_handler_task_id_mismatch_skipped(monkeypatch):
    from app.services import video_generation as vg

    set_status = AsyncMock()
    monkeypatch.setattr(
        vg, "get_db_conn", AsyncMock(return_value=_fake_conn([_cb_row(task_id="other-job")])),
    )
    monkeypatch.setattr(vg, "_set_status", set_status)
    out = await vg.handle_token6688_callback(_cb_snapshot())
    assert out == {"ok": True, "matched": 0}
    set_status.assert_not_awaited()


def _cb_client() -> Any:
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.routers.video import router as video_router

    app = FastAPI()
    app.include_router(video_router, prefix="/api")
    return TestClient(app)


def test_callback_endpoint_bad_signature_401(monkeypatch):
    monkeypatch.setenv("TOKEN6688_CALLBACK_SECRET", "sec-1")
    r = _cb_client().post(
        "/api/video/token6688-callback",
        json=_cb_snapshot(),
        headers={"X-TokenGo-Signature": "sha256=deadbeef", "X-TokenGo-Event": "task.completed"},
    )
    assert r.status_code == 401


def test_callback_endpoint_valid_signature_200(monkeypatch):
    from app.services import video_generation as vg

    monkeypatch.setenv("TOKEN6688_CALLBACK_SECRET", "sec-1")
    monkeypatch.setattr(vg, "get_db_conn", AsyncMock(return_value=_fake_conn([])))
    body = json.dumps(_cb_snapshot()).encode("utf-8")
    sig = "sha256=" + hmac.new(b"sec-1", body, hashlib.sha256).hexdigest()
    r = _cb_client().post(
        "/api/video/token6688-callback",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-TokenGo-Signature": sig,
            "X-TokenGo-Event": "task.completed",
        },
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True, "matched": 0}  # 无在途行,幂等静默


def test_callback_endpoint_no_secret_fail_closed(monkeypatch):
    """密钥未配置 → 503 fail-closed,不再跳过验签继续处理(2026-09-09 P0)。"""
    monkeypatch.delenv("TOKEN6688_CALLBACK_SECRET", raising=False)
    r = _cb_client().post("/api/video/token6688-callback", json=_cb_snapshot())
    assert r.status_code == 503


def test_callback_endpoint_invalid_body_ok_false(monkeypatch):
    """配 secret + 合法签名但非法 JSON 体 → 200 ok=False(幂等确认)。"""
    import hashlib as _h
    import hmac as _hmac

    secret = "sec"
    monkeypatch.setenv("TOKEN6688_CALLBACK_SECRET", secret)
    raw = b"not-json"
    sig = "sha256=" + _hmac.new(secret.encode(), raw, _h.sha256).hexdigest()
    r = _cb_client().post(
        "/api/video/token6688-callback",
        content=raw,
        headers={"X-TokenGo-Signature": sig, "Content-Type": "application/json"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is False


def test_callback_path_whitelisted_in_jwt_middleware():
    """回调路径必须在 JWT 白名单(精确匹配项);外部平台无 JWT,鉴权靠 HMAC 验签。"""
    from app.core import jwt_auth

    assert "/api/video/token6688-callback" in jwt_auth.PUBLIC_PATHS

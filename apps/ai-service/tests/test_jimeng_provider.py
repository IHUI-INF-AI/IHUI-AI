# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""jimeng_provider.py 单元测试(真实 API 实现)。

测试覆盖:
- volcano_v4_signature:HMAC-SHA256 派生链逐步复算验证 / 头部字段
- __init__ 三模式判定:ark / v4 / none,凭据来源(api_key vs 环境变量)
- configured / _require_configured 503
- complete / astream 显式 400 拒绝
- Ark 图像:模型归一化 / 缺 URL 502 / watermark 透传
- V4 图像:image_urls / resp_data JSON 字符串 / binary_data_base64 三形态
- Ark 视频:任务提交 --dur/--rt 拼接 / 图生视频 content 结构 / 轮询至 succeeded
- V4 视频:submit + GetResult 轮询 / video_url 三形态提取
- _poll_task:failed 502 / 超时 504
- _post_ark / _v4_post:HTTP 4xx / 非法 JSON / 网络异常
"""

from __future__ import annotations

import hashlib
import hmac
import json
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.providers.base_provider import ProviderError
from app.providers.jimeng_provider import JimengProvider, volcano_v4_signature

_ARK_BASE = "https://ark.cn-beijing.volces.com"
_VISUAL_BASE = "https://visual.volcengineapi.com"


@contextmanager
def _patch_http_client(fake_client: Any) -> Iterator[None]:
    """Patch jimeng_provider 命名空间的 get_http_client。"""
    with patch("app.providers.jimeng_provider.get_http_client", return_value=fake_client):
        yield


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """隔离环境变量,避免宿主机凭据影响模式判定。"""
    for key in (
        "ARK_API_KEY",
        "ARK_ACCESS_KEY",
        "ARK_SECRET_KEY",
        "ARK_API_BASE",
        "ARK_IMAGE_MODEL",
        "ARK_VIDEO_MODEL",
        "ARK_REGION",
        "JIMENG_API_BASE",
        "JIMENG_IMAGE_REQ_KEY",
    ):
        monkeypatch.delenv(key, raising=False)


# =============================================================================
# volcano_v4_signature
# =============================================================================


def test_v4_signature_full_chain_recomputation():
    """逐步复算签名链,验证 Authorization 与官方 V4 算法一致。"""
    body = json.dumps({"req_key": "x", "prompt": "hi"}, separators=(",", ":")).encode("utf-8")
    now = datetime(2026, 9, 5, 12, 0, 0, tzinfo=timezone.utc)
    query = {"Action": "CVProcess", "Version": "2022-08-31"}
    headers = volcano_v4_signature(
        "AKTEST", "SKTEST", method="POST", host="visual.volcengineapi.com",
        path="/", query=query, body=body, now=now,
    )
    assert headers["X-Date"] == "20260905T120000Z"
    assert headers["X-Content-Sha256"] == hashlib.sha256(body).hexdigest()

    x_date = "20260905T120000Z"
    short_date = "20260905"
    payload_hash = headers["X-Content-Sha256"]
    canonical_query = "Action=CVProcess&Version=2022-08-31"
    canonical_headers = (
        f"content-type:application/json\nhost:visual.volcengineapi.com\n"
        f"x-content-sha256:{payload_hash}\nx-date:{x_date}\n"
    )
    canonical_request = "\n".join(
        ["POST", "/", canonical_query, canonical_headers,
         "content-type;host;x-content-sha256;x-date", payload_hash]
    )
    scope = f"{short_date}/cn-north-1/cv/request"
    string_to_sign = "\n".join(
        ["HMAC-SHA256", x_date, scope,
         hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()]
    )
    k = hmac.new(b"SKTEST", short_date.encode("utf-8"), hashlib.sha256).digest()
    k = hmac.new(k, b"cn-north-1", hashlib.sha256).digest()
    k = hmac.new(k, b"cv", hashlib.sha256).digest()
    k = hmac.new(k, b"request", hashlib.sha256).digest()
    sig = hmac.new(k, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    expected = (
        f"HMAC-SHA256 Credential=AKTEST/{scope}, "
        f"SignedHeaders=content-type;host;x-content-sha256;x-date, Signature={sig}"
    )
    assert headers["Authorization"] == expected


def test_v4_signature_different_body_different_hash():
    """body 不同 → X-Content-Sha256 不同。"""
    kw = dict(method="POST", host="h", path="/", query={})
    h1 = volcano_v4_signature("ak", "sk", body=b"{}", now=datetime(2026, 1, 1, tzinfo=timezone.utc), **kw)
    h2 = volcano_v4_signature("ak", "sk", body=b'{"a":1}', now=datetime(2026, 1, 1, tzinfo=timezone.utc), **kw)
    assert h1["X-Content-Sha256"] != h2["X-Content-Sha256"]


# =============================================================================
# __init__ 三模式判定
# =============================================================================


def test_init_ark_mode_with_plain_api_key():
    """无冒号 api_key → Ark 模式,方舟默认 base。"""
    p = JimengProvider("ark-key-123")
    assert p.mode == "ark"
    assert p.base_url == _ARK_BASE
    assert p._ark_key == "ark-key-123"


def test_init_v4_mode_with_colon_api_key():
    """"AK:SK" → V4 模式,视觉服务默认 base。"""
    p = JimengProvider("myak:mysk")
    assert p.mode == "v4"
    assert p.base_url == _VISUAL_BASE
    assert (p._ak, p._sk) == ("myak", "mysk")


def test_init_none_mode_without_credentials():
    """无任何凭据 → none 模式。"""
    p = JimengProvider(None)
    assert p.mode == "none"
    assert p.configured is False


def test_init_ark_mode_from_env(monkeypatch):
    """ARK_API_KEY 环境变量 → Ark 模式。"""
    monkeypatch.setenv("ARK_API_KEY", "env-ark")
    p = JimengProvider(None)
    assert p.mode == "ark"


def test_init_v4_mode_from_env(monkeypatch):
    """ARK_ACCESS_KEY + ARK_SECRET_KEY → V4 模式。"""
    monkeypatch.setenv("ARK_ACCESS_KEY", "ak")
    monkeypatch.setenv("ARK_SECRET_KEY", "sk")
    p = JimengProvider(None)
    assert p.mode == "v4"


def test_init_ark_env_key_wins_over_env_aksk(monkeypatch):
    """ARK_API_KEY 与 AK/SK 同时存在 → Ark 模式优先。"""
    monkeypatch.setenv("ARK_API_KEY", "ark")
    monkeypatch.setenv("ARK_ACCESS_KEY", "ak")
    monkeypatch.setenv("ARK_SECRET_KEY", "sk")
    p = JimengProvider(None)
    assert p.mode == "ark"


def test_init_custom_api_base():
    p = JimengProvider("k", api_base="https://ark.example.com/")
    assert p.base_url == "https://ark.example.com"


def test_require_configured_raises_503():
    with pytest.raises(ProviderError) as exc:
        JimengProvider(None)._require_configured()
    assert exc.value.status_code == 503


# =============================================================================
# chat 不可用
# =============================================================================


async def test_complete_rejects_with_400():
    with pytest.raises(ProviderError) as exc:
        await JimengProvider("k").complete([{"role": "user", "content": "hi"}], "jimeng-x")
    assert exc.value.status_code == 400


async def test_astream_rejects_with_400():
    with pytest.raises(ProviderError) as exc:
        async for _ in JimengProvider("k").astream([{"role": "user", "content": "hi"}], "jimeng-x"):
            pass
    assert exc.value.status_code == 400


# =============================================================================
# Ark 图像
# =============================================================================


async def test_ark_image_success_with_seedream_model():
    p = JimengProvider("ark-key")
    with patch.object(p, "_post_ark", new=AsyncMock(return_value={"data": [{"url": "https://img/1.png"}]})) as mock:
        result = await p.generate_image("cat", "jimeng-doubao-seedream-4-0", size="1024x1024")
    assert result == {"provider": "jimeng", "model": "doubao-seedream-4-0",
                      "data": [{"url": "https://img/1.png"}]}
    url, body = mock.call_args[0]
    assert url.endswith("/api/v3/images/generations")
    assert body["model"] == "doubao-seedream-4-0"
    assert body["size"] == "1024x1024"
    assert body["response_format"] == "url"


async def test_ark_image_non_seedream_model_falls_back_to_env_default():
    p = JimengProvider("ark-key")
    with patch.object(p, "_post_ark", new=AsyncMock(return_value={"data": [{"url": "u"}]})):
        result = await p.generate_image("cat", "jimeng-wrong-model", size="1024x1024")
    assert result["model"] == "doubao-seedream-4-0"


async def test_ark_image_missing_url_raises():
    p = JimengProvider("ark-key")
    with patch.object(p, "_post_ark", new=AsyncMock(return_value={"data": []})):
        with pytest.raises(ProviderError) as exc:
            await p.generate_image("cat", "jimeng-x")
    assert exc.value.status_code == 502


# =============================================================================
# V4 图像(三种返回形态)
# =============================================================================


async def test_v4_image_image_urls_form():
    p = JimengProvider("ak:sk")
    with patch.object(p, "_v4_post", new=AsyncMock(return_value={"image_urls": ["u1", "u2"]})) as mock:
        result = await p.generate_image("cat", "high_aes_general_v21", size="512x768")
    assert result["data"] == [{"url": "u1"}, {"url": "u2"}]
    action, body = mock.call_args[0]
    assert action == "CVProcess"
    assert (body["width"], body["height"]) == (512, 768)


async def test_v4_image_resp_data_json_string_form():
    p = JimengProvider("ak:sk")
    data = {"resp_data": json.dumps({"image_urls": ["u9"]})}
    with patch.object(p, "_v4_post", new=AsyncMock(return_value=data)):
        result = await p.generate_image("cat", "rk")
    assert result["data"] == [{"url": "u9"}]


async def test_v4_image_binary_base64_form():
    p = JimengProvider("ak:sk")
    with patch.object(p, "_v4_post", new=AsyncMock(return_value={"binary_data_base64": ["QUJD"]})):
        result = await p.generate_image("cat", "rk")
    assert result["data"] == [{"url": "data:image/png;base64,QUJD"}]


async def test_v4_image_invalid_size_defaults_1024():
    p = JimengProvider("ak:sk")
    with patch.object(p, "_v4_post", new=AsyncMock(return_value={"image_urls": ["u"]})) as mock:
        await p.generate_image("cat", "rk", size="bad")
    _, body = mock.call_args[0]
    assert (body["width"], body["height"]) == (1024, 1024)


async def test_v4_image_no_urls_raises():
    p = JimengProvider("ak:sk")
    with patch.object(p, "_v4_post", new=AsyncMock(return_value={})):
        with pytest.raises(ProviderError):
            await p.generate_image("cat", "rk")


# =============================================================================
# Ark 视频
# =============================================================================


async def test_ark_video_submit_and_poll():
    p = JimengProvider("ark-key")
    with patch.object(p, "_post_ark", new=AsyncMock(return_value={"id": "task-1"})) as m_post, \
         patch.object(p, "_get_ark_task",
                      new=AsyncMock(return_value={"status": "succeeded",
                                                  "content": {"video_url": "https://vid/v.mp4"}})) as m_get:
        result = await p.generate_video("dance", "jimeng-doubao-seedance-1-0-pro", duration=5)
    assert result == {"provider": "jimeng", "model": "doubao-seedance-1-0-pro",
                      "task_id": "task-1", "video_url": "https://vid/v.mp4"}
    url, body = m_post.call_args[0]
    assert url.endswith("/api/v3/contents/generations/tasks")
    assert body["content"][0]["text"] == "dance --dur 5"
    m_get.assert_awaited_once_with("task-1")


async def test_ark_video_aspect_ratio_and_image():
    """--rt 比例拼进 text;image 以 image_url 条目追加进 content。"""
    p = JimengProvider("ark-key")
    with patch.object(p, "_post_ark", new=AsyncMock(return_value={"id": "t2"})) as m2, \
         patch.object(p, "_get_ark_task",
                      new=AsyncMock(return_value={"status": "succeeded", "content": {"video_url": "v"}})):
        await p.generate_video("y", "jimeng-s", duration=10, aspect_ratio="9:16", image="data:png;base64,AA")
        _, body = m2.call_args[0]
        text = body["content"][0]["text"]
        assert "--dur 10" in text and "--rt 9:16" in text
        assert body["content"][1] == {"type": "image_url",
                                      "image_url": {"url": "data:png;base64,AA"}}


async def test_ark_video_missing_id_raises():
    p = JimengProvider("ark-key")
    with patch.object(p, "_post_ark", new=AsyncMock(return_value={})):
        with pytest.raises(ProviderError) as exc:
            await p.generate_video("x", "jimeng-s")
    assert exc.value.status_code == 502


async def test_ark_video_poll_failed_raises():
    p = JimengProvider("ark-key")
    with patch.object(p, "_post_ark", new=AsyncMock(return_value={"id": "t"})), \
         patch.object(p, "_get_ark_task", new=AsyncMock(return_value={"status": "failed"})):
        with pytest.raises(ProviderError) as exc:
            await p.generate_video("x", "jimeng-s")
    assert exc.value.status_code == 502


async def test_ark_video_no_video_url_raises():
    p = JimengProvider("ark-key")
    with patch.object(p, "_post_ark", new=AsyncMock(return_value={"id": "t"})), \
         patch.object(p, "_get_ark_task",
                      new=AsyncMock(return_value={"status": "succeeded", "content": {}})):
        with pytest.raises(ProviderError):
            await p.generate_video("x", "jimeng-s")


# =============================================================================
# V4 视频
# =============================================================================


async def test_v4_video_submit_then_getresult_done():
    p = JimengProvider("ak:sk")
    v4_post = AsyncMock(side_effect=[
        {"task_id": "vt1"},
        {"status": "done", "video_url": "https://vid/out.mp4"},
    ])
    with patch.object(p, "_v4_post", new=v4_post):
        result = await p.generate_video("run", "video_generation", duration=5)
    assert result["task_id"] == "vt1"
    assert result["video_url"] == "https://vid/out.mp4"
    action, body = v4_post.call_args_list[1][0]
    assert action == "CVSync2AsyncGetResult"
    assert body == {"req_key": "video_generation", "task_id": "vt1"}


async def test_v4_video_video_urls_list_form():
    p = JimengProvider("ak:sk")
    with patch.object(p, "_v4_post", new=AsyncMock(side_effect=[
        {"task_id": "t"},
        {"status": "done", "video_urls": [{"video_url": "https://vid/a.mp4"}]},
    ])):
        result = await p.generate_video("x", "rk")
    assert result["video_url"] == "https://vid/a.mp4"


async def test_v4_video_resp_data_form():
    p = JimengProvider("ak:sk")
    with patch.object(p, "_v4_post", new=AsyncMock(side_effect=[
        {"task_id": "t"},
        {"status": "done", "resp_data": json.dumps({"video_url": "https://vid/b.mp4"})},
    ])):
        result = await p.generate_video("x", "rk")
    assert result["video_url"] == "https://vid/b.mp4"


def test_extract_video_url_string_list_form():
    assert JimengProvider._extract_video_url({"video_urls": ["https://s.mp4"]}) == "https://s.mp4"


def test_extract_video_url_empty():
    assert JimengProvider._extract_video_url({}) == ""


# =============================================================================
# _poll_task 超时
# =============================================================================


async def test_poll_task_timeout_504():
    p = JimengProvider("ak:sk")

    async def fetch():
        return {"status": "running"}

    with pytest.raises(ProviderError) as exc:
        await p._poll_task(fetch=fetch, status_of=lambda d: d["status"],
                           done={"done"}, failed={"failed"}, label="T", max_wait=0)
    assert exc.value.status_code == 504


# =============================================================================
# _post_ark / _v4_post 错误路径
# =============================================================================


async def test_post_ark_http_4xx_raises_provider_error():
    p = JimengProvider("ark-key")
    resp = MagicMock()
    resp.status_code = 401
    resp.json.return_value = {"error": {"message": "invalid api key"}}
    client = MagicMock()
    client.request = AsyncMock(return_value=resp)
    with _patch_http_client(client), pytest.raises(ProviderError) as exc:
        await p._post_ark(f"{_ARK_BASE}/api/v3/images/generations", {"model": "m"})
    assert exc.value.status_code == 401


async def test_post_ark_invalid_json_raises():
    p = JimengProvider("ark-key")
    resp = MagicMock()
    resp.status_code = 200
    resp.json.side_effect = ValueError("bad json")
    resp.text = "<html>"
    client = MagicMock()
    client.request = AsyncMock(return_value=resp)
    with _patch_http_client(client), pytest.raises(ProviderError) as exc:
        await p._post_ark("u", {})
    assert "非合法 JSON" in str(exc.value)


async def test_post_ark_network_error_raises():
    p = JimengProvider("ark-key")
    client = MagicMock()
    client.request = AsyncMock(side_effect=httpx.ConnectError("boom"))
    with _patch_http_client(client), pytest.raises(ProviderError) as exc:
        await p._post_ark("u", {})
    assert "网络异常" in str(exc.value)


async def test_v4_post_business_code_raises_502():
    p = JimengProvider("ak:sk")
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"code": 50000, "message": "quota exceeded"}
    client = MagicMock()
    client.post = AsyncMock(return_value=resp)
    with _patch_http_client(client), pytest.raises(ProviderError) as exc:
        await p._v4_post("CVProcess", {})
    assert exc.value.status_code == 502


async def test_v4_post_success_returns_inner_data():
    p = JimengProvider("ak:sk")
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"code": 10000, "data": {"task_id": "x"}}
    client = MagicMock()
    client.post = AsyncMock(return_value=resp)
    with _patch_http_client(client):
        assert await p._v4_post("CVSync2AsyncSubmitTask", {}) == {"task_id": "x"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

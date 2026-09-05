# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""kling_provider.py 单元测试(真实 API 实现)。

测试覆盖:
- kling_jwt:HS256 结构(header/payload)+ 签名可复算验证
- _resolve_credentials:api_key "AK:SK" / 环境变量 / 双 fallback
- configured / _auth_headers 未配置 503
- complete / astream 显式 400 拒绝(chat 不可用)
- _check_code 业务错误(HTTP 200 但 code != 0)
- _size_to_aspect 尺寸映射
- generate_image:同步 images / 异步 task_id 轮询 / 业务错误 / 缺字段
- generate_video:task_id 轮询 / image2video / mode 归一化
- _poll:failed / 超时
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any

import pytest

from app.providers.base_provider import ProviderError
from app.providers.kling_provider import KlingProvider, kling_jwt


# =============================================================================
# kling_jwt 签名
# =============================================================================


def test_kling_jwt_structure_and_signature():
    """JWT 三段结构,header/payload 字段与官方文档一致,签名可复算。"""
    now = 1_700_000_000
    token = kling_jwt("ak-test", "sk-test", now=now)
    h, p, s = token.split(".")
    header = json.loads(base64.urlsafe_b64decode(h + "=="))
    assert header == {"alg": "HS256", "typ": "JWT"}
    payload = json.loads(base64.urlsafe_b64decode(p + "=="))
    assert payload == {"iss": "ak-test", "exp": now + 1800, "nbf": now - 5}
    signing_input = f"{h}.{p}".encode("ascii")
    expected = base64.urlsafe_b64encode(
        hmac.new(b"sk-test", signing_input, hashlib.sha256).digest()
    ).rstrip(b"=").decode("ascii")
    assert s == expected


def test_kling_jwt_wrong_sk_produces_different_signature():
    """SK 不同 → 签名不同。"""
    t1 = kling_jwt("ak", "sk-1", now=100)
    t2 = kling_jwt("ak", "sk-2", now=100)
    assert t1.rsplit(".", 1)[-1] != t2.rsplit(".", 1)[-1]


# =============================================================================
# 凭据解析 / configured / _auth_headers
# =============================================================================


def test_resolve_credentials_from_api_key_colon_format():
    """api_key "AK:SK" 冒号格式优先于环境变量。"""
    ak, sk = KlingProvider._resolve_credentials("my-ak:my-sk")
    assert (ak, sk) == ("my-ak", "my-sk")


def test_resolve_credentials_fallback_to_env(monkeypatch):
    """无冒号 api_key → 环境变量 KLING_ACCESS_KEY/KLING_SECRET_KEY。"""
    monkeypatch.setenv("KLING_ACCESS_KEY", "env-ak")
    monkeypatch.setenv("KLING_SECRET_KEY", "env-sk")
    ak, sk = KlingProvider._resolve_credentials(None)
    assert (ak, sk) == ("env-ak", "env-sk")


def test_resolve_credentials_empty_when_nothing_set(monkeypatch):
    """无 api_key 无环境变量 → 空字符串。"""
    monkeypatch.delenv("KLING_ACCESS_KEY", raising=False)
    monkeypatch.delenv("KLING_SECRET_KEY", raising=False)
    assert KlingProvider._resolve_credentials(None) == ("", "")


def test_configured_true_with_colon_api_key(monkeypatch):
    """api_key "AK:SK" → configured=True。"""
    monkeypatch.delenv("KLING_ACCESS_KEY", raising=False)
    monkeypatch.delenv("KLING_SECRET_KEY", raising=False)
    p = KlingProvider("ak:sk")
    assert p.configured is True
    assert p.base_url == "https://api.klingai.com"


def test_configured_false_without_credentials(monkeypatch):
    """无凭据 → configured=False。"""
    monkeypatch.delenv("KLING_ACCESS_KEY", raising=False)
    monkeypatch.delenv("KLING_SECRET_KEY", raising=False)
    p = KlingProvider(None)
    assert p.configured is False


def test_auth_headers_without_credentials_raises_503(monkeypatch):
    """未配置时 _auth_headers 抛 ProviderError(503)。"""
    monkeypatch.delenv("KLING_ACCESS_KEY", raising=False)
    monkeypatch.delenv("KLING_SECRET_KEY", raising=False)
    p = KlingProvider(None)
    with pytest.raises(ProviderError) as exc:
        p._auth_headers()
    assert exc.value.status_code == 503


def test_auth_headers_contain_bearer_jwt(monkeypatch):
    """已配置时 Authorization 为 Bearer + 三段 JWT。"""
    p = KlingProvider("ak:sk")
    headers = p._auth_headers()
    token = headers["Authorization"].removeprefix("Bearer ")
    assert len(token.split(".")) == 3


def test_custom_api_base():
    """自定义 api_base 覆盖默认。"""
    p = KlingProvider("ak:sk", api_base="https://kling.example.com/")
    assert p.base_url == "https://kling.example.com"


# =============================================================================
# chat 不可用(显式 400,非 503 stub)
# =============================================================================


async def test_complete_rejects_with_400():
    p = KlingProvider("ak:sk")
    with pytest.raises(ProviderError) as exc:
        await p.complete([{"role": "user", "content": "hi"}], "kling-v1")
    assert exc.value.status_code == 400


async def test_astream_rejects_with_400():
    p = KlingProvider("ak:sk")
    with pytest.raises(ProviderError) as exc:
        async for _ in p.astream([{"role": "user", "content": "hi"}], "kling-v1"):
            pass
    assert exc.value.status_code == 400


# =============================================================================
# _check_code 业务错误
# =============================================================================


def test_check_code_zero_returns_inner_data():
    p = KlingProvider("ak:sk")
    assert p._check_code({"code": 0, "data": {"x": 1}}, "u") == {"x": 1}


def test_check_code_none_code_returns_data():
    p = KlingProvider("ak:sk")
    assert p._check_code({"data": {"y": 2}}, "u") == {"y": 2}
    assert p._check_code({}, "u") == {}


def test_check_code_nonzero_raises_502():
    p = KlingProvider("ak:sk")
    with pytest.raises(ProviderError) as exc:
        p._check_code({"code": 1001, "message": "bad prompt"}, "u")
    assert exc.value.status_code == 502
    assert "1001" in str(exc.value)


# =============================================================================
# _size_to_aspect
# =============================================================================


@pytest.mark.parametrize(
    "size,expected",
    [
        ("1024x1024", "1:1"),
        ("1920x1080", "16:9"),
        ("1080x1920", "9:16"),
        ("1440x1080", "4:3"),
        ("1080x1440", "3:4"),
        ("not-a-size", "1:1"),
        ("10x0", "1:1"),
    ],
)
def test_size_to_aspect_mapping(size: str, expected: str):
    assert KlingProvider._size_to_aspect(size) == expected


# =============================================================================
# generate_image
# =============================================================================


def _kling_provider_with_requests(monkeypatch, responses: list[dict[str, Any]]):
    """构造 provider 并按顺序回放 _request 响应,记录调用。"""
    p = KlingProvider("ak:sk")
    calls: list[tuple[str, str, dict[str, Any]]] = []
    queue = list(responses)

    async def fake_request(method: str, url: str, **kwargs: Any):
        calls.append((method, url, kwargs))
        return queue.pop(0)

    monkeypatch.setattr(p, "_request", fake_request)
    return p, calls


async def test_generate_image_sync_path(monkeypatch):
    """同步协议:直接返回 images。"""
    p, calls = _kling_provider_with_requests(
        monkeypatch,
        [{"code": 0, "data": {"images": [{"url": "https://img/u1"}]}}],
    )
    result = await p.generate_image("a cat", "kolors", size="1024x1024")
    assert result == {"provider": "kling", "model": "kolors", "data": [{"url": "https://img/u1"}]}
    method, url, kwargs = calls[0]
    assert method == "POST"
    assert url == "https://api.klingai.com/v1/images/text2image"
    assert kwargs["json"]["prompt"] == "a cat"
    assert kwargs["json"]["aspect_ratio"] == "1:1"


async def test_generate_image_async_fallback_polls_task(monkeypatch):
    """异步协议:先返回 task_id → 轮询至 succeed。"""
    p, calls = _kling_provider_with_requests(
        monkeypatch,
        [
            {"code": 0, "data": {"task_id": "t1"}},
            {"code": 0, "data": {"task_status": "succeed", "images": [{"url": "https://img/u2"}]}},
        ],
    )
    result = await p.generate_image("a cat", "kolors")
    assert result["data"] == [{"url": "https://img/u2"}]
    assert calls[1][0] == "GET"
    assert calls[1][1].endswith("/v1/images/text2image/t1")


async def test_generate_image_missing_images_and_task_id(monkeypatch):
    """既无 images 又无 task_id → ProviderError 502。"""
    p, _ = _kling_provider_with_requests(monkeypatch, [{"code": 0, "data": {}}])
    with pytest.raises(ProviderError) as exc:
        await p.generate_image("x", "kolors")
    assert exc.value.status_code == 502


async def test_generate_image_business_error(monkeypatch):
    """业务错误 code!=0 → ProviderError 502。"""
    p, _ = _kling_provider_with_requests(
        monkeypatch, [{"code": 1002, "message": "sensitive"}]
    )
    with pytest.raises(ProviderError) as exc:
        await p.generate_image("x", "kolors")
    assert exc.value.status_code == 502


async def test_generate_image_invalid_aspect_falls_back(monkeypatch):
    """非法 aspect_ratio → 回退 1:1。"""
    p, calls = _kling_provider_with_requests(
        monkeypatch, [{"code": 0, "data": {"images": [{"url": "u"}]}}]
    )
    await p.generate_image("x", "kolors", aspect_ratio="7:5")
    assert calls[0][2]["json"]["aspect_ratio"] == "1:1"


async def test_generate_image_negative_prompt_passed(monkeypatch):
    p, calls = _kling_provider_with_requests(
        monkeypatch, [{"code": 0, "data": {"images": [{"url": "u"}]}}]
    )
    await p.generate_image("x", "kolors", negative_prompt="blurry")
    assert calls[0][2]["json"]["negative_prompt"] == "blurry"


# =============================================================================
# generate_video
# =============================================================================


async def test_generate_video_text2video_polls_to_succeed(monkeypatch):
    """文生视频:task_id → 轮询 succeed → 取 task_result.videos[0].url。"""
    p, calls = _kling_provider_with_requests(
        monkeypatch,
        [
            {"code": 0, "data": {"task_id": "tv1"}},
            {
                "code": 0,
                "data": {
                    "task_status": "succeed",
                    "task_result": {"videos": [{"url": "https://vid/v1", "duration": "5"}]},
                },
            },
        ],
    )
    result = await p.generate_video("dancing", "kling-v1", duration=5)
    assert result["provider"] == "kling"
    assert result["task_id"] == "tv1"
    assert result["video_url"] == "https://vid/v1"
    assert calls[0][1].endswith("/v1/videos/text2video")
    assert calls[1][1].endswith("/v1/videos/text2video/tv1")
    assert calls[0][2]["json"]["duration"] == "5"
    assert calls[0][2]["json"]["mode"] == "std"


async def test_generate_video_image2video(monkeypatch):
    """传 image → 走 image2video 端点。"""
    p, calls = _kling_provider_with_requests(
        monkeypatch,
        [
            {"code": 0, "data": {"task_id": "tv2"}},
            {
                "code": 0,
                "data": {
                    "task_status": "succeed",
                    "task_result": {"videos": [{"url": "https://vid/v2"}]},
                },
            },
        ],
    )
    result = await p.generate_video("motion", "kling-v1", image="https://img/in.png")
    assert result["video_url"] == "https://vid/v2"
    assert calls[0][1].endswith("/v1/videos/image2video")
    assert calls[0][2]["json"]["image"] == "https://img/in.png"


async def test_generate_video_invalid_mode_normalized(monkeypatch):
    """mode 非法值 → 归一化为 std。"""
    p, calls = _kling_provider_with_requests(
        monkeypatch,
        [
            {"code": 0, "data": {"task_id": "t"}},
            {"code": 0, "data": {"task_status": "succeed", "task_result": {"videos": [{"url": "u"}]}}},
        ],
    )
    await p.generate_video("x", "kling-v1", mode="ultra")
    assert calls[0][2]["json"]["mode"] == "std"


async def test_generate_video_missing_task_id(monkeypatch):
    p, _ = _kling_provider_with_requests(monkeypatch, [{"code": 0, "data": {}}])
    with pytest.raises(ProviderError) as exc:
        await p.generate_video("x", "kling-v1")
    assert exc.value.status_code == 502


async def test_generate_video_poll_failed(monkeypatch):
    p, _ = _kling_provider_with_requests(
        monkeypatch,
        [
            {"code": 0, "data": {"task_id": "t"}},
            {"code": 0, "data": {"task_status": "failed", "task_status_msg": "content risk"}},
        ],
    )
    with pytest.raises(ProviderError) as exc:
        await p.generate_video("x", "kling-v1")
    assert exc.value.status_code == 502
    assert "failed" in str(exc.value)


# =============================================================================
# _poll 超时
# =============================================================================


async def test_poll_timeout_raises_504(monkeypatch):
    """max_wait=0 且状态 pending → 立即 504。"""
    p, _ = _kling_provider_with_requests(
        monkeypatch, [{"code": 0, "data": {"task_status": "submitted"}}]
    )
    with pytest.raises(ProviderError) as exc:
        await p._poll("https://api.klingai.com/v1/videos/text2video/t", max_wait=0)
    assert exc.value.status_code == 504
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""agnes_video_provider.py 单元测试(契约对齐 agnes-ai-cli 源码)。

覆盖:
- 提交 payload 形状(model/prompt/mode/size/image/seed/negative_prompt)
- video_id 形态走 /agnesapi,legacy task_ 形态走 {base}/videos/{id}
- 提交即终态(completed + url)不再轮询
- 轮询 queued→in_progress→succeeded
- video_url 五种承载形态
- failed / 超时 / 4xx / 非 JSON / 缺 task_id
- 未配置凭据 503、chat 400
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from app.providers.agnes_video_provider import AgnesVideoProvider, _extract_video_url, _origin_of
from app.providers.base_provider import ProviderError

_BASE = "https://api.agnes-ai.cn/v1"


class _Resp:
    def __init__(self, status_code: int = 200, payload: Any = None, text: str | None = None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text if text is not None else str(self._payload)

    def json(self) -> Any:
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class _Client:
    def __init__(self, responses: list[_Resp]):
        self.responses = list(responses)
        self.calls: list[dict[str, Any]] = []

    async def request(self, method: str, url: str, **kwargs: Any) -> _Resp:
        self.calls.append({"method": method, "url": url, **kwargs})
        if not self.responses:
            raise AssertionError(f"意外的额外请求: {method} {url}")
        return self.responses.pop(0)


def _provider(client: _Client, **kwargs: Any) -> AgnesVideoProvider:
    prov = AgnesVideoProvider("test-key", _BASE, poll_interval=0, poll_max_wait=0.05, **kwargs)
    return prov


def _patched(client: _Client):
    return patch("app.providers.agnes_video_provider.get_http_client", return_value=client)


def test_origin_of_strips_path():
    assert _origin_of("https://api.agnes-ai.cn/v1") == "https://api.agnes-ai.cn"
    assert _origin_of("https://api.agnes-ai.cn") == "https://api.agnes-ai.cn"


def test_extract_video_url_forms():
    assert _extract_video_url({"metadata": {"url": "https://a/1.mp4"}}) == "https://a/1.mp4"
    assert _extract_video_url({"video_url": "https://a/2.mp4"}) == "https://a/2.mp4"
    assert _extract_video_url({"url": "https://a/3.mp4"}) == "https://a/3.mp4"
    assert _extract_video_url({"output_url": "https://a/4.mp4"}) == "https://a/4.mp4"
    assert _extract_video_url({"result": {"video_url": "https://a/5.mp4"}}) == "https://a/5.mp4"
    assert _extract_video_url({"url": "not-a-url"}) == ""


async def test_not_configured_raises_503():
    prov = AgnesVideoProvider("", _BASE)
    with pytest.raises(ProviderError) as exc:
        await prov.generate_video("p", "agnes-video-2.5")
    assert exc.value.status_code == 503


async def test_chat_rejected():
    prov = AgnesVideoProvider("k", _BASE)
    with pytest.raises(ProviderError) as exc:
        await prov.complete([{"role": "user", "content": "hi"}], "agnes-video-2.5")
    assert exc.value.status_code == 400


async def test_submit_payload_and_video_id_polling():
    client = _Client(
        [
            _Resp(200, {"task_id": "task_1", "video_id": "video_1", "status": "queued"}),
            _Resp(200, {"status": "in_progress"}),
            _Resp(200, {"status": "succeeded", "metadata": {"url": "https://cdn/x.mp4"}}),
        ]
    )
    with _patched(client):
        out = await _provider(client).generate_video("a red apple", "agnes-video-2.5", duration=6)
    assert out == {
        "provider": "agnes",
        "model": "agnes-video-2.5",
        "task_id": "task_1",
        "video_url": "https://cdn/x.mp4",
        "duration": 6,
    }
    submit = client.calls[0]
    assert submit["method"] == "POST"
    assert submit["url"] == f"{_BASE}/videos"
    assert submit["json"] == {
        "model": "agnes-video-2.5",
        "prompt": "a red apple",
        "mode": "text",
        "size": "720P",
    }
    assert submit["headers"]["Authorization"] == "Bearer test-key"
    # video_id 形态必须走站点根 /agnesapi
    assert client.calls[1]["url"] == "https://api.agnes-ai.cn/agnesapi?video_id=video_1"
    assert client.calls[1]["method"] == "GET"


async def test_legacy_task_id_polling_path():
    client = _Client(
        [
            _Resp(200, {"task_id": "task_9", "status": "queued"}),
            _Resp(200, {"status": "completed", "video_url": "https://cdn/y.mp4"}),
        ]
    )
    with _patched(client):
        out = await _provider(client).generate_video("p", "agnes-video-2.5")
    assert out["video_url"] == "https://cdn/y.mp4"
    assert client.calls[1]["url"] == f"{_BASE}/videos/task_9"


async def test_submit_terminal_skips_polling():
    client = _Client(
        [
            _Resp(200, {"task_id": "task_2", "status": "completed", "url": "https://cdn/z.mp4"}),
        ]
    )
    with _patched(client):
        out = await _provider(client).generate_video("p", "agnes-video-2.5")
    assert out["video_url"] == "https://cdn/z.mp4"
    assert len(client.calls) == 1


async def test_image_mode_and_optional_fields():
    client = _Client(
        [
            _Resp(200, {"task_id": "task_3", "status": "completed", "url": "https://cdn/i.mp4"}),
        ]
    )
    with _patched(client):
        await _provider(client).generate_video(
            "add wind",
            "agnes-video-2.5-flash",
            image="https://img/a.png",
            seed=7,
            negative_prompt="blur",
            size="1080P",
        )
    body = client.calls[0]["json"]
    assert body["mode"] == "image"
    assert body["image"] == "https://img/a.png"
    assert body["seed"] == 7
    assert body["negative_prompt"] == "blur"
    assert body["size"] == "1080P"
    assert body["model"] == "agnes-video-2.5-flash"


async def test_non_video_model_falls_back_to_default():
    client = _Client(
        [
            _Resp(200, {"task_id": "task_4", "status": "completed", "url": "https://cdn/a.mp4"}),
        ]
    )
    with _patched(client):
        await _provider(client).generate_video("p", "agnes-2.5-pro")
    assert client.calls[0]["json"]["model"] == "agnes-video-2.5"


async def test_failed_status_raises_502():
    client = _Client(
        [
            _Resp(200, {"task_id": "task_5", "status": "queued"}),
            _Resp(200, {"status": "failed", "error": "generate video failed"}),
        ]
    )
    with _patched(client):
        with pytest.raises(ProviderError) as exc:
            await _provider(client).generate_video("p", "agnes-video-2.5")
    assert exc.value.status_code == 502
    assert "generate video failed" in str(exc.value)


async def test_timeout_raises_504():
    client = _Client(
        [
            _Resp(200, {"task_id": "task_6", "status": "queued"}),
            _Resp(200, {"status": "queued"}),
        ]
    )
    prov = AgnesVideoProvider("test-key", _BASE, poll_interval=0, poll_max_wait=0)
    with _patched(client):
        with pytest.raises(ProviderError) as exc:
            await prov.generate_video("p", "agnes-video-2.5")
    assert exc.value.status_code == 504


async def test_quota_error_surfaces_upstream_message():
    client = _Client(
        [
            _Resp(
                402,
                {
                    "code": "insufficient_user_quota",
                    "message": "用户额度不足，剩余额度: ￥0.000000",
                },
            ),
        ]
    )
    with _patched(client):
        with pytest.raises(ProviderError) as exc:
            await _provider(client).generate_video("p", "agnes-video-2.5")
    assert exc.value.status_code == 402
    assert "insufficient_user_quota" in str(exc.value) or "额度不足" in str(exc.value)


async def test_missing_task_id_raises_502():
    client = _Client([_Resp(200, {"status": "queued"})])
    with _patched(client):
        with pytest.raises(ProviderError) as exc:
            await _provider(client).generate_video("p", "agnes-video-2.5")
    assert exc.value.status_code == 502


async def test_non_json_response_raises():
    client = _Client([_Resp(200, ValueError("bad json"), text="<html>")])
    with _patched(client):
        with pytest.raises(ProviderError) as exc:
            await _provider(client).generate_video("p", "agnes-video-2.5")
    assert exc.value.status_code == 502


async def test_completed_without_url_raises_502():
    client = _Client(
        [
            _Resp(200, {"task_id": "task_7", "status": "queued"}),
            _Resp(200, {"status": "succeeded"}),
        ]
    )
    with _patched(client):
        with pytest.raises(ProviderError) as exc:
            await _provider(client).generate_video("p", "agnes-video-2.5")
    assert exc.value.status_code == 502
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

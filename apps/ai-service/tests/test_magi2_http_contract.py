# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MAGI-2 的 HTTP 契约测试(真实 httpx 序列化,不只是 mock _request)。

前面的 test_magi2_provider.py 直接替换 `_request`,覆盖不到 URL 拼接、Bearer
头、content[] JSON 形状与 int64 任务号;这里用 httpx.MockTransport 走完整
请求编码路径,再断言实际发出的报文。
"""

from __future__ import annotations

import json

import httpx
import pytest

from app.providers import base_provider
from app.providers.magi2_provider import Magi2Provider

TASKS = "/compatible/ark/api/v3/contents/generations/tasks"


def _install(monkeypatch, handler) -> httpx.AsyncClient:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(base_provider, "get_http_client", lambda: client)
    return client


@pytest.mark.asyncio
async def test_submit_sends_bearer_and_ark_content(monkeypatch):
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": 9007199254740993, "status": "queued"})

    client = _install(monkeypatch, handler)
    p = Magi2Provider("sk-sand", "https://api.sand.ai")
    result = await p.generate_video(
        "海浪拍岸",
        "",
        duration=10,
        wait=False,
        image="https://cdn.example.com/first.jpg",
        aspect_ratio="9:16",
        generate_audio=False,
    )
    await client.aclose()

    assert str(seen["url"]) == f"https://api.sand.ai{TASKS}"
    assert seen["auth"] == "Bearer sk-sand"
    body = seen["body"]
    assert body["model"] == "magi-2"
    assert body["duration"] == 10
    assert body["ratio"] == "9:16"
    assert body["resolution"] == "1080p"
    assert body["generate_audio"] is False
    assert body["content"][0] == {"type": "text", "text": "海浪拍岸"}
    assert body["content"][1]["role"] == "first_frame"
    # int64 不能经 JS Number 丢精度:必须原样转十进制字符串
    assert result["task_id"] == "9007199254740993"


@pytest.mark.asyncio
async def test_status_reads_content_video_url(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert str(request.url).endswith(f"{TASKS}/9007199254740993")
        return httpx.Response(
            200,
            json={
                "status": "succeeded",
                "content": {"video_url": "https://cdn.example.com/out.mp4"},
                "duration": 10,
            },
        )

    client = _install(monkeypatch, handler)
    p = Magi2Provider("sk-sand", "https://api.sand.ai")
    st = await p.get_task_status("9007199254740993")
    await client.aclose()

    assert st["ok"] is True
    assert st["video_url"] == "https://cdn.example.com/out.mp4"
    assert st["status"] == "succeeded"


@pytest.mark.asyncio
async def test_status_404_maps_to_failed(monkeypatch):
    client = _install(monkeypatch, lambda request: httpx.Response(404, json={"error": "not found"}))
    p = Magi2Provider("sk-sand", "https://api.sand.ai")
    st = await p.get_task_status("42")
    await client.aclose()

    assert st["ok"] is False
    assert st["failed"] is True
    assert st["status"] == "not_found"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

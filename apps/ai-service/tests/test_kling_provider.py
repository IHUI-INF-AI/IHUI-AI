"""kling_provider.py 单元测试。

快手可灵适配器:503 降级实现(API 待接入)。

测试覆盖:
- __init__:默认 base_url / 自定义 api_base / timeout
- 继承 BaseProvider
- complete:抛 HTTPException(503)
- astream:抛 HTTPException(503)
- generate_image:抛 HTTPException(503)
- generate_video:抛 HTTPException(503)
- 错误消息文案校验
"""

from __future__ import annotations

from typing import Any, AsyncIterator

import pytest
from fastapi import HTTPException

from app.providers.base_provider import BaseProvider
from app.providers.kling_provider import KlingProvider


# =============================================================================
# __init__
# =============================================================================


def test_init_default_base_url():
    """默认 base_url 指向快手可灵 API。"""
    p = KlingProvider(api_key="kling-key")
    assert p.base_url == "https://api.kuaishoutechnology.com/v1"
    assert p.api_key == "kling-key"


def test_init_custom_api_base():
    """自定义 api_base 会覆盖默认值(末尾 / 被剥离)。"""
    p = KlingProvider(api_key="k", api_base="https://kling.example.com/v1/")
    assert p.base_url == "https://kling.example.com/v1"


def test_init_timeout_default_60():
    """timeout 默认 60.0。"""
    p = KlingProvider(api_key="k")
    assert p.timeout == 60.0


def test_init_custom_timeout():
    """可自定义 timeout。"""
    p = KlingProvider(api_key="k", timeout=15.0)
    assert p.timeout == 15.0


def test_inherits_base_provider():
    """KlingProvider 继承 BaseProvider。"""
    p = KlingProvider(api_key="k")
    assert isinstance(p, BaseProvider)


# =============================================================================
# complete(503 降级)
# =============================================================================


async def test_complete_raises_503():
    """complete 抛 HTTPException 503。"""
    p = KlingProvider(api_key="k")
    with pytest.raises(HTTPException) as exc_info:
        await p.complete([{"role": "user", "content": "hi"}], "kling-v1")
    assert exc_info.value.status_code == 503


async def test_complete_error_message_mentions_kling():
    """complete 错误消息含 'Kling'。"""
    p = KlingProvider(api_key="k")
    with pytest.raises(HTTPException) as exc_info:
        await p.complete([{"role": "user", "content": "hi"}], "kling-v1")
    assert "Kling" in exc_info.value.detail


async def test_complete_error_message_mentions_chat_unavailable():
    """complete 错误消息说明 chat 接口不可用。"""
    p = KlingProvider(api_key="k")
    with pytest.raises(HTTPException) as exc_info:
        await p.complete([{"role": "user", "content": "hi"}], "kling-v1")
    assert "chat" in exc_info.value.detail


# =============================================================================
# astream(503 降级)
# =============================================================================


async def test_astream_raises_503():
    """astream 抛 HTTPException 503。"""
    p = KlingProvider(api_key="k")
    with pytest.raises(HTTPException) as exc_info:
        async for _ in p.astream([{"role": "user", "content": "hi"}], "kling-v1"):
            pass
    assert exc_info.value.status_code == 503


async def test_astream_error_message_mentions_kling():
    """astream 错误消息含 'Kling'。"""
    p = KlingProvider(api_key="k")
    with pytest.raises(HTTPException) as exc_info:
        async for _ in p.astream([{"role": "user", "content": "hi"}], "kling-v1"):
            pass
    assert "Kling" in exc_info.value.detail


# =============================================================================
# generate_image(503 降级)
# =============================================================================


async def test_generate_image_raises_503():
    """generate_image 抛 HTTPException 503。"""
    p = KlingProvider(api_key="k")
    with pytest.raises(HTTPException) as exc_info:
        await p.generate_image("a cat", "kling-v1")
    assert exc_info.value.status_code == 503


async def test_generate_image_error_message_mentions_image():
    """generate_image 错误消息含 '图像'。"""
    p = KlingProvider(api_key="k")
    with pytest.raises(HTTPException) as exc_info:
        await p.generate_image("a cat", "kling-v1")
    assert "图像" in exc_info.value.detail


# =============================================================================
# generate_video(503 降级)
# =============================================================================


async def test_generate_video_raises_503():
    """generate_video 抛 HTTPException 503。"""
    p = KlingProvider(api_key="k")
    with pytest.raises(HTTPException) as exc_info:
        await p.generate_video("a cat playing", "kling-v1")
    assert exc_info.value.status_code == 503


async def test_generate_video_error_message_mentions_video():
    """generate_video 错误消息含 '视频'。"""
    p = KlingProvider(api_key="k")
    with pytest.raises(HTTPException) as exc_info:
        await p.generate_video("a cat playing", "kling-v1")
    assert "视频" in exc_info.value.detail


async def test_generate_video_accepts_duration_kwarg():
    """generate_video 接受 duration 参数(仍抛 503)。"""
    p = KlingProvider(api_key="k")
    with pytest.raises(HTTPException):
        await p.generate_video("test", "kling-v1", duration=10)


# =============================================================================
# 通用降级行为
# =============================================================================


async def test_all_methods_status_code_is_503():
    """所有降级方法 status_code 都是 503。"""
    p = KlingProvider(api_key="k")
    methods_503 = []

    try:
        await p.complete([], "kling-v1")
    except HTTPException as e:
        methods_503.append(e.status_code)

    try:
        async for _ in p.astream([], "kling-v1"):
            pass
    except HTTPException as e:
        methods_503.append(e.status_code)

    try:
        await p.generate_image("x", "kling-v1")
    except HTTPException as e:
        methods_503.append(e.status_code)

    try:
        await p.generate_video("x", "kling-v1")
    except HTTPException as e:
        methods_503.append(e.status_code)

    assert methods_503 == [503, 503, 503, 503]

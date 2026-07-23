"""douyin.py 适配器单元测试。

抖音 适配器:基于抖音开放平台 OpenAPI。

测试覆盖:
- 类属性:platform_id / platform_name / supported_formats / requires_credentials
- verify_credentials:缺 token/open_id/client_key / HTTP 异常 / 非 200 / 非 JSON / 验证失败 / 成功
- publish:非 video 格式 / 缺 file_path
- _upload_video:文件不存在
- publish 失败:_upload_video 失败时返回 PublishResult(success=False)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.publish.adapters.douyin import DouyinAdapter
from app.services.publish.base_adapter import PublishContent, PublishResult


# =============================================================================
# 类属性
# =============================================================================


def test_class_attributes():
    """类属性固定值。"""
    assert DouyinAdapter.platform_id == "douyin"
    assert DouyinAdapter.platform_name == "抖音"
    assert DouyinAdapter.supported_formats == ["video"]
    assert DouyinAdapter.requires_credentials == ["access_token", "open_id", "client_key", "client_secret"]
    assert DouyinAdapter.needs_browser is False


# =============================================================================
# verify_credentials
# =============================================================================


async def test_verify_credentials_missing_access_token():
    """缺 access_token → 失败。"""
    a = DouyinAdapter()
    ok, msg = await a.verify_credentials({"access_token": "", "open_id": "x", "client_key": "y"})
    assert ok is False
    assert "access_token" in msg


async def test_verify_credentials_missing_open_id():
    """缺 open_id → 失败。"""
    a = DouyinAdapter()
    ok, msg = await a.verify_credentials({"access_token": "t", "open_id": "", "client_key": "y"})
    assert ok is False
    assert "open_id" in msg


async def test_verify_credentials_missing_client_key():
    """缺 client_key → 失败。"""
    a = DouyinAdapter()
    ok, msg = await a.verify_credentials({"access_token": "t", "open_id": "o", "client_key": ""})
    assert ok is False
    assert "client_key" in msg


async def test_verify_credentials_http_error():
    """HTTP 异常 → 失败。"""
    a = DouyinAdapter()

    fake_client = MagicMock()
    fake_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"access_token": "t", "open_id": "o", "client_key": "c"})

    assert ok is False
    assert "http error" in msg


async def test_verify_credentials_non_200():
    """非 200 → 失败。"""
    a = DouyinAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 500
    fake_resp.text = "err"

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"access_token": "t", "open_id": "o", "client_key": "c"})

    assert ok is False
    assert "500" in msg


async def test_verify_credentials_invalid_json():
    """非 JSON → 失败。"""
    a = DouyinAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = "not json"
    fake_resp.json.side_effect = ValueError("bad")

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"access_token": "t", "open_id": "o", "client_key": "c"})

    assert ok is False
    assert "invalid json" in msg


async def test_verify_credentials_failed_response():
    """响应含 error_code != 0 → 失败。"""
    a = DouyinAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = "{}"
    fake_resp.json.return_value = {"data": {"error_code": 100, "description": "invalid token"}}

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"access_token": "bad", "open_id": "o", "client_key": "c"})

    assert ok is False
    assert "verify failed" in msg


async def test_verify_credentials_success():
    """成功 → (True, 'connected as <nickname> (open_id=...)')。"""
    a = DouyinAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = "{}"
    fake_resp.json.return_value = {
        "data": {
            "description": "user_info",
            "open_id": "open-123",
            "nickname": "tester",
        },
    }

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"access_token": "t", "open_id": "o", "client_key": "c"})

    assert ok is True
    assert "tester" in msg
    assert "open-123" in msg


# =============================================================================
# publish 输入校验
# =============================================================================


async def test_publish_non_video_format():
    """非 video 格式 → 失败。"""
    a = DouyinAdapter()
    result = await a.publish(PublishContent(format="md", title="t", text="hi"), {}, {})
    assert result.success is False
    assert "video" in result.error_message


async def test_publish_missing_file_path():
    """缺 file_path → 失败。"""
    a = DouyinAdapter()
    result = await a.publish(PublishContent(format="video", title="t"), {}, {})
    assert result.success is False
    assert "file_path" in result.error_message


# =============================================================================
# _upload_video
# =============================================================================


async def test_upload_video_file_not_found():
    """_upload_video 文件不存在 → (False, 'video not found', {})。"""
    a = DouyinAdapter()
    ok, msg, payload = await a._upload_video("tok", "oid", "/nonexistent/video.mp4")
    assert ok is False
    assert "not found" in msg
    assert payload == {}


async def test_upload_video_init_upload_http_error(tmp_path):
    """init_upload HTTP 异常 → (False, 'init upload failed', {})。"""
    a = DouyinAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_client = MagicMock()
    fake_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=fake_client):
        ok, msg, payload = await a._upload_video("tok", "oid", str(video))

    assert ok is False
    assert "init upload failed" in msg


async def test_upload_video_init_upload_non_200(tmp_path):
    """init_upload 非 200 → (False, 'init upload <code>', {})。"""
    a = DouyinAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_resp = MagicMock()
    fake_resp.status_code = 500
    fake_resp.text = "err"

    fake_client = MagicMock()
    fake_client.post = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=fake_client):
        ok, msg, payload = await a._upload_video("tok", "oid", str(video))

    assert ok is False
    assert "init upload 500" in msg


async def test_upload_video_init_upload_missing_fields(tmp_path):
    """init_upload 缺 upload_token/video_id → 失败。"""
    a = DouyinAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {"data": {}}  # 缺字段

    fake_client = MagicMock()
    fake_client.post = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=fake_client):
        ok, msg, payload = await a._upload_video("tok", "oid", str(video))

    assert ok is False
    assert "missing fields" in msg


# =============================================================================
# publish 失败链路
# =============================================================================


async def test_publish_upload_failure_returns_failure_result(tmp_path):
    """publish 内部 _upload_video 失败时返回 PublishResult(success=False)。"""
    a = DouyinAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    # 文件存在但 init_upload 异常
    fake_client = MagicMock()
    fake_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=fake_client):
        result = await a.publish(
            PublishContent(format="video", title="t", file_path=str(video)),
            {"access_token": "tok", "open_id": "oid"},
            {},
        )

    assert isinstance(result, PublishResult)
    assert result.success is False
    assert result.platform == "douyin"

"""kuaishou.py 适配器单元测试。

快手 适配器:基于快手开放平台 OpenAPI。

测试覆盖:
- 类属性:platform_id / platform_name / supported_formats / requires_credentials
- verify_credentials:缺 token/app_id / HTTP 异常 / 非 200 / 非 JSON / result != 1 / 成功
- publish:非 video 格式 / 缺 file_path / 缺 open_id
- _upload_video:文件不存在 / HTTP 异常 / 非 200 / result != 1 / 缺 video_id
- publish 失败链路
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.publish.adapters.kuaishou import KuaishouAdapter
from app.services.publish.base_adapter import PublishContent, PublishResult


# =============================================================================
# 类属性
# =============================================================================


def test_class_attributes():
    """类属性固定值。"""
    assert KuaishouAdapter.platform_id == "kuaishou"
    assert KuaishouAdapter.platform_name == "快手"
    assert KuaishouAdapter.supported_formats == ["video"]
    assert KuaishouAdapter.requires_credentials == ["access_token", "app_id", "app_secret"]
    assert KuaishouAdapter.needs_browser is False


# =============================================================================
# verify_credentials
# =============================================================================


async def test_verify_credentials_missing_access_token():
    """缺 access_token → 失败。"""
    a = KuaishouAdapter()
    ok, msg = await a.verify_credentials({"access_token": "", "app_id": "x"})
    assert ok is False
    assert "access_token" in msg


async def test_verify_credentials_missing_app_id():
    """缺 app_id → 失败。"""
    a = KuaishouAdapter()
    ok, msg = await a.verify_credentials({"access_token": "t", "app_id": ""})
    assert ok is False
    assert "app_id" in msg


async def test_verify_credentials_http_error():
    """HTTP 异常 → 失败。"""
    a = KuaishouAdapter()

    fake_client = MagicMock()
    fake_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"access_token": "t", "app_id": "a"})

    assert ok is False
    assert "http error" in msg


async def test_verify_credentials_non_200():
    """非 200 → 失败。"""
    a = KuaishouAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 503
    fake_resp.text = "err"

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"access_token": "t", "app_id": "a"})

    assert ok is False
    assert "503" in msg


async def test_verify_credentials_invalid_json():
    """非 JSON → 失败。"""
    a = KuaishouAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = "not json"
    fake_resp.json.side_effect = ValueError("bad")

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"access_token": "t", "app_id": "a"})

    assert ok is False
    assert "invalid json" in msg


async def test_verify_credentials_result_not_1():
    """result != 1 → 失败。"""
    a = KuaishouAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = "{}"
    fake_resp.json.return_value = {"result": 0, "error_msg": "invalid token"}

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"access_token": "bad", "app_id": "a"})

    assert ok is False
    assert "verify failed" in msg


async def test_verify_credentials_success():
    """成功 → (True, 'connected as <name>')。"""
    a = KuaishouAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = "{}"
    fake_resp.json.return_value = {
        "result": 1,
        "user_info": {"name": "kwai_user", "kwai_id": "k123"},
    }

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"access_token": "t", "app_id": "a"})

    assert ok is True
    assert "kwai_user" in msg


# =============================================================================
# publish 输入校验
# =============================================================================


async def test_publish_non_video_format():
    """非 video 格式 → 失败。"""
    a = KuaishouAdapter()
    result = await a.publish(PublishContent(format="md", title="t", text="hi"), {}, {})
    assert result.success is False
    assert "video" in result.error_message


async def test_publish_missing_file_path():
    """缺 file_path → 失败。"""
    a = KuaishouAdapter()
    result = await a.publish(PublishContent(format="video", title="t"), {}, {})
    assert result.success is False
    assert "file_path" in result.error_message


async def test_publish_missing_open_id(tmp_path):
    """缺 open_id(平台配置 + 凭证都没有)→ 失败。"""
    a = KuaishouAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    result = await a.publish(
        PublishContent(format="video", title="t", file_path=str(video)),
        {"access_token": "t", "app_id": "a"},  # 无 open_id
        {},  # platform_config 也无 open_id
    )
    assert result.success is False
    assert "open_id" in result.error_message


# =============================================================================
# _upload_video
# =============================================================================


async def test_upload_video_file_not_found():
    """文件不存在 → (False, 'video not found', {})。"""
    a = KuaishouAdapter()
    ok, msg, payload = await a._upload_video("tok", "app", "oid", "/nonexistent.mp4")
    assert ok is False
    assert "not found" in msg
    assert payload == {}


async def test_upload_video_http_error(tmp_path):
    """上传阶段 HTTP 异常 → (False, 'upload failed', {})。"""
    a = KuaishouAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_client = MagicMock()
    fake_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=fake_client):
        ok, msg, payload = await a._upload_video("tok", "app", "oid", str(video))

    assert ok is False
    assert "upload failed" in msg


async def test_upload_video_non_200(tmp_path):
    """上传非 200 → 失败。"""
    a = KuaishouAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_resp = MagicMock()
    fake_resp.status_code = 413
    fake_resp.text = "too large"

    fake_client = MagicMock()
    fake_client.post = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=fake_client):
        ok, msg, payload = await a._upload_video("tok", "app", "oid", str(video))

    assert ok is False
    assert "413" in msg


async def test_upload_video_result_not_1(tmp_path):
    """上传响应 result != 1 → 失败。"""
    a = KuaishouAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {"result": 0, "error_msg": "quota exceeded"}

    fake_client = MagicMock()
    fake_client.post = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=fake_client):
        ok, msg, payload = await a._upload_video("tok", "app", "oid", str(video))

    assert ok is False
    assert "upload failed" in msg


async def test_upload_video_missing_video_id(tmp_path):
    """上传响应缺 video_id → 失败。"""
    a = KuaishouAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {"result": 1, "video_info": {}}  # 缺 video_id

    fake_client = MagicMock()
    fake_client.post = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=fake_client):
        ok, msg, payload = await a._upload_video("tok", "app", "oid", str(video))

    assert ok is False
    assert "video_id" in msg


# =============================================================================
# publish 失败链路
# =============================================================================


async def test_publish_upload_failure_returns_failure_result(tmp_path):
    """publish 内部 _upload_video 失败时返回 PublishResult(success=False)。"""
    a = KuaishouAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_client = MagicMock()
    fake_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=fake_client):
        result = await a.publish(
            PublishContent(format="video", title="t", file_path=str(video)),
            {"access_token": "t", "app_id": "a"},
            {"open_id": "oid"},
        )

    assert isinstance(result, PublishResult)
    assert result.success is False
    assert result.platform == "kuaishou"

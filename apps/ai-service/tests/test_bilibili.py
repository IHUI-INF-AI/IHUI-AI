"""bilibili.py 适配器单元测试。

B站 适配器:基于 Cookie + Web API。

测试覆盖:
- 类属性:platform_id / platform_name / supported_formats / requires_credentials / needs_browser
- _cookies:映射 sessdata/bili_jct/dedeuserid → SESSDATA/bili_jct/DedeUserID
- _headers:User-Agent / Referer / Origin
- verify_credentials:missing sessdata / HTTP 异常 / 非 200 / 非 JSON / code != 0 / 成功
- publish:非 video 格式 / 缺 file_path / 文件不存在 / 空文件
- publish 流程:preupload 失败(非 200 / 坏 JSON / 缺 upos_uri)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.publish.adapters.bilibili import BilibiliAdapter
from app.services.publish.base_adapter import PublishContent, PublishResult


# =============================================================================
# 类属性
# =============================================================================


def test_class_attributes():
    """类属性固定值。"""
    assert BilibiliAdapter.platform_id == "bilibili"
    assert BilibiliAdapter.platform_name == "B站"
    assert BilibiliAdapter.supported_formats == ["video"]
    assert BilibiliAdapter.requires_credentials == ["sessdata", "bili_jct", "dedeuserid"]
    assert BilibiliAdapter.needs_browser is False


# =============================================================================
# _cookies / _headers
# =============================================================================


def test_cookies_mapping():
    """_cookies 把凭证字段映射到 Cookie 名。"""
    a = BilibiliAdapter()
    creds = {"sessdata": "s1", "bili_jct": "j1", "dedeuserid": "u1"}
    cookies = a._cookies(creds)
    assert cookies["SESSDATA"] == "s1"
    assert cookies["bili_jct"] == "j1"
    assert cookies["DedeUserID"] == "u1"


def test_cookies_missing_fields_default_empty():
    """缺失字段默认空字符串。"""
    a = BilibiliAdapter()
    cookies = a._cookies({})
    assert cookies["SESSDATA"] == ""
    assert cookies["bili_jct"] == ""
    assert cookies["DedeUserID"] == ""


def test_headers_contains_required_fields():
    """_headers 含 User-Agent / Referer / Origin。"""
    a = BilibiliAdapter()
    headers = a._headers({})
    assert "User-Agent" in headers
    assert headers["Referer"] == "https://member.bilibili.com"
    assert headers["Origin"] == "https://member.bilibili.com"


# =============================================================================
# verify_credentials
# =============================================================================


async def test_verify_credentials_missing_sessdata():
    """缺 sessdata → (False, 'missing sessdata cookie')。"""
    a = BilibiliAdapter()
    ok, msg = await a.verify_credentials({"sessdata": ""})
    assert ok is False
    assert "sessdata" in msg


async def test_verify_credentials_http_error():
    """HTTP 异常 → (False, 'http error: ...')。"""
    a = BilibiliAdapter()

    fake_client = MagicMock()
    fake_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"sessdata": "abc"})

    assert ok is False
    assert "http error" in msg


async def test_verify_credentials_non_200():
    """非 200 响应 → (False, 'API <code>: ...')。"""
    a = BilibiliAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 500
    fake_resp.text = "server error"
    fake_resp.json.return_value = {}

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"sessdata": "abc"})

    assert ok is False
    assert "500" in msg


async def test_verify_credentials_invalid_json():
    """非 JSON 响应 → (False, 'invalid json response')。"""
    a = BilibiliAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = "not json"
    fake_resp.json.side_effect = ValueError("not json")

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"sessdata": "abc"})

    assert ok is False
    assert "invalid json" in msg


async def test_verify_credentials_not_logged_in():
    """code != 0 → (False, 'not logged in')。"""
    a = BilibiliAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = '{"code":-101}'
    fake_resp.json.return_value = {"code": -101, "message": "not logged in"}

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"sessdata": "expired"})

    assert ok is False
    assert "not logged in" in msg


async def test_verify_credentials_success():
    """成功 → (True, 'connected as <uname> (uid=..., vip=...)')。"""
    a = BilibiliAdapter()

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = '{"code":0}'
    fake_resp.json.return_value = {
        "code": 0,
        "data": {"uname": "tester", "mid": 12345, "vipStatus": 1},
    }

    fake_client = MagicMock()
    fake_client.get = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=fake_client):
        ok, msg = await a.verify_credentials({"sessdata": "valid"})

    assert ok is True
    assert "tester" in msg
    assert "12345" in msg


# =============================================================================
# publish 输入校验
# =============================================================================


async def test_publish_non_video_format():
    """非 video 格式 → 失败。"""
    a = BilibiliAdapter()
    content = PublishContent(format="md", title="t", text="hello")
    result = await a.publish(content, {}, {})
    assert result.success is False
    assert "video" in result.error_message


async def test_publish_missing_file_path():
    """缺 file_path → 失败。"""
    a = BilibiliAdapter()
    content = PublishContent(format="video", title="t")
    result = await a.publish(content, {}, {})
    assert result.success is False
    assert "file_path" in result.error_message


async def test_publish_file_not_found(tmp_path):
    """文件不存在 → 失败。"""
    a = BilibiliAdapter()
    content = PublishContent(format="video", title="t", file_path=str(tmp_path / "nonexistent.mp4"))
    result = await a.publish(content, {}, {})
    assert result.success is False
    assert "not found" in result.error_message


async def test_publish_empty_file(tmp_path):
    """空文件 → 失败。"""
    a = BilibiliAdapter()
    empty = tmp_path / "empty.mp4"
    empty.write_bytes(b"")
    content = PublishContent(format="video", title="t", file_path=str(empty))
    result = await a.publish(content, {}, {})
    assert result.success is False
    assert "empty" in result.error_message


# =============================================================================
# publish 流程 - preupload 失败路径
# =============================================================================


async def test_publish_preupload_http_error(tmp_path):
    """preupload 阶段 HTTP 异常 → 失败。"""
    a = BilibiliAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00\x00\x00")  # 4 bytes

    fake_client = MagicMock()
    fake_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=fake_client):
        result = await a.publish(
            PublishContent(format="video", title="t", file_path=str(video)),
            {"sessdata": "s", "bili_jct": "j", "dedeuserid": "u"},
            {},
        )

    assert result.success is False
    assert "preupload failed" in result.error_message


async def test_publish_preupload_non_200(tmp_path):
    """preupload 非 200 → 失败。"""
    a = BilibiliAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_resp = MagicMock()
    fake_resp.status_code = 500
    fake_resp.text = "error"

    fake_client = MagicMock()
    fake_client.post = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=fake_client):
        result = await a.publish(
            PublishContent(format="video", title="t", file_path=str(video)),
            {"sessdata": "s", "bili_jct": "j", "dedeuserid": "u"},
            {},
        )

    assert result.success is False
    assert "preupload 500" in result.error_message


async def test_publish_preupload_invalid_json(tmp_path):
    """preupload 坏 JSON → 失败。"""
    a = BilibiliAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = "not json"
    fake_resp.json.side_effect = ValueError("bad json")

    fake_client = MagicMock()
    fake_client.post = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=fake_client):
        result = await a.publish(
            PublishContent(format="video", title="t", file_path=str(video)),
            {"sessdata": "s", "bili_jct": "j", "dedeuserid": "u"},
            {},
        )

    assert result.success is False
    assert "invalid json" in result.error_message


async def test_publish_preupload_missing_upos_uri(tmp_path):
    """preupload 返回缺 upos_uri → 失败。"""
    a = BilibiliAdapter()
    video = tmp_path / "v.mp4"
    video.write_bytes(b"\x00\x00")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.text = "{}"
    fake_resp.json.return_value = {"biz_id": "b1"}  # 缺 upos_uri

    fake_client = MagicMock()
    fake_client.post = AsyncMock(return_value=fake_resp)
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=fake_client):
        result = await a.publish(
            PublishContent(format="video", title="t", file_path=str(video)),
            {"sessdata": "s", "bili_jct": "j", "dedeuserid": "u"},
            {},
        )

    assert result.success is False
    assert "upos_uri" in result.error_message

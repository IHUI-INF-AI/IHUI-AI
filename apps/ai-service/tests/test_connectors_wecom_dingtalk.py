# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""企业微信 / 钉钉 Connector 测试(2026-09-02 立,2026-09-20 企微接入微盘,钉钉接入钉盘)。

覆盖(企业微信):
- 缺凭据(corpid/corpsecret)→ sync/fetch_document 降级失败
- 缺 extra.space_id → sync 降级失败(提示 space_id)
- mock token + file_list 成功 → items(doc_id/title)与 last_sync_at 正确
- file_list errcode != 0 → 降级
- fetch:file_download 成功 + utf-8 文本下载 / 二进制降级 / API 错误降级 / 超长截断
覆盖(钉钉,2026-09-20 接入钉盘 Drive):
- 缺凭据 / 缺 extra.space_id → sync/fetch_document 降级失败(提示 space_id)
- mock token + file/list 成功 → items(doc_id/title)与 last_sync_at 正确
- next_token 翻页聚合 / file_list errcode != 0 → 降级
- fetch:download 成功 + utf-8 文本 / 二进制降级 / API 错误降级 / 超长截断
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from app.services.connectors import dingtalk as dingtalk_mod
from app.services.connectors import wecom as wecom_mod

WECOM_RECORD: dict = {
    "key": "wecom-1",
    "type": "wecom",
    "name": "企业微信",
    "app_id": "corp-test",
    "app_secret": "secret-test",
    "extra": {"space_id": 100001},
    "enabled": True,
}

DINGTALK_RECORD: dict = {
    "key": "dingtalk-1",
    "type": "dingtalk",
    "name": "钉钉",
    "app_id": "appkey-test",
    "app_secret": "secret-test",
    "extra": {},
    "enabled": True,
}


# ---------------------------------------------------------------------------
# 企业微信
# ---------------------------------------------------------------------------


async def test_wecom_connector_type() -> None:
    """CONNECTOR_TYPE 标识正确。"""
    assert wecom_mod.CONNECTOR_TYPE == "wecom"


async def test_wecom_sync_missing_credentials() -> None:
    """缺 corpid/corpsecret → ok=False 提示未配置。"""
    result = await wecom_mod.sync({**WECOM_RECORD, "app_id": ""})
    assert result["ok"] is False
    assert "未配置" in result["message"]
    assert result["items"] == []


async def test_wecom_fetch_document_missing_credentials() -> None:
    """缺凭据 → fetch_document 提示未配置。"""
    result = await wecom_mod.fetch_document(
        {**WECOM_RECORD, "app_secret": ""}, "doc-1"
    )
    assert result["ok"] is False
    assert "未配置" in result["message"]


# ---------------------------------------------------------------------------
# 企业微信:mock 辅助(对齐 test_connectors_feishu.py 风格)
# ---------------------------------------------------------------------------


def _fake_client(
    *post_responses: MagicMock, get_response: MagicMock | None = None
) -> MagicMock:
    """构造 httpx.AsyncClient mock:async context manager + 顺序返回响应。"""
    client = MagicMock()
    client.post = AsyncMock(side_effect=list(post_responses))
    client.get = AsyncMock(return_value=get_response)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    return client


async def _fake_token(self) -> str:
    """假的 access_token(绕过 token 网络请求)。"""
    return "fake-wecom-token"


def _json_resp(payload: dict) -> MagicMock:
    """构造带 JSON body 的 httpx 响应 mock。"""
    resp = MagicMock()
    resp.json.return_value = payload
    return resp


def _download_resp(content: bytes) -> MagicMock:
    """构造文件字节下载响应 mock。"""
    resp = MagicMock()
    resp.content = content
    return resp


async def test_wecom_sync_missing_space_id() -> None:
    """缺 extra.space_id → ok=False 且 message 提示 space_id。"""
    result = await wecom_mod.sync({**WECOM_RECORD, "extra": {}})
    assert result["ok"] is False
    assert "space_id" in result["message"]
    assert result["items"] == []
    assert result["last_sync_at"] == ""


async def test_wecom_sync_parses_file_list() -> None:
    """假 token + file_list 成功 → items 正确且 last_sync_at 非空。"""
    resp = _json_resp(
        {
            "errcode": 0,
            "errmsg": "ok",
            "file_list": [
                {"file_info": {"fileid": 301, "file_name": "产品需求.md"}},
                {"file_info": {"fileid": 302, "file_name": "会议纪要.txt"}},
                {"file_info": {"file_name": "缺 fileid"}},
                "bad-entry",
            ],
        }
    )
    client = _fake_client(resp)
    with (
        patch.object(wecom_mod.WecomConnector, "get_access_token", _fake_token),
        patch(
            "app.services.connectors.wecom.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await wecom_mod.sync(WECOM_RECORD)

    assert result["ok"] is True
    assert result["items"] == [
        {"doc_id": "301", "title": "产品需求.md"},
        {"doc_id": "302", "title": "会议纪要.txt"},
    ]
    assert result["last_sync_at"]


async def test_wecom_sync_paginates() -> None:
    """next_start 翻页 → 合并两页结果且请求体 start 递进。"""
    resp1 = _json_resp(
        {
            "errcode": 0,
            "file_list": [{"file_info": {"fileid": 1, "file_name": "a.md"}}],
            "next_start": 100,
        }
    )
    resp2 = _json_resp(
        {"errcode": 0, "file_list": [{"file_info": {"fileid": 2, "file_name": "b.md"}}]}
    )
    client = _fake_client(resp1, resp2)
    with (
        patch.object(wecom_mod.WecomConnector, "get_access_token", _fake_token),
        patch(
            "app.services.connectors.wecom.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await wecom_mod.sync(WECOM_RECORD)

    assert result["ok"] is True
    assert [item["doc_id"] for item in result["items"]] == ["1", "2"]
    assert client.post.await_count == 2
    first_body = client.post.await_args_list[0].kwargs["json"]
    second_body = client.post.await_args_list[1].kwargs["json"]
    assert first_body["start"] == 0
    assert second_body["start"] == 100
    assert first_body["space_id"] == 100001
    assert first_body["limit"] == 100


async def test_wecom_sync_api_error() -> None:
    """file_list errcode != 0 → ok=False 带错误信息。"""
    resp = _json_resp({"errcode": 301005, "errmsg": "no permission"})
    client = _fake_client(resp)
    with (
        patch.object(wecom_mod.WecomConnector, "get_access_token", _fake_token),
        patch(
            "app.services.connectors.wecom.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await wecom_mod.sync(WECOM_RECORD)

    assert result["ok"] is False
    assert "301005" in result["message"]
    assert result["items"] == []


async def test_wecom_fetch_document_parses_text() -> None:
    """file_download 成功 + utf-8 文本 → content/chars 正确且下载带 cookie。"""
    dl = _json_resp(
        {
            "errcode": 0,
            "download_url": "https://download.example/1.txt",
            "cookie_name": "wedrive_cookie",
            "cookie_value": "ticket-abc",
        }
    )
    client = _fake_client(
        dl, get_response=_download_resp("第一行\n第二行".encode())
    )
    with (
        patch.object(wecom_mod.WecomConnector, "get_access_token", _fake_token),
        patch(
            "app.services.connectors.wecom.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await wecom_mod.fetch_document(WECOM_RECORD, "301")

    assert result["ok"] is True
    assert result["title"] == "301"
    assert result["content"] == "第一行\n第二行"
    assert result["chars"] == len(result["content"])
    assert result["truncated"] is False
    assert client.get.await_args.kwargs["cookies"] == {
        "wedrive_cookie": "ticket-abc"
    }


async def test_wecom_fetch_document_binary_fails() -> None:
    """下载二进制(utf-8 解码失败)→ 降级失败。"""
    dl = _json_resp(
        {
            "errcode": 0,
            "download_url": "https://download.example/2.png",
            "cookie_name": "wedrive_cookie",
            "cookie_value": "ticket-abc",
        }
    )
    client = _fake_client(dl, get_response=_download_resp(b"\xff\xfe\x00\x01binary"))
    with (
        patch.object(wecom_mod.WecomConnector, "get_access_token", _fake_token),
        patch(
            "app.services.connectors.wecom.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await wecom_mod.fetch_document(WECOM_RECORD, "302")

    assert result["ok"] is False
    assert "非文本" in result["message"]
    assert result["content"] == ""


async def test_wecom_fetch_document_api_error() -> None:
    """file_download errcode != 0 → ok=False 带错误信息。"""
    resp = _json_resp({"errcode": 301002, "errmsg": "file not found"})
    client = _fake_client(resp)
    with (
        patch.object(wecom_mod.WecomConnector, "get_access_token", _fake_token),
        patch(
            "app.services.connectors.wecom.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await wecom_mod.fetch_document(WECOM_RECORD, "404")

    assert result["ok"] is False
    assert "301002" in result["message"]


async def test_wecom_fetch_document_truncates() -> None:
    """内容超过 MAX_DOC_CHARS → truncated=True 且截断到上限。"""
    long_text = "长" * (wecom_mod.MAX_DOC_CHARS + 100)
    dl = _json_resp({"errcode": 0, "download_url": "https://download.example/3.md"})
    client = _fake_client(dl, get_response=_download_resp(long_text.encode("utf-8")))
    with (
        patch.object(wecom_mod.WecomConnector, "get_access_token", _fake_token),
        patch(
            "app.services.connectors.wecom.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await wecom_mod.fetch_document(WECOM_RECORD, "303")

    assert result["ok"] is True
    assert result["truncated"] is True
    assert result["chars"] == wecom_mod.MAX_DOC_CHARS
    assert len(result["content"]) == wecom_mod.MAX_DOC_CHARS


# ---------------------------------------------------------------------------
# 钉钉:mock 辅助(复用上方 _fake_client/_json_resp/_download_resp)
# ---------------------------------------------------------------------------


async def _fake_dingtalk_token(self) -> str:
    """假的 access_token(绕过 token 网络请求)。"""
    return "fake-dingtalk-token"


# ---------------------------------------------------------------------------
# 钉钉
# ---------------------------------------------------------------------------


async def test_dingtalk_connector_type() -> None:
    """CONNECTOR_TYPE 标识正确。"""
    assert dingtalk_mod.CONNECTOR_TYPE == "dingtalk"


async def test_dingtalk_sync_missing_credentials() -> None:
    """缺 appkey/appsecret → ok=False 提示未配置。"""
    result = await dingtalk_mod.sync({**DINGTALK_RECORD, "app_id": ""})
    assert result["ok"] is False
    assert "未配置" in result["message"]
    assert result["items"] == []


async def test_dingtalk_fetch_document_missing_credentials() -> None:
    """缺凭据 → fetch_document 提示未配置。"""
    result = await dingtalk_mod.fetch_document(
        {**DINGTALK_RECORD, "app_secret": ""}, "doc-1"
    )
    assert result["ok"] is False
    assert "未配置" in result["message"]


async def test_dingtalk_sync_missing_space_id() -> None:
    """缺 extra.space_id → ok=False 且 message 提示 space_id。"""
    result = await dingtalk_mod.sync(DINGTALK_RECORD)
    assert result["ok"] is False
    assert "space_id" in result["message"]
    assert result["items"] == []
    assert result["last_sync_at"] == ""


async def test_dingtalk_sync_parses_file_list() -> None:
    """假 token + file/list 成功 → items 正确且 last_sync_at 非空。"""
    resp = _json_resp(
        {
            "errcode": 0,
            "errmsg": "ok",
            "result": {
                "files": [
                    {"file_id": 901, "file_name": "产品需求.md"},
                    {"file_id": 902, "file_name": "会议纪要.txt"},
                    {"file_name": "缺 file_id"},
                    "bad-entry",
                ]
            },
        }
    )
    client = _fake_client(resp)
    with (
        patch.object(
            dingtalk_mod.DingtalkConnector, "get_access_token", _fake_dingtalk_token
        ),
        patch(
            "app.services.connectors.dingtalk.httpx.AsyncClient",
            return_value=client,
        ),
    ):
        record = {**DINGTALK_RECORD, "extra": {"space_id": 200001}}
        result = await dingtalk_mod.sync(record)

    assert result["ok"] is True
    assert result["items"] == [
        {"doc_id": "901", "title": "产品需求.md"},
        {"doc_id": "902", "title": "会议纪要.txt"},
    ]
    assert result["last_sync_at"]


async def test_dingtalk_sync_paginates() -> None:
    """next_token 翻页 → 合并两页结果且请求体 next_token 递进。"""
    resp1 = _json_resp(
        {
            "errcode": 0,
            "result": {
                "files": [{"file_id": 1, "file_name": "a.md"}],
                "next_token": "cursor-1",
            },
        }
    )
    resp2 = _json_resp(
        {
            "errcode": 0,
            "result": {"files": [{"file_id": 2, "file_name": "b.md"}]},
        }
    )
    client = _fake_client(resp1, resp2)
    with (
        patch.object(
            dingtalk_mod.DingtalkConnector, "get_access_token", _fake_dingtalk_token
        ),
        patch(
            "app.services.connectors.dingtalk.httpx.AsyncClient",
            return_value=client,
        ),
    ):
        record = {**DINGTALK_RECORD, "extra": {"space_id": 200001, "folder_id": 5}}
        result = await dingtalk_mod.sync(record)

    assert result["ok"] is True
    assert [item["doc_id"] for item in result["items"]] == ["1", "2"]
    assert client.post.await_count == 2
    first_body = client.post.await_args_list[0].kwargs["json"]
    second_body = client.post.await_args_list[1].kwargs["json"]
    assert first_body["space_id"] == 200001
    assert first_body["folder_id"] == 5
    assert first_body["limit"] == 100
    assert first_body["next_token"] == ""
    assert second_body["next_token"] == "cursor-1"


async def test_dingtalk_sync_api_error() -> None:
    """file/list errcode != 0 → ok=False 带错误信息。"""
    resp = _json_resp({"errcode": 90004, "errmsg": "no permission"})
    client = _fake_client(resp)
    with (
        patch.object(
            dingtalk_mod.DingtalkConnector, "get_access_token", _fake_dingtalk_token
        ),
        patch(
            "app.services.connectors.dingtalk.httpx.AsyncClient",
            return_value=client,
        ),
    ):
        record = {**DINGTALK_RECORD, "extra": {"space_id": 200001}}
        result = await dingtalk_mod.sync(record)

    assert result["ok"] is False
    assert "no permission" in result["message"]
    assert result["items"] == []


async def test_dingtalk_fetch_document_missing_space_id() -> None:
    """缺 extra.space_id → fetch_document 降级并提示 space_id。"""
    result = await dingtalk_mod.fetch_document(DINGTALK_RECORD, "901")
    assert result["ok"] is False
    assert "space_id" in result["message"]


async def test_dingtalk_fetch_document_parses_text() -> None:
    """download 成功 + utf-8 文本 → content/chars/truncated 正确。"""
    dl = _json_resp(
        {"errcode": 0, "result": {"url": "https://download.example/1.txt"}}
    )
    client = _fake_client(dl, get_response=_download_resp("第一行\n第二行".encode()))
    with (
        patch.object(
            dingtalk_mod.DingtalkConnector, "get_access_token", _fake_dingtalk_token
        ),
        patch(
            "app.services.connectors.dingtalk.httpx.AsyncClient",
            return_value=client,
        ),
    ):
        record = {**DINGTALK_RECORD, "extra": {"space_id": 200001}}
        result = await dingtalk_mod.fetch_document(record, "901")

    assert result["ok"] is True
    assert result["title"] == "901"
    assert result["content"] == "第一行\n第二行"
    assert result["chars"] == len(result["content"])
    assert result["truncated"] is False
    # 下载请求体带 space_id / file_id
    body = client.post.await_args.kwargs["json"]
    assert body["space_id"] == 200001
    assert body["file_id"] == 901


async def test_dingtalk_fetch_document_binary_fails() -> None:
    """下载二进制(utf-8 解码失败)→ 降级失败。"""
    dl = _json_resp(
        {"errcode": 0, "result": {"url": "https://download.example/2.png"}}
    )
    client = _fake_client(dl, get_response=_download_resp(b"\xff\xfe\x00\x01binary"))
    with (
        patch.object(
            dingtalk_mod.DingtalkConnector, "get_access_token", _fake_dingtalk_token
        ),
        patch(
            "app.services.connectors.dingtalk.httpx.AsyncClient",
            return_value=client,
        ),
    ):
        record = {**DINGTALK_RECORD, "extra": {"space_id": 200001}}
        result = await dingtalk_mod.fetch_document(record, "902")

    assert result["ok"] is False
    assert "非文本" in result["message"]
    assert result["content"] == ""


async def test_dingtalk_fetch_document_api_error() -> None:
    """download errcode != 0 → ok=False 带错误信息。"""
    resp = _json_resp({"errcode": 90004, "errmsg": "file not found"})
    client = _fake_client(resp)
    with (
        patch.object(
            dingtalk_mod.DingtalkConnector, "get_access_token", _fake_dingtalk_token
        ),
        patch(
            "app.services.connectors.dingtalk.httpx.AsyncClient",
            return_value=client,
        ),
    ):
        record = {**DINGTALK_RECORD, "extra": {"space_id": 200001}}
        result = await dingtalk_mod.fetch_document(record, "404")

    assert result["ok"] is False
    assert "file not found" in result["message"]


async def test_dingtalk_fetch_document_truncates() -> None:
    """内容超过 MAX_DOC_CHARS → truncated=True 且截断到上限。"""
    long_text = "长" * (dingtalk_mod.MAX_DOC_CHARS + 100)
    dl = _json_resp(
        {"errcode": 0, "result": {"url": "https://download.example/3.md"}}
    )
    client = _fake_client(
        dl, get_response=_download_resp(long_text.encode("utf-8"))
    )
    with (
        patch.object(
            dingtalk_mod.DingtalkConnector, "get_access_token", _fake_dingtalk_token
        ),
        patch(
            "app.services.connectors.dingtalk.httpx.AsyncClient",
            return_value=client,
        ),
    ):
        record = {**DINGTALK_RECORD, "extra": {"space_id": 200001}}
        result = await dingtalk_mod.fetch_document(record, "903")

    assert result["ok"] is True
    assert result["truncated"] is True
    assert result["chars"] == dingtalk_mod.MAX_DOC_CHARS
    assert len(result["content"]) == dingtalk_mod.MAX_DOC_CHARS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

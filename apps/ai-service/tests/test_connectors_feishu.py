# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""飞书 Connector 单元测试(2026-09-02 立)。

覆盖:
- 缺 app_id/app_secret → 未配置降级(ok=False)
- 假 token + 假 httpx 响应 → sync 正确解析 data.files[] 结构
- fetch_document 遍历 blocks 拼纯文本 / API 错误 / 超长截断
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from app.services.connectors import feishu as feishu_mod
from app.services.im.feishu_lark import FeishuLarkAdapter

RECORD: dict = {
    "key": "feishu-1",
    "type": "feishu",
    "name": "团队知识库",
    "app_id": "cli_test_app",
    "app_secret": "secret_test",
    "extra": {},
    "enabled": True,
}


def _fake_client(*responses: MagicMock) -> MagicMock:
    """构造 httpx.AsyncClient mock:async context manager + 顺序返回响应。"""
    client = MagicMock()
    client.get = AsyncMock(side_effect=list(responses))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    return client


async def _fake_tenant_token(self) -> str:
    """假的 tenant_access_token(绕过 token 网络请求)。"""
    return "fake-tenant-token"


async def test_sync_missing_credentials() -> None:
    """缺 app_id/app_secret → ok=False 且提示未配置。"""
    result = await feishu_mod.sync({**RECORD, "app_id": "", "app_secret": ""})
    assert result["ok"] is False
    assert "未配置" in result["message"]
    assert result["items"] == []


async def test_fetch_document_missing_credentials() -> None:
    """缺 app_id/app_secret → fetch_document 提示未配置。"""
    result = await feishu_mod.fetch_document(
        {**RECORD, "app_secret": ""}, "doc-1"
    )
    assert result["ok"] is False
    assert "未配置" in result["message"]


async def test_sync_parses_files() -> None:
    """假 token + 假响应 → sync 正确解析 data.files[] 并过滤非 docx。"""
    resp = MagicMock()
    resp.json.return_value = {
        "code": 0,
        "data": {
            "files": [
                {"token": "doc-1", "name": "产品方案", "type": "docx"},
                {"token": "doc-2", "name": "会议纪要", "type": "docx"},
                {"token": "sheet-1", "name": "数据表", "type": "sheet"},
                {"token": "", "name": "无 token", "type": "docx"},
            ]
        },
    }
    client = _fake_client(resp)
    with (
        patch.object(FeishuLarkAdapter, "get_tenant_access_token", _fake_tenant_token),
        patch(
            "app.services.connectors.feishu.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await feishu_mod.sync(RECORD)

    assert result["ok"] is True
    assert len(result["items"]) == 2
    assert result["items"][0] == {"doc_id": "doc-1", "title": "产品方案"}
    assert result["items"][1] == {"doc_id": "doc-2", "title": "会议纪要"}
    assert result["last_sync_at"]


async def test_sync_api_error() -> None:
    """飞书 API 返回非零 code → ok=False 带错误信息。"""
    resp = MagicMock()
    resp.json.return_value = {"code": 99991, "msg": "no permission", "data": {}}
    client = _fake_client(resp)
    with (
        patch.object(FeishuLarkAdapter, "get_tenant_access_token", _fake_tenant_token),
        patch(
            "app.services.connectors.feishu.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await feishu_mod.sync(RECORD)

    assert result["ok"] is False
    assert "99991" in result["message"]


async def test_fetch_document_parses_blocks() -> None:
    """fetch_document 拉取元信息 + 遍历 blocks 拼纯文本。"""
    meta_resp = MagicMock()
    meta_resp.json.return_value = {
        "code": 0,
        "data": {"document": {"document_id": "d1", "title": "项目方案"}},
    }
    blocks_resp = MagicMock()
    blocks_resp.json.return_value = {
        "code": 0,
        "data": {
            "items": [
                {"type": 3, "text": {"element": [{"text_run": {"content": "第一章"}}]}},
                {
                    "type": 2,
                    "text": {
                        "element": [
                            {"text_run": {"content": "欢迎"}},
                            {"text_run": {"content": "来到"}},
                        ]
                    },
                },
                {"type": 14, "code": {"element": [{"text_run": {"content": "print(1)"}}]}},
                {"type": 12, "text": {"element": [{"text_run": {"content": "要点"}}]}},
            ],
            "page_token": None,
        },
    }
    client = _fake_client(meta_resp, blocks_resp)
    with (
        patch.object(FeishuLarkAdapter, "get_tenant_access_token", _fake_tenant_token),
        patch(
            "app.services.connectors.feishu.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await feishu_mod.fetch_document(RECORD, "doc-1")

    assert result["ok"] is True
    assert result["title"] == "项目方案"
    assert "第一章" in result["content"]
    assert "欢迎来到" in result["content"]
    assert "print(1)" in result["content"]
    assert "要点" in result["content"]
    assert result["chars"] == len(result["content"])
    assert result["truncated"] is False


async def test_fetch_document_api_error() -> None:
    """文档接口非零 code → ok=False 且 message 带 code。"""
    resp = MagicMock()
    resp.json.return_value = {"code": 99991, "msg": "document not found", "data": {}}
    client = _fake_client(resp)
    with (
        patch.object(FeishuLarkAdapter, "get_tenant_access_token", _fake_tenant_token),
        patch(
            "app.services.connectors.feishu.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await feishu_mod.fetch_document(RECORD, "missing-doc")

    assert result["ok"] is False
    assert "99991" in result["message"]


async def test_fetch_document_truncates() -> None:
    """内容超过 MAX_DOC_CHARS → truncated=True 且截断到上限。"""
    long_text = "长" * (feishu_mod.MAX_DOC_CHARS + 100)
    meta_resp = MagicMock()
    meta_resp.json.return_value = {
        "code": 0,
        "data": {"document": {"document_id": "d1", "title": "长文"}},
    }
    blocks_resp = MagicMock()
    blocks_resp.json.return_value = {
        "code": 0,
        "data": {
            "items": [
                {"type": 2, "text": {"element": [{"text_run": {"content": long_text}}]}},
            ],
            "page_token": None,
        },
    }
    client = _fake_client(meta_resp, blocks_resp)
    with (
        patch.object(FeishuLarkAdapter, "get_tenant_access_token", _fake_tenant_token),
        patch(
            "app.services.connectors.feishu.httpx.AsyncClient", return_value=client
        ),
    ):
        result = await feishu_mod.fetch_document(RECORD, "doc-1")

    assert result["ok"] is True
    assert result["truncated"] is True
    assert result["chars"] == feishu_mod.MAX_DOC_CHARS
    assert len(result["content"]) == feishu_mod.MAX_DOC_CHARS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

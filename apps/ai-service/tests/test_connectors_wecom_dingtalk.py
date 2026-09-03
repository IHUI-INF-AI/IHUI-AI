# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""企业微信 / 钉钉 Connector 框架测试(2026-09-02 立)。

覆盖:
- 缺凭据(corpid/corpsecret、appkey/appsecret)→ 返回"未配置"
- 已配置但未接入文档源 → sync/fetch_document 返回 ok=False 且 message 非空
- CONNECTOR_TYPE 标识正确(路由层分发依据)
"""

from __future__ import annotations

from app.services.connectors import dingtalk as dingtalk_mod
from app.services.connectors import wecom as wecom_mod

WECOM_RECORD: dict = {
    "key": "wecom-1",
    "type": "wecom",
    "name": "企业微信",
    "app_id": "corp-test",
    "app_secret": "secret-test",
    "extra": {},
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


async def test_wecom_sync_not_available() -> None:
    """已配置但文档源未接入 → ok=False 且 message 非空。"""
    result = await wecom_mod.sync(WECOM_RECORD)
    assert result["ok"] is False
    assert result["message"]
    assert "待接入" in result["message"]
    assert result["items"] == []


async def test_wecom_fetch_document_not_available() -> None:
    """已配置但文档读取未接入 → ok=False 且 message 非空。"""
    result = await wecom_mod.fetch_document(WECOM_RECORD, "doc-1")
    assert result["ok"] is False
    assert result["message"]
    assert "待接入" in result["message"]


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


async def test_dingtalk_sync_not_available() -> None:
    """已配置但文档源未接入 → ok=False 且 message 非空。"""
    result = await dingtalk_mod.sync(DINGTALK_RECORD)
    assert result["ok"] is False
    assert result["message"]
    assert "待接入" in result["message"]
    assert result["items"] == []


async def test_dingtalk_fetch_document_not_available() -> None:
    """已配置但文档读取未接入 → ok=False 且 message 非空。"""
    result = await dingtalk_mod.fetch_document(DINGTALK_RECORD, "doc-1")
    assert result["ok"] is False
    assert result["message"]
    assert "待接入" in result["message"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

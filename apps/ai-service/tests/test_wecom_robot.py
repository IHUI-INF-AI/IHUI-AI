# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""企微机器人连接器服务测试:授权落库/加密/脱敏/7天过期/tools白名单。"""

from __future__ import annotations

import time

import pytest

from app.services import connector_store
from app.services.connectors import wecom_robot as robot


@pytest.fixture(autouse=True)
def _fake_crypto_and_store(monkeypatch):
    """加密用可逆假实现(测形状),存储用 FakeSession(不连 PG)。"""
    import base64
    import json

    from tests._connector_fake import FakeSession

    fake = FakeSession()
    monkeypatch.setattr(connector_store, "_pg_session", lambda: fake)

    def enc(payload):
        return base64.b64encode(json.dumps(payload, ensure_ascii=False).encode()).decode()

    def dec(text):
        return json.loads(base64.b64decode(text).decode())

    from app.services.publish import credentials_crypto as cc

    monkeypatch.setattr(cc, "encrypt", enc)
    monkeypatch.setattr(cc, "decrypt", dec)
    robot.clear_cache()
    yield fake
    robot.clear_cache()


URL = "https://qyapi.weixin.qq.com/mcp/v2/bot/doc?apikey=secretkey123"


def test_save_and_status_roundtrip_no_apikey_leak():
    st = robot.save_endpoint("tenant-A", None, URL)
    assert st["authorized"] is True
    assert st["capability"] == "document"
    assert "secretkey123" not in str(st)

    # 原始行里是密文,不含明文 apikey
    rec = connector_store.get("tenant-A", robot.CONNECTOR_KEY)
    cipher = rec["extra"][robot.ENDPOINT_EXTRA_KEY]
    assert "secretkey123" not in cipher
    assert cipher.startswith(robot._cipher_prefix())


def test_status_unauthorized_when_none():
    st = robot.status("tenant-empty", None)
    assert st["authorized"] is False
    assert st["message"] == "未授权"


def test_expired_detection():
    payload = robot.EndpointPayload(
        {"url": URL, "capability": "document", "authorized_at": int(time.time()) - 8 * 86400}
    )
    assert robot.is_expired(payload) is True
    fresh = robot.EndpointPayload(
        {"url": URL, "capability": "document", "authorized_at": int(time.time())}
    )
    assert robot.is_expired(fresh) is False


@pytest.mark.asyncio
async def test_invoke_rejects_tool_not_in_allowlist(monkeypatch):
    """调用的工具必须在 tools/list 清单内,挡任意方法名注入。"""
    robot.save_endpoint("tenant-B", None, URL)

    async def fake_list_tools(scope, tenant_id):
        return [{"name": "doc_create", "inputSchema": {}}]

    monkeypatch.setattr(robot, "list_tools", fake_list_tools)
    with pytest.raises(robot.WecomRobotError, match="不在授权清单"):
        await robot.invoke("tenant-B", None, "dangerous_tool", {})

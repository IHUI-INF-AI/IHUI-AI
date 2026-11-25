# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""连接器只读工具安全守门测试(2026-11-25)。

钉死四条不变式:
1. 无服务端 principal ⇒ 一律拒绝(LLM 不能靠入参伪造身份)
2. 非只读操作(action)与未授权连接器的 operation ⇒ 拒绝执行
3. 只读操作在授权清单内 ⇒ 放行,且 confirm 恒 False(绝不触发写门)
4. 工具 schema 不含任何凭据字段;工具注册幂等且 _TOOLS/_TOOL_HANDLERS 双射
"""

from __future__ import annotations

import uuid

import pytest

from app.services.agent_security_prefs import (
    reset_security_principal,
    set_security_principal,
)
from app.services.connectors import connector_read_tools as crt
from app.services import mcp_server as _mcp_module

USER_A = str(uuid.uuid4())


@pytest.fixture()
def principal_a():
    token = set_security_principal(USER_A)
    try:
        yield
    finally:
        if token is not None:
            reset_security_principal(token)


def _fake_caps_payload():
    # 按 _asgi_call 契约:端点响应包在 data 里(真实 /api/connectors 返回 {connectors:...})
    return {
        "ok": True, "status": 200,
        "data": {"connectors": [
            {"key": "feishu-me", "enabled": True, "configured": True,
             "operations": [
                 {"id": "list_docs", "capability": "list", "name": "列文档"},
                 {"id": "send_msg", "capability": "action", "name": "发消息"},
             ]},
            {"key": "dingtalk-me", "enabled": True, "configured": True,
             "operations": [
                 {"id": "fetch_user", "capability": "fetch", "name": "查成员"},
             ]},
        ]},
    }


# --- 1. 身份门 ---
@pytest.mark.asyncio
async def test_capabilities_without_principal_denied(monkeypatch):
    # 确保无 principal
    tok = set_security_principal(None)
    try:
        monkeypatch.setattr(crt, "_asgi_call", _fail_if_called)
        out = await crt._capabilities_handler({})
        assert out["ok"] is False
        assert out["errorCode"] == "NO_PRINCIPAL"
    finally:
        if tok is not None:
            reset_security_principal(tok)


@pytest.mark.asyncio
async def test_call_read_without_principal_denied(monkeypatch):
    tok = set_security_principal(None)
    try:
        monkeypatch.setattr(crt, "_asgi_call", _fail_if_called)
        out = await crt._call_read_handler({"connector_key": "x", "operation_id": "y"})
        assert out["ok"] is False
        assert out["errorCode"] == "NO_PRINCIPAL"
    finally:
        if tok is not None:
            reset_security_principal(tok)


async def _fail_if_called(*args, **kwargs):
    raise AssertionError("无 principal 时不得触网调用")


# --- 2. 能力清单只含只读 ---
@pytest.mark.asyncio
async def test_capabilities_filters_action(monkeypatch, principal_a):
    async def fake(method, path, **kw):
        return _fake_caps_payload()

    monkeypatch.setattr(crt, "_asgi_call", fake)
    out = await crt._capabilities_handler({})
    assert out["ok"] is True
    caps = out["connectors"]
    assert {c["operation_id"] for c in caps} == {"list_docs", "fetch_user"}
    assert all(c["capability"] in crt._READ_CAPABILITIES for c in caps)


# --- 3. action / 未授权 operation 拒执 ---
@pytest.mark.asyncio
@pytest.mark.parametrize("key,op_id", [
    ("feishu-me", "send_msg"),      # action 类
    ("feishu-me", "unknown_op"),    # 不存在
    ("attacker", "list_docs"),      # 连接器不属当前用户
])
async def test_call_read_denies_non_readonly(monkeypatch, principal_a, key, op_id):
    async def fake(method, path, **kw):
        if method == "GET":
            return _fake_caps_payload()
        raise AssertionError("不应执行 invoke")

    monkeypatch.setattr(crt, "_asgi_call", fake)
    out = await crt._call_read_handler({"connector_key": key, "operation_id": op_id})
    assert out["ok"] is False
    assert out["errorCode"] == "READ_ONLY_DENIED"


# --- 4. 只读放行,confirm 恒 False ---
@pytest.mark.asyncio
async def test_call_read_allows_readonly_with_confirm_false(monkeypatch, principal_a):
    seen = {}

    async def fake(method, path, **kw):
        if method == "GET":
            return _fake_caps_payload()
        seen["method"] = method
        seen["path"] = path
        seen["body"] = kw.get("body")
        return {"ok": True, "status": 200, "data": {"items": []}}

    monkeypatch.setattr(crt, "_asgi_call", fake)
    out = await crt._call_read_handler({
        "connector_key": "feishu-me", "operation_id": "list_docs",
        "params": {"page": 1}, "confirm": True,  # LLM 自填 confirm 也必须被丢弃
    })
    assert out["ok"] is True
    assert "/api/connectors/feishu-me/invoke" in seen["path"]
    assert seen["body"]["confirm"] is False
    assert seen["body"]["params"] == {"page": 1}


@pytest.mark.asyncio
async def test_call_read_rejects_non_dict_params(monkeypatch, principal_a):
    async def fake(method, path, **kw):
        return _fake_caps_payload()

    monkeypatch.setattr(crt, "_asgi_call", fake)
    out = await crt._call_read_handler({
        "connector_key": "feishu-me", "operation_id": "list_docs",
        "params": "not-a-dict",
    })
    assert out["ok"] is False
    assert out["errorCode"] == "BAD_PARAMS"


# --- 5. schema 脱敏 + 注册双射 ---
def test_minted_token_audience_matches_jwt_auth():
    """audience 必须与 jwt_auth 验签一致,否则 ASGI 自调用全部鉴权失败。"""
    assert crt._JWT_AUDIENCE == "ihui-ai-users"


def test_tool_schemas_have_no_credentials():
    for tool in (crt._capabilities_tool(), crt._call_read_tool()):
        text = str(tool.input_schema).lower()
        for leak in ("token", "secret", "password", "user_id", "tenant_id", "scope"):
            assert leak not in text, f"{tool.name} schema 泄露字段 {leak}"


def test_setup_is_idempotent_and_keeps_bijection():
    crt.setup_connector_read_tools()
    n2 = crt.setup_connector_read_tools()
    assert n2 == 0  # 幂等:第二次同名注册被拒
    assert len(_mcp_module._TOOLS) == len(_mcp_module._TOOL_HANDLERS)
    names = {t.name for t in _mcp_module._TOOLS}
    assert crt.CAPABILITIES_TOOL in names
    assert crt.CALL_READ_TOOL in names

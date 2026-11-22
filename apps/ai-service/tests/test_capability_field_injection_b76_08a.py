# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b76-08a 票2:连接级能力位由宿主注入 —— engine.py 注入口行为钉子。

打在生产入口 `_bind_principal`(JSON-RPC 四入口 HTTP 单发/批量/SSE/WS 共用)上:
客户端自报 connectionId/clientMode/deliveryProfile/subscriberScope/workflowRunDeltas
五个连接级能力位必须在转发前被摘除;身份/角色注入(既有语义)不得被本改动破坏。
"""

from importlib import import_module

import pytest

engine = import_module("app.routers.engine")

CAP_FIELDS = (
    "connectionId",
    "clientMode",
    "deliveryProfile",
    "subscriberScope",
    "workflowRunDeltas",
)


def _msg(**params):
    return {"jsonrpc": "2.0", "id": 1, "method": "thread.turns.create", "params": params}


def test_client_supplied_capability_fields_are_stripped():
    raw = _msg(
        sessionId="s1",
        connectionId="forged-conn",
        clientMode="bypass-all",
        deliveryProfile="admin",
        subscriberScope="global",
        workflowRunDeltas=True,
        keepMe="x",
    )
    out = engine._bind_principal(raw, "u-123", 3)
    params = out["params"]
    for field in CAP_FIELDS:
        assert field not in params, f"客户端自报的连接级能力位 {field} 未被摘除"
    assert params["keepMe"] == "x"


def test_identity_and_role_binding_unchanged():
    out = engine._bind_principal(_msg(userId="spoofed"), "u-123", 3)
    assert out["params"]["userId"] == "u-123"  # O19:令牌主体覆盖自报
    assert out["params"]["roleId"] == 3  # V3 #47:角色一律宿主写

    # 未鉴权通道:userId 保留自述(历史语义),roleId 仍一律宿主覆盖(取不到验证角色才是 0)
    out2 = engine._bind_principal(_msg(userId="anon"), None, 7)
    assert out2["params"]["userId"] == "anon"
    assert out2["params"]["roleId"] == 7
    out3 = engine._bind_principal(_msg(userId="anon"), None, 0)
    assert out3["params"]["roleId"] == 0


def test_non_dict_params_and_non_dict_message_pass_through():
    assert engine._bind_principal("not-a-dict", "u", 0) == "not-a-dict"
    m = {"jsonrpc": "2.0", "id": 2, "method": "x"}  # 无 params
    assert engine._bind_principal(m, "u", 0) == m


def test_pop_before_write_order():
    """宿主真值写在摘除之后(先删后写):将来建了等值字段不会又被自报值顶回。"""
    import inspect

    src = inspect.getsource(engine._bind_principal)
    pop_at = src.index("params.pop(_cap_field, None)")
    role_at = src.index('params["roleId"] =')
    assert pop_at < role_at


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

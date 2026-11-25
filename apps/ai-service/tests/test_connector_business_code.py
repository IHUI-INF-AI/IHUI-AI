# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器执行层"HTTP 200 + 平台业务码"伪调用缺陷的反向用例(2026-11-25)。

缺陷:custom_http._execute 原来只在 status_code>=400 时判失败,HTTP 200 一律
ok=True。飞书/企微/钉钉的业务错误(code/errcode 非 0)多是 200 返回的,AI 拿到
ok=True 的错误 JSON 会误判调用成功。本文件钉住:业务码非 0 必须失败;成功码
0/"0"/无码字段/字符串型 message code 必须保持成功;未知平台跳过以免误伤。
"""
from __future__ import annotations

import json
from typing import Any

import pytest

from app.services.connectors import custom_http


# ---------------------------------------------------------------------------
# 纯函数 _platform_error
# ---------------------------------------------------------------------------


def test_platform_error_feishu_code_and_msg():
    assert custom_http._platform_error(
        {"code": 99991672, "msg": "no permission"}, "feishu"
    ) == (99991672, "no permission")


def test_platform_error_wecom_errcode_and_errmsg():
    assert custom_http._platform_error(
        {"errcode": 48001, "errmsg": "api unauthorized"}, "wecom"
    ) == (48001, "api unauthorized")


def test_platform_error_dingtalk_errcode_and_errmsg():
    assert custom_http._platform_error(
        {"errcode": 40001, "errmsg": "token expired"}, "dingtalk"
    ) == (40001, "token expired")


@pytest.mark.parametrize(
    "platform, body",
    [
        ("feishu", {"code": 0, "msg": "ok"}),
        ("feishu", {"code": "0", "msg": "ok"}),
        ("wecom", {"errcode": 0, "errmsg": "ok"}),
        ("wecom", {"errcode": "0", "errmsg": "ok"}),
        ("dingtalk", {"errcode": None, "errmsg": ""}),
        ("feishu", {"data": {"items": []}}),  # 纯数据响应,压根没有码字段
        ("feishu", {"code": "ok", "msg": "some message"}),  # 字符串非数字,不判失败
        ("feishu", {"code": True}),  # bool 是 int 子类,不当错误码
        ("wecom", {"errcode": False}),
        ("feishu", [{"code": 1}]),  # 非 dict
    ],
)
def test_platform_error_ignores_success_and_ambiguous_shapes(platform, body):
    assert custom_http._platform_error(body, platform) is None


def test_platform_error_falls_back_to_other_key_and_accepts_numeric_string():
    assert custom_http._platform_error({"errcode": 40001}, "feishu") == (40001, "")
    assert custom_http._platform_error({"code": "48001"}, "wecom") == (48001, "")


@pytest.mark.parametrize(
    "payload, expected_msg",
    [
        ({"code": 1, "message": "from message"}, "from message"),
        ({"code": 1, "msg": "from msg"}, "from msg"),
        ({"code": 1, "errmsg": "from errmsg"}, "from errmsg"),
    ],
)
def test_platform_error_picks_message_field(payload, expected_msg):
    assert custom_http._platform_error(payload, "feishu") == (1, expected_msg)


# ---------------------------------------------------------------------------
# 端到端 invoke(fake transport,不触网)
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _public_dns(monkeypatch):
    """测试环境不依赖真实 DNS:域名解析固定到公网 IP(SSRF 校验照常跑)。"""
    monkeypatch.setattr(
        custom_http.socket,
        "getaddrinfo",
        lambda host, port: [(2, 1, 6, "", ("93.184.216.34", 0))],
    )


class _FakeResponse:
    def __init__(self, payload: Any, status: int = 200) -> None:
        self._payload = payload
        self.status_code = status
        self.content = json.dumps(payload, ensure_ascii=False).encode()

    def json(self) -> Any:
        return self._payload


class _FakeClient:
    def __init__(self, response: _FakeResponse) -> None:
        self._response = response

    async def __aenter__(self) -> "_FakeClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    async def request(self, method: str, url: str, **kwargs: Any) -> _FakeResponse:
        return self._response


def _install_fake_response(monkeypatch, payload: Any, status: int = 200) -> None:
    monkeypatch.setattr(
        custom_http.httpx,
        "AsyncClient",
        lambda **_kw: _FakeClient(_FakeResponse(payload, status)),
    )


def _record(platform: str) -> dict[str, Any]:
    return {
        "key": f"{platform}:test",
        "type": platform,
        "name": "business-code-test",
        "spec": {"base_url": "https://api.example.com", "auth_kind": "none"},
        "operations": [
            {
                "id": "list_items",
                "capability": "list",
                "method": "GET",
                "path": "/items",
                "response_path": "data.items",
            }
        ],
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "platform, payload, code_text, msg_text",
    [
        (
            "feishu",
            {"code": 99991672, "msg": "no permission"},
            "99991672",
            "no permission",
        ),
        (
            "wecom",
            {"errcode": 48001, "errmsg": "api unauthorized"},
            "48001",
            "api unauthorized",
        ),
        (
            "dingtalk",
            {"errcode": 40001, "errmsg": "token expired"},
            "40001",
            "token expired",
        ),
    ],
)
async def test_invoke_http200_business_error_is_partial_failure(
    monkeypatch, platform, payload, code_text, msg_text
):
    """HTTP 200 + 业务错误码必须抛 _PartialFailure,不能返回 ok=True。"""
    _install_fake_response(monkeypatch, payload)
    with pytest.raises(custom_http._PartialFailure) as exc:
        await custom_http.invoke(_record(platform), "list_items", {})
    failure = exc.value
    assert failure.status == 200
    assert failure.capability == "list"
    assert failure.operation_id == "list_items"
    assert failure.data == payload
    assert code_text in str(failure)
    assert msg_text in str(failure)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "platform, payload",
    [
        ("feishu", {"code": 0, "data": {"items": [{"id": "1"}]}}),
        ("feishu", {"code": "0", "data": {"items": [{"id": "1"}]}}),
        ("wecom", {"errcode": 0, "data": {"items": [{"id": "1"}]}}),
        ("dingtalk", {"errcode": "0", "data": {"items": [{"id": "1"}]}}),
        ("feishu", {"data": {"items": [{"id": "1"}]}}),  # 无 code 字段的纯数据
        ("feishu", {"code": "ok", "data": {"items": [{"id": "1"}]}}),  # message 型 code
    ],
)
async def test_invoke_success_payloads_stay_ok(monkeypatch, platform, payload):
    """成功码 0/"0"、无码字段、字符串非数字 code 都不能被误判失败。"""
    _install_fake_response(monkeypatch, payload)
    result = await custom_http.invoke(_record(platform), "list_items", {})
    assert result["ok"] is True
    assert result["status"] == 200
    assert result["data"] == [{"id": "1"}]


@pytest.mark.asyncio
async def test_invoke_feishu_pagination_success_code_zero_stays_ok(monkeypatch):
    """飞书分页成功响应 code=0,必须保持 ok=True。"""
    payload = {"code": 0, "msg": "success", "data": {"items": [], "has_more": True}}
    _install_fake_response(monkeypatch, payload)
    result = await custom_http.invoke(_record("feishu"), "list_items", {})
    assert result["ok"] is True
    assert result["data"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize("platform", ["custom", "yuque", ""])
async def test_invoke_unknown_platform_skips_business_code_check(monkeypatch, platform):
    """自建/未知平台可能用 code=200/1 表示成功,跳过判定避免误伤。"""
    payload = {"code": 200, "data": {"items": []}}
    _install_fake_response(monkeypatch, payload)
    result = await custom_http.invoke(_record(platform), "list_items", {})
    assert result["ok"] is True


def test_mutation_lock_business_code_gate_present():
    """变异锁:执行层那句业务码判失败被抹掉即红(防注释写绿、代码没绿)。"""
    import inspect

    src = inspect.getsource(custom_http.CustomHttpConnector._execute)
    assert "_platform_error(payload, platform)" in src
    assert "平台返回错误码" in src

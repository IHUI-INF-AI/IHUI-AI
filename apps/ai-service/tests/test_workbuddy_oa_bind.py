# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import asyncio
from unittest.mock import patch

import httpx

from scripts import workbuddy_oa_bind as bind


def test_initiate_params_shape() -> None:
    p = bind.initiate_params()
    assert p == {
        "scene": "BIND_WECHAT",
        "action": "bind",
        "callback_uri": bind.DEFAULT_CALLBACK_URI,
        "extra_param": "",
    }


def test_callback_params_shape() -> None:
    assert bind.callback_params("CODE", "STATE") == {"code": "CODE", "state": "STATE"}


def _client_with(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_initiate_bind_extracts_redirect_url() -> None:
    captured: dict = {}

    def handler(req: httpx.Request) -> httpx.Response:
        captured["headers"] = dict(req.headers)
        captured["body"] = req.content
        return httpx.Response(200, json={"redirect_url": "https://weixin.qq.com/auth?x=1"})

    with patch.object(bind.httpx, "AsyncClient", return_value=_client_with(handler)):
        res = asyncio.run(bind.initiate_bind("COOKIE"))
    assert res["http"] == 200
    assert res["body"]["redirect_url"] == "https://weixin.qq.com/auth?x=1"
    # 鉴权必须是 Cookie 头, 而非 Bearer(copilot token 会被 401 G40102)
    assert captured["headers"]["cookie"] == "COOKIE"
    assert b"BIND_WECHAT" in captured["body"]


def test_callback_bind_posts_code_state() -> None:
    captured: dict = {}

    def handler(req: httpx.Request) -> httpx.Response:
        captured["headers"] = dict(req.headers)
        captured["body"] = req.content
        return httpx.Response(200, json={"errCode": "0"})

    with patch.object(bind.httpx, "AsyncClient", return_value=_client_with(handler)):
        res = asyncio.run(bind.callback_bind("COOKIE", "C", "S"))
    assert res["http"] == 200
    assert b'"code":"C"' in captured["body"]
    assert b'"state":"S"' in captured["body"]
    assert captured["headers"]["cookie"] == "COOKIE"

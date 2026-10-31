# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Gemini 原生调用的凭据只许走请求头,不许进 URL(2026-11-01)。

原先三处把**平台自己的** api key 拼成 ``...?key=<明文>``:
① httpx 在 DEBUG 档逐请求打印完整 URL;② 中间层(反代/云监控/中转)访问日志按 URL 记录;
③ 异常文本里的 request.url。Google 原生 REST 认 ``x-goog-api-key`` 头,且**本仓 Node 侧
调同一端点早已在用该头**(`apps/api/src/routes/ai-vendors/proxy-llm.ts` 直接 POST
``:generateContent`` 而 URL 不含 key)—— 所以查询串形态只剩泄露面,没有兼容性收益。

每个"没 key"的断言都配一条"头里必须有 key":只查前者会把"鉴权整个丢了"
(生产表现为全线 401)也判成绿。
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

import pytest

from app.providers.gemini_provider import GeminiProvider

_KEY = "AIzaDUMMY-PLATFORM-KEY-not-real"
_MODELS_PAYLOAD: dict[str, Any] = {
    "candidates": [{"content": {"parts": [{"text": "pong"}]}, "finishReason": "STOP"}],
    "usageMetadata": {"totalTokenCount": 3},
}


class _Resp:
    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload
        self.status_code = 200
        self.headers: dict[str, str] = {}
        self.text = "ok"

    def json(self) -> dict[str, Any]:
        return self._payload


class _StreamResp(_Resp):
    def __init__(self, lines: list[str]) -> None:
        self._lines = lines
        self.status_code = 200
        self.headers: dict[str, str] = {}
        self.text = "ok"

    async def aread(self) -> bytes:
        return b""

    async def aiter_lines(self) -> Any:
        for line in self._lines:
            yield line

    def __call__(self) -> _StreamResp:
        return self

    async def __aenter__(self) -> _StreamResp:
        return self

    async def __aexit__(self, *exc: object) -> bool:
        return False


class _Client:
    """假 httpx 客户端:把 request/stream 的入参原样交给断言。"""

    def __init__(self, payload: dict[str, Any], stream_lines: list[str] | None = None) -> None:
        self.payload = payload
        self.stream_lines = stream_lines or []
        self.calls: list[dict[str, Any]] = []

    async def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> _Resp:
        self.calls.append({"kind": "request", "method": method, "url": url, "headers": headers or {}})
        return _Resp(self.payload)

    def stream(self, method: str, url: str, **kwargs: Any) -> _StreamResp:
        self.calls.append({"kind": "stream", "method": method, "url": url, "headers": kwargs.get("headers") or {}})
        return _StreamResp(self.stream_lines)


def _install(monkeypatch: pytest.MonkeyPatch, client: _Client) -> None:
    import app.providers.base_provider as bp
    import app.providers.gemini_provider as gp

    # `_request` 住在基类里,它按**基类模块命名空间**解析 get_http_client。只桩子类的
    # 名字,`complete`/`list_models` 会悄悄打到真实厂商端点(本仓第一版就是这么写的,
    # 靠真网络返回 400 才暴露)。两个名字都桩上,并断言假客户端真被用到。
    monkeypatch.setattr(gp, "get_http_client", lambda: client)
    monkeypatch.setattr(bp, "get_http_client", lambda: client)


def _sse_lines() -> list[str]:
    return [
        'data: {"candidates":[{"content":{"parts":[{"text":"chunk"}]},"finishReason":"STOP"}],'
        '"usageMetadata":{"totalTokenCount":2}}',
    ]


async def test_complete_sends_key_in_header_not_in_url(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _Client(_MODELS_PAYLOAD)
    _install(monkeypatch, client)
    provider = GeminiProvider(_KEY)
    out = await provider.complete([{"role": "user", "content": "hi"}], "gemini/gemini-pro")
    assert out["content"] == "pong"
    call = client.calls[-1]
    assert "key=" not in call["url"], f"URL 仍带凭据:{call['url']}"
    assert call["headers"].get("x-goog-api-key") == _KEY, "鉴权必须仍在(否则整站 401)"


async def test_stream_sends_key_in_header_and_keeps_alt_sse(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _Client(_MODELS_PAYLOAD, _sse_lines())
    _install(monkeypatch, client)
    provider = GeminiProvider(_KEY)
    events = [e async for e in provider.astream([{"role": "user", "content": "hi"}], "gemini/gemini-pro")]
    assert [e["type"] for e in events][0] == "chunk"
    call = client.calls[-1]
    assert "key=" not in call["url"]
    assert "alt=sse" in call["url"], "脱 key 不能顺手把流式协议参数弄丢"
    assert call["headers"].get("x-goog-api-key") == _KEY


async def test_list_models_sends_key_in_header(monkeypatch: pytest.MonkeyPatch) -> None:
    client = _Client({"models": [{"name": "models/gemini-pro"}]})
    _install(monkeypatch, client)
    provider = GeminiProvider(_KEY)
    models = await provider.list_models()
    assert models == [{"name": "models/gemini-pro"}]
    call = client.calls[-1]
    assert "key=" not in call["url"]
    assert call["headers"].get("x-goog-api-key") == _KEY


async def test_custom_base_still_gets_the_header(monkeypatch: pytest.MonkeyPatch) -> None:
    """管理员把 api_base 指到自建域名时,鉴权同样只能走头(URL 形态没有第二套)。"""
    client = _Client(_MODELS_PAYLOAD)
    _install(monkeypatch, client)
    provider = GeminiProvider(_KEY, api_base="https://gemini.internal.example")
    await provider.complete([{"role": "user", "content": "hi"}], "gemini/gemini-pro")
    call = client.calls[-1]
    assert call["url"].startswith("https://gemini.internal.example/v1beta/models/")
    assert "key=" not in call["url"]
    assert call["headers"].get("x-goog-api-key") == _KEY


def _fstring_literals(path: Path) -> list[str]:
    """收集**f-string 里的字面片段**(不碰注释与 docstring)。

    负断言必须判在代码面上:本仓的解释文字里合法地出现 "?key=" 这类形态,
    拿整文件字符串比会把自己写的说明判成违规(也逼下一个人把说明改掉)。
    """
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    fragments: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.JoinedStr):
            for value in node.values:
                if isinstance(value, ast.Constant) and isinstance(value.value, str):
                    fragments.append(value.value)
    return fragments


def test_no_url_builder_injects_a_key_query_anywhere_in_the_two_sites() -> None:
    root = Path(__file__).resolve().parents[1]
    for rel in ("app/providers/gemini_provider.py", "app/services/model_sync.py"):
        bad = [frag for frag in _fstring_literals(root / rel) if "key=" in frag.lower()]
        assert not bad, f"{rel} 仍在拼查询串凭据:{bad}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

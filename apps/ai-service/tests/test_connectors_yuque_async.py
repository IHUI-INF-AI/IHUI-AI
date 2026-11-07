# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""语雀 connector 异步网络层回归钉子(BUG-0006 同报告 P1)。

修复前 ``_request`` 是同步 ``requests.get(timeout=20)``,却在 ``async def``
的 ``sync`` / ``fetch_document`` 里被直接调用;``fetch_document`` 连续两次
请求(首页 + 正文接口),最坏阻塞事件循环 40 秒。本用例锁住三件事:

1. ``_request`` 是协程函数,且模块不再持有同步 ``requests`` 客户端;
2. ``sync`` / ``fetch_document`` 走 ``httpx.AsyncClient`` 异步通道;
3. 网络等待期间事件循环仍能推进其它协程(不是"改成 async 签名"的假修复)。
"""

from __future__ import annotations

import asyncio
import inspect
import json
import urllib.parse
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.connectors import yuque as yuque_mod

_RECORD: dict[str, Any] = {
    "key": "yuque:docs",
    "type": "yuque",
    "name": "语雀文档库",
    "extra": {"user": "yuque", "repo": "developer"},
    "enabled": True,
}


def _appdata_html(book: dict[str, Any]) -> str:
    """构造语雀 SSR 首页:注入 window.appData 的 JSON。"""
    payload = urllib.parse.quote(json.dumps({"book": book}))
    return (
        "<html><script>"
        f'window.appData = JSON.parse(decodeURIComponent("{payload}"));'
        "</script></html>"
    )


def _fake_client(*responses: MagicMock) -> MagicMock:
    """构造 httpx.AsyncClient mock:async context manager + 顺序返回响应。"""
    client = MagicMock()
    client.get = AsyncMock(side_effect=list(responses))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    return client


def _ok_response(**kwargs: Any) -> MagicMock:
    resp = MagicMock()
    for name, value in kwargs.items():
        setattr(resp, name, value)
    return resp


def test_request_is_coroutine_and_no_sync_requests() -> None:
    """网络入口必须是协程,且不得再持有同步 requests 模块。"""
    assert inspect.iscoroutinefunction(yuque_mod._request)
    assert not hasattr(yuque_mod, "requests")


async def test_sync_uses_async_client_and_parses_toc() -> None:
    """sync 经 httpx.AsyncClient 拉首页并解析目录,保留 20s 超时。"""
    home = _ok_response(text=_appdata_html({
        "id": 1,
        "toc": [
            {"type": "TITLE", "title": "分组"},
            {"type": "DOC", "url": "api", "title": "接口文档"},
            {"type": "DOC", "url": "guide", "title": "使用指南"},
        ],
    }))
    client = _fake_client(home)
    factory = MagicMock(return_value=client)
    with patch.object(yuque_mod.httpx, "AsyncClient", factory):
        result = await yuque_mod.sync(_RECORD)

    factory.assert_called_once_with(timeout=20.0)
    client.get.assert_awaited_once()
    assert result["ok"] is True
    assert result["items"] == [
        {"doc_id": "api", "title": "接口文档"},
        {"doc_id": "guide", "title": "使用指南"},
    ]
    assert result["last_sync_at"]


async def test_fetch_document_awaits_twice_and_returns_text() -> None:
    """fetch_document 两次请求都经异步客户端,正文转纯文本成功。"""
    home = _ok_response(text=_appdata_html({"id": 7, "toc": []}))
    doc = _ok_response(json=MagicMock(return_value={
        "data": {
            "title": "接口文档",
            "content": "<!doctype lake><p>第一段</p><p>第二段</p>",
        }
    }))
    client = _fake_client(home, doc)
    with patch.object(yuque_mod.httpx, "AsyncClient", MagicMock(return_value=client)):
        result = await yuque_mod.fetch_document(_RECORD, "api")

    assert client.get.await_count == 2
    assert result["ok"] is True
    assert result["title"] == "接口文档"
    assert "第一段" in result["content"] and "第二段" in result["content"]


async def test_network_wait_does_not_block_event_loop() -> None:
    """网络等待期间事件循环可推进其它协程(阻塞式 requests 会饿死 ticker)。"""

    async def slow_get(*args: Any, **kwargs: Any) -> MagicMock:
        await asyncio.sleep(0.05)
        return _ok_response(text=_appdata_html({"id": 9, "toc": [
            {"type": "DOC", "url": "api", "title": "接口文档"},
        ]}))

    client = _fake_client()
    client.get = slow_get
    ticks = {"n": 0}

    async def ticker() -> None:
        for _ in range(10):
            ticks["n"] += 1
            await asyncio.sleep(0.01)

    with patch.object(yuque_mod.httpx, "AsyncClient", MagicMock(return_value=client)):
        result, _ = await asyncio.gather(yuque_mod.sync(_RECORD), ticker())

    assert result["ok"] is True
    # 0.05s 的网络等待里,ticker 至少推进了 3 次(同步阻塞时恒为 0)。
    assert ticks["n"] >= 3
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

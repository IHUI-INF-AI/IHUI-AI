# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""语雀 Connector 测试(2026-09-02 立,P2-2)。

覆盖:sync 返回结构 / fetch_document 返回结构 / 缺 extra 报错 / 网络异常降级。
真网测试打 @pytest.mark.network(仓库暂无该标记约定,仅此一例)。
"""

from __future__ import annotations

import json
import urllib.parse
from typing import Any

import pytest
import requests

import app.services.connectors.yuque as yuque


def _fake_home_html(book_id: int = 75338) -> str:
    """构造语雀首页 SSR HTML:注入 window.appData(toc 含 DOC/TITLE 条目)。"""
    payload = {
        "book": {
            "id": book_id,
            "toc": [
                {"type": "TITLE", "title": "分组", "url": "", "doc_id": ""},
                {"type": "DOC", "title": "Overview", "url": "api", "doc_id": 575699},
                {"type": "DOC", "title": "开始使用", "url": "start"},
            ],
        }
    }
    enc = urllib.parse.quote(json.dumps(payload, ensure_ascii=False))
    return f'<script>window.appData = JSON.parse(decodeURIComponent("{enc}"));</script>'


class _FakeResp:
    """模拟 requests.Response:暴露 text/json()/raise_for_status()。"""

    def __init__(self, text: str = "", json_data: dict[str, Any] | None = None, status: int = 200):
        self.text = text
        self._json_data = json_data or {}
        self._status = status

    def json(self) -> dict[str, Any]:
        return self._json_data

    def raise_for_status(self) -> None:
        if self._status >= 400:
            raise requests.HTTPError(f"{self._status} Error")


def _record(**overrides: Any) -> dict:
    rec: dict[str, Any] = {
        "key": "yuque:docs",
        "type": "yuque",
        "name": "语雀文档库",
        "extra": {"user": "yuque", "repo": "developer"},
    }
    rec.update(overrides)
    return rec


async def test_sync_returns_expected_structure(monkeypatch):
    monkeypatch.setattr(yuque, "_request", lambda url, params=None, timeout=20: _FakeResp(text=_fake_home_html()))
    res = await yuque.sync(_record())
    assert res["ok"] is True
    assert res["last_sync_at"]  # 成功时带时间戳
    items = res["items"]
    assert len(items) == 2  # TITLE 被过滤
    assert items[0] == {"doc_id": "api", "title": "Overview"}
    assert items[1]["doc_id"] == "start"


async def test_fetch_document_returns_expected_structure(monkeypatch):
    content = "<!doctype lake><p>第一段</p><p>第二段</p>"
    fake_responses = [
        _FakeResp(text=_fake_home_html()),
        _FakeResp(json_data={"data": {"title": "Overview", "content": content}}),
    ]
    monkeypatch.setattr(yuque, "_request", lambda url, params=None, timeout=20: fake_responses.pop(0))
    res = await yuque.fetch_document(_record(), "api")
    assert res["ok"] is True
    assert res["title"] == "Overview"
    assert res["chars"] > 0
    assert "第一段" in res["content"]
    assert res["truncated"] is False
    assert "第二段" in res["content"]


async def test_fetch_document_truncates_long_content(monkeypatch):
    content = "<p>" + "字" * (yuque.MAX_DOC_CHARS + 500) + "</p>"
    fake_responses = [
        _FakeResp(text=_fake_home_html()),
        _FakeResp(json_data={"data": {"title": "长文", "content": content}}),
    ]
    monkeypatch.setattr(yuque, "_request", lambda url, params=None, timeout=20: fake_responses.pop(0))
    res = await yuque.fetch_document(_record(), "long")
    assert res["ok"] is True
    assert res["truncated"] is True
    assert res["chars"] <= yuque.MAX_DOC_CHARS


async def test_sync_missing_extra_returns_ok_false():
    res = await yuque.sync(_record(extra={}))
    assert res["ok"] is False
    assert res["items"] == []
    assert res["last_sync_at"] == ""
    assert "extra" in res["message"]


async def test_fetch_missing_extra_returns_ok_false():
    res = await yuque.fetch_document(_record(extra={}), "api")
    assert res["ok"] is False
    assert res["content"] == ""
    assert res["chars"] == 0


async def test_sync_network_error_degrades(monkeypatch):
    def _boom(url, params=None, timeout=20):
        raise requests.ConnectionError("mock 网络不可达")

    monkeypatch.setattr(yuque, "_request", _boom)
    res = await yuque.sync(_record())
    assert res["ok"] is False
    assert res["items"] == []
    assert res["last_sync_at"] == ""
    assert "mock 网络不可达" in res["message"]


async def test_fetch_network_error_degrades(monkeypatch):
    def _boom(url, params=None, timeout=20):
        raise requests.Timeout("mock 超时")

    monkeypatch.setattr(yuque, "_request", _boom)
    res = await yuque.fetch_document(_record(), "api")
    assert res["ok"] is False
    assert res["content"] == ""
    assert "mock 超时" in res["message"]


async def test_fetch_empty_doc_content_returns_ok_false(monkeypatch):
    fake_responses = [
        _FakeResp(text=_fake_home_html()),
        _FakeResp(json_data={"data": {"title": "空", "content": ""}}),
    ]
    monkeypatch.setattr(yuque, "_request", lambda url, params=None, timeout=20: fake_responses.pop(0))
    res = await yuque.fetch_document(_record(), "empty")
    assert res["ok"] is False
    assert res["title"] == "空"


@pytest.mark.network
async def test_yuque_public_book_real_sync_and_fetch():
    """真网:语雀公开知识库 yuque/developer 免 token 同步 + 拉正文(chars > 0)。"""
    record = _record(extra={"user": "yuque", "repo": "developer"})
    res = await yuque.sync(record)
    assert res["ok"] is True, res["message"]
    assert len(res["items"]) > 0
    doc = await yuque.fetch_document(record, res["items"][0]["doc_id"])
    assert doc["ok"] is True, doc["message"]
    assert doc["chars"] > 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

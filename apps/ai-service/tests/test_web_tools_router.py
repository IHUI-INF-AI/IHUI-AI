# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""网页工具 HTTP 薄接口(POST /api/web-tools/call)单元测试。

离线跑:工具函数用 monkeypatch 替身,不发真实网络请求。
覆盖:白名单校验 / extract_web 缺 fields / 形参收敛透传 / crawl_site 拒绝 / 成功链路。
"""

import os
import sys

_PKG = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _PKG not in sys.path:
    sys.path.insert(0, _PKG)

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.routers import web_tools as wt  # noqa: E402
from app.tools import web_crawl_tools as wc  # noqa: E402


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(wt.router, prefix="/api")
    return TestClient(app, raise_server_exceptions=False)


def test_unknown_tool_rejected():
    with _client() as c:
        r = c.post("/api/web-tools/call", json={"tool": "crawl_site", "url": "https://a.com/"})
        assert r.status_code == 400
        assert "crawl_site" in r.json()["detail"]


def test_extract_web_requires_fields():
    with _client() as c:
        r = c.post("/api/web-tools/call", json={"tool": "extract_web", "url": "https://a.com/"})
        assert r.status_code == 400
        assert "fields" in r.json()["detail"]


def test_fetch_readable_arg_passthrough_and_result_envelope(monkeypatch):
    captured: dict = {}

    async def fake_fetch_readable(args):  # noqa: ANN001
        captured.update(args)
        return {"tool": "fetch_readable", "ok": True, "url": args["url"], "content": "hi", "chars": 2}

    monkeypatch.setattr(wc, "fetch_readable", fake_fetch_readable)
    with _client() as c:
        r = c.post(
            "/api/web-tools/call",
            json={"tool": "fetch_readable", "url": "https://a.com/", "max_chars": 2000,
                  "include_links": True, "max_links": 5, "same_domain_only": False},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True and body["tool"] == "fetch_readable"
        assert body["result"]["content"] == "hi"
        # 形参收敛:仅白名单内形参透传
        assert captured == {"url": "https://a.com/", "max_chars": 2000, "include_links": True}


def test_map_site_args(monkeypatch):
    captured: dict = {}

    async def fake_map_site(args):  # noqa: ANN001
        captured.update(args)
        return {"tool": "map_site", "ok": True, "links": [], "link_count": 0}

    monkeypatch.setattr(wc, "map_site", fake_map_site)
    with _client() as c:
        r = c.post(
            "/api/web-tools/call",
            json={"tool": "map_site", "url": "https://a.com/", "max_links": 50, "same_domain_only": False,
                  "include_links": True},
        )
        assert r.status_code == 200
        # map_site 不接受 include_links(max_chars 允许但未传);只透传收敛后的形参
        assert captured == {"url": "https://a.com/", "max_links": 50, "same_domain_only": False}


def test_extract_web_fields_dict_passthrough(monkeypatch):
    captured: dict = {}

    async def fake_extract_web(args):  # noqa: ANN001
        captured.update(args)
        return {"tool": "extract_web", "ok": True, "source": "llm", "fields": {"价格": "9.9"},
                "confidence": {"价格": 0.95}, "llm_usage": {"total_tokens": 42}, "llm_model": "m1"}

    monkeypatch.setattr(wc, "extract_web", fake_extract_web)
    with _client() as c:
        r = c.post(
            "/api/web-tools/call",
            json={"tool": "extract_web", "url": "https://a.com/", "fields": {"价格": "number"}, "max_chars": 3000},
        )
        assert r.status_code == 200
        assert captured == {"url": "https://a.com/", "max_chars": 3000, "fields": {"价格": "number"}}
        assert r.json()["result"]["llm_usage"]["total_tokens"] == 42


def test_tool_exception_maps_to_500(monkeypatch):
    async def boom(args):  # noqa: ANN001
        raise RuntimeError("net down")

    monkeypatch.setattr(wc, "fetch_readable", boom)
    with _client() as c:
        r = c.post("/api/web-tools/call", json={"tool": "fetch_readable", "url": "https://a.com/"})
        assert r.status_code == 500
        assert "net down" in r.json()["detail"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

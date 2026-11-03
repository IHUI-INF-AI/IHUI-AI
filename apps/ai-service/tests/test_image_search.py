# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""image_search 检索腿单元测试(MockTransport,不出网)。"""

import asyncio

import httpx

from app.services.image_search import _extract_vqd, _parse_images_payload, search_images


def _run(handler, query: str = "cat", max_results: int = 8):
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    async def go():
        try:
            return await search_images(query, max_results, client=client)
        finally:
            await client.aclose()

    return asyncio.run(go())


def _ok_handler(payload: dict):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/i.js"):
            return httpx.Response(200, json=payload)
        return httpx.Response(200, text='<html><script>vqd="4-1234567890"</script></html>')

    return handler


def test_正常载荷投影为工具结果():
    payload = {
        "results": [
            {
                "title": "A cat",
                "image": "https://img.example/a.jpg",
                "thumbnail": "https://thumb.example/a.jpg",
                "url": "https://site.example/a",
                "width": 800,
                "height": 600,
                "source": "example",
            }
        ]
    }
    r = _run(_ok_handler(payload))
    assert r["ok"] is True
    assert r["total"] == 1
    # 原字段集逐字不变;新增的 trust 单列断言(见 test_image_search_trust.py)
    assert {k: v for k, v in r["results"][0].items() if k != "trust"} == {
        "title": "A cat",
        "imageUrl": "https://img.example/a.jpg",
        "thumbnailUrl": "https://thumb.example/a.jpg",
        "sourceUrl": "https://site.example/a",
        "width": 800,
        "height": 600,
        "source": "example",
    }
    assert r["results"][0]["trust"]["tier"] == "unknown"


def test_max_results_截断且跳过无_image_项():
    payload = {
        "results": [
            {"title": "no image"},
            {"image": "https://img.example/1.jpg"},
            {"image": "https://img.example/2.jpg"},
            {"image": "https://img.example/3.jpg"},
        ]
    }
    r = _run(_ok_handler(payload), max_results=2)
    assert r["ok"] is True
    assert [x["imageUrl"] for x in r["results"]] == [
        "https://img.example/1.jpg",
        "https://img.example/2.jpg",
    ]


def test_vqd_取不到判未判定而不是编造():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>no token here</html>")

    r = _run(handler)
    assert r["ok"] is False
    assert r["error"] == "vqd_not_found"
    assert r["results"] == []


def test_网络失败返回_ok_false():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    r = _run(handler)
    assert r["ok"] is False
    assert r["results"] == []
    assert r["error"]


def test_空_query_返回空结果():
    r = _run(lambda request: httpx.Response(200), query="   ")
    assert r["ok"] is True
    assert r["total"] == 0


def test_vqd_三种形态都能取到():
    assert _extract_vqd('<div data-vqd="abc-1"></div>') == "abc-1"
    assert _extract_vqd("url?q=x&vqd=4-42") == "4-42"
    assert _extract_vqd('cfg = { vqd: "zz-9" }') == "zz-9"
    assert _extract_vqd("nothing") is None


def test_载荷不认识时不编造():
    assert _parse_images_payload({"results": "oops"}, 5) == []
    assert _parse_images_payload({}, 5) == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

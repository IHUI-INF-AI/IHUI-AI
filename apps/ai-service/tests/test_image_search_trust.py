# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""image_search 来源可信度分档(assess_trust)单元测试;检索腿用 MockTransport,不出网。"""

import asyncio
from typing import Any

import httpx

from app.services.image_search import assess_trust, search_images


def _run(payload: dict[str, Any], max_results: int = 8) -> dict[str, Any]:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/i.js"):
            return httpx.Response(200, json=payload)
        return httpx.Response(200, text='<html><script>vqd="4-1234567890"</script></html>')

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    async def go() -> dict[str, Any]:
        try:
            return await search_images("cat", max_results, client=client)
        finally:
            await client.aclose()

    return asyncio.run(go())


def test_官方域名判_official() -> None:
    for url in (
        "https://upload.wikimedia.org/wikipedia/commons/a.jpg",
        "https://raw.githubusercontent.com/o/r/main/a.png",
        "https://images.unsplash.com/photo-1",
    ):
        t = assess_trust({"imageUrl": url})
        assert t["tier"] == "official", url
        assert t["score"] >= 90
        assert any("官方" in r for r in t["reasons"])


def test_可信图源判_trusted() -> None:
    for url in ("https://i.imgur.com/x.jpg", "https://res.cloudinary.com/d/x.png"):
        t = assess_trust({"imageUrl": url})
        assert t["tier"] == "trusted", url
        assert 60 <= t["score"] <= 80
        assert any("可信图源" in r for r in t["reasons"])


def test_普通域名判_unknown_且写明不等于恶意() -> None:
    t = assess_trust({"imageUrl": "https://photos.example.net/x.jpg"})
    assert t["tier"] == "unknown"
    assert 30 <= t["score"] <= 50
    assert any("不等于恶意" in r for r in t["reasons"])


def test_白名单按域后缀匹配不误伤近名域() -> None:
    t = assess_trust({"imageUrl": "https://evil-wikimedia.org/a.jpg"})
    assert t["tier"] == "unknown"


def test_回环私网与非_http_判_unsafe() -> None:
    for url in (
        "http://127.0.0.1/a.jpg",
        "https://10.1.2.3/a.jpg",
        "https://192.168.1.9/a.jpg",
        "https://169.254.1.1/a.jpg",
        "https://localhost/a.jpg",
        "http://[::1]/a.jpg",
        "ftp://example.com/a.jpg",
        "not-a-url",
        "",
    ):
        t = assess_trust({"imageUrl": url})
        assert t["tier"] == "unsafe", url
        assert t["score"] == 0
        assert t["reasons"], url


def test_http_明文至少降一档() -> None:
    official = assess_trust({"imageUrl": "http://upload.wikimedia.org/a.jpg"})
    assert official["tier"] == "trusted"
    assert any("http 明文" in r for r in official["reasons"])

    trusted = assess_trust({"imageUrl": "http://i.imgur.com/a.jpg"})
    assert trusted["tier"] == "unknown"

    plain_http = assess_trust({"imageUrl": "http://photos.example.net/a.jpg"})
    plain_https = assess_trust({"imageUrl": "https://photos.example.net/a.jpg"})
    assert plain_http["tier"] == "unknown"
    assert plain_http["score"] < plain_https["score"]


def test_同主域加分且不跨档() -> None:
    bare = assess_trust({"imageUrl": "https://images.unsplash.com/a.jpg"})
    both = assess_trust(
        {
            "imageUrl": "https://images.unsplash.com/a.jpg",
            "sourceUrl": "https://unsplash.com/photos/1",
            "thumbnailUrl": "https://images.unsplash.com/a-thumb.jpg",
        }
    )
    assert both["tier"] == "official"
    assert both["score"] > bare["score"]

    unknown = assess_trust(
        {
            "imageUrl": "https://cdn.example.net/a.jpg",
            "sourceUrl": "https://example.net/post",
            "thumbnailUrl": "https://cdn.example.net/t.jpg",
        }
    )
    assert unknown["tier"] == "unknown"
    assert unknown["score"] <= 50


def test_结果按_score_降序且同分稳定() -> None:
    payload = {
        "results": [
            {"image": "https://photos.example.net/a.jpg"},
            {"image": "https://i.imgur.com/b.jpg"},
            {"image": "https://upload.wikimedia.org/c.jpg"},
            {"image": "https://photos.example.net/d.jpg"},
        ]
    }
    r = _run(payload)
    assert [x["trust"]["tier"] for x in r["results"]] == [
        "official",
        "trusted",
        "unknown",
        "unknown",
    ]
    assert [x["imageUrl"] for x in r["results"] if x["trust"]["tier"] == "unknown"] == [
        "https://photos.example.net/a.jpg",
        "https://photos.example.net/d.jpg",
    ]


def test_message_带_unsafe_条数并点名() -> None:
    payload = {
        "results": [
            {"image": "https://upload.wikimedia.org/a.jpg"},
            {"image": "http://127.0.0.1/b.jpg"},
            {"image": "https://localhost/c.jpg"},
        ]
    }
    r = _run(payload)
    assert r["total"] == 3
    assert "2 条来源不可信" in r["message"]
    assert "127.0.0.1" in r["message"]
    assert "localhost" in r["message"]
    assert r["results"][-1]["trust"]["tier"] == "unsafe"


def test_message_无_unsafe_时不点名() -> None:
    r = _run({"results": [{"image": "https://upload.wikimedia.org/a.jpg"}]})
    assert r["message"] == "找到 1 条图片"


def test_结果结构保留原字段并新增_trust() -> None:
    payload = {"results": [{"image": "https://upload.wikimedia.org/a.jpg", "width": 1, "height": 2}]}
    item = _run(payload)["results"][0]
    assert set(item) == {
        "title",
        "imageUrl",
        "thumbnailUrl",
        "sourceUrl",
        "width",
        "height",
        "source",
        "trust",
    }
    assert set(item["trust"]) == {"tier", "score", "reasons"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

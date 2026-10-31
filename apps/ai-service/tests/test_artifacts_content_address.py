# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-25:artifacts 内容寻址 —— payload_sha256 与按内容查回。"""

import asyncio

from app.services.artifacts_store import ArtifactsStore, payload_sha256_of


def _store() -> ArtifactsStore:
    """强制内存模式:测试铁律禁止连任何 Redis。"""
    s = ArtifactsStore()
    s._use_redis = False
    s._redis = None
    return s


def _run(coro):
    return asyncio.run(coro)


def test_摘要只取内容维度且稳定():
    a = {"type": "file", "title": "t", "content": "body", "metadata": {"k": 1}}
    b = {"type": "file", "title": "t", "content": "body", "metadata": {"k": 1}, "id": "x", "created_at": "now"}
    assert payload_sha256_of(a) == payload_sha256_of(b)
    assert len(payload_sha256_of(a)) == 64
    assert payload_sha256_of(a) != payload_sha256_of({**a, "content": "other"})
    assert payload_sha256_of(a) != payload_sha256_of({**a, "metadata": {"k": 2}})


def test_add_写入摘要且同内容同摘要():
    async def go():
        s = _store()
        r1 = await s.add("c1", {"type": "file", "title": "t", "content": "x"})
        r2 = await s.add("c1", {"type": "file", "title": "t", "content": "x"})
        g1 = await s.get("c1", r1["artifact_id"])
        g2 = await s.get("c1", r2["artifact_id"])
        return r1, r2, g1, g2

    r1, r2, g1, g2 = _run(go())
    assert r1["artifact_id"] != r2["artifact_id"]
    assert g1["artifact"]["payload_sha256"] == g2["artifact"]["payload_sha256"]
    assert len(g1["artifact"]["payload_sha256"]) == 64


def test_按内容体查回():
    async def go():
        s = _store()
        await s.add("c1", {"type": "file", "title": "t", "content": "hello"})
        return await s.find_by_payload("c1", {"type": "file", "title": "t", "content": "hello"})

    r = _run(go())
    assert r["ok"] is True
    assert r["artifact"]["content"] == "hello"


def test_按摘要查回():
    async def go():
        s = _store()
        payload = {"type": "screenshot", "title": "shot", "content": "png-bytes"}
        added = await s.add("c1", payload)
        got = await s.get("c1", added["artifact_id"])
        return got["artifact"]["payload_sha256"], await s.find_by_sha256("c1", got["artifact"]["payload_sha256"])

    sha, r = _run(go())
    assert r["ok"] is True
    assert r["artifact"]["title"] == "shot"


def test_内容不同查不到():
    async def go():
        s = _store()
        await s.add("c1", {"type": "file", "title": "t", "content": "a"})
        return await s.find_by_payload("c1", {"type": "file", "title": "t", "content": "b"})

    r = _run(go())
    assert r["ok"] is False
    assert r["errorCode"] == "NOT_FOUND"


def test_旧记录无摘要字段也现算命中():
    async def go():
        s = _store()
        legacy = {"id": "old-1", "type": "file", "title": "t", "content": "legacy", "metadata": {}}
        s._store.setdefault("c1", {})["old-1"] = legacy
        return await s.find_by_payload("c1", {"type": "file", "title": "t", "content": "legacy"})

    r = _run(go())
    assert r["ok"] is True
    assert r["artifact"]["id"] == "old-1"


def test_缺参数返回_MISSING_PARAMS():
    async def go():
        s = _store()
        return await s.find_by_sha256("", "x")

    assert _run(go())["errorCode"] == "MISSING_PARAMS"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

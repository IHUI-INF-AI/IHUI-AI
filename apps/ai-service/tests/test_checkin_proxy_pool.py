# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""免费代理池单测(纯函数;抓取/测活走真实网络,不在单测面)。"""

from app.services import checkin_proxy_pool as pp


def test_parse_proxy_source_dedup_and_filter():
    text = """
    1.2.3.4:8080
    1.2.3.4:8080
    5.6.7.8:3128
    not-a-proxy
    9.9.9.9
    10.0.0.1:99999
    10.0.0.2:0
    """
    out = pp.parse_proxy_source(text)
    assert out == ["http://1.2.3.4:8080", "http://5.6.7.8:3128"]


def test_sticky_proxy_for_uid_stable_binding():
    pool = ["http://1.1.1.1:80", "http://2.2.2.2:80", "http://3.3.3.3:80"]
    a1 = pp.sticky_proxy_for_uid("user-a", pool)
    a2 = pp.sticky_proxy_for_uid("user-a", pool)
    assert a1 == a2, "同账号必须粘性绑定同一出口"
    assert a1 in pool
    # 不同 uid 尽量分散(不强制,但空 uid/空池必须 None)
    assert pp.sticky_proxy_for_uid("", pool) is None
    assert pp.sticky_proxy_for_uid("user-b", []) is None


def test_device_map_uid_keys():
    assert pp.device_map_uid({"uid": " 42 "}) == "42"
    assert pp.device_map_uid({"user_id": 7}) == "7"
    assert pp.device_map_uid({}) is None


def test_ensure_proxy_existing_wins():
    import asyncio

    dm = {"uid": "u-1", "proxy": "http://manual:8080"}
    got = asyncio.run(pp.ensure_proxy(dm))
    assert got == "http://manual:8080", "手动指定的 proxy 优先,不触发池"


def test_ensure_proxy_no_uid_returns_none():
    import asyncio

    got = asyncio.run(pp.ensure_proxy({}))
    assert got is None


def test_refresh_pool_end_to_end_without_network(monkeypatch):
    """refresh_pool 必须真能跑完:抓源→测活→入池,且不碰真实网络。

    回归型:该函数体内曾有一句 `import asyncio`,把 asyncio 变成**局部名**,
    于是更早那行 `asyncio.Semaphore(…)` 每次必抛 UnboundLocalError ⇒ 免费代理池
    整条功能一调就崩(单测面当时只覆盖纯函数,没兜住)。
    """
    import asyncio

    async def fake_fetch(url: str, client: object) -> str:
        return f"{url}\n1.2.3.4:8080\n5.6.7.8:3128\nnot-a-proxy\n"

    async def fake_probe(proxy: str) -> str | None:
        return proxy if proxy.endswith("3128") else None

    monkeypatch.setattr(pp, "_fetch_source", fake_fetch)
    monkeypatch.setattr(pp, "_probe_alive", fake_probe)
    monkeypatch.setattr(pp, "_pool_cache", [])
    monkeypatch.setattr(pp, "_pool_fetched_at", 0.0)

    out = asyncio.run(pp.refresh_pool())

    assert out == ["http://5.6.7.8:3128"], "测活通过的才入池"
    assert pp._pool_cache == out, "结果必须写回进程级缓存"
    assert pp._pool_fetched_at > 0.0, "刷新时刻必须落账,否则 1h 去重恒失效"

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

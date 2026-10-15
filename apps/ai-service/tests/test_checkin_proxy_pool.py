# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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

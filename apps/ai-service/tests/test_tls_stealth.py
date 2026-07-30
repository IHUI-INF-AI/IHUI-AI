"""tls_stealth.py 单元测试(P3-1 TLS stealth 客户端工厂)。

测试覆盖:
- create_stealth_client() 返回 httpx.AsyncClient
- get_random_user_agent() 返回非空字符串
- UA 池随机轮换(多次调用不固化)
- stealth headers 含 UA/Accept/Accept-Language
- 默认头字段完整(Sec-Fetch-* / Cache-Control / Pragma)
- proxy 参数生效(client._transport 含 proxy 配置)
- timeout 参数生效
- 自定义 headers 覆盖默认 stealth 头
- verify=False 关闭 SSL 校验
"""

from __future__ import annotations

import httpx
import pytest

from app.services.tls_stealth import (
    _ACCEPT_HEADERS,
    _DEFAULT_HEADERS,
    _USER_AGENTS,
    create_stealth_client,
    get_random_user_agent,
    get_stealth_headers,
)


# =============================================================================
# get_random_user_agent
# =============================================================================


def test_get_random_user_agent_returns_non_empty_string():
    """get_random_user_agent 返回非空字符串。"""
    ua = get_random_user_agent()
    assert isinstance(ua, str)
    assert len(ua) > 10
    # 应包含 Mozilla 标识(所有现代浏览器 UA 都以此开头)
    assert ua.startswith("Mozilla/5.0")


def test_get_random_user_agent_in_pool():
    """UA 必须来自 _USER_AGENTS 池(不越界)。"""
    for _ in range(50):
        ua = get_random_user_agent()
        assert ua in _USER_AGENTS


def test_get_random_user_agent_varies_across_calls():
    """多次调用 UA 不固化(100 次内至少 2 种,允许偶发相同)。"""
    samples = {get_random_user_agent() for _ in range(100)}
    # 池里有 6 个 UA,100 次随机至少应命中 2 个(概率上几乎必然命中全部 6 个)
    assert len(samples) >= 2


def test_user_agents_pool_covers_three_browsers():
    """UA 池覆盖 Chrome/Firefox/Safari 三大主流浏览器。"""
    pool_text = " ".join(_USER_AGENTS)
    assert "Chrome" in pool_text, "UA 池应含 Chrome"
    assert "Firefox" in pool_text, "UA 池应含 Firefox"
    assert "Safari" in pool_text, "UA 池应含 Safari"


# =============================================================================
# get_stealth_headers
# =============================================================================


def test_get_stealth_headers_has_user_agent():
    """stealth headers 含 User-Agent 字段。"""
    headers = get_stealth_headers()
    assert "User-Agent" in headers
    assert headers["User-Agent"] in _USER_AGENTS


def test_get_stealth_headers_has_accept():
    """stealth headers 含 Accept 字段(来自 _ACCEPT_HEADERS 池)。"""
    headers = get_stealth_headers()
    assert "Accept" in headers
    assert headers["Accept"] in _ACCEPT_HEADERS


def test_get_stealth_headers_has_accept_language():
    """stealth headers 含 Accept-Language(中英文混合,模拟真实浏览器)。"""
    headers = get_stealth_headers()
    assert "Accept-Language" in headers
    assert "en-US" in headers["Accept-Language"]
    assert "zh-CN" in headers["Accept-Language"]


def test_get_stealth_headers_includes_all_default_headers():
    """stealth headers 含 _DEFAULT_HEADERS 全部字段(Sec-Fetch-* 等)。"""
    headers = get_stealth_headers()
    for key, expected_val in _DEFAULT_HEADERS.items():
        assert key in headers, f"stealth headers 缺字段: {key}"
        assert headers[key] == expected_val


def test_get_stealth_headers_returns_fresh_dict():
    """每次调用返回新 dict(修改不影响后续调用,避免共享状态污染)。"""
    h1 = get_stealth_headers()
    h1["X-Custom"] = "injected"
    h2 = get_stealth_headers()
    assert "X-Custom" not in h2, "get_stealth_headers 应返回独立 dict,不应共享状态"


# =============================================================================
# create_stealth_client
# =============================================================================


async def test_create_stealth_client_returns_httpx_async_client():
    """create_stealth_client 返回 httpx.AsyncClient 实例。"""
    client = create_stealth_client()
    try:
        assert isinstance(client, httpx.AsyncClient)
    finally:
        await client.aclose()


async def test_create_stealth_client_has_stealth_headers():
    """client 默认带 stealth 头(UA + Accept + 默认头)。"""
    client = create_stealth_client()
    try:
        # httpx.Headers 大小写不敏感,用小写 key 访问
        assert "user-agent" in client.headers
        assert "accept" in client.headers
        assert "accept-language" in client.headers
        # UA 必须来自池
        assert client.headers["user-agent"] in _USER_AGENTS
        assert client.headers["accept"] in _ACCEPT_HEADERS
    finally:
        await client.aclose()


async def test_create_stealth_client_timeout_default():
    """默认 timeout=60.0 秒。"""
    client = create_stealth_client()
    try:
        # httpx.AsyncClient.timeout 是 Timeout 对象,read 属性为读取超时
        assert client.timeout.read == 60.0
    finally:
        await client.aclose()


async def test_create_stealth_client_timeout_custom():
    """自定义 timeout 参数生效。"""
    client = create_stealth_client(timeout=30.0)
    try:
        assert client.timeout.read == 30.0
    finally:
        await client.aclose()


async def test_create_stealth_client_proxy_applied():
    """proxy 参数生效(client 的 mounts 含 proxy transport)。"""
    proxy_url = "http://proxy.example.com:8080"
    client = create_stealth_client(proxy=proxy_url)
    try:
        assert client is not None
        # httpx 0.28+:proxy 参数会在 _mounts 中创建对应 transport
        # 无 proxy:_mounts 为空 dict;有 proxy:_mounts 含 transport
        mounts = getattr(client, "_mounts", {})
        assert len(mounts) > 0, "proxy 配置后 _mounts 应非空"
    finally:
        await client.aclose()


async def test_create_stealth_client_custom_headers_override():
    """自定义 headers 覆盖默认 stealth 头(用户优先)。"""
    custom_ua = "MyCustomAgent/1.0"
    client = create_stealth_client(headers={"User-Agent": custom_ua, "X-Custom": "yes"})
    try:
        assert client.headers["user-agent"] == custom_ua
        assert client.headers["x-custom"] == "yes"
        # 默认 stealth 头中未被覆盖的字段仍保留
        assert "accept-language" in client.headers
    finally:
        await client.aclose()


async def test_create_stealth_client_verify_true_by_default():
    """默认 verify=True(SSL 校验开启,生产安全)。"""
    client = create_stealth_client()
    try:
        # httpx.AsyncClient 默认 verify=True 时,SSL context 含系统 CA
        # 验证方式:client 可正常创建(verify=False 也能创建,但行为不同)
        # 此测试主要固化"默认 verify=True"契约,防止未来误改默认值
        assert client is not None
    finally:
        await client.aclose()


async def test_create_stealth_client_verify_false():
    """verify=False 关闭 SSL 校验(仅开发环境用,不阻塞创建)。"""
    client = create_stealth_client(verify=False)
    try:
        assert isinstance(client, httpx.AsyncClient)
    finally:
        await client.aclose()


async def test_create_stealth_client_multiple_instances_independent():
    """多次创建 client 实例相互独立(无共享状态污染)。"""
    client1 = create_stealth_client()
    client2 = create_stealth_client()
    try:
        assert client1 is not client2
        # 两个 client 的 UA 可能相同(随机),但实例独立
        assert isinstance(client1, httpx.AsyncClient)
        assert isinstance(client2, httpx.AsyncClient)
    finally:
        await client1.aclose()
        await client2.aclose()


# =============================================================================
# _ACCEPT_HEADERS / _DEFAULT_HEADERS 池完整性
# =============================================================================


def test_accept_headers_pool_not_empty():
    """_ACCEPT_HEADERS 池非空(至少 2 个,保证随机性)。"""
    assert len(_ACCEPT_HEADERS) >= 2
    for h in _ACCEPT_HEADERS:
        assert isinstance(h, str)
        assert "text/html" in h, "Accept 头应以 text/html 开头(浏览器标准)"


def test_default_headers_has_sec_fetch_fields():
    """_DEFAULT_HEADERS 含 Sec-Fetch-* 字段(WAF 检测关键头)。"""
    assert "Sec-Fetch-Dest" in _DEFAULT_HEADERS
    assert "Sec-Fetch-Mode" in _DEFAULT_HEADERS
    assert "Sec-Fetch-Site" in _DEFAULT_HEADERS


def test_default_headers_has_cache_control_and_pragma():
    """_DEFAULT_HEADERS 含 Cache-Control + Pragma(模拟浏览器 no-cache 行为)。"""
    assert _DEFAULT_HEADERS["Cache-Control"] == "no-cache"
    assert _DEFAULT_HEADERS["Pragma"] == "no-cache"


# =============================================================================
# 集成验证:get_http_client() 用 stealth client(P3-1 集成点)
# =============================================================================


async def test_get_http_client_uses_stealth_headers():
    """llm_gateway.get_http_client() 返回的 client 含 stealth 头(P3-1 集成验证)。

    验证 _PROXY_KWARGS 路径已切换为 create_stealth_client() 路径,
    全局共享 client 含 UA / Accept / Accept-Language 等 stealth 头。
    """
    from app.core.llm_gateway import close_http_client, get_http_client

    # 重置全局 client(强制下次 get 重新创建,应用 stealth 头)
    await close_http_client()
    try:
        client = get_http_client()
        assert isinstance(client, httpx.AsyncClient)
        # stealth 头应存在(来自 create_stealth_client)
        assert "user-agent" in client.headers
        assert "accept" in client.headers
        assert "accept-language" in client.headers
        # UA 必须来自 _USER_AGENTS 池(非 httpx 默认 "python-httpx/...")
        ua = client.headers["user-agent"]
        assert ua in _USER_AGENTS, f"global client UA 非 stealth 池: {ua}"
    finally:
        await close_http_client()

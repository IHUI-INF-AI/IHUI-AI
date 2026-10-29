# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""按 IP 的长连接闸门(2026-10-28 DDoS 加固 · Python 侧)。

钉三组判据:
1. IP 提取优先级:**只信边缘层(router)验证后注入**的 x-ihui-client-ip + x-ihui-edge-verified,
   绝不读客户端可整写的 cf-connecting-ip / x-forwarded-for / x-real-ip(见 conn_guard 头注);
   边缘结论缺失时回落 TCP 对端(scope["client"] / WSGI REMOTE_ADDR),再不行给 "unknown"
   (空串会把所有取不到 IP 的连接并成一个桶,故必须给哨兵值);
2. IpConnGate:握手频率、按 IP 隔离、并发槽获取/释放、表大小硬顶;
3. 接线语义:中间件超限时**不调下游**、handler 抛异常也要归还槽;sio connect 把闸门
   排在验签**之前**,全局容量到顶时拒绝新握手而**不踢存量连接** —— 旧实现是
   `_evict_sessions_if_needed` 在 accept 之后 FIFO pop 最旧一条,等于"新连接进来就把
   最老实的合法用户挤下线",持几个可用 token 持续建连即可放大型断服。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.core.conn_guard import (
    UNKNOWN_IP,
    IpConnGate,
    WsConnGuardMiddleware,
    client_ip_from_container,
)
from app.sio import handlers

# =============================================================================
# IP 提取
# =============================================================================


def _asgi_scope(
    ip: str = "",
    edge_ip: str = "",
    edge_verified: bool = False,
    scope_type: str = "websocket",
) -> dict[str, Any]:
    headers: list[tuple[bytes, bytes]] = []
    if edge_ip:
        headers.append((b"x-ihui-client-ip", edge_ip.encode()))
    if edge_verified:
        headers.append((b"x-ihui-edge-verified", b"1"))
    scope: dict[str, Any] = {"type": scope_type, "headers": headers}
    if ip:
        scope["client"] = (ip, 54321)
    return scope


def test_client_ip_ignores_client_supplied_cf_connecting_ip() -> None:
    """伪造的 cf-connecting-ip 必须被忽略,回落到 TCP 对端。

    立因:生产边缘是腾讯云 EdgeOne 而非 Cloudflare,永不写 cf-connecting-ip;
    任何客户端自带该头都是伪造。旧实现优先采信它 ⇒ 攻击者每个请求换一个假 IP
    即绕过 per-IP 并发/握手上限。
    """
    headers: list[tuple[bytes, bytes]] = [(b"cf-connecting-ip", b"1.1.1.1")]
    scope = {"type": "websocket", "headers": headers, "client": ("10.0.0.9", 54321)}
    assert client_ip_from_container(scope) == "10.0.0.9"


def test_client_ip_ignores_x_forwarded_for() -> None:
    """x-forwarded-for 最左值同样客户端可整写,不得采信。"""
    headers: list[tuple[bytes, bytes]] = [(b"x-forwarded-for", b"2.2.2.2, 3.3.3.3")]
    scope = {"type": "websocket", "headers": headers, "client": ("10.0.0.9", 54321)}
    assert client_ip_from_container(scope) == "10.0.0.9"


def test_client_ip_trusts_edge_verified_header() -> None:
    """带 x-ihui-edge-verified:1 + x-ihui-client-ip ⇒ 取后者(router 注入的真实 IP)。"""
    scope = _asgi_scope(ip="10.0.0.9", edge_ip="203.0.113.7", edge_verified=True)
    assert client_ip_from_container(scope) == "203.0.113.7"


def test_client_ip_ignores_edge_header_without_verified_marker() -> None:
    """反向对照:只有 x-ihui-client-ip 而无 verified 标记 ⇒ 不得采信,回落 TCP 对端。

    防的是"攻击者自己带一个 x-ihui-client-ip 骗限流"。标记由 router 经回源鉴权后才
    注入,客户端无法伪造,故无标记即视为未验证。
    """
    headers: list[tuple[bytes, bytes]] = [(b"x-ihui-client-ip", b"203.0.113.7")]
    scope = {"type": "websocket", "headers": headers, "client": ("10.0.0.9", 54321)}
    assert client_ip_from_container(scope) == "10.0.0.9"


def test_client_ip_falls_back_to_socket_peer() -> None:
    assert client_ip_from_container(_asgi_scope(ip="10.0.0.7")) == "10.0.0.7"


def test_client_ip_reads_wsgi_remote_addr() -> None:
    """WSGI 的 REMOTE_ADDR 是服务器侧 TCP 对端,可信;HTTP_X_FORWARDED_FOR 已不采信。"""
    environ = {"REMOTE_ADDR": "4.4.4.4"}
    assert client_ip_from_container(environ) == "4.4.4.4"


def test_client_ip_gives_sentinel_not_empty_string() -> None:
    # 空串会把所有"取不到 IP"的连接并成同一个桶 ⇒ 闸门被拧成全局开关
    assert client_ip_from_container({"type": "http", "headers": []}) == UNKNOWN_IP
    assert client_ip_from_container("not-a-dict") == UNKNOWN_IP


# =============================================================================
# IpConnGate
# =============================================================================


def test_gate_isolates_handshake_budget_per_ip() -> None:
    gate = IpConnGate(handshake_per_window=2, max_conn_per_ip=5)
    assert gate.allow_handshake("1.1.1.1", now=0.0)
    assert gate.allow_handshake("1.1.1.1", now=0.1)
    assert not gate.allow_handshake("1.1.1.1", now=0.2)
    assert gate.allow_handshake("2.2.2.2", now=0.2)


def test_gate_window_expires() -> None:
    gate = IpConnGate(handshake_per_window=1, max_conn_per_ip=5, window_sec=1.0)
    assert gate.allow_handshake("3.3.3.3", now=0.0)
    assert not gate.allow_handshake("3.3.3.3", now=0.5)
    assert gate.allow_handshake("3.3.3.3", now=1.5)  # 上一跳已出窗


def test_gate_acquire_release_roundtrip() -> None:
    gate = IpConnGate(handshake_per_window=100, max_conn_per_ip=2)
    assert gate.acquire("4.4.4.4")
    assert gate.acquire("4.4.4.4")
    assert not gate.acquire("4.4.4.4")
    gate.release("4.4.4.4")
    assert gate.acquire("4.4.4.4")
    assert gate.live_count("4.4.4.4") == 2


def test_gate_releasing_below_zero_drops_the_key() -> None:
    gate = IpConnGate(handshake_per_window=100, max_conn_per_ip=2)
    gate.acquire("5.5.5.5")
    gate.release("5.5.5.5")
    gate.release("5.5.5.5")  # 重复释放(异常路径可能撞上)不得把计数变负
    assert gate.live_count("5.5.5.5") == 0
    assert gate.acquire("5.5.5.5")


def test_gate_prunes_stale_ips_and_caps_table_size() -> None:
    gate = IpConnGate(
        handshake_per_window=100, max_conn_per_ip=5, window_sec=1.0, max_tracked_ips=3
    )
    for i, ip in enumerate(["a", "b", "c"]):
        gate.allow_handshake(ip, now=float(i))
    gate.allow_handshake("d", now=3.0)
    gate.prune(now=3.5)  # window=1s ⇒ a(0)/b(1)/c(2) 均出窗，只有 d(3.0) 还在窗内
    assert gate.tracked_ip_count() == 1


def test_gate_hard_cap_evicts_oldest_when_all_fresh() -> None:
    gate = IpConnGate(handshake_per_window=100, max_conn_per_ip=5, window_sec=60.0, max_tracked_ips=2)
    for ip in ("a", "b", "c"):
        gate.allow_handshake(ip, now=0.0)
    assert gate.tracked_ip_count() <= 2  # 全新鲜也必须有硬顶，否则换 IP 就能撑爆内存


# =============================================================================
# ASGI 中间件
# =============================================================================


async def _noop_receive() -> dict[str, Any]:
    return {"type": "websocket.connect"}


def _collector() -> tuple[list[dict[str, Any]], Any]:
    sent: list[dict[str, Any]] = []

    async def send(message: dict[str, Any]) -> None:
        sent.append(message)

    return sent, send


async def test_middleware_passes_http_through_untouched() -> None:
    gate = IpConnGate(handshake_per_window=1, max_conn_per_ip=1)
    called: dict[str, int] = {"n": 0}

    async def inner(scope: Any, receive: Any, send: Any) -> None:
        called["n"] += 1

    mw = WsConnGuardMiddleware(inner, gate, label="t")
    await mw(_asgi_scope(ip="1.1.1.1", scope_type="http"), _noop_receive, _collector()[1])
    assert called["n"] == 1
    assert gate.tracked_ip_count() == 0


async def test_middleware_holds_the_slot_for_the_life_of_the_connection() -> None:
    """并发槽的语义 = 连接存续期。

    FastAPI 的 WS 路由函数会一直跑到断开，所以 inner 用 Event 挂住模拟真实连接；
    若 inner 立即返回(槽立即归还)，测的就是"瞬时并发"而不是"长连接并发"，那是假判据。
    """
    gate = IpConnGate(handshake_per_window=100, max_conn_per_ip=1)
    called: dict[str, int] = {"n": 0}
    hold = asyncio.Event()

    async def inner(scope: Any, receive: Any, send: Any) -> None:
        called["n"] += 1
        await hold.wait()

    mw = WsConnGuardMiddleware(inner, gate, label="t")
    scope = _asgi_scope(ip="9.9.9.9")

    first, send1 = _collector()
    task = asyncio.create_task(mw(scope, _noop_receive, send1))
    await asyncio.sleep(0)
    assert called["n"] == 1

    # 第一条还挂着 ⇒ 第二条同 IP 必须被拒，且不进业务 handler
    second, send2 = _collector()
    await mw(scope, _noop_receive, send2)
    assert called["n"] == 1
    assert second[0]["type"] == "websocket.close"
    assert gate.live_count("9.9.9.9") == 1

    hold.set()
    await task
    assert gate.live_count("9.9.9.9") == 0  # 断开即归还


async def test_middleware_returns_slot_when_handler_raises() -> None:
    gate = IpConnGate(handshake_per_window=100, max_conn_per_ip=1)

    async def boom(scope: Any, receive: Any, send: Any) -> None:
        raise RuntimeError("handler died")

    mw = WsConnGuardMiddleware(boom, gate, label="t")
    with pytest.raises(RuntimeError):
        await mw(_asgi_scope(ip="8.8.8.8"), _noop_receive, _collector()[1])
    assert gate.live_count("8.8.8.8") == 0


async def test_middleware_blocks_handshake_flood() -> None:
    gate = IpConnGate(handshake_per_window=2, max_conn_per_ip=50)
    reached: dict[str, int] = {"n": 0}

    async def inner(scope: Any, receive: Any, send: Any) -> None:
        reached["n"] += 1

    mw = WsConnGuardMiddleware(inner, gate, label="t")
    scope = _asgi_scope(ip="6.6.6.6")
    results = []
    for _ in range(5):
        sent, send = _collector()
        await mw(scope, _noop_receive, send)
        results.append(sent[0]["type"] if sent else "accepted")
    assert reached["n"] == 2
    assert results.count("websocket.close") == 3


# =============================================================================
# Socket.IO connect / disconnect 接线
# =============================================================================


@pytest.fixture()
def sio_gate(monkeypatch: pytest.MonkeyPatch) -> IpConnGate:
    gate = IpConnGate(handshake_per_window=3, max_conn_per_ip=2, window_sec=60.0)
    monkeypatch.setattr(handlers, "sio_conn_gate", gate)
    handlers._sessions.clear()
    yield gate
    handlers._sessions.clear()


def _accept_all(monkeypatch: pytest.MonkeyPatch) -> dict[str, int]:
    calls: dict[str, int] = {"n": 0}

    async def fake_verify(token: str) -> dict[str, Any] | None:
        calls["n"] += 1
        return {"userId": "u1", "roleId": 0}

    monkeypatch.setattr(handlers, "_verify_token", fake_verify)
    return calls


async def test_sio_gate_runs_before_token_verification(
    sio_gate: IpConnGate, monkeypatch: pytest.MonkeyPatch
) -> None:
    """验签失败会 fallback 到 GET /api/auth/me(出站请求) ⇒ 闸门必须排在它前面。"""
    calls = _accept_all(monkeypatch)
    scope = _asgi_scope(ip="7.7.7.7")
    for i in range(6):
        await handlers.connect(f"sid{i}", scope, auth={"token": "t"})
    assert calls["n"] == 3  # 第 4 次握手就被闸门拒掉，不再花一次验签


async def test_sio_global_cap_refuses_new_handshake_without_evicting_live(
    sio_gate: IpConnGate, monkeypatch: pytest.MonkeyPatch
) -> None:
    _accept_all(monkeypatch)
    monkeypatch.setattr(handlers, "_MAX_SESSIONS", 2)
    scope = _asgi_scope(ip="7.7.7.8")
    assert await handlers.connect("old", scope, auth={"token": "t"}) is True
    assert await handlers.connect("second", scope, auth={"token": "t"}) is True
    assert await handlers.connect("third", scope, auth={"token": "t"}) is False
    # 关键:存量两条必须还在。旧实现在这里 pop 掉 "old" ⇒ 攻击者建连即可挤掉老实用户
    assert set(handlers._sessions) == {"old", "second"}
    assert sio_gate.live_count("7.7.7.8") == 2


async def test_sio_per_ip_connection_cap_is_enforced(
    sio_gate: IpConnGate, monkeypatch: pytest.MonkeyPatch
) -> None:
    _accept_all(monkeypatch)
    monkeypatch.setattr(handlers, "_MAX_SESSIONS", 100)
    hot = _asgi_scope(ip="7.7.7.9")
    other = _asgi_scope(ip="7.7.8.9")
    assert await handlers.connect("a", hot, auth={"token": "t"}) is True
    assert await handlers.connect("b", hot, auth={"token": "t"}) is True
    assert await handlers.connect("c", hot, auth={"token": "t"}) is False
    assert await handlers.connect("d", other, auth={"token": "t"}) is True


async def test_sio_disconnect_returns_the_slot(
    sio_gate: IpConnGate, monkeypatch: pytest.MonkeyPatch
) -> None:
    _accept_all(monkeypatch)
    monkeypatch.setattr(handlers, "_MAX_SESSIONS", 100)
    scope = _asgi_scope(ip="7.7.7.10")
    await handlers.connect("a", scope, auth={"token": "t"})
    assert sio_gate.live_count("7.7.7.10") == 1
    await handlers.disconnect("a")
    assert sio_gate.live_count("7.7.7.10") == 0
    assert await handlers.connect("b", scope, auth={"token": "t"}) is True


async def test_sio_rejected_handshake_leaks_no_slot(
    sio_gate: IpConnGate, monkeypatch: pytest.MonkeyPatch
) -> None:
    """鉴权失败/无 token 的连接根本没建立 ⇒ 不能占并发槽(否则拒绝即自伤)。"""

    async def deny(token: str) -> dict[str, Any] | None:
        return None

    monkeypatch.setattr(handlers, "_verify_token", deny)
    scope = _asgi_scope(ip="7.7.7.11")
    assert await handlers.connect("a", scope, auth={"token": "bad"}) is False
    assert await handlers.connect("b", scope, auth=None) is False
    assert sio_gate.live_count("7.7.7.11") == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""按 IP 的长连接握手闸门(Socket.IO 与 FastAPI 原生 WebSocket 共用一份实现)。

对应 DDoS 加固:此前 Python 侧三处长连接入口 —— sio connect、/api/engine/ws、
/api/browser/ws/{session_id} —— 都只做**身份**校验,没有任何按 IP 的握手频率或并发
上限;而现成的限流中间件(input_sanitizer)挂在 inner fastapi_app 上,Socket.IO 流量
根本不过它。单个 IP 因此可以无限建连,把进程的连接表与内存占满。

TS 侧 apps/api 已有等价件(plugins/ws-guard.ts),本模块是 Python 侧的同型实现,
判据一致:
  · 握手频率:窗口内每 IP 的握手次数上限;
  · 并发连接:每 IP 活跃长连接数上限;
  · 表大小有硬顶:只在同 IP 再次握手时过滤数组是不够的 ——「每个 IP 只打一发」会让
    数组永不复发、键永久留存,故按窗口清理 + 超限时淘汰最久未动手的 IP。

计数是**进程内**的。ai-service 明令禁 --workers(run-ai.ps1 头注),单进程即全量视角,
所以不需要跨进程共享计数。
"""

from __future__ import annotations

import os
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


def _env_int(name: str, default: int) -> int:
    """读整数型运维旋钮;读不到或形态坏一律回落默认(绝不回落成 0 ⇒ 那等于关掉闸门)。"""
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw.strip())
    except (AttributeError, ValueError):
        return default
    return value if value > 0 else default


MAX_CONN_PER_IP = _env_int("AI_WS_MAX_CONN_PER_IP", 200)
HANDSHAKE_PER_WINDOW = _env_int("AI_WS_HANDSHAKE_PER_IP_PER_WINDOW", 30)
HANDSHAKE_WINDOW_SEC = float(_env_int("AI_WS_HANDSHAKE_WINDOW_SEC", 1))
MAX_TRACKED_IPS = _env_int("AI_WS_MAX_TRACKED_IPS", 10000)
UNKNOWN_IP = "unknown"


def _decode(raw: object) -> str:
    if isinstance(raw, (bytes, bytearray)):
        return bytes(raw).decode("latin-1")
    if raw is None:
        return ""
    return str(raw)


def client_ip_from_container(container: object) -> str:
    """从 ASGI scope 或 WSGI environ 两种形态里尽力取客户端 IP。

    只信**边缘层(router)验证后注入**的结论,绝不读客户端可整写的 IP 类头
    (cf-connecting-ip / x-forwarded-for / x-real-ip):本项目生产边缘是腾讯云 EdgeOne,
    不是 Cloudflare —— EdgeOne 永不写 cf-connecting-ip,任何客户端自带该头都是伪造;
    x-forwarded-for 最左值同样是客户端自己写进去的。拿它们当限流键,等于把
    "每秒换一个假 IP" 的开关交给攻击者(每假 IP 各记 1 条 ⇒ 200 条并发上限形同虚设)。

    取值优先级:
      ① x-ihui-edge-verified == "1" 且 x-ihui-client-ip 存在
         ⇒ 这是 router 经回源鉴权后写入的不可伪造真实 IP,由 api 透传进本服务;
      ② 否则回落 TCP 对端(scope["client"][0] / WSGI REMOTE_ADDR);
      ③ 都取不到 ⇒ "unknown" 哨兵(空串会把所有取不到 IP 的连接并成一个桶,
        把闸门拧成全局开关)。

    这个值**只用于防御计量**,不得用作鉴权依据。
    """
    if not isinstance(container, dict):
        return UNKNOWN_IP

    headers = container.get("headers")
    if isinstance(headers, (list, tuple)):
        table: dict[str, str] = {}
        for item in headers:
            try:
                name, value = item[0], item[1]
            except (IndexError, TypeError):
                continue
            key = _decode(name).lower()
            if key and key not in table:
                table[key] = _decode(value)
        # ① 仅信边缘层验证结论:verified 标记存在 + 真实 IP 同时存在才采用。
        #   单独有 x-ihui-client-ip 而无标记 ⇒ 仍可能是客户端自带,回落对端。
        if table.get("x-ihui-edge-verified") == "1":
            ip = table.get("x-ihui-client-ip", "").strip()
            if ip:
                return ip

    # ② TCP 对端(不可伪造):ASGI scope["client"] 或 WSGI REMOTE_ADDR。
    client = container.get("client")
    if isinstance(client, (list, tuple)) and client:
        ip = _decode(client[0])
        if ip:
            return ip
    remote = container.get("REMOTE_ADDR")
    if isinstance(remote, str) and remote:
        return remote

    return UNKNOWN_IP


class IpConnGate:
    """单 IP 的握手频率 + 活跃连接数闸门(进程内,非分布式)。"""

    def __init__(
        self,
        *,
        max_conn_per_ip: int = MAX_CONN_PER_IP,
        handshake_per_window: int = HANDSHAKE_PER_WINDOW,
        window_sec: float = HANDSHAKE_WINDOW_SEC,
        max_tracked_ips: int = MAX_TRACKED_IPS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_conn_per_ip = max_conn_per_ip
        self._handshake_per_window = handshake_per_window
        self._window_sec = window_sec
        self._max_tracked_ips = max_tracked_ips
        self._clock = clock
        self._live: dict[str, int] = {}
        # OrderedDict:淘汰时按"最久未握手"的顺序摘,不会误伤正在活跃的那批。
        self._handshakes: OrderedDict[str, list[float]] = OrderedDict()

    def allow_handshake(self, ip: str, now: float | None = None) -> bool:
        """记录一次握手并判断是否放行。被拒的握手**也计数**,否则速率限制形同虚设。"""
        stamp = self._clock() if now is None else now
        stamps = [t for t in self._handshakes.get(ip, []) if stamp - t < self._window_sec]
        stamps.append(stamp)
        self._handshakes[ip] = stamps
        self._handshakes.move_to_end(ip)
        if len(stamps) > self._handshake_per_window:
            return False
        if len(self._handshakes) > self._max_tracked_ips:
            self.prune(stamp)
        return True

    def acquire(self, ip: str) -> bool:
        """连接真正建立时占一个并发槽;已达上限返回 False(调用方负责拒绝)。"""
        live = self._live.get(ip, 0)
        if live >= self._max_conn_per_ip:
            return False
        self._live[ip] = live + 1
        return True

    def release(self, ip: str) -> None:
        """释放并发槽;计数归零即删键,Map 不随 IP 数无限增长。"""
        live = self._live.get(ip, 0) - 1
        if live <= 0:
            self._live.pop(ip, None)
        else:
            self._live[ip] = live

    def prune(self, now: float | None = None) -> None:
        """清掉窗口外的握手记录;清完仍超限则按最久未动手的顺序淘汰,内存有硬顶。"""
        stamp = self._clock() if now is None else now
        stale = [
            ip
            for ip, stamps in self._handshakes.items()
            if not stamps or stamp - stamps[-1] >= self._window_sec
        ]
        for ip in stale:
            self._handshakes.pop(ip, None)
        while len(self._handshakes) > self._max_tracked_ips:
            self._handshakes.popitem(last=False)

    def live_count(self, ip: str) -> int:
        return self._live.get(ip, 0)

    def tracked_ip_count(self) -> int:
        return len(self._handshakes)

    def reset(self) -> None:
        self._live.clear()
        self._handshakes.clear()


class WsConnGuardMiddleware:
    """给所有 FastAPI 原生 WebSocket 路由加按 IP 的握手/并发闸门。

    为什么包在 ASGI 层、而不是逐个 handler 改:业务 handler(engine.py 的 JSON-RPC 循环、
    browser_hub.py 的帧转发)主体都是几百行,逐处包 try/finally 要把大段代码重新缩进,
    而且下一个 WS 路由新增时必然忘记接线。在这一层拦,新增路由天然落在射程内。
    """

    def __init__(self, app: ASGIApp, gate: IpConnGate, *, label: str = "ws") -> None:
        self._app = app
        self._gate = gate
        self._label = label

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "websocket":
            await self._app(scope, receive, send)
            return

        ip = client_ip_from_container(scope)
        if not self._gate.allow_handshake(ip):
            await self._reject(send, f"{self._label} handshake rate limit exceeded")
            return
        if not self._gate.acquire(ip):
            await self._reject(send, f"{self._label} per-IP connection limit exceeded")
            return
        try:
            await self._app(scope, receive, send)
        finally:
            self._gate.release(ip)

    @staticmethod
    async def _reject(send: Send, reason: str) -> None:
        # 在 accept 之前发 websocket.close 是 ASGI 规范允许的拒绝形态(不进入业务 handler)。
        message: Message = {"type": "websocket.close", "code": 1008, "reason": reason}
        await send(message)


sio_conn_gate = IpConnGate()
ws_conn_gate = IpConnGate()

__all__ = [
    "IpConnGate",
    "WsConnGuardMiddleware",
    "client_ip_from_container",
    "sio_conn_gate",
    "ws_conn_gate",
    "MAX_CONN_PER_IP",
    "HANDSHAKE_PER_WINDOW",
    "MAX_TRACKED_IPS",
    "UNKNOWN_IP",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

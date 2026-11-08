# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部 MCP 出站落点的 fail-closed 策略(AIS-053)。

原缺陷:任一登录用户都能把服务端指到任意地址,且注册/连接两侧只看 URL 字面量。
本模块把三件事收成一条判据链:

1. 默认 fail-closed:私网(RFC1918 / ULA)、回环、链路本地、云元数据地址
   (169.254.169.254 / 100.100.100.200 / fd00:ec2::254)一律拒绝,IPv4 与 IPv6 同尺。
   只有显式开关 `MCP_ALLOW_PRIVATE_ENDPOINTS`(默认关)才放行私网落点,
   供本地开发连 127.0.0.1:8803 这类第一方服务。
2. 判定点 = DNS 解析后的**实际 IP**:调用方拿到 `EndpointTarget` 后必须连接
   `target.ip`,而不是把 hostname 再交给连接层做第二次 DNS —— 校验期与连接期
   是两次解析,只校验 URL 字面量会被 DNS rebinding 换掉(短 TTL 交替返回公网/内网)。
3. 重定向:调用方不得跟随 3xx(`mcp_client` 的 SSE 用状态码直接失败,
   streamable-http 显式 `follow_redirects=False`)。逐跳复检在本仓不采用 ——
   多一条"跟随时再校验"的路径就多一处可能漏检的连接点。

`resolve_endpoint` 在解析失败、解析结果为空、或**任一** A/AAAA 记录落在黑名单时
一律拒绝:"某一跳看起来安全"不是放行理由。
"""

from __future__ import annotations

import ipaddress
import socket
import urllib.parse
from dataclasses import dataclass

from ..core.config import settings


class MCPEndpointRejected(Exception):
    """落点被策略拒绝(调用方负责转成 403 / 连接失败,不得吞成"稍后重试")。"""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


# 云元数据地址:三家主要云厂商 + AWS IPv6 元数据。显式列出,不依赖
# ipaddress 对保留段的覆盖(不同 Python 版本对保留段判定有差异)。
_BLOCKED_METADATA_IPS = frozenset(
    {
        ipaddress.ip_address("169.254.169.254"),  # AWS/GCP/Azure/OpenStack 元数据
        ipaddress.ip_address("100.100.100.200"),  # 阿里云元数据
        ipaddress.ip_address("fd00:ec2::254"),  # AWS IPv6 元数据
    }
)
# 100.64.0.0/10(运营商级 NAT / 云厂商内网地址段)不属于 RFC1918,
# 但同样是从公网不应直达的地址面(阿里云元数据 100.100.100.200 就在其中)。
_SHARED_ADDRESS_SPACE = ipaddress.ip_network("100.64.0.0/10")


def allow_private_endpoints() -> bool:
    """显式开关,默认关。`getattr` 兜底是为了让"字段还没配"也等于 False(fail-closed)。"""
    return bool(getattr(settings, "mcp_allow_private_endpoints", False))


def is_blocked_ip(ip: str) -> bool:
    """单个 IP 是否落在黑名单。无法解析的串按危险处理(fail-closed)。"""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    if addr in _BLOCKED_METADATA_IPS:
        return True
    if isinstance(addr, ipaddress.IPv4Address) and addr in _SHARED_ADDRESS_SPACE:
        return True
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        # ::ffff:127.0.0.1 这类 IPv4-mapped 形态必须按 IPv4 判据再看一遍。
        if is_blocked_ip(str(addr.ipv4_mapped)):
            return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_unspecified
        or addr.is_multicast
    )


@dataclass(frozen=True)
class EndpointTarget:
    """已校验的落点:连接层只准用 `ip`,原 `host` 仅用于 Host 头 / TLS SNI。"""

    ip: str
    host: str
    port: int
    scheme: str

    @property
    def host_header(self) -> str:
        host_part = f"[{self.host}]" if ":" in self.host else self.host
        default_port = 443 if self.scheme == "https" else 80
        if self.port == default_port:
            return host_part
        return f"{host_part}:{self.port}"

    def pin_url(self, url: str) -> str:
        """把 URL 的连接目标换成已校验的 IP,路径/查询原样保留。"""
        parsed = urllib.parse.urlparse(url)
        host_part = f"[{self.ip}]" if ":" in self.ip else self.ip
        default_port = 443 if self.scheme == "https" else 80
        netloc = host_part if self.port == default_port else f"{host_part}:{self.port}"
        return urllib.parse.urlunparse(parsed._replace(netloc=netloc))


def _resolve_host(host: str, port: int) -> list[str]:
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, OSError) as e:
        raise MCPEndpointRejected(f"DNS 解析失败: {host} ({e})") from e
    ips: list[str] = []
    for _family, _type, _proto, _canon, sockaddr in infos:
        ip = str(sockaddr[0])
        if ip not in ips:
            ips.append(ip)
    if not ips:
        raise MCPEndpointRejected(f"DNS 未返回任何地址: {host}")
    return ips


def resolve_endpoint(url: str, *, allow_private: bool | None = None) -> EndpointTarget:
    """解析并校验外部 MCP 落点;返回**已钉住 IP** 的连接目标。

    Raises:
        MCPEndpointRejected: 协议非 http(s)、host 缺失、端口非法、DNS 失败/无结果、
        或任一解析结果命中黑名单(开关未开启时)。
    """
    try:
        parsed = urllib.parse.urlparse((url or "").strip())
    except Exception as e:  # urlparse 对畸形串也可能抛,统一转成拒绝
        raise MCPEndpointRejected(f"URL 解析失败: {e}") from e
    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        raise MCPEndpointRejected(f"协议 {parsed.scheme!r} 不被允许(仅 http/https)")
    host = parsed.hostname
    if not host:
        raise MCPEndpointRejected("URL 缺少 hostname")
    try:
        port = parsed.port
    except ValueError as e:
        raise MCPEndpointRejected(f"URL 端口非法: {e}") from e
    if port is None:
        port = 443 if scheme == "https" else 80
    if not 1 <= port <= 65535:
        raise MCPEndpointRejected(f"URL 端口超出范围: {port}")

    try:
        ipaddress.ip_address(host)
        candidates = [host]
    except ValueError:
        candidates = _resolve_host(host, port)

    allow = allow_private_endpoints() if allow_private is None else allow_private
    if not allow:
        for ip in candidates:
            if is_blocked_ip(ip):
                raise MCPEndpointRejected(
                    f"目标 {host} 解析到受限地址 {ip}(私网/回环/链路本地/云元数据)"
                )
    return EndpointTarget(ip=candidates[0], host=host, port=port, scheme=scheme)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
"""F-187: ai-service 侧 api_base SSRF 二次校验（防 DNS rebinding）。

apps/api 侧已在 v1/v2 创建/更新链路对用户自定义 baseUrlOverride 过 ssrf-guard；
本模块在 ai-service 真正发起 litellm 调用前对 api_base 再做一次解析级校验，
防止「保存后 DNS 记录被改指内网/云元数据」的 rebinding，与 保存时校验 互为补充。

判定语义与同仓 apps/api/src/utils/ssrf-guard.ts、app/services/a2a_service.py 对齐：
私网 / 回环 / 链路本地 / 保留 / 组播 / 未指定 一律 fail-closed。
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


def _blocked_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip.split("%")[0])
    except ValueError:
        return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def is_safe_api_base(api_base: str) -> tuple[bool, str | None]:
    """返回 (是否安全, 不安全原因)。解析失败判不安全（fail-closed）。"""
    if not api_base:
        return True, None
    parsed = urlparse(api_base)
    if parsed.scheme not in ("http", "https"):
        return False, f"api_base scheme 必须是 http/https，实得 {parsed.scheme!r}"
    host = (parsed.hostname or "").lower()
    if not host:
        return False, "api_base 缺少 host"
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as e:
        return False, f"api_base host 解析失败: {e}"
    if not infos:
        return False, "api_base host 解析无结果"
    for info in infos:
        ip = info[4][0]
        if _blocked_ip(ip):
            return False, f"api_base 解析到受限地址 {ip}（私网/回环/云元数据）"
    return True, None

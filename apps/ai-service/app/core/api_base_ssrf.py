# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
    """把单个已解析地址判成"受限/不可判"。

    签名刻意保持 ``ip: str``(不收窄成 object):调用点的 isinstance 守卫因此被 mypy 当可达判据——
    守卫一旦被摘,``_blocked_ip(str | int)`` 立刻重新判红。写成 object 会让 T1 这把尺子
    从本调用面静默退场,只剩运行时行为,属"修红顺手削判据"。
    非字符串地址由调用方 fail-closed 拦截(见 is_safe_api_base)。
    """
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
        if not isinstance(ip, str):
            # 判据取不到可靠地址形态 ⇒ 未判定按不安全处理,且如实点名成因,不冒报成"解析到受限地址"。
            return False, f"api_base host 解析出非地址字符串形态 {ip!r}({type(ip).__name__}),无法判定 ⇒ 拒绝"
        if _blocked_ip(ip):
            return False, f"api_base 解析到受限地址 {ip}（私网/回环/云元数据）"
    return True, None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

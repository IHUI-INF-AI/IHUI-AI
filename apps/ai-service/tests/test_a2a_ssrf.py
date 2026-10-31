# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""A2A endpoint SSRF 校验单测(validate_a2a_endpoint)。

防 SSRF:拒绝私网/回环/链路本地/元数据/保留段地址,非本地必须用 https,
仅本地开发回环(http/https 皆可)放行。这是 R11 收口的 P1 修复的回归钉。
"""
from __future__ import annotations

import socket

import pytest

from app.services.a2a_service import validate_a2a_endpoint


@pytest.mark.parametrize(
    "ep",
    [
        "",
        "ftp://example.com",
        "javascript:alert(1)",
        "http://example.com",        # 非本地必须 https
        "http://169.254.169.254",    # 元数据地址(非本地 http)
        "https://10.0.0.1",          # 私网
        "https://192.168.1.1",       # 私网
        "https://169.254.169.254",   # 链路本地/元数据
        "https://[fe80::1]",         # 链路本地
        "https://0.0.0.0",           # unspecified(非 local_hosts 放行列表)
    ],
)
def test_validate_a2a_endpoint_rejects(ep: str):
    with pytest.raises(ValueError):
        validate_a2a_endpoint(ep)


@pytest.mark.parametrize(
    "ep",
    [
        "http://localhost",
        "http://127.0.0.1",
    ],
)
def test_validate_a2a_endpoint_allows_local(ep: str):
    assert validate_a2a_endpoint(ep) == ep.rstrip("/")


def test_validate_a2a_endpoint_allows_https_public(monkeypatch):
    """公网 https endpoint 必须放行(伪造解析为真实公网 IP,非私网/保留段,确定性)。"""
    def fake_getaddrinfo(host, port, **kw):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 0))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    assert validate_a2a_endpoint("https://agent.example.com") == "https://agent.example.com"

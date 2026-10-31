# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 10 批 R6 回归锁(2026-10-31)。

1. DNS rebinding TOCTOU:resolve_pinned_target 把 URL hostname 换成校验过的
   公网 IP(连接层零 DNS),Host/SNI 由调用方保持原域名 —— 校验期 getaddrinfo
   与真实请求期 httpx 二次解析可不一致(短 TTL 权威 DNS 交替返回公网/内网)
   曾可绕过全部首跳闸。
2. repo_wiki workspace_path 登记白名单:请求体用户可控路径此前可指向服务器
   任意目录(_inject_workspace_memory 读目标 CLAUDE.md/AGENTS.md 注入
   system prompt ⇒ 跨租户探测/注入面);现 fail-closed。
"""

from __future__ import annotations

import socket
from unittest.mock import patch

import pytest


class TestResolvePinnedTarget:
    def test_ip_literal_url_passthrough_shape(self):
        from app.services.screenshot_service import resolve_pinned_target

        r = resolve_pinned_target("https://93.184.216.34/a?b=c")
        assert r is not None
        pinned, host = r
        assert host == "93.184.216.34"
        assert pinned.startswith("https://93.184.216.34/")
        assert "b=c" in pinned

    def test_private_hostname_returns_none(self):
        """解析即内网(或解析失败)⇒ None(调用方拒绝)。"""
        from app.services.screenshot_service import resolve_pinned_target

        with patch(
            "app.services.screenshot_service.socket.getaddrinfo",
            side_effect=socket.gaierror(1, "no dns"),
        ):
            assert resolve_pinned_target("https://unresolvable.invalid/x") is None

    def test_all_private_results_return_none(self):
        from app.services.screenshot_service import resolve_pinned_target

        addr = [
            (2, 1, 6, "", ("10.0.0.5", 0)),
            (2, 1, 6, "", ("192.168.1.5", 0)),
        ]
        with patch("app.services.screenshot_service.socket.getaddrinfo", return_value=addr):
            assert resolve_pinned_target("https://rebind.evil/x") is None

    def test_public_ip_pinned_with_port_and_path(self):
        from app.services.screenshot_service import resolve_pinned_target

        addr = [(2, 1, 6, "", ("93.184.216.34", 0))]
        with patch("app.services.screenshot_service.socket.getaddrinfo", return_value=addr):
            r = resolve_pinned_target("https://cdn.example.com:8443/path/img.png")
        assert r is not None
        pinned, host = r
        assert pinned == "https://93.184.216.34:8443/path/img.png"
        assert host == "cdn.example.com"

    def test_download_safe_uses_pinned_ip_url(self):
        """_download_url_ssrf_safe 发出的请求 URL host 必须是解析 IP(非域名)。"""
        import httpx

        from app.services import mcp_server

        sent_urls: list[str] = []
        sent_headers: list[dict] = []

        class _Inner:
            def __init__(self, *a, **k) -> None:
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a) -> None:
                return None

            async def get(self, url, headers=None, extensions=None):
                sent_urls.append(url)
                sent_headers.append(headers or {})
                return httpx.Response(
                    200, content=b"ok", request=httpx.Request("GET", url)
                )

        class _FakeHttpx:
            AsyncClient = _Inner

        import app.services.screenshot_service as ss

        addr = [(2, 1, 6, "", ("93.184.216.34", 0))]
        with (
            patch("app.services.screenshot_service.socket.getaddrinfo", return_value=addr),
            patch.object(ss, "_validate_url_ssrf", lambda url: (True, "")),
        ):
            result = mcp_server.__dict__["_download_url_ssrf_safe"](
                "https://cdn.example.com/i.png", _FakeHttpx
            )
            # async 函数要真正执行
        import asyncio

        async def _run():
            with (
                patch(
                    "app.services.screenshot_service.socket.getaddrinfo",
                    return_value=addr,
                ),
                patch.object(ss, "_validate_url_ssrf", lambda url: (True, "")),
            ):
                return await mcp_server._download_url_ssrf_safe(
                    "https://cdn.example.com/i.png", _FakeHttpx
                )

        result = asyncio.run(_run())
        assert result == b"ok"
        assert sent_urls, "必须发出请求"
        assert sent_urls[0].startswith("https://93.184.216.34/"), (
            f"连接层必须钉 IP,实际: {sent_urls[0]}"
        )
        assert sent_headers[0].get("Host") == "cdn.example.com", "Host 头保持原域名"


class TestRepoWikiWorkspaceAllowlist:
    def test_unregistered_workspace_returns_none(self, monkeypatch):
        """登记根不含该路径 ⇒ None(不读目标目录任何文件)。"""
        from app.services import repo_wiki_engine

        monkeypatch.setattr(
            "app.services.mcp_server._get_workspace_roots",
            lambda: ["D:/IHUI-AI"],
            raising=False,
        )
        import asyncio

        # workspacePath 指向登记根外 ⇒ 白名单直接拒绝(不读目标目录任何文件)
        result = asyncio.run(
            repo_wiki_engine.ensure_wiki("C:/Windows/Temp/some-repo", "ns-test")
        )
        assert result is None

    def test_empty_roots_fails_closed(self, monkeypatch):
        import asyncio

        from app.services import repo_wiki_engine

        monkeypatch.setattr(
            "app.services.mcp_server._get_workspace_roots",
            lambda: [],
            raising=False,
        )
        # 该路径存在与否不影响:登记为空一律拒绝
        result = asyncio.run(repo_wiki_engine.ensure_wiki("C:/Windows/Temp", "ns-empty"))
        assert result is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

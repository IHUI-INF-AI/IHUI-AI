# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 10 批 R3 回归锁(2026-10-31)。

钉住重定向绕过 SSRF 的三处修复:
1. media_tasks 代理三端点(download/stream/image)手动逐跳 —— 每一跳(含 302
   落点)都重新过 _validate_url_ssrf。修复前 follow_redirects=True 只看首跳,
   公网页 302 → http://169.254.169.254/ 即整条 SSRF。
2. mcp_server 三处 URL 下载统一走 _download_url_ssrf_safe 单源(逐跳复检),
   _resolve_image_source_bytes 此前连首跳校验都没有。
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest
from fastapi import HTTPException


def _redirect_response(location: str, base: str = "https://public.example/a") -> httpx.Response:
    return httpx.Response(
        302,
        headers={"location": location},
        request=httpx.Request("GET", base),
    )


# =============================================================================
# ① media_tasks 代理逐跳复检
# =============================================================================


class TestProxyFollowingRedirects:
    @pytest.mark.asyncio
    async def test_redirect_to_metadata_rejected_mid_hops(self):
        """公网首跳 302 → 169.254.169.254:落点必须被拒,请求绝不发往元数据地址。"""
        from app.routers.media_tasks import _send_following_redirects

        sent: list[str] = []

        class _FakeClient:
            def build_request(self, method: str, url: str, headers: dict | None = None) -> tuple:
                return (method, url)

            async def send(self, req: tuple) -> httpx.Response:
                url = req[1]
                sent.append(url)
                if url.startswith("https://public.example"):
                    return _redirect_response("http://169.254.169.254/latest/meta-data/", url)
                return httpx.Response(200, request=httpx.Request("GET", url))

        with pytest.raises(HTTPException) as exc:
            await _send_following_redirects(_FakeClient(), "https://public.example/a")  # type: ignore[arg-type]

        assert exc.value.status_code == 400
        assert not any("169.254" in u for u in sent), "落点请求不得发出"

    @pytest.mark.asyncio
    async def test_first_hop_private_rejected(self):
        from app.routers.media_tasks import _send_following_redirects

        class _FakeClient:
            def build_request(self, method: str, url: str, headers: dict | None = None) -> tuple:
                return (method, url)

            async def send(self, req: tuple) -> httpx.Response:
                raise AssertionError("首跳即被禁,请求不得发出")

        with pytest.raises(HTTPException) as exc:
            await _send_following_redirects(_FakeClient(), "http://127.0.0.1:8801/x")  # type: ignore[arg-type]

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_safe_chain_allows_and_returns_final(self, monkeypatch):
        """正向对照:全部安全跳正常返回最终响应(闸不削合法能力)。

        _validate_url_ssrf 做真实 DNS(example 域解析不了),此处 mock 尺本体,
        并断言**每一跳都被问过**(首跳 + 落点各一次,防"只问一次"的退化)。"""
        from unittest.mock import patch

        import app.routers.media_tasks as mt
        import app.services.screenshot_service as ss_mod

        asked: list[str] = []

        def _fake_validate(url: str) -> tuple[bool, str]:
            asked.append(url)
            return (True, "")

        class _FakeClient:
            def build_request(self, method: str, url: str, headers: dict | None = None) -> tuple:
                return (method, url)

            async def send(self, req: tuple) -> httpx.Response:
                url = req[1]
                # 钉 IP 后连接 URL 的 host 是解析 IP(非域名),按路径判跳
                if url.endswith("/a"):
                    return _redirect_response("https://public.example/b", url)
                return httpx.Response(200, text="ok", request=httpx.Request("GET", url))

        public_addr = [(2, 1, 6, "", ("93.184.216.34", 0))]
        with (
            patch.object(mt, "_validate_url_ssrf", side_effect=_fake_validate),
            # 2026-10-31 R6 起 helper 每跳还要 resolve_pinned_target(钉 IP),
            # 真实 DNS 解析不了 example 域 ⇒ mock 之
            patch.object(ss_mod.socket, "getaddrinfo", return_value=public_addr),
        ):
            resp = await mt._send_following_redirects(_FakeClient(), "https://public.example/a")  # type: ignore[arg-type]

        assert resp.status_code == 200
        assert asked == ["https://public.example/a", "https://public.example/b"]


# =============================================================================
# ② mcp_server URL 下载单源
# =============================================================================


class TestDownloadUrlSsrfSafe:
    @pytest.mark.asyncio
    async def test_redirect_bypass_blocked(self):
        from app.services.mcp_server import _download_url_ssrf_safe

        sent: list[str] = []

        class _Inner:
            def __init__(self, *a: Any, **k: Any) -> None:
                pass

            async def __aenter__(self) -> "_Inner":
                return self

            async def __aexit__(self, *a: Any) -> None:
                return None

            async def get(self, url: str) -> httpx.Response:
                sent.append(url)
                # 钉 IP 后连接 URL 的 host 是解析 IP(非域名),按路径判跳
                if url.endswith("/img.png"):
                    return _redirect_response("http://10.0.0.5/internal", url)
                return httpx.Response(200, content=b"secret", request=httpx.Request("GET", url))

        class _FakeHttpx:
            AsyncClient = _Inner

        result = await _download_url_ssrf_safe("https://public.example/img.png", _FakeHttpx)
        assert result is None, "SSRF 落点必须整条失败"
        assert not any("10.0.0.5" in u for u in sent)

    @pytest.mark.asyncio
    async def test_first_hop_private_blocked(self):
        from app.services.mcp_server import _download_url_ssrf_safe

        class _NeverClient:
            def __init__(self, *a: Any, **k: Any) -> None:
                pass

            async def __aenter__(self) -> "_NeverClient":
                return self

            async def __aexit__(self, *a: Any) -> None:
                return None

            async def get(self, url: str) -> httpx.Response:
                raise AssertionError("首跳被禁,请求不得发出")

        result = await _download_url_ssrf_safe("http://169.254.169.254/x", _NeverClient)
        assert result is None

    @pytest.mark.asyncio
    async def test_safe_url_downloads(self, monkeypatch):
        from unittest.mock import patch

        import app.services.mcp_server as ms
        from app.services.mcp_server import _download_url_ssrf_safe

        class _Inner:
            def __init__(self, *a: Any, **k: Any) -> None:
                pass

            async def __aenter__(self) -> "_Inner":
                return self

            async def __aexit__(self, *a: Any) -> None:
                return None

            async def get(self, url: str, headers=None, extensions=None) -> httpx.Response:
                # helper 钉 IP 后会带 Host 头与 sni_hostname extensions
                return httpx.Response(200, content=b"png-bytes", request=httpx.Request("GET", url))

        class _FakeHttpx:
            AsyncClient = _Inner

        # SSRF 尺 mock 成全放(example 域真实 DNS 解析不了;拒绝路径由
        # test_redirect_bypass_blocked / test_first_hop_private_blocked 反向覆盖)。
        # helper 内是延迟 import from .screenshot_service ⇒ patch 其模块属性即生效。
        # 2026-10-31 R6 起 helper 还要 resolve_pinned_target(钉 IP)⇒ getaddrinfo 同 mock。
        import app.services.screenshot_service as ss

        public_addr = [(2, 1, 6, "", ("93.184.216.34", 0))]
        with (
            patch.object(ss, "_validate_url_ssrf", lambda url: (True, "")),
            patch.object(ss.socket, "getaddrinfo", return_value=public_addr),
        ):
            result = await _download_url_ssrf_safe("https://cdn.example/i.png", _FakeHttpx)

        assert result == b"png-bytes"

    @pytest.mark.asyncio
    async def test_resolve_image_source_url_goes_through_ssrf(self):
        """_resolve_image_source_bytes 的 URL 分支此前零校验,现必须走单源。"""
        from app.services import mcp_server

        called: list[str] = []

        async def _fake_download(url: str, httpx_mod: Any, **kwargs: Any) -> bytes | None:
            called.append(url)
            return b"img"

        with __import__("unittest").mock.patch.object(
            mcp_server, "_download_url_ssrf_safe", side_effect=_fake_download
        ):
            raw, err = await mcp_server._resolve_image_source_bytes("https://cdn.example/i.png")

        assert called == ["https://cdn.example/i.png"], "URL 分支必须经单源"
        assert err is None
        assert raw == b"img"

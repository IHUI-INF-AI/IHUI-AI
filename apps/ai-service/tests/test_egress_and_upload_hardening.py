# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""出网面与匿名上传面的硬化接线锁(2026-11-01 安全强化批次)。

三格各对应一类真实可利用缺陷:
1. `/api/voice/stt` 在 JWT_PUBLIC_PATHS 里(匿名可调)且原先 `await file.read()` 无上限
   ⇒ 不登录就能用一枚大 multipart 把内存吃光,还每次都排进本地 CPU 推理队列;
2. MCP 外部服务器的 url 此前只判非空,SSE 传输直接 `asyncio.open_connection(host, port)`
   ⇒ 仓内 SSRF 判据结构上覆盖不到子进程级外连,元数据地址/回环管理端口都在射程;
3. 匿名重 CPU 端点不在任何限流规则内。
反向牙:摘掉上限读取/摘掉校验调用/摘掉限流条目,对应用例即红。
"""

from __future__ import annotations

import inspect
from pathlib import Path

from app.middleware.input_sanitizer import RATE_RULES
from app.routers import mcp as mcp_router
from app.routers import voice_stt
from app.services import mcp_client
from app.services.screenshot_service import _validate_url_ssrf


class _ChunkedUpload:
    """按 UploadFile 的形状分块产出(测的是"边读边断",不是"读完再量")。"""

    def __init__(self, total_bytes: int, chunk: int = 1024 * 1024) -> None:
        self._remaining = total_bytes
        self._chunk = chunk
        self.read_calls = 0

    async def read(self, size: int = -1) -> bytes:
        self.read_calls += 1
        if self._remaining <= 0:
            return b""
        take = min(self._chunk, size if size and size > 0 else self._chunk, self._remaining)
        self._remaining -= take
        return b"a" * take


async def test_read_capped_passes_under_limit() -> None:
    upload = _ChunkedUpload(3 * 1024 * 1024)
    data = await voice_stt._read_capped(upload, voice_stt.MAX_STT_UPLOAD_BYTES)
    assert data is not None
    assert len(data) == 3 * 1024 * 1024


async def test_read_capped_stops_at_limit_without_reading_the_whole_body() -> None:
    """超限必须在**读到上限那一块**就断,而不是把 2GB 收完再判长度。"""
    limit = 5 * 1024 * 1024
    upload = _ChunkedUpload(200 * 1024 * 1024)
    data = await voice_stt._read_capped(upload, limit)
    assert data is None
    # 200MB / 1MB 块 = 200 次读;真超限即断的话只会读个位数次
    assert upload.read_calls <= (limit // (1024 * 1024)) + 2, (
        f"读到 {upload.read_calls} 次才停 —— 峰值占用没有被限住"
    )


def test_stt_endpoint_uses_the_capped_reader() -> None:
    """形状锁:端点里不得再出现无上限的 `await file.read()`。"""
    src = Path(voice_stt.__file__).read_text(encoding="utf-8")
    assert "_read_capped(file" in src
    assert "audio_bytes = await file.read()" not in src
    # 超限那条 raise 路径要的符号必须真的 import 了 —— mypy 的 --ignore-missing-imports
    # 曾把"模块里用了没导入的名字"洗成类型噪声(本仓 Python 侧的已知失效型)。
    assert "HTTPException" in inspect.getsource(voice_stt)[: 2000]
    assert "status_code=413" in src


def test_anonymous_heavy_endpoints_are_rate_limited() -> None:
    voice_rules = [r for r in RATE_RULES if r[0] == "/api/voice/"]
    assert voice_rules, "/api/voice/* 不在任何限流规则内(匿名 CPU 推理 = 可被打满)"
    _prefix, requests, window = voice_rules[0]
    assert 1 <= requests <= 60, f"限流量级不合理:{requests}/{window}s"
    assert window > 0


def test_mcp_url_transport_requires_admin_and_endpoint_policy() -> None:
    """AIS-053:远程 MCP 注册权收归 admin,落点按 DNS 解析后的真实 IP 判定。

    更早的反向牙(`test_sse_register_untouched_by_stdio_gate`)钉的是"普通用户可注册
    远程 MCP";AIS-053 的结论是"只封地址不封人没有意义",故契约翻面:
      · 角色闸覆盖两种 transport(非管理员一律 403 ROLE_DENIED);
      · 落点必须过 mcp_endpoint_policy(默认 fail-closed,私网/回环/链路本地/云元数据全拒);
      · 注册期校验 + 连接期复检,重定向不跟随。
    行为侧由 tests/test_ais053_mcp_endpoint_policy.py 与
    tests/test_mcp_stdio_registration_gates.py 的用例覆盖。
    """
    src = inspect.getsource(mcp_router)
    assert "ROLE_DENIED" in src, "非管理员注册的角色闸被摘掉了"
    assert "resolve_mcp_endpoint(req.url.strip())" in src, "注册期落点校验被摘掉了"
    assert "ENDPOINT_BLOCKED" in src


def test_mcp_client_connect_site_uses_endpoint_policy() -> None:
    """连接点必须走 `mcp_endpoint_policy`:判定在解析后的真实 IP 上,重定向不跟随。

    刻意仍**不**套 screenshot 的 `_validate_url_ssrf`(那把尺子的端口封闭表会打死
    第一方内网 MCP)。"内网落点是否放行"改由显式开关 MCP_ALLOW_PRIVATE_ENDPOINTS
    控制(默认关),不再靠连接点自己放宽。
    """
    src = Path(mcp_client.__file__).read_text(encoding="utf-8")
    assert "resolve_endpoint(self._config.url)" in src, "连接点未接落点策略"
    assert "asyncio.open_connection(target.ip, target.port" in src, (
        "连接目标没有钉到已校验 IP ⇒ 校验期与连接期仍可能被 DNS rebinding 换掉"
    )
    assert "follow_redirects=False" in src, "streamable-http 又允许跟随重定向了"
    assert "_validate_url_ssrf(" not in src, (
        "连接侧又套上了 SSRF 端口表 —— 会打死第一方内网 MCP;放行改由显式开关控制。"
    )


def test_shared_ssrf_judge_rejects_metadata_and_loopback_literals() -> None:
    """复用的那把尺子必须真能挡(不是"看起来接了")。"""
    for url in (
        "http://169.254.169.254/latest/meta-data/iam/",
        "http://127.0.0.1:8830/admin",
        "http://[::1]:8802/api",
    ):
        ok, reason = _validate_url_ssrf(url)
        assert ok is False, f"{url} 本该被拒"
        assert reason
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""app/routers/voice_tts.py 单元测试:edge-tts 单引擎 + 已下线入口的明确不可用。

当前供应商口径(2026-11-26):TTS 仅 edge-tts;声纹克隆/异步 TTS/第三方 TTS 供应商
均已下线,对应入口保留但统一返回 503 或 400,不得静默改走其他厂商。
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.routers import voice_tts


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch, request):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径。"""
    if request.node.get_closest_marker("real_jwt") is not None:
        return
    from app.core.config import settings

    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


def _fake_edge(monkeypatch):
    import sys

    class _FakeCommunicate:
        def __init__(self, text, voice=None, rate=None):
            pass

        async def stream(self):
            yield {"type": "audio", "data": b"ID3fake"}

    fake_mod = MagicMock()
    fake_mod.Communicate = _FakeCommunicate
    monkeypatch.setitem(sys.modules, "edge_tts", fake_mod)


class TestTtsEdgeEngine:
    """engine=edge(默认)走 edge-tts,monkeypatch edge_tts 不触网。"""

    async def test_default_engine_edge_returns_audio(self, client, monkeypatch):
        _fake_edge(monkeypatch)
        resp = await client.post("/api/voice/tts", json={"text": "你好"})
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("audio/mpeg")
        assert resp.headers["x-tts-engine"] == "edge-tts"
        assert resp.content == b"ID3fake"

    async def test_voice_not_in_whitelist_rejected(self, client):
        resp = await client.post("/api/voice/tts", json={"text": "你好", "voice": "random-voice"})
        assert resp.status_code == 400

    async def test_unknown_engine_rejected(self, client):
        resp = await client.post("/api/voice/tts", json={"text": "你好", "engine": "azure"})
        assert resp.status_code == 400
        assert "仅支持 edge" in resp.json()["detail"]


class TestDisabledSuppliers:
    """已下线供应商入口:保留路由,明确 503/400,不改走其他厂商。"""

    async def test_voice_library_list_503(self, client):
        resp = await client.get("/api/voice/voices")
        assert resp.status_code == 503
        assert "下线" in resp.json()["detail"]

    async def test_voice_library_upload_503(self, client):
        resp = await client.post(
            "/api/voice/voices",
            files={"file": ("ref.wav", b"RIFF-fake-audio", "audio/wav")},
        )
        assert resp.status_code == 503
        assert "下线" in resp.json()["detail"]

    async def test_voice_delete_guard_first(self, client):
        """删除入口先过 admin 守卫(非管理员 403),管理员才看到下线提示。"""
        resp = await client.delete("/api/voice/voices/v-1")
        assert resp.status_code == 403
        assert "管理员" in resp.json()["detail"]

    async def test_async_tts_task_503(self, client):
        resp = await client.get("/api/voice/tts-async/t-1")
        assert resp.status_code == 503
        assert "下线" in resp.json()["detail"]


def _enable_real_jwt(monkeypatch, secret: str = "test-secret-voice-tts-092") -> str:
    from app.core.config import settings

    monkeypatch.setattr(settings, "jwt_secret", secret)
    monkeypatch.setattr(settings, "ai_dev_no_auth", False)
    return secret


def _access_token(secret: str, sub: str = "user-1") -> str:
    import time

    import jwt

    from app.core.config import settings

    return jwt.encode(
        {
            "sub": sub,
            "type": "access",
            "roleId": 0,
            "aud": "ihui-ai-users",
            "iss": settings.jwt_issuer,
            "exp": int(time.time()) + 300,
        },
        secret,
        algorithm="HS256",
    )


def test_voice_tts_not_in_default_jwt_public_paths() -> None:
    from app.core.config import Settings

    raw = Settings(_env_file=None).jwt_public_paths
    entries = tuple(p.strip() for p in raw.split(",") if p.strip())
    assert "/api/voice/tts" not in entries
    assert "/api/voice/stt" in entries


@pytest.mark.real_jwt
class TestVoiceTtsAuthz:
    async def test_unauthenticated_tts_is_401(self, client, monkeypatch):
        _enable_real_jwt(monkeypatch)
        resp = await client.post("/api/voice/tts", json={"text": "你好"})
        assert resp.status_code == 401

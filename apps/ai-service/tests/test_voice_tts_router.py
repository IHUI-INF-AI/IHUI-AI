# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""app/routers/voice_tts.py 单元测试:TTS 双引擎 + 声纹库端点。

2026-09-08 修复回归:token6688 分支曾引用未定义的 _tts_via_token6688 且
TTSRequest 缺 engine 字段(所有请求 AttributeError),本测试守门防再断链。
测试覆盖:
- POST /api/voice/tts engine=edge(默认):200 audio/mpeg,monkeypatch edge_tts
- POST /api/voice/tts engine=token6688:调用 provider.tts 返回音频
- POST /api/voice/tts engine=token6688 未配 key:503 如实提示
- POST /api/voice/tts engine=token6688 provider 失败:502
- POST /api/voice/tts 未知 engine:400
- GET /api/voice/voices:声纹列表 / 未配 key 503
- POST /api/voice/voices:multipart 上传参考音频 / 空文件 400

测试隔离:monkeypatch voice_tts 模块内 provider 工厂,不触网。
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.routers import voice_tts


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch, request):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径。

    real_jwt 用例(真实验签/401 断言)自行钉死密钥,不走本放行档。
    """
    if request.node.get_closest_marker("real_jwt") is not None:
        return
    from app.core.config import settings

    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


def _fake_provider(
    monkeypatch, *, api_key="sk-test", tts=None, voices=None, upload=None, delete=None
):
    """替换 _token6688_provider 工厂,返回可控 provider mock。"""
    p = MagicMock()
    p.api_key = api_key
    if tts is not None:
        p.tts = AsyncMock(return_value=tts)
    p.list_voices = AsyncMock(return_value=voices if voices is not None else [])
    if upload is not None:
        p.upload_voice = AsyncMock(return_value=upload)
    if delete is not None:
        p.delete_voice = AsyncMock(return_value=delete)
    monkeypatch.setattr(voice_tts, "_token6688_provider", lambda: p)
    return p


def _no_key_provider(monkeypatch):
    """未配 key 场景:_token6688_provider 抛 503(与真实工厂行为一致)。"""
    from fastapi import HTTPException

    def _raise():
        raise HTTPException(status_code=503, detail="token6688 未配置")

    monkeypatch.setattr(voice_tts, "_token6688_provider", _raise)


class TestTtsEdgeEngine:
    """engine=edge(默认)走 edge-tts,monkeypatch edge_tts 不触网。"""

    async def test_default_engine_edge_returns_audio(self, client, monkeypatch):
        class _FakeCommunicate:
            def __init__(self, text, voice=None, rate=None):
                pass

            async def stream(self):
                yield {"type": "audio", "data": b"ID3fake"}
                yield {"type": "WordBoundary", "data": None}

        import sys

        fake_mod = MagicMock()
        fake_mod.Communicate = _FakeCommunicate
        monkeypatch.setitem(sys.modules, "edge_tts", fake_mod)

        resp = await client.post("/api/voice/tts", json={"text": "你好"})
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("audio/mpeg")
        assert resp.headers["x-tts-engine"] == "edge-tts"
        assert resp.content == b"ID3fake"

    async def test_voice_not_in_whitelist_rejected(self, client):
        resp = await client.post("/api/voice/tts", json={"text": "你好", "voice": "random-voice"})
        assert resp.status_code == 400


class TestTtsToken6688Engine:
    """engine=token6688 走网关 /v1/audio/speech。"""

    async def test_success_returns_audio(self, client, monkeypatch):
        _fake_provider(monkeypatch, tts=(b"ID3gateway-audio", "audio/mpeg"))
        resp = await client.post(
            "/api/voice/tts", json={"text": "你好", "engine": "token6688", "voice": "alloy"},
        )
        assert resp.status_code == 200
        assert resp.headers["x-tts-engine"] == "token6688"
        assert resp.content == b"ID3gateway-audio"

    async def test_missing_key_returns_503(self, client, monkeypatch):
        _no_key_provider(monkeypatch)
        resp = await client.post(
            "/api/voice/tts", json={"text": "你好", "engine": "token6688"},
        )
        assert resp.status_code == 503
        assert "未配置" in resp.json()["detail"]

    async def test_provider_failure_returns_502(self, client, monkeypatch):
        from app.providers.base_provider import ProviderError

        p = _fake_provider(monkeypatch)
        p.tts = AsyncMock(side_effect=ProviderError("quota exceeded", 402))
        resp = await client.post(
            "/api/voice/tts", json={"text": "你好", "engine": "token6688", "voice": "alloy"},
        )
        assert resp.status_code == 502
        assert "quota" in resp.json()["detail"]

    async def test_unknown_engine_rejected(self, client):
        resp = await client.post("/api/voice/tts", json={"text": "你好", "engine": "azure"})
        assert resp.status_code == 400
        assert "未知 engine" in resp.json()["detail"]


class TestVoiceLibrary:
    """声纹库端点(voice-clone 工作流前置)。"""

    async def test_list_voices_success(self, client, monkeypatch):
        _fake_provider(monkeypatch, voices=[{"voice_id": "v1", "name": "我的声纹"}])
        resp = await client.get("/api/voice/voices")
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert body["voices"][0]["voice_id"] == "v1"

    async def test_list_voices_missing_key_503(self, client, monkeypatch):
        _no_key_provider(monkeypatch)
        resp = await client.get("/api/voice/voices")
        assert resp.status_code == 503

    async def test_upload_voice_success(self, client, monkeypatch):
        _fake_provider(monkeypatch, upload={"voice_id": "v9", "status": "completed"})
        resp = await client.post(
            "/api/voice/voices",
            files={"file": ("ref.wav", b"RIFF-fake-audio", "audio/wav")},
        )
        assert resp.status_code == 200
        assert resp.json()["voice_id"] == "v9"

    async def test_upload_voice_empty_file_400(self, client, monkeypatch):
        _fake_provider(monkeypatch, upload={})
        resp = await client.post(
            "/api/voice/voices",
            files={"file": ("ref.wav", b"", "audio/wav")},
        )
        assert resp.status_code == 400


class TestVoiceDeleteAdminGuard:
    """DELETE /voice/voices/{voice_id} 仅限 admin(roleId>=1)(2026-09-09 P1)。

    声纹库是平台共享资源(单一 token6688 账号,无归属概念),删除影响所有用户。
    JWT 旁路测试环境下 request.state.role_id 未注入 → getattr 默认 0 → 403;
    admin 通道用 dependency_overrides 注入(monkeypatch.setitem 自动回滚)。
    """

    async def test_delete_forbidden_for_non_admin(self, client):
        resp = await client.delete("/api/voice/voices/v-1")
        assert resp.status_code == 403
        assert "管理员" in resp.json()["detail"]

    async def test_delete_allowed_for_admin(self, client, monkeypatch):
        # app.main.app 是 socketio.ASGIApp 包装,真正的 FastAPI 实例是 fastapi_app
        from app.main import fastapi_app

        p = _fake_provider(monkeypatch, delete={"ok": True})
        monkeypatch.setitem(
            fastapi_app.dependency_overrides, voice_tts._require_admin, lambda: None
        )
        resp = await client.delete("/api/voice/voices/v-1")
        assert resp.status_code == 200
        p.delete_voice.assert_awaited_once_with("v-1")


# ---------------------------------------------------------------------------
# AIS-092(2026-11-08):匿名可达的付费 TTS 收权 + token6688 voice 白名单
# ---------------------------------------------------------------------------


def _enable_real_jwt(monkeypatch, secret: str = "test-secret-voice-tts-092") -> str:
    """real_jwt 用例自行钉死密钥并关掉开发放行档(conftest/本文件夹具均已跳过)。"""
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
    """根因 1:默认公开白名单不得再含 /api/voice/tts,且不得误伤 /api/voice/stt。"""
    from app.core.config import Settings

    raw = Settings(_env_file=None).jwt_public_paths
    entries = tuple(p.strip() for p in raw.split(",") if p.strip())
    assert "/api/voice/tts" not in entries
    assert "/api/voice/stt" in entries


@pytest.mark.real_jwt
class TestVoiceTtsAuthzAis092:
    """a–d 安全验证:匿名 401 / 非白名单 voice 拒绝且不落合成 / 白名单与在册声纹放行 / edge 不变。"""

    async def test_a_unauthenticated_tts_is_401(self, client, monkeypatch):
        _enable_real_jwt(monkeypatch)
        resp = await client.post(
            "/api/voice/tts",
            json={"text": "你好", "engine": "token6688", "voice": "alloy"},
        )
        assert resp.status_code == 401
        assert resp.json()["message"] == "Authentication required"

    async def test_b_authenticated_non_whitelist_voice_rejected(self, client, monkeypatch):
        secret = _enable_real_jwt(monkeypatch)
        calls = AsyncMock()
        monkeypatch.setattr(voice_tts, "_tts_via_token6688", calls)
        _fake_provider(monkeypatch, tts=(b"should-not-be-used", "audio/mpeg"), voices=[])
        resp = await client.post(
            "/api/voice/tts",
            json={"text": "你好", "engine": "token6688", "voice": "voice_attacker_pick"},
            headers={"Authorization": f"Bearer {_access_token(secret)}"},
        )
        assert resp.status_code == 403
        assert "白名单" in resp.json()["detail"]
        calls.assert_not_awaited()

    async def test_c_authenticated_official_voice_succeeds(self, client, monkeypatch):
        secret = _enable_real_jwt(monkeypatch)
        upstream = AsyncMock(return_value=(b"ID3paid-ok", "audio/mpeg"))
        monkeypatch.setattr(voice_tts, "_tts_via_token6688", upstream)
        resp = await client.post(
            "/api/voice/tts",
            json={"text": "你好", "engine": "token6688", "voice": "alloy"},
            headers={"Authorization": f"Bearer {_access_token(secret)}"},
        )
        assert resp.status_code == 200
        assert resp.headers["x-tts-engine"] == "token6688"
        assert resp.content == b"ID3paid-ok"
        upstream.assert_awaited_once_with("你好", "alloy")

    async def test_c2_authenticated_cloned_voice_in_library_succeeds(self, client, monkeypatch):
        """防误挡:平台声纹库在册 voice_id 仍可合成(与 GET /voice/voices 同一数据源)。"""
        secret = _enable_real_jwt(monkeypatch)
        _fake_provider(monkeypatch, voices=[{"voice_id": "voice_mine_1"}])
        upstream = AsyncMock(return_value=(b"ID3clone-ok", "audio/mpeg"))
        monkeypatch.setattr(voice_tts, "_tts_via_token6688", upstream)
        resp = await client.post(
            "/api/voice/tts",
            json={"text": "你好", "engine": "token6688", "voice": "voice_mine_1"},
            headers={"Authorization": f"Bearer {_access_token(secret)}"},
        )
        assert resp.status_code == 200
        assert resp.content == b"ID3clone-ok"

    async def test_d_authenticated_edge_engine_unchanged(self, client, monkeypatch):
        secret = _enable_real_jwt(monkeypatch)
        import sys

        class _FakeCommunicate:
            def __init__(self, text, voice=None, rate=None):
                pass

            async def stream(self):
                yield {"type": "audio", "data": b"ID3edge-free"}

        fake_mod = MagicMock()
        fake_mod.Communicate = _FakeCommunicate
        monkeypatch.setitem(sys.modules, "edge_tts", fake_mod)
        resp = await client.post(
            "/api/voice/tts",
            json={"text": "你好", "engine": "edge", "voice": "zh-CN-XiaoxiaoNeural"},
            headers={"Authorization": f"Bearer {_access_token(secret)}"},
        )
        assert resp.status_code == 200
        assert resp.headers["x-tts-engine"] == "edge-tts"
        assert resp.content == b"ID3edge-free"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

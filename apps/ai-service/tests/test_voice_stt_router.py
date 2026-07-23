"""app/routers/voice_stt.py 单元测试:STT 转写端点 + 工具函数全覆盖。

测试覆盖:
- POST /api/voice/stt stub 模式:无 API key → 返回模拟文本 + stub=True
- POST /api/voice/stt 真实模式:litellm.atranscription 成功 / ImportError / 异常降级
- POST /api/voice/stt 边界:空音频 → 空文本 / language 参数透传
- _get_suffix():正常扩展名 / 无扩展名 / 超长扩展名 / 非字母数字扩展名

测试隔离:用 monkeypatch 替换 llm_gateway._is_stub_mode / litellm.atranscription,不调真实 API。
"""
from __future__ import annotations

import io
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.routers import voice_stt
from app.core.llm_gateway import llm_gateway


# =============================================================================
# 辅助 fixtures
# =============================================================================


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径(node_env=development)。

    .env 中配置了真实 jwt_secret,JWTAuthMiddleware 会验证 token,测试无 token → 401。
    清空 jwt_secret + node_env=development 后,middleware 直接放行。
    """
    from app.core.config import settings
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


@pytest.fixture
def stub_mode(monkeypatch):
    """强制 llm_gateway._is_stub_mode() 返回 True(stub 模式)。"""
    monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: True)


@pytest.fixture
def real_mode(monkeypatch):
    """强制 llm_gateway._is_stub_mode() 返回 False(真实模式)。"""
    monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: False)


def _make_audio_file(content: bytes = b"fake audio data", filename: str = "test.wav"):
    """构造 UploadFile 兼容对象(用 io.BytesIO 包装)。"""
    from fastapi import UploadFile
    file = UploadFile(filename=filename, file=io.BytesIO(content))
    return file


# =============================================================================
# POST /api/voice/stt — stub 模式
# =============================================================================


class TestVoiceSttStubMode:
    """测试 stub 模式下的 STT 端点(无 API key)。"""

    async def test_returns_stub_text_in_stub_mode(self, client, stub_mode):
        # stub 模式 → 返回含 [stub] 前缀的模拟文本
        files = {"file": ("test.wav", b"audio bytes", "audio/wav")}
        resp = await client.post("/api/voice/stt", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["stub"] is True
        assert data["model"] == "whisper-1"
        assert "[stub]" in data["text"]
        assert "audio bytes" in data["text"] or "字节" in data["text"]

    async def test_includes_language_hint_when_provided(self, client, stub_mode):
        # 带 language 参数 → stub 文本含 language 提示
        files = {"file": ("test.mp3", b"audio", "audio/mpeg")}
        resp = await client.post(
            "/api/voice/stt",
            files=files,
            data={"language": "zh"},
        )
        assert resp.status_code == 200
        text = resp.json()["text"]
        assert "language=zh" in text

    async def test_omits_language_hint_when_not_provided(self, client, stub_mode):
        # 不带 language → stub 文本不含 language 提示
        files = {"file": ("test.wav", b"audio", "audio/wav")}
        resp = await client.post("/api/voice/stt", files=files)
        text = resp.json()["text"]
        assert "language=" not in text

    async def test_empty_audio_returns_empty_text(self, client, stub_mode):
        # 空音频(0 字节)→ 返回空文本 + stub=True(短路逻辑)
        files = {"file": ("empty.wav", b"", "audio/wav")}
        resp = await client.post("/api/voice/stt", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["text"] == ""
        assert data["stub"] is True
        assert data["model"] == "whisper-1"


# =============================================================================
# POST /api/voice/stt — 真实模式
# =============================================================================


class TestVoiceSttRealMode:
    """测试真实模式下的 STT 端点(调用 litellm.atranscription)。"""

    async def test_returns_text_on_successful_transcription(self, client, real_mode, monkeypatch):
        # litellm.atranscription 成功 → 返回转写文本 + stub=False
        fake_response = MagicMock()
        fake_response.text = "你好世界"

        import sys
        import types
        fake_litellm_mod = types.ModuleType("litellm")
        fake_litellm_mod.atranscription = AsyncMock(return_value=fake_response)
        sys.modules["litellm"] = fake_litellm_mod

        try:
            files = {"file": ("test.wav", b"audio bytes", "audio/wav")}
            resp = await client.post("/api/voice/stt", files=files)
            assert resp.status_code == 200
            data = resp.json()
            assert data["stub"] is False
            assert data["text"] == "你好世界"
            assert data["model"] == "whisper-1"
        finally:
            sys.modules.pop("litellm", None)

    async def test_returns_text_with_language_param(self, client, real_mode, monkeypatch):
        # 带 language 参数 → 透传到 litellm.atranscription
        fake_response = MagicMock()
        fake_response.text = "hello"

        import sys
        import types
        fake_litellm_mod = types.ModuleType("litellm")
        fake_litellm_mod.atranscription = AsyncMock(return_value=fake_response)
        sys.modules["litellm"] = fake_litellm_mod

        try:
            files = {"file": ("test.wav", b"audio", "audio/wav")}
            resp = await client.post(
                "/api/voice/stt",
                files=files,
                data={"language": "en"},
            )
            assert resp.status_code == 200
            assert resp.json()["text"] == "hello"
            # 验证 language 被透传
            call_kwargs = fake_litellm_mod.atranscription.call_args.kwargs
            assert call_kwargs.get("language") == "en"
        finally:
            sys.modules.pop("litellm", None)

    async def test_falls_back_to_stub_on_import_error(self, client, real_mode, monkeypatch):
        # litellm 未安装(ImportError)→ 降级 stub 文本
        import builtins
        real_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name == "litellm":
                raise ImportError("no module named litellm")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", fake_import)

        files = {"file": ("test.wav", b"audio", "audio/wav")}
        resp = await client.post("/api/voice/stt", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["stub"] is True
        assert "litellm 未安装" in data["text"]

    async def test_falls_back_to_stub_on_transcription_error(self, client, real_mode, monkeypatch):
        # litellm.atranscription 抛异常 → 降级 stub,返回 [STT 失败] 文本
        import sys
        import types
        fake_litellm_mod = types.ModuleType("litellm")
        fake_litellm_mod.atranscription = AsyncMock(side_effect=RuntimeError("api timeout"))
        sys.modules["litellm"] = fake_litellm_mod

        try:
            files = {"file": ("test.wav", b"audio", "audio/wav")}
            resp = await client.post("/api/voice/stt", files=files)
            assert resp.status_code == 200
            data = resp.json()
            assert data["stub"] is True
            assert "[STT 失败]" in data["text"]
            assert "api timeout" in data["text"]
        finally:
            sys.modules.pop("litellm", None)

    async def test_scrubs_sensitive_info_from_error_message(self, client, real_mode, monkeypatch):
        # 异常消息含 api_key 等敏感字段 → 脱敏
        import sys
        import types
        fake_litellm_mod = types.ModuleType("litellm")
        fake_litellm_mod.atranscription = AsyncMock(
            side_effect=RuntimeError("Authorization: Bearer sk-xxx-1234567890 expired")
        )
        sys.modules["litellm"] = fake_litellm_mod

        try:
            files = {"file": ("test.wav", b"audio", "audio/wav")}
            resp = await client.post("/api/voice/stt", files=files)
            data = resp.json()
            assert data["stub"] is True
            # 敏感信息已脱敏(不包含原始 token)
            assert "sk-xxx-1234567890" not in data["text"]
            assert "脱敏" in data["text"] or "RuntimeError" in data["text"]
        finally:
            sys.modules.pop("litellm", None)

    async def test_scrubs_apikey_in_error_message(self, client, real_mode, monkeypatch):
        # 异常含 "apikey" 关键字 → 脱敏
        import sys
        import types
        fake_litellm_mod = types.ModuleType("litellm")
        fake_litellm_mod.atranscription = AsyncMock(
            side_effect=ValueError("invalid apikey sk-secret")
        )
        sys.modules["litellm"] = fake_litellm_mod

        try:
            files = {"file": ("test.wav", b"audio", "audio/wav")}
            resp = await client.post("/api/voice/stt", files=files)
            data = resp.json()
            assert "sk-secret" not in data["text"]
        finally:
            sys.modules.pop("litellm", None)


# =============================================================================
# _get_suffix 文件扩展名提取
# =============================================================================


class TestGetSuffix:
    """测试 _get_suffix() 从文件名提取扩展名。"""

    def test_returns_extension_for_normal_filename(self):
        # 正常文件名 → 返回 .ext
        assert voice_stt._get_suffix("audio.wav") == ".wav"
        assert voice_stt._get_suffix("audio.mp3") == ".mp3"
        assert voice_stt._get_suffix("audio.m4a") == ".m4a"
        assert voice_stt._get_suffix("audio.webm") == ".webm"

    def test_returns_lowercase_extension(self):
        # 大写扩展名 → 转小写
        assert voice_stt._get_suffix("audio.WAV") == ".wav"
        assert voice_stt._get_suffix("audio.MP3") == ".mp3"

    def test_returns_default_wav_when_no_extension(self):
        # 无扩展名 → 默认 .wav
        assert voice_stt._get_suffix("audio") == ".wav"
        assert voice_stt._get_suffix("no_dot") == ".wav"

    def test_returns_default_wav_for_empty_string(self):
        # 空字符串 → .wav
        assert voice_stt._get_suffix("") == ".wav"

    def test_returns_default_wav_for_too_long_extension(self):
        # 扩展名超 6 字符 → .wav(防路径注入)
        assert voice_stt._get_suffix("file.verylongext") == ".wav"
        assert voice_stt._get_suffix("file.abcdefgh") == ".wav"

    def test_returns_default_wav_for_non_alnum_extension(self):
        # 扩展名含非字母数字 → .wav(防路径注入)
        assert voice_stt._get_suffix("file.tar.gz") == ".gz"  # rsplit 取最后一段
        assert voice_stt._get_suffix("file.sh") == ".sh"
        # 含特殊字符的扩展名 → .wav
        assert voice_stt._get_suffix("file.ex-t") == ".wav"
        assert voice_stt._get_suffix("file.ex t") == ".wav"

    def test_handles_filename_with_multiple_dots(self):
        # 多个点 → 取最后一段
        assert voice_stt._get_suffix("my.audio.file.mp3") == ".mp3"
        assert voice_stt._get_suffix("a.b.c.wav") == ".wav"

    def test_returns_dot_prefixed_extension(self):
        # 返回值含 "." 前缀
        result = voice_stt._get_suffix("audio.flac")
        assert result.startswith(".")
        assert result == ".flac"

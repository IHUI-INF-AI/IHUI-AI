"""app/routers/voice_stt.py 单元测试:STT 转写端点 + 工具函数全覆盖。

2026-07-28 重构:从 mock litellm.atranscription 迁移到 mock faster-whisper 本地推理。
测试覆盖:
- POST /api/voice/stt 成功转写:faster-whisper 模型返回文本 + stub=False
- POST /api/voice/stt 模型未安装:ImportError → 降级 stub 文本
- POST /api/voice/stt 转写异常:RuntimeError → 降级 stub 文本
- POST /api/voice/stt 边界:空音频 → 空文本 / language 参数透传
- _get_suffix():正常扩展名 / 无扩展名 / 超长扩展名 / 非字母数字扩展名

测试隔离:用 monkeypatch 替换 _get_whisper_model,不加载真实模型。
"""
from __future__ import annotations

import io
from unittest.mock import MagicMock

import pytest

from app.routers import voice_stt


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径。"""
    from app.core.config import settings
    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


@pytest.fixture
def reset_whisper_singleton(monkeypatch):
    """每个测试前重置全局 _whisper_model 单例,避免测试间污染。"""
    monkeypatch.setattr(voice_stt, "_whisper_model", None)
    yield
    monkeypatch.setattr(voice_stt, "_whisper_model", None)


def _mock_whisper_model(text: str = "你好世界"):
    """构造一个 mock 的 faster-whisper 模型,transcribe 返回 (segments, info)。"""
    model = MagicMock()
    segment = MagicMock()
    segment.text = text
    model.transcribe.return_value = ([segment], {"language": "zh", "duration": 1.0})
    return model


class TestVoiceSttSuccess:
    """测试 faster-whisper 本地推理成功转写。"""

    async def test_returns_text_on_successful_transcription(self, client, reset_whisper_singleton, monkeypatch):
        mock_model = _mock_whisper_model("你好世界")
        monkeypatch.setattr(voice_stt, "_get_whisper_model", lambda: mock_model)

        files = {"file": ("test.wav", b"audio bytes", "audio/wav")}
        resp = await client.post("/api/voice/stt", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["stub"] is False
        assert data["text"] == "你好世界"
        assert data["model"] == "whisper-base-local"

    async def test_returns_text_with_language_param(self, client, reset_whisper_singleton, monkeypatch):
        mock_model = _mock_whisper_model("hello")
        monkeypatch.setattr(voice_stt, "_get_whisper_model", lambda: mock_model)

        files = {"file": ("test.wav", b"audio", "audio/wav")}
        resp = await client.post(
            "/api/voice/stt",
            files=files,
            data={"language": "en"},
        )
        assert resp.status_code == 200
        assert resp.json()["text"] == "hello"
        call_kwargs = mock_model.transcribe.call_args.kwargs
        assert call_kwargs.get("language") == "en"

    async def test_empty_audio_returns_empty_text(self, client, reset_whisper_singleton, monkeypatch):
        mock_model = _mock_whisper_model("should not be called")
        monkeypatch.setattr(voice_stt, "_get_whisper_model", lambda: mock_model)

        files = {"file": ("empty.wav", b"", "audio/wav")}
        resp = await client.post("/api/voice/stt", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["text"] == ""
        assert data["stub"] is True
        assert data["model"] == "whisper-base-local"
        mock_model.transcribe.assert_not_called()


class TestVoiceSttFallback:
    """测试 faster-whisper 异常时的降级行为。"""

    async def test_falls_back_to_stub_on_import_error(self, client, reset_whisper_singleton, monkeypatch):
        def raise_import_error():
            raise ImportError("no module named faster_whisper")

        monkeypatch.setattr(voice_stt, "_get_whisper_model", raise_import_error)

        files = {"file": ("test.wav", b"audio", "audio/wav")}
        resp = await client.post("/api/voice/stt", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["stub"] is True
        assert "faster-whisper 未安装" in data["text"]

    async def test_falls_back_to_stub_on_transcription_error(self, client, reset_whisper_singleton, monkeypatch):
        mock_model = MagicMock()
        mock_model.transcribe.side_effect = RuntimeError("model load failed")
        monkeypatch.setattr(voice_stt, "_get_whisper_model", lambda: mock_model)

        files = {"file": ("test.wav", b"audio", "audio/wav")}
        resp = await client.post("/api/voice/stt", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["stub"] is True
        assert "[STT 失败]" in data["text"]
        assert "model load failed" in data["text"]

    async def test_scrubs_sensitive_info_from_error_message(self, client, reset_whisper_singleton, monkeypatch):
        mock_model = MagicMock()
        mock_model.transcribe.side_effect = RuntimeError(
            "Authorization: Bearer sk-xxx-1234567890 expired"
        )
        monkeypatch.setattr(voice_stt, "_get_whisper_model", lambda: mock_model)

        files = {"file": ("test.wav", b"audio", "audio/wav")}
        resp = await client.post("/api/voice/stt", files=files)
        data = resp.json()
        assert data["stub"] is True
        assert "sk-xxx-1234567890" not in data["text"]
        assert "脱敏" in data["text"] or "RuntimeError" in data["text"]

    async def test_scrubs_apikey_in_error_message(self, client, reset_whisper_singleton, monkeypatch):
        mock_model = MagicMock()
        mock_model.transcribe.side_effect = ValueError("invalid apikey sk-secret")
        monkeypatch.setattr(voice_stt, "_get_whisper_model", lambda: mock_model)

        files = {"file": ("test.wav", b"audio", "audio/wav")}
        resp = await client.post("/api/voice/stt", files=files)
        data = resp.json()
        assert "sk-secret" not in data["text"]


class TestGetSuffix:
    """测试 _get_suffix() 从文件名提取扩展名。"""

    def test_returns_extension_for_normal_filename(self):
        assert voice_stt._get_suffix("audio.wav") == ".wav"
        assert voice_stt._get_suffix("audio.mp3") == ".mp3"
        assert voice_stt._get_suffix("audio.m4a") == ".m4a"
        assert voice_stt._get_suffix("audio.webm") == ".webm"

    def test_returns_lowercase_extension(self):
        assert voice_stt._get_suffix("audio.WAV") == ".wav"
        assert voice_stt._get_suffix("audio.MP3") == ".mp3"

    def test_returns_default_wav_when_no_extension(self):
        assert voice_stt._get_suffix("audio") == ".wav"
        assert voice_stt._get_suffix("no_dot") == ".wav"

    def test_returns_default_wav_for_empty_string(self):
        assert voice_stt._get_suffix("") == ".wav"

    def test_returns_default_wav_for_too_long_extension(self):
        assert voice_stt._get_suffix("file.verylongext") == ".wav"
        assert voice_stt._get_suffix("file.abcdefgh") == ".wav"

    def test_returns_default_wav_for_non_alnum_extension(self):
        assert voice_stt._get_suffix("file.tar.gz") == ".gz"
        assert voice_stt._get_suffix("file.sh") == ".sh"
        assert voice_stt._get_suffix("file.ex-t") == ".wav"
        assert voice_stt._get_suffix("file.ex t") == ".wav"

    def test_handles_filename_with_multiple_dots(self):
        assert voice_stt._get_suffix("my.audio.file.mp3") == ".mp3"
        assert voice_stt._get_suffix("a.b.c.wav") == ".wav"

    def test_returns_dot_prefixed_extension(self):
        result = voice_stt._get_suffix("audio.flac")
        assert result.startswith(".")
        assert result == ".flac"

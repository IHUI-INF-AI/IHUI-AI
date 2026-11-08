# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P1 AIS-050:媒体工具本地 path 分支必须与 read_file 同一套工作区 + 敏感文件判据。

旧写法(仅 os.path.isfile/getsize + open)⇒ 根外文件、data/sessions.db、.env
都能被读取并上传第三方。本夹具钉住:被拒 + 没有任何上传发生;登记根内正常文件
仍能通过路径校验(上传本身 monkeypatch,不发真实网络)。
"""

from __future__ import annotations

import pytest

from app.services import mcp_server
from app.services import video_generation as _vg


class _UploadStub:
    def __init__(self) -> None:
        self.file_calls: list[tuple[bytes, str, str | None]] = []
        self.voice_calls: list[tuple[bytes, str]] = []

    async def upload_file(self, data: bytes, filename: str, purpose: str | None = None) -> str:
        self.file_calls.append((data, filename, purpose))
        return "https://cdn.example/fake-file"

    async def upload_voice(self, data: bytes, filename: str) -> dict:
        self.voice_calls.append((data, filename))
        return {"voice": {"id": "voice-1"}}


@pytest.fixture
def workspace(tmp_path, monkeypatch: pytest.MonkeyPatch):
    root = tmp_path / "ws"
    root.mkdir()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(root))
    return root


def _install_stub(monkeypatch: pytest.MonkeyPatch) -> _UploadStub:
    stub = _UploadStub()
    monkeypatch.setattr(_vg, "_instantiate", lambda name: stub if name == "token6688" else None)
    return stub


async def test_upload_file_rejects_outside_path_without_upload(
    workspace, tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    outside = tmp_path / "outside-secret.txt"
    outside.write_text("TOP-SECRET", encoding="utf-8")
    stub = _install_stub(monkeypatch)

    out = await mcp_server._tool_token6688_upload_file({"path": str(outside)})

    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_ALLOWED"
    assert stub.file_calls == []


async def test_upload_file_rejects_sessions_db(
    workspace, monkeypatch: pytest.MonkeyPatch
) -> None:
    (workspace / "data").mkdir()
    db = workspace / "data" / "sessions.db"
    db.write_bytes(b"SQLITE-session-token")
    stub = _install_stub(monkeypatch)

    out = await mcp_server._tool_token6688_upload_file({"path": str(db)})

    assert out["ok"] is False
    assert out["errorCode"] == "SENSITIVE_FILE_BLOCKED"
    assert stub.file_calls == []


async def test_upload_file_rejects_dotenv(
    workspace, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = workspace / ".env"
    env.write_text("TOKEN6688_API_KEY=sk-live", encoding="utf-8")
    stub = _install_stub(monkeypatch)

    out = await mcp_server._tool_token6688_upload_file({"path": str(env)})

    assert out["ok"] is False
    assert out["errorCode"] == "SENSITIVE_FILE_BLOCKED"
    assert stub.file_calls == []


async def test_upload_file_allows_normal_file_inside_workspace(
    workspace, monkeypatch: pytest.MonkeyPatch
) -> None:
    normal = workspace / "ok.wav"
    normal.write_bytes(b"RIFF-fake-audio")
    stub = _install_stub(monkeypatch)

    out = await mcp_server._tool_token6688_upload_file({"path": str(normal)})

    assert out["ok"] is True
    assert stub.file_calls and stub.file_calls[0][1] == "ok.wav"


async def test_voice_clone_upload_rejects_outside_path_without_upload(
    workspace, tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    outside = tmp_path / "outside-ref.wav"
    outside.write_bytes(b"RIFF-outside")
    stub = _install_stub(monkeypatch)

    # 2026-11-08 合并波次:声纹上传已叠加 AIS-050 归属闸(stock-red 线),身份缺失会
    # 先返回 IDENTITY_REQUIRED;这里如实带上宿主注入身份,继续钉住"路径判据先于上传"
    # (路径/敏感文件判据与归属闸两者都保留,不选边)。
    out = await mcp_server._tool_token6688_voice_clone(
        {"action": "upload", "path": str(outside), "__user_id": "u-050"}
    )

    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_ALLOWED"
    assert stub.voice_calls == []


async def test_voice_clone_upload_rejects_dotenv(
    workspace, monkeypatch: pytest.MonkeyPatch
) -> None:
    env = workspace / ".env.local"
    env.write_text("SECRET=1", encoding="utf-8")
    stub = _install_stub(monkeypatch)

    out = await mcp_server._tool_token6688_voice_clone(
        {"action": "upload", "path": str(env), "__user_id": "u-050"}
    )

    assert out["ok"] is False
    assert out["errorCode"] == "SENSITIVE_FILE_BLOCKED"
    assert stub.voice_calls == []


async def test_audio_transcription_rejects_outside_path_without_stt(
    workspace, tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    outside = tmp_path / "outside-audio.wav"
    outside.write_bytes(b"RIFF-outside")
    calls: list[tuple] = []

    async def _fake_stt(engine, data, filename, language):
        calls.append((engine, data, filename, language))
        return "hello", "m", "local", None

    monkeypatch.setattr(mcp_server, "_stt_once", _fake_stt)

    out = await mcp_server._tool_audio_transcription({"audio": str(outside)})

    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_ALLOWED"
    assert calls == []


async def test_audio_transcription_rejects_sessions_db(
    workspace, monkeypatch: pytest.MonkeyPatch
) -> None:
    (workspace / "data").mkdir()
    db = workspace / "data" / "sessions.db"
    db.write_bytes(b"SQLITE")
    calls: list[tuple] = []

    async def _fake_stt(engine, data, filename, language):
        calls.append((engine, data, filename, language))
        return "hello", "m", "local", None

    monkeypatch.setattr(mcp_server, "_stt_once", _fake_stt)

    out = await mcp_server._tool_audio_transcription({"audio": str(db)})

    assert out["ok"] is False
    assert out["errorCode"] == "SENSITIVE_FILE_BLOCKED"
    assert calls == []


async def test_audio_transcription_allows_inside_path(
    workspace, monkeypatch: pytest.MonkeyPatch
) -> None:
    normal = workspace / "voice.wav"
    normal.write_bytes(b"RIFF-inside")
    calls: list[tuple] = []

    async def _fake_stt(engine, data, filename, language):
        calls.append((engine, data, filename, language))
        return "hello", "m", "local", None

    monkeypatch.setattr(mcp_server, "_stt_once", _fake_stt)

    out = await mcp_server._tool_audio_transcription({"audio": str(normal)})

    assert out["ok"] is True
    assert calls and calls[0][2] == "voice.wav"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

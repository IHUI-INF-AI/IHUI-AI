# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Voice Session 路由单测(2026-09-18 第六批,对标 Codex realtime-webrtc 会话语义)。

覆盖:
- 创建会话(自动新建线程 / 绑定不存在线程 404)
- 语音回合全链路:音频 → STT(桩)→ 引擎 prompt(桩)→ TTS(桩)→ 音频出
- 空语音内容短路(STT 结果为空不进引擎)
- TTS 失败降级为纯文本回合(note 标注)
- 会话状态 / 关闭 / 关闭后回合 404
"""

import base64
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.routers.engine_voice as engine_voice
from app.routers import engine_voice as voice_router_module


class _FakeEngine:
    """脚本化引擎:thread.start/thread.prompt 返回预置结果。"""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.prompt_response: dict[str, Any] = {
            "result": {
                "finalResponse": "你好,我是智汇AI语音助手。",
                "usage": {"totalTokens": 9},
            }
        }

    async def handle_message(self, payload: dict[str, Any], emit: Any = None) -> dict[str, Any]:
        self.calls.append(payload)
        method = payload.get("method")
        if method == "thread.start":
            return {"result": {"threadId": "thr_voicefake"}}
        if method == "thread.state":
            if payload["params"]["threadId"] == "thr_exists":
                return {"result": {"status": "idle"}}
            return {"error": {"code": -32004, "message": "线程不存在"}}
        if method == "thread.prompt":
            return dict(self.prompt_response)
        return {"error": {"code": -32601, "message": f"未知方法 {method}"}}


@pytest.fixture()
def client(monkeypatch):
    fake = _FakeEngine()
    monkeypatch.setattr(engine_voice, "ENGINE", fake)
    monkeypatch.setattr(
        engine_voice, "_transcribe_audio", _fake_transcribe, raising=True
    )
    monkeypatch.setattr(
        engine_voice, "_synthesize_speech", _fake_synthesize, raising=True
    )
    app = FastAPI()
    app.include_router(voice_router_module.router, prefix="/api")
    voice_router_module._sessions.clear()
    return TestClient(app), fake


async def _fake_transcribe(data: bytes, filename: str, language: str | None) -> str:
    return "帮我查一下天气"


async def _fake_synthesize(text: str, voice: str) -> bytes:
    return f"mp3::{voice}::{text[:20]}".encode()


# =============================================================================
# 用例
# =============================================================================


def test_create_session_auto_thread_and_bind_existing(client):
    tc, fake = client
    resp = tc.post("/api/engine/voice/sessions", json={})
    assert resp.status_code == 200
    body = resp.json()
    assert body["sessionId"].startswith("vse_")
    assert body["threadId"] == "thr_voicefake"
    # 绑定不存在线程 → 404
    resp = tc.post(
        "/api/engine/voice/sessions", json={"threadId": "thr_missing"}
    )
    assert resp.status_code == 404
    # 绑定存在线程
    resp = tc.post("/api/engine/voice/sessions", json={"threadId": "thr_exists"})
    assert resp.status_code == 200
    assert resp.json()["threadId"] == "thr_exists"


def test_voice_turn_full_pipeline(client):
    """音频进 → STT → 引擎 → TTS → 音频出(全链路桩)。"""
    tc, fake = client
    sid = tc.post("/api/engine/voice/sessions", json={}).json()["sessionId"]
    resp = tc.post(
        f"/api/engine/voice/sessions/{sid}/turn",
        files={"file": ("speech.wav", b"RIFF-fake-audio", "audio/wav")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["transcript"] == "帮我查一下天气"
    assert body["responseText"] == "你好,我是智汇AI语音助手。"
    assert body["audioBase64"] == base64.b64encode(
        "mp3::zh-CN-XiaoxiaoNeural::你好,我是智汇AI语音助手。".encode()
    ).decode("ascii")
    assert body["turnIndex"] == 1
    # 引擎确实收到了转写文本作为输入
    prompt_calls = [c for c in fake.calls if c["method"] == "thread.prompt"]
    assert len(prompt_calls) == 1
    assert prompt_calls[0]["params"]["input"] == "帮我查一下天气"


def test_voice_turn_empty_transcript_short_circuits(client):
    """STT 空结果 → 不进引擎,note 标注。"""
    tc, fake = client

    async def _empty(data: bytes, filename: str, language: str | None) -> str:
        return ""

    import app.routers.engine_voice as mod

    original = mod._transcribe_audio
    mod._transcribe_audio = _empty
    try:
        sid = tc.post("/api/engine/voice/sessions", json={}).json()["sessionId"]
        resp = tc.post(
            f"/api/engine/voice/sessions/{sid}/turn",
            files={"file": ("a.wav", b"data", "audio/wav")},
        )
        assert resp.status_code == 200
        assert resp.json()["note"] == "未检测到语音内容"
        assert not [c for c in fake.calls if c["method"] == "thread.prompt"]
    finally:
        mod._transcribe_audio = original


def test_voice_turn_tts_failure_degrades_to_text(client):
    """TTS 失败 → 回合不炸,返回文本 + note。"""
    tc, _ = client

    async def _boom(text: str, voice: str) -> bytes:
        raise RuntimeError("edge-tts down")

    import app.routers.engine_voice as mod

    original = mod._synthesize_speech
    mod._synthesize_speech = _boom
    try:
        sid = tc.post("/api/engine/voice/sessions", json={}).json()["sessionId"]
        resp = tc.post(
            f"/api/engine/voice/sessions/{sid}/turn",
            files={"file": ("a.wav", b"data", "audio/wav")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["audioBase64"] is None
        assert "TTS 合成失败" in body["note"]
        assert body["responseText"]
    finally:
        mod._synthesize_speech = original


def test_voice_session_state_and_close(client):
    tc, _ = client
    sid = tc.post("/api/engine/voice/sessions", json={}).json()["sessionId"]
    state = tc.get(f"/api/engine/voice/sessions/{sid}").json()
    assert state["turns"] == 0
    # 一轮后 turns=1
    tc.post(
        f"/api/engine/voice/sessions/{sid}/turn",
        files={"file": ("a.wav", b"data", "audio/wav")},
    )
    assert tc.get(f"/api/engine/voice/sessions/{sid}").json()["turns"] == 1
    # 关闭后回合 404
    assert tc.delete(f"/api/engine/voice/sessions/{sid}").json()["closed"] is True
    assert (
        tc.post(
            f"/api/engine/voice/sessions/{sid}/turn",
            files={"file": ("a.wav", b"data", "audio/wav")},
        ).status_code
        == 404
    )
    assert tc.get(f"/api/engine/voice/sessions/{sid}").status_code == 404


def test_voice_turn_empty_audio_rejected(client):
    tc, _ = client
    sid = tc.post("/api/engine/voice/sessions", json={}).json()["sessionId"]
    resp = tc.post(
        f"/api/engine/voice/sessions/{sid}/turn",
        files={"file": ("a.wav", b"", "audio/wav")},
    )
    assert resp.status_code == 400
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

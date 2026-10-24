# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""app/routers/voice_tts.py 逐段流式端点(/voice/tts/stream)回归。

D11 第二工「段间静默内可打断」的服务端一半:整段一次返回的链路没有"段",
客户端就无从在段间静默里判打断。本文件钉住三件事:

1. 正例:policy 先下、segment 逐段下、done 收尾,段数与实际合成次数一致;
2. 反例:空文本 / 超长 / 声音不在白名单在任何字节下发前 400(且一次合成都不发);
3. 反例:段级合成失败如实下发 error 帧并停止,不伪造 done。

测试隔离:monkeypatch sys.modules["edge_tts"],不触网(本机 venv 的 edge-tts
对微软端点 403,真网不可用,也绝不该在单测里用)。
"""
from __future__ import annotations

import base64
import json
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.routers import voice_tts


@pytest.fixture(autouse=True)
def _bypass_jwt(monkeypatch):
    """隔离 JWT 中间件:清空 jwt_secret → middleware 走跳过路径。"""
    from app.core.config import settings

    monkeypatch.setattr(settings, "jwt_secret", "")
    monkeypatch.setattr(settings, "node_env", "development")


def _install_fake_edge(monkeypatch) -> list[str]:
    """替身 edge_tts:记录每次合成的文本,回一段假音频。"""
    calls: list[str] = []

    class _FakeCommunicate:
        def __init__(self, text, voice=None, rate=None):
            calls.append(text)

        async def stream(self):
            yield {"type": "audio", "data": b"ID3fake-segment"}
            yield {"type": "WordBoundary", "data": None}

    fake_mod = MagicMock()
    fake_mod.Communicate = _FakeCommunicate
    monkeypatch.setitem(sys.modules, "edge_tts", fake_mod)
    return calls


def _events(body: str) -> list[dict]:
    return [json.loads(line) for line in body.strip().splitlines() if line.strip()]


class TestTtsStreamHappyPath:
    """正例:policy → segment × N → done。"""

    async def test_stream_emits_policy_segments_and_done(self, client, monkeypatch):
        calls = _install_fake_edge(monkeypatch)
        text = "今天天气不错。我们出去走走。顺便买点水果。"
        resp = await client.post("/api/voice/tts/stream", json={"text": text})

        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("application/x-ndjson")
        assert resp.headers["x-barge-in-policy"] == "silence_gap_only"

        events = _events(resp.text)
        assert events[0]["type"] == "policy"
        assert events[0]["minVoicedMs"] == 300
        assert events[0]["segmentGapMs"] == 750

        segments = [e for e in events if e["type"] == "segment"]
        assert events[-1] == {"type": "done", "segments": len(segments)}
        # 三段文本合起来必须与被朗读文本逐字相同,且每次合成只合一段
        assert "".join(s["text"] for s in segments) == text
        assert len(calls) == len(segments)
        # 下发的必须是 base64 编码的音频字节(客户端可直接 new Audio(blob),不二次解码)
        assert all(base64.b64decode(s["audioBase64"]) == b"ID3fake-segment" for s in segments)
        assert all(s["contentType"] == "audio/mpeg" for s in segments)

    async def test_single_sentence_still_gets_one_segment(self, client, monkeypatch):
        calls = _install_fake_edge(monkeypatch)
        resp = await client.post("/api/voice/tts/stream", json={"text": "你好。"})

        assert resp.status_code == 200
        segments = [e for e in _events(resp.text) if e["type"] == "segment"]
        assert len(segments) == 1 == len(calls)
        assert segments[0]["total"] == 1


class TestTtsStreamRejectsBeforeAnyAudio:
    """反例:校验失败必须在下发任何字节前 400,且零合成请求。"""

    async def test_empty_text_rejected_without_synthesis(self, client, monkeypatch):
        calls = _install_fake_edge(monkeypatch)
        resp = await client.post("/api/voice/tts/stream", json={"text": "   "})
        assert resp.status_code == 400
        assert calls == []

    async def test_overlong_text_rejected(self, client, monkeypatch):
        calls = _install_fake_edge(monkeypatch)
        resp = await client.post("/api/voice/tts/stream", json={"text": "字" * 2001})
        assert resp.status_code == 400
        assert "超长" in resp.json()["detail"]
        assert calls == []

    async def test_voice_not_in_whitelist_rejected(self, client, monkeypatch):
        calls = _install_fake_edge(monkeypatch)
        resp = await client.post(
            "/api/voice/tts/stream", json={"text": "你好。", "voice": "random-voice"},
        )
        assert resp.status_code == 400
        assert calls == []


class TestTtsStreamSegmentFailure:
    """反例:段级合成失败如实上报,不发 done。"""

    async def test_provider_error_emits_error_frame_and_stops(self, client, monkeypatch):
        from app.providers.free_voice_provider import FreeVoiceProvider, VoiceProviderError

        monkeypatch.setattr(
            FreeVoiceProvider,
            "tts",
            AsyncMock(side_effect=VoiceProviderError("edge-tts 服务不可达", 503)),
        )
        resp = await client.post("/api/voice/tts/stream", json={"text": "第一句。第二句。"})

        events = _events(resp.text)
        assert [e["type"] for e in events] == ["policy", "error"]
        assert events[1]["stage"] == "tts"
        assert events[1]["index"] == 0
        assert events[1]["status"] == 503
        assert "不可达" in events[1]["message"]
        assert "done" not in [e["type"] for e in events]

    async def test_partial_failure_keeps_earlier_segments_visible(self, client, monkeypatch):
        # 第一段成功、第二段失败:已发的段不能收回,error 帧必须带失败段序号
        from app.providers.free_voice_provider import FreeVoiceProvider, VoiceProviderError

        async def _tts(self, text, *, voice=None, rate="+0%", response_format="mp3"):
            if text.startswith("第二"):
                raise VoiceProviderError("boom", 503)
            return b"ID3ok", "audio/mpeg"

        monkeypatch.setattr(FreeVoiceProvider, "tts", _tts)
        resp = await client.post(
            "/api/voice/tts/stream", json={"text": "第一句话足够长。第二句话足够长。"},
        )

        events = _events(resp.text)
        assert [e["type"] for e in events] == ["policy", "segment", "error"]
        assert events[2]["index"] == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

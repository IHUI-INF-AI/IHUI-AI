# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""模型健康探测能力升级(2026-11-11 立)的纯函数 / 状态层测试。

覆盖:
- SSE 首块解析(有内容 / [DONE] / 非流式 JSON / 错误块);
- 工具调用判定(命中 / 未命中 / 400 tool 文案 / 超时未知);
- 长上下文针测文本生成与验证码校验;
- 状态字段落盘-恢复,以及 /llm/models 的 caps_verified 结构。
"""

from __future__ import annotations

import json
import time

import httpx
import pytest

import app.services.model_health as mh
from app.services.model_health import (
    ModelHealthService,
    ModelProbeState,
    _build_context_probe_text,
    _check_context_probe_reply,
    _judge_tools_response,
    _sse_chunk_has_content,
    _stream_chat,
)


class _Resp:
    def __init__(self, status_code: int, text: str) -> None:
        self.status_code = status_code
        self.text = text


class _FakePostClient:
    def __init__(self, resp: _Resp) -> None:
        self._resp = resp

    async def post(self, *args, **kwargs) -> _Resp:
        return self._resp


class _TimeoutPostClient:
    async def post(self, *args, **kwargs):
        raise httpx.ReadTimeout("slow")


class _FakeStreamContext:
    def __init__(self, status_code: int, lines: list[str], body: str = "") -> None:
        self.status_code = status_code
        self._lines = lines
        self._body = body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def aiter_lines(self):
        for line in self._lines:
            yield line

    async def aread(self) -> bytes:
        return self._body.encode("utf-8")


class _FakeStreamClient:
    def __init__(self, ctx: _FakeStreamContext) -> None:
        self._ctx = ctx

    def stream(self, *args, **kwargs) -> _FakeStreamContext:
        return self._ctx


# ---------------------------------------------------------------------------
# SSE 首块解析
# ---------------------------------------------------------------------------


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}"


def test_sse_chunk_has_content_accepts_choices_and_delta():
    line = _sse({"choices": [{"index": 0, "delta": {"content": "p"}}]})
    assert _sse_chunk_has_content(line) is True
    # 首块只有 role 也算流式链路已生效
    assert _sse_chunk_has_content(_sse({"choices": [{"delta": {"role": "assistant"}}]})) is True


@pytest.mark.parametrize(
    "line",
    [
        "",
        ": ping",
        "event: message",
        "data: [DONE]",
        '{"choices":[{"delta":{"content":"x"}}]}',
        'data: not-json',
        _sse({"error": {"message": "bad"}}),
        _sse({"choices": []}),
    ],
)
def test_sse_chunk_has_content_rejects_non_content(line):
    assert _sse_chunk_has_content(line) is False


async def test_stream_chat_records_ttft_on_first_parsable_chunk():
    ctx = _FakeStreamContext(
        200,
        [
            ": keep-alive",
            "",
            _sse({"choices": [{"delta": {"role": "assistant"}}]}),
            _sse({"choices": [{"delta": {"content": "pong"}}]}),
        ],
    )
    status, text, ttft_ms = await _stream_chat(_FakeStreamClient(ctx), "http://x", {}, {})
    assert status == 200
    assert "pong" in text
    assert ttft_ms is not None and ttft_ms >= 0


async def test_stream_chat_returns_none_ttft_for_non_stream_json():
    """上游无视 stream 参数直接返回非流式 JSON:首块未知,交给非流式复测。"""
    ctx = _FakeStreamContext(
        200, [json.dumps({"choices": [{"message": {"content": "hi"}}]})]
    )
    status, _text, ttft_ms = await _stream_chat(_FakeStreamClient(ctx), "http://x", {}, {})
    assert status == 200
    assert ttft_ms is None


async def test_stream_chat_returns_body_on_error_status():
    ctx = _FakeStreamContext(400, [], body='{"error":"unsupported"}')
    status, text, ttft_ms = await _stream_chat(_FakeStreamClient(ctx), "http://x", {}, {})
    assert status == 400
    assert "unsupported" in text
    assert ttft_ms is None


# ---------------------------------------------------------------------------
# 工具调用判定
# ---------------------------------------------------------------------------


def test_judge_tools_response_hit():
    body = json.dumps(
        {
            "choices": [
                {
                    "message": {
                        "tool_calls": [
                            {"id": "1", "type": "function", "function": {"name": "get_weather"}}
                        ]
                    }
                }
            ]
        }
    )
    assert _judge_tools_response(200, body) == (True, "")


def test_judge_tools_response_declared_but_not_triggered():
    body = json.dumps({"choices": [{"message": {"content": "北京晴天"}}]})
    ok, error = _judge_tools_response(200, body)
    assert ok is False
    assert "未实际触发" in error


@pytest.mark.parametrize("status_code", [400, 422])
def test_judge_tools_response_rejects_when_error_mentions_tools(status_code):
    ok, error = _judge_tools_response(
        status_code, '{"error":"tools are not supported for this model"}'
    )
    assert ok is False
    assert str(status_code) in error


def test_judge_tools_response_unknown_for_server_error():
    ok, _error = _judge_tools_response(503, "upstream unavailable")
    assert ok is None, "5xx 不能误判为不支持工具调用"


async def test_probe_tools_timeout_is_unknown():
    svc = ModelHealthService()
    ok, error = await svc._probe_tools(_TimeoutPostClient(), "http://x", {}, "m")
    assert ok is None
    assert "Timeout" in error


# ---------------------------------------------------------------------------
# 长上下文针测文本
# ---------------------------------------------------------------------------


def test_build_context_probe_text_is_deterministic_and_code_is_at_end():
    text, code = _build_context_probe_text(500)
    assert code == "IHUI-000500-OK"
    assert text.rstrip().endswith(code), "验证码必须放在末尾"
    assert len(text) >= 500 * 4, "填充量应接近 4 字符/token"
    assert _build_context_probe_text(500) == (text, code)


def test_check_context_probe_reply():
    _text, code = _build_context_probe_text(500)
    assert _check_context_probe_reply("IHUI-000500-OK", code) is True
    assert _check_context_probe_reply("  ihui-000500-ok  ", code) is True
    assert _check_context_probe_reply("I cannot read that", code) is False
    assert _check_context_probe_reply("", code) is False


async def test_context_probe_flags_wrong_reply(monkeypatch):
    svc = ModelHealthService()
    resp = _Resp(
        200,
        json.dumps({"choices": [{"message": {"content": "我不知道"}}]}),
    )

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, *args, **kwargs):
            return resp

    monkeypatch.setattr(mh.httpx, "AsyncClient", lambda **kwargs: _Client())
    target = mh._ProbeTarget("alpha", "http://x", {}, None, "m")
    ok, error = await svc._probe_context(target, 500)
    assert ok is False
    assert "验证码" in error


# ---------------------------------------------------------------------------
# 状态字段持久化 + 能力轮转
# ---------------------------------------------------------------------------


def test_state_fields_roundtrip(monkeypatch, tmp_path):
    state_file = tmp_path / "model_health_state.json"
    monkeypatch.setattr(mh, "_STATE_FILE", state_file)
    svc = ModelHealthService()
    now = time.time()
    svc._states["m1"] = ModelProbeState(
        status="healthy",
        checked_at=now,
        latency_ms=120,
        stream_ok=True,
        stream_ttft_ms=45,
        tools_ok=False,
        tools_error="声明支持工具调用但未实际触发",
        context_tokens=16000,
        context_ok=True,
        context_error="",
        context_checked_at=now - 100,
    )
    svc._save_states()

    restored = ModelHealthService()
    restored._load_states()
    state = restored._states["m1"]
    assert state.stream_ok is True
    assert state.stream_ttft_ms == 45
    assert state.tools_ok is False
    assert state.tools_error.startswith("声明支持")
    assert state.context_tokens == 16000
    assert state.context_ok is True
    assert state.context_checked_at == pytest.approx(now - 100)


def test_caps_verified_shape_with_and_without_state(monkeypatch):
    monkeypatch.delenv("MODEL_HEALTH_CONTEXT_PROBE_TOKENS", raising=False)
    svc = ModelHealthService()
    assert svc.get_caps_verified("missing") == {
        "stream": None,
        "tools": None,
        "context": {"ok": None, "tokens": 16000},
    }
    svc._states["m"] = ModelProbeState(
        status="healthy",
        checked_at=time.time(),
        stream_ok=False,
        tools_ok=True,
        context_tokens=16000,
        context_ok=None,
    )
    assert svc.get_caps_verified("m") == {
        "stream": False,
        "tools": True,
        "context": {"ok": None, "tokens": 16000},
    }


async def test_context_probe_rotation_prefers_never_tested(monkeypatch):
    monkeypatch.setenv("MODEL_HEALTH_CONTEXT_PROBES_PER_CYCLE", "1")
    monkeypatch.setenv("MODEL_HEALTH_CONTEXT_PROBE_TOKENS", "500")
    monkeypatch.setattr(
        mh,
        "_build_probe_target",
        lambda mid, hint: mh._ProbeTarget("alpha", "http://x", {}, None, mid),
    )
    svc = ModelHealthService()
    svc._catalog = {"m-old": "alpha", "m-new": "alpha"}
    old = time.time() - 8 * 86400
    svc._states = {
        "m-old": ModelProbeState(status="healthy", context_checked_at=old),
        "m-new": ModelProbeState(status="healthy"),
    }
    calls: list[str] = []

    async def fake_probe(target, tokens):
        calls.append(target.upstream_model)
        assert tokens == 500
        return True, ""

    monkeypatch.setattr(svc, "_probe_context", fake_probe)
    await svc._run_context_probes()

    assert calls == ["m-new"], "每轮只测预算内 1 个,且从未测过的优先"
    assert svc._states["m-new"].context_ok is True
    assert svc._states["m-new"].context_tokens == 500
    assert svc._states["m-new"].context_checked_at > 0
    assert svc._states["m-old"].context_ok is None, "超出预算的本轮不动"


async def test_context_probe_skips_recent_and_budget_zero(monkeypatch):
    monkeypatch.setenv("MODEL_HEALTH_CONTEXT_PROBES_PER_CYCLE", "0")
    svc = ModelHealthService()
    svc._catalog = {"m": "alpha"}
    svc._states = {"m": ModelProbeState(status="healthy")}

    async def fail_probe(target, tokens):  # pragma: no cover - 不应被调用
        raise AssertionError("budget=0 时不得发起长上下文探测")

    monkeypatch.setattr(svc, "_probe_context", fail_probe)
    await svc._run_context_probes()
    assert svc._states["m"].context_checked_at == 0

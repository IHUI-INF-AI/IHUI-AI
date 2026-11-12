# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
    _aggregate_sse_reply,
    _build_context_probe_text,
    _check_context_probe_reply,
    _judge_tools_response,
    _judge_tools_stream,
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



class _BothClient:
    """同时支持非流式(post)与流式(stream)的探测客户端桩。

    长上下文针测 2026-11-12 起两路都测(流式优先、非流式复核),桩必须两路都在,
    否则测出来的是桩的缺陷而不是被测逻辑。
    """

    def __init__(self, post_resp=None, stream_ctx=None) -> None:
        self._post = post_resp
        self._ctx = stream_ctx

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, *args, **kwargs):
        if isinstance(self._post, Exception):
            raise self._post
        return self._post

    def stream(self, *args, **kwargs):
        if isinstance(self._ctx, Exception):
            raise self._ctx
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


def test_judge_tools_response_truncated_is_unknown():
    """max_tokens 截断时不能判"不支持":推理模型可能还没轮到发 tool_calls。"""
    body = json.dumps(
        {"choices": [{"message": {"content": ""}, "finish_reason": "length"}]}
    )
    ok, error = _judge_tools_response(200, body)
    assert ok is None
    assert "截断" in error


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


def test_judge_tools_stream_detects_tool_call():
    """WorkBuddy 这类上游只在 SSE 帧里下发 tool_calls:流式判定必须能认出来。"""
    body = (
        'data: {"choices":[{"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n'
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function",'
        '"function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}\n\n'
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n'
        "data: [DONE]\n\n"
    )
    assert _judge_tools_stream(200, body) == (True, "")


def test_judge_tools_stream_text_only_is_false():
    body = (
        'data: {"choices":[{"delta":{"content":"北京晴天"},"finish_reason":null}]}\n\n'
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
        "data: [DONE]\n\n"
    )
    ok, error = _judge_tools_stream(200, body)
    assert ok is False
    assert "未实际触发" in error


def test_judge_tools_stream_empty_name_is_unknown():
    """分片到了但函数名始终为空(流被切断)不能判"不支持"。"""
    body = (
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,'
        '"function":{"name":"","arguments":"{}"}}]},"finish_reason":null}]}\n\n'
    )
    ok, _error = _judge_tools_stream(200, body)
    assert ok is None


def test_judge_tools_stream_falls_back_to_json_body():
    """上游无视 stream 参数直接回 JSON:复用非流式判据。"""
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
    assert _judge_tools_stream(200, body) == (True, "")


def test_judge_tools_stream_5xx_is_unknown():
    assert _judge_tools_stream(503, "upstream unavailable")[0] is None


async def test_probe_tools_timeout_is_unknown():
    svc = ModelHealthService()
    ok, error = await svc._probe_tools(_TimeoutPostClient(), "http://x", {}, "m")
    assert ok is None
    assert "Timeout" in error


class _ToolChoiceFallbackClient:
    """首次以 required 探测被 400 拒绝,退回 auto 后才真正调工具。"""

    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def post(self, _url, headers=None, **kwargs):
        self.calls.append(dict(kwargs.get("json") or {}))
        if len(self.calls) == 1:
            return _Resp(400, '{"error":"tool_choice required is not supported"}')
        return _Resp(
            200,
            json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "tool_calls": [
                                    {
                                        "id": "c1",
                                        "type": "function",
                                        "function": {"name": "get_weather", "arguments": "{}"},
                                    }
                                ]
                            }
                        }
                    ]
                }
            ),
        )


async def test_probe_tools_required_falls_back_to_auto():
    svc = ModelHealthService()
    client = _ToolChoiceFallbackClient()
    ok, error = await svc._probe_tools(client, "http://x", {}, "m")
    assert ok is True, error
    assert client.calls[0]["tool_choice"] == "required"
    assert client.calls[1]["tool_choice"] == "auto"


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


def _plain_stream_ctx(content: str, finish_reason: str = "stop") -> _FakeStreamContext:
    """构造一个"只回纯文本、不含验证码"的流式桩。"""
    lines = [
        _sse({"choices": [{"delta": {"content": content}, "finish_reason": None}]}),
        _sse({"choices": [{"delta": {}, "finish_reason": finish_reason}]}),
        "data: [DONE]",
    ]
    return _FakeStreamContext(200, lines)


async def test_context_probe_flags_wrong_reply(monkeypatch):
    """两路都明确回复"没拿到验证码" ⇒ 判未通过(不能因为一路没判定就放过)。"""
    svc = ModelHealthService()
    resp = _Resp(
        200,
        json.dumps({"choices": [{"message": {"content": "我不知道"}, "finish_reason": "stop"}]}),
    )
    client = _BothClient(post_resp=resp, stream_ctx=_plain_stream_ctx("我不知道"))
    monkeypatch.setattr(mh.httpx, "AsyncClient", lambda **kwargs: client)
    target = mh._ProbeTarget("alpha", "http://x", {}, None, "m")
    ok, error = await svc._probe_context(target, 500)
    assert ok is False
    assert "验证码" in error


@pytest.mark.parametrize("status_code", [429, 500])
async def test_context_probe_account_level_or_5xx_is_unknown(monkeypatch, status_code):
    """限流/上游故障只能记"未知",不能给模型打上"不支持长上下文"。"""
    svc = ModelHealthService()
    resp = _Resp(status_code, '{"error":"rate limit exceeded"}')
    stream = _FakeStreamContext(status_code, [], '{"error":"rate limit exceeded"}')
    client = _BothClient(post_resp=resp, stream_ctx=stream)
    monkeypatch.setattr(mh.httpx, "AsyncClient", lambda **kwargs: client)
    target = mh._ProbeTarget("alpha", "http://x", {}, None, "m")
    ok, error = await svc._probe_context(target, 500)
    assert ok is None
    assert str(status_code) in error


async def test_context_probe_truncated_is_unknown(monkeypatch):
    """推理模型把预算花在思考上被截断 ⇒ 记未知,不能判"不支持长上下文"。"""
    svc = ModelHealthService()
    resp = _Resp(
        200,
        json.dumps(
            {"choices": [{"message": {"content": ""}, "finish_reason": "length"}]}
        ),
    )
    stream = _FakeStreamContext(
        200,
        [
            _sse({"choices": [{"delta": {"reasoning_content": "思考中"}}]}),
            _sse({"choices": [{"delta": {}, "finish_reason": "length"}]}),
        ],
    )
    client = _BothClient(post_resp=resp, stream_ctx=stream)
    monkeypatch.setattr(mh.httpx, "AsyncClient", lambda **kwargs: client)
    target = mh._ProbeTarget("alpha", "http://x", {}, None, "m")
    ok, error = await svc._probe_context(target, 500)
    assert ok is None
    assert "未判定" in error or "截断" in error


async def test_context_probe_stream_pass_short_circuits_non_stream(monkeypatch):
    """流式拿到验证码即判通过,不再发非流式请求(省一次 16k 预填充)。"""
    svc = ModelHealthService()
    _text, code = _build_context_probe_text(500)
    stream = _plain_stream_ctx(code)
    client = _BothClient(post_resp=RuntimeError("不应被调用"), stream_ctx=stream)
    monkeypatch.setattr(mh.httpx, "AsyncClient", lambda **kwargs: client)
    target = mh._ProbeTarget("alpha", "http://x", {}, None, "m")
    ok, error = await svc._probe_context(target, 500)
    assert ok is True, error


async def test_context_probe_non_stream_pass_covers_stream_failure(monkeypatch):
    """流式只回 "OK"、非流式能答出验证码 ⇒ 判通过(deepseek-v4-pro 的实测形态)。

    这是 2026-11-12 的定档依据:两条都是真实客户端路径,任一条通过即说明
    模型读得进 16k;只按流式判会把可用模型打成"不支持长上下文"。
    """
    svc = ModelHealthService()
    _text, code = _build_context_probe_text(500)
    resp = _Resp(
        200,
        json.dumps({"choices": [{"message": {"content": code}, "finish_reason": "stop"}]}),
    )
    client = _BothClient(post_resp=resp, stream_ctx=_plain_stream_ctx("OK"))
    monkeypatch.setattr(mh.httpx, "AsyncClient", lambda **kwargs: client)
    target = mh._ProbeTarget("alpha", "http://x", {}, None, "m")
    ok, error = await svc._probe_context(target, 500)
    assert ok is True, error


async def test_context_probe_reasoning_only_is_unknown(monkeypatch):
    """只有思考帧、可见回复为空 ⇒ 未知,不能记成"不支持"(hy4-preview 的实测形态)。"""
    svc = ModelHealthService()
    resp = _Resp(
        200,
        json.dumps({"choices": [{"message": {"content": ""}, "finish_reason": "stop"}]}),
    )
    stream = _FakeStreamContext(
        200,
        [
            _sse({"choices": [{"delta": {"reasoning_content": "读了很久"}}]}),
            _sse({"choices": [{"delta": {}, "finish_reason": "stop"}]}),
        ],
    )
    client = _BothClient(post_resp=resp, stream_ctx=stream)
    monkeypatch.setattr(mh.httpx, "AsyncClient", lambda **kwargs: client)
    target = mh._ProbeTarget("alpha", "http://x", {}, None, "m")
    ok, _error = await svc._probe_context(target, 500)
    assert ok is None


def test_aggregate_sse_reply_splits_content_and_reasoning():
    body = chr(10).join(
        [
            _sse({"choices": [{"delta": {"reasoning_content": "想"}}]}),
            _sse({"choices": [{"delta": {"content": "IHUI-"}}]}),
            _sse({"choices": [{"delta": {"content": "000500-OK"}}]}),
            _sse({"choices": [{"delta": {}, "finish_reason": "stop"}]}),
            "data: [DONE]",
        ]
    )
    reply, saw_reasoning, truncated = _aggregate_sse_reply(body)
    assert reply == "IHUI-000500-OK"
    assert saw_reasoning is True
    assert truncated is False


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


def test_build_probe_target_keeps_full_id_for_relay(monkeypatch):
    """relay 网关的白名单按带前缀 id 登记:不得剥成裸模型名(否则 403 污染三项能力)。"""
    monkeypatch.setattr(mh, "_resolve_credentials", lambda code: ("k", "http://127.0.0.1:8802/v1"))
    target = mh._build_probe_target("workbuddy/kimi-k3-1", "workbuddy_relay")

    assert target is not None
    assert target.code == "workbuddy_relay"
    assert target.upstream_model == "workbuddy/kimi-k3-1"


def test_build_probe_target_strips_prefix_for_direct_provider(monkeypatch):
    """直连厂商认的是裸模型名:网关前缀必须剥掉。"""
    monkeypatch.setattr(mh, "_resolve_credentials", lambda code: ("k", "https://api.agnes-ai.cn/v1"))
    target = mh._build_probe_target("agnes/agnes-2.5-flash", "agnes")

    assert target is not None
    assert target.upstream_model == "agnes-2.5-flash"


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


async def test_context_probe_initial_coverage_covers_all_untested(monkeypatch):
    """未显式配置预算时,首轮把「从未测过」的模型一次覆盖完(否则前端一天都填不满)。"""
    monkeypatch.delenv("MODEL_HEALTH_CONTEXT_PROBES_PER_CYCLE", raising=False)
    monkeypatch.setenv("MODEL_HEALTH_CONTEXT_PROBE_TOKENS", "500")
    monkeypatch.setattr(
        mh, "_build_probe_target", lambda mid, hint: mh._ProbeTarget("alpha", "http://x", {}, None, mid)
    )
    svc = ModelHealthService()
    svc._catalog = {f"m{i}": "alpha" for i in range(6)}
    svc._states = {f"m{i}": ModelProbeState(status="healthy") for i in range(6)}
    calls: list[str] = []

    async def fake_probe(target, tokens):
        calls.append(target.upstream_model)
        return True, ""

    monkeypatch.setattr(svc, "_probe_context", fake_probe)
    await svc._run_context_probes()

    assert sorted(calls) == [f"m{i}" for i in range(6)]
    assert all(svc._states[f"m{i}"].context_ok is True for i in range(6))
    assert all(svc._states[f"m{i}"].context_checked_at > 0 for i in range(6))


async def test_context_probe_explicit_budget_keeps_acceleration_off(monkeypatch):
    """机主显式配置每轮预算时,首轮加速不得越权放大。"""
    monkeypatch.setenv("MODEL_HEALTH_CONTEXT_PROBES_PER_CYCLE", "2")
    monkeypatch.setenv("MODEL_HEALTH_CONTEXT_PROBE_TOKENS", "500")
    monkeypatch.setattr(
        mh, "_build_probe_target", lambda mid, hint: mh._ProbeTarget("alpha", "http://x", {}, None, mid)
    )
    svc = ModelHealthService()
    svc._catalog = {f"m{i}": "alpha" for i in range(6)}
    svc._states = {f"m{i}": ModelProbeState(status="healthy") for i in range(6)}
    calls: list[str] = []

    async def fake_probe(target, tokens):
        calls.append(target.upstream_model)
        return True, ""

    monkeypatch.setattr(svc, "_probe_context", fake_probe)
    await svc._run_context_probes()

    assert sorted(calls) == ["m0", "m1"], "显式 budget=2 时本轮只测 2 个"


async def test_context_probe_failed_conclusion_retests_sooner_than_passed(monkeypatch):
    """未通过结论不能跟着通过档一起吃 7 天 TTL(2026-11-12 回环事故的教训)。

    事故形态:relay 回环 bug 让 19 个模型拿到 false/null,代码修好后这些结论
    仍按 7 天缓存不退场,界面一直挂着"长上下文未验证"。所以失败档必须更早复测。
    """
    monkeypatch.setenv("MODEL_HEALTH_CONTEXT_PROBES_PER_CYCLE", "10")
    monkeypatch.setenv("MODEL_HEALTH_CONTEXT_PROBE_TOKENS", "500")
    monkeypatch.delenv("MODEL_HEALTH_CONTEXT_RETRY_DAYS", raising=False)
    monkeypatch.setattr(
        mh, "_build_probe_target", lambda mid, hint: mh._ProbeTarget("alpha", "http://x", {}, None, mid)
    )
    now = time.time()
    svc = ModelHealthService()
    svc._catalog = {"failed": "alpha", "passed": "alpha"}
    svc._states = {
        # 两条都是 2 天前测的:通过的还在 7 天窗口内,失败的已过 1 天重试窗
        "failed": ModelProbeState(
            status="healthy", context_ok=False, context_checked_at=now - 2 * 86400
        ),
        "passed": ModelProbeState(
            status="healthy", context_ok=True, context_checked_at=now - 2 * 86400
        ),
    }
    calls: list[str] = []

    async def fake_probe(target, tokens):
        calls.append(target.upstream_model)
        return True, ""

    monkeypatch.setattr(svc, "_probe_context", fake_probe)
    await svc._run_context_probes()

    assert calls == ["failed"], "只该复测未通过的那个,通过的仍在 7 天窗内"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


def test_classify_error_workbuddy_service_info_not_found_is_model_level():
    """WorkBuddy code=11102(账号池没这个模型的 service info)必须判模型级,一次即隐藏。

    2026-11-12 实测:hy4-preview-x / minimax-m3 / hunyuan-2.0-thinking 三个都回这条,
    旧判据里没有这个词,只能记"未知" ⇒ 界面上永远挂着"长上下文未验证",
    实际是上游压根没给这个模型配服务(不是我们的探测没跑通)。
    """
    body = '{"code":11102,"msg":"model [MiniMax-M3] service info not found"}'
    account_level, model_level = mh._classify_error(body, 400)
    assert model_level is True
    assert account_level is False


def test_classify_error_plain_bad_request_stays_non_model_level():
    """普通 400(参数错)不能因为新增关键词被误判成"模型不存在"。"""
    account_level, model_level = mh._classify_error('{"error":"invalid request: bad temperature"}', 400)
    assert model_level is False
    assert account_level is False

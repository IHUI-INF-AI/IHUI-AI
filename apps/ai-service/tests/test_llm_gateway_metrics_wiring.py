# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""llm_gateway → Prometheus 埋点接线回归锁(2026-10-17 立)。

为什么要有这个文件:ihui_llm_* 指标 2026-07-22 就定义了,模块 docstring 写明
"供 llm_gateway.py 埋点调用",但 gateway 从来没调用过 —— 线上 Prometheus 查
30 天保留窗内 `ihui_llm_tokens_total` / `ihui_llm_request_duration_seconds`
**一条时序都没有**,AI 监控大屏因此整片 No data。而 tests/test_llm_metrics.py
一直是绿的:它测的是"手工调 record_llm_call 会不会加数",这件事就算成立,
也证明不了生产路径会调它。

本文件钉死的是另一件事:**走 gw.complete()/gw.astream() 生产收口时指标必须前进**。
把 llm_gateway.py 里任一处 record_llm_outcome 摘掉,对应用例即判红。
"""

from __future__ import annotations

import json
import sys
from types import ModuleType

import pytest

from app.core.llm_gateway import LLMGateway
from app.middleware import llm_metrics


def _sample(metric: object, **labels: str) -> float:
    """从 REGISTRY 里按标签取样本值;取不到按 0 计(未产生过样本 == 0)。"""
    for family in metric.collect():  # type: ignore[attr-defined]
        for s in family.samples:
            if all(s.labels.get(k) == v for k, v in labels.items()):
                return float(s.value)
    return 0.0


def _provider_of(model: str) -> str:
    """与 gateway 埋点同源:标签取模型 ID 的显式厂商前缀,不兜底成 openai。"""
    return model.split("/", 1)[0]


class _FakeUsage:
    def __init__(self, prompt: int, completion: int) -> None:
        self._v = {
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "total_tokens": prompt + completion,
        }

    def model_dump(self) -> dict[str, int]:
        return dict(self._v)


class _FakeMessage:
    def __init__(self, content: str) -> None:
        self.content = content
        self.tool_calls = None
        self.reasoning_content = None


class _FakeResponse:
    def __init__(self, content: str, prompt: int, completion: int) -> None:
        self.usage = _FakeUsage(prompt, completion)
        self.choices = [type("C", (), {"message": _FakeMessage(content), "finish_reason": "stop"})()]
        self.model = "step-3.7-flash"


def _install_fake_litellm(monkeypatch: pytest.MonkeyPatch, response: object) -> ModuleType:
    """把 litellm 换成假模块(gateway 内是 `import litellm` 函数级导入,可整体替换)。"""

    fake = ModuleType("litellm")

    async def fake_acompletion(**kwargs: object) -> object:
        return response

    fake.acompletion = fake_acompletion  # type: ignore[attr-defined]
    fake.token_counter = lambda **kw: 0  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "litellm", fake)
    return fake


@pytest.fixture()
def real_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    """非 stub 模式:配两家厂商,让 gateway 走真实调用分支。

    stepfun 有原生 provider 适配器(complete 走 litellm 没问题),agnes 是纯
    litellm 路径 —— astream 的用例必须用 agnes,否则请求根本不会经过
    litellm.acompletion,测的就不是被埋点的那条链。
    """
    from app.core.config import settings

    monkeypatch.setattr(
        settings,
        "llm_providers",
        json.dumps(
            {
                "stepfun": {"api_key": "sk-test"},
                "agnes": {"api_key": "sk-test-agnes", "api_base": "https://apihub.agnes-ai.com/v1"},
            }
        ),
    )


async def test_complete_success_advances_calls_and_tokens(real_mode, monkeypatch):
    """非流式成功:调用次数、token 双向计数、延迟直方图必须各自前进 1 次。"""
    model = "stepfun/step-3.7-flash"
    p = _provider_of(model)
    _install_fake_litellm(monkeypatch, _FakeResponse("真实回复", 10, 5))

    before_calls = _sample(llm_metrics.llm_calls_total, provider=p, model=model, status="ok")
    before_in = _sample(llm_metrics.llm_tokens_total, provider=p, model=model, direction="input")
    before_out = _sample(
        llm_metrics.llm_tokens_total, provider=p, model=model, direction="output"
    )
    before_dur = _sample(
        llm_metrics.llm_request_duration_seconds, provider=p, model=model, le="+Inf"
    )

    gw = LLMGateway()
    result = await gw.complete([{"role": "user", "content": "test"}], model=model)

    assert result["stub"] is False
    assert _sample(llm_metrics.llm_calls_total, provider=p, model=model, status="ok") == (
        before_calls + 1
    ), "complete() 成功路径没把 ihui_llm_calls_total 推上去(埋点被摘掉/接错位置)"
    assert _sample(llm_metrics.llm_tokens_total, provider=p, model=model, direction="input") == (
        before_in + 10
    )
    assert _sample(llm_metrics.llm_tokens_total, provider=p, model=model, direction="output") == (
        before_out + 5
    )
    assert _sample(
        llm_metrics.llm_request_duration_seconds, provider=p, model=model, le="+Inf"
    ) == (before_dur + 1), "延迟直方图没 observe —— 大屏 P50/P95/P99 将永远是 No data"


async def test_complete_upstream_429_advances_error_metrics(real_mode, monkeypatch):
    """非流式失败:calls{status=error} 与 provider_errors{status=4xx} 各自前进,且不记 ok。"""
    model = "stepfun/step-3.7-flash"
    p = _provider_of(model)

    class _RateLimited(Exception):
        status_code = 429

    fake = ModuleType("litellm")

    async def raise_it(**kwargs: object) -> object:
        raise _RateLimited("Too Many Requests")

    fake.acompletion = raise_it  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "litellm", fake)

    before_err = _sample(llm_metrics.llm_calls_total, provider=p, model=model, status="error")
    before_4xx = _sample(llm_metrics.llm_provider_errors_total, provider=p, status="4xx")
    before_ok = _sample(llm_metrics.llm_calls_total, provider=p, model=model, status="ok")

    gw = LLMGateway()
    result = await gw.complete(
        [{"role": "user", "content": "test"}], model=model, _skip_fallback=True
    )
    assert result.get("error"), "complete() 失败应把 error 回给调用方(指标已在 except 首行记下)"

    assert _sample(llm_metrics.llm_calls_total, provider=p, model=model, status="error") == (
        before_err + 1
    )
    assert _sample(llm_metrics.llm_provider_errors_total, provider=p, status="4xx") == (
        before_4xx + 1
    ), "429 没归到 4xx —— 大屏的 provider 错误率面板会恒等于 0"
    assert _sample(llm_metrics.llm_calls_total, provider=p, model=model, status="ok") == before_ok


class _FakeDelta:
    def __init__(self, content: str | None) -> None:
        self.content = content
        self.reasoning_content = None
        self.tool_calls = None


class _FakeStreamChunk:
    def __init__(self, content: str | None = None, usage: _FakeUsage | None = None) -> None:
        self.choices = (
            [type("C", (), {"delta": _FakeDelta(content), "finish_reason": None})()]
            if content is not None
            else []
        )
        self.usage = usage
        self.model = None


class _FakeStream:
    """litellm 流式对象形状:__aiter__ + aclose(gateway 的 finally 会显式关闭)。"""

    def __init__(self, chunks: list[_FakeStreamChunk], raise_after: int | None = None) -> None:
        self._chunks = chunks
        self._raise_after = raise_after

    def __aiter__(self):
        async def gen():
            for i, c in enumerate(self._chunks):
                if self._raise_after is not None and i >= self._raise_after:
                    raise RuntimeError("upstream connection reset")
                yield c

        return gen()

    async def aclose(self) -> None:
        return None


async def test_astream_success_records_ttft(real_mode, monkeypatch):
    """流式成功:TTFT 直方图必须有样本(大屏首字延迟靠它,不是靠 DB 的 ttftMs)。"""
    model = "agnes/gpt-4o"
    p = _provider_of(model)
    stream = _FakeStream(
        [
            _FakeStreamChunk(content="你"),
            _FakeStreamChunk(content="好"),
            _FakeStreamChunk(usage=_FakeUsage(7, 3)),
        ]
    )

    fake = ModuleType("litellm")

    async def fake_acompletion(**kwargs: object) -> object:
        return stream

    fake.acompletion = fake_acompletion  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "litellm", fake)

    before_ttft = _sample(llm_metrics.llm_ttft_seconds, provider=p, model=model, le="+Inf")
    before_ok = _sample(llm_metrics.llm_calls_total, provider=p, model=model, status="ok")

    gw = LLMGateway()
    events = [e async for e in gw.astream([{"role": "user", "content": "hi"}], model=model)]

    assert any(e.get("type") == "done" for e in events)
    assert _sample(llm_metrics.llm_ttft_seconds, provider=p, model=model, le="+Inf") == (
        before_ttft + 1
    ), "流式没量 TTFT —— ihui_llm_ttft_seconds 将没有桶,大屏首字分位图空板"
    assert _sample(llm_metrics.llm_calls_total, provider=p, model=model, status="ok") == (
        before_ok + 1
    )


async def test_astream_midstream_failure_marks_interrupt(real_mode, monkeypatch):
    """流已发内容后断:必须计一次"流中断",这是中断率面板的唯一数据来源。"""
    model = "agnes/gpt-4o"
    p = _provider_of(model)
    stream = _FakeStream(
        [_FakeStreamChunk(content="半"), _FakeStreamChunk(content="截")], raise_after=1
    )

    fake = ModuleType("litellm")

    async def fake_acompletion(**kwargs: object) -> object:
        return stream

    fake.acompletion = fake_acompletion  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "litellm", fake)

    before_interrupt = _sample(
        llm_metrics.llm_stream_interrupt_total,
        provider=p,
        model=model,
        reason="upstream_error",
    )

    gw = LLMGateway()
    try:
        [e async for e in gw.astream([{"role": "user", "content": "hi"}], model=model)]
    except Exception:
        pass  # 断流是向上抛还是回 error 事件由网关自己定,本用例只判"有没有被记成中断"

    assert _sample(
        llm_metrics.llm_stream_interrupt_total,
        provider=p,
        model=model,
        reason="upstream_error",
    ) == (before_interrupt + 1), "半截流没被记成中断 —— 中断率面板永远是 0"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

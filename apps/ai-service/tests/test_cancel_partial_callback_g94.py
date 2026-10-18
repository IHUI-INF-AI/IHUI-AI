# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# G-94(2026-10-18 立):用户按停止时,半截回答必须交给回调落库。

from __future__ import annotations

import inspect
import re

import pytest

from app.routers.llm import _fire_callback, _interrupted_callback_flush


class _FakeResp:
    status_code = 200


class _FakeClient:
    captured: list[dict] = []  # type: ignore[type-arg]

    def __init__(self, *a: object, **kw: object) -> None:
        pass

    async def __aenter__(self) -> _FakeClient:
        return self

    async def __aexit__(self, *exc: object) -> bool:
        return False

    async def post(self, url: str, json: dict | None = None, **kw: object) -> _FakeResp:  # type: ignore[override]
        _FakeClient.captured.append(json or {})
        return _FakeResp()


@pytest.fixture(autouse=True)
def _cb_env(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_callback_secret", "test-secret")
    monkeypatch.setattr("app.routers.llm.httpx.AsyncClient", _FakeClient)
    _FakeClient.captured = []


# =============================================================================
# 判据本体:补发条件(三条缺一不补)
# =============================================================================


class TestInterruptedFlushDecision:
    def test_closing_with_arrived_text_flushes(self) -> None:
        assert (
            _interrupted_callback_flush(stream_exiting=True, error=None, content="半截回答") is True
        )

    def test_zero_char_cancel_does_not_flush(self) -> None:
        # 票面判据②:零字符时不得落空 assistant 气泡(上游 if (!snapshot.text) return 同判据)。
        for blank in ("", "   ", "\n\n", None):
            assert (
                _interrupted_callback_flush(stream_exiting=True, error=None, content=blank) is False
            )

    def test_in_stream_error_does_not_flush(self) -> None:
        # 流内已判错(模型/供应商错)走的是另一条终态路径,不在这里冒充"半截回答"。
        assert (
            _interrupted_callback_flush(
                stream_exiting=True, error="LLM_ERROR", content="半截回答"
            )
            is False
        )

    def test_normal_completion_not_flushed_here(self) -> None:
        # 正常跑完由 try 之后的原回调路径落库;这里再发一次就是同一幂等键的重复 POST。
        assert (
            _interrupted_callback_flush(stream_exiting=False, error=None, content="完整回答")
            is False
        )


# =============================================================================
# body 形状:标注只在 interrupted=True 时进入,默认两键缺席
# =============================================================================


async def _fire(**kw: object) -> dict:
    await _fire_callback(
        "http://api.test/api/ai/callback",
        {"content": "半截回答", "model": "gpt-x", "usage": None, "stub": False},
        {"conversationId": "c-1", "userId": "u-1", "messageId": "m-1"},
        **kw,  # type: ignore[arg-type]
    )
    assert len(_FakeClient.captured) == 1
    return _FakeClient.captured[0]


class TestFireCallbackInterruptedBody:
    async def test_interrupted_writes_both_keys(self) -> None:
        body = await _fire(interrupted=True)
        assert body["interrupted"] is True
        assert body["interruptReason"] == "user_cancelled"
        assert body["content"] == "半截回答"

    async def test_default_body_has_neither_key(self) -> None:
        body = await _fire()
        assert "interrupted" not in body
        assert "interruptReason" not in body


# =============================================================================
# 装车锁:补发必须挂在 finally 顶部(取消路径唯一能跑到的地方)
# =============================================================================


def test_flush_call_sits_in_the_finally() -> None:
    """判"补写挂在走得到的那一段",不判"代码里出现过这个函数名"。

    结构性事实:生成器 try/finally **之后**那段"流结束后异步回调"在
    GeneratorExit / CancelledError 两条分支上根本到不了(两处 except 都 raise 出去),
    所以把补写挂在那里等于什么都没修。这里取 finally 到兜底关停之间的那一段源码,
    要求调用点确实落在其中。
    """
    src = inspect.getsource(inspect.getmodule(_fire_callback) or "")
    assert "def _interrupted_callback_flush(" in src, "取态函数从未入库 ⇒ 判据本体缺席"
    positions = [m.start() for m in re.finditer(r"_interrupted_callback_flush\(", src)]
    assert len(positions) >= 2, "调用点不存在 ⇒ 只造了尺子没装车"
    # 取**第一处**:调用点住在流式端点的 finally 里(文件靠前),定义在其后(模块尾部)。
    call_at = positions[0]
    finally_at = src.rfind("finally:", 0, call_at)
    assert finally_at != -1, "调用点之前没有 finally ⇒ 不在取消路径跑得到的那一段"
    between = src[finally_at:call_at]
    assert len(between) < 3000, "finally 与调用点距离异常 ⇒ 锚点认错"
    assert "def " not in between, "两个锚点之间跨了函数定义 ⇒ 锚点认错"
    # 排在兜底关停之前:那段之后任何 yield/await 都可能被 GeneratorExit 打断。
    after = src[call_at : call_at + 4000]
    assert "aclose_async_gen" in after, "补发未与兜底关停同处一段 finally"
    # 只 fire 不 await:取消作用域内裸 await 会把后面的四项清理整批跳过(本文件既有纪律)。
    assert "await _fire_callback" not in after
    assert "await _interrupted_callback_flush" not in after
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""输入上下文溢出应急压缩(2026-10-30 立,对齐 Qoder/Trae)镜像测试。

覆盖三维,缺一不算结清:
① 判据侧 —— 各家措辞认得出、非溢出措辞(限流/输出截断/5xx)绝不认成溢出;
② 装车侧 —— 主动压缩腿仍受灰度总闸管(``compaction_enabled=False`` 时线上今天不压),
   而应急腿在同一种默认态下**必须**工作(否则本票等于没改);
③ 失效方向侧 —— 总闸 off / 窗口取不到 / 次数用尽,都不得比改动前更糟,
   且必须抛出**原始异常**(不得把"救火失败"变成"救火本身炸了"这种新故障)。

夹具口径(本册首版踩过的坑,写给下一位):确定性压缩器的 ``trigger_ratio`` 同时是
「这次压缩算不算见效」的地板(``core/context_compaction.py`` 防循环保护 —— 压缩后仍
>= trigger_threshold 即判 incompressible 并拒收)。所以窗口与历史必须配得下真实收益:
本册统一用 32K 窗口 + 约 48K token 历史(压后落到约 8K,稳在六成线以下)。拿 8K 窗口
配小手笔会被判 incompressible,看起来像"功能没生效",其实是夹具不成立。
"""

from __future__ import annotations

import asyncio

import pytest

from app.core.context_overflow import __test__ as overflow_judge
from app.services.agent_loop_v2 import (
    MAX_OVERFLOW_RECOVERY_ATTEMPTS,
    AgentLoopV2,
    ToolDefinition,
)

#: 夹具用的模型窗口(tokens)。见模块头注「夹具口径」。
_WINDOW = 32_768
_OVERFLOW_TEXT = f"Error code: 400 - This model's maximum context length is {_WINDOW} tokens."


async def _noop_llm(messages: list, tools: object) -> dict:  # pragma: no cover
    return {"content": "不该被调用", "tool_calls": None}


def _echo_tool() -> ToolDefinition:
    async def _executor(args: dict) -> dict:
        return {"echo": args.get("text", "")}

    return ToolDefinition(
        name="echo",
        description="回显",
        parameters={
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": [],
        },
        executor=_executor,
    )


def _long_history(n_pairs: int = 30) -> list[dict]:
    """长历史:system + n 对长 user/assistant + 末条提问(约 48K token,压得动)。"""
    filler = "历史上下文内容," * 100
    msgs: list[dict] = [{"role": "system", "content": "你是回显助手。"}]
    for i in range(n_pairs):
        msgs.append({"role": "user", "content": f"第{i}轮提问 {filler}"})
        msgs.append({"role": "assistant", "content": f"第{i}轮回答 {filler}"})
    msgs.append({"role": "user", "content": "现在回显 hi"})
    return msgs


# ---------------------------------------------------------------------------
# ① 判据侧
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "Error code: 400 - {'error': {'message': \"This model's maximum context length is 8192 tokens. However, your messages resulted in 12000 tokens.\", 'type': 'invalid_request_error', 'code': 'context_length_exceeded'}}",
        "Error code: 400 - prompt is too long: 210000 tokens > 200000 maximum",
        "BadRequestError: 400 too many input tokens in your prompt; reduce your prompt and try again",
        "litellm.BadRequestError: 400 exceeds model context window of 32768 tokens",
        "请求失败:上下文长度超出模型限制,当前输入 130000 tokens",
        "HTTP 400 提示词过长，请缩短输入内容后重试",
    ],
)
def test_overflow_phrases_are_recognised(message: str) -> None:
    assert overflow_judge["is_context_overflow_error"](RuntimeError(message)) is True


@pytest.mark.parametrize(
    "message",
    [
        "Error code: 429 - {'error': {'message': 'Rate limit reached for requests', 'code': 'rate_limit_exceeded'}}",
        "Error code: 500 - Internal Server Error",
        "Connection reset by peer",
        "upstream stream closed before finish_reason=model_context_window_exceeded",
        "Error code: 401 - Invalid API key",
        "the context of the conversation is helpful, please continue",
    ],
)
def test_non_overflow_errors_are_never_misread(message: str) -> None:
    assert overflow_judge["is_context_overflow_error"](RuntimeError(message)) is False


def test_overflow_code_attr_beats_uninformative_text() -> None:
    class _ProviderError(RuntimeError):
        code = "context_length_exceeded"

    assert overflow_judge["is_context_overflow_error"](_ProviderError("")) is True


def test_overflow_recognised_through_wrapped_cause_chain() -> None:
    inner = ValueError("This model's maximum context length is 8192 tokens")
    outer = RuntimeError("网关调用失败")
    outer.__cause__ = inner
    assert overflow_judge["is_context_overflow_error"](outer) is True


def test_cancelled_error_is_never_overflow() -> None:
    # 用户取消 ≠ 载荷超限:误判会让取消路径白跑一次压缩。
    assert overflow_judge["is_context_overflow_error"](asyncio.CancelledError()) is False
    outer = asyncio.CancelledError()
    outer.__cause__ = RuntimeError("maximum context length")
    assert overflow_judge["is_context_overflow_error"](outer) is False


def test_self_referencing_chain_terminates_and_says_no() -> None:
    a = RuntimeError("boom")
    b = RuntimeError("wrapped")
    a.__cause__ = b
    b.__cause__ = a  # 环
    assert overflow_judge["is_context_overflow_error"](a) is False


def test_none_input_is_not_overflow() -> None:
    assert overflow_judge["is_context_overflow_error"](None) is False


def test_output_truncation_finish_reason_still_not_treated_as_overflow() -> None:
    """同名字样分家:model_context_window_exceeded 是**输出**侧 finish_reason,
    既有截断续写判据照常成立,而溢出判据必须为 False(两条腿不得互相抢活)。"""
    from app.services.agent_loop_v2 import is_output_token_limit_finish_reason

    message = "upstream stopped with finish_reason=model_context_window_exceeded"
    assert is_output_token_limit_finish_reason("model_context_window_exceeded") is True
    assert overflow_judge["is_context_overflow_error"](RuntimeError(message)) is False


# ---------------------------------------------------------------------------
# ② 装车侧:应急腿必须在主动腿关闭时工作
# ---------------------------------------------------------------------------


async def test_overflow_recovery_works_with_proactive_compaction_off() -> None:
    """核心一条:主动压缩关(线上默认态)时,上游报溢出仍须压一次并救回请求。

    改动前这里是「白重试几轮然后会话死掉」;本用例即那张交付凭据。
    """
    seen_counts: list[int] = []
    calls = {"n": 0}

    async def mock_llm(messages: list, tools: object) -> dict:
        seen_counts.append(len(messages))
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError(_OVERFLOW_TEXT)
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_echo_tool()],
        max_iterations=3,
        compaction_enabled=False,  # 主动腿关(= 线上默认)
        compaction_context_limit=_WINDOW,
    )
    result = await loop.run(_long_history())

    assert result.success is True
    assert calls["n"] == 2
    assert seen_counts[1] < seen_counts[0], "重试必须带更小的载荷"
    triggers = [ev.get("trigger") for ev in result.compaction_events]
    assert triggers == ["input_overflow_recovery"]


async def test_overflow_recovery_needs_no_retry_slot() -> None:
    """溢出不是瞬时故障:不得占用退避重试名额。

    llm_retry_max=0 的调用方按旧上界连一次重试名额都没有(遇溢出必死);
    本用例钉住「零名额也能救」这一条,顺带钉住应急腿不睡退避。
    """
    calls = {"n": 0}

    async def mock_llm(messages: list, tools: object) -> dict:
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("Error code: 400 - prompt is too long: 90000 tokens")
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_echo_tool()],
        max_iterations=3,
        llm_retry_max=0,
        compaction_context_limit=_WINDOW,
    )
    result = await loop.run(_long_history())

    assert result.success is True
    assert calls["n"] == 2


async def test_proactive_path_untouched_when_no_overflow() -> None:
    """上游没报溢出 ⇒ 一行都不动:不压缩、不多调、事件为空(与改动前逐字节同形)。"""
    seen_counts: list[int] = []

    async def mock_llm(messages: list, tools: object) -> dict:
        seen_counts.append(len(messages))
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_echo_tool()],
        max_iterations=3,
        compaction_enabled=False,
        compaction_context_limit=_WINDOW,
    )
    result = await loop.run(_long_history())

    assert result.success is True
    assert result.compaction_events == []
    assert seen_counts == [len(_long_history())]


async def test_ordinary_5xx_keeps_existing_retry_path_and_does_not_compact() -> None:
    """非溢出错误走原退避重试,不得被顺手压缩(静默丢历史是比失败更糟的结果)。"""
    calls = {"n": 0}

    async def mock_llm(messages: list, tools: object) -> dict:
        calls["n"] += 1
        if calls["n"] <= 2:
            raise RuntimeError("Error code: 502 - Bad Gateway")
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_echo_tool()],
        max_iterations=3,
        llm_retry_max=3,
        compaction_context_limit=_WINDOW,
    )
    result = await loop.run(_long_history())

    assert result.success is True
    assert calls["n"] == 3
    assert result.compaction_events == []


# ---------------------------------------------------------------------------
# ③ 失效方向侧
# ---------------------------------------------------------------------------


async def test_gray_release_total_switch_off_disables_recovery_too(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AGENT_COMPACTION_MODE=off 是唯一总闸:关掉它应急腿也必须停(不新增第二个开关)。"""
    monkeypatch.setenv("AGENT_COMPACTION_MODE", "off")
    calls = {"n": 0}

    async def mock_llm(messages: list, tools: object) -> dict:
        calls["n"] += 1
        raise RuntimeError(_OVERFLOW_TEXT)

    loop = AgentLoopV2(
        mock_llm,
        [_echo_tool()],
        max_iterations=2,
        llm_retry_max=1,
        compaction_context_limit=_WINDOW,
    )
    result = await loop.run(_long_history())

    assert result.success is False
    assert result.compaction_events == []
    # 1 次首试 + 1 次原有退避重试 —— 证明救火腿在本用例里一次都没派生
    assert calls["n"] == 2


async def test_unknown_context_window_leaves_behaviour_unchanged() -> None:
    """窗口取不到(limit<=0)⇒ 不压缩,原始错误照常上抛(与改动前同形)。"""
    calls = {"n": 0}

    async def mock_llm(messages: list, tools: object) -> dict:
        calls["n"] += 1
        raise RuntimeError(_OVERFLOW_TEXT)

    loop = AgentLoopV2(
        mock_llm,
        [_echo_tool()],
        max_iterations=2,
        llm_retry_max=0,
        compaction_context_limit=0,
    )
    result = await loop.run(_long_history())

    assert result.success is False
    assert result.compaction_events == []
    assert calls["n"] == 1


async def test_persistent_overflow_terminates_and_reports_original_error() -> None:
    """反复溢出:必须收手(不变成无限重试),且失败原因仍是上游那一条。"""
    calls = {"n": 0}

    async def mock_llm(messages: list, tools: object) -> dict:
        calls["n"] += 1
        raise RuntimeError(_OVERFLOW_TEXT)

    loop = AgentLoopV2(
        mock_llm,
        [_echo_tool()],
        max_iterations=2,
        llm_retry_max=0,
        compaction_context_limit=_WINDOW,
    )
    result = await loop.run(_long_history())

    assert result.success is False
    assert "maximum context length" in (result.error or "")
    # 上界 = 首试 + 应急名额;再多一次就说明救火自己长了循环
    assert calls["n"] <= 1 + MAX_OVERFLOW_RECOVERY_ATTEMPTS
    assert len(result.compaction_events) <= MAX_OVERFLOW_RECOVERY_ATTEMPTS


def test_recovery_helper_stops_when_budget_exhausted() -> None:
    """次数上界直接判(不靠集成推断):预算为 0 时 helper 必须拒压、且不记事件。"""
    loop = AgentLoopV2(_noop_llm, [_echo_tool()], compaction_context_limit=_WINDOW)
    loop._compaction_events = []
    loop._overflow_recovery_left = 0

    assert loop._compact_for_overflow_recovery(_long_history()) is None
    assert loop._compaction_events == []


def test_recovery_helper_shrinks_payload_when_budget_available() -> None:
    """预算在、窗口正 ⇒ helper 真压得动(②③ 走的是同一条压缩出口,不是测试特供)。"""
    loop = AgentLoopV2(_noop_llm, [_echo_tool()], compaction_context_limit=_WINDOW)
    loop._compaction_events = []
    loop._overflow_recovery_left = MAX_OVERFLOW_RECOVERY_ATTEMPTS
    history = _long_history()

    recovered = loop._compact_for_overflow_recovery(history)

    assert recovered is not None
    assert len(recovered) < len(history)
    assert recovered[0]["role"] == "system", "system 必须原样保留"
    assert loop._compaction_events[-1]["trigger"] == "input_overflow_recovery"


async def test_recovery_budget_resets_per_run() -> None:
    """次数按 run 计:同一实例第二次 run 仍须有满额救赎机会。

    跨 run 累积会让长会话后期彻底失去保护 —— 而那时正是最容易超限的时候。
    判据按载荷长度而非调用序号:每个 run 的首试都带全量历史 ⇒ 必溢出,压过即通过。
    """

    async def mock_llm(messages: list, tools: object) -> dict:
        if len(messages) > 15:
            raise RuntimeError(_OVERFLOW_TEXT)
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_echo_tool()],
        max_iterations=2,
        llm_retry_max=0,
        compaction_context_limit=_WINDOW,
    )
    first = await loop.run(_long_history())
    second = await loop.run(_long_history())

    assert first.success is True
    assert second.success is True
    assert len(second.compaction_events) == 1, "第二次 run 的预算没有被第一次 run 吃掉"


__test__ = {
    "MAX_OVERFLOW_RECOVERY_ATTEMPTS": MAX_OVERFLOW_RECOVERY_ATTEMPTS,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""advisor_consult / AdvisorBudget 单测(G-11 协议层:指定模型咨询 + 会话级次数预算)。

判据只读生产实现(advisor.consult / AdvisorBudget / mcp_server 的注册表与 handler),
不在测试里复制一份阈值;``llm_gateway.complete`` 全程被假网关替换 —— 不真连网、
不碰 DB/Redis(§5 测试隔离)。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.services import advisor as advisor_mod
from app.services import mcp_server
from app.services.advisor import (
    ADVISOR_MAX_USES_CAP,
    ADVISOR_MAX_USES_DEFAULT,
    ADVISOR_PROMPT_MAX_CHARS,
    AdvisorBudget,
    consult,
)


class _FakeGateway:
    """记录每次调用参数的假网关:用例只关心"调了几次、用了哪个模型、有没有关改道"。"""

    def __init__(self, result: dict[str, Any]) -> None:
        self.result = result
        self.calls: list[dict[str, Any]] = []

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        **extra: Any,
    ) -> dict[str, Any]:
        self.calls.append({"messages": messages, "model": model, **extra})
        return self.result


def _install_gateway(
    monkeypatch: pytest.MonkeyPatch, result: dict[str, Any]
) -> _FakeGateway:
    fake = _FakeGateway(result)
    monkeypatch.setattr(advisor_mod, "llm_gateway", fake)
    return fake


@pytest.fixture()
def fresh_budget(monkeypatch: pytest.MonkeyPatch) -> AdvisorBudget:
    """每个用例一枚干净预算(进程内单例不跨用例串味)。"""
    budget = AdvisorBudget()
    monkeypatch.setattr(advisor_mod, "advisor_budget", budget)
    return budget


def _ok_result(model: str = "m-ok") -> dict[str, Any]:
    return {"content": "咨询答案", "model": model, "stub": False}


# ---------------------------------------------------------------------------
# ① 预算用尽:具名错误码 + 被拒不计次
# ---------------------------------------------------------------------------


async def test_budget_exhausted_is_named_and_denials_are_not_counted(
    monkeypatch: pytest.MonkeyPatch, fresh_budget: AdvisorBudget
) -> None:
    fake = _install_gateway(monkeypatch, _ok_result("m1"))
    call = {
        "principal": "u1",
        "session_id": "s1",
        "prompt": "子问题",
        "model": "m1",
        "max_uses": 2,
    }

    first = await consult(**call)
    second = await consult(**call)
    third = await consult(**call)
    fourth = await consult(**call)

    assert (first["ok"], first["used"], first["remaining"]) == (True, 1, 1)
    assert (second["ok"], second["used"], second["remaining"]) == (True, 2, 0)
    for denied in (third, fourth):
        assert denied["ok"] is False
        assert denied["errorCode"] == "ADVISOR_BUDGET_EXHAUSTED"
        # 被拒的两次都不计次:used 停在 2,且一次都没发起 LLM 调用
        assert denied["used"] == 2
        assert denied["remaining"] == 0
    assert len(fake.calls) == 2


# ---------------------------------------------------------------------------
# ② 不同 (属主, 会话) 互不影响
# ---------------------------------------------------------------------------


async def test_budget_is_scoped_to_principal_and_session(
    monkeypatch: pytest.MonkeyPatch, fresh_budget: AdvisorBudget
) -> None:
    _install_gateway(monkeypatch, _ok_result("m1"))
    base: dict[str, Any] = {"prompt": "q", "model": "m1", "max_uses": 1}

    assert (await consult(principal="u1", session_id="s1", **base))["ok"] is True
    # 换属主 / 换会话都各自有一份额度
    assert (await consult(principal="u2", session_id="s1", **base))["ok"] is True
    assert (await consult(principal="u1", session_id="s2", **base))["ok"] is True
    # 原 (u1, s1) 仍是用尽状态
    again = await consult(principal="u1", session_id="s1", **base)
    assert again["errorCode"] == "ADVISOR_BUDGET_EXHAUSTED"


# ---------------------------------------------------------------------------
# ③ 空 prompt / 超长 prompt 被拒,且不动预算也不发请求
# ---------------------------------------------------------------------------


async def test_empty_and_overlong_prompt_rejected_without_touching_budget(
    monkeypatch: pytest.MonkeyPatch, fresh_budget: AdvisorBudget
) -> None:
    fake = _install_gateway(monkeypatch, _ok_result("m1"))

    empty = await consult(principal="u1", session_id="s1", prompt="   ", model="m1")
    too_long_text = "a" * (ADVISOR_PROMPT_MAX_CHARS + 1)
    too_long = await consult(
        principal="u1", session_id="s1", prompt=too_long_text, model="m1"
    )

    assert empty["errorCode"] == "ADVISOR_PROMPT_EMPTY"
    assert too_long["errorCode"] == "ADVISOR_PROMPT_TOO_LONG"
    assert too_long["prompt_chars"] == ADVISOR_PROMPT_MAX_CHARS + 1
    # 错误体只回长度,不回显原文
    assert too_long_text not in str(too_long)
    assert fake.calls == []

    # 被拒的两次都没吃预算:下一次仍是第 1 次
    ok = await consult(principal="u1", session_id="s1", prompt="q", model="m1")
    assert (ok["ok"], ok["used"]) == (True, 1)


# ---------------------------------------------------------------------------
# ④ 缺身份被拒:handler 层 fail-closed,一次都不碰 LLM
# ---------------------------------------------------------------------------


async def test_handler_rejects_missing_host_identity_without_calling_llm(
    monkeypatch: pytest.MonkeyPatch, fresh_budget: AdvisorBudget
) -> None:
    fake = _install_gateway(monkeypatch, _ok_result("m1"))

    for arguments in (
        {"prompt": "q"},
        {"prompt": "q", "__user_id": "u1"},
        {"prompt": "q", "__session_id": "s1"},
        {"prompt": "q", "__user_id": "  ", "__session_id": "s1"},
        {"prompt": "q", "__user_id": "u1", "__session_id": "   "},
    ):
        result = await mcp_server._tool_advisor_consult(dict(arguments))
        assert result["tool"] == "advisor_consult"
        assert result["ok"] is False
        assert result["errorCode"] == "PRINCIPAL_REQUIRED"
        assert result["missingKeys"]

    assert fake.calls == []


# ---------------------------------------------------------------------------
# ⑤ 指定模型不可用:不回落(既不换默认模型,也不再试第二次)
# ---------------------------------------------------------------------------


async def test_unavailable_model_fails_closed_without_fallback(
    monkeypatch: pytest.MonkeyPatch, fresh_budget: AdvisorBudget
) -> None:
    fake = _install_gateway(
        monkeypatch,
        {
            "content": "",
            "model": "ghost-model",
            "stub": False,
            "error": True,
            "error_message": "model not found",
            "errorCode": "LLM_ERROR",
        },
    )

    result = await consult(
        principal="u1", session_id="s1", prompt="q", model="ghost-model"
    )

    assert result["ok"] is False
    assert result["errorCode"] == "ADVISOR_MODEL_UNAVAILABLE"
    assert result["model"] == "ghost-model"
    assert result["reason"] == "LLM_ERROR"
    assert "content" not in result
    # 只调了一次,且那一次就打在指定的模型上 + 显式关掉网关自动改道
    assert len(fake.calls) == 1
    assert fake.calls[0]["model"] == "ghost-model"
    assert fake.calls[0]["_skip_fallback"] is True
    # 真的发出了请求 ⇒ 计 1 次(不是在预算上假装没发生)
    assert (result["used"], result["remaining"]) == (1, ADVISOR_MAX_USES_DEFAULT - 1)


async def test_gateway_reroute_is_rejected_even_without_error(
    monkeypatch: pytest.MonkeyPatch, fresh_budget: AdvisorBudget
) -> None:
    """防御性一格:网关没报错却换了模型 ⇒ 也不采用(答案不是被问的那个模型给的)。"""
    _install_gateway(monkeypatch, {"content": "别人的答案", "model": "m-other"})

    result = await consult(principal="u1", session_id="s1", prompt="q", model="m-asked")

    assert result["ok"] is False
    assert result["errorCode"] == "ADVISOR_MODEL_UNAVAILABLE"
    assert result["model"] == "m-asked"
    assert result["fallbackModel"] == "m-other"
    assert "content" not in result


# ---------------------------------------------------------------------------
# ⑥ 成功路径:content / used / remaining 正确;未指定模型即用网关默认
# ---------------------------------------------------------------------------


async def test_success_returns_content_and_counters(
    monkeypatch: pytest.MonkeyPatch, fresh_budget: AdvisorBudget
) -> None:
    fake = _install_gateway(monkeypatch, _ok_result("m2"))

    first = await consult(
        principal="u1", session_id="s1", prompt="q", model="m2", max_uses=3
    )
    second = await consult(
        principal="u1", session_id="s1", prompt="q", model="m2", max_uses=3
    )
    defaulted = await consult(principal="u1", session_id="s1", prompt="q")

    assert (first["ok"], first["content"], first["model"]) == (True, "咨询答案", "m2")
    assert (first["used"], first["remaining"]) == (1, 2)
    assert (second["used"], second["remaining"]) == (2, 1)
    assert first["stub"] is False
    # 未指定 model ⇒ model=None 交给网关默认,且不需要关改道(没有"点名的模型"可保)
    assert fake.calls[-1]["model"] is None
    assert fake.calls[-1]["_skip_fallback"] is False
    assert (defaulted["ok"], defaulted["used"], defaulted["remaining"]) == (True, 3, 0)


async def test_max_uses_defaults_and_clamps_to_cap(
    monkeypatch: pytest.MonkeyPatch, fresh_budget: AdvisorBudget
) -> None:
    fake = _install_gateway(monkeypatch, _ok_result("m1"))
    kwargs: dict[str, Any] = {"prompt": "q", "model": "m1"}

    # 缺省上限 = ADVISOR_MAX_USES_DEFAULT
    for _ in range(ADVISOR_MAX_USES_DEFAULT):
        assert (await consult(principal="u1", session_id="s1", **kwargs))["ok"] is True
    exhausted = await consult(principal="u1", session_id="s1", **kwargs)
    assert exhausted["errorCode"] == "ADVISOR_BUDGET_EXHAUSTED"
    assert exhausted["limit"] == ADVISOR_MAX_USES_DEFAULT

    # 显式给超过硬上界的值 ⇒ 收到 CAP,不会真的放行 99 次
    capped = await consult(
        principal="u2", session_id="s1", max_uses=99, **kwargs
    )
    assert (capped["ok"], capped["limit"], capped["remaining"]) == (
        True,
        ADVISOR_MAX_USES_CAP,
        ADVISOR_MAX_USES_CAP - 1,
    )
    assert len(fake.calls) == ADVISOR_MAX_USES_DEFAULT + 1


# ---------------------------------------------------------------------------
# ⑦ 并发 consume 不超发
# ---------------------------------------------------------------------------


async def test_concurrent_consume_never_overspends() -> None:
    budget = AdvisorBudget()
    limit = 3

    outcomes = await asyncio.gather(
        *(budget.consume(("u1", "s1"), limit) for _ in range(10))
    )

    allowed = [item for item in outcomes if item[0]]
    denied = [item for item in outcomes if not item[0]]
    assert len(allowed) == limit
    # 放行的记数恰好是 1..limit(没有重复计、也没有跳过)
    assert sorted(item[1] for item in allowed) == [1, 2, 3]
    assert len(denied) == 10 - limit
    assert all((item[1], item[2]) == (limit, 0) for item in denied)


# ---------------------------------------------------------------------------
# ⑧ 注册面:声明 ↔ handler 双射 + schema 形状 + handler 端到端接线
# ---------------------------------------------------------------------------


def test_tool_is_declared_and_paired_in_registry() -> None:
    declared = [tool for tool in mcp_server._TOOLS if tool.name == "advisor_consult"]
    assert len(declared) == 1
    assert mcp_server._TOOL_HANDLERS["advisor_consult"] is mcp_server._tool_advisor_consult

    schema = declared[0].input_schema
    assert schema["type"] == "object"
    assert schema["required"] == ["prompt"]
    assert schema["properties"]["prompt"]["type"] == "string"
    assert schema["properties"]["model"]["type"] == "string"
    max_uses = schema["properties"]["max_uses"]
    assert max_uses["type"] == "integer"
    assert (max_uses["minimum"], max_uses["maximum"]) == (1, ADVISOR_MAX_USES_CAP)


async def test_handler_uses_injected_identity_as_budget_key(
    monkeypatch: pytest.MonkeyPatch, fresh_budget: AdvisorBudget
) -> None:
    fake = _install_gateway(monkeypatch, _ok_result("m1"))

    first = await mcp_server._tool_advisor_consult(
        {
            "prompt": "q",
            "model": "m1",
            "max_uses": 1,
            "__user_id": "u1",
            "__session_id": "s1",
        }
    )
    second = await mcp_server._tool_advisor_consult(
        {
            "prompt": "q",
            "model": "m1",
            "max_uses": 1,
            "__user_id": "u1",
            "__session_id": "s1",
        }
    )

    assert first["tool"] == "advisor_consult"
    assert (first["ok"], first["used"], first["remaining"]) == (True, 1, 0)
    assert second["errorCode"] == "ADVISOR_BUDGET_EXHAUSTED"
    assert len(fake.calls) == 1
    # 身份取自宿主注入(非 schema 字段),prompt 原样进消息体
    assert fake.calls[0]["messages"] == [{"role": "user", "content": "q"}]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 参数化指令片段「声明面」接线测试(2026-11-01 装载口补齐批 · 第二笔)
#
# 本笔要钉的三条不变量(主席定义)与一条接线锁:
#   ① env 默认关 ⇒ 输出与接前**逐字节相同**(即使声明面有货也不读);
#   ② env 开 ⇒ 已声明片段确定性地出现在消息尾部、顺序稳定(同输入同输出,不掺时刻/随机);
#   ③ 非法/缺项声明 ⇒ 沿用装载口既有「单 try 整批隔离」,既有断言一字不破(绝不伪造正文);
#   ④ 三个真实构造点(agents._new_v2_loop / engine 工厂 / agent_plan._execute_plan)确实把
#      `instructional_inputs_from_env()` 传进构造器 —— 不是"造好没装车"(§0.9)。
#
# 判据单一真相源(§0.6):期望值一律现调 app.core.instructional_fragments 的 build_* 生成,
# 本文件不复制任何模板正文/上限常量;声明读口也只有生产那一个实现。
# 测试隔离:不连 PG/Redis;三个工厂里的 llm/工具装配全部换成桩(不触 mcp_server)。
from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest

from app.core import instructional_fragments as F
from app.routers import agent_plan as agent_plan_router
from app.routers import agents as agents_router
from app.routers import engine as engine_router
from app.services import agent_loop_v2 as loop_mod
from app.services.agent_loop_v2 import (
    INSTRUCTIONAL_INPUTS_ENV,
    AgentLoopV2,
    instructional_inputs_from_env,
    normalize_instructional_inputs,
)

_ENV_ON = "AGENT_INSTRUCTIONAL_FRAGMENTS_ENABLED"

#: 一份"八枚都能装满"的服务端声明(正文只是测试用短句,不含任何模板常量)。
_DECLARATION: dict[str, Any] = {
    "managed_developer_instructions": "遵守平台合规基线",
    "multi_agent_mode": "proactive",
    "multi_agent_usage_hint": "delegate when parallelizable",
    "persistent_instructions_template": "stay persistent {{ approval_request_channel }}",
    "send_user_message_async_available": True,
    "plugin_instruction": "custom plugin guidance",
    "recommended_plugins": [["Alpha", "alpha_id"]],
    "internal_model_context": {"source": "policy", "body": "internal note"},
    "unsupported_media": ["image", "audio"],
}


async def _noop_llm(messages, tools, **kwargs):  # noqa: ANN001, ANN002, ANN003, ANN202
    return {"content": "done", "tool_calls": None}


def _make_loop(monkeypatch: pytest.MonkeyPatch, *, env_on: bool, **kw: Any) -> AgentLoopV2:
    """按 env 现状构造循环:声明面一律走生产的唯一读口,不手搓 dict。"""
    monkeypatch.delenv(_ENV_ON, raising=False)
    if env_on:
        monkeypatch.setenv(_ENV_ON, "on")
    return AgentLoopV2(
        _noop_llm,
        [],
        enable_checkpoint=False,
        checkpoint_manager=object(),
        session_id="sess-instr-decl",
        chain="main",
        instructional_inputs=instructional_inputs_from_env(),
        **kw,
    )


def _declare(monkeypatch: pytest.MonkeyPatch, payload: Any) -> None:
    raw = payload if isinstance(payload, str) else json.dumps(payload)
    monkeypatch.setenv(INSTRUCTIONAL_INPUTS_ENV, raw)


def _expected_tail() -> list[dict[str, Any]]:
    """按装载口文档顺序现调 builder 生成期望尾部(单一真相源:不抄正文)。"""
    return [
        F.build_managed_developer_instructions_fragment(
            _DECLARATION["managed_developer_instructions"]
        ),
        F.build_multi_agent_mode_fragment("proactive", ""),
        F.build_multi_agent_usage_hint_fragment(_DECLARATION["multi_agent_usage_hint"]),
        F.build_persistent_mode_fragment(
            "persistent",
            _DECLARATION["persistent_instructions_template"],
            send_user_message_async_available=True,
        ),
        F.build_plugin_instruction_fragment(_DECLARATION["plugin_instruction"]),
        F.build_recommended_plugins_instructions_fragment([("Alpha", "alpha_id")]),
        F.build_internal_model_context_fragment("policy", "internal note"),
        F.build_unsupported_media_fragment("image"),
        F.build_unsupported_media_fragment("audio"),
    ]


def _expected_four() -> list[dict[str, Any]]:
    """批58 已有的参数无关四枚(接后仍在位,不被补齐批挤掉)。"""
    return [
        F.build_apps_instructions_fragment(),
        F.build_available_plugins_instructions_fragment(),
        F.build_environments_instructions_fragment(),
        F.build_user_verification_notice_fragment(),
    ]


# ---------------------------------------------------------------------------
# A. 声明面唯一读口:未设置 / 坏 JSON / 形态坏一律"未声明",绝不猜正文
# ---------------------------------------------------------------------------
def test_env_unset_means_empty_declaration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(INSTRUCTIONAL_INPUTS_ENV, raising=False)
    assert instructional_inputs_from_env() == {}


def test_env_roundtrip_keeps_all_declared_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(INSTRUCTIONAL_INPUTS_ENV, json.dumps(_DECLARATION))
    got = instructional_inputs_from_env()
    assert got["managed_developer_instructions"] == "遵守平台合规基线"
    assert got["multi_agent_mode"] == "proactive"
    assert got["send_user_message_async_available"] is True
    assert got["recommended_plugins"] == [["Alpha", "alpha_id"]]
    assert got["internal_model_context"] == {"source": "policy", "body": "internal note"}
    assert got["unsupported_media"] == ["image", "audio"]


@pytest.mark.parametrize("raw", ["{not json", "[]", '"just-a-string"', "null", "123"])
def test_bad_env_payload_is_empty_not_fabricated(
    monkeypatch: pytest.MonkeyPatch, raw: str
) -> None:
    """坏配置的唯一后果是"不声明";既不抛错阻塞回合,也不拿空串顶正文。"""
    monkeypatch.setenv(INSTRUCTIONAL_INPUTS_ENV, raw)
    assert instructional_inputs_from_env() == {}


def test_normalize_drops_wrong_typed_values_without_coercion() -> None:
    dirty: Any = {
        "managed_developer_instructions": 123,
        "multi_agent_mode": "   ",
        "multi_agent_custom_text": None,
        "send_user_message_async_available": "true",  # 字符串不冒充布尔
        "recommended_plugins": [],
        "unsupported_media": ["image"],
        "internal_model_context": {"source": "policy"},  # 缺 body
        "unknown_key": "ignored",
    }
    assert normalize_instructional_inputs(dirty) == {"unsupported_media": ["image"]}
    assert normalize_instructional_inputs(None) == {}
    assert normalize_instructional_inputs(["not", "a", "dict"]) == {}


# ---------------------------------------------------------------------------
# 不变量①:env 关 ⇒ 逐字节相同(声明面有货也不读)
# ---------------------------------------------------------------------------
def test_off_is_byte_identical_even_when_declared(monkeypatch: pytest.MonkeyPatch) -> None:
    _declare(monkeypatch, _DECLARATION)
    loop = _make_loop(monkeypatch, env_on=False)
    assert loop._instructional_inputs  # 声明确实进了构造器(证明零差异不是"没声明"造成的)
    msgs: list[dict[str, Any]] = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_instructional_fragments(msgs)
    assert msgs == before


# ---------------------------------------------------------------------------
# 不变量②:env 开 ⇒ 确定性 + 位置稳定(尾部,顺序 = 装载口文档顺序)
# ---------------------------------------------------------------------------
def test_on_injects_declaration_deterministically_in_stable_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _declare(monkeypatch, _DECLARATION)
    kwargs: dict[str, Any] = {"model_params": {"reasoning_effort": "persistent"}}
    loop = _make_loop(monkeypatch, env_on=True, **kwargs)

    m1: list[dict[str, Any]] = [{"role": "user", "content": "hi"}]
    m2: list[dict[str, Any]] = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(m1)
    loop._inject_instructional_fragments(m2)
    assert m1 == m2  # 同输入同输出:不掺时刻/随机数

    assert m1[0] == {"role": "user", "content": "hi"}  # 原文一字不动,只追加
    assert m1[1:5] == _expected_four()  # 批58 四枚仍在位、位置不变
    assert m1[5:] == _expected_tail()  # 参数化八枚(unsupported_media 两值出两条)

    # 换一个实例(同一份 env)重放:位置与内容仍逐字相同 ⇒ 不依赖实例状态
    again = _make_loop(monkeypatch, env_on=True, **kwargs)
    m3: list[dict[str, Any]] = [{"role": "user", "content": "hi"}]
    again._inject_instructional_fragments(m3)
    assert m3 == m1


# ---------------------------------------------------------------------------
# 不变量③:缺项 ⇒ 该枚不注入;非法值 ⇒ 沿用既有整批隔离(不抛、不伪造)
# ---------------------------------------------------------------------------
def test_missing_declaration_injects_only_existing_four(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(INSTRUCTIONAL_INPUTS_ENV, raising=False)
    loop = _make_loop(monkeypatch, env_on=True)
    assert loop._instructional_inputs == {}
    msgs: list[dict[str, Any]] = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(msgs)
    assert msgs == [{"role": "user", "content": "hi"}, *_expected_four()]


def test_illegal_mode_value_isolated_by_existing_batch_try(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """语义判据仍在 builder:未知档位 ⇒ 抛错 ⇒ 装上口单 try 整批隔离(既有语义不变)。"""
    _declare(
        monkeypatch,
        {
            "managed_developer_instructions": "先注入的这枚保留",
            "multi_agent_mode": "no_such_mode",
            "unsupported_media": ["image"],
        },
    )
    loop = _make_loop(monkeypatch, env_on=True)
    msgs: list[dict[str, Any]] = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(msgs)  # 不抛:整批隔离
    assert msgs == [
        {"role": "user", "content": "hi"},
        *_expected_four(),
        F.build_managed_developer_instructions_fragment("先注入的这枚保留"),
    ]
    assert "image content omitted" not in json.dumps(msgs, ensure_ascii=False)


# ---------------------------------------------------------------------------
# ④ 接线锁:三个真实构造点都把声明面传进构造器(行为面,不是读源码)
# ---------------------------------------------------------------------------
class _RecordingLoop:
    """替代 AgentLoopV2 的记账桩:只记录构造 kwargs,不跑任何真实装配。"""

    #: 最近一次构造的 kwargs(供"就地构造、不带回句柄"的工厂断言)。
    last_kwargs: dict[str, Any] = {}

    def __init__(self, *_args: Any, **kwargs: Any) -> None:
        self.kwargs = kwargs
        _RecordingLoop.last_kwargs = kwargs

    async def run(self, _messages: list[dict[str, Any]]) -> Any:
        return SimpleNamespace(
            success=True, final_response="", stop_reason="done", error=None, iterations=[]
        )


def _patch_factories(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_tools(*_a: Any, **_k: Any) -> list[Any]:
        return []

    monkeypatch.setattr(agents_router, "_build_loop_v2_tools", _fake_tools)
    monkeypatch.setattr(agents_router, "_make_loop_v2_llm", lambda model: object())
    monkeypatch.setattr(agent_plan_router, "_build_readonly_tools", lambda names: [])
    monkeypatch.setattr(loop_mod, "AgentLoopV2", _RecordingLoop)
    monkeypatch.setattr(agent_plan_router, "AgentLoopV2", _RecordingLoop)
    monkeypatch.setattr(
        agent_plan_router, "plan_store", SimpleNamespace(save=lambda rec: None)
    )


async def test_agents_factory_passes_declaration(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_factories(monkeypatch)
    _declare(monkeypatch, _DECLARATION)
    loop = await agents_router._new_v2_loop(
        model=None,
        tools=None,
        max_iterations=1,
        session_id="s1",
        current_user="u1",
        user_role=0,
    )
    assert loop.kwargs["instructional_inputs"] == normalize_instructional_inputs(_DECLARATION)


async def test_engine_factory_passes_declaration(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_factories(monkeypatch)
    _declare(monkeypatch, _DECLARATION)
    factory = engine_router._make_loop_factory()
    loop = await factory({"session_id": "s1", "user_id": "u1", "role_id": 0}, [])
    assert loop.kwargs["instructional_inputs"] == normalize_instructional_inputs(_DECLARATION)


async def test_plan_factory_passes_declaration(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_factories(monkeypatch)
    _declare(monkeypatch, _DECLARATION)
    rec = SimpleNamespace(
        plan_id="p1",
        plan_md="",
        goal="g",
        status="approved",
        result=None,
        updated_at="",
    )
    await agent_plan_router._execute_plan(rec, frozenset())
    # _execute_plan 就地构造,不带回句柄 ⇒ 从桩类最近一次记账取
    recorded = _RecordingLoop.last_kwargs
    assert recorded["instructional_inputs"] == normalize_instructional_inputs(_DECLARATION)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

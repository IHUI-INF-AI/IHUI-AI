# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 指令片段装载口接线测试(2026-11-01 装载口补齐批)
#
# 钉住"接前不生效 → 接后生效":
# ① 接前:除 build_network_rule_saved_fragment(经 network_rule_amendments 装载)与
#    参数无关四枚(批58 已接)外,其余参数化 build_* 在全仓装载口**零调用**;
#    装载函数源码是这一事实的静态证据,本文件先锁"接后每枚都被装载口引用"。
# ② 接后:同一函数 `_inject_instructional_fragments`、同一 env 开关
#    AGENT_INSTRUCTIONAL_FRAGMENTS_ENABLED(默认 off,语义不变)下,参数化片段
#    在"开关开 ∧ 承载层经 instructional_inputs 声明了输入"时确实进消息注入;
#    未声明 ⇒ 一枚不加(绝不伪造正文)。
# 测试隔离:不连 PG/Redis;纯内存循环实例。
from __future__ import annotations

import inspect

import pytest

from app.core import instructional_fragments as F
from app.services.agent_loop_v2 import AgentLoopV2

_ENV = "AGENT_INSTRUCTIONAL_FRAGMENTS_ENABLED"


async def _noop_llm(messages, tools, **kwargs):  # noqa: ANN001, ANN002, ANN003, ANN202
    return {"content": "done", "tool_calls": None}


def _make_loop(monkeypatch: pytest.MonkeyPatch, env: str | None = None, **kw) -> AgentLoopV2:
    monkeypatch.delenv(_ENV, raising=False)
    if env is not None:
        monkeypatch.setenv(_ENV, env)
    return AgentLoopV2(
        _noop_llm,
        [],
        enable_checkpoint=False,
        checkpoint_manager=object(),
        session_id="sess-frag-wiring",
        chain="main",
        **kw,
    )


_FULL_INPUTS = {
    "managed_developer_instructions": "遵守平台合规基线",
    "multi_agent_mode": "proactive",
    "multi_agent_usage_hint": "delegate when parallelizable",
    "persistent_instructions_template": "stay persistent {{ approval_request_channel }}",
    "plugin_instruction": "custom plugin guidance",
    "recommended_plugins": [["Alpha", "alpha_id"]],
    "internal_model_context": {"source": "policy", "body": "internal note"},
    "unsupported_media": ["image", "audio"],
}


def _joined(msgs: list) -> str:
    return "\n".join(str(m.get("content")) for m in msgs)


# ---------------------------------------------------------------------------
# 1. 开关语义:off 零差异 / 非法 env 按 off / on 无输入时只加既有四枚
# ---------------------------------------------------------------------------
def test_off_with_inputs_zero_change(monkeypatch: pytest.MonkeyPatch) -> None:
    loop = _make_loop(monkeypatch, instructional_inputs=_FULL_INPUTS)  # env 未设=off
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_instructional_fragments(msgs)
    assert msgs == before  # 接前/接后同一纪律:开关关 ⇒ 逐零差异


def test_illegal_env_treated_as_off(monkeypatch: pytest.MonkeyPatch) -> None:
    loop = _make_loop(
        monkeypatch, env="maybe", instructional_inputs=_FULL_INPUTS
    )
    assert loop._instructional_fragments_enabled is False
    msgs = [{"role": "user", "content": "hi"}]
    before = [dict(m) for m in msgs]
    loop._inject_instructional_fragments(msgs)
    assert msgs == before


def test_on_without_inputs_loads_only_existing_four(
    monkeypatch: pytest.MonkeyPatch
) -> None:
    loop = _make_loop(monkeypatch, env="on")
    msgs = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(msgs)
    assert len(msgs) == 5  # 回归锚:批58 四枚,接后不多不少
    assert "<managed_developer_instructions>" not in _joined(msgs)


# ---------------------------------------------------------------------------
# 2. 接后核心:开关开 ∧ 输入声明 ⇒ 参数化片段确实进注入
# ---------------------------------------------------------------------------
def test_on_with_full_inputs_loads_all_fragments(monkeypatch: pytest.MonkeyPatch) -> None:
    loop = _make_loop(
        monkeypatch,
        env="on",
        instructional_inputs=dict(_FULL_INPUTS),
        model_params={"reasoning_effort": "persistent"},
    )
    msgs = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(msgs)
    # 4(既有) + 8(参数化;unsupported_media 两值 ⇒ 该枚出两条)= 1+4+1+1+1+1+1+1+2
    assert len(msgs) == 14
    joined = _joined(msgs)
    assert F.MANAGED_DEVELOPER_INSTRUCTIONS_OPEN_TAG in joined
    assert "遵守平台合规基线" in joined
    assert F.MULTI_AGENT_MODE_OPEN_TAG in joined
    assert F.PROACTIVE_MULTI_AGENT_MODE_TEXT[:60] in joined
    assert "delegate when parallelizable" in joined
    assert F.PERSISTENT_MODE_OPEN_TAG in joined
    assert "custom plugin guidance" in joined
    assert F.RECOMMENDED_PLUGINS_OPEN_TAG in joined
    assert "- Alpha (alpha_id)" in joined
    assert '<codex_internal_context source="policy">' in joined
    assert "image content omitted because you do not support image input" in joined
    assert "audio content omitted because you do not support audio input" in joined
    # 既有四枚仍在位(未被补齐批挤掉)
    assert "## Apps (Connectors)" in joined
    assert F.ENVIRONMENTS_INSTRUCTIONS_OPEN_TAG in joined
    assert F.USER_VERIFICATION_NOTICE_OPEN_TAG in joined


def test_persistent_fragment_gated_by_reasoning_effort(
    monkeypatch: pytest.MonkeyPatch
) -> None:
    """非 persistent 档位 ⇒ builder 返回 None ⇒ 不注入(装载不改判据)。"""
    loop = _make_loop(
        monkeypatch,
        env="on",
        instructional_inputs={
            "persistent_instructions_template": "stay persistent",
        },
        model_params={"reasoning_effort": "low"},
    )
    msgs = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(msgs)
    assert len(msgs) == 5
    assert F.PERSISTENT_MODE_OPEN_TAG not in _joined(msgs)


def test_custom_mode_empty_text_not_injected(
    monkeypatch: pytest.MonkeyPatch
) -> None:
    loop = _make_loop(
        monkeypatch,
        env="on",
        instructional_inputs={"multi_agent_mode": "custom", "multi_agent_custom_text": ""},
    )
    msgs = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(msgs)
    assert len(msgs) == 5
    assert F.MULTI_AGENT_MODE_OPEN_TAG not in _joined(msgs)


def test_illegal_shapes_are_skipped_not_fabricated(
    monkeypatch: pytest.MonkeyPatch
) -> None:
    loop = _make_loop(
        monkeypatch,
        env="on",
        instructional_inputs={
            "managed_developer_instructions": 123,  # 非 str ⇒ 跳过
            "multi_agent_mode": "no_such_mode",  # 非法档 ⇒ builder raise ⇒ 整批隔离
            "unsupported_media": ["video", "image"],  # video 非法值 ⇒ 不收
        },
    )
    msgs = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(msgs)
    # multi_agent_mode 非法值在既有整批 try 隔离中降级:此前已追加的参数无关四枚保留,
    # 之后的片段不再追加(与批58 单 try 语义一致)。
    assert F.MANAGED_DEVELOPER_INSTRUCTIONS_OPEN_TAG not in _joined(msgs)
    assert "image content omitted" not in _joined(msgs)


def test_managed_over_limit_isolated_by_batch_try(monkeypatch: pytest.MonkeyPatch) -> None:
    """超 10k token ⇒ builder 抛 ValueError ⇒ 既有整批异常隔离,不阻塞、不注入该枚。"""
    loop = _make_loop(
        monkeypatch,
        env="on",
        instructional_inputs={
            "managed_developer_instructions": "x" * (
                F.MAX_MANAGED_DEVELOPER_INSTRUCTIONS_TOKENS * F.BYTES_PER_TOKEN + 1
            )
        },
    )
    msgs = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(msgs)
    assert len(msgs) == 5  # 只有参数无关四枚
    assert F.MANAGED_DEVELOPER_INSTRUCTIONS_OPEN_TAG not in _joined(msgs)


# ---------------------------------------------------------------------------
# 3. 静态源锁:装载口引用了全部十二枚 builder(network_rule_saved 除外,它另有装载点)
# ---------------------------------------------------------------------------
def test_loader_references_all_wired_builders() -> None:
    src = inspect.getsource(AgentLoopV2._inject_instructional_fragments)
    # 只解析函数体内的装载 import 块(方法 docstring 会点名 network_rule_saved 的
    # 装载点归属,那是叙述不是调用)
    _head = src.split("from app.core.instructional_fragments import (", 1)
    assert len(_head) == 2, "装载口未从 instructional_fragments import"
    import_block = _head[1].split(")", 1)[0]
    for name in (
        "build_apps_instructions_fragment",
        "build_plugin_instruction_fragment",
        "build_available_plugins_instructions_fragment",
        "build_recommended_plugins_instructions_fragment",
        "build_environments_instructions_fragment",
        "build_multi_agent_mode_fragment",
        "build_multi_agent_usage_hint_fragment",
        "build_persistent_mode_fragment",
        "build_managed_developer_instructions_fragment",
        "build_user_verification_notice_fragment",
        "build_internal_model_context_fragment",
        "build_unsupported_media_fragment",
    ):
        assert name in import_block, f"装载口缺引用: {name}"
    # build_network_rule_saved_fragment 的装载点仍在 network_rule_amendments,未被搬走
    assert "build_network_rule_saved_fragment" not in import_block


def test_instructional_inputs_validated_at_construction(
    monkeypatch: pytest.MonkeyPatch
) -> None:
    with pytest.raises(ValueError):
        _make_loop(monkeypatch, instructional_inputs=["not-a-dict"])


def test_run_twice_deterministic(monkeypatch: pytest.MonkeyPatch) -> None:
    loop = _make_loop(
        monkeypatch,
        env="on",
        instructional_inputs=dict(_FULL_INPUTS),
        model_params={"reasoning_effort": "persistent"},
    )
    m1: list = [{"role": "user", "content": "hi"}]
    m2: list = [{"role": "user", "content": "hi"}]
    loop._inject_instructional_fragments(m1)
    loop._inject_instructional_fragments(m2)
    assert m1 == m2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

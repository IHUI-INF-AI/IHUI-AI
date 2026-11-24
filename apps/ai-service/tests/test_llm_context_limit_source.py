# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""聊天端自动压缩上限的来源(2026-10-31 立,对齐 Qoder/Trae 的「不因客户端漏传字段而死」)。

现场:`routers/llm.py` 两处压缩门此前写成 ``if req.context_limit and req.context_limit > 0``,
而 ``context_limit`` 由客户端自报 ⇒ 不带该字段的调用方**完全没有自动压缩**,一旦超窗
就由提供方回 400 打死会话。执行器侧(``agents._new_v2_loop``)早已按模型解析,聊天侧漏了。

本册钉三样:优先级次序(客户端 > env > 模型 > 兜底)、两处门真的走了同一个出口
(形状锁,防"helper 写好了但门还在读客户端字段"),以及客户端仍可覆盖(运维/端上
显式意图不被服务端猜的值压掉)。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.model_context_window import DEFAULT_CONTEXT_WINDOW
from app.routers.llm import LLMCompleteRequest, _effective_context_limit


def _req(**kw: object) -> LLMCompleteRequest:
    return LLMCompleteRequest(messages=[{"role": "user", "content": "hi"}], **kw)  # type: ignore[arg-type]


def test_client_declared_limit_wins_over_model_and_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """客户端显式声明仍最优先 —— 端上意图不得被服务端猜的值压掉。"""
    monkeypatch.setenv("AGENT_COMPACTION_CONTEXT_LIMIT", "99999")
    assert _effective_context_limit(_req(model="deepseek-chat", context_limit=7000)) == 7000


def test_env_override_wins_when_client_omits_field(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """运维覆盖能力保持不变:客户端没传、env 配了 ⇒ 用 env(与 agents 侧同一优先级)。"""
    monkeypatch.setenv("AGENT_COMPACTION_CONTEXT_LIMIT", "55000")
    assert _effective_context_limit(_req(model="deepseek-chat")) == 55000


@pytest.mark.parametrize(
    ("model", "expected"),
    [
        ("deepseek-chat", 64_000),  # 低窗口例外表
        ("gemma-2-9b-it", 8_192),
        ("some-brand-new-model-1m", DEFAULT_CONTEXT_WINDOW),  # 未知模型走兜底
        (None, DEFAULT_CONTEXT_WINDOW),
    ],
)
def test_absent_client_field_resolves_from_model(
    model: str | None, expected: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    """核心一格:客户端漏传 context_limit 时,按请求模型解析而不是干脆不压。"""
    monkeypatch.delenv("AGENT_COMPACTION_CONTEXT_LIMIT", raising=False)
    assert _effective_context_limit(_req(model=model)) == expected


@pytest.mark.parametrize("declared", [0, None])
def test_zero_and_none_client_field_are_treated_as_absent(
    declared: int | None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """0 与缺省同义(都是"客户端没表态"),都落到模型解析。"""
    monkeypatch.delenv("AGENT_COMPACTION_CONTEXT_LIMIT", raising=False)
    req = _req(model="deepseek-chat", context_limit=declared)
    assert _effective_context_limit(req) == 64_000


def test_negative_or_non_int_client_field_does_not_disable_compaction() -> None:
    """负数/非整型是脏输入:不得被当成"关闭压缩",也不得让请求炸。"""
    assert _effective_context_limit(_req(model="deepseek-chat", context_limit=-5)) == 64_000


def test_both_chat_gates_now_use_the_shared_resolver() -> None:
    """形状锁:两处门必须走 _effective_context_limit,且旧的"只认客户端字段"门形不得残留。

    摘掉本断言所钉的实现(把门改回读 req.context_limit)必须翻红 —— 否则 helper
    就成了"造好没装车"的那一格(AGENTS.md §0.9)。
    """
    source = (Path(__file__).resolve().parents[1] / "app/routers/llm.py").read_text(
        encoding="utf-8"
    )
    assert "if req.context_limit and req.context_limit > 0:" not in source
    assert source.count("_ctx_limit = _effective_context_limit(req)") == 2
    assert source.count("compress_messages_if_needed(messages, _ctx_limit)") == 2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

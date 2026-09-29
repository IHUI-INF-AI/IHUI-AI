# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSE 事件契约单一事实源测试(#25,2026-09-16 立)。

覆盖:
- SSE_EVENTS 事件名集合完整性(26 个:2026-09-19 补录 fallback/usage/steer/budget、
  删 repair/resumed 孤儿事件)与无重复
- SSE_EVENT_CONTRACTS 清单与 SSE_EVENTS 集合严格对齐
- #25 补录的 3 个对话流漂移事件(plan_updated/terminal_start/terminal_end)

注: TS 侧(packages/shared/src/sse/contract.ts)与 PY 侧的集合一致性由
scripts/check-agent-event-parity.mjs 守门断言, 本文件不重复。
"""

from __future__ import annotations

from app.core.sse_contract import SSE_EVENT_CONTRACTS, SSE_EVENTS


def test_sse_events_completeness() -> None:
    """事件名集合共 32 个且无重复。

    这个数字此前**落后实际两轮**还一路报绿:`26` 是 2026-09-19 的读数,D113 入
    `tool-delta`、V3 #63 入 `form_request` 都没同步它 ⇒ 本用例红在干净 HEAD 上
    (即"恒红门"那一型,AGENTS §12f)。下面那条对齐用例同时补上了 `tool-delta` 缺失的
    契约条目 —— 两处都是记账缺口,不是本票引入的行为变化。

    30 → 31 是 D151(2026-09-29)新增 `terminal_interaction` 一帧;31 → 32 是 D152
    (2026-09-29)新增 `goal_updated` 一帧:**改被审代码的写法必须同时改审它的数字**,
    否则这条计数就变成替旧契约背书的死账。
    """
    assert len(SSE_EVENTS) == 32
    assert len(set(SSE_EVENTS)) == 32
    # D151 的新帧必须真在集合里(光有计数会放过"删了别的、加了这个"):
    assert "terminal_interaction" in SSE_EVENTS
    # D152 同理 —— 计数只保证"没少",点名才保证"加的就是这一名":
    assert "goal_updated" in SSE_EVENTS


def test_sse_events_p4_d1_steer_members() -> None:
    """2026-09-19 入契约的 4 个事件在位(P4-2 降级/D1 计量帧/Steer 引导注入/预算分档提醒)。"""
    assert {"fallback", "usage", "steer", "budget"} <= SSE_EVENTS


def test_sse_events_contains_dialog_drift_events() -> None:
    """#25 补录的 3 个对话流漂移事件在契约内。"""
    assert {"plan_updated", "terminal_start", "terminal_end"} <= SSE_EVENTS
    # D34(2026-09-22):运行环境交代两帧必须同时出现在两份契约里
    # (事件名为我方协议自定,字段形状才是竞品实证部分;TS 侧见
    #  packages/shared/src/sse/__tests__/contract.test.ts 的同名用例)
    assert {"injection_applied", "retry_scheduled"} <= SSE_EVENTS


def test_sse_events_core_members() -> None:
    """核心流式事件在位。"""
    assert {
        "chunk",
        "reasoning",
        "thinking",
        "tool-call-start",
        "tool-result",
        "subagent_spawn",
        "plan-step",
        "done",
        "error",
        "compaction",
    } <= SSE_EVENTS


def test_contracts_align_with_events() -> None:
    """SSE_EVENT_CONTRACTS 清单与 SSE_EVENTS 集合严格一致(不多不少)。"""
    contract_names = [c.name for c in SSE_EVENT_CONTRACTS]
    assert len(contract_names) == len(set(contract_names)), "契约清单存在重复条目"
    assert set(contract_names) == SSE_EVENTS


def test_every_contract_has_payload_fields() -> None:
    """每个契约条目均登记 payload 字段提示(文档性最低要求)。"""
    for contract in SSE_EVENT_CONTRACTS:
        assert contract.payload_fields, f"契约事件 {contract.name} 未登记 payload_fields"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

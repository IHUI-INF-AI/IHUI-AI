# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-816004(2026-10-13)审批代际 CAS 接线测试(_approval_registry 待决表)。

CAS 判面本体(approval_generation_cas.ApprovalGenerationCas,双码分形/迟到
resolve/超时结算)由 test_approval_generation_cas.py 的 12 例钉死,本文件只测
**接线**:

- 注册盖章:_request_approval 把 generation(初始 0)+ content_digest(决策
  payload)同时写进 _approval_registry 条目与 CAS 判面(⑤);
- 结算双比对:resolve_approval_for_requester / resolve_approval_response 的
  持章 resolve 先过 CAS 双比对(路由代锁先于内容锁)——
  ① 同代同快照 ⇒ APPLIED(正常结算);
  ② 换代 ⇒ SUPERSEDED(reasonCode 与 CAS 逐字同形),零副作用、名额不消耗;
  ③ 快照变 ⇒ SNAPSHOT_MISMATCH(与 ② 不同形,不得并码),零副作用;
  ④ 迟到 resolve ⇒ False / ALREADY_SETTLED、不抛异常、副作用零发生;
- 叠加不是替换:未持章的既有通道行为逐零差异(claim_settlement 原子语义不动)。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.services.agent_loop_v2 import (
    AgentLoopV2,
    ApprovalOutcome,
    ToolCall,
    ToolDefinition,
    _ApprovalEntry,
    _approval_generation_cas,
    _approval_registry,
    resolve_approval_for_requester,
    resolve_approval_response,
)
from app.services.approval_generation_cas import (
    STATE_PENDING,
    STATE_RESOLVED,
    ApprovalSpec,
    content_digest,
)

_ARGS = {"query": "北京天气"}
_DIGEST = content_digest({"tool": "mcp_tool", "args": _ARGS})


@pytest.fixture(autouse=True)
def _clean_approval_tables():
    """隔离两张全局表:_approval_registry 可清;CAS 单例条目按 id 隔离(测试用
    一次性 id,互不串台;deadline 一律 None 不起计时器)。"""
    _approval_registry.clear()
    yield
    _approval_registry.clear()


def _stamp_and_register(
    approval_id: str,
    generation: int = 0,
    snapshot_digest: str = _DIGEST,
    owner_user_id: str | None = None,
) -> _ApprovalEntry:
    """按 _request_approval 的同一盖章形状登记:注册表条目 + CAS 判面各一份。"""
    entry = _ApprovalEntry(event=asyncio.Event(), owner_user_id=owner_user_id)
    _approval_registry[approval_id] = entry
    _approval_generation_cas.register(
        ApprovalSpec(
            request_id=approval_id,
            session_id="wire-test",
            tool_name="mcp_tool",
            generation=generation,
            snapshot_digest=snapshot_digest,
        )
    )
    return entry


class _RecordingEvent:
    """可观察的唤醒事件替身:计数 set() 调用(④ 副作用断言用)。"""

    def __init__(self) -> None:
        self.set_calls = 0

    def set(self) -> None:
        self.set_calls += 1

    def is_set(self) -> bool:
        return True


async def test_same_generation_same_snapshot_resolves_applied() -> None:
    """① 同代同快照 ⇒ 放行:APPLIED、决策写入、等待方被唤醒、CAS 落 resolved。"""
    entry = _stamp_and_register("appr-wire-ok")
    outcome = resolve_approval_for_requester(
        "appr-wire-ok", "approve", None, generation=0, snapshot_digest=_DIGEST
    )
    assert outcome is ApprovalOutcome.APPLIED
    assert entry.decision == "approve"
    assert entry.event.is_set()
    assert _approval_generation_cas.state_of("appr-wire-ok") == STATE_RESOLVED
    # 布尔出口同向
    assert (
        resolve_approval_response(
            "appr-wire-ok", "approve", None, generation=0, snapshot_digest=_DIGEST
        )
        is False  # 迟到:第一次已结算,布尔出口 False(零副作用)
    )


async def test_generation_bump_rejected_superseded_without_side_effects() -> None:
    """② 换代 ⇒ 拒且 reasonCode=superseded;零副作用,且结算名额不消耗。"""
    entry = _stamp_and_register("appr-wire-gen", generation=0, snapshot_digest=_DIGEST)
    outcome = resolve_approval_for_requester(
        "appr-wire-gen", "approve", None, generation=1, snapshot_digest=_DIGEST
    )
    assert outcome is ApprovalOutcome.SUPERSEDED
    assert outcome.value == "superseded"
    assert outcome.value != "snapshot_mismatch"  # 两码不同形,不得并码
    # 零副作用:决策未写、事件未发、CAS 条目仍 pending
    assert entry.decision is None
    assert not entry.event.is_set()
    assert _approval_generation_cas.state_of("appr-wire-gen") == STATE_PENDING
    # 名额未被陈旧持章者消耗:真正持章者随后仍可正常结算
    assert (
        resolve_approval_for_requester(
            "appr-wire-gen", "approve", None, generation=0, snapshot_digest=_DIGEST
        )
        is ApprovalOutcome.APPLIED
    )
    assert entry.decision == "approve"


async def test_snapshot_change_rejected_snapshot_mismatch_without_side_effects() -> None:
    """③ 快照变 ⇒ 拒且 reasonCode=snapshot_mismatch(与 superseded 不同形)。"""
    entry = _stamp_and_register("appr-wire-snap", generation=0, snapshot_digest=_DIGEST)
    outcome = resolve_approval_for_requester(
        "appr-wire-snap", "approve", None, generation=0, snapshot_digest="digest-tampered"
    )
    assert outcome is ApprovalOutcome.SNAPSHOT_MISMATCH
    assert outcome.value == "snapshot_mismatch"
    assert outcome.value != "superseded"  # 两码不同形,不得并码
    assert entry.decision is None
    assert not entry.event.is_set()
    assert _approval_generation_cas.state_of("appr-wire-snap") == STATE_PENDING
    assert (
        resolve_approval_for_requester(
            "appr-wire-snap", "approve", None, generation=0, snapshot_digest=_DIGEST
        )
        is ApprovalOutcome.APPLIED
    )
    assert entry.decision == "approve"


async def test_late_resolve_returns_false_with_zero_side_effects() -> None:
    """④ 迟到 resolve ⇒ False / ALREADY_SETTLED、不抛异常、任何副作用都没发生。"""
    entry = _stamp_and_register("appr-wire-late", generation=0, snapshot_digest=_DIGEST)
    assert (
        resolve_approval_for_requester(
            "appr-wire-late", "approve", None, generation=0, snapshot_digest=_DIGEST
        )
        is ApprovalOutcome.APPLIED
    )
    # 换上可观察事件:迟到 resolve 不得再触发任何唤醒
    recorder = _RecordingEvent()
    entry.event = recorder  # type: ignore[assignment]
    # 布尔出口:False,不抛异常
    assert (
        resolve_approval_response(
            "appr-wire-late", "reject", None, generation=0, snapshot_digest=_DIGEST
        )
        is False
    )
    # 详情出口:迟到折叠为 ALREADY_SETTLED(不是"换代"语义)
    assert (
        resolve_approval_for_requester(
            "appr-wire-late", "reject", None, generation=0, snapshot_digest=_DIGEST
        )
        is ApprovalOutcome.ALREADY_SETTLED
    )
    # 副作用零发生:决策保持先到者的 approve,事件零触发
    assert entry.decision == "approve"
    assert recorder.set_calls == 0


async def test_unchaptered_resolve_keeps_legacy_behavior() -> None:
    """叠加不是替换:未持章 resolve 不启用 CAS,行为与既有通道逐零差异。"""
    entry = _stamp_and_register("appr-wire-legacy", generation=0, snapshot_digest=_DIGEST)
    assert resolve_approval_response("appr-wire-legacy", "approve", None) is True
    assert entry.decision == "approve"
    assert entry.event.is_set()
    # 重复未持章应答仍走 G-637 一次性结算
    assert resolve_approval_response("appr-wire-legacy", "reject", None) is False
    assert entry.decision == "approve"


async def test_request_approval_stamps_generation_and_digest(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """⑤ 注册盖章接线:_request_approval 把 generation=0 + content_digest(决策
    payload)写进 CAS 判面,持章 resolve 直接唤醒等待方(工具放行返回 None)。"""
    import app.services.agent_loop_v2 as mod
    from app.services import approval_persistence as ap

    async def _no_review(tool_name: str, args: Any, **kwargs: Any) -> Any:
        return mod.unavailable_review("disabled")

    monkeypatch.setattr(mod, "request_guardian_review", _no_review)
    # 持久层打桩:防测试写 approval_grants.db(check → 未命中,grant → 记调用)
    grants: list[tuple[str, str]] = []
    monkeypatch.setattr(ap, "check", lambda key, kind: None)
    monkeypatch.setattr(
        ap, "grant", lambda scope, key, kind: grants.append((scope, key)) or True
    )

    async def _executor(args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True}

    loop = AgentLoopV2(
        lambda messages, tools: None,  # type: ignore[arg,return-value] — 不会被调
        [
            ToolDefinition(
                name="mcp_tool",
                description="查询",
                parameters={"type": "object", "properties": {}},
                executor=_executor,
            )
        ],
        max_iterations=1,
        enable_checkpoint=False,
        session_id="g816004-stamp",
    )
    tc = ToolCall(id="tc-g816004", name="mcp_tool", args=dict(_ARGS))

    ids_before = set(_approval_registry.keys())
    wait_task = asyncio.ensure_future(loop._request_approval(tc))
    # 登记发生在首个 await 之前,一拍即达;多让几拍防调度差异
    for _ in range(10):
        await asyncio.sleep(0)
        if set(_approval_registry.keys()) - ids_before:
            break
    approval_id = (set(_approval_registry.keys()) - ids_before).pop()

    try:
        stamped = _approval_generation_cas.describe(approval_id)
        assert stamped is not None
        assert stamped["state"] == STATE_PENDING
        assert stamped["generation"] == 0
        assert stamped["tool_name"] == "mcp_tool"
        # 内容摘要 = 决策 payload(tool+args)的 content_digest —— 与持章方同源
        assert stamped["snapshot_digest"] == _DIGEST
        # 持章结算:同代同快照 ⇒ 唤醒等待方,工具放行
        outcome = resolve_approval_for_requester(
            approval_id, "approve", None,
            generation=stamped["generation"],
            snapshot_digest=stamped["snapshot_digest"],
        )
        assert outcome is ApprovalOutcome.APPLIED
        assert await wait_task is None  # approve ⇒ None(工具继续执行)
        assert grants  # 批准后按 session 档落盘授权(None 属主 → 兼容路径授 session)
    finally:
        if not wait_task.done():
            wait_task.cancel()
            try:
                await wait_task
            except asyncio.CancelledError:
                pass

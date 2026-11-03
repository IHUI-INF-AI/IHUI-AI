# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-637 审批应答竞态:同一 permissionRequestId 的两次应答只许第一次生效。

判据四条(成对,缺一不可),全部对准"副作用没发生"而不是只断错误码
(AGENTS §5 明文:只断 403/码会放过"先改了再抛"):

1. 竞态/连续两次应答 ⇒ 只有第一次生效:decision/scope/reason/accept_alternative
   **逐字不变**、`event.set()` 只被调用一次、持久授权授予计数只 +1(第二次既不能
   把 approve 翻成 reject,也不能把 session 档升到 always)。
2. 正向对照:单次应答路径与修前同形(结果、落盘档位、清理纪律三条分别断言)。
3. 同形/不同形的口径本身:`ALREADY_SETTLED` 只对**已证明的属主**可见 —— 非属主
   永远拿回 FORBIDDEN/NOT_FOUND;且越权尝试**不得消耗**结算名额(否则一次攻击
   尝试就把受害者的审批变成"不存在",那是 §5"先改了再抛 403"的同一型)。
4. 一次性名额原语自身的反证:同一个条目连取两次 ⇒ 第二次必 False(门有牙的证明)。

测试隔离(§5 铁律):本机 8810/8811 无监听,任何用例不得碰生产 PG/Redis。
`app.core.db_pool.get_shared_pool` 被换成"一被调用就 AssertionError"的替身 ——
它不是"mock 掉就好",而是**用了就直接红**;持久层另指 tmp_path 的独立 sqlite。
"""

from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any

import pytest

# ---------------------------------------------------------------------------
# 隔离夹具
# ---------------------------------------------------------------------------


class _ProductionDbTouched(AssertionError):
    """生产库被触碰的唯一出口:宁可红,不可静默连上去。"""


@pytest.fixture(autouse=True)
def _no_production_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """§5 测试隔离铁律:共享连接池一旦被调用即判失败。"""

    import app.core.db_pool as db_pool

    async def _boom() -> None:
        raise _ProductionDbTouched(
            "G-637 用例不得对生产 PostgreSQL/Redis 产生任何读写(§5 测试隔离铁律)"
        )

    monkeypatch.setattr(db_pool, "get_shared_pool", _boom)


@pytest.fixture()
def pending(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Any
) -> SimpleNamespace:
    """待决表 + 持久层 + grant 计数的成套隔离面。

    必须原地 clear 而非替换 dict 引用:`_request_approval` 与 `grant_tool_approval_persist`
    都按模块级全局 dict 取用(与 tests/test_persist_channel_rules_cfg_53.py 同一教训)。
    """
    from app.services import agent_loop_v2 as v2
    from app.services import approval_persistence as ap

    ap.set_db_path(tmp_path / "g637_grants.db")
    v2._approval_registry.clear()
    v2._approval_persist_keys.clear()

    grant_spy: list[tuple[str, str, str]] = []

    def _spy_grant(scope: str, key: str, kind: str = "mcp_tool") -> None:
        grant_spy.append((scope, key, kind))

    monkeypatch.setattr(ap, "grant", _spy_grant)
    yield SimpleNamespace(
        v2=v2, ap=ap, grant_spy=grant_spy, registry=v2._approval_registry
    )
    v2._approval_registry.clear()
    v2._approval_persist_keys.clear()
    ap.close()
    ap.set_db_path(ap.DEFAULT_DB_PATH)


# ---------------------------------------------------------------------------
# 记录型事件:量"future 只被 set 一次"(不依赖被 await,也不改生产 Event)
# ---------------------------------------------------------------------------


class _RecordingEvent:
    """duck-typed asyncio.Event:只记 set 次数,不做唤醒。"""

    def __init__(self) -> None:
        self.set_calls = 0

    def set(self) -> None:
        self.set_calls += 1

    def is_set(self) -> bool:
        return self.set_calls > 0

    async def wait(self) -> bool:  # pragma: no cover - 手工登记形态没有等待方
        return True


# ---------------------------------------------------------------------------
# 最小 self 替身与工具调用形态(与 tests/test_approval_scope_d84.py 同形)
# ---------------------------------------------------------------------------


@dataclass
class _StubToolCall:
    id: str = "tc_g637"
    name: str = "write_file"
    args: dict[str, Any] = field(default_factory=lambda: {"path": "/tmp/g637.txt"})


class _StubLoop:
    """`_request_approval` 的鸭子类型 self(不构造完整 AgentLoopV2)。"""

    def __init__(self, user_id: str | None = "user-a") -> None:
        self._decision_hints: dict[str, tuple[str, str]] = {}
        self._user_id = user_id
        self._session_id = "sess-g637"
        self._approval_timeout = 5
        self.emitted: list[dict[str, Any]] = []
        self._events = SimpleNamespace(tool_approval=self._emit)

    async def _emit(self, **kwargs: Any) -> None:
        self.emitted.append(kwargs)


def _register(v2: Any, approval_id: str, *, owner: str | None) -> _RecordingEvent:
    """手工登记一条待决审批(事件 + persist 旁路键),返回可数的 Event。"""
    ev = _RecordingEvent()
    v2._approval_registry[approval_id] = v2._ApprovalEntry(
        event=ev, decision=None, owner_user_id=owner
    )
    v2._approval_persist_keys[approval_id] = f"key::{approval_id}"
    return ev


# ===========================================================================
# ① 竞态用例:并发 respond 只结算一次(线程级真并发,不是"看起来串行")
# ===========================================================================


def test_concurrent_respond_settles_only_once(pending: SimpleNamespace) -> None:
    """八个线程同抢同一 approval_id ⇒ 恰好一个 APPLIED,其余全部 ALREADY_SETTLED。

    这是修前必然失败的一型:旧实现是无锁的"读条目→写字段→set 事件",
    任何两次应答都会赢,后写的覆盖先写的。
    """
    v2 = pending.v2
    approval_id = "appr_g637_race"
    ev = _register(v2, approval_id, owner="user-a")

    barrier = threading.Barrier(8)
    outcomes: list[Any] = []
    lock = threading.Lock()

    def _respond(index: int) -> None:
        decision = "approve" if index % 2 == 0 else "reject"
        barrier.wait()  # 把八个线程挤到同一时刻,抬高撞车概率
        outcome = v2.resolve_approval_for_requester(
            approval_id, decision, "user-a", scope="always" if index else "session"
        )
        with lock:
            outcomes.append(outcome)

    threads = [threading.Thread(target=_respond, args=(i,)) for i in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    applied = outcomes.count(v2.ApprovalOutcome.APPLIED)
    already = outcomes.count(v2.ApprovalOutcome.ALREADY_SETTLED)
    assert applied == 1, f"结算名额必须唯一,实测 APPLIED={applied}"
    assert already == 7, "其余七次一律是'已被答过',不得静默也算赢"
    assert ev.set_calls == 1, f"future/事件只许被 set 一次,实测 {ev.set_calls}"

    entry = v2._approval_registry[approval_id]
    assert isinstance(entry, v2._ApprovalEntry)
    assert entry.decision in ("approve", "reject")
    # 落定的是**第一个赢的应答**的档位,且此后不再被改写:
    assert entry.scope == ("session" if entry.decision == "approve" else "always")


def test_second_response_writes_nothing_and_grants_no_more(
    pending: SimpleNamespace,
) -> None:
    """连续两次应答:第二次既不改字段、不再 set、也不得再落持久授权。

    断言全部对准副作用本身(AGENTS §5):错误码之外,逐字段比"有没有被动过"。
    """
    v2 = pending.v2
    approval_id = "appr_g637_twice"
    ev = _register(v2, approval_id, owner="user-a")

    first = v2.resolve_approval_for_requester(
        approval_id, "approve", "user-a", scope="session", reason="第一次点的"
    )
    assert first is v2.ApprovalOutcome.APPLIED

    second = v2.resolve_approval_for_requester(
        approval_id,
        "reject",
        "user-a",
        scope="always",
        reason="第二次改主意",
        accept_alternative=True,
    )
    assert second is v2.ApprovalOutcome.ALREADY_SETTLED

    entry = v2._approval_registry[approval_id]
    assert isinstance(entry, v2._ApprovalEntry)
    assert entry.decision == "approve", "第二次应答不得翻掉已生效的决策"
    assert entry.scope == "session", "不得把 session 档改成 always(= 权限放大)"
    assert entry.reason == "第一次点的"
    assert entry.accept_alternative is False, "第二次带的勾选不得覆盖第一次"
    assert ev.set_calls == 1, "唤醒事件只被触发一次"

    # 持久授权通道:第一次取走键并落盘,第二次连 cache_key 都取不到 ⇒ 不可能双落盘
    assert v2.grant_tool_approval_persist(approval_id, "session") is True
    assert v2.grant_tool_approval_persist(approval_id, "always") is False
    assert pending.grant_spy == [("session", "key::appr_g637_twice", "mcp_tool")], (
        "grant_spy 只 +1:第二次调用绝不能再落一条(更不能升档)"
    )


# ===========================================================================
# ② 正向对照:单次应答路径与修前逐字同形(别把功能改坏)
# ===========================================================================


def _drive(v2: Any, respond: Any) -> tuple[Any, Any, _StubLoop, str]:
    """驱动真实 `_request_approval` 到结算,返回 (结果, cache_key, stub, approval_id)。"""

    async def scenario() -> tuple[Any, Any, _StubLoop, str]:
        stub = _StubLoop()
        tc = _StubToolCall()
        task = asyncio.create_task(v2.AgentLoopV2._request_approval(stub, tc))
        for _ in range(200):
            if v2._approval_registry:
                break
            await asyncio.sleep(0.005)
        approval_id = next(iter(v2._approval_registry))
        respond(v2, approval_id)
        result = await task
        key = v2._tool_approval_cache_key(tc.name, tc.args)
        return result, key, stub, approval_id

    return asyncio.run(scenario())


def test_single_response_path_unchanged_approve(pending: SimpleNamespace) -> None:
    """单次 approve(scope=session):结果=放行、落盘=session、清理纪律同修前。"""
    v2 = pending.v2

    def _respond(mod: Any, approval_id: str) -> None:
        assert (
            mod.resolve_approval_for_requester(
                approval_id, "approve", "user-a", scope="session"
            )
            is mod.ApprovalOutcome.APPLIED
        )

    result, key, stub, approval_id = _drive(v2, _respond)
    assert result is None, "批准 ⇒ 工具照常执行(返回 None 即'无拦截理由')"
    assert stub._decision_hints == {}, "正向链路不该凭空多出决策提示"
    assert pending.grant_spy == [("session", key, "mcp_tool")]
    assert approval_id not in v2._approval_registry, "finally 清理纪律(同期释放)"
    assert approval_id not in v2._approval_persist_keys


def test_single_response_path_unchanged_reject(pending: SimpleNamespace) -> None:
    """单次 reject + 原因:结果=user_rejected、提示写进 _decision_hints、零落盘。"""
    v2 = pending.v2

    def _respond(mod: Any, approval_id: str) -> None:
        assert (
            mod.resolve_approval_for_requester(
                approval_id, "reject", "user-a", reason="不让写"
            )
            is mod.ApprovalOutcome.APPLIED
        )

    result, _key, stub, _approval_id = _drive(v2, _respond)
    assert result == "user_rejected"
    assert stub._decision_hints == {"tc_g637": ("rejected_by_user", "不让写")}
    assert pending.grant_spy == [], "拒绝绝不落任何授权"


def test_double_response_first_answer_wins_end_to_end(
    pending: SimpleNamespace,
) -> None:
    """端到端可见结果:第一次 approve、紧接着(等待方尚未醒)第二次 reject ⇒ 仍按批准执行。

    修前这一条会红:第二次应答把 decision 覆盖成 reject,等待方读到的就是 reject,
    工具被跳过、还回一条 "rejected_by_user" 提示 —— 用户点了批准却什么都没发生。
    """
    v2 = pending.v2

    def _respond(mod: Any, approval_id: str) -> None:
        assert (
            mod.resolve_approval_for_requester(
                approval_id, "approve", "user-a", scope="session"
            )
            is mod.ApprovalOutcome.APPLIED
        )
        # 关键:两次应答之间**不 await**,等待方还没被唤醒 —— 这正是竞态窗口
        assert (
            mod.resolve_approval_for_requester(approval_id, "reject", "user-a")
            is mod.ApprovalOutcome.ALREADY_SETTLED
        )

    result, key, stub, _approval_id = _drive(v2, _respond)
    assert result is None, "第一次应答赢:工具必须按 approve 执行"
    assert "tc_g637" not in stub._decision_hints or stub._decision_hints[
        "tc_g637"
    ][0] != "rejected_by_user", "第二次 reject 不得留下'被用户拒绝'的痕迹"
    assert pending.grant_spy == [("session", key, "mcp_tool")], "落盘只按第一次的档位"


# ===========================================================================
# ③ 同形/不同形的口径:ALREADY_SETTLED 只对已证明的属主可见
# ===========================================================================


def test_foreign_response_never_observes_already_settled(
    pending: SimpleNamespace,
) -> None:
    """已结算之后,别人的应答仍是 FORBIDDEN —— 第四态不给非属主,存在性预言机没变宽。"""
    v2 = pending.v2
    approval_id = "appr_g637_shape"
    _register(v2, approval_id, owner="user-a")

    assert (
        v2.resolve_approval_for_requester(approval_id, "approve", "user-a")
        is v2.ApprovalOutcome.APPLIED
    )
    assert (
        v2.resolve_approval_for_requester(approval_id, "approve", "user-b")
        is v2.ApprovalOutcome.FORBIDDEN
    ), "非属主不得看见'已被答过',只能拿到与修前同形的那一档"
    assert (
        v2.resolve_approval_for_requester(approval_id, "approve", "user-a")
        is v2.ApprovalOutcome.ALREADY_SETTLED
    )


def test_forbidden_attempt_does_not_consume_the_settlement_slot(
    pending: SimpleNamespace,
) -> None:
    """顺序判据:属主判定必须在结算判定之前 —— 否则越权尝试会把受害者的审批吃空。

    两条断言合起来才叫"副作用没发生":① 越权后条目字段一个都没动;② 真正属主随后
    仍然能正常结算(不是 NOT_FOUND)。旧代码这条也过,但它是"碰巧"过 —— 本票一旦
    把取走改成 `dict.pop(approval_id)` 就会退化成拒绝服务,这条钉住那一步不许走偏。
    """
    v2 = pending.v2
    approval_id = "appr_g637_dos"
    ev = _register(v2, approval_id, owner="user-a")

    assert (
        v2.resolve_approval_for_requester(
            approval_id, "reject", "user-b", scope="always"
        )
        is v2.ApprovalOutcome.FORBIDDEN
    )
    entry = v2._approval_registry.get(approval_id)
    assert entry is not None, "越权尝试不得把条目从待决表里摘走"
    assert isinstance(entry, v2._ApprovalEntry)
    assert entry.decision is None and entry.scope is None
    assert ev.set_calls == 0, "越权尝试不得唤醒等待方"

    assert (
        v2.resolve_approval_for_requester(approval_id, "approve", "user-a")
        is v2.ApprovalOutcome.APPLIED
    ), "属主的正常结算权不得被一次失败的越权尝试消耗掉"


def test_absent_id_is_same_shaped_for_every_principal(pending: SimpleNamespace) -> None:
    """不存在的 id:属主与非属主拿到同一个 NOT_FOUND(同形,不给存在性预言机)。"""
    v2 = pending.v2
    for principal in ("user-a", "user-b", None):
        assert (
            v2.resolve_approval_for_requester("appr_never_existed", "approve", principal)
            is v2.ApprovalOutcome.NOT_FOUND
        )


# ===========================================================================
# ④ 原语反证:名额只有一份
# ===========================================================================


def test_claim_settlement_is_one_shot() -> None:
    """同一条目连取两次 ⇒ True 然后 False(判据有牙的证明,不是空调用)。"""
    from app.services.agent_loop_v2 import _ApprovalEntry

    entry = _ApprovalEntry(event=_RecordingEvent(), owner_user_id="user-a")  # type: ignore[arg-type]
    assert entry.claim_settlement() is True
    assert entry.claim_settlement() is False
    assert entry.claim_settlement() is False


def test_claim_is_atomic_across_threads() -> None:
    """二十个线程抢同一个名额 ⇒ 恰好一个 True(锁真的在起作用,不是 GIL 碰巧)。"""
    from app.services.agent_loop_v2 import _ApprovalEntry

    entry = _ApprovalEntry(event=_RecordingEvent(), owner_user_id="user-a")  # type: ignore[arg-type]
    winners: list[bool] = []
    barrier = threading.Barrier(20)

    def _grab() -> None:
        barrier.wait()
        winners.append(entry.claim_settlement())

    threads = [threading.Thread(target=_grab) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sum(1 for w in winners if w) == 1, f"结算名额必须唯一,实测 {winners}"


def test_legacy_tuple_record_upgrade_keeps_single_slot(pending: SimpleNamespace) -> None:
    """历史二元组形态就地升级后,名额仍然只有一份(升级换对象不得复制名额)。

    `_as_entry()` 会把 `(event, decision)` 换成新的 `_ApprovalEntry` 实例 —— 如果
    锁是"每条目一把",两个并发应答可能各自升出一个对象、各得一个全新名额,于是
    本票的判据在这一型上失效。共用一把可重入锁正是为了罩住这次换对象。
    """
    v2 = pending.v2
    approval_id = "appr_g637_tuple"
    ev = _RecordingEvent()
    v2._approval_registry[approval_id] = (ev, None)  # type: ignore[assignment]

    outcomes: list[Any] = []
    barrier = threading.Barrier(4)

    def _respond() -> None:
        barrier.wait()
        outcomes.append(
            v2.resolve_approval_for_requester(approval_id, "approve", None)
        )

    threads = [threading.Thread(target=_respond) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert outcomes.count(v2.ApprovalOutcome.APPLIED) == 1
    assert ev.set_calls == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

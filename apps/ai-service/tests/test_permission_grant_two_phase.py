# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-816005 验收:权限授权两阶段提交。

三条断言(票面):
① 同一 receipt 重放 ⇒ 事件字节相同且队列不重抓(重抓计数器为 0);
② 崩溃点注入(登记后、发布前)⇒ 重启后必须补齐发布且只补一次;
③ 预览钩子失败 ⇒ 仍走 ask,不得降为 allow 或 deny(反例:把钩子错误当裁决)。

测试隔离(AGENTS §5):纯内存 store,零生产库,零外呼。
"""

from __future__ import annotations

import pytest

from app.services.permission_grant_two_phase import (
    GATE_ASK,
    GATE_PROCEED,
    InMemoryGrantStore,
    PermissionGrantCommitter,
    PermissionGrantReceipt,
    PermissionReceiptScopeError,
    QueueMutationBusyError,
    canonical_event_bytes,
    receipt_id_for,
    recover_committed_permission_grants,
    resolve_tool_approval,
)

_SESSION = "sess-2pc-1"
_RECEIPT_IA1 = receipt_id_for(_SESSION, "ia-1")


def _build_event(interaction_id: str, queue_item_ids: list[str]) -> dict:
    return {
        "event_id": f"evt-{interaction_id}",
        "type": "session.mode_changed",
        "session_id": _SESSION,
        "mode": "yolo",
        "previous_mode": "default",
        "permission_grant": {
            "interaction_id": interaction_id,
            "queue_item_ids": list(queue_item_ids),
        },
    }


class _Counters:
    def __init__(self, queue: list[list[str]]) -> None:
        self._queue = queue
        self.fetches: list[int] = []
        self.published: list[str] = []
        self.applied: list[dict] = []

    def fetch(self) -> list[str]:
        self.fetches.append(1)
        return list(self._queue[len(self.fetches) - 1])

    def publish(self, event: dict) -> None:
        self.published.append(canonical_event_bytes(event))

    def apply(self, event: dict) -> None:
        self.applied.append(dict(event))


def _committer(store: InMemoryGrantStore, counters: _Counters) -> PermissionGrantCommitter:
    return PermissionGrantCommitter(
        session_id=_SESSION,
        store=store,
        fetch_queue_item_ids=counters.fetch,
        build_event=_build_event,
        publish_event=counters.publish,
        apply_state=counters.apply,
    )


# ---------------------------------------------------------------------------
# ① 同一 receipt 重放 ⇒ 事件字节相同且队列不重抓(重抓计数器为 0)
# ---------------------------------------------------------------------------
def test_same_receipt_replay_identical_event_and_no_queue_refetch() -> None:
    store = InMemoryGrantStore()
    counters = _Counters(queue=[["q-1", "q-2"], ["q-3"]])  # 若重抓会拿到不同的队列
    committer = _committer(store, counters)

    event_id_1 = committer.grant_full_access("ia-1")
    assert event_id_1 == "evt-ia-1"
    assert len(counters.fetches) == 1  # 提交时抓一次(钉快照)

    event_id_2 = committer.grant_full_access("ia-1")  # 同 receipt 重放
    assert event_id_2 == event_id_1

    # 事件字节相同(重放的是 receipt 里那份,不是新造的)
    receipt = store.find_receipt(_SESSION, _RECEIPT_IA1)
    assert canonical_event_bytes(receipt.event) == counters.published[0]
    assert len(counters.published) == 1  # 发布也只发生过一次
    # 队列不重抓:重抓计数器为 0
    assert len(counters.fetches) == 1 and (len(counters.fetches) - 1) == 0
    # 范围快照钉死:事件里的 queueItemIds 是提交时刻那份,后来入队的没混进来
    assert receipt.event["permission_grant"]["queue_item_ids"] == ["q-1", "q-2"]
    # appliedGrants 一次性:内存/投影只应用一次
    assert len(counters.applied) == 1


# ---------------------------------------------------------------------------
# ② 崩溃点注入(登记后、发布前)⇒ 重启后必须补齐发布且只补一次
# ---------------------------------------------------------------------------
def test_crash_after_register_before_publish_recovers_exactly_once() -> None:
    store = InMemoryGrantStore()
    attempts: list[int] = []

    def crashing_publish(event: dict) -> None:
        attempts.append(1)
        raise RuntimeError("simulated crash between register and publish")

    crashed = PermissionGrantCommitter(
        session_id=_SESSION,
        store=store,
        fetch_queue_item_ids=lambda: ["q-1"],
        build_event=_build_event,
        publish_event=crashing_publish,
    )

    with pytest.raises(RuntimeError):
        crashed.grant_full_access("ia-crash")

    # 崩溃点核实:登记(receipt)已完成,发布一次都没成功
    receipt = store.find_receipt(_SESSION, receipt_id_for(_SESSION, "ia-crash"))
    assert receipt is not None
    assert crashed.unpublished_permission_grant is not None  # 恢复锚在
    assert len(attempts) == 1

    # "重启":全新 committer,同一持久库
    fresh = _Counters(queue=[["q-9"]])  # 若重启路径重抓队列会拿到完全不同的队列
    restarted = _committer(store, fresh)

    replayed = recover_committed_permission_grants(store, restarted)

    assert replayed == ["evt-ia-crash"]
    assert len(fresh.published) == 1  # 补齐发布
    assert fresh.published[0] == canonical_event_bytes(receipt.event)  # 同一事件
    assert fresh.fetches == []  # 补发布不重抓队列(快照钉死在 receipt 里)
    assert len(fresh.applied) == 1  # 内存/投影补齐且只一次

    # 只补一次:再恢复一轮,publish/applied 计数不动
    recover_committed_permission_grants(store, restarted)
    assert len(fresh.published) == 1
    assert len(fresh.applied) == 1


def test_in_process_recover_replays_publish_once() -> None:
    """同进程恢复路径:发布失败(传输断)后 recover 重放,重试不重抓队列。"""
    store = InMemoryGrantStore()
    counters = _Counters(queue=[["q-1", "q-2"]])
    publish_attempts: list[int] = []
    successful_publishes: list[str] = []

    def flaky_publish(event: dict) -> None:
        publish_attempts.append(1)
        if len(publish_attempts) == 1:
            raise RuntimeError("transport down right after commit")
        successful_publishes.append(canonical_event_bytes(event))

    committer = PermissionGrantCommitter(
        session_id=_SESSION,
        store=store,
        fetch_queue_item_ids=counters.fetch,
        build_event=_build_event,
        publish_event=flaky_publish,
        apply_state=counters.apply,
    )

    with pytest.raises(RuntimeError):
        committer.grant_full_access("ia-r")

    event_id = committer.recover_pending_permission_grant()

    assert event_id == "evt-ia-r"
    assert len(successful_publishes) == 1  # 重放发布只补一次
    receipt = store.find_receipt(_SESSION, receipt_id_for(_SESSION, "ia-r"))
    assert successful_publishes[0] == canonical_event_bytes(receipt.event)
    assert len(counters.fetches) == 1  # replay 走 receipt,不重抓队列
    assert committer.unpublished_permission_grant is None  # 成功才清锚
    assert len(counters.applied) == 1  # applied 一次性


# ---------------------------------------------------------------------------
# ③ 预览钩子失败 ⇒ 仍走 ask,不得降为 allow 或 deny
# ---------------------------------------------------------------------------
def test_preview_hook_failure_still_asks() -> None:
    def broken_hook() -> dict:
        raise RuntimeError("preview generator crashed")

    result = resolve_tool_approval(broken_hook)

    assert result["gate"] == GATE_ASK  # ask 照旧成立,只让预览降级
    assert result["gate"] not in {"allow", "deny", GATE_PROCEED}  # 不把钩子错误当裁决
    assert "display" not in result


def test_preview_hook_proceed_is_honored_when_healthy() -> None:
    """反例锁:健康钩子的 proceed 必须被尊重 —— 证明不是无条件回 ask。"""
    result = resolve_tool_approval(lambda: {"gate": GATE_PROCEED})
    assert result == {"gate": GATE_PROCEED}


def test_preview_hook_ask_with_display_is_kept() -> None:
    display = {"kind": "diff", "summary": "3 files"}
    result = resolve_tool_approval(lambda: {"gate": GATE_ASK, "display": display})
    assert result == {"gate": GATE_ASK, "display": display}


def test_hook_cannot_grant_allow_or_deny() -> None:
    """钩子契约外的裁决值(allow/deny)一律不认,归 ask。"""
    assert resolve_tool_approval(lambda: {"gate": "allow"})["gate"] == GATE_ASK
    assert resolve_tool_approval(lambda: "deny")["gate"] == GATE_ASK


def test_no_hook_defaults_to_ask() -> None:
    assert resolve_tool_approval(None) == {"gate": GATE_ASK}


# ---------------------------------------------------------------------------
# scope 校验 / busy 闸 / resume 标记
# ---------------------------------------------------------------------------
def test_receipt_scope_mismatch_is_rejected() -> None:
    store = InMemoryGrantStore()
    # 人为放一笔 interaction 与 receipt 键不符的坏账(上游 scope mismatch 形态)
    store.save_receipt(
        PermissionGrantReceipt(
            receipt_id=_RECEIPT_IA1,
            session_id=_SESSION,
            interaction_id="ia-other",
            event={"event_id": "evt-ia-other"},
        )
    )
    committer = _committer(store, _Counters(queue=[["q-1"]]))

    with pytest.raises(PermissionReceiptScopeError):
        committer.grant_full_access("ia-1")


def test_reentrant_grant_during_queue_mutation_is_busy_rejected() -> None:
    store = InMemoryGrantStore()
    holder: dict[str, PermissionGrantCommitter] = {}

    def reentrant_build(interaction_id: str, queue_item_ids: list[str]) -> dict:
        with pytest.raises(QueueMutationBusyError):
            holder["committer"].grant_full_access("ia-nested")
        return _build_event(interaction_id, queue_item_ids)

    committer = PermissionGrantCommitter(
        session_id=_SESSION,
        store=store,
        fetch_queue_item_ids=lambda: ["q-1"],
        build_event=reentrant_build,
        publish_event=lambda e: None,
    )
    holder["committer"] = committer
    assert committer.grant_full_access("ia-busy") == "evt-ia-busy"


def test_restore_marker_skips_corrupt_receipt_without_raising() -> None:
    """resume 时坏 receipt 只 warn 跳过,不阻断历史恢复。"""
    store = InMemoryGrantStore()
    store.save_receipt(
        PermissionGrantReceipt(
            receipt_id=receipt_id_for(_SESSION, "ia-bad"),
            session_id=_SESSION,
            interaction_id="ia-bad",
            event="not-a-dict",  # 格式损坏
        )
    )
    committer = _committer(store, _Counters(queue=[["q-1"]]))

    assert committer.restore_permission_grant_marker() is None  # 不抛、跳过
    assert committer.last_permission_grant_id is None  # 标记未被坏数据污染


def test_restore_marker_picks_up_last_valid_grant() -> None:
    store = InMemoryGrantStore()
    counters = _Counters(queue=[["q-1"]])
    committer = _committer(store, counters)
    committer.grant_full_access("ia-1")

    restarted = _committer(store, _Counters(queue=[["q-1"]]))
    assert restarted.restore_permission_grant_marker() == "ia-1"
    assert restarted.last_permission_grant_id == "ia-1"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

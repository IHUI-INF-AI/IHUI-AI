# app/core/thread_rollout_truncation.py
"""线程 rollout 截断/分叉纯算法 — 2026-09-19 第三十二批,对标 Codex
core/src/thread_rollout_truncation.rs(全文 300 行)与 thread_manager.rs 尾部
(truncate_before_nth_user_message / snapshot_turn_state / fork_history_from_snapshot /
append_interrupted_boundary)。

数据模型(OpenAI 风格 dict):
- RolloutItem 四变体:
    {"type": "response_item", "item": <ResponseItem dict>}
    {"type": "event_msg", "event": {"type": "turn_started"|"turn_completed"|"turn_aborted"|
                                    "thread_rolled_back", ...}}
    {"type": "inter_agent_communication", "trigger_turn": bool, ...}
    {"type": "inter_agent_communication_metadata", "trigger_turn": bool}
- InitialHistory 三态:{"kind": "new"|"cleared"}(无 items) / {"kind": "resumed"|"forked", "items": [...]}
- SnapshotTurnState / ForkSnapshot / InterruptedTurnHistoryMarker 同名等价。

复用批 31 stream_events.parse_turn_item / is_contextual_user_message_content 判定用户回合边界。
用户消息边界扫描应用 ThreadRolledBack 标记(索引基于回滚后有效历史)。

判定跳过(耦合证据):
- ThreadHistoryBuilder 完整回合投影(build_turns_from_rollout_items 的 TurnStatus 状态机):
  snapshot_turn_state 以显式 TurnStarted/Complete/Aborted 事件扫描等价实现,合成 turn id
  投影(legacy rollout 兼容)不移植——Codex 侧对合成 id 也拒绝作为分叉边界;
- TurnAbortedEvent 的 reason 枚举完整面:只落 Interrupted(本模块唯一使用场景);
- InterAgentInstructionContent 完整解析:assistant 边界以「单文本项可 JSON 解析且带
  trigger_turn 键」等价近似(对应 InterAgentCommunication::from_message_content)。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Optional

from app.core.stream_events import is_contextual_user_message_content, parse_turn_item

ROLLOUT_RESPONSE_ITEM = "response_item"
ROLLOUT_EVENT_MSG = "event_msg"
ROLLOUT_INTER_AGENT = "inter_agent_communication"
ROLLOUT_INTER_AGENT_META = "inter_agent_communication_metadata"

EVENT_TURN_STARTED = "turn_started"
EVENT_TURN_COMPLETED = "turn_completed"
EVENT_TURN_ABORTED = "turn_aborted"
EVENT_THREAD_ROLLED_BACK = "thread_rolled_back"


def _event_type(rollout_item: dict[str, Any]) -> Optional[str]:
    event = rollout_item.get("event")
    if isinstance(event, dict):
        kind = event.get("type")
        return kind if isinstance(kind, str) else None
    return None


def _event_field(rollout_item: dict[str, Any], key: str) -> Any:
    event = rollout_item.get("event")
    if isinstance(event, dict):
        return event.get(key)
    return None


def _is_inter_agent_instruction_content(content: list[dict[str, Any]]) -> bool:
    """assistant 边界的 agent 间通信判定等价近似:单一文本项且可解析出 trigger_turn。"""
    if len(content) != 1:
        return False
    text = content[0].get("text")
    if not isinstance(text, str):
        return False
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        return False
    return isinstance(parsed, dict) and "trigger_turn" in parsed


def is_user_turn_boundary(item: dict[str, Any]) -> bool:
    """Codex context_manager::is_user_turn_boundary:AgentMessage 恒为边界;
    user 非上下文消息 / assistant agent 间指令消息为边界。"""
    if item.get("type") == "agent_message":
        return True
    if item.get("type") != "message":
        return False
    role = item.get("role")
    content = item.get("content")
    if not isinstance(content, list):
        return False
    if role == "user":
        return not is_contextual_user_message_content(content)
    if role == "assistant":
        return _is_inter_agent_instruction_content(content)
    return False


def _is_real_user_message_boundary(item: dict[str, Any]) -> bool:
    turn = parse_turn_item(item)
    return turn is not None and turn.get("type") == "user_message"


def _is_trigger_turn_boundary(item: dict[str, Any]) -> bool:
    if item.get("type") != "message":
        return False
    return item.get("role") == "assistant" and _is_inter_agent_instruction_content(
        item.get("content", [])
    )


def user_message_positions_in_rollout(items: list[dict[str, Any]]) -> list[int]:
    """用户消息边界索引(应用 ThreadRolledBack:回滚 N 个用户回合即截断末尾 N 个索引)。"""
    positions: list[int] = []
    for idx, rollout_item in enumerate(items):
        kind = rollout_item.get("type")
        if kind == ROLLOUT_RESPONSE_ITEM:
            item = rollout_item.get("item")
            if isinstance(item, dict) and item.get("type") == "message" and _is_real_user_message_boundary(item):
                positions.append(idx)
        elif kind == ROLLOUT_EVENT_MSG and _event_type(rollout_item) == EVENT_THREAD_ROLLED_BACK:
            num_turns = _event_field(rollout_item, "num_turns")
            n = num_turns if isinstance(num_turns, int) and num_turns >= 0 else len(positions)
            positions = positions[: max(0, len(positions) - n)]
    return positions


def truncate_rollout_before_nth_user_message_from_start(
    items: list[dict[str, Any]], n_from_start: int
) -> list[dict[str, Any]]:
    """严格在第 n(0-based)个用户消息前截断;n 超过存量或 <0 视为不截断。"""
    if n_from_start < 0:
        return list(items)
    positions = user_message_positions_in_rollout(items)
    if len(positions) <= n_from_start:
        return list(items)
    return items[: positions[n_from_start]]


def fork_turn_positions_in_rollout(items: list[dict[str, Any]]) -> list[int]:
    """fork 回合边界索引:真实用户消息 / trigger_turn 代理间通信(含 metadata 信封);
    回滚按"指令回合"计数——从第 num_turns 个回滚边界起整体剔除 fork 位置。"""
    rollback_positions: list[int] = []
    fork_positions: list[int] = []
    for idx, rollout_item in enumerate(items):
        kind = rollout_item.get("type")
        if kind == ROLLOUT_RESPONSE_ITEM:
            item = rollout_item.get("item")
            if not isinstance(item, dict):
                continue
            has_delivery_metadata = item.get("type") == "agent_message" and (
                idx > 0
                and items[idx - 1].get("type") == ROLLOUT_INTER_AGENT_META
            )
            if is_user_turn_boundary(item) and not has_delivery_metadata:
                rollback_positions.append(idx)
            if _is_real_user_message_boundary(item) or _is_trigger_turn_boundary(item):
                fork_positions.append(idx)
        elif kind == ROLLOUT_INTER_AGENT:
            rollback_positions.append(idx)
            if rollout_item.get("trigger_turn"):
                fork_positions.append(idx)
        elif kind == ROLLOUT_INTER_AGENT_META:
            rollback_positions.append(idx)
            if rollout_item.get("trigger_turn"):
                fork_positions.append(idx)
        elif kind == ROLLOUT_EVENT_MSG and _event_type(rollout_item) == EVENT_THREAD_ROLLED_BACK:
            num_turns = _event_field(rollout_item, "num_turns")
            n = num_turns if isinstance(num_turns, int) and num_turns > 0 else 0
            if n == 0:
                continue
            rollback_start_idx: Optional[int]
            if len(rollback_positions) >= n:
                rollback_start_idx = rollback_positions[len(rollback_positions) - n]
            else:
                rollback_start_idx = rollback_positions[0] if rollback_positions else None
            if rollback_start_idx is None:
                continue
            rollback_positions = rollback_positions[: max(0, len(rollback_positions) - n)]
            fork_positions = [p for p in fork_positions if p < rollback_start_idx]
    return fork_positions


def truncate_rollout_after_turn_id(items: list[dict[str, Any]], last_turn_id: str) -> list[dict[str, Any]]:
    """保留到指定已完结回合为止的前缀;回合须显式 TurnStarted 且非进行中,否则 ValueError。"""
    started_idx: Optional[int] = None
    for idx, rollout_item in enumerate(items):
        if (
            rollout_item.get("type") == ROLLOUT_EVENT_MSG
            and _event_type(rollout_item) == EVENT_TURN_STARTED
            and _event_field(rollout_item, "turn_id") == last_turn_id
        ):
            started_idx = idx
            break
    if started_idx is None:
        raise ValueError(f"lastTurnId '{last_turn_id}' is not a persisted canonical turn in the source thread")
    has_terminal = any(
        rollout_item.get("type") == ROLLOUT_EVENT_MSG
        and _event_type(rollout_item) in (EVENT_TURN_COMPLETED, EVENT_TURN_ABORTED)
        and _event_field(rollout_item, "turn_id") == last_turn_id
        for rollout_item in items[started_idx + 1 :]
    )
    if not has_terminal:
        raise ValueError(f"lastTurnId '{last_turn_id}' identifies an in-progress turn")
    cut_index = len(items)
    for idx in range(started_idx + 1, len(items)):
        if (
            items[idx].get("type") == ROLLOUT_EVENT_MSG
            and _event_type(items[idx]) == EVENT_TURN_STARTED
        ):
            cut_index = idx
            break
    return list(items[:cut_index])


def truncate_rollout_before_turn_id(items: list[dict[str, Any]], before_turn_id: str) -> list[dict[str, Any]]:
    """在指定显式 TurnStarted 之前截断;无该边界或已被回滚移除则 ValueError。"""
    cut_index: Optional[int] = None
    for idx, rollout_item in enumerate(items):
        if (
            rollout_item.get("type") == ROLLOUT_EVENT_MSG
            and _event_type(rollout_item) == EVENT_TURN_STARTED
            and _event_field(rollout_item, "turn_id") == before_turn_id
        ):
            cut_index = idx
            break
    if cut_index is None:
        raise ValueError(f"beforeTurnId '{before_turn_id}' was not found in the source thread")
    rolled_back_later = any(
        rollout_item.get("type") == ROLLOUT_EVENT_MSG
        and _event_type(rollout_item) == EVENT_THREAD_ROLLED_BACK
        for rollout_item in items[cut_index + 1 :]
    )
    if rolled_back_later:
        started_ids = {
            _event_field(r, "turn_id")
            for r in items
            if r.get("type") == ROLLOUT_EVENT_MSG and _event_type(r) == EVENT_TURN_STARTED
        }
        if before_turn_id not in started_ids:
            raise ValueError(f"beforeTurnId '{before_turn_id}' was not found in the source thread")
    return list(items[:cut_index])


def truncate_rollout_to_last_n_fork_turns(items: list[dict[str, Any]], n_from_end: int) -> list[dict[str, Any]]:
    """保留最后 n 个 fork 回合的尾部;不足 n 时从首个边界起保(仍去掉回合前启动上下文)。"""
    if n_from_end <= 0:
        return []
    positions = fork_turn_positions_in_rollout(items)
    if not positions:
        return []
    keep_idx = positions[len(positions) - n_from_end] if len(positions) >= n_from_end else positions[0]
    return list(items[keep_idx:])


# ---------- thread_manager.rs 尾部等价 ----------

@dataclass
class SnapshotTurnState:
    ends_mid_turn: bool
    active_turn_id: Optional[str] = None
    active_turn_started_at: Optional[int] = None
    active_turn_start_index: Optional[int] = None


def _history_items(history: dict[str, Any]) -> list[dict[str, Any]]:
    kind = history.get("kind")
    if kind in ("new", "cleared"):
        return []
    items = history.get("items")
    return list(items) if isinstance(items, list) else []


def snapshot_turn_state(history: dict[str, Any]) -> SnapshotTurnState:
    """等价快照判定:显式未完结 TurnStarted → 进行中;否则看最后用户消息后有无回合终结事件。"""
    items = _history_items(history)
    active_idx: Optional[int] = None
    active_id: Optional[str] = None
    started_at: Optional[int] = None
    for idx, rollout_item in enumerate(items):
        if (
            rollout_item.get("type") == ROLLOUT_EVENT_MSG
            and _event_type(rollout_item) == EVENT_TURN_STARTED
        ):
            turn_id = _event_field(rollout_item, "turn_id")
            if isinstance(turn_id, str):
                terminated = any(
                    items[j].get("type") == ROLLOUT_EVENT_MSG
                    and _event_type(items[j]) in (EVENT_TURN_COMPLETED, EVENT_TURN_ABORTED)
                    and _event_field(items[j], "turn_id") == turn_id
                    for j in range(idx + 1, len(items))
                )
                if not terminated:
                    active_idx = idx
                    active_id = turn_id
                    sa = _event_field(rollout_item, "started_at")
                    started_at = sa if isinstance(sa, int) else None
                    break
    if active_idx is not None:
        return SnapshotTurnState(
            ends_mid_turn=True,
            active_turn_id=active_id,
            active_turn_started_at=started_at,
            active_turn_start_index=active_idx,
        )
    positions = user_message_positions_in_rollout(items)
    if not positions:
        return SnapshotTurnState(ends_mid_turn=False)
    last_user = positions[-1]
    has_terminal_after = any(
        rollout_item.get("type") == ROLLOUT_EVENT_MSG
        and _event_type(rollout_item) in (EVENT_TURN_COMPLETED, EVENT_TURN_ABORTED)
        for rollout_item in items[last_user + 1 :]
    )
    return SnapshotTurnState(ends_mid_turn=not has_terminal_after)


def truncate_before_nth_user_message(
    history: dict[str, Any], n: int, snapshot_state: SnapshotTurnState
) -> list[dict[str, Any]]:
    """Codex truncate_before_nth_user_message:中途快照在第 n 越界时按活动回合起点截断。"""
    items = _history_items(history)
    positions = user_message_positions_in_rollout(items)
    if snapshot_state.ends_mid_turn and n >= len(positions):
        cut_idx = (
            snapshot_state.active_turn_start_index
            if snapshot_state.active_turn_start_index is not None
            else (positions[-1] if positions else None)
        )
        if cut_idx is not None:
            return items[:cut_idx]
        return items
    return truncate_rollout_before_nth_user_message_from_start(items, n)


def _interrupted_turn_history_marker(marker: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    return marker if isinstance(marker, dict) else None


def append_interrupted_boundary(
    history: dict[str, Any],
    turn_id: Optional[str],
    started_at: Optional[int],
    interrupted_marker: Optional[dict[str, Any]] = None,
) -> list[dict[str, Any]]:
    """向分叉快照追加与实时中断路径一致的持久化 TurnAborted 边界(+可选 marker 项)。"""
    items = _history_items(history)
    if (marker := _interrupted_turn_history_marker(interrupted_marker)) is not None:
        items.append({"type": ROLLOUT_RESPONSE_ITEM, "item": marker})
    items.append(
        {
            "type": ROLLOUT_EVENT_MSG,
            "event": {
                "type": EVENT_TURN_ABORTED,
                "turn_id": turn_id,
                "reason": "interrupted",
                "started_at": started_at,
                "completed_at": None,
                "duration_ms": None,
            },
        }
    )
    return items


def fork_history_from_snapshot(
    snapshot: dict[str, Any],
    history: dict[str, Any],
    interrupted_marker: Optional[dict[str, Any]] = None,
) -> list[dict[str, Any]]:
    """Codex fork_history_from_snapshot:truncate_before_nth_user_message / interrupted 两路。"""
    snapshot_state = snapshot_turn_state(history)
    variant = snapshot.get("variant")
    if variant == "truncate_before_nth_user_message":
        n = snapshot.get("nth_user_message")
        return truncate_before_nth_user_message(
            history, n if isinstance(n, int) else 0, snapshot_state
        )
    if variant == "interrupted":
        if snapshot_state.ends_mid_turn:
            return append_interrupted_boundary(
                history,
                snapshot_state.active_turn_id,
                snapshot_state.active_turn_started_at,
                interrupted_marker,
            )
        return _history_items(history)
    raise ValueError(f"unknown fork snapshot variant: {variant!r}")

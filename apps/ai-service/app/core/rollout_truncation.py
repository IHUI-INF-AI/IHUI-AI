# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/rollout_truncation.py
"""Rollout 按用户回合边界截断(2026-09-19 第二十七批,对标 Codex thread_rollout_truncation.rs)。

为"从第 N 个用户回合 fork/重放/裁剪"提供位置索引与截断原语:

- **用户回合边界**:由调用方注入判定(泛化 Codex 对 ResponseItem::Message
  的 parse_turn_item 判定),模块本身与具体消息格式解耦;
- **回滚标记**:序列中可插入 ``RollbackMarker(num_turns)``,表示"最近 N 个
  用户回合被移出有效历史"——位置索引据此收缩,保证按位置 fork 裁剪的是
  **回滚后**的有效历史而非原始流;
- **fork 边界**:真实用户消息,或 trigger_turn 的代理间消息(泛化为
  注入的 ``is_trigger_turn`` 判定),回滚按"指令回合"计数,从最早的被
  回滚边界起截断 fork 列表;
- 不足 N 个边界时保持完整(不截断)。

典型输入是我们持久化线程的消息/事件序列(items),每项为任意对象 +
两个判定回调;``RollbackMarker`` 是模块提供的哨兵类型。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional, Sequence


@dataclass(frozen=True)
class RollbackMarker:
    """ThreadRolledBack 标记:自此以后,最近 num_turns 个用户回合视为已移除。"""

    num_turns: int


def user_message_positions(
    items: Sequence[object],
    is_user_turn_boundary: Callable[[object], bool],
) -> list[int]:
    """用户消息边界位置索引(应用回滚标记后的有效历史)。"""
    positions: list[int] = []
    for idx, item in enumerate(items):
        if isinstance(item, RollbackMarker):
            keep = max(0, len(positions) - max(0, item.num_turns))
            del positions[keep:]
        elif is_user_turn_boundary(item):
            positions.append(idx)
    return positions


def truncate_before_nth_user_message(
    items: Sequence[object],
    n_from_start: int,
    is_user_turn_boundary: Callable[[object], bool],
) -> list[object]:
    """截取严格早于第 n(0 基)个用户消息的前缀(不含该消息本身)。

    边界数量 ≤ n 时原样返回完整序列(Codex 同款"不截断"语义)。
    """
    positions = user_message_positions(items, is_user_turn_boundary)
    if len(positions) <= n_from_start:
        return list(items)
    return list(items[: positions[n_from_start]])


def fork_turn_positions(
    items: Sequence[object],
    is_user_turn_boundary: Callable[[object], bool],
    is_trigger_turn: Optional[Callable[[object], bool]] = None,
) -> list[int]:
    """fork 回合边界位置(用户消息 + trigger_turn 消息),应用回滚语义。

    回滚按"指令回合"计数:从最早被回滚的指令回合边界起,
    其后的 fork 边界全部失效(Codex rollback_start_idx 语义)。
    """
    rollback_positions: list[int] = []
    fork_positions: list[int] = []
    for idx, item in enumerate(items):
        if isinstance(item, RollbackMarker):
            num = max(0, item.num_turns)
            if num == 0:
                continue
            rollback_start = (
                rollback_positions[len(rollback_positions) - num]
                if len(rollback_positions) >= num
                else (rollback_positions[0] if rollback_positions else None)
            )
            if rollback_start is None:
                continue
            del rollback_positions[len(rollback_positions) - num:]
            fork_positions = [p for p in fork_positions if p < rollback_start]
        elif is_user_turn_boundary(item):
            rollback_positions.append(idx)
            fork_positions.append(idx)
        elif is_trigger_turn is not None and is_trigger_turn(item):
            # 代理间 trigger_turn 消息:同样是指令回合边界
            rollback_positions.append(idx)
            fork_positions.append(idx)
    return fork_positions


def truncate_to_last_n_fork_turns(
    items: Sequence[object],
    n_from_end: int,
    is_user_turn_boundary: Callable[[object], bool],
    is_trigger_turn: Optional[Callable[[object], bool]] = None,
) -> list[object]:
    """保留最后 n 个 fork 回合的后缀;n=0 返回空;不足 n 时从首个边界起保留。"""
    if n_from_end == 0:
        return []
    positions = fork_turn_positions(items, is_user_turn_boundary, is_trigger_turn)
    if not positions:
        return list(items)
    keep_idx = positions[len(positions) - n_from_end] if len(positions) >= n_from_end else positions[0]
    return list(items[keep_idx:])


def has_prior_user_turns(
    items: Sequence[object],
    is_user_turn_boundary: Callable[[object], bool],
) -> bool:
    """有效历史中是否已存在用户回合(Codex initial_history_has_prior_user_turns)。"""
    return bool(user_message_positions(items, is_user_turn_boundary))


def truncate_after_turn_id(
    items: Sequence[object],
    turn_id: str,
    turn_started_index: Callable[[object], Optional[str]],
    turn_status: Optional[Callable[[str], str]] = None,
) -> list[object]:
    """截取到指定已持久化回合结束的后缀(含该回合)。

    Args:
        turn_started_index: 返回该项声明的 turn_id(TurnStarted 边界),否则 None
        turn_status: 可选,turn_id → 状态;状态为 "in_progress" 抛 ValueError
    Raises:
        ValueError: turn_id 不存在 / 非规范持久化边界 / 进行中
    """
    start_idx: Optional[int] = None
    for idx, item in enumerate(items):
        tid = turn_started_index(item)
        if tid == turn_id:
            start_idx = idx
            break
    if start_idx is None:
        raise ValueError(f"turn id '{turn_id}' 未在源线程中找到规范 TurnStarted 边界")
    if turn_status is not None and turn_status(turn_id) == "in_progress":
        raise ValueError(f"turn id '{turn_id}' 标识一个进行中的回合")
    cut = len(items)
    for idx in range(start_idx + 1, len(items)):
        if turn_started_index(items[idx]) is not None:
            cut = idx
            break
    return list(items[:cut])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

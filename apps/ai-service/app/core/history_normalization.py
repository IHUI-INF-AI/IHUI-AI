# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话历史健全化（对标 codex-rs core/src/context_manager/normalize.rs）。

在每轮 prompt 组装前对 OpenAI 风格的 ``messages``（``list[dict]``）做健全化，
避免把残缺历史直接打给 LLM 触发 400：

* ``ensure_call_outputs_present``  —— 对应 codex ``ensure_call_outputs_present``：
  assistant 带 ``tool_calls`` 但缺对应 ``role='tool'`` 回复 → 补占位 tool 消息。
* ``remove_orphan_outputs``       —— 对应 codex ``remove_orphan_outputs``：
  tool 消息找不到前置 assistant 引用 → 删除（孤儿回复）。
* ``remove_corresponding_for``    —— 对应 codex ``remove_corresponding_for``：
  删除某 assistant 时连带删其 tool 回复（保持成对）。
* ``normalize_history``           —— 一键管线：先删孤儿再补占位。

全部函数对畸形输入防御（``tool_calls=None/非 list``、消息非 dict 一律跳过，不崩）。
纯标准库实现，无第三方依赖。
"""

from __future__ import annotations

from typing import Any

__all__ = [
    "ensure_call_outputs_present",
    "remove_orphan_outputs",
    "remove_corresponding_for",
    "normalize_history",
]

DEFAULT_PLACEHOLDER = "[tool call was interrupted; no output recorded]"


def _extract_tool_call_ids(tool_calls: object) -> list[str]:
    """从 assistant 消息的 ``tool_calls`` 字段提取 id 列表（isinstance 严格守卫）。

    OpenAI 格式: ``[{id: str, type: 'function', function: {...}}, ...]``
    非 list / 元素非 dict / 缺 id / id 不是非空 str 一律跳过（防御性）。
    """
    if not isinstance(tool_calls, list):
        return []
    ids: list[str] = []
    for tc in tool_calls:
        if isinstance(tc, dict):
            tc_id = tc.get("id")
            if isinstance(tc_id, str) and tc_id:
                ids.append(tc_id)
    return ids


def _tool_call_id_of(msg: object) -> str | None:
    """取出 tool 消息的 ``tool_call_id``（防御性：非 dict / 缺字段 → None）。"""
    if isinstance(msg, dict) and msg.get("role") == "tool":
        tc_id = msg.get("tool_call_id")
        if isinstance(tc_id, str) and tc_id:
            return tc_id
    return None


def ensure_call_outputs_present(
    messages: list[dict[str, Any]],
    *,
    placeholder: str = DEFAULT_PLACEHOLDER,
) -> int:
    """为缺少对应 tool 回复的 assistant tool_calls 补占位 tool 消息。

    规则：遍历每个 assistant，其 ``tool_calls`` 中每个 id 若在**其后**找不到
    ``role='tool'`` 且 ``tool_call_id == id`` 的消息，则在该 assistant 同组
    tool 回复（紧邻其后的连续 tool 块）的最末尾插入占位
    ``{"role": "tool", "tool_call_id": id, "content": placeholder}``。

    返回补插条数。原地修改（按原始坐标逆序插入，避免索引漂移）。

    对畸形输入防御：``tool_calls=None/非 list``、非 dict 项一律跳过。
    """
    if not isinstance(messages, list):
        return 0

    # 预登记所有 tool 消息（原始坐标 + tool_call_id），供按位置查找引用。
    tool_msgs: list[tuple[int, str]] = []
    for i, msg in enumerate(messages):
        tc_id = _tool_call_id_of(msg)
        if tc_id is not None:
            tool_msgs.append((i, tc_id))

    # 逐个 assistant 计算：缺失的 id（保持 tool_calls 顺序）与插入点。
    insertions: list[tuple[int, list[str], int]] = []
    for i, msg in enumerate(messages):
        if not isinstance(msg, dict) or msg.get("role") != "assistant":
            continue
        call_ids = _extract_tool_call_ids(msg.get("tool_calls"))
        if not call_ids:
            continue
        call_id_set = set(call_ids)

        # 该 assistant 之后、归属其 tool_calls 的 tool 回复。
        present_after: set[str] = set()
        last_pos = i  # 紧邻 tool 块的末尾坐标（无 tool 回复时即 assistant 之后）
        for ti, tcid in tool_msgs:
            if ti > i and tcid in call_id_set:
                present_after.add(tcid)
                if ti > last_pos:
                    last_pos = ti

        missing = [cid for cid in call_ids if cid not in present_after]
        if missing:
            insertions.append((i, missing, last_pos + 1))

    if not insertions:
        return 0

    # 按 assistant 原始坐标逆序处理，使低坐标插入不受高坐标插入的位移影响。
    insertions.sort(key=lambda x: x[0], reverse=True)
    count = 0
    for _assistant_index, missing_ids, insert_point in insertions:
        # 逆序插入使最终顺序与 missing_ids 顺序一致，且与既有 tool 回复相邻。
        for cid in reversed(missing_ids):
            messages.insert(
                insert_point,
                {"role": "tool", "tool_call_id": cid, "content": placeholder},
            )
            count += 1
    return count


def remove_orphan_outputs(messages: list[dict[str, Any]]) -> int:
    """删除所有找不到**前置** assistant ``tool_calls`` 引用的 ``role='tool'`` 消息。

    单趟遍历：维护「截至当前已见过的 assistant call id 集合」，tool 消息的
    ``tool_call_id`` 不在其中（即无前置 assistant 声明过该调用）即判定为孤儿删除。

    返回删除条数。原地修改。对畸形输入防御（非 dict / 缺 role / 缺 id 不删）。
    """
    if not isinstance(messages, list):
        return 0

    seen_call_ids: set[str] = set()
    result: list[dict[str, Any]] = []
    removed = 0
    for msg in messages:
        if not isinstance(msg, dict):
            result.append(msg)
            continue
        role = msg.get("role")
        if role == "assistant":
            for tc_id in _extract_tool_call_ids(msg.get("tool_calls")):
                seen_call_ids.add(tc_id)
            result.append(msg)
        elif role == "tool":
            own_id = _tool_call_id_of(msg)
            if own_id is None or own_id not in seen_call_ids:
                removed += 1  # 孤儿回复，丢弃
            else:
                result.append(msg)
        else:
            result.append(msg)

    messages[:] = result
    return removed


def remove_corresponding_for(
    messages: list[dict[str, Any]], assistant_index: int
) -> int:
    """删除指定索引的 assistant 及其全部 tool 回复消息（保持成对）。

    先基于目标 assistant 的 ``tool_calls`` 建立 id 集合，再一次性过滤
    （即该 assistant 本身 + 所有 ``tool_call_id`` 命中集合的 tool 消息）。

    返回删除条数。原地修改。索引越界 / 非 assistant / 非 dict 一律返回 0。
    """
    if not isinstance(messages, list):
        return 0
    if (
        not isinstance(assistant_index, int)
        or assistant_index < 0
        or assistant_index >= len(messages)
    ):
        return 0
    target = messages[assistant_index]
    if not isinstance(target, dict) or target.get("role") != "assistant":
        return 0

    call_ids = set(_extract_tool_call_ids(target.get("tool_calls")))

    def _keep(msg: object) -> bool:
        if msg is target:
            return False
        if isinstance(msg, dict) and msg.get("role") == "tool":
            tc_id = _tool_call_id_of(msg)
            if tc_id is not None and tc_id in call_ids:
                return False
        return True

    before = len(messages)
    messages[:] = [m for m in messages if _keep(m)]
    return before - len(messages)


def normalize_history(
    messages: list[dict[str, Any]],
    *,
    placeholder: str | None = None,
) -> dict[str, int]:
    """一键健全化管线：先 ``remove_orphan_outputs`` 再 ``ensure_call_outputs_present``。

    Args:
        messages: OpenAI 风格消息列表（原地修改）。
        placeholder: 补位占位文本；``None`` 表示只删不补（不插入占位）。

    Returns:
        ``{"orphans_removed": n, "placeholders_added": m}``。
    """
    if not isinstance(messages, list):
        return {"orphans_removed": 0, "placeholders_added": 0}

    orphans_removed = remove_orphan_outputs(messages)
    if placeholder is None:
        return {"orphans_removed": orphans_removed, "placeholders_added": 0}

    placeholders_added = ensure_call_outputs_present(messages, placeholder=placeholder)
    return {"orphans_removed": orphans_removed, "placeholders_added": placeholders_added}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

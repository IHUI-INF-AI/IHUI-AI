# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/queue_items.py
"""排队中的消息(queueItems)数据面 —— 单一真相源(D33①,2026-09-26 立)。

为什么需要:D33「过程性信息持久化」九类里 `queueItems` 是唯一**全仓零数据面**的一类
(`git grep -n "queueItems" HEAD -- apps/ai-service/app | grep -v test` = 0),对话流
"排队中的消息"在刷新 / 重拉历史后无从还原。票面纪律「api 侧先行 invent schema 属反序
设计」⇒ 本模块先把**产出端形状**立成一份事实源;发送端(`routers/llm.py`
`_fire_callback`)与落库校验端(`apps/api/src/routes/ai-callback.ts` 的 zod 白名单)
都按本模块的键名与形状取值,不得各写一份。

形状对齐前端既有 store,不做第二次映射:`apps/web/src/stores/chat.ts:145`
`SideQueueItem` = `{id, text, createdAt(Date.now() 毫秒)}`,与
`packages/shared/src/chat/queue-interactions.ts:192` `EditableQueueItem` 同形。

三个口径刻意收在函数里而不是交给调用方决定(写在两处就必然漂移):

1. **形状稳定**:无排队项给 `[]`,不给 `None`、不省键。既有八类字段沿用「非空才写
   key」(toolCalls / planSteps / steerApplied…),该约定对"本轮没有"与"这版后端没有"
   不作区分;而排队项恰好要靠这个区分 —— 读取侧需要能判定"确实没有排队消息"。
2. **身份最小集**:每项只出 `id` / `text` / `createdAt` 三键(白名单构造,不认识的键
   一律不透传),因此原始附件正文与凭据在结构上不可能进入 `chat_messages.metadata`。
3. **FIFO 不被并行分支打乱**:排序键 = `(入队毫秒, 入参下标)`,且同一批内基准时钟只取
   一次 —— 并发入队把 wall-clock 顺序写乱时,按声明的入队时间还原真实 FIFO;时间戳相同
   才回落到入参顺序(稳定排序,不引入随机)。
"""

from __future__ import annotations

import hashlib
import re
import time
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import UTC, datetime
from typing import Any, Final, TypedDict

__all__ = [
    "MAX_QUEUE_ITEMS",
    "QUEUE_ITEMS_FIELD",
    "QUEUE_ITEM_FIELDS",
    "TEXT_SUMMARY_LIMIT",
    "QueueItemPayload",
    "attach_queue_items",
    "build_queue_items",
]

# 回调 body / metadata 的唯一键名(与前端 store 字段同名,跨语言一份事实源)。
QUEUE_ITEMS_FIELD: Final[str] = "queueItems"
# 每项允许的字段集 = 落库形状的白名单;超集即判红(见 tests/test_queue_items_data_plane.py)。
QUEUE_ITEM_FIELDS: Final[frozenset[str]] = frozenset({"id", "text", "createdAt"})

# 体积护栏:与 llm.py `_STEER_QUEUE_LIMIT = 8` 同档(引导队列的既有上限),
# 超出只保留队首(下一个要跑的那批)—— 计数语义不丢:`thread.state.queued` 仍是全量 len。
MAX_QUEUE_ITEMS: Final[int] = 8
# 正文摘要长度:与 D24 `_TOOL_ARGS_PERSIST_LIMIT = 2000` 同量级,不新增第二档。
TEXT_SUMMARY_LIMIT: Final[int] = 2000

# epoch 秒 / 毫秒分界(Date.now() ≈ 1.7e12, time.time() ≈ 1.7e9)。
_MILLIS_THRESHOLD: Final[float] = 1e12
_ID_PREFIX: Final[str] = "q_"
# 正文取值次序:web/steer 用 text,agent engine 用 input,兜底 content。
_TEXT_KEYS: Final[tuple[str, ...]] = ("text", "input", "content")
# 入队时间取值次序:落库/前端规范名 → engine enqueuedAt → steer queuedAt(ISO)。
_CREATED_AT_KEYS: Final[tuple[str, ...]] = ("createdAt", "enqueuedAt", "queuedAt")
# 内联附件正文(data URI)不进 metadata:它是内容载荷,不是"排队中的这条消息说了什么"。
_INLINE_DATA_URI_RE: Final = re.compile(r"data:[^;\s,]+;base64,[A-Za-z0-9+/=]*")
_ATTACHMENT_PLACEHOLDER: Final[str] = "[attachment omitted]"


class QueueItemPayload(TypedDict):
    """落库/回放的单条排队项(与前端 SideQueueItem 逐字段同形同单位)。"""

    id: str
    text: str
    createdAt: int


def _now_ms() -> int:
    return int(time.time() * 1000)


def _to_created_at(value: object, ref_now_ms: int) -> int:
    """入队时间归一为 epoch 毫秒 —— 三处真相源各写各的,是本票最可能的漂移点。

    接受:int/float(秒或毫秒按量级判定)、ISO 8601 字符串(`datetime.now(UTC).isoformat()`
    带 +00:00;外部传 `Z` 也接)、纯数字字符串。判不出来一律退到本批基准时钟
    (退化成"最后入队",不抛异常 —— 数据面缺时间戳不该让一轮回调整体失败)。
    """
    if isinstance(value, bool):  # bool 是 int 的子类:True→1970 显然不成立
        return ref_now_ms
    if isinstance(value, (int, float)):
        number = float(value)
        return int(number if number >= _MILLIS_THRESHOLD else number * 1000)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return ref_now_ms
        if text.isdigit():
            return _to_created_at(int(text), ref_now_ms)
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return ref_now_ms
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return int(parsed.timestamp() * 1000)
    return ref_now_ms


def _summarize(raw: str) -> str:
    """正文 → 摘要:剥内联附件正文 → trim → 超长截断。

    截断标注与 llm.py `_truncate_persist_value` 同形(`...[truncated N chars]`),
    读回侧只需认一种退化形态。
    """
    cleaned = _INLINE_DATA_URI_RE.sub(_ATTACHMENT_PLACEHOLDER, raw).strip()
    if len(cleaned) <= TEXT_SUMMARY_LIMIT:
        return cleaned
    return f"{cleaned[:TEXT_SUMMARY_LIMIT]}...[truncated {len(cleaned) - TEXT_SUMMARY_LIMIT} chars]"


def _first_text(entry: Mapping[str, Any]) -> str:
    for key in _TEXT_KEYS:
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return ""


def _stable_id(explicit: object, text: str, created_at: int) -> str:
    """身份键:入队端给了就用;没给则由 (入队毫秒, 正文) 派生确定性 id。

    刻意**不用 uuid4**:同一条排队消息重放两次必须得到同一个 id,前端才能按 id
    去重 / 定位 / 编辑(`applyQueueEdit` 就按 id 寻址)。前缀 `q_` 与 agent engine
    `_handle_thread_enqueue` 既有的 `q_{uuid.hex[:12]}` 同档,不新增第二种形态。
    """
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip()
    digest = hashlib.sha1(f"{created_at}\n{text}".encode()).hexdigest()[:12]
    return f"{_ID_PREFIX}{digest}"


def build_queue_items(
    entries: Sequence[Any] | None,
    *,
    now_ms: int | None = None,
    limit: int = MAX_QUEUE_ITEMS,
) -> list[QueueItemPayload]:
    """把任意既有队列形态归一为落库用的 queueItems 数组(永不返回 None)。

    入参接受三种在仓形态:`{text, queuedAt(ISO)}`(llm.py steer 队列)、
    `{id, input, enqueuedAt(秒)}`(agent engine thread.queue)、`{id, text, createdAt(毫秒)}`
    (前端 SideQueueItem)。非 Mapping 项、正文为空 / 非字符串的项一律不进数组
    (与 llm.py drain 循环 `if not _steer_text: continue` 同语义)。
    """
    ref_now_ms = now_ms if now_ms is not None else _now_ms()
    rows: list[tuple[int, int, QueueItemPayload]] = []
    for index, entry in enumerate(entries or ()):
        if not isinstance(entry, Mapping):
            continue
        raw_entry: Mapping[str, Any] = entry
        text = _first_text(raw_entry)
        if not text.strip():
            continue
        created_at = ref_now_ms
        for key in _CREATED_AT_KEYS:
            candidate = raw_entry.get(key)
            if candidate is not None:
                created_at = _to_created_at(candidate, ref_now_ms)
                break
        summary = _summarize(text)
        rows.append(
            (
                created_at,
                index,
                {
                    "id": _stable_id(raw_entry.get("id"), summary, created_at),
                    "text": summary,
                    "createdAt": created_at,
                },
            )
        )
    rows.sort(key=lambda row: (row[0], row[1]))
    return [row[2] for row in rows[: max(0, limit)]]


def attach_queue_items(
    body: MutableMapping[str, Any],
    entries: Sequence[Any] | None,
    *,
    now_ms: int | None = None,
) -> None:
    """把 `queueItems` 写进回调 body(api 侧据此浅合并进 chat_messages.metadata)。

    **无条件写键**,与 toolCalls / planSteps / steerApplied 的「非空才写」刻意不同(理由
    见模块 docstring 第 1 条)。队列是瞬时态:每轮写回当轮快照(含空数组)正是期望语义,
    上一轮的残留不该在刷新后仍然显示。

    落点:`routers/llm.py` `_fire_callback` 各产出点(该文件由并行会话持有未提交改动,
    接线动作以本函数为唯一入口,一处即成)。
    """
    body[QUEUE_ITEMS_FIELD] = build_queue_items(entries, now_ms=now_ms)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

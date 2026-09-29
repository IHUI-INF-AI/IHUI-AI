# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""同 record_id 二次投递的「逐列定向合并」唯一实现(2026-09-29 G-822 立)。

账本一行的幂等键是天然的(`run_id:step:N`),但同一行会被**两个阶段**各投一次:先
"开始/进行中"(此时耗时与结束还不知道),后"一次性完成"(才带回 duration/ended_at)。
旧实现在同 id 处直接丢弃迟到那条 ⇒ 行永久停在耗时 0 / 结束时刻空。
合并必须**按列方向**判,不得用"谁新谁赢"一句兜掉(那正是本票要拦的形状):

- `at`(首见时刻)取**最早** —— 一次不带时间的盲投会被归一化填成 now,
  若允许它覆盖,账目就被挪进错误的时间桶(timeseries/日期过滤随之错)。
- `ended_at`(完成时刻)与 `duration_ms`(耗时)取**较大者** —— 后到补齐,
  且倒退的投递不得把已量到的值改小。
- 身份列与**已入账的测量列**(令牌/成本)先到先定 —— 账本不得事后改写已入账的量;
  空值与哨兵("unknown"/"(unknown)" 这类)不构成"已知",不得覆盖已知值,
  但已知值可以补齐旧行的空值(旧值为空 ⇒ 接受新值)。
- `status` 的 error 是既成事实:只允许 ok→error 补齐,不允许 error→ok 被盲投洗掉。

本模块只认列名与方向,不认账本语义之外的东西;新增列必须同时进
`COLUMN_DIRECTIONS`(与 `LedgerEntry` 字段集的对账由 tests/test_cost_ledger.py 钉住)。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final, Literal, TypeGuard

__all__ = [
    "COLUMN_DIRECTIONS",
    "LedgerRow",
    "LedgerValue",
    "MergeDirection",
    "MergeResult",
    "merge_entry",
    "parse_timestamp",
]

LedgerValue = str | int | float | bool | None
LedgerRow = dict[str, LedgerValue]
MergeDirection = Literal["keep", "earliest", "latest", "first_known", "late_unless_terminal"]

# 数据类的缺省态即"这一次还没测到"(0 / "" / 哨兵),不是"值本身就是 0"。
_ABSENT_STRINGS: Final[frozenset[str]] = frozenset({"", "unknown", "(unknown)", "none", "null", "n/a"})
# error 是既成事实,后到的盲投不得把它降回 ok。
_TERMINAL_STATUS: Final[str] = "error"

# 唯一方向表:列名 → 合并方向(顺序与 LedgerEntry 字段一致,便于逐列审计)。
COLUMN_DIRECTIONS: Final[dict[str, MergeDirection]] = {
    "record_id": "keep",
    "user_id": "first_known",
    "session_id": "first_known",
    "run_id": "first_known",
    "tool_name": "first_known",
    "model": "first_known",
    "tokens_in": "first_known",
    "tokens_out": "first_known",
    "total_tokens": "first_known",
    "cached_tokens": "first_known",
    "cache_creation_tokens": "first_known",
    "provider": "first_known",
    "cost_usd": "first_known",
    "duration_ms": "latest",
    "status": "late_unless_terminal",
    "at": "earliest",
    "estimated": "keep",
    "ended_at": "latest",
}


@dataclass(frozen=True)
class MergeResult:
    """合并产物:新行 + 真正发生变化的列(空元组 == 逐列合并后行未变,即"真的重投")。"""

    row: LedgerRow
    changed_columns: tuple[str, ...]


def parse_timestamp(value: object) -> datetime | None:
    """ISO8601 → datetime(尾缀 Z 归一为 +00:00);解不出返回 None。

    唯一时间解析出口:合并面的端点比较与 cost_ledger 读面的窗口/分桶必须对同一个
    字符串给同一个答案。naive 串照原样返回 naive(与迁移前 `_parse_at` 逐字同语义,
    读面窗口输出因此一字不变),跨 naive/aware 的比较另由 `_order_key` 处理。
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except (ValueError, TypeError):
        return None


def _order_key(value: datetime) -> float:
    """naive 按 UTC 读:混合时区形态不得抛 TypeError,也不得被读成"比不出"。"""
    return (value if value.tzinfo is not None else value.replace(tzinfo=UTC)).timestamp()


def _is_number(value: LedgerValue) -> TypeGuard[int | float]:
    """bool 是 int 的子类,而 `estimated=False` 是已知值不是"缺省",必须显式排除。"""
    return isinstance(value, int | float) and not isinstance(value, bool)


def _is_known(value: LedgerValue) -> bool:
    if value is None or isinstance(value, bool):
        return value is not None
    if isinstance(value, str):
        return value.strip().lower() not in _ABSENT_STRINGS
    if _is_number(value):
        return value != 0
    return False


def _as_timestamp(value: LedgerValue) -> datetime | None:
    """只有字符串列才是时刻;数值列即使长得像年份也不得被当时间读。"""
    return parse_timestamp(value) if isinstance(value, str) else None


def _pick_earliest(old: LedgerValue, new: LedgerValue) -> LedgerValue:
    old_ts, new_ts = _as_timestamp(old), _as_timestamp(new)
    if old_ts is not None and new_ts is not None:
        return old if _order_key(old_ts) <= _order_key(new_ts) else new
    if old_ts is not None:
        return old
    if new_ts is not None:
        return new
    return old if _is_known(old) else new


def _pick_latest(old: LedgerValue, new: LedgerValue) -> LedgerValue:
    old_ts, new_ts = _as_timestamp(old), _as_timestamp(new)
    if old_ts is not None and new_ts is not None:
        return old if _order_key(old_ts) >= _order_key(new_ts) else new
    if old_ts is not None:
        return old
    if new_ts is not None:
        return new
    if _is_number(old) and _is_number(new):
        return old if float(old) >= float(new) else new
    return old if _is_known(old) else new


def _resolve(direction: MergeDirection, old: LedgerValue, new: LedgerValue) -> LedgerValue:
    """单列取值:方向决定胜负,未知值永远不得覆盖已知值。"""
    if direction == "keep":
        return old if old is not None else new
    if direction == "first_known":
        return old if _is_known(old) else new
    if direction == "late_unless_terminal":
        if old == _TERMINAL_STATUS:
            return old
        return new if _is_known(new) else old
    if direction == "earliest":
        return _pick_earliest(old, new)
    return _pick_latest(old, new)


def merge_entry(existing: LedgerRow, incoming: LedgerRow) -> MergeResult:
    """把同一 record_id 的下一次投递逐列并入已有行(不改两个入参,方向只有一份)。

    未被方向表覆盖的列一律保守处理:已有值不动,缺失才从 incoming 取
    (即"先到先定"),这样将来加列时最坏结果是"没补齐",而不是静默改写已入账数据。
    """
    row: LedgerRow = dict(existing)
    changed: list[str] = []
    for column, direction in COLUMN_DIRECTIONS.items():
        old_value = existing.get(column)
        winner = _resolve(direction, old_value, incoming.get(column))
        if column not in existing:
            row[column] = winner
            # 旧行没有这一列(升级前落盘的行):只有真拿到已知值才算补齐了一列
            if _is_known(winner):
                changed.append(column)
        elif winner != old_value:
            row[column] = winner
            changed.append(column)
    for column, value in incoming.items():
        if column not in row:
            row[column] = value
            changed.append(column)
    return MergeResult(row=row, changed_columns=tuple(changed))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

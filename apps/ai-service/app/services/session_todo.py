# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话级待办板(对齐 Qoder 的 TodoWrite 行为面,自研实现)。

为什么服务端要有一份:

* IHUI 的 CLI 执行体已有 ``todo_write`` / ``todo_read``
  (``apps/cli/src/tools/todo-write.ts``),但 **Python 侧没有** —— 同一轮对话在
  服务端跑时模型没有任何任务板可用,长任务只能靠上下文里的散文记住进度;
* ``team_task`` 是多子 agent 共享的协作表,语义是"认领/派发",不是"单回合计划";
  把单回合计划塞进团队表会让"谁持有"这件事失真;
* ``team_task`` 的条目只增不删,而计划需要整体替换(模型每次重写一份)。

语义(与 Qoder 的 TodoWrite 对齐):

* ``todo_write`` 是**整表替换**,不是追加;
* 状态五档 ``pending`` / ``in_progress`` / ``completed`` / ``cancelled`` / ``blocked``
  (Qoder 字面量原文:``{"description": string, "status": "pending"|"in_progress"|
  "completed"|"cancelled"|"blocked"}`` —— 只认三档会让模型表达"放弃/受阻"时被拒);
* 同一时刻最多一条 ``in_progress``(两条在飞等于计划本身没想清楚);
* 条目上限 50、单条正文上限 200 字 —— 超限**报错而不是静默截断**,
  否则模型会以为计划完整落盘;
* 按 (user_id, session_id) 隔离,2 小时过期;缺 session_id 时拒绝执行,
  避免 A 会话的计划被 B 会话读到。

存储刻意放在进程内:任务板是"本回合的工作记忆",不是产品数据。重启后模型
重新规划比读一份过期的旧计划更安全;需要跨重启的任务应走 ``goal`` 或定时任务。
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any, Iterable

__all__ = [
    "MAX_TODOS",
    "MAX_TODO_CONTENT_LEN",
    "TODO_STATUSES",
    "SessionTodoBoard",
    "TodoItem",
    "format_todos",
    "normalize_todos",
    "todo_board",
]

TODO_STATUSES: tuple[str, ...] = (
    "pending",
    "in_progress",
    "completed",
    "cancelled",
    "blocked",
)

MAX_TODOS = 50
MAX_TODO_CONTENT_LEN = 200
MAX_ACTIVE_FORM_LEN = 80

DEFAULT_TTL_SECONDS = 2 * 60 * 60
_MAX_BOARDS = 1024

_STATUS_MARKS = {
    "pending": "[ ]",
    "in_progress": "[→]",
    "completed": "[x]",
    "cancelled": "[-]",
    "blocked": "[!]",
}


@dataclass(frozen=True)
class TodoItem:
    """一条计划项。"""

    content: str
    status: str = "pending"
    active_form: str = ""

    def as_dict(self) -> dict[str, str]:
        out = {"content": self.content, "status": self.status}
        if self.active_form:
            out["activeForm"] = self.active_form
        return out


def normalize_todos(raw: Any) -> tuple[list[TodoItem] | None, str | None]:
    """校验并归一模型提交的计划表。

    Args:
        raw: ``todo_write`` 的 ``todos`` 参数(期望是对象数组;空数组 = 清空)。

    Returns:
        ``(items, None)`` 表示通过;``(None, 错误文案)`` 表示拒绝且**未落盘**。
    """
    if raw is None:
        return None, "todos 必填:传对象数组;传 [] 表示清空任务板"
    if not isinstance(raw, list):
        return None, "todos 必须是对象数组(每项含 content/status)"
    if len(raw) > MAX_TODOS:
        return None, f"todos 最多 {MAX_TODOS} 条,当前 {len(raw)} 条"
    items: list[TodoItem] = []
    in_progress = 0
    for idx, entry in enumerate(raw):
        if not isinstance(entry, dict):
            return None, f"第 {idx + 1} 项不是对象"
        content = entry.get("content")
        if not isinstance(content, str) or not content.strip():
            return None, f"第 {idx + 1} 项缺少非空 content"
        content = content.strip()
        if len(content) > MAX_TODO_CONTENT_LEN:
            return None, (
                f"第 {idx + 1} 项 content 超过 {MAX_TODO_CONTENT_LEN} 字"
                f"(当前 {len(content)} 字),请压缩后再提交"
            )
        status = entry.get("status", "pending")
        if not isinstance(status, str) or status not in TODO_STATUSES:
            return None, (
                f"第 {idx + 1} 项 status 非法: {status!r};"
                f"只能是 {' / '.join(TODO_STATUSES)}"
            )
        active_form = entry.get("activeForm", "")
        if active_form is not None and not isinstance(active_form, str):
            return None, f"第 {idx + 1} 项 activeForm 必须是字符串"
        active_form = (active_form or "").strip()[:MAX_ACTIVE_FORM_LEN]
        if status == "in_progress":
            in_progress += 1
        items.append(
            TodoItem(content=content, status=status, active_form=active_form)
        )
    if in_progress > 1:
        return None, (
            f"同一时刻最多一条 in_progress,当前 {in_progress} 条;"
            "请把其中一条改回 pending 或标记 completed"
        )
    return items, None


def format_todos(items: Iterable[TodoItem]) -> str:
    """把计划表折成模型/用户都能读的一屏文本。"""
    rows = list(items)
    if not rows:
        return "任务板为空。"
    done = sum(1 for item in rows if item.status == "completed")
    lines = [f"进度: {done}/{len(rows)} 已完成"]
    for item in rows:
        mark = _STATUS_MARKS.get(item.status, "[ ]")
        line = f"{mark} {item.content}"
        if item.status == "in_progress":
            line += " (进行中)"
        lines.append(line)
    return "\n".join(lines)


class SessionTodoBoard:
    """进程内会话待办板(TTL + 容量上限 + 线程锁)。"""

    def __init__(self, *, ttl_seconds: int = DEFAULT_TTL_SECONDS, max_boards: int = _MAX_BOARDS) -> None:
        self._ttl = max(1, int(ttl_seconds))
        self._max = max(1, int(max_boards))
        self._items: dict[tuple[str, str], tuple[list[TodoItem], float]] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _key(user_id: str | None, session_id: str | None) -> tuple[str, str]:
        return ((user_id or "").strip(), (session_id or "").strip())

    def _prune(self, now: float) -> None:
        for key in [k for k, (_items, exp) in self._items.items() if exp <= now]:
            self._items.pop(key, None)
        if len(self._items) > self._max:
            ordered = sorted(self._items.items(), key=lambda kv: kv[1][1])
            for key, _entry in ordered[: len(self._items) - self._max]:
                self._items.pop(key, None)

    def set(
        self,
        *,
        user_id: str | None,
        session_id: str | None,
        items: list[TodoItem],
        now: float | None = None,
    ) -> None:
        """整表替换(空列表 = 清空)。"""
        key = self._key(user_id, session_id)
        ts = time.monotonic() if now is None else now
        with self._lock:
            if not items:
                self._items.pop(key, None)
            else:
                self._items[key] = (list(items), ts + self._ttl)
            self._prune(ts)

    def get(
        self,
        *,
        user_id: str | None,
        session_id: str | None,
        now: float | None = None,
    ) -> list[TodoItem]:
        """读当前计划表(过期即空)。"""
        key = self._key(user_id, session_id)
        ts = time.monotonic() if now is None else now
        with self._lock:
            entry = self._items.get(key)
            if entry is None:
                return []
            items, exp = entry
            if exp <= ts:
                self._items.pop(key, None)
                return []
            return list(items)

    def clear(self, *, user_id: str | None, session_id: str | None) -> bool:
        """清空;返回是否真有一条被移除。"""
        key = self._key(user_id, session_id)
        with self._lock:
            return self._items.pop(key, None) is not None

    def reset(self) -> None:
        """清空全部(仅测试用)。"""
        with self._lock:
            self._items.clear()


todo_board = SessionTodoBoard()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

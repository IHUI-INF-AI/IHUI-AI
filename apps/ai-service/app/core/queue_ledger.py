# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-659:队列 durable admission 账本(2026-09-29 立项)。

排队项的真实生命周期(agent_engine.py,全内存):
- admit  = `_handle_thread_enqueue` → `thread.queue.append(...)`
- ACK    = `_handle_thread_prompt` drain 循环 `nxt = thread.queue.pop(0)`
  (pop 即 ACK,先于执行,无任何持久记录)
- cancel = `_handle_thread_queue_delete` 按 id 移除
- fail   = 已 ACK 项的 `_run_prompt_turn` 返回 success=False
- discard= 无显式点 —— 进程一死,`self._threads` 全内存队列整队蒸发

这就是票面要消的孤儿窗:kill 落在 ACK 之后、user message 落库(跨服务回调
`_fire_callback` → apps/api `ai-callback.ts` → chat_messages)之前,队列已
消费而转录无消息,且事后无从取证。本模块把每次状态跃迁**先于内存变更**追加
进 JSONL 账本(flush + fsync),重启后 recover() 对账。

存储选型(沿用仓内先例,不新开表/迁移):
- 队列本体是纯内存(EngineThread.queue),没有 redis/db 可挂;
- 文件账本先例 = `core/message_history.py`(~/.ihui/history.jsonl 追加式、
  坏行跳过)与 publish/anti_risk 的 audit_logger.jsonl,同"一行一条 JSON";
- sqlite 先例(session_store / approval_persistence)都要建表,票面禁止为此
  票新开数据库表/迁移 ⇒ JSONL 追加账本是既有持久原语里的最小方案。

状态机(admitted → promoted / cancelled / discarded / failed,终态不可逆):

    admitted ──ack──▶ promoted_pending ──confirm──▶ promoted(终态)
       │                    │
       │                    ├─fail──▶ failed(终态)
       │                    └─(重启对账,无确认)──▶ discarded(终态)
       ├─cancel──▶ cancelled(终态)
       └─(重启对账)──▶ discarded(终态)

"promotion 与 user message 同事务"的跨服务现实约束:user message 落库在
apps/api 侧(chat_messages),与 ai-service 内存队列不共享任何事务边界,真同
事务不可达。处置即账本的 promoted_pending 桥:ACK 时先落 promoted_pending,
回调确认后补 promoted(接线点在 llm.py `_fire_callback` 成功返回处,留给主
会话);重启对账时 promoted_pending 无确认即判孤儿 → discarded(原始行保留,
证据不改写)。

**逐字守票面**:recover() 不得把 failed 改写成 discarded —— failed 是"轮跑
了但失败"的既成事实,与"消费了却没跑成"的孤儿(discarded)是两种事故,混写
会抹掉失败证据。对账只处理非终态项(admitted / promoted_pending)。
"""

from __future__ import annotations

import contextlib
import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Final

__all__ = [
    "DEFAULT_LEDGER_PATH",
    "QUEUE_LEDGER_EVENTS",
    "QUEUE_LEDGER_STATES",
    "TERMINAL_STATES",
    "QueueLedger",
    "get_queue_ledger",
]

# 落盘路径沿用 message_history.py 的 IHUI_HOME 约定(同目录第二本账)。
DEFAULT_LEDGER_PATH: Final[Path] = Path(
    os.environ.get("IHUI_HOME") or Path.home() / ".ihui"
) / "queue-ledger.jsonl"

# 事件与状态:一份事实源,接线方只认这里的名。
QUEUE_LEDGER_EVENTS: Final[frozenset[str]] = frozenset(
    {"admit", "ack", "confirm", "cancel", "discard", "fail"}
)
QUEUE_LEDGER_STATES: Final[frozenset[str]] = frozenset(
    {"admitted", "promoted_pending", "promoted", "cancelled", "discarded", "failed"}
)
TERMINAL_STATES: Final[frozenset[str]] = frozenset(
    {"promoted", "cancelled", "discarded", "failed"}
)

# 事件 → 目标状态(状态机唯一映射)。
_EVENT_TO_STATE: Final[dict[str, str]] = {
    "admit": "admitted",
    "ack": "promoted_pending",
    "confirm": "promoted",
    "cancel": "cancelled",
    "discard": "discarded",
    "fail": "failed",
}

# 允许的跃迁(状态机本体;终态不在任何源里,天然不可逆)。
_ALLOWED_TRANSITIONS: Final[dict[str, frozenset[str]]] = {
    "admitted": frozenset({"promoted_pending", "cancelled", "discarded"}),
    "promoted_pending": frozenset({"promoted", "cancelled", "discarded", "failed"}),
    # 终态:空集。
    "promoted": frozenset(),
    "cancelled": frozenset(),
    "discarded": frozenset(),
    "failed": frozenset(),
}

_MAX_TEXT_CHARS: Final[int] = 2000  # 与 queue_items.TEXT_SUMMARY_LIMIT 同量级,不新增第二档


class QueueLedger:
    """追加式 JSONL 账本:每次跃迁一行,先落盘后生效。

    - 写入:进程内 threading.Lock 串行化;每行 flush + fsync,kill 于任意点
      已写的行不丢(这正是"kill 于 ACK 后必留一行"的物理前提)。
    - 读取:回放时坏行跳过不抛错(沿用 message_history 的容错降级)。
    - 终态不可逆:对已是终态的项再记任何事件一律拒写(返回 False),包括
      failed —— failed 不许被后续事件(尤其 discard)覆盖。
    """

    def __init__(self, path: Path | str | None = None) -> None:
        self._path = Path(path) if path is not None else DEFAULT_LEDGER_PATH
        self._lock = threading.Lock()
        self._states: dict[tuple[str, str], str] = {}
        self._seq = 0
        self._load()

    # ------------------------------------------------------------------
    # 读取/回放
    # ------------------------------------------------------------------

    def _load(self) -> None:
        """全量回放:最后一行定状态;坏行跳过(账本完整性靠写入侧 fsync,
        不靠读取侧报错)。"""
        if not self._path.exists():
            return
        with self._path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(row, dict):
                    continue
                item_id = row.get("itemId")
                event = row.get("event")
                target = _EVENT_TO_STATE.get(event) if isinstance(event, str) else None
                if not isinstance(item_id, str) or not item_id or target is None:
                    continue
                thread_id = row.get("threadId")
                key = (thread_id if isinstance(thread_id, str) else "", item_id)
                current = self._states.get(key)
                # 回放同样守终态不可逆:损坏/乱序文件里终态后的行不采纳。
                if current is not None and current in TERMINAL_STATES:
                    continue
                self._states[key] = target
                self._seq = max(self._seq, int(row.get("seq") or 0))

    def state_of(self, thread_id: str, item_id: str) -> str | None:
        with self._lock:
            return self._states.get((thread_id, item_id))

    def snapshot(self) -> dict[tuple[str, str], str]:
        with self._lock:
            return dict(self._states)

    # ------------------------------------------------------------------
    # 写入
    # ------------------------------------------------------------------

    def _append(self, row: dict[str, Any]) -> None:
        """单行追加 + fsync。调用方必须已持 self._lock。"""
        self._seq += 1
        row["seq"] = self._seq
        row.setdefault("ts", int(time.time() * 1000))
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
            f.flush()
            os.fsync(f.fileno())

    def _transition(
        self,
        event: str,
        thread_id: str,
        item_id: str,
        *,
        text: str | None = None,
        created_at: int | None = None,
    ) -> bool:
        target = _EVENT_TO_STATE[event]
        key = (thread_id, item_id)
        with self._lock:
            current = self._states.get(key)
            allowed_sources = {
                src for src, dsts in _ALLOWED_TRANSITIONS.items() if target in dsts
            }
            if current is not None and (
                current in TERMINAL_STATES or current not in allowed_sources
            ):
                # 终态不可逆;其余非法跃迁同样拒写(状态机咬合点)。
                return False
            row: dict[str, Any] = {
                "event": event,
                "threadId": thread_id,
                "itemId": item_id,
            }
            if text:
                row["text"] = text[:_MAX_TEXT_CHARS]
            if created_at is not None:
                row["createdAt"] = int(created_at)
            self._append(row)
            self._states[key] = target
            return True

    def record_admit(
        self,
        thread_id: str,
        item_id: str,
        *,
        text: str | None = None,
        created_at: int | None = None,
    ) -> bool:
        return self._transition("admit", thread_id, item_id, text=text, created_at=created_at)

    def record_ack(self, thread_id: str, item_id: str) -> bool:
        """ACK = drain 循环 pop(0) 那一刻。必须先于内存变更生效前调用。"""
        return self._transition("ack", thread_id, item_id)

    def record_confirmed(self, thread_id: str, item_id: str) -> bool:
        """回调确认:user message 已落库(apps/api chat_messages)。"""
        return self._transition("confirm", thread_id, item_id)

    def record_cancel(self, thread_id: str, item_id: str) -> bool:
        return self._transition("cancel", thread_id, item_id)

    def record_discard(self, thread_id: str, item_id: str) -> bool:
        return self._transition("discard", thread_id, item_id)

    def record_fail(self, thread_id: str, item_id: str) -> bool:
        return self._transition("fail", thread_id, item_id)

    # ------------------------------------------------------------------
    # 重启对账
    # ------------------------------------------------------------------

    def recover(self) -> dict[str, list[tuple[str, str]]]:
        """进程重启后对账:**只处理非终态项**,逐项补一行 discard。

        - admitted / promoted_pending → discarded(队列本体是内存,重启即蒸发;
          ACK 过的项补 discard 正是票面验收"kill 于 ACK 后必留一行 discarded")。
        - failed **原样保留**,不改写成 discarded(票面逐字守这条:failed 是
          既成事实,对账无权重判)。
        - 其余终态原样保留。
        返回 {"discarded": [...(threadId, itemId)], "failed_preserved": [...]}:
        仅供观测,不参与判定(item_id 跨 thread 可重名,故给键元组)。
        """
        recovered: list[tuple[str, str]] = []
        preserved_failed: list[tuple[str, str]] = []
        with self._lock:
            pending = [
                key
                for key, state in self._states.items()
                if state in ("admitted", "promoted_pending")
            ]
            for key in pending:
                thread_id, item_id = key
                self._append({"event": "discard", "threadId": thread_id, "itemId": item_id})
                self._states[key] = "discarded"
                recovered.append(key)
            preserved_failed = [
                key for key, state in self._states.items() if state == "failed"
            ]
        return {"discarded": recovered, "failed_preserved": preserved_failed}


# ----------------------------------------------------------------------
# 进程级单例(与 message_history 的模块级单例形态一致)
# ----------------------------------------------------------------------

_ledger: QueueLedger | None = None
_ledger_lock = threading.Lock()


def get_queue_ledger() -> QueueLedger:
    """进程级单例。首次取用时顺带 recover() 一次(等于把"进程重启"的对账
    提前到本进程首次队列交互之前,任何 admit/ack 都晚于它,语义等价且免去
    在引擎构造路径上做 IO)。对账失败不阻塞队列主链路(账本是取证面,
    不是可用面)。"""
    global _ledger
    with _ledger_lock:
        if _ledger is None:
            ledger = QueueLedger()
            with contextlib.suppress(Exception):
                ledger.recover()
            _ledger = ledger
        return _ledger
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

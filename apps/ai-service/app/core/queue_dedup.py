"""排队项幂等去重(2026-11-16 立,逆向对照 Codex `queuedSubmissionIds`)。

差距来源(Codex app.asar / chunk 331 thread 治理族取证):Codex 客户端在
`thread/queue/add` 前维护一个 `queuedSubmissionIds` 集合,入队前按 submission
身份判重 —— 同一 submission 重试(网络重发 / 用户快速双击 / 断线重连重放)
幂等返回已存在项,**不重复排队**。本仓 `_handle_thread_enqueue` 每次无条件
`uuid.uuid4()` 生成新 id 并 append,客户端重试会重复入队(同文排队项堆积,
drain 时重复执行同一 prompt)。

为什么是纯函数模块而不是直接改 agent_engine:① 判重键派生(submission 身份
→ 指纹)是无副作用可测核心,先立事实源;② 在飞 agent_engine.py 不硬接
(前轮已定档「兼容库不硬接」类决策,新能力以独立模块 + 测试钉行为)。

判重键选型 —— 两级:
1. **显式 clientRequestId**:调用方自带请求幂等键时,一级精确判重。
2. **(thread_id, 规范化 text) 指纹**:调用方未带键时,按线程内同文判重
   (排队窗口内的同文重试视为同一 submission)。规范化 = strip + 折叠连续
   空白,防"同文多打一个空格"绕过判重。

有界性:seen 集合随 drain 消费淘汰(项被 ACK 出队即从 seen 移除),不无限增长
—— 与 queue_ledger 的"队列必须有死亡机制"同一纪律。
"""

from __future__ import annotations

import re
import threading
from collections.abc import Awaitable, Callable
from typing import Any

_WS_RE = re.compile(r"\s+")


def normalize_submission_text(text: str) -> str:
    """规范化排队项文本:strip + 折叠连续空白为单空格。判重键派生用。"""
    return _WS_RE.sub(" ", text).strip()


def submission_fingerprint(thread_id: str, text: str) -> str:
    """(thread_id, 规范化 text) 指纹。同线程同文 = 同 submission。"""
    return f"{thread_id}::{normalize_submission_text(text)}"


class QueueDedup:
    """线程安全排队判重器。模仿 Codex `queuedSubmissionIds` 集合语义。

    - `admit` 返回 `(item_id, is_new)`:新 submission 登记(is_new=True)用
      调用方传入的 item_id;重试 submission 返回既有 item_id(is_new=False),
      调用方据此幂等响应、不重复入队。
    - `forget(item_id)`:项被 drain ACK 出队后调用,从 seen 淘汰(有界性)。
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # clientRequestId → item_id(显式键)
        self._by_request_id: dict[str, str] = {}
        # (thread_id, 规范化 text) → item_id(同文键)
        self._by_fingerprint: dict[str, str] = {}
        # item_id → 判重键(供 forget 反向淘汰)
        self._keys_of: dict[str, tuple[str | None, str | None]] = {}

    def admit(
        self,
        *,
        thread_id: str,
        text: str,
        item_id: str,
        client_request_id: str | None = None,
    ) -> tuple[str, bool]:
        """入队判重。返回 (item_id, is_new)。

        - 显式 client_request_id 命中 → 返回既有 item_id, is_new=False。
        - 否则 (thread_id, text) 指纹命中 → 同上。
        - 均未命中 → 用传入 item_id 登记,is_new=True。
        契约:命中/登记返回的 item_id 与注册时用的一致,forget 反向淘汰才咬合。
        """
        fingerprint = submission_fingerprint(thread_id, text)
        with self._lock:
            if client_request_id is not None:
                existing = self._by_request_id.get(client_request_id)
                if existing is not None:
                    return existing, False
            existing = self._by_fingerprint.get(fingerprint)
            if existing is not None:
                return existing, False
            if client_request_id is not None:
                self._by_request_id[client_request_id] = item_id
            self._by_fingerprint[fingerprint] = item_id
            self._keys_of[item_id] = (client_request_id, fingerprint)
            return item_id, True

    def forget(self, item_id: str) -> None:
        """项被 drain ACK 出队后淘汰(有界性,防 seen 无限增长)。"""
        with self._lock:
            keys = self._keys_of.pop(item_id, None)
            if keys is None:
                return
            request_id, fingerprint = keys
            if request_id is not None and self._by_request_id.get(request_id) == item_id:
                del self._by_request_id[request_id]
            if fingerprint is not None and self._by_fingerprint.get(fingerprint) == item_id:
                del self._by_fingerprint[fingerprint]

    def pending_count(self) -> int:
        """当前登记的 submission 数(观测用,不参与判定)。"""
        with self._lock:
            return len(self._keys_of)


async def dedup_enqueue(
    thread_queue: list[dict[str, Any]],
    dedup: QueueDedup,
    *,
    thread_id: str,
    text: str,
    new_item_id: str,
    make_item: Callable[[str], dict[str, Any]],
    client_request_id: str | None = None,
    record_admit: Callable[[str], None] | None = None,
    emit: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> dict[str, Any]:
    """幂等入队编排(纯函数,不依赖 agent_engine)。

    判重命中 → 返回既有项 id,不改队列(deduped=True);未命中 → 用 new_item_id
    构造新项 append,record_admit 落账,emit 广播。调用方把
    `_handle_thread_enqueue` 主体换成本函数即可接入幂等语义:new_item_id 由
    调用方先生成(uuid),未命中时才真正入队。
    """
    item_id, is_new = dedup.admit(
        thread_id=thread_id,
        text=text,
        item_id=new_item_id,
        client_request_id=client_request_id,
    )
    if not is_new:
        return {"id": item_id, "queued": len(thread_queue), "deduped": True}
    item = make_item(item_id)
    thread_queue.append(item)
    if record_admit is not None:
        record_admit(item_id)
    if emit is not None:
        await emit({"queued": len(thread_queue), "action": "enqueued"})
    return {"id": item_id, "queued": len(thread_queue), "deduped": False}

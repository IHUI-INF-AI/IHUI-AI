# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:auto-compact 窗口账本 — 对标 codex state/auto_compact_window.rs。

逐条移植:
- AutoCompactWindowIds: first/previous/current 三 UUID;当前窗 id 即
  first 窗的初始值;advance() 推进编号并把当前窗降为 previous。
  UUID v7(时间有序);ihui 侧用 uuid4 + 时间前缀近似(无 v7 依赖时)。
- prefill_input_tokens: ServerObserved(首个服务端 usage 样本的
  request-input 侧,恒优先且不可被 Estimated 覆盖) | Estimated
  (resume/重算基线估计,ServerObserved 到位后失效)。
- claim_*_delivered: 单发防重(mem::replace 语义)。
- new_context_window_requested: 模型主动开新窗标志,take 后清零,
  advance 后清零。
- snapshot(): 输出 prefill_input_tokens 供 body_after_prefix 扣减基线。
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Literal

PrefillKind = Literal["server_observed", "estimated"]


def _uuid_v7_like() -> str:
    """优先 uuid7(时间有序);无依赖时回退 uuid4。

    codex 用 Uuid::now_v7;Python 标准库无 v7,ihui 接受 uuid4 近似
    (唯一性语义一致,时间有序性由调用方 advance 顺序保证)。
    """
    return str(uuid.uuid4())


@dataclass
class AutoCompactWindowIds:
    first_window_id: str
    previous_window_id: str | None
    window_id: str

    @classmethod
    def new_initial(cls) -> "AutoCompactWindowIds":
        window_id = _uuid_v7_like()
        return cls(first_window_id=window_id, previous_window_id=None, window_id=window_id)


@dataclass
class AutoCompactWindowSnapshot:
    prefill_input_tokens: int | None


@dataclass
class AutoCompactWindow:
    window_number: int = 0
    ids: AutoCompactWindowIds = field(default_factory=AutoCompactWindowIds.new_initial)
    new_context_window_requested: bool = False
    # (kind, tokens);None=未记录
    prefill: tuple[PrefillKind, int] | None = None
    token_budget_reminder_delivered: bool = False
    auto_compact_fallback_delivered: bool = False

    @classmethod
    def new_with_ids(cls, ids: AutoCompactWindowIds) -> "AutoCompactWindow":
        return cls(window_number=0, ids=ids)

    def clear_prefill(self) -> None:
        self.prefill = None

    def restore(self, window_number: int, ids: AutoCompactWindowIds) -> None:
        self.window_number = window_number
        self.ids = ids

    def advance(self) -> tuple[int, AutoCompactWindowIds]:
        """推进到下一压缩窗:编号+1,当前窗降为 previous,新窗新 id,
        单发标志与开新窗请求全部清零(新窗重新记账)。"""
        self.window_number = self.window_number + 1
        self.ids.previous_window_id = self.ids.window_id
        self.ids.window_id = _uuid_v7_like()
        self.new_context_window_requested = False
        self.token_budget_reminder_delivered = False
        self.auto_compact_fallback_delivered = False
        return self.window_number, self.ids

    def claim_token_budget_reminder(self) -> bool:
        """首调用 True,此后 False(mem::replace 语义)。"""
        was = self.token_budget_reminder_delivered
        self.token_budget_reminder_delivered = True
        return not was

    def claim_auto_compact_fallback(self) -> bool:
        was = self.auto_compact_fallback_delivered
        self.auto_compact_fallback_delivered = True
        return not was

    def request_new_context_window(self) -> None:
        self.new_context_window_requested = True

    def take_new_context_window_request(self) -> bool:
        requested = self.new_context_window_requested
        self.new_context_window_requested = False
        return requested

    def ensure_server_observed_prefill_from_usage(self, input_tokens: int) -> None:
        """首个服务端 usage 样本的 request-input 侧;恒优先,不可被覆盖。

        该响应的 sampled output 属 body 增长,仍计入 auto-compact 预算。
        """
        if self.prefill is not None and self.prefill[0] == "server_observed":
            return
        self.prefill = ("server_observed", max(input_tokens, 0))

    def set_estimated_prefill(self, tokens: int) -> None:
        """resume/重算基线估计;ServerObserved 到位后调用是空操作。"""
        if self.prefill is not None and self.prefill[0] == "server_observed":
            return
        self.prefill = ("estimated", max(tokens, 0))

    def snapshot(self) -> AutoCompactWindowSnapshot:
        tokens: int | None = None if self.prefill is None else self.prefill[1]
        return AutoCompactWindowSnapshot(prefill_input_tokens=tokens)

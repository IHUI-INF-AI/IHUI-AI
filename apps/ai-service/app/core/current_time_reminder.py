# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""当前时间提醒(2026-09-19 第四十批,对标 codex-rs 三件套):

- context/current_time_reminder.rs:提醒片段本体(标记/正文/不可用降级)
- session/time_reminder.rs:投递节流状态机(窗口判定 + interval 节流 +
  user/tool-output boundary 消耗 + 时钟失败去重)
- config: CurrentTimeReminderConfig(默认 interval=1s、AnyInference 模式)

设计取舍(与 codex 语义逐条对齐):
- 片段是 developer 角色的上下文片段:格式 `<current_time_reminder>It is {UTC}.</…>`,
  content_kind = "current_time.reminder";时钟读取失败时降级为
  CurrentTimeUnavailable("failed to read current time"),绝不抛错阻塞回合。
- 节流四要素:①新窗口(window_id 变化)必投;②interval_seconds==0 每推理必投;
  ③距上次投递 >= interval 才投;④AfterUserOrToolOutput 模式下,非新窗口且
  非紧跟用户输入/工具输出的推理一律抑制(但 boundary 本身被消耗,不积累)。
- 时钟失败去重:同一 (turn_id, window_id) 的失败只注入一次不可用片段
  (压缩后窗口可能已不含早前提示,换窗口允许重试注入)。
- 状态可序列化快照(roundtrip):线程分叉/恢复时携带投递状态,避免重复提醒。

零依赖:datetime 标准库;时间源由调用方注入(time_provider 回调),测试可冻结。
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any

__all__ = [
    "CURRENT_TIME_REMINDER_OPEN_TAG",
    "CURRENT_TIME_REMINDER_CLOSE_TAG",
    "CURRENT_TIME_UNAVAILABLE_MESSAGE",
    "TURN_ABORTED_GUIDANCE_BY_STATUS",
    "TimeReminderDeliveryMode",
    "build_current_time_reminder",
    "build_current_time_unavailable",
    "build_turn_aborted_fragment",
    "is_current_time_reminder_fragment",
    "is_turn_aborted_fragment",
    "CurrentTimeReminderState",
]

# 片段标记(对标 CurrentTimeReminder::type_markers)
CURRENT_TIME_REMINDER_OPEN_TAG = "<current_time_reminder>"
CURRENT_TIME_REMINDER_CLOSE_TAG = "</current_time_reminder>"
# 时钟读取失败固定文案(对标 CurrentTimeUnavailable::MESSAGE)
CURRENT_TIME_UNAVAILABLE_MESSAGE = "failed to read current time"

# 中断指导文案(对标 TurnAborted::INTERRUPTED_GUIDANCE / INTERRUPTED_DEVELOPER_GUIDANCE;
# 按我方 checkpoint status 分档:cancelled=用户视角,cancelled/paused 共用后台进程告警)
TURN_ABORTED_GUIDANCE_BY_STATUS: dict[str, str] = {
    "cancelled": (
        "The user interrupted the previous turn on purpose. Any running unified exec "
        "processes may still be running in the background. If any tools/commands were "
        "aborted, they may have partially executed."
    ),
    "paused": (
        "The previous turn was interrupted on purpose. Any running unified exec processes "
        "may still be running in the background. If any tools/commands were aborted, they "
        "may have partially executed."
    ),
}

# TurnAborted 片段标记(对标 TurnAborted::type_markers)
TURN_ABORTED_OPEN_TAG = "<turn_aborted>"
TURN_ABORTED_CLOSE_TAG = "</turn_aborted>"


def build_turn_aborted_fragment(status: str) -> dict[str, Any]:
    """构造中断指导片段(对标 TurnAborted → ResponseItem;user 角色带标记)。"""
    guidance = TURN_ABORTED_GUIDANCE_BY_STATUS.get(status) or TURN_ABORTED_GUIDANCE_BY_STATUS[
        "cancelled"
    ]
    return {
        "type": "message",
        "role": "user",
        "content": [
            {
                "type": "input_text",
                "text": f"{TURN_ABORTED_OPEN_TAG}\n{guidance}\n{TURN_ABORTED_CLOSE_TAG}",
            }
        ],
    }


def is_turn_aborted_fragment(text: str) -> bool:
    """判断文本是否为中断指导片段(供 contextual 归约集/裁剪逻辑使用)。"""
    return text.lstrip().startswith(TURN_ABORTED_OPEN_TAG)


class TimeReminderDeliveryMode(StrEnum):
    """投递模式(对标 CurrentTimeReminderDeliveryMode)。

    - ANY_INFERENCE(默认):interval 到期即在任何推理前投递。
    - AFTER_USER_OR_TOOL_OUTPUT:仅在用户输入或工具输出之后的推理投递;
      新上下文窗口仍然强制投递一次。
    """

    ANY_INFERENCE = "any_inference"
    AFTER_USER_OR_TOOL_OUTPUT = "after_user_or_tool_output"


def _fmt_utc(dt: datetime) -> str:
    """统一 UTC 格式化(对标 %Y-%m-%d %H:%M:%S UTC)。"""
    return dt.strftime("%Y-%m-%d %H:%M:%S") + " UTC"


def build_current_time_reminder(current_time: datetime) -> dict[str, Any]:
    """构造时间提醒片段(对标 CurrentTimeReminder → ResponseItem)。

    developer 角色、content_kind="current_time.reminder"、带标记的 input_text。
    """
    body = f"It is {_fmt_utc(current_time)}."
    return {
        "type": "message",
        "role": "developer",
        "content": [
            {
                "type": "input_text",
                "text": f"{CURRENT_TIME_REMINDER_OPEN_TAG}\n{body}\n{CURRENT_TIME_REMINDER_CLOSE_TAG}",
            }
        ],
    }


def build_current_time_unavailable() -> dict[str, Any]:
    """构造时钟不可用片段(对标 CurrentTimeUnavailable → ResponseItem)。

    同为 developer 角色;失败降级好过让回合失败。
    """
    return {
        "type": "message",
        "role": "developer",
        "content": [
            {
                "type": "input_text",
                "text": (
                    f"{CURRENT_TIME_REMINDER_OPEN_TAG}\n"
                    f"{CURRENT_TIME_UNAVAILABLE_MESSAGE}\n"
                    f"{CURRENT_TIME_REMINDER_CLOSE_TAG}"
                ),
            }
        ],
    }


def is_current_time_reminder_fragment(text: str) -> bool:
    """判断文本是否为本片段(供 contextual 归约集/裁剪逻辑使用)。"""
    return text.lstrip().startswith(CURRENT_TIME_REMINDER_OPEN_TAG)


@dataclass
class CurrentTimeReminderState:
    """投递节流状态机(对标 CurrentTimeReminderState,逐字段等价)。

    用法(对标 Session::maybe_record_current_time_reminder):
        state = CurrentTimeReminderState()
        item = state.take_reminder(
            window_id="w1", turn_id="t1",
            current_time=datetime.now(UTC),
            time_provider=clock_fn,  # 返回 datetime 或抛异常
        )
    - item 非 None:把该片段追加进对话历史(投递);
    - item 为 "unavailable" 哨兵之外的场景:时钟失败且同窗口已注入过 → None。
    """

    last_delivery_time: datetime | None = None
    last_window_id: str | None = None
    last_clock_failure: tuple[str, str] | None = None  # (turn_id, window_id)
    pending_user_or_tool_output_boundary: bool = False
    # 可配置(对标 CurrentTimeReminderConfig 默认:interval=1、AnyInference)
    reminder_interval_seconds: int = 1
    delivery_mode: TimeReminderDeliveryMode = TimeReminderDeliveryMode.ANY_INFERENCE

    # ------------------------------------------------------------------
    # boundary 记录(对标 note_recorded_items:用户轮次边界或工具输出后置位)
    # ------------------------------------------------------------------
    def note_recorded_items(self, items: list[dict[str, Any]]) -> None:
        """扫描将写入历史的项,遇用户消息/工具输出则标记 boundary。"""
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "message" and item.get("role") == "user":
                self.pending_user_or_tool_output_boundary = True
                continue
            if item.get("type") in ("function_call_output", "custom_tool_call_output", "tool_search_output"):
                self.pending_user_or_tool_output_boundary = True

    # ------------------------------------------------------------------
    # 节流判定(对标 take_reminder_due,语义逐条对齐)
    # ------------------------------------------------------------------
    def _reminder_due(
        self,
        window_id: str,
        current_time: datetime,
    ) -> bool:
        is_new_window = self.last_window_id != window_id
        # 本次推理消耗 boundary(即使 interval 抑制投递,也不积累到下一次)
        follows_user_or_tool_output = self.pending_user_or_tool_output_boundary
        self.pending_user_or_tool_output_boundary = False
        if (
            self.delivery_mode == TimeReminderDeliveryMode.AFTER_USER_OR_TOOL_OUTPUT
            and not is_new_window
            and not follows_user_or_tool_output
        ):
            return False
        reminder_is_due = (
            is_new_window
            or self.reminder_interval_seconds == 0
            or self.last_delivery_time is None
            or (current_time - self.last_delivery_time).total_seconds()
            >= self.reminder_interval_seconds
        )
        if reminder_is_due:
            self.last_delivery_time = current_time
            self.last_window_id = window_id
        return reminder_is_due

    # ------------------------------------------------------------------
    # 带时钟读取的投递(对标 read_clock_for_context + maybe_record 合并入口)
    # ------------------------------------------------------------------
    def take_reminder(
        self,
        window_id: str,
        turn_id: str,
        time_provider: Callable[[], datetime],
    ) -> dict[str, Any] | None:
        """读取时钟并按节流策略返回提醒片段;失败降级,绝不抛错。

        Returns:
            - 正常:build_current_time_reminder 的片段(到期)或 None(被抑制);
            - 时钟失败:首败注入 CurrentTimeUnavailable 片段;同 (turn_id,
              window_id) 重复失败不再注入(对标 last_clock_failure 去重)。
        """
        try:
            current_time = time_provider()
        except Exception:  # noqa: BLE001 - 时钟失败降级(codex NonfatalClockReadErrors 语义)
            failure = (turn_id, window_id)
            if self.last_clock_failure == failure:
                return None
            self.last_clock_failure = failure
            return build_current_time_unavailable()
        # 时钟恢复:清失败记录(codex 成功路径清 last_clock_failure)
        self.last_clock_failure = None
        if not self._reminder_due(window_id, current_time):
            return None
        return build_current_time_reminder(current_time)

    # ------------------------------------------------------------------
    # 序列化快照(线程分叉/恢复携带,避免重复提醒;datetime 存 ISO 字符串)
    # ------------------------------------------------------------------
    def to_snapshot(self) -> dict[str, Any]:
        return {
            "last_delivery_time": (
                self.last_delivery_time.isoformat() if self.last_delivery_time else None
            ),
            "last_window_id": self.last_window_id,
            "last_clock_failure": (
                list(self.last_clock_failure) if self.last_clock_failure else None
            ),
            "pending_user_or_tool_output_boundary": self.pending_user_or_tool_output_boundary,
            "reminder_interval_seconds": self.reminder_interval_seconds,
            "delivery_mode": self.delivery_mode.value,
        }

    @classmethod
    def from_snapshot(cls, snap: dict[str, Any] | None) -> CurrentTimeReminderState:
        if not isinstance(snap, dict):
            return cls()
        last_delivery = snap.get("last_delivery_time")
        failure = snap.get("last_clock_failure")
        try:
            mode = TimeReminderDeliveryMode(snap.get("delivery_mode", "any_inference"))
        except ValueError:
            mode = TimeReminderDeliveryMode.ANY_INFERENCE
        return cls(
            last_delivery_time=(
                datetime.fromisoformat(last_delivery) if isinstance(last_delivery, str) else None
            ),
            last_window_id=snap.get("last_window_id"),
            last_clock_failure=tuple(failure) if isinstance(failure, list) and len(failure) == 2 else None,
            pending_user_or_tool_output_boundary=bool(
                snap.get("pending_user_or_tool_output_boundary", False)
            ),
            reminder_interval_seconds=int(snap.get("reminder_interval_seconds", 1)),
            delivery_mode=mode,
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/hook_runtime.py
"""生命周期钩子运行时(2026-09-19 第三十批,对标 Codex hook_runtime.rs / codex_hooks)。

在会话生命周期各点运行注册的钩子,聚合同类结果(Codex HookRuntimeOutcome 语义):

- **两个聚合产物**:
  1. ``additional_contexts``:钩子注入的附加上下文,按注册顺序拼接,
     由调用方并入模型输入(Codex ContextualUserFragment / additionalContext);
  2. ``should_stop``:任一钩子要求停止即停(带首个 stop_reason),
     对标 UserPromptSubmitOutcome / PreCompactHookOutcome::Stopped;
- **超时与隔离**:每个钩子带独立超时(默认 10s),单个钩子异常/超时
  被记录为 error 事件但不拖垮其余钩子(Codex hook run 失败隔离);
- **PRE_TOOL_USE 决策**:allow / deny(reason) / passthrough,任一 deny
  即拒绝(带原因),对标 PreToolUseHookResult;
- **事件审计**:每次运行产生 HookRunEvent(name, status, duration_ms,
  error),可下发前端/日志,对标 HookRunSummary 事件流。

钩子本身是同步或异步可调用 ``(payload) -> dict | None``;返回 dict 可含
``additional_context`` / ``stop`` / ``stop_reason`` / ``decision`` 字段。
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

DEFAULT_HOOK_TIMEOUT_SECS = 10.0

HookFunc = Callable[[dict[str, Any]], Any]


class HookKind(str, Enum):
    """生命周期挂载点(对标 SessionStart/UserPromptSubmit/PreToolUse/Pre·PostCompact/Stop)。"""

    SESSION_START = "session_start"
    USER_PROMPT_SUBMIT = "user_prompt_submit"
    PRE_TOOL_USE = "pre_tool_use"
    PRE_COMPACT = "pre_compact"
    POST_COMPACT = "post_compact"
    STOP = "stop"


@dataclass
class HookRunEvent:
    name: str
    kind: str
    status: str  # "ok" | "error" | "timeout"
    duration_ms: int
    error: Optional[str] = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "kind": self.kind,
            "status": self.status,
            "durationMs": self.duration_ms,
            **({"error": self.error} if self.error else {}),
        }


@dataclass
class HookOutcome:
    """一次钩子运行的聚合结果(对标 HookRuntimeOutcome)。"""

    should_stop: bool = False
    stop_reason: Optional[str] = None
    additional_contexts: list[str] = field(default_factory=list)
    denial_reason: Optional[str] = None  # PRE_TOOL_USE:非 None 即拒绝
    events: list[HookRunEvent] = field(default_factory=list)

    def events_as_dicts(self) -> list[dict[str, Any]]:
        return [e.as_dict() for e in self.events]


@dataclass
class _Registration:
    name: str
    kind: HookKind
    func: HookFunc
    timeout: float


class HookRuntime:
    """生命周期钩子注册表与执行器(单事件循环使用;线程安全不承诺)。"""

    def __init__(self) -> None:
        self._hooks: dict[HookKind, list[_Registration]] = {
            kind: [] for kind in HookKind
        }

    # ------------------------------------------------------------------
    def register(
        self,
        kind: HookKind,
        func: HookFunc,
        *,
        name: Optional[str] = None,
        timeout: float = DEFAULT_HOOK_TIMEOUT_SECS,
    ) -> None:
        """注册钩子;同点多钩子按注册顺序执行(上下文注入顺序确定)。"""
        reg_name = name or getattr(func, "__name__", "hook") or "hook"
        self._hooks[kind].append(
            _Registration(name=reg_name, kind=kind, func=func, timeout=timeout)
        )

    def hooks_for(self, kind: HookKind) -> list[str]:
        return [r.name for r in self._hooks[kind]]

    # ------------------------------------------------------------------
    async def run(self, kind: HookKind, payload: Optional[dict[str, Any]] = None) -> HookOutcome:
        """运行某点全部钩子并聚合(失败隔离 + 事件审计)。"""
        outcome = HookOutcome()
        regs = self._hooks[kind]
        if not regs:
            return outcome
        payload = payload or {}
        for reg in regs:
            event, result = await self._run_one(reg, payload)
            outcome.events.append(event)
            self._absorb(reg, event, result, outcome, kind)
        return outcome

    async def _run_one(
        self, reg: _Registration, payload: dict[str, Any]
    ) -> tuple[HookRunEvent, Any]:
        started = time.perf_counter()
        try:
            result = reg.func(payload)
            if asyncio.iscoroutine(result):
                result = await asyncio.wait_for(result, timeout=reg.timeout)
            duration_ms = int((time.perf_counter() - started) * 1000)
            return (
                HookRunEvent(name=reg.name, kind=reg.kind.value, status="ok", duration_ms=duration_ms),
                result,
            )
        except asyncio.TimeoutError:
            duration_ms = int((time.perf_counter() - started) * 1000)
            return (
                HookRunEvent(
                    name=reg.name, kind=reg.kind.value, status="timeout",
                    duration_ms=duration_ms, error=f"timeout after {reg.timeout}s",
                ),
                None,
            )
        except Exception as e:  # noqa: BLE001 - 钩子失败隔离
            duration_ms = int((time.perf_counter() - started) * 1000)
            return (
                HookRunEvent(
                    name=reg.name, kind=reg.kind.value, status="error",
                    duration_ms=duration_ms, error=str(e),
                ),
                None,
            )

    def _absorb(
        self,
        reg: _Registration,
        event: HookRunEvent,
        result: Any,
        outcome: HookOutcome,
        kind: HookKind,
    ) -> None:
        if result is None:
            return
        if not isinstance(result, dict):
            return
        ctx = result.get("additional_context")
        if isinstance(ctx, str) and ctx:
            outcome.additional_contexts.append(ctx)
        elif isinstance(ctx, list):
            outcome.additional_contexts.extend(c for c in ctx if isinstance(c, str) and c)
        if result.get("stop"):
            if not outcome.should_stop:
                outcome.should_stop = True
                outcome.stop_reason = (
                    result.get("stop_reason") if isinstance(result.get("stop_reason"), str) else None
                ) or f"stopped by hook '{reg.name}'"
        if kind is HookKind.PRE_TOOL_USE:
            decision = result.get("decision")
            if decision == "deny" and outcome.denial_reason is None:
                reason = result.get("reason")
                outcome.denial_reason = (
                    reason if isinstance(reason, str) and reason else f"denied by hook '{reg.name}'"
                )

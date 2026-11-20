# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/hook_runtime.py
"""生命周期钩子运行时(2026-09-19 第三十批,遵循统一工程规范)。

在会话生命周期各点运行注册的钩子,聚合同类结果(Codex HookRuntimeOutcome 语义):

- **两个聚合产物**:
  1. ``additional_contexts``:钩子注入的附加上下文,按注册顺序拼接,
     由调用方并入模型输入(Codex ContextualUserFragment / additionalContext);
  2. ``should_stop``:任一钩子要求停止即停(带首个 stop_reason),
     对齐 UserPromptSubmitOutcome / PreCompactHookOutcome::Stopped;
- **超时与隔离**:每个钩子带独立超时(默认 10s),单个钩子异常/超时
  被记录为 error 事件但不拖垮其余钩子(Codex hook run 失败隔离);
- **PRE_TOOL_USE 决策**:allow / deny(reason) / passthrough,任一 deny
  即拒绝(带原因),对齐 PreToolUseHookResult;
- **事件审计**:每次运行产生 HookRunEvent(name, status, duration_ms,
  error),可下发前端/日志,对齐 HookRunSummary 事件流。

钩子本身是同步或异步可调用 ``(payload) -> dict | None``;返回 dict 可含
``additional_context`` / ``stop`` / ``stop_reason`` / ``decision`` 字段。
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

DEFAULT_HOOK_TIMEOUT_SECS = 10.0


class _NoUpdatedOutput:
    """哨兵:钩子没给产出替换值时用它,避免与"显式改成 None"混淆。"""

    def __repr__(self) -> str:  # pragma: no cover - 仅调试
        return "<no-updated-output>"


NO_UPDATED_OUTPUT = _NoUpdatedOutput()

HookFunc = Callable[[dict[str, Any]], Any]


class HookKind(StrEnum):
    """生命周期挂载点(对齐 SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/Pre·PostCompact/Stop)。"""

    SESSION_START = "session_start"
    USER_PROMPT_SUBMIT = "user_prompt_submit"
    PRE_TOOL_USE = "pre_tool_use"
    # 2026-11-20:契约(HOOK_EVENTS)一直有 post_tool_use,本仓此前只有 PRE ——
    # "产出改写面(updatedMCPToolOutput)"因此无挂载点,是典型的"契约在、执行链不在"。
    POST_TOOL_USE = "post_tool_use"
    # 2026-11-20:契约(HOOK_EVENTS)有 permission_request,本仓此前无挂载点 ⇒
    # "审批可编程裁决"(PermissionRequestDecisionWire.behavior)无处生效。
    PERMISSION_REQUEST = "permission_request"
    PRE_COMPACT = "pre_compact"
    POST_COMPACT = "post_compact"
    STOP = "stop"


@dataclass
class HookRunEvent:
    name: str
    kind: str
    status: str  # "ok" | "error" | "timeout"
    duration_ms: int
    error: str | None = None

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
    """一次钩子运行的聚合结果(对齐 HookRuntimeOutcome)。"""

    should_stop: bool = False
    stop_reason: str | None = None
    additional_contexts: list[str] = field(default_factory=list)
    denial_reason: str | None = None  # PRE_TOOL_USE:非 None 即拒绝
    # PRE_TOOL_USE:钩子给出的权限裁决(allow/deny/ask)。None = 不表态,沿用审批门。
    permission_decision: str | None = None
    # PRE_TOOL_USE:钩子改写后的工具入参(对齐 updatedInput)。哨兵区分"没给"与
    # "显式给空对象"(后者是合法的"清空参数")。
    updated_input: Any = field(default=NO_UPDATED_OUTPUT)
    # PERMISSION_REQUEST:钩子对"要不要问人"的裁决(allow/deny)。None = 不表态。
    permission_behavior: str | None = None
    # POST_TOOL_USE:钩子给出的产出替换值(对齐 updatedMCPToolOutput)。哨兵对象
    # 区分"没给"与"给了 None"—— 后者是合法的"抹掉结果",不能被当成未提供。
    updated_output: Any = field(default=NO_UPDATED_OUTPUT)
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
        name: str | None = None,
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
    async def run(self, kind: HookKind, payload: dict[str, Any] | None = None) -> HookOutcome:
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
        except TimeoutError:
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
            perm = result.get("permission_decision")
            if (
                outcome.permission_decision is None
                and isinstance(perm, str)
                and perm in ("allow", "deny", "ask")
            ):
                # 首个表态生效:多钩子给出相反裁决时由先注册者说了算,顺序确定。
                outcome.permission_decision = perm
                if perm == "deny" and outcome.denial_reason is None:
                    reason = result.get("reason")
                    outcome.denial_reason = (
                        reason if isinstance(reason, str) and reason
                        else f"denied by hook '{reg.name}'"
                    )
            if "updated_input" in result and outcome.updated_input is NO_UPDATED_OUTPUT:
                # 只认对象:非对象改写会让下游工具拿到形状外的入参(比不改更危险)。
                if isinstance(result["updated_input"], dict):
                    outcome.updated_input = result["updated_input"]
        if kind is HookKind.POST_TOOL_USE and "updated_output" in result:
            # 后注册的钩子看到的仍是"原始产出"而不是前一枚改写后的值 —— 顺序确定、
            # 结果可预测;首个改写生效,后续改写按"最后写赢"覆盖(与 Codex 的链式
            # 改写同语义,但这里显式记录为覆盖而不是叠加)。
            outcome.updated_output = result["updated_output"]
        if kind is HookKind.PERMISSION_REQUEST:
            behavior = result.get("permission_behavior")
            if (
                outcome.permission_behavior is None
                and isinstance(behavior, str)
                and behavior in ("allow", "deny")
            ):
                # 首个表态生效;deny 同时落 denial_reason,便于调用方统一取原因。
                outcome.permission_behavior = behavior
                reason = result.get("reason")
                if behavior == "deny" and outcome.denial_reason is None:
                    outcome.denial_reason = (
                        reason if isinstance(reason, str) and reason
                        else f"denied by hook '{reg.name}'"
                    )


# ---------------------------------------------------------------------------
# 进程级生命周期钩子登记表(接线批 2026-11-01 立)
#
# 背景:HookRuntime 自批 30 移植后**消费侧判据面已全量装车**(agent_loop_v2 的
# PRE_TOOL_USE deny / additional_contexts 注入链),但构造/注入方全仓为 0 ——
# 三处生产构造入口(agents._new_v2_loop 唯一构造入口 / engine 主循环工厂 /
# agent_plan 计划执行)都不传 hook_runtime,`self._hook_runtime` 恒 None,
# pre-tool-use 可编程拦截从未真正生效。本节补的正是缺失的"登记→构造→注入"一环:
# - 登记表是进程级(代码级)唯一真相源,只许服务端 import 后
#   `register_lifecycle_hook()` 登记;**客户端请求面拿不到这个口**,注入路径
#   不构成任何可信主体绕过(属主 = 登记动作所在的服务端部署代码本身);
# - 三处构造入口统一经 `build_registered_hook_runtime()` 取 runtime,不在
#   路由层各写一份 register 时序(§0.6 单一真相源);
# - 登记表为空 ⇒ 构造出"无钩子的 HookRuntime",run() 返回空 outcome,与
#   接线前(self._hook_runtime=None 时的零行为变化)逐零等价。
# ---------------------------------------------------------------------------

_LIFECYCLE_HOOK_REGISTRY: list[tuple[HookKind, HookFunc, str | None, float]] = []


def register_lifecycle_hook(
    kind: HookKind,
    func: HookFunc,
    *,
    name: str | None = None,
    timeout: float = DEFAULT_HOOK_TIMEOUT_SECS,
) -> None:
    """登记一枚进程级生命周期钩子;此后每次构造 runtime 时重放 register()。"""
    _LIFECYCLE_HOOK_REGISTRY.append((kind, func, name, float(timeout)))


def clear_lifecycle_hook_registry() -> None:
    """清空登记表(测试隔离唯一出口;生产热重装载亦走此处再重登记)。"""
    _LIFECYCLE_HOOK_REGISTRY.clear()


def lifecycle_hook_registry_size() -> int:
    """登记表当前条目数(只读,供巡检/测试断言,不作判权输入)。"""
    return len(_LIFECYCLE_HOOK_REGISTRY)


def build_registered_hook_runtime() -> HookRuntime:
    """按登记表构造 HookRuntime —— 生产三构造入口共用的唯一取 runtime 出口。

    配置面(2026-11-20 立):登记表此前只有"服务端代码 register"一条来源,用户侧
    ``.ihui/hooks.json`` 无论怎么写都进不来(功能形同未装车)。这里在构造前补一次
    ``install_command_hooks()`` —— 它自带信任闸与幂等,未配置/未信任即 0 条,与接线
    前逐零等价;执行/超时/隔离/审计仍全部由本模块 HookRuntime 承担(不新造第二套)。
    """
    try:
        from .command_hooks import install_command_hooks

        install_command_hooks()
    except Exception as e:  # noqa: BLE001 - 配置面异常不得阻断循环构造
        logging.getLogger(__name__).warning("命令钩子装配失败(降级为无配置钩子): %s", e)
    runtime = HookRuntime()
    for kind, func, name, timeout in list(_LIFECYCLE_HOOK_REGISTRY):
        runtime.register(kind, func, name=name, timeout=timeout)
    return runtime
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

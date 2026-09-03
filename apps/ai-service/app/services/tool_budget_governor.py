# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具执行预算门控 — 补上审批/沙箱之外的真实缺口:执行配额/成本/并发门控(2026-09-03 立)。

对标 Claude Code / Codex 对单轮 / 单会话工具调用的资源管控:超配额即返回
确定性错误码并阻止继续执行,附带已用 / 上限信息供上层向 agent / 用户呈现。

覆盖 3 类上限(均可独立启用,0 = 不限制):
1. max_tools_per_run   —— 单 run 累计工具执行次数上限(循环失控兜底)
2. max_cost_per_run_usd —— 单 run 累计成本上限(配合 cost_estimate 前置扣、record 后校准)
3. max_concurrency      —— 单 run 并发工具执行上限(防并行打爆资源)

默认 enabled=False:不注入时执行器行为与现状逐零差异;开启仅需构造自定义
config 注入。可选接入点是同步 acquire/release + 异步上下文管理器 guard
(进 guard 前校验配额并在超出时抛 ToolBudgetExceededError,退出自动 release)。

线程安全性:内存状态用 threading.Lock 保护(进程内单实例足够,与 cloud_run_store
同款做法)。resource 无 I/O,同步实现;guard 仅做异步生命周期封装。
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# 确定性错误码:预算超限(供上层稳定匹配,勿改字符串)
BUDGET_EXCEEDED = "budget_exceeded"
# 预算未启用/未配置上限时放行理由
REASON_DISABLED = "budget_disabled"


@dataclass
class ToolBudgetConfig:
    """工具执行预算配置。0 / False 表示对应维度不限制。"""

    enabled: bool = False          # 默认关闭,不影响既有流程
    max_tools_per_run: int = 100   # 单 run 累计工具调用次数上限
    max_cost_per_run_usd: float = 5.0  # 单 run 累计成本上限(美元)
    max_concurrency: int = 4       # 单 run 并发执行上限


@dataclass
class GateResult:
    """一次 acquire 的门控结果。"""

    allowed: bool
    error_type: str | None = None
    reason: str = ""
    tool_name: str = ""
    used: dict[str, Any] = field(default_factory=dict)   # 已用(次数/成本/并发)
    limits: dict[str, Any] = field(default_factory=dict)  # 上限


class ToolBudgetExceededError(Exception):
    """工具预算超限异常(guard 在配额不足时抛出)。

    携带 error_type=BUDGET_EXCEEDED 与已用/上限,供上层结构化呈现。
    """

    def __init__(self, reason: str, result: GateResult | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.error_type = BUDGET_EXCEEDED
        self.result = result


class _RunState:
    """单 run 的预算计数状态。"""

    __slots__ = ("tool_count", "cost", "active")

    def __init__(self) -> None:
        self.tool_count = 0
        self.cost = 0.0
        self.active = 0  # 当前并发中(acquire 未 release)的调用数


class ToolBudgetGovernor:
    """工具执行预算门控器(进程内单实例,线程安全)。

    用法:
        gov = ToolBudgetGovernor(ToolBudgetConfig(enabled=True, max_tools_per_run=10))
        res = gov.acquire(run_id, tool_name="write_file")
        if not res.allowed:  # 阻止执行,res.error_type == "budget_exceeded"
            ...
        try:
            ...执行工具...
        finally:
            gov.release(run_id)

    或异步守卫:
        async with gov.guard(run_id, cost_estimate=0.001) as guard:
            ... (guard.allowed 恒 True,超额时 __aenter__ 直接抛工具执行违反则抛)
    """

    def __init__(self, config: ToolBudgetConfig | None = None) -> None:
        self.config = config or ToolBudgetConfig()
        self._states: dict[str, _RunState] = {}
        self._lock = threading.Lock()

    # ---------------- 内部 ----------------

    def _limits_active(self) -> bool:
        """是否有任何启用且非 0 的维度上限。全关则恒放行(零行为差异)。"""
        c = self.config
        return bool(
            c.enabled
            and (c.max_tools_per_run > 0 or c.max_cost_per_run_usd > 0 or c.max_concurrency > 0)
        )

    @staticmethod
    def _result(
        allowed: bool,
        state_used: dict[str, Any],
        limits: dict[str, Any],
        *,
        error_type: str | None = None,
        reason: str = "",
        tool_name: str = "",
    ) -> GateResult:
        return GateResult(
            allowed=allowed,
            error_type=error_type,
            reason=reason,
            tool_name=tool_name,
            used=state_used,
            limits=limits,
        )

    def _limits(self) -> dict[str, Any]:
        c = self.config
        return {
            "max_tools": c.max_tools_per_run if c.enabled else 0,
            "max_cost": c.max_cost_per_run_usd if c.enabled else 0.0,
            "max_concurrency": c.max_concurrency if c.enabled else 0,
        }

    def _used(self, st: _RunState) -> dict[str, Any]:
        return {
            "tool_count": st.tool_count,
            "cost": round(st.cost, 6),
            "active": st.active,
        }

    def _state(self, run_id: str) -> _RunState:
        with self._lock:
            st = self._states.get(run_id)
            if st is None:
                st = _RunState()
                self._states[run_id] = st
            return st

    # ---------------- 门控 API(同步,内存无 I/O) ----------------

    def acquire(
        self,
        run_id: str,
        *,
        tool_name: str = "",
        cost_estimate: float = 0.0,
    ) -> GateResult:
        """尝试取得一次工具执行配额。allowed=True 才应执行工具。

        - 预算未启用(默认)→ 恒放行,不产生任何副作用(零回归)
        - 任一维度超限 → allowed=False,error_type="budget_exceeded",
          附 used/limits;本次不计入 tool_count/active(不污染后续)
        - 允许 → 自增 tool_count+active,并按 cost_estimate 预扣成本
        """
        limits = self._limits()
        if not self._limits_active():
            empty = {"tool_count": 0, "cost": 0.0, "active": 0}
            return self._result(True, empty, limits, reason=REASON_DISABLED, tool_name=tool_name)

        if not run_id:
            raise ValueError("run_id 不能为空")
        with self._lock:
            st = self._states.get(run_id)
            if st is None:
                st = self._states.setdefault(run_id, _RunState())

            c = self.config
            # 并发维度
            prospective_active = st.active + 1
            if c.max_concurrency > 0 and prospective_active > c.max_concurrency:
                return self._result(
                    False, self._used(st), limits,
                    error_type=BUDGET_EXCEEDED,
                    reason=f"并发超限({prospective_active} > {c.max_concurrency})",
                    tool_name=tool_name,
                )
            # 次数维度
            prospective_tools = st.tool_count + 1
            if c.max_tools_per_run > 0 and prospective_tools > c.max_tools_per_run:
                return self._result(
                    False, self._used(st), limits,
                    error_type=BUDGET_EXCEEDED,
                    reason=f"执行次数超限({prospective_tools} > {c.max_tools_per_run})",
                    tool_name=tool_name,
                )
            # 成本维度
            prospective_cost = st.cost + max(0.0, float(cost_estimate))
            if c.max_cost_per_run_usd > 0 and prospective_cost > c.max_cost_per_run_usd:
                return self._result(
                    False, self._used(st), limits,
                    error_type=BUDGET_EXCEEDED,
                    reason=f"成本超限(预计 {prospective_cost:.4f}$ > {c.max_cost_per_run_usd}$)",
                    tool_name=tool_name,
                )
            # 提交
            st.tool_count = prospective_tools
            st.active = prospective_active
            st.cost = prospective_cost
            return self._result(
                True, self._used(st), limits, reason="ok", tool_name=tool_name
            )

    def release(self, run_id: str) -> int:
        """完成一次执行后释放并发占位,返回剩余并发中的调用数。"""
        with self._lock:
            st = self._states.get(run_id)
            if st is None:
                return 0
            st.active = max(0, st.active - 1)
            return st.active

    def record_usage(self, run_id: str, cost: float = 0.0) -> None:
        """按实际成本校准已用成本(acquire 预扣后可在此按真实值修正)。

        cost 为本次调用实际产生的增量成本,可为负(核实后回退)。幂等追加。
        """
        cost = float(cost)
        with self._lock:
            st = self._states.get(run_id)
            if st is None:
                return
            st.cost = round(max(0.0, st.cost + cost), 6)

    def get_state(self, run_id: str) -> dict[str, Any]:
        """查询某 run 的已用/上限/剩余。不存在的 run 返回全 0。"""
        limits = self._limits()
        with self._lock:
            st = self._states.get(run_id)
        used = self._used(st) if st else {"tool_count": 0, "cost": 0.0, "active": 0}
        remaining = {
            "tools": max(0, int(limits["max_tools"]) - used["tool_count"]),
            "cost": max(0.0, float(limits["max_cost"]) - used["cost"]),
        }
        return {"run_id": run_id, "used": used, "limits": limits, "remaining": remaining}

    def reset(self, run_id: str) -> bool:
        """重置某 run 的预算计数(存在则删除并返回 True)。"""
        with self._lock:
            if run_id in self._states:
                del self._states[run_id]
                return True
            return False

    # ---------------- 可选接入点:异步守卫 ----------------

    def guard(
        self, run_id: str, *, cost_estimate: float = 0.0, tool_name: str = ""
    ) -> ToolRunGuard:
        """返回异步上下文管理器作为工具执行的接入点。

        __aenter__ 时 acquire:超额则抛出 ToolBudgetExceededError(调用方决定终止),
        否则进入;__aexit__ 自动 release 并发占位。预算关闭时恒放行,零回归。
        """
        return ToolRunGuard(self, run_id, cost_estimate=cost_estimate, tool_name=tool_name)


class ToolRunGuard:
    """工具执行预算守卫(async with 用法)。"""

    def __init__(
        self,
        governor: ToolBudgetGovernor,
        run_id: str,
        *,
        cost_estimate: float = 0.0,
        tool_name: str = "",
    ) -> None:
        self._gov = governor
        self._run_id = run_id
        self._cost_estimate = cost_estimate
        self._tool_name = tool_name
        self.result: GateResult | None = None
        self._entered = False

    async def __aenter__(self) -> ToolRunGuard:
        self.result = self._gov.acquire(
            self._run_id,
            tool_name=self._tool_name,
            cost_estimate=self._cost_estimate,
        )
        if not self.result.allowed:
            raise ToolBudgetExceededError(self.result.reason, self.result)
        self._entered = True
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> bool:
        if self._entered:
            self._gov.release(self._run_id)
        return False  # 不吞异常


# 模块级单例(可被既有 agent 上下文按需注入)
tool_budget_governor = ToolBudgetGovernor()

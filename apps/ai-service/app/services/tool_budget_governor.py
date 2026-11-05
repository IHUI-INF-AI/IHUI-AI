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

分维配额(2026-11-05 立,goal-b49 S4):另开四个**彼此独立**的维度 ——
mcp_tool_limit(MCP 注册工具数上限)/ mcp_token_limit(MCP 令牌桶)/
custom_prompt_token_limit(自定义提示 token 上限)/ history_query_limit(历史查询窗口)。
四维各自只受自身取值管辖:**0 / 未配 ⇒ 该维关闭**(与对标产品把配额写死成内置常量
不同,我方四维同时进 core/capability_matrix.py 台账,可被守门 diff)。
`enabled` 只管辖上面三类 run 循环维(向后兼容,既有语义一字未动);
`acquire/release/record_usage/get_state` 的行为与三维默认值均不受本次改动影响。
超限一律**具名拒绝**:reason 同时含维度名 + 实测值 + 上限值,不做静默截断。

线程安全性:内存状态用 threading.Lock 保护(进程内单实例足够,与 cloud_run_store
同款做法)。resource 无 I/O,同步实现;guard 仅做异步生命周期封装。
"""

from __future__ import annotations

import logging
import math
import os
import threading
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# 确定性错误码:预算超限(供上层稳定匹配,勿改字符串)
BUDGET_EXCEEDED = "budget_exceeded"
# 预算未启用/未配置上限时放行理由
REASON_DISABLED = "budget_disabled"
# 放行理由:配额在位且未超(与 acquire 的字面 "ok" 同值,勿另起一名)
REASON_OK = "ok"
# 放行理由:该分维未配置上限(0 ⇒ 该维关闭,不产生任何计数副作用)
REASON_DIM_DISABLED = "dim_disabled"

# ---------------------------------------------------------------------------
# 分维配额(2026-11-05 立):维度名 = 台账键 = reason 里的具名片段,三者同源。
# 唯一实现点在本模块;测试与调用方一律 import 这些常量,不得在别处复制判据。
# ---------------------------------------------------------------------------
DIM_MCP_TOOL_LIMIT = "mcp_tool_limit"
DIM_MCP_TOKEN_LIMIT = "mcp_token_limit"
DIM_CUSTOM_PROMPT_TOKEN_LIMIT = "custom_prompt_token_limit"
DIM_HISTORY_QUERY_LIMIT = "history_query_limit"

#: 台账顺序固定的四维名单(投影/自检/遍历的唯一出口)
BUDGET_DIMENSIONS: tuple[str, ...] = (
    DIM_MCP_TOOL_LIMIT,
    DIM_MCP_TOKEN_LIMIT,
    DIM_CUSTOM_PROMPT_TOKEN_LIMIT,
    DIM_HISTORY_QUERY_LIMIT,
)

#: 维度到人说明(进 reason,便于拒绝时人能一眼读懂是哪一格)
DIM_LABELS: dict[str, str] = {
    DIM_MCP_TOOL_LIMIT: "MCP 注册工具数",
    DIM_MCP_TOKEN_LIMIT: "MCP 令牌桶",
    DIM_CUSTOM_PROMPT_TOKEN_LIMIT: "自定义提示 token",
    DIM_HISTORY_QUERY_LIMIT: "历史查询窗口",
}

# env 常量:唯一读取点 = ToolBudgetConfig.from_env;四个大写键同时登记进
# app/core/capability_matrix.py 台账(守门 check-capability-matrix J1 以这些
# 带引号字面量为「代码里真实存在」的取证)。
TOOL_BUDGET_MCP_TOOL_LIMIT_ENV = "TOOL_BUDGET_MCP_TOOL_LIMIT"
TOOL_BUDGET_MCP_TOKEN_LIMIT_ENV = "TOOL_BUDGET_MCP_TOKEN_LIMIT"
TOOL_BUDGET_CUSTOM_PROMPT_TOKEN_LIMIT_ENV = "TOOL_BUDGET_CUSTOM_PROMPT_TOKEN_LIMIT"
TOOL_BUDGET_HISTORY_QUERY_LIMIT_ENV = "TOOL_BUDGET_HISTORY_QUERY_LIMIT"

#: 维度 → env 键(台账登记与 from_env 取值共用这一张表)
DIM_ENV_KEYS: dict[str, str] = {
    DIM_MCP_TOOL_LIMIT: TOOL_BUDGET_MCP_TOOL_LIMIT_ENV,
    DIM_MCP_TOKEN_LIMIT: TOOL_BUDGET_MCP_TOKEN_LIMIT_ENV,
    DIM_CUSTOM_PROMPT_TOKEN_LIMIT: TOOL_BUDGET_CUSTOM_PROMPT_TOKEN_LIMIT_ENV,
    DIM_HISTORY_QUERY_LIMIT: TOOL_BUDGET_HISTORY_QUERY_LIMIT_ENV,
}

#: 只累加消耗的维度(其余维度按调用方实测值做阈值判定,不在本器记账)
ACCUMULATING_DIMENSIONS: tuple[str, ...] = (DIM_MCP_TOKEN_LIMIT,)

# CJK 区段(estimate_tokens 的量法基础):中日韩统一表意文字 + 扩展 A + 兼容
# 表意文字 + 日文假名 + 谚文音节。区间端点含在内。
_CJK_RANGES: tuple[tuple[int, int], ...] = (
    (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF),
    (0x3040, 0x30FF),
    (0x3130, 0x318F),
    (0xF900, 0xFAFF),
)


def is_cjk_char(ch: str) -> bool:
    """单字符是否属 CJK 族(estimate_tokens 的字符分类,导出以便复用而非重抄区间)。"""
    code = ord(ch)
    return any(low <= code <= high for low, high in _CJK_RANGES)


def estimate_tokens(text: str) -> int:
    """把文本折成 token **估算值**(零第三方依赖、可复算)。

    量法:CJK 字符 1 token/字,其余字符按 4 字符 ≈ 1 token 向上取整。
    这是估算而非某家 tokenizer 的精确计数 —— 分维上限按同一量法判,调用方
    若接入真 tokenizer 只需替换本函数,门控语义(具名拒绝 / 0 即关闭)不变。
    """
    if not text:
        return 0
    cjk = sum(1 for ch in text if is_cjk_char(ch))
    other = len(text) - cjk
    return cjk + math.ceil(other / 4)


def dim_exceed_reason(dimension: str, measured: int, limit: int) -> str:
    """超限拒绝的**具名**文案:维度名 + 实测值 + 上限值,三样缺一不可。

    失效方向 = 多要一次定向说明(点名是哪一维、超了多少),绝不是静默截断或
    笼统一句「预算不足」。
    """
    label = DIM_LABELS.get(dimension, dimension)
    return (
        f"分维配额超限[{dimension}] {label}: 实测 {measured} > 上限 {limit}"
        "(具名拒绝,未静默截断;请缩小请求或显式调高该维上限)"
    )


@dataclass
class ToolBudgetConfig:
    """工具执行预算配置。0 / False 表示对应维度不限制。

    run 循环三维(`enabled` 管辖)语义自 2026-09-03 起未变。
    分维配额四维(2026-11-05 起)**各自独立**:只看自身取值,0 = 该维关闭,
    与 `enabled` 无耦合 —— 故 `from_env()` 只配分维时绝不会把 run 循环维打开。
    """

    enabled: bool = False          # 默认关闭,不影响既有流程
    max_tools_per_run: int = 100   # 单 run 累计工具调用次数上限
    max_cost_per_run_usd: float = 5.0  # 单 run 累计成本上限(美元)
    max_concurrency: int = 4       # 单 run 并发执行上限
    # ---- 分维配额(彼此独立;0 / 未配 ⇒ 该维不拦)----
    mcp_tool_limit: int = 0            # MCP 注册工具数上限
    mcp_token_limit: int = 0           # MCP 令牌桶上限(token)
    custom_prompt_token_limit: int = 0  # 自定义提示 token 上限
    history_query_limit: int = 0       # 历史查询窗口上限(条)

    def __post_init__(self) -> None:
        """分维上限必须非负:负数既不是「不拦」也不是有效上限 ⇒ 当场说清,不猜。"""
        for dimension in BUDGET_DIMENSIONS:
            value = self.dim_limit(dimension)
            if value < 0:
                raise ValueError(
                    f"分维 {dimension} 的上限不得为负(收到 {value}):"
                    "0 = 该维关闭,正数 = 上限,负数无定义"
                )

    def dim_limit(self, dimension: str) -> int:
        """维度名 → 该维上限(单一取值出口;未知维度抛 KeyError,不返回 0 冒充「没配」)。"""
        if dimension == DIM_MCP_TOOL_LIMIT:
            return self.mcp_tool_limit
        if dimension == DIM_MCP_TOKEN_LIMIT:
            return self.mcp_token_limit
        if dimension == DIM_CUSTOM_PROMPT_TOKEN_LIMIT:
            return self.custom_prompt_token_limit
        if dimension == DIM_HISTORY_QUERY_LIMIT:
            return self.history_query_limit
        raise KeyError(dimension)

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> ToolBudgetConfig:
        """按台账登记的四个大写 env 键装配**分维配额**(run 循环维取数据类默认)。

        - `environ` 缺省读 `os.environ`;测试可注入映射(判据同一条,不写第二份)。
        - 未设置 / 空串 / 非法整数 / 非正数 ⇒ 0 ⇒ 该维关闭(非法值只 warning,不猜上限)。
        - 返回的 `enabled` 恒为默认 False:本类方法只装分维,绝不顺手打开 run 循环门。
        """
        source: Mapping[str, str] = os.environ if environ is None else environ
        limits: dict[str, int] = {}
        for dimension in BUDGET_DIMENSIONS:
            env_key = DIM_ENV_KEYS[dimension]
            raw = (source.get(env_key) or "").strip()
            if not raw:
                limits[dimension] = 0
                continue
            try:
                value = int(raw)
            except ValueError:
                logger.warning(
                    "[tool_budget] %s=%r 不是整数,%s 按 0(该维关闭)处理",
                    env_key,
                    raw,
                    dimension,
                )
                value = 0
            limits[dimension] = value if value > 0 else 0
        return cls(
            mcp_tool_limit=limits[DIM_MCP_TOOL_LIMIT],
            mcp_token_limit=limits[DIM_MCP_TOKEN_LIMIT],
            custom_prompt_token_limit=limits[DIM_CUSTOM_PROMPT_TOKEN_LIMIT],
            history_query_limit=limits[DIM_HISTORY_QUERY_LIMIT],
        )


@dataclass
class GateResult:
    """一次 acquire / 分维判定的门控结果。"""

    allowed: bool
    error_type: str | None = None
    reason: str = ""
    tool_name: str = ""
    used: dict[str, Any] = field(default_factory=dict)   # 已用(次数/成本/并发)
    limits: dict[str, Any] = field(default_factory=dict)  # 上限
    # 分维超限时点名的维度名;run 循环三维的路径恒为空串(既有形状不变)
    dimension: str = ""


class ToolBudgetExceededError(Exception):
    """工具预算超限异常(guard 在配额不足时抛出)。

    携带 error_type=BUDGET_EXCEEDED 与已用/上限,供上层结构化呈现。
    """

    def __init__(self, reason: str, result: GateResult | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.error_type = BUDGET_EXCEEDED
        self.result = result

    @property
    def dimension(self) -> str:
        """被点名的分维维度名(run 循环维或无结果时为空格串)。"""
        return self.result.dimension if self.result else ""


class _RunState:
    """单 run 的预算计数状态。"""

    __slots__ = ("tool_count", "cost", "active", "mcp_tokens")

    def __init__(self) -> None:
        self.tool_count = 0
        self.cost = 0.0
        self.active = 0  # 当前并发中(acquire 未 release)的调用数
        self.mcp_tokens = 0  # MCP 令牌桶已消耗(mcp_token_limit 维)


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

    分维配额(与上面 run 循环维互不相干,各自只受自身上限管辖):
        gov = ToolBudgetGovernor(ToolBudgetConfig(mcp_tool_limit=40, history_query_limit=300))
        res = gov.check_mcp_tool_count(len(registry.tools))     # 超限 ⇒ 具名拒绝
        res = gov.check_history_query(requested_rows=500)       # 同上
        res = gov.consume_mcp_tokens(run_id, tokens=1200)        # 令牌桶按 run 累加
        gov.dim_state(run_id)                                   # 四维上限/已用/剩余投影
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
        dimension: str = "",
    ) -> GateResult:
        return GateResult(
            allowed=allowed,
            error_type=error_type,
            reason=reason,
            tool_name=tool_name,
            used=state_used,
            limits=limits,
            dimension=dimension,
        )

    def _limits(self) -> dict[str, Any]:
        c = self.config
        limits: dict[str, Any] = {
            "max_tools": c.max_tools_per_run if c.enabled else 0,
            "max_cost": c.max_cost_per_run_usd if c.enabled else 0.0,
            "max_concurrency": c.max_concurrency if c.enabled else 0,
        }
        # 分维配额独立于 enabled 投影(0 = 该维关闭);既有三个键一字不删。
        limits.update(self.dim_limits())
        return limits

    def dim_limits(self) -> dict[str, int]:
        """四维上限投影(台账键 → 上限)。`limits` 投影与台账自检共用这一出口。"""
        return {dimension: self.config.dim_limit(dimension) for dimension in BUDGET_DIMENSIONS}

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

    # ---------------- 分维配额 API(2026-11-05 立;四维各自独立) ----------------

    def _dim_limit(self, dimension: str) -> int:
        """取该维上限;未知维度 ⇒ ValueError 点名合法维度(绝不返回 0 冒充「未配置」)。"""
        try:
            return self.config.dim_limit(dimension)
        except KeyError as exc:
            raise ValueError(
                f"未知分维 {dimension!r}:合法维度 = {', '.join(BUDGET_DIMENSIONS)}"
            ) from exc

    @staticmethod
    def _dim_measured(dimension: str, measured: int) -> int:
        """实测值归一:非整数 / 负数当场点名,不折成 0 也不折成上限。"""
        try:
            value = int(measured)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"分维 {dimension} 的实测值必须是整数(收到 {measured!r})") from exc
        if value < 0:
            raise ValueError(f"分维 {dimension} 的实测值不得为负(收到 {value})")
        return value

    def check_dim(self, dimension: str, measured: int, *, tool_name: str = "") -> GateResult:
        """通用分维阈值判定(非累加维的唯一出口)。

        - 上限 <= 0 ⇒ 该维关闭:allowed=True,reason=dim_disabled,不写任何计数
        - 实测 > 上限 ⇒ allowed=False,error_type=budget_exceeded,reason 具名点名
          (维度名 + 实测值 + 上限值),dimension 字段同步带出
        - 累加维(mcp_token_limit)不走本出口 ⇒ ValueError:同一维两条消耗通道
          必然漂移(§0.6 单一真相源),请走 consume_mcp_tokens
        """
        if dimension in ACCUMULATING_DIMENSIONS:
            raise ValueError(
                f"分维 {dimension} 是累加维:配额消耗一律走 consume_mcp_tokens,"
                "本出口只做阈值判定,不记账"
            )
        limit = self._dim_limit(dimension)
        value = self._dim_measured(dimension, measured)
        used = {dimension: value}
        limits = {dimension: limit}
        if limit <= 0:
            return self._result(
                True,
                used,
                limits,
                reason=REASON_DIM_DISABLED,
                tool_name=tool_name,
                dimension=dimension,
            )
        if value > limit:
            return self._result(
                False,
                used,
                limits,
                error_type=BUDGET_EXCEEDED,
                reason=dim_exceed_reason(dimension, value, limit),
                tool_name=tool_name,
                dimension=dimension,
            )
        return self._result(
            True, used, limits, reason=REASON_OK, tool_name=tool_name, dimension=dimension
        )

    def check_mcp_tool_count(self, registered_tools: int, *, tool_name: str = "") -> GateResult:
        """MCP 注册工具数上限(mcp_tool_limit):注册面实测条数超上限即具名拒绝。"""
        return self.check_dim(DIM_MCP_TOOL_LIMIT, registered_tools, tool_name=tool_name)

    def check_custom_prompt(self, prompt: str, *, tool_name: str = "") -> GateResult:
        """自定义提示 token 上限(custom_prompt_token_limit)。

        token 由 estimate_tokens 估算(量法见该函数),空提示 ⇒ 0 token ⇒ 放行。
        """
        return self.check_dim(
            DIM_CUSTOM_PROMPT_TOKEN_LIMIT, estimate_tokens(prompt), tool_name=tool_name
        )

    def check_history_query(self, requested_rows: int, *, tool_name: str = "") -> GateResult:
        """历史查询窗口上限(history_query_limit):请求条数超窗口即具名拒绝。"""
        return self.check_dim(DIM_HISTORY_QUERY_LIMIT, requested_rows, tool_name=tool_name)

    def consume_mcp_tokens(self, run_id: str, tokens: int, *, tool_name: str = "") -> GateResult:
        """MCP 令牌桶(mcp_token_limit):按 run 累加消耗,超额具名拒绝。

        - 该维关闭(上限 <= 0)⇒ 放行且**不写任何计数**(与 acquire 的关闭档同纪律)
        - 被拒的本次不入库,已用量不受污染
        """
        dimension = DIM_MCP_TOKEN_LIMIT
        limit = self._dim_limit(dimension)
        amount = self._dim_measured(dimension, tokens)
        if limit <= 0:
            return self._result(
                True,
                {dimension: amount},
                {dimension: 0},
                reason=REASON_DIM_DISABLED,
                tool_name=tool_name,
                dimension=dimension,
            )
        if not run_id:
            raise ValueError("run_id 不能为空")
        with self._lock:
            st = self._states.setdefault(run_id, _RunState())
            projected = st.mcp_tokens + amount
            if projected > limit:
                return self._result(
                    False,
                    {dimension: projected},
                    {dimension: limit},
                    error_type=BUDGET_EXCEEDED,
                    reason=dim_exceed_reason(dimension, projected, limit),
                    tool_name=tool_name,
                    dimension=dimension,
                )
            st.mcp_tokens = projected
            return self._result(
                True,
                {dimension: projected},
                {dimension: limit},
                reason=REASON_OK,
                tool_name=tool_name,
                dimension=dimension,
            )

    def refund_mcp_tokens(self, run_id: str, tokens: int) -> int:
        """回退某 run 已消耗的 MCP 令牌(核实多扣时用),返回回退后的已用量。"""
        amount = self._dim_measured(DIM_MCP_TOKEN_LIMIT, tokens)
        with self._lock:
            st = self._states.get(run_id)
            if st is None:
                return 0
            st.mcp_tokens = max(0, st.mcp_tokens - amount)
            return st.mcp_tokens

    def dim_state(self, run_id: str = "") -> dict[str, Any]:
        """四维配额投影:上限 / 已用 / 剩余 / 哪些维开着(供台账端点与上层呈现)。

        - 关闭维(上限 <= 0)的 remaining 恒 None = 「该维不设限」,不用 0 冒充「已用尽」
        - used 只有累加维有真值(mcp_token_limit);阈值维的实测值随调用点走,
          本器不替调用方记账,故报 0 并在 accumulating_dimensions 里点名口径
        """
        limits = self.dim_limits()
        used = dict.fromkeys(BUDGET_DIMENSIONS, 0)
        if run_id:
            with self._lock:
                st = self._states.get(run_id)
            if st is not None:
                used[DIM_MCP_TOKEN_LIMIT] = st.mcp_tokens
        remaining: dict[str, int | None] = {}
        for dimension, limit in limits.items():
            remaining[dimension] = None if limit <= 0 else max(0, limit - used[dimension])
        return {
            "run_id": run_id,
            "limits": limits,
            "used": used,
            "remaining": remaining,
            "open_dimensions": [d for d, limit in limits.items() if limit > 0],
            "accumulating_dimensions": list(ACCUMULATING_DIMENSIONS),
        }

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


# 模块级单例(可被既有 agent 上下文按需注入)。
# 分维配额在导入时按台账登记的四个大写 env 键装配(唯一读取点 = from_env):
# 未配置 ⇒ 四维全关 ⇒ 与旧的裸构造逐零差异;`enabled` 仍取默认 False ⇒ run 循环三维不受影响。
tool_budget_governor = ToolBudgetGovernor(ToolBudgetConfig.from_env())

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

第二层配额(2026-11-06 立,goal-b49 Z20;口径见对标靶「三层装箱预算 maxChunkChars /
maxCharsPerResult / **maxTotalChars** + maxRerankTokens」里我方缺的那一格):上面的分维
配额全部是**单桶(层一)**尺子 —— 每个 run / 每台 server 各有一份额,配了额仍不等于
"这一份消耗合起来有界"。本模块因此加**第二层 = 按 scope 的聚合总量层**:

- 两维 `tool_call_total_limit`(聚合层工具执行总量)/ `mcp_token_total_limit`
  (聚合层 MCP token 总量),与层一同样**各自独立**、同样 **0 / 未配 ⇒ 该维关闭**;
- 接在**既有生产消费点**上(`guarded_tool_pipeline` 调 `acquire`、`mcp_client` 调
  `consume_mcp_tokens`)⇒ 不需要调用方改一行就真在管;scope 分区入参留给宿主
  (未显式传入 ⇒ 归 `DEFAULT_AGGREGATE_SCOPE` = 单例治理器所承载的进程/部署合计面,
  本席如实说明而不是假装已有会话级分区宿主);
- 超限**具名拒绝**(维度名 + 聚合实测值 + 上限值),被拒的本次**层一层二都不写计数**
  (与层一"被拒不污染已用量"同一条纪律),绝不静默丢一次调用、也不把计数夹到上限;
- **比较式只有一枚**:模块级 `over_limit()`。层一三维、层一四维、层二两维的超限判定
  全部走它(§0.6 单一真相源;§0.3 判不出不猜)。成本轴为何不进层二:层一成本是
  "预扣 + `record_usage` 事后校准"的双通道量,聚合层再抄一份就要在事后校准里维护第二
  本可回退账本(时序歧义),该宿主在计费面(本席白名单外)⇒ 按 §0.9 不登记空维。

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

#: 台账顺序固定的四维名单(**层一**:单桶阈值/单桶累加,投影与遍历的唯一出口)
BUDGET_DIMENSIONS: tuple[str, ...] = (
    DIM_MCP_TOOL_LIMIT,
    DIM_MCP_TOKEN_LIMIT,
    DIM_CUSTOM_PROMPT_TOKEN_LIMIT,
    DIM_HISTORY_QUERY_LIMIT,
)

# 层二(聚合层)维度名 + env 常量:同一套纪律 —— 维度名 = 台账键 = reason 里的具名片段。
DIM_TOOL_CALL_TOTAL_LIMIT = "tool_call_total_limit"
DIM_MCP_TOKEN_TOTAL_LIMIT = "mcp_token_total_limit"

#: 层二维度名单(与层一互不相交;`dim_state` 的既有投影形状因此不受影响)
AGGREGATE_DIMENSIONS: tuple[str, ...] = (
    DIM_TOOL_CALL_TOTAL_LIMIT,
    DIM_MCP_TOKEN_TOTAL_LIMIT,
)

#: 全部维度(层一 + 层二)的唯一全集出口:校验、取值、env 装配都遍历它,不另列清单
ALL_DIMENSIONS: tuple[str, ...] = BUDGET_DIMENSIONS + AGGREGATE_DIMENSIONS

#: 维度到人说明(进 reason,便于拒绝时人能一眼读懂是哪一格)
DIM_LABELS: dict[str, str] = {
    DIM_MCP_TOOL_LIMIT: "MCP 注册工具数",
    DIM_MCP_TOKEN_LIMIT: "MCP 令牌桶",
    DIM_CUSTOM_PROMPT_TOKEN_LIMIT: "自定义提示 token",
    DIM_HISTORY_QUERY_LIMIT: "历史查询窗口",
    DIM_TOOL_CALL_TOTAL_LIMIT: "聚合层工具执行总量",
    DIM_MCP_TOKEN_TOTAL_LIMIT: "聚合层 MCP token 总量",
}

# env 常量:唯一读取点 = ToolBudgetConfig.from_env;大写键同时登记进
# app/core/capability_matrix.py 台账(守门 check-capability-matrix J1 以这些
# 带引号字面量为「代码里真实存在」的取证)。
TOOL_BUDGET_MCP_TOOL_LIMIT_ENV = "TOOL_BUDGET_MCP_TOOL_LIMIT"
TOOL_BUDGET_MCP_TOKEN_LIMIT_ENV = "TOOL_BUDGET_MCP_TOKEN_LIMIT"
TOOL_BUDGET_CUSTOM_PROMPT_TOKEN_LIMIT_ENV = "TOOL_BUDGET_CUSTOM_PROMPT_TOKEN_LIMIT"
TOOL_BUDGET_HISTORY_QUERY_LIMIT_ENV = "TOOL_BUDGET_HISTORY_QUERY_LIMIT"
TOOL_BUDGET_TOOL_CALL_TOTAL_LIMIT_ENV = "TOOL_BUDGET_TOOL_CALL_TOTAL_LIMIT"
TOOL_BUDGET_MCP_TOKEN_TOTAL_LIMIT_ENV = "TOOL_BUDGET_MCP_TOKEN_TOTAL_LIMIT"

#: 维度 → env 键(台账登记与 from_env 取值共用这一张表;六维同源)
DIM_ENV_KEYS: dict[str, str] = {
    DIM_MCP_TOOL_LIMIT: TOOL_BUDGET_MCP_TOOL_LIMIT_ENV,
    DIM_MCP_TOKEN_LIMIT: TOOL_BUDGET_MCP_TOKEN_LIMIT_ENV,
    DIM_CUSTOM_PROMPT_TOKEN_LIMIT: TOOL_BUDGET_CUSTOM_PROMPT_TOKEN_LIMIT_ENV,
    DIM_HISTORY_QUERY_LIMIT: TOOL_BUDGET_HISTORY_QUERY_LIMIT_ENV,
    DIM_TOOL_CALL_TOTAL_LIMIT: TOOL_BUDGET_TOOL_CALL_TOTAL_LIMIT_ENV,
    DIM_MCP_TOKEN_TOTAL_LIMIT: TOOL_BUDGET_MCP_TOKEN_TOTAL_LIMIT_ENV,
}

#: 只累加消耗的层一维度(其余层一维度按调用方实测值做阈值判定,不在本器记账)
ACCUMULATING_DIMENSIONS: tuple[str, ...] = (DIM_MCP_TOKEN_LIMIT,)

#: 维度 → ToolBudgetConfig 字段名(六维取值的唯一映射表,`dim_limit` 靠它,不写 if 链)
DIM_LIMIT_FIELDS: dict[str, str] = {
    DIM_MCP_TOOL_LIMIT: "mcp_tool_limit",
    DIM_MCP_TOKEN_LIMIT: "mcp_token_limit",
    DIM_CUSTOM_PROMPT_TOKEN_LIMIT: "custom_prompt_token_limit",
    DIM_HISTORY_QUERY_LIMIT: "history_query_limit",
    DIM_TOOL_CALL_TOTAL_LIMIT: "tool_call_total_limit",
    DIM_MCP_TOKEN_TOTAL_LIMIT: "mcp_token_total_limit",
}

#: 层二维度 → `_AggregateState` 计数字段名(判定与提交共用这一张表)
AGGREGATE_STATE_FIELDS: dict[str, str] = {
    DIM_TOOL_CALL_TOTAL_LIMIT: "tool_calls",
    DIM_MCP_TOKEN_TOTAL_LIMIT: "mcp_tokens",
}

#: 宿主未显式分区时的聚合 scope。层二的**判定**在生产调用路径上(见 acquire /
#: consume_mcp_tokens),分区入参是留给宿主的接口:未传 ⇒ 单例治理器所承载的
#: 进程/部署合计面(如实命名,不冒充会话级)。
DEFAULT_AGGREGATE_SCOPE = "process"

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


def over_limit(measured: int | float, limit: int | float) -> bool:
    """**唯一**的超限比较式(层一三维 / 层一四维 / 层二两维共用这一枚)。

    - `limit <= 0` ⇒ 该维关闭,一律 False(不参与比较、不写计数)
    - 其余情形 ⇒ 实测严格大于上限才算超(等于上限仍在额度内)

    新增判定路径**必须**调本函数,不得再手写 `实测 > 上限`(§0.6 单一真相源:
    同一判据两份实现必然漂移;§22c 同纪律)。
    """
    return limit > 0 and measured > limit


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
    # ---- 分维配额(层一;彼此独立;0 / 未配 ⇒ 该维不拦)----
    mcp_tool_limit: int = 0            # MCP 注册工具数上限
    mcp_token_limit: int = 0           # MCP 令牌桶上限(token)
    custom_prompt_token_limit: int = 0  # 自定义提示 token 上限
    history_query_limit: int = 0       # 历史查询窗口上限(条)
    # ---- 分维配额(层二 · 聚合总量;同样各自独立,0 ⇒ 该维关闭)----
    tool_call_total_limit: int = 0     # 聚合层工具执行总量上限(跨该 scope 的全部桶)
    mcp_token_total_limit: int = 0     # 聚合层 MCP token 总量上限(跨该 scope 的全部桶)

    def __post_init__(self) -> None:
        """分维上限必须非负:负数既不是「不拦」也不是有效上限 ⇒ 当场说清,不猜。"""
        for dimension in ALL_DIMENSIONS:
            value = self.dim_limit(dimension)
            if value < 0:
                raise ValueError(
                    f"分维 {dimension} 的上限不得为负(收到 {value}):"
                    "0 = 该维关闭,正数 = 上限,负数无定义"
                )

    def dim_limit(self, dimension: str) -> int:
        """维度名 → 该维上限(六维唯一的取值出口;`DIM_LIMIT_FIELDS` 是唯一映射表)。

        未知维度抛 KeyError,不返回 0 冒充「没配」。
        """
        try:
            field_name = DIM_LIMIT_FIELDS[dimension]
        except KeyError:
            raise KeyError(dimension) from None
        return int(getattr(self, field_name))

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> ToolBudgetConfig:
        """按台账登记的全部大写 env 键装配**分维配额**(层一四维 + 层二两维)。

        - `environ` 缺省读 `os.environ`;测试可注入映射(判据同一条,不写第二份)。
        - 未设置 / 空串 / 非法整数 / 非正数 ⇒ 0 ⇒ 该维关闭(非法值只 warning,不猜上限)。
        - 返回的 `enabled` 恒为默认 False:本类方法只装分维,绝不顺手打开 run 循环门。
        """
        source: Mapping[str, str] = os.environ if environ is None else environ
        limits: dict[str, int] = {}
        for dimension in ALL_DIMENSIONS:
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
            tool_call_total_limit=limits[DIM_TOOL_CALL_TOTAL_LIMIT],
            mcp_token_total_limit=limits[DIM_MCP_TOKEN_TOTAL_LIMIT],
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
    """单 run 的预算计数状态(**层一**:一个桶一份额度)。"""

    __slots__ = ("tool_count", "cost", "active", "mcp_tokens")

    def __init__(self) -> None:
        self.tool_count = 0
        self.cost = 0.0
        self.active = 0  # 当前并发中(acquire 未 release)的调用数
        self.mcp_tokens = 0  # MCP 令牌桶已消耗(mcp_token_limit 维)


class _AggregateState:
    """单 scope 的**层二**聚合计数:该 scope 下全部桶合计消耗到这里。

    与 `_RunState` 分表存放是刻意的:层一的桶被 `reset(run_id)` 清掉时,
    聚合总量**不该**跟着归零(否则"第二层"退化回第一层,正是本票要补的那格)。
    """

    __slots__ = ("tool_calls", "mcp_tokens")

    def __init__(self) -> None:
        self.tool_calls = 0
        self.mcp_tokens = 0


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

    第二层(聚合层,2026-11-06 立):同一个治理器实例所承载的**跨桶总量**天花板。
        gov = ToolBudgetGovernor(ToolBudgetConfig(tool_call_total_limit=500,
                                                  mcp_token_total_limit=200000))
        gov.acquire(run_id, tool_name="write_file")     # 生产路径:guarded_tool_pipeline
        gov.consume_mcp_tokens(bucket, tokens)          # 生产路径:mcp_client
        gov.aggregate_state()                           # 默认 scope 的聚合投影
        gov.aggregate_state("tenant-42")                # 宿主显式分区时的聚合投影
    层二超限同样是**具名拒绝**(维度名 + 聚合实测值 + 上限值),且被拒本次连层一计数
    都不写;层二全 0(默认)⇒ 判定与计数一次都不发生,与接线前逐零差异。
    """

    def __init__(self, config: ToolBudgetConfig | None = None) -> None:
        self.config = config or ToolBudgetConfig()
        self._states: dict[str, _RunState] = {}
        self._scopes: dict[str, _AggregateState] = {}  # 层二:scope → 聚合计数
        self._lock = threading.Lock()

    # ---------------- 内部 ----------------

    def _limits_active(self) -> bool:
        """是否有任何启用且非 0 的 run 循环维度上限。全关则恒放行(零行为差异)。"""
        c = self.config
        return bool(
            c.enabled
            and (c.max_tools_per_run > 0 or c.max_cost_per_run_usd > 0 or c.max_concurrency > 0)
        )

    def _aggregate_active(self) -> bool:
        """层二是否至少开了一维(全 0 ⇒ 判定与计数一律不发生,与接线前逐零差异)。"""
        return any(self.config.dim_limit(d) > 0 for d in AGGREGATE_DIMENSIONS)

    @staticmethod
    def _scope_of(scope_id: str) -> str:
        """聚合 scope 的唯一归一出口:未显式分区(或只给了空白)⇒ `DEFAULT_AGGREGATE_SCOPE`。

        空白不当成一个真分区:否则"配了额却没管住任何人"会伪装成"分区很多"。
        """
        stripped = scope_id.strip()
        return stripped or DEFAULT_AGGREGATE_SCOPE

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

    # ---------------- 层二(聚合层)内部:必须在持锁作用域内调用 ----------------

    def _aggregate_denial(
        self, scope: str, deltas: dict[str, int], *, limits: dict[str, Any], tool_name: str
    ) -> GateResult | None:
        """层二聚合天花板判定(**只判不写**;比较式 = 模块级 `over_limit`)。

        - 层二全关 ⇒ None(调用方按既有路径继续,零副作用)
        - 某一维「该 scope 已聚合 + 本次增量」越过上限 ⇒ 具名拒绝:reason 由
          `dim_exceed_reason` 出(维度名 + 聚合实测值 + 上限值),used 带出的就是
          **加上本次增量后的聚合量**(拒绝时如实说明"再放就超"),limits 同时带层一投影
        - 逐维遍历 `AGGREGATE_DIMENSIONS`,一维一份映射(`AGGREGATE_STATE_FIELDS`),
          不写第二份比较式
        """
        if not self._aggregate_active():
            return None
        st = self._scopes.get(scope)
        for dimension in AGGREGATE_DIMENSIONS:
            limit = self.config.dim_limit(dimension)
            if limit <= 0:
                continue
            field = AGGREGATE_STATE_FIELDS[dimension]
            base = getattr(st, field) if st is not None else 0
            projected = base + deltas.get(dimension, 0)
            if over_limit(projected, limit):
                return self._result(
                    False,
                    {dimension: projected},
                    {**limits, **{dimension: limit}},
                    error_type=BUDGET_EXCEEDED,
                    reason=dim_exceed_reason(dimension, projected, limit),
                    tool_name=tool_name,
                    dimension=dimension,
                )
        return None

    def _aggregate_commit(self, scope: str, deltas: dict[str, int]) -> None:
        """层二提交:仅在两层的拒绝都不命中后调用;只记**开着的维**。"""
        if not self._aggregate_active():
            return
        st = self._scopes.setdefault(scope, _AggregateState())
        for dimension, delta in deltas.items():
            if self.config.dim_limit(dimension) > 0 and delta:
                field = AGGREGATE_STATE_FIELDS[dimension]
                setattr(st, field, getattr(st, field) + int(delta))

    def _aggregate_used(self, scope: str) -> dict[str, int]:
        """层二各开维的聚合已用(读锁内状态;调用方须持锁)。关闭维不进投影。"""
        st = self._scopes.get(scope)
        out: dict[str, int] = {}
        for dimension in AGGREGATE_DIMENSIONS:
            if self.config.dim_limit(dimension) <= 0:
                continue
            field = AGGREGATE_STATE_FIELDS[dimension]
            out[dimension] = getattr(st, field) if st is not None else 0
        return out

    # ---------------- 门控 API(同步,内存无 I/O) ----------------

    def acquire(
        self,
        run_id: str,
        *,
        tool_name: str = "",
        cost_estimate: float = 0.0,
        scope_id: str = "",
    ) -> GateResult:
        """尝试取得一次工具执行配额。allowed=True 才应执行工具。

        - 预算未启用(默认)且层二全关 → 恒放行,不产生任何副作用(零回归)
        - **层二先判**:该 scope 的聚合总量加上本次(1 次工具执行)越过上限 → 具名拒绝,
          且**层一计数一分不写**(被拒不污染任何一层,与分维同一纪律)
        - 层一任一维度超限 → allowed=False,error_type="budget_exceeded",
          附 used/limits;本次不计入 tool_count/active(不污染后续)
        - 允许 → 自增层一 tool_count+active 并按 cost_estimate 预扣成本,同时提交层二
        - `scope_id` 为空 ⇒ 归 `DEFAULT_AGGREGATE_SCOPE`(生产宿主未分区时的合计面)
        """
        limits = self._limits()
        empty = {"tool_count": 0, "cost": 0.0, "active": 0}
        if not self._limits_active() and not self._aggregate_active():
            return self._result(True, empty, limits, reason=REASON_DISABLED, tool_name=tool_name)

        if not run_id and self._limits_active():
            raise ValueError("run_id 不能为空")
        scope = self._scope_of(scope_id)
        deltas = {DIM_TOOL_CALL_TOTAL_LIMIT: 1}
        with self._lock:
            denial = self._aggregate_denial(scope, deltas, limits=limits, tool_name=tool_name)
            if denial is not None:
                return denial

            used = dict(empty)
            if self._limits_active():
                st = self._states.get(run_id)
                if st is None:
                    st = self._states.setdefault(run_id, _RunState())

                c = self.config
                # 并发维度
                prospective_active = st.active + 1
                if over_limit(prospective_active, c.max_concurrency):
                    return self._result(
                        False, self._used(st), limits,
                        error_type=BUDGET_EXCEEDED,
                        reason=f"并发超限({prospective_active} > {c.max_concurrency})",
                        tool_name=tool_name,
                    )
                # 次数维度
                prospective_tools = st.tool_count + 1
                if over_limit(prospective_tools, c.max_tools_per_run):
                    return self._result(
                        False, self._used(st), limits,
                        error_type=BUDGET_EXCEEDED,
                        reason=f"执行次数超限({prospective_tools} > {c.max_tools_per_run})",
                        tool_name=tool_name,
                    )
                # 成本维度
                prospective_cost = st.cost + max(0.0, float(cost_estimate))
                if over_limit(prospective_cost, c.max_cost_per_run_usd):
                    return self._result(
                        False, self._used(st), limits,
                        error_type=BUDGET_EXCEEDED,
                        reason=f"成本超限(预计 {prospective_cost:.4f}$ > {c.max_cost_per_run_usd}$)",
                        tool_name=tool_name,
                    )
                # 提交(层一)
                st.tool_count = prospective_tools
                st.active = prospective_active
                st.cost = prospective_cost
                used = self._used(st)
            # 提交(层二):两层的拒绝都没命中才走到这里
            self._aggregate_commit(scope, deltas)
            if self._aggregate_active():
                used.update(self._aggregate_used(scope))
            return self._result(True, used, limits, reason=REASON_OK, tool_name=tool_name)

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
                f"未知分维 {dimension!r}:合法维度 = {', '.join(ALL_DIMENSIONS)}"
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
        """通用分维阈值判定(**层一**的非累加维唯一出口)。

        - 上限 <= 0 ⇒ 该维关闭:allowed=True,reason=dim_disabled,不写任何计数
        - 实测越过上限 ⇒ allowed=False,error_type=budget_exceeded,reason 具名点名
          (维度名 + 实测值 + 上限值),dimension 字段同步带出
        - 累加维(mcp_token_limit)不走本出口 ⇒ ValueError:同一维两条消耗通道
          必然漂移(§0.6 单一真相源),请走 consume_mcp_tokens
        - 层二维度(tool_call_total_limit / mcp_token_total_limit)也不走本出口 ⇒
          ValueError:聚合层的量是**提交时累计**出来的,阈值判定无从代劳
        """
        if dimension in AGGREGATE_DIMENSIONS:
            raise ValueError(
                f"分维 {dimension} 属第二层(聚合层):总量由 acquire / consume_mcp_tokens "
                "在提交时按 scope 累计,本出口只做层一阈值判定,不替聚合层记账"
            )
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
        if over_limit(value, limit):
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

    def consume_mcp_tokens(
        self, run_id: str, tokens: int, *, tool_name: str = "", scope_id: str = ""
    ) -> GateResult:
        """MCP 令牌桶:层一按桶(`mcp_token_limit`)累加,层二按 scope 聚合(`mcp_token_total_limit`)。

        - 该维关闭(上限 <= 0)⇒ 放行且**不写该维计数**(与 acquire 的关闭档同纪律);
          层二若开着,聚合总量照常累计并在 used 里如实带出
        - 层二先判:越线即具名拒绝,且**桶计数一分不写**(被拒的本次哪儿都不入库)
        - 层一被拒的本次同样不入库,已用量不受污染
        """
        dimension = DIM_MCP_TOKEN_LIMIT
        limit = self._dim_limit(dimension)
        amount = self._dim_measured(dimension, tokens)
        deltas = {DIM_MCP_TOKEN_TOTAL_LIMIT: amount}
        base_limits = {dimension: limit}
        if limit <= 0 and not self._aggregate_active():
            return self._result(
                True,
                {dimension: amount},
                base_limits,
                reason=REASON_DIM_DISABLED,
                tool_name=tool_name,
                dimension=dimension,
            )
        if not run_id and limit > 0:
            raise ValueError("run_id 不能为空")
        scope = self._scope_of(scope_id)
        with self._lock:
            denial = self._aggregate_denial(
                scope, deltas, limits=base_limits, tool_name=tool_name
            )
            if denial is not None:
                return denial
            used = {dimension: amount}
            out_limits = dict(base_limits)
            if limit > 0:
                st = self._states.setdefault(run_id, _RunState())
                projected = st.mcp_tokens + amount
                if over_limit(projected, limit):
                    return self._result(
                        False,
                        {dimension: projected},
                        out_limits,
                        error_type=BUDGET_EXCEEDED,
                        reason=dim_exceed_reason(dimension, projected, limit),
                        tool_name=tool_name,
                        dimension=dimension,
                    )
                st.mcp_tokens = projected
                used[dimension] = projected
            self._aggregate_commit(scope, deltas)
            if self._aggregate_active():
                used.update(self._aggregate_used(scope))
                out_limits.update(
                    {d: self.config.dim_limit(d) for d in AGGREGATE_DIMENSIONS}
                )
            return self._result(
                True,
                used,
                out_limits,
                reason=REASON_OK if limit > 0 else REASON_DIM_DISABLED,
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

    # ---------------- 层二(聚合层)公开 API ----------------

    def aggregate_limits(self) -> dict[str, int]:
        """层二上限投影(台账键 → 上限)。与 `dim_limits` 刻意分表:两层不是一条尺。"""
        return {dimension: self.config.dim_limit(dimension) for dimension in AGGREGATE_DIMENSIONS}

    def aggregate_state(self, scope_id: str = "") -> dict[str, Any]:
        """层二聚合投影:scope / 上限 / 已用 / 剩余 / 开着哪些维(供台账端点与上层呈现)。

        关闭维的 remaining 恒 None(= 不设限),不用 0 冒充「已用尽」——与 `dim_state` 同口径。
        """
        scope = self._scope_of(scope_id)
        limits = self.aggregate_limits()
        used = dict.fromkeys(AGGREGATE_DIMENSIONS, 0)
        with self._lock:
            st = self._scopes.get(scope)
        if st is not None:
            for dimension in AGGREGATE_DIMENSIONS:
                used[dimension] = int(getattr(st, AGGREGATE_STATE_FIELDS[dimension]))
        remaining: dict[str, int | None] = {}
        for dimension, limit in limits.items():
            remaining[dimension] = None if limit <= 0 else max(0, limit - used[dimension])
        return {
            "scope_id": scope,
            "layer": "aggregate",
            "limits": limits,
            "used": used,
            "remaining": remaining,
            "open_dimensions": [d for d, limit in limits.items() if limit > 0],
            "default_scope": DEFAULT_AGGREGATE_SCOPE,
        }

    def reset_aggregate(self, scope_id: str = "") -> bool:
        """清某 scope 的层二聚合计数(存在则删除并返回 True)。

        层一的 `reset(run_id)` **不**动这里:把桶清零不该顺带抹掉总量层,否则层二退化回层一。
        """
        scope = self._scope_of(scope_id)
        with self._lock:
            if scope in self._scopes:
                del self._scopes[scope]
                return True
            return False

    # ---------------- 可选接入点:异步守卫 ----------------

    def guard(
        self,
        run_id: str,
        *,
        cost_estimate: float = 0.0,
        tool_name: str = "",
        scope_id: str = "",
    ) -> ToolRunGuard:
        """返回异步上下文管理器作为工具执行的接入点(层一 + 层二同一判据)。

        __aenter__ 时 acquire:超额则抛出 ToolBudgetExceededError(调用方决定终止),
        否则进入;__aexit__ 自动 release 并发占位。预算关闭时恒放行,零回归。
        """
        return ToolRunGuard(
            self, run_id, cost_estimate=cost_estimate, tool_name=tool_name, scope_id=scope_id
        )


class ToolRunGuard:
    """工具执行预算守卫(async with 用法)。"""

    def __init__(
        self,
        governor: ToolBudgetGovernor,
        run_id: str,
        *,
        cost_estimate: float = 0.0,
        tool_name: str = "",
        scope_id: str = "",
    ) -> None:
        self._gov = governor
        self._run_id = run_id
        self._cost_estimate = cost_estimate
        self._tool_name = tool_name
        self._scope_id = scope_id
        self.result: GateResult | None = None
        self._entered = False

    async def __aenter__(self) -> ToolRunGuard:
        self.result = self._gov.acquire(
            self._run_id,
            tool_name=self._tool_name,
            cost_estimate=self._cost_estimate,
            scope_id=self._scope_id,
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

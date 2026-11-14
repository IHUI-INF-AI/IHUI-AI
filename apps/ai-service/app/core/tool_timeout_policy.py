# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具调用超时预算(per-tool timeout policy;对标 DSH dsh-tool-call-timeout-policy)。

病灶(2026-11-14 第五遍取证):`AgentLoopV2` 用**单一** 60s 包住所有工具调用,而工具
自己声明的预算普遍更长 —— `run_command` 接受 timeout/max_timeout(handler 硬上限
`RUN_COMMAND_TIMEOUT_S`,默认 120s)、`dispatch_subagent` 内部 300s、
`office_document` 转换最高 300s。结果:工具刚进入自己的正常执行区间就被外层 60s
掐断,模型收到"工具执行超时(60.0s)"并可能立刻重试,长构建 / 子代理 / 文档转换
永远跑不完 —— schema 对模型承诺的预算与运行时实际预算互相矛盾。

治理原则(与 DSH 同构,只抄判据不抄插件):
  - **工具拥有预算**:`run_command` 取调用参数 `timeout`,并被 `max_timeout` 与
    `RUN_COMMAND_TIMEOUT_S` 双重夹紧 —— 与 handler `_tool_run_command` 同一判据
    (两边都调本模块,不各写一套);
  - **声明式兜底**:`dispatch_subagent` / `office_document` 用显式常量登记其
    handler 内部同名超时;未登记的工具一律用默认档,不可能被模型用参数放大;
  - **外层永远晚于内层**:MCP 守卫 = 预算 + 2s,循环等待 = 预算 + 5s,保证 handler
    自己的超时先返回(带 partial_output / TIMEOUT 结果),而不是被外层取消导致
    一次"没有任何产出"的硬中断;
  - **有界 + 失败闭合**:一切预算最终夹到 `HARD_CEILING_S`;非法参数(负数 / 非数字 /
    bool / inf)一律回落默认档,绝不因为模型填了一个大数就把单次调用拖成无界。
"""

from __future__ import annotations

import math
import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Final

# --- 默认档与上限(唯一声明处,消费方 import,不得另抄字面量)----------------
DEFAULT_TOOL_TIMEOUT_S: Final = 60.0
HARD_CEILING_S: Final = 900.0
MCP_GUARD_GRACE_S: Final = 2.0
LOOP_GUARD_GRACE_S: Final = 5.0

# run_command:与 handler 同一判据(默认 timeout 60 / max_timeout 600 / 硬上限 120)
RUN_COMMAND_TOOL_NAME: Final = "run_command"
RUN_COMMAND_TIMEOUT_ENV: Final = "RUN_COMMAND_TIMEOUT_S"
RUN_COMMAND_DEFAULT_TIMEOUT_S: Final = 60
RUN_COMMAND_DEFAULT_MAX_TIMEOUT_S: Final = 600
RUN_COMMAND_HARD_DEFAULT_S: Final = 120

# dispatch_subagent:编排器内部单子代理超时
SUBAGENT_TOOL_NAME: Final = "dispatch_subagent"
SUBAGENT_TIMEOUT_ENV: Final = "SUBAGENT_TIMEOUT_S"
SUBAGENT_DEFAULT_TIMEOUT_S: Final = 300

# office_document:convert/render 的 soffice 超时最高 300s,另留 30s 收尾
OFFICE_TOOL_NAME: Final = "office_document"
OFFICE_DOCUMENT_BUDGET_S: Final = 330.0


def _env_seconds(name: str, fallback: int) -> int:
    """读正整数秒的环境变量;缺失 / 非法 / 非正数 → 回落 ``fallback``。"""
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return fallback
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        return fallback
    return value if value > 0 else fallback


def run_command_hard_timeout_s() -> int:
    """`run_command` 执行硬上限秒(env ``RUN_COMMAND_TIMEOUT_S``,默认 120)。"""
    return _env_seconds(RUN_COMMAND_TIMEOUT_ENV, RUN_COMMAND_HARD_DEFAULT_S)


def subagent_timeout_s() -> int:
    """单子代理超时秒(env ``SUBAGENT_TIMEOUT_S``,默认 300)。"""
    return _env_seconds(SUBAGENT_TIMEOUT_ENV, SUBAGENT_DEFAULT_TIMEOUT_S)


def _as_int(value: Any, fallback: int) -> int:
    """把模型给的超时参数归一成 int;bool / 非数字 / None 一律回落。"""
    if value is None or isinstance(value, bool):
        return fallback
    try:
        return int(value)
    except (TypeError, ValueError, OverflowError):
        return fallback


def run_command_budget_s(args: Mapping[str, Any] | None) -> float:
    """与 ``_tool_run_command`` 完全同形的 timeout 解析结果(秒)。

    逐行对齐 handler 的 ``max(1, ...)`` / ``min(timeout, max_timeout)`` /
    ``min(timeout, RUN_COMMAND_TIMEOUT_S)`` 三步,不另立第二套夹紧。
    """
    data: Mapping[str, Any] = args if isinstance(args, Mapping) else {}
    max_timeout = _as_int(
        data.get("max_timeout", RUN_COMMAND_DEFAULT_MAX_TIMEOUT_S),
        RUN_COMMAND_DEFAULT_MAX_TIMEOUT_S,
    )
    if max_timeout < 1:
        max_timeout = 1
    timeout = _as_int(
        data.get("timeout", RUN_COMMAND_DEFAULT_TIMEOUT_S),
        RUN_COMMAND_DEFAULT_TIMEOUT_S,
    )
    if timeout < 1:
        timeout = 1
    timeout = min(timeout, max_timeout)
    return float(min(timeout, run_command_hard_timeout_s()))


@dataclass(frozen=True)
class ToolTimeoutBudget:
    """一次工具调用的时间预算(纯数据,无副作用)。

    - ``tool_budget_s``:工具自身被允许运行的时间(报错文案与观测口径);
    - ``loop_timeout_s``:``AgentLoopV2`` 外层 ``wait_for`` 的等待上限
      (登记工具 = 预算 + 5s;默认档 = 默认值原样,不额外放宽);
    - ``mcp_guard_s``:``mcp_server.call_tool`` 的守卫上限(预算 + 2s);
      默认档由调用方与 ``MCP_GLOBAL_TIMEOUT`` 取较大值,保持历史行为;
    - ``source``:``args`` / ``declared`` / ``default`` —— 预算从哪来。
    """

    tool_budget_s: float
    loop_timeout_s: float
    mcp_guard_s: float
    source: str


def resolve_tool_timeout_budget(
    tool_name: str | None,
    args: Mapping[str, Any] | None = None,
    *,
    default_s: float = DEFAULT_TOOL_TIMEOUT_S,
) -> ToolTimeoutBudget:
    """解析一次工具调用的预算;纯函数、不抛异常、绝不返回无界值。"""
    try:
        if isinstance(default_s, bool):
            raise TypeError("bool 不是合法的超时值")
        base = float(default_s)
    except (TypeError, ValueError, OverflowError):
        base = DEFAULT_TOOL_TIMEOUT_S
    if not math.isfinite(base) or base <= 0:
        base = DEFAULT_TOOL_TIMEOUT_S
    base = min(base, HARD_CEILING_S)

    name = str(tool_name or "")
    if name == RUN_COMMAND_TOOL_NAME:
        budget = run_command_budget_s(args)
        source = "args"
    elif name == SUBAGENT_TOOL_NAME:
        budget = float(subagent_timeout_s())
        source = "declared"
    elif name == OFFICE_TOOL_NAME:
        budget = OFFICE_DOCUMENT_BUDGET_S
        source = "declared"
    else:
        budget = base
        source = "default"

    if source == "default":
        # 默认档原样透传调用方给的 tool_timeout(历史行为;测试与部署都可能用
        # 亚秒值,绝不在这里抬到 1s 下限)。
        loop_timeout = budget
        guard = budget + MCP_GUARD_GRACE_S
    else:
        budget = max(1.0, min(budget, HARD_CEILING_S))
        loop_timeout = min(budget + LOOP_GUARD_GRACE_S, HARD_CEILING_S + LOOP_GUARD_GRACE_S)
        guard = min(budget + MCP_GUARD_GRACE_S, HARD_CEILING_S + MCP_GUARD_GRACE_S)
    return ToolTimeoutBudget(
        tool_budget_s=budget,
        loop_timeout_s=loop_timeout,
        mcp_guard_s=guard,
        source=source,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

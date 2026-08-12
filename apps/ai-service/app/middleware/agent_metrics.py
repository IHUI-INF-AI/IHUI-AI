"""Agent 循环自定义 Prometheus 指标(2026-08-12 立,补齐 agent 可观测性)。

agent_loop_v2(AgentLoopV2)执行层专用指标:
- 执行次数(按 stop_reason 标签)
- LLM 重试次数(按 error_type 标签)
- 工具重试次数
- 错误计数(按 error_type 标签)

与 llm_metrics.py 同模式:全局 prometheus_client 注册表自动暴露在
/metrics 端点(main.py Instrumentator 挂载),无需额外注册。
"""

import logging

from prometheus_client import Counter

logger = logging.getLogger(__name__)

# Agent 循环执行次数(按 stop_reason: completed/error/max_iterations/paused/cancelled)
agent_loop_runs_total = Counter(
    "ihui_agent_loop_runs_total",
    "Total AgentLoopV2 executions",
    ["status"],
)

# LLM 调用重试次数(按 error_type: timeout/connection/http_5xx/...)
agent_loop_llm_retries_total = Counter(
    "ihui_agent_loop_llm_retries_total",
    "Total LLM call retries in AgentLoopV2",
    ["error_type"],
)

# 工具瞬时失败自动重试次数
agent_loop_tool_retries_total = Counter(
    "ihui_agent_loop_tool_retries_total",
    "Total tool retries in AgentLoopV2",
)

# Agent 循环错误计数(按 error_type 六分类)
agent_loop_errors_total = Counter(
    "ihui_agent_loop_errors_total",
    "Total AgentLoopV2 errors",
    ["error_type"],
)

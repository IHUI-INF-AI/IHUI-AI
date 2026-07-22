"""LLM 自定义 Prometheus 指标(2026-07-22 立,补齐 LLM 网关可观测性短板)。

项目已有 prometheus-fastapi-instrumentator 暴露 HTTP 层通用指标,
但缺 LLM 专用指标(token 计数 / 延迟 / provider 错误 / 活跃会话)。
本模块定义 LLM 专用指标,供 llm_gateway.py 埋点调用。

指标通过全局 prometheus_client 注册表自动暴露在 /metrics 端点
(由 main.py 的 Instrumentator.expose 挂载,无需额外注册)。
"""

import logging

from prometheus_client import Counter, Gauge, Histogram

logger = logging.getLogger(__name__)

# LLM token 计数(按 provider/model/direction 标签)
llm_tokens_total = Counter(
    'ihui_llm_tokens_total',
    'Total LLM tokens processed',
    ['provider', 'model', 'direction'],  # direction: 'input' | 'output'
)

# LLM 请求延迟(按 provider/model 标签)
llm_request_duration_seconds = Histogram(
    'ihui_llm_request_duration_seconds',
    'LLM request duration in seconds',
    ['provider', 'model'],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
)

# LLM provider 错误计数
llm_provider_errors_total = Counter(
    'ihui_llm_provider_errors_total',
    'Total LLM provider errors',
    ['provider', 'status'],  # status: '4xx' | '5xx' | 'timeout' | 'connection'
)

# 活跃 LLM 会话数
llm_active_sessions = Gauge(
    'ihui_llm_active_sessions',
    'Number of active LLM sessions',
)


def record_llm_call(
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    duration_seconds: float,
    error: str | None = None,
) -> None:
    """记录一次 LLM 调用的指标(供 llm_gateway.py 调用)。

    指标记录失败不抛异常(不阻塞 LLM 业务流程)。

    Args:
        provider: provider 标识(如 openai/anthropic/qwen)。
        model: 模型名称。
        input_tokens: 输入 token 数(prompt_tokens)。
        output_tokens: 输出 token 数(completion_tokens)。
        duration_seconds: 调用耗时(秒)。
        error: 错误类型(None=成功,'4xx'/'5xx'/'timeout'/'connection'=失败)。
    """
    try:
        llm_request_duration_seconds.labels(provider=provider, model=model).observe(
            duration_seconds
        )
        if error is None:
            # 成功:记录 token 计数
            llm_tokens_total.labels(
                provider=provider, model=model, direction='input'
            ).inc(input_tokens)
            llm_tokens_total.labels(
                provider=provider, model=model, direction='output'
            ).inc(output_tokens)
        else:
            # 失败:记录错误计数
            llm_provider_errors_total.labels(provider=provider, status=error).inc()
    except Exception as e:
        logger.warning("LLM 指标记录失败(忽略,不阻塞业务): %s", e)

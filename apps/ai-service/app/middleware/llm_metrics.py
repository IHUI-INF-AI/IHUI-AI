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


# =============================================================================
# 流式 fallback 指标(P3-1 + P3-2: fallback 触发率后端监控上报,2026-07-25 立)
#
# 上一轮 goal 已在 llm_gateway.complete/astream 的 fallback 触发点埋点,
# 此处补齐 Prometheus 指标定义,通过全局注册表自动暴露在 /metrics 端点
# (由 main.py 的 Instrumentator.expose 挂载,无需额外注册)。
#
# 触发场景:
# - complete(): 主模型异常 LLM_ERROR 且未跳过 fallback → 调 fallback_router
# - astream():  流式异常 + 未发送任何 chunk → 调 fallback_router
#
# 标签语义:
# - primary_model: 主模型名(失败的那个)
# - backup_model:  实际成功/失败的备用模型名(全部失败用 "all_failed")
# - reason:        fallback 触发原因(timeout / rate_limit / api_error / unknown)
# =============================================================================

LLM_FALLBACK_TRIGGERED = Counter(
    'llm_fallback_triggered_total',
    'LLM 流式 fallback 触发总次数(主模型失败,切换到备用模型)',
    ['primary_model', 'backup_model', 'reason'],
)

LLM_FALLBACK_SUCCESS = Counter(
    'llm_fallback_success_total',
    'LLM fallback 切换后成功完成生成的次数',
    ['primary_model', 'backup_model'],
)

LLM_FALLBACK_FAILURE = Counter(
    'llm_fallback_failure_total',
    'LLM fallback 切换后仍然失败的次数(备用模型也失败)',
    ['primary_model', 'backup_model'],
)


def classify_fallback_reason(exc: BaseException | None) -> str:
    """从异常类型/消息推导 fallback 触发原因标签。

    Args:
        exc: 主模型抛出的异常(None 时返回 'unknown')。

    Returns:
        'timeout' / 'rate_limit' / 'api_error' / 'unknown'
    """
    if exc is None:
        return 'unknown'
    combined = f"{type(exc).__name__} {exc}".lower()
    if 'timeout' in combined or 'timed out' in combined:
        return 'timeout'
    if 'ratelimit' in combined or 'rate_limit' in combined or 'rate limit' in combined or '429' in combined:
        return 'rate_limit'
    if 'apierror' in combined or 'api_error' in combined or 'apiconnection' in combined or 'api error' in combined:
        return 'api_error'
    if 'connection' in combined:
        return 'api_error'
    return 'unknown'


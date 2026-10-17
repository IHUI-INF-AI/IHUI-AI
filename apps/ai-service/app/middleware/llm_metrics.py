# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

# LLM 调用次数(按 provider/model/status)—— 2026-10-17 立。
# status 是**每次尝试**的结果(号池换 key / fallback 换模型会各计一次),
# 故成功率 = ok / (ok + error + timeout + interrupted),不要当成"会话成功率"。
llm_calls_total = Counter(
    'ihui_llm_calls_total',
    'LLM call attempts by provider, model and outcome',
    ['provider', 'model', 'status'],  # ok | error | timeout | connection | interrupted
)

# 首 token 耗时(TTFT,流式专用)—— 仅在有内容 token 产出时记录
llm_ttft_seconds = Histogram(
    'ihui_llm_ttft_seconds',
    'Time to first token in seconds (streaming)',
    ['provider', 'model'],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 20.0, 40.0, 80.0),
)

# 流式中断(客户端断开 / 上游断流 / 异常终止)
llm_stream_interrupt_total = Counter(
    'ihui_llm_stream_interrupt_total',
    'Streaming responses that terminated before the upstream finished',
    ['provider', 'model', 'reason'],  # client_disconnect | upstream_error | timeout_guard | unknown
)

# LLM 花费(USD)—— 取不到成本的调用不计数(宁缺毋假)。
# 成本来源两档(2026-10-17 补第二档):provider 自报价(litellm 价表)优先,
# 取不到时退回 core.model_pricing 的价目单一来源(与 ai-cost 扣费、cost_ledger
# 同一口径);零价运行时(ollama/lmstudio/stub)估出 0 仍然不计数。
llm_cost_usd_total = Counter(
    'ihui_llm_cost_usd_total',
    'Total LLM spend in USD (provider-reported price, else the project price table)',
    ['provider', 'model'],
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


def record_llm_outcome(
    provider: str,
    model: str,
    *,
    status: str,
    usage: dict[str, object] | None = None,
    duration_seconds: float | None = None,
    ttft_seconds: float | None = None,
    cost_usd: float | None = None,
    error_status: str | None = None,
    interrupt_reason: str | None = None,
) -> None:
    """一次 LLM 调用尝试的**统一收口埋点**(2026-10-17 立,供 llm_gateway 调用)。

    与 record_llm_call 的分工:record_llm_call 只记 token/延迟/错误三件事且没有
    "调用次数"这一维(大屏因此无从算成功率);本函数是接线后的唯一入口,
    gateway 的成功、失败、流式三条路径都只调它一次。

    任何一步抛异常都只 warn 不上抛 —— 观测层坏了不能把对话业务带崩。
    """
    try:
        llm_calls_total.labels(
            provider=provider, model=model, status=status
        ).inc()

        if status == 'ok' and usage:
            input_tokens = _as_non_negative_int(usage.get('prompt_tokens'))
            output_tokens = _as_non_negative_int(usage.get('completion_tokens'))
            if input_tokens:
                llm_tokens_total.labels(
                    provider=provider, model=model, direction='input'
                ).inc(input_tokens)
            if output_tokens:
                llm_tokens_total.labels(
                    provider=provider, model=model, direction='output'
                ).inc(output_tokens)
            # 缓存读写 token 是计费大项(Anthropic cache_read 可达输入的 80%),
            # 单独成 direction 值,大屏据此算"缓存命中率"而不是把它混进 input。
            cache_read = _as_non_negative_int(usage.get('cached_tokens'))
            if cache_read:
                llm_tokens_total.labels(
                    provider=provider, model=model, direction='cache_read'
                ).inc(cache_read)
            cache_write = _as_non_negative_int(usage.get('cache_creation_tokens'))
            if cache_write:
                llm_tokens_total.labels(
                    provider=provider, model=model, direction='cache_creation'
                ).inc(cache_write)

        if status == 'ok' and duration_seconds is not None and duration_seconds >= 0:
            llm_request_duration_seconds.labels(provider=provider, model=model).observe(
                duration_seconds
            )
        if ttft_seconds is not None and ttft_seconds >= 0:
            llm_ttft_seconds.labels(provider=provider, model=model).observe(ttft_seconds)
        if cost_usd is not None and cost_usd > 0:
            llm_cost_usd_total.labels(provider=provider, model=model).inc(cost_usd)
        if error_status:
            llm_provider_errors_total.labels(provider=provider, status=error_status).inc()
        if interrupt_reason:
            llm_stream_interrupt_total.labels(
                provider=provider, model=model, reason=interrupt_reason
            ).inc()
    except Exception as e:
        logger.warning("LLM 结果指标记录失败(忽略,不阻塞业务): %s", e)


def _as_non_negative_int(raw: object) -> int:
    """usage 字段可能是 None / str / int(各厂商返回不齐),取不到就当 0。"""
    if isinstance(raw, int) and not isinstance(raw, bool):
        return raw if raw > 0 else 0
    if isinstance(raw, str):
        try:
            value = int(raw)
        except ValueError:
            return 0
        return value if value > 0 else 0
    return 0


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
# - reason:        fallback 触发原因(timeout / rate_limit / api_error / quota / unknown)
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


# =============================================================================
# 上游"账号额度耗尽"判据(2026-09-22 批次 59 立)
#
# 场景:DashScope(阿里云百炼)账号欠费时鉴权仍正常(/models 返 200),但聊天调用返
# 400 {"code":"Arrearage"}。这类失败换 key 无用(整家账号没钱),只有换厂商才能接通,
# 因此与 timeout / rate_limit 区分成独立一类。
#
# 判据必须是"HTTP 状态码 + 额度错误码/文案"双条件:单看 400 会把参数错、上下文超长
# 误判成额度问题(进而把本来正常的请求改道);单看文案则任何 5xx 里的中文提示都能
# 触发降级。400 Arrearage 与参数错 400 的区分完全靠这份错误码清单。
# =============================================================================

# 只有这三个状态码可能承载额度语义(其余状态码一律不算,含 401/403/404/5xx)
_QUOTA_STATUS_CODES: frozenset[int] = frozenset({400, 402, 429})

# 厂商返回的额度类错误码/文案(只收录明确指向"这家账号没钱"的字符串,不含泛化词)
_QUOTA_MARKERS: tuple[str, ...] = (
    "arrearage",             # DashScope: {"code":"Arrearage"}
    "insufficientbalance",   # 通用"余额不足"错误码(下划线形态一并覆盖)
    "insufficient_quota",    # OpenAI: 账单额度耗尽
    "quota exceeded",        # Google: 月度配额耗尽
    "insufficient balance",  # 通用文案
    "余额不足",
    "欠费",
    "额度耗尽",
    # 2026-09-21 直连 DashScope 抓到的真实英文文案:{"error":{"type":"Arrearage","code":"Arrearage",
    # "message":"Access denied, please make sure your account is in good standing…#overdue-payment"}}。
    # 收录 message 片段是为了经代理转发后只剩文案、丢掉 code 字段的场景仍能判出来。
    "in good standing",
    "overdue-payment",
)


def _error_text(exc: BaseException | str) -> str:
    """异常/字符串统一成小写待匹配文本(含类型名,兼容无类型定义的包装异常)。"""
    if isinstance(exc, str):
        return exc.lower()
    return f"{type(exc).__name__} {exc}".lower()


def _upstream_status_code(exc: BaseException | str) -> int | None:
    """取上游 HTTP 状态码(LiteLLM 异常带 status_code;纯字符串没有状态码)。"""
    raw: object = getattr(exc, "status_code", None)
    if raw is None:
        raw = getattr(exc, "status", None)
    return raw if isinstance(raw, int) else None


def llm_error_status(exc: BaseException | str) -> str:
    """把一次失败归成 ihui_llm_provider_errors_total{status} 的四个取值之一。

    '4xx' | '5xx' | 'timeout' | 'connection'。有状态码就按码段;没有则退到文案
    (LiteLLM 的超时/连接异常不一定带 status_code,这类若只按码判会全部漏成 5xx)。
    """
    status = _upstream_status_code(exc) if isinstance(exc, BaseException) else None
    if status is None and isinstance(exc, str):
        status = _upstream_status_code(exc)
    if status is not None:
        if 400 <= status < 500:
            return '4xx'
        if 500 <= status < 600:
            return '5xx'
        return '4xx' if status < 500 else '5xx'
    text = _error_text(exc)
    if 'timeout' in text or 'timed out' in text:
        return 'timeout'
    if 'connect' in text or 'connection' in text or 'dns' in text:
        return 'connection'
    return '5xx'


def first_quota_marker(exc: BaseException | str | None) -> str:
    """返回命中的额度错误码/文案(未命中返回空串)。"""
    if exc is None:
        return ""
    text = _error_text(exc)
    for marker in _QUOTA_MARKERS:
        if marker in text:
            return marker
    return ""


def is_quota_exhaustion_error(
    exc: BaseException | str | None,
    *,
    status_code: int | None = None,
) -> bool:
    """判定"上游因账号额度/欠费/余额不足而失败"(值得换厂商,而非换 key 或改参数)。

    Args:
        exc: 异常对象或已序列化的错误文本(astream 的 error 事件只剩字符串)。
        status_code: 调用方已知的状态码(HTTP 响应 ping 场景),优先于从异常上取。

    Returns:
        True = 额度类错误。402 语义无歧义直接算;400/429 必须同时命中额度错误码;
        无状态码时只信错误码。
    """
    if exc is None:
        return False
    status = status_code if status_code is not None else _upstream_status_code(exc)
    if status == 402:
        return True
    if status is not None and status not in _QUOTA_STATUS_CODES:
        return False
    return bool(first_quota_marker(exc))


def describe_quota_error(exc: BaseException | str | None) -> str:
    """额度类错误的简短归因(错误码优先,退回状态码),用于错误透传不夹带原始响应体。"""
    marker = first_quota_marker(exc)
    if marker:
        return marker
    status = _upstream_status_code(exc) if isinstance(exc, BaseException) else None
    return f"http_{status}" if status is not None else "quota"


def classify_fallback_reason(exc: BaseException | None) -> str:
    """从异常类型/消息推导 fallback 触发原因标签。

    Args:
        exc: 主模型抛出的异常(None 时返回 'unknown')。

    Returns:
        'timeout' / 'rate_limit' / 'api_error' / 'quota' / 'unknown'
    """
    if exc is None:
        return 'unknown'
    # 额度判定先于 429→rate_limit:429 + insufficient_quota 是没钱,不是限流
    if is_quota_exhaustion_error(exc):
        return 'quota'
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


# =============================================================================
# Fusion 策略指标(2026-07-30 立,combo_router._route_fusion 增强配套)
#
# 触发场景(combo_router._route_fusion):
# - PROPOSERS_CALLED:每次 fusion 发起并发调用后,记录 proposer 数量
# - JUDGE_CALLED:judge 成功产出可用结果(merge 融合完成 / vote JSON 解析成功)
# - SUCCESS:fusion 最终向调用方返回有效内容(含降级到首条 proposal 的场景)
# - FAILURE:降级路径触发(全 proposer 失败 / judge 调用异常 / judge 非法 JSON)
#
# 标签语义:
# - combo_name:     combo 链名
# - proposer_count: 字符串化的 proposer 数量(Counter 标签必须是 str)
# - judge_model:    judge 用的 model 名
# - judge_mode:     "merge" / "vote"
# - reason:         FAILURE 原因:
#                   "all_proposers_failed" / "judge_call_failed" / "judge_invalid_json"
# =============================================================================

LLM_FUSION_PROPOSERS_CALLED = Counter(
    'llm_fusion_proposers_called_total',
    'Fusion 策略并发调用 proposer 的累计次数(每次 fusion 触发记一次,值=proposer 数量)',
    ['combo_name', 'proposer_count'],
)

LLM_FUSION_JUDGE_CALLED = Counter(
    'llm_fusion_judge_called_total',
    'Fusion 策略 judge model 成功产出可用结果的次数(merge 融合完成 / vote JSON 解析成功)',
    ['combo_name', 'judge_model', 'judge_mode'],
)

LLM_FUSION_SUCCESS = Counter(
    'llm_fusion_success_total',
    'Fusion 策略最终向调用方返回有效内容的次数(含降级到首条 proposal 的场景)',
    ['combo_name'],
)

LLM_FUSION_FAILURE = Counter(
    'llm_fusion_failure_total',
    'Fusion 策略降级路径触发次数(judge 失败 / 全 proposer 失败 / judge 非法 JSON)',
    ['combo_name', 'reason'],
)


# =============================================================================
# Token 压缩指标(2026-07-30 立,token_compaction.py 集成到 llm_gateway 调用链)
#
# 触发场景(llm_gateway.LLMGateway._apply_token_compaction):
# - TRIGGERED:每次满足启用条件(enabled + token > 阈值 + 非 stub + 无 tools)调用 compactor
# - SUCCESS:compactor.compact_messages 成功返回 CompactionResult
# - FAILURE:compactor 抛异常(降级用原 messages,不阻塞主流程)
# - RATIO:Histogram 观测压缩率(0-1,值越大压缩越好)
#
# 标签语义:
# - strategy: 压缩策略(rtk / caveman / rtk_caveman)
# - model:    模型名(用于 TRIGGERED / SUCCESS / FAILURE)
# - reason:   FAILURE 原因(异常类型名)
# =============================================================================

LLM_TOKEN_COMPACTION_TRIGGERED = Counter(
    'llm_token_compaction_triggered',
    'Number of token compaction triggers in llm_gateway',
    ['strategy', 'model'],
)

LLM_TOKEN_COMPACTION_SUCCESS = Counter(
    'llm_token_compaction_success',
    'Number of successful token compactions',
    ['strategy', 'model'],
)

LLM_TOKEN_COMPACTION_FAILURE = Counter(
    'llm_token_compaction_failure',
    'Number of failed token compactions',
    ['strategy', 'model', 'reason'],
)

LLM_TOKEN_COMPACTION_RATIO = Histogram(
    'llm_token_compaction_ratio',
    'Token compaction compression ratio (0-1)',
    ['strategy'],
    buckets=(0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99),
)

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

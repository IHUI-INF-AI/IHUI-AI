# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""错误分类——结构化状态码优先（2026-11-16 立，逆向对照 Codex error taxonomy）。

差距来源
--------
Codex 把 ``rate_limit(429)`` 归入 ``Retryable`` 且携带 ``retry_after`` 头；
``server_overloaded / internal_server_error(≥500)`` 同归 ``Retryable``。

本仓 ``agent_loop_v2._classify_error`` 只用**文本启发式**（``"4" in text[:12]``），
对 ``ProviderError`` 自带的结构化 ``status_code`` 字段视而不见：

- ``ProviderError("限频", 429)`` → 文本无 http/status 关键字 → ``unknown`` → ``undetermined``；
- ``ProviderError("http 429 …", 429)`` → 命中 ``"4"`` → ``http_4xx`` → **terminal**（终局不重试）。

而 provider 层（``llm_gateway.py:2993``）明确 ``_http_status == 429`` 列为可重试——
两层判定脱节，工具层漏重试 429。

修复思路
--------
把「从结构化 status_code → 错误族」抽成纯函数，供 ``_classify_error`` 优先调用；
文本启发式降级为无结构化信息时的兜底。在飞文件不硬接（用户前轮已定档），
接线点由调用方在非在飞窗口替换即可。

状态码 → 错误族映射（对齐 Codex retryable 语义）：
- ``429`` → ``rate_limit``（Retryable，重试安全，服务端已限频要求等待）
- ``>= 500`` → ``http_5xx``（Retryable）
- ``>= 400 and < 500``（除 429）→ ``http_4xx``（Terminal，业务错误重试无意义）
- ``None`` / 无法识别 → ``None``（回退文本启发式）
"""
from __future__ import annotations


def classify_from_status_code(status_code: int | None) -> str | None:
    """结构化 HTTP 状态码 → 错误族。None = 无结构化信息，回退文本启发式。

    映射规则（对齐 Codex ``Retryable`` 语义）：
    - 429 → ``rate_limit``（**新增族**，可重试；须由消费方词汇表同步登记）
    - ≥500 → ``http_5xx``（可重试）
    - ≥400 且 <500（除 429）→ ``http_4xx``（终局）
    - <400 或 None → None（回退）
    """
    if status_code is None:
        return None
    code = int(status_code)
    if code == 429:
        return "rate_limit"
    if code >= 500:
        return "http_5xx"
    if 400 <= code < 500:
        return "http_4xx"
    return None


def classify_error_structured_first(e: BaseException) -> str:
    """结构化优先错误分类：ProviderError.status_code 优先，文本启发式兜底。

    这是 ``_classify_error`` 的**目标态**——把现有文本启发式抽成兜底分支，
    在它之前插入 ProviderError 结构化认领。返回值语义与现有 ``_classify_error``
    完全一致（timeout / connection / http_5xx / http_4xx / rate_limit / cancelled /
    unknown / 宿主盖章 code），调用方零改动可替换。
    """
    # 1) 结构化优先：ProviderError（或语义兼容的 status_code 携带者）
    status_code = getattr(e, "status_code", None)
    if status_code is not None:
        from_status = classify_from_status_code(status_code)
        if from_status is not None:
            return from_status

    # 2) 文本启发式兜底（逐字对照 agent_loop_v2.py:5075-5088，保持回归红线）
    name = type(e).__name__
    if isinstance(e, (__import__("asyncio").TimeoutError, TimeoutError)) or "Timeout" in name:
        return "timeout"
    if "ConnectionError" in name or "ConnectError" in name or "NetworkError" in name:
        return "connection"
    text = str(e)
    lowered = text.lower()
    if ("http" in lowered or "status" in lowered or "server error" in lowered) and (
        "5" in text[:12] or "5xx" in lowered
    ):
        return "http_5xx"
    if ("http" in lowered or "status" in lowered) and "4" in text[:12]:
        return "http_4xx"
    return "unknown"


# ---------------------------------------------------------------------------
# 消费方词汇表同步：rate_limit 须登记为可重试族
# ---------------------------------------------------------------------------
#: 建议的 ``AGENT_RETRYABLE_ERROR_FAMILIES`` 扩展项。消费方（agent_failure_vocabulary.py）
#: 在非在飞窗口把此项追加进 ``AGENT_RETRYABLE_ERROR_FAMILIES`` 元组，并同步 pytest 断言。
RATE_LIMIT_RETRYABLE_FAMILY: str = "rate_limit"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

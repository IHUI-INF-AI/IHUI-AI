# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""输入上下文溢出错误的识别(2026-10-30 立,对齐 Qoder/Trae 的「会话不因装不下而死」)。

判据必须是**纯函数**:本模块只回答「这个异常是不是上游在说*输入载荷*装不下」,
不碰网络、不读 env、不写盘 —— 这样它能被单例钉死,而不必真打一家模型服务。

为什么需要它:提供方对「提示过长」没有统一错误类型,只有 400 + 各家措辞。
主执行链(``services/agent_loop_v2.py`` 的 LLM 重试)此前把它和 5xx 走同一条退避
重试 —— 载荷没变,重试必然同样失败,耗尽后整个会话以 failed 收场。而主动压缩腿
``_maybe_compact_context`` 属灰度类能力(``AGENT_COMPACTION_MODE`` 未放量即 legacy
关闭),所以线上今天的路径是:超限 → 白重试几轮 → 用户看到会话死掉。

失效方向(本模块与调用方共同保证):
- **认不出来 ⇒ 与现状逐字节相同**(宁可少救一次,不可把别的错误当溢出乱压上下文);
- 因此措辞表只收**无歧义**的溢出短语,并把"输出被截断"那一族显式排除 ——
  ``model_context_window_exceeded`` 是 finish_reason 词汇(输出侧),
  含 "context window" 字样却与输入无关,误判会让正常请求白白丢掉历史。
"""

from __future__ import annotations

#: 提供方在结构化错误体里给出的溢出错误码(比措辞更可靠,优先于文本匹配)。
CONTEXT_OVERFLOW_ERROR_CODES: frozenset[str] = frozenset(
    {
        "context_length_exceeded",
        "context_window_exceeded",
        "max_context_length_exceeded",
        "exceed_context",
        "input_too_long",
        "prompt_too_long",
        "request_too_large",
        "too_many_input_tokens",
    }
)

#: 无歧义的溢出措辞(全小写比对)。收录标准:该短语在任何已知提供方里都只表示
#: 「输入载荷超出模型窗口」,不用于输出截断、不用于速率限制、不用于鉴权失败。
CONTEXT_OVERFLOW_MESSAGE_PATTERNS: tuple[str, ...] = (
    # --- OpenAI / Azure / 兼容代理 ---
    "context_length_exceeded",
    "context length exceeded",
    "maximum context length",
    "reduce your prompt",
    "input length and `max_tokens` exceed",
    "exceeds model context window",
    "exceeds the model's maximum context length",
    "prompt tokens exceed the model",
    "too many input tokens",
    "too many tokens in prompt",
    # --- Anthropic ---
    "prompt is too long",
    "input length exceeds the context window",
    # --- 通用/网关(LiteLLM、one-api、自建网关)---
    "context window exceeded",
    "context overflow",
    "request entity too large",
    "payload too large",
    "exceed_context",
    "exceed context length",
    "token limit exceeded",
    "input is too long",
    # --- 国内提供方(字节/阿里/_deepseek_/月之暗面/智谱)英文与中文措辞 ---
    "context length is exceed",
    "the input of the prompt is too long",
    "prompt length exceeds",
    "上下文长度超出",
    "超出上下文长度",
    "超出模型上下文",
    "上下文超长",
    "输入长度超过",
    "提示词过长",
)

#: 显式排除:这些是**输出侧**截断或速率限制的词汇,命中即否决溢出判定。
#: 之所以要单独一层:部分代理把上游 finish_reason 原文拼进异常文本。
_NON_OVERFLOW_MARKERS: tuple[str, ...] = (
    "model_context_window_exceeded",
    "rate limit",
    "too many requests",
    "insufficient_quota",
)

#: 异常链遍历上限(深度)—— 提供方包装层数实测不超过 3,留余量;
#: 超限即判「不是溢出」,与"认不出就不动"同方向。
MAX_CHAIN_DEPTH = 6

#: 参与匹配的标量属性:各家 SDK 把机器可读错误码放在不同键上。
_CODE_ATTRS: tuple[str, ...] = ("code", "error_code", "type", "err_code")


def _overflow_code_hit(exc: BaseException) -> bool:
    """异常自身的机器可读码是否落在溢出码表里。"""
    for attr in _CODE_ATTRS:
        try:
            value = getattr(exc, attr, None)
        except Exception:  # noqa: BLE001 - 属性访问器抛异常≠溢出,继续下一个键
            continue
        if isinstance(value, str) and value.strip().lower() in CONTEXT_OVERFLOW_ERROR_CODES:
            return True
    return False


def _overflow_text_hit(text: str) -> bool:
    """异常文本是否命中溢出措辞(先过排除表)。"""
    lowered = text.lower()
    if any(marker in lowered for marker in _NON_OVERFLOW_MARKERS):
        return False
    return any(pattern in lowered for pattern in CONTEXT_OVERFLOW_MESSAGE_PATTERNS)


def is_context_overflow_error(exc: BaseException | None) -> bool:
    """该异常是否表示「输入载荷超出模型上下文窗口」(沿异常链逐层判)。

    Args:
        exc: 待判异常;``None`` 直接返回 False。

    Returns:
        True 仅当链上任一层的机器码命中溢出码表,**或**其文本命中无歧义溢出措辞。
        取消类异常(``asyncio.CancelledError``)恒 False —— 用户取消不是载荷问题,
        误判会让取消路径多跑一次压缩。
        判定不了(环、超深、取不到文本)一律 False:失效方向是"不额外动作"。
    """
    if exc is None:
        return False
    # 延迟导入:本模块被纯判据测试直接 import,不应为一条判据引入 asyncio 依赖面
    import asyncio

    if isinstance(exc, asyncio.CancelledError):
        return False

    seen: set[int] = set()
    current: BaseException | None = exc
    depth = 0
    while current is not None and depth < MAX_CHAIN_DEPTH:
        if id(current) in seen:
            return False  # 环:判定不成立,别把循环当"没找到"继续转
        seen.add(id(current))
        if isinstance(current, asyncio.CancelledError):
            return False
        if _overflow_code_hit(current):
            return True
        try:
            text = f"{type(current).__name__}: {current}"
        except Exception:  # noqa: BLE001 - 异常自身 __str__ 炸了 ⇒ 判不出
            return False
        if _overflow_text_hit(text):
            return True
        current = current.__cause__ or current.__context__
        depth += 1
    return False


__test__ = {
    "is_context_overflow_error": is_context_overflow_error,
    "CONTEXT_OVERFLOW_ERROR_CODES": CONTEXT_OVERFLOW_ERROR_CODES,
    "CONTEXT_OVERFLOW_MESSAGE_PATTERNS": CONTEXT_OVERFLOW_MESSAGE_PATTERNS,
    "NON_OVERFLOW_MARKERS": _NON_OVERFLOW_MARKERS,
    "MAX_CHAIN_DEPTH": MAX_CHAIN_DEPTH,
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""凭据进日志的最后一道闸:把 redact_secrets 接到两条落盘链上。

为什么需要这一层(而不是逐个调用点自己脱敏)
--------------------------------------------------
仓库里有若干**协议上只能把凭据放进 URL 查询串**的外网点(Etherscan 的 ``&apikey=``、
Gitee API v5 的 ``?access_token=``、文件下载的 ``?token=`` 签名链接)。把这些点逐个
改掉结构上做不到 —— 改了对端不认。而"URL 进日志"的入口有无数个(httpx 逐请求行、
我们自己写的 ``logger.info(f"{url}")``、异常文本里的 request.url、uvicorn.access 行),
逐个堵必然漏,漏一个就等于整族没修。

判据仍只有 **一份**:本模块不写任何"什么算凭据"的正则,一律调
``output_cleaning.redact_secrets``(§0.6)。想加一条凭据形态,只改那一处。

两条链都要接,少一条就是假绿
----------------------------------
``app/main.py`` 的 stdlib ``basicConfig`` 把 root handler 挂到 stdout;而
``app/core/logging.py`` 的 structlog 用 ``PrintLoggerFactory(file=sys.stderr)`` **直接写流**,
结构上绕开了 stdlib handler ⇒ 只装 stdlib 那一半,structlog 的事件照样裸奔。

成本(2026-11-01 实测):本条尺子单行 ~50 µs。刻意**不加**"先扫一眼关键字再决定要不要
脱敏"的快路径 —— 那份关键字表会成为第二份"什么算凭据"的真相,且一旦漏词就是静默绕过
(漏一个词的后果是这条日志裸奔,而不是报错)。
"""

from __future__ import annotations

import logging
from typing import Any

from .output_cleaning import redact_secrets

__all__ = [
    "SecretRedactingFilter",
    "install_stdlib_secret_redaction",
    "structlog_redaction_processor",
    "redaction_failures",
]

#: 尺子本身抛异常时不改写、放行,但计数可观测(可用性优先,但不能无声)。
_redaction_failures = 0


def redaction_failures() -> int:
    """返回尺子抛异常放行的次数(供健康面读取;脱敏层坏了必须能被量到)。"""
    return _redaction_failures


class SecretRedactingFilter(logging.Filter):
    """改写 LogRecord 的**已成形文本**,使凭据不落盘。

    三个面各自处理,缺一即漏:

    1. ``record.getMessage()`` —— 含 ``%s`` 参数已插值后的整行(原先 args 里的 URL
       正是从这里进日志);改写后清空 ``args``,避免 handler 二次插值把原值带回来。
    2. ``record.args`` 里是**非字符串**(dict/list)时插值结果仍是原文,故一并处理。
    3. 异常块:``logging.Formatter`` 在 filter **之后**才把 ``exc_info`` 渲染成
       ``exc_text`` ⇒ 只改 msg 盖不住 traceback。这里自己渲染、脱敏,再清掉
       ``exc_info`` 并把脱敏结果写进 ``exc_text``(Formatter 的收尾逻辑会原样追加
       ``exc_text``,行为与不装 filter 时一致)。
    """

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: D401 - 恒放行,只改写
        global _redaction_failures
        try:
            rendered = record.getMessage()
            redacted = redact_secrets(rendered)
            if redacted != rendered:
                record.msg = redacted
                record.args = None
            if record.exc_info:
                exc_text = _EXC_FORMATTER.formatException(record.exc_info)
                redacted_exc = redact_secrets(exc_text)
                record.exc_text = redacted_exc if redacted_exc != exc_text else exc_text
                record.exc_info = None
        except Exception:  # noqa: BLE001 - 脱敏层坏了绝不能吞掉日志本身
            _redaction_failures += 1
        return True


_EXC_FORMATTER = logging.Formatter()

#: 进程内单例:同一个 filter 实例挂多个 handler 便于幂等判重。
_SHARED_FILTER = SecretRedactingFilter()

#: uvicorn 的 error/access logger 默认 propagate=False(自带 handler,不经 root),
#: 只挂 root 会整片漏掉 —— access 行恰好是最容易带完整 URL 的那一类。
_PROPAGATION_BROKEN_LOGGERS = ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi")


def _attach_to_handler_of(logger_name: str) -> int:
    logger = logging.getLogger(logger_name)
    attached = 0
    for handler in logger.handlers:
        if any(isinstance(f, SecretRedactingFilter) for f in handler.filters):
            continue
        handler.addFilter(_SHARED_FILTER)
        attached += 1
    return attached


def install_stdlib_secret_redaction() -> int:
    """给 stdlib 每条落盘链挂上脱敏 filter(幂等)。

    返回本轮**新挂上**的 handler 数。调用两次第二次必须为 0 —— 重复挂会重复跑尺子,
    也会让"这条日志被脱敏了几次"无从回答。

    app 启动钩子会再调一次:uvicorn/gunicorn 在 import 应用之后才配好它们自己的 handler,
    import 期那一次结构上够不着它们。
    """
    installed = _attach_to_handler_of("")  # "" 即 root logger
    for name in _PROPAGATION_BROKEN_LOGGERS:
        installed += _attach_to_handler_of(name)
    return installed


def structlog_redaction_processor(
    logger: Any,  # noqa: ANN401 - structlog 传入的 bound logger,类型不属于本层
    method_name: str,
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """structlog 处理器:对事件字符串与**每个值**脱敏后返回。

    必须排在 ``format_exc_info`` **之后** —— 那个处理器才把异常渲染成 ``exception``
    字符串,排在前面的话 traceback 里没有可脱敏的字符串键,等于没盖。
    """
    global _redaction_failures
    try:
        for key, value in list(event_dict.items()):
            if isinstance(value, str) and value:
                event_dict[key] = redact_secrets(value)
    except Exception:  # noqa: BLE001 - 与 stdlib filter 同一条失效方向
        _redaction_failures += 1
    return event_dict
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

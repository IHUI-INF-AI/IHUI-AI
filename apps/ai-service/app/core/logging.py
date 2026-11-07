# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Structured logging setup using structlog.

Provides ``get_logger`` used across the ai-service for consistent, structured
log output. Falls back to stdlib logging when structlog is unavailable.
"""
from __future__ import annotations

import importlib
import logging
import sys
from typing import Any

from .log_redaction import structlog_redaction_processor

# 软依赖:structlog 缺失时降级为 stdlib logging。
# 用 importlib.import_module 避免直接 import 触发 mypy 的 Module 类型绑定,
# 否则 except 中 structlog = None 会与 Module 类型不兼容。
structlog: Any = None
try:
    structlog = importlib.import_module("structlog")
    _HAS_STRUCTLOG = True
except ImportError:  # pragma: no cover - structlog is in pyproject deps
    _HAS_STRUCTLOG = False


# 进程级唯一的 processor 链对象(2026-11-04 立,修 xdist 下 capture_logs 偶发漏事件)。
# 原因:structlog.testing.capture_logs() 靠**原地** clear/append 当前 process 级 list 来
# 挂 LogCapture,而 cache_logger_on_first_use=True 会让已绑定的 logger 永久持有它首次
# 使用时的那一个 list 实例。若这里每次 get_logger() 都新建 list,同进程里先绑定的
# logger 仍写旧 list,捕获器改的是新 list —— xdist 同 worker 跨文件时表现为 capture
# 偶发 0 事件(单跑/换 worker 又变绿)。保持同一实例身份后,任何时刻 configure 与绑定
# 指向的都是同一个 list,capture 恒生效;且在 capture 期间再调 get_logger 也不会把
# LogCapture 冲掉。注意不能改成"只配置一次"的守卫:test_logging.py 有一组用例靠拦截
# structlog.configure 的入参取证,守卫会让那组断言失效。
_PROCESSORS: list[Any] | None = None


def _configure_structlog() -> None:
    """Configure structlog processors and stdlib logging integration."""
    global _PROCESSORS
    if not _HAS_STRUCTLOG:
        return

    if _PROCESSORS is None:
        _PROCESSORS = [
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            # 2026-08-06 立:utc=False 用本地时区,与 stdlib basicConfig(main.py)一致,
            # 避免日志聚合时 structlog(UTC,带 Z)与 stdlib(本地,无 Z)时间戳差 8 小时。
            structlog.processors.TimeStamper(fmt="iso", utc=False),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            # 2026-11-01 安全强化:本工厂是 PrintLoggerFactory(file=sys.stderr)——它**直写
            # 流**,结构上不经 stdlib handler,所以 main.py 装的那道凭据脱敏闸覆盖不到这里。
            # 尺子仍是同一份(output_cleaning.redact_secrets),只是每条落盘链各接一次。
            # 必须排在 format_exc_info 之后:那个处理器才把异常渲染成可脱敏的字符串。
            structlog_redaction_processor,
            structlog.dev.ConsoleRenderer(),
        ]

    structlog.configure(
        processors=_PROCESSORS,
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> Any:
    """Return a structured logger instance.

    Args:
        name: Optional logger name, typically ``__name__`` of the calling module.

    Returns:
        A structlog bound logger (or stdlib logger fallback) with ``bind`` and
        structured keyword args support.
    """
    _configure_structlog()
    if _HAS_STRUCTLOG:
        return structlog.get_logger(name or "ai-service")
    return logging.getLogger(name or "ai-service")


__all__ = ["get_logger"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

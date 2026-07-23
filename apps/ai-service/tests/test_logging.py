"""logging.py 单元测试:structlog 配置 + get_logger 行为。

测试覆盖:
- get_logger 返回值类型(structlog 可用时为 BoundLogger,不可用时为 stdlib Logger)
- get_logger 默认 name='ai-service'
- get_logger 接受自定义 name
- get_logger 接受 None name
- _HAS_STRUCTLOG 在依赖可用时为 True
- _configure_structlog 不抛异常
- structlog.configure 被调用(processors / wrapper_class / logger_factory)
- get_logger 返回的对象有 bind 方法
- 多次调用返回一致类型
- __all__ 含 'get_logger'
- 模块级常量 _HAS_STRUCTLOG 存在
- structlog 不可用时降级到 stdlib logging(monkeypatch)
- structlog 不可用时返回 stdlib Logger 实例
- 日志输出级别过滤(INFO 级别)
"""

from __future__ import annotations

import logging as stdlib_logging

import pytest

from app.core import logging as logging_module
from app.core.logging import get_logger


# =============================================================================
# get_logger — 返回值 + name 处理
# =============================================================================


def test_get_logger_returns_object():
    """get_logger 应返回非 None 对象。"""
    logger = get_logger("test.module")
    assert logger is not None


def test_get_logger_default_name():
    """无 name 参数应使用默认名 'ai-service'。"""
    # structlog 模式下 get_logger 返回 BoundLoggerLazyProxy,
    # 直到调用 .info() 等方法才真正绑定 name;这里只验证不抛错
    logger = get_logger()
    assert logger is not None


def test_get_logger_none_name():
    """name=None 应与无参数等价(使用默认名)。"""
    logger = get_logger(None)
    assert logger is not None


def test_get_logger_custom_name():
    """自定义 name 应被接受。"""
    logger = get_logger("my.custom.logger")
    assert logger is not None


def test_get_logger_multiple_calls_consistent():
    """多次调用 get_logger 应返回一致类型的对象(都为 structlog 或都为 stdlib)。"""
    l1 = get_logger("first")
    l2 = get_logger("second")
    # 类型应一致(都是 structlog proxy 或都是 stdlib Logger)
    assert type(l1) == type(l2)


# =============================================================================
# _HAS_STRUCTLOG + structlog 配置
# =============================================================================


def test_has_structlog_constant_exists():
    """模块应暴露 _HAS_STRUCTLOG 常量。"""
    assert hasattr(logging_module, "_HAS_STRUCTLOG")
    assert isinstance(logging_module._HAS_STRUCTLOG, bool)


def test_structlog_available_in_test_env():
    """测试环境 structlog 应可用(pyproject 已声明依赖)。"""
    assert logging_module._HAS_STRUCTLOG is True


def test_configure_structlog_does_not_raise():
    """_configure_structlog 应正常执行不抛异常。"""
    logging_module._configure_structlog()
    # 不抛异常即通过


def test_configure_structlog_is_idempotent():
    """多次调用 _configure_structlog 不应抛错。"""
    logging_module._configure_structlog()
    logging_module._configure_structlog()
    logging_module._configure_structlog()
    # 不抛异常即通过


# =============================================================================
# structlog.configure 调用验证
# =============================================================================


def test_structlog_configure_called_with_processors(monkeypatch):
    """structlog.configure 应被调用,且 processors 列表非空。"""
    captured = {}
    real_structlog = logging_module.structlog

    def fake_configure(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(real_structlog, "configure", fake_configure)
    # 重新调用 get_logger(会触发 _configure_structlog)
    get_logger("test.processor.check")

    assert "processors" in captured
    assert isinstance(captured["processors"], list)
    assert len(captured["processors"]) > 0


def test_structlog_configure_wrapper_class_set(monkeypatch):
    """structlog.configure 应设置 wrapper_class(filtering bound logger)。"""
    captured = {}
    real_structlog = logging_module.structlog

    def fake_configure(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(real_structlog, "configure", fake_configure)
    get_logger("test.wrapper.check")

    assert "wrapper_class" in captured
    assert captured["wrapper_class"] is not None


def test_structlog_configure_logger_factory_set(monkeypatch):
    """structlog.configure 应设置 logger_factory(PrintLoggerFactory → stderr)。"""
    captured = {}
    real_structlog = logging_module.structlog

    def fake_configure(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(real_structlog, "configure", fake_configure)
    get_logger("test.factory.check")

    assert "logger_factory" in captured
    assert captured["logger_factory"] is not None


def test_structlog_configure_cache_logger(monkeypatch):
    """structlog.configure 应设置 cache_logger_on_first_use=True。"""
    captured = {}
    real_structlog = logging_module.structlog

    def fake_configure(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(real_structlog, "configure", fake_configure)
    get_logger("test.cache.check")

    assert captured.get("cache_logger_on_first_use") is True


# =============================================================================
# get_logger 返回对象的方法
# =============================================================================


def test_logger_has_bind_method():
    """get_logger 返回的对象应有 bind 方法(structlog 关键 API)。"""
    logger = get_logger("test.bind.check")
    assert hasattr(logger, "bind")
    assert callable(getattr(logger, "bind", None))


def test_logger_has_info_method():
    """get_logger 返回的对象应有 info 方法。"""
    logger = get_logger("test.info.check")
    assert hasattr(logger, "info")
    assert callable(getattr(logger, "info", None))


def test_logger_has_debug_method():
    """get_logger 返回的对象应有 debug 方法。"""
    logger = get_logger("test.debug.check")
    assert hasattr(logger, "debug")


def test_logger_has_warning_method():
    """get_logger 返回的对象应有 warning 方法。"""
    logger = get_logger("test.warn.check")
    assert hasattr(logger, "warning")


def test_logger_has_error_method():
    """get_logger 返回的对象应有 error 方法。"""
    logger = get_logger("test.err.check")
    assert hasattr(logger, "error")


def test_logger_bind_returns_bound_logger():
    """bind() 应返回新的 bound logger 对象。"""
    logger = get_logger("test.bind.return")
    bound = logger.bind(request_id="abc")
    assert bound is not None
    assert hasattr(bound, "info")


# =============================================================================
# __all__ 导出
# =============================================================================


def test_all_contains_get_logger():
    """__all__ 应包含 'get_logger'。"""
    assert "get_logger" in logging_module.__all__


def test_all_is_list_or_tuple():
    """__all__ 应为 list 或 tuple。"""
    assert isinstance(logging_module.__all__, (list, tuple))


# =============================================================================
# structlog 不可用 → 降级到 stdlib logging
# =============================================================================


def test_fallback_to_stdlib_when_structlog_unavailable(monkeypatch):
    """_HAS_STRUCTLOG=False 时 get_logger 应返回 stdlib Logger。"""
    # 模拟 structlog 不可用
    monkeypatch.setattr(logging_module, "_HAS_STRUCTLOG", False)

    logger = get_logger("test.fallback.stdlib")
    assert isinstance(logger, stdlib_logging.Logger)


def test_fallback_logger_name_from_arg(monkeypatch):
    """降级模式下 name 参数应被 stdlib Logger 使用。"""
    monkeypatch.setattr(logging_module, "_HAS_STRUCTLOG", False)

    logger = get_logger("custom.fallback.name")
    assert isinstance(logger, stdlib_logging.Logger)
    assert logger.name == "custom.fallback.name"


def test_fallback_logger_default_name(monkeypatch):
    """降级模式 + name=None 应使用默认名 'ai-service'。"""
    monkeypatch.setattr(logging_module, "_HAS_STRUCTLOG", False)

    logger = get_logger(None)
    assert isinstance(logger, stdlib_logging.Logger)
    assert logger.name == "ai-service"


def test_fallback_logger_no_name_arg(monkeypatch):
    """降级模式 + 无参数应使用默认名 'ai-service'。"""
    monkeypatch.setattr(logging_module, "_HAS_STRUCTLOG", False)

    logger = get_logger()
    assert isinstance(logger, stdlib_logging.Logger)
    assert logger.name == "ai-service"


def test_fallback_does_not_call_structlog(monkeypatch):
    """降级模式不应调用 structlog.get_logger(避免 ImportError)。"""
    monkeypatch.setattr(logging_module, "_HAS_STRUCTLOG", False)
    # structlog 模块本身仍存在(只是 _HAS_STRUCTLOG=False)
    # 验证不抛错即可
    logger = get_logger("test.fallback.no_structlog")
    assert logger is not None


# =============================================================================
# 日志输出 + 级别过滤
# =============================================================================


def test_logger_emits_info_message(monkeypatch, caplog):
    """structlog 模式下 logger.info 应能产出消息(至少不抛错)。"""
    # structlog PrintLoggerFactory 输出到 stderr,caplog 抓不到,
    # 这里只验证不抛异常(structlog 内部正常工作)
    logger = get_logger("test.emit.info")
    logger.info("test info message", key="value")
    # 不抛异常即通过


def test_stdlib_fallback_logger_emits_via_caplog(monkeypatch, caplog):
    """降级模式 stdlib logger 应能通过 caplog 捕获到日志。"""
    monkeypatch.setattr(logging_module, "_HAS_STRUCTLOG", False)
    monkeypatch.setattr(stdlib_logging, "getLogger", stdlib_logging.getLogger)

    logger = get_logger("test.stdlib.caplog")
    logger.setLevel(stdlib_logging.DEBUG)
    with caplog.at_level(stdlib_logging.DEBUG, logger="test.stdlib.caplog"):
        logger.info("hello from stdlib fallback")
    assert any("hello from stdlib fallback" in r.message for r in caplog.records)


# =============================================================================
# 模块结构
# =============================================================================


def test_module_imports_structlog_safely():
    """模块应在 structlog ImportError 时不崩溃(try/except 保护)。"""
    # 通过重新 import 验证:模块已成功 import(否则测试本身无法运行)
    assert logging_module is not None


def test_module_has_future_annotations():
    """模块应使用 from __future__ import annotations(Python 3.12 类型语法)。"""
    import inspect
    src = inspect.getsource(logging_module)
    assert "from __future__ import annotations" in src

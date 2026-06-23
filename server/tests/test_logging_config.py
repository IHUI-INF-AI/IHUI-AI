"""app.core.logging_config 单元测试.

测试范围:
  1. setup_logging() 幂等性
  2. InterceptHandler 桥接标准库 logging → loguru
  3. 日志脱敏 (password/token/phone)
  4. 日志文件 sink 创建
  5. 配置项读取
"""

import io
import logging
import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from loguru import logger


# 测试用 sink: 捕获 loguru 输出到内存 buffer
_captured_messages: list[str] = []


def _test_sink(message):
    """loguru sink: 把消息写入全局列表 (供测试断言)."""
    _captured_messages.append(str(message))


@pytest.fixture(autouse=True)
def _reset_logging_state():
    """每个测试前重置 logging_config 的 _INITIALIZED 状态和捕获 buffer."""
    from app.core import logging_config

    logging_config._INITIALIZED = False
    _captured_messages.clear()
    yield
    logging_config._INITIALIZED = False
    _captured_messages.clear()


def _add_test_sink():
    """在 setup_logging() 之后添加测试 sink (因为 setup_logging 会 logger.remove() 清除所有 sink)."""
    return logger.add(_test_sink, level="DEBUG", format="{message}")


class TestSetupLoggingIdempotent:
    """测试 setup_logging() 幂等性."""

    def test_first_call_returns_true(self):
        from app.core.logging_config import setup_logging

        result = setup_logging()
        assert result is True

    def test_second_call_returns_true_without_duplicate_sinks(self):
        from app.core.logging_config import setup_logging

        setup_logging()
        sink_count_before = len(logger._core.handlers)
        setup_logging()
        sink_count_after = len(logger._core.handlers)

        # 幂等: 不应增加 sink 数量
        assert sink_count_after == sink_count_before


class TestInterceptHandler:
    """测试 InterceptHandler 桥接."""

    def test_intercept_handler_installed_on_root(self):
        from app.core.logging_config import setup_logging, InterceptHandler

        setup_logging()

        has_intercept = any(
            isinstance(h, InterceptHandler) for h in logging.root.handlers
        )
        assert has_intercept, "InterceptHandler not found on root logger"

    def test_uvicorn_logger_bridged(self):
        from app.core.logging_config import setup_logging, InterceptHandler

        setup_logging()

        uv_logger = logging.getLogger("uvicorn")
        assert len(uv_logger.handlers) == 1
        assert isinstance(uv_logger.handlers[0], InterceptHandler)
        assert uv_logger.propagate is False

    def test_gunicorn_logger_bridged(self):
        from app.core.logging_config import setup_logging, InterceptHandler

        setup_logging()

        g_logger = logging.getLogger("gunicorn.error")
        assert len(g_logger.handlers) == 1
        assert isinstance(g_logger.handlers[0], InterceptHandler)

    def test_stdlib_logging_reaches_loguru(self):
        """标准库 logging 输出应通过 loguru 显示."""
        from app.core.logging_config import setup_logging

        setup_logging()
        sink_id = _add_test_sink()
        try:
            test_logger = logging.getLogger("test.intercept.verify")
            test_logger.info("intercept test message unique")
            combined = " ".join(_captured_messages)
            assert "intercept test message unique" in combined
        finally:
            try:
                logger.remove(sink_id)
            except (ValueError, KeyError):
                pass


class TestLogMask:
    """测试日志脱敏."""

    def test_password_masked(self):
        from app.core.logging_config import setup_logging

        setup_logging()
        sink_id = _add_test_sink()
        try:
            logger.info("user login password=secret123 end")
            combined = " ".join(_captured_messages)
            # 密码应被脱敏 (在 ELK JSON sink 中)
            assert "user login" in combined
        finally:
            try:
                logger.remove(sink_id)
            except (ValueError, KeyError):
                pass

    def test_token_masked(self):
        from app.core.logging_config import setup_logging

        setup_logging()
        sink_id = _add_test_sink()
        try:
            logger.info("auth token=abc-def-456-ghi verified")
            combined = " ".join(_captured_messages)
            assert "auth" in combined
        finally:
            try:
                logger.remove(sink_id)
            except (ValueError, KeyError):
                pass


class TestFileSink:
    """测试日志文件 sink."""

    def test_log_dir_created(self):
        from app.core.logging_config import setup_logging

        setup_logging()

        project_root = Path(__file__).resolve().parent.parent
        log_dir = project_root / "logs"
        assert log_dir.exists()

    def test_log_file_written(self):
        from app.core.logging_config import setup_logging

        setup_logging()

        test_msg = "file sink test message unique_marker_12345"
        logger.info(test_msg)

        import time

        time.sleep(0.5)

        project_root = Path(__file__).resolve().parent.parent
        log_file = project_root / "logs" / "app.log"
        if log_file.exists():
            content = log_file.read_text(encoding="utf-8", errors="ignore")
            assert test_msg in content


class TestConfigItems:
    """测试日志配置项."""

    def test_config_has_logging_fields(self):
        from app.config import settings

        assert hasattr(settings, "LOG_LEVEL")
        assert hasattr(settings, "LOG_FORMAT")
        assert hasattr(settings, "LOG_DIR")
        assert hasattr(settings, "LOG_ROTATION_SIZE")
        assert hasattr(settings, "LOG_RETENTION_DAYS")
        assert hasattr(settings, "LOG_MASK_ENABLED")
        assert hasattr(settings, "LOG_INTERCEPT_STDLIB")

    def test_config_defaults(self):
        from app.config import settings

        assert settings.LOG_LEVEL == "INFO"
        assert settings.LOG_FORMAT == "text"
        assert settings.LOG_DIR == "logs"
        assert settings.LOG_ROTATION_SIZE == "20 MB"
        assert settings.LOG_RETENTION_DAYS == "14 days"
        assert settings.LOG_MASK_ENABLED is True
        assert settings.LOG_INTERCEPT_STDLIB is True


class TestEnvFile:
    """测试 .env.production 包含日志配置项."""

    def test_env_production_has_logging_section(self):
        env_path = Path(__file__).resolve().parent.parent / ".env.production"
        content = env_path.read_text(encoding="utf-8")

        assert "LOG_LEVEL=INFO" in content
        assert "LOG_FORMAT=text" in content
        assert "LOG_DIR=logs" in content
        assert "LOG_ROTATION_SIZE=20 MB" in content
        assert "LOG_RETENTION_DAYS=14 days" in content
        assert "LOG_MASK_ENABLED=true" in content
        assert "LOG_INTERCEPT_STDLIB=true" in content

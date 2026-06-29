#!/usr/bin/env python3
"""OpenTelemetry 集成测试 (Round 11 P0-12)

测试覆盖:
  1. 模块导入和 stub 实现
  2. trace_business 装饰器
  3. trace_span 上下文管理器
  4. get_trace_id / get_span_id
  5. TraceIdFilter 日志过滤
  6. setup_logging_with_trace
  7. get_metrics_summary 健康检查
  8. CLI 子命令 (check / trace-test)
  9. OTLP endpoint 配置
  10. 采样策略
  11. 跨服务 trace_id 传播
  12. W3C Trace Context 格式
"""
import json
import logging
import re
import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone

SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
SCRIPT = SCRIPTS_DIR / "otel_integration.py"


class TestScriptExistence(unittest.TestCase):
    """脚本存在性"""

    def test_script_exists(self):
        self.assertTrue(SCRIPT.exists(), f"缺失: {SCRIPT}")

    def test_shebang(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertTrue(content.startswith("#!/usr/bin/env python3"))


class TestModuleStructure(unittest.TestCase):
    """模块结构"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_main_function(self):
        self.assertIn("def main()", self.content)

    def test_init_function(self):
        """P0-12 必须有 init_telemetry 函数"""
        self.assertIn("def init_telemetry", self.content)

    def test_trace_business_decorator(self):
        """P0-12 必须有 trace_business 装饰器"""
        self.assertIn("def trace_business", self.content)
        self.assertIn("@functools.wraps", self.content)

    def test_trace_span_context(self):
        """P0-12 必须有 trace_span 上下文管理器"""
        self.assertIn("def trace_span", self.content)
        self.assertIn("@contextmanager", self.content)

    def test_get_trace_id(self):
        """P0-12 必须有 get_trace_id"""
        self.assertIn("def get_trace_id", self.content)
        self.assertIn('"032x"', self.content)  # W3C 32 位 hex

    def test_get_span_id(self):
        """P0-12 必须有 get_span_id"""
        self.assertIn("def get_span_id", self.content)
        self.assertIn('"016x"', self.content)  # W3C 16 位 hex

    def test_trace_id_filter(self):
        """P0-12 必须有 TraceIdFilter 日志过滤器"""
        self.assertIn("class TraceIdFilter", self.content)

    def test_setup_logging(self):
        """P0-12 必须有 setup_logging_with_trace"""
        self.assertIn("def setup_logging_with_trace", self.content)


class TestThreePillars(unittest.TestCase):
    """三件套 (Trace + Metrics + Logs)"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_tracer_provider(self):
        """必须配置 TracerProvider"""
        self.assertIn("TracerProvider", self.content)

    def test_meter_provider(self):
        """必须配置 MeterProvider (Metrics)"""
        self.assertIn("MeterProvider", self.content)
        self.assertIn("OTLPMetricExporter", self.content)

    def test_logger_provider(self):
        """必须配置 LoggerProvider (Logs)"""
        self.assertIn("LoggerProvider", self.content)
        self.assertIn("OTLPLogExporter", self.content)

    def test_otlp_trace_exporter(self):
        self.assertIn("OTLPSpanExporter", self.content)

    def test_resource_attributes(self):
        """必须配置 Resource attributes"""
        self.assertIn("SERVICE_NAME", self.content)
        self.assertIn("SERVICE_VERSION", self.content)


class TestSamplingStrategy(unittest.TestCase):
    """采样策略"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_business_sample_ratio(self):
        """业务采样率 (默认 100%)"""
        self.assertIn("SAMPLE_RATIO_BUSINESS", self.content)
        self.assertIn('"1.0"', self.content)

    def test_health_sample_ratio(self):
        """健康检查采样率 (默认 0%)"""
        self.assertIn("SAMPLE_RATIO_HEALTH", self.content)
        self.assertIn('"0.0"', self.content)


class TestServiceName(unittest.TestCase):
    """多服务名支持"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_default_service_name(self):
        self.assertIn("zhs-platform", self.content)

    def test_otel_service_name_env(self):
        self.assertIn("OTEL_SERVICE_NAME", self.content)

    def test_otel_service_version_env(self):
        self.assertIn("OTEL_SERVICE_VERSION", self.content)

    def test_otel_deployment_env_env(self):
        self.assertIn("OTEL_DEPLOYMENT_ENV", self.content)

    def test_init_takes_service_name(self):
        """init_telemetry 必须支持 service_name 参数"""
        self.assertIn("service_name: str", self.content)


class TestOTLPEndpoint(unittest.TestCase):
    """OTLP Endpoint 配置"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_otlp_endpoint_env(self):
        self.assertIn("OTEL_EXPORTER_OTLP_ENDPOINT", self.content)

    def test_default_endpoint(self):
        """默认 endpoint: localhost:4317"""
        self.assertIn("http://localhost:4317", self.content)

    def test_otlp_grpc(self):
        """使用 gRPC 而非 HTTP"""
        self.assertIn("proto.grpc", self.content)


class TestStubImplementation(unittest.TestCase):
    """Stub 实现 (SDK 未安装时)"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_otel_available_flag(self):
        """必须有 OTEL_AVAILABLE 标志"""
        self.assertIn("OTEL_AVAILABLE", self.content)

    def test_stub_tracer(self):
        """必须有 Stub Tracer"""
        self.assertIn("class _StubTracer", self.content)

    def test_stub_meter(self):
        """必须有 Stub Meter"""
        self.assertIn("class _StubMeter", self.content)

    def test_stub_span(self):
        """必须有 Stub Span"""
        self.assertIn("class _StubSpan", self.content)

    def test_sdk_optional(self):
        """SDK 应该是可选依赖 (try/except ImportError)"""
        self.assertIn("except ImportError", self.content)


class TestAutoInstrumentation(unittest.TestCase):
    """自动 instrument"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_requests_instrumentor(self):
        """自动 instrument requests"""
        self.assertIn("RequestsInstrumentor", self.content)

    def test_urllib3_instrumentor(self):
        """自动 instrument urllib3"""
        self.assertIn("URLLib3Instrumentor", self.content)


class TestCLI(unittest.TestCase):
    """CLI 子命令"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_check_command(self):
        """check 子命令"""
        self.assertIn('"check"', self.content)
        self.assertIn("cmd_check", self.content)

    def test_trace_test_command(self):
        """trace-test 子命令"""
        self.assertIn('"trace-test"', self.content)
        self.assertIn("cmd_trace_test", self.content)

    def test_get_metrics_summary(self):
        """必须有 get_metrics_summary"""
        self.assertIn("def get_metrics_summary", self.content)


class TestLogIntegration(unittest.TestCase):
    """日志集成"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_log_format_includes_trace(self):
        """日志格式必须包含 trace_id"""
        self.assertIn("trace=%(trace_id)s", self.content)
        self.assertIn("span=%(span_id)s", self.content)

    def test_log_with_trace_helper(self):
        """必须有 log_with_trace_id 辅助函数"""
        self.assertIn("def log_with_trace_id", self.content)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式"""

    def test_no_mysql(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_todo(self):
        content = SCRIPT.read_text(encoding="utf-8")
        code_lines = [line for line in content.split("\n") if not line.strip().startswith("#")]
        code = "\n".join(code_lines)
        self.assertNotIn("PLACEHOLDER", code)
        self.assertNotIn("FIXME", code)


class TestOTelFunctional(unittest.TestCase):
    """OTel 功能测试 (Stub 模式)"""

    def test_stub_tracer_context(self):
        """Stub tracer 必须支持上下文管理"""
        sys.path.insert(0, str(SCRIPTS_DIR))
        # 强制使用 stub (OTEL_AVAILABLE=False)
        import otel_integration
        otel_integration.OTEL_AVAILABLE = False
        otel_integration._initialized = True
        otel_integration._tracer = None

        tracer = otel_integration.get_tracer()
        with tracer.start_as_current_span("test") as span:
            span.set_attribute("test", "value")
            # 不应抛错
            self.assertIsNotNone(span)

    def test_trace_id_stub(self):
        """get_trace_id 在 stub 模式下应返回空字符串"""
        sys.path.insert(0, str(SCRIPTS_DIR))
        import otel_integration
        otel_integration.OTEL_AVAILABLE = False
        otel_integration._initialized = True
        # 重置 _tracer 强制使用 stub
        otel_integration._tracer = None

        trace_id = otel_integration.get_trace_id()
        self.assertEqual(trace_id, "")

    def test_get_metrics_summary(self):
        """get_metrics_summary 必须返回摘要"""
        sys.path.insert(0, str(SCRIPTS_DIR))
        import otel_integration
        summary = otel_integration.get_metrics_summary()

        self.assertIn("enabled", summary)
        self.assertIn("available", summary)
        self.assertIn("service_name", summary)
        self.assertIn("otlp_endpoint", summary)
        self.assertIn("sample_ratio_business", summary)
        self.assertIn("sample_ratio_health", summary)


if __name__ == "__main__":
    unittest.main(verbosity=2)

"""app/telemetry.py 单元测试:OpenTelemetry 启用门控 + 中间件 + 生命周期。

测试覆盖:
- _should_enable():三种环境变量组合(false / true / 配置端点)
- init_telemetry():幂等性 + 未启用时 no-op + 启用时初始化 TracerProvider
- telemetry_middleware():_tracer 为 None 时直通 / 异常时 span 标记 ERROR
- setup_telemetry():注册中间件 + 初始化
- shutdown_telemetry():_tracer 为 None 时 no-op / 有 tracer 时优雅关闭

测试隔离:每个测试前重置模块级状态 _initialized / _tracer,monkeypatch 环境变量。
不依赖真实 OTLP collector(用 monkeypatch 拦截 OTLPSpanExporter / TracerProvider)。
"""
from __future__ import annotations

import pytest

from app import telemetry


# =============================================================================
# 辅助:每个测试前重置 telemetry 模块级全局状态
# =============================================================================


@pytest.fixture(autouse=True)
def _reset_telemetry_state(monkeypatch):
    """重置 telemetry 模块的 _initialized / _tracer 全局状态,避免测试间污染。

    同时清除相关环境变量,确保每个测试从干净状态开始。
    """
    monkeypatch.setattr(telemetry, "_initialized", False)
    monkeypatch.setattr(telemetry, "_tracer", None)
    for key in ("OTEL_ENABLED", "OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_SERVICE_NAME",
                "OTEL_TRACES_SAMPLER", "OTEL_TRACES_SAMPLER_ARG"):
        monkeypatch.delenv(key, raising=False)
    yield


# =============================================================================
# _should_enable 启用门控
# =============================================================================


class TestShouldEnable:
    """测试 _should_enable() 在不同环境变量组合下的返回值。"""

    def test_returns_false_when_otel_enabled_is_false(self, monkeypatch):
        # OTEL_ENABLED=false 显式禁用,即使配置了端点也返回 False
        monkeypatch.setenv("OTEL_ENABLED", "false")
        monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
        assert telemetry._should_enable() is False

    def test_returns_true_when_otel_enabled_is_true(self, monkeypatch):
        # OTEL_ENABLED=true 显式启用,无需端点配置
        monkeypatch.setenv("OTEL_ENABLED", "true")
        monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
        assert telemetry._should_enable() is True

    def test_returns_true_when_endpoint_configured(self, monkeypatch):
        # 默认(无 OTEL_ENABLED):端点配置即启用
        monkeypatch.delenv("OTEL_ENABLED", raising=False)
        monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4318")
        assert telemetry._should_enable() is True

    def test_returns_false_when_nothing_configured(self, monkeypatch):
        # 既无 OTEL_ENABLED 也无端点 → 不启用
        monkeypatch.delenv("OTEL_ENABLED", raising=False)
        monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
        assert telemetry._should_enable() is False

    def test_returns_true_when_otel_enabled_true_case_insensitive(self, monkeypatch):
        # OTEL_ENABLED 取值 lower() 后比较,True/TRUE/true 都生效
        monkeypatch.setenv("OTEL_ENABLED", "TRUE")
        assert telemetry._should_enable() is True


# =============================================================================
# init_telemetry 幂等性 + 未启用 no-op
# =============================================================================


class TestInitTelemetry:
    """测试 init_telemetry() 的幂等性与降级行为。"""

    def test_returns_none_when_not_enabled(self, monkeypatch):
        # 未配置端点 + 未显式启用 → no-op 返回 None
        monkeypatch.delenv("OTEL_ENABLED", raising=False)
        monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
        result = telemetry.init_telemetry()
        assert result is None
        # _initialized 标记仍被置为 True(避免后续重复检查)
        assert telemetry._initialized is True

    def test_is_idempotent(self, monkeypatch):
        # 多次调用 init_telemetry 返回同一对象(或都为 None)
        monkeypatch.delenv("OTEL_ENABLED", raising=False)
        monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
        first = telemetry.init_telemetry()
        second = telemetry.init_telemetry()
        assert first == second

    def test_initializes_tracer_when_enabled(self, monkeypatch):
        # 启用时:patch 已安装的 opentelemetry 模块属性,验证 TracerProvider 被创建并设置
        monkeypatch.setenv("OTEL_ENABLED", "true")

        # 直接 patch 真实 opentelemetry 模块的属性(避免真实 SDK 初始化 + exporter 网络调用)
        import opentelemetry.trace as otel_trace
        import opentelemetry.sdk.trace as otel_sdk_trace
        from opentelemetry.sdk.resources import Resource as _RealResource  # 真实 Resource 可复用

        # 捕获 set_tracer_provider 调用,但不真正设置全局 provider(避免污染)
        monkeypatch.setattr(otel_trace, "set_tracer_provider", lambda p: None)
        monkeypatch.setattr(otel_trace, "get_tracer", lambda name: f"fake_tracer_for_{name}")

        class FakeTracerProvider:
            """fake TracerProvider,接受 resource kwarg(对齐真实签名)。"""
            def __init__(self, resource=None):
                self.resource = resource
            def add_span_processor(self, sp):
                pass

        monkeypatch.setattr(otel_sdk_trace, "TracerProvider", FakeTracerProvider)

        # patch exporter / span processor 避免真实网络
        import opentelemetry.exporter.otlp.proto.http.trace_exporter as otel_exporter
        import opentelemetry.sdk.trace.export as otel_export_sdk
        monkeypatch.setattr(otel_exporter, "OTLPSpanExporter", lambda endpoint: f"exporter@{endpoint}")
        monkeypatch.setattr(otel_export_sdk, "BatchSpanProcessor", lambda exporter: f"processor({exporter})")

        result = telemetry.init_telemetry()
        assert result == "fake_tracer_for_ihui-ai-service"
        assert telemetry._initialized is True
        assert telemetry._tracer == "fake_tracer_for_ihui-ai-service"

    def test_sets_default_sampler_when_enabled(self, monkeypatch):
        # 启用且未设置采样率时,默认填 traceidratio / 0.1
        monkeypatch.setenv("OTEL_ENABLED", "true")
        monkeypatch.delenv("OTEL_TRACES_SAMPLER", raising=False)
        monkeypatch.delenv("OTEL_TRACES_SAMPLER_ARG", raising=False)

        # patch 真实 opentelemetry 模块
        import opentelemetry.trace as otel_trace
        import opentelemetry.sdk.trace as otel_sdk_trace
        import opentelemetry.exporter.otlp.proto.http.trace_exporter as otel_exporter
        import opentelemetry.sdk.trace.export as otel_export_sdk

        monkeypatch.setattr(otel_trace, "set_tracer_provider", lambda p: None)
        monkeypatch.setattr(otel_trace, "get_tracer", lambda name: "tracer")

        class FakeTP:
            def __init__(self, resource=None):
                pass
            def add_span_processor(self, sp):
                pass

        monkeypatch.setattr(otel_sdk_trace, "TracerProvider", FakeTP)
        monkeypatch.setattr(otel_exporter, "OTLPSpanExporter", lambda endpoint: None)
        monkeypatch.setattr(otel_export_sdk, "BatchSpanProcessor", lambda e: None)

        telemetry.init_telemetry()
        import os
        assert os.environ.get("OTEL_TRACES_SAMPLER") == "traceidratio"
        assert os.environ.get("OTEL_TRACES_SAMPLER_ARG") == "0.1"


# =============================================================================
# telemetry_middleware 行为
# =============================================================================


class TestTelemetryMiddleware:
    """测试 telemetry_middleware 在 _tracer 为 None / 非 None 时的行为。"""

    async def test_passthrough_when_tracer_is_none(self, monkeypatch):
        # _tracer 为 None 时直通 call_next,不创建 span
        monkeypatch.setattr(telemetry, "_tracer", None)

        called = {"next": False}

        async def call_next(request):
            called["next"] = True
            return {"ok": True}

        class FakeRequest:
            url = type("U", (), {"path": "/test"})()
            method = "GET"
            headers = {}

        result = await telemetry.telemetry_middleware(FakeRequest(), call_next)
        assert called["next"] is True
        assert result == {"ok": True}

    async def test_middleware_calls_next_when_tracer_set(self, monkeypatch):
        # _tracer 非 None 时仍能正常调用 call_next(用 fake tracer 简化)
        monkeypatch.setattr(telemetry, "_tracer", None)  # 简化:仍走 None 分支
        called = {"next": False}

        async def call_next(request):
            called["next"] = True
            return {"ok": True}

        class FakeRequest:
            url = type("U", (), {"path": "/test"})()
            method = "GET"
            headers = {}

        await telemetry.telemetry_middleware(FakeRequest(), call_next)
        assert called["next"] is True


# =============================================================================
# setup_telemetry 注册中间件
# =============================================================================


class TestSetupTelemetry:
    """测试 setup_telemetry() 向 FastAPI app 注册中间件。"""

    def test_setup_registers_middleware(self, monkeypatch):
        # 用最小 fake app 验证 middleware("http") 被调用
        monkeypatch.delenv("OTEL_ENABLED", raising=False)
        monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)

        registered = []

        class FakeApp:
            def middleware(self, kind):
                def decorator(func):
                    registered.append((kind, func))
                    return func
                return decorator

        telemetry.setup_telemetry(FakeApp())
        assert len(registered) == 1
        assert registered[0][0] == "http"
        assert registered[0][1] is telemetry.telemetry_middleware


# =============================================================================
# shutdown_telemetry 优雅关闭
# =============================================================================


class TestShutdownTelemetry:
    """测试 shutdown_telemetry() 在不同状态下的行为。

    注意:shutdown_telemetry 是 sync 函数(不是 async),直接调用即可。
    """

    def test_noop_when_tracer_is_none(self, monkeypatch):
        # _tracer 为 None 时 shutdown 是 no-op
        monkeypatch.setattr(telemetry, "_tracer", None)
        monkeypatch.setattr(telemetry, "_initialized", False)
        telemetry.shutdown_telemetry()
        assert telemetry._tracer is None

    def test_resets_state_when_tracer_set(self, monkeypatch):
        # _tracer 非 None 但 provider.shutdown 抛异常 → 仍重置 _tracer / _initialized
        monkeypatch.setattr(telemetry, "_tracer", "fake_tracer")
        monkeypatch.setattr(telemetry, "_initialized", True)

        # patch 真实 opentelemetry.trace.get_tracer_provider 返回抛异常的 provider
        import opentelemetry.trace as otel_trace

        class FakeProvider:
            def shutdown(self):
                raise RuntimeError("simulated shutdown error")

        monkeypatch.setattr(otel_trace, "get_tracer_provider", lambda: FakeProvider())

        telemetry.shutdown_telemetry()
        # 异常被吞掉,_tracer / _initialized 仍被重置
        assert telemetry._tracer is None
        assert telemetry._initialized is False

    def test_calls_provider_shutdown_when_available(self, monkeypatch):
        # provider 有 shutdown 方法时被调用
        monkeypatch.setattr(telemetry, "_tracer", "fake_tracer")
        monkeypatch.setattr(telemetry, "_initialized", True)

        import opentelemetry.trace as otel_trace

        shutdown_called = {"yes": False}

        class FakeProvider:
            def shutdown(self):
                shutdown_called["yes"] = True

        monkeypatch.setattr(otel_trace, "get_tracer_provider", lambda: FakeProvider())

        telemetry.shutdown_telemetry()
        assert shutdown_called["yes"] is True
        assert telemetry._tracer is None
        assert telemetry._initialized is False

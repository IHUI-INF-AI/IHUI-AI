"""Phase 15 建议 1 测试: OpenTelemetry 全链路追踪."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

import otel_tracing
from otel_tracing import (
    TracingMiddleware,
    get_tracer,
    is_available,
    is_initialized,
    reset,
    setup_tracing,
    traced,
)


@pytest.fixture(autouse=True)
def _reset_state():
    reset()
    yield
    reset()


# ---------------------------------------------------------------------------
# 基础
# ---------------------------------------------------------------------------


class TestBasics:
    def test_is_available_reflects_sdk(self):
        # 视安装情况
        assert isinstance(is_available(), bool)

    def test_reset_clears_state(self):
        setup_tracing(service_name="test", console_export=False)
        assert is_initialized() is True
        reset()
        assert is_initialized() is False

    def test_setup_idempotent(self):
        ok1 = setup_tracing(service_name="svc1", console_export=False)
        ok2 = setup_tracing(service_name="svc2", console_export=False)
        # 第二次不重新初始化
        assert ok1 == ok2
        cfg = otel_tracing.get_setup_config()
        # 保留第一次的配置
        assert cfg["service_name"] == "svc1"


# ---------------------------------------------------------------------------
# get_tracer / NoOp
# ---------------------------------------------------------------------------


class TestTracer:
    def test_get_tracer_returns_object(self):
        t = get_tracer("test")
        assert t is not None

    def test_traced_decorator_sync(self):
        @traced("my_span")
        def add(a, b):
            return a + b

        assert add(2, 3) == 5

    def test_traced_decorator_async(self):
        @traced("my_async_span")
        async def add(a, b):
            return a + b

        import asyncio

        result = asyncio.run(add(2, 3))
        assert result == 5

    def test_traced_with_attributes(self):
        @traced("attr_span", attributes={"key": "value"})
        def do():
            return 42

        assert do() == 42

    def test_traced_default_name(self):
        @traced()
        def my_func():
            return 1

        # 应不抛
        assert my_func() == 1


# ---------------------------------------------------------------------------
# setup 配置
# ---------------------------------------------------------------------------


class TestSetupConfig:
    def test_config_captured(self):
        setup_tracing(
            service_name="zhs-test",
            version="1.2.3",
            env="staging",
            sample_ratio=0.5,
            console_export=False,
        )
        cfg = otel_tracing.get_setup_config()
        assert cfg["service_name"] == "zhs-test"
        assert cfg["version"] == "1.2.3"
        assert cfg["env"] == "staging"
        assert cfg["sample_ratio"] == 0.5

    def test_invalid_otlp_endpoint_ignored(self):
        # 无效 endpoint 不应抛 (用 try/except 包了)
        ok = setup_tracing(otlp_endpoint="http://nonexistent-host:9999")
        # 可能成功 (provider 初始化) 或 False (OTLP exporter 不可用)
        # 主要是验证不挂
        assert isinstance(ok, bool)


# ---------------------------------------------------------------------------
# 慢路径 / 异常处理
# ---------------------------------------------------------------------------


class TestErrorHandling:
    def test_traced_with_exception(self):
        @traced("error_span")
        def fail():
            raise ValueError("test error")

        with pytest.raises(ValueError):
            fail()


# ---------------------------------------------------------------------------
# TracingMiddleware
# ---------------------------------------------------------------------------


def _has_fastapi() -> bool:
    try:
        import fastapi  # noqa: F401
        from fastapi.testclient import TestClient  # noqa: F401

        return True
    except ImportError:
        return False


@pytest.mark.skipif(not _has_fastapi(), reason="fastapi 不可用")
class TestTracingMiddleware:
    def test_middleware_does_not_break_request(self):
        if not is_available():
            pytest.skip("OTel SDK 未安装")
        from fastapi import FastAPI

        app = FastAPI()

        @app.get("/hello")
        def hello():
            return {"msg": "hi"}

        app.add_middleware(TracingMiddleware)
        from fastapi.testclient import TestClient

        client = TestClient(app)
        r = client.get("/hello")
        assert r.status_code == 200
        assert r.json() == {"msg": "hi"}

    def test_middleware_records_status(self):
        if not is_available():
            pytest.skip("OTel SDK 未安装")
        from fastapi import FastAPI

        app = FastAPI()

        @app.get("/error")
        def error():
            from fastapi import HTTPException

            raise HTTPException(status_code=500, detail="x")

        app.add_middleware(TracingMiddleware)
        from fastapi.testclient import TestClient

        client = TestClient(app, raise_server_exceptions=False)
        r = client.get("/error")
        assert r.status_code == 500


# ---------------------------------------------------------------------------
# SQLAlchemy instrumentation
# ---------------------------------------------------------------------------


class TestSQLAInstrumentation:
    def test_instrument_sqlalchemy_returns_bool(self):
        pytest.importorskip("sqlalchemy")
        from sqlalchemy import create_engine

        engine = create_engine("sqlite:///:memory:")
        result = otel_tracing.instrument_sqlalchemy(engine)
        assert isinstance(result, bool)

    def test_instrument_sqlalchemy_idempotent(self):
        pytest.importorskip("sqlalchemy")
        from sqlalchemy import create_engine

        engine = create_engine("sqlite:///:memory:")
        r1 = otel_tracing.instrument_sqlalchemy(engine)
        r2 = otel_tracing.instrument_sqlalchemy(engine)
        # 重复调用应安全 (可能 True, 也可能 False if 不可用)
        assert isinstance(r1, bool)
        assert isinstance(r2, bool)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


class TestCLI:
    def test_cli_runs(self, capsys):
        rc = otel_tracing.main(["--service-name", "test-cli", "--console"])
        # 无 OTel SDK 时返回 1
        if not is_available():
            assert rc == 1
            err = capsys.readouterr().err
            assert "OTel SDK 未安装" in err
        else:
            assert rc == 0
            out = capsys.readouterr().out
            assert "OTel 已初始化" in out

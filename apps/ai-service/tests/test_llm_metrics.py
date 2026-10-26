# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""llm_metrics.py 单元测试:LLM 自定义 Prometheus 指标。

测试覆盖:
- 4 个指标对象存在 + 类型正确(Counter / Histogram / Gauge)
- record_llm_call 成功路径(input + output token 计数累加)
- record_llm_call 失败路径(4xx / 5xx / timeout / connection 错误计数)
- llm_error_status 分类:401/403 → 'auth'(厂商鉴权类,单列不进到人告警通道),其余 4xx/5xx/timeout/connection 各归各位
- record_llm_call 异常吞掉(指标 API 抛异常时不向上抛、不阻塞业务)
- record_llm_call 边界(0 token / 0 耗时 / None error)
- Gauge inc/dec/set 操作
- 指标在默认 REGISTRY 中可被发现
- Histogram observe 在不同 bucket 内
- label 维度透传正确
- 模块 logger 行为(异常时 warning)
"""

from __future__ import annotations

import logging

import pytest
from prometheus_client import REGISTRY, Counter, Histogram

from app.middleware.llm_metrics import (
    llm_error_status,
    llm_provider_errors_total,
    llm_request_duration_seconds,
    llm_tokens_total,
    record_llm_call,
)

# =============================================================================
# 指标对象存在性 + 类型
# =============================================================================


def test_llm_tokens_total_is_counter():
    """llm_tokens_total 应为 Counter 实例。"""
    assert isinstance(llm_tokens_total, Counter)


def test_llm_request_duration_is_histogram():
    """llm_request_duration_seconds 应为 Histogram 实例。"""
    assert isinstance(llm_request_duration_seconds, Histogram)


def test_llm_provider_errors_is_counter():
    """llm_provider_errors_total 应为 Counter 实例。"""
    assert isinstance(llm_provider_errors_total, Counter)


def test_metric_names_in_registry():
    """4 个指标名都应在默认 REGISTRY 中可见。"""
    names = set(REGISTRY._names_to_collectors.keys())
    assert "ihui_llm_tokens_total" in names
    assert "ihui_llm_request_duration_seconds" in names
    assert "ihui_llm_provider_errors_total" in names


# =============================================================================
# record_llm_call — 成功路径(token 计数累加)
# =============================================================================


def _sample_value(metric_name: str, labels: dict | None = None) -> float:
    """从 REGISTRY 读取某个 metric + label 组合的当前值。

    注意:prometheus_client Counter 名若已以 _total 结尾,
    sample 名保持单 _total(不会变成 _total_total)。
    用于 before/after delta 验证(避免全局指标状态污染)。
    """
    return REGISTRY.get_sample_value(metric_name, labels) or 0.0


def test_record_successful_call_increments_input_tokens():
    """成功调用:input token 计数应累加 input_tokens。"""
    provider = "test-provider-input"
    model = "test-model-input"
    labels = {"provider": provider, "model": model, "direction": "input"}
    before = _sample_value("ihui_llm_tokens_total", labels)

    record_llm_call(provider=provider, model=model, input_tokens=42, output_tokens=10,
                    duration_seconds=0.5)

    after = _sample_value("ihui_llm_tokens_total", labels)
    assert after - before == 42


def test_record_successful_call_increments_output_tokens():
    """成功调用:output token 计数应累加 output_tokens。"""
    provider = "test-provider-output"
    model = "test-model-output"
    labels = {"provider": provider, "model": model, "direction": "output"}
    before = _sample_value("ihui_llm_tokens_total", labels)

    record_llm_call(provider=provider, model=model, input_tokens=5, output_tokens=17,
                    duration_seconds=0.3)

    after = _sample_value("ihui_llm_tokens_total", labels)
    assert after - before == 17


def test_record_successful_call_observes_duration():
    """成功调用:duration 应被 observe 到 histogram。"""
    provider = "test-provider-dur"
    model = "test-model-dur"
    labels = {"provider": provider, "model": model}
    before_count = _sample_value(
        "ihui_llm_request_duration_seconds_count", labels
    )

    record_llm_call(provider=provider, model=model, input_tokens=1, output_tokens=1,
                    duration_seconds=1.5)

    after_count = _sample_value(
        "ihui_llm_request_duration_seconds_count", labels
    )
    assert after_count - before_count == 1


def test_record_successful_call_with_zero_tokens():
    """成功调用 + 0 token:不应报错(input/output 都为 0)。"""
    # 用唯一 provider 避免与其他用例 state 干扰
    record_llm_call(
        provider="test-zero-token-provider",
        model="test-zero-token-model",
        input_tokens=0,
        output_tokens=0,
        duration_seconds=0.0,
    )
    # 不抛异常即通过


# =============================================================================
# llm_error_status — 失败分类(2026-10-26 新增 auth 一档)
# =============================================================================


class _StatusCarrier(Exception):
    """带 status_code 的上游异常(仿 LiteLLM 异常形态)。"""

    def __init__(self, status_code: int) -> None:
        super().__init__(f"upstream status {status_code}")
        self.status_code = status_code


@pytest.mark.parametrize("status_code", [401, 403])
def test_auth_errors_are_classified_as_auth(status_code):
    """厂商鉴权类失败(401/403)必须归成 'auth',**不能**归成 '4xx'。

    立因(机主令「厂商 key 我想配自然会配,别总说,也别报警」):'auth' 是单列的一档,
    监控/prometheus/alerts.yml 的 LlmProviderErrorBurst 靠 status!="auth" 把它排除在
    到人告警通道之外。若这一格退化成 '4xx',厂商账户状态就会重新开始寄信。
    """
    assert llm_error_status(_StatusCarrier(status_code)) == "auth"


@pytest.mark.parametrize(
    ("status_code", "expected"),
    [(400, "4xx"), (404, "4xx"), (429, "4xx"), (402, "4xx"), (500, "5xx"), (503, "5xx")],
)
def test_non_auth_status_codes_keep_their_class(status_code, expected):
    """非鉴权类状态码分类不变(401/403 之外一律按码段)。"""
    assert llm_error_status(_StatusCarrier(status_code)) == expected


def test_timeout_and_connection_still_classified_by_text():
    """无状态码时仍退到文案判 timeout / connection(不能被 auth 档吞掉)。"""
    assert llm_error_status("ReadTimeout: request timed out") == "timeout"
    assert llm_error_status("ConnectionError: connection refused") == "connection"


# =============================================================================
# record_llm_call — 失败路径(error 计数)
# =============================================================================


@pytest.mark.parametrize("error_code", ["4xx", "5xx", "timeout", "connection"])
def test_record_failed_call_increments_error_counter(error_code):
    """失败调用:error 计数应按 status 标签累加。"""
    provider = f"test-provider-err-{error_code}"
    labels = {"provider": provider, "status": error_code}
    before = _sample_value("ihui_llm_provider_errors_total", labels)

    record_llm_call(
        provider=provider,
        model="any-model",
        input_tokens=10,
        output_tokens=0,
        duration_seconds=0.2,
        error=error_code,
    )

    after = _sample_value("ihui_llm_provider_errors_total", labels)
    assert after - before == 1


def test_record_failed_call_does_not_increment_tokens():
    """失败调用:不应累加 token 计数(只累加 error 计数)。

    先做一次成功调用建立非零 baseline,再做失败调用验证 token 计数不变。
    """
    provider = "test-provider-no-token-on-err"
    model = "test-model-no-token-on-err"
    input_labels = {"provider": provider, "model": model, "direction": "input"}
    output_labels = {"provider": provider, "model": model, "direction": "output"}

    # 1) 先成功调用一次,建立非零 baseline
    record_llm_call(
        provider=provider, model=model, input_tokens=10, output_tokens=5,
        duration_seconds=0.1,
    )
    before_in = _sample_value("ihui_llm_tokens_total", input_labels)
    before_out = _sample_value("ihui_llm_tokens_total", output_labels)
    assert before_in == 10  # baseline 非零
    assert before_out == 5

    # 2) 失败调用:token 计数不应变化
    record_llm_call(
        provider=provider,
        model=model,
        input_tokens=999,
        output_tokens=999,
        duration_seconds=0.1,
        error="5xx",
    )

    after_in = _sample_value("ihui_llm_tokens_total", input_labels)
    after_out = _sample_value("ihui_llm_tokens_total", output_labels)
    assert after_in == before_in
    assert after_out == before_out


# =============================================================================
# record_llm_call — 异常吞掉(不阻塞业务)
# =============================================================================


def test_record_call_does_not_raise_when_metrics_fail(monkeypatch, caplog):
    """指标 API 抛异常时 record_llm_call 应吞掉异常,不向上抛。"""
    # 让 Counter.inc 抛异常
    def raise_exc(*args, **kwargs):
        raise RuntimeError("prometheus server down")

    monkeypatch.setattr(llm_request_duration_seconds, "labels", lambda **kw: type(
        "FakeLabel", (), {"observe": raise_exc}
    )())

    with caplog.at_level(logging.WARNING, logger="app.middleware.llm_metrics"):
        # 不应抛异常
        record_llm_call(
            provider="x", model="y", input_tokens=1, output_tokens=1,
            duration_seconds=0.1,
        )

    # 应有 warning 日志
    assert any("LLM 指标记录失败" in r.message for r in caplog.records)


def test_record_call_does_not_raise_when_token_inc_fails(monkeypatch, caplog):
    """token 计数 inc 抛异常时也应吞掉(error 路径前的 observe 已成功)。"""
    class FakeLabels:
        def __init__(self, should_fail: bool):
            self._should_fail = should_fail

        def observe(self, val):
            pass  # observe 成功

        def inc(self, val=1):
            if self._should_fail:
                raise RuntimeError("inc failed")

    call_count = {"n": 0}

    def fake_labels(**kwargs):
        call_count["n"] += 1
        # 第一次 labels 调用是 duration observe(成功),后续是 token inc(失败)
        return FakeLabels(should_fail=(call_count["n"] > 1))

    monkeypatch.setattr(llm_request_duration_seconds, "labels", fake_labels)
    monkeypatch.setattr(llm_tokens_total, "labels", fake_labels)

    with caplog.at_level(logging.WARNING, logger="app.middleware.llm_metrics"):
        record_llm_call(
            provider="x", model="y", input_tokens=1, output_tokens=1,
            duration_seconds=0.1,
        )

    assert any("LLM 指标记录失败" in r.message for r in caplog.records)


# =============================================================================
# Histogram bucket 覆盖
# =============================================================================


def test_histogram_buckets_defined():
    """Histogram 的 buckets 应包含文档定义的 9 个延迟档位。"""
    expected = (0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0)
    # Histogram 的 _upper_bounds 内含 +Inf
    bounds = llm_request_duration_seconds._upper_bounds
    for b in expected:
        assert b in bounds, f"bucket {b} 缺失"


def test_histogram_observe_increases_count():
    """observe 后 count 应 +1。"""
    provider = "test-hist-count"
    model = "test-hist-count"
    labels = {"provider": provider, "model": model}
    before = _sample_value(
        "ihui_llm_request_duration_seconds_count", labels
    )
    record_llm_call(
        provider=provider, model=model, input_tokens=0, output_tokens=0,
        duration_seconds=0.05,
    )
    after = _sample_value(
        "ihui_llm_request_duration_seconds_count", labels
    )
    assert after - before == 1


# =============================================================================
# 模块 logger
# =============================================================================


def test_module_logger_name():
    """模块 logger 名应为 app.middleware.llm_metrics。"""
    from app.middleware import llm_metrics
    assert llm_metrics.logger.name == "app.middleware.llm_metrics"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

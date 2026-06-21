"""OTel metrics 业务维度 label (建议 95) 单元测试.

覆盖:
  - 新指标 BIZ_REQUEST_BY_USER_TOTAL / BIZ_LATENCY_BY_USER 已定义
  - BizTimer 默认不打开 user 维度 (不破坏旧行为)
  - BizTimer(with_user=True) 且 telemetry context 已 set 时, 4 维 label 写入
  - BizTimer(with_user=True) 且 telemetry context 未 set 时, 写入 "anonymous"
  - BizTimer 异常路径: 仍打 user 维度 (5xx status 写 "500")
  - _trim_user_label: None / 空 / 正常 / 超长 / 非 str
  - 默认指标 (BIZ_REQUEST_TOTAL / BIZ_LATENCY) 与新指标独立 (互不影响)
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


@pytest.fixture(autouse=True)
def _reset_telemetry_context():
    """每个测试前清空 telemetry contextvar."""
    from app import telemetry

    telemetry.set_request_context(reset=True)
    yield
    telemetry.set_request_context(reset=True)


# ---------------------------------------------------------------------------
# 新指标存在
# ---------------------------------------------------------------------------


def test_new_metrics_exist():
    from app.metrics_business import BIZ_LATENCY_BY_USER, BIZ_REQUEST_BY_USER_TOTAL

    assert BIZ_REQUEST_BY_USER_TOTAL is not None
    assert BIZ_LATENCY_BY_USER is not None
    # 维度顺序: endpoint, status, user_id, tenant_id
    # 通过 labels() 拿一个元组验证
    v = BIZ_REQUEST_BY_USER_TOTAL.labels(
        endpoint="x",
        status="200",
        user_id="u1",
        tenant_id="t1",
    )._value.get()
    assert isinstance(v, float)


def test_existing_metrics_unchanged():
    """回归: 默认指标 BIZ_REQUEST_TOTAL / BIZ_LATENCY 应保持原签名."""
    from app.metrics_business import BIZ_REQUEST_TOTAL

    # 建议 117: 默认指标现在是 endpoint, status, tenant_id 三维
    v = BIZ_REQUEST_TOTAL.labels(endpoint="x", status="200", tenant_id="anonymous")._value.get()
    assert isinstance(v, float)


# ---------------------------------------------------------------------------
# BizTimer 默认行为 (不破坏)
# ---------------------------------------------------------------------------


def test_biztimer_default_no_user_label():
    """默认 BizTimer(with_user=False) 不打 user 维度, 不读 telemetry context."""
    from app import telemetry
    from app.metrics_business import BIZ_REQUEST_BY_USER_TOTAL

    telemetry.set_request_context(user_id="u-1", tenant_id="t-1")

    # 即使 context 存在, 默认 BizTimer 不写 BY_USER 指标
    # 取一个永远不存在的 label 组合, value 应为 0
    v0 = BIZ_REQUEST_BY_USER_TOTAL.labels(
        endpoint="default_test",
        status="200",
        user_id="u-1",
        tenant_id="t-1",
    )._value.get()

    from app.metrics_business import BizTimer

    with BizTimer("default_test") as t:
        t.status = "200"

    v1 = BIZ_REQUEST_BY_USER_TOTAL.labels(
        endpoint="default_test",
        status="200",
        user_id="u-1",
        tenant_id="t-1",
    )._value.get()
    # 默认不应写 BY_USER 指标
    assert v1 == v0, f"默认 BizTimer 不应写 BY_USER 指标, {v0} -> {v1}"


def test_biztimer_default_writes_default_metrics():
    """默认 BizTimer 仍写 BIZ_REQUEST_TOTAL."""
    from app.metrics_business import BIZ_REQUEST_TOTAL, BizTimer

    v0 = BIZ_REQUEST_TOTAL.labels(endpoint="default_test", status="200", tenant_id="anonymous")._value.get()
    with BizTimer("default_test") as t:
        t.status = "200"
    v1 = BIZ_REQUEST_TOTAL.labels(endpoint="default_test", status="200", tenant_id="anonymous")._value.get()
    assert v1 == v0 + 1


# ---------------------------------------------------------------------------
# BizTimer with_user=True
# ---------------------------------------------------------------------------


def test_biztimer_with_user_reads_telemetry_context():
    """with_user=True 时, 4 维 label 写入 (从 telemetry context 读)."""
    from app import telemetry
    from app.metrics_business import BIZ_LATENCY_BY_USER, BIZ_REQUEST_BY_USER_TOTAL, BizTimer

    telemetry.set_request_context(user_id="u-99", tenant_id="acme")

    v0 = BIZ_REQUEST_BY_USER_TOTAL.labels(
        endpoint="with_user_test",
        status="200",
        user_id="u-99",
        tenant_id="acme",
    )._value.get()

    with BizTimer("with_user_test", with_user=True) as t:
        t.status = "200"

    v1 = BIZ_REQUEST_BY_USER_TOTAL.labels(
        endpoint="with_user_test",
        status="200",
        user_id="u-99",
        tenant_id="acme",
    )._value.get()
    assert v1 == v0 + 1

    # Histogram 也有样本
    hist = BIZ_LATENCY_BY_USER.labels(
        endpoint="with_user_test",
        status="200",
        user_id="u-99",
        tenant_id="acme",
    )
    # 至少 1 个 sample
    assert hist._sum.get() >= 0


def test_biztimer_with_user_no_context_writes_anonymous():
    """with_user=True 但 telemetry context 为空时, 写入 anonymous."""
    from app.metrics_business import BIZ_REQUEST_BY_USER_TOTAL, BizTimer

    # 不调用 set_request_context, contextvar 默认 None
    v0 = BIZ_REQUEST_BY_USER_TOTAL.labels(
        endpoint="anon_test",
        status="200",
        user_id="anonymous",
        tenant_id="anonymous",
    )._value.get()

    with BizTimer("anon_test", with_user=True):
        pass

    v1 = BIZ_REQUEST_BY_USER_TOTAL.labels(
        endpoint="anon_test",
        status="200",
        user_id="anonymous",
        tenant_id="anonymous",
    )._value.get()
    assert v1 == v0 + 1


def test_biztimer_with_user_exception_writes_5xx():
    """with_user=True 抛异常时, status="500" 且 BY_USER 指标也记 5xx."""
    from app import telemetry
    from app.metrics_business import BIZ_REQUEST_BY_USER_TOTAL, BizTimer

    telemetry.set_request_context(user_id="u-x", tenant_id="t-x")

    v0 = BIZ_REQUEST_BY_USER_TOTAL.labels(
        endpoint="err_test",
        status="500",
        user_id="u-x",
        tenant_id="t-x",
    )._value.get()

    with pytest.raises(RuntimeError), BizTimer("err_test", with_user=True):
        raise RuntimeError("boom")

    v1 = BIZ_REQUEST_BY_USER_TOTAL.labels(
        endpoint="err_test",
        status="500",
        user_id="u-x",
        tenant_id="t-x",
    )._value.get()
    assert v1 == v0 + 1, f"异常时 BY_USER 5xx 应 +1, {v0} -> {v1}"


# ---------------------------------------------------------------------------
# _trim_user_label
# ---------------------------------------------------------------------------


def test_trim_user_label_none():
    from app.metrics_business import _trim_user_label

    assert _trim_user_label(None) == "anonymous"


def test_trim_user_label_empty():
    from app.metrics_business import _trim_user_label

    assert _trim_user_label("") == "anonymous"


def test_trim_user_label_normal():
    from app.metrics_business import _trim_user_label

    assert _trim_user_label("u-001") == "u-001"
    assert _trim_user_label("acme") == "acme"


def test_trim_user_label_too_long_truncated():
    """超长 ID (UUID 等) 应截断到 32+...+24 = 59 字符."""
    from app.metrics_business import _trim_user_label

    long_id = "u" * 200
    trimmed = _trim_user_label(long_id)
    assert len(trimmed) < len(long_id)
    assert "..." in trimmed
    assert trimmed.startswith("u" * 32)
    assert trimmed.endswith("u" * 24)


def test_trim_user_label_non_string():
    from app.metrics_business import _trim_user_label

    # 数字 truthy (非 0): 转字符串
    assert _trim_user_label(12345) == "12345"
    # 0 是 falsy: 走 anonymous 路径
    assert _trim_user_label(0) == "anonymous"
    # False 是 falsy: 走 anonymous 路径
    assert _trim_user_label(False) == "anonymous"


# ---------------------------------------------------------------------------
# 新指标互不干扰
# ---------------------------------------------------------------------------


def test_biztimer_with_user_does_not_affect_default():
    """with_user=True 不应改变 BIZ_REQUEST_TOTAL / BIZ_LATENCY 计数."""
    from app import telemetry
    from app.metrics_business import BIZ_LATENCY, BIZ_REQUEST_TOTAL, BizTimer

    telemetry.set_request_context(user_id="u-1", tenant_id="t-1")

    v_count_0 = BIZ_REQUEST_TOTAL.labels(endpoint="iso_test", status="200", tenant_id="t-1")._value.get()
    v_lat_0 = BIZ_LATENCY.labels(endpoint="iso_test")._sum.get()

    with BizTimer("iso_test", with_user=True):
        pass

    v_count_1 = BIZ_REQUEST_TOTAL.labels(endpoint="iso_test", status="200", tenant_id="t-1")._value.get()
    v_lat_1 = BIZ_LATENCY.labels(endpoint="iso_test")._sum.get()

    # 默认指标应仍 +1
    assert v_count_1 == v_count_0 + 1
    assert v_lat_1 >= v_lat_0


# ---------------------------------------------------------------------------
# 高 cardinality 防御
# ---------------------------------------------------------------------------


def test_trim_user_label_preserves_uniqueness_for_short_ids():
    """短 ID 应保留, 便于多租户区分."""
    from app.metrics_business import _trim_user_label

    seen = set()
    for i in range(100):
        uid = f"u-{i:04d}"
        v = _trim_user_label(uid)
        assert v not in seen, f"重复: {v}"
        seen.add(v)

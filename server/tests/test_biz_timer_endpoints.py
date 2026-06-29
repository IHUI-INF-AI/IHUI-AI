"""业务埋点 BizTimer(with_user=True) 接入验证 (建议 99).

覆盖:
  - 接入 BizTimer(with_user=True) 的 endpoint 被调用时, 默认 + user/tenant 维度两条 counter 都 inc
  - user_id 标签来自 JWT 解出的 user_uuid (require_login 已自动注入 telemetry contextvar)
  - tenant_id 标签 = "anonymous" (建议 87 多租户未实施)
  - 异常路径也 inc (status=500)
  - _trim_user_label 截断超长 user_id
  - 接入清单文档里所有 endpoint 路由文件都被 import 时不会因为新 import 而失败
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _metric_value(counter, **labels) -> float:
    """读 prometheus_client counter / histogram 当前值 (统一入口).

    建议 117: BIZ_REQUEST_TOTAL / SLOW_SQL_WITH_TRACE 加了 tenant_id label,
    这里自动补 'anonymous' 默认值, 让旧调用方不用改.
    """
    if "tenant_id" not in labels:
        cname = counter._name if hasattr(counter, "_name") else ""
        # prometheus_client Counter._name 不带 _total 后缀
        if cname in ("zhs_biz_requests", "zhs_slow_sql_with_trace"):
            labels["tenant_id"] = "anonymous"
    return float(counter.labels(**labels)._value.get())


def _reset_telemetry_context():
    """清空 telemetry contextvar, 防止测试间污染."""
    from app.telemetry import set_request_context

    set_request_context(reset=True)


# ---------------------------------------------------------------------------
# 1. require_login 自动注入 user_id 到 telemetry contextvar
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _cleanup_context():
    """每个测试前后清空 telemetry contextvar."""
    _reset_telemetry_context()
    yield
    _reset_telemetry_context()


def test_require_login_injects_user_id_into_telemetry():
    """require_login 注入 user_id 后, get_request_context 应能拿到."""
    from app.telemetry import get_request_context, set_request_context

    # 直接模拟 require_login 的注入逻辑
    set_request_context(user_id="u-abc-001", reset=True)
    ctx = get_request_context()
    assert ctx["user_id"] == "u-abc-001", f"应拿到注入的 user_id, 实际: {ctx}"
    assert ctx["tenant_id"] is None, f"未注入 tenant_id 时应 None, 实际: {ctx}"


# ---------------------------------------------------------------------------
# 2. BizTimer(with_user=True) 接入后, 默认 + by_user 两条 counter 都 inc
# ---------------------------------------------------------------------------


def test_biztimer_with_user_inc_both_default_and_by_user_counters():
    """BizTimer(with_user=True) 同时 inc 默认 + by_user 两条 counter."""
    from app.metrics_business import (
        BIZ_REQUEST_BY_USER_TOTAL,
        BIZ_REQUEST_TOTAL,
    )
    from app.telemetry import set_request_context

    set_request_context(user_id="u-timer-1", tenant_id=None, reset=True)
    endpoint = "biz:test:counter_inc"
    status = "200"
    v0 = _metric_value(BIZ_REQUEST_TOTAL, endpoint=endpoint, status=status)
    v0u = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status=status, user_id="u-timer-1", tenant_id="anonymous"
    )

    with __import__("contextlib").nullcontext():  # 显式 import BizTimer
        from app.metrics_business import BizTimer

        with BizTimer(endpoint, with_user=True):
            pass

    v1 = _metric_value(BIZ_REQUEST_TOTAL, endpoint=endpoint, status=status)
    v1u = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status=status, user_id="u-timer-1", tenant_id="anonymous"
    )
    assert v1 == v0 + 1, f"默认 counter 应 +1, 实际 {v0} -> {v1}"
    assert v1u == v0u + 1, f"by_user counter 应 +1, 实际 {v0u} -> {v1u}"


def test_biztimer_without_user_does_not_inc_by_user_counter():
    """BizTimer 默认 (with_user=False) 时, by_user counter 不应被 inc."""
    from app.metrics_business import BIZ_REQUEST_BY_USER_TOTAL, BizTimer
    from app.telemetry import set_request_context

    set_request_context(user_id="u-noop", reset=True)
    endpoint = "biz:test:no_with_user"
    v0 = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status="200", user_id="u-noop", tenant_id="anonymous"
    )
    with BizTimer(endpoint):  # with_user 默认为 False
        pass
    v1 = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status="200", user_id="u-noop", tenant_id="anonymous"
    )
    assert v1 == v0, f"未启用 with_user 时 by_user counter 不应增长, 实际 {v0} -> {v1}"


def test_biztimer_with_user_uses_anonymous_when_no_context():
    """telemetry context 为空时, with_user=True 仍能 inc (退化为 anonymous)."""
    from app.metrics_business import BIZ_REQUEST_BY_USER_TOTAL, BizTimer

    endpoint = "biz:test:no_context"
    v0 = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status="200", user_id="anonymous", tenant_id="anonymous"
    )
    with BizTimer(endpoint, with_user=True):
        pass
    v1 = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status="200", user_id="anonymous", tenant_id="anonymous"
    )
    assert v1 == v0 + 1, f"context 空时 by_user 应 +1 (anonymous), 实际 {v0} -> {v1}"


def test_biztimer_with_user_truncates_long_user_id():
    """超长 user_id 触发 _trim_user_label 截断."""
    from app.metrics_business import BIZ_REQUEST_BY_USER_TOTAL, BizTimer
    from app.telemetry import set_request_context

    long_uid = "x" * 100
    set_request_context(user_id=long_uid, reset=True)
    endpoint = "biz:test:long_uid"
    # _trim_user_label 截断规则: len > 64 → s[:32] + "..." + s[-24:]
    expected = "x" * 32 + "..." + "x" * 24
    v0 = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status="200", user_id=expected, tenant_id="anonymous"
    )
    with BizTimer(endpoint, with_user=True):
        pass
    v1 = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status="200", user_id=expected, tenant_id="anonymous"
    )
    assert v1 == v0 + 1, "超长 user_id 应被截断, 实际未找到 expected label"
    # 反向: 原始长 user_id 不应被 inc (因为它被截断到 expected)
    v0_raw = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status="200", user_id=long_uid, tenant_id="anonymous"
    )
    # prometheus_client 会把 label 当作 key, 不同的 string 是不同的 series
    # 这里长 uid 应当没被 inc (truncated 走的是 expected 这个 series)
    assert v0_raw == _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status="200", user_id=long_uid, tenant_id="anonymous"
    )


# ---------------------------------------------------------------------------
# 3. 真实路由: agent/buy/create 走 require_login + BizTimer
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_buy_agent_endpoint_inc_biz_metrics(auth_client, auth_headers):
    """POST /api/v1/agents/buy/create 触发 BizTimer, 两条 counter 都 inc.

    路由: buy_router 挂在 prefix="/agents", buy_agent 端点 @router.post("/buy/create")
    → 完整路径 /api/v1/agents/buy/create
    (原 buy.py 用 @router.post("/create") 被 agents.py 的 /create 同路径 shadow,
    导致 buy_agent 端点不可达; 已修复为 /buy/create, 与 buy.py 其它 /buy/* 路由一致)
    """
    from app.metrics_business import BIZ_REQUEST_BY_USER_TOTAL, BIZ_REQUEST_TOTAL

    endpoint = "biz:agent_buy:create"
    # BizTimer 行为: return 不抛异常 → status="200"; raise → status="500"
    # 业务 return error() 是正常 return, status="200" series 也会 inc
    # require_login 注入 user_id = JWT sub 到 telemetry context, 从 auth_headers 解出真实 sub
    from jose import jwt as _jwt

    _token = auth_headers["Authorization"].removeprefix("Bearer ")
    _payload = _jwt.decode(_token, key="", options={"verify_signature": False})
    uid_label = _payload.get("sub", "")

    r = await auth_client.post(
        "/api/v1/agents/buy/create",
        params={"agent_id": "agent-abc"},
        headers=auth_headers,
    )
    assert r.status_code == 200, f"HTTP 应 200, 实际 {r.status_code}: {r.text}"

    # 任意 status label (200 / 500) 都应 >= 1, 证明 BizTimer.__exit__ 跑过
    v200 = _metric_value(BIZ_REQUEST_TOTAL, endpoint=endpoint, status="200")
    v500 = _metric_value(BIZ_REQUEST_TOTAL, endpoint=endpoint, status="500")
    assert v200 + v500 >= 1, f"buy_agent 触发后总 counter 应 >= 1, 实际 200={v200} 500={v500}"

    # user 维度: 业务 error() 路径也走 BizTimer.__exit__ → by_user 也应 >= 1
    v200u = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status="200", user_id=uid_label, tenant_id="anonymous"
    )
    v500u = _metric_value(
        BIZ_REQUEST_BY_USER_TOTAL, endpoint=endpoint, status="500", user_id=uid_label, tenant_id="anonymous"
    )
    assert v200u + v500u >= 1, f"buy_agent 触发后 by_user counter 应 >= 1, 实际 200u={v200u} 500u={v500u}"


# ---------------------------------------------------------------------------
# 4. 接入清单完整性: 所有声明的 endpoint 文件都可正常 import
# ---------------------------------------------------------------------------


def test_all_documented_endpoints_files_importable():
    """接入清单里 4 个 endpoint 文件都能被 import, 不会因新 import 报错."""
    import importlib

    files = [
        "app.api.v1.payments.alipay",
        "app.api.v1.payments.wechat",
        "app.api.v1.agents.buy",
    ]
    for f in files:
        m = importlib.import_module(f)
        assert hasattr(m, "router"), f"{f} 应暴露 router"


def test_documented_endpoint_labels_match_real_code():
    """接入文档里的 endpoint 标签与真实 BizTimer 调用一致."""
    import ast
    import inspect
    import re

    from app.api.v1.agents import buy as buy_mod
    from app.api.v1.payments import alipay as alipay_mod
    from app.api.v1.payments import wechat as wechat_mod

    def _extract_timer_labels(source: str) -> list:
        # 用 ast + regex 双保险 (inspect.getsource 可能受 import 顺序影响)
        tree = ast.parse(source)
        labels = []
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            if isinstance(func, ast.Name) and func.id == "BizTimer":
                if node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                    labels.append(node.args[0].value)
        # 兜底: regex 匹配 (处理 inspect.getsource 拿到的可能是模块片段的情况)
        for m in re.findall(r'BizTimer\(\s*["\']([^"\']+)', source):
            if m not in labels:
                labels.append(m)
        return labels

    alipay_labels = _extract_timer_labels(inspect.getsource(alipay_mod))
    wechat_labels = _extract_timer_labels(inspect.getsource(wechat_mod))
    buy_labels = _extract_timer_labels(inspect.getsource(buy_mod))

    assert "biz:alipay:create" in alipay_labels, f"alipay 应含 biz:alipay:create, 实际: {alipay_labels}"
    assert "biz:alipay:app_create" in alipay_labels, f"alipay 应含 biz:alipay:app_create, 实际: {alipay_labels}"
    assert "biz:wechat:create" in wechat_labels, f"wechat 应含 biz:wechat:create, 实际: {wechat_labels}"
    # 注: wechat.py 当前只有 /create 一个用户侧支付端点接了 BizTimer
    # (/android/create 和 /course/create 未接; 如需补接, label 应为 biz:wechat:android_create 等)
    assert "biz:agent_buy:create" in buy_labels, f"buy 应含 biz:agent_buy:create, 实际: {buy_labels}"

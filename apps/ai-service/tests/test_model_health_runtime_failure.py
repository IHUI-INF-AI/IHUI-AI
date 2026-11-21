# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型可用性分档契约(2026-11-18 立)。

起因(真机):CF Workers AI 免费额度用尽只回一句
"you have used up your daily free allocation of 10,000 neurons …",
旧判据里一条关键词都不命中 ⇒ 被判成"账户级错误" ⇒ 既不隐藏也不标注,
模型一直挂在选择器里,用户点下去必 429。

本测试钉住四件事:
① 额度耗尽类文案一律归"模型级"(一次即隐藏),与既有设计意图一致;
② 运行时失败回写会把该模型打进 down 档并带 reason=quota/auth;
③ 纯限流(429 但账户仍有额度)只记 reason,不动档位(不许一次抖动抹掉好模型);
④ 非模型级失败(网络不可达)不记账,返回空串。
"""

from __future__ import annotations

import pytest

from app.services.model_health import ModelHealthService, ModelProbeState, _classify_error

CF_QUOTA = (
    "AiError: you have used up your daily free allocation of 10,000 neurons, "
    "please upgrade to Cloudflare's Workers Paid plan"
)


def _service() -> ModelHealthService:
    """每次用独立实例:不碰全局单例与落盘文件。"""
    svc = ModelHealthService()
    svc._save_states = lambda: None  # type: ignore[method-assign]
    return svc


def test_cf_free_allocation_counts_as_model_level() -> None:
    account_level, model_level = _classify_error(CF_QUOTA, 429)
    assert model_level is True
    assert account_level is False


def test_plain_rate_limit_stays_account_level() -> None:
    account_level, model_level = _classify_error("rate limit exceeded, retry later", 429)
    assert account_level is True
    assert model_level is False


def test_quota_runtime_failure_marks_down() -> None:
    svc = _service()
    reason = svc.record_runtime_failure("cf/zai-org/glm-4.7-flash", CF_QUOTA, 429)
    assert reason == "quota"
    state = svc.get_state("cf/zai-org/glm-4.7-flash")
    assert state is not None
    assert state.status == "down"
    assert state.reason == "quota"


def test_auth_runtime_failure_marks_down() -> None:
    svc = _service()
    reason = svc.record_runtime_failure("agnes/agnes-3.0-flash", "Invalid API key", 401)
    assert reason == "auth"
    state = svc.get_state("agnes/agnes-3.0-flash")
    assert state is not None
    assert state.status == "down"


def test_rate_limit_runtime_failure_keeps_status() -> None:
    svc = _service()
    reason = svc.record_runtime_failure("x/y", "rate limit exceeded", 429)
    assert reason == "rate_limit"
    state = svc.get_state("x/y")
    assert state is not None
    # 只记原因,不把模型打死
    assert state.status == "pending"


@pytest.mark.parametrize(
    ("message", "status"),
    [("connection reset by peer", 0), ("upstream timeout", 504)],
)
def test_unclassified_failure_is_not_recorded(message: str, status: int) -> None:
    svc = _service()
    assert svc.record_runtime_failure("a/b", message, status) == ""
    assert svc.get_state("a/b") is None


def test_auth_failure_on_proven_model_does_not_kill_it() -> None:
    """2026-11-22 根治:号池 relay 一次 401/403 不许把已实测能出字的模型判死。

    真机:workbuddy/deepseek-v4.1-flash 被路由到一个坏号(403 request illegal),
    运行时记账把模型写成 down+reason=auth,界面显示"密钥失效"并禁用,可同一份
    状态里 stream_ok 又是 true、换条通道就能用。
    """
    svc = _service()
    svc._states["workbuddy/deepseek-v4.1-flash"] = ModelProbeState(
        status="healthy", stream_ok=True, checked_at=0.0
    )
    reason = svc.record_runtime_failure(
        "workbuddy/deepseek-v4.1-flash", "HTTP 403: request illegal", 403
    )
    assert reason == ""
    state = svc.get_state("workbuddy/deepseek-v4.1-flash")
    assert state is not None
    assert state.status == "healthy"
    assert state.reason == ""


def test_auth_failure_on_unproven_model_still_marks_down() -> None:
    svc = _service()
    reason = svc.record_runtime_failure("agnes/agnes-3.0-flash", "Invalid API key", 401)
    assert reason == "auth"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号额度耗尽(欠费/余额不足)跨通道降级测试(批次 59,2026-09-22)。

覆盖三层:
- 判据 llm_metrics.is_quota_exhaustion_error:状态码 + 额度错误码双条件,含误判防护矩阵
- 可用性 model_availability:额度标记写进既有健康状态位,由既有 TTL/ping 探测承载恢复
- 换通道 FallbackRouter.complete_with_fallback:跨厂商改道、同请求不选回同一 provider、
  全通道欠费时的错误透传,以及"非额度错误行为完全不变"的回归

不发真实网络请求,不连数据库(替代通道查询走假 pool / monkeypatch)。
"""

from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator, Callable, Iterator
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from app.core.llm_gateway import (
    FallbackRouter,
    LLMGateway,
    _explicit_provider_code_of,
    _find_quota_alternate_channels,
    _provider_prefix_for_code,
    fallback_router,
)
from app.middleware.llm_metrics import (
    classify_fallback_reason,
    describe_quota_error,
    first_quota_marker,
    is_quota_exhaustion_error,
)
from app.services.free_provider_registry import ProviderStatus, free_provider_registry
from app.services.model_availability import (
    QUOTA_BLOCK_TRUST_S,
    ProviderErrorType,
    ProviderHealth,
    ProviderHealthStatus,
    model_availability,
)

# 2026-09-21 直连 https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions 实测抓回的原始响应体
# (HTTP 400;鉴权是通的,欠费发生在计费侧)。改写这份常量时请保持逐字节真实,别用"看起来像"的文案。
ARREARS_BODY = (
    '{"error":{"message":"Access denied, please make sure your account is in good standing. '
    'For details, see: https://help.aliyun.com/zh/model-studio/error-code#overdue-payment",'
    '"type":"Arrearage","param":null,"code":"Arrearage"},'
    '"id":"chatcmpl-0434ce69-ad58-9649-bf64-79911a8ee816",'
    '"request_id":"0434ce69-ad58-9649-bf64-79911a8ee816"}'
)
# 中转层常只把 message 透出来、丢掉 code/type 字段:此时只能靠文案判,故文案也进白名单。
ARREARS_MESSAGE_ONLY = "Access denied, please make sure your account is in good standing."
INSUFFICIENT_QUOTA_BODY = '{"error":{"code":"insufficient_quota","message":"You exceeded"}}'


class UpstreamError(Exception):
    """模拟 LiteLLM 上游异常:带 status_code 属性,消息体即厂商响应文本。"""

    def __init__(self, status_code: int, body: str) -> None:
        super().__init__(body)
        self.status_code = status_code


ARREARS_400 = UpstreamError(400, ARREARS_BODY)


@pytest.fixture
def clean_health() -> Iterator[dict[str, ProviderHealth]]:
    """隔离 model_availability 的健康缓存(进程内单例),避免跨测试污染。"""
    saved = dict(model_availability._health)
    model_availability._health.clear()
    try:
        yield model_availability._health
    finally:
        model_availability._health.clear()
        model_availability._health.update(saved)


@pytest.fixture
def alt_channel_spy(
    monkeypatch: pytest.MonkeyPatch,
) -> Callable[[list[str]], None]:
    """把"替代通道查询"整体换成假实现(零 DB),测试内决定返回哪些通道。"""
    state: dict[str, list[str]] = {"channels": []}

    async def _fake(model_id: str, exclude_providers: set[str]) -> list[str]:
        return list(state["channels"])

    def _configure(channels: list[str]) -> None:
        state["channels"] = channels

    monkeypatch.setattr("app.core.llm_gateway._find_quota_alternate_channels", _fake)
    return _configure


# =============================================================================
# 判据:状态码 + 额度错误码双条件
# =============================================================================


@pytest.mark.parametrize(
    ("status", "body", "expected"),
    [
        # 额度类:真阳性
        (400, ARREARS_BODY, True),
        (400, '{"code":"InsufficientBalance","message":"账户余额不足"}', True),
        (400, "You have exceeded your balance. 余额不足", True),
        (402, "Payment Required", True),  # 402 状态码本身即账单语义,无需文案
        (429, INSUFFICIENT_QUOTA_BODY, True),
        (429, "Monthly quota exceeded for project", True),
        (400, '{"code":"Arrearage"}\n', True),
        (400, ARREARS_MESSAGE_ONLY, True),  # 经代理只剩文案(无 code 字段):靠 message 片段判
        (403, ARREARS_MESSAGE_ONLY, False),  # 文案命中但状态码不承载额度语义 → 不换厂商
        # 误判防护:参数错 / 上下文超长 / 限流 / 鉴权 / 服务端错误 一律不算额度
        (400, '{"code":"InvalidParameter","message":"Range of input length [1,30000]"}', False),
        (400, "This model's maximum context length is 8192 tokens", False),
        (400, "messages: at least one message is required", False),
        (429, "Rate limit reached for requests", False),
        (401, ARREARS_BODY, False),
        (403, "Model access denied", False),
        (404, "model not found", False),
        (500, ARREARS_BODY, False),  # 状态码不参与 → 文案不单独触发
        (503, "Service is unavailable", False),
        (408, "Request timed out", False),
    ],
)
def test_quota_detection_needs_status_and_code(status: int, body: str, expected: bool) -> None:
    assert is_quota_exhaustion_error(UpstreamError(status, body)) is expected


def test_quota_detection_without_status_code_only_trusts_error_code() -> None:
    """流式 error 事件只剩字符串(无状态码):只信厂商错误码,不信泛化措辞。"""
    assert is_quota_exhaustion_error(f"litellm.BadRequestError: 400 - {ARREARS_BODY}") is True
    assert is_quota_exhaustion_error("litellm.BadRequestError: 400 - 余额不足") is True
    assert is_quota_exhaustion_error("litellm.Timeout: Request timed out.") is False
    assert is_quota_exhaustion_error("Invalid model name") is False
    assert is_quota_exhaustion_error(None) is False


def test_quota_error_cannot_be_mixed_with_rate_limit_wording() -> None:
    """429 同时含限流与额度文案时按额度判(没钱比限流更需要换厂商)。"""
    exc = UpstreamError(429, "Rate limit reached: insufficient_quota")
    assert is_quota_exhaustion_error(exc) is True
    assert classify_fallback_reason(exc) == "quota"


def test_describe_quota_error_exposes_code_only_not_raw_body() -> None:
    """错误透传归因只输出错误码,绝不把原始响应体(可能含 key)带给调用方。"""
    noisy = UpstreamError(400, f'{ARREARS_BODY} api_key=sk-secret-123456')
    assert describe_quota_error(noisy) == "arrearage"
    assert "sk-secret" not in describe_quota_error(noisy)
    assert first_quota_marker(noisy) == "arrearage"
    assert first_quota_marker(UpstreamError(400, "InvalidParameter")) == ""


def test_classify_fallback_reason_labels() -> None:
    assert classify_fallback_reason(ARREARS_400) == "quota"
    assert classify_fallback_reason(UpstreamError(408, "Request timed out")) == "timeout"
    assert classify_fallback_reason(UpstreamError(429, "Rate limit reached")) == "rate_limit"
    assert classify_fallback_reason(UpstreamError(400, "InvalidParameter")) == "unknown"
    assert classify_fallback_reason(None) == "unknown"


# =============================================================================
# provider 级额度标记:写进既有健康状态位,由既有 TTL/ping 探测恢复
# =============================================================================


async def test_mark_quota_exhausted_reuses_existing_health_slot(clean_health: dict[str, ProviderHealth]) -> None:
    await model_availability.mark_provider_quota_exhausted("qwen", "arrearage")
    health = model_availability.get_provider_health("qwen")
    assert health.status == ProviderHealthStatus.DOWN
    assert health.error_type == ProviderErrorType.PAYMENT_REQUIRED
    assert model_availability.is_provider_quota_blocked("qwen") is True


async def test_quota_block_expires_after_trust_window(clean_health: dict[str, ProviderHealth]) -> None:
    """额度是账号状态不是永久属性:超过一个探测周期不再采信。"""
    await model_availability.mark_provider_quota_exhausted("qwen", "arrearage")
    clean_health["qwen"].last_check -= QUOTA_BLOCK_TRUST_S + 1
    assert model_availability.is_provider_quota_blocked("qwen") is False


async def test_next_probe_overwrites_quota_block(clean_health: dict[str, ProviderHealth]) -> None:
    """充值后由既有 5 分钟 ping 循环覆盖状态位 → 自动恢复。"""
    await model_availability.mark_provider_quota_exhausted("qwen", "arrearage")
    clean_health["qwen"] = ProviderHealth(status=ProviderHealthStatus.HEALTHY, last_check=time.time())
    assert model_availability.is_provider_quota_blocked("qwen") is False


async def test_quota_blocked_provider_hidden_from_model_list(
    clean_health: dict[str, ProviderHealth],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        free_provider_registry,
        "is_key_configured",
        lambda _code: ProviderStatus.CONFIGURED,
    )
    assert model_availability.is_model_available("qwen3-max") is True
    await model_availability.mark_provider_quota_exhausted("qwen", "arrearage")
    assert model_availability.is_model_available("qwen3-max") is False


async def test_mark_empty_provider_code_is_noop(clean_health: dict[str, ProviderHealth]) -> None:
    await model_availability.mark_provider_quota_exhausted("", "arrearage")
    assert clean_health == {}


# =============================================================================
# provider_code ↔ 模型 ID 前缀回环
# =============================================================================


def test_provider_code_attribution_is_strict() -> None:
    assert _explicit_provider_code_of("qwen3-max") == "qwen"
    assert _explicit_provider_code_of("openrouter/qwen/qwen3-max") == "openrouter"
    # 未命中前缀表不得兜底成 openai(否则会把整家厂商误标没钱)
    assert _explicit_provider_code_of("totally-unknown-model") == ""


def test_provider_prefix_lookup() -> None:
    assert _provider_prefix_for_code("openrouter") == "openrouter/"
    assert _provider_prefix_for_code("token6688") == "t6688/"
    # "qwen" 只有裸模型名规则,不能当前缀用 → 该厂商的 DB 行走原 ID,不造新前缀
    assert _provider_prefix_for_code("qwen") is None
    assert _provider_prefix_for_code("no_such_provider") is None


# =============================================================================
# 替代通道查询(假 pool,零 DB 副作用)
# =============================================================================


class _FakeRecord(dict[str, str]):
    """asyncpg Record 的最简替身(只需下标访问)。"""


class _FakeConn:
    def __init__(self, rows: list[_FakeRecord]) -> None:
        self.rows = rows
        self.sql = ""
        self.params: tuple[Any, ...] = ()

    async def fetch(self, sql: str, *params: Any) -> list[_FakeRecord]:
        self.sql = sql
        self.params = params
        return self.rows


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    def acquire(self) -> AsyncIterator[_FakeConn]:
        @asynccontextmanager
        async def _ctx() -> AsyncIterator[_FakeConn]:
            yield self._conn

        return _ctx()  # type: ignore[return-value]


async def test_find_quota_alternate_channels_builds_cross_provider_ids(
    clean_health: dict[str, ProviderHealth],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conn = _FakeConn([
        _FakeRecord(provider_code="openrouter", model_id="qwen/qwen3-max"),
        _FakeRecord(provider_code="token6688", model_id="qwen3-max"),
        _FakeRecord(provider_code="token6688", model_id="qwen3-max"),  # 重复行去重
        _FakeRecord(provider_code="qwen", model_id="qwen3-max"),       # 欠费那家本身
        _FakeRecord(provider_code="ollama", model_id="qwen3-max"),      # 本地 LLM 不改道
        _FakeRecord(provider_code="no_such_provider", model_id="qwen3-max"),  # 无前缀 → 丢弃
        _FakeRecord(provider_code="groq", model_id="qwen3-max"),       # 已被标记没钱
    ])
    monkeypatch.setattr(
        "app.core.llm_gateway._get_pool", AsyncMock(return_value=_FakePool(conn))
    )
    await model_availability.mark_provider_quota_exhausted("groq", "arrearage")

    channels = await _find_quota_alternate_channels(
        "qwen3-max", {"qwen"}
    )
    assert channels == ["openrouter/qwen/qwen3-max", "t6688/qwen3-max"]
    assert "ai_model_config_models" in conn.sql
    assert conn.params == ("qwen3-max",)


async def test_find_quota_alternate_channels_strips_gateway_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """openrouter/qwen/qwen3-max 这类带厂商路径的 ID,查询键取末段模型名。"""
    conn = _FakeConn([])
    monkeypatch.setattr(
        "app.core.llm_gateway._get_pool", AsyncMock(return_value=_FakePool(conn))
    )
    assert await _find_quota_alternate_channels("openrouter/qwen/qwen3-max", set()) == []
    assert conn.params == ("qwen/qwen3-max",)


async def test_find_quota_alternate_channels_swallows_db_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DB 不可用时返回空(等同未启用该特性),不让兜底路径抛异常。"""
    monkeypatch.setattr(
        "app.core.llm_gateway._get_pool", AsyncMock(side_effect=RuntimeError("no pool"))
    )
    assert await _find_quota_alternate_channels("qwen3-max", set()) == []


# =============================================================================
# 换通道:接进既有 FallbackRouter 链路
# =============================================================================


async def test_quota_error_fails_over_to_other_provider_channel(
    clean_health: dict[str, ProviderHealth],
    alt_channel_spy: Callable[[list[str]], None],
) -> None:
    alt_channel_spy(["openrouter/qwen/qwen3-max"])
    router = FallbackRouter()
    ok = {"content": "from openrouter", "model": "openrouter/qwen/qwen3-max", "usage": {}, "stub": False}

    with patch(
        "app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock, return_value=ok
    ) as mock_complete:
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}], "qwen3-max", primary_error=ARREARS_400
        )

    assert result["content"] == "from openrouter"
    assert mock_complete.call_args.kwargs["model"] == "openrouter/qwen/qwen3-max"
    assert mock_complete.call_args.kwargs["_skip_fallback"] is True  # 防递归契约不变
    assert mock_complete.call_args.kwargs["num_retries"] == 0       # 不放大重试
    assert model_availability.is_provider_quota_blocked("qwen") is True


async def test_quota_failover_never_picks_back_the_same_provider(
    clean_health: dict[str, ProviderHealth],
    alt_channel_spy: Callable[[list[str]], None],
) -> None:
    """同请求内 qwen 系其他通道(qwen-plus / qwen-turbo)都不得再撞一次欠费。"""
    alt_channel_spy(["qwen-turbo", "openrouter/qwen/qwen3-max"])
    router = FallbackRouter()
    router.configure("qwen3-max", {"fallbacks": ["qwen-plus"]})
    ok = {"content": "ok", "model": "openrouter/qwen/qwen3-max", "usage": {}, "stub": False}

    with patch(
        "app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock, return_value=ok
    ) as mock_complete:
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}], "qwen3-max", primary_error=ARREARS_400
        )

    assert result["content"] == "ok"
    assert mock_complete.call_count == 1
    assert mock_complete.call_args.kwargs["model"] == "openrouter/qwen/qwen3-max"


async def test_quota_failover_continues_past_non_quota_candidate(
    clean_health: dict[str, ProviderHealth],
    alt_channel_spy: Callable[[list[str]], None],
) -> None:
    """替代通道因别的原因失败(503)时继续往下走,且不误标该厂商没钱。"""
    alt_channel_spy(["openrouter/qwen/qwen3-max", "agnes/qwen3-max"])
    router = FallbackRouter()
    unavailable = {"content": "", "error": True, "error_message": "503 upstream unavailable"}
    ok = {"content": "from agnes", "model": "agnes/qwen3-max", "usage": {}, "stub": False}

    with patch(
        "app.core.llm_gateway.llm_gateway.complete",
        new_callable=AsyncMock,
        side_effect=[unavailable, ok],
    ) as mock_complete:
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}], "qwen3-max", primary_error=ARREARS_400
        )

    assert result["content"] == "from agnes"
    assert mock_complete.call_count == 2
    assert model_availability.is_provider_quota_blocked("openrouter") is False


async def test_all_channels_in_debt_reports_who_and_why(
    clean_health: dict[str, ProviderHealth],
    alt_channel_spy: Callable[[list[str]], None],
) -> None:
    alt_channel_spy(["openrouter/qwen/qwen3-max"])
    router = FallbackRouter()
    openrouter_arrears = {
        "content": "",
        "error": True,
        "error_message": f"400 - {INSUFFICIENT_QUOTA_BODY}",
    }

    with patch(
        "app.core.llm_gateway.llm_gateway.complete",
        new_callable=AsyncMock,
        return_value=openrouter_arrears,
    ):
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}], "qwen3-max", primary_error=ARREARS_400
        )

    assert result.get("error") and result.get("quota_exhausted") is True
    detail = str(result["error"])
    assert "qwen3-max[qwen]=arrearage" in detail
    assert "openrouter/qwen/qwen3-max[openrouter]=insufficient_quota" in detail
    # 第二家也被标记,后续请求不再白撞
    assert model_availability.is_provider_quota_blocked("openrouter") is True


async def test_non_quota_error_keeps_legacy_fallback_behavior(
    clean_health: dict[str, ProviderHealth],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """回归:参数错/超时等既不改道查替代通道,也不标记 provider,错误文案不变。"""
    calls = 0

    async def _boom(model_id: str, exclude_providers: set[str]) -> list[str]:
        nonlocal calls
        calls += 1
        return []

    monkeypatch.setattr("app.core.llm_gateway._find_quota_alternate_channels", _boom)
    router = FallbackRouter()
    router.configure("stepfun/step-3.7-flash", {"fallbacks": ["stepfun/step-router-v1"]})
    fail = {"content": "", "error": True, "error_message": "400 InvalidParameter: range of input length"}

    with patch("app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock, return_value=fail):
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}],
            "stepfun/step-3.7-flash",
            primary_error=UpstreamError(400, "InvalidParameter: range of input length"),
        )

    assert calls == 0
    assert result["error"].startswith("all fallbacks failed:")
    assert model_availability.is_provider_quota_blocked("stepfun") is False


async def test_oversized_prompt_short_circuits_before_quota_marking(
    clean_health: dict[str, ProviderHealth],
    alt_channel_spy: Callable[[list[str]], None],
) -> None:
    alt_channel_spy(["openrouter/qwen/qwen3-max"])
    router = FallbackRouter()
    with patch("app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock) as mock_complete:
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "x" * 130_001}],
            "qwen3-max",
            primary_error=ARREARS_400,
        )

    assert "prompt too large" in str(result["error"])
    mock_complete.assert_not_called()
    assert model_availability.is_provider_quota_blocked("qwen") is False


# =============================================================================
# complete() 端到端接线:证明额度类错误走的就是既有那条换通道链路
# =============================================================================


def _install_fake_litellm(
    monkeypatch: pytest.MonkeyPatch,
    *,
    arrears_keys: set[str],
    content: str,
    counter: list[int],
    server_error_keys: set[str] | None = None,
) -> None:
    """把 litellm 换成假模块:按 api_key 分派额度错误 / 5xx / 成功。"""
    import sys
    from types import ModuleType

    fake = ModuleType("litellm")
    server_errors = server_error_keys or set()

    async def fake_acompletion(**kwargs: Any) -> Any:
        counter.append(1)
        key = str(kwargs.get("api_key"))
        if key in arrears_keys:
            raise UpstreamError(400, ARREARS_BODY)
        if key in server_errors:
            raise UpstreamError(503, '{"code":"ServiceUnavailable"}')

        class _Usage:
            def model_dump(self) -> dict[str, int]:
                return {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8}

        class _Msg:
            content = "ok"

        class _Choice:
            message = _Msg()

        class _Resp:
            usage = _Usage()
            choices = [_Choice()]
            model = "qwen3-max"

        resp = _Resp()
        resp.choices[0].message.content = content  # type: ignore[attr-defined]
        return resp

    fake.acompletion = fake_acompletion  # type: ignore[attr-defined]
    fake.token_counter = lambda **kw: 10  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "litellm", fake)


async def test_complete_routes_around_arrears_without_static_fallback_config(
    clean_health: dict[str, ProviderHealth],
    monkeypatch: pytest.MonkeyPatch,
    alt_channel_spy: Callable[[list[str]], None],
) -> None:
    """未配任何静态 fallbacks 的 qwen 模型欠费时也要自动换厂商。

    这是本功能的原始故障:用户选中 qwen 系模型直接报错,不会自动换通道。
    """
    from app.core.config import settings

    # 测试环境 _resolve_from_db 被 conftest 全局 mock(无 DB),裸 qwen 模型 ID 由 _resolve_provider
    # 的 qwen 分支取 qwen 位上的 key(2026-09-21 之前缺该分支,落到 openai 默认位 → 列表里选得到、
    # 一调用即 LiteLLM "Provider NOT provided")。key 值只是假 litellm 的判别符,
    # 厂商归因走 _explicit_provider_code_of("qwen3-max") == "qwen"。
    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "qwen": {"api_key": "sk-qwen-indebt"},
        "openrouter": {"api_key": "sk-or-ok", "api_base": "https://openrouter.ai/api/v1"},
    }))
    alt_channel_spy(["openrouter/qwen/qwen3-max"])
    counter: list[int] = []
    _install_fake_litellm(
        monkeypatch, arrears_keys={"sk-qwen-indebt"}, content="via openrouter", counter=counter
    )

    saved = dict(fallback_router._configs)
    fallback_router._configs.clear()
    try:
        result = await LLMGateway().complete(
            [{"role": "user", "content": "hi"}], model="qwen3-max"
        )
    finally:
        fallback_router._configs.clear()
        fallback_router._configs.update(saved)

    assert result.get("error") is None or not result.get("error")
    assert result["content"] == "via openrouter"
    assert result.get("fallback_used") is True
    assert result["fallback_primary"] == "qwen3-max"
    assert len(counter) == 2  # qwen 撞欠费 + openrouter 成功
    assert model_availability.is_provider_quota_blocked("qwen") is True


async def test_complete_reports_every_indebt_provider_to_caller(
    clean_health: dict[str, ProviderHealth],
    monkeypatch: pytest.MonkeyPatch,
    alt_channel_spy: Callable[[list[str]], None],
) -> None:
    """全通道都因额度失败:错误消息要点名厂商与错误码,而不是只吐一个笼统失败。

    第三条通道故意返 503(非额度),验证归因不会把所有失败一锅端成"没钱"。
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "llm_providers", json.dumps({
        "qwen": {"api_key": "sk-qwen-indebt"},
        "openrouter": {"api_key": "sk-or-indebt", "api_base": "https://openrouter.ai/api/v1"},
        "stepfun": {
            "api_key": "sk-step-unavailable",
            "api_base": "https://api.stepfun.com/step_plan/v1",
        },
    }))
    alt_channel_spy(["openrouter/qwen/qwen3-max", "stepfun/step-3.7-flash"])
    counter: list[int] = []
    _install_fake_litellm(
        monkeypatch,
        arrears_keys={"sk-qwen-indebt", "sk-or-indebt"},
        server_error_keys={"sk-step-unavailable"},
        content="unreachable",
        counter=counter,
    )

    saved = dict(fallback_router._configs)
    fallback_router._configs.clear()
    try:
        result = await LLMGateway().complete(
            [{"role": "user", "content": "hi"}], model="qwen3-max"
        )
    finally:
        fallback_router._configs.clear()
        fallback_router._configs.update(saved)

    assert result.get("error") is True
    assert result["errorCode"] == "LLM_ERROR"
    msg = str(result["error_message"])
    assert "arrearage" in msg
    assert "openrouter" in msg
    assert len(counter) == 3
    # 非额度失败的通道照实列出,但不被归因成额度、也不被标"没钱"
    assert "stepfun/step-3.7-flash[stepfun]=" in msg
    assert msg.count("arrearage") == 2
    assert model_availability.is_provider_quota_blocked("stepfun") is False
    assert model_availability.is_provider_quota_blocked("openrouter") is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
"""厂商归属实证 + 额度耗尽同族等效降级 + 结构化错误码测试(批次 60,2026-09-22)。

三层各自要守住的事实:
- 任务 A:归属判定是"显式厂商路径 > ai_model_config 实证 > 名字前缀兜底"。
  裸前缀猜厂商会把 mimo-v2.5-free(库里属 opencode_zen)打到小米公网端点;
  反过来,用户点名 openrouter/ ihui/ 时也绝不允许被 DB 猜走。
  DB 是热路径依赖:必须带 TTL 缓存、必须查不到就退回前缀、绝不让调用链整体炸掉。
- 任务 B:同名通道用尽后才退到同族等效,顺序严格;换到不同模型必须在既有
  fallback 事件 reason / complete 结果的 fallback_reason 上看得见(不静默替换)。
- 任务 C:只有"确因额度且改道已穷尽"才回 PROVIDER_QUOTA_EXHAUSTED,
  普通 LLM 错误不得被吞成这个码,message 仍保留 `模型[厂商]=错误码` 点名归因。

不发真实网络请求,不连数据库(归属/同族查询一律走假 pool 或 monkeypatch)。
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator, Callable, Iterator
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from app.core.llm_gateway import (
    FALLBACK_REASON_QUOTA_EQUIVALENT,
    PROVIDER_QUOTA_EXHAUSTED,
    FallbackRouter,
    LLMGateway,
    _db_provider_code_for_model,
    _declared_provider_code_of,
    _explicit_provider_code_of,
    _family_stem,
    _find_quota_equivalent_channels,
    _generation_rank,
    _provider_ownership_cache,
    _query_provider_ownership,
    _resolve_from_db,
    _resolve_provider_code,
    fallback_router,
)
from app.services.model_availability import (
    ProviderHealth,
    ProviderHealthStatus,
    model_availability,
)
from app.services.model_catalog import ModelCategory, ModelClassification, ModelTier

# 真实抓回的 DashScope 欠费响应体(与批次 59 同源,改写请保持逐字节真实)
ARREARS_BODY = (
    '{"error":{"message":"Access denied, please make sure your account is in good standing. '
    'For details, see: https://help.aliyun.com/zh/model-studio/error-code#overdue-payment",'
    '"type":"Arrearage","param":null,"code":"Arrearage"}}'
)
INVALID_PARAM_BODY = '{"error":{"code":"InvalidParameter","message":"Range of input length [1,30000]"}}'


class UpstreamError(Exception):
    """模拟 LiteLLM 上游异常:带 status_code 属性,消息体即厂商响应文本。"""

    def __init__(self, status_code: int, body: str) -> None:
        super().__init__(body)
        self.status_code = status_code


ARREARS_400 = UpstreamError(400, ARREARS_BODY)
BAD_PARAM_400 = UpstreamError(400, INVALID_PARAM_BODY)


@pytest.fixture(autouse=True)
def clean_ownership_cache() -> Iterator[dict[str, tuple[str, float]]]:
    """归属缓存是进程内的,用例之间必须互不可见(否则上一个用例的缓存会让本用例不打 DB)。"""
    saved = dict(_provider_ownership_cache)
    _provider_ownership_cache.clear()
    try:
        yield _provider_ownership_cache
    finally:
        _provider_ownership_cache.clear()
        _provider_ownership_cache.update(saved)


@pytest.fixture
def clean_health() -> Iterator[dict[str, ProviderHealth]]:
    """隔离 model_availability 的健康缓存(进程内单例)。"""
    saved = dict(model_availability._health)
    model_availability._health.clear()
    try:
        yield model_availability._health
    finally:
        model_availability._health.clear()
        model_availability._health.update(saved)


# =============================================================================
# 假 pool:按 SQL 关键字分派,并记录每次调用(便于断言"打了几次 DB")
# =============================================================================


class _Rec(dict[str, Any]):
    """asyncpg Record 的最简替身(只需下标访问)。"""


class _FakeConn:
    def __init__(self, routes: dict[str, Any]) -> None:
        self._routes = routes
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    def _pick(self, sql: str) -> Any:
        for marker, value in self._routes.items():
            if marker in sql:
                return value() if callable(value) else value
        raise AssertionError(f"未预期的 SQL: {sql[:100]}")

    async def fetch(self, sql: str, *params: Any) -> list[_Rec]:
        self.calls.append((sql, params))
        return list(self._pick(sql))

    async def fetchrow(self, sql: str, *params: Any) -> _Rec | None:
        self.calls.append((sql, params))
        return self._pick(sql)

    @property
    def query_count(self) -> int:
        return len(self.calls)

    def sql_at(self, index: int) -> str:
        return self.calls[index][0]

    def params_at(self, index: int) -> tuple[Any, ...]:
        return self.calls[index][1]


@pytest.fixture
def fake_pool(monkeypatch: pytest.MonkeyPatch) -> Callable[[dict[str, Any]], _FakeConn]:
    """把 llm_gateway 的 DB 入口换成假连接,返回该连接以便断言 SQL/参数/次数。"""
    holder: dict[str, _FakeConn] = {}

    def _install(routes: dict[str, Any]) -> _FakeConn:
        conn = _FakeConn(routes)
        holder["conn"] = conn

        async def _get_pool() -> Any:
            return _FakePool(holder["conn"])

        monkeypatch.setattr("app.core.llm_gateway._get_pool", _get_pool)
        return conn

    return _install


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self._conn = conn

    def acquire(self) -> Any:
        @asynccontextmanager
        async def _ctx() -> AsyncIterator[_FakeConn]:
            yield self._conn

        return _ctx()


@pytest.fixture
def broken_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """DB 完全不可用(连接池都拿不到)。"""

    async def _boom() -> Any:
        raise RuntimeError("connection refused")

    monkeypatch.setattr("app.core.llm_gateway._get_pool", _boom)


# =============================================================================
# 任务 A-1:只有含斜杠的厂商路径才算"用户显式指定"
# =============================================================================


def test_declared_provider_code_only_accepts_vendor_path_prefixes() -> None:
    assert _declared_provider_code_of("openrouter/qwen/qwen3-max") == "openrouter"
    assert _declared_provider_code_of("groq/llama-3.3-70b-versatile") == "groq"
    assert _declared_provider_code_of("ihui/MiniMax-M2.7") == "ihui_relay"
    assert _declared_provider_code_of("byok/deepseek-v3") == "byok"
    assert _declared_provider_code_of("t6688/gm-3.8-flash") == "token6688"


def test_bare_name_rules_are_guesses_not_declarations() -> None:
    # 这些正是本批次被 DB 抢过判定权的裸名
    assert _declared_provider_code_of("mimo-v2.5-free") == ""
    assert _declared_provider_code_of("qwen3-max") == ""
    assert _declared_provider_code_of("glm-4-plus") == ""
    assert _declared_provider_code_of("") == ""


# =============================================================================
# 任务 A-2:三级优先级
# =============================================================================


async def test_db_evidence_overrides_bare_prefix_guess(monkeypatch: pytest.MonkeyPatch) -> None:
    """mimo-v2.5-free 库里属 opencode_zen:归属必须以 DB 为准,前缀只是兜底。"""
    seen: list[str] = []

    async def _db(model: str) -> str:
        seen.append(model)
        return "opencode_zen"

    monkeypatch.setattr("app.core.llm_gateway._db_provider_code_for_model", _db)
    assert await _resolve_provider_code("mimo-v2.5-free") == "opencode_zen"
    assert seen == ["mimo-v2.5-free"]


async def test_explicit_vendor_path_short_circuits_db(monkeypatch: pytest.MonkeyPatch) -> None:
    """用户点名 openrouter/ 时不得再问 DB(否则显式指定会被 DB 猜走)。"""
    seen: list[str] = []

    async def _db(model: str) -> str:
        seen.append(model)
        return "stepfun"

    monkeypatch.setattr("app.core.llm_gateway._db_provider_code_for_model", _db)
    assert await _resolve_provider_code("openrouter/qwen/qwen3-max") == "openrouter"
    assert await _resolve_provider_code("ihui/MiniMax-M2.7") == "ihui_relay"
    assert seen == []


async def test_prefix_guess_is_the_last_resort(monkeypatch: pytest.MonkeyPatch) -> None:
    """DB 查不到时逐字节退回改动前的前缀行为;仍归不出来时不得兜底成 openai。"""

    async def _db(_model: str) -> str:
        return ""

    monkeypatch.setattr("app.core.llm_gateway._db_provider_code_for_model", _db)
    assert await _resolve_provider_code("qwen3-max") == "qwen"
    assert await _resolve_provider_code("totally-unknown-model") == ""
    # 与 _model_to_provider_code 的分工保持不变(那层才兜底 openai)
    assert _explicit_provider_code_of("totally-unknown-model") == ""


# =============================================================================
# 任务 A-3:归属查询本身(排序 / 参数 / 降级 / 缓存)
# =============================================================================


async def test_ownership_query_matches_full_and_bare_id_in_one_roundtrip(
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
) -> None:
    conn = fake_pool({"ANY($1::text[])": [_Rec(provider_code="opencode_zen", model_id="mimo-v2.5-free")]})
    assert await _query_provider_ownership("mimo-v2.5-free") == "opencode_zen"
    assert conn.query_count == 1
    # 裸名只有一种形态;带厂商路径的 ID 要连末段一起给,才能命中库里存的路径形态
    assert conn.params_at(0) == (["mimo-v2.5-free"],)
    assert "ai_model_config_models" in conn.sql_at(0)
    assert "JOIN ai_model_config" in conn.sql_at(0)
    assert "c.owner_uuid IS NULL" in conn.sql_at(0)


async def test_ownership_prefers_exact_full_id_over_tail_match(
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
) -> None:
    """'qwen/qwen3-max' 同时命中整串(openrouter)与末段(t6688):整串说了算。"""
    conn = fake_pool({"ANY($1::text[])": [
        _Rec(provider_code="token6688", model_id="qwen3-max"),   # SQL 序在前
        _Rec(provider_code="openrouter", model_id="qwen/qwen3-max"),
    ]})
    assert await _query_provider_ownership("qwen/qwen3-max") == "openrouter"
    assert conn.params_at(0) == (["qwen/qwen3-max", "qwen3-max"],)


async def test_ownership_demotes_unavailable_provider_but_still_returns_it(
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
) -> None:
    """可用性只用于同序裁决:全部不可用时仍给排序第一,归属不随 ping 结果漂移。"""
    fake_pool({"ANY($1::text[])": [
        _Rec(provider_code="groq", model_id="qwen3-max"),
        _Rec(provider_code="openrouter", model_id="qwen3-max"),
    ]})
    clean_health["groq"] = ProviderHealth(status=ProviderHealthStatus.DOWN)
    assert await _query_provider_ownership("qwen3-max") == "openrouter"

    clean_health["openrouter"] = ProviderHealth(status=ProviderHealthStatus.DOWN)
    assert await _query_provider_ownership("qwen3-max") == "groq"


async def test_ownership_query_swallows_db_failure(broken_db: None) -> None:
    """DB 挂了不能把调用链带崩:归属退空,上层自动退回前缀行为。"""
    assert await _query_provider_ownership("mimo-v2.5-free") == ""
    assert await _resolve_provider_code("mimo-v2.5-free") == "mimo"


async def test_ownership_lookup_hits_db_once_per_ttl_window(
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
) -> None:
    """热路径:同一 ID(含大小写变体)在 TTL 内只打一次 DB。"""
    conn = fake_pool({"ANY($1::text[])": [_Rec(provider_code="opencode_zen", model_id="mimo-v2.5-free")]})
    assert await _db_provider_code_for_model("mimo-v2.5-free") == "opencode_zen"
    assert await _db_provider_code_for_model("MiMo-V2.5-Free") == "opencode_zen"
    assert conn.query_count == 1

    _provider_ownership_cache["mimo-v2.5-free"] = ("opencode_zen", time.time() - 1)
    assert await _db_provider_code_for_model("mimo-v2.5-free") == "opencode_zen"
    assert conn.query_count == 2


async def test_ownership_miss_is_cached_too(
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
) -> None:
    """查不到也要缓存,否则每个未入库的模型 ID 都会次次打 DB。"""
    conn = fake_pool({"ANY($1::text[])": []})
    assert await _db_provider_code_for_model("brand-new-model") == ""
    assert await _db_provider_code_for_model("brand-new-model") == ""
    assert conn.query_count == 1


async def test_ownership_skips_empty_model_id(fake_pool: Callable[[dict[str, Any]], _FakeConn]) -> None:
    conn = fake_pool({"ANY($1::text[])": []})
    assert await _db_provider_code_for_model("   ") == ""
    assert conn.query_count == 0


# =============================================================================
# 任务 A-4:_resolve_from_db 真的按 DB 归属取配置(原故障落点)
# =============================================================================


async def test_resolve_from_db_uses_db_ownership_for_base_url(
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
) -> None:
    """mimo-v2.5-free 必须拿 opencode_zen 那行的 base_url,而不是小米公网端点。"""
    conn = fake_pool({
        "ANY($1::text[])": [_Rec(provider_code="opencode_zen", model_id="mimo-v2.5-free")],
        "api_key_enc": _Rec(
            api_key_enc="sk-opencode",
            base_url="https://opencode.ai/zen/v1",
            api_format="openai_chat",
        ),
    })
    api_key, api_base, litellm_model = await _resolve_from_db("mimo-v2.5-free")
    assert (api_key, api_base, litellm_model) == (
        "sk-opencode",
        "https://opencode.ai/zen/v1",
        "openai/mimo-v2.5-free",
    )
    # 第二次查询(取配置行)用的是 DB 实证出来的 provider_code,不是前缀猜的 mimo
    assert conn.params_at(1) == ("opencode_zen",)


async def test_resolve_from_db_backfills_openrouter_path_for_db_attributed_model(
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
) -> None:
    """归属由 DB 判出时,模型串可能只是库里的路径形态,必须补 openrouter/ 才认得。"""
    fake_pool({
        "ANY($1::text[])": [_Rec(provider_code="openrouter", model_id="qwen/qwen3-max")],
        "api_key_enc": _Rec(
            api_key_enc="sk-or", base_url="https://openrouter.ai/api/v1", api_format="openai_chat"
        ),
    })
    _, _, litellm_model = await _resolve_from_db("qwen/qwen3-max")
    assert litellm_model == "openrouter/qwen/qwen3-max"


async def test_resolve_from_db_degrades_to_prefix_when_db_down(
    broken_db: None,
) -> None:
    """DB 不可用时归属退回前缀,行为与改动前一致(整条链路不得抛)。"""
    assert await _resolve_from_db("mimo-v2.5-free") is None


# =============================================================================
# 任务 B-1:家族词干与代次接近度
# =============================================================================


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("qwen-plus", "qwen"),           # family 退化成整名时取词干,否则等效降级等于没做
        ("qwen-turbo", "qwen"),
        ("qwen3-max", "qwen"),
        ("qwen3.5-397b-a17b", "qwen"),
        ("mimo-v2.5-free", "mimo"),
        ("deepseek-v4-pro", "deepseek"),
        ("glm-4-plus", "glm"),
        ("step-3.7-flash", "step"),
        ("yi-large", ""),                # 词干过短,LIKE 会命中一大片 → 不换
        ("o3-mini", ""),
        ("", ""),
    ],
)
def test_family_stem(name: str, expected: str) -> None:
    assert _family_stem(name) == expected


@pytest.mark.parametrize(
    ("origin", "candidate", "expected"),
    [("3", "3", 0), ("3", "3.5", 0), ("3", None, 1), (None, "3", 1), ("3", "2", 2)],
)
def test_generation_rank(origin: str | None, candidate: str | None, expected: int) -> None:
    assert _generation_rank(origin, candidate) == expected


# =============================================================================
# 任务 B-2:同族等效候选的筛选与排序
# (classify_model 换成表驱动假实现:排序规则不得随 model_catalog 数据演进漂移)
# =============================================================================


def _install_catalog(
    monkeypatch: pytest.MonkeyPatch,
    table: dict[str, tuple[str, str | None, str]],
) -> None:
    def _classify(model_id: str, *_a: Any, **_kw: Any) -> ModelClassification:
        family, generation, tier = table.get(model_id.lower(), ("unknown", None, "standard"))
        return ModelClassification(
            category=ModelCategory.CHAT,
            tier=ModelTier(tier),
            family=family,
            generation=generation,
            reason="test",
        )

    monkeypatch.setattr("app.services.model_catalog.classify_model", _classify)


@pytest.fixture
def always_available(monkeypatch: pytest.MonkeyPatch) -> Iterator[set[str]]:
    """默认放行"模型当前可用"判定(该项自有用例单独验),并记录被问到的候选。"""
    asked: set[str] = set()

    def _fake(model_id: str) -> bool:
        asked.add(model_id)
        return True

    monkeypatch.setattr(model_availability, "is_model_available", _fake)
    yield asked


async def test_equivalent_channels_filter_out_same_name_other_family_and_unaddressable(
    monkeypatch: pytest.MonkeyPatch,
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
    always_available: set[str],
) -> None:
    _install_catalog(monkeypatch, {
        "qwen3-max": ("qwen", "3", "standard"),
        "qwen3-coder": ("qwen", "3", "standard"),
        "qwen3-mini": ("qwen", "3", "standard"),
        "llama-3.3-70b": ("llama", "3", "standard"),
    })
    conn = fake_pool({"ILIKE": [
        _Rec(provider_code="openrouter", model_id="qwen/qwen3-max"),    # 同名 → 属第一档
        _Rec(provider_code="groq", model_id="llama-3.3-70b"),           # 不同族
        _Rec(provider_code="qwen", model_id="qwen3-coder"),             # 无斜杠前缀 → 拼不出通道
        _Rec(provider_code="ollama", model_id="qwen3-mini"),            # 本地 LLM 不改道
        _Rec(provider_code="token6688", model_id="qwen3-coder"),        # ✅
        _Rec(provider_code="opencode_zen", model_id="qwen3-mini"),      # ✅
    ]})
    channels = await _find_quota_equivalent_channels("qwen3-max", set())
    # 顺序按免费优先排(opencode_zen 是 zero_cost,t6688 需 key 且无免费层)
    assert channels == ["opencode/qwen3-mini", "t6688/qwen3-coder"]
    # 粗筛参数是家族词干(不是整名),精筛由 _family_stem 逐行判定
    assert conn.params_at(0) == ("qwen",)
    assert "ILIKE" in conn.sql_at(0)


async def test_equivalent_channels_skip_blocked_providers(
    monkeypatch: pytest.MonkeyPatch,
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
    always_available: set[str],
) -> None:
    _install_catalog(monkeypatch, {
        "qwen3-max": ("qwen", "3", "standard"),
        "qwen3-coder": ("qwen", "3", "standard"),
        "qwen3-mini": ("qwen", "3", "standard"),
    })
    await model_availability.mark_provider_quota_exhausted("opencode_zen", "arrearage")
    fake_pool({"ILIKE": [
        _Rec(provider_code="opencode_zen", model_id="qwen3-mini"),      # 刚被判欠费
        _Rec(provider_code="token6688", model_id="qwen3-coder"),
    ]})
    assert await _find_quota_equivalent_channels("qwen3-max", set()) == ["t6688/qwen3-coder"]
    # 本请求黑名单同样生效(欠费厂商绝不回头再撞)
    assert await _find_quota_equivalent_channels("qwen3-max", {"token6688"}) == []


async def test_equivalent_channels_require_model_availability(
    monkeypatch: pytest.MonkeyPatch,
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
) -> None:
    _install_catalog(monkeypatch, {
        "qwen3-max": ("qwen", "3", "standard"),
        "qwen3-coder": ("qwen", "3", "standard"),
    })
    monkeypatch.setattr(model_availability, "is_model_available", lambda _m: False)
    fake_pool({"ILIKE": [_Rec(provider_code="token6688", model_id="qwen3-coder")]})
    assert await _find_quota_equivalent_channels("qwen3-max", set()) == []


async def test_equivalent_channels_rank_free_then_generation_then_tier(
    monkeypatch: pytest.MonkeyPatch,
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
    always_available: set[str],
) -> None:
    """优先级:免费额度通道 > 同大版本 > 代次档位 > SQL 序(/llm/models 同序)。"""
    # 临时抬高候选上限,让四条的相对次序全部可见(上限本身另有用例单独验)
    monkeypatch.setattr("app.core.llm_gateway._MAX_QUOTA_EQUIVALENT_CHANNELS", 9)
    _install_catalog(monkeypatch, {
        "qwen3-max": ("qwen", "3", "standard"),
        "qwen3-coder": ("qwen", "3", "standard"),      # 付费家 + 同代
        "qwen2.5-pro": ("qwen", "2.5", "standard"),    # 免费家 + 跨代
        "qwen3.5-flash": ("qwen", "3.5", "latest"),    # 免费家 + 同代 + latest
        "qwen3-turbo": ("qwen", "3", "legacy"),        # 免费家 + 同代 + legacy
    })
    fake_pool({"ILIKE": [
        _Rec(provider_code="token6688", model_id="qwen3-coder"),       # free_tier=False
        _Rec(provider_code="opencode_zen", model_id="qwen2.5-pro"),    # zero_cost,gen 2
        _Rec(provider_code="openrouter", model_id="qwen/qwen3.5-flash"),  # free_tier,同代
        _Rec(provider_code="pollinations", model_id="qwen3-turbo"),    # zero_cost,同代,legacy
    ]})
    assert await _find_quota_equivalent_channels("qwen3-max", set()) == [
        "openrouter/qwen/qwen3.5-flash",
        "pollinations/qwen3-turbo",
        "opencode/qwen2.5-pro",
        "t6688/qwen3-coder",
    ]


async def test_equivalent_channels_are_capped(
    monkeypatch: pytest.MonkeyPatch,
    fake_pool: Callable[[dict[str, Any]], _FakeConn],
    clean_health: dict[str, ProviderHealth],
    always_available: set[str],
) -> None:
    """兜底路径不得无界放大请求数(每次尝试都是真实上游调用)。"""
    table = {"qwen3-max": ("qwen", "3", "standard")}
    rows = []
    for i in range(6):
        name = f"qwen3-v{i}"
        table[name] = ("qwen", "3", "standard")
        rows.append(_Rec(provider_code="openrouter", model_id=f"qwen/{name}"))
    _install_catalog(monkeypatch, table)
    fake_pool({"ILIKE": rows})
    assert len(await _find_quota_equivalent_channels("qwen3-max", set())) == 3


async def test_equivalent_channels_swallows_db_failure(
    monkeypatch: pytest.MonkeyPatch,
    broken_db: None,
) -> None:
    _install_catalog(monkeypatch, {"qwen3-max": ("qwen", "3", "standard")})
    assert await _find_quota_equivalent_channels("qwen3-max", set()) == []


async def test_equivalent_channels_skip_query_for_unstemmed_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """词干不可判定时连 DB 都不该碰(省一次无谓查询,也避免 LIKE 乱命中)。"""
    pool = AsyncMock(side_effect=AssertionError("不该打 DB"))
    monkeypatch.setattr("app.core.llm_gateway._get_pool", pool)
    _install_catalog(monkeypatch, {"yi-large": ("yi", None, "standard")})
    assert await _find_quota_equivalent_channels("yi-large", set()) == []
    pool.assert_not_called()


# =============================================================================
# 任务 B-3:两档顺序与"不静默替换"
# =============================================================================


@pytest.fixture
def quota_channels(
    monkeypatch: pytest.MonkeyPatch,
) -> dict[str, Any]:
    """把两档候选来源都换成可编程假实现,并统计各自被调用了几次。"""
    state: dict[str, Any] = {
        "same_name": [], "equivalents": [], "same_name_calls": 0, "equivalent_calls": 0,
    }

    async def _same_name(model_id: str, exclude_providers: set[str]) -> list[str]:
        state["same_name_calls"] += 1
        return list(state["same_name"])

    async def _equivalent(model_id: str, exclude_providers: set[str]) -> list[str]:
        state["equivalent_calls"] += 1
        return list(state["equivalents"])

    async def _no_ownership(_model: str) -> str:
        return ""

    monkeypatch.setattr("app.core.llm_gateway._find_quota_alternate_channels", _same_name)
    monkeypatch.setattr("app.core.llm_gateway._find_quota_equivalent_channels", _equivalent)
    monkeypatch.setattr("app.core.llm_gateway._db_provider_code_for_model", _no_ownership)
    return state


async def test_same_name_channel_wins_over_equivalent(
    clean_health: dict[str, ProviderHealth],
    quota_channels: dict[str, Any],
) -> None:
    quota_channels["same_name"] = ["openrouter/qwen/qwen3-max"]
    quota_channels["equivalents"] = ["opencode/qwen3-coder"]
    ok = {"content": "ok", "model": "openrouter/qwen/qwen3-max", "usage": {}, "stub": False}

    with patch("app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock, return_value=ok) as called:
        router = FallbackRouter()
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}], "qwen3-max", primary_error=ARREARS_400
        )

    assert result["content"] == "ok"
    assert called.call_args.kwargs["model"] == "openrouter/qwen/qwen3-max"
    # 同名通道一次就成 → 同族等效连查都不查(不静默多打 DB,也不越级换模型)
    assert quota_channels["equivalent_calls"] == 0
    assert "fallback_reason" not in result


async def test_equivalent_used_only_after_same_name_exhausted(
    clean_health: dict[str, ProviderHealth],
    quota_channels: dict[str, Any],
) -> None:
    quota_channels["same_name"] = ["openrouter/qwen/qwen3-max"]
    quota_channels["equivalents"] = ["opencode/qwen3-coder"]
    broke = {"content": "", "error": True, "error_message": f"400 - {ARREARS_BODY}"}
    ok = {"content": "via equivalent", "model": "opencode/qwen3-coder", "usage": {}, "stub": False}

    with patch(
        "app.core.llm_gateway.llm_gateway.complete",
        new_callable=AsyncMock,
        side_effect=[broke, ok],
    ) as called:
        router = FallbackRouter()
        result = await router.complete_with_fallback(
            [{"role": "user", "content": "hi"}], "qwen3-max", primary_error=ARREARS_400
        )

    assert quota_channels["equivalent_calls"] == 1
    assert [c.kwargs["model"] for c in called.call_args_list] == [
        "openrouter/qwen/qwen3-max",
        "opencode/qwen3-coder",
    ]
    # 不许静默替换:换到了不同模型,结果里看得见实际模型 + 换道原因
    assert result["content"] == "via equivalent"
    assert result["model"] == "opencode/qwen3-coder"
    assert result["fallback_reason"] == FALLBACK_REASON_QUOTA_EQUIVALENT


async def test_blocked_provider_is_not_repicked_within_one_request(
    clean_health: dict[str, ProviderHealth],
    quota_channels: dict[str, Any],
) -> None:
    """同一请求里:同名轮已把 openrouter 判欠费,同族轮再混进它也必须被跳过。"""
    quota_channels["same_name"] = ["openrouter/qwen/qwen3-max"]
    quota_channels["equivalents"] = ["openrouter/qwen3-coder", "t6688/qwen3-coder"]
    broke = {"content": "", "error": True, "error_message": f"400 - {ARREARS_BODY}"}
    ok = {"content": "ok", "model": "t6688/qwen3-coder", "usage": {}, "stub": False}

    with patch(
        "app.core.llm_gateway.llm_gateway.complete",
        new_callable=AsyncMock,
        side_effect=[broke, ok],
    ) as called:
        result = await FallbackRouter().complete_with_fallback(
            [{"role": "user", "content": "hi"}], "qwen3-max", primary_error=ARREARS_400
        )

    assert [c.kwargs["model"] for c in called.call_args_list] == [
        "openrouter/qwen/qwen3-max",
        "t6688/qwen3-coder",
    ]
    assert result["content"] == "ok"
    assert model_availability.is_provider_quota_blocked("openrouter") is True
    assert model_availability.is_provider_quota_blocked("t6688") is False


async def test_non_quota_error_never_touches_equivalent_tier(
    clean_health: dict[str, ProviderHealth],
    quota_channels: dict[str, Any],
) -> None:
    """参数错/超限不是"没钱",换模型也治不好:两档都不得查,错误文案也不变。"""
    quota_channels["same_name"] = ["openrouter/qwen/qwen3-max"]
    quota_channels["equivalents"] = ["opencode/qwen3-coder"]
    broke = {"content": "", "error": True, "error_message": "400 InvalidParameter"}

    with patch("app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock, return_value=broke):
        result = await FallbackRouter().complete_with_fallback(
            [{"role": "user", "content": "hi"}], "qwen3-max", primary_error=BAD_PARAM_400
        )

    assert quota_channels["same_name_calls"] == 0
    assert quota_channels["equivalent_calls"] == 0
    assert result["error"].startswith("all fallbacks failed:")
    assert "quota_exhausted" not in result
    assert "errorCode" not in result


async def test_exhausting_both_tiers_names_every_channel(
    clean_health: dict[str, ProviderHealth],
    quota_channels: dict[str, Any],
) -> None:
    """三家都失败时仍按 `模型[厂商]=错误码` 点名,且带上同族替代那一条。"""
    quota_channels["same_name"] = ["openrouter/qwen/qwen3-max"]
    quota_channels["equivalents"] = ["opencode/qwen3-coder"]
    broke = {"content": "", "error": True, "error_message": f"400 - {ARREARS_BODY}"}

    with patch("app.core.llm_gateway.llm_gateway.complete", new_callable=AsyncMock, return_value=broke):
        result = await FallbackRouter().complete_with_fallback(
            [{"role": "user", "content": "hi"}], "qwen3-max", primary_error=ARREARS_400
        )

    assert result["quota_exhausted"] is True
    assert result["errorCode"] == PROVIDER_QUOTA_EXHAUSTED
    detail = str(result["error"])
    assert "qwen3-max[qwen]=arrearage" in detail
    assert "openrouter/qwen/qwen3-max[openrouter]=arrearage" in detail
    assert "opencode/qwen3-coder[opencode_zen]=arrearage" in detail


# =============================================================================
# 任务 C:错误码契约(非流式 / 流式),以及"普通错误不得被吞"
# =============================================================================


def _install_fake_litellm(
    monkeypatch: pytest.MonkeyPatch,
    *,
    failures: dict[str, BaseException],
) -> list[int]:
    """把 litellm 换成按 api_key 分派的假模块(只测网关侧链路,不打网络)。

    命中 failures 的 key 抛对应异常;其余返回成功且 response.model 留空,
    让网关回落成"我们实际调用的那条通道 ID",便于断言不静默替换。
    """
    import sys
    from types import ModuleType

    counter: list[int] = []
    fake = ModuleType("litellm")

    async def _call(**kwargs: Any) -> Any:
        counter.append(1)
        key = str(kwargs.get("api_key"))
        if key in failures:
            raise failures[key]

        class _Usage:
            def model_dump(self) -> dict[str, int]:
                return {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8}

        class _Msg:
            content = "via healthy channel"

        class _Choice:
            message = _Msg()

        class _Resp:
            usage = _Usage()
            choices = [_Choice()]
            model = ""

        return _Resp()

    fake.acompletion = _call  # type: ignore[attr-defined]
    fake.token_counter = lambda **kw: 10  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "litellm", fake)
    return counter


@pytest.fixture
def set_provider_keys(monkeypatch: pytest.MonkeyPatch) -> Callable[[dict[str, str]], None]:
    """配置 LLM_PROVIDERS(否则 complete() 会在"未配置 key"分支提前返回)。"""
    import json

    from app.core.config import settings

    def _apply(providers: dict[str, str]) -> None:
        monkeypatch.setattr(
            settings,
            "llm_providers",
            json.dumps({name: {"api_key": key} for name, key in providers.items()}),
        )

    return _apply


async def test_complete_returns_stable_code_only_when_quota_exhausted(
    monkeypatch: pytest.MonkeyPatch,
    clean_health: dict[str, ProviderHealth],
    set_provider_keys: Callable[[dict[str, str]], None],
) -> None:
    set_provider_keys({"qwen": "sk-x"})
    _install_fake_litellm(monkeypatch, failures={"sk-x": ARREARS_400})
    fb = {
        "content": "",
        "error": "所有通道均因账号额度耗尽失败: qwen3-max[qwen]=arrearage",
        "quota_exhausted": True,
        "errorCode": PROVIDER_QUOTA_EXHAUSTED,
    }
    with patch.object(fallback_router, "complete_with_fallback", new_callable=AsyncMock, return_value=fb):
        result = await LLMGateway().complete([{"role": "user", "content": "hi"}], model="qwen3-max")

    assert result["errorCode"] == PROVIDER_QUOTA_EXHAUSTED
    # message 仍人类可读且含点名归因(前端要能直接展示)
    assert "qwen3-max[qwen]=arrearage" in str(result["error_message"])


async def test_complete_keeps_llm_error_for_ordinary_failures(
    monkeypatch: pytest.MonkeyPatch,
    clean_health: dict[str, ProviderHealth],
    set_provider_keys: Callable[[dict[str, str]], None],
) -> None:
    """回归:兜底链路自己返回普通失败时,绝不能被贴成额度码。"""
    set_provider_keys({"qwen": "sk-x"})
    _install_fake_litellm(monkeypatch, failures={"sk-x": BAD_PARAM_400})
    fb = {"content": "", "error": "all fallbacks failed: 503 upstream unavailable"}
    saved = dict(fallback_router._configs)
    fallback_router._configs.clear()
    fallback_router._configs["qwen3-max"] = {"fallbacks": ["stepfun/step-3.7-flash"]}
    try:
        with patch.object(
            fallback_router, "complete_with_fallback", new_callable=AsyncMock, return_value=fb
        ):
            result = await LLMGateway().complete(
                [{"role": "user", "content": "hi"}], model="qwen3-max"
            )
    finally:
        fallback_router._configs.clear()
        fallback_router._configs.update(saved)

    assert result["errorCode"] == "LLM_ERROR"


async def test_complete_end_to_end_lands_on_family_equivalent(
    monkeypatch: pytest.MonkeyPatch,
    clean_health: dict[str, ProviderHealth],
    quota_channels: dict[str, Any],
    set_provider_keys: Callable[[dict[str, str]], None],
) -> None:
    """qwen 没钱、别家没有同名 qwen-plus → 改道同族等效模型,且调用方看得见换成了谁。"""
    quota_channels["same_name"] = []
    quota_channels["equivalents"] = ["opencode/qwen3-coder"]
    set_provider_keys({"qwen": "sk-qwen-indebt", "opencode": "sk-opencode-free"})
    counter = _install_fake_litellm(monkeypatch, failures={"sk-qwen-indebt": ARREARS_400})

    saved = dict(fallback_router._configs)
    fallback_router._configs.clear()
    try:
        result = await LLMGateway().complete(
            [{"role": "user", "content": "hi"}], model="qwen-plus"
        )
    finally:
        fallback_router._configs.clear()
        fallback_router._configs.update(saved)

    assert not result.get("error")
    assert result["content"] == "via healthy channel"
    assert result["model"] == "opencode/qwen3-coder"
    assert result["fallback_used"] is True
    assert result["fallback_primary"] == "qwen-plus"
    assert result["fallback_reason"] == FALLBACK_REASON_QUOTA_EQUIVALENT
    assert len(counter) == 2  # qwen 撞欠费 + opencode 成功
    assert model_availability.is_provider_quota_blocked("qwen") is True


async def test_astream_fallback_event_exposes_reason_and_actual_model(
    monkeypatch: pytest.MonkeyPatch,
    clean_health: dict[str, ProviderHealth],
) -> None:
    """流式侧沿用既有 type:"fallback" 事件(不新增前端不认识的字段)。"""
    fb = {
        "content": "hi there",
        "model": "opencode/qwen3-coder",
        "usage": {},
        "fallback_reason": FALLBACK_REASON_QUOTA_EQUIVALENT,
    }
    with patch.object(fallback_router, "complete_with_fallback", new_callable=AsyncMock, return_value=fb):
        events = [
            evt
            async for evt in LLMGateway()._astream_fallback_events(
                [{"role": "user", "content": "hi"}], "qwen3-max", f"400 - {ARREARS_BODY}"
            )
        ]

    fallback_evt = next(e for e in events if e["type"] == "fallback")
    assert set(fallback_evt) == {"type", "primary_model", "backup_model", "reason"}
    assert fallback_evt["primary_model"] == "qwen3-max"
    assert fallback_evt["backup_model"] == "opencode/qwen3-coder"
    assert fallback_evt["reason"] == FALLBACK_REASON_QUOTA_EQUIVALENT
    done_evt = next(e for e in events if e["type"] == "done")
    assert done_evt["model"] == "opencode/qwen3-coder"
    assert done_evt["fallback_used"] is True


async def test_astream_error_event_carries_quota_code_when_exhausted(
    monkeypatch: pytest.MonkeyPatch,
    clean_health: dict[str, ProviderHealth],
) -> None:
    fb = {
        "content": "",
        "error": "所有通道均因账号额度耗尽失败: qwen3-max[qwen]=arrearage",
        "quota_exhausted": True,
        "errorCode": PROVIDER_QUOTA_EXHAUSTED,
    }
    with patch.object(fallback_router, "complete_with_fallback", new_callable=AsyncMock, return_value=fb):
        events = [
            evt
            async for evt in LLMGateway()._astream_fallback_events(
                [{"role": "user", "content": "hi"}], "qwen3-max", f"400 - {ARREARS_BODY}"
            )
        ]

    error_evt = next(e for e in events if e["type"] == "error")
    assert error_evt["errorCode"] == PROVIDER_QUOTA_EXHAUSTED
    assert "qwen3-max[qwen]=arrearage" in error_evt["message"]
    assert set(error_evt) == {"type", "message", "errorCode"}


async def test_astream_error_event_keeps_llm_error_on_ordinary_failure(
    monkeypatch: pytest.MonkeyPatch,
    clean_health: dict[str, ProviderHealth],
) -> None:
    fb = {"content": "", "error": "all fallbacks failed: 503"}
    with patch.object(fallback_router, "complete_with_fallback", new_callable=AsyncMock, return_value=fb):
        events = [
            evt
            async for evt in LLMGateway()._astream_fallback_events(
                [{"role": "user", "content": "hi"}], "qwen3-max", f"400 - {INVALID_PARAM_BODY}"
            )
        ]

    error_evt = next(e for e in events if e["type"] == "error")
    assert error_evt["errorCode"] == "LLM_ERROR"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

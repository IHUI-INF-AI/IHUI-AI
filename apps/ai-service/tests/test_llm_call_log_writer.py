# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""llm_call_log_writer 用例(2026-10-22 立,AI 网关逐条落库票)。

隔离铁律(AGENTS.md §5):本文件**一律用 fake pool**,零 asyncpg 真连接,
禁止触碰生产 PG(8810)/Redis(8811);所有用例连跑两次结果必须逐字一致
(test_same_inputs_produce_identical_rows 显式钉住)。
"""

from __future__ import annotations

import asyncio
import inspect
import json
from typing import Any

import pytest

from app.middleware.trace_context import use_trace_id
from app.services.llm_call_log_writer import (
    LlmCallLogFields,
    RawRetentionPolicy,
    build_metadata,
    build_raw_text_columns,
    persist_llm_call_log,
    prompt_from_messages,
    resolve_raw_retention_policy,
    schedule_llm_call_log,
)

USER_UUID = "7b2c3a4d-5e6f-4a1b-9c8d-7e6f5a4b3c2d"
KEY_POOL_UUID = "3f2a1b0c-9d8e-4f70-a1b2-c3d4e5f60718"
TRACE_32HEX = "0af7651916cd43dd8448eb211c80319c"


class FakeConnection:
    """记录 execute/fetchval 调用的假连接(asyncpg.Connection 的最小面)。"""

    def __init__(self, recorder: dict[str, list[Any]]) -> None:
        self._recorder = recorder

    async def execute(self, sql: str, *args: Any) -> str:
        self._recorder["executions"].append((sql, args))
        return "INSERT 0 1"

    async def fetchval(self, sql: str, *args: Any) -> Any:
        self._recorder["fetchvals"].append((sql, args))
        return self._recorder.get("fetchval_result")


class FakeAcquireContext:
    def __init__(self, pool: FakePool) -> None:
        self._pool = pool

    async def __aenter__(self) -> FakeConnection:
        if self._pool.fail_acquire:
            raise RuntimeError("pool exhausted(模拟)")
        return FakeConnection(self._pool.recorder)

    async def __aexit__(self, *exc: object) -> None:
        return None


class FakePool:
    """fake asyncpg.Pool:只记账,不联网。"""

    def __init__(self, *, fail_acquire: bool = False, fail_execute: bool = False) -> None:
        self.recorder: dict[str, list[Any]] = {"executions": [], "fetchvals": []}
        self.fail_acquire = fail_acquire
        self.fail_execute = fail_execute

    def acquire(self) -> Any:
        if self.fail_execute:

            class _Boom(FakeAcquireContext):
                async def __aenter__(self) -> Any:
                    conn = await super().__aenter__()

                    async def _raise(*_a: Any, **_k: Any) -> None:
                        raise RuntimeError("FK violation(模拟)")

                    conn.execute = _raise  # type: ignore[method-assign]
                    return conn

            return _Boom(self)
        return FakeAcquireContext(self)


async def _no_optout(_user_id: str) -> bool:
    return False


async def _optout_yes(_user_id: str) -> bool:
    return True


def _fields(**overrides: Any) -> LlmCallLogFields:
    base: dict[str, Any] = {
        "user_id": USER_UUID,
        "model": "stepfun/step-3",
        "status": "success",
        "prompt": "user:你好",
        "response": "助手回复",
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
            "cached_tokens": 2,
            "cache_creation_tokens": 1,
        },
        "provider_code": "stepfun",
        "latency_ms": 1234,
        "cost_usd": 0.5,
        "cost_source": "litellm",
        "config_source": "key_pool",
        "key_pool_id": KEY_POOL_UUID,
        "config_id": 41,
        "attempt": 1,
        "call_route": "fallback",
        "leg_primary": "openrouter/gpt-oss",
        "combo_name": "combo-a",
        "model_requested": "auto",
        "conversation_id": "conv-1",
        "trace_id": TRACE_32HEX,
    }
    base.update(overrides)
    return LlmCallLogFields(**base)


@pytest.fixture(autouse=True)
def _isolate_optout_cache() -> Any:
    """opt-out TTL 缓存在进程内跨用例共享 —— 逐用例清空,保证"跑两次结果一致"。"""
    import app.services.llm_call_log_writer as writer_mod

    writer_mod._optout_cache.clear()
    yield
    writer_mod._optout_cache.clear()


# ---------------------------------------------------------------------------
# ① 归属主体:缺主体 ⇒ 副作用没发生(并成对留正向对照)
# ---------------------------------------------------------------------------


async def test_missing_user_id_writes_no_rows() -> None:
    """缺主体(user_id='')⇒ persist 返回 False 且 fake pool 零调用(无 INSERT)。"""
    pool = FakePool()
    ok = await persist_llm_call_log(
        _fields(user_id=""), pool=pool, raw_optout_lookup=_no_optout
    )
    assert ok is False
    assert pool.recorder["executions"] == []
    assert pool.recorder["fetchvals"] == []


async def test_non_uuid_principal_writes_no_rows() -> None:
    """主体不是 uuid 形态(如 'system-worker' / 客户端自报串)⇒ 同样零副作用。"""
    pool = FakePool()
    for forged in ("system-worker", "42", "dev-anonymous", USER_UUID + "00"):
        ok = await persist_llm_call_log(
            _fields(user_id=forged), pool=pool, raw_optout_lookup=_no_optout
        )
        assert ok is False, forged
    assert pool.recorder["executions"] == []


async def test_positive_control_valid_principal_writes_one_row() -> None:
    """正向对照:同一份输入只把主体换成合法 uuid ⇒ 恰好一行 INSERT。"""
    pool = FakePool()
    ok = await persist_llm_call_log(
        _fields(), pool=pool, raw_optout_lookup=_no_optout
    )
    assert ok is True
    assert len(pool.recorder["executions"]) == 1
    assert "INSERT INTO llm_call_logs" in pool.recorder["executions"][0][0]


def test_schedule_without_principal_creates_no_task(monkeypatch: pytest.MonkeyPatch) -> None:
    """schedule 层同样在缺主体时**连任务都不创建**(与 persist 同一形状锁)。"""
    calls: list[Any] = []

    async def _spy(_f: LlmCallLogFields) -> bool:
        calls.append(_f)
        return True

    import app.services.llm_call_log_writer as writer_mod

    monkeypatch.setattr(writer_mod, "persist_llm_call_log", _spy)
    schedule_llm_call_log(_fields(user_id=""))
    schedule_llm_call_log(_fields(user_id="not-a-uuid"))
    assert calls == []


# ---------------------------------------------------------------------------
# ② INSERT 参数形状(token 四维 / 成本 / key 池 / 腿别 / metadata 键)
# ---------------------------------------------------------------------------


async def test_insert_argument_shape() -> None:
    pool = FakePool()
    assert await persist_llm_call_log(
        _fields(), pool=pool, raw_optout_lookup=_no_optout
    )
    _sql, args = pool.recorder["executions"][0]
    assert list(args) == [
        USER_UUID,
        "stepfun/step-3",
        "user:你好",
        "助手回复",
        True,
        10,
        5,
        15,
        2,
        1,
        1234,
        "success",
        None,
        "conv-1",
        json.dumps(
            {
                "writer": "ai-service.llm_gateway",
                "attempt": 1,
                "call_route": "fallback",
                "leg_primary": "openrouter/gpt-oss",
                "combo_name": "combo-a",
                "config_source": "key_pool",
                "cost_source": "litellm",
                "model_requested": "auto",
            },
            ensure_ascii=False,
        ),
        "stepfun",
        KEY_POOL_UUID,
        "50.0",
        None,
        None,
        "chat",
        TRACE_32HEX,
        41,
    ]


async def test_error_row_zeroes_cost_and_keeps_attribution() -> None:
    pool = FakePool()
    fields = _fields(
        status="error",
        error_message="LLM 调用失败",
        error_kind="4xx",
        http_status=429,
        response=None,
    )
    assert await persist_llm_call_log(fields, pool=pool, raw_optout_lookup=_no_optout)
    _sql, args = pool.recorder["executions"][0]
    metadata = json.loads(args[14])
    assert args[11] == "error"
    assert args[12] == "LLM 调用失败"
    assert args[18] == 429
    assert args[17] == "0.0"  # 失败调用成本置 0(与 Node relay-billing 同决策)
    assert metadata["noChargeReason"] == "status=error"
    assert metadata["error_kind"] == "4xx"


async def test_key_pool_id_shape_lock() -> None:
    """key_pool_id 非法 uuid ⇒ 列落 NULL,但行照写(宁缺毋假,不冒充号池命中)。"""
    pool = FakePool()
    assert await persist_llm_call_log(
        _fields(key_pool_id="not-uuid"), pool=pool, raw_optout_lookup=_no_optout
    )
    _sql, args = pool.recorder["executions"][0]
    assert args[16] is None


# ---------------------------------------------------------------------------
# ③ 原文留存:对齐 Node buildRawTextColumns(用户 opt-out / env 全关 / 截断)
# ---------------------------------------------------------------------------


async def test_user_optout_writes_no_raw_text() -> None:
    pool = FakePool()
    assert await persist_llm_call_log(_fields(), pool=pool, raw_optout_lookup=_optout_yes)
    _sql, args = pool.recorder["executions"][0]
    assert args[2] == ""  # prompt 列 NOT NULL ⇒ 落空串
    assert args[3] is None  # response 落 NULL(与清除器口径一致)
    assert args[4] is False  # raw_retained=false,清除器跳过本行


def test_policy_star_env_disables_all_raw() -> None:
    policy = resolve_raw_retention_policy(
        {"LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS": "*"}
    )
    assert policy.all is True
    assert policy.default_days == 0
    cols = build_raw_text_columns(prompt="p", response="r", policy=policy)
    assert (cols.prompt, cols.response, cols.raw_retained) == ("", None, False)


def test_policy_parses_days_and_disabled_ids() -> None:
    policy = resolve_raw_retention_policy(
        {
            "LLM_CALL_LOG_RAW_RETENTION_DAYS": "7",
            "LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS": " k1 , k2 ",
        }
    )
    assert policy == RawRetentionPolicy(7, ("k1", "k2"), False)
    # 非法天数回落 30(与 Node parseNonNegativeInt 同口径)
    assert resolve_raw_retention_policy({"LLM_CALL_LOG_RAW_RETENTION_DAYS": "abc"}).default_days == 30
    assert resolve_raw_retention_policy({"LLM_CALL_LOG_RAW_RETENTION_DAYS": "-1"}).default_days == 30


def test_build_raw_text_columns_disabled_key_id() -> None:
    policy = RawRetentionPolicy(30, ("k1",), False)
    cols = build_raw_text_columns(
        prompt="p", response="r", api_key_id="k1", policy=policy
    )
    assert cols.raw_retained is False and cols.prompt == ""


async def test_long_prompt_truncated_at_5000() -> None:
    pool = FakePool()
    long_prompt = "x" * 6000
    assert await persist_llm_call_log(
        _fields(prompt=long_prompt), pool=pool, raw_optout_lookup=_no_optout
    )
    _sql, args = pool.recorder["executions"][0]
    assert args[2].startswith("x" * 5000)
    assert args[2].endswith("...[truncated]")
    assert len(args[2]) == 5000 + len("...[truncated]")


# ---------------------------------------------------------------------------
# ④ 失败方向:只 warn 降级,绝不带崩;默认 opt-out 查询失败 ⇒ 按默认留存
# ---------------------------------------------------------------------------


async def test_pool_failure_degrades_without_raising() -> None:
    pool = FakePool(fail_execute=True)
    ok = await persist_llm_call_log(_fields(), pool=pool, raw_optout_lookup=_no_optout)
    assert ok is False  # 异常被吞,业务链路无感


async def test_optout_lookup_failure_defaults_to_retaining() -> None:
    """默认库查(fetchval 抛异常)⇒ fail-safe 方向 = 保留原文(与 Node 留档一致)。"""
    pool = FakePool()
    pool.recorder["fail_fetchval"] = True

    class _BoomPool(FakePool):
        def acquire(self) -> Any:
            recorder = self.recorder

            class _CM:
                async def __aenter__(self) -> Any:
                    conn = FakeConnection(recorder)

                    async def _boom(*_a: Any, **_k: Any) -> None:
                        raise RuntimeError("db down(模拟)")

                    conn.fetchval = _boom  # type: ignore[method-assign]
                    return conn

                async def __aexit__(self, *_e: object) -> None:
                    return None

            return _CM()

    ok = await persist_llm_call_log(_fields(), pool=_BoomPool())
    assert ok is True


async def test_default_optout_query_hits_user_preferences() -> None:
    """不注入 lookup 时,默认实现查 user_preferences 隐私键(Node 同一存储事实)。"""
    pool = FakePool()
    assert await persist_llm_call_log(_fields(), pool=pool)
    sel_sql, sel_args = pool.recorder["fetchvals"][0]
    assert "user_preferences" in sel_sql
    assert "'privacy'" in sel_sql
    assert "llmRawRetentionOptOut" in sel_sql
    assert sel_args == (USER_UUID,)
    assert len(pool.recorder["executions"]) == 1


# ---------------------------------------------------------------------------
# ⑤ 确定性:同输入跑两次,参数逐字一致(测试隔离铁律的"跑两次"面)
# ---------------------------------------------------------------------------


async def test_same_inputs_produce_identical_rows() -> None:
    pool_a = FakePool()
    pool_b = FakePool()
    f = _fields()
    assert await persist_llm_call_log(f, pool=pool_a, raw_optout_lookup=_no_optout)
    assert await persist_llm_call_log(f, pool=pool_b, raw_optout_lookup=_no_optout)
    assert pool_a.recorder["executions"] == pool_b.recorder["executions"]


# ---------------------------------------------------------------------------
# ⑥ schedule(fire-and-forget)与网关契约面
# ---------------------------------------------------------------------------


async def test_schedule_fires_persist_with_pool() -> None:
    pool = FakePool()
    schedule_llm_call_log(_fields(), pool=pool, raw_optout_lookup=_no_optout)
    await asyncio.sleep(0.05)
    assert len(pool.recorder["executions"]) == 1


def test_schedule_without_running_loop_only_warns() -> None:
    """同步上下文(无 loop)⇒ 如实丢弃 + warn,不抛异常、不冒充已排期。"""
    schedule_llm_call_log(_fields(), pool=FakePool(), raw_optout_lookup=_no_optout)


def test_gateway_entrypoint_contract() -> None:
    """网关契约锁:complete/astream 必须把主体声明成**具名 kw-only 参数**——
    若落回 **kwargs,它们会随 call_kwargs.update(kwargs) 漏进 litellm 调用参数。"""
    from app.core.llm_gateway import LLMGateway

    for fn in (LLMGateway.complete, LLMGateway.astream):
        params = inspect.signature(fn).parameters
        for name in ("billing_user_id", "conversation_id", "_call_route"):
            assert name in params, f"{fn.__name__} 缺具名参数 {name}"
            assert params[name].kind is inspect.Parameter.KEYWORD_ONLY


def test_gateway_emit_skips_without_principal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """_emit_llm_call_log:缺主体 ⇒ 写入层一次都不被调用;带主体 ⇒ 恰好一次(正向对照)。"""
    import app.services.llm_call_log_writer as writer_mod
    from app.core.llm_gateway import _emit_llm_call_log

    seen: list[Any] = []
    monkeypatch.setattr(writer_mod, "schedule_llm_call_log", lambda f: seen.append(f))

    _emit_llm_call_log(
        billing_user_id=None, model="stepfun/step-3", provider="stepfun", status="success"
    )
    assert seen == []

    _emit_llm_call_log(
        billing_user_id=USER_UUID,
        model="stepfun/step-3",
        provider="stepfun",
        status="success",
        messages=[{"role": "user", "content": "你好"}],
    )
    assert len(seen) == 1
    assert seen[0].user_id == USER_UUID
    assert seen[0].prompt == prompt_from_messages([{"role": "user", "content": "你好"}])


def test_metadata_key_list_is_closed_set() -> None:
    """metadata 键清单(模块头注登记的唯一一份)不得悄悄长出新键。"""
    fields = _fields(
        status="error",
        error_kind="5xx",
        native_adapter=True,
        usage_estimated=True,
        config_source="key_pool",
    )
    keys = set(build_metadata(fields).keys())
    allowed = {
        "writer",
        "attempt",
        "call_route",
        "leg_primary",
        "combo_name",
        "error_kind",
        "config_source",
        "cost_source",
        "usage_estimated",
        "model_requested",
        "native_adapter",
        "noChargeReason",
    }
    assert keys <= allowed


def test_trace_id_falls_back_to_contextvar() -> None:
    pool_holder: list[FakePool] = []

    async def _run() -> None:
        pool = FakePool()
        pool_holder.append(pool)
        with use_trace_id(TRACE_32HEX):
            assert await persist_llm_call_log(
                _fields(trace_id=None), pool=pool, raw_optout_lookup=_no_optout
            )

    asyncio.run(_run())
    assert pool_holder[0].recorder["executions"][0][1][21] == TRACE_32HEX


# ---------------------------------------------------------------------------
# ⑦ config_id:命中哪一条 provider 配置可回溯(2026-10-23 补票面第二格)
# ---------------------------------------------------------------------------


async def test_config_id_is_written_as_bigint_column() -> None:
    """config_id 走**列**不走 metadata(与 metadata 闭合集判据互不越界)。"""
    pool = FakePool()
    assert await persist_llm_call_log(_fields(), pool=pool, raw_optout_lookup=_no_optout)
    sql, args = pool.recorder["executions"][0]
    assert "config_id" in sql
    assert args[22] == 41
    metadata = json.loads(args[14])
    assert "config_id" not in metadata


async def test_config_id_shape_lock_rejects_non_evidence() -> None:
    """拿不到实证 id ⇒ 落 NULL:bool/0/负数/非数字串一律不冒充"命中了某条配置"。"""
    for forged in (True, 0, -7, "not-a-number", "", 9_223_372_036_854_775_808, None):
        pool = FakePool()
        assert await persist_llm_call_log(
            _fields(config_id=forged), pool=pool, raw_optout_lookup=_no_optout
        ), forged
        _sql, args = pool.recorder["executions"][0]
        assert args[22] is None, forged


async def test_config_id_positive_control_accepts_int_and_digit_string() -> None:
    """正向对照:整形与纯数字串两种真实形态都落原值(asyncpg 回 int / 旧调用方回串)。"""
    for raw, expected in ((41, 41), ("41", 41)):
        pool = FakePool()
        assert await persist_llm_call_log(
            _fields(config_id=raw), pool=pool, raw_optout_lookup=_no_optout
        )
        _sql, args = pool.recorder["executions"][0]
        assert args[22] == expected, raw


def test_gateway_emit_carries_config_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """网关分发器把 config_id 透传给写入层(缺省=None,不拿 provider 猜 id)。"""
    import app.services.llm_call_log_writer as writer_mod
    from app.core.llm_gateway import _emit_llm_call_log

    seen: list[Any] = []
    monkeypatch.setattr(writer_mod, "schedule_llm_call_log", lambda f: seen.append(f))

    _emit_llm_call_log(
        billing_user_id=USER_UUID,
        model="stepfun/step-3",
        provider="stepfun",
        status="success",
        config_id=77,
    )
    _emit_llm_call_log(
        billing_user_id=USER_UUID, model="stepfun/step-3", provider="stepfun", status="success"
    )
    assert [f.config_id for f in seen] == [77, None]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

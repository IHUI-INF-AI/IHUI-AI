"""LLM 成本预算治理器(llm_budget_governor.py)测试。

覆盖范围:
1. 模块辅助函数:_now_iso / _today_key / _hour_key / _date_from_days_ago
2. 模块常量:_VALID_PILLARS / _MEMORY_USAGE_MAX / _REDIS_KEY_*
3. 数据类:BudgetConfig / UsageRecord / BudgetCheckResult
4. 异常:BudgetExceededError
5. LLMBudgetGovernor:
   - __init__
   - _ensure_redis(URL 缺失/存在/import 失败/缓存)
   - _calc_cost(已知/未知模型/默认费率/0 token/取整/rates 缺失)
   - _incr_memory(创建/累加/取整)
   - _incr_usage(内存模式/Redis 成功/Redis 失败降级)
   - _get_period_usage(内存/Redis/失败降级)
   - _get_pillar_usage(内存/Redis/失败降级)
   - _scan_records(today/hour/week/未知/Redis/失败/无效 member)
   - _emit_event(import 失败/无 emit/同步/异步/异常)
   - _pick_degrade_model(未降级/已降级/链尾/不在链中/空链/短链)
   - record_usage(基础/未知支柱/request_id/uuid/Redis/失败降级/返回值)
   - check_budget(正常/warning/critical/auto_degrade/hard_stop/支柱触发/未知支柱/事件)
   - get_usage_summary(today/hour/week/pillar/未知)
   - get_usage_trend(默认 7 天/自定义)
   - get_pillar_budget(基础/未知支柱)
   - reset_degradation(存在/不存在/事件)
   - update_config(部分/全量/pillar_ratios 偏离/model_cost_table/degrade_chain/Redis)
   - get_cost_breakdown(空/有记录)
6. with_budget 装饰器:允许/超限抛错/记录用量/无用量不记录/llm_model 别名
7. 模块级单例:llm_budget_governor
"""

from __future__ import annotations

import asyncio
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import llm_budget_governor as lbg_module
from app.services.llm_budget_governor import (
    BudgetCheckResult,
    BudgetConfig,
    BudgetExceededError,
    LLMBudgetGovernor,
    UsageRecord,
    _MEMORY_USAGE_MAX,
    _REDIS_KEY_CONFIG,
    _REDIS_KEY_DAILY,
    _REDIS_KEY_HOURLY,
    _REDIS_KEY_PILLAR,
    _REDIS_KEY_USAGE,
    _VALID_PILLARS,
    _date_from_days_ago,
    _hour_key,
    _now_iso,
    _today_key,
    llm_budget_governor,
    with_budget,
)


# =============================================================================
# 公共 fixture
# =============================================================================


@pytest.fixture
def memory_governor() -> LLMBudgetGovernor:
    """干净的内存模式 governor(强制 _ensure_redis 返回 None,所有路径走内存)。"""
    gov = LLMBudgetGovernor()
    gov._redis = None
    gov._redis_inited = True
    return gov


@pytest.fixture
def fresh_governor() -> LLMBudgetGovernor:
    """未初始化 Redis 的 governor(用于测试 _ensure_redis)。"""
    return LLMBudgetGovernor()


# =============================================================================
# 模块辅助函数
# =============================================================================


class TestHelpers:
    """模块级辅助函数:_now_iso / _today_key / _hour_key / _date_from_days_ago。"""

    def test_now_iso_returns_iso_format(self):
        """_now_iso 返回 ISO 8601 格式字符串。"""
        ts = _now_iso()
        # 能被 datetime.fromisoformat 解析
        parsed = datetime.fromisoformat(ts)
        assert parsed.tzinfo is not None

    def test_now_iso_is_utc(self):
        """_now_iso 时间戳带 UTC 时区。"""
        ts = _now_iso()
        parsed = datetime.fromisoformat(ts)
        assert parsed.utcoffset() == timedelta(0)

    def test_today_key_format(self):
        """_today_key 格式 YYYY-MM-DD。"""
        key = _today_key()
        parsed = datetime.strptime(key, "%Y-%m-%d")
        assert parsed is not None

    def test_hour_key_format(self):
        """_hour_key 格式 YYYY-MM-DD-HH。"""
        key = _hour_key()
        parsed = datetime.strptime(key, "%Y-%m-%d-%H")
        assert parsed is not None

    def test_date_from_days_ago_zero(self):
        """_date_from_days_ago(0) 等于今天。"""
        assert _date_from_days_ago(0) == _today_key()

    def test_date_from_days_ago_positive(self):
        """_date_from_days_ago(1) 是昨天。"""
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        assert _date_from_days_ago(1) == yesterday

    def test_date_from_days_ago_format(self):
        """_date_from_days_ago 返回 YYYY-MM-DD 格式。"""
        key = _date_from_days_ago(7)
        parsed = datetime.strptime(key, "%Y-%m-%d")
        assert parsed is not None


# =============================================================================
# 模块常量
# =============================================================================


class TestModuleConstants:
    """模块常量:_VALID_PILLARS / _MEMORY_USAGE_MAX / _REDIS_KEY_*。"""

    def test_valid_pillars_contents(self):
        """_VALID_PILLARS 包含 6 大支柱。"""
        assert _VALID_PILLARS == {"rules", "hook", "spec", "context", "subagent", "terminal"}

    def test_valid_pillars_count(self):
        """_VALID_PILLARS 恰好 6 个。"""
        assert len(_VALID_PILLARS) == 6

    def test_memory_usage_max_value(self):
        """_MEMORY_USAGE_MAX = 10000。"""
        assert _MEMORY_USAGE_MAX == 10000

    def test_redis_key_templates(self):
        """Redis key 模板格式正确。"""
        assert _REDIS_KEY_USAGE == "hub:budget:usage"
        assert _REDIS_KEY_DAILY.format(date="2026-07-23") == "hub:budget:daily:2026-07-23"
        assert _REDIS_KEY_HOURLY.format(hour="2026-07-23-14") == "hub:budget:hourly:2026-07-23-14"
        assert _REDIS_KEY_PILLAR.format(pillar="rules", date="2026-07-23") == \
            "hub:budget:pillar:rules:2026-07-23"
        assert _REDIS_KEY_CONFIG == "hub:budget:config"


# =============================================================================
# BudgetConfig 数据类
# =============================================================================


class TestBudgetConfig:
    """BudgetConfig 默认值与结构。"""

    def test_default_config_values(self):
        """默认配置值正确。"""
        cfg = BudgetConfig()
        assert cfg.daily_token_limit == 2_000_000
        assert cfg.daily_cost_limit_usd == 10.0
        assert cfg.hourly_token_limit == 200_000
        assert cfg.warning_threshold == 0.8
        assert cfg.critical_threshold == 0.95
        assert cfg.auto_degrade_at == 0.9
        assert cfg.hard_stop_at == 1.0

    def test_default_pillar_ratios_sum_to_one(self):
        """默认 pillar_ratios 总和为 1.0。"""
        cfg = BudgetConfig()
        assert sum(cfg.pillar_ratios.values()) == pytest.approx(1.0)

    def test_default_pillar_ratios_contains_all_pillars(self):
        """默认 pillar_ratios 包含全部 6 支柱。"""
        cfg = BudgetConfig()
        assert set(cfg.pillar_ratios.keys()) == _VALID_PILLARS

    def test_default_model_cost_table_has_default(self):
        """默认 model_cost_table 含 default 费率。"""
        cfg = BudgetConfig()
        assert "default" in cfg.model_cost_table
        assert "input" in cfg.model_cost_table["default"]
        assert "output" in cfg.model_cost_table["default"]

    def test_default_degrade_chain(self):
        """默认 degrade_chain 至少 2 个模型。"""
        cfg = BudgetConfig()
        assert len(cfg.degrade_chain) >= 2
        assert "gpt-4o" in cfg.degrade_chain
        assert "gpt-4o-mini" in cfg.degrade_chain

    def test_custom_config(self):
        """自定义配置覆盖默认值。"""
        cfg = BudgetConfig(daily_token_limit=500_000, daily_cost_limit_usd=5.0)
        assert cfg.daily_token_limit == 500_000
        assert cfg.daily_cost_limit_usd == 5.0


# =============================================================================
# UsageRecord / BudgetCheckResult 数据类
# =============================================================================


class TestUsageRecord:
    """UsageRecord 数据类。"""

    def test_usage_record_creation(self):
        """UsageRecord 字段正确赋值。"""
        rec = UsageRecord(
            pillar="rules", model="gpt-4o",
            input_tokens=100, output_tokens=50,
            cost_usd=0.005, timestamp="2026-07-23T00:00:00+00:00",
            request_id="req-1", action="auto_generate",
        )
        assert rec.pillar == "rules"
        assert rec.model == "gpt-4o"
        assert rec.input_tokens == 100
        assert rec.output_tokens == 50
        assert rec.cost_usd == 0.005
        assert rec.request_id == "req-1"
        assert rec.action == "auto_generate"


class TestBudgetCheckResult:
    """BudgetCheckResult 数据类。"""

    def test_budget_check_result_creation(self):
        """BudgetCheckResult 字段正确赋值。"""
        result = BudgetCheckResult(
            allowed=True, degrade_to_model="gpt-4o-mini",
            reason="已超降级阈值", usage_percent=0.92,
            pillar_usage_percent=0.5, remaining_tokens=1000,
            remaining_cost_usd=5.0,
        )
        assert result.allowed is True
        assert result.degrade_to_model == "gpt-4o-mini"
        assert result.reason == "已超降级阈值"
        assert result.usage_percent == 0.92
        assert result.pillar_usage_percent == 0.5
        assert result.remaining_tokens == 1000
        assert result.remaining_cost_usd == 5.0

    def test_budget_check_result_defaults(self):
        """BudgetCheckResult degrade_to_model 默认 None。"""
        result = BudgetCheckResult(
            allowed=True, degrade_to_model=None, reason="",
            usage_percent=0.0, pillar_usage_percent=0.0,
            remaining_tokens=0, remaining_cost_usd=0.0,
        )
        assert result.degrade_to_model is None


# =============================================================================
# BudgetExceededError 异常
# =============================================================================


class TestBudgetExceededError:
    """BudgetExceededError 异常属性。"""

    def test_error_with_values(self):
        """异常携带 usage_percent 和 remaining_tokens。"""
        err = BudgetExceededError("超限", usage_percent=1.2, remaining_tokens=0)
        assert str(err) == "超限"
        assert err.usage_percent == 1.2
        assert err.remaining_tokens == 0

    def test_error_default_values(self):
        """异常默认 usage_percent=0.0, remaining_tokens=0。"""
        err = BudgetExceededError("超限")
        assert err.usage_percent == 0.0
        assert err.remaining_tokens == 0

    def test_error_is_exception(self):
        """BudgetExceededError 是 Exception 子类。"""
        err = BudgetExceededError("超限")
        assert isinstance(err, Exception)


# =============================================================================
# LLMBudgetGovernor __init__
# =============================================================================


class TestLLMBudgetGovernorInit:
    """LLMBudgetGovernor 初始化。"""

    def test_init_default_config(self, fresh_governor):
        """无参初始化使用默认 BudgetConfig。"""
        assert isinstance(fresh_governor.config, BudgetConfig)
        assert fresh_governor.config.daily_token_limit == 2_000_000

    def test_init_custom_config(self):
        """自定义 config 被采用。"""
        cfg = BudgetConfig(daily_token_limit=999_999)
        gov = LLMBudgetGovernor(config=cfg)
        assert gov.config.daily_token_limit == 999_999

    def test_init_redis_none_initially(self, fresh_governor):
        """初始化时 _redis 为 None。"""
        assert fresh_governor._redis is None

    def test_init_redis_not_inited_initially(self, fresh_governor):
        """初始化时 _redis_inited 为 False。"""
        assert fresh_governor._redis_inited is False

    def test_init_memory_usage_deque_maxlen(self, fresh_governor):
        """_memory_usage deque maxlen = _MEMORY_USAGE_MAX。"""
        assert fresh_governor._memory_usage.maxlen == _MEMORY_USAGE_MAX

    def test_init_empty_dicts(self, fresh_governor):
        """初始化时各累加器为空 dict。"""
        assert fresh_governor._memory_daily == {}
        assert fresh_governor._memory_hourly == {}
        assert fresh_governor._memory_pillar == {}
        assert fresh_governor._degraded_models == {}


# =============================================================================
# _ensure_redis
# =============================================================================


class TestEnsureRedis:
    """_ensure_redis:惰性获取 Redis 连接,失败返回 None。"""

    async def test_no_redis_url_returns_none(self, fresh_governor, monkeypatch):
        """无 REDIS_URL 环境变量 → 返回 None。"""
        monkeypatch.delenv("REDIS_URL", raising=False)
        result = await fresh_governor._ensure_redis()
        assert result is None

    async def test_redis_url_returns_connection(self, fresh_governor, monkeypatch):
        """有 REDIS_URL → 尝试建立连接。"""
        monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
        mock_redis = MagicMock()

        # 直接 mock redis.asyncio.from_url(import redis.asyncio as aioredis 的字节码
        # 会从 redis 包对象的 asyncio 属性获取模块,故 patch.dict(sys.modules) 无效,
        # 必须直接 patch 模块属性)
        with patch("redis.asyncio.from_url", return_value=mock_redis):
            result = await fresh_governor._ensure_redis()
        assert result is mock_redis

    async def test_import_failure_returns_none(self, fresh_governor, monkeypatch):
        """redis 模块 import 失败 → 返回 None(降级内存)。"""
        monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
        # 让 import redis.asyncio 抛 ImportError
        original = sys.modules.get("redis.asyncio")
        sys.modules["redis.asyncio"] = None  # 触发 ImportError
        try:
            result = await fresh_governor._ensure_redis()
        finally:
            if original is not None:
                sys.modules["redis.asyncio"] = original
            else:
                sys.modules.pop("redis.asyncio", None)
        assert result is None

    async def test_cached_after_first_call(self, fresh_governor, monkeypatch):
        """第二次调用复用缓存(_redis_inited=True)。"""
        monkeypatch.delenv("REDIS_URL", raising=False)
        first = await fresh_governor._ensure_redis()
        assert first is None
        assert fresh_governor._redis_inited is True
        # 第二次应直接返回缓存的 None,不再读 env
        monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
        second = await fresh_governor._ensure_redis()
        assert second is None


# =============================================================================
# _calc_cost
# =============================================================================


class TestCalcCost:
    """_calc_cost:成本计算。"""

    def test_known_model_gpt4o(self, memory_governor):
        """已知模型 gpt-4o 用其费率。"""
        # gpt-4o: input=0.0025/1k, output=0.01/1k
        # 1000 input + 500 output = 0.0025 + 0.005 = 0.0075
        cost = memory_governor._calc_cost("gpt-4o", 1000, 500)
        assert cost == pytest.approx(0.0075, abs=1e-6)

    def test_known_model_gpt4o_mini(self, memory_governor):
        """已知模型 gpt-4o-mini 用其费率。"""
        # gpt-4o-mini: input=0.00015/1k, output=0.0006/1k
        # 1000 + 1000 = 0.00015 + 0.0006 = 0.00075
        cost = memory_governor._calc_cost("gpt-4o-mini", 1000, 1000)
        assert cost == pytest.approx(0.00075, abs=1e-6)

    def test_unknown_model_uses_default(self, memory_governor):
        """未知模型用 default 费率。"""
        # default: input=0.002, output=0.008
        cost = memory_governor._calc_cost("unknown-model", 1000, 1000)
        assert cost == pytest.approx(0.01, abs=1e-6)

    def test_zero_tokens(self, memory_governor):
        """0 token → cost = 0。"""
        cost = memory_governor._calc_cost("gpt-4o", 0, 0)
        assert cost == 0.0

    def test_cost_rounding(self, memory_governor):
        """cost 保留 6 位小数。"""
        # 选一个会产生长小数的组合
        cost = memory_governor._calc_cost("gpt-4o-mini", 1, 1)
        # 1/1000 * 0.00015 + 1/1000 * 0.0006 = 0.00000075 → round 6 位 = 0.000001
        assert cost == round(0.00000075, 6)

    def test_rates_missing_input_uses_fallback(self, memory_governor):
        """rates 字典缺 input 键 → 用 0.002 兜底。"""
        memory_governor.config.model_cost_table = {
            "custom": {"output": 0.01},  # 无 input
            "default": {"input": 0.002, "output": 0.008},
        }
        # custom 缺 input → 用 0.002
        # 1000 input + 1000 output = 0.002 + 0.01 = 0.012
        cost = memory_governor._calc_cost("custom", 1000, 1000)
        assert cost == pytest.approx(0.012, abs=1e-6)

    def test_no_default_in_table_uses_hardcoded(self, memory_governor):
        """model_cost_table 无 default 键 → 用硬编码 0.002/0.008。"""
        memory_governor.config.model_cost_table = {
            "gpt-4o": {"input": 0.0025, "output": 0.01},
        }
        # 未知模型 + 无 default → 硬编码 0.002, 0.008
        cost = memory_governor._calc_cost("nonexistent", 1000, 1000)
        assert cost == pytest.approx(0.01, abs=1e-6)


# =============================================================================
# _incr_memory(staticmethod)
# =============================================================================


class TestIncrMemory:
    """_incr_memory:内存累加(staticmethod)。"""

    def test_creates_bucket(self, memory_governor):
        """首次写入创建 bucket。"""
        store: dict = {}
        LLMBudgetGovernor._incr_memory(store, "key1", 100, 0.5)
        assert store["key1"] == {"tokens": 100, "cost": 0.5}

    def test_accumulates(self, memory_governor):
        """多次写入累加。"""
        store: dict = {}
        LLMBudgetGovernor._incr_memory(store, "key1", 100, 0.5)
        LLMBudgetGovernor._incr_memory(store, "key1", 200, 1.5)
        assert store["key1"]["tokens"] == 300
        assert store["key1"]["cost"] == 2.0

    def test_cost_rounding(self, memory_governor):
        """cost 累加后 round 6 位。"""
        store: dict = {}
        LLMBudgetGovernor._incr_memory(store, "key1", 0, 0.0000001)
        LLMBudgetGovernor._incr_memory(store, "key1", 0, 0.0000001)
        # 0.0000002 round 6 位 = 0.0
        assert store["key1"]["cost"] == 0.0

    def test_multiple_keys_independent(self, memory_governor):
        """不同 key 互不影响。"""
        store: dict = {}
        LLMBudgetGovernor._incr_memory(store, "key1", 100, 0.5)
        LLMBudgetGovernor._incr_memory(store, "key2", 200, 1.0)
        assert store["key1"]["tokens"] == 100
        assert store["key2"]["tokens"] == 200


# =============================================================================
# _incr_usage
# =============================================================================


class TestIncrUsage:
    """_incr_usage:用量累加(Redis + 内存降级)。"""

    async def test_memory_mode_writes_three_stores(self, memory_governor):
        """内存模式:写入 daily/hourly/pillar 三个 store。"""
        await memory_governor._incr_usage("2026-07-23", "2026-07-23-14", "rules", 500, 0.25)
        daily_key = _REDIS_KEY_DAILY.format(date="2026-07-23")
        hourly_key = _REDIS_KEY_HOURLY.format(hour="2026-07-23-14")
        pillar_key = _REDIS_KEY_PILLAR.format(pillar="rules", date="2026-07-23")

        assert memory_governor._memory_daily[daily_key]["tokens"] == 500
        assert memory_governor._memory_daily[daily_key]["cost"] == 0.25
        assert memory_governor._memory_hourly[hourly_key]["tokens"] == 500
        assert memory_governor._memory_pillar["rules"][pillar_key]["tokens"] == 500

    async def test_redis_success_skips_memory(self, memory_governor):
        """Redis 成功 → 不写内存。"""
        mock_pipe = MagicMock()
        mock_redis = MagicMock()
        mock_redis.pipeline.return_value = mock_pipe
        mock_pipe.execute = AsyncMock(return_value=[1, 1.0, 1, 1.0, 1, 1.0])
        memory_governor._redis = mock_redis

        await memory_governor._incr_usage("2026-07-23", "2026-07-23-14", "rules", 500, 0.25)
        # 应调用 pipeline 的 6 个方法
        assert mock_pipe.hincrby.call_count == 3
        assert mock_pipe.hincrbyfloat.call_count == 3
        # 内存不应被写入
        assert len(memory_governor._memory_daily) == 0

    async def test_redis_failure_fallback_memory(self, memory_governor):
        """Redis 失败 → 降级到内存。"""
        mock_pipe = MagicMock()
        mock_redis = MagicMock()
        mock_redis.pipeline.return_value = mock_pipe
        mock_pipe.execute = AsyncMock(side_effect=RuntimeError("redis down"))
        memory_governor._redis = mock_redis

        await memory_governor._incr_usage("2026-07-23", "2026-07-23-14", "rules", 500, 0.25)
        # 降级到内存
        daily_key = _REDIS_KEY_DAILY.format(date="2026-07-23")
        assert memory_governor._memory_daily[daily_key]["tokens"] == 500


# =============================================================================
# _get_period_usage
# =============================================================================


class TestGetPeriodUsage:
    """_get_period_usage:读取周期用量。"""

    async def test_memory_mode_returns_bucket(self, memory_governor):
        """内存模式:返回 store 中的值。"""
        daily_key = _REDIS_KEY_DAILY.format(date="2026-07-23")
        memory_governor._memory_daily[daily_key] = {"tokens": 1500, "cost": 0.075}

        result = await memory_governor._get_period_usage(
            lambda: daily_key, memory_governor._memory_daily,
        )
        assert result["tokens"] == 1500
        assert result["cost"] == 0.075

    async def test_memory_mode_missing_key_returns_zero(self, memory_governor):
        """内存模式:key 不存在 → 返回 0。"""
        result = await memory_governor._get_period_usage(
            lambda: "nonexistent", memory_governor._memory_daily,
        )
        assert result["tokens"] == 0
        assert result["cost"] == 0.0

    async def test_redis_success(self, memory_governor):
        """Redis 成功:返回 Redis 中的值。"""
        mock_redis = MagicMock()
        mock_redis.hget = AsyncMock(side_effect=["1500", "0.075"])
        memory_governor._redis = mock_redis

        result = await memory_governor._get_period_usage(
            lambda: "any_key", memory_governor._memory_daily,
        )
        assert result["tokens"] == 1500
        assert result["cost"] == 0.075

    async def test_redis_returns_none_values(self, memory_governor):
        """Redis 返回 None → tokens=0, cost=0.0。"""
        mock_redis = MagicMock()
        mock_redis.hget = AsyncMock(side_effect=[None, None])
        memory_governor._redis = mock_redis

        result = await memory_governor._get_period_usage(
            lambda: "any_key", memory_governor._memory_daily,
        )
        assert result["tokens"] == 0
        assert result["cost"] == 0.0

    async def test_redis_failure_fallback_memory(self, memory_governor):
        """Redis 失败 → 降级到内存。"""
        daily_key = _REDIS_KEY_DAILY.format(date="2026-07-23")
        memory_governor._memory_daily[daily_key] = {"tokens": 999, "cost": 0.5}

        mock_redis = MagicMock()
        mock_redis.hget = AsyncMock(side_effect=RuntimeError("redis down"))
        memory_governor._redis = mock_redis

        result = await memory_governor._get_period_usage(
            lambda: daily_key, memory_governor._memory_daily,
        )
        assert result["tokens"] == 999
        assert result["cost"] == 0.5


# =============================================================================
# _get_pillar_usage
# =============================================================================


class TestGetPillarUsage:
    """_get_pillar_usage:读取单支柱用量。"""

    async def test_memory_mode_returns_bucket(self, memory_governor):
        """内存模式:返回支柱 store 中的值。"""
        pillar_key = _REDIS_KEY_PILLAR.format(pillar="rules", date="2026-07-23")
        memory_governor._memory_pillar["rules"] = {pillar_key: {"tokens": 300, "cost": 0.15}}

        result = await memory_governor._get_pillar_usage("rules", "2026-07-23")
        assert result["tokens"] == 300
        assert result["cost"] == 0.15

    async def test_memory_mode_missing_pillar_returns_zero(self, memory_governor):
        """内存模式:支柱不存在 → 返回 0。"""
        result = await memory_governor._get_pillar_usage("hook", "2026-07-23")
        assert result["tokens"] == 0
        assert result["cost"] == 0.0

    async def test_redis_success(self, memory_governor):
        """Redis 成功:返回 Redis 中的值。"""
        mock_redis = MagicMock()
        mock_redis.hget = AsyncMock(side_effect=["300", "0.15"])
        memory_governor._redis = mock_redis

        result = await memory_governor._get_pillar_usage("rules", "2026-07-23")
        assert result["tokens"] == 300
        assert result["cost"] == 0.15

    async def test_redis_failure_fallback_memory(self, memory_governor):
        """Redis 失败 → 降级到内存。"""
        pillar_key = _REDIS_KEY_PILLAR.format(pillar="rules", date="2026-07-23")
        memory_governor._memory_pillar["rules"] = {pillar_key: {"tokens": 777, "cost": 0.3}}

        mock_redis = MagicMock()
        mock_redis.hget = AsyncMock(side_effect=RuntimeError("redis down"))
        memory_governor._redis = mock_redis

        result = await memory_governor._get_pillar_usage("rules", "2026-07-23")
        assert result["tokens"] == 777


# =============================================================================
# _scan_records
# =============================================================================


class TestScanRecords:
    """_scan_records:扫描某周期的用量记录。"""

    def _make_record(self, minutes_ago: int, pillar: str = "rules") -> UsageRecord:
        """创建 N 分钟前的 UsageRecord。"""
        ts = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()
        return UsageRecord(
            pillar=pillar, model="gpt-4o",
            input_tokens=100, output_tokens=50,
            cost_usd=0.0075, timestamp=ts,
            request_id="req-1", action="auto_generate",
        )

    async def test_today_finds_recent_record(self, memory_governor):
        """today 周期:找到当天的记录。"""
        memory_governor._memory_usage.append(self._make_record(5))
        records = await memory_governor._scan_records("today")
        assert len(records) == 1
        assert records[0]["pillar"] == "rules"
        assert records[0]["model"] == "gpt-4o"

    async def test_hour_finds_recent_record(self, memory_governor):
        """hour 周期:找到当小时的记录。"""
        memory_governor._memory_usage.append(self._make_record(5))
        records = await memory_governor._scan_records("hour")
        assert len(records) == 1

    async def test_week_finds_recent_record(self, memory_governor):
        """week 周期:找到最近 7 天的记录。"""
        memory_governor._memory_usage.append(self._make_record(5))
        records = await memory_governor._scan_records("week")
        assert len(records) == 1

    async def test_unknown_period_uses_now_as_range(self, memory_governor):
        """未知 period:start=end=now,只有 timestamp 恰好等于 now 的才匹配(几乎无)。"""
        memory_governor._memory_usage.append(self._make_record(5))
        records = await memory_governor._scan_records("unknown")
        # 5 分钟前的记录不在 now 时刻范围内
        assert len(records) == 0

    async def test_empty_deque_returns_empty(self, memory_governor):
        """空 deque → 空列表。"""
        records = await memory_governor._scan_records("today")
        assert records == []

    async def test_invalid_timestamp_skipped(self, memory_governor):
        """无效 timestamp 的记录被跳过。"""
        bad_rec = UsageRecord(
            pillar="rules", model="gpt-4o", input_tokens=100, output_tokens=50,
            cost_usd=0.0075, timestamp="not-a-date", request_id="r", action="a",
        )
        memory_governor._memory_usage.append(bad_rec)
        records = await memory_governor._scan_records("today")
        assert len(records) == 0

    async def test_redis_success(self, memory_governor):
        """Redis 成功:从 sorted set 读取记录。"""
        member = json.dumps({
            "pillar": "rules", "model": "gpt-4o",
            "input_tokens": 100, "output_tokens": 50,
            "cost_usd": 0.0075, "timestamp": _now_iso(),
            "request_id": "r", "action": "a",
        })
        mock_redis = MagicMock()
        mock_redis.zrangebyscore = AsyncMock(return_value=[member])
        memory_governor._redis = mock_redis

        records = await memory_governor._scan_records("today")
        assert len(records) == 1
        assert records[0]["pillar"] == "rules"

    async def test_redis_invalid_member_skipped(self, memory_governor):
        """Redis 成员 JSON 解析失败 → 跳过。"""
        mock_redis = MagicMock()
        mock_redis.zrangebyscore = AsyncMock(return_value=["not-json", json.dumps({"valid": True})])
        memory_governor._redis = mock_redis

        records = await memory_governor._scan_records("today")
        assert len(records) == 1  # 只有 valid 那条

    async def test_redis_failure_fallback_memory(self, memory_governor):
        """Redis 失败 → 降级到内存 deque。"""
        memory_governor._memory_usage.append(self._make_record(5))
        mock_redis = MagicMock()
        mock_redis.zrangebyscore = AsyncMock(side_effect=RuntimeError("redis down"))
        memory_governor._redis = mock_redis

        records = await memory_governor._scan_records("today")
        assert len(records) == 1


# =============================================================================
# _emit_event
# =============================================================================


class TestEmitEvent:
    """_emit_event:发射事件到 orchestration_hub。"""

    async def test_import_failure_silent(self, memory_governor):
        """orchestration_hub import 失败 → 静默 return。"""
        # 临时移除模块让 import 失败
        with patch.dict(sys.modules, {"app.services.orchestration_hub": None}):
            # 不应抛异常
            await memory_governor._emit_event("test.event", {"k": "v"})

    async def test_no_emit_method_returns(self, memory_governor):
        """hub 无 emit_event / emit 方法 → return。"""
        mock_hub = MagicMock()
        mock_hub.emit_event = None
        mock_hub.emit = None
        with patch("app.services.orchestration_hub.orchestration_hub", mock_hub):
            await memory_governor._emit_event("test.event", {"k": "v"})

    async def test_sync_emit_event_called(self, memory_governor):
        """emit_event 是同步方法 → 直接调用。"""
        mock_hub = MagicMock()
        mock_hub.emit_event = MagicMock(return_value=None)
        with patch("app.services.orchestration_hub.orchestration_hub", mock_hub):
            await memory_governor._emit_event("test.event", {"k": "v"})
        mock_hub.emit_event.assert_called_once_with("test.event", {"k": "v"})

    async def test_async_emit_awaited(self, memory_governor):
        """emit 是异步方法 → await。"""
        mock_hub = MagicMock()
        mock_hub.emit_event = None  # 跳过 emit_event
        mock_emit = AsyncMock(return_value="event-id")
        mock_hub.emit = mock_emit
        with patch("app.services.orchestration_hub.orchestration_hub", mock_hub):
            await memory_governor._emit_event("test.event", {"k": "v"})
        mock_emit.assert_awaited_once_with("test.event", {"k": "v"})

    async def test_emit_exception_ignored(self, memory_governor):
        """emit 抛异常 → 忽略,不向外传播。"""
        mock_hub = MagicMock()
        mock_hub.emit_event = MagicMock(side_effect=RuntimeError("boom"))
        with patch("app.services.orchestration_hub.orchestration_hub", mock_hub):
            # 不应抛异常
            await memory_governor._emit_event("test.event", {"k": "v"})


# =============================================================================
# _pick_degrade_model
# =============================================================================


class TestPickDegradeModel:
    """_pick_degrade_model:从降级链选下一个更便宜的模型。"""

    def test_no_current_returns_second(self, memory_governor):
        """未降级 → 返回链中第 2 个(第一档降级)。"""
        # 默认链 ["gpt-4o", "gpt-4o-mini"]
        result = memory_governor._pick_degrade_model("rules")
        assert result == "gpt-4o-mini"

    def test_current_in_chain_returns_next(self, memory_governor):
        """当前已降级到链中某档 → 返回下一档。"""
        memory_governor.config.degrade_chain = ["a", "b", "c", "d"]
        memory_governor._degraded_models["rules"] = "b"
        result = memory_governor._pick_degrade_model("rules")
        assert result == "c"

    def test_at_chain_end_returns_last(self, memory_governor):
        """当前已在链尾 → 返回最后一个(最便宜档)。"""
        memory_governor.config.degrade_chain = ["a", "b", "c"]
        memory_governor._degraded_models["rules"] = "c"
        result = memory_governor._pick_degrade_model("rules")
        assert result == "c"

    def test_current_not_in_chain_returns_last(self, memory_governor):
        """当前降级模型不在链中 → 返回最便宜档。"""
        memory_governor.config.degrade_chain = ["a", "b", "c"]
        memory_governor._degraded_models["rules"] = "zzz"
        result = memory_governor._pick_degrade_model("rules")
        assert result == "c"

    def test_empty_chain_returns_none(self, memory_governor):
        """空链 → None。"""
        memory_governor.config.degrade_chain = []
        result = memory_governor._pick_degrade_model("rules")
        assert result is None

    def test_short_chain_returns_none(self, memory_governor):
        """长度 < 2 的链 → None。"""
        memory_governor.config.degrade_chain = ["only-one"]
        result = memory_governor._pick_degrade_model("rules")
        assert result is None


# =============================================================================
# record_usage
# =============================================================================


class TestRecordUsage:
    """record_usage:记录一次 LLM 调用用量。"""

    async def test_basic_record(self, memory_governor):
        """基础记录:返回 UsageRecord,字段正确。"""
        rec = await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=1000, output_tokens=500,
            action="auto_generate", request_id="req-1",
        )
        assert isinstance(rec, UsageRecord)
        assert rec.pillar == "rules"
        assert rec.model == "gpt-4o"
        assert rec.input_tokens == 1000
        assert rec.output_tokens == 500
        assert rec.action == "auto_generate"
        assert rec.request_id == "req-1"
        assert rec.cost_usd > 0

    async def test_unknown_pillar_still_recorded(self, memory_governor):
        """未知支柱仍记录(只 warning)。"""
        rec = await memory_governor.record_usage(
            pillar="unknown_pillar", model="gpt-4o",
            input_tokens=100, output_tokens=50,
            action="test", request_id="r",
        )
        assert rec.pillar == "unknown_pillar"
        # 未知支柱也会被 append 到 _memory_usage
        assert len(memory_governor._memory_usage) == 1

    async def test_with_request_id(self, memory_governor):
        """提供 request_id → 使用提供的。"""
        rec = await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=100, output_tokens=50,
            action="test", request_id="custom-id",
        )
        assert rec.request_id == "custom-id"

    async def test_without_request_id_generates_uuid(self, memory_governor):
        """无 request_id → 自动生成 uuid hex。"""
        rec = await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=100, output_tokens=50,
            action="test",
        )
        assert rec.request_id  # 非空
        assert len(rec.request_id) == 32  # uuid4 hex 长度

    async def test_records_to_memory_deque(self, memory_governor):
        """内存模式:记录追加到 _memory_usage。"""
        await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=100, output_tokens=50,
            action="test", request_id="r",
        )
        assert len(memory_governor._memory_usage) == 1
        assert memory_governor._memory_usage[0].pillar == "rules"

    async def test_incr_usage_called(self, memory_governor):
        """record_usage 累加 daily/hourly/pillar 用量。"""
        await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=1000, output_tokens=500,
            action="test", request_id="r",
        )
        daily_key = _REDIS_KEY_DAILY.format(date=_today_key())
        # total_tokens = 1500
        assert memory_governor._memory_daily[daily_key]["tokens"] == 1500

    async def test_redis_zadd_called(self, memory_governor):
        """Redis 可用时:zadd 写 sorted set。"""
        mock_redis = MagicMock()
        mock_redis.zadd = AsyncMock(return_value=1)
        memory_governor._redis = mock_redis

        await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=100, output_tokens=50,
            action="test", request_id="r",
        )
        mock_redis.zadd.assert_awaited_once()
        # 不应 append 到 _memory_usage
        assert len(memory_governor._memory_usage) == 0

    async def test_redis_zadd_failure_fallback_memory(self, memory_governor):
        """Redis zadd 失败 → 降级到内存 deque。"""
        mock_redis = MagicMock()
        mock_redis.zadd = AsyncMock(side_effect=RuntimeError("redis down"))
        memory_governor._redis = mock_redis

        await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=100, output_tokens=50,
            action="test", request_id="r",
        )
        assert len(memory_governor._memory_usage) == 1


# =============================================================================
# check_budget
# =============================================================================


class TestCheckBudget:
    """check_budget:检查预算是否允许调用。"""

    async def test_under_warning_no_event(self, memory_governor):
        """用量 < warning_threshold → 允许,无降级,无事件。"""
        memory_governor._emit_event = AsyncMock()
        # mock 用量读取:50% 用量
        memory_governor._get_period_usage = AsyncMock(side_effect=[
            {"tokens": 1_000_000, "cost": 0.0},  # daily 50%
            {"tokens": 0, "cost": 0.0},           # hourly
        ])
        memory_governor._get_pillar_usage = AsyncMock(return_value={"tokens": 0, "cost": 0.0})

        result = await memory_governor.check_budget("rules")
        assert result.allowed is True
        assert result.degrade_to_model is None
        assert result.usage_percent == 0.5
        assert "预算充足" in result.reason
        memory_governor._emit_event.assert_not_awaited()

    async def test_warning_threshold_emits_warning(self, memory_governor):
        """用量 >= warning_threshold(0.8) → 发 budget.warning 事件。"""
        memory_governor._emit_event = AsyncMock()
        memory_governor._get_period_usage = AsyncMock(side_effect=[
            {"tokens": 1_700_000, "cost": 0.0},  # daily 85%
            {"tokens": 0, "cost": 0.0},
        ])
        memory_governor._get_pillar_usage = AsyncMock(return_value={"tokens": 0, "cost": 0.0})

        result = await memory_governor.check_budget("rules")
        assert result.allowed is True
        assert result.usage_percent == 0.85
        memory_governor._emit_event.assert_awaited_once_with(
            "budget.warning",
            {"pillar": "rules", "usage_percent": 0.85},
        )

    async def test_auto_degrade_triggers_degrade(self, memory_governor):
        """用量 >= auto_degrade_at(0.9) → 返回 degrade_to_model。"""
        memory_governor._emit_event = AsyncMock()
        memory_governor._get_period_usage = AsyncMock(side_effect=[
            {"tokens": 1_900_000, "cost": 0.0},  # daily 95%... 等等,95% 是 critical
            {"tokens": 0, "cost": 0.0},
        ])
        memory_governor._get_pillar_usage = AsyncMock(return_value={"tokens": 0, "cost": 0.0})

        # 用 0.92 避免触发 critical(0.95)
        memory_governor._get_period_usage = AsyncMock(side_effect=[
            {"tokens": 1_840_000, "cost": 0.0},  # daily 92%
            {"tokens": 0, "cost": 0.0},
        ])

        result = await memory_governor.check_budget("rules")
        assert result.allowed is True
        assert result.degrade_to_model is not None
        assert "降级" in result.reason
        # 应发 degrade 事件 + warning 事件
        event_types = [call.args[0] for call in memory_governor._emit_event.await_args_list]
        assert "budget.degrade" in event_types
        assert "budget.warning" in event_types

    async def test_critical_threshold_emits_critical(self, memory_governor):
        """用量 >= critical_threshold(0.95) → 发 budget.critical 事件。"""
        memory_governor._emit_event = AsyncMock()
        memory_governor._get_period_usage = AsyncMock(side_effect=[
            {"tokens": 1_960_000, "cost": 0.0},  # daily 98%
            {"tokens": 0, "cost": 0.0},
        ])
        memory_governor._get_pillar_usage = AsyncMock(return_value={"tokens": 0, "cost": 0.0})

        result = await memory_governor.check_budget("rules")
        assert result.allowed is True  # 98% < 100% hard_stop
        event_types = [call.args[0] for call in memory_governor._emit_event.await_args_list]
        assert "budget.critical" in event_types

    async def test_hard_stop_disallows(self, memory_governor):
        """用量 >= hard_stop_at(1.0) → allowed=False。"""
        memory_governor._emit_event = AsyncMock()
        memory_governor._get_period_usage = AsyncMock(side_effect=[
            {"tokens": 2_000_000, "cost": 0.0},  # daily 100%
            {"tokens": 0, "cost": 0.0},
        ])
        memory_governor._get_pillar_usage = AsyncMock(return_value={"tokens": 0, "cost": 0.0})

        result = await memory_governor.check_budget("rules")
        assert result.allowed is False
        assert result.degrade_to_model is None
        assert "硬停止" in result.reason
        assert result.remaining_tokens == 0
        # 硬停止只发 critical(在 return 前)
        memory_governor._emit_event.assert_awaited_once()
        assert memory_governor._emit_event.await_args.args[0] == "budget.critical"

    async def test_pillar_usage_triggers_degrade(self, memory_governor):
        """支柱用量 >= auto_degrade_at → 触发降级(即使全局用量低)。"""
        memory_governor._emit_event = AsyncMock()
        memory_governor._get_period_usage = AsyncMock(side_effect=[
            {"tokens": 100_000, "cost": 0.0},  # daily 5%(全局低)
            {"tokens": 0, "cost": 0.0},
        ])
        # rules 支柱分配 10% = 200,000 tokens,用 95% 触发降级
        memory_governor._get_pillar_usage = AsyncMock(return_value={"tokens": 190_000, "cost": 0.0})

        result = await memory_governor.check_budget("rules")
        assert result.allowed is True
        assert result.degrade_to_model is not None
        assert result.pillar_usage_percent == pytest.approx(0.95, abs=0.01)

    async def test_unknown_pillar_zero_ratio(self, memory_governor):
        """未知支柱:pillar_ratio=0 → pillar_usage_percent=0。"""
        memory_governor._emit_event = AsyncMock()
        memory_governor._get_period_usage = AsyncMock(side_effect=[
            {"tokens": 100_000, "cost": 0.0},
            {"tokens": 0, "cost": 0.0},
        ])
        memory_governor._get_pillar_usage = AsyncMock(return_value={"tokens": 0, "cost": 0.0})

        result = await memory_governor.check_budget("unknown_pillar")
        assert result.pillar_usage_percent == 0.0

    async def test_cost_pct_dominates(self, memory_governor):
        """cost_pct > token_pct → usage_percent = cost_pct。"""
        memory_governor._emit_event = AsyncMock()
        memory_governor._get_period_usage = AsyncMock(side_effect=[
            {"tokens": 100_000, "cost": 9.0},  # token 5%, cost 90%
            {"tokens": 0, "cost": 0.0},
        ])
        memory_governor._get_pillar_usage = AsyncMock(return_value={"tokens": 0, "cost": 0.0})

        result = await memory_governor.check_budget("rules")
        assert result.usage_percent == 0.9  # cost 90% 主导

    async def test_hourly_pct_dominates(self, memory_governor):
        """hourly_pct > daily_pct → usage_percent = hourly_pct。"""
        memory_governor._emit_event = AsyncMock()
        memory_governor._get_period_usage = AsyncMock(side_effect=[
            {"tokens": 100_000, "cost": 0.0},   # daily 5%
            {"tokens": 180_000, "cost": 0.0},   # hourly 90%
        ])
        memory_governor._get_pillar_usage = AsyncMock(return_value={"tokens": 0, "cost": 0.0})

        result = await memory_governor.check_budget("rules")
        assert result.usage_percent == 0.9  # hourly 90% 主导


# =============================================================================
# get_usage_summary
# =============================================================================


class TestUsageSummary:
    """get_usage_summary:用量汇总。"""

    async def test_today_summary(self, memory_governor):
        """today 汇总:返回 total_tokens/cost/by_pillar/by_model。"""
        await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=1000, output_tokens=500,
            action="auto_generate", request_id="r1",
        )
        summary = await memory_governor.get_usage_summary("today")
        assert summary["total_tokens"] == 1500
        assert summary["total_cost"] > 0
        assert "rules" in summary["by_pillar"]
        assert "gpt-4o" in summary["by_model"]
        assert summary["by_pillar"]["rules"]["tokens"] == 1500
        assert summary["by_model"]["gpt-4o"]["tokens"] == 1500
        assert summary["limit"]["tokens"] == 2_000_000

    async def test_hour_summary(self, memory_governor):
        """hour 汇总:limit_cost = daily_cost / 24。"""
        await memory_governor.record_usage(
            pillar="hook", model="gpt-4o-mini",
            input_tokens=200, output_tokens=100,
            action="orchestrate", request_id="r2",
        )
        summary = await memory_governor.get_usage_summary("hour")
        assert summary["total_tokens"] == 300
        assert summary["limit"]["tokens"] == 200_000
        assert summary["limit"]["cost"] == 10.0 / 24.0

    async def test_week_summary(self, memory_governor):
        """week 汇总:limit = daily * 7。"""
        await memory_governor.record_usage(
            pillar="spec", model="gpt-4o",
            input_tokens=500, output_tokens=500,
            action="split", request_id="r3",
        )
        summary = await memory_governor.get_usage_summary("week")
        assert summary["total_tokens"] == 1000
        assert summary["limit"]["tokens"] == 2_000_000 * 7
        assert summary["limit"]["cost"] == 10.0 * 7

    async def test_pillar_alias(self, memory_governor):
        """period='pillar:rules' → 调用 get_pillar_budget。"""
        await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=1000, output_tokens=0,
            action="test", request_id="r4",
        )
        summary = await memory_governor.get_usage_summary("pillar:rules")
        assert summary["pillar"] == "rules"
        assert summary["used_tokens"] == 1000

    async def test_unknown_period_returns_error(self, memory_governor):
        """未知 period → 返回 {"error": ...}。"""
        result = await memory_governor.get_usage_summary("unknown")
        assert "error" in result
        assert "unknown" in result["error"]


# =============================================================================
# get_usage_trend
# =============================================================================


class TestUsageTrend:
    """get_usage_trend:用量趋势。"""

    async def test_default_7_days(self, memory_governor):
        """默认 7 天:返回 7 条记录。"""
        trend = await memory_governor.get_usage_trend()
        assert len(trend) == 7
        # 每条都有 date/tokens/cost/by_pillar
        for item in trend:
            assert "date" in item
            assert "tokens" in item
            assert "cost" in item
            assert "by_pillar" in item

    async def test_custom_days(self, memory_governor):
        """自定义天数。"""
        trend = await memory_governor.get_usage_trend(3)
        assert len(trend) == 3

    async def test_trend_includes_today_data(self, memory_governor):
        """趋势包含今天的数据。"""
        await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=1000, output_tokens=500,
            action="test", request_id="r1",
        )
        trend = await memory_governor.get_usage_trend(1)
        assert len(trend) == 1
        assert trend[0]["tokens"] == 1500
        assert "rules" in trend[0]["by_pillar"]

    async def test_trend_ordering(self, memory_governor):
        """趋势按日期从旧到新排序(7 天前 → 今天)。"""
        trend = await memory_governor.get_usage_trend(3)
        # 第一条是 2 天前,最后一条是今天
        assert trend[0]["date"] == _date_from_days_ago(2)
        assert trend[-1]["date"] == _today_key()


# =============================================================================
# get_pillar_budget
# =============================================================================


class TestPillarBudget:
    """get_pillar_budget:单支柱预算详情。"""

    async def test_basic_pillar_budget(self, memory_governor):
        """已知支柱:返回分配限额 + 已用 + 剩余。"""
        await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=100_000, output_tokens=0,
            action="test", request_id="r1",
        )
        budget = await memory_governor.get_pillar_budget("rules")
        assert budget["pillar"] == "rules"
        # rules 分配 10% = 200,000 tokens
        assert budget["allocated_limit"]["tokens"] == 200_000
        assert budget["used_tokens"] == 100_000
        assert budget["remaining"]["tokens"] == 100_000
        assert budget["usage_percent"] == 0.5
        assert budget["degraded_model"] is None

    async def test_unknown_pillar_zero_allocation(self, memory_governor):
        """未知支柱:分配 0,usage_percent=0。"""
        budget = await memory_governor.get_pillar_budget("nonexistent")
        assert budget["pillar"] == "nonexistent"
        assert budget["allocated_limit"]["tokens"] == 0
        assert budget["used_tokens"] == 0
        assert budget["usage_percent"] == 0.0

    async def test_degraded_model_reflected(self, memory_governor):
        """已降级支柱:degraded_model 字段反映当前降级状态。"""
        memory_governor._degraded_models["rules"] = "gpt-4o-mini"
        budget = await memory_governor.get_pillar_budget("rules")
        assert budget["degraded_model"] == "gpt-4o-mini"


# =============================================================================
# reset_degradation
# =============================================================================


class TestResetDegradation:
    """reset_degradation:重置支柱降级状态。"""

    async def test_reset_existing(self, memory_governor):
        """支柱已降级 → 重置成功,返回 True。"""
        memory_governor._degraded_models["rules"] = "gpt-4o-mini"
        memory_governor._emit_event = AsyncMock()
        result = await memory_governor.reset_degradation("rules")
        assert result is True
        assert "rules" not in memory_governor._degraded_models

    async def test_reset_nonexistent(self, memory_governor):
        """支柱未降级 → 返回 False。"""
        memory_governor._emit_event = AsyncMock()
        result = await memory_governor.reset_degradation("rules")
        assert result is False

    async def test_reset_emits_event(self, memory_governor):
        """重置时发射 budget.degrade_reset 事件。"""
        memory_governor._degraded_models["rules"] = "gpt-4o-mini"
        memory_governor._emit_event = AsyncMock()
        await memory_governor.reset_degradation("rules")
        memory_governor._emit_event.assert_awaited_once_with(
            "budget.degrade_reset", {"pillar": "rules"},
        )


# =============================================================================
# update_config
# =============================================================================


class TestUpdateConfig:
    """update_config:更新预算配置。"""

    async def test_partial_update(self, memory_governor):
        """部分更新:只更新提供的字段。"""
        original_hourly = memory_governor.config.hourly_token_limit
        await memory_governor.update_config({"daily_token_limit": 999_999})
        assert memory_governor.config.daily_token_limit == 999_999
        assert memory_governor.config.hourly_token_limit == original_hourly

    async def test_update_all_scalar_fields(self, memory_governor):
        """更新所有标量字段。"""
        await memory_governor.update_config({
            "daily_token_limit": 500_000,
            "daily_cost_limit_usd": 5.0,
            "hourly_token_limit": 50_000,
            "warning_threshold": 0.7,
            "critical_threshold": 0.85,
            "auto_degrade_at": 0.8,
            "hard_stop_at": 0.95,
        })
        assert memory_governor.config.daily_token_limit == 500_000
        assert memory_governor.config.daily_cost_limit_usd == 5.0
        assert memory_governor.config.hourly_token_limit == 50_000
        assert memory_governor.config.warning_threshold == 0.7
        assert memory_governor.config.critical_threshold == 0.85
        assert memory_governor.config.auto_degrade_at == 0.8
        assert memory_governor.config.hard_stop_at == 0.95

    async def test_update_pillar_ratios(self, memory_governor):
        """更新 pillar_ratios(总和=1.0)。"""
        new_ratios = {"rules": 0.5, "hook": 0.1, "spec": 0.1, "context": 0.1, "subagent": 0.1, "terminal": 0.1}
        await memory_governor.update_config({"pillar_ratios": new_ratios})
        assert memory_governor.config.pillar_ratios == new_ratios

    async def test_update_pillar_ratios_imbalanced_still_accepted(self, memory_governor):
        """pillar_ratios 总和偏离 1.0 > 0.05 → 仍接受(只 warning)。"""
        bad_ratios = {"rules": 0.9, "hook": 0.1}  # 总和 1.0,但只 2 个支柱
        await memory_governor.update_config({"pillar_ratios": bad_ratios})
        assert memory_governor.config.pillar_ratios == bad_ratios

    async def test_update_model_cost_table_merge(self, memory_governor):
        """model_cost_table 用 update 合并(不替换)。"""
        original_default = memory_governor.config.model_cost_table["default"]
        await memory_governor.update_config({
            "model_cost_table": {"new-model": {"input": 0.001, "output": 0.002}},
        })
        assert "new-model" in memory_governor.config.model_cost_table
        assert "default" in memory_governor.config.model_cost_table  # 原有保留
        assert memory_governor.config.model_cost_table["default"] == original_default

    async def test_update_degrade_chain_replace(self, memory_governor):
        """degrade_chain 用 list 替换。"""
        new_chain = ["model-a", "model-b", "model-c"]
        await memory_governor.update_config({"degrade_chain": new_chain})
        assert memory_governor.config.degrade_chain == new_chain

    async def test_update_config_redis_persist(self, memory_governor):
        """Redis 可用时:配置持久化到 Redis hash。"""
        mock_redis = MagicMock()
        mock_redis.hset = AsyncMock(return_value=1)
        memory_governor._redis = mock_redis

        await memory_governor.update_config({"daily_token_limit": 888_888})
        mock_redis.hset.assert_awaited_once()
        call_kwargs = mock_redis.hset.await_args
        assert call_kwargs.args[0] == _REDIS_KEY_CONFIG
        mapping = call_kwargs.kwargs["mapping"]
        assert mapping["daily_token_limit"] == "888888"

    async def test_update_config_redis_failure_ignored(self, memory_governor):
        """Redis 持久化失败 → 忽略,配置仍更新。"""
        mock_redis = MagicMock()
        mock_redis.hset = AsyncMock(side_effect=RuntimeError("redis down"))
        memory_governor._redis = mock_redis

        # 不应抛异常
        await memory_governor.update_config({"daily_token_limit": 777_777})
        assert memory_governor.config.daily_token_limit == 777_777


# =============================================================================
# get_cost_breakdown
# =============================================================================


class TestCostBreakdown:
    """get_cost_breakdown:成本分解(按支柱/模型/action)。"""

    async def test_empty_breakdown(self, memory_governor):
        """无记录 → 空分解,total=0。"""
        result = await memory_governor.get_cost_breakdown("today")
        assert result["by_pillar"] == {}
        assert result["by_model"] == {}
        assert result["by_action"] == {}
        assert result["total"]["tokens"] == 0
        assert result["total"]["cost"] == 0.0

    async def test_breakdown_with_records(self, memory_governor):
        """有记录 → 按支柱/模型/action 分解。"""
        await memory_governor.record_usage(
            pillar="rules", model="gpt-4o",
            input_tokens=1000, output_tokens=500,
            action="auto_generate", request_id="r1",
        )
        await memory_governor.record_usage(
            pillar="hook", model="gpt-4o-mini",
            input_tokens=200, output_tokens=100,
            action="orchestrate", request_id="r2",
        )
        result = await memory_governor.get_cost_breakdown("today")
        assert "rules" in result["by_pillar"]
        assert "hook" in result["by_pillar"]
        assert "gpt-4o" in result["by_model"]
        assert "gpt-4o-mini" in result["by_model"]
        assert "auto_generate" in result["by_action"]
        assert "orchestrate" in result["by_action"]
        # total = 1500 + 300 = 1800
        assert result["total"]["tokens"] == 1800
        assert result["total"]["cost"] > 0


# =============================================================================
# with_budget 装饰器
# =============================================================================


class TestWithBudget:
    """with_budget 装饰器:自动 check + record。"""

    async def test_allowed_no_usage_recorded(self):
        """预算充足,函数返回无用量信息 → 不记录用量。"""
        mock_check = BudgetCheckResult(
            allowed=True, degrade_to_model=None, reason="预算充足",
            usage_percent=0.5, pillar_usage_percent=0.3,
            remaining_tokens=1000, remaining_cost_usd=5.0,
        )
        mock_record = AsyncMock()

        with patch.object(lbg_module.llm_budget_governor, "check_budget",
                          AsyncMock(return_value=mock_check)):
            with patch.object(lbg_module.llm_budget_governor, "record_usage", mock_record):
                @with_budget("rules", "auto_generate")
                async def my_func():
                    return {"status": "ok"}  # 无 model/input_tokens/output_tokens

                result = await my_func()
                assert result == {"status": "ok"}
                mock_record.assert_not_awaited()

    async def test_exceeded_raises_error(self):
        """预算超限 → 抛 BudgetExceededError。"""
        mock_check = BudgetCheckResult(
            allowed=False, degrade_to_model=None, reason="已达硬停止",
            usage_percent=1.0, pillar_usage_percent=0.5,
            remaining_tokens=0, remaining_cost_usd=0.0,
        )

        with patch.object(lbg_module.llm_budget_governor, "check_budget",
                          AsyncMock(return_value=mock_check)):
            @with_budget("rules", "auto_generate")
            async def my_func():
                return {"should": "not be called"}

            with pytest.raises(BudgetExceededError) as exc_info:
                await my_func()
            assert "预算超限" in str(exc_info.value)
            assert exc_info.value.usage_percent == 1.0
            assert exc_info.value.remaining_tokens == 0

    async def test_records_usage_with_model_tokens(self):
        """函数返回含 model/input_tokens/output_tokens → 记录用量。"""
        mock_check = BudgetCheckResult(
            allowed=True, degrade_to_model=None, reason="预算充足",
            usage_percent=0.5, pillar_usage_percent=0.3,
            remaining_tokens=1000, remaining_cost_usd=5.0,
        )
        mock_record = AsyncMock()

        with patch.object(lbg_module.llm_budget_governor, "check_budget",
                          AsyncMock(return_value=mock_check)):
            with patch.object(lbg_module.llm_budget_governor, "record_usage", mock_record):
                @with_budget("rules", "auto_generate")
                async def my_func():
                    return {
                        "model": "gpt-4o",
                        "input_tokens": 1000,
                        "output_tokens": 500,
                        "request_id": "req-123",
                    }

                await my_func()
                mock_record.assert_awaited_once()
                kwargs = mock_record.await_args.kwargs
                assert kwargs["pillar"] == "rules"
                assert kwargs["model"] == "gpt-4o"
                assert kwargs["input_tokens"] == 1000
                assert kwargs["output_tokens"] == 500
                assert kwargs["action"] == "auto_generate"
                assert kwargs["request_id"] == "req-123"

    async def test_records_usage_with_llm_model_aliases(self):
        """函数返回含 llm_model/prompt_tokens/completion_tokens → 也记录。"""
        mock_check = BudgetCheckResult(
            allowed=True, degrade_to_model=None, reason="预算充足",
            usage_percent=0.5, pillar_usage_percent=0.3,
            remaining_tokens=1000, remaining_cost_usd=5.0,
        )
        mock_record = AsyncMock()

        with patch.object(lbg_module.llm_budget_governor, "check_budget",
                          AsyncMock(return_value=mock_check)):
            with patch.object(lbg_module.llm_budget_governor, "record_usage", mock_record):
                @with_budget("hook", "orchestrate")
                async def my_func():
                    return {
                        "llm_model": "claude-3-opus",
                        "prompt_tokens": 200,
                        "completion_tokens": 100,
                    }

                await my_func()
                mock_record.assert_awaited_once()
                kwargs = mock_record.await_args.kwargs
                assert kwargs["model"] == "claude-3-opus"
                assert kwargs["input_tokens"] == 200
                assert kwargs["output_tokens"] == 100
                assert kwargs["action"] == "orchestrate"

    async def test_no_record_when_missing_output_tokens(self):
        """函数返回缺 output_tokens → 不记录。"""
        mock_check = BudgetCheckResult(
            allowed=True, degrade_to_model=None, reason="预算充足",
            usage_percent=0.5, pillar_usage_percent=0.3,
            remaining_tokens=1000, remaining_cost_usd=5.0,
        )
        mock_record = AsyncMock()

        with patch.object(lbg_module.llm_budget_governor, "check_budget",
                          AsyncMock(return_value=mock_check)):
            with patch.object(lbg_module.llm_budget_governor, "record_usage", mock_record):
                @with_budget("rules", "auto_generate")
                async def my_func():
                    return {"model": "gpt-4o", "input_tokens": 100}  # 缺 output_tokens

                await my_func()
                mock_record.assert_not_awaited()

    async def test_non_dict_result_not_recorded(self):
        """函数返回非 dict → 不记录用量。"""
        mock_check = BudgetCheckResult(
            allowed=True, degrade_to_model=None, reason="预算充足",
            usage_percent=0.5, pillar_usage_percent=0.3,
            remaining_tokens=1000, remaining_cost_usd=5.0,
        )
        mock_record = AsyncMock()

        with patch.object(lbg_module.llm_budget_governor, "check_budget",
                          AsyncMock(return_value=mock_check)):
            with patch.object(lbg_module.llm_budget_governor, "record_usage", mock_record):
                @with_budget("rules", "auto_generate")
                async def my_func():
                    return "string-result"

                result = await my_func()
                assert result == "string-result"
                mock_record.assert_not_awaited()

    async def test_check_budget_called_with_pillar(self):
        """check_budget 用装饰器指定的 pillar 调用。"""
        mock_check = BudgetCheckResult(
            allowed=True, degrade_to_model=None, reason="",
            usage_percent=0.0, pillar_usage_percent=0.0,
            remaining_tokens=0, remaining_cost_usd=0.0,
        )
        mock_check_fn = AsyncMock(return_value=mock_check)

        with patch.object(lbg_module.llm_budget_governor, "check_budget", mock_check_fn):
            with patch.object(lbg_module.llm_budget_governor, "record_usage", AsyncMock()):
                @with_budget("terminal", "diagnose")
                async def my_func():
                    return {"model": "gpt-4o", "input_tokens": 1, "output_tokens": 1}

                await my_func()
                mock_check_fn.assert_awaited_once_with("terminal")


# =============================================================================
# 模块级单例
# =============================================================================


class TestModuleSingleton:
    """模块级单例 llm_budget_governor。"""

    def test_singleton_is_instance(self):
        """模块级 llm_budget_governor 是 LLMBudgetGovernor 实例。"""
        assert isinstance(llm_budget_governor, LLMBudgetGovernor)

    def test_singleton_has_default_config(self):
        """单例使用默认 BudgetConfig。"""
        assert isinstance(llm_budget_governor.config, BudgetConfig)
        assert llm_budget_governor.config.daily_token_limit == 2_000_000

    def test_singleton_importable(self):
        """单例可从模块直接 import。"""
        from app.services.llm_budget_governor import llm_budget_governor as gov
        assert gov is llm_budget_governor

    def test_with_budget_decorator_callable(self):
        """with_budget 是可调用函数。"""
        assert callable(with_budget)

    def test_with_budget_returns_decorator(self):
        """with_budget(pillar, action) 返回装饰器。"""
        deco = with_budget("rules", "auto_generate")
        assert callable(deco)

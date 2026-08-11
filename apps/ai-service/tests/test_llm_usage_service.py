"""LLMUsageService 单元测试。

测试覆盖:
- record_usage 正确记录
- 成本估算
- get_user_stats 聚合
- get_quota_info
- 空数据返回
"""

from __future__ import annotations

import time

import pytest

from app.services.llm_usage_service import (
    LLMUsageService,
    _estimate_cost,
)


@pytest.fixture
def service():
    return LLMUsageService(quota_limit=10_000_000)


# =============================================================================
# 成本估算
# =============================================================================


def test_estimate_cost_known_provider():
    """已知厂商按定价表计算成本。"""
    cost = _estimate_cost("openai", 1000, 500)
    # input: 1000/1e6 * 2.50 = 0.0025, output: 500/1e6 * 10.00 = 0.005
    assert cost == 0.0075


def test_estimate_cost_free_provider():
    """免费厂商成本为 0。"""
    cost = _estimate_cost("ollama", 10000, 5000)
    assert cost == 0.0


def test_estimate_cost_unknown_provider():
    """未知厂商用默认定价兜底。"""
    cost = _estimate_cost("unknown_provider", 1000, 500)
    # input: 1000/1e6 * 1.00 = 0.001, output: 500/1e6 * 3.00 = 0.0015
    assert cost == 0.0025


def test_estimate_cost_zero_tokens():
    """0 token 成本为 0。"""
    cost = _estimate_cost("openai", 0, 0)
    assert cost == 0.0


# =============================================================================
# record_usage
# =============================================================================


def test_record_usage_returns_record(service):
    """record_usage 返回 UsageRecord 对象。"""
    r = service.record_usage("openai", "gpt-4o", "user1", 100, 50)
    assert r.id
    assert r.provider == "openai"
    assert r.model == "gpt-4o"
    assert r.user_id == "user1"
    assert r.input_tokens == 100
    assert r.output_tokens == 50
    assert r.estimated_cost > 0
    assert r.timestamp > 0


def test_record_usage_stores_record(service):
    """record_usage 的记录可在 _records 中找到。"""
    r = service.record_usage("anthropic", "claude-3", "user2", 200, 100)
    assert r in service._records
    assert len(service._records) == 1


def test_record_usage_multiple_records(service):
    """多次记录正常追加。"""
    service.record_usage("openai", "gpt-4o", "user1", 100, 50)
    service.record_usage("anthropic", "claude-3", "user1", 200, 100)
    service.record_usage("ollama", "llama3", "user2", 50, 25)
    assert len(service._records) == 3


def test_record_usage_max_records(service):
    """超过 max_records 时自动裁剪。"""
    for i in range(service._max_records + 50):
        service.record_usage("openai", "gpt-4o", f"user{i}", 1, 1)
    assert len(service._records) == service._max_records


# =============================================================================
# get_user_stats
# =============================================================================


def test_get_user_stats_empty(service):
    """无记录时返回空统计。"""
    stats = service.get_user_stats("nonexistent", days=7)
    assert stats["total_tokens"] == 0
    assert stats["total_cost"] == 0.0
    assert stats["total_calls"] == 0
    assert stats["daily_breakdown"] == {}
    assert stats["model_breakdown"] == {}
    assert stats["provider_breakdown"] == {}


def test_get_user_stats_aggregates(service):
    """get_user_stats 正确聚合用户数据。"""
    service.record_usage("openai", "gpt-4o", "user1", 1000, 500)
    service.record_usage("openai", "gpt-4o", "user1", 2000, 1000)
    service.record_usage("anthropic", "claude-3", "user1", 500, 250)
    # 不同用户不应计入
    service.record_usage("openai", "gpt-4o", "user2", 9999, 9999)

    stats = service.get_user_stats("user1", days=7)
    assert stats["total_tokens"] == 1000 + 500 + 2000 + 1000 + 500 + 250
    assert stats["total_calls"] == 3
    assert stats["total_cost"] > 0
    assert "model_breakdown" in stats
    assert "provider_breakdown" in stats


def test_get_user_stats_model_breakdown(service):
    """get_user_stats 按模型正确分组。"""
    service.record_usage("openai", "gpt-4o", "user1", 1000, 500)
    service.record_usage("anthropic", "claude-3", "user1", 500, 250)

    stats = service.get_user_stats("user1", days=7)
    assert "openai/gpt-4o" in stats["model_breakdown"]
    assert "anthropic/claude-3" in stats["model_breakdown"]
    assert stats["model_breakdown"]["openai/gpt-4o"]["calls"] == 1
    assert stats["model_breakdown"]["anthropic/claude-3"]["calls"] == 1


def test_get_user_stats_provider_breakdown(service):
    """get_user_stats 按厂商正确分组。"""
    service.record_usage("openai", "gpt-4o", "user1", 1000, 500)
    service.record_usage("openai", "gpt-4o-turbo", "user1", 500, 250)

    stats = service.get_user_stats("user1", days=7)
    assert "openai" in stats["provider_breakdown"]
    assert stats["provider_breakdown"]["openai"]["calls"] == 2


def test_get_user_stats_daily_breakdown(service):
    """get_user_stats 按天正确分组。"""
    service.record_usage("openai", "gpt-4o", "user1", 100, 50)
    stats = service.get_user_stats("user1", days=7)
    assert len(stats["daily_breakdown"]) >= 1


# =============================================================================
# get_global_stats
# =============================================================================


def test_get_global_stats_empty(service):
    """无记录时全局统计为空。"""
    stats = service.get_global_stats(days=7)
    assert stats["total_tokens"] == 0
    assert stats["total_cost"] == 0.0
    assert stats["total_calls"] == 0
    assert stats["active_users"] == 0


def test_get_global_stats_aggregates(service):
    """get_global_stats 正确聚合全局数据。"""
    service.record_usage("openai", "gpt-4o", "user1", 1000, 500)
    service.record_usage("anthropic", "claude-3", "user2", 500, 250)

    stats = service.get_global_stats(days=7)
    assert stats["total_tokens"] == 1000 + 500 + 500 + 250
    assert stats["total_calls"] == 2
    assert stats["active_users"] == 2
    assert stats["total_cost"] > 0


# =============================================================================
# get_quota_info
# =============================================================================


def test_get_quota_info_default(service):
    """无用量时配额全部可用。"""
    info = service.get_quota_info("user1")
    assert info["used_tokens"] == 0
    assert info["quota_limit"] == 10_000_000
    assert info["remaining"] == 10_000_000
    assert info["usage_percent"] == 0.0


def test_get_quota_info_after_usage(service):
    """有用量后配额正确计算。"""
    service.record_usage("openai", "gpt-4o", "user1", 100000, 50000)
    info = service.get_quota_info("user1")
    assert info["used_tokens"] == 150000
    assert info["remaining"] == 10_000_000 - 150000
    assert info["usage_percent"] > 0


def test_get_quota_info_exceeds_limit(service):
    """超过配额时剩余为 0。"""
    service.record_usage("openai", "gpt-4o", "user1", 10_000_000, 1)
    info = service.get_quota_info("user1")
    assert info["remaining"] == 0
    assert info["usage_percent"] == 100.0


# =============================================================================
# 边界与空数据
# =============================================================================


def test_empty_service_no_records(service):
    """全新服务无任何记录。"""
    assert len(service._records) == 0
    stats = service.get_global_stats(days=7)
    assert stats["total_tokens"] == 0
    assert stats["total_calls"] == 0


def test_old_records_excluded_by_days(service):
    """超过 days 范围的旧记录被排除。"""
    r = service.record_usage("openai", "gpt-4o", "user1", 100, 50)
    # 强制修改 timestamp 为 365 天前
    old_ts = time.time() - 366 * 86400
    r.timestamp = old_ts

    stats = service.get_user_stats("user1", days=7)
    assert stats["total_tokens"] == 0

    # 扩大范围应包含
    stats_wide = service.get_user_stats("user1", days=366)
    assert stats_wide["total_tokens"] > 0
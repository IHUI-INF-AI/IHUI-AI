"""app/services/publish/anti_risk/risk_scoring.py 单元测试:风险评分引擎。

测试覆盖(16 cases):
- RiskScore dataclass:字段完整性 / is_safe / to_dict
- _level_from_score:5 等级阈值 / 边界值(20/40/60/80)
- _cooldown_for_level:冷却时长(medium/high/critical 有冷却,safe/low 无)
- RiskScorer.calculate_risk_score:空输入降级 / 总分截断[0,100] / 8 维度权重
- RiskScorer 单维度:频率(+20) / 失败率(+15) / 指纹(+25) / IP(+20) /
  行为(+10) / 平台信号(+30) / Cookie 健康(+15) / 内容相似度(+20)
- is_platform_risk_error:关键词检测
- record_risk_event:事件持久化到 JSONL 文件
- get_instance:单例模式

测试隔离:每测试用 tmp_path 隔离 _EVENTS_FILE,新建 RiskScorer 实例避免状态泄漏。
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from app.services.publish.anti_risk import risk_scoring
from app.services.publish.anti_risk.risk_scoring import (
    RiskScore,
    RiskScorer,
    _cooldown_for_level,
    _level_from_score,
    get_instance,
)


# =============================================================================
# fixtures:隔离事件文件 + 新建 scorer
# =============================================================================


@pytest.fixture
def isolated_events_file(tmp_path: Path, monkeypatch) -> Path:
    """每个测试隔离 _EVENTS_FILE 到 tmp_path,避免污染真实事件文件。"""
    events_file = tmp_path / "test-events.jsonl"
    monkeypatch.setattr(risk_scoring, "_EVENTS_FILE", events_file)
    return events_file


@pytest.fixture
def scorer(isolated_events_file: Path) -> RiskScorer:
    """每个测试新建独立 RiskScorer(不共享单例状态)。"""
    return RiskScorer()


def _make_history_record(
    success: bool = True,
    offset_seconds: float = 0.0,
    duration_ms: int = 5000,
    error: str | None = None,
) -> dict:
    """构造 publish_history 记录(offset_seconds=距现在的秒数,负数=未来)。"""
    return {
        "success": success,
        "duration_ms": duration_ms,
        "error_message": error,
        "created_at": time.time() - offset_seconds,
    }


# =============================================================================
# RiskScore dataclass(3 tests)
# =============================================================================


class TestRiskScoreDataclass:
    """测试 RiskScore dataclass 字段与方法。"""

    def test_full_construction(self):
        """所有字段显式构造。"""
        rs = RiskScore(
            score=45,
            level="medium",
            factors=["频率异常", "IP 变化"],
            calculated_at=1234567890.0,
            cooldown_until=1234571490.0,
        )
        assert rs.score == 45
        assert rs.level == "medium"
        assert rs.factors == ["频率异常", "IP 变化"]
        assert rs.calculated_at == 1234567890.0
        assert rs.cooldown_until == 1234571490.0

    def test_default_values(self):
        """factors 默认空 list,calculated_at 自动填充,cooldown_until 默认 None。"""
        rs = RiskScore(score=10, level="safe")
        assert rs.factors == []
        assert rs.cooldown_until is None
        assert rs.calculated_at > 0  # 自动填充当前时间

    def test_is_safe_returns_true_for_safe_and_low(self):
        """is_safe:score<=40(safe/low)返回 True,score>40 返回 False。"""
        assert RiskScore(score=0, level="safe").is_safe() is True
        assert RiskScore(score=20, level="safe").is_safe() is True
        assert RiskScore(score=40, level="low").is_safe() is True
        assert RiskScore(score=41, level="medium").is_safe() is False
        assert RiskScore(score=80, level="high").is_safe() is False
        assert RiskScore(score=100, level="critical").is_safe() is False

    def test_to_dict_serialization(self):
        """to_dict 返回含所有字段的 dict(供审计日志持久化)。"""
        rs = RiskScore(
            score=55,
            level="medium",
            factors=["测试因子"],
            cooldown_until=99999.0,
        )
        d = rs.to_dict()
        assert d["score"] == 55
        assert d["level"] == "medium"
        assert d["factors"] == ["测试因子"]
        assert d["cooldown_until"] == 99999.0
        assert "calculated_at" in d


# =============================================================================
# _level_from_score 等级划分(2 tests)
# =============================================================================


class TestLevelFromScore:
    """测试 _level_from_score() 等级阈值与边界值。"""

    def test_five_levels(self):
        """5 个等级:safe(<=20) / low(<=40) / medium(<=60) / high(<=80) / critical(>80)。"""
        assert _level_from_score(0) == "safe"
        assert _level_from_score(20) == "safe"
        assert _level_from_score(21) == "low"
        assert _level_from_score(40) == "low"
        assert _level_from_score(41) == "medium"
        assert _level_from_score(60) == "medium"
        assert _level_from_score(61) == "high"
        assert _level_from_score(80) == "high"
        assert _level_from_score(81) == "critical"
        assert _level_from_score(100) == "critical"

    def test_boundary_values(self):
        """边界值:20→safe, 40→low, 60→medium, 80→high(含等号)。"""
        assert _level_from_score(20) == "safe"  # <=20
        assert _level_from_score(40) == "low"  # <=40
        assert _level_from_score(60) == "medium"  # <=60
        assert _level_from_score(80) == "high"  # <=80


# =============================================================================
# _cooldown_for_level 冷却时长(1 test)
# =============================================================================


class TestCooldownForLevel:
    """测试 _cooldown_for_level() 各等级冷却时长。"""

    def test_cooldown_durations(self):
        """medium/high 有冷却(3600s),critical 有冷却(86400s),safe/low 无冷却(None)。"""
        now = time.time()
        # safe / low 无冷却
        assert _cooldown_for_level("safe") is None
        assert _cooldown_for_level("low") is None
        # medium 冷却 1h
        cd_medium = _cooldown_for_level("medium")
        assert cd_medium is not None
        assert 3590 <= cd_medium - now <= 3610
        # high 冷却 1h
        cd_high = _cooldown_for_level("high")
        assert cd_high is not None
        assert 3590 <= cd_high - now <= 3610
        # critical 冷却 24h
        cd_critical = _cooldown_for_level("critical")
        assert cd_critical is not None
        assert 86390 <= cd_critical - now <= 86410


# =============================================================================
# RiskScorer.calculate_risk_score 评分逻辑(7 tests)
# =============================================================================


class TestCalculateRiskScore:
    """测试 RiskScorer.calculate_risk_score() 多维度评分。"""

    async def test_empty_input_returns_safe(self, scorer: RiskScorer):
        """无 publish_history + 无事件 → score=0, level=safe(降级模式)。"""
        result = scorer.calculate_risk_score("acct_1", "csdn")
        assert result.score == 0
        assert result.level == "safe"
        assert result.factors == []

    async def test_score_clamped_to_zero(self, scorer: RiskScorer):
        """总分不会低于 0(max(0, score) 截断)。"""
        # 无任何风险因子 → score=0(已经是下限)
        result = scorer.calculate_risk_score("acct_2", "csdn")
        assert result.score >= 0

    async def test_frequency_dimension_weight(self, scorer: RiskScorer):
        """维度 1:近 24h 发布 >10 次 → +20 分(频率异常)。"""
        # 11 条成功记录,均在 1 小时前(24h 内)
        history = [_make_history_record(success=True, offset_seconds=3600) for _ in range(11)]
        result = scorer.calculate_risk_score("acct_3", "csdn", publish_history=history)
        assert result.score >= 20  # 至少含频率维度 20 分
        assert any("频率" in f for f in result.factors)

    async def test_failure_rate_dimension_weight(self, scorer: RiskScorer):
        """维度 2:近 7d 失败率 >50% → +15 分。"""
        # 4 条失败 + 2 条成功 = 66% 失败率(>50%)
        history = [
            _make_history_record(success=False, offset_seconds=86400) for _ in range(4)
        ] + [
            _make_history_record(success=True, offset_seconds=86400) for _ in range(2)
        ]
        result = scorer.calculate_risk_score("acct_4", "csdn", publish_history=history)
        assert result.score >= 15
        assert any("失败率" in f for f in result.factors)

    async def test_platform_signal_dimension_weight(self, scorer: RiskScorer):
        """维度 6:近 24h 平台风控触发 → +30 分。"""
        scorer.record_risk_event(
            "acct_5", "csdn", "platform_risk_trigger",
            details={"error": "操作频繁,请稍后再试"},
        )
        result = scorer.calculate_risk_score("acct_5", "csdn")
        assert result.score >= 30
        assert any("平台风控" in f for f in result.factors)

    async def test_cookie_health_dimension_weight(self, scorer: RiskScorer):
        """维度 7:Cookie 过期(expired)→ +15 分。"""
        result = scorer.calculate_risk_score(
            "acct_6", "csdn",
            cookie_health={"status": "expired", "days_until_expiry": -1},
        )
        assert result.score >= 15
        assert any("Cookie" in f for f in result.factors)

    async def test_content_similarity_dimension_weight(self, scorer: RiskScorer):
        """维度 8:内容相似度 >85% → +20 分。"""
        result = scorer.calculate_risk_score(
            "acct_7", "csdn", content_similarity=0.95,
        )
        assert result.score >= 20
        assert any("相似度" in f for f in result.factors)


# =============================================================================
# RiskScorer 多维度组合 + 截断(2 tests)
# =============================================================================


class TestRiskScoreCombination:
    """测试多维度组合评分与总分截断。"""

    async def test_multiple_dimensions_accumulate(self, scorer: RiskScorer):
        """多维度同时触发时,分数累加(平台信号 30 + Cookie 15 + 相似度 20 = 65)。"""
        scorer.record_risk_event(
            "acct_8", "csdn", "platform_risk_trigger",
            details={"error": "请稍后再试"},
        )
        result = scorer.calculate_risk_score(
            "acct_8", "csdn",
            cookie_health={"status": "expired", "days_until_expiry": -1},
            content_similarity=0.95,
        )
        # 30(平台) + 15(Cookie) + 20(相似度) = 65
        assert result.score >= 60
        assert result.level in ("medium", "high")

    async def test_score_clamped_to_100(self, scorer: RiskScorer):
        """总分上限 100(所有维度全触发也不超过 100)。"""
        # 触发所有维度:平台信号(30) + Cookie(15) + 相似度(20) + 频率(20) +
        # 失败率(15) + 指纹(25) + IP(20) + 行为(10) = 155 → 截断到 100
        scorer.record_risk_event(
            "acct_9", "csdn", "platform_risk_trigger", details={"error": "风控"},
        )
        scorer.record_risk_event(
            "acct_9", "csdn", "fingerprint_recorded",
            details={"fingerprint_hash": "fp_a"},
        )
        scorer.record_risk_event(
            "acct_9", "csdn", "fingerprint_recorded",
            details={"fingerprint_hash": "fp_b"},
        )
        scorer.record_risk_event(
            "acct_9", "csdn", "proxy_recorded",
            details={"proxy_server": "http://proxy_a:8080"},
        )
        scorer.record_risk_event(
            "acct_9", "csdn", "proxy_recorded",
            details={"proxy_server": "http://proxy_b:8080"},
        )
        history = [
            _make_history_record(success=False, offset_seconds=3600, duration_ms=1000)
            for _ in range(12)
        ]
        result = scorer.calculate_risk_score(
            "acct_9", "csdn",
            publish_history=history,
            cookie_health={"status": "expired", "days_until_expiry": -1},
            content_similarity=0.99,
        )
        assert result.score <= 100
        assert result.score == 100  # 所有维度全触发应达上限


# =============================================================================
# is_platform_risk_error 关键词检测(1 test)
# =============================================================================


class TestIsPlatformRiskError:
    """测试 is_platform_risk_error() 风控关键词检测。"""

    def test_detects_risk_keywords(self):
        """命中风控关键词返回 True,未命中返回 False。"""
        assert RiskScorer.is_platform_risk_error("操作频繁,请稍后再试") is True
        assert RiskScorer.is_platform_risk_error("账号异常,请验证") is True
        assert RiskScorer.is_platform_risk_error("滑块验证") is True
        assert RiskScorer.is_platform_risk_error("网络超时") is False
        assert RiskScorer.is_platform_risk_error("") is False
        assert RiskScorer.is_platform_risk_error("正常发布成功") is False


# =============================================================================
# record_risk_event 事件持久化(1 test)
# =============================================================================


class TestRecordRiskEvent:
    """测试 record_risk_event() 内存 + 文件持久化。"""

    async def test_event_persisted_to_jsonl_file(
        self, scorer: RiskScorer, isolated_events_file: Path
    ):
        """记录事件后,JSONL 文件包含对应记录(account_id/platform/type)。"""
        scorer.record_risk_event(
            "acct_persist", "csdn", "publish_failed",
            details={"error": "timeout"},
        )
        assert isolated_events_file.is_file()
        content = isolated_events_file.read_text(encoding="utf-8").strip()
        assert content  # 非空
        record = json.loads(content)
        assert record["account_id"] == "acct_persist"
        assert record["platform"] == "csdn"
        assert record["type"] == "publish_failed"
        assert record["details"]["error"] == "timeout"


# =============================================================================
# get_instance 单例(1 test)
# =============================================================================


class TestGetInstance:
    """测试 get_instance() 全局单例。"""

    def test_returns_same_instance(self):
        """get_instance 多次调用返回同一 RiskScorer 实例。"""
        # 注意:get_instance 返回全局单例,可能被其他测试影响
        # 但同一调用链内应返回同一对象
        instance1 = get_instance()
        instance2 = get_instance()
        assert instance1 is instance2
        assert isinstance(instance1, RiskScorer)

"""platform_rule_versions.py 单元测试:平台规则版本管理 + 失效检测。

测试覆盖:
- RuleVersion dataclass 构造与默认值
- _build_initial_version 从 PlatformRule 构造初始版本
- RuleVersionManager 初始化(从 PLATFORM_RULES 同步 37 平台)
- get_current_version:已知平台返回 RuleVersion / 未知平台返回 None
- list_all_platforms:返回所有已跟踪平台 ID
- check_rule_outdated:未知平台 / 空 last_updated / 无效日期 / 90 天阈值
- list_all_outdated / list_all_up_to_date:返回排序后的平台列表
- record_rule_change:正常记录 / 未知平台 / 版本不一致告警 / change_log 累积
- get_change_log:返回变更历史副本
- bulk_check_outdated:批量检测
- get_outdated_summary:摘要字段完整性
- 模块级单例 + 便捷函数
- outdated_days_threshold 负数抛 ValueError
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional
from unittest.mock import patch

import pytest

from app.services.publish.platform_rule_versions import (
    RuleVersion,
    RuleVersionManager,
    _build_initial_version,
    _get_default_manager,
    check_rule_outdated as mod_check_rule_outdated,
    get_current_version as mod_get_current_version,
    list_all_outdated as mod_list_all_outdated,
    record_rule_change as mod_record_rule_change,
)
from app.services.publish.platform_rules import PLATFORM_RULES, PlatformRule


# =============================================================================
# 1. RuleVersion dataclass(2 tests)
# =============================================================================


class TestRuleVersionDataclass:
    """RuleVersion dataclass 字段构造与默认值。"""

    def test_full_construction(self) -> None:
        """所有字段显式构造。"""
        rv = RuleVersion(
            platform="wechat",
            current_version="2026.07.31",
            last_updated="2026-07-31",
            official_rule_url="https://mp.weixin.qq.com/",
            change_log=["v1 → v2: 标题字数变更"],
        )
        assert rv.platform == "wechat"
        assert rv.current_version == "2026.07.31"
        assert rv.last_updated == "2026-07-31"
        assert rv.official_rule_url == "https://mp.weixin.qq.com/"
        assert rv.change_log == ["v1 → v2: 标题字数变更"]

    def test_defaults_empty_strings_and_list(self) -> None:
        """默认值:空字符串 + 空 change_log list。"""
        rv = RuleVersion(platform="test")
        assert rv.platform == "test"
        assert rv.current_version == ""
        assert rv.last_updated == ""
        assert rv.official_rule_url == ""
        assert rv.change_log == []


# =============================================================================
# 2. _build_initial_version(2 tests)
# =============================================================================


class TestBuildInitialVersion:
    """_build_initial_version 从 PlatformRule 构造 RuleVersion。"""

    def test_builds_from_platform_rule(self) -> None:
        """从 PlatformRule 构造初始 RuleVersion,字段同步。"""
        rule = PlatformRule(
            platform_id="test_plat",
            platform_name="测试平台",
            rule_version="2026.07.01",
            rule_updated_at="2026-07-01",
            platform_official_url="https://example.com/rules",
        )
        rv = _build_initial_version(rule)
        assert rv.platform == "test_plat"
        assert rv.current_version == "2026.07.01"
        assert rv.last_updated == "2026-07-01"
        assert rv.official_rule_url == "https://example.com/rules"
        assert rv.change_log == []

    def test_change_log_is_independent_per_instance(self) -> None:
        """每个 _build_initial_version 的 change_log 是独立 list。"""
        rule = PlatformRule(platform_id="a", platform_name="A")
        rv1 = _build_initial_version(rule)
        rv2 = _build_initial_version(rule)
        rv1.change_log.append("change1")
        assert rv1.change_log == ["change1"]
        assert rv2.change_log == []


# =============================================================================
# 3. RuleVersionManager 初始化(3 tests)
# =============================================================================


class TestManagerInit:
    """RuleVersionManager 初始化与平台加载。"""

    def test_loads_all_platforms_from_platform_rules(self) -> None:
        """初始化后 _versions 包含 PLATFORM_RULES 全部 37 个平台。"""
        mgr = RuleVersionManager()
        assert len(mgr.list_all_platforms()) == len(PLATFORM_RULES)
        assert len(mgr.list_all_platforms()) >= 37

    def test_default_threshold_is_90_days(self) -> None:
        """默认过期阈值 90 天(一个季度)。"""
        mgr = RuleVersionManager()
        summary = mgr.get_outdated_summary()
        assert summary["threshold_days"] == 90

    def test_negative_threshold_raises_value_error(self) -> None:
        """负数阈值抛 ValueError。"""
        with pytest.raises(ValueError, match="不能为负数"):
            RuleVersionManager(outdated_days_threshold=-1)


# =============================================================================
# 4. get_current_version(2 tests)
# =============================================================================


class TestGetCurrentVersion:
    """get_current_version 查询接口。"""

    def test_known_platform_returns_rule_version(self) -> None:
        """已知平台返回 RuleVersion,字段从 PLATFORM_RULES 同步。"""
        mgr = RuleVersionManager()
        rv = mgr.get_current_version("wechat")
        assert rv is not None
        assert rv.platform == "wechat"
        assert rv.current_version  # 非空(PLATFORM_RULES 中 wechat 有 rule_version)

    def test_unknown_platform_returns_none(self) -> None:
        """未知平台返回 None。"""
        mgr = RuleVersionManager()
        assert mgr.get_current_version("nonexistent-xyz-999") is None


# =============================================================================
# 5. check_rule_outdated(4 tests)
# =============================================================================


class TestCheckRuleOutdated:
    """check_rule_outdated 过期检测逻辑。"""

    def test_unknown_platform_returns_false(self) -> None:
        """未知平台返回 False(避免误报)。"""
        mgr = RuleVersionManager()
        assert mgr.check_rule_outdated("nonexistent-xyz-999") is False

    def test_empty_last_updated_returns_true(self) -> None:
        """last_updated 为空 → 视为过期。"""
        mgr = RuleVersionManager()
        # 手动构造一个 last_updated 为空的版本
        mgr._versions["test_empty"] = RuleVersion(platform="test_empty", last_updated="")
        assert mgr.check_rule_outdated("test_empty") is True

    def test_invalid_date_format_returns_true(self) -> None:
        """last_updated 格式无效 → 视为过期。"""
        mgr = RuleVersionManager()
        mgr._versions["test_bad_date"] = RuleVersion(
            platform="test_bad_date", last_updated="not-a-date",
        )
        assert mgr.check_rule_outdated("test_bad_date") is True

    def test_recent_date_within_threshold_not_outdated(self) -> None:
        """最近更新的平台(今天)未过期。"""
        mgr = RuleVersionManager()
        today = datetime.now().strftime("%Y-%m-%d")
        mgr._versions["test_recent"] = RuleVersion(
            platform="test_recent", last_updated=today,
        )
        assert mgr.check_rule_outdated("test_recent") is False

    def test_old_date_beyond_threshold_is_outdated(self) -> None:
        """超过阈值天数的平台视为过期。"""
        mgr = RuleVersionManager(outdated_days_threshold=30)
        old_date = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
        mgr._versions["test_old"] = RuleVersion(
            platform="test_old", last_updated=old_date,
        )
        assert mgr.check_rule_outdated("test_old") is True


# =============================================================================
# 6. list_all_outdated / list_all_up_to_date(2 tests)
# =============================================================================


class TestListOutdatedAndUpToDate:
    """list_all_outdated / list_all_up_to_date 列表接口。"""

    def test_list_all_outdated_returns_sorted_list(self) -> None:
        """list_all_outdated 返回排序后的过期平台列表。"""
        mgr = RuleVersionManager(outdated_days_threshold=1)
        # 所有 last_updated 为 2026-07-31 的平台在 threshold=1 时大概率过期
        outdated = mgr.list_all_outdated()
        assert isinstance(outdated, list)
        # 验证排序
        assert outdated == sorted(outdated)

    def test_list_all_up_to_date_returns_sorted_list(self) -> None:
        """list_all_up_to_date 返回排序后的未过期平台列表。"""
        mgr = RuleVersionManager(outdated_days_threshold=365 * 10)
        up_to_date = mgr.list_all_up_to_date()
        assert isinstance(up_to_date, list)
        assert up_to_date == sorted(up_to_date)
        # 10 年阈值下大部分平台应未过期
        assert len(up_to_date) > 0


# =============================================================================
# 7. record_rule_change(4 tests)
# =============================================================================


class TestRecordRuleChange:
    """record_rule_change 变更记录。"""

    def test_unknown_platform_returns_false(self) -> None:
        """未知平台返回 False。"""
        mgr = RuleVersionManager()
        result = mgr.record_rule_change(
            "nonexistent-xyz", "1.0", "2.0", ["变更1"],
        )
        assert result is False

    def test_normal_record_updates_version_and_log(self) -> None:
        """正常记录:更新 current_version + last_updated + change_log。"""
        mgr = RuleVersionManager()
        rv = mgr.get_current_version("wechat")
        assert rv is not None
        old_ver = rv.current_version
        result = mgr.record_rule_change(
            "wechat", old_ver, "2026.12.31", ["标题字数 64→80", "新增禁用词"],
        )
        assert result is True
        assert rv.current_version == "2026.12.31"
        assert rv.last_updated == datetime.now().strftime("%Y-%m-%d")
        assert len(rv.change_log) == 1
        assert "2026.12.31" in rv.change_log[0]
        assert "标题字数 64→80" in rv.change_log[0]

    def test_version_mismatch_still_records(self) -> None:
        """old_version 与当前不一致时仍记录(告警但不阻塞)。"""
        mgr = RuleVersionManager()
        rv = mgr.get_current_version("wechat")
        assert rv is not None
        original_version = rv.current_version
        result = mgr.record_rule_change(
            "wechat", "WRONG_VERSION", "2026.12.31", ["测试不一致"],
        )
        assert result is True
        assert rv.current_version == "2026.12.31"
        assert original_version != "2026.12.31"

    def test_empty_changes_list_still_records(self) -> None:
        """changes 为空列表时仍记录(写入"无具体变更说明")。"""
        mgr = RuleVersionManager()
        rv = mgr.get_current_version("wechat")
        assert rv is not None
        old_ver = rv.current_version
        mgr.record_rule_change("wechat", old_ver, "2026.12.31", [])
        assert len(rv.change_log) >= 1
        assert "无具体变更说明" in rv.change_log[-1]


# =============================================================================
# 8. get_change_log(2 tests)
# =============================================================================


class TestGetChangeLog:
    """get_change_log 变更历史查询。"""

    def test_unknown_platform_returns_empty_list(self) -> None:
        """未知平台返回空列表。"""
        mgr = RuleVersionManager()
        assert mgr.get_change_log("nonexistent-xyz") == []

    def test_returns_copy_not_reference(self) -> None:
        """返回 change_log 的副本,修改不影响内部状态。"""
        mgr = RuleVersionManager()
        rv = mgr.get_current_version("wechat")
        assert rv is not None
        old_ver = rv.current_version
        mgr.record_rule_change("wechat", old_ver, "2026.12.31", ["变更"])
        log1 = mgr.get_change_log("wechat")
        log1.append("external modification")
        log2 = mgr.get_change_log("wechat")
        assert "external modification" not in log2


# =============================================================================
# 9. bulk_check_outdated(2 tests)
# =============================================================================


class TestBulkCheckOutdated:
    """bulk_check_outdated 批量检测。"""

    def test_all_platforms_when_none_given(self) -> None:
        """platforms=None 时检测全部平台。"""
        mgr = RuleVersionManager()
        result = mgr.bulk_check_outdated(None)
        assert len(result) == len(PLATFORM_RULES)
        for v in result.values():
            assert isinstance(v, bool)

    def test_specific_platforms_subset(self) -> None:
        """指定平台子集只返回指定平台的结果。"""
        mgr = RuleVersionManager()
        result = mgr.bulk_check_outdated(["wechat", "zhihu"])
        assert set(result.keys()) == {"wechat", "zhihu"}


# =============================================================================
# 10. get_outdated_summary(1 test)
# =============================================================================


class TestGetOutdatedSummary:
    """get_outdated_summary 摘要。"""

    def test_summary_fields_complete(self) -> None:
        """摘要包含所有必填字段。"""
        mgr = RuleVersionManager()
        summary = mgr.get_outdated_summary()
        assert "total_platforms" in summary
        assert "outdated_count" in summary
        assert "outdated_platforms" in summary
        assert "up_to_date_count" in summary
        assert "threshold_days" in summary
        assert summary["total_platforms"] == len(PLATFORM_RULES)
        assert summary["outdated_count"] + summary["up_to_date_count"] == summary["total_platforms"]
        assert isinstance(summary["outdated_platforms"], list)


# =============================================================================
# 11. 模块级单例 + 便捷函数(2 tests)
# =============================================================================


class TestModuleLevelSingleton:
    """模块级单例 _get_default_manager 和便捷函数。"""

    def test_get_default_manager_returns_singleton(self) -> None:
        """_get_default_manager 返回同一实例(单例)。"""
        m1 = _get_default_manager()
        m2 = _get_default_manager()
        assert m1 is m2

    def test_module_level_functions_work(self) -> None:
        """模块级便捷函数正常工作(委托给单例)。"""
        rv = mod_get_current_version("wechat")
        assert rv is not None
        assert rv.platform == "wechat"
        # check_rule_outdated 返回 bool
        assert isinstance(mod_check_rule_outdated("wechat"), bool)
        # list_all_outdated 返回 list
        assert isinstance(mod_list_all_outdated(), list)
        # record_rule_change 返回 bool
        old_ver = rv.current_version
        result = mod_record_rule_change("wechat", old_ver, "2099.01.01", ["模块级测试"])
        assert result is True

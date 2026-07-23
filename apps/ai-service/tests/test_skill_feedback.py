"""skill_feedback.py 单元测试:Skill 使用反馈追踪(Redis 优先 + 内存降级)。

覆盖 SkillFeedbackTracker 的全部方法 + 全局单例。
所有测试强制内存模式(mock _get_redis 返回 None)以隔离 Redis 依赖。
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.skill_feedback import SkillFeedbackTracker, skill_feedback_tracker


# ------------------------------------------------------------
# 辅助 fixture:强制内存模式
# ------------------------------------------------------------


@pytest.fixture
def tracker():
    """返回强制内存模式的 SkillFeedbackTracker(隔离 Redis)。"""
    t = SkillFeedbackTracker()
    t._use_redis = False
    t._redis = None
    return t


# ------------------------------------------------------------
# __init__
# ------------------------------------------------------------


class TestInit:
    """SkillFeedbackTracker 构造函数。"""

    def test_store_is_empty_dict(self):
        t = SkillFeedbackTracker()
        assert isinstance(t._store, dict)
        assert len(t._store) == 0

    def test_iter_store_is_empty_dict(self):
        t = SkillFeedbackTracker()
        assert isinstance(t._iter_store, dict)
        assert len(t._iter_store) == 0

    def test_redis_initially_none(self):
        t = SkillFeedbackTracker()
        assert t._redis is None

    def test_use_redis_depends_on_settings(self):
        """_use_redis = bool(settings.redis_url) and aioredis is not None。"""
        t = SkillFeedbackTracker()
        # 只验证是 bool 类型(具体值取决于环境配置)
        assert isinstance(t._use_redis, bool)


# ------------------------------------------------------------
# _fb_key / _iter_key(静态方法)
# ------------------------------------------------------------


class TestRedisKeys:
    """_fb_key / _iter_key 生成 Redis key。"""

    def test_fb_key_format(self):
        assert SkillFeedbackTracker._fb_key("my-skill") == "skill:feedback:my-skill"

    def test_fb_key_different_per_skill(self):
        assert SkillFeedbackTracker._fb_key("a") != SkillFeedbackTracker._fb_key("b")

    def test_iter_key_format(self):
        assert SkillFeedbackTracker._iter_key("my-skill") == "skill:iter:my-skill"

    def test_iter_key_different_per_skill(self):
        assert SkillFeedbackTracker._iter_key("a") != SkillFeedbackTracker._iter_key("b")

    def test_fb_and_iter_keys_different(self):
        assert SkillFeedbackTracker._fb_key("x") != SkillFeedbackTracker._iter_key("x")


# ------------------------------------------------------------
# record_usage(异步)
# ------------------------------------------------------------


class TestRecordUsage:
    """record_usage 记录单次 skill 使用反馈。"""

    @pytest.mark.asyncio
    async def test_basic_record(self, tracker):
        await tracker.record_usage({
            "skillName": "s1",
            "taskId": "t1",
            "usedAt": "2026-07-23T10:00:00Z",
            "success": True,
            "durationMs": 100,
        })
        records = await tracker._get_all_feedback("s1")
        assert len(records) == 1
        assert records[0]["skillName"] == "s1"
        assert records[0]["taskId"] == "t1"
        assert records[0]["usedAt"] == "2026-07-23T10:00:00Z"
        assert records[0]["success"] is True
        assert records[0]["durationMs"] == 100

    @pytest.mark.asyncio
    async def test_empty_skill_name_skipped(self, tracker):
        """源码 str(feedback.get("skillName", "")) — 空字符串跳过,None 会被 str() 转成 'None'。"""
        await tracker.record_usage({"skillName": "", "taskId": "t1"})
        # 空字符串被跳过,无记录写入
        assert len(tracker._store) == 0

    @pytest.mark.asyncio
    async def test_none_skill_name_coerced_to_string(self, tracker):
        """源码 str(None) → 'None'(非空字符串),不会被跳过。"""
        await tracker.record_usage({"skillName": None, "taskId": "t2"})
        # None 被 str() 转成 "None",作为 skill_name 写入
        assert "None" in tracker._store
        assert len(tracker._store["None"]) == 1

    @pytest.mark.asyncio
    async def test_multiple_records_append(self, tracker):
        for i in range(3):
            await tracker.record_usage({
                "skillName": "s1",
                "taskId": f"t{i}",
                "usedAt": f"2026-07-23T10:0{i}:00Z",
                "success": i % 2 == 0,
                "durationMs": i * 100,
            })
        records = await tracker._get_all_feedback("s1")
        assert len(records) == 3
        assert records[0]["taskId"] == "t0"
        assert records[2]["taskId"] == "t2"

    @pytest.mark.asyncio
    async def test_user_satisfaction_recorded_as_float(self, tracker):
        await tracker.record_usage({
            "skillName": "s1",
            "taskId": "t1",
            "usedAt": "now",
            "success": True,
            "durationMs": 100,
            "userSatisfaction": 4,
        })
        records = await tracker._get_all_feedback("s1")
        assert records[0]["userSatisfaction"] == 4.0
        assert isinstance(records[0]["userSatisfaction"], float)

    @pytest.mark.asyncio
    async def test_failure_reason_recorded_as_str(self, tracker):
        await tracker.record_usage({
            "skillName": "s1",
            "taskId": "t1",
            "usedAt": "now",
            "success": False,
            "durationMs": 100,
            "failureReason": "timeout",
        })
        records = await tracker._get_all_feedback("s1")
        assert records[0]["failureReason"] == "timeout"

    @pytest.mark.asyncio
    async def test_optional_fields_omitted_when_absent(self, tracker):
        await tracker.record_usage({
            "skillName": "s1",
            "taskId": "t1",
            "usedAt": "now",
            "success": True,
            "durationMs": 100,
        })
        records = await tracker._get_all_feedback("s1")
        assert "userSatisfaction" not in records[0]
        assert "failureReason" not in records[0]

    @pytest.mark.asyncio
    async def test_task_id_defaults_empty_string(self, tracker):
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True})
        records = await tracker._get_all_feedback("s1")
        assert records[0]["taskId"] == ""

    @pytest.mark.asyncio
    async def test_duration_ms_defaults_zero(self, tracker):
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True})
        records = await tracker._get_all_feedback("s1")
        assert records[0]["durationMs"] == 0

    @pytest.mark.asyncio
    async def test_used_at_defaults_empty_string(self, tracker):
        await tracker.record_usage({"skillName": "s1", "success": True})
        records = await tracker._get_all_feedback("s1")
        assert records[0]["usedAt"] == ""

    @pytest.mark.asyncio
    async def test_success_coerced_to_bool(self, tracker):
        await tracker.record_usage({
            "skillName": "s1", "usedAt": "now",
            "success": 1,  # truthy
            "durationMs": 0,
        })
        records = await tracker._get_all_feedback("s1")
        assert records[0]["success"] is True

    @pytest.mark.asyncio
    async def test_duration_ms_none_coerced_to_zero(self, tracker):
        await tracker.record_usage({
            "skillName": "s1", "usedAt": "now",
            "success": True, "durationMs": None,
        })
        records = await tracker._get_all_feedback("s1")
        assert records[0]["durationMs"] == 0


# ------------------------------------------------------------
# _get_all_feedback(异步)
# ------------------------------------------------------------


class TestGetAllFeedback:
    """_get_all_feedback 读取全部反馈记录。"""

    @pytest.mark.asyncio
    async def test_empty_returns_empty_list(self, tracker):
        records = await tracker._get_all_feedback("nonexistent")
        assert records == []

    @pytest.mark.asyncio
    async def test_returns_all_records(self, tracker):
        for i in range(5):
            await tracker.record_usage({
                "skillName": "s1", "taskId": f"t{i}",
                "usedAt": "now", "success": True, "durationMs": 100,
            })
        records = await tracker._get_all_feedback("s1")
        assert len(records) == 5

    @pytest.mark.asyncio
    async def test_returns_copy_not_reference(self, tracker):
        await tracker.record_usage({
            "skillName": "s1", "taskId": "t1",
            "usedAt": "now", "success": True, "durationMs": 100,
        })
        records = await tracker._get_all_feedback("s1")
        records.clear()
        # 内部存储不受影响
        records2 = await tracker._get_all_feedback("s1")
        assert len(records2) == 1


# ------------------------------------------------------------
# get_stats(异步)
# ------------------------------------------------------------


class TestGetStats:
    """get_stats 聚合使用统计。"""

    @pytest.mark.asyncio
    async def test_empty_stats(self, tracker):
        stats = await tracker.get_stats("nonexistent")
        assert stats["skillName"] == "nonexistent"
        assert stats["totalUses"] == 0
        assert stats["successCount"] == 0
        assert stats["successRate"] == 0.0
        assert stats["avgSatisfaction"] == 0.0
        assert stats["avgDurationMs"] == 0
        assert stats["lastUsedAt"] == ""
        assert stats["currentVersion"] == "1.0.0"
        assert stats["iterationHistory"] == []

    @pytest.mark.asyncio
    async def test_total_uses_count(self, tracker):
        for i in range(3):
            await tracker.record_usage({
                "skillName": "s1", "taskId": f"t{i}",
                "usedAt": "now", "success": True, "durationMs": 100,
            })
        stats = await tracker.get_stats("s1")
        assert stats["totalUses"] == 3

    @pytest.mark.asyncio
    async def test_success_count(self, tracker):
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 100})
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": False, "durationMs": 100})
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 100})
        stats = await tracker.get_stats("s1")
        assert stats["successCount"] == 2

    @pytest.mark.asyncio
    async def test_success_rate_calculation(self, tracker):
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 100})
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": False, "durationMs": 100})
        stats = await tracker.get_stats("s1")
        assert stats["successRate"] == 0.5

    @pytest.mark.asyncio
    async def test_avg_satisfaction(self, tracker):
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 100, "userSatisfaction": 4})
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 100, "userSatisfaction": 5})
        stats = await tracker.get_stats("s1")
        assert stats["avgSatisfaction"] == 4.5

    @pytest.mark.asyncio
    async def test_avg_satisfaction_no_values_returns_zero(self, tracker):
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 100})
        stats = await tracker.get_stats("s1")
        assert stats["avgSatisfaction"] == 0.0

    @pytest.mark.asyncio
    async def test_avg_duration_ms(self, tracker):
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 100})
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 300})
        stats = await tracker.get_stats("s1")
        assert stats["avgDurationMs"] == 200

    @pytest.mark.asyncio
    async def test_last_used_at_takes_max(self, tracker):
        await tracker.record_usage({"skillName": "s1", "usedAt": "2026-07-23T10:00:00Z", "success": True, "durationMs": 100})
        await tracker.record_usage({"skillName": "s1", "usedAt": "2026-07-23T12:00:00Z", "success": True, "durationMs": 100})
        await tracker.record_usage({"skillName": "s1", "usedAt": "2026-07-23T11:00:00Z", "success": True, "durationMs": 100})
        stats = await tracker.get_stats("s1")
        assert stats["lastUsedAt"] == "2026-07-23T12:00:00Z"

    @pytest.mark.asyncio
    async def test_skill_name_in_stats(self, tracker):
        await tracker.record_usage({"skillName": "my-skill", "usedAt": "now", "success": True, "durationMs": 100})
        stats = await tracker.get_stats("my-skill")
        assert stats["skillName"] == "my-skill"


# ------------------------------------------------------------
# get_failure_cases(异步)
# ------------------------------------------------------------


class TestGetFailureCases:
    """get_failure_cases 返回最近 N 个失败案例。"""

    @pytest.mark.asyncio
    async def test_no_failures_returns_empty(self, tracker):
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 100})
        failures = await tracker.get_failure_cases("s1")
        assert failures == []

    @pytest.mark.asyncio
    async def test_returns_only_failures(self, tracker):
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 100})
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": False, "durationMs": 100, "failureReason": "err1"})
        await tracker.record_usage({"skillName": "s1", "usedAt": "now", "success": True, "durationMs": 100})
        failures = await tracker.get_failure_cases("s1")
        assert len(failures) == 1
        assert failures[0]["failureReason"] == "err1"

    @pytest.mark.asyncio
    async def test_limit_restricts_count(self, tracker):
        for i in range(5):
            await tracker.record_usage({
                "skillName": "s1", "usedAt": f"t{i}",
                "success": False, "durationMs": 100,
                "failureReason": f"err{i}",
            })
        failures = await tracker.get_failure_cases("s1", limit=3)
        assert len(failures) == 3

    @pytest.mark.asyncio
    async def test_returns_in_reverse_chronological_order(self, tracker):
        """源码:列表尾部为最新,返回时反转为时间倒序(最新在前)。"""
        for i in range(3):
            await tracker.record_usage({
                "skillName": "s1", "usedAt": f"t{i}",
                "success": False, "durationMs": 100,
                "failureReason": f"err{i}",
            })
        failures = await tracker.get_failure_cases("s1")
        # 最新(err2)应在首位
        assert failures[0]["failureReason"] == "err2"
        assert failures[2]["failureReason"] == "err0"

    @pytest.mark.asyncio
    async def test_limit_zero_returns_all(self, tracker):
        """源码:limit <= 0 时返回全部(recent = failures)。"""
        for i in range(3):
            await tracker.record_usage({
                "skillName": "s1", "usedAt": "now",
                "success": False, "durationMs": 100,
            })
        failures = await tracker.get_failure_cases("s1", limit=0)
        assert len(failures) == 3

    @pytest.mark.asyncio
    async def test_default_limit_is_5(self, tracker):
        for i in range(7):
            await tracker.record_usage({
                "skillName": "s1", "usedAt": "now",
                "success": False, "durationMs": 100,
            })
        failures = await tracker.get_failure_cases("s1")
        assert len(failures) == 5


# ------------------------------------------------------------
# _read_skill_version(静态方法)
# ------------------------------------------------------------


class TestReadSkillVersion:
    """_read_skill_version 从 skill 文件 frontmatter 读 version。"""

    def test_file_not_exists_returns_default(self, tmp_path, monkeypatch):
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        version = SkillFeedbackTracker._read_skill_version("nonexistent")
        assert version == "1.0.0"

    def test_file_without_version_returns_default(self, tmp_path, monkeypatch):
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        skill_file = tmp_path / "my-skill.md"
        skill_file.write_text("---\nname: my-skill\ndescription: d\n---\n# Instructions\nbody", encoding="utf-8")
        version = SkillFeedbackTracker._read_skill_version("my-skill")
        assert version == "1.0.0"

    def test_file_with_version_returns_version(self, tmp_path, monkeypatch):
        from app.services.skills import SkillRegistry
        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(lambda: str(tmp_path)))
        skill_file = tmp_path / "my-skill.md"
        skill_file.write_text("---\nname: my-skill\nversion: 2.3.1\n---\n# Instructions\nbody", encoding="utf-8")
        version = SkillFeedbackTracker._read_skill_version("my-skill")
        assert version == "2.3.1"

    def test_read_exception_returns_default(self, tmp_path, monkeypatch):
        """_auto_dir 抛异常 → 兜底返回 '1.0.0'。"""
        from app.services.skills import SkillRegistry

        def raise_error():
            raise OSError("access denied")

        monkeypatch.setattr(SkillRegistry, "_auto_dir", staticmethod(raise_error))
        version = SkillFeedbackTracker._read_skill_version("x")
        assert version == "1.0.0"


# ------------------------------------------------------------
# record_iteration(异步)
# ------------------------------------------------------------


class TestRecordIteration:
    """record_iteration 记录一次迭代历史。"""

    @pytest.mark.asyncio
    async def test_basic_record(self, tracker):
        await tracker.record_iteration("s1", {
            "version": "1.1.0",
            "iteratedAt": "2026-07-23T10:00:00Z",
            "reason": "improved",
            "previousPassRate": 0.5,
            "newPassRate": 0.8,
        })
        history = await tracker._get_iteration_history("s1")
        assert len(history) == 1
        assert history[0]["version"] == "1.1.0"
        assert history[0]["iteratedAt"] == "2026-07-23T10:00:00Z"
        assert history[0]["reason"] == "improved"
        assert history[0]["previousPassRate"] == 0.5
        assert history[0]["newPassRate"] == 0.8

    @pytest.mark.asyncio
    async def test_empty_skill_name_skipped(self, tracker):
        await tracker.record_iteration("", {"version": "1.0.0"})
        await tracker.record_iteration(None, {"version": "1.0.0"})
        assert len(tracker._iter_store) == 0

    @pytest.mark.asyncio
    async def test_multiple_iterations_append(self, tracker):
        for i in range(3):
            await tracker.record_iteration("s1", {"version": f"1.{i}.0"})
        history = await tracker._get_iteration_history("s1")
        assert len(history) == 3
        assert history[0]["version"] == "1.0.0"
        assert history[2]["version"] == "1.2.0"

    @pytest.mark.asyncio
    async def test_field_type_coercion(self, tracker):
        """version/iteratedAt/reason 转 str,passRate 转 float。"""
        await tracker.record_iteration("s1", {
            "version": 123,  # 非 str
            "iteratedAt": 456,
            "reason": None,
            "previousPassRate": "0.5",  # 非 float
            "newPassRate": 1,
        })
        history = await tracker._get_iteration_history("s1")
        assert history[0]["version"] == "123"
        assert history[0]["iteratedAt"] == "456"
        assert history[0]["reason"] == "None"
        assert history[0]["previousPassRate"] == 0.5
        assert isinstance(history[0]["previousPassRate"], float)
        assert history[0]["newPassRate"] == 1.0

    @pytest.mark.asyncio
    async def test_none_pass_rate_coerced_to_zero(self, tracker):
        await tracker.record_iteration("s1", {
            "version": "1.0.0",
            "previousPassRate": None,
            "newPassRate": None,
        })
        history = await tracker._get_iteration_history("s1")
        assert history[0]["previousPassRate"] == 0.0
        assert history[0]["newPassRate"] == 0.0


# ------------------------------------------------------------
# _get_iteration_history(异步)
# ------------------------------------------------------------


class TestGetIterationHistory:
    """_get_iteration_history 读取迭代历史。"""

    @pytest.mark.asyncio
    async def test_empty_returns_empty_list(self, tracker):
        history = await tracker._get_iteration_history("nonexistent")
        assert history == []

    @pytest.mark.asyncio
    async def test_returns_all_records(self, tracker):
        for i in range(3):
            await tracker.record_iteration("s1", {"version": f"1.{i}.0"})
        history = await tracker._get_iteration_history("s1")
        assert len(history) == 3

    @pytest.mark.asyncio
    async def test_returns_copy_not_reference(self, tracker):
        await tracker.record_iteration("s1", {"version": "1.0.0"})
        history = await tracker._get_iteration_history("s1")
        history.clear()
        history2 = await tracker._get_iteration_history("s1")
        assert len(history2) == 1


# ------------------------------------------------------------
# get_stats 集成 iterationHistory
# ------------------------------------------------------------


class TestGetStatsIterationHistory:
    """get_stats 包含 iterationHistory 字段。"""

    @pytest.mark.asyncio
    async def test_stats_includes_iteration_history(self, tracker):
        await tracker.record_iteration("s1", {"version": "1.1.0", "reason": "improved"})
        stats = await tracker.get_stats("s1")
        assert "iterationHistory" in stats
        assert len(stats["iterationHistory"]) == 1
        assert stats["iterationHistory"][0]["version"] == "1.1.0"

    @pytest.mark.asyncio
    async def test_stats_iteration_history_empty_when_none(self, tracker):
        stats = await tracker.get_stats("s1")
        assert stats["iterationHistory"] == []


# ------------------------------------------------------------
# 全局单例
# ------------------------------------------------------------


class TestGlobalSingleton:
    """skill_feedback_tracker 全局单例。"""

    def test_singleton_is_tracker_instance(self):
        assert isinstance(skill_feedback_tracker, SkillFeedbackTracker)

    def test_singleton_has_record_usage(self):
        assert hasattr(skill_feedback_tracker, "record_usage")
        assert callable(skill_feedback_tracker.record_usage)

    def test_singleton_has_get_stats(self):
        assert hasattr(skill_feedback_tracker, "get_stats")
        assert callable(skill_feedback_tracker.get_stats)

    def test_singleton_has_get_failure_cases(self):
        assert hasattr(skill_feedback_tracker, "get_failure_cases")
        assert callable(skill_feedback_tracker.get_failure_cases)

    def test_singleton_has_record_iteration(self):
        assert hasattr(skill_feedback_tracker, "record_iteration")
        assert callable(skill_feedback_tracker.record_iteration)

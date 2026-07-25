"""ShadowRunner 测试(L5-4,2026-07-25 立)。

覆盖 shadow_runner.py:
- register_treatment / unregister_treatment / get_treatment
- maybe_shadow_call:无 active test / shadow_ratio=0 / treatment 未注册 → 跳过
- maybe_shadow_call:概率采样命中 → fire-and-forget LLM 调用
- _shadow_call:LLM 成功 / LLM 失败 / record 调用
- cleanup_inactive 清理已结束测试的 treatment
- get_status / 全局单例
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.ab_test_tracker import ABTestTracker, _empty_stats
from app.services.shadow_runner import ShadowRunner, shadow_runner


@pytest.fixture
def fresh_runner(monkeypatch):
    """返回一个全新 ShadowRunner + 全新 ABTestTracker(隔离测试)。"""
    r = ShadowRunner()
    # 替换全局单例的 ab_test_tracker 引用为本地实例
    tracker = ABTestTracker()
    monkeypatch.setattr(
        "app.services.shadow_runner.ab_test_tracker", tracker
    )
    return r, tracker


# =============================================================================
# Treatment 内容管理
# =============================================================================


class TestRegisterTreatment:
    """register_treatment 注册 treatment 内容。"""

    @pytest.mark.asyncio
    async def test_register(self, fresh_runner):
        r, _ = fresh_runner
        await r.register_treatment("test-1", "treatment prompt content")
        assert r.get_treatment("test-1") == "treatment prompt content"

    @pytest.mark.asyncio
    async def test_register_empty_test_id_skipped(self, fresh_runner):
        r, _ = fresh_runner
        await r.register_treatment("", "content")
        assert r.get_treatment("") is None

    @pytest.mark.asyncio
    async def test_register_empty_content_skipped(self, fresh_runner):
        r, _ = fresh_runner
        await r.register_treatment("test-1", "")
        assert r.get_treatment("test-1") is None

    @pytest.mark.asyncio
    async def test_register_overrides_existing(self, fresh_runner):
        r, _ = fresh_runner
        await r.register_treatment("test-1", "old content")
        await r.register_treatment("test-1", "new content")
        assert r.get_treatment("test-1") == "new content"


class TestUnregisterTreatment:
    """unregister_treatment 清理 treatment 内容。"""

    @pytest.mark.asyncio
    async def test_unregister_existing(self, fresh_runner):
        r, _ = fresh_runner
        await r.register_treatment("test-1", "content")
        await r.unregister_treatment("test-1")
        assert r.get_treatment("test-1") is None

    @pytest.mark.asyncio
    async def test_unregister_nonexistent(self, fresh_runner):
        r, _ = fresh_runner
        # 不存在的 test_id → 不抛异常
        await r.unregister_treatment("nonexistent")


class TestGetTreatment:
    """get_treatment 查询。"""

    @pytest.mark.asyncio
    async def test_nonexistent_returns_none(self, fresh_runner):
        r, _ = fresh_runner
        assert r.get_treatment("nonexistent") is None


# =============================================================================
# maybe_shadow_call:跳过场景
# =============================================================================


class TestMaybeShadowCallSkipped:
    """maybe_shadow_call 各跳过场景。"""

    def test_no_active_test_skipped(self, fresh_runner):
        """无 active test → 跳过(无 task 创建)。"""
        r, tracker = fresh_runner
        # tracker 中无 active test
        r.maybe_shadow_call(
            skill_name="skill-no-test",
            control_call_result={"content": "x", "tokens": 100, "error": None},
            model=None,
            variables={},
        )
        # 没有 pending task
        assert len(r._pending_tasks) == 0

    @pytest.mark.asyncio
    async def test_shadow_ratio_zero_skipped(self, fresh_runner):
        """shadow_ratio=0 → 永远跳过。"""
        r, tracker = fresh_runner
        test_id = await tracker.create_test(
            "skill-a", "1.0.0", "1.1.0", shadow_ratio=0.0
        ) if False else await tracker.create_test(
            "skill-a", "1.0.0", "1.1.0", shadow_ratio=0.1
        )
        # 直接改 shadowRatio 为 0
        tracker._tests[test_id]["shadowRatio"] = 0.0
        await r.register_treatment(test_id, "treatment content")
        r.maybe_shadow_call(
            skill_name="skill-a",
            control_call_result={"content": "x", "tokens": 100, "error": None},
            model=None,
            variables={},
        )
        assert len(r._pending_tasks) == 0

    @pytest.mark.asyncio
    async def test_treatment_not_registered_skipped(self, fresh_runner, monkeypatch):
        """treatment 内容未注册 → 跳过(无 task)。"""
        r, tracker = fresh_runner
        await tracker.create_test("skill-a", "1.0.0", "1.1.0", shadow_ratio=1.0)
        # 不 register_treatment → 概率采样命中也无法 shadow
        # 用 monkeypatch 强制 random.random 返回 0(命中 shadow_ratio=1.0)
        monkeypatch.setattr("app.services.shadow_runner.random.random", lambda: 0.0)
        r.maybe_shadow_call(
            skill_name="skill-a",
            control_call_result={"content": "x", "tokens": 100, "error": None},
            model=None,
            variables={},
        )
        assert len(r._pending_tasks) == 0

    @pytest.mark.asyncio
    async def test_random_above_ratio_skipped(self, fresh_runner, monkeypatch):
        """随机数 >= shadow_ratio → 跳过。"""
        r, tracker = fresh_runner
        await tracker.create_test("skill-a", "1.0.0", "1.1.0", shadow_ratio=0.1)
        await r.register_treatment(
            tracker.get_active_test("skill-a")["testId"], "treatment content"
        )
        # random.random 返回 0.5 ≥ 0.1 → 跳过
        monkeypatch.setattr("app.services.shadow_runner.random.random", lambda: 0.5)
        r.maybe_shadow_call(
            skill_name="skill-a",
            control_call_result={"content": "x", "tokens": 100, "error": None},
            model=None,
            variables={},
        )
        assert len(r._pending_tasks) == 0


# =============================================================================
# maybe_shadow_call:触发场景
# =============================================================================


class TestMaybeShadowCallTriggered:
    """maybe_shadow_call 触发 shadow 调用场景。"""

    @pytest.mark.asyncio
    async def test_trigger_creates_task(self, fresh_runner, monkeypatch):
        """概率采样命中 + treatment 已注册 → 创建 task。"""
        r, tracker = fresh_runner
        await tracker.create_test("skill-a", "1.0.0", "1.1.0", shadow_ratio=0.1)
        await r.register_treatment(
            tracker.get_active_test("skill-a")["testId"], "treatment content"
        )
        # random 命中
        monkeypatch.setattr("app.services.shadow_runner.random.random", lambda: 0.05)
        # mock _shadow_call 避免 LLM 真实调用
        mock_shadow = AsyncMock()
        monkeypatch.setattr(r, "_shadow_call", mock_shadow)

        r.maybe_shadow_call(
            skill_name="skill-a",
            control_call_result={"content": "x", "tokens": 100, "error": None},
            model="gpt-4",
            variables={"k": "v"},
        )
        # 创建了 task
        assert len(r._pending_tasks) == 1
        # 等待 task 完成让 callback 执行
        await list(r._pending_tasks)[0]
        # _shadow_call 被调用
        assert mock_shadow.called
        call_kwargs = mock_shadow.call_args.kwargs
        assert call_kwargs["skill_name"] == "skill-a"
        assert call_kwargs["model"] == "gpt-4"

    def test_exception_does_not_propagate(self, fresh_runner, monkeypatch):
        """任何异常都不向上抛(不影响 SkillScheduler 主流程)。"""
        r, tracker = fresh_runner
        # tracker.get_active_test 抛异常
        def _boom(*args, **kwargs):
            raise RuntimeError("unexpected")
        monkeypatch.setattr(tracker, "get_active_test", _boom)
        # 不抛异常
        r.maybe_shadow_call(
            skill_name="skill-a",
            control_call_result={"content": "x", "tokens": 100, "error": None},
            model=None,
            variables={},
        )
        assert len(r._pending_tasks) == 0


# =============================================================================
# _shadow_call:LLM 调用 + 记录指标
# =============================================================================


class TestShadowCall:
    """_shadow_call 执行 LLM shadow 调用 + 记录指标。"""

    @pytest.mark.asyncio
    async def test_llm_success_records_both_versions(self, fresh_runner, monkeypatch):
        """LLM 成功 → 记录 control + treatment 指标。"""
        r, tracker = fresh_runner
        test_id = await tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await r.register_treatment(test_id, "treatment content")

        # mock llm_gateway.complete
        async def _fake_complete(messages, **kwargs):
            return {"content": "treatment result", "usage": {"total_tokens": 80}, "error": None}
        monkeypatch.setattr(
            "app.services.shadow_runner.llm_gateway.complete", _fake_complete
        )

        await r._shadow_call(
            test_id=test_id,
            skill_name="skill-a",
            treatment_content="treatment content",
            variables={},
            model=None,
            control_call_result={"content": "control result", "tokens": 100, "error": None},
        )

        test = tracker.get_test(test_id)
        # control 记录了一次调用(success=True)
        assert test["controlStats"]["success_count"] == 1
        assert test["controlStats"]["tokens_sum"] == 100
        # treatment 记录了一次调用(success=True, tokens=80)
        assert test["treatmentStats"]["success_count"] == 1
        assert test["treatmentStats"]["tokens_sum"] == 80
        # duration_ms_sum >= 0(mock LLM 可能极快返回导致 0,不强制 > 0)
        assert test["treatmentStats"]["duration_ms_sum"] >= 0

    @pytest.mark.asyncio
    async def test_llm_failure_records_failure(self, fresh_runner, monkeypatch):
        """LLM 调用失败 → 记录 failure。"""
        r, tracker = fresh_runner
        test_id = await tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await r.register_treatment(test_id, "treatment content")

        async def _fake_complete_failed(messages, **kwargs):
            raise RuntimeError("llm down")
        monkeypatch.setattr(
            "app.services.shadow_runner.llm_gateway.complete", _fake_complete_failed
        )

        await r._shadow_call(
            test_id=test_id,
            skill_name="skill-a",
            treatment_content="treatment content",
            variables={},
            model=None,
            control_call_result={"content": "control result", "tokens": 100, "error": None},
        )

        test = tracker.get_test(test_id)
        # control success(control_call_result 无 error)
        assert test["controlStats"]["success_count"] == 1
        # treatment failure(LLM 抛异常)
        assert test["treatmentStats"]["failure_count"] == 1
        assert test["treatmentStats"]["success_count"] == 0

    @pytest.mark.asyncio
    async def test_llm_returns_error_records_failure(self, fresh_runner, monkeypatch):
        """LLM 返回 error → 记录 failure。"""
        r, tracker = fresh_runner
        test_id = await tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await r.register_treatment(test_id, "treatment content")

        async def _fake_complete_error(messages, **kwargs):
            return {"content": "", "usage": {}, "error": "rate_limit"}
        monkeypatch.setattr(
            "app.services.shadow_runner.llm_gateway.complete", _fake_complete_error
        )

        await r._shadow_call(
            test_id=test_id,
            skill_name="skill-a",
            treatment_content="treatment content",
            variables={},
            model=None,
            control_call_result={"content": "control result", "tokens": 100, "error": None},
        )

        test = tracker.get_test(test_id)
        assert test["treatmentStats"]["failure_count"] == 1
        assert test["treatmentStats"]["success_count"] == 0

    @pytest.mark.asyncio
    async def test_control_failure_recorded(self, fresh_runner, monkeypatch):
        """control_call_result 含 error → control 记录 failure。"""
        r, tracker = fresh_runner
        test_id = await tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await r.register_treatment(test_id, "treatment content")

        async def _fake_complete(messages, **kwargs):
            return {"content": "ok", "usage": {"total_tokens": 50}, "error": None}
        monkeypatch.setattr(
            "app.services.shadow_runner.llm_gateway.complete", _fake_complete
        )

        await r._shadow_call(
            test_id=test_id,
            skill_name="skill-a",
            treatment_content="treatment content",
            variables={},
            model=None,
            control_call_result={"content": "", "tokens": 0, "error": "control failed"},
        )

        test = tracker.get_test(test_id)
        # control failure
        assert test["controlStats"]["failure_count"] == 1
        assert test["controlStats"]["success_count"] == 0
        # treatment success(LLM 正常)
        assert test["treatmentStats"]["success_count"] == 1

    @pytest.mark.asyncio
    async def test_unknown_test_id_skipped(self, fresh_runner, monkeypatch):
        """test_id 不存在 → 不记录。"""
        r, tracker = fresh_runner
        async def _fake_complete(messages, **kwargs):
            return {"content": "ok", "usage": {"total_tokens": 50}, "error": None}
        monkeypatch.setattr(
            "app.services.shadow_runner.llm_gateway.complete", _fake_complete
        )
        # 不抛异常
        await r._shadow_call(
            test_id="nonexistent",
            skill_name="skill-a",
            treatment_content="x",
            variables={},
            model=None,
            control_call_result={"content": "", "tokens": 0, "error": None},
        )


# =============================================================================
# cleanup_inactive / get_status
# =============================================================================


class TestCleanupInactive:
    """cleanup_inactive 清理已结束测试的 treatment。"""

    @pytest.mark.asyncio
    async def test_cleans_stopped_tests(self, fresh_runner, monkeypatch):
        r, tracker = fresh_runner
        test_id = await tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await r.register_treatment(test_id, "content")
        # 测试还在 running → 不清理
        await r.cleanup_inactive()
        assert r.get_treatment(test_id) == "content"
        # 标记 stopped → 清理
        await tracker.stop_test(test_id)
        cleaned = await r.cleanup_inactive()
        assert cleaned == 1
        assert r.get_treatment(test_id) is None

    @pytest.mark.asyncio
    async def test_keeps_running_tests(self, fresh_runner):
        r, tracker = fresh_runner
        test_id = await tracker.create_test("skill-a", "1.0.0", "1.1.0")
        await r.register_treatment(test_id, "content")
        cleaned = await r.cleanup_inactive()
        assert cleaned == 0
        assert r.get_treatment(test_id) == "content"


class TestGetStatus:
    """get_status 状态摘要。"""

    @pytest.mark.asyncio
    async def test_empty(self, fresh_runner):
        r, _ = fresh_runner
        status = r.get_status()
        assert status["registeredTreatments"] == 0
        assert status["pendingTasks"] == 0
        assert status["testIds"] == []

    @pytest.mark.asyncio
    async def test_with_treatments(self, fresh_runner):
        r, _ = fresh_runner
        await r.register_treatment("test-1", "content-1")
        await r.register_treatment("test-2", "content-2")
        status = r.get_status()
        assert status["registeredTreatments"] == 2
        assert "test-1" in status["testIds"]
        assert "test-2" in status["testIds"]


# =============================================================================
# 全局单例
# =============================================================================


class TestSingleton:
    """全局单例 shadow_runner。"""

    def test_singleton_exists(self):
        assert shadow_runner is not None
        assert isinstance(shadow_runner, ShadowRunner)

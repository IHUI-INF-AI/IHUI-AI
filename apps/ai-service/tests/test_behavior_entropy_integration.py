"""behavior_entropy 端到端集成测试(2026-08-01 立)。

测试覆盖(15 cases):
1. behavior_humanizer.human_type diversify 扰动集成(3 tests):
   - diversify 正常调用(BEHAVIOR_TYPE)→ 扰动后间隔用于 sleep
   - diversify 失败 → try/except 降级原始间隔(不崩溃)
   - len(raw_intervals) < 2 → 跳过 diversify(单字符文本)
   注意:源码中仅 human_type 集成了 diversify(commit a78e692f81),
   human_move_mouse / human_click 未集成(BEHAVIOR_MOUSE/CLICK 导入但未使用)。
2. behavior_humanizer human_move_mouse / human_click 行为验证(4 tests):
   - human_move_mouse 生成贝塞尔轨迹 → page.mouse.move 逐点调用
   - human_move_mouse steps 与距离正相关
   - human_click selector 路径 → element.bounding_box → 点击
   - human_click x/y 路径 → 随机偏移点击
3. scheduler B5 时区地理一致性(3 tests):
   - 字段缺失 → debug 跳过(不调 validate)/ 发布仍成功
   - 不一致 → warning 不阻塞(publish 仍成功)
   - 一致 → 无 warning
4. scheduler B6 TLS 指纹建议(2 tests):
   - 成功 → tls_profile 注入 platform_config
   - 失败 → warning 不阻塞(publish 仍成功)
5. scheduler B7 行为熵分析(3 tests):
   - 样本 < 5 → 跳过(不调 analyze)
   - 熵值异常 → log_risk_event warning
   - 熵值正常 → 不调 log_risk_event

测试隔离:全用 AsyncMock/MagicMock mock Playwright Page / scheduler 依赖,
不真实启动浏览器或连接 DB。
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.publish.anti_risk.behavior_humanizer import (
    human_click,
    human_move_mouse,
    human_type,
)
from app.services.publish.anti_risk.behavior_entropy import (
    BEHAVIOR_TYPE,
    get_entropy_analyzer,
)
from app.services.publish.base_adapter import PublishContent, PublishResult
from app.services.publish.scheduler import PublishScheduler


# =============================================================================
# 1. human_type diversify 扰动集成(3 tests)
# =============================================================================


class TestHumanTypeDiversify:
    """测试 human_type() 集成 behavior_entropy diversify 扰动。

    源码 behavior_humanizer.py L182-194:
    - 预生成 raw_intervals(每字符间隔,标点更长)
    - len >= 2 时调 get_entropy_analyzer().diversify(raw_intervals, BEHAVIOR_TYPE)
    - diversify 失败 → try/except 降级原始间隔
    """

    @patch("app.services.publish.anti_risk.behavior_humanizer.get_entropy_analyzer")
    async def test_diversify_called_with_behavior_type(self, mock_get_analyzer: MagicMock):
        """human_type 调用 diversify(raw_intervals, BEHAVIOR_TYPE),扰动后间隔用于 sleep。"""
        mock_analyzer = MagicMock()
        mock_analyzer.diversify = MagicMock(return_value=[0.2, 0.15, 0.3])
        mock_get_analyzer.return_value = mock_analyzer

        page = AsyncMock()
        await human_type(page, "abc")

        mock_get_analyzer.assert_called_once()
        mock_analyzer.diversify.assert_called_once()
        call_args = mock_analyzer.diversify.call_args
        assert call_args.args[1] == BEHAVIOR_TYPE
        # 扰动后间隔长度 == 文本长度
        assert len(call_args.args[0]) == 3

    @patch("app.services.publish.anti_risk.behavior_humanizer.get_entropy_analyzer")
    async def test_diversify_failure_falls_back_to_raw_intervals(
        self, mock_get_analyzer: MagicMock
    ):
        """diversify 抛异常时,try/except 降级为原始间隔(不崩溃,继续输入)。"""
        mock_analyzer = MagicMock()
        mock_analyzer.diversify = MagicMock(side_effect=RuntimeError("numpy error"))
        mock_get_analyzer.return_value = mock_analyzer

        page = AsyncMock()
        # 不应抛异常(降级成功)
        await human_type(page, "abc")

        mock_analyzer.diversify.assert_called_once()
        # keyboard.type 仍被调用 3 次(降级后正常输入)
        assert page.keyboard.type.call_count == 3

    async def test_short_text_skips_diversify(self):
        """len(raw_intervals) < 2(单字符文本)时跳过 diversify。

        源码: `if len(raw_intervals) >= 2:` 守卫,单字符不调 diversify。
        """
        with patch(
            "app.services.publish.anti_risk.behavior_humanizer.get_entropy_analyzer"
        ) as mock_get_analyzer:
            mock_analyzer = MagicMock()
            mock_analyzer.diversify = MagicMock()
            mock_get_analyzer.return_value = mock_analyzer

            page = AsyncMock()
            await human_type(page, "x")  # 单字符

            # diversify 未被调用(len < 2)
            mock_analyzer.diversify.assert_not_called()
            # 但 keyboard.type 仍被调用 1 次
            assert page.keyboard.type.call_count == 1


# =============================================================================
# 2. human_move_mouse / human_click 行为验证(4 tests)
# =============================================================================


class TestHumanMoveMouse:
    """测试 human_move_mouse() 贝塞尔曲线轨迹生成。

    注意:human_move_mouse 当前未集成 diversify(仅用 _triangular_sample 间隔),
    测试验证其现有行为:生成贝塞尔轨迹点 → page.mouse.move 逐点调用。
    """

    async def test_generates_bezier_points_and_calls_mouse_move(self):
        """human_move_mouse 生成轨迹点,逐点调用 page.mouse.move。"""
        page = AsyncMock()
        await human_move_mouse(page, 200.0, 200.0, start=(0.0, 0.0))

        # page.mouse.move 被调用多次(贝塞尔轨迹点数 = steps + 1)
        assert page.mouse.move.call_count >= 6  # 最少 5 步 → 6 点
        # 最后一个点接近目标 (200, 200)
        last_call = page.mouse.move.call_args
        last_x, last_y = last_call.args[0], last_call.args[1]
        assert abs(last_x - 200.0) < 5.0
        assert abs(last_y - 200.0) < 5.0

    async def test_steps_correlate_with_distance(self):
        """距离更远 → 步数更多 → mouse.move 调用次数更多。"""
        page_short = AsyncMock()
        await human_move_mouse(page_short, 50.0, 0.0, start=(0.0, 0.0))
        short_calls = page_short.mouse.move.call_count

        page_long = AsyncMock()
        await human_move_mouse(page_long, 500.0, 0.0, start=(0.0, 0.0))
        long_calls = page_long.mouse.move.call_count

        # 长距离步数 >= 短距离步数(每 50px 一步,50px→5步,500px→10步)
        assert long_calls >= short_calls


class TestHumanClick:
    """测试 human_click() 点击行为。

    注意:human_click 当前未集成 diversify,测试验证其现有行为:
    selector 路径(element.bounding_box)或 x/y 路径(随机偏移)→ 点击。
    """

    async def test_selector_path_clicks_element(self):
        """selector 路径:query_selector + bounding_box → 在元素范围内点击。"""
        page = AsyncMock()
        element = AsyncMock()
        element.bounding_box.return_value = {
            "x": 100.0, "y": 100.0, "width": 50.0, "height": 30.0,
        }
        page.query_selector.return_value = element

        await human_click(page, selector="#submit-btn")

        page.query_selector.assert_awaited_once_with("#submit-btn")
        element.bounding_box.assert_awaited_once()
        # mouse.click 被调用
        page.mouse.click.assert_awaited_once()
        click_x, click_y = page.mouse.click.call_args.args[0], page.mouse.click.call_args.args[1]
        # 点击位置在元素范围内 (100-150, 100-130)
        assert 100.0 <= click_x <= 150.0
        assert 100.0 <= click_y <= 130.0

    async def test_xy_path_clicks_with_offset(self):
        """x/y 路径:在目标 ±5px 随机偏移点击。"""
        page = AsyncMock()
        await human_click(page, x=300.0, y=200.0)

        page.mouse.click.assert_awaited_once()
        click_x, click_y = page.mouse.click.call_args.args[0], page.mouse.click.call_args.args[1]
        # 偏移在 ±5px 内
        assert 295.0 <= click_x <= 305.0
        assert 195.0 <= click_y <= 205.0


# =============================================================================
# 3. scheduler B5 时区地理一致性(3 tests)
# =============================================================================


def _make_content() -> PublishContent:
    """构造测试用 PublishContent(html=None 跳过图片处理)。"""
    return PublishContent(format="md", title="测试标题", text="测试正文内容")


def _make_target(config: dict | None = None) -> dict:
    """构造测试用 target(platform=csdn, account_id=123)。"""
    return {
        "platform": "csdn",
        "account_id": 123,
        "config": config or {},
    }


@pytest.fixture
def scheduler_with_mocks(monkeypatch: pytest.MonkeyPatch):
    """构造 PublishScheduler 实例 + mock 所有 _run_single_platform 前置依赖。

    mock 范围:
    - get_adapter → mock adapter(PublishResult success=True)
    - _load_credentials → 返回含 proxy_ip 的凭证 dict
    - notifications → noop
    - validate_content → valid=True
    - truncate_to_platform / enrich_content_for_platform / process_external_images → noop
    - get_deduplicator → noop
    - CooldownManager → 不在冷却中
    - RiskScorer → 账号安全(score=10)
    - get_monitor → Cookie healthy
    - CrossAccountGuard → 无关联(本地 import,patch anti_risk 模块)
    - AuditLogger → mock(log_publish_attempt / log_risk_event)
    - _write_history → noop
    - _get_conn → mock conn(供 B7 查询)

    返回 dict:可覆盖 B5/B6/B7 相关 mock 验证特定行为。
    """
    from app.services.publish import scheduler as sched_module
    from app.services.publish import anti_risk as ar_module

    sched = PublishScheduler()

    # --- adapter + credentials ---
    mock_adapter = AsyncMock()
    mock_adapter.publish = AsyncMock(return_value=PublishResult(
        success=True, platform="csdn", published_url="http://example.com/post/1",
    ))
    monkeypatch.setattr(sched_module, "get_adapter", lambda p: mock_adapter)
    sched._load_credentials = AsyncMock(return_value={"token": "abc", "proxy_ip": "1.2.3.4"})

    # --- notifications ---
    mock_notifications = MagicMock()
    mock_notifications.notify_progress = AsyncMock()
    mock_notifications.notify_publish_complete = AsyncMock()
    monkeypatch.setattr(sched_module, "notifications", mock_notifications)

    # --- content validation / enrichment ---
    mock_validation = MagicMock()
    mock_validation.valid = True
    mock_validation.errors = []
    mock_validation.warnings = []
    monkeypatch.setattr(sched_module, "validate_content", lambda p, c, cfg: mock_validation)
    monkeypatch.setattr(sched_module, "truncate_to_platform", lambda p, c: c)
    monkeypatch.setattr(sched_module, "enrich_content_for_platform", lambda c, p: None)
    monkeypatch.setattr(sched_module, "process_external_images", AsyncMock(return_value=""))

    # --- deduplicator ---
    mock_dedup = MagicMock()
    mock_dedup.diversify_for_platform = lambda c, p, a: c
    monkeypatch.setattr(sched_module, "get_deduplicator", lambda: mock_dedup)

    # --- CooldownManager ---
    mock_cooldown_mgr = MagicMock()
    mock_cooldown_mgr.is_in_cooldown = MagicMock(return_value=(False, None))
    mock_cooldown_mgr.get_remaining_time = MagicMock(return_value=0)
    mock_cooldown_mgr.enter_cooldown = MagicMock()
    mock_cooldown_mgr.record_success = MagicMock()
    mock_cooldown_mgr.record_failure = MagicMock(return_value=None)
    mock_cooldown_cls = MagicMock()
    mock_cooldown_cls.get_instance.return_value = mock_cooldown_mgr
    monkeypatch.setattr(sched_module, "CooldownManager", mock_cooldown_cls)

    # --- RiskScorer ---
    mock_risk_score = MagicMock()
    mock_risk_score.score = 10
    mock_risk_score.factors = []
    mock_scorer = MagicMock()
    mock_scorer.is_account_safe_to_publish = MagicMock(return_value=(True, mock_risk_score))
    mock_scorer.record_risk_event = MagicMock()
    mock_scorer_cls = MagicMock()
    mock_scorer_cls.get_instance.return_value = mock_scorer
    mock_scorer_cls.is_platform_risk_error = MagicMock(return_value=False)
    monkeypatch.setattr(sched_module, "RiskScorer", mock_scorer_cls)

    # --- Cookie health monitor ---
    mock_cookie_health = MagicMock()
    mock_cookie_health.status = "healthy"
    mock_cookie_health.days_until_expiry = 30
    mock_monitor = MagicMock()
    mock_monitor.check_cookie_health = AsyncMock(return_value=mock_cookie_health)
    monkeypatch.setattr(sched_module, "get_monitor", lambda: mock_monitor)

    # --- Captcha solver ---
    mock_solver = MagicMock()
    mock_solver._provider = "none"
    monkeypatch.setattr(sched_module, "get_solver", lambda: mock_solver)

    # --- AuditLogger ---
    mock_audit = MagicMock()
    mock_audit.log_publish_attempt = MagicMock()
    mock_audit.log_risk_event = MagicMock()
    mock_audit.log_cooldown_event = MagicMock()
    mock_audit_cls = MagicMock()
    mock_audit_cls.get_instance.return_value = mock_audit
    monkeypatch.setattr(sched_module, "AuditLogger", mock_audit_cls)

    # --- CrossAccountGuard(本地 import,patch anti_risk 模块)---
    mock_cross_guard = MagicMock()
    mock_cross_guard.async_check_device_linkage = AsyncMock(return_value=(False, 0, []))
    mock_cross_guard_cls = MagicMock()
    mock_cross_guard_cls.get_instance.return_value = mock_cross_guard
    monkeypatch.setattr(ar_module, "CrossAccountGuard", mock_cross_guard_cls)

    # --- _write_history / _get_conn(实例方法)---
    sched._write_history = AsyncMock()

    mock_conn_b7 = AsyncMock()
    mock_conn_b7.fetch = AsyncMock(return_value=[])
    mock_conn_b7.close = AsyncMock()
    sched._get_conn = AsyncMock(return_value=mock_conn_b7)

    return {
        "scheduler": sched,
        "adapter": mock_adapter,
        "audit": mock_audit,
        "audit_cls": mock_audit_cls,
        "conn_b7": mock_conn_b7,
        "mock_risk_score": mock_risk_score,
        "monkeypatch": monkeypatch,
    }


class TestSchedulerB5TimezoneGeo:
    """测试 scheduler B5 时区地理一致性校验。

    源码 scheduler.py L670-700:
    - 从 platform_config / credentials 取 proxy_ip + timezone + language
    - proxy_ip 和 timezone 均非空 → get_timezone_geo_validator().validate()
    - 不一致 → logger.warning(不阻塞)
    - 字段缺失 → logger.debug 跳过
    - 异常 → logger.warning(不阻塞)
    """

    async def test_fields_missing_skips_validate(self, scheduler_with_mocks):
        """B5 字段缺失(无 proxy_ip/timezone)→ 跳过 validate,发布仍成功。"""
        env = scheduler_with_mocks
        sched = env["scheduler"]

        mock_geo_validator = MagicMock()
        mock_geo_validator.validate = AsyncMock()
        env["monkeypatch"].setattr(
            "app.services.publish.anti_risk.get_timezone_geo_validator",
            lambda: mock_geo_validator,
        )

        # config 无 proxy_ip / timezone
        target = _make_target(config={})
        result = await sched._run_single_platform(
            "task-1", "user-1", _make_content(), target,
        )

        # validate 未被调用(字段缺失跳过)
        mock_geo_validator.validate.assert_not_called()
        # 发布仍成功(不阻塞)
        assert result.success is True

    async def test_inconsistent_does_not_block_publish(self, scheduler_with_mocks):
        """B5 不一致 → warning,但发布仍成功(不阻塞)。"""
        env = scheduler_with_mocks
        sched = env["scheduler"]

        mock_geo_validator = MagicMock()
        mock_geo_validator.validate = AsyncMock(
            return_value=MagicMock(consistent=False, suggestion="时区不匹配"),
        )
        env["monkeypatch"].setattr(
            "app.services.publish.anti_risk.get_timezone_geo_validator",
            lambda: mock_geo_validator,
        )

        target = _make_target(config={
            "proxy_ip": "1.2.3.4",
            "timezone": "America/New_York",
            "language": "en-US",
        })
        result = await sched._run_single_platform(
            "task-2", "user-1", _make_content(), target,
        )

        # validate 被调用
        mock_geo_validator.validate.assert_awaited_once()
        # 发布仍成功(不一致仅 warning,不阻塞)
        assert result.success is True

    async def test_consistent_no_warning(self, scheduler_with_mocks):
        """B5 一致 → 无 warning,发布成功。"""
        env = scheduler_with_mocks
        sched = env["scheduler"]

        mock_geo_validator = MagicMock()
        mock_geo_validator.validate = AsyncMock(
            return_value=MagicMock(consistent=True, suggestion=""),
        )
        env["monkeypatch"].setattr(
            "app.services.publish.anti_risk.get_timezone_geo_validator",
            lambda: mock_geo_validator,
        )

        target = _make_target(config={
            "proxy_ip": "1.2.3.4",
            "timezone": "Asia/Shanghai",
            "language": "zh-CN",
        })
        result = await sched._run_single_platform(
            "task-3", "user-1", _make_content(), target,
        )

        mock_geo_validator.validate.assert_awaited_once()
        assert result.success is True


# =============================================================================
# 4. scheduler B6 TLS 指纹建议(2 tests)
# =============================================================================


class TestSchedulerB6TlsFingerprint:
    """测试 scheduler B6 TLS 指纹建议。

    源码 scheduler.py L702-718:
    - get_tls_recommendation(account_id_str) → TLSProfile
    - platform_config["tls_profile"] = tls_profile.to_dict()
    - 异常 → logger.warning(不阻塞)
    """

    async def test_tls_profile_injected_into_config(self, scheduler_with_mocks):
        """B6 成功 → tls_profile 注入 platform_config(传给 adapter)。"""
        env = scheduler_with_mocks
        sched = env["scheduler"]
        adapter = env["adapter"]

        mock_tls_profile = MagicMock()
        mock_tls_profile.browser_name = "Chrome 121"
        mock_tls_profile.to_dict = MagicMock(
            return_value={"browser_name": "Chrome 121", "ja3_hash": "cd08e31494f9531f560d64c695473da9"}
        )
        env["monkeypatch"].setattr(
            "app.services.publish.anti_risk.get_tls_recommendation",
            lambda aid: mock_tls_profile,
        )

        target = _make_target(config={})
        result = await sched._run_single_platform(
            "task-4", "user-1", _make_content(), target,
        )

        # adapter.publish 被调用,platform_config 含 tls_profile
        # 源码:adapter.publish(platform_content, credentials, platform_config) 位置参数
        adapter.publish.assert_awaited_once()
        publish_args = adapter.publish.call_args.args
        platform_config = publish_args[2]  # 第 3 个位置参数
        assert "tls_profile" in platform_config
        assert platform_config["tls_profile"]["browser_name"] == "Chrome 121"
        assert result.success is True

    async def test_tls_failure_does_not_block_publish(self, scheduler_with_mocks):
        """B6 get_tls_recommendation 抛异常 → warning,发布仍成功(不阻塞)。"""
        env = scheduler_with_mocks
        sched = env["scheduler"]

        env["monkeypatch"].setattr(
            "app.services.publish.anti_risk.get_tls_recommendation",
            lambda aid: (_ for _ in ()).throw(RuntimeError("TLS lib error")),
        )

        target = _make_target(config={})
        result = await sched._run_single_platform(
            "task-5", "user-1", _make_content(), target,
        )

        # 异常被捕获,发布仍成功
        assert result.success is True


# =============================================================================
# 5. scheduler B7 行为熵分析(3 tests)
# =============================================================================


class TestSchedulerB7BehaviorEntropy:
    """测试 scheduler B7 行为熵分析。

    源码 scheduler.py L826-879:
    - 查询 publish_history 近 10 次成功发布的时间戳
    - 样本 < 5 → 跳过
    - 计算相邻间隔 → get_entropy_analyzer().analyze(intervals, BEHAVIOR_TYPE)
    - 熵值异常(is_human_like=False)→ logger.warning + audit.log_risk_event
    """

    async def test_sample_less_than_5_skips_analyze(self, scheduler_with_mocks):
        """B7 样本 < 5(3 行)→ 跳过 analyze(不调 get_entropy_analyzer)。"""
        env = scheduler_with_mocks
        sched = env["scheduler"]
        conn_b7 = env["conn_b7"]

        # 3 行历史(< 5 → 跳过)
        conn_b7.fetch.return_value = [
            {"ts": 1000.0}, {"ts": 1100.0}, {"ts": 1200.0},
        ]

        mock_entropy_analyzer = MagicMock()
        mock_entropy_analyzer.analyze = MagicMock()
        env["monkeypatch"].setattr(
            "app.services.publish.anti_risk.get_entropy_analyzer",
            lambda: mock_entropy_analyzer,
        )

        target = _make_target(config={})
        await sched._run_single_platform(
            "task-6", "user-1", _make_content(), target,
        )

        # analyze 未被调用(样本不足)
        mock_entropy_analyzer.analyze.assert_not_called()

    async def test_anomalous_entropy_logs_risk_event(self, scheduler_with_mocks):
        """B7 熵值异常(is_human_like=False)→ audit.log_risk_event 被调用。"""
        env = scheduler_with_mocks
        sched = env["scheduler"]
        conn_b7 = env["conn_b7"]
        audit = env["audit"]

        # 6 行历史(>= 5 → 进入分析,intervals 5 个 >= 5)
        conn_b7.fetch.return_value = [
            {"ts": float(1000 + i * 100)} for i in range(6)
        ]

        mock_entropy_analyzer = MagicMock()
        mock_entropy_analyzer.analyze = MagicMock(return_value=MagicMock(
            is_human_like=False,
            shannon_entropy=1.5,
            suggestion="熵值过低,行为过于规律",
            to_dict=lambda: {"shannon_entropy": 1.5, "is_human_like": False},
        ))
        env["monkeypatch"].setattr(
            "app.services.publish.anti_risk.get_entropy_analyzer",
            lambda: mock_entropy_analyzer,
        )

        target = _make_target(config={})
        await sched._run_single_platform(
            "task-7", "user-1", _make_content(), target,
        )

        # analyze 被调用
        mock_entropy_analyzer.analyze.assert_called_once()
        # log_risk_event 被调用(熵值异常)
        audit.log_risk_event.assert_called_once()
        call_args = audit.log_risk_event.call_args
        assert call_args.args[2] == "low_behavior_entropy"
        assert call_args.args[3] == "warning"

    async def test_human_like_entropy_no_risk_event(self, scheduler_with_mocks):
        """B7 熵值正常(is_human_like=True)→ 不调 log_risk_event。"""
        env = scheduler_with_mocks
        sched = env["scheduler"]
        conn_b7 = env["conn_b7"]
        audit = env["audit"]

        # 8 行历史(充分样本)
        conn_b7.fetch.return_value = [
            {"ts": float(1000 + i * 100)} for i in range(8)
        ]

        mock_entropy_analyzer = MagicMock()
        mock_entropy_analyzer.analyze = MagicMock(return_value=MagicMock(
            is_human_like=True,
            shannon_entropy=3.5,
            suggestion="",
            to_dict=lambda: {"shannon_entropy": 3.5, "is_human_like": True},
        ))
        env["monkeypatch"].setattr(
            "app.services.publish.anti_risk.get_entropy_analyzer",
            lambda: mock_entropy_analyzer,
        )

        target = _make_target(config={})
        await sched._run_single_platform(
            "task-8", "user-1", _make_content(), target,
        )

        # analyze 被调用
        mock_entropy_analyzer.analyze.assert_called_once()
        # log_risk_event 未被调用(熵值正常)
        audit.log_risk_event.assert_not_called()

"""建议 144 测试: CanaryAutoPromoter Prometheus 指标源.

测试覆盖:
  - InMemoryMetricsSource (本地 promoter 注入)
  - PrometheusMetricsSource (mock httpx)
  - auto_detect_source 工厂 (env var)
  - feed_promoter_from_source 喂数据逻辑
  - get_stage 比例 → 阶段映射
  - NaN 处理 / 异常隔离 / timeout
"""

from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_state_file(tmp_path):
    return str(tmp_path / "canary_promoter_state.json")


@pytest.fixture
def controller(tmp_state_file):
    from app.canary_stages import CanaryStageController

    return CanaryStageController(
        state_file=tmp_state_file,
        cooldown_seconds=0.0,
        failure_threshold=3,
    )


@pytest.fixture
def promoter(controller):
    from app.canary_auto_promoter import CanaryAutoPromoter, PromoterConfig

    config = PromoterConfig(
        error_threshold=0.05,
        min_stable_minutes=0.01,
        check_interval_seconds=0.5,
        dry_run=False,
        min_traffic_count=5,
    )
    return CanaryAutoPromoter(controller, config=config)


# ---------------------------------------------------------------------------
# TestInMemoryMetricsSource
# ---------------------------------------------------------------------------


class TestInMemoryMetricsSource:
    """InMemoryMetricsSource 本地源."""

    def test_empty_returns_zero(self, promoter):
        from app.canary_metrics_source import InMemoryMetricsSource

        src = InMemoryMetricsSource(promoter=promoter)
        assert src.get_error_rate() == 0.0
        assert src.get_traffic_count() == 0

    def test_recorded_outcomes_count(self, promoter):
        from app.canary_metrics_source import InMemoryMetricsSource

        for _ in range(20):
            promoter.record_outcome(success=True, version="v2")
        src = InMemoryMetricsSource(promoter=promoter)
        assert src.get_traffic_count() == 20
        assert src.get_error_rate() == 0.0

    def test_mixed_outcomes(self, promoter):
        from app.canary_metrics_source import InMemoryMetricsSource

        for _ in range(7):
            promoter.record_outcome(success=True, version="v2")
        for _ in range(3):
            promoter.record_outcome(success=False, version="v2")
        src = InMemoryMetricsSource(promoter=promoter)
        assert src.get_traffic_count() == 10
        assert abs(src.get_error_rate() - 0.3) < 0.001

    def test_stage_from_controller(self, promoter, controller):
        from app.canary_metrics_source import InMemoryMetricsSource

        src = InMemoryMetricsSource(promoter=promoter, controller=controller)
        assert src.get_stage() == "0%"
        controller.promote(actor="t", reason="")
        assert src.get_stage() == "1%"

    def test_no_promoter_returns_defaults(self):
        from app.canary_metrics_source import InMemoryMetricsSource

        src = InMemoryMetricsSource()  # 无 promoter
        assert src.get_error_rate() == 0.0
        assert src.get_traffic_count() == 0
        # stage 走全局 controller, 默认 STAGE_0
        assert src.get_stage() in ("0%", "100%")  # 取决于全局状态


# ---------------------------------------------------------------------------
# TestPrometheusMetricsSource
# ---------------------------------------------------------------------------


class TestPrometheusMetricsSource:
    """PrometheusMetricsSource 远程抓取 (mock httpx)."""

    def test_query_success(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        with patch("httpx.Client.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {
                "status": "success",
                "data": {"result": [{"value": [1234567890, "0.15"]}]},
            }
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp
            src = PrometheusMetricsSource(url="http://prom:9090")
            val = src._query("test_query")
            assert val == 0.15
            mock_get.assert_called_once()

    def test_query_empty_result(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        with patch("httpx.Client.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {
                "status": "success",
                "data": {"result": []},
            }
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp
            src = PrometheusMetricsSource(url="http://prom:9090")
            val = src._query("test_query")
            assert val == 0.0

    def test_query_error_status(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        with patch("httpx.Client.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {
                "status": "error",
                "error": "bad query",
            }
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp
            src = PrometheusMetricsSource(url="http://prom:9090")
            val = src._query("test_query")
            assert val == 0.0

    def test_query_exception(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        with patch("httpx.Client.get") as mock_get:
            mock_get.side_effect = Exception("connection refused")
            src = PrometheusMetricsSource(url="http://prom:9090")
            val = src._query("test_query")
            assert val == 0.0

    def test_get_error_rate(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        with patch("httpx.Client.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {
                "status": "success",
                "data": {"result": [{"value": [0, "0.05"]}]},
            }
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp
            src = PrometheusMetricsSource(url="http://prom:9090", service="svc")
            rate = src.get_error_rate()
            assert rate == 0.05

    def test_get_error_rate_clamped(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        with patch("httpx.Client.get") as mock_get:
            mock_resp = MagicMock()
            # 异常值 2.0 (超 100%), 应 clamp 到 1.0
            mock_resp.json.return_value = {
                "status": "success",
                "data": {"result": [{"value": [0, "2.0"]}]},
            }
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp
            src = PrometheusMetricsSource(url="http://prom:9090")
            assert src.get_error_rate() == 1.0

    def test_get_error_rate_nan(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        with patch("httpx.Client.get") as mock_get:
            mock_resp = MagicMock()
            # NaN: 字符串 "NaN"
            mock_resp.json.return_value = {
                "status": "success",
                "data": {"result": [{"value": [0, "NaN"]}]},
            }
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp
            src = PrometheusMetricsSource(url="http://prom:9090")
            assert src.get_error_rate() == 0.0

    def test_get_traffic_count(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        with patch("httpx.Client.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {
                "status": "success",
                "data": {"result": [{"value": [0, "1234"]}]},
            }
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp
            src = PrometheusMetricsSource(url="http://prom:9090")
            assert src.get_traffic_count() == 1234

    def test_get_traffic_count_zero(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        with patch("httpx.Client.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {
                "status": "success",
                "data": {"result": [{"value": [0, "0"]}]},
            }
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp
            src = PrometheusMetricsSource(url="http://prom:9090")
            assert src.get_traffic_count() == 0

    def test_get_stage_mapping(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        # 测试 ratio → stage 映射
        mapping = [
            (0.0, "0%"),
            (0.01, "1%"),
            (0.10, "10%"),
            (0.50, "50%"),
            (1.0, "100%"),
        ]
        for ratio, expected_stage in mapping:
            with patch("httpx.Client.get") as mock_get:
                mock_resp = MagicMock()
                mock_resp.json.return_value = {
                    "status": "success",
                    "data": {"result": [{"value": [0, str(ratio)]}]},
                }
                mock_resp.raise_for_status = MagicMock()
                mock_get.return_value = mock_resp
                src = PrometheusMetricsSource(url="http://prom:9090")
                assert src.get_stage() == expected_stage, f"ratio={ratio}"

    def test_close(self):
        from app.canary_metrics_source import PrometheusMetricsSource

        with patch("httpx.Client.get") as mock_get:
            mock_resp = MagicMock()
            mock_resp.json.return_value = {
                "status": "success",
                "data": {"result": [{"value": [0, "0"]}]},
            }
            mock_resp.raise_for_status = MagicMock()
            mock_get.return_value = mock_resp
            src = PrometheusMetricsSource(url="http://prom:9090")
            src.get_traffic_count()  # 触发 _client 创建
            assert src._client is not None
            src.close()
            assert src._client is None


# ---------------------------------------------------------------------------
# TestAutoDetectSource
# ---------------------------------------------------------------------------


class TestAutoDetectSource:
    """auto_detect_source 工厂."""

    def test_no_env_returns_inmemory(self, promoter, monkeypatch):
        from app.canary_metrics_source import InMemoryMetricsSource, auto_detect_source

        monkeypatch.delenv("PROMETHEUS_URL", raising=False)
        src = auto_detect_source(promoter=promoter)
        assert isinstance(src, InMemoryMetricsSource)

    def test_env_set_returns_prometheus(self, promoter, monkeypatch):
        from app.canary_metrics_source import PrometheusMetricsSource, auto_detect_source

        monkeypatch.setenv("PROMETHEUS_URL", "http://prom:9090")
        monkeypatch.setenv("PROMETHEUS_SERVICE", "my-svc")
        src = auto_detect_source(promoter=promoter)
        assert isinstance(src, PrometheusMetricsSource)
        assert src._url == "http://prom:9090"
        assert src._service == "my-svc"

    def test_empty_env_returns_inmemory(self, promoter, monkeypatch):
        from app.canary_metrics_source import InMemoryMetricsSource, auto_detect_source

        monkeypatch.setenv("PROMETHEUS_URL", "")
        src = auto_detect_source(promoter=promoter)
        assert isinstance(src, InMemoryMetricsSource)


# ---------------------------------------------------------------------------
# TestFeedPromoterFromSource
# ---------------------------------------------------------------------------


class TestFeedPromoterFromSource:
    """feed_promoter_from_source 喂数据逻辑."""

    def test_feed_success_only(self, promoter):
        from app.canary_metrics_source import feed_promoter_from_source

        # mock source 返回 100 流量, 0% 错误
        mock_src = MagicMock()
        mock_src.get_traffic_count.return_value = 100
        mock_src.get_error_rate.return_value = 0.0
        n = feed_promoter_from_source(promoter, mock_src)
        assert n == 100
        assert promoter.get_recent_traffic_count() == 100
        assert promoter.get_recent_error_rate() == 0.0

    def test_feed_with_errors(self, promoter):
        from app.canary_metrics_source import feed_promoter_from_source

        mock_src = MagicMock()
        mock_src.get_traffic_count.return_value = 100
        mock_src.get_error_rate.return_value = 0.20  # 20 错误
        n = feed_promoter_from_source(promoter, mock_src)
        assert n == 100
        # 80 success + 20 fail
        assert abs(promoter.get_recent_error_rate() - 0.2) < 0.001

    def test_feed_zero_traffic(self, promoter):
        from app.canary_metrics_source import feed_promoter_from_source

        mock_src = MagicMock()
        mock_src.get_traffic_count.return_value = 0
        mock_src.get_error_rate.return_value = 0.0
        n = feed_promoter_from_source(promoter, mock_src)
        assert n == 0
        assert promoter.get_recent_traffic_count() == 0

    def test_feed_with_inmemory(self, promoter):
        from app.canary_metrics_source import InMemoryMetricsSource, feed_promoter_from_source

        # 灌 50 个 outcomes 到 promoter, 然后用 InMemoryMetricsSource 喂回去
        for _ in range(50):
            promoter.record_outcome(success=True, version="v2")
        src = InMemoryMetricsSource(promoter=promoter)
        # 此时源已经有 50 个 outcomes, 但 feed_promoter_from_source 会再灌同样数量
        # 简化: 我们只验证它不抛错
        n = feed_promoter_from_source(promoter, src)
        # InMemory 源返回 50, 所以又灌 50, 总 100
        assert n == 50
        assert promoter.get_recent_traffic_count() == 100


# ---------------------------------------------------------------------------
# TestIntegrationWithPromoter
# ---------------------------------------------------------------------------


class TestIntegrationWithPromoter:
    """集成: 端到端, 喂数据后 promoter 能正常推进."""

    def test_feed_then_promote(self, promoter):
        from app.canary_metrics_source import feed_promoter_from_source

        # mock 高流量, 0 错误
        mock_src = MagicMock()
        mock_src.get_traffic_count.return_value = 200
        mock_src.get_error_rate.return_value = 0.0
        feed_promoter_from_source(promoter, mock_src)
        # 等稳定时长
        import time

        time.sleep(0.7)
        # 现在应该可以 promote 了
        result = promoter.check_and_promote()
        assert result["promoted"] is True
        assert result["from"] == "0%"
        assert result["to"] == "1%"

    def test_high_error_blocks_promote(self, promoter):
        from app.canary_metrics_source import feed_promoter_from_source

        # 50% 错误率
        mock_src = MagicMock()
        mock_src.get_traffic_count.return_value = 100
        mock_src.get_error_rate.return_value = 0.50
        feed_promoter_from_source(promoter, mock_src)
        import time

        time.sleep(0.7)
        result = promoter.check_and_promote()
        assert result["promoted"] is False
        assert "错误率过高" in result["reason"]

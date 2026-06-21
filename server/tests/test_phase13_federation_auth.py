"""Phase 13 建议 2 测试: Federation Endpoint 鉴权 + 限流 + IP 白名单."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))


def _has_fastapi() -> bool:
    try:
        import fastapi  # noqa: F401
        from fastapi.testclient import TestClient  # noqa: F401

        return True
    except ImportError:
        return False


@pytest.fixture(autouse=True)
def _clean_security():
    """每个测试前后清空 security 状态."""
    import federation_security

    federation_security.reset()
    yield
    federation_security.reset()


# ---------------------------------------------------------------------------
# configure / reset / load_from_env
# ---------------------------------------------------------------------------


class TestConfigure:
    def test_reset_clears_state(self):
        import federation_security

        federation_security.configure(bearer_tokens=["t1"], allow_ips=["10.0.0.1"])
        assert federation_security._bearer_tokens == {"t1"}
        federation_security.reset()
        assert federation_security._bearer_tokens == set()
        assert federation_security._allow_ips == []

    def test_configure_bearer_tokens(self):
        import federation_security

        federation_security.configure(bearer_tokens=["a", "b", " c "])
        assert federation_security._bearer_tokens == {"a", "b", "c"}

    def test_configure_bearer_tokens_empty_filter(self):
        import federation_security

        federation_security.configure(bearer_tokens=["", "  "])
        assert federation_security._bearer_tokens == set()

    def test_configure_invalid_rate_per_min(self):
        import federation_security

        with pytest.raises(ValueError):
            federation_security.configure(rate_per_min=0)
        with pytest.raises(ValueError):
            federation_security.configure(rate_per_min=-1)

    def test_configure_invalid_rate_burst(self):
        import federation_security

        with pytest.raises(ValueError):
            federation_security.configure(rate_burst=0)

    def test_configure_allow_ips_invalid(self):
        import federation_security

        with pytest.raises(ValueError):
            federation_security.configure(allow_ips=["not-an-ip"])

    def test_configure_allow_ips_cidr_and_single(self):
        import federation_security

        federation_security.configure(allow_ips=["10.0.0.0/24", "127.0.0.1"])
        assert len(federation_security._allow_ips) == 2

    def test_load_from_env(self, monkeypatch):
        import federation_security

        monkeypatch.setenv("ZHS_FEDERATION_BEARER_TOKEN", "s1,s2")
        monkeypatch.setenv("ZHS_FEDERATION_ALLOW_IPS", "10.0.0.0/8")
        monkeypatch.setenv("ZHS_FEDERATION_RATE_PER_MIN", "120")
        monkeypatch.setenv("ZHS_FEDERATION_RATE_BURST", "200")
        monkeypatch.setenv("ZHS_FEDERATION_RATE_DISABLE", "1")
        federation_security.load_from_env()
        assert federation_security._bearer_tokens == {"s1", "s2"}
        assert len(federation_security._allow_ips) == 1
        assert federation_security._rate_per_min == 120.0
        assert federation_security._rate_burst == 200
        assert federation_security._rate_disabled is True

    def test_load_from_env_empty(self, monkeypatch):
        import federation_security

        monkeypatch.delenv("ZHS_FEDERATION_BEARER_TOKEN", raising=False)
        monkeypatch.delenv("ZHS_FEDERATION_ALLOW_IPS", raising=False)
        monkeypatch.delenv("ZHS_FEDERATION_RATE_PER_MIN", raising=False)
        monkeypatch.delenv("ZHS_FEDERATION_RATE_BURST", raising=False)
        monkeypatch.delenv("ZHS_FEDERATION_RATE_DISABLE", raising=False)
        federation_security.load_from_env()
        assert federation_security._bearer_tokens == set()
        assert federation_security._allow_ips == []


# ---------------------------------------------------------------------------
# verify_bearer
# ---------------------------------------------------------------------------


class TestVerifyBearer:
    def test_no_tokens_configured_allows_all(self):
        import federation_security

        assert federation_security.verify_bearer(None) is True
        assert federation_security.verify_bearer("Bearer xxx") is True

    def test_missing_header_when_required(self):
        import federation_security

        federation_security.configure(bearer_tokens=["valid-token"])
        assert federation_security.verify_bearer(None) is False
        assert federation_security.verify_bearer("") is False

    def test_non_bearer_format(self):
        import federation_security

        federation_security.configure(bearer_tokens=["valid-token"])
        assert federation_security.verify_bearer("Basic dXNlcjpwYXNz") is False
        assert federation_security.verify_bearer("valid-token") is False

    def test_bearer_case_insensitive(self):
        import federation_security

        federation_security.configure(bearer_tokens=["valid-token"])
        assert federation_security.verify_bearer("bearer valid-token") is True
        assert federation_security.verify_bearer("BEARER valid-token") is True

    def test_bearer_with_extra_spaces(self):
        import federation_security

        federation_security.configure(bearer_tokens=["valid-token"])
        assert federation_security.verify_bearer("Bearer  valid-token") is True

    def test_valid_token(self):
        import federation_security

        federation_security.configure(bearer_tokens=["t1", "t2"])
        assert federation_security.verify_bearer("Bearer t1") is True
        assert federation_security.verify_bearer("Bearer t2") is True

    def test_invalid_token(self):
        import federation_security

        federation_security.configure(bearer_tokens=["t1"])
        assert federation_security.verify_bearer("Bearer wrong") is False


# ---------------------------------------------------------------------------
# check_ip_allowed
# ---------------------------------------------------------------------------


class TestCheckIpAllowed:
    def test_no_allowlist_allows_all(self):
        import federation_security

        assert federation_security.check_ip_allowed("1.2.3.4") is True
        assert federation_security.check_ip_allowed(None) is True

    def test_single_ip_match(self):
        import federation_security

        federation_security.configure(allow_ips=["192.168.1.1"])
        assert federation_security.check_ip_allowed("192.168.1.1") is True
        assert federation_security.check_ip_allowed("192.168.1.2") is False

    def test_cidr_match(self):
        import federation_security

        federation_security.configure(allow_ips=["10.0.0.0/8"])
        assert federation_security.check_ip_allowed("10.0.0.1") is True
        assert federation_security.check_ip_allowed("10.255.255.255") is True
        assert federation_security.check_ip_allowed("11.0.0.1") is False

    def test_multiple_cidrs(self):
        import federation_security

        federation_security.configure(allow_ips=["10.0.0.0/8", "192.168.0.0/16"])
        assert federation_security.check_ip_allowed("10.1.2.3") is True
        assert federation_security.check_ip_allowed("192.168.5.5") is True
        assert federation_security.check_ip_allowed("172.16.0.1") is False

    def test_invalid_ip(self):
        import federation_security

        federation_security.configure(allow_ips=["10.0.0.0/8"])
        assert federation_security.check_ip_allowed("not-an-ip") is False
        assert federation_security.check_ip_allowed(None) is False


# ---------------------------------------------------------------------------
# consume_token (令牌桶)
# ---------------------------------------------------------------------------


class TestConsumeToken:
    def test_no_allowlist_consume(self):
        import federation_security

        # 不配 rate 时, 默认 rate_per_min=60, burst=60
        for _ in range(60):
            assert federation_security.consume_token("1.1.1.1") is True
        # 61 次必失败
        assert federation_security.consume_token("1.1.1.1") is False

    def test_independent_buckets_per_ip(self):
        import federation_security

        # 1.1.1.1 用完
        for _ in range(60):
            assert federation_security.consume_token("1.1.1.1") is True
        assert federation_security.consume_token("1.1.1.1") is False
        # 2.2.2.2 独立
        assert federation_security.consume_token("2.2.2.2") is True

    def test_disabled_rate(self):
        import federation_security

        federation_security.configure(rate_per_min=1, rate_burst=1, rate_disabled=True)
        for _ in range(100):
            assert federation_security.consume_token("1.1.1.1") is True

    def test_refill_over_time(self):
        import federation_security

        # rate=60/min = 1/sec, burst=1
        federation_security.configure(rate_per_min=60, rate_burst=1)
        assert federation_security.consume_token("1.1.1.1") is True
        assert federation_security.consume_token("1.1.1.1") is False
        # 等 1.1 秒
        time.sleep(1.1)
        assert federation_security.consume_token("1.1.1.1") is True

    def test_get_bucket_state(self):
        import federation_security

        federation_security.configure(rate_per_min=60, rate_burst=5)
        federation_security.consume_token("1.1.1.1", n=2)
        state = federation_security.get_bucket_state("1.1.1.1")
        assert state["tokens"] <= 5.0
        assert "last_ts" in state

    def test_anonymous_ip(self):
        import federation_security

        federation_security.configure(rate_per_min=60, rate_burst=2)
        assert federation_security.consume_token("") is True
        assert federation_security.consume_token("") is True
        assert federation_security.consume_token("") is False


# ---------------------------------------------------------------------------
# enforce (一站式)
# ---------------------------------------------------------------------------


class TestEnforce:
    def test_all_pass_when_unconfigured(self):
        import federation_security

        federation_security.enforce(None, "1.2.3.4")  # 不应抛

    def test_bearer_rejected(self):
        import federation_security

        federation_security.configure(bearer_tokens=["valid"])
        with pytest.raises(federation_security.SecurityError) as e:
            federation_security.enforce(None, "1.2.3.4")
        assert e.value.status_code == 401

    def test_ip_rejected(self):
        import federation_security

        federation_security.configure(allow_ips=["10.0.0.0/8"])
        with pytest.raises(federation_security.SecurityError) as e:
            federation_security.enforce(None, "8.8.8.8")
        assert e.value.status_code == 403

    def test_rate_limited(self):
        import federation_security

        federation_security.configure(rate_per_min=60, rate_burst=1)
        federation_security.enforce(None, "1.2.3.4")  # 1st OK
        with pytest.raises(federation_security.SecurityError) as e:
            federation_security.enforce(None, "1.2.3.4")
        assert e.value.status_code == 429

    def test_bearer_checked_first(self):
        import federation_security

        federation_security.configure(bearer_tokens=["valid"], allow_ips=["10.0.0.0/8"])
        # 鉴权先失败, IP 检查不会触发
        with pytest.raises(federation_security.SecurityError) as e:
            federation_security.enforce(None, "8.8.8.8")
        assert e.value.status_code == 401

    def test_all_pass(self):
        import federation_security

        federation_security.configure(
            bearer_tokens=["valid"],
            allow_ips=["10.0.0.0/8"],
            rate_per_min=60,
            rate_burst=10,
        )
        federation_security.enforce("Bearer valid", "10.0.0.1")  # 不应抛


# ---------------------------------------------------------------------------
# /federate 端点集成
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not _has_fastapi(), reason="fastapi.testclient 不可用")
class TestFederateEndpointSecurity:
    def _reload_endpoint(self):
        """重载 endpoint 模块, 干净状态."""
        for m in ("federation_endpoint", "federation_metrics"):
            if m in sys.modules:
                del sys.modules[m]
        import federation_endpoint
        import federation_metrics

        federation_metrics._gauge_route.clear()
        federation_metrics._gauge_source_up.clear()
        federation_metrics._gauge_scrape_interval.clear()
        federation_metrics._counter_match._metrics.clear()
        federation_metrics.init_route_gauges()
        return federation_endpoint, federation_metrics

    def test_no_config_allows_all(self):
        ep, fm = self._reload_endpoint()
        from fastapi.testclient import TestClient

        client = TestClient(ep.app)
        r = client.get("/federate", params={"match[]": '{__name__="zhs_federation_route_tenant_to_region"}'})
        assert r.status_code == 200

    def test_401_when_bearer_required(self):
        ep, fm = self._reload_endpoint()
        import federation_security
        from fastapi.testclient import TestClient

        federation_security.configure(bearer_tokens=["valid-secret"])
        client = TestClient(ep.app)
        r = client.get("/federate", params={"match[]": '{__name__="zhs_federation_route_tenant_to_region"}'})
        assert r.status_code == 401
        assert "bearer" in r.json()["detail"].lower()

    def test_401_with_wrong_bearer(self):
        ep, fm = self._reload_endpoint()
        import federation_security
        from fastapi.testclient import TestClient

        federation_security.configure(bearer_tokens=["valid-secret"])
        client = TestClient(ep.app)
        r = client.get(
            "/federate",
            params={"match[]": '{__name__="zhs_federation_route_tenant_to_region"}'},
            headers={"Authorization": "Bearer wrong-secret"},
        )
        assert r.status_code == 401

    def test_200_with_correct_bearer(self):
        ep, fm = self._reload_endpoint()
        import federation_security
        from fastapi.testclient import TestClient

        federation_security.configure(bearer_tokens=["valid-secret"])
        client = TestClient(ep.app)
        r = client.get(
            "/federate",
            params={"match[]": '{__name__="zhs_federation_route_tenant_to_region"}'},
            headers={"Authorization": "Bearer valid-secret"},
        )
        assert r.status_code == 200
        assert "zhs_federation_route_tenant_to_region" in r.text

    def test_429_when_rate_limited(self):
        ep, fm = self._reload_endpoint()
        import federation_security
        from fastapi.testclient import TestClient

        federation_security.configure(rate_per_min=60, rate_burst=2)
        client = TestClient(ep.app)
        # 用 testclient 时, client IP 默认是 testclient, 所有请求共享同一 IP
        params = {"match[]": '{__name__="zhs_federation_route_tenant_to_region"}'}
        r1 = client.get("/federate", params=params)
        r2 = client.get("/federate", params=params)
        r3 = client.get("/federate", params=params)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r3.status_code == 429
        assert "过于频繁" in r3.json()["detail"]

    def test_healthz_shows_security_state(self):
        ep, fm = self._reload_endpoint()
        import federation_security
        from fastapi.testclient import TestClient

        # 未配置
        client = TestClient(ep.app)
        r = client.get("/healthz")
        assert r.status_code == 200
        assert r.json()["auth_enabled"] is False
        assert r.json()["ip_allowlist_enabled"] is False

        # 配置后
        federation_security.configure(bearer_tokens=["t"], allow_ips=["10.0.0.0/8"])
        r = client.get("/healthz")
        assert r.json()["auth_enabled"] is True
        assert r.json()["ip_allowlist_enabled"] is True

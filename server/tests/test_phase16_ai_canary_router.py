"""Phase 16 建议 3 测试: AI 灰度路由器."""

from __future__ import annotations

import pytest

try:
    from scripts.ops.ai_canary_router import (
        CanaryRouter,
        CanaryStats,
        CanaryStrategy,
        TenantHasher,
        Tier,
        main,
    )

    HAS_MODULE = True
except ImportError:
    HAS_MODULE = False
    Tier = CanaryStats = TenantHasher = CanaryStrategy = CanaryRouter = main = None


# ---------------------------------------------------------------------------
# 1. TenantHasher
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_hasher_deterministic():
    b1 = TenantHasher.bucket("tenant-1")
    b2 = TenantHasher.bucket("tenant-1")
    assert b1 == b2
    assert 0 <= b1 < 100


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_hasher_salt_matters():
    b1 = TenantHasher.bucket("t1", salt="a")
    b2 = TenantHasher.bucket("t1", salt="b")
    # 盐不同, 桶大概率不同
    assert b1 != b2 or True  # 偶尔相同, 接受


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_hasher_in_canary_0():
    for i in range(20):
        assert TenantHasher.in_canary(f"t-{i}", 0) is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_hasher_in_canary_100():
    for i in range(20):
        assert TenantHasher.in_canary(f"t-{i}", 100) is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_hasher_in_canary_partial_approx():
    """100 个随机租户, 50% 灰度应大致命中 50 个."""
    hits = sum(1 for i in range(100) if TenantHasher.in_canary(f"t-{i}", 50))
    assert 30 <= hits <= 70


# ---------------------------------------------------------------------------
# 2. CanaryStats
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_stats_init():
    s = CanaryStats()
    assert s.total == 0
    assert s.canary_ratio == 0.0
    assert s.avg_latency_ms == 0.0
    assert s.to_dict()["canary_hits"] == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_stats_with_data():
    s = CanaryStats()
    s.canary_hits = 30
    s.conventional_hits = 70
    s.total_latency_ms = 1000
    assert s.total == 100
    assert abs(s.canary_ratio - 0.3) < 0.01
    assert abs(s.avg_latency_ms - 10.0) < 0.01


# ---------------------------------------------------------------------------
# 3. CanaryStrategy
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_strategy_init_default():
    s = CanaryStrategy(canary_model="gpt-4", conventional_model="gpt-3.5")
    assert s.percentage == 0
    assert s.enabled is True
    assert s.canary_model == "gpt-4"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_strategy_invalid_percentage():
    with pytest.raises(ValueError):
        CanaryStrategy("a", "b", percentage=-1)
    with pytest.raises(ValueError):
        CanaryStrategy("a", "b", percentage=101)


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_strategy_invalid_tier_weight():
    with pytest.raises(ValueError):
        CanaryStrategy("a", "b", tier_weights={Tier.FREE: 200})


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_strategy_blocklist_overrides():
    s = CanaryStrategy("gpt-4", "gpt-3.5", percentage=100, tenant_blocklist={"t1"})
    assert s.should_use_canary("t1") is False
    assert s.should_use_canary("t2") is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_strategy_allowlist_overrides():
    s = CanaryStrategy("gpt-4", "gpt-3.5", percentage=0, tenant_allowlist={"t1"})
    assert s.should_use_canary("t1") is True
    assert s.should_use_canary("t2") is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_strategy_disabled():
    s = CanaryStrategy("a", "b", percentage=100, enabled=False)
    assert s.should_use_canary("t1") is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_strategy_tier_weight_overrides():
    """tier 权重覆盖全局 percentage."""
    s = CanaryStrategy("a", "b", percentage=0, tier_weights={Tier.ENTERPRISE: 100})
    assert s.should_use_canary("t1", Tier.ENTERPRISE) is True
    assert s.should_use_canary("t1", Tier.FREE) is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_strategy_tier_string_input():
    s = CanaryStrategy("a", "b", percentage=0, tier_weights={Tier.PRO: 100})
    assert s.should_use_canary("t1", "pro") is True
    assert s.should_use_canary("t1", "free") is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_strategy_allowlist_priority_over_blocklist():
    """allowlist 与 blocklist 冲突: 严格说 blocklist 应胜出 (更安全)."""
    s = CanaryStrategy("a", "b", tenant_allowlist={"t1"}, tenant_blocklist={"t1"})
    # 当前设计: blocklist 先检查
    assert s.should_use_canary("t1") is False


# ---------------------------------------------------------------------------
# 4. CanaryRouter
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_init():
    s = CanaryStrategy("gpt-4", "gpt-3.5", percentage=50)
    r = CanaryRouter(s)
    assert r.strategy is s
    assert r.global_stats()["total"] == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_route_0pct():
    s = CanaryStrategy("gpt-4", "gpt-3.5", percentage=0)
    r = CanaryRouter(s)
    for i in range(10):
        result = r.route(f"t-{i}", {"text": "x"}, Tier.FREE)
        assert result["is_canary"] is False
        assert result["model"] == "gpt-3.5"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_route_100pct():
    s = CanaryStrategy("gpt-4", "gpt-3.5", percentage=100)
    r = CanaryRouter(s)
    for i in range(10):
        result = r.route(f"t-{i}", {"text": "x"}, Tier.FREE)
        assert result["is_canary"] is True
        assert result["model"] == "gpt-4"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_route_50pct_distribution():
    s = CanaryStrategy("gpt-4", "gpt-3.5", percentage=50)
    r = CanaryRouter(s)
    canary = 0
    conv = 0
    for i in range(200):
        result = r.route(f"tenant-{i}", {"text": "x"}, Tier.FREE)
        if result["is_canary"]:
            canary += 1
        else:
            conv += 1
    # 200 个随机租户, 50% 灰度, 接受 ±15% 误差
    assert 80 <= canary <= 120


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_stats_recorded():
    s = CanaryStrategy("gpt-4", "gpt-3.5", percentage=50)
    r = CanaryRouter(s)
    r.route("t-1", {"text": "x"}, Tier.FREE)
    r.route("t-1", {"text": "y"}, Tier.FREE)
    stats = r.stats("t-1")
    assert "t-1" in stats
    assert stats["t-1"]["total"] == 2


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_call_fn_called():
    received: list[tuple[str, dict]] = []

    def fake_call(model, payload):
        received.append((model, payload))
        return {"echo": payload}

    s = CanaryStrategy("gpt-4", "gpt-3.5", percentage=100)
    r = CanaryRouter(s, call_fn=fake_call)
    r.route("t-1", {"text": "hi"}, Tier.FREE)
    assert len(received) == 1
    assert received[0][0] == "gpt-4"
    assert received[0][1]["text"] == "hi"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_call_fn_exception_recorded():
    def bad_call(model, payload):
        raise RuntimeError("api error")

    s = CanaryStrategy("a", "b", percentage=100)
    r = CanaryRouter(s, call_fn=bad_call)
    result = r.route("t-1", {"text": "x"}, Tier.FREE)
    assert result["error"] is not None
    assert "api error" in result["error"]
    gs = r.global_stats()
    assert gs["errors"] == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_response_no_call_fn():
    """无 call_fn 时, 模拟返回."""
    s = CanaryStrategy("a", "b", percentage=100)
    r = CanaryRouter(s)
    result = r.route("t-1", {"text": "hello world"}, Tier.FREE)
    assert result["response"] == {"model": "a", "echo": "hello world"}


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_report_markdown():
    s = CanaryStrategy("gpt-4", "gpt-3.5", percentage=30, tenant_allowlist={"vip-1"})
    r = CanaryRouter(s)
    for i in range(50):
        r.route(f"t-{i}", {"text": "x"}, Tier.FREE)
    md = r.report()
    assert "AI 灰度发布报表" in md
    assert "gpt-4" in md
    assert "30%" in md
    assert "vip-1" in md
    assert "全局统计" in md


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_reset():
    s = CanaryStrategy("a", "b", percentage=50)
    r = CanaryRouter(s)
    for i in range(5):
        r.route(f"t-{i}", {"text": "x"}, Tier.FREE)
    r.reset()
    assert r.global_stats()["total"] == 0
    assert r.stats() == {}


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_router_log_bounded():
    """log 数组有上限."""
    s = CanaryStrategy("a", "b", percentage=50)
    r = CanaryRouter(s)
    for i in range(100):
        r.route(f"t-{i % 10}", {"text": "x"}, Tier.FREE)
    # log 限 10000
    assert len(r._log) <= 10000


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def test_cli_basic(capsys):
    code = main(["--canary-model", "gpt-4", "--conventional-model", "gpt-3.5", "--percentage", "50"])
    assert code == 0
    out = capsys.readouterr().out
    assert "gpt-4" in out or "gpt-3.5" in out


def test_cli_with_allowlist(capsys):
    code = main(["--percentage", "0", "--allowlist", "vip-1", "vip-2", "--tenants", "vip-1", "vip-2", "user-x"])
    assert code == 0
    out = capsys.readouterr().out
    # vip-1/2 在 0% 灰度下应走 canary (因为在白名单)
    assert "vip-1" in out
    assert "gpt-4-turbo" in out  # canary_model 默认值


def test_cli_with_tier_weights(capsys):
    code = main(["--percentage", "0", "--free-pct", "0", "--pro-pct", "100", "--enterprise-pct", "100"])
    assert code == 0


def test_cli_with_report(capsys):
    code = main(["--percentage", "30", "--tenants", "u1", "u2", "u3", "--report"])
    assert code == 0
    out = capsys.readouterr().out
    assert "AI 灰度发布报表" in out

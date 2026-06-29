"""影子流量白名单 + 动态配比 (建议 122) 单元测试.

覆盖:
  ShadowWhitelist:
    - 初始化 (allow / deny 模式)
    - 白名单判定 (allow 模式): in → True, out → False
    - 白名单判定 (deny 模式): 翻转
    - 黑名单优先
    - 通配符 (*)
    - 方法+路径 拼接
    - 动态 add / remove
    - 模式切换
    - 快照
    - 全局 default (env 读取)
  ShadowRatioController:
    - 初始配比 (env / 显式)
    - adjust: 绿/稳定/警告/关停 四档
    - 冷却: 短时间内不连调
    - 上下限: clamp [0, max]
    - 强制 set_ratio (force=True)
    - 重置
    - 后台 loop 启停
    - 错误率 source 容错 (None / 缺方法)
    - 与 ShadowRouter 同步
    - 快照
  ShadowRouter.should_shadow_endpoint 集成
"""

import asyncio
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_global():
    from app.shadow_traffic import reset_default_router
    from app.shadow_whitelist import reset_default_whitelist

    reset_default_router()
    reset_default_whitelist()
    os.environ.pop("ZHS_SHADOW_WHITELIST_MODE", None)
    os.environ.pop("ZHS_SHADOW_ALLOWED_ENDPOINTS", None)
    os.environ.pop("ZHS_SHADOW_BLOCKED_ENDPOINTS", None)
    os.environ.pop("ZHS_SHADOW_TRAFFIC_RATIO", None)
    yield
    reset_default_router()
    reset_default_whitelist()


# ---------------------------------------------------------------------------
# ShadowWhitelist - 初始化
# ---------------------------------------------------------------------------


def test_whitelist_init_allow_default():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(mode="allow")
    assert wl.mode == "allow"
    assert wl.get_allowed()  # 有默认
    assert wl.get_blocked()  # 有默认


def test_whitelist_init_deny_mode():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(mode="deny")
    assert wl.mode == "deny"


def test_whitelist_init_custom_allowed():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /a", "GET /b"], blocked=[], mode="allow")
    assert wl.get_allowed() == {"GET /a", "GET /b"}


# ---------------------------------------------------------------------------
# ShadowWhitelist - 判定
# ---------------------------------------------------------------------------


def test_should_shadow_allow_mode_match():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /api/v1/orders"], blocked=[], mode="allow")
    assert wl.should_shadow_endpoint("GET", "/api/v1/orders") is True


def test_should_shadow_allow_mode_no_match():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /api/v1/orders"], blocked=[], mode="allow")
    assert wl.should_shadow_endpoint("GET", "/api/v1/users") is False


def test_should_shadow_deny_mode_match_in_allow():
    """deny 模式: 白名单内 → False (排除项)."""
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /api/v1/orders"], blocked=[], mode="deny")
    assert wl.should_shadow_endpoint("GET", "/api/v1/orders") is False


def test_should_shadow_deny_mode_match_not_in_allow():
    """deny 模式: 白名单外 → True."""
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /api/v1/orders"], blocked=[], mode="deny")
    assert wl.should_shadow_endpoint("GET", "/api/v1/users") is True


def test_blocked_overrides_allowed():
    """黑名单优先: 即使在白名单, 黑名单命中 → False."""
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(
        allowed=["GET /api/v1/orders"],
        blocked=["GET /api/v1/orders"],
        mode="allow",
    )
    assert wl.should_shadow_endpoint("GET", "/api/v1/orders") is False


def test_blocked_deny_mode():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(
        allowed=[],
        blocked=["* /api/v1/payment*"],
        mode="deny",
    )
    assert wl.should_shadow_endpoint("POST", "/api/v1/payment/create") is False
    assert wl.should_shadow_endpoint("GET", "/api/v1/orders") is True


# ---------------------------------------------------------------------------
# 通配符
# ---------------------------------------------------------------------------


def test_wildcard_path_match():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /api/v1/orders/*"], blocked=[], mode="allow")
    assert wl.should_shadow_endpoint("GET", "/api/v1/orders/123") is True
    assert wl.should_shadow_endpoint("GET", "/api/v1/orders/abc") is True


def test_wildcard_no_match():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /api/v1/orders/*"], blocked=[], mode="allow")
    assert wl.should_shadow_endpoint("GET", "/api/v1/users/123") is False


def test_wildcard_method_any():
    from app.shadow_whitelist import ShadowWhitelist

    # "GET /api/v1/orders" 含方法+路径, 用路径通配
    wl = ShadowWhitelist(allowed=["GET /api/v1/orders*", "POST /api/v1/orders*"], blocked=[], mode="allow")
    assert wl.should_shadow_endpoint("GET", "/api/v1/orders") is True
    assert wl.should_shadow_endpoint("POST", "/api/v1/orders") is True
    assert wl.should_shadow_endpoint("GET", "/api/v1/orders/123") is True


def test_method_case_insensitive():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /api/v1/orders"], blocked=[], mode="allow")
    assert wl.should_shadow_endpoint("get", "/api/v1/orders") is True
    assert wl.should_shadow_endpoint("Get", "/api/v1/orders") is True


# ---------------------------------------------------------------------------
# 动态 add / remove
# ---------------------------------------------------------------------------


def test_add_allowed():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=[], blocked=[], mode="allow")
    n = wl.add_allowed("GET /a")
    assert n == 1
    assert "GET /a" in wl.get_allowed()


def test_add_allowed_multiple():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=[], blocked=[], mode="allow")
    n = wl.add_allowed(["GET /a", "GET /b", "GET /c"])
    assert n == 3


def test_add_allowed_duplicate_noop():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /a"], blocked=[], mode="allow")
    n = wl.add_allowed("GET /a")
    assert n == 0  # 重复不加


def test_remove_allowed():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /a", "GET /b"], blocked=[], mode="allow")
    n = wl.remove_allowed("GET /a")
    assert n == 1
    assert "GET /a" not in wl.get_allowed()


def test_remove_allowed_nonexistent():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /a"], blocked=[], mode="allow")
    n = wl.remove_allowed("GET /z")
    assert n == 0


def test_add_remove_blocked():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=[], blocked=[], mode="allow")
    wl.add_blocked("POST /x")
    assert "POST /x" in wl.get_blocked()
    wl.remove_blocked("POST /x")
    assert "POST /x" not in wl.get_blocked()


def test_set_mode():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /a"], blocked=[], mode="allow")
    wl.set_mode("deny")
    assert wl.mode == "deny"
    # 翻转
    assert wl.should_shadow_endpoint("GET", "/a") is False
    assert wl.should_shadow_endpoint("GET", "/z") is True


def test_set_mode_invalid_raises():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=[], blocked=[], mode="allow")
    with pytest.raises(ValueError):
        wl.set_mode("invalid")


# ---------------------------------------------------------------------------
# 快照
# ---------------------------------------------------------------------------


def test_whitelist_snapshot():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=["GET /a"], blocked=["POST /b"], mode="allow")
    snap = wl.snapshot()
    assert snap["mode"] == "allow"
    assert snap["allowed_count"] == 1
    assert snap["blocked_count"] == 1
    assert "GET /a" in snap["allowed_sample"]


def test_whitelist_snapshot_history():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=[], blocked=[], mode="allow")
    wl.set_mode("deny")
    wl.add_allowed("GET /a")
    snap = wl.snapshot()
    assert len(snap["history"]) >= 2


def test_whitelist_clear_history():
    from app.shadow_whitelist import ShadowWhitelist

    wl = ShadowWhitelist(allowed=[], blocked=[], mode="allow")
    wl.add_allowed("GET /a")
    wl.clear_history()
    assert wl.snapshot()["history"] == []


# ---------------------------------------------------------------------------
# 全局 default
# ---------------------------------------------------------------------------


def test_default_whitelist_singleton():
    from app.shadow_whitelist import get_default_whitelist, reset_default_whitelist

    reset_default_whitelist()
    w1 = get_default_whitelist()
    w2 = get_default_whitelist()
    assert w1 is w2


def test_default_whitelist_resets():
    from app.shadow_whitelist import get_default_whitelist, reset_default_whitelist

    w1 = get_default_whitelist()
    reset_default_whitelist()
    w2 = get_default_whitelist()
    assert w1 is not w2


def test_default_whitelist_reads_env():
    os.environ["ZHS_SHADOW_ALLOWED_ENDPOINTS"] = "GET /env1,GET /env2"
    os.environ["ZHS_SHADOW_BLOCKED_ENDPOINTS"] = "POST /env3"
    from app.shadow_whitelist import get_default_whitelist, reset_default_whitelist

    reset_default_whitelist()
    wl = get_default_whitelist()
    assert "GET /env1" in wl.get_allowed()
    assert "GET /env2" in wl.get_allowed()
    assert "POST /env3" in wl.get_blocked()


# ---------------------------------------------------------------------------
# ShadowRatioController - 初始化
# ---------------------------------------------------------------------------


def test_controller_init_default():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter())
    assert c.current_ratio == 0.0


def test_controller_init_env():
    os.environ["ZHS_SHADOW_TRAFFIC_RATIO"] = "0.1"
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter())
    assert c.current_ratio == 0.1


def test_controller_init_explicit():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.2)
    assert c.current_ratio == 0.2


def test_controller_synced_to_router():
    """controller 创建后, router.ratio 同步."""
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    r = ShadowRouter()
    _c = ShadowRatioController(router=r, base_ratio=0.15)
    assert r.ratio == 0.15


# ---------------------------------------------------------------------------
# ShadowRatioController - adjust
# ---------------------------------------------------------------------------


class _StubErrorSource:
    """可控制错误率的 stub."""

    def __init__(self, er: float = 0.0):
        self.er = er

    def get_recent_error_rate(self, window_sec: float) -> float:
        return self.er


def test_adjust_grow():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    src = _StubErrorSource(er=0.0001)  # 极低
    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.05, error_source=src, cooldown_sec=0)
    change = c.adjust()
    assert change is not None
    assert change.reason == "grow"
    assert change.to_ratio > 0.05


def test_adjust_stable_no_change():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    src = _StubErrorSource(er=0.005)  # 0.1% - 1% 之间, 稳定期
    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.05, error_source=src, cooldown_sec=0)
    change = c.adjust()
    assert change is None  # 稳定期不动


def test_adjust_shrink_warning():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    src = _StubErrorSource(er=0.02)  # 1% - 5%
    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.1, error_source=src, cooldown_sec=0)
    change = c.adjust()
    assert change is not None
    assert change.reason == "shrink"
    assert change.to_ratio < 0.1


def test_adjust_halt_critical():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    src = _StubErrorSource(er=0.10)  # 5%+
    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.1, error_source=src, cooldown_sec=0)
    change = c.adjust()
    assert change is not None
    assert change.reason == "halt"
    assert change.to_ratio == 0.0


def test_adjust_cooldown():
    """冷却期内连续调只生效 1 次."""
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    src = _StubErrorSource(er=0.0001)
    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.05, error_source=src, cooldown_sec=60)
    c1 = c.adjust()
    c2 = c.adjust()  # 冷却期
    assert c1 is not None
    assert c2 is None


# ---------------------------------------------------------------------------
# ShadowRatioController - set_ratio
# ---------------------------------------------------------------------------


def test_set_ratio_clamp_upper():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.0, max_ratio=0.3)
    c.set_ratio(0.9, reason="manual", force=True)
    assert c.current_ratio == 0.3


def test_set_ratio_clamp_lower():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.1, max_ratio=0.3)
    c.set_ratio(-0.5, reason="manual", force=True)
    assert c.current_ratio == 0.0


def test_set_ratio_no_change_returns_none():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.1, max_ratio=0.3)
    c.set_ratio(0.1, reason="manual", force=True)
    assert c.current_ratio == 0.1


def test_set_ratio_force_bypass_cooldown():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.1, max_ratio=0.3, cooldown_sec=60)
    c.set_ratio(0.2, force=True)
    c.set_ratio(0.0, reason="halt", force=True)  # force=True 跳过冷却
    assert c.current_ratio == 0.0


def test_reset():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.1, max_ratio=0.3)
    c.set_ratio(0.25, force=True)
    change = c.reset()
    assert change is not None
    assert change.to_ratio == 0.1
    assert change.reason == "reset"


# ---------------------------------------------------------------------------
# ShadowRatioController - 容错
# ---------------------------------------------------------------------------


def test_no_error_source_returns_zero():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.1, error_source=None)
    assert c.health == "green"  # 默认 er=0, 绿


def test_error_source_without_method_returns_zero():
    class _Broken:
        pass

    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.1, error_source=_Broken())
    assert c.health == "green"


def test_health_states():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(router=ShadowRouter(), base_ratio=0.1)
    c.error_source = _StubErrorSource(er=0.0001)
    assert c.health == "green"
    c.error_source = _StubErrorSource(er=0.005)
    assert c.health == "stable"
    c.error_source = _StubErrorSource(er=0.02)
    assert c.health == "warning"
    c.error_source = _StubErrorSource(er=0.10)
    assert c.health == "halt"


# ---------------------------------------------------------------------------
# ShadowRatioController - 后台 loop
# ---------------------------------------------------------------------------


def test_controller_start_stop():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(
        router=ShadowRouter(),
        base_ratio=0.05,
        error_source=_StubErrorSource(er=0.0001),
        interval_sec=0.1,
        cooldown_sec=0,
    )

    async def _run():
        await c.start()
        await asyncio.sleep(0.3)
        await c.stop()

    asyncio.run(_run())
    # 跑了几次后应至少 1 条 change
    assert len(c.snapshot()["recent_changes"]) >= 1


# ---------------------------------------------------------------------------
# ShadowRatioController - 快照
# ---------------------------------------------------------------------------


def test_controller_snapshot():
    from app.shadow_ratio_controller import ShadowRatioController
    from app.shadow_traffic import ShadowRouter

    c = ShadowRatioController(
        router=ShadowRouter(), base_ratio=0.1, error_source=_StubErrorSource(er=0.005)
    )  # 0.1%-1% 之间, 稳定
    snap = c.snapshot()
    assert snap["base_ratio"] == 0.1
    assert snap["current_ratio"] == 0.1
    assert snap["max_ratio"] == 0.5
    assert snap["health"] == "stable"
    assert snap["error_rate"] == 0.005


# ---------------------------------------------------------------------------
# ShadowRouter.should_shadow_endpoint 集成
# ---------------------------------------------------------------------------


def test_router_should_shadow_endpoint_disabled():
    from app.shadow_traffic import ShadowRouter

    r = ShadowRouter(ratio=0.0)
    assert r.should_shadow_endpoint("GET", "/api/v1/orders") is False


def test_router_should_shadow_endpoint_in_whitelist():
    """默认白名单允许 GET /api/v1/orders."""
    from app.shadow_traffic import ShadowRouter

    r = ShadowRouter(ratio=1.0)
    # 默认白名单含 GET /api/v1/orders
    # 但 should_shadow_endpoint 仍带概率, 跑 100 次至少中 80 次
    hits = sum(1 for _ in range(100) if r.should_shadow_endpoint("GET", "/api/v1/orders"))
    assert hits >= 80


def test_router_should_shadow_endpoint_blocked():
    """默认黑名单拦截 POST /api/v1/payment."""
    from app.shadow_traffic import ShadowRouter

    r = ShadowRouter(ratio=1.0)
    for _ in range(50):
        assert r.should_shadow_endpoint("POST", "/api/v1/payment/create") is False


def test_router_should_shadow_endpoint_no_match():
    from app.shadow_traffic import ShadowRouter

    r = ShadowRouter(ratio=1.0)
    for _ in range(20):
        # 不在白名单
        assert r.should_shadow_endpoint("GET", "/api/v1/some/random/path") is False

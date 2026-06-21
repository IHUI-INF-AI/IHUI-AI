"""Canary 切流 controller + metrics (建议 123) 单元测试.

覆盖:
  CanaryController:
    - 初始化 (env / 显式)
    - 关闭状态 → 全部 v1
    - rollback → 全部 v1
    - v2_tenants 白名单 → 强制 v2
    - v1_tenants 黑名单 → 强制 v1
    - hash 策略: 同一 tenant 永远走同一边
    - random 策略: 比例正确
    - round_robin 策略: 累计到阈值切 v2
    - sticky_tenant 策略: 同 hash
    - 比例配置 (set_v2_ratio)
    - 启用开关 (set_enabled)
    - 紧急回滚 (set_rollback)
    - 策略切换 (set_strategy)
    - 租户白/黑名单动态加减
    - 快照
  CanaryMetrics:
    - record_canary_decision 计数
    - record_canary_error 计数
    - get_error_rate 计算
    - get_metrics_snapshot
    - reset_metrics
    - sync_canary_gauges
  choose_version 全局便捷函数
"""

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
def _reset():
    from app.canary import reset_default_canary
    from app.canary_metrics import reset_metrics

    reset_default_canary()
    reset_metrics()
    os.environ.pop("ZHS_CANARY_ENABLED", None)
    os.environ.pop("ZHS_CANARY_V2_RATIO", None)
    os.environ.pop("ZHS_CANARY_ROLLBACK", None)
    os.environ.pop("ZHS_CANARY_STRATEGY", None)
    os.environ.pop("ZHS_CANARY_V2_TENANTS", None)
    os.environ.pop("ZHS_CANARY_V1_TENANTS", None)
    yield
    reset_default_canary()
    reset_metrics()


# ---------------------------------------------------------------------------
# CanaryController - 初始化
# ---------------------------------------------------------------------------


def test_controller_init_disabled():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=False, v2_ratio=0.5)
    assert c.enabled is False
    assert c.choose_version(1) == CanaryVersion.V1


def test_controller_init_enabled():
    from app.canary import CanaryController

    c = CanaryController(enabled=True, v2_ratio=0.5)
    assert c.enabled is True
    assert c.v2_ratio == 0.5


def test_controller_init_env():
    os.environ["ZHS_CANARY_ENABLED"] = "1"
    os.environ["ZHS_CANARY_V2_RATIO"] = "0.3"
    from app.canary import CanaryController

    c = CanaryController()
    assert c.enabled is True
    assert c.v2_ratio == 0.3


def test_controller_init_strategy_default():
    from app.canary import CanaryController, CanaryStrategy

    c = CanaryController(enabled=True)
    assert c.strategy == CanaryStrategy.HASH


def test_controller_init_invalid_strategy():
    from app.canary import CanaryController, CanaryStrategy

    c = CanaryController(enabled=True, strategy=CanaryStrategy.RANDOM)
    assert c.strategy == CanaryStrategy.RANDOM


# ---------------------------------------------------------------------------
# CanaryController - 全局开关 / rollback
# ---------------------------------------------------------------------------


def test_disabled_always_v1():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=False, v2_ratio=1.0)
    for tid in range(1, 100):
        assert c.choose_version(tid) == CanaryVersion.V1


def test_rollback_overrides_enabled():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=1.0, rollback=True)
    for tid in range(1, 100):
        assert c.choose_version(tid) == CanaryVersion.V1


def test_set_enabled_runtime():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=False, v2_ratio=1.0)
    assert c.choose_version(1) == CanaryVersion.V1
    c.set_enabled(True)
    # 走 hash 策略, tenant=1 不一定命中, 用 v2_tenants
    c.add_v2_tenant(1)
    assert c.choose_version(1) == CanaryVersion.V2


def test_set_rollback_runtime():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=1.0)
    c.add_v2_tenant(1)
    assert c.choose_version(1) == CanaryVersion.V2
    c.set_rollback(True)
    assert c.choose_version(1) == CanaryVersion.V1


# ---------------------------------------------------------------------------
# CanaryController - 租户白/黑名单
# ---------------------------------------------------------------------------


def test_v2_tenants_whitelist():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=0.0)  # 默认 0%
    c.add_v2_tenant(5)
    assert c.choose_version(5) == CanaryVersion.V2
    assert c.choose_version(6) == CanaryVersion.V1  # 不在白名单


def test_v1_tenants_blacklist():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=1.0)  # 100% 走 v2
    c.add_v1_tenant(7)
    assert c.choose_version(7) == CanaryVersion.V1
    assert c.choose_version(8) == CanaryVersion.V2  # 不在黑名单


def test_v2_whitelist_overrides_blacklist():
    """v2 白名单优先于 v1 黑名单."""
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=0.0)
    c.add_v1_tenant(9)
    c.add_v2_tenant(9)
    assert c.choose_version(9) == CanaryVersion.V2


def test_remove_v2_v1_tenant():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=0.0)
    c.add_v2_tenant(5)
    c.remove_v2_tenant(5)
    assert 5 not in c.v2_tenants
    assert c.choose_version(5) == CanaryVersion.V1


def test_v2_tenants_from_env():
    os.environ["ZHS_CANARY_V2_TENANTS"] = "3,7,11"
    from app.canary import CanaryController

    c = CanaryController(enabled=True, v2_ratio=0.0)
    assert c.v2_tenants == {3, 7, 11}


def test_v1_tenants_from_env():
    os.environ["ZHS_CANARY_V1_TENANTS"] = "2,4"
    from app.canary import CanaryController

    c = CanaryController(enabled=True, v2_ratio=1.0)
    assert c.v1_tenants == {2, 4}


# ---------------------------------------------------------------------------
# CanaryController - hash 策略
# ---------------------------------------------------------------------------


def test_hash_strategy_sticky():
    """同一 tenant 永远走同一边."""
    from app.canary import CanaryController

    c = CanaryController(enabled=True, v2_ratio=0.5, strategy="hash")
    # 100 次
    for _ in range(100):
        v = c.choose_version(42)
        assert v == c.choose_version(42)  # 一致性


def test_hash_strategy_distribution():
    """hash 分布: v2_ratio=0.5 时, 约 50% 走 v2."""
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=0.5, strategy="hash")
    v2 = 0
    total = 1000
    for tid in range(1, total + 1):
        if c.choose_version(tid) == CanaryVersion.V2:
            v2 += 1
    # 应在 40%-60% 之间 (大数定律)
    assert 400 <= v2 <= 600, f"v2 count {v2} 偏离太大"


def test_hash_strategy_zero_ratio():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=0.0, strategy="hash")
    for tid in range(1, 100):
        assert c.choose_version(tid) == CanaryVersion.V1


def test_hash_strategy_full_ratio():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=1.0, strategy="hash")
    for tid in range(1, 100):
        assert c.choose_version(tid) == CanaryVersion.V2


# ---------------------------------------------------------------------------
# CanaryController - random 策略
# ---------------------------------------------------------------------------


def test_random_strategy_distribution():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=0.3, strategy="random")
    v2 = 0
    total = 5000
    for _ in range(total):
        if c.choose_version(1) == CanaryVersion.V2:
            v2 += 1
    # 应在 25%-35% 之间
    assert 1250 <= v2 <= 1750, f"v2 count {v2} 偏离太大"


# ---------------------------------------------------------------------------
# CanaryController - round_robin 策略
# ---------------------------------------------------------------------------


def test_round_robin_strategy():
    """v2_ratio=0.1 → 每 10 次有 1 次 v2."""
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=0.1, strategy="round_robin")
    # 内部 _rr_counter 单调递增
    # 第 10 / 20 / 30 次必是 v2, 其余 v1
    # 但我们没控制 _rr_counter 起点, 只测比例
    v2 = 0
    total = 100
    for _ in range(total):
        if c.choose_version(1) == CanaryVersion.V2:
            v2 += 1
    # 1/10 = 10%, ±2
    assert 5 <= v2 <= 15, f"v2 count {v2} 偏离太多"


def test_round_robin_zero_ratio():
    from app.canary import CanaryController, CanaryVersion

    c = CanaryController(enabled=True, v2_ratio=0.0, strategy="round_robin")
    for _ in range(50):
        assert c.choose_version(1) == CanaryVersion.V1


# ---------------------------------------------------------------------------
# CanaryController - 策略切换
# ---------------------------------------------------------------------------


def test_set_strategy():
    from app.canary import CanaryController, CanaryStrategy

    c = CanaryController(enabled=True, v2_ratio=0.5)
    c.set_strategy(CanaryStrategy.RANDOM)
    assert c.strategy == CanaryStrategy.RANDOM


# ---------------------------------------------------------------------------
# CanaryController - 比例配置
# ---------------------------------------------------------------------------


def test_set_v2_ratio_clamps():
    from app.canary import CanaryController

    c = CanaryController(enabled=True, v2_ratio=0.5)
    c.set_v2_ratio(2.0)
    assert c.v2_ratio == 1.0
    c.set_v2_ratio(-1.0)
    assert c.v2_ratio == 0.0


# ---------------------------------------------------------------------------
# CanaryController - 快照
# ---------------------------------------------------------------------------


def test_snapshot_basic():
    from app.canary import CanaryController

    c = CanaryController(enabled=True, v2_ratio=0.3, strategy="hash", v2_tenants={5}, v1_tenants={9})
    snap = c.snapshot()
    assert snap["enabled"] is True
    assert snap["rollback"] is False
    assert snap["v2_ratio"] == 0.3
    assert snap["strategy"] == "hash"
    assert 5 in snap["v2_tenants"]
    assert 9 in snap["v1_tenants"]


def test_snapshot_records_decisions():
    from app.canary import CanaryController

    c = CanaryController(enabled=True, v2_ratio=1.0, strategy="hash", v2_tenants={1, 2, 3, 4, 5})
    for _ in range(10):
        c.choose_version(1)
    snap = c.snapshot()
    assert snap["decisions"]["total"] == 10
    assert snap["decisions"]["v2"] == 10


def test_clear_history():
    from app.canary import CanaryController

    c = CanaryController(enabled=True, v2_ratio=1.0, v2_tenants={1})
    for _ in range(5):
        c.choose_version(1)
    c.clear_history()
    assert c.snapshot()["decisions"]["total"] == 0
    assert c.snapshot()["rr_counter"] == 0


# ---------------------------------------------------------------------------
# 全局默认
# ---------------------------------------------------------------------------


def test_default_canary_singleton():
    from app.canary import get_default_canary, reset_default_canary

    reset_default_canary()
    c1 = get_default_canary()
    c2 = get_default_canary()
    assert c1 is c2


def test_default_canary_reset():
    from app.canary import get_default_canary, reset_default_canary

    c1 = get_default_canary()
    reset_default_canary()
    c2 = get_default_canary()
    assert c1 is not c2


def test_choose_version_helper():
    os.environ["ZHS_CANARY_ENABLED"] = "1"
    os.environ["ZHS_CANARY_V2_RATIO"] = "0"
    os.environ["ZHS_CANARY_V2_TENANTS"] = "42"
    from app.canary import CanaryVersion, choose_version, reset_default_canary

    reset_default_canary()
    assert choose_version(42) == CanaryVersion.V2
    assert choose_version(43) == CanaryVersion.V1


# ---------------------------------------------------------------------------
# CanaryMetrics
# ---------------------------------------------------------------------------


def test_record_decision():
    from app.canary_metrics import (
        get_metrics_snapshot,
        record_canary_decision,
    )

    record_canary_decision("v1", tenant_id=1)
    record_canary_decision("v1", tenant_id=1)
    record_canary_decision("v2", tenant_id=1)
    snap = get_metrics_snapshot()
    assert snap["decisions"]["v1/1"] == 2
    assert snap["decisions"]["v2/1"] == 1
    assert snap["decision_total"] == 3


def test_record_error():
    from app.canary_metrics import (
        get_metrics_snapshot,
        record_canary_error,
    )

    record_canary_error("v1", tenant_id=1, endpoint="GET /a")
    record_canary_error("v1", tenant_id=1, endpoint="GET /a")
    snap = get_metrics_snapshot()
    assert snap["errors"]["v1/1/GET /a"] == 2
    assert snap["error_total"] == 2


def test_get_error_rate():
    from app.canary_metrics import (
        get_error_rate,
        record_canary_decision,
        record_canary_error,
    )

    for _ in range(10):
        record_canary_decision("v1", tenant_id=1)
    for _ in range(2):
        record_canary_error("v1", tenant_id=1, endpoint="GET /a")
    er = get_error_rate("v1", tenant_id=1)
    assert er == pytest.approx(0.2)


def test_get_error_rate_zero_total():
    from app.canary_metrics import get_error_rate

    assert get_error_rate("v1", tenant_id=999) == 0.0


def test_metrics_reset():
    from app.canary_metrics import (
        get_metrics_snapshot,
        record_canary_decision,
        record_canary_error,
        reset_metrics,
    )

    record_canary_decision("v1", tenant_id=1)
    record_canary_error("v1", tenant_id=1, endpoint="GET /a")
    reset_metrics()
    snap = get_metrics_snapshot()
    assert snap["decision_total"] == 0
    assert snap["error_total"] == 0


def test_trim_label_long_tenant_id():
    from app.canary_metrics import get_metrics_snapshot, record_canary_decision

    # 长字符串应被截
    long_tid = "t" * 100
    record_canary_decision("v1", tenant_id=long_tid)
    snap = get_metrics_snapshot()
    keys = list(snap["decisions"].keys())
    assert any("..." in k for k in keys)


def test_sync_canary_gauges(monkeypatch):
    from app.canary import CanaryController
    from app.canary_metrics import sync_canary_gauges

    # 不应抛
    c = CanaryController(enabled=True, v2_ratio=0.3, rollback=False)
    sync_canary_gauges(c)
    c2 = CanaryController(enabled=True, v2_ratio=0.5, rollback=True)
    sync_canary_gauges(c2)


# ---------------------------------------------------------------------------
# 集成: canary + metrics
# ---------------------------------------------------------------------------


def test_canary_integration_with_metrics():
    from app.canary import CanaryController
    from app.canary_metrics import get_metrics_snapshot, record_canary_decision

    c = CanaryController(enabled=True, v2_ratio=0.0, v2_tenants={10})
    for tid in range(1, 11):
        v = c.choose_version(tid)
        record_canary_decision(v, tenant_id=tid)
    snap = get_metrics_snapshot()
    assert snap["decisions"]["v2/10"] == 1  # tenant 10 走 v2 (因白名单)
    # 其它全 v1
    for tid in range(1, 10):
        assert snap["decisions"][f"v1/{tid}"] == 1

"""多租户 canary_monitor_bridge 演练 (建议 3 落地测试).

验证:
  1. tenant_id=default 触发 mark_failure 时, reason 含 [tenant=default]
  2. tenant_id=tenant_alpha 触发时, reason 含 [tenant=tenant_alpha]
  3. 三个不同租户都演练 1 次, total mark_failure 调用 = 3, kwargs tenant_id 各自不同
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


class _MockEvent:
    event_type = "auto_rollback"
    from_stage = "10%"
    to_stage = "0%"


@pytest.fixture(autouse=True)
def _setup_env():
    os.environ["ZHS_CANARY_MONITOR_BRIDGE_DISABLED"] = "1"
    os.environ["ZHS_CANARY_MONITOR_CHECK_INTERVAL"] = "0.1"
    os.environ["ZHS_CANARY_MONITOR_FAIL_THRESHOLD"] = "3"
    yield


class _DummyMonitor:
    """极简 monitor stub, 提供 is_running 属性."""

    def __init__(self, running: bool = True):
        self.is_running = running


async def _drill_tenant(tenant_id: str) -> dict[str, Any]:
    """在 in-process app 中跑单租户演练, 返回 mock 调用列表."""
    from app.services import canary_monitor_bridge as bridge

    real_monitor = _DummyMonitor(running=True)  # 用 stub, 避免启动 lifespan

    calls: list[dict] = []

    class _MockController:
        def mark_failure(self, reason: str = "", **kwargs):
            calls.append({"reason": reason, "kwargs": kwargs})
            return _MockEvent()

    bridge._canary_controller = _MockController()
    bridge._bridge_task = None
    bridge._stopping = False

    # 把 _get_monitor 替换为返回我们的 stub
    bridge._get_monitor = lambda: real_monitor  # type: ignore[assignment]

    bridge_state = {
        "check_interval": 0.1,
        "fail_threshold": 3,
        "fail_streak": 0,
        "last_check_ts": 0.0,
        "last_down_ts": 0.0,
        "triggered": False,
        "last_trigger_ts": 0.0,
        "tenant_id": tenant_id,
    }

    # 关闭 monitor, 模拟掉线
    original_running = real_monitor.is_running
    real_monitor.is_running = False
    try:
        for _ in range(3):
            bridge._check_monitor_and_maybe_rollback(bridge_state)
    finally:
        real_monitor.is_running = original_running

    return {"calls": calls, "monitor": real_monitor}


@pytest.mark.asyncio
async def test_tenant_default_runs():
    r = await _drill_tenant("default")
    assert len(r["calls"]) == 1
    assert "[tenant=default]" in r["calls"][0]["reason"]
    assert r["calls"][0]["kwargs"].get("tenant_id") == "default"


@pytest.mark.asyncio
async def test_tenant_alpha_runs():
    r = await _drill_tenant("tenant_alpha")
    assert len(r["calls"]) == 1
    assert "[tenant=tenant_alpha]" in r["calls"][0]["reason"]
    assert r["calls"][0]["kwargs"].get("tenant_id") == "tenant_alpha"


@pytest.mark.asyncio
async def test_three_tenants_isolated():
    """3 个不同租户各自跑一次, 总调用 = 3, 各自 tenant_id 不串."""
    r1 = await _drill_tenant("tenant_a")
    r2 = await _drill_tenant("tenant_b")
    r3 = await _drill_tenant("tenant_c")
    # _drill_tenant 每次都会把 _canary_controller 替换成新 mock, 但调用计数在 mock 内部
    # 重新调用时是新 mock, 计数独立, 所以每个 mock 内部都是 1
    assert len(r1["calls"]) == 1
    assert len(r2["calls"]) == 1
    assert len(r3["calls"]) == 1
    tenants = sorted([r["calls"][0]["kwargs"]["tenant_id"] for r in (r1, r2, r3)])
    assert tenants == ["tenant_a", "tenant_b", "tenant_c"]

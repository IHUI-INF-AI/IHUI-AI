# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型健康服务 × 上游模型清单同步 联动测试(2026-11-09 立)。

机主诉求:刷新模型列表 / 定时自动刷新模型是否好使时,同时也要拉上游模型清单、
更新模型;上游已下架的不在库里占地方,上新的也要更新好。

本文件只钉「触发链路」这层契约,不重复 model_sync 自身的 upsert / 物理删除判据
(那些由 test_model_sync.py、test_model_sync_auto_replace.py 覆盖):
- 手动刷新强制触发一次上游同步,自动轮次按 5 小时节流;
- 一次完整刷新编排 = 同步 → 重建目录 → 探测,running 覆盖同步阶段;
- 上游同步失败 / stub / 已有一轮在跑,都不能让健康探测丢失;
- 同步结果(上新数 / 下架清理数 / 成败)如实暴露给前端轮询状态。
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

import app.services.model_sync as model_sync_module
from app.core.llm_gateway import llm_gateway
from app.services.model_health import UPSTREAM_SYNC_INTERVAL_S, ModelHealthService


class FakeSyncService:
    """替身:记录 sync_all_providers 调用,不碰 DB / 不真打上游。"""

    def __init__(self) -> None:
        self.calls = 0
        self.dry_runs: list[bool] = []
        self.syncing = False
        self.status_calls = 0
        self.syncing_once = False
        self.result: dict = {
            "total_new_models": 3,
            "total_removed_models": 2,
            "total_providers": 5,
            "is_syncing": False,
            "results": [
                {"provider_code": "alpha", "success": True},
                {"provider_code": "beta", "success": True},
            ],
        }

    def get_status(self) -> dict:
        self.status_calls += 1
        if self.syncing_once:
            # 第一次探到「有同步在跑」,之后立刻落库完成 ⇒ 不触发真实 sleep
            return {"is_syncing": self.status_calls == 1}
        return {"is_syncing": self.syncing, **self.result}

    async def sync_all_providers(self, dry_run: bool = False) -> dict:
        self.calls += 1
        self.dry_runs.append(dry_run)
        return self.get_status()


@pytest.fixture
def fake_sync(monkeypatch):
    fake = FakeSyncService()
    monkeypatch.setattr(model_sync_module, "model_sync_service", fake)
    monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: False)
    return fake


@pytest.fixture
def service():
    """每个用例一份全新实例,不污染进程内单例 model_health。"""
    svc = ModelHealthService()
    svc._ensure_catalog = AsyncMock(return_value=True)
    svc._refresh_all = AsyncMock()
    return svc


async def _run(svc: ModelHealthService, *, reason: str, force: bool) -> None:
    """起一轮完整刷新并等它跑完(避开 while True 的 _refresh_loop)。"""
    svc._start_refresh(reason=reason, force_upstream=force)
    assert svc._refresh_task is not None
    await svc._refresh_task


@pytest.mark.asyncio
async def test_manual_refresh_forces_upstream_sync_and_rebuilds_catalog(service, fake_sync):
    """用户点刷新 ⇒ 真拉一次上游清单(非 dry-run)⇒ 重建目录 ⇒ 再探测。"""
    status = service.trigger_refresh()
    assert status["running"] is True, "同步阶段 running 必须已为 true,否则前端会过早重拉列表"
    await service._refresh_task

    assert fake_sync.calls == 1
    assert fake_sync.dry_runs == [False], "必须真写库,不能是 dry-run 预览"
    service._ensure_catalog.assert_awaited_once(), "同步后要按最新 DB 重建探测候选目录"
    service._refresh_all.assert_awaited_once(), "健康探测不能被同步吞掉"

    state = service.get_status()["upstream_sync"]
    assert state["last_reason"] == "manual_refresh"
    assert state["last_ok"] is True
    assert state["new_models"] == 3, "上新数要如实回传"
    assert state["removed_models"] == 2, "下架清理数要如实回传"
    assert state["total_providers"] == 5
    assert service.get_status()["running"] is False


@pytest.mark.asyncio
async def test_running_covers_whole_sync_phase(service, fake_sync):
    """上游同步还在跑时 running 恒 true;同步完成且探测结束才落 false。"""
    gate = asyncio.Event()

    async def slow_sync(dry_run: bool = False) -> dict:
        await gate.wait()
        return fake_sync.result

    fake_sync.sync_all_providers = slow_sync
    service._start_refresh(reason="manual_refresh", force_upstream=True)
    await asyncio.sleep(0)

    assert service.get_status()["running"] is True
    assert service.get_status()["upstream_sync"]["running"] is True
    assert service._refresh_all.await_count == 0, "同步没完不应先跑探测"

    gate.set()
    await service._refresh_task
    assert service.get_status()["running"] is False
    assert service._refresh_all.await_count == 1


@pytest.mark.asyncio
async def test_auto_round_throttles_upstream_sync_to_five_hours(service, fake_sync):
    """自动轮次 30 分钟一轮,但上游同步只在距上次 >= 5 小时那一轮顺带跑。"""
    await _run(service, reason="auto_probe", force=False)
    assert fake_sync.calls == 1

    await _run(service, reason="auto_probe", force=False)
    assert fake_sync.calls == 1, "未到 5 小时不得重复打上游"
    assert service._refresh_all.await_count == 2, "跳过同步不影响健康探测照常跑"
    assert service.get_status()["upstream_sync"]["skipped"] is True

    # 时间拨过 5 小时窗口 ⇒ 下一轮自动探测重新拉上游
    service._last_upstream_sync_at -= UPSTREAM_SYNC_INTERVAL_S + 1
    await _run(service, reason="auto_probe", force=False)
    assert fake_sync.calls == 2


@pytest.mark.asyncio
async def test_manual_force_bypasses_five_hour_window_but_keeps_debounce(service, fake_sync):
    """手动刷新不受 5 小时节流,但 60s 内连点仍防抖,避免把上游打成限流。"""
    await _run(service, reason="auto_probe", force=False)
    assert fake_sync.calls == 1

    await _run(service, reason="manual_refresh", force=True)
    assert fake_sync.calls == 1, "60s 内连点应防抖"

    service._last_upstream_sync_at -= 120.0
    await _run(service, reason="manual_refresh", force=True)
    assert fake_sync.calls == 2, "过了防抖窗,手动刷新必须能重新拉上游"


@pytest.mark.asyncio
async def test_upstream_sync_failure_never_blocks_probe(service, fake_sync):
    """上游挂了只是记失败 + 短退避,健康探测是可用性底线,必须照跑。"""
    failing = AsyncMock(side_effect=RuntimeError("upstream down"))
    fake_sync.sync_all_providers = failing

    await _run(service, reason="manual_refresh", force=True)

    service._refresh_all.assert_awaited_once()
    assert failing.await_count == 1
    state = service.get_status()["upstream_sync"]
    assert state["last_ok"] is False
    assert "RuntimeError" in state["error"]

    # 失败走 5 分钟短退避,而非 5 小时:下一轮自动探测即可重试
    service._last_upstream_sync_at -= 301.0
    await _run(service, reason="auto_probe", force=False)
    assert failing.await_count == 2, "过了短退避窗必须重新尝试同步"


@pytest.mark.asyncio
async def test_reuses_running_sync_and_waits_for_it(service, fake_sync):
    """model_sync 自身 6h 循环正在跑:不重复打上游,但等它落库后重建目录。"""
    fake_sync.syncing_once = True

    await _run(service, reason="manual_refresh", force=True)

    assert fake_sync.calls == 0, "已有同步在跑,本轮不得重复触发"
    service._ensure_catalog.assert_awaited_once(), "要按对方刚落库的最新清单重建目录"
    service._refresh_all.assert_awaited_once()
    assert service.get_status()["upstream_sync"]["reused_running_sync"] is True


@pytest.mark.asyncio
async def test_stub_mode_skips_upstream_but_still_probes(service, fake_sync, monkeypatch):
    """本地开发 stub(无 key)不该打上游,探测链路仍完整。"""
    monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: True)

    await _run(service, reason="manual_refresh", force=True)

    assert fake_sync.calls == 0
    service._refresh_all.assert_awaited_once()
    assert service.get_status()["upstream_sync"]["skipped"] is True


@pytest.mark.asyncio
async def test_partial_provider_failure_is_reported(service, fake_sync):
    """单 provider 失败被 sync_all_providers 收进 results,状态层要如实计数。"""
    fake_sync.result["results"] = [
        {"provider_code": "alpha", "success": True},
        {"provider_code": "beta", "success": False, "error": "401 invalid key"},
    ]

    await _run(service, reason="manual_refresh", force=True)

    state = service.get_status()["upstream_sync"]
    assert state["last_ok"] is True, "部分成功不算整轮失败"
    assert state["failed_providers"] == 1
    assert "401" in state["error"]


@pytest.mark.asyncio
async def test_all_providers_failed_marks_round_failed(service, fake_sync):
    """全部 provider 失败 ⇒ last_ok=False,触发短退避重试而非 5 小时空窗。"""
    fake_sync.result["results"] = [
        {"provider_code": "alpha", "success": False, "error": "timeout"},
        {"provider_code": "beta", "success": False, "error": "timeout"},
    ]

    await _run(service, reason="manual_refresh", force=True)

    assert service.get_status()["upstream_sync"]["last_ok"] is False


@pytest.mark.asyncio
async def test_start_refresh_does_not_stack_concurrent_rounds(service, fake_sync):
    """已有一轮在跑时不叠加任务,避免并发打上游。"""
    gate = asyncio.Event()

    async def slow_sync(dry_run: bool = False) -> dict:
        await gate.wait()
        return fake_sync.result

    fake_sync.sync_all_providers = slow_sync
    service._start_refresh(reason="manual_refresh", force_upstream=True)
    first_task = service._refresh_task
    service._start_refresh(reason="manual_refresh", force_upstream=True)
    assert service._refresh_task is first_task, "不得另起第二个任务"

    gate.set()
    await first_task
    assert service._refresh_all.await_count == 1


@pytest.mark.asyncio
async def test_sync_status_snapshot_shape_is_stable(service, fake_sync):
    """get_status().upstream_sync 字段集稳定,前端可安全读取可选字段。"""
    expected_keys = {
        "last_reason", "last_ok", "error", "new_models", "removed_models",
        "total_providers", "failed_providers", "skipped", "reused_running_sync",
        "running", "last_sync_at",
    }
    assert set(service.get_status()["upstream_sync"]) == expected_keys
    await _run(service, reason="manual_refresh", force=True)
    assert set(service.get_status()["upstream_sync"]) == expected_keys
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""agent_timeline.py + injection_event_recorder.py 单元测试。

测试覆盖:
- injection_event_recorder:记录/列表回环、snippet 截断、MAX_PER_SESSION 上限、reset
- aggregate_timeline:五源聚合、时间升序排序、summary 统计、limit 截断、
  单源故障隔离(某源抛异常不影响其余聚合)、空会话冷启动
- _to_epoch / _iso 边界值(None / 非法字符串 / epoch 数字 / ISO 字符串)

聚合测试通过 monkeypatch 替换 agent_timeline 模块内引用的五个数据源,
不依赖 Redis / DB;注入源使用真实进程内记录器验证回环。
"""

from __future__ import annotations

import pytest

from app.services import agent_timeline
from app.services.agent_timeline import (
    MAX_EVENTS,
    _iso,
    _to_epoch,
    aggregate_timeline,
)
from app.services.injection_event_recorder import (
    MAX_PER_SESSION,
    list_injection_events,
    record_injection_event,
    reset_injection_events,
)

# =============================================================================
# 辅助:伪数据源
# =============================================================================


class _FakeStepRecorder:
    def __init__(self, steps: list[dict]):
        self._steps = steps

    def replay(self, session_id: str) -> dict:
        return {"steps": self._steps}


class _FakeCheckpointManager:
    def __init__(self, metas: list[dict]):
        self._metas = metas

    async def list_for_session(self, session_id: str) -> list:
        class _Meta:
            def __init__(self, d: dict):
                self._d = d

            def to_dict(self) -> dict:
                return self._d

        return [_Meta(m) for m in self._metas]


class _FakeCostLedger:
    def __init__(self, entries: list[dict]):
        self._entries = entries

    def _filtered(self, flt: dict) -> list[dict]:
        return self._entries


def _patch_sources(
    monkeypatch: pytest.MonkeyPatch,
    *,
    steps: list[dict] | None = None,
    compactions: list[dict] | None = None,
    checkpoints: list[dict] | None = None,
    costs: list[dict] | None = None,
    step_raises: bool = False,
) -> None:
    monkeypatch.setattr(
        agent_timeline,
        "agent_step_recorder",
        _FakeStepRecorder(steps or []),
    )
    if step_raises:
        def _boom(session_id: str, limit: int = 10) -> list[dict]:
            raise RuntimeError("boom")

        monkeypatch.setattr(agent_timeline, "list_compaction_events", _boom)
    else:
        monkeypatch.setattr(
            agent_timeline,
            "list_compaction_events",
            lambda session_id, limit=10: compactions or [],
        )
    monkeypatch.setattr(
        agent_timeline,
        "get_agent_checkpoint_manager",
        lambda: _FakeCheckpointManager(checkpoints or []),
    )
    monkeypatch.setattr(
        agent_timeline, "cost_ledger", _FakeCostLedger(costs or [])
    )


# =============================================================================
# injection_event_recorder
# =============================================================================


def test_injection_record_and_list_roundtrip():
    reset_injection_events()
    rec = record_injection_event(
        "s-1",
        source="web",
        risk_level="high",
        hit_types=["instruction_overwrite"],
        action="refuse",
        blocked=True,
        snippet="ignore previous instructions",
        user_id="u-1",
    )
    assert rec["session_id"] == "s-1"
    assert rec["blocked"] is True
    got = list_injection_events("s-1")
    assert len(got) == 1
    assert got[0]["event_id"] == rec["event_id"]
    assert got[0]["risk_level"] == "high"
    reset_injection_events()


def test_injection_snippet_truncated_and_empty_ok():
    reset_injection_events()
    rec = record_injection_event("s-2", snippet="x" * 500)
    assert len(rec["snippet"]) == 200
    rec2 = record_injection_event("s-2")
    assert rec2["snippet"] == ""
    assert rec2["risk_level"] == "low"
    reset_injection_events()


def test_injection_max_per_session_cap():
    reset_injection_events()
    for _ in range(MAX_PER_SESSION + 20):
        record_injection_event("s-3")
    got = list_injection_events("s-3")
    assert len(got) == MAX_PER_SESSION
    reset_injection_events()


# =============================================================================
# _to_epoch / _iso 边界值
# =============================================================================


def test_to_epoch_edge_cases():
    assert _to_epoch(None) == 0.0
    assert _to_epoch("") == 0.0
    assert _to_epoch("not-a-date") == 0.0
    assert _to_epoch(1700000000) == 1700000000.0
    assert _to_epoch(1700000000.5) == 1700000000.5
    assert _to_epoch("2026-09-07T00:00:00") > 0.0
    assert _to_epoch("2026-09-07T00:00:00Z") > 0.0


def test_iso_edge_cases():
    assert _iso(None) == ""
    assert _iso(0) != ""  # epoch 0 是合法时间
    assert "T" in _iso(1700000000)
    assert _iso("2026-09-07") == "2026-09-07"


# =============================================================================
# aggregate_timeline
# =============================================================================


@pytest.mark.asyncio
async def test_aggregate_empty_session_cold_start(monkeypatch):
    _patch_sources(monkeypatch)
    reset_injection_events()
    data = await aggregate_timeline("s-empty")
    assert data["total"] == 0
    assert data["events"] == []
    assert data["summary"]["counts"] == {}
    assert data["summary"]["window"]["start"] is None


@pytest.mark.asyncio
async def test_aggregate_five_kinds_sorted_and_summary(monkeypatch):
    reset_injection_events()
    steps = [
        {
            "type": "tool",
            "tool_name": "index_codebase",
            "input_summary": "rebuild index",
            "status": "ok",
            "at": 1700000200,
            "step_index": 1,
            "tokens": 120,
        }
    ]
    compactions = [
        {
            "compaction_id": "c-1",
            "compacted_at": 1700000100,
            "original_tokens": 1000,
            "compressed_tokens": 400,
            "saved_tokens": 600,
            "saved_ratio": 0.6,
            "trigger": "threshold",
            "summary": "kept key decisions",
        }
    ]
    checkpoints = [
        {
            "checkpoint_id": "cp-1",
            "created_at": 1700000300,
            "iteration": 3,
            "message_count": 8,
            "status": "ok",
        }
    ]
    costs = [
        {
            "record_id": "cost-1",
            "at": 1700000250,
            "tool_name": "index_codebase",
            "model": "",
            "tokens_in": 100,
            "tokens_out": 20,
            "total_tokens": 120,
            "cost_usd": 0.01,
            "status": "ok",
            "estimated": False,
        }
    ]
    record_injection_event("s-5", risk_level="med", hit_types=["fake"], blocked=True)
    # 覆盖:注入事件挂在真实记录器上,聚合应拉到
    _patch_sources(
        monkeypatch,
        steps=steps,
        compactions=compactions,
        checkpoints=checkpoints,
        costs=costs,
    )
    data = await aggregate_timeline("s-5")

    kinds = [e["kind"] for e in data["events"]]
    assert kinds == ["compaction", "step", "cost", "checkpoint", "injection"]
    ats = [e["at"] for e in data["events"]]
    assert ats == sorted(ats)

    assert data["total"] == 5
    assert data["summary"]["counts"] == {
        "compaction": 1,
        "step": 1,
        "cost": 1,
        "checkpoint": 1,
        "injection": 1,
    }
    assert data["summary"]["total_cost_usd"] == pytest.approx(0.01)
    assert data["summary"]["total_tokens"] == 240  # cost 120 + step 120
    assert data["summary"]["window"]["start"] is not None
    assert data["summary"]["window"]["end"] is not None


@pytest.mark.asyncio
async def test_aggregate_limit_truncation(monkeypatch):
    steps = [
        {"tool_name": f"t{i}", "at": 1700000000 + i, "step_index": i}
        for i in range(50)
    ]
    _patch_sources(monkeypatch, steps=steps)
    data = await aggregate_timeline("s-6", limit=10)
    assert data["total"] == 10
    assert len(data["events"]) == 10


@pytest.mark.asyncio
async def test_aggregate_limit_clamped_to_max(monkeypatch):
    _patch_sources(monkeypatch)
    data = await aggregate_timeline("s-7", limit=999999)
    assert data["total"] == 0
    # MAX_EVENTS 常量兜底
    assert MAX_EVENTS == 500


@pytest.mark.asyncio
async def test_aggregate_source_failure_isolated(monkeypatch):
    """单源抛异常不得影响其余四源聚合(降级安全)。"""
    _patch_sources(
        monkeypatch,
        steps=[{"tool_name": "ok-tool", "at": 1700000100, "step_index": 0}],
        step_raises=True,
    )
    reset_injection_events()
    data = await aggregate_timeline("s-8")
    assert data["total"] == 1
    assert data["events"][0]["kind"] == "step"


@pytest.mark.asyncio
async def test_aggregate_step_event_fields(monkeypatch):
    steps = [
        {
            "type": "tool",
            "tool_name": "run_tests",
            "input_summary": "x" * 300,
            "status": "error",
            "at": "2026-09-07T10:00:00",
            "step_index": 2,
            "tokens_in": 10,
            "tokens_out": 5,
            "duration_ms": 12.345,
            "cost": 0.002,
            "result_summary": "1 failed",
        }
    ]
    _patch_sources(monkeypatch, steps=steps)
    data = await aggregate_timeline("s-9")
    ev = data["events"][0]
    assert ev["kind"] == "step"
    assert ev["title"] == "run_tests"
    assert len(ev["subtitle"]) == 160
    assert ev["status"] == "error"
    assert ev["ref_id"] == "step-2"
    assert ev["meta"]["duration_ms"] == 12.35
    assert ev["meta"]["tokens"] == 0  # 未提供 tokens 字段时兜底 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

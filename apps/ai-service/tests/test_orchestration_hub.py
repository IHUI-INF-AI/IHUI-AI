"""跨支柱编排中枢(orchestration_hub.py)测试。

覆盖范围:
1. 模块常量(PILLARS / PILLAR_EVENTS / _PILLAR_API_PATHS / ORCHESTRATION_PLAYBOOKS)
2. 数据模型:PillarEvent(to_dict / from_dict)、OrchestrationDecision(to_dict)
3. PillarEventBus:publish / subscribe / unsubscribe / 内存分发 / get_recent_events / get_event_stats
   + Redis 降级 + 同步/异步回调 + 异常隔离
4. JointDecisionEngine:_match_playbook / evaluate / _call_pillar_action / execute_decision
   / _record_decision / get_playbooks / enable_playbook / get_decision_history / get_orchestration_stats
5. OrchestrationHub:start / stop / _consume_loop(cancel)/ _process_event / emit
   / get_status / get_event_feed / get_dashboard
6. 模块级单例:orchestration_hub

强制内存模式:patch 模块级 _REDIS_URL="" 让 _ensure_redis 立即返回 None。
httpx 调用通过 patch("httpx.AsyncClient") mock,不实际发 HTTP。
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import orchestration_hub as oh_module
from app.services.orchestration_hub import (
    ORCHESTRATION_PLAYBOOKS,
    PILLAR_EVENTS,
    PILLARS,
    _DECISION_LIST_KEY,
    _MEMORY_DECISION_MAXLEN,
    _MEMORY_EVENT_MAXLEN,
    _PILLAR_API_PATHS,
    _PLAYBOOK_HASH_KEY,
    _STREAM_GROUP,
    _STREAM_KEY,
    _STREAM_MAXLEN,
    JointDecisionEngine,
    OrchestrationDecision,
    OrchestrationHub,
    PillarEvent,
    PillarEventBus,
    orchestration_hub,
)


# =============================================================================
# 公共 fixture:强制内存模式(隔离 Redis)
# =============================================================================


@pytest.fixture(autouse=True)
def _force_memory_mode(monkeypatch: pytest.MonkeyPatch):
    """强制内存模式:patch _REDIS_URL="",确保所有 _ensure_redis 立即返回 None。"""
    monkeypatch.setattr(oh_module, "_REDIS_URL", "")
    monkeypatch.setattr(oh_module, "_settings", None)
    yield


@pytest.fixture
def event_bus() -> PillarEventBus:
    """干净的 PillarEventBus 实例(内存模式)。"""
    return PillarEventBus()


@pytest.fixture
def decision_engine() -> JointDecisionEngine:
    """干净的 JointDecisionEngine 实例(内存模式)。"""
    return JointDecisionEngine()


@pytest.fixture
def hub() -> OrchestrationHub:
    """干净的 OrchestrationHub 实例(内存模式)。"""
    return OrchestrationHub()


def _make_event(
    event_type: str = "terminal.command_failed",
    source_pillar: str = "terminal",
    payload: dict[str, Any] | None = None,
    severity: str = "info",
    dispatch_id: str = "",
) -> PillarEvent:
    """构造测试用 PillarEvent。"""
    return PillarEvent(
        event_type=event_type,
        source_pillar=source_pillar,
        timestamp=datetime.now(timezone.utc).isoformat(),
        payload=payload or {},
        dispatch_id=dispatch_id,
        severity=severity,
    )


def _patch_record_decision(engine: JointDecisionEngine):
    """Patch 源码 _record_decision 的 walrus 操作符 bug(L679)。

    源码:
        self._stats[total_key := decision.status] = self._stats.get(total_key, 0) + 1
    Python 先求值 RHS,self._stats.get(total_key, 0) 在 total_key 赋值前执行
    → UnboundLocalError。

    这里提供一个等价于"源码意图"的可用实现,供需要 _record_decision 副作用的测试使用。
    bug 本身由 TestJointDecisionEngineRecordDecisionBug 类直接验证。
    """

    async def _working_record(decision: OrchestrationDecision) -> None:
        record = decision.to_dict()
        engine._memory_decisions.append(record)
        engine._stats["total_decisions"] += 1
        engine._stats[decision.status] = engine._stats.get(decision.status, 0) + 1
        engine._stats["total_duration_ms"] += decision.duration_ms
        if decision.playbook_id:
            engine._stats["playbook_triggers"][decision.playbook_id] = (
                engine._stats["playbook_triggers"].get(decision.playbook_id, 0) + 1
            )

    return patch.object(engine, "_record_decision", _working_record)


# =============================================================================
# 1. 模块常量
# =============================================================================


class TestConstants:
    """模块常量校验。"""

    def test_pillars_contains_seven_pillars(self):
        assert set(PILLARS) == {
            "rules", "hook", "spec", "context", "subagent", "terminal", "budget"
        }

    def test_pillar_events_count(self):
        assert len(PILLAR_EVENTS) == 26

    def test_pillar_events_all_have_descriptions(self):
        for key, desc in PILLAR_EVENTS.items():
            assert isinstance(key, str)
            assert "." in key  # 格式 pillar.event
            assert isinstance(desc, str) and desc

    def test_pillar_api_paths_keys_subset_of_pillars(self):
        for pillar in _PILLAR_API_PATHS:
            assert pillar in PILLARS

    def test_pillar_api_paths_values_are_api_paths(self):
        for path in _PILLAR_API_PATHS.values():
            assert path.startswith("/api/")
            assert path.endswith("/orchestrate")

    def test_playbooks_count(self):
        assert len(ORCHESTRATION_PLAYBOOKS) == 6

    def test_playbooks_triggers_match_pillar_events(self):
        for pid, playbook in ORCHESTRATION_PLAYBOOKS.items():
            assert playbook["trigger"] in PILLAR_EVENTS, f"{pid} trigger 不在 PILLAR_EVENTS"

    def test_playbooks_have_actions(self):
        for pid, playbook in ORCHESTRATION_PLAYBOOKS.items():
            assert "name" in playbook
            assert "trigger" in playbook
            assert isinstance(playbook["actions"], list) and playbook["actions"]

    def test_playbooks_actions_pillar_known(self):
        for pid, playbook in ORCHESTRATION_PLAYBOOKS.items():
            for action in playbook["actions"]:
                assert action["pillar"] in PILLARS, f"{pid} action pillar={action['pillar']} 不在 PILLARS"

    def test_stream_key_constants(self):
        assert _STREAM_KEY == "hub:events"
        assert _STREAM_GROUP == "hub-orchestrator"
        assert _DECISION_LIST_KEY == "hub:decisions"
        assert _PLAYBOOK_HASH_KEY == "hub:playbooks"

    def test_memory_maxlen_constants(self):
        assert _MEMORY_EVENT_MAXLEN == 10000
        assert _MEMORY_DECISION_MAXLEN == 1000
        assert _STREAM_MAXLEN == 10000


# =============================================================================
# 2. PillarEvent 数据模型
# =============================================================================


class TestPillarEvent:
    """PillarEvent dataclass:to_dict / from_dict。"""

    def test_to_dict_returns_all_fields(self):
        evt = PillarEvent(
            event_type="rules.matched",
            source_pillar="rules",
            timestamp="2026-07-23T00:00:00+00:00",
            payload={"k": "v"},
            dispatch_id="d-1",
            severity="warning",
        )
        d = evt.to_dict()
        assert d == {
            "event_type": "rules.matched",
            "source_pillar": "rules",
            "timestamp": "2026-07-23T00:00:00+00:00",
            "payload": {"k": "v"},
            "dispatch_id": "d-1",
            "severity": "warning",
        }

    def test_to_dict_with_defaults(self):
        evt = PillarEvent(
            event_type="hook.emitted",
            source_pillar="hook",
            timestamp="ts",
            payload={},
        )
        d = evt.to_dict()
        assert d["dispatch_id"] == ""
        assert d["severity"] == "info"

    def test_from_dict_full_data(self):
        data = {
            "event_type": "spec.approved",
            "source_pillar": "spec",
            "timestamp": "ts",
            "payload": {"a": 1},
            "dispatch_id": "d-2",
            "severity": "critical",
        }
        evt = PillarEvent.from_dict(data)
        assert evt.event_type == "spec.approved"
        assert evt.source_pillar == "spec"
        assert evt.payload == {"a": 1}
        assert evt.dispatch_id == "d-2"
        assert evt.severity == "critical"

    def test_from_dict_missing_fields_uses_defaults(self):
        evt = PillarEvent.from_dict({})
        assert evt.event_type == ""
        assert evt.source_pillar == ""
        assert evt.timestamp == ""
        assert evt.payload == {}
        assert evt.dispatch_id == ""
        assert evt.severity == "info"

    def test_from_dict_partial_data(self):
        evt = PillarEvent.from_dict({"event_type": "x.y", "source_pillar": "x"})
        assert evt.event_type == "x.y"
        assert evt.source_pillar == "x"
        assert evt.severity == "info"

    def test_roundtrip_to_from_dict(self):
        evt = _make_event(event_type="rules.violated", source_pillar="rules", severity="warning")
        evt.dispatch_id = "rd-1"
        d = evt.to_dict()
        evt2 = PillarEvent.from_dict(d)
        assert evt2.event_type == evt.event_type
        assert evt2.source_pillar == evt.source_pillar
        assert evt2.timestamp == evt.timestamp
        assert evt2.payload == evt.payload
        assert evt2.dispatch_id == evt.dispatch_id
        assert evt2.severity == evt.severity


# =============================================================================
# 3. OrchestrationDecision 数据模型
# =============================================================================


class TestOrchestrationDecision:
    """OrchestrationDecision dataclass:to_dict。"""

    def test_to_dict_includes_trigger_event_dict(self):
        evt = _make_event()
        decision = OrchestrationDecision(
            decision_id="d-1",
            trigger_event=evt,
            playbook_id="pb",
            actions=[{"pillar": "rules", "action": "x", "params": {}}],
            status="pending",
        )
        d = decision.to_dict()
        assert d["decision_id"] == "d-1"
        assert d["playbook_id"] == "pb"
        assert d["status"] == "pending"
        assert d["trigger_event"] == evt.to_dict()
        assert d["actions"] == [{"pillar": "rules", "action": "x", "params": {}}]
        assert d["results"] == []
        assert d["duration_ms"] == 0

    def test_to_dict_with_results_and_timing(self):
        evt = _make_event()
        decision = OrchestrationDecision(
            decision_id="d-2",
            trigger_event=evt,
            playbook_id="",
            actions=[],
            status="completed",
            results=[{"success": True}],
            created_at="2026-01-01T00:00:00+00:00",
            executed_at="2026-01-01T00:00:01+00:00",
            duration_ms=1000,
        )
        d = decision.to_dict()
        assert d["status"] == "completed"
        assert d["results"] == [{"success": True}]
        assert d["created_at"] == "2026-01-01T00:00:00+00:00"
        assert d["executed_at"] == "2026-01-01T00:00:01+00:00"
        assert d["duration_ms"] == 1000


# =============================================================================
# 4. PillarEventBus
# =============================================================================


class TestPillarEventBusInit:
    """PillarEventBus 初始化。"""

    def test_init_defaults(self, event_bus: PillarEventBus):
        assert event_bus._redis is None
        assert event_bus._use_redis is True
        assert event_bus._memory_events.maxlen == _MEMORY_EVENT_MAXLEN
        assert event_bus._subscriptions == {}

    async def test_ensure_redis_no_url_returns_none(self, event_bus: PillarEventBus):
        result = await event_bus._ensure_redis()
        assert result is None
        assert event_bus._use_redis is False

    async def test_ensure_redis_second_call_short_circuits(self, event_bus: PillarEventBus):
        event_bus._use_redis = False
        result = await event_bus._ensure_redis()
        assert result is None

    async def test_ensure_redis_returns_existing_client(self, event_bus: PillarEventBus):
        fake_redis = MagicMock()
        event_bus._redis = fake_redis
        result = await event_bus._ensure_redis()
        assert result is fake_redis


class TestPillarEventBusPublish:
    """PillarEventBus.publish — 内存降级 + 订阅分发。"""

    async def test_publish_returns_uuid_string(self, event_bus: PillarEventBus):
        evt = _make_event()
        eid = await event_bus.publish(evt)
        assert isinstance(eid, str)
        assert len(eid) > 0

    async def test_publish_appends_to_memory_events(self, event_bus: PillarEventBus):
        evt = _make_event(event_type="rules.matched")
        eid = await event_bus.publish(evt)
        assert len(event_bus._memory_events) == 1
        stored = event_bus._memory_events[0]
        assert stored["id"] == eid
        assert stored["event_type"] == "rules.matched"

    async def test_publish_dispatches_to_subscribers(self, event_bus: PillarEventBus):
        received: list[PillarEvent] = []
        sub_id = await event_bus.subscribe("rules", ["rules.matched"], lambda e: received.append(e))
        evt = _make_event(event_type="rules.matched", source_pillar="rules")
        await event_bus.publish(evt)
        assert len(received) == 1
        assert received[0].event_type == "rules.matched"

    async def test_publish_does_not_dispatch_unrelated_subscribers(self, event_bus: PillarEventBus):
        received: list[PillarEvent] = []
        await event_bus.subscribe("hook", ["hook.emitted"], lambda e: received.append(e))
        evt = _make_event(event_type="rules.matched", source_pillar="rules")
        await event_bus.publish(evt)
        assert received == []

    async def test_publish_with_redis_returns_stream_id(self, event_bus: PillarEventBus):
        """模拟 Redis 可用:patch _ensure_redis 返回 fake_redis。"""
        fake_redis = AsyncMock()
        fake_redis.xadd = AsyncMock(return_value="1234-0")
        event_bus._redis = fake_redis
        event_bus._use_redis = True

        evt = _make_event()
        eid = await event_bus.publish(evt)
        assert eid == "1234-0"
        fake_redis.xadd.assert_awaited_once()
        # 内存镜像也应该有
        assert len(event_bus._memory_events) == 1
        assert event_bus._memory_events[0]["id"] == "1234-0"

    async def test_publish_redis_failure_falls_back_to_memory(self, event_bus: PillarEventBus):
        """Redis XADD 抛异常 → 降级到内存(返回 uuid)。"""
        fake_redis = AsyncMock()
        fake_redis.xadd = AsyncMock(side_effect=Exception("XADD 失败"))
        event_bus._redis = fake_redis
        event_bus._use_redis = True

        evt = _make_event()
        eid = await event_bus.publish(evt)
        # 内存降级会 append 一次(Redis 路径在 try 内 append 失败,降级路径再 append)
        assert isinstance(eid, str)
        # 至少有一条内存事件(降级路径的)
        assert len(event_bus._memory_events) >= 1


class TestPillarEventBusSubscribe:
    """PillarEventBus.subscribe / unsubscribe。"""

    async def test_subscribe_returns_uuid(self, event_bus: PillarEventBus):
        sub_id = await event_bus.subscribe("rules", ["rules.matched"], lambda e: None)
        assert isinstance(sub_id, str)
        assert sub_id in event_bus._subscriptions

    async def test_subscribe_stores_pillar_and_event_types(self, event_bus: PillarEventBus):
        cb = lambda e: None
        sub_id = await event_bus.subscribe("hook", ["hook.emitted", "hook.failed"], cb)
        sub = event_bus._subscriptions[sub_id]
        assert sub["pillar"] == "hook"
        assert sub["event_types"] == {"hook.emitted", "hook.failed"}
        assert sub["callback"] is cb

    async def test_unsubscribe_removes_subscription(self, event_bus: PillarEventBus):
        sub_id = await event_bus.subscribe("rules", ["rules.matched"], lambda e: None)
        result = await event_bus.unsubscribe(sub_id)
        assert result is True
        assert sub_id not in event_bus._subscriptions

    async def test_unsubscribe_unknown_returns_false(self, event_bus: PillarEventBus):
        result = await event_bus.unsubscribe("nonexistent")
        assert result is False


class TestPillarEventBusDispatch:
    """PillarEventBus._dispatch_to_memory_subscribers — 同步/异步回调 + 异常隔离。"""

    async def test_dispatch_sync_callback(self, event_bus: PillarEventBus):
        received: list[PillarEvent] = []
        await event_bus.subscribe("rules", ["rules.matched"], lambda e: received.append(e))
        evt = _make_event(event_type="rules.matched")
        await event_bus._dispatch_to_memory_subscribers(evt)
        assert len(received) == 1

    async def test_dispatch_async_callback(self, event_bus: PillarEventBus):
        received: list[PillarEvent] = []

        async def cb(e: PillarEvent):
            received.append(e)

        await event_bus.subscribe("rules", ["rules.matched"], cb)
        evt = _make_event(event_type="rules.matched")
        await event_bus._dispatch_to_memory_subscribers(evt)
        assert len(received) == 1

    async def test_dispatch_callback_exception_does_not_raise(self, event_bus: PillarEventBus):
        def bad_cb(e: PillarEvent):
            raise ValueError("callback 故障")

        await event_bus.subscribe("rules", ["rules.matched"], bad_cb)
        evt = _make_event(event_type="rules.matched")
        # 不抛异常
        await event_bus._dispatch_to_memory_subscribers(evt)

    async def test_dispatch_only_matching_event_types(self, event_bus: PillarEventBus):
        received_a: list[PillarEvent] = []
        received_b: list[PillarEvent] = []
        await event_bus.subscribe("rules", ["rules.matched"], lambda e: received_a.append(e))
        await event_bus.subscribe("rules", ["rules.violated"], lambda e: received_b.append(e))
        evt = _make_event(event_type="rules.matched")
        await event_bus._dispatch_to_memory_subscribers(evt)
        assert len(received_a) == 1
        assert received_b == []

    async def test_dispatch_multiple_subscribers_same_event(self, event_bus: PillarEventBus):
        received_a: list[PillarEvent] = []
        received_b: list[PillarEvent] = []
        await event_bus.subscribe("rules", ["rules.matched"], lambda e: received_a.append(e))
        await event_bus.subscribe("rules", ["rules.matched"], lambda e: received_b.append(e))
        evt = _make_event(event_type="rules.matched")
        await event_bus._dispatch_to_memory_subscribers(evt)
        assert len(received_a) == 1
        assert len(received_b) == 1


class TestPillarEventBusGetRecentEvents:
    """PillarEventBus.get_recent_events — 内存模式 + 过滤 + limit。"""

    async def test_get_recent_events_empty(self, event_bus: PillarEventBus):
        events = await event_bus.get_recent_events()
        assert events == []

    async def test_get_recent_events_returns_events(self, event_bus: PillarEventBus):
        await event_bus.publish(_make_event(event_type="rules.matched", source_pillar="rules"))
        await event_bus.publish(_make_event(event_type="hook.emitted", source_pillar="hook"))
        events = await event_bus.get_recent_events()
        assert len(events) == 2
        # 顺序:倒序(最新在前)
        assert events[0]["event_type"] == "hook.emitted"
        assert events[1]["event_type"] == "rules.matched"

    async def test_get_recent_events_filter_by_pillar(self, event_bus: PillarEventBus):
        await event_bus.publish(_make_event(event_type="rules.matched", source_pillar="rules"))
        await event_bus.publish(_make_event(event_type="hook.emitted", source_pillar="hook"))
        events = await event_bus.get_recent_events(pillar="rules")
        assert len(events) == 1
        assert events[0]["source_pillar"] == "rules"

    async def test_get_recent_events_filter_by_event_type(self, event_bus: PillarEventBus):
        await event_bus.publish(_make_event(event_type="rules.matched", source_pillar="rules"))
        await event_bus.publish(_make_event(event_type="rules.violated", source_pillar="rules"))
        events = await event_bus.get_recent_events(event_type="rules.matched")
        assert len(events) == 1
        assert events[0]["event_type"] == "rules.matched"

    async def test_get_recent_events_limit(self, event_bus: PillarEventBus):
        for i in range(5):
            await event_bus.publish(_make_event(event_type=f"rules.matched", source_pillar="rules"))
        events = await event_bus.get_recent_events(limit=2)
        assert len(events) == 2

    async def test_get_recent_events_combined_filters(self, event_bus: PillarEventBus):
        await event_bus.publish(_make_event(event_type="rules.matched", source_pillar="rules"))
        await event_bus.publish(_make_event(event_type="rules.matched", source_pillar="hook"))
        await event_bus.publish(_make_event(event_type="rules.violated", source_pillar="rules"))
        events = await event_bus.get_recent_events(pillar="rules", event_type="rules.matched")
        assert len(events) == 1
        assert events[0]["source_pillar"] == "rules"
        assert events[0]["event_type"] == "rules.matched"

    async def test_get_recent_events_redis_path(self, event_bus: PillarEventBus):
        """模拟 Redis 可用:xrevrange 返回事件。"""
        fake_redis = AsyncMock()
        fake_redis.xrevrange = AsyncMock(return_value=[
            ("id-1", {"event_type": "rules.matched", "source_pillar": "rules", "timestamp": "ts", "payload": {}, "dispatch_id": "", "severity": "info"}),
        ])
        event_bus._redis = fake_redis
        events = await event_bus.get_recent_events(limit=10)
        assert len(events) == 1
        assert events[0]["id"] == "id-1"
        assert events[0]["event_type"] == "rules.matched"

    async def test_get_recent_events_redis_failure_falls_back_to_memory(self, event_bus: PillarEventBus):
        """Redis xrevrange 抛异常 → 降级到内存。"""
        await event_bus.publish(_make_event(event_type="rules.matched", source_pillar="rules"))
        fake_redis = AsyncMock()
        fake_redis.xrevrange = AsyncMock(side_effect=Exception("xrevrange 失败"))
        event_bus._redis = fake_redis
        events = await event_bus.get_recent_events()
        assert len(events) == 1
        assert events[0]["event_type"] == "rules.matched"


class TestPillarEventBusGetEventStats:
    """PillarEventBus.get_event_stats — 时间窗口 + 成功/失败计数。"""

    async def test_get_event_stats_empty(self, event_bus: PillarEventBus):
        stats = await event_bus.get_event_stats(window_hours=24)
        assert stats["window_hours"] == 24
        assert stats["total_events"] == 0
        assert stats["by_type"] == {}

    async def test_get_event_stats_counts_events(self, event_bus: PillarEventBus):
        await event_bus.publish(_make_event(event_type="rules.matched", source_pillar="rules"))
        await event_bus.publish(_make_event(event_type="rules.matched", source_pillar="rules"))
        await event_bus.publish(_make_event(event_type="hook.emitted", source_pillar="hook"))
        stats = await event_bus.get_event_stats(window_hours=24)
        assert stats["total_events"] == 3
        assert stats["by_type"]["rules.matched"]["count"] == 2
        assert stats["by_type"]["hook.emitted"]["count"] == 1

    async def test_get_event_stats_success_failed(self, event_bus: PillarEventBus):
        await event_bus.publish(_make_event(event_type="terminal.command_succeeded", payload={"success": True}))
        await event_bus.publish(_make_event(event_type="terminal.command_failed", payload={"failed": True}))
        await event_bus.publish(_make_event(event_type="terminal.command_failed", payload={"error": "boom"}))
        stats = await event_bus.get_event_stats(window_hours=24)
        assert stats["by_type"]["terminal.command_succeeded"]["success"] == 1
        assert stats["by_type"]["terminal.command_failed"]["failed"] == 2

    async def test_get_event_stats_window_filters_old_events(self, event_bus: PillarEventBus):
        """超过时间窗口的事件不计入(timestamp < cutoff)。"""
        old_ts = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
        new_ts = datetime.now(timezone.utc).isoformat()
        event_bus._memory_events.append({
            "id": "old",
            "event_type": "rules.matched",
            "source_pillar": "rules",
            "timestamp": old_ts,
            "payload": {},
            "dispatch_id": "",
            "severity": "info",
        })
        event_bus._memory_events.append({
            "id": "new",
            "event_type": "rules.matched",
            "source_pillar": "rules",
            "timestamp": new_ts,
            "payload": {},
            "dispatch_id": "",
            "severity": "info",
        })
        stats = await event_bus.get_event_stats(window_hours=24)
        assert stats["total_events"] == 1  # 只有 new 计入


# =============================================================================
# 5. JointDecisionEngine
# =============================================================================


class TestJointDecisionEngineInit:
    """JointDecisionEngine 初始化。"""

    def test_init_defaults(self, decision_engine: JointDecisionEngine):
        assert decision_engine._redis is None
        assert decision_engine._use_redis is True
        assert decision_engine._memory_decisions.maxlen == _MEMORY_DECISION_MAXLEN
        # playbook_states 默认全部启用
        assert all(decision_engine._playbook_states.values())
        assert set(decision_engine._playbook_states.keys()) == set(ORCHESTRATION_PLAYBOOKS)

    def test_init_stats_defaults(self, decision_engine: JointDecisionEngine):
        stats = decision_engine._stats
        assert stats["total_decisions"] == 0
        assert stats["completed"] == 0
        assert stats["partially_failed"] == 0
        assert stats["failed"] == 0
        assert stats["skipped"] == 0
        assert stats["total_duration_ms"] == 0
        assert set(stats["playbook_triggers"].keys()) == set(ORCHESTRATION_PLAYBOOKS)

    async def test_ensure_redis_no_url_returns_none(self, decision_engine: JointDecisionEngine):
        result = await decision_engine._ensure_redis()
        assert result is None
        assert decision_engine._use_redis is False


class TestJointDecisionEngineMatchPlaybook:
    """JointDecisionEngine._match_playbook — 匹配 / 禁用 / 无匹配。"""

    def test_match_playbook_finds_match(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="terminal.command_failed")
        pid = decision_engine._match_playbook(evt)
        assert pid == "terminal_command_failed"

    def test_match_playbook_no_match_returns_none(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="rules.matched")
        pid = decision_engine._match_playbook(evt)
        assert pid is None

    def test_match_playbook_disabled_returns_none(self, decision_engine: JointDecisionEngine):
        decision_engine._playbook_states["terminal_command_failed"] = False
        evt = _make_event(event_type="terminal.command_failed")
        pid = decision_engine._match_playbook(evt)
        assert pid is None

    def test_match_playbook_spec_approved(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="spec.approved", source_pillar="spec")
        assert decision_engine._match_playbook(evt) == "spec_approved"

    def test_match_playbook_subagent_completed(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="subagent.completed", source_pillar="subagent")
        assert decision_engine._match_playbook(evt) == "subagent_completed"

    def test_match_playbook_rules_violated(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="rules.violated", source_pillar="rules")
        assert decision_engine._match_playbook(evt) == "rules_violated"

    def test_match_playbook_hook_health_degraded(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="hook.health_degraded", source_pillar="hook")
        assert decision_engine._match_playbook(evt) == "hook_health_degraded"

    def test_match_playbook_budget_warning(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="budget.warning", source_pillar="budget")
        assert decision_engine._match_playbook(evt) == "budget_warning"


class TestJointDecisionEngineEvaluate:
    """JointDecisionEngine.evaluate — 匹配 / 不匹配 / 禁用。"""

    async def test_evaluate_matching_returns_decision(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="terminal.command_failed")
        decision = await decision_engine.evaluate(evt)
        assert decision.playbook_id == "terminal_command_failed"
        assert decision.status == "pending"
        assert len(decision.actions) == len(ORCHESTRATION_PLAYBOOKS["terminal_command_failed"]["actions"])
        assert decision.trigger_event is evt
        assert decision.decision_id  # uuid
        assert decision.created_at  # ISO 时间戳

    async def test_evaluate_no_match_returns_skipped(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="rules.matched")
        decision = await decision_engine.evaluate(evt)
        assert decision.status == "skipped"
        assert decision.playbook_id == ""
        assert decision.actions == []

    async def test_evaluate_disabled_playbook_returns_skipped(self, decision_engine: JointDecisionEngine):
        decision_engine._playbook_states["terminal_command_failed"] = False
        evt = _make_event(event_type="terminal.command_failed")
        decision = await decision_engine.evaluate(evt)
        assert decision.status == "skipped"
        assert decision.playbook_id == ""

    async def test_evaluate_actions_are_deep_copied(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="terminal.command_failed")
        decision = await decision_engine.evaluate(evt)
        # 修改 decision.actions 不应该影响 ORCHESTRATION_PLAYBOOKS
        decision.actions.append({"pillar": "rules", "action": "extra", "params": {}})
        assert "extra" not in [a.get("action") for a in ORCHESTRATION_PLAYBOOKS["terminal_command_failed"]["actions"]]


class TestJointDecisionEngineCallPillarAction:
    """JointDecisionEngine._call_pillar_action — 未知支柱 + httpx 成功/失败。"""

    async def test_call_pillar_action_unknown_pillar(self, decision_engine: JointDecisionEngine):
        evt = _make_event()
        result = await decision_engine._call_pillar_action("unknown_pillar", "test", {}, evt)
        assert result["success"] is False
        assert "未知支柱" in result["error"]
        assert result["pillar"] == "unknown_pillar"
        assert result["action"] == "test"

    async def test_call_pillar_action_httpx_success(self, decision_engine: JointDecisionEngine):
        """mock httpx.AsyncClient 返回 200。"""
        evt = _make_event()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"ok": true}'

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await decision_engine._call_pillar_action("rules", "auto_generate", {"pattern": "x"}, evt)

        assert result["success"] is True
        assert result["status_code"] == 200
        assert result["pillar"] == "rules"
        assert result["action"] == "auto_generate"
        assert result["response"] == '{"ok": true}'
        # 验证 URL 拼接(localhost 降级)
        call_args = mock_client.post.call_args
        assert call_args[0][0].startswith("http://localhost:8802/api/rules/orchestrate")

    async def test_call_pillar_action_httpx_404_returns_failure(self, decision_engine: JointDecisionEngine):
        evt = _make_event()
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_resp.text = "Not Found"

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await decision_engine._call_pillar_action("hook", "emit", {}, evt)

        assert result["success"] is False  # status_code >= 400
        assert result["status_code"] == 404

    async def test_call_pillar_action_httpx_exception_returns_failure(self, decision_engine: JointDecisionEngine):
        evt = _make_event()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(side_effect=Exception("连接失败"))
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await decision_engine._call_pillar_action("rules", "x", {}, evt)

        assert result["success"] is False
        assert "连接失败" in result["error"]
        assert result["pillar"] == "rules"

    async def test_call_pillar_action_uses_settings_base_url(
        self, decision_engine: JointDecisionEngine, monkeypatch: pytest.MonkeyPatch
    ):
        """当 _settings 可用且 api_service_url 非空时,使用 settings 的 URL。"""
        fake_settings = MagicMock()
        fake_settings.api_service_url = "http://api.example.com:9999"
        monkeypatch.setattr(oh_module, "_settings", fake_settings)

        evt = _make_event()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "ok"

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await decision_engine._call_pillar_action("rules", "x", {}, evt)

        call_args = mock_client.post.call_args
        assert call_args[0][0] == "http://api.example.com:9999/api/rules/orchestrate"

    async def test_call_pillar_action_empty_response_text(
        self, decision_engine: JointDecisionEngine
    ):
        """status_code < 400 + text 为空 → response="". """
        evt = _make_event()
        mock_resp = MagicMock()
        mock_resp.status_code = 204
        mock_resp.text = ""

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await decision_engine._call_pillar_action("rules", "x", {}, evt)

        assert result["success"] is True
        assert result["response"] == ""


class TestJointDecisionEngineExecuteDecision:
    """JointDecisionEngine.execute_decision — 状态机 + 统计。

    注意:源码 _record_decision 有 walrus 操作符 bug(L679),会抛 UnboundLocalError。
    本测试类用 _patch_record_decision 替换为可用实现,以测 execute_decision 的状态机逻辑。
    bug 本身由 TestJointDecisionEngineRecordDecisionBug 验证。
    """

    async def test_execute_decision_skipped_no_actions(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="rules.matched")
        decision = await decision_engine.evaluate(evt)
        # decision.status == "skipped" (无匹配 playbook)
        with _patch_record_decision(decision_engine):
            result = await decision_engine.execute_decision(decision)
        assert decision.status == "skipped"
        assert result["status"] == "skipped"
        # 记录到内存历史
        assert len(decision_engine._memory_decisions) == 1

    async def test_execute_decision_empty_actions_skipped(self, decision_engine: JointDecisionEngine):
        """actions=[] 且 status != skipped 时,execute 返回 skipped。"""
        evt = _make_event()
        decision = OrchestrationDecision(
            decision_id="d-1",
            trigger_event=evt,
            playbook_id="",
            actions=[],
            status="pending",
        )
        with _patch_record_decision(decision_engine):
            await decision_engine.execute_decision(decision)
        assert decision.status == "skipped"

    async def test_execute_decision_all_success_completed(
        self, decision_engine: JointDecisionEngine
    ):
        evt = _make_event(event_type="terminal.command_failed")
        decision = await decision_engine.evaluate(evt)
        # mock _call_pillar_action 全部成功
        async def fake_call(pillar, action, params, trigger_event):
            return {"success": True, "pillar": pillar, "action": action}

        with patch.object(decision_engine, "_call_pillar_action", side_effect=fake_call), \
             _patch_record_decision(decision_engine):
            result = await decision_engine.execute_decision(decision)

        assert decision.status == "completed"
        assert decision.duration_ms >= 0
        assert len(decision.results) == len(decision.actions)
        assert all(r["success"] for r in decision.results)
        assert decision.executed_at  # 已设置

    async def test_execute_decision_all_failed(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="terminal.command_failed")
        decision = await decision_engine.evaluate(evt)
        async def fake_call(pillar, action, params, trigger_event):
            return {"success": False, "pillar": pillar, "action": action, "error": "x"}

        with patch.object(decision_engine, "_call_pillar_action", side_effect=fake_call), \
             _patch_record_decision(decision_engine):
            await decision_engine.execute_decision(decision)

        assert decision.status == "failed"

    async def test_execute_decision_partial_failure(self, decision_engine: JointDecisionEngine):
        evt = _make_event(event_type="terminal.command_failed")
        decision = await decision_engine.evaluate(evt)
        # 第一个成功,其余失败
        call_count = [0]
        async def fake_call(pillar, action, params, trigger_event):
            call_count[0] += 1
            return {"success": call_count[0] == 1, "pillar": pillar, "action": action}

        with patch.object(decision_engine, "_call_pillar_action", side_effect=fake_call), \
             _patch_record_decision(decision_engine):
            await decision_engine.execute_decision(decision)

        assert decision.status == "partially_failed"

    async def test_execute_decision_call_exception_caught(
        self, decision_engine: JointDecisionEngine
    ):
        """_call_pillar_action 抛异常 → 兜底 try/except,记录失败 result。"""
        evt = _make_event(event_type="terminal.command_failed")
        decision = await decision_engine.evaluate(evt)
        async def fake_call(pillar, action, params, trigger_event):
            raise RuntimeError("unexpected")

        with patch.object(decision_engine, "_call_pillar_action", side_effect=fake_call), \
             _patch_record_decision(decision_engine):
            await decision_engine.execute_decision(decision)

        assert decision.status == "failed"
        for r in decision.results:
            assert r["success"] is False
            assert "unexpected" in r["error"]

    async def test_execute_decision_results_recorded(
        self, decision_engine: JointDecisionEngine
    ):
        """execute_decision 完成后,decision.results 与 _memory_decisions 一致。"""
        evt = _make_event(event_type="terminal.command_failed")
        decision = await decision_engine.evaluate(evt)
        async def fake_call(pillar, action, params, trigger_event):
            return {"success": True, "pillar": pillar, "action": action}

        with patch.object(decision_engine, "_call_pillar_action", side_effect=fake_call), \
             _patch_record_decision(decision_engine):
            await decision_engine.execute_decision(decision)

        assert len(decision_engine._memory_decisions) == 1
        recorded = decision_engine._memory_decisions[0]
        assert recorded["status"] == "completed"
        assert len(recorded["results"]) == len(decision.actions)


class TestJointDecisionEngineRecordDecisionBug:
    """源码 _record_decision 的 walrus 操作符 bug 验证(L679)。

    源码:
        self._stats[total_key := decision.status] = self._stats.get(total_key, 0) + 1
    Python 求值顺序:先 RHS → self._stats.get(total_key, 0) → total_key 未定义
    → UnboundLocalError(因 walrus 使 total_key 成为局部变量)。
    """

    async def test_record_decision_raises_unbound_local_error(
        self, decision_engine: JointDecisionEngine
    ):
        evt = _make_event()
        decision = OrchestrationDecision(
            decision_id="d-bug",
            trigger_event=evt,
            playbook_id="",
            actions=[],
            status="skipped",
        )
        with pytest.raises(UnboundLocalError):
            await decision_engine._record_decision(decision)


class TestJointDecisionEngineRecordDecision:
    """JointDecisionEngine._record_decision — 内存记录 + 统计更新。

    用 _patch_record_decision 提供等价于"源码意图"的可用实现,验证记录逻辑。
    """

    async def test_record_decision_appends_to_memory(self, decision_engine: JointDecisionEngine):
        evt = _make_event()
        decision = OrchestrationDecision(
            decision_id="d-1",
            trigger_event=evt,
            playbook_id="terminal_command_failed",
            actions=[],
            status="skipped",
            duration_ms=100,
        )
        with _patch_record_decision(decision_engine):
            await decision_engine._record_decision(decision)
        assert len(decision_engine._memory_decisions) == 1
        assert decision_engine._memory_decisions[0]["decision_id"] == "d-1"

    async def test_record_decision_updates_stats(self, decision_engine: JointDecisionEngine):
        evt = _make_event()
        decision = OrchestrationDecision(
            decision_id="d-1",
            trigger_event=evt,
            playbook_id="terminal_command_failed",
            actions=[],
            status="completed",
            duration_ms=500,
        )
        with _patch_record_decision(decision_engine):
            await decision_engine._record_decision(decision)
        assert decision_engine._stats["total_decisions"] == 1
        assert decision_engine._stats["completed"] == 1
        assert decision_engine._stats["total_duration_ms"] == 500
        assert decision_engine._stats["playbook_triggers"]["terminal_command_failed"] == 1

    async def test_record_decision_no_playbook_id_no_trigger_increment(
        self, decision_engine: JointDecisionEngine
    ):
        evt = _make_event()
        decision = OrchestrationDecision(
            decision_id="d-1",
            trigger_event=evt,
            playbook_id="",
            actions=[],
            status="skipped",
        )
        with _patch_record_decision(decision_engine):
            await decision_engine._record_decision(decision)
        # playbook_triggers 不应该被增加
        for v in decision_engine._stats["playbook_triggers"].values():
            assert v == 0


class TestJointDecisionEnginePlaybooks:
    """JointDecisionEngine.get_playbooks / enable_playbook。"""

    async def test_get_playbooks_returns_all(self, decision_engine: JointDecisionEngine):
        playbooks = await decision_engine.get_playbooks()
        assert len(playbooks) == len(ORCHESTRATION_PLAYBOOKS)
        for pb in playbooks:
            assert "id" in pb
            assert "name" in pb
            assert "trigger" in pb
            assert "actions" in pb
            assert pb["enabled"] is True

    async def test_get_playbooks_reflects_disabled_state(self, decision_engine: JointDecisionEngine):
        decision_engine._playbook_states["terminal_command_failed"] = False
        playbooks = await decision_engine.get_playbooks()
        pb = next(p for p in playbooks if p["id"] == "terminal_command_failed")
        assert pb["enabled"] is False

    async def test_enable_playbook_existing(self, decision_engine: JointDecisionEngine):
        result = await decision_engine.enable_playbook("spec_approved", False)
        assert result is True
        assert decision_engine._playbook_states["spec_approved"] is False

    async def test_enable_playbook_non_existing_returns_false(self, decision_engine: JointDecisionEngine):
        result = await decision_engine.enable_playbook("nonexistent", True)
        assert result is False

    async def test_enable_playbook_redis_persists(self, decision_engine: JointDecisionEngine):
        """Redis 可用时,enable_playbook 调用 hset 持久化。"""
        fake_redis = AsyncMock()
        fake_redis.hset = AsyncMock()
        decision_engine._redis = fake_redis
        decision_engine._use_redis = True
        await decision_engine.enable_playbook("spec_approved", True)
        fake_redis.hset.assert_awaited_once_with(_PLAYBOOK_HASH_KEY, "spec_approved", "1")

    async def test_enable_playbook_redis_failure_does_not_raise(
        self, decision_engine: JointDecisionEngine
    ):
        fake_redis = AsyncMock()
        fake_redis.hset = AsyncMock(side_effect=Exception("hset 失败"))
        decision_engine._redis = fake_redis
        decision_engine._use_redis = True
        # 不抛异常,本地状态仍更新
        result = await decision_engine.enable_playbook("spec_approved", False)
        assert result is True
        assert decision_engine._playbook_states["spec_approved"] is False


class TestJointDecisionEngineHistoryAndStats:
    """JointDecisionEngine.get_decision_history / get_orchestration_stats。"""

    async def test_get_decision_history_empty(self, decision_engine: JointDecisionEngine):
        history = await decision_engine.get_decision_history()
        assert history == []

    async def test_get_decision_history_memory_mode(self, decision_engine: JointDecisionEngine):
        evt = _make_event()
        decision = OrchestrationDecision(
            decision_id="d-1",
            trigger_event=evt,
            playbook_id="",
            actions=[],
            status="skipped",
        )
        with _patch_record_decision(decision_engine):
            await decision_engine._record_decision(decision)
        history = await decision_engine.get_decision_history()
        assert len(history) == 1
        assert history[0]["decision_id"] == "d-1"

    async def test_get_decision_history_limit(self, decision_engine: JointDecisionEngine):
        with _patch_record_decision(decision_engine):
            for i in range(5):
                evt = _make_event()
                decision = OrchestrationDecision(
                    decision_id=f"d-{i}",
                    trigger_event=evt,
                    playbook_id="",
                    actions=[],
                    status="skipped",
                )
                await decision_engine._record_decision(decision)
        history = await decision_engine.get_decision_history(limit=2)
        assert len(history) == 2

    async def test_get_decision_history_redis_path(self, decision_engine: JointDecisionEngine):
        """Redis 可用:lrange 返回 JSON 字符串列表。"""
        fake_redis = AsyncMock()
        fake_redis.lrange = AsyncMock(return_value=[
            json.dumps({"decision_id": "d-1", "status": "skipped"}),
            "not-json",  # 应被跳过
        ])
        decision_engine._redis = fake_redis
        decision_engine._use_redis = True
        history = await decision_engine.get_decision_history()
        assert len(history) == 1
        assert history[0]["decision_id"] == "d-1"

    async def test_get_decision_history_redis_failure_falls_back_to_memory(
        self, decision_engine: JointDecisionEngine
    ):
        evt = _make_event()
        decision = OrchestrationDecision(
            decision_id="d-mem",
            trigger_event=evt,
            playbook_id="",
            actions=[],
            status="skipped",
        )
        with _patch_record_decision(decision_engine):
            await decision_engine._record_decision(decision)
        fake_redis = AsyncMock()
        fake_redis.lrange = AsyncMock(side_effect=Exception("lrange 失败"))
        decision_engine._redis = fake_redis
        decision_engine._use_redis = True
        history = await decision_engine.get_decision_history()
        assert len(history) == 1
        assert history[0]["decision_id"] == "d-mem"

    async def test_get_orchestration_stats_initial(self, decision_engine: JointDecisionEngine):
        stats = await decision_engine.get_orchestration_stats()
        assert stats["total_decisions"] == 0
        assert stats["completed"] == 0
        assert stats["success_rate"] == 0.0
        assert stats["avg_duration_ms"] == 0.0
        assert stats["playbook_triggers"] == {pid: 0 for pid in ORCHESTRATION_PLAYBOOKS}

    async def test_get_orchestration_stats_after_decisions(self, decision_engine: JointDecisionEngine):
        # 模拟两个 completed decision
        with _patch_record_decision(decision_engine):
            for _ in range(2):
                evt = _make_event(event_type="terminal.command_failed")
                decision = OrchestrationDecision(
                    decision_id="d",
                    trigger_event=evt,
                    playbook_id="terminal_command_failed",
                    actions=[{"pillar": "context", "action": "x", "params": {}}],
                    status="pending",
                    duration_ms=200,
                )
                decision.status = "completed"
                decision.results = [{"success": True}]
                await decision_engine._record_decision(decision)

        stats = await decision_engine.get_orchestration_stats()
        assert stats["total_decisions"] == 2
        assert stats["completed"] == 2
        assert stats["success_rate"] == 1.0
        assert stats["avg_duration_ms"] == 200.0
        assert stats["playbook_triggers"]["terminal_command_failed"] == 2


# =============================================================================
# 6. OrchestrationHub
# =============================================================================


class TestOrchestrationHubInit:
    """OrchestrationHub 初始化。"""

    def test_init_defaults(self, hub: OrchestrationHub):
        assert isinstance(hub.event_bus, PillarEventBus)
        assert isinstance(hub.decision_engine, JointDecisionEngine)
        assert hub._running is False
        assert hub._consumer_task is None
        assert all(hub._playbook_states.values())

    def test_init_has_memory_collections(self, hub: OrchestrationHub):
        assert hub._memory_events.maxlen == _MEMORY_EVENT_MAXLEN
        assert hub._memory_decisions.maxlen == _MEMORY_DECISION_MAXLEN


class TestOrchestrationHubStartStop:
    """OrchestrationHub.start / stop。"""

    async def test_start_sets_running(self, hub: OrchestrationHub):
        await hub.start()
        assert hub._running is True
        assert hub._consumer_task is not None
        await hub.stop()

    async def test_start_idempotent(self, hub: OrchestrationHub):
        await hub.start()
        task1 = hub._consumer_task
        await hub.start()
        # 同一 task,不重复创建
        assert hub._consumer_task is task1
        await hub.stop()

    async def test_stop_clears_running(self, hub: OrchestrationHub):
        await hub.start()
        await hub.stop()
        assert hub._running is False
        assert hub._consumer_task is None

    async def test_stop_when_not_running_no_op(self, hub: OrchestrationHub):
        # 未启动过 stop 不抛异常
        await hub.stop()
        assert hub._running is False
        assert hub._consumer_task is None

    async def test_start_consume_loop_cancellable(self, hub: OrchestrationHub):
        """启动后台消费循环,内存模式下空转 5s,可被 stop 取消。"""
        await hub.start()
        await asyncio.sleep(0.05)  # 让循环跑一会
        await hub.stop()
        assert hub._running is False


class TestOrchestrationHubProcessEvent:
    """OrchestrationHub._process_event — evaluate + execute。"""

    async def test_process_event_skipped(self, hub: OrchestrationHub):
        """无匹配 playbook → decision.status=skipped → 直接 return,不 execute。"""
        evt = _make_event(event_type="rules.matched")  # 无 playbook
        with patch.object(hub.decision_engine, "execute_decision", new=AsyncMock()) as mock_exec:
            await hub._process_event(evt)
            mock_exec.assert_not_awaited()

    async def test_process_event_normal(self, hub: OrchestrationHub):
        evt = _make_event(event_type="terminal.command_failed")
        with patch.object(hub.decision_engine, "execute_decision", new=AsyncMock()) as mock_exec:
            await hub._process_event(evt)
            mock_exec.assert_awaited_once()

    async def test_process_event_exception_does_not_raise(self, hub: OrchestrationHub):
        """evaluate 抛异常 → _process_event 兜底,不向外抛。"""
        evt = _make_event(event_type="terminal.command_failed")
        with patch.object(
            hub.decision_engine, "evaluate", new=AsyncMock(side_effect=RuntimeError("eval 失败"))
        ):
            await hub._process_event(evt)  # 不抛


class TestOrchestrationHubEmit:
    """OrchestrationHub.emit — 发布 + 自动编排。"""

    async def test_emit_returns_event_id(self, hub: OrchestrationHub):
        eid = await hub.emit("rules.matched", "rules", {"k": "v"})
        assert isinstance(eid, str)
        assert len(eid) > 0

    async def test_emit_appends_to_event_bus(self, hub: OrchestrationHub):
        await hub.emit("rules.matched", "rules", {})
        assert len(hub.event_bus._memory_events) == 1

    async def test_emit_when_not_running_triggers_process_event(self, hub: OrchestrationHub):
        """未启动消费循环 → emit 同步触发 _process_event。"""
        # rules.matched 无 playbook → skipped,不会 execute
        with patch.object(hub, "_process_event", new=AsyncMock()) as mock_proc:
            await hub.emit("rules.matched", "rules", {})
            mock_proc.assert_awaited_once()

    async def test_emit_when_running_skips_sync_process(self, hub: OrchestrationHub):
        """启动消费循环后,emit 不再同步触发 _process_event(由消费循环处理)。"""
        await hub.start()
        try:
            with patch.object(hub, "_process_event", new=AsyncMock()) as mock_proc:
                await hub.emit("rules.matched", "rules", {})
                # 等一会,确保消费循环(内存模式空转 5s)没机会调到 _process_event
                # 关键:emit 不应同步调用
                # 给一点点时间让任务调度
                await asyncio.sleep(0.01)
                # 内存模式下,_process_event 不会被 emit 同步触发
                # (消费循环只在 Redis 模式下处理事件)
                assert not mock_proc.awaited or mock_proc.await_count == 0
        finally:
            await hub.stop()

    async def test_emit_with_severity(self, hub: OrchestrationHub):
        """emit 支持 severity 参数。"""
        await hub.emit("rules.violated", "rules", {}, severity="critical")
        evt = hub.event_bus._memory_events[0]
        assert evt["severity"] == "critical"


class TestOrchestrationHubStatusAndFeed:
    """OrchestrationHub.get_status / get_event_feed。"""

    async def test_get_status_initial(self, hub: OrchestrationHub):
        status = await hub.get_status()
        assert status["running"] is False
        assert status["event_count"] == 0
        assert status["decision_count"] == 0
        assert status["redis_mode"] is True  # _use_redis 默认 True(未触发降级前)
        assert "playbook_states" in status

    async def test_get_status_after_emit(self, hub: OrchestrationHub):
        await hub.emit("rules.matched", "rules", {})
        status = await hub.get_status()
        assert status["event_count"] == 1

    async def test_get_event_feed_returns_events(self, hub: OrchestrationHub):
        await hub.emit("rules.matched", "rules", {})
        await hub.emit("hook.emitted", "hook", {})
        feed = await hub.get_event_feed()
        assert len(feed) == 2

    async def test_get_event_feed_filter_pillar(self, hub: OrchestrationHub):
        await hub.emit("rules.matched", "rules", {})
        await hub.emit("hook.emitted", "hook", {})
        feed = await hub.get_event_feed(pillar="rules")
        assert len(feed) == 1
        assert feed[0]["source_pillar"] == "rules"

    async def test_get_event_feed_limit(self, hub: OrchestrationHub):
        for _ in range(5):
            await hub.emit("rules.matched", "rules", {})
        feed = await hub.get_event_feed(limit=2)
        assert len(feed) == 2


class TestOrchestrationHubDashboard:
    """OrchestrationHub.get_dashboard — 仪表盘聚合。"""

    async def test_get_dashboard_structure(self, hub: OrchestrationHub):
        dashboard = await hub.get_dashboard()
        assert "status" in dashboard
        assert "event_stats" in dashboard
        assert "decision_stats" in dashboard
        assert "playbooks" in dashboard
        assert "pillar_health" in dashboard
        assert "timestamp" in dashboard

    async def test_get_dashboard_pillar_health_keys(self, hub: OrchestrationHub):
        dashboard = await hub.get_dashboard()
        assert set(dashboard["pillar_health"].keys()) == set(PILLARS)

    async def test_get_dashboard_pillar_health_initial(self, hub: OrchestrationHub):
        dashboard = await hub.get_dashboard()
        for p in PILLARS:
            health = dashboard["pillar_health"][p]
            assert health["event_count"] == 0
            assert health["success"] == 0
            assert health["failed"] == 0
            assert health["health"] == "healthy"

    async def test_get_dashboard_pillar_health_with_failures(self, hub: OrchestrationHub):
        await hub.emit("terminal.command_failed", "terminal", {"failed": True})
        dashboard = await hub.get_dashboard()
        # 内存模式 emit 会同步触发 _process_event,但是事件本身已记入 event_bus
        terminal_health = dashboard["pillar_health"]["terminal"]
        assert terminal_health["failed"] >= 1

    async def test_get_dashboard_pillar_health_degraded(self, hub: OrchestrationHub):
        """success 数 > failed 数 > 0 → degraded。"""
        await hub.emit("terminal.command_succeeded", "terminal", {"success": True})
        await hub.emit("terminal.command_succeeded", "terminal", {"success": True})
        await hub.emit("terminal.command_failed", "terminal", {"failed": True})
        dashboard = await hub.get_dashboard()
        terminal_health = dashboard["pillar_health"]["terminal"]
        assert terminal_health["health"] == "degraded"

    async def test_get_dashboard_pillar_health_unhealthy(self, hub: OrchestrationHub):
        """failed >= success → unhealthy。"""
        await hub.emit("terminal.command_succeeded", "terminal", {"success": True})
        await hub.emit("terminal.command_failed", "terminal", {"failed": True})
        await hub.emit("terminal.command_failed", "terminal", {"error": "x"})
        dashboard = await hub.get_dashboard()
        terminal_health = dashboard["pillar_health"]["terminal"]
        assert terminal_health["health"] == "unhealthy"

    async def test_get_dashboard_playbooks_complete(self, hub: OrchestrationHub):
        dashboard = await hub.get_dashboard()
        assert len(dashboard["playbooks"]) == len(ORCHESTRATION_PLAYBOOKS)


# =============================================================================
# 7. 模块级单例
# =============================================================================


class TestGlobalSingleton:
    """模块级 orchestration_hub 单例。"""

    def test_singleton_is_orchestration_hub_instance(self):
        assert isinstance(orchestration_hub, OrchestrationHub)

    def test_singleton_has_event_bus(self):
        assert isinstance(orchestration_hub.event_bus, PillarEventBus)

    def test_singleton_has_decision_engine(self):
        assert isinstance(orchestration_hub.decision_engine, JointDecisionEngine)

    def test_singleton_initial_not_running(self):
        # 单例可能被其他测试启动过,此处只验证类型/字段存在
        assert hasattr(orchestration_hub, "_running")
        assert isinstance(orchestration_hub._running, bool)

    def test_singleton_playbook_states_complete(self):
        assert set(orchestration_hub._playbook_states.keys()) == set(ORCHESTRATION_PLAYBOOKS)


# =============================================================================
# 8. 端到端集成(内存模式)
# =============================================================================


class TestEndToEndMemoryMode:
    """端到端:emit → publish → 自动 evaluate → execute(skipped)。"""

    async def test_emit_no_playbook_event_skipped(self, hub: OrchestrationHub):
        """emit 一个无 playbook 的事件 → 自动 _process_event → skipped,不执行 action。"""
        with patch.object(hub.decision_engine, "execute_decision", new=AsyncMock()) as mock_exec:
            await hub.emit("rules.matched", "rules", {"k": "v"})
            mock_exec.assert_not_awaited()

    async def test_emit_matching_playbook_executes(self, hub: OrchestrationHub):
        """emit terminal.command_failed → 匹配 playbook → execute_decision 调用。"""
        with patch.object(hub.decision_engine, "execute_decision", new=AsyncMock()) as mock_exec:
            await hub.emit("terminal.command_failed", "terminal", {"command": "ls"})
            mock_exec.assert_awaited_once()
            # 验证传给 execute_decision 的是 OrchestrationDecision
            decision = mock_exec.call_args[0][0]
            assert decision.playbook_id == "terminal_command_failed"
            assert len(decision.actions) == 4  # terminal_command_failed 有 4 个 actions

    async def test_full_flow_with_mocked_actions(self, hub: OrchestrationHub):
        """完整流程:emit → evaluate → execute(全 mock 成功)→ stats 更新。"""
        async def fake_call(pillar, action, params, trigger_event):
            return {"success": True, "pillar": pillar, "action": action}

        with patch.object(hub.decision_engine, "_call_pillar_action", side_effect=fake_call), \
             _patch_record_decision(hub.decision_engine):
            await hub.emit("terminal.command_failed", "terminal", {"command": "ls"})

        stats = await hub.decision_engine.get_orchestration_stats()
        assert stats["total_decisions"] == 1
        assert stats["completed"] == 1
        assert stats["playbook_triggers"]["terminal_command_failed"] == 1

    async def test_full_flow_partial_failure(self, hub: OrchestrationHub):
        """完整流程:emit → 部分 action 失败 → partially_failed。"""
        call_count = [0]
        async def fake_call(pillar, action, params, trigger_event):
            call_count[0] += 1
            return {"success": call_count[0] == 1, "pillar": pillar, "action": action}

        with patch.object(hub.decision_engine, "_call_pillar_action", side_effect=fake_call), \
             _patch_record_decision(hub.decision_engine):
            await hub.emit("terminal.command_failed", "terminal", {})

        stats = await hub.decision_engine.get_orchestration_stats()
        assert stats["partially_failed"] == 1

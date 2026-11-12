"""AIS-020 回归:thread.export 的 truncateAfterTurnId 不得把目标回合切成首条。

修前判据是"turn_id 是否非空",而导出记录**每条 item 都带 turn_id 信封字段** ——
截断原语找到目标回合首项后,下一项(同回合第二条)就被当成下一个 TurnStarted,
`cut` 落在首项之后,导出只剩目标回合的第一条,tool_call/tool_result 因此被拆散。

本文件钉住:
- 原语层:规范 TurnStarted = 回合首项(连续同 turn_id 的后续项不是边界);
- 引擎层:开关 on + truncateAfterTurnId 时,导出保留到**整个目标回合结束**;
- 开关 off / 不带 truncateAfterTurnId:导出逐字节保持全量(不误伤);
- 目标 turn 不存在 / 进行中:维持既有拒绝语义(ValueError → 引擎降级导出全量并告警)。
"""

from __future__ import annotations

import json
from typing import Any

import pytest

from app.core.rollout_truncation import truncate_after_turn_id, turn_start_positions
from app.services.agent_engine import AgentEngine, EngineThread


def _record(item_type: str, turn_id: str | None, seq: int) -> dict[str, Any]:
    """导出记录的形制:信封字段 turn_id 每一条都有(这正是修前的陷阱)。"""
    return {
        "seq": seq,
        "thread_id": "thr_1",
        "turn_id": turn_id,
        "parent_seq": None,
        "created_at": 1.0,
        "client_item_id": None,
        "item_type": item_type,
    }


# t1 = user + assistant(同回合两条),t2 = 另一个回合
_RECORDS = [
    _record("user_message", "t1", 1),
    _record("assistant_message", "t1", 2),
    _record("user_message", "t2", 3),
    _record("assistant_message", "t2", 4),
]


def _turn_id_of(record: object) -> str | None:
    return record.get("turn_id") if isinstance(record, dict) else None


class TestPrimitiveBoundaries:
    def test_consecutive_same_turn_yields_single_boundary(self):
        """同回合多条只有首项是边界 —— 修前 positions 会是 [0,1,2,3]。"""
        assert turn_start_positions(_RECORDS, _turn_id_of) == [0, 2]

    def test_truncation_keeps_whole_turn(self):
        cut = truncate_after_turn_id(_RECORDS, "t1", _turn_id_of)
        assert [r["seq"] for r in cut] == [1, 2]

    def test_truncation_on_last_turn_keeps_everything(self):
        cut = truncate_after_turn_id(_RECORDS, "t2", _turn_id_of)
        assert [r["seq"] for r in cut] == [1, 2, 3, 4]

    def test_unknown_turn_still_rejected(self):
        with pytest.raises(ValueError):
            truncate_after_turn_id(_RECORDS, "nope", _turn_id_of)

    def test_in_progress_turn_still_rejected(self):
        with pytest.raises(ValueError):
            truncate_after_turn_id(
                _RECORDS, "t1", _turn_id_of, turn_status=lambda _t: "in_progress"
            )

    def test_records_without_turn_id_are_not_boundaries(self):
        """无信封 turn_id 的记录(内存回退导出的形态)不制造边界。"""
        records = [{"type": "message", "role": "user"}, {"type": "message", "role": "assistant"}]
        assert turn_start_positions(records, _turn_id_of) == []


class _FakeItem:
    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload

    def model_dump(self, mode: str = "python") -> dict[str, Any]:
        del mode
        return dict(self._payload)


class _FakeStore:
    """只实现导出用到的 list_items —— 不连真库(本票不验持久层)。"""

    def __init__(self, payloads: list[dict[str, Any]]) -> None:
        self._payloads = payloads

    def list_items(self, thread_id: str) -> list[_FakeItem]:
        del thread_id
        return [_FakeItem(p) for p in self._payloads]


def _engine_with_store(payloads: list[dict[str, Any]]) -> AgentEngine:
    async def _loop_factory(**_kwargs: Any) -> Any:  # pragma: no cover - 导出不跑 loop
        raise AssertionError("thread.export 不应创建 loop")

    engine = AgentEngine(_loop_factory, store=_FakeStore(payloads))  # type: ignore[arg-type]
    thread = EngineThread(
        thread_id="thr_1",
        session_id="sess_1",
        model=None,
        permission_mode="default",
        max_iterations=10,
        tool_names=None,
        workspace=None,
        user_id=None,
        conversation_id=None,
        messages=[],
    )
    engine._threads[thread.thread_id] = thread
    return engine


async def _export(engine: AgentEngine, params: dict[str, Any]) -> list[dict[str, Any]]:
    resp = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 1, "method": "thread.export", "params": params}
    )
    assert resp is not None
    assert "result" in resp, resp
    return [json.loads(line) for line in resp["result"]["lines"]]


class TestEngineExport:
    async def test_export_truncated_at_turn_keeps_whole_turn(self, monkeypatch):
        """开关 on + 指定 t1 ⇒ 只剩 t1 的两条(修前只剩 seq=1)。"""
        monkeypatch.setenv("ENGINE_ROLLOUT_TRUNCATION_ENABLED", "on")
        engine = _engine_with_store(_RECORDS)
        records = await _export(engine, {"threadId": "thr_1", "truncateAfterTurnId": "t1"})
        assert [r["seq"] for r in records] == [1, 2]

    async def test_export_without_param_keeps_everything(self, monkeypatch):
        """不带 truncateAfterTurnId ⇒ 全量导出,不误伤。"""
        monkeypatch.setenv("ENGINE_ROLLOUT_TRUNCATION_ENABLED", "on")
        engine = _engine_with_store(_RECORDS)
        records = await _export(engine, {"threadId": "thr_1"})
        assert [r["seq"] for r in records] == [1, 2, 3, 4]

    async def test_export_switch_off_ignores_param(self, monkeypatch):
        """开关 off ⇒ 参数被忽略,导出全量(既有语义)。"""
        monkeypatch.setenv("ENGINE_ROLLOUT_TRUNCATION_ENABLED", "off")
        engine = _engine_with_store(_RECORDS)
        records = await _export(engine, {"threadId": "thr_1", "truncateAfterTurnId": "t1"})
        assert [r["seq"] for r in records] == [1, 2, 3, 4]

    async def test_export_unknown_turn_degrades_to_full_export(self, monkeypatch):
        """目标 turn 不存在 ⇒ 既有降级:导出全量并告警,不静默丢内容。"""
        monkeypatch.setenv("ENGINE_ROLLOUT_TRUNCATION_ENABLED", "on")
        engine = _engine_with_store(_RECORDS)
        records = await _export(engine, {"threadId": "thr_1", "truncateAfterTurnId": "nope"})
        assert [r["seq"] for r in records] == [1, 2, 3, 4]

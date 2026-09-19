# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Harness 压缩摘要模型兼容性(2026-09-19 第十八批)单测。

对标 Codex history::CompactionCheckpoint:
- 压缩边界记录生成摘要的模型(model 字段)
- 换模型后旧摘要判定不兼容(语义漂移风险),resume 时发 compaction 钩子事件
  并在回执带 compactionModelMismatch;客户端可用 recompactIfModelChanged
  触发就地重压缩
- 兼容判定保守:任一侧模型缺失(旧数据/未知)一律视为兼容,不阻断 resume
"""

from typing import Any

import pytest

from app.services.agent_engine import (
    AgentEngine,
    _compaction_compatible,
    _model_hash,
)


# =============================================================================
# 夹具(与既有 harness 批次同构的最小替身)
# =============================================================================


class _FakeLoop:
    async def run(self, messages: list[dict[str, Any]]) -> Any:
        return _SimpleResult()

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        return _SimpleResult()

    async def interrupt(self, mode: str = "cancel") -> Any:
        return None


class _SimpleResult:
    success = True
    stop_reason = "end_turn"
    final_response = "done"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 123
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


def _engine(**kwargs: Any):
    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        return _FakeLoop()

    return AgentEngine(loop_factory=factory, **kwargs)


@pytest.fixture(autouse=True)
def _mock_env(monkeypatch):
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")
    yield {}


class _FakeStore:
    """最小持久层替身:记录 compact 调用,可注入既有边界条目。"""

    def __init__(self, existing: list[Any] | None = None) -> None:
        self.compacted: list[tuple[str, Any]] = []
        self._items: list[Any] = list(existing or [])

    def compact(self, thread_id: str, item: Any) -> None:
        self.compacted.append((thread_id, item))
        self._items.append(item)

    def list_items(self, thread_id: str) -> list[Any]:
        return list(self._items)


class _Boundary:
    def __init__(self, model: str = "", summary: str = "s") -> None:
        self.item_type = "compaction_boundary"
        self.model = model
        self.summary = summary


# =============================================================================
# 兼容性判定(纯函数)
# =============================================================================


def test_model_hash_stable_and_normalized():
    assert _model_hash("gpt-4o") == _model_hash("GPT-4O ")
    assert len(_model_hash("gpt-4o")) == 16
    assert _model_hash(None) == ""
    assert _model_hash("") == ""


def test_compaction_compatible_matrix():
    # 任一侧缺失 → 保守兼容(旧数据/未知模型不阻断 resume)
    assert _compaction_compatible("", "gpt-4o") is True
    assert _compaction_compatible("gpt-4o", "") is True
    assert _compaction_compatible(None, "gpt-4o") is True
    # 同模型(大小写/空白归一)兼容
    assert _compaction_compatible("gpt-4o", "gpt-4o") is True
    assert _compaction_compatible("GPT-4O", " gpt-4o") is True
    # 换模型 → 不兼容(摘要语义漂移)
    assert _compaction_compatible("gpt-4o", "claude-sonnet") is False
    assert _compaction_compatible("gpt-4o", "gpt-4o-2024-11-20") is False


# =============================================================================
# 边界持久化与检测
# =============================================================================


def _mk_thread(engine: AgentEngine) -> Any:
    return engine._threads[next(iter(engine._threads))]


async def test_persist_compaction_boundary_records_model():
    engine = _engine()
    store = _FakeStore()
    engine._persistence_store = lambda: store  # type: ignore[method-assign]
    engine._threads.clear()
    thread = type(
        "T",
        (),
        {"thread_id": "thr_x", "model": "gpt-4o"},
    )()
    engine._persist_compaction_boundary(
        thread,
        {"summary": "压缩摘要", "original_tokens": 900, "compressed_tokens": 120},
    )
    assert store.compacted, "边界未落库"
    _, item = store.compacted[0]
    assert item.model == "gpt-4o"
    assert item.summary == "压缩摘要"


async def test_mismatch_detected_on_model_change():
    engine = _engine()
    store = _FakeStore(existing=[_Boundary(model="gpt-4o")])
    engine._persistence_store = lambda: store  # type: ignore[method-assign]
    engine._threads.clear()
    thread = type("T", (), {"thread_id": "thr_y", "model": "claude-sonnet"})()
    mismatch = await engine._compaction_model_mismatch(thread)
    assert mismatch == {"summaryModel": "gpt-4o", "currentModel": "claude-sonnet"}

    # 同模型 → None
    thread.model = "gpt-4o"
    assert await engine._compaction_model_mismatch(thread) is None

    # 旧数据无 model 字段 → 兼容(保守)
    thread.model = "claude-sonnet"
    store._items = [_Boundary(model="")]
    assert await engine._compaction_model_mismatch(thread) is None

    # 无持久层 → None(不阻断)
    engine._persistence_store = lambda: None  # type: ignore[method-assign]
    assert await engine._compaction_model_mismatch(thread) is None


async def test_latest_boundary_wins():
    engine = _engine()
    store = _FakeStore(existing=[_Boundary(model="model-a"), _Boundary(model="model-b")])
    engine._persistence_store = lambda: store  # type: ignore[method-assign]
    engine._threads.clear()
    thread = type("T", (), {"thread_id": "thr_z", "model": "model-c"})()
    mismatch = await engine._compaction_model_mismatch(thread)
    assert mismatch is not None and mismatch["summaryModel"] == "model-b"


# =============================================================================
# resume 接线(事件发射 + 回执标记 + 可选重压缩)
# =============================================================================


class _HookBus:
    def __init__(self) -> None:
        self.emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(self, event: str, context: dict[str, Any]) -> list[dict[str, Any]]:
        self.emitted.append((event, context))
        return []


async def test_resume_flags_mismatch_and_emits_hook(monkeypatch):
    engine = _engine()
    store = _FakeStore(existing=[_Boundary(model="gpt-4o")])
    engine._persistence_store = lambda: store  # type: ignore[method-assign]
    engine._threads.clear()
    bus = _HookBus()
    engine._hook_bus = lambda: bus  # type: ignore[method-assign]
    engine._threads["thr_m"] = type(
        "T",
        (),
        {
            "thread_id": "thr_m",
            "model": "claude-sonnet",
            "status": "idle",
            "checkpoint_id": None,
            "frozen_context": None,
            "messages": [],
        },
    )()
    # 跳过真实执行(thread.state 校验之后的 _run_thread 用最小替身结果)
    async def _fake_run(thread: Any, emit: Any, from_checkpoint: Any = None) -> dict[str, Any]:
        return {"success": True}

    engine._run_thread = _fake_run  # type: ignore[method-assign]

    async def _noop_emit(message: dict[str, Any]) -> None:
        return None

    result = await engine._handle_thread_resume(
        {"threadId": "thr_m", "checkpointId": "cp-1"}, _noop_emit
    )
    assert result.get("compactionModelMismatch") == {
        "summaryModel": "gpt-4o",
        "currentModel": "claude-sonnet",
    }
    hook_events = [e for e, _ in bus.emitted]
    assert "compaction" in hook_events
    payload = next(p for e, p in bus.emitted if e == "compaction")
    assert payload["trigger"] == "resume_model_mismatch"
    assert payload["action"] == "flagged"


async def test_resume_recompact_clears_mismatch(monkeypatch):
    engine = _engine()
    store = _FakeStore(existing=[_Boundary(model="gpt-4o")])
    engine._persistence_store = lambda: store  # type: ignore[method-assign]
    engine._threads.clear()
    bus = _HookBus()
    engine._hook_bus = lambda: bus  # type: ignore[method-assign]
    engine._threads["thr_r"] = type(
        "T",
        (),
        {
            "thread_id": "thr_r",
            "model": "claude-sonnet",
            "status": "idle",
            "checkpoint_id": None,
            "frozen_context": None,
            "messages": [{"role": "user", "content": "hi"}],
        },
    )()

    async def _fake_run(thread: Any, emit: Any, from_checkpoint: Any = None) -> dict[str, Any]:
        return {"success": True}

    engine._run_thread = _fake_run  # type: ignore[method-assign]
    recompacted: list[str] = []

    async def _fake_compact(thread: Any, keep_recent: int, emit: Any, trigger: str, **kw: Any) -> dict[str, Any]:
        recompacted.append(trigger)
        return {"ok": True}

    engine._compact_thread = _fake_compact  # type: ignore[method-assign]

    async def _noop_emit(message: dict[str, Any]) -> None:
        return None

    result = await engine._handle_thread_resume(
        {"threadId": "thr_r", "checkpointId": "cp-1", "recompactIfModelChanged": True}, _noop_emit
    )
    assert recompacted == ["resume_model_mismatch"]
    assert "compactionModelMismatch" not in result  # 重压后兼容性恢复
    payload = next(p for e, p in bus.emitted if e == "compaction")
    assert payload["action"] == "recompacted"

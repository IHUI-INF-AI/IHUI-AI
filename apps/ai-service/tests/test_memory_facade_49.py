# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# 2026-09-20 批 49,对标 OpenAI codex memory/status + memory/reset
# 引擎记忆面(memory_facade)测试:status 只读聚合 + reset 确认清空 + 异常降级。
# 自包含,直接 import app.services.memory_facade 与单例 meta_learner。

from __future__ import annotations

from datetime import UTC, datetime

from app.services import memory_facade
from app.services.meta_learner import meta_learner


def _make_lesson(lid: str, ltype: str, title: str, skills, conf: float = 0.5) -> dict:
    """构造一条与 meta_learner 内存结构一致的 lesson dict(供测试注入)。"""
    iso = datetime.now(UTC).isoformat()
    return {
        "lessonId": lid,
        "lessonType": ltype,
        "title": title,
        "content": "x",
        "sourceSkills": list(skills),
        "failurePatternId": None,
        "occurrenceCount": 1,
        "confidence": conf,
        "systemPromptSnippet": "",
        "createdAt": iso,
        "updatedAt": iso,
    }


def _inject(lessons: list[dict]) -> None:
    """把构造好的 lessons 注入 meta_learner 内存(单例共享,测试前后自行清理)。"""
    for lesson in lessons:
        meta_learner._lessons[lesson["lessonId"]] = lesson


def test_status_empty() -> None:
    """空态:totalLessons=0,bySkill 空,lastWriteAt=None,byType 三类为 0。"""
    meta_learner._lessons.clear()
    meta_learner._title_index.clear()

    out = memory_facade.memory_status()
    assert "error" not in out
    assert out["totalLessons"] == 0
    assert out["bySkill"] == {}
    assert out["lastWriteAt"] is None
    assert out["byType"].get("failure_pattern", 0) == 0
    assert out["byType"].get("improvement_tip", 0) == 0
    assert out["byType"].get("best_practice", 0) == 0
    assert out["avgConfidence"] == 0.0

    meta_learner._lessons.clear()
    meta_learner._title_index.clear()


def test_status_counts_by_type_and_total() -> None:
    """注入后:总数与 byType 分类计数正确。"""
    meta_learner._lessons.clear()
    meta_learner._title_index.clear()

    _inject([
        _make_lesson("l1", "failure_pattern", "f1", ["a"]),
        _make_lesson("l2", "improvement_tip", "i1", ["b"]),
        _make_lesson("l3", "improvement_tip", "i2", ["b"]),
    ])

    out = memory_facade.memory_status()
    assert out["totalLessons"] == 3
    assert out["byType"]["failure_pattern"] == 1
    assert out["byType"]["improvement_tip"] == 2
    assert out["byType"]["best_practice"] == 0

    meta_learner._lessons.clear()
    meta_learner._title_index.clear()


def test_status_by_skill_aggregation() -> None:
    """按 skill 聚合:一条 lesson 多 skill,多 lesson 同 skill 正确累加。"""
    meta_learner._lessons.clear()
    meta_learner._title_index.clear()

    _inject([
        _make_lesson("l1", "failure_pattern", "f1", ["sA", "sB"]),
        _make_lesson("l2", "improvement_tip", "i1", ["sA"]),
    ])

    out = memory_facade.memory_status()
    assert out["bySkill"]["sA"] == 2
    assert out["bySkill"]["sB"] == 1
    assert out["lastWriteAt"] is not None  # 注入的 lesson 带时间戳

    meta_learner._lessons.clear()
    meta_learner._title_index.clear()


def test_reset_unconfirmed_is_noop() -> None:
    """未确认:不执行清空,返回 hint,且数据保持不动。"""
    meta_learner._lessons.clear()
    meta_learner._title_index.clear()

    _inject([
        _make_lesson("l1", "failure_pattern", "f1", ["a"]),
        _make_lesson("l2", "improvement_tip", "i1", ["b"]),
    ])

    out = memory_facade.memory_reset()
    assert out["confirmed"] is False
    assert "hint" in out
    # 数据未被清空
    assert memory_facade.memory_status()["totalLessons"] == 2

    meta_learner._lessons.clear()
    meta_learner._title_index.clear()


def test_reset_confirmed_clears_and_counts() -> None:
    """确认:清空前快照计数,清空后 totalLessons=0,内存索引已清。"""
    meta_learner._lessons.clear()
    meta_learner._title_index.clear()

    _inject([
        _make_lesson("l1", "failure_pattern", "f1", ["a"]),
        _make_lesson("l2", "improvement_tip", "i1", ["b"]),
    ])

    out = memory_facade.memory_reset(confirm=True)
    assert out["confirmed"] is True
    assert out["cleared"] == 2
    assert out["memoryCleared"] is True
    assert out["dbCleared"] is False
    # 数据确实被清空
    assert memory_facade.memory_status()["totalLessons"] == 0
    assert len(meta_learner._lessons) == 0
    assert len(meta_learner._title_index) == 0

    meta_learner._lessons.clear()
    meta_learner._title_index.clear()


def test_status_error_degradation(monkeypatch) -> None:
    """异常降级:monkeypatch meta_learner.get_status 抛错 → 返回 error 键,不抛异常。"""
    meta_learner._lessons.clear()
    meta_learner._title_index.clear()

    def _boom() -> dict:
        raise RuntimeError("injected get_status failure")

    monkeypatch.setattr(meta_learner, "get_status", _boom)

    out = memory_facade.memory_status()
    assert "error" in out
    assert "injected get_status failure" in out["error"]

    meta_learner._lessons.clear()
    meta_learner._title_index.clear()


def test_reset_error_degradation(monkeypatch) -> None:
    """异常降级:reset 路径中 get_status 抛错 → 返回 error 键,不抛异常。"""
    meta_learner._lessons.clear()
    meta_learner._title_index.clear()

    def _boom() -> dict:
        raise RuntimeError("injected get_status failure")

    monkeypatch.setattr(meta_learner, "get_status", _boom)

    out = memory_facade.memory_reset(confirm=True)
    assert "error" in out
    assert "injected get_status failure" in out["error"]

    meta_learner._lessons.clear()
    meta_learner._title_index.clear()


# =============================================================================
# 批 49(主会话补):RPC 出口接线(memory.status / memory.reset)
# =============================================================================


class _RpcCollector:
    def __init__(self):
        self.events: list[tuple[str, dict]] = []

    async def __call__(self, message):
        params = message.get("params") or {}
        self.events.append((params.get("event", ""), params.get("payload") or {}))


class _FakeLoop:
    async def run(self, messages):  # pragma: no cover
        raise AssertionError("memory RPC 测试不应触发 LLM 运行")

    async def resume_from_checkpoint(self, checkpoint_id):  # pragma: no cover
        raise AssertionError

    async def interrupt(self, mode="cancel"):  # pragma: no cover
        return None


def _rpc_engine(tmp_path):
    from app.services.agent_engine import AgentEngine
    from app.services.session_store import SessionStore

    async def factory(spec, host_tools):
        return _FakeLoop()

    store = SessionStore(str(tmp_path / "mem_rpc.db"))
    return AgentEngine(loop_factory=factory, store=store)


async def test_rpc_memory_status_roundtrip(tmp_path):
    """memory.status 经完整 RPC 链路返回 facade 聚合。"""
    engine = _rpc_engine(tmp_path)
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 1, "method": "memory.status", "params": {}}
    )
    assert response is not None and "error" not in response, response
    status = response["result"]["status"]
    assert isinstance(status, dict) and "error" not in status


async def test_rpc_memory_reset_requires_confirm(tmp_path):
    """memory/reset 未确认:返回 confirmed=False 且不动数据。"""
    engine = _rpc_engine(tmp_path)
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 2, "method": "memory.reset", "params": {}}
    )
    result = response["result"]["result"]
    assert result["confirmed"] is False


async def test_rpc_memory_reset_confirmed(tmp_path):
    """memory/reset confirm=true:走完整链路清空并回计数。"""
    engine = _rpc_engine(tmp_path)
    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "memory.reset",
            "params": {"confirm": True},
        }
    )
    result = response["result"]["result"]
    assert result["confirmed"] is True
    assert isinstance(result.get("cleared", 0), int)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

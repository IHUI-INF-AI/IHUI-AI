# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-101 / AIS-104 / AIS-105 三条一组:录制属主、全局记忆 reset、沉淀计数淘汰。

缺陷(现读):
  · AIS-101 `GET /api/agent-recorder/runs/{run_id}/steps|replay|metrics` 只校验登录,
    `user_id` 仅进日志 —— 凭可枚举 run_id 就能读他人 agent 的工具入参/diff/测试输出;
  · AIS-104 `memory.reset` 无角色校验,且清空后 `meta_learner._loaded` 仍为 True,
    懒加载永不重来 —— 任一用户清空全局 lessons 后,`memory.status` 对所有租户谎报 0;
  · AIS-105 `memory_sedimenter._COUNT` 注释称 LRU,实际只增不淘汰 —— 构造无限
    conversationId 可让进程内存持续增长。

修法:
  · AIS-101 录制首写盖章 `owner_user_id`,读端逐端点与调用主体比对(未盖章的记录
    对已登录调用方不可见);跨属主续写抛 ValueError;
  · AIS-104 RPC 处理器按承载层绑定的 `roleId` 限定管理员,清空后置 `_loaded=False`
    让懒加载重新读持久化源(不把"没加载"报成"没有记忆");
  · AIS-105 计数表改 OrderedDict + 容量上限,超限淘汰最旧会话。

用例:
  AIS-101:首写盖章;异主体读 steps/replay/metrics 全为空且不可续写;系统级读不受影响。
  AIS-104:非管理员被拒且数据不动;管理员清空且 `_loaded=False`;facade 清空同样下落。
  AIS-105:灌入超上限会话后计数表不增长,最旧键被淘汰、最新键仍在。
"""

from __future__ import annotations

import pytest

import app.services.memory_sedimenter as ms
from app.services.agent_step_recorder import AgentStepRecorder
from app.services.meta_learner import meta_learner

# ---------------------------------------------------------------------------
# AIS-101:step-recorder 运行记录属主
# ---------------------------------------------------------------------------


def _recorder(tmp_path) -> AgentStepRecorder:
    return AgentStepRecorder(file_path=tmp_path / "step_records.json")


def test_append_stamps_owner_and_owner_reads(tmp_path) -> None:
    """首写盖章属主;同一主体三个读端点都能看到自己的步骤。"""
    rec = _recorder(tmp_path)
    rec.append_step("run-a", {"tool_name": "shell", "status": "ok"}, owner_user_id="alice")

    assert rec.get_run_steps("run-a", owner_user_id="alice")["total"] == 1
    assert rec.replay("run-a", owner_user_id="alice")["total"] == 1
    assert rec.get_run_metrics("run-a", owner_user_id="alice")["step_count"] == 1


def test_other_owner_reads_empty_and_cannot_write(tmp_path) -> None:
    """异主体读三端点全为空(与"不存在"同形),续写抛 ValueError。"""
    rec = _recorder(tmp_path)
    rec.append_step("run-a", {"tool_name": "shell", "input_summary": "secret"}, owner_user_id="alice")

    steps = rec.get_run_steps("run-a", owner_user_id="bob")
    assert steps["total"] == 0 and steps["list"] == []
    replay = rec.replay("run-a", owner_user_id="bob")
    assert replay["total"] == 0 and replay["steps"] == []
    assert rec.replay("run-a", step_index=0, owner_user_id="bob")["found"] is False
    assert rec.get_run_metrics("run-a", owner_user_id="bob")["step_count"] == 0

    with pytest.raises(ValueError):
        rec.append_step("run-a", {"tool_name": "shell"}, owner_user_id="bob")


def test_legacy_unowned_record_invisible_to_identified_caller(tmp_path) -> None:
    """没盖章的历史记录对已登录调用方不可见;系统级内部读(不传主体)不受影响。"""
    rec = _recorder(tmp_path)
    rec.append_step("run-legacy", {"tool_name": "shell"})

    assert rec.get_run_steps("run-legacy", owner_user_id="alice")["total"] == 0
    # 系统级读(内部时间线/回放链路)不设过滤
    assert rec.get_run_steps("run-legacy")["total"] == 1


def test_invocation_lookup_is_owner_scoped(tmp_path) -> None:
    """按账行编号反查同样按属主过滤,不因跨 run 扫描而串号。"""
    rec = _recorder(tmp_path)
    evidence = {"invocation_id": "inv-1", "permission_decision": "allow"}
    rec.append_step("run-a", {"tool_name": "shell", **evidence}, owner_user_id="alice")
    rec.append_step("run-b", {"tool_name": "shell", **evidence}, owner_user_id="bob")

    alice = rec.get_steps_by_invocation_id("inv-1", owner_user_id="alice")
    assert alice["found"] is True and alice["total"] == 1
    assert {s["run_id"] for s in alice["list"]} == {"run-a"}
    assert rec.get_steps_by_invocation_id("inv-1", owner_user_id="bob")["scanned_runs"] == 1


# ---------------------------------------------------------------------------
# AIS-104:memory.reset 的权限与重载
# ---------------------------------------------------------------------------


@pytest.fixture
def _memory_state():
    """隔离 meta_learner 全局单例(含加载生命周期标量)。"""
    saved = (
        dict(meta_learner._lessons),
        dict(meta_learner._title_index),
        meta_learner._loaded,
        meta_learner._load_failures,
        meta_learner._load_next_attempt_s,
        meta_learner._load_give_up_logged,
    )
    yield
    (
        lessons,
        title_index,
        loaded,
        failures,
        next_attempt,
        give_up,
    ) = saved
    meta_learner._lessons = lessons
    meta_learner._title_index = title_index
    meta_learner._loaded = loaded
    meta_learner._load_failures = failures
    meta_learner._load_next_attempt_s = next_attempt
    meta_learner._load_give_up_logged = give_up


def _seed_lessons() -> None:
    meta_learner._lessons = {"l1": {"lessonId": "l1"}, "l2": {"lessonId": "l2"}}
    meta_learner._title_index = {("t", "标题"): "l1"}


def _rpc_engine(tmp_path):
    from app.services.agent_engine import AgentEngine
    from app.services.session_store import SessionStore

    class _FakeLoop:
        run_id = None

    async def factory(spec, host_tools):
        return _FakeLoop()

    return AgentEngine(loop_factory=factory, store=SessionStore(str(tmp_path / "mem_rpc.db")))


async def test_reset_facade_drops_loaded_flag(_memory_state) -> None:
    """facade 清空后必须把 `_loaded` 落下 —— 否则懒加载永不重来,status 永远谎报 0。"""
    from app.services.memory_facade import memory_reset

    meta_learner._loaded = True
    _seed_lessons()

    out = memory_reset(confirm=True)

    assert out["cleared"] == 2
    assert meta_learner._lessons == {}
    assert meta_learner._title_index == {}
    assert meta_learner._loaded is False, "清空后必须让懒加载重新读持久化源"


async def test_reset_rpc_rejects_non_admin(_memory_state, tmp_path) -> None:
    """普通用户(roleId 缺省 0)调 memory.reset:被拒且数据原样保留。"""
    _seed_lessons()
    engine = _rpc_engine(tmp_path)

    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 11, "method": "memory.reset", "params": {"confirm": True}}
    )
    result = response["result"]["result"]

    assert result["confirmed"] is False
    assert result["error"] == "forbidden"
    assert len(meta_learner._lessons) == 2, "非管理员的请求不许清空全局记忆"


async def test_reset_rpc_allows_admin(_memory_state, tmp_path) -> None:
    """管理员(roleId>=1)清空成功,并同步置 `_loaded=False`。"""
    meta_learner._loaded = True
    _seed_lessons()
    engine = _rpc_engine(tmp_path)

    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 12,
            "method": "memory.reset",
            "params": {"confirm": True, "roleId": 1},
        }
    )
    result = response["result"]["result"]

    assert result["confirmed"] is True
    assert result["cleared"] == 2
    assert meta_learner._lessons == {}
    assert meta_learner._loaded is False


# ---------------------------------------------------------------------------
# AIS-105:memory_sedimenter 计数表有界
# ---------------------------------------------------------------------------


async def test_count_map_is_bounded(monkeypatch) -> None:
    """灌入超过上限的会话后计数表不增长:最旧键被淘汰,最新键仍在。"""
    monkeypatch.setenv("IHUI_MEMORY_SEDIMENT_EVERY", "99")
    ms._COUNT.clear()
    try:
        cap = ms._COUNT_MAX
        overflow = 200
        for i in range(cap + overflow):
            await ms.maybe_sediment(f"sess-{i}", "user-1")

        assert len(ms._COUNT) <= cap
        assert "sess-0" not in ms._COUNT, "最旧会话应被淘汰"
        assert f"sess-{cap + overflow - 1}" in ms._COUNT, "最新会话必须保留"
    finally:
        ms._COUNT.clear()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

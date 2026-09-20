# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""agent_checkpoint.py + AgentLoopV2 checkpoint 集成测试。

测试覆盖:
- AgentCheckpointManager 基本存取/查询/删除/LRU/TTL/清理(15 个核心用例)
- AgentLoopV2 checkpoint 集成:run 自动 checkpoint / pause / cancel / resume / 异常保存 / 失败不阻塞
- PG 持久层(D26 三层存储:内存 -> redis -> PG,psycopg 软依赖 fake 驱动)

所有测试用内存模式(redis_url=None),不依赖外部 Redis;PG 路径用 fake pool,不依赖真实 PG。
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime

import pytest

import app.services.agent_checkpoint as agent_checkpoint_module
from app.services.agent_checkpoint import (
    AgentCheckpointManager,
    AgentLoopCheckpoint,
    _reset_global_manager_for_test,
    get_agent_checkpoint_manager,
)
from app.services.agent_loop_v2 import (
    AgentLoopV2,
    ToolDefinition,
)

# =============================================================================
# 辅助
# =============================================================================


def _make_manager(**kwargs) -> AgentCheckpointManager:
    """新建内存模式 manager(redis_url 强制 None)。"""
    kwargs.setdefault("redis_url", None)
    return AgentCheckpointManager(**kwargs)


def _sample_messages(n: int = 2) -> list[dict]:
    return [{"role": "system", "content": "sys"}] + [
        {"role": "user", "content": f"msg {i}"} for i in range(n - 1)
    ]


async def _weather_executor(args):
    return {"city": args["city"], "weather": "晴", "temp": 25}


def _weather_tool() -> ToolDefinition:
    return ToolDefinition(
        name="get_weather",
        description="查天气",
        parameters={"type": "object", "properties": {"city": {"type": "string"}}},
        executor=_weather_executor,
    )


# =============================================================================
# PG 持久层 fake 基建(D26:psycopg AsyncConnectionPool 最小 fake)
# =============================================================================


class _FakeCursor:
    """psycopg cursor 最小 fake(fetchone / rowcount)。"""

    def __init__(self, rows: list | None = None):
        self._rows = rows or []
        self.rowcount = 0

    async def fetchone(self):
        return self._rows[0] if self._rows else None


class _FakeConn:
    """psycopg 异步连接最小 fake(记录 execute 调用,可注入行集/异常)。"""

    def __init__(self, rows: list | None = None, error: Exception | None = None):
        self.executed: list[tuple[str, tuple]] = []
        self._rows = rows or []
        self._error = error

    async def execute(self, sql: str, *params):
        if self._error is not None:
            raise self._error
        self.executed.append((sql, params))
        return _FakeCursor(self._rows)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _FakePool:
    """psycopg AsyncConnectionPool 最小 fake(connection() 返回预置 conn)。"""

    def __init__(self, conn: _FakeConn):
        self._conn = conn
        self.closed = False

    def connection(self):
        return self._conn

    async def close(self):
        self.closed = True


def _pg_payload(**overrides) -> dict:
    """构造 agent_checkpoints.payload 全量 dict(对齐 AgentLoopCheckpoint.to_dict)。"""
    base = {
        "checkpoint_id": "cp-pg-1",
        "session_id": "s-pg",
        "iteration": 2,
        "messages": [{"role": "user", "content": "hi"}],
        "tool_state": {},
        "status": "paused",
        "created_at": time.time() - 10,
        "expires_at": time.time() + 3600,
        "metadata": {"k": "v"},
    }
    base.update(overrides)
    return base


def _pg_row_from_payload(payload: dict) -> tuple:
    """构造 psycopg tuple 行(列序对齐 _SELECT_*_SQL:4 号位 payload)。"""
    return (
        payload["checkpoint_id"],
        payload["session_id"],
        payload["status"],
        payload["iteration"],
        payload,
        payload["created_at"],
        payload["expires_at"],
    )


# =============================================================================
# 1. 基本存取
# =============================================================================


async def test_save_and_load_checkpoint():
    """save_checkpoint 后 load_checkpoint 返回相同内容。"""
    mgr = _make_manager()
    cid = await mgr.save_checkpoint(
        session_id="s1",
        iteration=3,
        messages=_sample_messages(),
        tool_state={"k": "v"},
        status="running",
    )
    cp = await mgr.load_checkpoint(cid)
    assert cp is not None
    assert cp.checkpoint_id == cid
    assert cp.session_id == "s1"
    assert cp.iteration == 3
    assert cp.status == "running"
    assert cp.tool_state == {"k": "v"}
    assert len(cp.messages) == 2


# =============================================================================
# 2. 加载不存在的 checkpoint
# =============================================================================


async def test_load_nonexistent_checkpoint():
    """load_checkpoint 不存在 id 返回 None。"""
    mgr = _make_manager()
    cp = await mgr.load_checkpoint("nonexistent_id")
    assert cp is None


# =============================================================================
# 3. 按 session 查最新
# =============================================================================


async def test_load_latest_by_session():
    """同一 session 多次保存,load_latest_by_session 返回最新。"""
    mgr = _make_manager()
    await mgr.save_checkpoint("s1", 1, _sample_messages(), {}, "running")
    await mgr.save_checkpoint("s1", 2, _sample_messages(), {}, "running")
    cid3 = await mgr.save_checkpoint("s1", 3, _sample_messages(), {}, "running")
    cp = await mgr.load_latest_by_session("s1")
    assert cp is not None
    assert cp.checkpoint_id == cid3
    assert cp.iteration == 3
    # 其他 session 不受影响
    await mgr.save_checkpoint("s2", 1, _sample_messages(), {}, "running")
    cp_s1 = await mgr.load_latest_by_session("s1")
    assert cp_s1 is not None
    assert cp_s1.checkpoint_id == cid3


# =============================================================================
# 4. 列出全部
# =============================================================================


async def test_list_checkpoints_all():
    """list_checkpoints() 返回所有未过期 checkpoint。"""
    mgr = _make_manager()
    await mgr.save_checkpoint("s1", 1, _sample_messages(), {}, "running")
    await mgr.save_checkpoint("s2", 1, _sample_messages(), {}, "running")
    await mgr.save_checkpoint("s3", 1, _sample_messages(), {}, "running")
    cps = await mgr.list_checkpoints()
    assert len(cps) == 3
    # 按 created_at 升序
    assert cps[0].created_at <= cps[1].created_at <= cps[2].created_at


# =============================================================================
# 5. 按 session 过滤
# =============================================================================


async def test_list_checkpoints_by_session():
    """list_checkpoints(session_id=) 只返回该 session 的 checkpoint。"""
    mgr = _make_manager()
    await mgr.save_checkpoint("s1", 1, _sample_messages(), {}, "running")
    await mgr.save_checkpoint("s1", 2, _sample_messages(), {}, "running")
    await mgr.save_checkpoint("s2", 1, _sample_messages(), {}, "running")
    cps_s1 = await mgr.list_checkpoints(session_id="s1")
    cps_s2 = await mgr.list_checkpoints(session_id="s2")
    assert len(cps_s1) == 2
    assert len(cps_s2) == 1
    assert all(cp.session_id == "s1" for cp in cps_s1)
    assert all(cp.session_id == "s2" for cp in cps_s2)


# =============================================================================
# 6. 删除 checkpoint
# =============================================================================


async def test_delete_checkpoint():
    """delete_checkpoint 后 load 返回 None。"""
    mgr = _make_manager()
    cid = await mgr.save_checkpoint("s1", 1, _sample_messages(), {}, "running")
    deleted = await mgr.delete_checkpoint(cid)
    assert deleted is True
    cp = await mgr.load_checkpoint(cid)
    assert cp is None


# =============================================================================
# 7. 删除不存在的返回 False
# =============================================================================


async def test_delete_nonexistent():
    """delete_checkpoint 不存在 id 返回 False。"""
    mgr = _make_manager()
    deleted = await mgr.delete_checkpoint("nonexistent")
    assert deleted is False


# =============================================================================
# 8. LRU 淘汰
# =============================================================================


async def test_lru_eviction():
    """超过 max_in_memory 时淘汰 created_at 最老的。"""
    mgr = _make_manager(max_in_memory=3)
    cids = []
    for i in range(5):
        cid = await mgr.save_checkpoint(f"s{i}", 1, _sample_messages(), {}, "running")
        cids.append(cid)
        # 确保 created_at 递增(避免同毫秒)
        await asyncio.sleep(0.001)
    # 内存中只应剩 3 个(最后 3 个)
    cps = await mgr.list_checkpoints()
    assert len(cps) == 3
    remaining_ids = {cp.checkpoint_id for cp in cps}
    assert cids[3] in remaining_ids
    assert cids[4] in remaining_ids
    # 最老的 2 个被淘汰
    assert cids[0] not in remaining_ids
    assert cids[1] not in remaining_ids
    # 被淘汰的 load 返回 None
    assert await mgr.load_checkpoint(cids[0]) is None


# =============================================================================
# 9. TTL 过期
# =============================================================================


async def test_ttl_expiry():
    """过期 checkpoint load 返回 None。"""
    mgr = _make_manager(ttl_seconds=1)
    cid = await mgr.save_checkpoint("s1", 1, _sample_messages(), {}, "running")
    # 立即 load 正常
    cp = await mgr.load_checkpoint(cid)
    assert cp is not None
    # 等 TTL 过期
    await asyncio.sleep(1.1)
    cp_expired = await mgr.load_checkpoint(cid)
    assert cp_expired is None


# =============================================================================
# 10. 清理过期
# =============================================================================


async def test_cleanup_expired():
    """cleanup_expired 清理过期 checkpoint 并返回数量。

    ttl 取 2s(而非 1s):全量回归高负载下 save s3 与 cleanup 之间
    可能被调度延迟 1s+,余量过小会把 s3 误判过期导致 flaky。
    """
    mgr = _make_manager(ttl_seconds=2)
    await mgr.save_checkpoint("s1", 1, _sample_messages(), {}, "running")
    await mgr.save_checkpoint("s2", 1, _sample_messages(), {}, "running")
    await asyncio.sleep(2.1)
    # 再加一个未过期的
    await mgr.save_checkpoint("s3", 1, _sample_messages(), {}, "running")
    cleaned = await mgr.cleanup_expired()
    assert cleaned == 2
    remaining = await mgr.list_checkpoints()
    assert len(remaining) == 1
    assert remaining[0].session_id == "s3"


# =============================================================================
# 11. 元数据存储
# =============================================================================


async def test_checkpoint_metadata():
    """metadata 字段正确存储和读取。"""
    mgr = _make_manager()
    meta = {"model": "gpt-4", "prompt": "你好", "nested": {"a": 1, "b": [2, 3]}}
    cid = await mgr.save_checkpoint(
        "s1", 1, _sample_messages(), {}, "running", metadata=meta
    )
    cp = await mgr.load_checkpoint(cid)
    assert cp is not None
    assert cp.metadata == meta
    assert cp.metadata["model"] == "gpt-4"
    assert cp.metadata["nested"]["b"] == [2, 3]


# =============================================================================
# 12. 并发保存不冲突
# =============================================================================


async def test_concurrent_save():
    """多协程并发 save_checkpoint 不冲突,全部成功。"""
    mgr = _make_manager(max_in_memory=100)
    tasks = [
        mgr.save_checkpoint(f"s{i}", i + 1, _sample_messages(), {}, "running")
        for i in range(20)
    ]
    cids = await asyncio.gather(*tasks)
    assert len(cids) == 20
    assert len(set(cids)) == 20  # 全部唯一
    # 全部可加载
    for cid in cids:
        cp = await mgr.load_checkpoint(cid)
        assert cp is not None


# =============================================================================
# 13. 全局单例
# =============================================================================


async def test_global_singleton():
    """get_agent_checkpoint_manager 返回同一实例。"""
    _reset_global_manager_for_test()
    m1 = get_agent_checkpoint_manager()
    m2 = get_agent_checkpoint_manager()
    assert m1 is m2
    _reset_global_manager_for_test()


# =============================================================================
# 14. 大消息历史性能
# =============================================================================


async def test_checkpoint_with_large_messages():
    """大消息历史(1000 条)存取正确且在合理时间内。"""
    mgr = _make_manager()
    large_messages = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"message content {i}" * 10}
        for i in range(1000)
    ]
    start = time.time()
    cid = await mgr.save_checkpoint("s1", 50, large_messages, {"counter": 1}, "running")
    save_duration = time.time() - start

    cp = await mgr.load_checkpoint(cid)
    load_duration = time.time() - start - save_duration

    assert cp is not None
    assert len(cp.messages) == 1000
    assert cp.iteration == 50
    # 内存操作应很快(< 2s,含 JSON 序列化深拷贝)
    assert save_duration < 2.0
    assert load_duration < 2.0


# =============================================================================
# 15. 状态转换 running → paused → completed
# =============================================================================


async def test_checkpoint_status_transitions():
    """同一 session 保存不同 status,load_latest 返回最新 status。"""
    mgr = _make_manager()
    await mgr.save_checkpoint("s1", 1, _sample_messages(), {}, "running")
    await mgr.save_checkpoint("s1", 2, _sample_messages(), {}, "paused")
    await mgr.save_checkpoint("s1", 3, _sample_messages(), {}, "completed")
    cp = await mgr.load_latest_by_session("s1")
    assert cp is not None
    assert cp.status == "completed"
    assert cp.iteration == 3


# =============================================================================
# 16. messages 深拷贝隔离
# =============================================================================


async def test_checkpoint_messages_deep_copy():
    """save_checkpoint 深拷贝 messages,外部修改不影响 checkpoint。"""
    mgr = _make_manager()
    msgs = _sample_messages()
    cid = await mgr.save_checkpoint("s1", 1, msgs, {}, "running")
    # 外部修改原 list
    msgs.append({"role": "user", "content": "new"})
    msgs[0]["content"] = "modified"
    cp = await mgr.load_checkpoint(cid)
    assert cp is not None
    assert len(cp.messages) == 2  # 不受 append 影响
    assert cp.messages[0]["content"] == "sys"  # 不受修改影响


# =============================================================================
# 17. checkpoint_id 为 uuid4 hex(32 字符)
# =============================================================================


async def test_checkpoint_id_format():
    """checkpoint_id 是 32 字符 hex(uuid4.hex)。"""
    mgr = _make_manager()
    cid = await mgr.save_checkpoint("s1", 1, _sample_messages(), {}, "running")
    assert len(cid) == 32
    int(cid, 16)  # 合法 hex


# =============================================================================
# 18. load_latest_by_session 不存在的 session
# =============================================================================


async def test_load_latest_nonexistent_session():
    """load_latest_by_session 不存在 session 返回 None。"""
    mgr = _make_manager()
    cp = await mgr.load_latest_by_session("nonexistent_session")
    assert cp is None


# =============================================================================
# 19. AgentLoopV2 + checkpoint 集成:run 自动保存 checkpoint
# =============================================================================


async def test_agent_loop_run_saves_checkpoint():
    """enable_checkpoint=True 时 run 每轮 iteration 后自动保存 checkpoint。"""
    mgr = _make_manager()
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "北京晴 25度", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm, [_weather_tool()], max_iterations=5,
        enable_checkpoint=True, session_id="test-session-1",
        checkpoint_manager=mgr,
    )
    result = await loop.run([
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "北京天气"},
    ])

    assert result.success is True
    assert result.stop_reason == "completed"
    # 第 1 轮 iteration 后应保存了 checkpoint(第 2 轮无 tool_calls 完成前还会再 save 一次 running)
    cps = await mgr.list_checkpoints(session_id="test-session-1")
    assert len(cps) >= 1
    latest = await mgr.load_latest_by_session("test-session-1")
    assert latest is not None
    # 2026-08-22 对齐:每轮 iteration 结束都 save(最新 = 最后保存的,可能 i=2),
    # load_latest_by_session 返回 max(iteration)。循环完成后会再 save 一次 status=completed
    # (L5-12 提前返回路径,确保 workbench 可视化可追溯),所以 latest.status 是 completed。
    assert latest.iteration >= 1
    assert latest.status in {"running", "completed"}
    # messages 应包含 assistant + tool 消息(第 1 轮追加的)
    assert len(latest.messages) >= 4


# =============================================================================
# 20. AgentLoopV2 + checkpoint:enable_checkpoint=False 不保存
# =============================================================================


async def test_agent_loop_checkpoint_disabled():
    """enable_checkpoint=False 时不保存 checkpoint。"""
    mgr = _make_manager()
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm, [_weather_tool()], max_iterations=5,
        enable_checkpoint=False, checkpoint_manager=mgr,
    )
    await loop.run([
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "天气"},
    ])
    cps = await mgr.list_checkpoints()
    assert len(cps) == 0


# =============================================================================
# 21. AgentLoopV2 + checkpoint:pause 保存 checkpoint
# =============================================================================


async def test_agent_loop_pause_saves_checkpoint():
    """pause() 设置标志后,loop 在下一轮 iteration 检测到并保存 paused checkpoint。

    时序:mock LLM 在第 2 次调用时设置 _pause_requested 标志,
    loop 在第 3 轮 iteration 开始前检测到并返回 paused 结果。
    """
    mgr = _make_manager()
    call_count = 0
    loop = AgentLoopV2(
        _weather_executor, [_weather_tool()], max_iterations=10,
        enable_checkpoint=True, session_id="pause-session",
        checkpoint_manager=mgr,
    )

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            # 在第 2 轮 LLM 调用时设置暂停标志
            # loop 在第 3 轮 iteration 开始前会检测到
            loop._pause_requested = True
        return {
            "content": f"第{call_count}轮",
            "tool_calls": [{"id": f"c{call_count}", "name": "get_weather", "args": {"city": "北京"}}],
        }

    loop._llm_complete = mock_llm
    result = await loop.run([
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "天气"},
    ])

    # pause 触发后 stop_reason="paused"
    assert result.stop_reason == "paused"
    assert result.success is False
    assert result.checkpoint_id is not None
    # checkpoint 已保存,status=paused
    cp = await mgr.load_checkpoint(result.checkpoint_id)
    assert cp is not None
    assert cp.status == "paused"


# =============================================================================
# 22. AgentLoopV2 + checkpoint:cancel 保存 checkpoint
# =============================================================================


async def test_agent_loop_cancel_saves_checkpoint():
    """cancel() 设置标志后,loop 在下一轮 iteration 检测到并保存 cancelled checkpoint。

    时序:mock LLM 在第 2 次调用时设置 _cancel_requested 标志,
    loop 在第 3 轮 iteration 开始前检测到并返回 cancelled 结果。
    """
    mgr = _make_manager()
    call_count = 0
    loop = AgentLoopV2(
        _weather_executor, [_weather_tool()], max_iterations=10,
        enable_checkpoint=True, session_id="cancel-session",
        checkpoint_manager=mgr,
    )

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            loop._cancel_requested = True
        return {
            "content": f"第{call_count}轮",
            "tool_calls": [{"id": f"c{call_count}", "name": "get_weather", "args": {"city": "北京"}}],
        }

    loop._llm_complete = mock_llm
    result = await loop.run([
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "天气"},
    ])

    assert result.stop_reason == "cancelled"
    assert result.success is False
    assert result.checkpoint_id is not None
    cp = await mgr.load_checkpoint(result.checkpoint_id)
    assert cp is not None
    assert cp.status == "cancelled"


# =============================================================================
# 23. AgentLoopV2 + checkpoint:异常时保存 failed checkpoint
# =============================================================================


async def test_agent_loop_error_saves_checkpoint():
    """LLM 调用异常时保存 status=failed checkpoint,便于后续 resume。"""
    mgr = _make_manager()

    async def mock_llm(messages, tools):
        raise RuntimeError("LLM 网关连接失败")

    loop = AgentLoopV2(
        mock_llm, [_weather_tool()], max_iterations=5,
        enable_checkpoint=True, session_id="error-session",
        checkpoint_manager=mgr,
    )
    result = await loop.run([
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "天气"},
    ])

    assert result.success is False
    assert result.stop_reason == "error"
    assert result.checkpoint_id is not None
    cp = await mgr.load_checkpoint(result.checkpoint_id)
    assert cp is not None
    assert cp.status == "failed"
    assert cp.metadata.get("error") == "LLM 网关连接失败"


# =============================================================================
# 24. AgentLoopV2 + checkpoint:resume_from_checkpoint 续跑
# =============================================================================


async def test_resume_from_checkpoint():
    """从 paused checkpoint 恢复,继续执行到完成。

    时序:
    1. 第一个 loop:mock LLM 在第 2 轮设置 pause 标志 → 第 3 轮 loop 检测到并暂停
    2. 第二个 loop:从 checkpoint 恢复,mock LLM 立即返回无 tool_calls → 完成
    """
    mgr = _make_manager()
    call_count = 0
    loop = AgentLoopV2(
        _weather_executor, [_weather_tool()], max_iterations=10,
        enable_checkpoint=True, session_id="resume-session",
        checkpoint_manager=mgr,
    )

    async def mock_llm_pause(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 2:
            loop._pause_requested = True
        return {
            "content": f"第{call_count}轮",
            "tool_calls": [{"id": f"c{call_count}", "name": "get_weather", "args": {"city": "北京"}}],
        }

    loop._llm_complete = mock_llm_pause
    result1 = await loop.run([
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "天气"},
    ])
    assert result1.stop_reason == "paused"
    assert result1.checkpoint_id is not None

    # 从 checkpoint 恢复(新 loop 实例,mock LLM 立即完成)
    async def mock_llm_finish(messages, tools):
        return {"content": "完成", "tool_calls": None}

    loop2 = AgentLoopV2(
        mock_llm_finish, [_weather_tool()], max_iterations=10,
        enable_checkpoint=True, checkpoint_manager=mgr,
    )
    result2 = await loop2.resume_from_checkpoint(result1.checkpoint_id)
    assert result2.success is True
    assert result2.stop_reason == "completed"
    assert result2.final_response == "完成"


# =============================================================================
# 25. AgentLoopV2 + checkpoint:resume 不存在的 checkpoint 抛 ValueError
# =============================================================================


async def test_resume_nonexistent_raises():
    """resume_from_checkpoint 不存在 id 抛 ValueError。"""
    mgr = _make_manager()
    loop = AgentLoopV2(
        _weather_executor, [_weather_tool()], max_iterations=5,
        checkpoint_manager=mgr,
    )
    with pytest.raises(ValueError, match="不存在或已过期"):
        await loop.resume_from_checkpoint("nonexistent_checkpoint_id")


# =============================================================================
# 26. AgentLoopV2 + checkpoint:checkpoint 失败不阻塞 loop
# =============================================================================


async def test_checkpoint_failure_does_not_block_loop():
    """checkpoint_manager.save_checkpoint 抛异常时,loop 只 log warning 不中断。"""
    class FailManager(AgentCheckpointManager):
        async def save_checkpoint(self, *args, **kwargs):
            raise RuntimeError("redis down")

    mgr = FailManager(redis_url=None)
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
            }
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm, [_weather_tool()], max_iterations=5,
        enable_checkpoint=True, checkpoint_manager=mgr,
    )
    result = await loop.run([
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "天气"},
    ])
    # loop 正常完成,checkpoint 失败未阻塞
    assert result.success is True
    assert result.stop_reason == "completed"
    assert result.final_response == "完成"


# =============================================================================
# 27. AgentLoopV2 + checkpoint:completed checkpoint resume 直接返回
# =============================================================================


async def test_resume_completed_checkpoint():
    """resume_from_checkpoint 对 completed 状态的 checkpoint 直接返回 completed。"""
    mgr = _make_manager()
    cid = await mgr.save_checkpoint(
        "s1", 5, _sample_messages(), {}, "completed",
    )
    loop = AgentLoopV2(
        _weather_executor, [_weather_tool()], max_iterations=10,
        checkpoint_manager=mgr,
    )
    result = await loop.resume_from_checkpoint(cid)
    assert result.stop_reason == "completed"
    assert "无需续跑" in result.error


# =============================================================================
# 28. AgentLoopV2 + checkpoint:messages 深拷贝隔离
# =============================================================================


async def test_checkpoint_messages_isolation_on_resume():
    """resume 时深拷贝 checkpoint.messages,修改不影响原 checkpoint。"""
    mgr = _make_manager()
    cid = await mgr.save_checkpoint(
        "resume-iso", 2, _sample_messages(), {}, "paused",
    )
    AgentLoopV2(
        _weather_executor, [_weather_tool()], max_iterations=10,
        checkpoint_manager=mgr,
    )
    # 恢复前先验证原 checkpoint
    cp_before = await mgr.load_checkpoint(cid)
    assert cp_before is not None
    original_len = len(cp_before.messages)

    # resume_from_checkpoint 内部会深拷贝 messages,但 completed checkpoint 直接返回
    # 用 paused checkpoint 触发 _run_loop(但 mock_llm 会立即完成)
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        return {"content": "完成", "tool_calls": None}

    loop2 = AgentLoopV2(
        mock_llm, [_weather_tool()], max_iterations=10,
        checkpoint_manager=mgr,
    )
    await loop2.resume_from_checkpoint(cid)
    # 原 checkpoint 的 messages 不被修改
    cp_after = await mgr.load_checkpoint(cid)
    assert cp_after is not None
    assert len(cp_after.messages) == original_len


# =============================================================================
# 29. PG 持久层(D26 三层存储:内存 -> redis -> PG)
# =============================================================================


async def test_pg_disabled_without_psycopg(caplog, monkeypatch):
    """db_url 有值但 psycopg 不可用 → PG 持久层降级关闭 + warning。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", False)
    with caplog.at_level(logging.WARNING):
        mgr = _make_manager(db_url="postgresql://fake")
    assert mgr._use_pg is False
    assert any("psycopg 未安装" in r.getMessage() for r in caplog.records)


async def test_pg_save_checkpoint_upserts(monkeypatch):
    """D26:save_checkpoint 同步 UPSERT 到 PG(payload JSON + timestamptz 参数)。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    mgr = _make_manager(db_url="postgresql://fake")
    conn = _FakeConn()
    mgr._pool = _FakePool(conn)
    mgr._table_ready = True  # 跳过建表(独立用例覆盖)

    cid = await mgr.save_checkpoint("s-pg", 3, _sample_messages(), {"k": "v"}, "paused")

    assert len(conn.executed) == 1
    sql, params = conn.executed[0]
    assert "INSERT INTO agent_checkpoints" in sql
    assert "ON CONFLICT (checkpoint_id) DO UPDATE" in sql
    assert params[0] == cid
    assert params[1] == "s-pg"
    assert params[2] == "paused"
    assert params[3] == 3
    payload = json.loads(params[4])
    assert payload["checkpoint_id"] == cid
    assert payload["tool_state"] == {"k": "v"}
    # timestamptz 参数为带时区 ISO 字符串
    assert datetime.fromisoformat(params[5]).tzinfo is not None
    assert datetime.fromisoformat(params[6]).tzinfo is not None


async def test_pg_save_failure_degrades(monkeypatch, caplog):
    """PG 写入异常 → warning 降级,checkpoint 仍返回 id(内存已存)。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    mgr = _make_manager(db_url="postgresql://fake")
    mgr._pool = _FakePool(_FakeConn(error=RuntimeError("pg down")))
    mgr._table_ready = True

    with caplog.at_level(logging.WARNING):
        cid = await mgr.save_checkpoint("s-pg", 1, _sample_messages(), {}, "running")
    assert len(cid) == 32
    assert any("PG 写入失败" in r.getMessage() for r in caplog.records)
    # 内存中仍可读(降级不丢)
    cp = await mgr.load_checkpoint(cid)
    assert cp is not None


async def test_pg_ensure_table_idempotent(monkeypatch):
    """_ensure_table 首次执行 3 条 DDL,重复调用短路。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    mgr = _make_manager(db_url="postgresql://fake")
    conn = _FakeConn()
    mgr._pool = _FakePool(conn)

    await mgr._ensure_table()
    assert mgr._table_ready is True
    assert len(conn.executed) == 3
    assert all("IF NOT EXISTS" in sql for sql, _ in conn.executed)

    executed_after_first = len(conn.executed)
    await mgr._ensure_table()  # 短路,不再执行 DDL
    assert len(conn.executed) == executed_after_first


async def test_pg_load_fallback_backfills_memory(monkeypatch):
    """内存 miss → PG 兜底查命中 → 返回并回填内存缓存(二次读走内存)。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    payload = _pg_payload()
    mgr = _make_manager(db_url="postgresql://fake")
    conn = _FakeConn(rows=[_pg_row_from_payload(payload)])
    mgr._pool = _FakePool(conn)
    mgr._table_ready = True

    cp = await mgr.load_checkpoint("cp-pg-1")
    assert cp is not None
    assert cp.checkpoint_id == "cp-pg-1"
    assert cp.session_id == "s-pg"
    assert cp.iteration == 2
    assert cp.status == "paused"
    assert cp.metadata == {"k": "v"}
    assert len(conn.executed) == 1
    # 回填后二次读走内存,不再查 PG
    cp_again = await mgr.load_checkpoint("cp-pg-1")
    assert cp_again is cp
    assert len(conn.executed) == 1


async def test_pg_load_expired_row_returns_none(monkeypatch):
    """PG 行已过期 → 返回 None(清理留给 cleanup_expired)。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    payload = _pg_payload(expires_at=time.time() - 1)
    mgr = _make_manager(db_url="postgresql://fake")
    mgr._pool = _FakePool(_FakeConn(rows=[_pg_row_from_payload(payload)]))
    mgr._table_ready = True

    assert await mgr.load_checkpoint("cp-pg-1") is None


async def test_pg_load_failure_degrades(monkeypatch):
    """PG 查询异常 → 返回 None 降级,不阻塞调用方。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    mgr = _make_manager(db_url="postgresql://fake")
    mgr._pool = _FakePool(_FakeConn(error=RuntimeError("pg down")))
    mgr._table_ready = True

    assert await mgr.load_checkpoint("cp-pg-1") is None


async def test_pg_load_latest_by_session(monkeypatch):
    """内存索引 miss → PG 按 session 查最新(ORDER BY created_at DESC LIMIT 1)。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    payload = _pg_payload()
    mgr = _make_manager(db_url="postgresql://fake")
    conn = _FakeConn(rows=[_pg_row_from_payload(payload)])
    mgr._pool = _FakePool(conn)
    mgr._table_ready = True

    cp = await mgr.load_latest_by_session("s-pg")
    assert cp is not None
    assert cp.checkpoint_id == "cp-pg-1"
    sql, params = conn.executed[0]
    assert "ORDER BY created_at DESC LIMIT 1" in sql
    assert params == ("s-pg",)
    # 回填内存索引
    assert mgr._session_index["s-pg"] == "cp-pg-1"


async def test_pg_delete_executes(monkeypatch):
    """delete_checkpoint 同步删除 PG 行(尽力,失败不阻塞)。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    mgr = _make_manager(db_url="postgresql://fake")
    conn = _FakeConn()
    mgr._pool = _FakePool(conn)
    mgr._table_ready = True
    cid = await mgr.save_checkpoint("s-pg", 1, _sample_messages(), {}, "running")

    deleted = await mgr.delete_checkpoint(cid)
    assert deleted is True
    sql, params = next(e for e in conn.executed if e[0].startswith("DELETE"))
    assert params == (cid,)


async def test_pg_cleanup_expired_executes(monkeypatch):
    """cleanup_expired 同步清理 PG 过期行(expires_at <= now)。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    mgr = _make_manager(db_url="postgresql://fake")
    conn = _FakeConn()
    mgr._pool = _FakePool(conn)
    mgr._table_ready = True
    # 塞一个已过期 checkpoint 到内存
    mgr._checkpoints["exp-1"] = AgentLoopCheckpoint(
        checkpoint_id="exp-1",
        session_id="s-exp",
        iteration=1,
        messages=[],
        tool_state={},
        status="running",
        created_at=time.time() - 100,
        expires_at=time.time() - 50,
    )

    cleaned = await mgr.cleanup_expired()
    assert cleaned == 1
    sql, params = conn.executed[0]
    assert sql.startswith("DELETE FROM agent_checkpoints WHERE expires_at")
    assert datetime.fromisoformat(params[0]).tzinfo is not None


async def test_close_closes_pg_pool(monkeypatch):
    """close() 关闭 PG 连接池并置空。"""
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    mgr = _make_manager(db_url="postgresql://fake")
    pool = _FakePool(_FakeConn())
    mgr._pool = pool

    await mgr.close()
    assert pool.closed is True
    assert mgr._pool is None


async def test_singleton_reads_settings_database_url(monkeypatch):
    """D26:全局单例 db_url 来自 settings.database_url(空串禁用 PG)。"""
    from app.core.config import settings

    _reset_global_manager_for_test()
    monkeypatch.setattr(settings, "database_url", "postgresql://singleton-test")
    mgr = get_agent_checkpoint_manager()
    assert mgr._db_url == "postgresql://singleton-test"
    # 空串 → db_url=None(PG 持久层禁用)
    _reset_global_manager_for_test()
    monkeypatch.setattr(settings, "database_url", "")
    mgr2 = get_agent_checkpoint_manager()
    assert mgr2._db_url is None
    assert mgr2._use_pg is False
    _reset_global_manager_for_test()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

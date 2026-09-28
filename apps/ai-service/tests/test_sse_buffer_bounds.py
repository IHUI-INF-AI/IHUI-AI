# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""SSE 缓冲区的容量与续传语义回归(2026-09-27)。

对应 ``app/core/sse_buffer.py`` 头注的三处病灶,每条病灶各有一对正反用例:

1. 双上限(条数 / 字节)溢出丢最旧,且 **dropped 必须可见**(属性出口 + 日志);
2. 续传三态:锚点被丢弃或不属于本 task ⇒ ``not_resumable`` 且**一帧历史都不发**
   (旧实现"未找到就返回全部",即客户端看到的"会话内容翻倍");
3. 两条到期锚点:空闲 TTL(结束后仍可重放的窗口)与存活上限(**活跃任务也会到期**,
   旧实现的时间戳被每次 append 无限续期,所以 TTL 对长任务永不触发)。

本文件只测纯内存的缓冲区,不碰 HTTP、不碰数据库(§5 测试隔离铁律:禁止连生产 PG 8810 /
Redis 8811,这里按构造即零依赖)。
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import pytest

from app.core.sse_buffer import (
    REPLAY_HIT,
    REPLAY_NOT_RESUMABLE,
    REPLAY_UNKNOWN_TASK,
    SSEEventBuffer,
    sse_buffer,
)


def _chunk(text: str) -> dict[str, str]:
    return {"type": "chunk", "content": text}


# =============================================================================
# 病灶 1:双上限 + 溢出丢最旧且计数
# =============================================================================


def test_event_cap_drops_oldest_and_counts() -> None:
    """条数上限:超出即丢最旧,dropped_events 计数正确,保留的是最新那段尾部。"""
    buf = SSEEventBuffer(max_events_per_task=3, max_bytes_per_task=10**9)
    for i in range(1, 6):
        buf.append("task-1", _chunk(f"e{i}"))

    kept = buf.get_all("task-1")
    assert [e["id"] for e in kept] == ["task-1-3", "task-1-4", "task-1-5"]
    assert buf.dropped_events("task-1") == 2
    # 上限是"硬"的:再写一条仍然只留 3 条
    buf.append("task-1", _chunk("e6"))
    assert len(buf.get_all("task-1")) == 3
    assert buf.dropped_events("task-1") == 3


def test_within_cap_keeps_everything_and_dropped_is_zero() -> None:
    """反向对照:未超上限时一条不丢,dropped 恒 0(证明计数不是随手加的装饰)。"""
    buf = SSEEventBuffer(max_events_per_task=10, max_bytes_per_task=10**9)
    for i in range(3):
        buf.append("task-1", _chunk(f"e{i}"))
    assert len(buf.get_all("task-1")) == 3
    assert buf.dropped_events("task-1") == 0


def test_byte_cap_bounds_large_payloads() -> None:
    """字节上限:条数远未触顶也会被字节账挤掉(挡的是"大而少"的那种事件)。"""
    big = "x" * 400
    buf = SSEEventBuffer(max_events_per_task=10_000, max_bytes_per_task=500)
    for _ in range(5):
        buf.append("task-1", _chunk(big))

    kept = buf.get_all("task-1")
    assert len(kept) < 5, "字节上限没起作用"
    assert len(kept) >= 1, "至少必须保留最新一条"
    assert kept[-1]["id"] == "task-1-5"
    assert buf.dropped_events("task-1") == 5 - len(kept)


def test_single_oversized_event_is_still_buffered() -> None:
    """单独一条就超字节上限时不得把自己挤出去 —— 那会把"有界"做成"缓冲区永远为空"。"""
    buf = SSEEventBuffer(max_bytes_per_task=10)
    eid = buf.append("task-1", _chunk("y" * 500))
    assert [e["id"] for e in buf.get_all("task-1")] == [eid]
    assert buf.dropped_events("task-1") == 0


# =============================================================================
# 病灶 2:续传三态(未命中不再全量重放)
# =============================================================================


def test_hit_returns_only_events_after_anchor() -> None:
    """正常续传:锚点在缓冲内 ⇒ 只返回其后的事件,且带 dropped 账。"""
    buf = SSEEventBuffer()
    buf.append("task-1", _chunk("a"))
    anchor = buf.append("task-1", _chunk("b"))
    buf.append("task-1", _chunk("c"))
    last = buf.append("task-1", _chunk("d"))

    outcome = buf.replay_outcome("task-1", anchor)
    assert outcome.status == REPLAY_HIT
    assert outcome.resumable is True
    assert [e["id"] for e in outcome.events] == ["task-1-3", "task-1-4"]
    assert outcome.dropped == 0
    # 锚点就是最后一帧 ⇒ 命中且无缺口(与"不可续传"同为一个空列表,靠 status 区分)
    tail = buf.replay_outcome("task-1", last)
    assert tail.status == REPLAY_HIT
    assert tail.events == []


def test_stale_anchor_is_not_resumable_and_returns_nothing() -> None:
    """陈旧 Last-Event-ID(已被上限丢弃)⇒ not_resumable + 空列表,绝不再灌整段历史。"""
    buf = SSEEventBuffer(max_events_per_task=2, max_bytes_per_task=10**9)
    dropped_id = buf.append("task-1", _chunk("a"))
    buf.append("task-1", _chunk("b"))
    buf.append("task-1", _chunk("c"))  # 挤出 dropped_id

    outcome = buf.replay_outcome("task-1", dropped_id)
    assert outcome.status == REPLAY_NOT_RESUMABLE
    assert outcome.events == [], "不可续传时返回事件 = 会话内容翻倍的入口"
    assert outcome.resumable is False
    assert outcome.dropped == 1, "丢弃条数必须随结局一起回给上层"
    assert outcome.reason and "丢弃" in outcome.reason
    # 兼容出口同形:replay_after 只是"命中事件"的投影,未命中一律空
    assert buf.replay_after("task-1", dropped_id) == []


def test_unknown_event_id_is_not_resumable() -> None:
    """序号越界的 Last-Event-ID(从未存在过)⇒ not_resumable,不是"返回全部"。"""
    buf = SSEEventBuffer()
    buf.append("task-1", _chunk("a"))
    buf.append("task-1", _chunk("b"))

    outcome = buf.replay_outcome("task-1", "task-1-999")
    assert outcome.status == REPLAY_NOT_RESUMABLE
    assert outcome.events == []

    # id 形态与本 task 不符(客户端串了别的 task 的 id)同样是不可续传
    other = buf.replay_outcome("task-1", "task-2-1")
    assert other.status == REPLAY_NOT_RESUMABLE
    assert other.events == []


def test_anchor_still_present_after_partial_drop_resumes() -> None:
    """正面对照:丢了更早的事件,但锚点还在 ⇒ 仍然 hit,且如实带上丢了几条。"""
    buf = SSEEventBuffer(max_events_per_task=3, max_bytes_per_task=10**9)
    for i in range(5):
        buf.append("task-1", _chunk(f"e{i}"))

    outcome = buf.replay_outcome("task-1", "task-1-3")
    assert outcome.status == REPLAY_HIT
    assert [e["id"] for e in outcome.events] == ["task-1-4", "task-1-5"]
    assert outcome.dropped == 2 and outcome.truncated is True


def test_no_anchor_replays_buffered_and_reports_truncation() -> None:
    """未给 Last-Event-ID = 主动要求从头重放现存缓冲;丢过就得在结局里说清楚。"""
    buf = SSEEventBuffer(max_events_per_task=2, max_bytes_per_task=10**9)
    buf.append("task-1", _chunk("a"))
    buf.append("task-1", _chunk("b"))
    buf.append("task-1", _chunk("c"))

    outcome = buf.replay_outcome("task-1", None)
    assert outcome.status == REPLAY_HIT
    assert [e["id"] for e in outcome.events] == ["task-1-2", "task-1-3"]
    assert outcome.dropped == 1
    assert outcome.reason is not None, "截断过的重放不得给出一条「看起来完整」的结论"


# =============================================================================
# 病灶 2/3 交界:task 不存在 / 已到期 ⇒ unknown_task
# =============================================================================


def test_unknown_task_returns_unknown_status() -> None:
    """从未写入过的 task ⇒ unknown_task(与 not_resumable 是两个结局,不得混)。"""
    buf = SSEEventBuffer()
    outcome = buf.replay_outcome("nope", None)
    assert outcome.status == REPLAY_UNKNOWN_TASK
    assert outcome.events == [] and outcome.resumable is False


def test_cleared_task_returns_unknown_status() -> None:
    """流收尾 clear 之后再重连 ⇒ unknown_task(旧实现同样返回空,但现在有明确身份)。"""
    buf = SSEEventBuffer()
    eid = buf.append("task-1", _chunk("a"))
    buf.clear("task-1")
    assert buf.replay_outcome("task-1", eid).status == REPLAY_UNKNOWN_TASK


def test_idle_ttl_still_expires_finished_task() -> None:
    """空闲 TTL 语义保留:距最后活动超过 ttl_seconds 即清理(结束后 ttl 秒内可重放)。"""
    buf = SSEEventBuffer(ttl_seconds=1, cleanup_interval=0, max_lifetime_seconds=3600)
    eid = buf.append("task-done", _chunk("a"))
    time.sleep(1.1)
    buf.append("someone-else", _chunk("b"))  # 触发惰性清理

    assert buf.get_all("task-done") == []
    assert buf.replay_outcome("task-done", eid).status == REPLAY_UNKNOWN_TASK


def test_active_task_still_expires_by_lifetime() -> None:
    """核心回归:持续写入的活跃任务**也**要能被判过期。

    旧实现把时间戳记成"最后更新时间"、清理判据是 ``now - ts > ttl``,于是这条用例在
    旧代码上必然失败(空闲锚点每 0.5s 被刷新一次,3600s 的 TTL 永不触发)。
    """
    buf = SSEEventBuffer(ttl_seconds=3600, max_lifetime_seconds=1, cleanup_interval=0)
    first_eid = buf.append("run-long", _chunk("a"))
    time.sleep(0.6)
    buf.append("run-long", _chunk("b"))  # 刷新空闲锚点(旧实现在这里就把生命周期续走了)
    time.sleep(0.6)

    buf.append("run-other", _chunk("z"))  # 触发惰性清理
    assert buf.get_all("run-long") == []
    assert buf.replay_outcome("run-long", first_eid).status == REPLAY_UNKNOWN_TASK


def test_within_lifetime_recent_task_survives() -> None:
    """反向对照:存活上限没到、空闲也没到 ⇒ 不得被清理(证明新锚点不是"一律杀")。"""
    buf = SSEEventBuffer(ttl_seconds=3600, max_lifetime_seconds=3600, cleanup_interval=0)
    eid = buf.append("run-new", _chunk("a"))
    time.sleep(0.1)
    buf.append("run-other", _chunk("z"))  # 触发惰性清理
    assert len(buf.get_all("run-new")) == 1
    # 锚点仍是唯一那条 ⇒ 结局必须是 hit 且无缺口,而不是"任务不存在"
    outcome = buf.replay_outcome("run-new", eid)
    assert outcome.status == REPLAY_HIT
    assert outcome.events == [] and outcome.dropped == 0


# =============================================================================
# 上层接线:routers/agents.py 的 replay 分支把三态接成真实回退路径
# (直接驱动 event_generator,不起 HTTP、不碰执行器、不连生产库)
# =============================================================================

_STALE_TASK = "task-stale"
_HIT_TASK = "task-hit"


def _frames(text: str) -> list[dict[str, Any]]:
    """把 SSE 文本解成 [{"id":..., "event":...}] 便于逐帧断言。"""
    out: list[dict[str, Any]] = []
    for block in text.split("\n\n"):
        eid: str | None = None
        data: str | None = None
        for line in block.splitlines():
            if line.startswith("id: "):
                eid = line[4:].strip()
            elif line.startswith("data: "):
                data = line[6:]
        if eid is not None and data is not None:
            out.append({"id": eid, "event": json.loads(data)})
    return out


@pytest.fixture(autouse=True)
def _clean_buffer_tasks() -> Any:
    """每个用例后清掉本文件写进全局单例的 task,避免跨用例串味。"""
    yield
    sse_buffer.clear(_STALE_TASK)
    sse_buffer.clear(_HIT_TASK)


def _call_stream(monkeypatch: pytest.MonkeyPatch, last_event_id: str) -> str:
    """调用 /agents/execute/stream 端点并收干 SSE 文本。

    AGENT_EXECUTOR 锁成非 loop_v2 ⇒ 走"执行器关闭"分支(只发 start / error / done),
    所以这三条用例只验 replay 分支的接线,不会真调 LLM,也不碰数据库(§5 测试隔离铁律)。
    """
    from app.routers.agents import AgentExecuteRequest, execute_agent_stream

    monkeypatch.setenv("AGENT_EXECUTOR", "langgraph")

    class _FakeRequest:
        """最小 Request 替身 —— 该路径上端点只读 request.headers。"""

        headers = {"last-event-id": last_event_id}

    async def _go() -> str:
        resp = await execute_agent_stream(
            AgentExecuteRequest(goal="重连回归用例", session_id="sess-reconnect-case"),
            _FakeRequest(),  # type: ignore[arg-type]
            current_user="user-1",
        )
        return "".join([chunk async for chunk in resp.body_iterator])

    return asyncio.run(_go())


def test_stream_refuses_stale_anchor_instead_of_reflowing_history(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """陈旧锚点(已被上限丢弃)⇒ 流里**一帧历史都不回灌**,并带上三态结论与丢弃条数。

    旧实现这里会把该 task 的整段缓冲再灌一遍(客户端按 id 追加 ⇒ 会话内容翻倍)。
    """
    for i in range(5):
        sse_buffer.append(_STALE_TASK, _chunk(f"old-{i}"))
    # 把条数上限压到 2,让锚点 task-stale-1 真的被丢弃(默认 500 条要写 501 条才触发)
    monkeypatch.setattr(sse_buffer, "_max_events", 2)
    sse_buffer.append(_STALE_TASK, _chunk("old-5"))
    assert sse_buffer.dropped_events(_STALE_TASK) >= 1

    text = _call_stream(monkeypatch, f"{_STALE_TASK}-1")
    frames = _frames(text)
    start = next(f for f in frames if f["event"].get("type") == "start")
    resume = start["event"]["resume"]
    assert resume["status"] == REPLAY_NOT_RESUMABLE
    assert resume["replayed_events"] == 0
    assert resume["dropped_events"] >= 1, "丢弃条数必须出现在响应里,不得静默变短"
    assert isinstance(resume["snapshot_endpoint"], str) and "sess-reconnect-case" in resume["snapshot_endpoint"]
    # 关键:没有任何一帧来自旧 task
    assert [f["id"] for f in frames if f["id"].startswith(f"{_STALE_TASK}-")] == []


def test_stream_replays_only_tail_after_hit_anchor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """正面对照:锚点在缓冲内 ⇒ 只补其后的事件,且 start 帧的 resume 说命中。"""
    for i in range(1, 5):
        sse_buffer.append(_HIT_TASK, _chunk(f"h{i}"))

    text = _call_stream(monkeypatch, f"{_HIT_TASK}-2")
    replayed = [f["id"] for f in _frames(text) if f["id"].startswith(f"{_HIT_TASK}-")]
    assert replayed == [f"{_HIT_TASK}-3", f"{_HIT_TASK}-4"]
    start = next(f for f in _frames(text) if f["event"].get("type") == "start")
    assert start["event"]["resume"]["status"] == REPLAY_HIT
    assert start["event"]["resume"]["replayed_events"] == 2


def test_stream_reports_unknown_task_and_still_starts_fresh(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """task 不存在 ⇒ 明确 unknown_task(不是"看起来命中"),并按既有语义另开一次 run。"""
    text = _call_stream(monkeypatch, "task-never-existed-7")
    frames = _frames(text)
    start = next(f for f in frames if f["event"].get("type") == "start")
    assert start["event"]["resume"]["status"] == REPLAY_UNKNOWN_TASK
    assert start["event"]["resume"]["replayed_events"] == 0
    assert start["event"]["resume_from"] == "task-never-existed-7"

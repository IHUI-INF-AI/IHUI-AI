# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D119 主聊天并行工具调用下放 —— 预取行为与只读白名单单源的验收证据。

票面缺口:实现已在 `app/routers/llm.py`(同批只读工具 `asyncio.gather` 预取,结果按
toolCallId 缓存供主循环命中),但 `git grep "_readonly_prefetch"` 在 tests 面零命中
⇒ 没人钉住"它真的并行了"和"白名单没被复算第二份"。本文件补三格,缺一不算验收:

1. **正向** —— 同批 N 枚只读工具确实**并行发起**:用共享计数 mock 量 `max_concurrent`
   (串行实现恒为 1,并行实现 = 批内枚数),再用"全部发起早于首个结束"的调用序二次
   证明;时间窗口只作第三信号且留 ≥3 倍余量,不承担判责。
2. **反向对照(本案最重要)** —— 混入一枚**不在只读白名单**的写类工具:它不得进并行批,
   必须在预取批次**整体结束之后**、于主循环里被**单独调用一次**。这同时证明两件事:
   没越权把写操作并行发出去,也没被"预取 + 主循环"重复执行(双份副作用)。
   少了这一格,测试只证明"跑得快",不证明"没越权"。
3. **单源** —— 预取的白名单只认 `core/permission_mode._readonly_tools()` 这一个出口:
   - 对象同一性:它就是 `services/plan_mode.READONLY_TOOLS`(第二份必然漂移,§0.6/§22c);
   - 接线证明:**改写这个出口,预取行为必须跟着改**(置空 ⇒ 退回逐个串行;换成非只读
     名字 ⇒ 那些名字进并行批)。把名单抄在别处的实现过不了这一格。

不打真实网络/数据库(§5 测试隔离铁律):LLM 面 `astream` 与 MCP 面 `call_tool` 全程
mock;conftest 的 autouse fixture 已清 vendor key 并 mock 掉 `_resolve_from_db`;经
`ASGITransport` 直连 app,不启端口。
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from httpx import AsyncClient

from app.core.permission_mode import _readonly_tools
from app.routers import llm as llm_router
from app.routers.llm import (
    _DELEGATE_ONLY_TOOLS,
    _FILE_EDIT_PREVIEW_TOOLS,
    _MCP_TOOL_NAMES,
    _PLUGIN_TOOL_NAMES,
    _TERMINAL_TOOL_NAMES,
    _TOOL_DANGER_LEVELS,
)
from app.services.mcp_server import _FORM_REQUEST_TOOL_NAME, _TOOL_ALIASES
from app.services.mcp_server import mcp_server as _mcp
from app.services.plan_mode import READONLY_TOOLS

# 每枚工具的模拟耗时:足够长以便计数窗口稳定分辨"并行 vs 串行",又足够短不拖慢用例。
_SLEEP_S = 0.15

# 循环内有**专用分支**、不走通用 `_mcp.call_tool` 路径的工具(与本案判据无关,故从
# 候选池排除)。这是"排除项",不是"只读名单副本" —— 白名单判据全程只问 _readonly_tools()。
_LOOP_SPECIAL_TOOLS: tuple[str, ...] = ("dispatch_subagent", _FORM_REQUEST_TOOL_NAME)


# ---------------------------------------------------------------------------
# SSE / 请求夹具(与 tests/test_streaming_tool_loop.py 同模式)
# ---------------------------------------------------------------------------


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    """把 SSE 原文解析成 [{"event": 类型, "data": 载荷}, ...]。"""
    events: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
        if not block.strip():
            continue
        event_type: str | None = None
        data: Any = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                try:
                    data = json.loads(data_str)
                except (json.JSONDecodeError, ValueError):
                    data = data_str
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


async def _stream_chat(client: AsyncClient, body: dict[str, Any]) -> str:
    """调用 /api/llm/complete/stream 并返回原始 SSE 文本。"""
    resp = await client.post("/api/llm/complete/stream", json=body)
    assert resp.status_code == 200, f"流入口应 200,实得 {resp.status_code}:{resp.text[:400]}"
    return resp.text


def _tool_call(tc_id: str, name: str, query: str) -> dict[str, Any]:
    """构造 OpenAI tool_calls 单项(arguments 各枚不同,避免撞上循环的重复调用去重)。"""
    return {
        "index": 0,
        "id": tc_id,
        "type": "function",
        "function": {"name": name, "arguments": json.dumps({"q": query}, ensure_ascii=False)},
    }


def _make_astream_yielding(tool_calls: list[dict[str, Any]]) -> tuple[dict[str, Any], Any]:
    """状态化 astream mock:第一轮抛 tool_calls,第二轮(结果回灌后)正常收尾。

    返回 (state, mock);state["rounds"] 记录 astream 被调用次数。
    """
    state: dict[str, Any] = {"rounds": 0}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        state["rounds"] += 1
        if state["rounds"] == 1:
            yield {"type": "tool_calls", "tool_calls": tool_calls}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}
        else:
            yield {"type": "chunk", "content": "已完成"}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "stub": True,
            }

    return state, mock_astream


async def _forbid_non_streaming_complete(messages=None, model=None, **kwargs):
    """回归守卫:本用例走的是流式通道,不得回落到非流式 complete()。"""
    raise AssertionError("D119 用例不应触发非流式 complete()")


def _make_counting_call_tool(sleep_s: float) -> tuple[dict[str, Any], Any]:
    """共享计数 + 等长 sleep 的 call_tool mock —— 确定性判并发,不靠时间戳竞态。

    串行实现下 max_concurrent 恒为 1;并行实现下 = 批内枚数。
    events 逐条记 (phase, name, active_after_update, monotonic_time)。
    """
    state: dict[str, Any] = {"active": 0, "max_concurrent": 0, "events": []}

    async def fake_call_tool(
        name: str, arguments: dict | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        loop = asyncio.get_running_loop()
        state["active"] += 1
        state["max_concurrent"] = max(state["max_concurrent"], state["active"])
        state["events"].append(("start", name, state["active"], loop.time()))
        await asyncio.sleep(sleep_s)
        state["active"] -= 1
        state["events"].append(("end", name, state["active"], loop.time()))
        return {"tool": name, "ok": True, "d119_probe": True, "args": arguments or {}}

    return state, fake_call_tool


def _starts_of(state: dict[str, Any], names: list[str]) -> list[tuple[str, int, float]]:
    """按发生序取这些名字的 (name, active_at_start, t_start)。"""
    return [(e[1], e[2], e[3]) for e in state["events"] if e[0] == "start" and e[1] in names]


def _first_end_of(state: dict[str, Any], names: list[str]) -> float | None:
    for e in state["events"]:
        if e[0] == "end" and e[1] in names:
            return e[3]
    return None


def _all_start_before_first_end(state: dict[str, Any], names: list[str]) -> bool:
    """批内**每一枚**都已发起,才有第一枚结束 —— 串行的发起/结束必然交替。"""
    ends = _first_end_of(state, names)
    starts = _starts_of(state, names)
    if ends is None or len(starts) != len(names):
        return False
    return all(t <= ends for (_n, _a, t) in starts)


def _count_of_calls(state: dict[str, Any], name: str) -> int:
    return sum(1 for e in state["events"] if e[0] == "start" and e[1] == name)


def _frame_values(events: list[dict[str, Any]], event_type: str, key: str) -> list[Any]:
    return [
        e["data"][key]
        for e in events
        if e["event"] == event_type and isinstance(e["data"], dict) and key in e["data"]
    ]


# ---------------------------------------------------------------------------
# 候选工具名:全部从**生产出口/生产表**现取,测试侧不抄任何一份名单
# ---------------------------------------------------------------------------


def _plain_call_path(name: str) -> bool:
    """该名字是否走循环里那条通用的 `_mcp.call_tool` 路径(排除各专用分支族)。

    排除项一律来自生产常量:`_TOOL_ALIASES`(归一后变形意味着模型写的不是注册名)、
    `_TERMINAL_TOOL_NAMES`(终端 delta 直投分支)、`_DELEGATE_ONLY_TOOLS`(无
    workspace_context 时直接被委托拦截)、`_FILE_EDIT_PREVIEW_TOOLS`(掺 diff 预览帧)、
    `_PLUGIN_TOOL_NAMES`(插件族,上游另有句柄闸)、`_MCP_TOOL_NAMES`(必须已注册)。
    """
    if _TOOL_ALIASES.get(name, name) != name:
        return False
    if name in _TERMINAL_TOOL_NAMES or name in _DELEGATE_ONLY_TOOLS:
        return False
    if name in _FILE_EDIT_PREVIEW_TOOLS or name in _PLUGIN_TOOL_NAMES:
        return False
    if name in _LOOP_SPECIAL_TOOLS:
        return False
    return name in _MCP_TOOL_NAMES


def _readonly_batch(count: int) -> list[str]:
    """从唯一白名单出口 `_readonly_tools()` 里现取 count 枚只读工具名。"""
    pool = [n for n in sorted(_readonly_tools()) if _plain_call_path(n)]
    if len(pool) < count:
        pytest.fail(
            f"生产只读出口里可直连 call_tool 的候选不足 {count} 枚(现读 {len(pool)} 枚)"
            "⇒ 用例前提不成立,判未判定而非静默通过"
        )
    return pool[:count]


def _non_readonly_write_name() -> str:
    """取一枚**不在只读白名单**、且主循环会正常执行的写类工具名(生产危险级表求差)。"""
    pool = [
        n
        for n in sorted(_TOOL_DANGER_LEVELS)
        if _plain_call_path(n) and n not in _readonly_tools()
    ]
    if not pool:
        pytest.fail("危险级表里找不到任何非只读且走通用路径的工具 ⇒ 反向对照无法构造,判未判定")
    return pool[0]


def _non_readonly_plain_batch(count: int) -> list[str]:
    """取 count 枚**不在只读白名单**、且默认档免审批的普通已注册工具名(单源改写实验用)。"""
    pool = [
        n
        for n in sorted(_MCP_TOOL_NAMES)
        if _plain_call_path(n)
        and n not in _readonly_tools()
        and not llm_router._resolve_tool_approval(None, n)[0]
    ]
    if len(pool) < count:
        pytest.fail(f"非只读候选不足 {count} 枚(现读 {len(pool)} 枚)⇒ 判未判定,不静默放行")
    return pool[:count]


# ===========================================================================
# 1. 正向:同批只读工具真的并行预取,且结果被主循环复用(不重复执行)
# ===========================================================================


async def test_d119_same_batch_readonly_tools_are_prefetched_in_parallel(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """同批 3 枚只读工具:并行发起(计数=3)+ 每枚只执行一次 + SSE 帧序不变。"""
    names = _readonly_batch(3)
    calls = [_tool_call(f"call_{i + 1}", n, f"kw-{i + 1}") for i, n in enumerate(names)]

    stream_state, mock_astream = _make_astream_yielding(calls)
    tool_state, fake_call_tool = _make_counting_call_tool(_SLEEP_S)
    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "complete", _forbid_non_streaming_complete)
    monkeypatch.setattr(_mcp, "call_tool", fake_call_tool)

    raw = await _stream_chat(
        client,
        {
            "messages": [{"role": "user", "content": "并行预取正向"}],
            "model": "test-model",
            "agent_tools": list(names),
        },
    )
    events = _parse_sse_events(raw)

    # 前置条件自证:3 枚都确实进了 call_tool(否则"并行"是空断言)
    assert [n for (n, _a, _t) in _starts_of(tool_state, names)] == names, (
        f"预期 3 枚只读工具都发起执行,实际事件 {tool_state['events']}"
    )
    # 判据①(主):共享计数 —— 串行实现这里恒为 1
    assert tool_state["max_concurrent"] == len(names), (
        f"D119 未把同批只读工具并行下放:max_concurrent={tool_state['max_concurrent']}"
        f"(期望 {len(names)}),调用序 {tool_state['events']}"
    )
    # 判据②(主):全部发起早于首个结束 —— 串行实现下 start/end 必然交替
    assert _all_start_before_first_end(tool_state, names), (
        f"同批只读工具呈串行序(发起/结束交替):{tool_state['events']}"
    )
    # 判据③(次,余量 ≥3 倍):批次实际跨度显著小于逐个串行之和
    serial_sum = _SLEEP_S * len(names)
    span = tool_state["events"][-1][3] - tool_state["events"][0][3]
    assert span < serial_sum, (
        f"批次跨度 {span:.3f}s 不低于串行之和 {serial_sum:.3f}s ⇒ 并行未生效"
        "(此条只作第二信号,判责以计数与调用序为准)"
    )
    # 判据④:预取结果被主循环按 toolCallId 复用 —— 每枚**只执行一次**
    for n in names:
        assert _count_of_calls(tool_state, n) == 1, (
            f"{n} 被调用 {_count_of_calls(tool_state, n)} 次(应为 1):预取缓存未被复用"
        )

    # 判据⑤:SSE 帧序不变(start/result 仍按 tool_calls 原序),且都是 mock 结果
    assert _frame_values(events, "tool-call-start", "toolName") == names
    result_frames = [e for e in events if e["event"] == "tool-result"]
    assert [e["data"]["toolName"] for e in result_frames] == names
    assert [e["data"]["toolCallId"] for e in result_frames] == [
        f"call_{i + 1}" for i in range(len(names))
    ]
    assert all(e["data"]["isError"] is False for e in result_frames)
    assert all(e["data"]["result"].get("d119_probe") is True for e in result_frames)
    # 流正常收尾:第二轮 astream 真流式 + done
    assert stream_state["rounds"] == 2
    assert len([e for e in events if e["event"] == "done"]) == 1


# ===========================================================================
# 2. 反向对照:白名单外的写类工具绝不并入并行预取
# ===========================================================================


async def test_d119_tool_outside_readonly_whitelist_is_never_joined_into_prefetch(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """同批混入一枚写类工具:它不得被并行发出去,必须在预取批次之后单独执行一次。

    permission_mode='bypass-permissions' 是为了让这枚写工具在主循环里**正常执行**
    (不弹审批、不被拦死)—— 本案要证的是"没被并行下放",不是"没被放行"。
    """
    readonly_names = _readonly_batch(2)
    write_name = _non_readonly_write_name()

    # 判据来自生产出口本身,测试不复算:这枚名字当下确实不在只读白名单里
    assert write_name not in _readonly_tools(), (
        f"用例前提已腐烂:{write_name} 现在竟在 _readonly_tools() 里,反向对照需换名"
    )

    # 顺序特意把写类工具夹在中间:并行/串行都不能靠"恰好排在末尾"蒙过这一格
    ordered_names = [readonly_names[0], write_name, readonly_names[1]]
    calls = [
        _tool_call(f"call_{i + 1}", n, f"kw-{i + 1}") for i, n in enumerate(ordered_names)
    ]

    stream_state, mock_astream = _make_astream_yielding(calls)
    tool_state, fake_call_tool = _make_counting_call_tool(_SLEEP_S)
    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "complete", _forbid_non_streaming_complete)
    monkeypatch.setattr(_mcp, "call_tool", fake_call_tool)

    raw = await _stream_chat(
        client,
        {
            "messages": [{"role": "user", "content": "并行预取反向对照"}],
            "model": "test-model",
            "agent_tools": list(ordered_names),
            "permission_mode": "bypass-permissions",
        },
    )
    events = _parse_sse_events(raw)

    assert stream_state["rounds"] == 2, "工具循环未走完(第一轮 tool_calls + 第二轮收尾)"

    # ① 并行批的规模只等于只读枚数:写类工具一旦混进 gather,这里会变成 3
    assert tool_state["max_concurrent"] == len(readonly_names), (
        f"写类工具 {write_name} 被并入了并行预取:max_concurrent="
        f"{tool_state['max_concurrent']}(只读批只有 {len(readonly_names)} 枚)"
    )
    # ② 只读批仍真的并行(证明①不是因为"整批退化成串行"而虚假通过 —— 正向对照)
    assert _all_start_before_first_end(tool_state, readonly_names), (
        f"只读批退化成串行,反向对照失去意义:{tool_state['events']}"
    )
    # ③ 写类工具发起时:并行批已整体结束(active=0),且它自己不与任何调用重叠
    write_starts = [e for e in tool_state["events"] if e[0] == "start" and e[1] == write_name]
    assert len(write_starts) == 1, (
        f"{write_name} 被执行 {len(write_starts)} 次(应为 1):"
        "预取 + 主循环重复执行 = 双份副作用"
    )
    active_at_write_start = write_starts[0][2]
    write_start_ts = write_starts[0][3]
    assert active_at_write_start == 1, (
        f"{write_name} 发起瞬间已有 {active_at_write_start - 1} 枚工具在飞"
        f"⇒ 它与并行批重叠了:{tool_state['events']}"
    )
    readonly_ends = [e[3] for e in tool_state["events"] if e[0] == "end" and e[1] in readonly_names]
    assert len(readonly_ends) == len(readonly_names)
    assert all(t <= write_start_ts for t in readonly_ends), (
        f"写类工具先于只读批结束就发起 ⇒ 它被卷进了同一批:{tool_state['events']}"
    )
    # ④ 每枚只读工具仍只执行一次(缓存被复用)
    for n in readonly_names:
        assert _count_of_calls(tool_state, n) == 1, f"{n} 被重复执行(预取缓存未命中)"
    # ⑤ 写类工具**照常执行**,只是不被并行下放:结果不得被打成拦截/失败
    result_frames = [e for e in events if e["event"] == "tool-result"]
    write_results = [e for e in result_frames if e["data"]["toolName"] == write_name]
    assert len(write_results) == 1
    assert write_results[0]["data"]["isError"] is False
    assert write_results[0]["data"]["result"].get("d119_probe") is True
    # ⑥ 帧序仍按 tool_calls 原序(并行只改执行发起时机,不改协议)
    assert _frame_values(events, "tool-call-start", "toolName") == ordered_names
    assert [e["data"]["toolName"] for e in result_frames] == ordered_names


# ===========================================================================
# 3. 单源:白名单只有那一份,而且预取每次现读它
# ===========================================================================


def test_d119_readonly_whitelist_is_one_object_not_a_second_copy() -> None:
    """`_readonly_tools()` 就是 plan_mode.READONLY_TOOLS 同一个对象(§0.6 单一真相源)。"""
    assert _readonly_tools() is READONLY_TOOLS
    assert isinstance(_readonly_tools(), frozenset)
    # 本用例使用的候选全部由该出口现取:非空即"判据有的放矢"
    assert _readonly_batch(1), "只读出口为空 ⇒ 无从构造正向用例"


async def test_d119_prefetch_reads_the_single_whitelist_source_at_request_time(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """改写那个出口,预取行为必须跟着改 ⇒ 白名单确实只有这一处被消费。

    - 出口置空:同批只读工具退回逐个串行(max_concurrent=1),但执行结果照常;
    - 出口换成非只读名字:这些名字进并行批(max_concurrent=批内枚数)。
    若实现另抄了一份名单,两档都会纹丝不动 ⇒ 翻红。
    """
    names = _readonly_batch(2)

    # ── 档 A:白名单为空 ⇒ 不并行(预取的闸门就是这个出口)
    stream_a, astream_a = _make_astream_yielding(
        [_tool_call(f"call_{i + 1}", n, f"kw-{i + 1}") for i, n in enumerate(names)]
    )
    state_a, call_a = _make_counting_call_tool(_SLEEP_S)
    monkeypatch.setattr(llm_router.llm_gateway, "astream", astream_a)
    monkeypatch.setattr(llm_router.llm_gateway, "complete", _forbid_non_streaming_complete)
    monkeypatch.setattr(_mcp, "call_tool", call_a)
    monkeypatch.setattr(llm_router, "_readonly_tools", lambda: frozenset())

    raw_a = await _stream_chat(
        client,
        {
            "messages": [{"role": "user", "content": "白名单置空"}],
            "model": "test-model",
            "agent_tools": list(names),
        },
    )
    assert stream_a["rounds"] == 2
    assert state_a["max_concurrent"] == 1, (
        f"白名单出口被置空后仍在并行发起(max_concurrent={state_a['max_concurrent']})"
        f"⇒ 预取读的不是这一个出口:{state_a['events']}"
    )
    assert [n for (n, _a, _t) in _starts_of(state_a, names)] == names
    for n in names:
        assert _count_of_calls(state_a, n) == 1
    # 白名单为空时结果仍照常回灌(退化为串行 ≠ 工具失败)
    assert all(
        e["data"]["isError"] is False
        for e in _parse_sse_events(raw_a)
        if e["event"] == "tool-result"
    )

    # ── 档 B:白名单换成非只读名字 ⇒ 那些名字进并行批(闸门跟着出口走)
    sentinels = _non_readonly_plain_batch(2)
    assert all(s not in READONLY_TOOLS for s in sentinels), "哨兵名必须当下确实非只读"
    stream_b, astream_b = _make_astream_yielding(
        [_tool_call(f"call_{i + 1}", n, f"kw-{i + 1}") for i, n in enumerate(sentinels)]
    )
    state_b, call_b = _make_counting_call_tool(_SLEEP_S)
    monkeypatch.setattr(llm_router.llm_gateway, "astream", astream_b)
    monkeypatch.setattr(_mcp, "call_tool", call_b)
    monkeypatch.setattr(llm_router, "_readonly_tools", lambda: frozenset(sentinels))

    await _stream_chat(
        client,
        {
            "messages": [{"role": "user", "content": "白名单改写"}],
            "model": "test-model",
            "agent_tools": list(sentinels),
        },
    )
    assert stream_b["rounds"] == 2
    assert state_b["max_concurrent"] == len(sentinels), (
        f"改写出口后 {sentinels} 没有进并行批(max_concurrent="
        f"{state_b['max_concurrent']})⇒ 预取另有第二份白名单"
    )
    assert _all_start_before_first_end(state_b, sentinels)
    for n in sentinels:
        assert _count_of_calls(state_b, n) == 1


# 守卫:本文件的候选池必须由生产表求得 —— 危险级表里至少一枚非只读且走通用路径,
# 否则第 2 格反向对照会退化成空断言(§0.3 枚举到 0 判死不记绿)。
def test_d119_test_fixture_pools_are_derived_not_copied() -> None:
    """形状锁:反向对照的候选来自生产危险级表,且与只读出口互不相交。"""
    assert _TOOL_DANGER_LEVELS, "生产危险级表为空 ⇒ 反向对照无法构造"
    assert not (set(_TOOL_DANGER_LEVELS) & set(_readonly_tools())), (
        "危险级表与只读白名单出现交集 ⇒ 两表口径已互相污染,须先修生产判据"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

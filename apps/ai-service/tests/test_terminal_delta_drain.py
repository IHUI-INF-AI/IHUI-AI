# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815938:SSE「排空在终态帧之前」的端点级看守(test_terminal_delta_drain)。

生产事实(llm.py 现读):tool loop 执行终端类工具(run_command)时,经
`set_terminal_stream_context(push=_delta_queue.put_nowait)` 注入 push 通道;
主生成器边等工具任务边排水转发,任务结束后还有一段「任务结束后排空残余
delta 帧」的排水臂(Grep 该注释现读定位),位于 `terminal_end` yield 之前。
此前这段顺序只靠注释活着 —— 本文件把它钉进可执行判据。

同一断言面同时覆盖 mcp_server `_drain_stream` 的 `_flush_pending()` 同型边界
(「末行不足 batch_lines 即 EOF ⇒ 尾部残余帧也必须冲出去」):夹具喂 3 行输出、
batch_lines=2 —— 第 1 帧("line-1\\nline-2\\n")来自批量边界冲刷,第 2 帧
("line-3\\n")**只能**来自 EOF 后的 `_flush_pending()` 尾部冲刷;两帧都必须
先于 terminal_end 到线。判据只有一份(delta 帧序列到齐 + 按到达序号先于
terminal_end),不为 `_flush_pending` 另立第二把尺子。

确定性构造(为什么 call_tool 桩是"同步函数返回已完成 Future"):若桩是真
async 任务,主生成器的排水轮询(wait_for 每次唤醒经 `queue.get()` 拿走一帧、
内层 while 排空其余)总会在任务结算前后把队列吃空,排水臂能否摸到残余纯属
时序运气 —— 那是时序耦合,不是看守。改用同步桩:主生成器在首个 `done()`
检查即跳过轮询、直落排水臂,恰是「任务已结算、残余帧还在队列」的确定性
等价场景,排水臂成为这些帧的唯一出口 —— 变异对照(注释排空臂)据此稳定翻红。

零生产依赖(测试隔离铁律):不连真实 LLM(astream/complete 打桩)、不碰真实
shell/子进程(`_FakeLineStream` 假流)、审批门按既有 W1 夹具同款短路;环境/DB
隔离由 tests/conftest.py 的 autouse 夹具承担。
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Coroutine
from typing import Any

import pytest
from httpx import AsyncClient

ENDPOINT = "/api/llm/complete/stream"
TOOL_CALL_ID = "tc_drain_001"
MESSAGE_ID = "msg-drain-001"
# 3 行输出 + batch_lines=2:前 2 行凑满批量即冲刷成 1 帧;
# 末行不足 batch_lines 便遇 EOF ⇒ 只能靠 _drain_stream 收尾的 _flush_pending()。
COMMAND_LINES = ["line-1", "line-2", "line-3"]
BATCH_LINES = 2
EXPECTED_DELTA_TEXTS = ["line-1\nline-2\n", "line-3\n"]


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    """把 SSE 正文切成 [{event, data}, ...](与相邻端点级测试同形,保到达序)。"""
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


class _FakeLineStream:
    """readline() 兼容假流:逐行返回 UTF-8 字节,耗尽即 EOF(b"")。

    read_protocol_frame 对只实现 readline() 的流走兼容支;每个 readline 都是
    「无真实挂起」的协程(await 立即返回的协程不向事件循环让位),使
    _drain_stream 全程可在一步内同步跑完 —— 同步桩的前提。
    """

    def __init__(self, lines: list[str]) -> None:
        self._pending = [line + "\n" for line in lines]

    async def readline(self) -> bytes:
        if self._pending:
            return self._pending.pop(0).encode("utf-8")
        return b""


def _run_without_real_suspension(coro: Coroutine[Any, Any, None]) -> None:
    """同步驱动一个「零真实挂起」协程到完成;出现真实挂起点即响亮失败。

    只有「await 未完成的 future」才会向事件循环让位;本夹具的假流让
    _drain_stream、_emit_terminal_delta(push 路径)全程无真实挂起。若生产码
    将来引入真实 await(或 push 通道缺失落到 hook_engine 分支),这里立即显式
    失败,而不是悄悄退化成时序耦合的假绿。
    """
    try:
        coro.send(None)
    except StopIteration:
        return
    coro.close()
    raise AssertionError(
        "协程出现真实挂起点:_drain_stream/_emit_terminal_delta 引入了真实 await"
        "(或 push 通道缺失落入 hook_engine 分支),同步驱动前提失效,夹具需重审"
    )


async def _drive_stream(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> tuple[str, list[str]]:
    """跑通端点流式链路,返回 (SSE 正文, on_line 实际收到的冲刷文本序列)。

    打桩点(零生产依赖):
    - llm_gateway.astream / complete:第一轮给 run_command tool_call,第二轮收尾;
    - _resolve_tool_approval:与既有 W1 夹具同款短路(审批门不在本票射程);
    - mcp_server 单例 call_tool:**同步桩返回已完成 Future** —— 主生成器在首个
      done() 检查即跳过轮询直落排水臂;桩内同步跑**真实** `_drain_stream`
      (假流 3 行,batch_lines=2),on_line 经**真实** `_emit_terminal_delta`
      → `_push_terminal_stream_frame` 直投 llm.py 的 `_delta_queue`。
    """
    from app.routers import llm as llm_router
    from app.services import mcp_server as mcp_mod

    tool_calls: list[str] = []
    on_line_texts: list[str] = []

    async def fake_astream(messages, model=None, owner_uuid=None, **kwargs):
        yield {"type": "chunk", "content": "正在执行命令。"}
        yield {
            "type": "tool_calls",
            "tool_calls": [
                {
                    "index": 0,
                    "id": TOOL_CALL_ID,
                    "type": "function",
                    "function": {
                        "name": "run_command",
                        "arguments": json.dumps({"command": "echo drain"}),
                    },
                }
            ],
        }
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    async def fake_complete(messages, model=None, owner_uuid=None, **kwargs):
        return {
            "content": "命令已执行完毕",
            "model": "test-model",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "stub": True,
        }

    def mock_call_tool(name, arguments, **kwargs):
        """同步桩:跑真实 _drain_stream,返回已完成 Future(残余帧留在队列)。"""
        tool_calls.append(name)
        command = str(arguments.get("command", ""))
        lines_list: list[str] = []

        def on_line(text: str) -> None:
            on_line_texts.append(text)
            # 走真实发射器:构造 terminal_delta 载荷并经 push 通道直投
            # llm.py 的 _delta_queue(push 缺失/发射让位都会在此响亮失败)。
            _run_without_real_suspension(
                mcp_mod._emit_terminal_delta(command, "stdout", text)
            )

        _run_without_real_suspension(
            mcp_mod._drain_stream(
                _FakeLineStream(COMMAND_LINES),
                lines_list,
                max_output=10000,
                on_line=on_line,
                batch_lines=BATCH_LINES,
            )
        )
        result: dict[str, Any] = {
            "tool": name,
            "ok": True,
            "command": command,
            "stdout": "".join(lines_list),
            "stderr": "",
            "exit_code": 0,
        }
        done: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        done.set_result(result)
        return done

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "complete", fake_complete)
    monkeypatch.setattr(mcp_mod.mcp_server, "call_tool", mock_call_tool)
    monkeypatch.setattr(
        llm_router, "_resolve_tool_approval", lambda mode, name: (False, "high")
    )

    resp = await client.post(
        ENDPOINT,
        json={
            "messages": [{"role": "user", "content": "执行 echo drain"}],
            "model": "test-model",
            "agent_tools": ["run_command"],
            "metadata": {"messageId": MESSAGE_ID},
        },
    )
    assert resp.status_code == 200, (
        f"路由未按 200 返回:{resp.status_code} / {resp.text[:800]}"
    )
    return resp.text, on_line_texts


class TestTerminalDeltaDrainBeforeTerminalEnd:
    """排空臂(任务结束后残余 delta 帧)必须在 terminal_end 之前把帧发完。"""

    async def test_residual_terminal_delta_drained_before_terminal_end(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """delta 帧序列先到齐、terminal_end 后到(按到达序号断言,非存在性)。

        判据只有一份,同时看守两处同型边界:
        - llm.py 排水臂:任务结算后队列残余帧在 terminal_end yield 之前全部
          转成 SSE(注释掉排空臂 ⇒ 帧 stranded ⇒ 本例按同一条判据翻红);
        - mcp_server._drain_stream 的 `_flush_pending()` 尾部冲刷:末行不足
          batch_lines 即 EOF ⇒ "line-3\\n" 这帧只能来自它,且同样必须先于
          terminal_end 到线(删掉尾部冲刷 ⇒ delta 序列不齐 ⇒ 同判据翻红)。
        """
        raw, on_line_texts = await _drive_stream(client, monkeypatch)

        # 夹具自证:两次冲刷都真实发生(批量边界 1 帧 + EOF 后 _flush_pending
        # 尾部残余 1 帧),且文本与预期到线序列一致。
        assert on_line_texts == EXPECTED_DELTA_TEXTS, (
            f"on_line 冲刷序列不符(第 2 帧只能来自 _flush_pending 尾部冲刷):"
            f"{on_line_texts}"
        )

        events = _parse_sse_events(raw)
        names = [e["event"] for e in events]

        # 按帧序号(到达顺序)断言,不是事件名存在性:
        end_idx = names.index("terminal_end")  # 终态帧缺失则在此翻红
        delta_idx = [i for i, n in enumerate(names) if n == "terminal_delta"]
        delta_texts = [events[i]["data"].get("text") for i in delta_idx]

        # ① delta 帧序列到齐且顺序稳定(第 2 帧 = _flush_pending 尾部残余)
        assert delta_texts == EXPECTED_DELTA_TEXTS, (
            f"delta 帧序列未到齐/乱序(排空臂被删或 _flush_pending 尾冲缺失):"
            f"{delta_texts}"
        )
        # ① 到达顺序:每一帧 delta 都先于 terminal_end
        assert max(delta_idx) < end_idx, (
            f"terminal_end(#{end_idx}) 抢先于 delta 帧(#{delta_idx})—— "
            f"排空臂不在终态帧之前"
        )
        # 上下文:terminal_start 先于首帧 delta(流形状未被夹具意外改变)
        start_idx = names.index("terminal_start")
        assert start_idx < min(delta_idx), (
            f"terminal_start(#{start_idx}) 应先于首帧 delta(#{min(delta_idx)})"
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

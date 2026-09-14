# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""complete_stream 端点的 AI 主动提问集成测试。

验证:
- LLM 输出含 [[ASK_USER:JSON]] 标记时,SSE 流中正确推送 question 事件
- 标记从 chunk 内容中剥离,不污染对话文本
- 跨 chunk 分片标记能正确累积解析
- 不完整标记 flush 时作为普通文本输出
- W1:tool loop 中 run_command 类工具产出 plan_updated / terminal_start / terminal_end 事件
- W1:未进入 tool loop 的普通问答不产出 plan_updated 事件(空历史守卫)
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    """异步 HTTP 测试客户端。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    """解析 SSE 原始文本为事件列表。

    每个事件格式:event: <type>\ndata: <json>\n\n
    返回 [{"event": "chunk", "data": {...}}, ...]
    """
    events: list[dict[str, Any]] = []
    blocks = raw.split("\n\n")
    for block in blocks:
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
    assert resp.status_code == 200
    return resp.text


class TestCompleteStreamQuestionEvents:
    """complete_stream 的 question 事件集成测试。"""

    async def test_question_marker_emits_question_event(self, client: AsyncClient, monkeypatch):
        """LLM 输出含提问标记 → SSE 推送 question 事件,且 chunk 内容已剥离标记。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            """模拟 LLM 输出含标记的内容。"""
            yield {"type": "chunk", "content": "正在处理您的请求[[ASK_USER:{\"prompt\":\"选择语言\",\"options\":[{\"id\":\"py\",\"label\":\"Python\"}]}]]"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        # 应该有 question 事件
        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 1
        q_data = question_events[0]["data"]
        assert q_data["type"] == "question"
        assert q_data["question"]["prompt"] == "选择语言"
        assert q_data["question"]["options"][0]["id"] == "py"

        # chunk 事件内容应已剥离标记
        chunk_events = [e for e in events if e["event"] == "chunk"]
        chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
        assert "[[ASK_USER:" not in chunk_text
        assert "正在处理您的请求" in chunk_text

    async def test_question_marker_split_across_chunks(self, client: AsyncClient, monkeypatch):
        """跨 chunk 分片的标记能正确累积解析。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {"type": "chunk", "content": "开头[[ASK_USER:{\"prompt\":"}
            yield {"type": "chunk", "content": "\"确认继续?\"}]]结尾"}
            yield {"type": "done", "model": "test", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 1
        assert question_events[0]["data"]["question"]["prompt"] == "确认继续?"

        # chunk 内容应剥离标记且前后文本拼接
        chunk_events = [e for e in events if e["event"] == "chunk"]
        chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
        assert "[[ASK_USER:" not in chunk_text
        assert chunk_text == "开头结尾"

    async def test_multiple_questions_in_one_stream(self, client: AsyncClient, monkeypatch):
        """单个流中多个提问标记全部解析。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {"type": "chunk", "content": "[[ASK_USER:{\"prompt\":\"Q1\"}]]中间[[ASK_USER:{\"prompt\":\"Q2\"}]]"}
            yield {"type": "done", "model": "test", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 2
        assert question_events[0]["data"]["question"]["prompt"] == "Q1"
        assert question_events[1]["data"]["question"]["prompt"] == "Q2"

    async def test_no_marker_no_question_event(self, client: AsyncClient, monkeypatch):
        """无标记时不产生 question 事件。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {"type": "chunk", "content": "普通文本无标记"}
            yield {"type": "done", "model": "test", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 0

        chunk_events = [e for e in events if e["event"] == "chunk"]
        assert chunk_events[0]["data"]["content"] == "普通文本无标记"

    async def test_invalid_marker_json_skipped(self, client: AsyncClient, monkeypatch):
        """标记内 JSON 非法 → 标记被丢弃,不推送 question 事件,不阻塞流。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {"type": "chunk", "content": "before[[ASK_USER:not-json]]after"}
            yield {"type": "done", "model": "test", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        # 非法 JSON 不应产生 question 事件
        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 0

        # 标记被丢弃,前后文本拼接
        chunk_events = [e for e in events if e["event"] == "chunk"]
        chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
        assert "beforeafter" in chunk_text
        assert "[[ASK_USER:" not in chunk_text

    async def test_incomplete_marker_flushed_as_text(self, client: AsyncClient, monkeypatch):
        """流结束时未闭合的标记 → flush 时作为普通文本输出(不吞内容)。"""
        from app.routers import llm as llm_router

        async def fake_astream(messages, model=None, owner_uuid=None):
            yield {"type": "chunk", "content": "正常文本[[ASK_USER:未闭合"}
            yield {"type": "done", "model": "test", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

        raw = await _stream_chat(client, {"messages": [{"role": "user", "content": "test"}]})
        events = _parse_sse_events(raw)

        # 不完整标记不应产生 question 事件
        question_events = [e for e in events if e["event"] == "question"]
        assert len(question_events) == 0

        # 不完整标记作为文本输出(不吞内容)
        chunk_events = [e for e in events if e["event"] == "chunk"]
        chunk_text = "".join(e["data"].get("content", "") for e in chunk_events)
        assert "正常文本" in chunk_text
        assert "[[ASK_USER:未闭合" in chunk_text


class TestCompleteStreamToolLoopPlanTerminalEvents:
    """W1(2026-09-12)tool loop 的 plan_updated / terminal_* SSE 事件集成测试。

    链路:请求带 agent_tools → 第一轮 astream 产出 shell 工具调用 → tool loop
    执行前发 terminal_start、执行后发 terminal_end,并在工具开始/结束时发
    plan_updated 权威快照。

    打桩点(绝不触碰真实 shell / 网络 / LLM):
    - app.routers.llm.llm_gateway.astream / .complete:避免真实 LLM 往返
    - app.services.mcp_server.mcp_server.call_tool:拦截真实工具执行
    """

    async def test_tool_loop_emits_plan_terminal_start_end(
        self, client: AsyncClient, monkeypatch
    ):
        """run_command 类工具调用 → 同时产出 plan_updated / terminal_start / terminal_end。

        LLM 返回工具名使用别名 execute_command,经 _TOOL_ALIASES 归一化为 run_command,
        据此验证「归一化后的工具名命中 _TERMINAL_TOOL_NAMES 才发终端事件」。
        """
        from app.routers import llm as llm_router
        from app.services.mcp_server import mcp_server as _mcp_inst

        # 记录真实工具执行次数与入参,断言打桩生效(测试未触碰真实 shell)
        shell_calls: list[str] = []

        async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
            """第一轮流式:产出 execute_command 别名工具调用 + done。"""
            yield {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "index": 0,
                        "id": "tc_shell_1",
                        "type": "function",
                        "function": {
                            "name": "execute_command",
                            "arguments": json.dumps({"command": "echo hi"}),
                        },
                    }
                ],
            }
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

        async def mock_complete(messages, model=None, owner_uuid=None, **kwargs):
            """第二轮:工具已执行,LLM 直接回复(无 tool_calls)以退出 tool loop。"""
            return {
                "content": "命令已执行完毕",
                "model": "test-model",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "stub": True,
            }

        async def mock_call_tool(name, arguments, **kwargs):
            """打桩工具执行:记录调用并返回固定结果,绝不执行真实命令。"""
            shell_calls.append(name)
            return {
                "tool": name,
                "ok": True,
                "command": arguments.get("command", ""),
                "stdout": "hi\n",
                "stderr": "",
                "exit_code": 0,
            }

        monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
        monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
        monkeypatch.setattr(_mcp_inst, "call_tool", mock_call_tool)

        raw = await _stream_chat(client, {
            "messages": [{"role": "user", "content": "执行 echo hi"}],
            "model": "test-model",
            "agent_tools": ["run_command"],
            "metadata": {"messageId": "msg-w1-001"},
        })

        # 原始 SSE 文本中三类事件均出现
        assert "event: plan_updated" in raw
        assert "event: terminal_start" in raw
        assert "event: terminal_end" in raw

        events = _parse_sse_events(raw)

        # 工具经打桩执行(别名 execute_command 已归一化为 run_command)
        assert shell_calls == ["run_command"]

        # 工具执行链路被触发
        tool_start_events = [e for e in events if e["event"] == "tool-call-start"]
        assert len(tool_start_events) == 1
        assert tool_start_events[0]["data"]["toolName"] == "run_command"

        # ---- plan_updated ----
        plan_events = [e for e in events if e["event"] == "plan_updated"]
        assert len(plan_events) >= 1
        for pe in plan_events:
            plan_data = pe["data"]
            assert plan_data["type"] == "plan_updated"
            assert isinstance(plan_data["plan"], list) and plan_data["plan"]
            for step in plan_data["plan"]:
                assert step["status"] in {"pending", "in_progress", "completed"}
            assert plan_data["messageId"] == "msg-w1-001"

        # ---- terminal_start ----
        start_events = [e for e in events if e["event"] == "terminal_start"]
        assert len(start_events) == 1
        start_data = start_events[0]["data"]
        assert start_data["type"] == "terminal_start"
        assert start_data["terminalId"]
        assert start_data["command"] == "echo hi"
        assert start_data["status"] == "running"
        assert start_data["messageId"] == "msg-w1-001"

        # ---- terminal_end ----
        end_events = [e for e in events if e["event"] == "terminal_end"]
        assert len(end_events) == 1
        end_data = end_events[0]["data"]
        assert end_data["type"] == "terminal_end"
        assert end_data["terminalId"] == start_data["terminalId"]
        assert "exitCode" in end_data
        assert end_data["exitCode"] == 0
        assert end_data["messageId"] == "msg-w1-001"

    async def test_normal_chat_emits_no_plan_updated(
        self, client: AsyncClient, monkeypatch
    ):
        """不进入 tool loop 的普通问答(tool_calls_history 为空)→ 不产生 plan_updated 事件。

        对应 _format_plan_updated_event 的「空历史返回空串」守卫:generic astream 路径
        done 前仍无条件调用该 helper,但空历史下不产生任何 SSE 输出。
        """
        from app.routers import llm as llm_router

        async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
            """普通问答:仅逐块输出文本,不产生 tool_calls。"""
            yield {"type": "chunk", "content": "普通问答回复"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)

        raw = await _stream_chat(client, {
            "messages": [{"role": "user", "content": "你好"}],
            "metadata": {"messageId": "msg-w1-002"},
        })

        # 关键断言:不产生 plan_updated 事件
        assert "event: plan_updated" not in raw
        events = _parse_sse_events(raw)
        assert [e for e in events if e["event"] == "plan_updated"] == []

        # 普通 chunk 正常输出,done 正常收尾
        assert "普通问答回复" in raw
        assert [e for e in events if e["event"] == "done"]


class TestCompleteStreamChatMode:
    """ChatMode 5 态(2026-09-13 矩阵 A #24)的 complete_stream 集成测试。

    链路:请求带 mode 字段 → _resolve_chat_mode 归一化(mode 优先于 legacy plan_mode)
    → 对应模式引导注入 system prompt 最顶部 → ask 模式额外禁用 tool loop。

    打桩点(绝不触碰真实 shell / 网络 / LLM):
    - app.routers.llm.llm_gateway.astream / .complete:避免真实 LLM 往返,同时捕获
      实际下发的 messages 以断言 system prompt 注入
    - app.services.mcp_server.mcp_server.call_tool:拦截真实工具执行
    """

    async def test_ask_mode_skips_tool_loop_and_injects_prompt(
        self, client: AsyncClient, monkeypatch
    ):
        """mode='ask' + agent_tools → 跳过 tool loop(不执行工具)+ 注入 Ask Mode 引导。"""
        from app.routers import llm as llm_router
        from app.services.mcp_server import mcp_server as _mcp_inst

        captured_astream_messages: list[list[dict[str, Any]]] = []
        complete_calls: list[list[dict[str, Any]]] = []
        tool_calls: list[str] = []

        async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
            captured_astream_messages.append(messages)
            yield {"type": "chunk", "content": "ask 模式纯文本回答"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

        async def mock_complete(messages, model=None, owner_uuid=None, **kwargs):
            complete_calls.append(messages)
            return {"content": "不应被调用", "model": "test-model", "usage": {}, "stub": True}

        async def mock_call_tool(name, arguments, **kwargs):
            tool_calls.append(name)
            return {"tool": name, "ok": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
        monkeypatch.setattr(llm_router.llm_gateway, "complete", mock_complete)
        monkeypatch.setattr(_mcp_inst, "call_tool", mock_call_tool)

        raw = await _stream_chat(client, {
            "messages": [{"role": "user", "content": "什么是依赖注入?"}],
            "model": "test-model",
            "mode": "ask",
            "agent_tools": ["run_command"],
            "metadata": {"messageId": "msg-mode-001"},
        })

        # 关键断言 1:tool loop 被跳过 —— 工具从未执行、complete 不被调用、
        # 无 tool-call-start / terminal_* / plan_updated 事件
        assert tool_calls == []
        assert complete_calls == []
        assert "event: tool-call-start" not in raw
        assert "event: terminal_start" not in raw
        assert "event: terminal_end" not in raw
        assert "event: plan_updated" not in raw

        # 关键断言 2:Ask Mode 引导注入到 system prompt 最顶部
        assert captured_astream_messages, "astream 必须被调用"
        first = captured_astream_messages[0][0]
        assert first["role"] == "system"
        assert first["content"].startswith("## Ask Mode Active")

        # chunk 正常输出,done 正常收尾
        assert "ask 模式纯文本回答" in raw
        events = _parse_sse_events(raw)
        assert [e for e in events if e["event"] == "done"]

    async def test_plan_mode_via_mode_field_injects_plan_prompt(
        self, client: AsyncClient, monkeypatch
    ):
        """mode='plan'(无 agent_tools)→ 注入 Plan Mode 引导(与 legacy plan_mode 同语义)。"""
        from app.routers import llm as llm_router

        captured: list[list[dict[str, Any]]] = []

        async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
            captured.append(messages)
            yield {"type": "chunk", "content": "1. 分析需求\n2. 给出方案"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)

        raw = await _stream_chat(client, {
            "messages": [{"role": "user", "content": "规划重构方案"}],
            "model": "test-model",
            "mode": "plan",
        })

        assert captured
        first = captured[0][0]
        assert first["role"] == "system"
        assert first["content"].startswith("## Plan Mode Active")
        # plan 模式正常走 astream 输出
        assert "1. 分析需求" in raw

    async def test_mode_overrides_legacy_plan_mode(self, client: AsyncClient, monkeypatch):
        """mode 优先于 legacy plan_mode:mode='build' + plan_mode='plan' → 不注入 Plan 引导。"""
        from app.routers import llm as llm_router

        captured: list[list[dict[str, Any]]] = []

        async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
            captured.append(messages)
            yield {"type": "chunk", "content": "build 模式回答"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)

        raw = await _stream_chat(client, {
            "messages": [{"role": "user", "content": "直接执行"}],
            "model": "test-model",
            "mode": "build",
            "plan_mode": "plan",
        })

        assert captured
        # mode='build' 优先 → 无 Plan Mode 引导(legacy plan_mode 被忽略)
        assert not any(
            m.get("role") == "system" and "## Plan Mode Active" in str(m.get("content", ""))
            for m in captured[0]
        )
        assert "build 模式回答" in raw

    async def test_mode_case_insensitive_and_legacy_plan_mode_still_works(
        self, client: AsyncClient, monkeypatch
    ):
        """mode 大小写不敏感('ASK');mode 缺省时 legacy plan_mode='plan' 继续生效(向后兼容)。"""
        from app.routers import llm as llm_router

        captured: list[list[dict[str, Any]]] = []

        async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
            captured.append(messages)
            yield {"type": "chunk", "content": "ok"}
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

        monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)

        # ① mode='ASK'(大写)→ 归一化为 ask,注入 Ask 引导
        raw1 = await _stream_chat(client, {
            "messages": [{"role": "user", "content": "q"}],
            "model": "test-model",
            "mode": "ASK",
        })
        assert raw1  # 流式 200
        assert captured
        assert captured[-1][0]["role"] == "system"
        assert captured[-1][0]["content"].startswith("## Ask Mode Active")

        # ② legacy:无 mode + plan_mode='plan' → Plan 引导(向后兼容不回归)
        await _stream_chat(client, {
            "messages": [{"role": "user", "content": "q"}],
            "model": "test-model",
            "plan_mode": "plan",
        })
        assert captured
        assert captured[-1][0]["role"] == "system"
        assert captured[-1][0]["content"].startswith("## Plan Mode Active")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

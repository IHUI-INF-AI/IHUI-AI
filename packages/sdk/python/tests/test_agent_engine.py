# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent Engine 编程编排层测试(P2-④,2026-09-18 立)。

通过 monkeypatch ``urllib.request.urlopen``(经 ``AgentConfig.opener`` 注入)回放
脚本化响应,全程无真实网络。覆盖:握手/线程生命周期、SSE 事件顺序、宿主工具往返、
审批回填、错误映射、以及 asyncio 包装层。
"""

from __future__ import annotations

import asyncio
import io
import json
import urllib.error
from typing import Any

import pytest

from ihui_ai.agent_engine import (
    ENGINE_ERROR_CODES,
    ENGINE_METHODS,
    ENGINE_NOTIFICATIONS,
    Agent,
    AgentEngineError,
    create_agent,
    create_agent_async,
)


# ---------------------------------------------------------------------------
# 夹具:脚本化 urlopen
# ---------------------------------------------------------------------------


class _Response:
    """最小响应对象:支持 read() 与按行迭代(SSE 增量消费路径)。"""

    def __init__(self, body: bytes) -> None:
        self._stream = io.BytesIO(body)

    def read(self, n: int = -1) -> bytes:
        return self._stream.read(n)

    def close(self) -> None:
        pass

    def __iter__(self):
        return iter(self._stream)


def json_step(payload: Any, status: int = 200) -> dict[str, Any]:
    """JSON 响应步骤。"""
    return {"kind": "json", "body": json.dumps(payload).encode("utf-8"), "status": status}


def sse_step(frames: list[dict[str, Any]], heartbeat: bool = True) -> dict[str, Any]:
    """SSE 响应步骤(注释心跳 + data 帧 + [DONE] 收尾)。"""
    parts: list[str] = []
    if heartbeat:
        parts.append(": ping\n\n")
    for frame in frames:
        parts.append(f"data: {json.dumps(frame)}\n\n")
    parts.append("event: done\ndata: [DONE]\n\n")
    return {"kind": "sse", "body": "".join(parts).encode("utf-8")}


def event_frame(name: str, payload: dict[str, Any]) -> dict[str, Any]:
    """thread/event 通知帧。"""
    return {
        "jsonrpc": "2.0",
        "method": "thread/event",
        "params": {"threadId": "thr_1", "event": name, "payload": payload},
    }


def run_payload(**overrides: Any) -> dict[str, Any]:
    """一轮结果载荷(引擎归一化形态)。"""
    payload = {
        "threadId": "thr_1",
        "success": True,
        "stopReason": "completed",
        "finalResponse": "改好了",
        "iterations": 2,
        "totalDurationMs": 12.5,
        "totalTokensUsed": 42,
        "checkpointId": None,
        "error": None,
        "budget": None,
        "compactionEvents": [],
    }
    payload.update(overrides)
    return payload


class Recorder:
    """替换 urlopen:记录每次请求并回放脚本步骤。"""

    def __init__(self, script: list[dict[str, Any]]) -> None:
        self.script = script
        self.requests: list[dict[str, Any]] = []

    def __call__(self, req: Any, timeout: Any = None) -> _Response:
        payload = json.loads(req.data.decode("utf-8")) if req.data else {}
        self.requests.append(
            {
                "method": payload.get("method"),
                "params": payload.get("params") or {},
                "id": payload.get("id"),
                "headers": dict(req.headers),
                "url": req.full_url,
                "timeout": timeout,
            }
        )
        step = self.script[min(len(self.requests) - 1, len(self.script) - 1)]
        if step.get("http_error"):
            raise urllib.error.HTTPError(
                req.full_url,
                step["http_error"],
                step.get("reason", ""),
                {},
                io.BytesIO(step.get("body", b"")),
            )
        return _Response(step["body"])

    @property
    def methods(self) -> list[str]:
        return [r["method"] for r in self.requests]


START_STEP = json_step(
    {"jsonrpc": "2.0", "id": 1, "result": {"threadId": "thr_1", "sessionId": "thr_1", "status": "idle"}}
)


def _agent(script: list[dict[str, Any]], **config: Any) -> tuple[Agent, Recorder]:
    recorder = Recorder(script)
    agent = create_agent({"token": "jwt_x", "base_url": "http://test.local", "opener": recorder, **config})
    return agent, recorder


# ---------------------------------------------------------------------------
# 构造与握手
# ---------------------------------------------------------------------------


def test_missing_token_raises_engine_error() -> None:
    with pytest.raises(AgentEngineError) as exc:
        create_agent({"token": ""})
    assert exc.value.code == ENGINE_ERROR_CODES["invalid_request"]


def test_run_auto_starts_thread_then_prompts() -> None:
    agent, recorder = _agent(
        [
            START_STEP,
            sse_step([{"jsonrpc": "2.0", "id": 2, "result": run_payload()}]),
        ]
    )
    result = agent.run("改错别字")

    assert recorder.methods == ["thread.start", "thread.prompt"]
    assert recorder.requests[1]["params"] == {"threadId": "thr_1", "input": "改错别字"}
    assert recorder.requests[0]["headers"]["Authorization"] == "Bearer jwt_x"
    assert recorder.requests[0]["url"] == "http://test.local/api/engine/rpc"
    # 非流式调用带超时,流式不带(长连接语义)
    assert recorder.requests[0]["timeout"] is not None
    assert recorder.requests[1]["timeout"] is None
    assert result["finalResponse"] == "改好了"
    assert agent.thread_id == "thr_1"
    assert agent.last_result["totalTokensUsed"] == 42


def test_start_only_sends_provided_params() -> None:
    agent, recorder = _agent(
        [START_STEP], model="claude-sonnet-4", max_iterations=5, permission_mode="acceptEdits"
    )
    agent.start()
    assert recorder.requests[0]["params"] == {
        "model": "claude-sonnet-4",
        "maxIterations": 5,
        "permissionMode": "acceptEdits",
    }


def test_repeated_start_reuses_thread() -> None:
    agent, recorder = _agent([START_STEP])
    agent.start()
    agent.start()
    assert recorder.methods == ["thread.start"]


# ---------------------------------------------------------------------------
# 流式事件
# ---------------------------------------------------------------------------


def test_stream_yields_events_in_order_and_ignores_heartbeat() -> None:
    agent, _ = _agent(
        [
            START_STEP,
            sse_step(
                [
                    event_frame("thinking.delta", {"content": "想"}),
                    event_frame("tool.after", {"tool": "read_file"}),
                    event_frame("message.receive", {"content": "完成"}),
                    {"jsonrpc": "2.0", "id": 2, "result": run_payload()},
                ]
            ),
        ]
    )
    events = list(agent.stream("跑"))
    assert [e.name for e in events] == ["thinking.delta", "tool.after", "message.receive"]
    assert events[0].payload == {"content": "想"}
    assert events[0].thread_id == "thr_1"
    assert agent.last_result["success"] is True


def test_run_on_event_callback_receives_events() -> None:
    agent, _ = _agent(
        [
            START_STEP,
            sse_step(
                [
                    event_frame("tool.before", {"tool": "x"}),
                    {"jsonrpc": "2.0", "id": 2, "result": run_payload()},
                ]
            ),
        ]
    )
    seen: list[str] = []
    agent.run("跑", on_event=lambda e: seen.append(e.name))
    assert seen == ["tool.before"]


def test_run_on_event_overrides_config_on_event() -> None:
    global_events: list[str] = []
    local_events: list[str] = []
    agent, _ = _agent(
        [
            START_STEP,
            sse_step(
                [
                    event_frame("tool.before", {}),
                    {"jsonrpc": "2.0", "id": 2, "result": run_payload()},
                ]
            ),
        ],
        on_event=lambda e: global_events.append(e.name),
    )
    agent.run("跑", on_event=lambda e: local_events.append(e.name))
    assert local_events == ["tool.before"]
    assert global_events == []


def test_method_error_frame_raises_with_engine_code() -> None:
    agent, _ = _agent(
        [
            START_STEP,
            sse_step(
                [
                    {
                        "jsonrpc": "2.0",
                        "id": 2,
                        "error": {"code": ENGINE_ERROR_CODES["thread_busy"], "message": "线程正在执行中"},
                    }
                ]
            ),
        ]
    )
    with pytest.raises(AgentEngineError) as exc:
        agent.run("跑")
    assert exc.value.code == ENGINE_ERROR_CODES["thread_busy"]


# ---------------------------------------------------------------------------
# 宿主工具往返
# ---------------------------------------------------------------------------


def test_host_tool_round_trip_registers_executes_and_reports() -> None:
    calls: list[Any] = []

    def handler(ctx: Any) -> dict[str, str]:
        calls.append(ctx)
        return {"content": "hello"}

    agent, recorder = _agent(
        [
            START_STEP,
            json_step({"jsonrpc": "2.0", "id": 2, "result": {"name": "read_file"}}),
            sse_step(
                [
                    {
                        "jsonrpc": "2.0",
                        "method": "tool/execute",
                        "params": {
                            "requestId": "req_1",
                            "threadId": "thr_1",
                            "name": "read_file",
                            "arguments": {"path": "README.md"},
                            "timeoutMs": 5000,
                        },
                    },
                    {"jsonrpc": "2.0", "id": 3, "result": run_payload()},
                ]
            ),
            json_step({"jsonrpc": "2.0", "id": 4, "result": {"applied": True}}),
        ],
        host_tools={"read_file": handler},
    )
    result = agent.run("读文件")

    assert recorder.methods == ["thread.start", "tools.register", "thread.prompt", "tools.result"]
    assert result["success"] is True
    assert len(calls) == 1
    assert calls[0].request_id == "req_1"
    assert calls[0].name == "read_file"
    assert calls[0].arguments == {"path": "README.md"}
    assert calls[0].timeout_ms == 5000
    assert recorder.requests[3]["params"] == {"requestId": "req_1", "result": {"content": "hello"}}


def test_host_tool_spec_is_sent_on_register() -> None:
    agent, recorder = _agent(
        [
            START_STEP,
            json_step({"jsonrpc": "2.0", "id": 2, "result": {"name": "read_file"}}),
            sse_step([{"jsonrpc": "2.0", "id": 3, "result": run_payload()}]),
        ],
        host_tools={"read_file": lambda ctx: "x"},
        host_tool_specs={
            "read_file": {
                "description": "读文件",
                "parameters": {"type": "object", "properties": {"path": {"type": "string"}}},
            }
        },
    )
    agent.run("跑")
    assert recorder.requests[1]["params"] == {
        "threadId": "thr_1",
        "name": "read_file",
        "description": "读文件",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}}},
    }


def test_host_tool_exception_reports_error_without_breaking_run() -> None:
    def boom(ctx: Any) -> str:
        raise RuntimeError("磁盘满了")

    agent, recorder = _agent(
        [
            START_STEP,
            json_step({"jsonrpc": "2.0", "id": 2, "result": {"name": "boom"}}),
            sse_step(
                [
                    {
                        "jsonrpc": "2.0",
                        "method": "tool/execute",
                        "params": {"requestId": "req_9", "name": "boom", "arguments": {}, "timeoutMs": 1000},
                    },
                    {"jsonrpc": "2.0", "id": 3, "result": run_payload()},
                ]
            ),
            json_step({"jsonrpc": "2.0", "id": 4, "result": {}}),
        ],
        host_tools={"boom": boom},
    )
    result = agent.run("跑")
    assert result["success"] is True
    assert recorder.requests[3]["params"] == {"requestId": "req_9", "error": "磁盘满了"}


def test_unregistered_host_tool_reports_error() -> None:
    agent, recorder = _agent(
        [
            START_STEP,
            sse_step(
                [
                    {
                        "jsonrpc": "2.0",
                        "method": "tool/execute",
                        "params": {"requestId": "req_x", "name": "unknown_tool", "arguments": {}, "timeoutMs": 1},
                    },
                    {"jsonrpc": "2.0", "id": 2, "result": run_payload()},
                ]
            ),
            json_step({"jsonrpc": "2.0", "id": 3, "result": {}}),
        ]
    )
    agent.run("跑")
    assert "unknown_tool" in str(recorder.requests[2]["params"]["error"])


def test_arguments_string_is_parsed_to_dict() -> None:
    captured: list[Any] = []
    agent, _ = _agent(
        [
            START_STEP,
            json_step({"jsonrpc": "2.0", "id": 2, "result": {"name": "echo"}}),
            sse_step(
                [
                    {
                        "jsonrpc": "2.0",
                        "method": "tool/execute",
                        "params": {"requestId": "r", "name": "echo", "arguments": '{"q":"hi"}', "timeoutMs": 1},
                    },
                    {"jsonrpc": "2.0", "id": 3, "result": run_payload()},
                ]
            ),
            json_step({"jsonrpc": "2.0", "id": 4, "result": {}}),
        ],
        host_tools={"echo": lambda ctx: captured.append(ctx) or "ok"},
    )
    agent.run("跑")
    assert captured[0].arguments == {"q": "hi"}


def test_unparsable_arguments_fall_back_to_raw() -> None:
    captured: list[Any] = []
    agent, _ = _agent(
        [
            START_STEP,
            json_step({"jsonrpc": "2.0", "id": 2, "result": {"name": "echo"}}),
            sse_step(
                [
                    {
                        "jsonrpc": "2.0",
                        "method": "tool/execute",
                        "params": {"requestId": "r", "name": "echo", "arguments": "not-json{", "timeoutMs": 1},
                    },
                    {"jsonrpc": "2.0", "id": 3, "result": run_payload()},
                ]
            ),
            json_step({"jsonrpc": "2.0", "id": 4, "result": {}}),
        ],
        host_tools={"echo": lambda ctx: captured.append(ctx) or "ok"},
    )
    agent.run("跑")
    assert captured[0].arguments == {"raw": "not-json{"}


# ---------------------------------------------------------------------------
# 审批回填
# ---------------------------------------------------------------------------


def _approval_script(request_params: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        START_STEP,
        sse_step(
            [
                {"jsonrpc": "2.0", "method": "approval/request", "params": request_params},
                {"jsonrpc": "2.0", "id": 2, "result": run_payload()},
            ]
        ),
        json_step({"jsonrpc": "2.0", "id": 3, "result": {"applied": True}}),
    ]


def test_approval_defaults_to_reject_without_handler() -> None:
    agent, recorder = _agent(_approval_script({"requestId": "ap_1", "toolName": "rm_rf"}))
    agent.run("跑")
    assert recorder.requests[2]["params"] == {"approvalId": "ap_1", "decision": "reject"}


def test_approval_handler_decision_and_context() -> None:
    seen: list[Any] = []

    def on_approval(req: Any) -> str:
        seen.append(req)
        return "approve"

    agent, recorder = _agent(
        _approval_script(
            {
                "requestId": "ap_2",
                "threadId": "thr_1",
                "toolName": "write_file",
                "toolCallId": "tc_9",
                "dangerLevel": "medium",
                "argsPreview": {"path": "a.ts"},
            }
        ),
        on_approval=on_approval,
    )
    agent.run("跑")
    assert len(seen) == 1
    assert seen[0].tool_name == "write_file"
    assert seen[0].tool_call_id == "tc_9"
    assert seen[0].danger_level == "medium"
    assert seen[0].args_preview == {"path": "a.ts"}
    assert recorder.requests[2]["params"] == {"approvalId": "ap_2", "decision": "approve"}


def test_approval_handler_exception_falls_back_to_reject() -> None:
    def on_approval(req: Any) -> str:
        raise RuntimeError("审批服务不可用")

    agent, recorder = _agent(_approval_script({"requestId": "ap_3", "toolName": "x"}), on_approval=on_approval)
    agent.run("跑")
    assert recorder.requests[2]["params"]["decision"] == "reject"


# ---------------------------------------------------------------------------
# 控制面
# ---------------------------------------------------------------------------


def test_control_plane_method_names_and_params() -> None:
    agent, recorder = _agent(
        [
            START_STEP,
            json_step({"jsonrpc": "2.0", "id": 2, "result": {"interrupted": True, "mode": "pause"}}),
            json_step({"jsonrpc": "2.0", "id": 3, "result": {"threadId": "thr_1", "prompts": 1}}),
            sse_step([{"jsonrpc": "2.0", "id": 4, "result": run_payload(stopReason="resumed")}]),
            json_step({"jsonrpc": "2.0", "id": 5, "result": {"closed": True}}),
        ]
    )
    agent.start()
    interrupted = agent.interrupt("pause")
    state = agent.state()
    resumed = agent.resume("ckpt_7")
    agent.close()

    assert recorder.methods == [
        "thread.start",
        "thread.interrupt",
        "thread.state",
        "thread.resume",
        "thread.close",
    ]
    assert interrupted == {"interrupted": True, "mode": "pause"}
    assert recorder.requests[1]["params"] == {"threadId": "thr_1", "mode": "pause"}
    assert recorder.requests[3]["params"] == {"threadId": "thr_1", "checkpointId": "ckpt_7"}
    assert state["prompts"] == 1
    assert resumed["stopReason"] == "resumed"
    assert agent.started is False


def test_close_is_idempotent() -> None:
    agent, recorder = _agent([START_STEP, json_step({"jsonrpc": "2.0", "id": 2, "result": {}})])
    agent.close()
    agent.start()
    agent.close()
    agent.close()
    assert recorder.methods == ["thread.start", "thread.close"]


def test_differentiator_endpoints() -> None:
    agent, recorder = _agent(
        [
            START_STEP,
            json_step({"jsonrpc": "2.0", "id": 2, "result": {"available": True, "report": {}}}),
            json_step({"jsonrpc": "2.0", "id": 3, "result": {"models": [], "total": 0}}),
            json_step({"jsonrpc": "2.0", "id": 4, "result": {"pool": [], "total": 0}}),
        ]
    )
    agent.start()
    agent.cost({"source": "relay"})
    agent.models()
    agent.list_tools()
    assert recorder.methods == ["thread.start", "cost.report", "models.list", "tools.list"]
    assert recorder.requests[1]["params"] == {"filter": {"source": "relay"}}


def test_respond_approval_direct_call() -> None:
    agent, recorder = _agent([START_STEP, json_step({"jsonrpc": "2.0", "id": 2, "result": {"applied": True}})])
    agent.start()
    agent.respond_approval("ap_9", "approve")
    assert recorder.requests[1]["method"] == "approval.respond"
    assert recorder.requests[1]["params"] == {"approvalId": "ap_9", "decision": "approve"}


# ---------------------------------------------------------------------------
# 错误映射
# ---------------------------------------------------------------------------


def test_http_error_maps_to_negative_status_code() -> None:
    recorder = Recorder([{"kind": "json", "body": b"", "http_error": 401, "reason": "Unauthorized"}])
    agent = create_agent({"token": "t", "base_url": "http://test.local", "opener": recorder})
    with pytest.raises(AgentEngineError) as exc:
        agent.start()
    assert exc.value.code == -401


def test_url_error_maps_to_code_zero() -> None:
    def failing_opener(req: Any, timeout: Any = None) -> Any:
        raise urllib.error.URLError("connection refused")

    agent = create_agent({"token": "t", "base_url": "http://test.local", "opener": failing_opener})
    with pytest.raises(AgentEngineError) as exc:
        agent.start()
    assert exc.value.code == 0


def test_stream_without_final_frame_raises_internal_error() -> None:
    agent, _ = _agent(
        [
            START_STEP,
            {"kind": "json", "body": b'{"jsonrpc":"2.0","id":2}', "status": 200},
        ]
    )
    with pytest.raises(AgentEngineError) as exc:
        agent.run("跑")
    assert exc.value.code == ENGINE_ERROR_CODES["internal_error"]


# ---------------------------------------------------------------------------
# asyncio 包装层
# ---------------------------------------------------------------------------


def test_async_agent_run_and_close() -> None:
    async def main() -> dict[str, Any]:
        recorder = Recorder(
            [
                START_STEP,
                sse_step([{"jsonrpc": "2.0", "id": 2, "result": run_payload()}]),
                json_step({"jsonrpc": "2.0", "id": 3, "result": {"closed": True}}),
            ]
        )
        agent = create_agent_async({"token": "t", "base_url": "http://test.local", "opener": recorder})
        result = await agent.run("跑")
        assert agent.started is True
        await agent.close()
        assert agent.started is False
        return result

    assert asyncio.run(main())["success"] is True


def test_async_agent_astream_yields_events() -> None:
    async def main() -> list[str]:
        recorder = Recorder(
            [
                START_STEP,
                sse_step(
                    [
                        event_frame("thinking.delta", {"content": "a"}),
                        event_frame("thinking.delta", {"content": "b"}),
                        {"jsonrpc": "2.0", "id": 2, "result": run_payload()},
                    ]
                ),
            ]
        )
        agent = create_agent_async({"token": "t", "base_url": "http://test.local", "opener": recorder})
        collected: list[str] = []
        async for event in agent.astream("跑"):
            collected.append(str(event.payload["content"]))
        return collected

    assert asyncio.run(main()) == ["a", "b"]


def test_async_agent_astream_propagates_engine_error() -> None:
    async def main() -> int:
        recorder = Recorder(
            [
                START_STEP,
                sse_step(
                    [
                        {
                            "jsonrpc": "2.0",
                            "id": 2,
                            "error": {"code": ENGINE_ERROR_CODES["thread_not_found"], "message": "no thread"},
                        }
                    ]
                ),
            ]
        )
        agent = create_agent_async({"token": "t", "base_url": "http://test.local", "opener": recorder})
        try:
            async for _ in agent.astream("跑"):
                pass
        except AgentEngineError as e:
            return e.code
        return 0

    assert asyncio.run(main()) == ENGINE_ERROR_CODES["thread_not_found"]


# ---------------------------------------------------------------------------
# 协议常量(与引擎 handler 表 parity)
# ---------------------------------------------------------------------------


def test_protocol_constants_match_engine_contract() -> None:
    assert ENGINE_METHODS == (
        "engine.initialize",
        "engine.ping",
        "thread.start",
        "thread.prompt",
        "thread.interrupt",
        "thread.resume",
        "thread.state",
        "thread.close",
        "thread.compact",
        "thread.export",
        "thread.plan",
        "thread.enqueue",
        "thread.goal",
        "thread.review",
        "agent.exec",
        "tools.list",
        "tools.register",
        "tools.result",
        "approval.respond",
        "cost.report",
        "models.list",
    )
    assert ENGINE_NOTIFICATIONS == ("thread/event", "tool/execute", "approval/request")
    assert ENGINE_ERROR_CODES["thread_closed"] == -32006
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

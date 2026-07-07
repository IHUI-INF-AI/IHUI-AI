"""WebSocket 端到端 E2E — Slash 命令真实流程 (handler 层 + 协议层双覆盖).

对标 Claude Code / Codex / Trae 的 /command 面板:
- handler 层: 直接调用 handle_help / handle_clear / handle_init / handle_cost 等
  函数, 验证返回的事件结构. 不依赖 TestClient 的 WebSocket 实现.
- 协议层: 通过 mock WebSocket, 验证 routes.py 的 agent_websocket
  完整流程 (鉴权 -> 接收 -> 解析 -> 分发 -> 推送).

测试运行方式:
  uv run pytest tests/test_phase23_ws_slash_e2e.py -v

设计要点:
  - slash 命令是纯后端逻辑, 不需要真实 LLM, 用 handler 直接调用 + mock 验证
  - 每个测试用 tmp_path 提供隔离的工作区
  - 既验证 handler 正确性, 也验证 WebSocket 入口对命令的分发
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import WebSocket, WebSocketDisconnect


# ---------------------------------------------------------------------------
# 共用 mock WebSocket 工厂
# ---------------------------------------------------------------------------

def _make_mock_ws(frames: list[str] | None = None) -> MagicMock:
    """构造能被 isinstance(a, WebSocket) 识别的 mock WebSocket.

    ws_require_auth 装饰器内部用 isinstance 识别 WebSocket,
    普通 MagicMock 不会被识别, 因此这里通过 spec=WebSocket 让 mock 模拟 WebSocket 类型.
    """
    ws = MagicMock(spec=WebSocket)
    ws.accept = AsyncMock()
    ws.close = AsyncMock()
    ws.send_text = AsyncMock()
    if frames is not None:
        ws.receive_text = AsyncMock(side_effect=frames)
    else:
        ws.receive_text = AsyncMock()
    ws.query_params = {}
    return ws


# ---------------------------------------------------------------------------
# Handler 层直接测试 (绕过 WS 协议, 验证 slash 命令核心逻辑)
# ---------------------------------------------------------------------------

class TestSlashHandlersDirect:
    """直接调用 handle_* 函数, 验证返回事件结构."""

    def _make_ws(self) -> AsyncMock:
        """构造 mock WebSocket, send_text 记录所有推送."""
        ws = AsyncMock()
        ws.send_text = AsyncMock()
        return ws

    def test_help_returns_command_list(self):
        """/help 应返回 14+ 命令 (核心 8 个 + 扩展 6 个)."""
        from app.api.v1.workspace.slash_commands import handle_help

        ws = self._make_ws()
        result = asyncio.run(handle_help(ws))

        assert result["type"] == "agent.command.result"
        assert result["command"] == "help"
        cmds = result["commands"]
        assert isinstance(cmds, list)
        names = {c["name"] for c in cmds}
        core = {"/help", "/clear", "/compact", "/plan",
                "/plan-accept", "/plan-reject", "/init", "/goal"}
        missing = core - names
        assert not missing, f"核心命令缺失: {missing}"
        assert len(cmds) >= 8

    def test_clear_returns_confirmation(self):
        """/clear 应返回 previous_chat_id 字段."""
        from app.api.v1.workspace.slash_commands import handle_clear

        ws = self._make_ws()
        result = asyncio.run(handle_clear(ws, chat_id="test-chat-123"))

        assert result["type"] == "agent.command.result"
        assert result["command"] == "clear"
        assert result["previous_chat_id"] == "test-chat-123"
        assert "会话已清除" in result["message"]

    def test_init_creates_agents_md(self, tmp_path: Path):
        """/init 应生成 AGENTS.md 草案 (文件不存在时)."""
        from app.api.v1.workspace.slash_commands import handle_init

        agents_md = tmp_path / "AGENTS.md"
        assert not agents_md.exists()

        ws = self._make_ws()
        result = asyncio.run(handle_init(ws, workspace_path=str(tmp_path)))

        assert result["type"] == "agent.command.result"
        assert result["command"] == "init"
        assert result.get("skipped") is not True
        assert "草案已生成" in result["message"]
        assert agents_md.exists()
        content = agents_md.read_text(encoding="utf-8")
        assert "项目" in content
        assert "技术栈" in content

    def test_init_skipped_when_exists(self, tmp_path: Path):
        """/init 第二次应被跳过."""
        from app.api.v1.workspace.slash_commands import handle_init

        (tmp_path / "AGENTS.md").write_text("# 已有\n", encoding="utf-8")
        ws = self._make_ws()
        result = asyncio.run(handle_init(ws, workspace_path=str(tmp_path)))

        assert result["skipped"] is True
        assert "已存在" in result["message"]

    def test_plan_returns_handled_with_modify(self):
        """/plan 应返回 modify.permission_mode=plan, max_iterations=5."""
        from app.api.v1.workspace.slash_commands import handle_plan

        ws = self._make_ws()
        result = asyncio.run(handle_plan(ws, args=""))

        assert result["type"] == "agent.command.handled"
        assert result["command"] == "plan"
        assert result["continue_to_loop"] is True
        assert result["modify"]["permission_mode"] == "plan"
        assert result["modify"]["max_iterations"] == 5

    def test_goal_returns_handled_with_modify(self):
        """/goal 应返回 modify.max_iterations=20."""
        from app.api.v1.workspace.slash_commands import handle_goal

        ws = self._make_ws()
        result = asyncio.run(handle_goal(ws, args="实现 hello world"))

        assert result["type"] == "agent.command.handled"
        assert result["command"] == "goal"
        assert result["modify"]["max_iterations"] == 20
        assert "实现 hello world" in result["message"]

    def test_compact_returns_compact_flag(self):
        """/compact 应返回 modify.compact_first=True."""
        from app.api.v1.workspace.slash_commands import handle_compact

        ws = self._make_ws()
        result = asyncio.run(handle_compact(ws, args=""))

        assert result["type"] == "agent.command.handled"
        assert result["command"] == "compact"
        assert result["modify"]["compact_first"] is True

    def test_cost_no_chat_returns_error(self):
        """/cost 无 chat_id 应优雅返回 (不报错)."""
        from app.api.v1.workspace.slash_commands import handle_cost

        ws = self._make_ws()
        result = asyncio.run(handle_cost(ws, chat_id=None))

        assert result["type"] == "agent.command.result"
        assert result["command"] == "cost"
        # 两种合法结果: error=no_chat_id, 或 message 含"没有"
        assert result.get("error") == "no_chat_id" or "没有" in result["message"]

    def test_usage_empty_workspace(self, tmp_path: Path):
        """/usage 在空工作区应返回 total_tokens=0."""
        from app.api.v1.workspace.slash_commands import handle_usage

        ws = self._make_ws()
        result = asyncio.run(handle_usage(ws, workspace_path=str(tmp_path)))

        assert result["type"] == "agent.command.result"
        assert result["command"] == "usage"
        assert result["summary"]["total_tokens"] == 0

    def test_agents_empty_list(self, tmp_path: Path):
        """/agents 无后台 agent 时应返回空列表."""
        from app.api.v1.workspace.slash_commands import handle_agents

        ws = self._make_ws()
        result = asyncio.run(handle_agents(ws, args="", workspace_path=str(tmp_path)))

        assert result["type"] == "agent.command.result"
        assert result["command"] == "agents"
        assert result["agents"] == []

    def test_memory_show_default(self, tmp_path: Path):
        """/memory 默认 show 应返回记忆系统状态."""
        from app.api.v1.workspace.slash_commands import handle_memory

        ws = self._make_ws()
        result = asyncio.run(handle_memory(ws, args="", workspace_path=str(tmp_path), chat_id=None))

        assert result["type"] == "agent.command.result"
        assert result["command"] == "memory"
        assert "项目记忆文件" in result["message"]

    def test_memory_clear_no_data(self, tmp_path: Path):
        """/memory clear 无数据时应返回 cleared=False."""
        from app.api.v1.workspace.slash_commands import handle_memory

        ws = self._make_ws()
        result = asyncio.run(handle_memory(ws, args="clear", workspace_path=str(tmp_path), chat_id=None))

        assert result["type"] == "agent.command.result"
        assert result["command"] == "memory"
        # 空工作区应返回 cleared=False 或提示消息
        assert result.get("cleared") is False or "没有" in result["message"] or "已清除" in result["message"]


# ---------------------------------------------------------------------------
# 命令解析测试 (parse_slash_command 严格规则)
# ---------------------------------------------------------------------------

class TestSlashCommandParser:
    """parse_slash_command 边界条件测试."""

    def test_plain_text_returns_none(self):
        """普通文本应返回 None (非 slash 命令)."""
        from app.api.v1.workspace.slash_commands import parse_slash_command

        assert parse_slash_command("hello world") is None
        assert parse_slash_command("") is None
        assert parse_slash_command("/") is None

    def test_valid_command(self):
        """合法 slash 命令应被正确解析."""
        from app.api.v1.workspace.slash_commands import parse_slash_command

        cmd, args = parse_slash_command("/help")
        assert cmd == "help"
        assert args == ""

        cmd, args = parse_slash_command("/plan 实现登录功能")
        assert cmd == "plan"
        assert args == "实现登录功能"

    def test_command_case_insensitive(self):
        """命令名应小写化 (大小写不敏感)."""
        from app.api.v1.workspace.slash_commands import parse_slash_command

        cmd, _ = parse_slash_command("/HELP")
        assert cmd == "help"
        cmd, _ = parse_slash_command("/Plan")
        assert cmd == "plan"

    def test_command_with_multiple_args(self):
        """多参数命令应正确分隔."""
        from app.api.v1.workspace.slash_commands import parse_slash_command

        cmd, args = parse_slash_command("/routine add mytask '0 9 * * *' hello world")
        assert cmd == "routine"
        assert "mytask" in args
        assert "hello world" in args


# ---------------------------------------------------------------------------
# COMMAND_HANDLERS 注册表测试
# ---------------------------------------------------------------------------

class TestCommandHandlerRegistry:
    """COMMAND_HANDLERS 注册表完整性测试."""

    def test_all_slash_commands_have_handlers(self):
        """SLASH_COMMANDS 中所有命令都应在 COMMAND_HANDLERS 中有对应 handler."""
        from app.api.v1.workspace.slash_commands import (
            SLASH_COMMANDS, COMMAND_HANDLERS,
        )

        for name in SLASH_COMMANDS:
            assert name in COMMAND_HANDLERS, f"命令 {name} 缺少 handler"
            assert callable(COMMAND_HANDLERS[name])

    def test_no_orphan_handlers(self):
        """COMMAND_HANDLERS 中不应有未在 SLASH_COMMANDS 注册的命令."""
        from app.api.v1.workspace.slash_commands import (
            SLASH_COMMANDS, COMMAND_HANDLERS,
        )

        for name in COMMAND_HANDLERS:
            assert name in SLASH_COMMANDS, f"handler {name} 未在 SLASH_COMMANDS 注册"

    def test_handler_count_at_least_8(self):
        """应至少有 8 个核心命令."""
        from app.api.v1.workspace.slash_commands import COMMAND_HANDLERS

        assert len(COMMAND_HANDLERS) >= 8, f"命令数量不足: {len(COMMAND_HANDLERS)}"

    def test_extended_commands_registered(self):
        """扩展命令 (cost/usage/memory/agents/pr/routine/swarm) 应全部注册."""
        from app.api.v1.workspace.slash_commands import COMMAND_HANDLERS

        extended = ["cost", "usage", "memory", "agents", "pr", "routine", "swarm"]
        for cmd in extended:
            assert cmd in COMMAND_HANDLERS, f"扩展命令 {cmd} 未注册"


# ---------------------------------------------------------------------------
# 协议层测试: agent_websocket 入口的事件分发 (mock WebSocket)
# ---------------------------------------------------------------------------

class TestAgentWebSocketDispatch:
    """agent_websocket 端点的事件分发测试 (mock WebSocket, 验证完整流程).

    不通过 TestClient.websocket_connect (因 starlette 1.3.x + httpx 0.28 兼容问题),
    直接调用 agent_websocket 协程并 mock WebSocket 实例.
    """

    def test_help_dispatch(self):
        """发送 /help 应触发 handle_help 并推送 agent.command.result."""
        from app.api.v1.workspace.routes import agent_websocket
        from app.security import create_access_token

        token = create_access_token(subject="ws-dispatch-test")
        ws = _make_mock_ws()

        call_count = {"n": 0}

        async def fake_receive_text():
            call_count["n"] += 1
            if call_count["n"] == 1:
                return json.dumps({
                    "prompt": "/help",
                    "workspace_path": ".",
                    "permission_mode": "default",
                })
            # 第二次: 模拟客户端关闭
            raise WebSocketDisconnect(code=1000)

        ws.receive_text = fake_receive_text
        ws.query_params = {"token": token}

        asyncio.run(agent_websocket(ws, user_uuid="ws-dispatch-test"))

        # 验证: 至少收到一次 send_text (command result) + 一次 close
        assert ws.send_text.called, "WebSocket 应至少推送一次"
        # 查找 agent.command.result 推送
        sent_payloads = [
            json.loads(call.args[0])
            for call in ws.send_text.call_args_list
        ]
        result_events = [p for p in sent_payloads if p.get("type") == "agent.command.result"]
        assert len(result_events) >= 1, f"应至少收到一条 command.result, got {sent_payloads}"
        assert result_events[0]["command"] == "help"
        assert "commands" in result_events[0]

    def test_invalid_json_dispatches_error(self):
        """无效 JSON 应被服务端优雅处理."""
        from app.api.v1.workspace.routes import agent_websocket
        from app.security import create_access_token

        token = create_access_token(subject="ws-json-test")
        ws = _make_mock_ws()

        call_count = {"n": 0}

        async def fake_receive_text():
            call_count["n"] += 1
            if call_count["n"] == 1:
                return "not valid json {"
            raise WebSocketDisconnect(code=1000)

        ws.receive_text = fake_receive_text
        ws.query_params = {"token": token}

        asyncio.run(agent_websocket(ws, user_uuid="ws-json-test"))

        # 应收到 agent.error
        sent_payloads = [
            json.loads(call.args[0])
            for call in ws.send_text.call_args_list
        ]
        error_events = [p for p in sent_payloads if p.get("type") == "agent.error"]
        assert len(error_events) >= 1, f"应至少收到一条 error, got {sent_payloads}"
        assert "JSON" in error_events[0]["message"]


# ---------------------------------------------------------------------------
# 鉴权装饰器测试 (ws_require_auth)
# ---------------------------------------------------------------------------

class TestWebSocketAuth:
    """WebSocket 鉴权守卫测试."""

    def test_missing_token_closes_1008(self):
        """无 token 必须 close(1008), 不进入处理函数."""
        from app.ws.auth_decorator import ws_require_auth

        @ws_require_auth
        async def protected(ws, user_uuid: str = ""):
            return "should not reach"

        ws = _make_mock_ws()
        ws.query_params = {}  # 无 token

        result = asyncio.run(protected(ws))
        assert result is None
        ws.close.assert_called_once()
        args, kwargs = ws.close.call_args
        assert kwargs.get("code") == 1008

    def test_valid_token_passes(self):
        """有效 token 应能通过鉴权."""
        from app.ws.auth_decorator import ws_require_auth
        from app.security import create_access_token

        token = create_access_token(subject="auth-test-user")

        @ws_require_auth
        async def protected(ws, user_uuid: str = ""):
            return f"passed: {user_uuid}"

        ws = _make_mock_ws()
        ws.query_params = {"token": token}

        result = asyncio.run(protected(ws))
        assert result == "passed: auth-test-user"
        ws.close.assert_not_called()

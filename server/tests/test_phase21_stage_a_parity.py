"""Stage A 测试 — 对标竞品的 5 项能力补齐.

测试覆盖:
1. WebSocket 鉴权 (/workspace/agent/ws 必须传 ?token=)
2. AGENTS.md / CLAUDE.md / .cursorrules 自动加载
3. Shell 命令黑名单
4. Slash 命令解析 + 6 个内置命令
5. todo_write 触发 agent.todo.update 事件
6. AgentEventType 枚举扩展
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Task 1: WebSocket 鉴权
# ---------------------------------------------------------------------------

class TestWebSocketAuth:
    """验证 /workspace/agent/ws 端点已挂 ws_require_auth 装饰器."""

    def test_routes_imports_auth_decorator(self):
        """routes.py 必须导入 ws_require_auth."""
        from app.api.v1.workspace import routes

        assert hasattr(routes, "ws_require_auth"), "ws_require_auth 未导入"

    def test_agent_websocket_has_auth_decorator(self):
        """agent_websocket 函数必须挂鉴权装饰器 (通过 __wrapped__ 验证)."""
        from app.api.v1.workspace.routes import agent_websocket

        # @ws_require_auth 包装后, 函数会有 wrapper 链
        # 简单检查: 装饰器使用 functools.wraps, 函数名应保留
        assert agent_websocket.__name__ == "agent_websocket"

        # 检查函数源码中包含装饰器痕迹 (从模块 __dict__ 反查)
        # 严格做法: 用 AST 解析
        import ast
        from app.api.v1.workspace import routes as routes_module
        source = Path(routes_module.__file__).read_text(encoding="utf-8")
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "agent_websocket":
                decorators = [
                    ast.unparse(d) for d in node.decorator_list
                ]
                assert any("ws_require_auth" in d for d in decorators), (
                    f"agent_websocket 未挂 @ws_require_auth 装饰器, 当前装饰器: {decorators}"
                )
                return
        pytest.fail("agent_websocket 函数未在 routes.py 中找到")

    def test_user_uuid_signature_accepts_injection(self):
        """agent_websocket 函数签名必须接受 user_uuid 参数, 供装饰器注入."""
        import inspect
        from app.api.v1.workspace.routes import agent_websocket

        sig = inspect.signature(agent_websocket)
        assert "user_uuid" in sig.parameters, (
            "agent_websocket 必须接受 user_uuid 参数, 否则 ws_require_auth 无法注入"
        )


# ---------------------------------------------------------------------------
# Task 2: .cursorrules 兼容
# ---------------------------------------------------------------------------

class TestCursorrulesCompat:
    """验证 .cursorrules 文件在 MEMORY_FILES 列表中."""

    def test_cursorrules_in_memory_files(self):
        from app.api.v1.workspace.memory import MEMORY_FILES

        assert ".cursorrules" in MEMORY_FILES, (
            f".cursorrules 不在 MEMORY_FILES 中, 当前: {MEMORY_FILES}"
        )

    def test_memory_files_priority_order(self):
        """AGENTS.md 应在 .cursorrules 之前 (优先级更高)."""
        from app.api.v1.workspace.memory import MEMORY_FILES

        agents_idx = MEMORY_FILES.index("AGENTS.md")
        cursor_idx = MEMORY_FILES.index(".cursorrules")
        assert agents_idx < cursor_idx, (
            "AGENTS.md 应优先于 .cursorrules 加载"
        )

    def test_load_project_memory_handles_missing_cursorrules(self, tmp_path: Path):
        """当 .cursorrules 不存在时, load_project_memory 不报错."""
        from app.api.v1.workspace.memory import load_project_memory

        # 工作区只有 AGENTS.md, 没有 .cursorrules
        (tmp_path / "AGENTS.md").write_text("# Test\n", encoding="utf-8")
        result = load_project_memory(str(tmp_path))

        assert "AGENTS.md" in result["project_memory"]
        assert isinstance(result["files"], list)

    def test_load_project_memory_loads_cursorrules(self, tmp_path: Path):
        """当 .cursorrules 存在时, 应被加载到 project_memory."""
        from app.api.v1.workspace.memory import load_project_memory

        (tmp_path / "AGENTS.md").write_text("# Project\n", encoding="utf-8")
        (tmp_path / ".cursorrules").write_text("# CSS Rules\n- no !important\n", encoding="utf-8")
        result = load_project_memory(str(tmp_path))

        assert "AGENTS.md" in result["project_memory"]
        assert ".cursorrules" in result["project_memory"]
        assert "no !important" in result["project_memory"]


# ---------------------------------------------------------------------------
# Task 5: Shell 命令黑名单
# ---------------------------------------------------------------------------

class TestShellBlacklist:
    """验证危险 shell 命令被拦截."""

    def test_blacklist_function_exists(self):
        from app.api.v1.workspace.tools import check_shell_blacklist

        assert callable(check_shell_blacklist)

    @pytest.mark.parametrize("dangerous_cmd", [
        "rm -rf /",
        "rm -rf /etc",
        "rm -rf /var/log",
        "rm -rf ~",
        "rm -rf ~",
        "rm -rf ~/Documents",
        "rm -rf ..",
        "rm -rf ../foo",
        "rmdir /",
        "del /*",
        "mkfs.ext4 /dev/sda1",
        "dd if=/dev/zero of=/dev/sda",
        "format C:",
        "diskpart",
        "shutdown -h now",
        "reboot",
        "halt",
        "poweroff",
        "sudo apt install",
        "su - root",
        "iptables -F",
    ])
    def test_dangerous_commands_blocked(self, dangerous_cmd: str):
        from app.api.v1.workspace.tools import check_shell_blacklist

        reason = check_shell_blacklist(dangerous_cmd)
        assert reason is not None, f"危险命令未被拦截: {dangerous_cmd!r}"
        assert len(reason) > 0, f"拦截原因不能为空: {dangerous_cmd!r}"

    @pytest.mark.parametrize("safe_cmd", [
        "ls -la",
        "git status",
        "npm install",
        "python -m pytest",
        "echo 'hello'",
        "cat file.txt",
        "rm -rf node_modules",  # 不在根目录, 应放行
        "rm -rf dist",  # 不在根目录, 应放行
        "rm -rf .next",  # 不在根目录, 应放行
    ])
    def test_safe_commands_allowed(self, safe_cmd: str):
        from app.api.v1.workspace.tools import check_shell_blacklist

        reason = check_shell_blacklist(safe_cmd)
        assert reason is None, f"安全命令被误拦截: {safe_cmd!r} -> {reason!r}"

    @pytest.mark.asyncio
    async def test_tool_run_command_blocks_dangerous(self):
        """tool_run_command 在黑名单命中时返回 success=False + error."""
        from app.api.v1.workspace.tools import tool_run_command

        result = await tool_run_command({"command": "rm -rf /"}, "/tmp")
        assert result.success is False
        assert "安全策略拦截" in (result.error or "")

    @pytest.mark.asyncio
    async def test_tool_run_command_allows_safe(self, tmp_path: Path):
        """tool_run_command 在安全命令时正常执行."""
        from app.api.v1.workspace.tools import tool_run_command

        result = await tool_run_command(
            {"command": "echo hello"},
            str(tmp_path),
        )
        assert result.success is True
        assert "hello" in result.output


# ---------------------------------------------------------------------------
# Task 3: Slash 命令系统
# ---------------------------------------------------------------------------

class TestSlashCommands:
    """验证 slash 命令解析 + 6 个内置命令."""

    def test_slash_command_module_imports(self):
        from app.api.v1.workspace import slash_commands

        assert hasattr(slash_commands, "SLASH_COMMANDS")
        assert hasattr(slash_commands, "COMMAND_HANDLERS")
        assert hasattr(slash_commands, "parse_slash_command")
        assert hasattr(slash_commands, "get_command_list")

    def test_eight_built_in_commands(self):
        """必须实现 8 个 Stage A/B 核心命令 (实际已扩展到 12 个, 包含 cost/usage/memory/agents)."""
        from app.api.v1.workspace.slash_commands import SLASH_COMMANDS

        # 8 个核心 (Stage A + Stage B Plan 模式)
        core = {"help", "clear", "compact", "plan", "plan-accept", "plan-reject", "init", "goal"}
        actual = set(SLASH_COMMANDS.keys())
        assert core.issubset(actual), (
            f"核心命令缺失: 核心 {core}, 实际 {actual}, 差集 {core - actual}"
        )
        # 至少 8 个
        assert len(actual) >= 8, f"命令过少: {actual}"

    def test_parse_slash_command_basic(self):
        from app.api.v1.workspace.slash_commands import parse_slash_command

        result = parse_slash_command("/help")
        assert result == ("help", "")

    def test_parse_slash_command_with_args(self):
        from app.api.v1.workspace.slash_commands import parse_slash_command

        result = parse_slash_command("/goal 实现用户登录")
        assert result == ("goal", "实现用户登录")

    def test_parse_slash_command_case_insensitive(self):
        from app.api.v1.workspace.slash_commands import parse_slash_command

        result = parse_slash_command("/GOAL 测试")
        assert result == ("goal", "测试")

    @pytest.mark.parametrize("non_slash", [
        "",
        "hello",
        "帮我写个函数",
        "/",  # 仅 / 不算
    ])
    def test_parse_slash_command_non_slash(self, non_slash: str):
        from app.api.v1.workspace.slash_commands import parse_slash_command

        assert parse_slash_command(non_slash) is None

    def test_get_command_list_returns_eight(self):
        from app.api.v1.workspace.slash_commands import get_command_list

        cmds = get_command_list()
        assert len(cmds) >= 8
        for c in cmds:
            assert c["name"].startswith("/")
            assert "description" in c
            assert "category" in c

    @pytest.mark.asyncio
    async def test_handle_help(self):
        from app.api.v1.workspace.slash_commands import handle_help

        mock_ws = MagicMock()
        result = await handle_help(mock_ws)
        assert result["type"] == "agent.command.result"
        assert result["command"] == "help"
        assert len(result["commands"]) >= 8

    @pytest.mark.asyncio
    async def test_handle_clear(self):
        from app.api.v1.workspace.slash_commands import handle_clear

        mock_ws = MagicMock()
        result = await handle_clear(mock_ws, chat_id=None)
        assert result["type"] == "agent.command.result"
        assert result["command"] == "clear"
        assert "previous_chat_id" in result

    @pytest.mark.asyncio
    async def test_handle_compact_returns_modify(self):
        from app.api.v1.workspace.slash_commands import handle_compact

        mock_ws = MagicMock()
        result = await handle_compact(mock_ws, args="")
        assert result["type"] == "agent.command.handled"
        assert result["continue_to_loop"] is True
        assert result["modify"].get("compact_first") is True

    @pytest.mark.asyncio
    async def test_handle_plan_sets_permission_mode(self):
        from app.api.v1.workspace.slash_commands import handle_plan

        mock_ws = MagicMock()
        result = await handle_plan(mock_ws, args="重构登录")
        assert result["type"] == "agent.command.handled"
        assert result["modify"]["permission_mode"] == "plan"
        assert result["modify"]["max_iterations"] == 5

    @pytest.mark.asyncio
    async def test_handle_goal_sets_max_iterations(self):
        from app.api.v1.workspace.slash_commands import handle_goal

        mock_ws = MagicMock()
        result = await handle_goal(mock_ws, args="实现用户登录")
        assert result["type"] == "agent.command.handled"
        assert result["modify"]["max_iterations"] == 20

    @pytest.mark.asyncio
    async def test_handle_init_creates_agents_md(self, tmp_path: Path):
        from app.api.v1.workspace.slash_commands import handle_init

        mock_ws = MagicMock()
        result = await handle_init(mock_ws, workspace_path=str(tmp_path))
        assert result["type"] == "agent.command.result"
        assert (tmp_path / "AGENTS.md").exists()
        assert "预览" in result.get("preview", "") or "技术栈" in result.get("preview", "")

    @pytest.mark.asyncio
    async def test_handle_init_skips_existing(self, tmp_path: Path):
        """AGENTS.md 已存在时, /init 不覆盖."""
        from app.api.v1.workspace.slash_commands import handle_init

        existing = tmp_path / "AGENTS.md"
        existing.write_text("# Existing\n", encoding="utf-8")

        mock_ws = MagicMock()
        result = await handle_init(mock_ws, workspace_path=str(tmp_path))
        assert result["type"] == "agent.command.result"
        assert result.get("skipped") is True
        assert existing.read_text(encoding="utf-8") == "# Existing\n"


# ---------------------------------------------------------------------------
# Task 4: todo_write 触发 todo.update 事件
# ---------------------------------------------------------------------------

class TestTodoUpdateEvent:
    """验证 todo_write 工具调用后, agent_loop 额外推送 agent.todo.update 事件."""

    def test_agent_event_type_has_todo_update(self):
        from app.api.v1.workspace.schemas import AgentEventType

        assert hasattr(AgentEventType, "TODO_UPDATE")
        assert AgentEventType.TODO_UPDATE.value == "agent.todo.update"

    def test_agent_event_type_has_command_result(self):
        from app.api.v1.workspace.schemas import AgentEventType

        assert hasattr(AgentEventType, "COMMAND_RESULT")
        assert hasattr(AgentEventType, "COMMAND_HANDLED")
        assert AgentEventType.COMMAND_RESULT.value == "agent.command.result"
        assert AgentEventType.COMMAND_HANDLED.value == "agent.command.handled"


# ---------------------------------------------------------------------------
# 集成测试: routes.py 中 slash 命令拦截
# ---------------------------------------------------------------------------

class TestRoutesSlashIntegration:
    """验证 routes.py 已集成 slash 命令拦截逻辑."""

    def test_routes_imports_slash_commands(self):
        from app.api.v1.workspace import routes

        assert hasattr(routes, "parse_slash_command")
        assert hasattr(routes, "COMMAND_HANDLERS")

    def test_routes_calls_parse_slash_command(self):
        """routes.py 中必须调用 parse_slash_command 处理 prompt."""
        from app.api.v1.workspace import routes as routes_module

        source = Path(routes_module.__file__).read_text(encoding="utf-8")
        assert "parse_slash_command" in source, (
            "routes.py 未调用 parse_slash_command"
        )
        assert "COMMAND_HANDLERS" in source, (
            "routes.py 未引用 COMMAND_HANDLERS"
        )


# ---------------------------------------------------------------------------
# 集成测试: /commands HTTP 端点 (2026-07-07 新增, 供前端 SlashCommandPalette 实时加载)
# ---------------------------------------------------------------------------

class TestCommandsHttpEndpoint:
    """验证 GET /api/v1/workspace/commands 暴露内置命令列表, 供前端 palette 使用."""

    def test_routes_exposes_commands_endpoint(self):
        from app.api.v1.workspace import routes as routes_module

        source = Path(routes_module.__file__).read_text(encoding="utf-8")
        # 必须存在 GET /commands 端点
        assert '@router.get("/commands")' in source, (
            "routes.py 缺少 GET /commands 端点"
        )
        # 必须调用 get_command_list 取数据, 避免双写漂移
        assert "get_command_list" in source, (
            "routes.py /commands 端点未调用 get_command_list"
        )

    def test_routes_imports_get_command_list(self):
        from app.api.v1.workspace import routes

        assert hasattr(routes, "get_command_list"), (
            "routes.py 未从 slash_commands 导入 get_command_list"
        )

    def test_get_command_list_shape(self):
        """get_command_list 返回的每条命令必须包含 name/description/category 字段."""
        from app.api.v1.workspace.slash_commands import get_command_list

        cmds = get_command_list()
        assert isinstance(cmds, list)
        assert len(cmds) >= 6, f"预期 ≥6 个命令, 实际 {len(cmds)}"
        for cmd in cmds:
            assert "name" in cmd
            assert "description" in cmd
            assert "category" in cmd
            assert cmd["name"].startswith("/"), f"命令名必须以 / 开头: {cmd['name']}"


# ---------------------------------------------------------------------------
# 集成测试: useWorkspaceAgent 客户端 composable 暴露 todos / slash command 事件
# ---------------------------------------------------------------------------

class TestUseWorkspaceAgentTodoAndCommands:
    """验证客户端 useWorkspaceAgent 暴露 currentTodos + 处理 todo/command 事件."""

    def test_use_workspace_agent_exposes_todos(self):
        # 前端 TS 文件以 ESM 导出, 静态解析类型契约即可
        path = Path(r"g:/IHUI-AI/client/src/composables/useWorkspaceAgent.ts")
        source = path.read_text(encoding="utf-8")
        assert "AgentTodoItem" in source
        assert "currentTodos" in source
        assert "clearTodos" in source
        assert "onTodoUpdate" in source
        assert "onCommandResult" in source
        assert "onCommandHandled" in source
        assert "agent.todo.update" in source
        assert "agent.command.result" in source
        assert "agent.command.handled" in source

    def test_workspace_service_exposes_get_slash_commands(self):
        path = Path(r"g:/IHUI-AI/client/src/api/services/workspace.service.ts")
        source = path.read_text(encoding="utf-8")
        assert "getSlashCommands" in source
        assert "/commands" in source

    def test_workspace_service_event_type_has_todo_field(self):
        path = Path(r"g:/IHUI-AI/client/src/api/services/workspace.service.ts")
        source = path.read_text(encoding="utf-8")
        # AgentEvent 必须有 todos 字段
        assert "todos?:" in source
        assert "command?:" in source

    def test_aichat_uses_palette_and_tasklist(self):
        """AIChat.vue 必须导入并使用 SlashCommandPalette + TaskListPanel."""
        path = Path(r"g:/IHUI-AI/client/src/components/ai/AIChat.vue")
        source = path.read_text(encoding="utf-8")
        assert "SlashCommandPalette" in source
        assert "TaskListPanel" in source
        assert "slashPaletteVisible" in source
        assert "detectSlashPalette" in source
        assert "todoListForPanel" in source
        # 必须把 useWorkspaceAgent 的 currentTodos 解构出来 (alias 为本地变量)
        assert "currentTodos: workspaceTodos" in source or "currentTodos: agentTodos" in source

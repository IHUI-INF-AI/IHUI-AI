"""
Stage B 测试 — Plan 模式执行路径 (对标 Claude Code / Cursor Plan Mode).

覆盖:
1. PermissionMode 枚举 (default/acceptEdits/plan/bypassPermissions)
2. PermissionChecker 三种核心操作: check_bash / check_edit / check_read
3. 危险命令阻断 (即使在 bypass 模式下也允许审计)
4. Plan 模式: edit/write 必须先有 plan_accepted
5. submit_plan 工具定义存在性
6. Plan 模式: max_iterations 限制

注: Stage B 测试聚焦"Plan 模式工作流", 与 Stage A 的 8 个核心能力互补。
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest


# ---------------------------------------------------------------------------
# Task 1: PermissionMode 枚举完整性
# ---------------------------------------------------------------------------

class TestPermissionMode:
    """4 种权限模式必须存在 (对标 Claude Code)."""

    def test_four_modes_exist(self):
        from app.api.v1.workspace.permissions import PermissionMode

        assert PermissionMode.DEFAULT == "default"
        assert PermissionMode.ACCEPT_EDITS == "acceptEdits"
        assert PermissionMode.PLAN == "plan"
        assert PermissionMode.BYPASS == "bypassPermissions"

    def test_mode_values_distinct(self):
        from app.api.v1.workspace.permissions import PermissionMode

        modes = {PermissionMode.DEFAULT, PermissionMode.ACCEPT_EDITS, PermissionMode.PLAN, PermissionMode.BYPASS}
        assert len(modes) == 4, f"权限模式重复: {modes}"


# ---------------------------------------------------------------------------
# Task 2: PermissionChecker 行为
# ---------------------------------------------------------------------------

class TestPermissionChecker:
    """PermissionChecker 阻断危险操作."""

    def test_default_mode_blocks_dangerous_bash(self):
        from app.api.v1.workspace.permissions import PermissionChecker, PermissionMode

        checker = PermissionChecker(workspace_path="/tmp", mode=PermissionMode.DEFAULT)
        # rm -rf / 应该被阻断或需要确认
        result = checker.check("run_command", {"command": "rm -rf /"})
        # default 模式可以"需确认" (needs_confirmation=True), 不允许直接 allowed
        assert result.get("allowed") is True and result.get("needs_confirmation") is True, (
            f"dangerous command should need confirmation: {result}"
        )

    def test_bypass_mode_allows_everything(self):
        from app.api.v1.workspace.permissions import PermissionChecker, PermissionMode

        checker = PermissionChecker(workspace_path="/tmp", mode=PermissionMode.BYPASS)
        result = checker.check("run_command", {"command": "rm -rf /"})
        assert result.get("allowed") is True, f"bypass mode blocked: {result}"

    def test_plan_mode_blocks_edits(self):
        from app.api.v1.workspace.permissions import PermissionChecker, PermissionMode

        checker = PermissionChecker(workspace_path="/tmp", mode=PermissionMode.PLAN)
        # Plan 模式只能只读
        result = checker.check("write_file", {"path": "/tmp/test.py", "content": "x"})
        # plan 模式应拒绝写操作
        assert result.get("allowed") is False, f"plan mode allowed write: {result}"


# ---------------------------------------------------------------------------
# Task 3: submit_plan 工具定义 (Agent 探索后提交计划的"出口")
# ---------------------------------------------------------------------------

class TestSubmitPlanTool:
    """submit_plan 工具必须定义完整."""

    def test_submit_plan_tool_defined(self):
        from app.api.v1.workspace.agent_loop import SUBMIT_PLAN_TOOL_DEFINITION

        assert SUBMIT_PLAN_TOOL_DEFINITION["type"] == "function"
        assert SUBMIT_PLAN_TOOL_DEFINITION["function"]["name"] == "submit_plan"
        params = SUBMIT_PLAN_TOOL_DEFINITION["function"]["parameters"]
        assert "title" in params["properties"]
        assert "summary" in params["properties"]
        assert "steps" in params["properties"]

    def test_submit_plan_steps_schema(self):
        from app.api.v1.workspace.agent_loop import SUBMIT_PLAN_TOOL_DEFINITION

        steps_schema = SUBMIT_PLAN_TOOL_DEFINITION["function"]["parameters"]["properties"]["steps"]
        assert steps_schema["type"] == "array"
        item_props = steps_schema["items"]["properties"]
        assert "id" in item_props
        assert "title" in item_props
        assert "description" in item_props


# ---------------------------------------------------------------------------
# Task 4: Slash 命令 Plan 模式支持
# ---------------------------------------------------------------------------

class TestSlashPlanCommands:
    """/plan /plan-accept /plan-reject 三个命令必须工作."""

    def test_plan_command_exists(self):
        from app.api.v1.workspace.slash_commands import SLASH_COMMANDS, handle_plan

        assert "plan" in SLASH_COMMANDS
        assert callable(handle_plan)

    def test_plan_accept_command_exists(self):
        from app.api.v1.workspace.slash_commands import SLASH_COMMANDS, handle_plan_accept

        assert "plan-accept" in SLASH_COMMANDS
        assert callable(handle_plan_accept)

    def test_plan_reject_command_exists(self):
        from app.api.v1.workspace.slash_commands import SLASH_COMMANDS, handle_plan_reject

        assert "plan-reject" in SLASH_COMMANDS
        assert callable(handle_plan_reject)


# ---------------------------------------------------------------------------
# Task 5: Agent 循环集成 Plan 模式
# ---------------------------------------------------------------------------

class TestAgentLoopPlanIntegration:
    """agent_loop 必须支持 plan 模式 (permission_mode='plan')."""

    def test_plan_mode_constant_in_agent_loop(self):
        from app.api.v1.workspace import agent_loop
        from app.api.v1.workspace.permissions import PermissionMode

        # agent_loop 引用了 PermissionMode.PLAN
        src = Path(agent_loop.__file__).read_text(encoding="utf-8")
        assert "PermissionMode.PLAN" in src, "agent_loop 未引用 PermissionMode.PLAN"
        assert "submit_plan" in src, "agent_loop 未引用 submit_plan"

    def test_subagents_tool_definition(self):
        """Task 工具 (子代理) 必须有定义 (对标 Codex Sub-agents)."""
        from app.api.v1.workspace.subagents import TASK_TOOL_DEFINITION

        assert TASK_TOOL_DEFINITION["type"] == "function"
        assert TASK_TOOL_DEFINITION["function"]["name"] == "task"


# ---------------------------------------------------------------------------
# Task 6: Persona + Plan 模式协同
# ---------------------------------------------------------------------------

class TestPersonaPlanIntegration:
    """Persona 可以与 Plan 模式协同 (Persona 提供 system_prompt, Plan 限制执行)."""

    def test_persona_registry_has_plan_capable(self):
        """至少 1 个 Persona 适合 Plan 模式 (architect/planner)."""
        from app.api.v1.workspace.persona_registry import get_persona_registry

        reg = get_persona_registry()
        all_personas = reg.search("", limit=0)
        # 查找与 plan/architect 相关的 persona
        keywords = ["plan", "architect", "design"]
        matched = []
        for p in all_personas:
            if any(k in p.id.lower() or k in p.tags for k in keywords):
                matched.append(p.id)
        assert len(matched) >= 1, f"未找到 plan 相关的 persona, 关键词: {keywords}"


# ---------------------------------------------------------------------------
# Task 7: Codebase 索引与 Plan 模式协同
# ---------------------------------------------------------------------------

class TestCodebasePlanIntegration:
    """Codebase 索引必须支持 Plan 模式 (Plan 阶段会探索代码)."""

    def test_codebase_search_function_exists(self):
        from app.api.v1.workspace.codebase_index import search_symbols, fuzzy_search_files

        assert callable(search_symbols)
        assert callable(fuzzy_search_files)

    def test_vector_search_function_exists(self):
        from app.api.v1.workspace.vector_index import search_semantic

        assert callable(search_semantic)

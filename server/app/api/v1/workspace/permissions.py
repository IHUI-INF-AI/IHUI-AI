"""
权限系统 — 对标 Claude Code 的 Permission System。

支持:
- allow/ask/deny 规则 (工具级 + 路径级)
- 4 种权限模式: default / acceptEdits / plan / bypassPermissions
- Bash 前缀匹配
- Edit/Read 路径范围匹配
- MCP 工具权限 (mcp__server / mcp__server__tool)

配置来源: .claude/settings.json 的 permissions 字段
"""

from __future__ import annotations

import fnmatch
import json
from pathlib import Path
from typing import Any

from loguru import logger


# ---------------------------------------------------------------------------
# 权限模式
# ---------------------------------------------------------------------------

class PermissionMode:
    DEFAULT = "default"
    ACCEPT_EDITS = "acceptEdits"
    PLAN = "plan"
    BYPASS = "bypassPermissions"


# ---------------------------------------------------------------------------
# 权限规则
# ---------------------------------------------------------------------------

class PermissionRule:
    """单条权限规则, 如 Bash(npm run test:*) / Edit(/src/**/*.ts) / Read(~/.env)"""

    def __init__(self, tool: str, pattern: str, action: str):
        self.tool = tool      # Bash / Edit / Read / Write / mcp__server / mcp__server__tool
        self.pattern = pattern  # 匹配模式
        self.action = action    # allow / ask / deny

    def matches(self, tool_name: str, args: dict[str, Any]) -> bool:
        """检查此规则是否匹配给定的工具调用。"""
        # 工具名匹配
        if self.tool == "Bash" and tool_name == "run_command":
            command = args.get("command", "")
            # Bash 用前缀匹配 (非 glob)
            if self.pattern.endswith(":*"):
                prefix = self.pattern[:-2]
                return command.startswith(prefix)
            return command == self.pattern or command.startswith(self.pattern)

        elif self.tool in ("Edit", "Write") and tool_name in ("edit_file", "write_file", "multi_edit"):
            path = args.get("path", "")
            return _match_path(path, self.pattern)

        elif self.tool == "Read" and tool_name in ("read_file", "list_dir", "glob", "grep"):
            path = args.get("path", "")
            return _match_path(path, self.pattern) if path else False

        elif self.tool.startswith("mcp__"):
            # MCP 工具: mcp__server 或 mcp__server__tool
            parts = self.tool.split("__")
            if len(parts) == 2:
                # mcp__server — 匹配该 server 的所有工具
                return tool_name.startswith(f"mcp__{parts[1]}")
            elif len(parts) == 3:
                # mcp__server__tool — 精确匹配
                return tool_name == self.tool

        return False


def _match_path(path: str, pattern: str) -> bool:
    """路径匹配 (支持 glob 模式)。"""
    # 展开 ~ 为 home 目录
    if pattern.startswith("~"):
        pattern = str(Path.home()) + pattern[1:]
    # 相对路径视为相对当前目录
    if not pattern.startswith("/") and not pattern.startswith("~"):
        pattern = "**/" + pattern
    return fnmatch.fnmatch(path, pattern)


# ---------------------------------------------------------------------------
# 权限检查器
# ---------------------------------------------------------------------------

class PermissionChecker:
    """权限检查器 — 加载规则, 检查工具调用是否允许。"""

    def __init__(self, workspace_path: str, mode: str = PermissionMode.DEFAULT):
        self.workspace = workspace_path
        self.mode = mode
        self.rules: list[PermissionRule] = []
        self._load_rules()

    def _load_rules(self) -> None:
        """从 .claude/settings.json 加载权限规则。"""
        settings_path = Path(self.workspace) / ".claude" / "settings.json"
        if not settings_path.exists():
            return

        try:
            data = json.loads(settings_path.read_text(encoding="utf-8"))
            permissions = data.get("permissions", {})

            for rule_str in permissions.get("allow", []):
                rule = _parse_rule(rule_str, "allow")
                if rule:
                    self.rules.append(rule)

            for rule_str in permissions.get("ask", []):
                rule = _parse_rule(rule_str, "ask")
                if rule:
                    self.rules.append(rule)

            for rule_str in permissions.get("deny", []):
                rule = _parse_rule(rule_str, "deny")
                if rule:
                    self.rules.append(rule)

        except Exception as e:
            logger.warning(f"加载权限规则失败: {e}")

    def check(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any]:
        """检查工具调用是否允许。

        Returns:
            {"allowed": bool, "needs_confirmation": bool, "reason": str}
        """
        # bypassPermissions 模式: 全部允许
        if self.mode == PermissionMode.BYPASS:
            return {"allowed": True, "needs_confirmation": False, "reason": "bypassPermissions"}

        # plan 模式: 只允许只读工具 + submit_plan (两阶段分离: Agent 探索后调用 submit_plan 提交计划)
        if self.mode == PermissionMode.PLAN:
            read_only_tools = {
                "read_file", "list_dir", "glob", "grep",
                "git_status", "git_diff", "git_log",
                "todo_read", "web_fetch", "codebase_search",
            }
            plan_mode_tools = read_only_tools | {"submit_plan"}
            if tool_name in plan_mode_tools:
                if tool_name == "submit_plan":
                    return {"allowed": True, "needs_confirmation": False, "reason": "plan: submit_plan 提交计划"}
                return {"allowed": True, "needs_confirmation": False, "reason": "plan: read-only"}
            return {"allowed": False, "needs_confirmation": False, "reason": "plan: 只读模式, 禁止修改操作 (需 /plan-accept 进入执行阶段)"}

        # acceptEdits 模式: 自动接受文件编辑
        if self.mode == PermissionMode.ACCEPT_EDITS:
            edit_tools = {"edit_file", "write_file", "multi_edit", "delete_file"}
            if tool_name in edit_tools:
                # 仍检查 deny 规则
                deny_rule = self._find_rule(tool_name, args, "deny")
                if deny_rule:
                    return {"allowed": False, "needs_confirmation": False, "reason": f"deny 规则: {deny_rule.tool}({deny_rule.pattern})"}
                return {"allowed": True, "needs_confirmation": False, "reason": "acceptEdits"}

        # 检查 deny 规则 (最高优先级)
        deny_rule = self._find_rule(tool_name, args, "deny")
        if deny_rule:
            return {"allowed": False, "needs_confirmation": False, "reason": f"deny: {deny_rule.tool}({deny_rule.pattern})"}

        # 检查 allow 规则
        allow_rule = self._find_rule(tool_name, args, "allow")
        if allow_rule:
            return {"allowed": True, "needs_confirmation": False, "reason": f"allow: {allow_rule.tool}({allow_rule.pattern})"}

        # 检查 ask 规则
        ask_rule = self._find_rule(tool_name, args, "ask")
        if ask_rule:
            return {"allowed": True, "needs_confirmation": True, "reason": f"ask: {ask_rule.tool}({ask_rule.pattern})"}

        # default 模式: 首次使用每个工具时需要确认
        return {"allowed": True, "needs_confirmation": True, "reason": "default: 首次使用需确认"}

    def _find_rule(self, tool_name: str, args: dict[str, Any], action: str) -> PermissionRule | None:
        """查找匹配的规则。"""
        for rule in self.rules:
            if rule.action == action and rule.matches(tool_name, args):
                return rule
        return None


def _parse_rule(rule_str: str, action: str) -> PermissionRule | None:
    """解析规则字符串, 如 'Bash(npm run test:*)' → PermissionRule('Bash', 'npm run test:*', action)"""
    rule_str = rule_str.strip()
    if "(" not in rule_str or not rule_str.endswith(")"):
        # 无参数规则, 匹配该工具的所有调用
        return PermissionRule(rule_str, "*", action)

    tool = rule_str[: rule_str.index("(")]
    pattern = rule_str[rule_str.index("(") + 1 : -1]
    return PermissionRule(tool, pattern, action)


# ---------------------------------------------------------------------------
# 快捷函数
# ---------------------------------------------------------------------------

def check_permission(
    workspace_path: str,
    tool_name: str,
    args: dict[str, Any],
    mode: str = PermissionMode.DEFAULT,
) -> dict[str, Any]:
    """快捷权限检查。"""
    checker = PermissionChecker(workspace_path, mode)
    return checker.check(tool_name, args)

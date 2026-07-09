"""Slash 命令集合。

12 个 slash 命令: /goal /loop /skill /plan /memory /persona /help /clear
/bug /improve /status /version。每个命令有 name/description/handler。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Awaitable

from .skills import skill_registry


@dataclass
class SlashCommand:
    """Slash 命令定义。"""

    name: str
    description: str
    handler: Callable[[list[str], dict[str, Any]], Awaitable[str]]


async def _goal_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/goal — 设定当前会话目标。"""
    goal = " ".join(args) if args else "(未指定目标)"
    ctx.setdefault("goal", goal)
    return f"✅ 已设定目标: {goal}"


async def _loop_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/loop — 设置 agent 循环执行模式。"""
    if not args:
        return "用法: /loop <on|off|iterations>。例如 /loop on 或 /loop 5"
    arg = args[0].lower()
    if arg in {"on", "true", "1"}:
        ctx["loop_mode"] = True
        return "🔁 循环执行模式: 开启"
    if arg in {"off", "false", "0"}:
        ctx["loop_mode"] = False
        return "🔁 循环执行模式: 关闭"
    if arg.isdigit():
        ctx["max_iterations"] = int(arg)
        return f"🔁 最大迭代次数已设为 {arg}"
    return f"未知参数: {arg}(支持 on/off 或数字)"


async def _skill_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/skill — 列出或选择预置 skill。"""
    if not args:
        skills = skill_registry.list()
        lines = [f"- {s.name}: {s.description}" for s in skills]
        return "可用 skill:\n" + "\n".join(lines)
    name = args[0]
    skill = skill_registry.get(name)
    if not skill:
        return f"❌ 未找到 skill: {name}"
    ctx["current_skill"] = name
    return f"✅ 已选择 skill: {name}\n{skill.description}"


async def _plan_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/plan — 生成任务计划。"""
    task = " ".join(args) if args else "(未指定任务)"
    return (
        f"📋 任务计划: {task}\n"
        "1. 需求分析与拆解\n"
        "2. 方案设计\n"
        "3. 实现核心逻辑\n"
        "4. 测试与验证\n"
        "5. 文档与交付"
    )


async def _memory_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/memory — 查看或管理会话记忆。"""
    from .memory import memory_store

    session_id = ctx.get("session_id", "default")
    if not args:
        msgs = await memory_store.get(session_id)
        if not msgs:
            return "📝 当前会话无记忆"
        lines = [f"[{m['role']}] {m['content'][:80]}" for m in msgs[-10:]]
        return f"📝 最近 {len(lines)} 条记忆:\n" + "\n".join(lines)
    if args[0] == "clear":
        await memory_store.clear(session_id)
        return "🗑️ 会话记忆已清除"
    if args[0] == "list":
        sessions = await memory_store.list_sessions()
        return f"📝 所有会话: {', '.join(sessions) if sessions else '(无)'}"
    return f"未知子命令: {args[0]}(支持 clear / list)"


async def _persona_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/persona — 切换 agent 人设。"""
    if not args:
        return "用法: /persona <name>。可选: developer / reviewer / architect / teacher"
    name = args[0]
    personas = {
        "developer": "你是一名资深全栈开发工程师,专注于高质量代码实现。",
        "reviewer": "你是一名严谨的代码审查专家,关注质量、安全与最佳实践。",
        "architect": "你是一名系统架构师,关注可扩展性、可维护性与技术选型。",
        "teacher": "你是一名耐心的技术导师,善于用通俗语言解释复杂概念。",
    }
    persona = personas.get(name)
    if not persona:
        return f"❌ 未知人设: {name}。可选: {', '.join(personas.keys())}"
    ctx["persona"] = persona
    return f"🎭 已切换人设: {name}\n{persona}"


async def _help_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/help — 显示所有命令帮助。"""
    lines = [f"/{c.name} — {c.description}" for c in _BUILTIN_COMMANDS]
    return "📖 可用命令:\n" + "\n".join(lines)


async def _clear_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/clear — 清除当前会话上下文。"""
    from .memory import memory_store

    session_id = ctx.get("session_id", "default")
    await memory_store.clear(session_id)
    ctx.clear()
    return "🧹 当前会话上下文已清除"


async def _bug_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/bug — 报告 bug 并启动调试。"""
    desc = " ".join(args) if args else "(未描述 bug)"
    return (
        f"🐛 Bug 报告: {desc}\n"
        "调试步骤:\n"
        "1. 复现问题\n"
        "2. 定位根因\n"
        "3. 编写修复\n"
        "4. 验证修复\n"
        "建议使用 /skill debug-fix 进行修复"
    )


async def _improve_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/improve — 对当前内容提出改进建议。"""
    target = " ".join(args) if args else "当前会话内容"
    return (
        f"💡 改进建议目标: {target}\n"
        "1. 代码质量: 命名、注释、复杂度\n"
        "2. 性能: 算法、IO、缓存\n"
        "3. 可维护性: 模块化、测试覆盖\n"
        "4. 安全: 输入校验、权限控制"
    )


async def _status_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/status — 显示当前 agent 状态。"""
    from .agent_loop import agent_executor

    running = agent_executor.list_running()
    lines = [f"- {tid} ({info['status']}): {info.get('goal', '')}" for tid, info in running.items()]
    body = "\n".join(lines) if lines else "(无运行中任务)"
    return f"📊 Agent 状态:\n运行中任务数: {len(running)}\n{body}"


async def _version_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/version — 显示服务版本信息。"""
    from .. import __version__

    return (
        f"🏷️ IHUI AI Service v{__version__}\n"
        "技术栈: FastAPI + LangGraph + LiteLLM + MCP"
    )


# 12 个 slash 命令
_BUILTIN_COMMANDS: list[SlashCommand] = [
    SlashCommand(name="goal", description="设定当前会话目标", handler=_goal_handler),
    SlashCommand(name="loop", description="设置循环执行模式", handler=_loop_handler),
    SlashCommand(name="skill", description="列出或选择预置 skill", handler=_skill_handler),
    SlashCommand(name="plan", description="生成任务计划", handler=_plan_handler),
    SlashCommand(name="memory", description="查看或管理会话记忆", handler=_memory_handler),
    SlashCommand(name="persona", description="切换 agent 人设", handler=_persona_handler),
    SlashCommand(name="help", description="显示所有命令帮助", handler=_help_handler),
    SlashCommand(name="clear", description="清除当前会话上下文", handler=_clear_handler),
    SlashCommand(name="bug", description="报告 bug 并启动调试", handler=_bug_handler),
    SlashCommand(name="improve", description="对当前内容提出改进建议", handler=_improve_handler),
    SlashCommand(name="status", description="显示当前 agent 状态", handler=_status_handler),
    SlashCommand(name="version", description="显示服务版本信息", handler=_version_handler),
]


class SlashCommandRegistry:
    """Slash 命令注册表。"""

    def __init__(self) -> None:
        self._commands: dict[str, SlashCommand] = {c.name: c for c in _BUILTIN_COMMANDS}

    def list(self) -> list[SlashCommand]:
        """列出全部 slash 命令。"""
        return list(self._commands.values())

    def get(self, name: str) -> SlashCommand | None:
        """按名称获取命令,不存在返回 None。"""
        return self._commands.get(name)

    async def execute(
        self,
        name: str,
        args: list[str] | None = None,
        ctx: dict[str, Any] | None = None,
    ) -> str:
        """执行 slash 命令并返回输出字符串。"""
        cmd = self._commands.get(name)
        if not cmd:
            available = ", ".join(self._commands.keys())
            return f"❌ 未知命令: /{name}。可用命令: {available}"
        return await cmd.handler(args or [], ctx if ctx is not None else {})


slash_command_registry = SlashCommandRegistry()

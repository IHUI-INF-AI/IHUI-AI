# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Slash 命令集合。

13 个 slash 命令: /goal /loop /skill /plan /memory /persona /help /clear
/bug /improve /status /version /bestof。每个命令有 name/description/handler。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

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
        skills = skill_registry.list_skills()
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


async def _bestof_handler(args: list[str], ctx: dict[str, Any]) -> str:
    """/bestof — 同任务 N 副本并行执行 + LLM 评审自动择优(2026-09-07 立)。"""
    from .best_of_n import BestOfNError, best_of_n_runner

    task = " ".join(args).strip()
    if not task:
        return "用法: /bestof <任务描述>[ #N]。例如 /bestof 用一句话介绍量子计算 #3(N=副本数,默认 3)"

    # 可选 #N 尾缀控制副本数(1-5)
    n = 3
    import re

    m = re.search(r"\s#(\d+)\s*$", task)
    if m:
        n = max(1, min(5, int(m.group(1))))
        task = task[: m.start()].strip()

    session_id = str(ctx.get("session_id", "") or "")
    try:
        result = await best_of_n_runner.run(
            [{"role": "user", "content": task}],
            n=n,
            session_id=session_id,
        )
    except BestOfNError as e:
        return f"❌ Best-of-N 失败: {e}"

    w = result.winner
    lines = [
        f"🏆 Best-of-N 择优完成(N={result.n_requested}"
        + (f",评审 {result.evaluator_model}" if not result.evaluator_fallback else ",评审兜底")
        + f",总成本 ${result.total_cost_usd:.4f})",
        "",
        w.content or "(空回复)",
        "",
        "| 副本 | 评分 | 模型 | 耗时 | 状态 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for c in result.candidates:
        score = "—" if c.score is None else str(c.score)
        status = "✅" if c.ok else f"❌ {c.error[:40]}"
        lines.append(
            f"| #{c.candidate_id} | {score} | {c.model} | {c.latency_ms}ms | {status} |"
        )
    if result.rationale:
        lines += ["", f"📌 评审理由: {result.rationale}"]
    return "\n".join(lines)


# 13 个 slash 命令
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
    SlashCommand(
        name="bestof",
        description="同任务 N 副本并行执行 + LLM 评审自动择优",
        handler=_bestof_handler,
    ),
]


class SlashCommandRegistry:
    """Slash 命令注册表。"""

    def __init__(self) -> None:
        self._commands: dict[str, SlashCommand] = {c.name: c for c in _BUILTIN_COMMANDS}

    def list_commands(self) -> list[SlashCommand]:
        """列出全部 slash 命令。

        方法名避开内置 list(2026-07-26):原方法名 list 与内置 list 冲突,
        导致 mypy 全库模式下类作用域内 list[str] 类型注解被解析为方法引用,
        触发 [valid-type] 错误。
        """
        return list(self._commands.values())

    def get(self, name: str) -> SlashCommand | None:
        """按名称获取命令,不存在返回 None。"""
        return self._commands.get(name)

    def reload(self, *, force: bool = True) -> dict[str, Any]:
        """运行时热重载 —— 控制帧 `reload_plugins` 的服务端实现(2026-10-28 立)。

        竞品原帧语义(2026-09 取证,qoder-control-frames.md 第 91 行):
        `let e=await this.request({type:"reload_plugins"});
         return this.replaceLatestCommands(e.commands),e`
        —— 即**宿主显式调用 + 必须把"最新的命令列表"回灌给宿主**(replaceLatestCommands),
        不是"后台自己会重载"。判据:调用方拿得到重载后的命令集合。

        我方插件面的对位物 = **技能(SKILL.md)贡献的命令能力**。本仓的 slash 命令表
        本身是静态内置的(见 `_BUILTIN_COMMANDS`),但 `/skill` 命令动态读取
        `skill_registry.list_skills()` —— 所以"插件(技能)变了"必须体现在**命令可见的
        技能集合**上。故本方法:
          ① 先调 `skill_registry.reload(force=force)` 让技能面真正重扫(复用
             `reload_skills` 帧的同一份实现,不新造第二套扫描逻辑);
          ② 再回报**重载后的完整命令列表**(内置命令 + 当前技能集合派生的 /skill 视图),
             即竞品 `replaceLatestCommands(e.commands)` 的等价物;
          ③ 同时带上技能差额(added/removed/changed),让"插件变了什么"可见 ——
             只回一句"已重载"等于把静默失败包装成成功态。

        Returns:
            {
                "reloaded": bool,
                "commands": [{"name", "description"}, ...],  # 重载后的最新命令列表
                "commandCount": int,
                "skills": int,                                  # 当前技能总数
                "added": [...], "removed": [...], "changed": [...],  # 技能差额
                "lastReload": str | None,
                "forced": bool,
            }

        任何异常都被捕获,返回 {"reloaded": False, "error": str(e)} —— 挂在帧处理器上,
        绝不能向上抛导致引擎崩溃。
        """
        try:
            skill_diff = skill_registry.reload(force=force)
            # 命令列表 = 内置命令 + 技能贡献的 /skill 视图(技能集合已随上面重载更新)。
            commands = [
                {"name": c.name, "description": c.description}
                for c in self.list_commands()
            ]
            skill_names = sorted(s.name for s in skill_registry.list_skills())
            return {
                "reloaded": True,
                "commands": commands,
                "commandCount": len(commands),
                "skills": len(skill_names),
                "skillNames": skill_names,
                "added": skill_diff.get("added", []),
                "removed": skill_diff.get("removed", []),
                "changed": skill_diff.get("changed", []),
                "lastReload": skill_diff.get("lastReload"),
                "forced": force,
            }
        except Exception as e:  # noqa: BLE001 - 兜底:绝不向上抛
            return {"reloaded": False, "error": str(e)}

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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

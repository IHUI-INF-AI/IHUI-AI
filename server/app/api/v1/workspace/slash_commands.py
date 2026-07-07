"""Slash 命令系统 — 对标 Claude Code / Codex / Trae 的 /command 面板.

设计要点:
- 6 个内置命令覆盖对话控制 / 模式切换 / 工作区引导
- 纯命令 (help/clear/init) 仅返回结果事件, 不进入 agent loop
- 状态修改命令 (plan/goal/compact) 返回 modify 字段, WebSocket 层应用后继续进入 agent loop
- 命令解析严格: 仅以 / 开头的整行消息, 否则透传给 LLM

事件协议:
- agent.command.result  纯命令结果 (不进入 agent loop)
- agent.command.handled 状态修改确认 (WebSocket 应用 modify 后继续)

扩展方法:
- 在 SLASH_COMMANDS 注册新命令
- 在 COMMAND_HANDLERS 实现新 handler
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import WebSocket


# 命令注册表 — 同时供 /help 输出和前端 SlashCommandPalette 使用
SLASH_COMMANDS: dict[str, dict[str, Any]] = {
    "help": {
        "description": "显示所有可用的 slash 命令",
        "category": "info",
    },
    "clear": {
        "description": "清除当前会话上下文, 开始新对话",
        "category": "session",
    },
    "compact": {
        "description": "压缩对话上下文 (从 N 消息压到 ≤12 条)",
        "category": "context",
    },
    "plan": {
        "description": "进入 Plan 模式: 只读探索 + submit_plan 提交计划 (两阶段分离)",
        "category": "mode",
    },
    "plan-accept": {
        "description": "接受 Agent 提交的计划, 切换到执行模式 (Stage B)",
        "category": "mode",
    },
    "plan-reject": {
        "description": "拒绝 Agent 提交的计划, 保留当前 session (Stage B)",
        "category": "mode",
    },
    "init": {
        "description": "扫描工作区生成 AGENTS.md 草案 (仅当文件不存在)",
        "category": "setup",
    },
    "goal": {
        "description": "进入 Goal 模式: max_iterations=20, 完成后 yield done",
        "category": "mode",
    },
    "cost": {
        "description": "显示当前会话的 Token 用量与成本估算",
        "category": "info",
    },
    "usage": {
        "description": "显示工作区全局用量统计 (所有会话汇总)",
        "category": "info",
    },
    "memory": {
        "description": "记忆管理: /memory [show|save|clear] 查看/提取/清除自动学习",
        "category": "context",
    },
    "pr": {
        "description": "GitHub PR 管理: /pr 列出 | /pr <编号> 详情 | /pr create <标题> 创建",
        "category": "github",
    },
    "agents": {
        "description": "后台 Agent 管理: /agents [cancel <id>] 列出/取消后台任务",
        "category": "session",
    },
    "routine": {
        "description": "定时任务管理: /routine [add|remove|enable|disable|trigger] 管理定时任务",
        "category": "session",
    },
}


def parse_slash_command(prompt: str) -> tuple[str, str] | None:
    """解析 /command. 返回 (command, args) 或 None (非 slash 命令).

    严格规则:
    - 整行首字符为 /
    - 命令名后必须跟空白或行尾
    - 长度 0 或仅 / 不算
    """
    if not prompt or not prompt.startswith("/"):
        return None
    parts = prompt[1:].split(maxsplit=1)
    if not parts or not parts[0]:
        return None
    return parts[0].lower(), parts[1] if len(parts) > 1 else ""


def get_command_list() -> list[dict[str, str]]:
    """返回命令列表 (供 /help 和前端 palette)."""
    return [
        {"name": f"/{name}", "description": info["description"], "category": info["category"]}
        for name, info in SLASH_COMMANDS.items()
    ]


# ---------------------------------------------------------------------------
# Token 用量与成本估算 (对标 Codex /cost /usage 和 Claude Code 的用量追踪)
# ---------------------------------------------------------------------------

# 模型定价表 (美元 / 百万 tokens) — 仅供参考, 实际以供应商为准
# 格式: { "模型关键字": {"input": float, "output": float} }
MODEL_PRICING: dict[str, dict[str, float]] = {
    "claude-opus-4": {"input": 15.0, "output": 75.0},
    "claude-sonnet-4": {"input": 3.0, "output": 15.0},
    "claude-3-5-sonnet": {"input": 3.0, "output": 15.0},
    "claude-3-5-haiku": {"input": 0.8, "output": 4.0},
    "claude-3-opus": {"input": 15.0, "output": 75.0},
    "gpt-4o": {"input": 2.5, "output": 10.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.6},
    "gpt-4-turbo": {"input": 10.0, "output": 30.0},
    "deepseek-chat": {"input": 0.27, "output": 1.1},
    "deepseek-reasoner": {"input": 0.55, "output": 2.19},
    "qwen-max": {"input": 2.76, "output": 8.28},
    "qwen-plus": {"input": 0.42, "output": 1.26},
    "qwen-turbo": {"input": 0.14, "output": 0.42},
    "doubao-pro": {"input": 0.11, "output": 0.28},
    "moonshot-v1": {"input": 1.68, "output": 1.68},
}

# 默认费率 (无法识别模型时使用)
_DEFAULT_PRICING = {"input": 3.0, "output": 15.0}


def _get_model_pricing(model_id: str) -> dict[str, float]:
    """根据模型 ID 匹配定价表。"""
    model_lower = model_id.lower()
    for key, pricing in MODEL_PRICING.items():
        if key in model_lower:
            return pricing
    return _DEFAULT_PRICING


def _estimate_cost(usage: dict[str, Any], model_id: str = "") -> dict[str, float]:
    """估算成本 (美元)。

    Returns:
        {"input_cost": float, "output_cost": float, "total_cost": float}
    """
    pricing = _get_model_pricing(model_id)
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
    output_cost = (completion_tokens / 1_000_000) * pricing["output"]
    return {
        "input_cost": round(input_cost, 6),
        "output_cost": round(output_cost, 6),
        "total_cost": round(input_cost + output_cost, 6),
        "input_rate": pricing["input"],
        "output_rate": pricing["output"],
    }


def _format_tokens(n: int) -> str:
    """格式化 token 数量 (K/M)。"""
    if n >= 1_000_000:
        return f"{n / 1_000_000:.2f}M"
    elif n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return str(n)


def _format_cost(cost: float) -> str:
    """格式化成本。"""
    if cost < 0.01:
        return f"${cost * 1000:.3f}m"  # 毫美元
    return f"${cost:.4f}"


async def handle_cost(
    websocket: WebSocket,
    chat_id: str | None,
    model_id: str = "",
    **kwargs,
) -> dict[str, Any]:
    """/cost - 显示当前会话的 Token 用量与成本估算。

    读取 session 中累积的 usage 数据, 计算:
    - prompt / completion / total tokens
    - API 调用次数 / 交互轮数
    - 成本估算 (基于模型定价表)
    """
    if not chat_id:
        return {
            "type": "agent.command.result",
            "command": "cost",
            "message": "没有活跃的会话, 无法查询用量。",
            "error": "no_chat_id",
        }

    from app.api.v1.workspace.session_store import get_session_usage, load_session

    usage = get_session_usage(chat_id)
    if not usage or usage.get("total_tokens", 0) == 0:
        return {
            "type": "agent.command.result",
            "command": "cost",
            "message": "当前会话尚无 Token 用量记录。",
            "usage": usage or {},
        }

    # 获取模型 ID
    session = load_session(chat_id)
    effective_model = model_id or (session.get("model_id", "") if session else "")

    cost = _estimate_cost(usage, effective_model)

    # 构建可读消息
    msg_lines = [
        f"📊 会话 Token 用量 (会话: {chat_id})",
        f"  模型: {effective_model or '未知'}",
        f"  输入 Tokens: {_format_tokens(usage.get('prompt_tokens', 0))}",
        f"  输出 Tokens: {_format_tokens(usage.get('completion_tokens', 0))}",
        f"  总计 Tokens: {_format_tokens(usage.get('total_tokens', 0))}",
        f"  API 调用: {usage.get('api_calls', 0)} 次",
        f"  交互轮数: {usage.get('rounds', 0)} 轮",
        f"  成本估算: {_format_cost(cost['total_cost'])} "
        f"(输入 {_format_cost(cost['input_cost'])} @ ${cost['input_rate']}/M + "
        f"输出 {_format_cost(cost['output_cost'])} @ ${cost['output_rate']}/M)",
    ]

    return {
        "type": "agent.command.result",
        "command": "cost",
        "message": "\n".join(msg_lines),
        "usage": usage,
        "cost": cost,
        "model": effective_model,
    }


async def handle_usage(
    websocket: WebSocket,
    workspace_path: str,
    **kwargs,
) -> dict[str, Any]:
    """/usage - 显示工作区全局用量统计。

    汇总工作区下所有会话的 token 用量:
    - 总输入 / 输出 / 总 tokens
    - 总 API 调用次数
    - 会话数量
    - 各会话用量摘要 (最近 10 条)
    """
    from app.api.v1.workspace.session_store import get_workspace_usage_summary

    summary = get_workspace_usage_summary(workspace_path)

    if summary["total_tokens"] == 0:
        return {
            "type": "agent.command.result",
            "command": "usage",
            "message": "工作区尚无 Token 用量记录。",
            "summary": summary,
        }

    # 构建可读消息
    msg_lines = [
        f"📈 工作区全局用量统计 ({workspace_path})",
        f"  会话总数: {summary['session_count']}",
        f"  总输入 Tokens: {_format_tokens(summary['total_prompt_tokens'])}",
        f"  总输出 Tokens: {_format_tokens(summary['total_completion_tokens'])}",
        f"  总计 Tokens: {_format_tokens(summary['total_tokens'])}",
        f"  总 API 调用: {summary['total_api_calls']} 次",
        "",
        "  最近会话:",
    ]

    for i, s in enumerate(summary["sessions"][:10], 1):
        su = s.get("usage", {})
        prompt = s.get("initial_prompt", "(无)")
        if len(prompt) > 50:
            prompt = prompt[:50] + "..."
        msg_lines.append(
            f"  {i}. [{s['id']}] {_format_tokens(su.get('total_tokens', 0))} tokens, "
            f"{su.get('api_calls', 0)} calls — {prompt}"
        )

    return {
        "type": "agent.command.result",
        "command": "usage",
        "message": "\n".join(msg_lines),
        "summary": summary,
    }


async def handle_memory(
    websocket: WebSocket,
    args: str,
    workspace_path: str,
    chat_id: str | None,
    model_id: str = "",
    **kwargs,
) -> dict[str, Any]:
    """/memory - 记忆管理 (show/save/clear).

    子命令:
    - /memory 或 /memory show  — 显示自动学习内容 + 项目记忆文件列表
    - /memory save             — 从当前会话提取学习并保存 (AutoMemory)
    - /memory clear            — 清除自动学习内容
    """
    from app.api.v1.workspace.memory import (
        load_auto_learnings,
        save_auto_learning,
        clear_auto_learnings,
        extract_learnings_from_session,
        load_project_memory,
    )
    from app.api.v1.workspace.session_store import get_history, load_session

    sub = args.strip().lower() if args else "show"

    if sub == "clear":
        cleared = clear_auto_learnings(workspace_path)
        return {
            "type": "agent.command.result",
            "command": "memory",
            "message": "自动学习记忆已清除。" if cleared else "没有自动学习记忆可清除。",
            "cleared": cleared,
        }

    if sub == "save":
        if not chat_id:
            return {
                "type": "agent.command.result",
                "command": "memory",
                "message": "没有活跃的会话, 无法提取学习。",
                "error": "no_chat_id",
            }

        # 获取会话历史
        history = get_history(chat_id)
        if len(history) < 4:
            return {
                "type": "agent.command.result",
                "command": "memory",
                "message": "对话太短 (<4 条消息), 没有足够内容提取学习。",
            }

        # 获取模型 ID
        session = load_session(chat_id)
        effective_model = model_id or (session.get("model_id", "") if session else "")

        # 提取学习
        learning = await extract_learnings_from_session(history, effective_model, workspace_path)
        if not learning:
            return {
                "type": "agent.command.result",
                "command": "memory",
                "message": "本次会话没有值得记忆的新知识。",
            }

        saved = save_auto_learning(workspace_path, learning)
        return {
            "type": "agent.command.result",
            "command": "memory",
            "message": f"自动学习已保存 {'✓' if saved else '✗'}\n\n{learning}",
            "learning": learning,
            "saved": saved,
        }

    # 默认: show
    auto = load_auto_learnings(workspace_path)
    proj_mem = load_project_memory(workspace_path)

    msg_lines = ["🧠 记忆系统状态", ""]

    # 项目记忆文件
    msg_lines.append("## 项目记忆文件")
    if proj_mem.get("files"):
        for f in proj_mem["files"]:
            msg_lines.append(f"  ✓ {f}")
    else:
        msg_lines.append("  (无项目记忆文件)")
    msg_lines.append("")

    # 自动学习
    msg_lines.append("## 自动学习 (AutoMemory)")
    if auto:
        # 只显示摘要 (前 500 字符)
        preview = auto[:500]
        if len(auto) > 500:
            preview += "\n... (更多内容请查看 .ihui/memory/auto-learnings.md)"
        msg_lines.append(preview)
    else:
        msg_lines.append("  (暂无自动学习记忆)")
        msg_lines.append("  使用 /memory save 从当前会话提取学习")

    return {
        "type": "agent.command.result",
        "command": "memory",
        "message": "\n".join(msg_lines),
        "auto_learnings": auto,
        "project_memory_files": proj_mem.get("files", []),
    }


# ---------------------------------------------------------------------------
# 纯命令 handlers (返回 result 后 WebSocket skip agent loop)
# ---------------------------------------------------------------------------

async def handle_help(websocket: WebSocket, **kwargs) -> dict[str, Any]:
    """/help - 返回所有命令列表."""
    return {
        "type": "agent.command.result",
        "command": "help",
        "commands": get_command_list(),
    }


async def handle_clear(websocket: WebSocket, chat_id: str | None, **kwargs) -> dict[str, Any]:
    """/clear - 清除会话上下文.

    注意: 后端仅返回确认事件, 实际的 chat 状态由前端响应事件后清空本地历史.
    下一轮 prompt 时如未传 chat_id, 后端会自动创建新 session.
    """
    return {
        "type": "agent.command.result",
        "command": "clear",
        "message": "会话已清除. 下一条消息将开始新对话.",
        "previous_chat_id": chat_id,
    }


async def handle_init(websocket: WebSocket, workspace_path: str, **kwargs) -> dict[str, Any]:
    """/init - 生成 AGENTS.md 草案 (仅当文件不存在)."""
    workspace = Path(workspace_path).resolve()
    agents_md = workspace / "AGENTS.md"
    if agents_md.exists():
        return {
            "type": "agent.command.result",
            "command": "init",
            "message": f"AGENTS.md 已存在 ({agents_md}), 跳过生成. 如需重新生成请先删除.",
            "path": str(agents_md),
            "skipped": True,
        }

    draft = _scan_workspace_for_agents_md(workspace)
    try:
        agents_md.write_text(draft, encoding="utf-8")
        return {
            "type": "agent.command.result",
            "command": "init",
            "message": f"AGENTS.md 草案已生成 ({len(draft)} 字符, {draft.count(chr(10))} 行)",
            "path": str(agents_md),
            "preview": draft[:600] + ("..." if len(draft) > 600 else ""),
        }
    except Exception as e:
        return {
            "type": "agent.command.result",
            "command": "init",
            "message": f"AGENTS.md 写入失败: {e}",
            "error": str(e),
        }


def _scan_workspace_for_agents_md(workspace: Path) -> str:
    """扫描工作区生成 AGENTS.md 草案 (7 章节模板)."""
    parts: list[str] = []

    # 1. 项目信息
    parts.append(f"# {workspace.name} — 项目 Agent 行为规范\n")
    parts.append("\n> 本文件由 /init 自动生成. 请根据实际情况补充完善.\n")

    # 2. 项目概述
    parts.append("\n## 项目概述\n\n")
    parts.append(f"本项目位于 `{workspace}` 目录下.\n")

    # 3. 技术栈检测
    tech_stack: list[str] = []
    if (workspace / "package.json").exists():
        tech_stack.append("Node.js / npm")
    if (workspace / "pnpm-lock.yaml").exists():
        tech_stack.append("pnpm")
    if (workspace / "pyproject.toml").exists() or (workspace / "requirements.txt").exists():
        tech_stack.append("Python")
    if (workspace / "uv.lock").exists():
        tech_stack.append("uv (Python)")
    if (workspace / "Cargo.toml").exists():
        tech_stack.append("Rust")
    if (workspace / "go.mod").exists():
        tech_stack.append("Go")
    if (workspace / "vue.config.js").exists() or any(workspace.glob("*.vue")) or any(workspace.glob("src/**/*.vue")):
        tech_stack.append("Vue")
    if (workspace / "tsconfig.json").exists():
        tech_stack.append("TypeScript")
    if (workspace / "tailwind.config.js").exists() or (workspace / "tailwind.config.ts").exists():
        tech_stack.append("Tailwind CSS")
    if (workspace / "vite.config.ts").exists() or (workspace / "vite.config.js").exists():
        tech_stack.append("Vite")

    if tech_stack:
        parts.append("\n## 技术栈\n\n")
        for tech in tech_stack:
            parts.append(f"- {tech}\n")
    else:
        parts.append("\n## 技术栈\n\n(未检测到常见技术栈, 请手动补充)\n")

    # 4. 构建命令
    parts.append("\n## 构建与运行\n\n")
    if (workspace / "package.json").exists():
        parts.append("- 安装依赖: `npm install` 或 `pnpm install`\n")
        parts.append("- 开发服务器: `npm run dev`\n")
        parts.append("- 生产构建: `npm run build`\n")
        parts.append("- 单元测试: `npm run test`\n")
        parts.append("- Lint: `npm run lint`\n")
    elif (workspace / "pyproject.toml").exists() or (workspace / "requirements.txt").exists():
        parts.append("- 安装依赖: `pip install -e .` 或 `uv pip install -e .`\n")
        parts.append("- 测试: `pytest`\n")
        parts.append("- Lint: `ruff check .`\n")
    else:
        parts.append("(请根据项目实际命令补充)\n")

    # 5. 代码规范
    parts.append("\n## 代码规范\n\n")
    parts.append("- 严格遵循项目已有代码风格\n")
    parts.append("- 修改前必读本文件 + `.cursorrules`\n")
    parts.append("- 提交前必运行 lint + test\n")
    parts.append("- TypeScript 类型 0 错误\n")

    # 6. 禁止项
    parts.append("\n## 禁止项\n\n")
    parts.append("- ❌ 不得修改其他项目的文件\n")
    parts.append("- ❌ 不得删除 git 未跟踪的关键文件\n")
    parts.append("- ❌ 不得跳过测试\n")
    parts.append("- ❌ 不得使用 `!important` 或堆叠类名\n")
    parts.append("- ❌ 不得执行 `rm -rf /`, `mkfs`, `shutdown` 等高危命令\n")

    # 7. 目录结构
    parts.append("\n## 目录结构\n\n")
    parts.append("```\n")
    parts.append(f"{workspace.name}/\n")
    # 列出顶层目录
    try:
        for entry in sorted(workspace.iterdir()):
            if entry.name.startswith("."):
                continue
            marker = "/" if entry.is_dir() else ""
            parts.append(f"  {entry.name}{marker}\n")
    except Exception:
        pass
    parts.append("```\n")

    # 8. 贡献流程
    parts.append("\n## 贡献流程\n\n")
    parts.append("1. 在 feature 分支开发\n")
    parts.append("2. 提交前运行 lint + test + 构建\n")
    parts.append("3. 提交 PR 时附详细说明 + 截图\n")
    parts.append("4. 等待 CI 通过 + Code Review\n")

    return "".join(parts)


# ---------------------------------------------------------------------------
# 状态修改 handlers (返回 modify 字段后 WebSocket 继续进入 agent loop)
# ---------------------------------------------------------------------------

async def handle_compact(websocket: WebSocket, args: str, **kwargs) -> dict[str, Any]:
    """/compact - 在 agent loop 入口执行上下文压缩."""
    return {
        "type": "agent.command.handled",
        "command": "compact",
        "continue_to_loop": True,
        "modify": {"compact_first": True},
        "message": "将在 agent loop 启动前执行上下文压缩 (≤12 消息)",
    }


async def handle_plan(websocket: WebSocket, args: str, **kwargs) -> dict[str, Any]:
    """/plan - 进入 Plan 模式 (只读 + submit_plan + max_iterations=5).

    两阶段分离: 阶段1 Agent 只读探索 → submit_plan 提交计划 → 等待 /plan-accept 进入执行。
    """
    return {
        "type": "agent.command.handled",
        "command": "plan",
        "continue_to_loop": True,
        "modify": {"permission_mode": "plan", "max_iterations": 5},
        "message": "已进入 Plan 模式 (两阶段分离): 阶段1只读探索 → submit_plan 提交计划 → 等待 /plan-accept 进入执行。",
    }


async def handle_goal(websocket: WebSocket, args: str, **kwargs) -> dict[str, Any]:
    """/goal - 进入 Goal 模式 (max_iterations=20 自动终止)."""
    return {
        "type": "agent.command.handled",
        "command": "goal",
        "continue_to_loop": True,
        "modify": {"max_iterations": 20},
        "message": f"已进入 Goal 模式 (max_iterations=20). 任务: {args or '无任务参数'}",
    }


async def handle_plan_accept(
    websocket: WebSocket,
    args: str,
    chat_id: str | None,
    **kwargs,
) -> dict[str, Any]:
    """/plan-accept - 接受 Agent 提交的计划, 切换到执行模式.

    读取 session.pending_plan, 构造新 prompt 注入 plan 文本, 切换到 default 权限模式继续 agent loop.
    """
    from app.api.v1.workspace.session_store import get_plan, clear_plan

    if not chat_id:
        return {
            "type": "agent.command.result",
            "command": "plan-accept",
            "message": "无法接受计划: 没有活跃的 session (chat_id 为空)",
            "error": "no_chat_id",
        }

    plan = get_plan(chat_id)
    if not plan:
        return {
            "type": "agent.command.result",
            "command": "plan-accept",
            "message": "没有待确认的计划。请先在 Plan 模式下让 Agent 提交计划 (submit_plan)。",
            "error": "no_pending_plan",
        }

    plan_text = _format_plan_for_execution(plan)
    extra = args.strip()
    if extra:
        execution_prompt = f"{plan_text}\n\n用户额外指令: {extra}"
    else:
        execution_prompt = plan_text

    clear_plan(chat_id)

    return {
        "type": "agent.command.handled",
        "command": "plan-accept",
        "continue_to_loop": True,
        "modify": {
            "permission_mode": "default",
            "max_iterations": 30,
            "plan_accepted": True,
        },
        "plan_accepted": plan,
        "execution_prompt": execution_prompt,
        "message": f"已接受计划 ({len(plan.get('steps', []))} 步), 切换到执行模式 (permission_mode=default)",
    }


async def handle_plan_reject(
    websocket: WebSocket,
    args: str,
    chat_id: str | None,
    **kwargs,
) -> dict[str, Any]:
    """/plan-reject - 拒绝 Agent 提交的计划, 清空 pending_plan."""
    from app.api.v1.workspace.session_store import get_plan, clear_plan

    if not chat_id:
        return {
            "type": "agent.command.result",
            "command": "plan-reject",
            "message": "无法拒绝计划: 没有活跃的 session (chat_id 为空)",
            "error": "no_chat_id",
        }

    plan = get_plan(chat_id)
    if not plan:
        return {
            "type": "agent.command.result",
            "command": "plan-reject",
            "message": "没有待拒绝的计划。",
            "error": "no_pending_plan",
        }

    clear_plan(chat_id)
    return {
        "type": "agent.command.result",
        "command": "plan-reject",
        "message": f"已拒绝计划 ({plan.get('title', '?')}), 保留当前 session。",
        "rejected_plan_title": plan.get("title", ""),
    }


def _format_plan_for_execution(plan: dict[str, Any]) -> str:
    """将 plan 格式化为可执行的 prompt。"""
    lines: list[str] = []
    lines.append(f"## 待执行计划: {plan.get('title', '')}")
    lines.append("")
    summary = plan.get("summary", "")
    if summary:
        lines.append(f"### 摘要\n{summary}\n")
    steps = plan.get("steps", [])
    if steps:
        lines.append("### 执行步骤")
        for i, step in enumerate(steps, 1):
            lines.append(f"{i}. **{step.get('title', '')}**")
            desc = step.get("description", "")
            if desc:
                lines.append(f"   {desc}")
            files = step.get("files", [])
            if files:
                lines.append(f"   - 涉及文件: {', '.join(files)}")
            tool_hint = step.get("tool_hint", "")
            if tool_hint:
                lines.append(f"   - 建议工具: {tool_hint}")
    risks = plan.get("risks", [])
    if risks:
        lines.append("\n### 风险点")
        for r in risks:
            lines.append(f"- {r}")
    lines.append("\n请按以上计划逐步执行, 每步完成后简短报告进展, 完成后给出总结。")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Background Agents (多会话并行 — 对标 Claude Code Background Agents)
# ---------------------------------------------------------------------------

async def handle_agents(
    websocket: WebSocket,
    args: str,
    workspace_path: str,
    **kwargs,
) -> dict[str, Any]:
    """/agents - 后台 Agent 管理 (列出 / 取消).

    子命令:
    - /agents                — 列出所有后台 agent 状态
    - /agents cancel <id>    — 取消指定 agent
    """
    from app.api.v1.workspace.background_agents import get_background_agent_manager

    manager = get_background_agent_manager()
    parts = args.strip().split(maxsplit=1) if args.strip() else []

    # /agents cancel <agent_id>
    if parts and parts[0].lower() == "cancel":
        if len(parts) < 2 or not parts[1].strip():
            return {
                "type": "agent.command.result",
                "command": "agents",
                "message": "用法: /agents cancel <agent_id>",
                "error": "missing_agent_id",
            }
        target_id = parts[1].strip()
        ok = manager.cancel_background_agent(target_id)
        if ok:
            return {
                "type": "agent.command.result",
                "command": "agents",
                "message": f"后台 agent {target_id} 已取消。",
                "cancelled": target_id,
            }
        return {
            "type": "agent.command.result",
            "command": "agents",
            "message": f"无法取消 agent {target_id}: 不存在或已结束。",
            "error": "cancel_failed",
        }

    # /agents — 列出所有后台 agent
    agents = manager.list_background_agents(workspace_path or None)

    if not agents:
        return {
            "type": "agent.command.result",
            "command": "agents",
            "message": "当前工作区没有后台 agent。",
            "agents": [],
        }

    # 统计
    running = [a for a in agents if a.get("status") == "running"]
    completed = [a for a in agents if a.get("status") == "completed"]
    failed = [a for a in agents if a.get("status") == "failed"]
    cancelled = [a for a in agents if a.get("status") == "cancelled"]

    msg_lines = [
        f"📋 后台 Agent 列表 (共 {len(agents)} 个)",
        f"  运行中: {len(running)}  完成: {len(completed)}  失败: {len(failed)}  已取消: {len(cancelled)}",
        "",
    ]

    for a in agents[:20]:  # 最多显示 20 条
        aid = a.get("agent_id", "?")
        status = a.get("status", "?")
        prompt = a.get("prompt", "")
        if len(prompt) > 60:
            prompt = prompt[:60] + "..."
        progress = a.get("progress", {})
        tool_calls = progress.get("tool_calls", 0)
        preview = progress.get("text_preview", "")

        status_icon = {
            "running": "▶",
            "completed": "✓",
            "failed": "✗",
            "cancelled": "⊘",
        }.get(status, "?")

        line = f"  {status_icon} [{aid}] {status}"
        if tool_calls:
            line += f" (工具调用: {tool_calls})"
        line += f"\n      任务: {prompt}"
        if preview and status == "running":
            prev = preview.replace("\n", " ")[:80]
            line += f"\n      进度: {prev}"
        msg_lines.append(line)

    if len(agents) > 20:
        msg_lines.append(f"\n  ... 还有 {len(agents) - 20} 个未显示")

    msg_lines.append("\n  提示: /agents cancel <agent_id> 取消指定 agent")

    return {
        "type": "agent.command.result",
        "command": "agents",
        "message": "\n".join(msg_lines),
        "agents": agents,
        "stats": {
            "total": len(agents),
            "running": len(running),
            "completed": len(completed),
            "failed": len(failed),
            "cancelled": len(cancelled),
        },
    }


# ---------------------------------------------------------------------------
# GitHub PR 管理 (/pr — 对标 Codex GitHub 集成)
# ---------------------------------------------------------------------------

async def handle_pr(
    websocket: WebSocket,
    args: str,
    workspace_path: str,
    **kwargs,
) -> dict[str, Any]:
    """/pr - GitHub PR 管理。

    子命令:
    - /pr                 — 列出当前仓库的 open PR
    - /pr <编号>          — 查看 PR 详情
    - /pr create <标题>   — 创建 PR (正文由 Agent 从后续对话/变更生成)
    """
    from app.api.v1.workspace.github_integration import (
        GitHubClient,
        format_pr_brief,
        format_pr_detail,
        token_missing_message,
    )

    raw = (args or "").strip()
    client = GitHubClient(workspace_path)

    # /pr create <title> — 进入 agent loop, 让 Agent 生成正文并调用 github_create_pr
    if raw.lower().startswith("create"):
        title = raw[len("create"):].strip()
        if not title:
            return {
                "type": "agent.command.result",
                "command": "pr",
                "message": "用法: /pr create <标题>",
                "error": "missing_title",
            }

        # 探测当前分支与默认分支, 注入到执行 prompt 中
        head_branch = client.current_branch() or "(当前分支)"
        base_branch = client.default_branch() or "main"

        execution_prompt = (
            f"请创建一个 GitHub Pull Request, 标题为: {title}\n"
            f"源分支(head): {head_branch}\n"
            f"目标分支(base): {base_branch}\n\n"
            "步骤:\n"
            "1. 使用 git_diff / git_log 工具查看当前分支相对 base 分支的变更\n"
            "2. 基于变更内容撰写清晰的 PR 正文 (Markdown): 含变更摘要 / 动机 / 测试方式\n"
            "3. 调用 github_create_pr 工具创建 PR (head_branch / base_branch 使用上面探测的值)\n"
            "4. 报告创建结果 (PR 编号与 URL)"
        )
        return {
            "type": "agent.command.handled",
            "command": "pr",
            "continue_to_loop": True,
            "execution_prompt": execution_prompt,
            "message": f"将在 Agent 循环中为 '{title}' 生成 PR 正文并创建 (head={head_branch} → base={base_branch})",
        }

    # /pr <number> — 查看 PR 详情 (纯命令)
    if raw.isdigit():
        number = int(raw)
        if not client.has_token:
            return {
                "type": "agent.command.result",
                "command": "pr",
                "message": token_missing_message(),
                "error": "no_token",
            }
        resp = await client.get_pr(number)
        if resp["ok"]:
            data = resp["data"]
            return {
                "type": "agent.command.result",
                "command": "pr",
                "message": format_pr_detail(data),
                "pr": data,
            }
        return {
            "type": "agent.command.result",
            "command": "pr",
            "message": f"获取 PR #{number} 失败 (HTTP {resp['status_code']}): {resp['data']}",
            "error": "api_error",
        }

    # /pr — 列出 open PR (纯命令)
    if not client.has_token:
        return {
            "type": "agent.command.result",
            "command": "pr",
            "message": token_missing_message(),
            "error": "no_token",
        }
    if not client.owner_repo:
        return {
            "type": "agent.command.result",
            "command": "pr",
            "message": "无法解析 GitHub 仓库 (请确认 git remote origin 指向 GitHub 仓库)。",
            "error": "no_remote",
        }
    resp = await client.list_prs(state="open")
    if resp["ok"]:
        prs = resp["data"]
        if not isinstance(prs, list) or not prs:
            return {
                "type": "agent.command.result",
                "command": "pr",
                "message": "当前没有 open 状态的 PR。",
                "prs": [],
            }
        owner, repo = client.owner_repo
        lines = [f"## Open PR — {owner}/{repo} (共 {len(prs)} 个)"]
        for pr in prs:
            lines.append(format_pr_brief(pr))
        lines.append("\n提示: /pr <编号> 查看详情 | /pr create <标题> 创建 PR")
        return {
            "type": "agent.command.result",
            "command": "pr",
            "message": "\n".join(lines),
            "prs": prs,
        }
    return {
        "type": "agent.command.result",
        "command": "pr",
        "message": f"列出 PR 失败 (HTTP {resp['status_code']}): {resp['data']}",
        "error": "api_error",
    }


# ---------------------------------------------------------------------------
# Routines — 定时任务管理 (/routine — 对标 Claude Code Routines)
# ---------------------------------------------------------------------------

def _format_ts(ts: float | None) -> str:
    """格式化 Unix timestamp 为可读时间字符串。"""
    if ts is None:
        return "—"
    from datetime import datetime
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")


def _resolve_routine_id(manager: Any, id_or_prefix: str) -> str:
    """根据完整 ID 或前缀解析出完整 routine_id。

    支持用 ID 前 8 位简写引用 (如 a1b2c3d4)。
    """
    # 完整匹配
    routines = manager.list_routines()
    for r in routines:
        if r.id == id_or_prefix:
            return r.id
    # 前缀匹配
    matches = [r.id for r in routines if r.id.startswith(id_or_prefix)]
    if len(matches) == 1:
        return matches[0]
    return id_or_prefix


async def handle_routine(
    websocket: WebSocket,
    args: str,
    workspace_path: str,
    model_id: str = "",
    **kwargs,
) -> dict[str, Any]:
    """/routine - 定时任务管理 (add/remove/enable/disable/trigger/list)。

    子命令:
    - /routine                              — 列出所有定时任务
    - /routine add <name> <cron> <prompt>   — 添加任务
        cron 可用引号包裹为单个参数, 也可直接写 5 个空格分隔的字段
    - /routine remove <id>                  — 删除任务
    - /routine enable <id>                  — 启用任务
    - /routine disable <id>                 — 禁用任务
    - /routine trigger <id>                 — 手动触发任务
    """
    import shlex

    from app.api.v1.workspace.routines import get_routine_manager, parse_cron

    manager = get_routine_manager()
    raw = (args or "").strip()

    # /routine (无参数) — 列出所有定时任务
    if not raw:
        routines = manager.list_routines(workspace_path or None)
        if not routines:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": (
                    "当前工作区没有定时任务。\n\n"
                    "用法: /routine add <name> <cron> <prompt>\n"
                    "cron 示例: \"*/5 * * * *\" (每5分钟) / \"0 9 * * 1-5\" (工作日9点)"
                ),
                "routines": [],
            }

        msg_lines = [f"⏰ 定时任务列表 (共 {len(routines)} 个)", ""]
        for r in routines:
            status = "✓" if r.enabled else "✗"
            next_str = _format_ts(r.next_run) if r.enabled else "(已禁用)"
            last_str = _format_ts(r.last_run) if r.last_run else "从未"
            prompt_preview = r.prompt[:50] + "..." if len(r.prompt) > 50 else r.prompt
            msg_lines.append(
                f"  {status} [{r.id[:8]}] {r.name}\n"
                f"      cron: {r.cron_expression}\n"
                f"      下次: {next_str}  上次: {last_str}\n"
                f"      任务: {prompt_preview}"
            )
        msg_lines.append("\n操作: /routine add|remove|enable|disable|trigger <id>")
        return {
            "type": "agent.command.result",
            "command": "routine",
            "message": "\n".join(msg_lines),
            "routines": [r.to_dict() for r in routines],
        }

    # 解析子命令 (支持引号)
    try:
        parts = shlex.split(raw)
    except ValueError:
        parts = raw.split()

    sub = parts[0].lower() if parts else ""

    # /routine add <name> <cron> <prompt>
    if sub == "add":
        if len(parts) < 4:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": (
                    "用法: /routine add <name> <cron> <prompt>\n"
                    "cron 示例: \"*/5 * * * *\" (每5分钟) / \"0 9 * * 1-5\" (工作日9点)\n"
                    "prompt 可用引号包裹多行内容"
                ),
                "error": "missing_args",
            }
        name = parts[1]
        # cron 可以是引号包裹的单个参数, 也可以是 5 个独立字段
        if len(parts[2].split()) == 5:
            cron_expr = parts[2]
            prompt_parts = parts[3:]
        else:
            # 取接下来 5 个字段作为 cron
            if len(parts) < 8:
                return {
                    "type": "agent.command.result",
                    "command": "routine",
                    "message": (
                        "cron 表达式需要 5 个字段 (分 时 日 月 周)。\n"
                        "建议用引号包裹: /routine add <name> \"*/5 * * * *\" <prompt>"
                    ),
                    "error": "invalid_cron",
                }
            cron_expr = " ".join(parts[2:7])
            prompt_parts = parts[7:]
        prompt = " ".join(prompt_parts)
        if not prompt:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": "prompt 不能为空。",
                "error": "missing_prompt",
            }

        # 校验 cron
        try:
            parse_cron(cron_expr)
        except ValueError as e:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": f"cron 表达式非法: {e}",
                "error": "invalid_cron",
            }

        effective_model = model_id or "default"
        cfg = manager.add_routine(
            name=name,
            prompt=prompt,
            cron_expression=cron_expr,
            workspace_path=workspace_path,
            model_id=effective_model,
        )
        next_str = _format_ts(cfg.next_run)
        return {
            "type": "agent.command.result",
            "command": "routine",
            "message": (
                f"✓ 定时任务已创建\n"
                f"  ID: {cfg.id}\n"
                f"  名称: {cfg.name}\n"
                f"  cron: {cfg.cron_expression}\n"
                f"  下次执行: {next_str}\n"
                f"  任务: {cfg.prompt[:80]}"
            ),
            "routine": cfg.to_dict(),
        }

    # /routine remove <id>
    if sub == "remove":
        if len(parts) < 2:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": "用法: /routine remove <id>",
                "error": "missing_id",
            }
        target_id = _resolve_routine_id(manager, parts[1])
        ok = manager.remove_routine(target_id)
        if ok:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": f"✓ 定时任务 {target_id[:8]} 已删除。",
                "removed": target_id,
            }
        return {
            "type": "agent.command.result",
            "command": "routine",
            "message": f"定时任务 {parts[1]} 不存在。",
            "error": "not_found",
        }

    # /routine enable <id>
    if sub == "enable":
        if len(parts) < 2:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": "用法: /routine enable <id>",
                "error": "missing_id",
            }
        target_id = _resolve_routine_id(manager, parts[1])
        ok = manager.enable_routine(target_id)
        if ok:
            cfg = manager.get_routine(target_id)
            next_str = _format_ts(cfg.next_run) if cfg else ""
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": f"✓ 定时任务 {target_id[:8]} 已启用。下次执行: {next_str}",
                "enabled": target_id,
            }
        return {
            "type": "agent.command.result",
            "command": "routine",
            "message": f"定时任务 {parts[1]} 不存在。",
            "error": "not_found",
        }

    # /routine disable <id>
    if sub == "disable":
        if len(parts) < 2:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": "用法: /routine disable <id>",
                "error": "missing_id",
            }
        target_id = _resolve_routine_id(manager, parts[1])
        ok = manager.disable_routine(target_id)
        if ok:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": f"✓ 定时任务 {target_id[:8]} 已禁用。",
                "disabled": target_id,
            }
        return {
            "type": "agent.command.result",
            "command": "routine",
            "message": f"定时任务 {parts[1]} 不存在。",
            "error": "not_found",
        }

    # /routine trigger <id>
    if sub == "trigger":
        if len(parts) < 2:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": "用法: /routine trigger <id>",
                "error": "missing_id",
            }
        target_id = _resolve_routine_id(manager, parts[1])
        result = manager.trigger_routine(target_id)
        if result is None:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": f"定时任务 {parts[1]} 不存在。",
                "error": "not_found",
            }
        if "error" in result:
            return {
                "type": "agent.command.result",
                "command": "routine",
                "message": f"触发失败: {result['error']}",
                "error": result["error"],
            }
        return {
            "type": "agent.command.result",
            "command": "routine",
            "message": (
                f"✓ 定时任务 {target_id[:8]} 已手动触发。\n"
                f"  后台 agent_id: {result.get('agent_id', '?')}\n"
                f"  可用 /agents 查看执行进度。"
            ),
            "triggered": result,
        }

    # 未知子命令
    return {
        "type": "agent.command.result",
        "command": "routine",
        "message": (
            f"未知子命令: {sub}\n"
            f"可用: add / remove / enable / disable / trigger\n"
            f"或直接 /routine 查看所有定时任务"
        ),
        "error": "unknown_subcommand",
    }


# 命令分发映射
COMMAND_HANDLERS = {
    "help": handle_help,
    "clear": handle_clear,
    "compact": handle_compact,
    "plan": handle_plan,
    "plan-accept": handle_plan_accept,
    "plan-reject": handle_plan_reject,
    "init": handle_init,
    "goal": handle_goal,
    "cost": handle_cost,
    "usage": handle_usage,
    "memory": handle_memory,
    "agents": handle_agents,
    "pr": handle_pr,
    "routine": handle_routine,
}

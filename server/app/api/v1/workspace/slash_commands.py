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
}

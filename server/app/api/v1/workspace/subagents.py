"""
Subagents 子代理系统 — 对标 Claude Code 的 Subagents / Task 工具。

子代理是预配置的专用 AI 人格,拥有:
- 独立上下文窗口 (与主 Agent 隔离)
- 专用系统 prompt
- 受控工具集 (仅允许指定工具)
- 可选的模型配置 (可不同于主 Agent)

配置来源: .claude/agents/ (项目级) + ~/.ihui/agents/ (用户级)
格式: Markdown 文件, YAML frontmatter + 正文为系统 prompt

示例 (.claude/agents/researcher.md):
---
name: researcher
description: 代码库研究员, 使用 PROACTIVELY 进行代码调研
tools: read_file, list_dir, glob, grep, git_status, git_diff, git_log
model: inherit
---

你是一个代码库研究员。你的任务是深入理解代码架构,
不修改任何文件, 只做调研和分析。
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from loguru import logger


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

@dataclass
class SubagentConfig:
    """子代理配置。"""
    name: str
    description: str
    system_prompt: str = ""
    tools: list[str] = field(default_factory=list)  # 空=继承全部
    model: str = "inherit"  # inherit / sonnet / opus / haiku / 具体模型 code
    file_path: str = ""


# ---------------------------------------------------------------------------
# 发现与加载
# ---------------------------------------------------------------------------

def discover_subagents(workspace_path: str) -> list[SubagentConfig]:
    """发现所有子代理配置。

    搜索顺序 (优先级高→低):
    1. 项目级: .claude/agents/*.md
    2. 用户级: ~/.ihui/agents/*.md
    """
    agents: list[SubagentConfig] = []
    seen_names: set[str] = set()

    search_dirs = [
        Path(workspace_path) / ".claude" / "agents",
        Path.home() / ".ihui" / "agents",
    ]

    for search_dir in search_dirs:
        if not search_dir.exists():
            continue
        for md_file in sorted(search_dir.glob("*.md")):
            try:
                agent = _parse_subagent_file(md_file)
                if agent and agent.name not in seen_names:
                    agents.append(agent)
                    seen_names.add(agent.name)
            except Exception as e:
                logger.warning(f"解析子代理文件失败 {md_file}: {e}")

    return agents


def _parse_subagent_file(file_path: Path) -> SubagentConfig | None:
    """解析子代理 Markdown 文件 (YAML frontmatter + 正文)。"""
    content = file_path.read_text(encoding="utf-8", errors="replace")

    # 解析 frontmatter
    if not content.startswith("---"):
        # 无 frontmatter, 用文件名作为 name
        name = file_path.stem
        return SubagentConfig(
            name=name,
            description="",
            system_prompt=content.strip(),
            file_path=str(file_path),
        )

    end_idx = content.find("---", 3)
    if end_idx == -1:
        return None

    frontmatter = content[3:end_idx].strip()
    body = content[end_idx + 3 :].strip()

    # 简单 YAML 解析 (避免引入 PyYAML 依赖)
    meta: dict[str, Any] = {}
    for line in frontmatter.split("\n"):
        line = line.strip()
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip()
        # tools 可能是逗号分隔列表
        if key == "tools" and val:
            meta[key] = [t.strip() for t in val.split(",") if t.strip()]
        else:
            meta[key] = val

    name = meta.get("name", file_path.stem)
    description = meta.get("description", "")
    tools = meta.get("tools", [])
    if isinstance(tools, str):
        tools = [t.strip() for t in tools.split(",") if t.strip()]
    model = meta.get("model", "inherit")

    return SubagentConfig(
        name=name,
        description=description,
        system_prompt=body,
        tools=tools,
        model=model,
        file_path=str(file_path),
    )


# ---------------------------------------------------------------------------
# 子代理执行 (作为 Task 工具)
# ---------------------------------------------------------------------------

async def run_subagent(
    subagent: SubagentConfig,
    task_prompt: str,
    workspace_path: str,
    main_model_id: str,
    *,
    max_iterations: int = 15,
    user_uuid: str = "anonymous",
) -> dict[str, Any]:
    """运行子代理 (独立上下文)。

    子代理有自己的消息列表, 不共享主 Agent 的上下文。
    完成后返回摘要给主 Agent。

    Returns:
        {"success": bool, "output": str, "iterations": int}
    """
    from app.api.v1.workspace.agent_loop import run_agent_loop
    from app.api.v1.workspace.llm_gateway import ChatMessage

    # 确定模型
    model_id = main_model_id if subagent.model == "inherit" else subagent.model

    # 子代理的系统 prompt
    sys_prompt = subagent.system_prompt or f"你是子代理 {subagent.name}。{subagent.description}"

    sys_prompt += f"""

## 子代理身份

你是 "{subagent.name}" 子代理。你的职责: {subagent.description}

规则:
1. 你在独立上下文中运行, 不共享主 Agent 的对话历史
2. 你只能使用被授权的工具
3. 完成任务后给出简洁的总结
4. 不要修改与你任务无关的文件
"""

    # SubagentStart Hook (Stage B: 补全 Hook 扩展点)
    # 在子代理开始前触发, 可用于记录审计日志/资源限制等
    try:
        from app.api.v1.workspace.skills import run_hooks
        await run_hooks(workspace_path, "SubagentStart", {
            "subagent_name": subagent.name,
            "task_prompt": task_prompt,
            "workspace_path": workspace_path,
            "model_id": model_id,
        })
    except Exception as e:
        logger.warning(f"SubagentStart Hook 触发失败 (非阻断): {e}")

    # 运行子代理循环 (独立上下文)
    accumulated_output = ""
    iterations = 0
    success = True

    try:
        async for event in run_agent_loop(
            prompt=task_prompt,
            model_id=model_id,
            workspace_path=workspace_path,
            user_uuid=user_uuid,
            system_prompt=sys_prompt,
            max_iterations=max_iterations,
            allowed_tools=subagent.tools if subagent.tools else None,
            permission_mode="bypassPermissions",  # 子代理不需要再次确认权限
        ):
            etype = event.get("type")
            if etype == "agent.text.delta":
                accumulated_output += event.get("content", "")
            elif etype == "agent.done":
                iterations = event.get("iterations", 0)
                if event.get("finish_reason") == "max_iterations":
                    accumulated_output += "\n[子代理达到最大迭代次数]"
            elif etype == "agent.error":
                success = False
                accumulated_output += f"\n[错误] {event.get('message', '')}"
    except Exception as e:
        logger.error(f"子代理 {subagent.name} 执行失败: {e}")
        # SubagentStop Hook (即使失败也触发, 便于审计)
        try:
            from app.api.v1.workspace.skills import run_hooks
            await run_hooks(workspace_path, "SubagentStop", {
                "subagent_name": subagent.name,
                "workspace_path": workspace_path,
                "success": False,
                "iterations": 0,
                "error": str(e),
            })
        except Exception:
            pass
        return {"success": False, "output": f"子代理执行失败: {e}", "iterations": 0}

    # SubagentStop Hook (Stage B: 补全 Hook 扩展点)
    # 在子代理完成后触发, 可用于清理资源/通知/审计
    try:
        from app.api.v1.workspace.skills import run_hooks
        await run_hooks(workspace_path, "SubagentStop", {
            "subagent_name": subagent.name,
            "workspace_path": workspace_path,
            "success": success,
            "iterations": iterations,
            "output_length": len(accumulated_output),
        })
    except Exception as e:
        logger.warning(f"SubagentStop Hook 触发失败 (非阻断): {e}")

    return {
        "success": success,
        "output": accumulated_output or "(子代理无输出)",
        "iterations": iterations,
    }


# ---------------------------------------------------------------------------
# Task 工具 (供 agent_loop 调用)
# ---------------------------------------------------------------------------

async def tool_task(args: dict[str, Any], workspace: str) -> Any:
    """Task 工具 — 调用子代理执行委派任务。

    对标 Claude Code 的 Task 工具:
    - 根据描述自动选择合适的子代理
    - 或直接指定子代理名称
    - 返回子代理的执行结果摘要
    """
    subagent_name = args.get("subagent", "")
    task_prompt = args.get("prompt", "")
    model_id = args.get("model_id", "default")

    if not task_prompt:
        from app.api.v1.workspace.tools import ToolCallResult
        return ToolCallResult(
            tool="task",
            input=args,
            output="",
            error="缺少 prompt 参数",
            success=False,
        )

    # 发现可用子代理
    agents = discover_subagents(workspace)

    # 选择子代理
    selected: SubagentConfig | None = None
    if subagent_name:
        for a in agents:
            if a.name == subagent_name:
                selected = a
                break
        if not selected:
            from app.api.v1.workspace.tools import ToolCallResult
            return ToolCallResult(
                tool="task",
                input=args,
                output=f"子代理 {subagent_name} 未找到。可用: {', '.join(a.name for a in agents) or '无'}",
                error="subagent not found",
                success=False,
            )
    else:
        # 自动选择: 简单关键词匹配 description
        task_lower = task_prompt.lower()
        best_score = 0
        for a in agents:
            desc_lower = a.description.lower()
            score = sum(1 for word in desc_lower.split() if word in task_lower)
            if score > best_score:
                best_score = score
                selected = a
        if not selected:
            from app.api.v1.workspace.tools import ToolCallResult
            return ToolCallResult(
                tool="task",
                input=args,
                output="无可用子代理。请在 .claude/agents/ 目录创建子代理配置。",
                error="no subagents available",
                success=False,
            )

    # 执行子代理
    from app.api.v1.workspace.tools import ToolCallResult
    result = await run_subagent(
        subagent=selected,
        task_prompt=task_prompt,
        workspace_path=workspace,
        main_model_id=model_id,
    )

    output = f"[子代理: {selected.name}]\n{result['output']}\n[迭代: {result['iterations']}]"
    return ToolCallResult(
        tool="task",
        input=args,
        output=output,
        success=result["success"],
    )


# Task 工具的 JSON Schema 定义
TASK_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "task",
        "description": "调用子代理执行委派任务。子代理在独立上下文中运行, 适合代码调研、批量重构等需要隔离的操作。可用子代理: 通过 discover_subagents 查询。",
        "parameters": {
            "type": "object",
            "properties": {
                "subagent": {
                    "type": "string",
                    "description": "子代理名称 (可选, 不指定则自动选择)",
                },
                "prompt": {
                    "type": "string",
                    "description": "委派给子代理的任务描述",
                },
                "model_id": {
                    "type": "string",
                    "description": "模型 ID (可选, 默认继承主 Agent)",
                },
            },
            "required": ["prompt"],
        },
    },
}

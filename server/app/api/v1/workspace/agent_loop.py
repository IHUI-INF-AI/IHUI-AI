"""
Agent Runtime — 核心工具循环引擎。

对标:
- Codex Agent Loop (OpenAI 官方架构)
- Claude Code Agent Loop (Anthropic)

流程:
1. 构建 prompt (system + developer + user + environment_context + AGENTS.md)
2. 调用 LLM (流式)
3. 如果 LLM 请求工具调用 → 执行工具 → 结果追加到 messages → 回到 2
4. 如果 LLM 输出最终回复 → 结束
5. 上下文窗口管理: 超限时自动压缩

事件通过 AsyncGenerator 流式推送, 供 WebSocket 或 HTTP SSE 消费。
"""

from __future__ import annotations

import asyncio
import json
import sys
import uuid
from typing import Any, AsyncGenerator

from app.api.v1.workspace.llm_gateway import (
    ChatMessage,
    _get_model_config,
    chat_with_tools,
    get_tool_definitions,
)
from app.api.v1.workspace.tools import execute_tool
from app.api.v1.workspace.memory import load_project_memory, build_system_prompt
from app.api.v1.workspace.skills import run_hooks, discover_skills
from app.api.v1.workspace.permissions import PermissionChecker, PermissionMode


# ---------------------------------------------------------------------------
# Plan Mode: submit_plan 工具定义
# ---------------------------------------------------------------------------
# 两阶段分离: 阶段1 探索(plan 模式) + 阶段2 确认(/plan-accept)
# submit_plan 是 plan 阶段唯一的"出口工具", Agent 探索完代码后调用它提交计划
# ---------------------------------------------------------------------------

SUBMIT_PLAN_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "submit_plan",
        "description": (
            "在 Plan 模式下提交一个完整的执行计划。\n\n"
            "调用此工具后, agent loop 会立即结束并向用户推送计划等待确认。"
            "用户接受后 (/plan-accept), 才会进入执行阶段。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "计划标题 (一句话概括, 20-50 字)",
                },
                "summary": {
                    "type": "string",
                    "description": "计划摘要 (3-8 句话说明背景 + 目标 + 关键决策)",
                },
                "steps": {
                    "type": "array",
                    "description": "执行步骤列表 (3-15 步为宜)",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "description": "步骤 ID, 如 'step-1'"},
                            "title": {"type": "string", "description": "步骤标题"},
                            "description": {"type": "string", "description": "步骤详细说明"},
                            "files": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "涉及的文件路径列表",
                            },
                            "tool_hint": {
                                "type": "string",
                                "description": "建议使用的工具 (write_file/edit_file/run_command 等)",
                            },
                        },
                        "required": ["id", "title", "description"],
                    },
                },
                "risks": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "潜在风险点列表 (可空)",
                },
            },
            "required": ["title", "summary", "steps"],
        },
    },
}


# ---------------------------------------------------------------------------
# Agent 循环
# ---------------------------------------------------------------------------

async def run_agent_loop(
    prompt: str,
    model_id: str,
    workspace_path: str,
    *,
    user_uuid: str = "anonymous",
    chat_id: str | None = None,
    system_prompt: str | None = None,
    max_iterations: int = 25,
    allowed_tools: list[str] | None = None,
    history: list[ChatMessage] | None = None,
    permission_mode: str = PermissionMode.DEFAULT,
) -> AsyncGenerator[dict[str, Any], None]:
    """运行 Agent 工具循环。

    流式 yield 事件:
        {"type": "agent.context", "files": [...], "memory": "..."} — 加载的上下文
        {"type": "agent.thinking", "content": str} — 思考过程
        {"type": "agent.text.delta", "content": str} — 回复文本片段
        {"type": "agent.tool.call", "id": str, "name": str, "input": dict} — 工具调用
        {"type": "agent.tool.result", "id": str, "output": str, "success": bool} — 工具结果
        {"type": "agent.plan.update", "plan": str} — 计划更新
        {"type": "agent.error", "message": str} — 错误
        {"type": "agent.done", "iterations": int} — 完成

    Args:
        prompt: 用户输入
        model_id: 模型 code
        workspace_path: 工作区绝对路径
        user_uuid: 用户 UUID
        chat_id: 会话 ID (多轮)
        system_prompt: 自定义系统提示词 (覆盖默认)
        max_iterations: 最大工具循环次数
        allowed_tools: 允许的工具列表
        history: 历史消息 (多轮对话)
        permission_mode: 权限模式 (default/acceptEdits/plan/bypassPermissions)
    """
    # 0. SessionStart Hook
    await run_hooks(workspace_path, "SessionStart", {
        "session_id": chat_id or str(uuid.uuid4()),
        "workspace_path": workspace_path,
    })

    # 1. UserPromptSubmit Hook (可阻断/注入上下文)
    prompt_hook = await run_hooks(workspace_path, "UserPromptSubmit", {
        "prompt": prompt,
        "workspace_path": workspace_path,
    })
    if not prompt_hook["allow"]:
        yield {"type": "agent.error", "message": f"用户输入被 Hook 阻断: {prompt_hook['feedback']}"}
        return

    # 2. 加载模型配置
    cfg = _get_model_config(model_id)
    if not cfg:
        yield {"type": "agent.error", "message": f"模型配置未找到: {model_id}"}
        return

    # 3. 构建工具定义 + MCP 工具注入
    tools = get_tool_definitions(allowed_tools)

    # 3.0 Plan 模式: 追加 submit_plan 工具 (Agent 探索完毕后的"出口")
    is_plan_mode = permission_mode == PermissionMode.PLAN
    if is_plan_mode:
        tools.append(SUBMIT_PLAN_TOOL_DEFINITION)
        logger.debug(f"Plan 模式已注册 submit_plan 工具 (workspace={workspace_path})")

    # 尝试加载 MCP 工具并追加到工具列表
    mcp_tool_names: list[str] = []
    try:
        from app.api.v1.workspace.mcp_bridge import load_mcp_config, MCPManager
        mcp_servers = load_mcp_config(workspace_path)
        if mcp_servers:
            mgr = MCPManager()
            for server_config in mcp_servers:
                try:
                    await mgr.add_server(server_config)
                    mcp_tools = await mgr.list_tools(server_config.name)
                    for mt in mcp_tools:
                        tools.append({
                            "type": "function",
                            "function": {
                                "name": f"mcp__{server_config.name}__{mt.name}",
                                "description": f"[MCP:{server_config.name}] {mt.description}",
                                "parameters": mt.input_schema or {"type": "object", "properties": {}},
                            },
                        })
                        mcp_tool_names.append(f"mcp__{server_config.name}__{mt.name}")
                except Exception:
                    pass  # MCP 服务器连接失败不阻断 Agent
    except Exception:
        pass  # MCP 模块加载失败不阻断

    # 3b. 加载 Task 工具 (子代理) 并追加到工具列表
    try:
        from app.api.v1.workspace.subagents import TASK_TOOL_DEFINITION, tool_task, discover_subagents
        agents = discover_subagents(workspace_path)
        if agents:
            tools.append(TASK_TOOL_DEFINITION)
            # 注册到 dispatch
            from app.api.v1.workspace.tools import TOOL_DISPATCH
            TOOL_DISPATCH["task"] = tool_task
    except Exception:
        pass  # Subagents 模块加载失败不阻断

    # 3c. 加载 Codebase 索引工具
    try:
        from app.api.v1.workspace.codebase_index import get_or_build_index, fuzzy_search_files, search_symbols
        # 添加 codebase_search 工具定义
        tools.append({
            "type": "function",
            "function": {
                "name": "codebase_search",
                "description": "搜索代码库中的文件 (模糊匹配文件名和路径)。类似 VS Code Quick Open。",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "搜索关键词"},
                        "limit": {"type": "integer", "description": "最大结果数, 默认 20"},
                    },
                    "required": ["query"],
                },
            },
        })

        async def _tool_codebase_search(args: dict, ws: str):
            from app.api.v1.workspace.tools import ToolCallResult
            idx = get_or_build_index(ws)
            results = fuzzy_search_files(idx, args.get("query", ""), args.get("limit", 20))
            output = "\n".join(f"{r['path']} (score: {r['score']})" for r in results) if results else "(无结果)"
            return ToolCallResult(tool="codebase_search", input=args, output=output, success=True)

        from app.api.v1.workspace.tools import TOOL_DISPATCH
        TOOL_DISPATCH["codebase_search"] = _tool_codebase_search
    except Exception:
        pass

    # 4. 构建 system prompt
    if system_prompt:
        sys_prompt = system_prompt
    else:
        memory = load_project_memory(workspace_path)
        sys_prompt = build_system_prompt(workspace_path, memory)

    # 补充工具使用说明
    sys_prompt += f"""

## 工具使用规则

你是一个 AI Coding Agent, 对标 Claude Code / Codex。你有以下工具可用:
- read_file: 读取文件
- write_file: 写入/创建文件 (支持 dry_run 预览 diff, 自动创建检查点)
- edit_file: 精确编辑文件 (支持模糊匹配恢复 + dry_run 预览 + 自动检查点)
- multi_edit: 批量编辑文件 (多个 search/replace, 原子性, 支持模糊匹配 + dry_run)
- delete_file: 删除文件 (自动创建检查点, 可撤销)
- list_dir: 列目录
- glob: 查找文件
- grep: 搜索内容
- run_command: 执行命令
- web_fetch: 抓取 URL 内容
- web_search: 搜索互联网
- todo_write: 写入任务清单
- todo_read: 读取任务清单
- git_status: 查看 git 状态
- git_diff: 查看 git diff
- git_log: 查看 git 日志
- undo: 撤销最近一次文件修改 (基于检查点快照)
- list_checkpoints: 列出检查点历史
- rollback: 回滚到指定检查点
{'- MCP 工具: ' + ', '.join(mcp_tool_names) if mcp_tool_names else ''}{'- submit_plan: 提交 Plan 模式计划 (仅 Plan 模式可用)' if is_plan_mode else ''}

工作原则:
1. 先理解再动手: 用 read_file/grep/glob 充分了解代码后再修改
2. 小步快跑: 每次只改必要的部分, 改完用 run_command 验证
3. 精确编辑: 优先用 edit_file/multi_edit 而非 write_file (除非创建新文件)
4. 说明你的思路: 在调用工具前简述你要做什么
5. 验证结果: 改完代码后用 run_command 跑测试/构建确认无误
6. 路径安全: 所有路径相对于工作区根目录
7. 任务跟踪: 复杂任务用 todo_write 跟踪进度
8. 安全修改: 修改前可用 dry_run=true 预览 diff; 误操作可用 undo 撤销, 或 list_checkpoints + rollback 回滚到更早状态
9. 模糊匹配: edit_file/multi_edit 支持空白差异容错, 但仍需保证 old_text 唯一
"""

    # Plan 模式特定指导: 探索后必须调用 submit_plan 提交计划
    if is_plan_mode:
        sys_prompt += """

## Plan 模式 (两阶段分离)

你正在 **Plan 模式** 下运行。这是一个两阶段流程:

**阶段 1 (当前): 探索 + 提交计划**
- 只能使用只读工具: read_file, list_dir, glob, grep, git_status, git_diff, git_log, todo_read, web_fetch, codebase_search
- 探索完毕后, **必须** 调用 `submit_plan` 工具提交一个完整的执行计划
- 禁止使用写工具 (write_file/edit_file/multi_edit/run_command/delete_file)
- 禁止直接回答用户 — 必须通过 submit_plan 提交结构化计划

**阶段 2 (用户确认后): 执行**
- 用户在 UI 中看到你提交的计划
- 用户回复 `/plan-accept` 后, 会话自动切换到执行模式 (permission_mode=default)
- 计划会作为新 prompt 重新进入 Agent loop, 届时你可以使用所有工具

**submit_plan 工具要求**:
- title: 一句话概括计划 (20-50 字)
- summary: 3-8 句话说明背景 + 目标 + 关键决策
- steps: 3-15 步执行步骤, 每步含 id/title/description/files/tool_hint
- risks: 潜在风险点 (可空)

**示例**:
```
submit_plan(
    title="重构登录模块: 改用 JWT + 移除 Cookie",
    summary="当前使用 express-session (基于 Cookie), 计划改为 JWT 无状态认证...",
    steps=[
        {"id": "step-1", "title": "添加 jsonwebtoken 依赖", "files": ["package.json"], "tool_hint": "edit_file"},
        {"id": "step-2", "title": "创建 JWT 工具模块", "files": ["src/utils/jwt.ts"], "tool_hint": "write_file"},
        ...
    ],
    risks=["需要前端同步改造 localStorage 存储方式", "需要刷新所有现有 token"]
)
```
"""

    # 5. 注入 Skills 描述 (对标 Claude Code 的渐进式披露 — description 常驻上下文)
    try:
        skills = discover_skills(workspace_path)
        if skills:
            skill_lines = ["\n## 可用 Skills\n"]
            for s in skills:
                skill_lines.append(f"- **{s.name}**: {s.description}")
                if s.allowed_tools:
                    skill_lines.append(f"  (工具: {', '.join(s.allowed_tools)})")
            sys_prompt += "\n".join(skill_lines) + "\n"
    except Exception:
        pass  # Skills 加载失败不阻断

    # 6. 初始化权限检查器
    perm_checker = PermissionChecker(workspace_path, permission_mode)

    # 7. 构建初始消息列表
    messages: list[ChatMessage] = [ChatMessage(role="system", content=sys_prompt)]

    # 加入环境上下文 (对标 Codex 的 environment_context)
    is_win = sys.platform == "win32"
    env_context = f"""<environment_context>
  <cwd>{workspace_path}</cwd>
  <platform>{"windows" if is_win else "unix"}</platform>
  <shell>{"powershell" if is_win else "bash"}</shell>
</environment_context>"""
    messages.append(ChatMessage(role="user", content=env_context))

    # 加入历史消息
    if history:
        messages.extend(history)

    # 加入用户当前输入
    messages.append(ChatMessage(role="user", content=prompt))

    yield {
        "type": "agent.context",
        "workspace": workspace_path,
        "model": model_id,
        "tools": [t["function"]["name"] for t in tools],
    }

    # 8. Agent 循环
    # Token 用量累计追踪 (对标 Codex/Gemini 的用量追踪)
    total_usage: dict[str, Any] = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "iterations": 0,
    }
    for iteration in range(1, max_iterations + 1):
        # 上下文压缩 (对标 Codex 的 context window management)
        if len(messages) > MAX_CONTEXT_MESSAGES:
            # PreCompact Hook
            original_count = len(messages)
            await run_hooks(workspace_path, "PreCompact", {
                "message_count": original_count,
                "trigger": "auto",
                "workspace_path": workspace_path,
            })
            messages = compress_context(messages)
            compacted_count = len(messages)
            yield {"type": "agent.plan.update", "plan": f"上下文已压缩 ({original_count} -> {compacted_count} 条消息)"}
            # PostCompact Hook (Stage B: 补全 Hook 扩展点)
            await run_hooks(workspace_path, "PostCompact", {
                "message_count_before": original_count,
                "message_count_after": compacted_count,
                "trigger": "auto",
                "workspace_path": workspace_path,
            })

        # 调用 LLM (流式)
        accumulated_text = ""
        tool_calls: list[dict[str, Any]] = []
        llm_usage: dict[str, Any] = {}

        async for event in chat_with_tools(messages, cfg, tools, stream=True):
            etype = event.get("type")

            if etype == "text_delta":
                text = event.get("content", "")
                accumulated_text += text
                yield {"type": "agent.text.delta", "content": text}

            elif etype == "tool_call_complete":
                tc_id = event.get("id", str(uuid.uuid4()))
                tc_name = event.get("name", "")
                tc_args = event.get("arguments", {})
                if isinstance(tc_args, str):
                    try:
                        tc_args = json.loads(tc_args)
                    except json.JSONDecodeError:
                        tc_args = {"raw": tc_args}

                tool_calls.append({"id": tc_id, "name": tc_name, "arguments": tc_args})

                # 通知前端工具调用开始
                yield {
                    "type": "agent.tool.call",
                    "id": tc_id,
                    "name": tc_name,
                    "input": tc_args,
                    "iteration": iteration,
                }

            elif etype == "done":
                # 捕获 token 用量 (对标 Codex/Gemini 的用量追踪)
                llm_usage = event.get("usage", {})
                attempts = event.get("attempts", 1)
                if llm_usage:
                    total_usage["prompt_tokens"] += llm_usage.get("prompt_tokens", 0)
                    total_usage["completion_tokens"] += llm_usage.get("completion_tokens", 0)
                    total_usage["total_tokens"] += llm_usage.get("total_tokens", 0)
                    total_usage["iterations"] = iteration
                    # 推送用量事件 (供前端展示 token 消耗)
                    yield {
                        "type": "agent.usage",
                        "iteration": iteration,
                        "usage": llm_usage,
                        "total": dict(total_usage),
                        "attempts": attempts,
                    }
                break

            elif etype == "error":
                yield {"type": "agent.error", "message": event.get("message", "未知错误")}
                return

        # 将 assistant 回复加入消息
        assistant_msg = ChatMessage(role="assistant", content=accumulated_text)
        if tool_calls:
            # OpenAI 格式的 tool_calls
            assistant_msg.tool_calls = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": json.dumps(tc["arguments"], ensure_ascii=False),
                    },
                }
                for tc in tool_calls
            ]
        messages.append(assistant_msg)

        # 如果没有工具调用 → Agent 认为完成
        if not tool_calls:
            # Stop Hook
            await run_hooks(workspace_path, "Stop", {
                "iterations": iteration,
                "workspace_path": workspace_path,
            })
            yield {"type": "agent.done", "iterations": iteration, "finish_reason": "completed",
                   "usage": dict(total_usage)}
            # SessionEnd Hook
            await run_hooks(workspace_path, "SessionEnd", {
                "reason": "completed",
                "workspace_path": workspace_path,
            })
            return

        # 执行所有工具调用 (含权限检查 + Hooks 集成)
        # 并行优化: 如果所有工具都是只读的, 并行执行 (对标 Claude Code/Codex 并发工具调用)
        READ_ONLY_TOOLS = {
            "read_file", "list_dir", "glob", "grep",
            "git_status", "git_diff", "git_log",
            "web_fetch", "web_search", "todo_read",
            "codebase_search", "list_checkpoints",
        }

        all_readonly = all(tc["name"] in READ_ONLY_TOOLS for tc in tool_calls)
        has_submit_plan = any(tc["name"] == "submit_plan" for tc in tool_calls)

        # 并行执行只读工具 (≥2 个时才有意义)
        if all_readonly and len(tool_calls) >= 2 and not has_submit_plan:

            async def _exec_one_tool(tc: dict) -> dict[str, Any]:
                """执行单个只读工具 (权限 + Hook + 执行), 返回结果事件 + messages 追加。"""
                tc_id = tc["id"]
                tc_name = tc["name"]
                tc_args = tc["arguments"]

                # 权限检查
                perm = perm_checker.check(tc_name, tc_args)
                if not perm["allowed"]:
                    return {
                        "event": {"type": "agent.tool.result", "id": tc_id, "name": tc_name,
                                  "output": f"权限拒绝: {perm['reason']}", "error": perm["reason"],
                                  "success": False, "iteration": iteration, "blocked_by_permission": True},
                        "msg": ChatMessage(role="tool", content=f"权限拒绝: {perm['reason']}",
                                           tool_call_id=tc_id, name=tc_name),
                    }

                # PreToolUse Hook
                hook_result = await run_hooks(workspace_path, "PreToolUse", {
                    "tool_name": tc_name, "tool_input": tc_args, "workspace_path": workspace_path,
                })
                if not hook_result["allow"]:
                    blocked = f"工具 {tc_name} 被 Hook 阻断: {hook_result['feedback']}"
                    return {
                        "event": {"type": "agent.tool.result", "id": tc_id, "name": tc_name,
                                  "output": blocked, "error": hook_result["feedback"],
                                  "success": False, "iteration": iteration, "blocked_by_hook": True},
                        "msg": ChatMessage(role="tool", content=blocked, tool_call_id=tc_id, name=tc_name),
                    }

                # 执行工具
                result = await execute_tool(tc_name, tc_args, workspace_path)

                # PostToolUse Hook
                post_hook = await run_hooks(workspace_path, "PostToolUse", {
                    "tool_name": tc_name, "tool_input": tc_args, "tool_output": result.output,
                    "tool_success": result.success, "workspace_path": workspace_path,
                })
                if post_hook["feedback"]:
                    result.output += f"\n\n[Hook 反馈] {post_hook['feedback']}"

                return {
                    "event": {"type": "agent.tool.result", "id": tc_id, "name": tc_name,
                              "output": result.output, "error": result.error,
                              "success": result.success, "iteration": iteration},
                    "msg": ChatMessage(role="tool", content=result.output if result.success else f"错误: {result.error}",
                                       tool_call_id=tc_id, name=tc_name),
                }

            # 并行执行所有只读工具
            results = await asyncio.gather(*[_exec_one_tool(tc) for tc in tool_calls], return_exceptions=True)

            # 顺序 yield 事件 + 追加 messages (保持顺序一致性)
            for i, res in enumerate(results):
                if isinstance(res, Exception):
                    tc = tool_calls[i]
                    yield {"type": "agent.tool.result", "id": tc["id"], "name": tc["name"],
                           "output": f"并行执行异常: {res}", "error": str(res),
                           "success": False, "iteration": iteration}
                    messages.append(ChatMessage(role="tool", content=f"并行执行异常: {res}",
                                                tool_call_id=tc["id"], name=tc["name"]))
                else:
                    yield res["event"]
                    messages.append(res["msg"])

        else:
            # 顺序执行 (含写工具 / submit_plan / 单个工具)
            for tc in tool_calls:
                tc_id = tc["id"]
                tc_name = tc["name"]
                tc_args = tc["arguments"]

                # Plan 模式 + submit_plan: 阶段1探索结束,推送计划等待用户确认
                if is_plan_mode and tc_name == "submit_plan":
                    # 1. 通知前端 submit_plan 工具调用开始
                    yield {
                        "type": "agent.tool.call",
                        "id": tc_id,
                        "name": tc_name,
                        "input": tc_args,
                        "iteration": iteration,
                    }
                    # 2. 推送 agent.plan.proposed 事件 (含完整 plan)
                    plan_data = {
                        "title": tc_args.get("title", ""),
                        "summary": tc_args.get("summary", ""),
                        "steps": tc_args.get("steps", []),
                        "risks": tc_args.get("risks", []),
                    }
                    yield {
                        "type": "agent.plan.proposed",
                        "plan": plan_data,
                        "iteration": iteration,
                        "workspace_path": workspace_path,
                    }
                    # 3. 通知前端 submit_plan 工具调用结果 (占位, 让前端有结果配对)
                    yield {
                        "type": "agent.tool.result",
                        "id": tc_id,
                        "name": tc_name,
                        "output": "计划已提交, 等待用户确认。",
                        "success": True,
                        "iteration": iteration,
                    }
                    # 4. 持久化 plan 到 session, 供 /plan-accept 读取
                    if chat_id:
                        try:
                            from app.api.v1.workspace.session_store import save_plan
                            save_plan(chat_id, plan_data)
                        except Exception as e:
                            logger.warning(f"保存 plan 到 session 失败: {e}")
                    # 5. 阶段1结束 — yield agent.done (finish_reason=plan_proposed)
                    # Stop Hook
                    await run_hooks(workspace_path, "Stop", {
                        "iterations": iteration,
                        "workspace_path": workspace_path,
                        "reason": "plan_proposed",
                    })
                    yield {
                        "type": "agent.done",
                        "iterations": iteration,
                        "finish_reason": "plan_proposed",
                        "message": f"计划已提交 ({len(plan_data['steps'])} 步), 等待用户确认后执行。",
                        "usage": dict(total_usage),
                    }
                    # SessionEnd Hook
                    await run_hooks(workspace_path, "SessionEnd", {
                        "reason": "plan_proposed",
                        "workspace_path": workspace_path,
                    })
                    return

                # 权限检查 (对标 Claude Code 的 Permission System)
                perm = perm_checker.check(tc_name, tc_args)
                if not perm["allowed"]:
                    blocked_msg = f"权限拒绝: {perm['reason']}"
                    yield {
                        "type": "agent.tool.result",
                        "id": tc_id,
                        "name": tc_name,
                        "output": blocked_msg,
                        "error": perm["reason"],
                        "success": False,
                        "iteration": iteration,
                        "blocked_by_permission": True,
                    }
                    messages.append(
                        ChatMessage(
                            role="tool",
                            content=blocked_msg,
                            tool_call_id=tc_id,
                            name=tc_name,
                        )
                    )
                    continue

                # 如果需要确认, 推送确认事件 (前端可展示确认对话框)
                if perm["needs_confirmation"]:
                    yield {
                        "type": "agent.tool.confirm",
                        "id": tc_id,
                        "name": tc_name,
                        "input": tc_args,
                        "reason": perm["reason"],
                        "iteration": iteration,
                    }
                    # 在自动模式下 (bypassPermissions/acceptEdits), 直接执行
                    # 在 default 模式下, 前端需发送确认消息后继续

                # PreToolUse Hook (可阻断工具调用)
                hook_result = await run_hooks(workspace_path, "PreToolUse", {
                    "tool_name": tc_name,
                    "tool_input": tc_args,
                    "workspace_path": workspace_path,
                })
                if not hook_result["allow"]:
                    # Hook 阻断了工具调用, 反馈给 Agent
                    blocked_msg = f"工具 {tc_name} 被 Hook 阻断: {hook_result['feedback']}"
                    yield {
                        "type": "agent.tool.result",
                        "id": tc_id,
                        "name": tc_name,
                        "output": blocked_msg,
                        "error": hook_result["feedback"],
                        "success": False,
                        "iteration": iteration,
                        "blocked_by_hook": True,
                    }
                    messages.append(
                        ChatMessage(
                            role="tool",
                            content=blocked_msg,
                            tool_call_id=tc_id,
                            name=tc_name,
                        )
                    )
                    continue

                # 执行工具
                result = await execute_tool(tc_name, tc_args, workspace_path)

                # PostToolUse Hook (可反馈但不能阻断已执行的操作)
                post_hook = await run_hooks(workspace_path, "PostToolUse", {
                    "tool_name": tc_name,
                    "tool_input": tc_args,
                    "tool_output": result.output,
                    "tool_success": result.success,
                    "workspace_path": workspace_path,
                })
                if post_hook["feedback"]:
                    result.output += f"\n\n[Hook 反馈] {post_hook['feedback']}"

                yield {
                    "type": "agent.tool.result",
                    "id": tc_id,
                    "name": tc_name,
                    "output": result.output,
                    "error": result.error,
                    "success": result.success,
                    "iteration": iteration,
                }

                # todo_write 特殊处理: 额外推送 agent.todo.update 事件, 供前端 TaskListPanel 实时展示
                if tc_name == "todo_write" and result.success:
                    todos = tc_args.get("todos", []) if isinstance(tc_args, dict) else []
                    yield {
                        "type": "agent.todo.update",
                        "todos": todos,
                        "workspace_path": workspace_path,
                    }

                # 将工具结果加入消息
                messages.append(
                    ChatMessage(
                        role="tool",
                        content=result.output if result.success else f"错误: {result.error}",
                        tool_call_id=tc_id,
                        name=tc_name,
                    )
                )

    # 达到最大迭代次数
    # Stop Hook
    await run_hooks(workspace_path, "Stop", {
        "iterations": max_iterations,
        "workspace_path": workspace_path,
    })
    yield {
        "type": "agent.done",
        "iterations": max_iterations,
        "finish_reason": "max_iterations",
        "message": f"已达到最大迭代次数 {max_iterations}",
        "usage": dict(total_usage),
    }
    # SessionEnd Hook
    await run_hooks(workspace_path, "SessionEnd", {
        "reason": "max_iterations",
        "workspace_path": workspace_path,
    })


# ---------------------------------------------------------------------------
# 上下文管理 (对标 Codex 的 context window management)
# ---------------------------------------------------------------------------

MAX_CONTEXT_MESSAGES = 50  # 超过此数量时压缩


def compress_context(messages: list[ChatMessage]) -> list[ChatMessage]:
    """智能压缩上下文 — 保留 system + 最近若干轮, 中间生成结构化摘要。

    对标 Codex 的 context window management + Claude Code 的 auto-compact:
    - 保留 system 消息 + 环境上下文
    - 保留最近 12 条消息 (确保 tool 消息配对完整)
    - 中间消息生成结构化摘要 (保留工具名/文件路径/关键结论)
    - 确保 tail 不以 tool 消息开头 (tool 消息必须跟在带 tool_calls 的 assistant 后)
    - 摘要按角色分组, 保留更多关键信息 (非简单截断 100 字符)
    """
    if len(messages) <= MAX_CONTEXT_MESSAGES:
        return messages

    # 保留 system + 前 2 条 (env context)
    head = messages[:3]

    # 从末尾向前找 12 条, 但确保不以 tool 消息开头
    tail_size = 12
    tail_start = max(3, len(messages) - tail_size)
    # 如果 tail 第一条是 tool 角色, 向前扩展直到找到对应的 assistant (含 tool_calls)
    while tail_start > 3 and messages[tail_start].role == "tool":
        tail_start -= 1
    tail = messages[tail_start:]

    # 中间消息生成结构化摘要 (保留关键信息: 工具名/文件路径/结论)
    middle = messages[3:tail_start]
    summary_parts = []

    # 按工作进展分组摘要, 保留更多上下文
    for m in middle:
        content = m.content or ""
        if m.role == "tool":
            # 工具结果: 保留工具名 + 前 200 字符 (含文件路径等关键信息)
            preview = content[:200].replace("\n", " ")
            summary_parts.append(f"[工具 {m.name} 结果] {preview}")
        elif m.role == "assistant":
            # 助手消息: 如果有 tool_calls, 记录调用了哪些工具
            if m.tool_calls:
                tool_names = [tc.get("name", "?") for tc in m.tool_calls]
                text_preview = content[:150].replace("\n", " ") if content else ""
                summary_parts.append(f"[助手 调用工具: {', '.join(tool_names)}] {text_preview}")
            else:
                preview = content[:200].replace("\n", " ")
                summary_parts.append(f"[助手回复] {preview}")
        elif m.role == "user":
            preview = content[:150].replace("\n", " ")
            summary_parts.append(f"[用户] {preview}")

    # 限制摘要总长度 (避免摘要本身过长)
    summary_text = "\n".join(summary_parts)
    max_summary_chars = 4000
    if len(summary_text) > max_summary_chars:
        summary_text = summary_text[:max_summary_chars] + "\n... (摘要已截断)"

    summary = f"<context_summary>\n以下为早期对话的压缩摘要 (共 {len(middle)} 条消息):\n{summary_text}\n</context_summary>"

    return head + [ChatMessage(role="system", content=summary)] + tail

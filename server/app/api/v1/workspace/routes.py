"""
Workspace API 路由 — 完整的 AI Coding 能力 HTTP + WebSocket 端点。

端点清单:
  # 文件系统 (FS Bridge)
  POST /workspace/browse          浏览目录
  POST /workspace/open             打开/记录工作区
  GET  /workspace/recent           最近工作区列表
  GET  /workspace/meta             工作区元数据 (技术栈/git)
  GET  /workspace/tree             目录树 (懒加载)
  POST /workspace/read              读取文件
  POST /workspace/write             写入文件
  POST /workspace/edit              精确编辑
  POST /workspace/delete             删除文件
  POST /workspace/grep               内容搜索
  POST /workspace/glob               文件名匹配
  POST /workspace/run                执行命令

  # Agent Runtime
  WS   /workspace/agent/ws          Agent 对话 (流式工具循环)

  # Skills / Hooks / Memory
  GET  /workspace/skills             列出 Skills
  POST /workspace/skills/create      创建 Skill
  GET  /workspace/skills/{name}/body 加载 Skill 正文
  GET  /workspace/hooks              列出 Hooks
  GET  /workspace/memory             加载项目记忆

  # MCP
  GET  /workspace/mcp/servers        列出 MCP 服务器配置
  POST /workspace/mcp/connect        连接 MCP 服务器
  GET  /workspace/mcp/tools          列出所有 MCP 工具
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

from app.schemas.common import success, error
from app.ws.auth_decorator import ws_require_auth
from app.api.v1.workspace.slash_commands import (
    parse_slash_command,
    COMMAND_HANDLERS,
    get_command_list,
)
from app.api.v1.workspace.schemas import (
    BrowseRequest,
    OpenWorkspaceRequest,
    ReadFileRequest,
    WriteFileRequest,
    EditFileRequest,
    DeleteFileRequest,
    GrepRequest,
    GlobRequest,
    RunCommandRequest,
    AgentChatRequest,
    SkillMeta,
    StartBackgroundAgentRequest,
    CreateRoutineRequest,
    UpdateRoutineRequest,
)
from app.api.v1.workspace.session_store import (
    load_recent_workspaces,
    add_recent_workspace,
    create_session,
    load_session,
    list_sessions,
    get_most_recent_session,
    append_message,
    get_history,
    delete_session,
)

router = APIRouter(prefix="/workspace", tags=["Workspace"])


# ---------------------------------------------------------------------------
# 文件系统 (FS Bridge)
# ---------------------------------------------------------------------------

@router.post("/browse")
async def browse_directory(req: BrowseRequest):
    """浏览目录 — 返回子目录列表。"""
    target = req.path
    if not target:
        # 返回系统根/盘符列表
        if os.name == "nt":
            import string
            drives = []
            for letter in string.ascii_uppercase:
                drive = f"{letter}:\\"
                if os.path.exists(drive):
                    drives.append({"name": f"{letter}:", "path": drive, "is_dir": True})
            return success(data=drives)
        else:
            target = "/"

    p = Path(target)
    if not p.exists():
        return error(msg=f"路径不存在: {target}")
    if not p.is_dir():
        return error(msg=f"不是目录: {target}")

    entries = []
    try:
        for item in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            # 跳过隐藏文件和常见忽略目录
            if item.name.startswith(".") or item.name in ("node_modules", "__pycache__", "$RECYCLE.BIN", "System Volume Information"):
                continue
            try:
                stat = item.stat()
                entries.append({
                    "name": item.name,
                    "path": str(item),
                    "is_dir": item.is_dir(),
                    "size": stat.st_size if not item.is_dir() else 0,
                    "modified": stat.st_mtime,
                })
            except (PermissionError, OSError):
                continue
    except PermissionError:
        return error(msg=f"无权限访问: {target}")

    return success(data=entries)


@router.post("/open")
async def open_workspace(req: OpenWorkspaceRequest):
    """打开工作区 — 记录到最近列表, 返回元数据。"""
    p = Path(req.path)
    if not p.exists():
        return error(msg=f"路径不存在: {req.path}")
    if not p.is_dir():
        return error(msg=f"不是目录: {req.path}")

    name = req.name or p.name

    # 检测技术栈
    tech_stack = _detect_tech_stack(p)

    # 检测 git
    git_branch = _get_git_branch(p)
    git_status = _get_git_status(p)

    # 统计文件数
    file_count = 0
    for _ in p.rglob("*"):
        if _.is_file() and "node_modules" not in str(_) and ".git" not in str(_):
            file_count += 1
            if file_count > 10000:
                break

    meta = {
        "path": str(p),
        "name": name,
        "tech_stack": tech_stack,
        "git_branch": git_branch,
        "git_status": git_status,
        "file_count": file_count,
        "last_opened": time.time(),
    }

    # 更新最近列表 (持久化到文件系统)
    add_recent_workspace(meta)

    return success(data=meta)


@router.get("/recent")
async def list_recent_workspaces():
    """返回最近打开的工作区列表。"""
    return success(data=load_recent_workspaces())


@router.get("/meta")
async def get_workspace_meta(path: str):
    """获取工作区元数据。"""
    p = Path(path)
    if not p.exists():
        return error(msg=f"路径不存在: {path}")

    tech_stack = _detect_tech_stack(p)
    git_branch = _get_git_branch(p)

    return success(data={
        "path": str(p),
        "name": p.name,
        "tech_stack": tech_stack,
        "git_branch": git_branch,
    })


@router.get("/tree")
async def get_directory_tree(path: str, depth: int = 2):
    """获取目录树 (懒加载, 默认 2 层)。"""
    p = Path(path)
    if not p.exists() or not p.is_dir():
        return error(msg=f"目录不存在: {path}")

    def _build_tree(node: Path, current_depth: int) -> dict[str, Any]:
        node_info = {
            "name": node.name,
            "path": str(node),
            "is_dir": node.is_dir(),
            "children": [],
        }
        if current_depth <= 0 or not node.is_dir():
            return node_info
        try:
            for child in sorted(node.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                if child.name.startswith(".") or child.name in ("node_modules", "__pycache__", "dist", "build"):
                    continue
                node_info["children"].append(_build_tree(child, current_depth - 1))
        except (PermissionError, OSError):
            pass
        return node_info

    tree = _build_tree(p, depth)
    return success(data=tree)


# ---------------------------------------------------------------------------
# 文件操作 (直接调用 tools.py, 工作区路径作为 workspace 沙箱)
# ---------------------------------------------------------------------------

@router.post("/read")
async def read_file(req: ReadFileRequest):
    """读取文件内容。"""
    from app.api.v1.workspace.tools import tool_read_file

    result = await tool_read_file(
        {"path": req.path, "start_line": req.start_line, "end_line": req.end_line},
        req.workspace_path,
    )
    return success(data={"content": result.output, "success": result.success, "error": result.error})


@router.post("/write")
async def write_file(req: WriteFileRequest):
    """写入/创建文件。"""
    from app.api.v1.workspace.tools import tool_write_file

    result = await tool_write_file({"path": req.path, "content": req.content}, req.workspace_path)
    return success(data={"output": result.output, "success": result.success, "error": result.error})


@router.post("/edit")
async def edit_file(req: EditFileRequest):
    """精确编辑文件 (search/replace)。"""
    from app.api.v1.workspace.tools import tool_edit_file

    result = await tool_edit_file(
        {"path": req.path, "old_text": req.old_text, "new_text": req.new_text},
        req.workspace_path,
    )
    return success(data={"output": result.output, "success": result.success, "error": result.error})


@router.post("/delete")
async def delete_file(req: DeleteFileRequest):
    """删除文件/目录。"""
    from app.api.v1.workspace.tools import tool_delete_file

    result = await tool_delete_file({"path": req.path, "recursive": req.recursive}, req.workspace_path)
    return success(data={"output": result.output, "success": result.success, "error": result.error})


@router.post("/grep")
async def grep_files(req: GrepRequest):
    """内容搜索 (正则)。"""
    from app.api.v1.workspace.tools import tool_grep

    result = await tool_grep(
        {"pattern": req.pattern, "path": req.path, "glob": req.glob, "output_mode": req.output_mode},
        req.workspace_path,
    )
    return success(data={"output": result.output, "success": result.success, "error": result.error})


@router.post("/glob")
async def glob_files(req: GlobRequest):
    """文件名匹配。"""
    from app.api.v1.workspace.tools import tool_glob

    result = await tool_glob({"pattern": req.pattern, "path": req.path}, req.workspace_path)
    return success(data={"output": result.output, "success": result.success, "error": result.error})


@router.post("/run")
async def run_command(req: RunCommandRequest):
    """执行 shell 命令。"""
    from app.api.v1.workspace.tools import tool_run_command

    # 沙箱: 优先用 workspace_path, cwd 可选覆盖但必须在 workspace 内
    result = await tool_run_command(
        {"command": req.command, "cwd": req.cwd or req.workspace_path, "timeout_ms": req.timeout_ms},
        req.workspace_path,
    )
    return success(data={"output": result.output, "success": result.success, "error": result.error})


# ---------------------------------------------------------------------------
# Agent Runtime (WebSocket)
# ---------------------------------------------------------------------------

@router.websocket("/agent/ws")
@ws_require_auth
async def agent_websocket(websocket: WebSocket, user_uuid: str = ""):
    """Agent 对话 WebSocket — 流式推送工具循环事件。

    客户端发送:
        JSON: AgentChatRequest 字段

    服务端推送事件:
        {"type": "agent.context", ...}    — 上下文加载
        {"type": "agent.text.delta", ...} — 回复文本片段
        {"type": "agent.tool.call", ...}  — 工具调用开始
        {"type": "agent.tool.result", ...} — 工具结果
        {"type": "agent.error", ...}     — 错误
        {"type": "agent.done", ...}       — 完成

    鉴权: 通过 query ?token=<jwt> 完成. 缺失/无效 token 立即 close(1008).
    user_uuid 来自 JWT 注入, 忽略客户端 payload 中的 user_uuid 防伪.
    """
    await websocket.accept()

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "agent.error", "message": "无效 JSON"}))
                continue

            prompt = data.get("prompt", "")
            model_id = data.get("model_id", "default")
            workspace_path = data.get("workspace_path", "")
            user_uuid = data.get("user_uuid", "anonymous")
            chat_id = data.get("chat_id")
            system_prompt = data.get("system_prompt")
            persona_id = data.get("persona_id")
            max_iterations = data.get("max_iterations", 25)
            allowed_tools = data.get("allowed_tools")
            permission_mode = data.get("permission_mode", "default")
            raw_history = data.get("history")

            if not prompt or not workspace_path:
                await websocket.send_text(json.dumps({
                    "type": "agent.error",
                    "message": "缺少 prompt 或 workspace_path",
                }))
                continue

            # 转换历史消息为 ChatMessage 列表
            history = None
            if raw_history:
                from app.api.v1.workspace.llm_gateway import ChatMessage
                history = [
                    ChatMessage(
                        role=h.get("role", "user"),
                        content=h.get("content", ""),
                        tool_calls=h.get("tool_calls"),
                        tool_call_id=h.get("tool_call_id"),
                        name=h.get("name"),
                    )
                    for h in raw_history
                ]

            # Slash 命令拦截 (对标 Claude Code / Trae 的 /command 面板)
            slash_cmd = parse_slash_command(prompt)
            if slash_cmd and slash_cmd[0] in COMMAND_HANDLERS:
                cmd_name, cmd_args = slash_cmd
                handler = COMMAND_HANDLERS[cmd_name]
                result = await handler(
                    websocket,
                    workspace_path=workspace_path,
                    chat_id=chat_id,
                    args=cmd_args,
                    user_uuid=user_uuid,
                    model_id=model_id,
                )
                await websocket.send_text(json.dumps(result, ensure_ascii=False, default=str))

                if result.get("type") != "agent.command.handled":
                    # 纯命令已处理, 跳过 agent loop
                    continue

                # 状态修改: 应用 modify 字段
                modify = result.get("modify", {})
                if "permission_mode" in modify:
                    permission_mode = modify["permission_mode"]
                if "max_iterations" in modify:
                    max_iterations = modify["max_iterations"]

                # /compact 强制上下文压缩
                if modify.get("compact_first") and history:
                    from app.api.v1.workspace.agent_loop import compress_context
                    history = compress_context(history)
                    await websocket.send_text(json.dumps({
                        "type": "agent.context",
                        "compacted": True,
                        "message_count": len(history),
                    }, ensure_ascii=False))

                # 优先使用 handler 返回的 execution_prompt (Stage B: /plan-accept)
                execution_prompt = result.get("execution_prompt")
                if execution_prompt:
                    prompt = execution_prompt
                elif cmd_args:
                    prompt = cmd_args
                else:
                    # 没有 args, 跳过 agent loop
                    continue

            from app.api.v1.workspace.agent_loop import run_agent_loop

            # 创建/恢复会话 (持久化)
            if not chat_id:
                session = create_session(workspace_path, model_id, user_uuid, prompt)
                chat_id = session["id"]

            # 记录用户消息
            append_message(chat_id, "user", prompt)

            # 累积助手回复用于持久化
            accumulated_assistant = ""

            # 运行 Agent 循环, 流式推送事件
            async for event in run_agent_loop(
                prompt=prompt,
                model_id=model_id,
                workspace_path=workspace_path,
                user_uuid=user_uuid,
                chat_id=chat_id,
                system_prompt=system_prompt,
                max_iterations=max_iterations,
                allowed_tools=allowed_tools,
                history=history,
                permission_mode=permission_mode,
            ):
                await websocket.send_text(json.dumps(event, ensure_ascii=False, default=str))
                # 累积助手文本
                if event.get("type") == "agent.text.delta":
                    accumulated_assistant += event.get("content", "")
                elif event.get("type") == "agent.tool.call":
                    append_message(chat_id, "assistant", "", tool_call=event)
                elif event.get("type") == "agent.tool.result":
                    append_message(chat_id, "tool", event.get("output", ""), tool_result=event)
                elif event.get("type") == "agent.done":
                    if accumulated_assistant:
                        append_message(chat_id, "assistant", accumulated_assistant)
                    accumulated_assistant = ""
                    # 持久化 token 用量 (对标 Codex /cost /usage)
                    done_usage = event.get("usage")
                    if done_usage and chat_id:
                        from app.api.v1.workspace.session_store import update_session_usage
                        update_session_usage(chat_id, done_usage)

    except WebSocketDisconnect:
        logger.info("Agent WebSocket 已断开")
    except Exception as e:
        logger.exception(f"Agent WebSocket 错误: {e}")
        try:
            await websocket.send_text(json.dumps({"type": "agent.error", "message": str(e)}))
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Skills / Hooks / Memory
# ---------------------------------------------------------------------------

@router.get("/skills")
async def list_skills(workspace_path: str):
    """列出工作区中的所有 Skill。"""
    from app.api.v1.workspace.skills import discover_skills

    skills = discover_skills(workspace_path)
    return success(data=[
        {
            "name": s.name,
            "description": s.description,
            "disable_model_invocation": s.disable_model_invocation,
            "allowed_tools": s.allowed_tools,
            "context": s.context,
            "model": s.model,
        }
        for s in skills
    ])


@router.post("/skills/create")
async def create_skill_endpoint(workspace_path: str, name: str, description: str, body: str = ""):
    """创建新 Skill。"""
    from app.api.v1.workspace.skills import create_skill

    ok = create_skill(workspace_path, name, description, body)
    return success(data={"created": ok})


@router.get("/skills/{name}/body")
async def get_skill_body_endpoint(workspace_path: str, name: str):
    """加载 Skill 正文 (按需)。"""
    from app.api.v1.workspace.skills import discover_skills, get_skill_body

    skills = discover_skills(workspace_path)
    for s in skills:
        if s.name == name:
            body = get_skill_body(s)
            return success(data={"body": body})
    return error(msg=f"Skill {name} 未找到")


@router.get("/hooks")
async def list_hooks(workspace_path: str):
    """列出工作区 Hooks 配置。"""
    from app.api.v1.workspace.skills import load_hooks

    hooks = load_hooks(workspace_path)
    return success(data=hooks)


@router.get("/memory")
async def get_memory(workspace_path: str):
    """加载项目记忆 (AGENTS.md / CLAUDE.md)。"""
    from app.api.v1.workspace.memory import load_project_memory

    memory = load_project_memory(workspace_path)
    return success(data=memory)


@router.get("/memory/system-prompt")
async def get_system_prompt(workspace_path: str):
    """构建并返回系统提示词。"""
    from app.api.v1.workspace.memory import load_project_memory, build_system_prompt

    memory = load_project_memory(workspace_path)
    prompt = build_system_prompt(workspace_path, memory)
    return success(data={"system_prompt": prompt, "files_loaded": memory.get("files", [])})


@router.get("/commands")
async def list_slash_commands():
    """列出所有内置 Slash 命令 — 供前端 SlashCommandPalette 实时加载.

    与 WebSocket 内的 COMMAND_HANDLERS 共享同一数据源, 避免双写漂移.
    """
    return success(data={"commands": get_command_list()})


# ---------------------------------------------------------------------------
# MCP
# ---------------------------------------------------------------------------

@router.get("/mcp/servers")
async def list_mcp_servers(workspace_path: str):
    """列出工作区配置的 MCP 服务器。"""
    from app.api.v1.workspace.mcp_bridge import load_mcp_config

    servers = load_mcp_config(workspace_path)
    return success(data=[
        {
            "name": s.name,
            "command": s.command,
            "args": s.args,
            "transport": s.transport,
            "url": s.url,
        }
        for s in servers
    ])


@router.post("/mcp/connect")
async def connect_mcp_server(workspace_path: str, server_name: str):
    """连接指定的 MCP 服务器。"""
    from app.api.v1.workspace.mcp_bridge import load_mcp_config, get_mcp_manager

    servers = load_mcp_config(workspace_path)
    target = next((s for s in servers if s.name == server_name), None)
    if not target:
        return error(msg=f"MCP 服务器 {server_name} 未配置")

    manager = get_mcp_manager()
    ok = await manager.add_server(target)
    return success(data={"connected": ok})


@router.get("/mcp/tools")
async def list_mcp_tools(workspace_path: str):
    """列出所有已连接 MCP 服务器的工具。"""
    from app.api.v1.workspace.mcp_bridge import get_mcp_manager

    manager = get_mcp_manager()
    tools = await manager.list_all_tools()
    return success(data=[
        {
            "name": t.name,
            "description": t.description,
            "input_schema": t.input_schema,
            "server_name": t.server_name,
        }
        for t in tools
    ])


# ---------------------------------------------------------------------------
# Codebase 索引 — 增量更新 + RAG 检索 (对标 Cursor Codebase Indexing)
# ---------------------------------------------------------------------------

@router.get("/codebase/status")
async def codebase_status(workspace_path: str):
    """查看 codebase 索引状态 (符号索引 + 语义索引)。"""
    from app.api.v1.workspace.codebase_incremental import get_status

    s = get_status(workspace_path)
    return success(data={
        "workspace": s.workspace,
        "symbol_index": {
            "exists": s.symbol_index_age >= 0,
            "age_seconds": round(max(s.symbol_index_age, 0), 2),
            "files": s.symbol_files,
        },
        "semantic_index": {
            "exists": s.semantic_index_age >= 0,
            "age_seconds": round(max(s.semantic_index_age, 0), 2),
            "chunks": s.semantic_chunks,
            "backend": s.semantic_backend,
        },
        "last_incremental_at": s.last_incremental_at,
        "last_incremental_changes": s.last_incremental_changes,
    })


@router.post("/codebase/incremental-update")
async def codebase_incremental_update(workspace_path: str):
    """触发增量更新 (git status 或 mtime 优先)。"""
    from app.api.v1.workspace.codebase_incremental import incremental_update

    result = incremental_update(workspace_path)
    return success(data=result)


@router.get("/codebase/search")
async def codebase_search(
    workspace_path: str,
    q: str,
    mode: str = "fuzzy",
    limit: int = 20,
):
    """统一检索 (fuzzy / symbols / semantic)。"""
    from app.api.v1.workspace.codebase_incremental import search_codebase

    if not q or not q.strip():
        return error(msg="参数 q 不能为空")
    if mode not in ("fuzzy", "symbols", "semantic"):
        return error(msg=f"mode 必须为 fuzzy/symbols/semantic, 收到: {mode}")
    results = search_codebase(workspace_path, q.strip(), mode=mode, limit=limit)
    return success(data={"mode": mode, "query": q, "results": results})


# ---------------------------------------------------------------------------
# Persona Registry — 151 expert 角色 (对标 Claude Code Sub-agents / Codex GPTs)
# ---------------------------------------------------------------------------

@router.get("/personas")
async def list_personas(category: str | None = None, include_disabled: bool = False):
    """列出所有 persona (可按 category 过滤)。"""
    from app.api.v1.workspace.persona_registry import get_persona_registry

    reg = get_persona_registry()
    items = reg.list_by_category(category, include_disabled=include_disabled) if category else reg.list_all(include_disabled=include_disabled)
    return success(data={
        "total": len(items),
        "categories": reg.list_categories(),
        "personas": [p.to_dict() for p in items],
    })


@router.get("/personas/categories")
async def list_persona_categories():
    """列出所有 persona 分类及计数。"""
    from app.api.v1.workspace.persona_registry import get_persona_registry

    reg = get_persona_registry()
    return success(data=reg.list_categories())


@router.get("/personas/search")
async def search_personas(q: str, limit: int = 30):
    """模糊检索 persona (name / description / tags / examples)。"""
    from app.api.v1.workspace.persona_registry import get_persona_registry

    reg = get_persona_registry()
    hits = reg.search(q, limit=limit)
    return success(data={"query": q, "total": len(hits), "personas": [p.to_dict() for p in hits]})


@router.get("/personas/{persona_id}")
async def get_persona(persona_id: str):
    """获取单个 persona 详情。"""
    from app.api.v1.workspace.persona_registry import get_persona_registry

    p = get_persona_registry().get(persona_id)
    if not p:
        return error(msg=f"Persona {persona_id} 不存在")
    return success(data=p.to_dict())


@router.post("/personas")
async def create_persona(payload: dict):
    """新建自定义 persona。"""
    from app.api.v1.workspace.persona_registry import Persona, get_persona_registry

    required = {"id", "name", "category", "description", "system_prompt"}
    missing = required - set(payload.keys())
    if missing:
        return error(msg=f"缺少必填字段: {missing}")
    p = Persona(
        id=payload["id"],
        name=payload["name"],
        category=payload["category"],
        description=payload["description"],
        system_prompt=payload["system_prompt"],
        tools=payload.get("tools", []),
        examples=payload.get("examples", []),
        tags=payload.get("tags", []),
        enabled=payload.get("enabled", True),
    )
    try:
        get_persona_registry().add(p)
    except ValueError as e:
        return error(msg=str(e))
    return success(data=p.to_dict())


@router.patch("/personas/{persona_id}")
async def update_persona(persona_id: str, payload: dict):
    """更新 persona 字段。"""
    from app.api.v1.workspace.persona_registry import get_persona_registry

    p = get_persona_registry().update(persona_id, **payload)
    if not p:
        return error(msg=f"Persona {persona_id} 不存在")
    return success(data=p.to_dict())


@router.delete("/personas/{persona_id}")
async def delete_persona(persona_id: str):
    """删除自定义 persona (内置不可删除)。"""
    from app.api.v1.workspace.persona_registry import get_persona_registry

    try:
        ok = get_persona_registry().delete(persona_id)
    except ValueError as e:
        return error(msg=str(e))
    if not ok:
        return error(msg=f"Persona {persona_id} 不存在")
    return success(data={"deleted": persona_id})


# ---------------------------------------------------------------------------
# Checkpoint 快照与回滚 (对标 Aider git revert / Gemini checkpointing)
# ---------------------------------------------------------------------------

@router.get("/checkpoints")
async def list_checkpoints(workspace_path: str, limit: int = 20):
    """列出工作区的检查点历史。"""
    from app.api.v1.workspace.checkpoint import list_checkpoints as _list

    return success(data=_list(workspace_path, limit))


@router.post("/checkpoints/undo")
async def undo_last_checkpoint(workspace_path: str):
    """撤销最近一次文件修改 (基于检查点快照恢复)。"""
    from app.api.v1.workspace.checkpoint import undo_last

    result = undo_last(workspace_path)
    if result["success"]:
        return success(data=result, message=result["message"])
    return error(message=result["message"])


@router.post("/checkpoints/rollback")
async def rollback_to_checkpoint(workspace_path: str, checkpoint_id: str):
    """回滚到指定检查点 (撤销该检查点及之后所有修改)。"""
    from app.api.v1.workspace.checkpoint import rollback_to

    result = rollback_to(workspace_path, checkpoint_id)
    if result["success"]:
        return success(data=result, message=result["message"])
    return error(message=result["message"])


@router.get("/checkpoints/{checkpoint_id}")
async def get_checkpoint_detail(workspace_path: str, checkpoint_id: str):
    """获取指定检查点的详情。"""
    from app.api.v1.workspace.checkpoint import get_checkpoint_detail as _detail

    detail = _detail(workspace_path, checkpoint_id)
    if detail:
        return success(data=detail)
    return error(message=f"检查点不存在: {checkpoint_id}")


@router.delete("/checkpoints")
async def clear_all_checkpoints(workspace_path: str):
    """清空工作区的所有检查点。"""
    from app.api.v1.workspace.checkpoint import clear_checkpoints

    count = clear_checkpoints(workspace_path)
    return success(data={"cleared": count}, message=f"已清空 {count} 个检查点")


# ---------------------------------------------------------------------------
# Subagents (子代理 — 对标 Claude Code Subagents)
# ---------------------------------------------------------------------------

@router.get("/agents")
async def list_subagents(workspace_path: str):
    """列出工作区中的所有子代理。"""
    from app.api.v1.workspace.subagents import discover_subagents

    agents = discover_subagents(workspace_path)
    return success(data=[
        {
            "name": a.name,
            "description": a.description,
            "tools": a.tools,
            "model": a.model,
            "file_path": a.file_path,
        }
        for a in agents
    ])


# ---------------------------------------------------------------------------
# Sessions (会话持久化 — 对标 Claude Code --resume/--continue)
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_sessions_endpoint(workspace_path: str | None = None, limit: int = 50):
    """列出 Agent 会话。"""
    sessions = list_sessions(workspace_path, limit)
    return success(data=sessions)


@router.get("/sessions/{session_id}")
async def get_session_endpoint(session_id: str):
    """获取指定会话详情 (含完整消息历史)。"""
    session = load_session(session_id)
    if not session:
        return error(msg=f"会话 {session_id} 未找到")
    return success(data=session)


@router.delete("/sessions/{session_id}")
async def delete_session_endpoint(session_id: str):
    """删除会话。"""
    ok = delete_session(session_id)
    return success(data={"deleted": ok})


@router.get("/sessions/recent")
async def get_recent_session_endpoint(workspace_path: str | None = None):
    """获取最近的会话。"""
    session = get_most_recent_session(workspace_path)
    return success(data=session)


# ---------------------------------------------------------------------------
# Codebase Index (代码库索引 — 对标 Cursor Codebase Indexing)
# ---------------------------------------------------------------------------

@router.post("/index/build")
async def build_codebase_index(workspace_path: str):
    """构建/重建代码库索引。"""
    from app.api.v1.workspace.codebase_index import build_index

    index = build_index(workspace_path)
    return success(data={
        "total_files": index.total_files,
        "total_lines": index.total_lines,
        "indexed_at": index.indexed_at,
    })


@router.get("/index/search")
async def search_codebase(workspace_path: str, query: str, limit: int = 20):
    """模糊搜索文件 (类似 VS Code Quick Open)。"""
    from app.api.v1.workspace.codebase_index import get_or_build_index, fuzzy_search_files

    index = get_or_build_index(workspace_path)
    results = fuzzy_search_files(index, query, limit)
    return success(data=results)


@router.get("/index/symbols")
async def search_symbols(workspace_path: str, query: str, limit: int = 30):
    """搜索符号 (函数/类/变量定义)。"""
    from app.api.v1.workspace.codebase_index import get_or_build_index, search_symbols

    index = get_or_build_index(workspace_path)
    results = search_symbols(index, query, limit)
    return success(data=results)


# ---------------------------------------------------------------------------
# Background Agents (多会话并行 — 对标 Claude Code Background Agents / Codex 多会话)
# ---------------------------------------------------------------------------

@router.post("/background-agents")
async def start_background_agent(req: StartBackgroundAgentRequest):
    """启动一个后台 Agent — 在后台运行 agent loop, 不阻塞调用方。

    返回 agent_id, 后续可通过 GET /background-agents/{agent_id} 查询状态。
    """
    from app.api.v1.workspace.background_agents import get_background_agent_manager

    if not req.prompt or not req.workspace_path:
        return error(msg="缺少 prompt 或 workspace_path")

    manager = get_background_agent_manager()
    agent_id = manager.start_background_agent(
        prompt=req.prompt,
        workspace_path=req.workspace_path,
        model_id=req.model_id,
        user_uuid=req.user_uuid,
        max_iterations=req.max_iterations,
        system_prompt=req.system_prompt,
        permission_mode=req.permission_mode,
    )
    return success(data={"agent_id": agent_id, "status": "running"})


@router.get("/background-agents")
async def list_background_agents(workspace_path: str | None = None):
    """列出所有后台 Agent (可按工作区过滤)。"""
    from app.api.v1.workspace.background_agents import get_background_agent_manager

    manager = get_background_agent_manager()
    agents = manager.list_background_agents(workspace_path)
    return success(data=agents, total=len(agents))


@router.get("/background-agents/{agent_id}")
async def get_background_agent_status(agent_id: str):
    """获取指定后台 Agent 的状态 + 进度摘要。"""
    from app.api.v1.workspace.background_agents import get_background_agent_manager

    manager = get_background_agent_manager()
    status = manager.get_agent_status(agent_id)
    if not status:
        return error(msg=f"后台 agent {agent_id} 不存在")
    return success(data=status)


@router.delete("/background-agents/{agent_id}")
async def cancel_background_agent(agent_id: str):
    """取消运行中的后台 Agent。"""
    from app.api.v1.workspace.background_agents import get_background_agent_manager

    manager = get_background_agent_manager()
    ok = manager.cancel_background_agent(agent_id)
    if not ok:
        return error(msg=f"无法取消: agent {agent_id} 不存在或已结束")
    return success(data={"agent_id": agent_id, "status": "cancelled"})


@router.get("/background-agents/{agent_id}/result")
async def get_background_agent_result(agent_id: str):
    """获取已完成后台 Agent 的结果。"""
    from app.api.v1.workspace.background_agents import get_background_agent_manager

    manager = get_background_agent_manager()
    result = manager.get_agent_result(agent_id)
    if not result:
        return error(msg=f"后台 agent {agent_id} 不存在")
    return success(data=result)


@router.get("/background-agents/{agent_id}/events")
async def get_background_agent_events(agent_id: str, from_line: int = 0, limit: int = 500):
    """获取后台 Agent 的事件流 (JSONL, 支持增量读取)。"""
    from app.api.v1.workspace.background_agents import get_background_agent_manager

    manager = get_background_agent_manager()
    events = manager.get_agent_events(agent_id, from_line=from_line, limit=limit)
    return success(data=events)


@router.delete("/background-agents/{agent_id}/purge")
async def purge_background_agent(agent_id: str):
    """彻底删除后台 Agent 记录 (含磁盘文件)。"""
    from app.api.v1.workspace.background_agents import get_background_agent_manager

    manager = get_background_agent_manager()
    ok = manager.delete_background_agent(agent_id)
    return success(data={"deleted": ok})


# ---------------------------------------------------------------------------
# Routines — 定时任务 (对标 Claude Code Routines)
# ---------------------------------------------------------------------------

@router.post("/routines")
async def create_routine(req: CreateRoutineRequest):
    """创建定时任务 — 指定 cron 表达式和 prompt, 调度器到期自动执行。"""
    from app.api.v1.workspace.routines import get_routine_manager, parse_cron

    if not req.name or not req.prompt or not req.cron_expression or not req.workspace_path:
        return error(msg="缺少 name / prompt / cron_expression / workspace_path")

    # 校验 cron 表达式
    try:
        parse_cron(req.cron_expression)
    except ValueError as e:
        return error(msg=f"cron 表达式非法: {e}")

    manager = get_routine_manager()
    cfg = manager.add_routine(
        name=req.name,
        prompt=req.prompt,
        cron_expression=req.cron_expression,
        workspace_path=req.workspace_path,
        model_id=req.model_id,
        enabled=req.enabled,
    )
    return success(data=cfg.to_dict())


@router.get("/routines")
async def list_routines(workspace_path: str | None = None):
    """列出所有定时任务 (可按工作区过滤)。"""
    from app.api.v1.workspace.routines import get_routine_manager

    manager = get_routine_manager()
    routines = manager.list_routines(workspace_path)
    return success(data=[r.to_dict() for r in routines], total=len(routines))


@router.get("/routines/{routine_id}")
async def get_routine(routine_id: str):
    """获取定时任务详情。"""
    from app.api.v1.workspace.routines import get_routine_manager

    manager = get_routine_manager()
    cfg = manager.get_routine(routine_id)
    if cfg is None:
        return error(msg=f"定时任务 {routine_id} 不存在")
    return success(data=cfg.to_dict())


@router.put("/routines/{routine_id}")
async def update_routine(routine_id: str, req: UpdateRoutineRequest):
    """更新定时任务配置 (所有字段可选)。"""
    from app.api.v1.workspace.routines import get_routine_manager, parse_cron

    # 校验 cron (如果提供了)
    if req.cron_expression is not None:
        try:
            parse_cron(req.cron_expression)
        except ValueError as e:
            return error(msg=f"cron 表达式非法: {e}")

    manager = get_routine_manager()
    cfg = manager.update_routine(
        routine_id,
        name=req.name,
        prompt=req.prompt,
        cron_expression=req.cron_expression,
        model_id=req.model_id,
        enabled=req.enabled,
    )
    if cfg is None:
        return error(msg=f"定时任务 {routine_id} 不存在")
    return success(data=cfg.to_dict())


@router.delete("/routines/{routine_id}")
async def delete_routine(routine_id: str):
    """删除定时任务。"""
    from app.api.v1.workspace.routines import get_routine_manager

    manager = get_routine_manager()
    ok = manager.remove_routine(routine_id)
    if not ok:
        return error(msg=f"定时任务 {routine_id} 不存在")
    return success(data={"deleted": True, "routine_id": routine_id})


@router.post("/routines/{routine_id}/trigger")
async def trigger_routine(routine_id: str):
    """手动触发定时任务 (立即执行一次, 不影响调度周期)。

    通过 BackgroundAgentManager 启动后台 agent 执行 prompt。
    """
    from app.api.v1.workspace.routines import get_routine_manager

    manager = get_routine_manager()
    result = manager.trigger_routine(routine_id)
    if result is None:
        return error(msg=f"定时任务 {routine_id} 不存在")
    if "error" in result:
        return error(msg=result["error"])
    return success(data=result)


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

def _detect_tech_stack(path: Path) -> list[str]:
    """检测项目技术栈。"""
    stack: list[str] = []

    # 前端
    if (path / "package.json").exists():
        stack.append("Node.js")
        try:
            pkg = json.loads((path / "package.json").read_text(encoding="utf-8"))
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            if "vue" in deps:
                stack.append("Vue")
            if "react" in deps:
                stack.append("React")
            if "@angular/core" in deps:
                stack.append("Angular")
            if "vite" in deps:
                stack.append("Vite")
            if "next" in deps:
                stack.append("Next.js")
            if "element-plus" in deps:
                stack.append("Element Plus")
            if "tailwindcss" in deps or "@tailwindcss" in str(deps):
                stack.append("Tailwind CSS")
        except Exception:
            pass

    # Python
    if (path / "requirements.txt").exists() or (path / "pyproject.toml").exists() or (path / "setup.py").exists():
        stack.append("Python")
        req_file = path / "requirements.txt"
        req_text = req_file.read_text(encoding="utf-8", errors="replace").lower() if req_file.exists() else ""
        if "fastapi" in req_text or (path / "fastapi").exists():
            stack.append("FastAPI")
        if (path / "django").exists() or (path / "manage.py").exists():
            stack.append("Django")
        if "flask" in req_text or (path / "flask").exists():
            stack.append("Flask")

    # Java
    if (path / "pom.xml").exists():
        stack.append("Java/Maven")
    if (path / "build.gradle").exists() or (path / "build.gradle.kts").exists():
        stack.append("Java/Gradle")

    # Go
    if (path / "go.mod").exists():
        stack.append("Go")

    # Rust
    if (path / "Cargo.toml").exists():
        stack.append("Rust")

    # Docker
    if (path / "Dockerfile").exists() or (path / "docker-compose.yml").exists():
        stack.append("Docker")

    # Git
    if (path / ".git").exists():
        stack.append("Git")

    return stack


def _get_git_branch(path: Path) -> str | None:
    """获取当前 git 分支。"""
    git_dir = path / ".git"
    if not git_dir.exists():
        return None
    try:
        head_file = git_dir / "HEAD"
        if head_file.exists():
            content = head_file.read_text(encoding="utf-8").strip()
            if content.startswith("ref: refs/heads/"):
                return content.replace("ref: refs/heads/", "")
        return None
    except Exception:
        return None


def _get_git_status(path: Path) -> str | None:
    """获取 git 状态摘要。"""
    git_dir = path / ".git"
    if not git_dir.exists():
        return None
    try:
        import subprocess
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=str(path),
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n") if result.stdout.strip() else []
            modified = len([l for l in lines if l.startswith(" M")])
            staged = len([l for l in lines if l.startswith("M ")])
            untracked = len([l for l in lines if l.startswith("??")])
            return f"{modified} modified, {staged} staged, {untracked} untracked"
        return None
    except Exception:
        return None

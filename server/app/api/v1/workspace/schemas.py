"""
Pydantic schemas for the Workspace module.
工作区模块的请求/响应模型定义。
"""

from pydantic import BaseModel, Field
from enum import Enum
from typing import Any


# ---------------------------------------------------------------------------
# 文件系统 (FS Bridge)
# ---------------------------------------------------------------------------

class BrowseRequest(BaseModel):
    """浏览目录请求。path 为空时返回系统根目录列表。"""
    path: str | None = Field(None, description="要浏览的目录绝对路径，空表示列出系统根")


class OpenWorkspaceRequest(BaseModel):
    """打开工作区请求 — 记录项目到最近列表。"""
    path: str = Field(..., description="工作区根目录的绝对路径")
    name: str | None = Field(None, description="项目显示名，默认取目录名")


class ReadFileRequest(BaseModel):
    """读取文件请求。"""
    path: str = Field(..., description="文件路径 (相对工作区或绝对)")
    workspace_path: str = Field(..., description="工作区根目录绝对路径 (沙箱边界)")
    start_line: int | None = Field(None, ge=1, description="起始行号 (1-based)")
    end_line: int | None = Field(None, ge=1, description="结束行号 (1-based, 含)")


class WriteFileRequest(BaseModel):
    """写入/创建文件请求。"""
    path: str = Field(..., description="文件路径 (相对工作区或绝对)")
    workspace_path: str = Field(..., description="工作区根目录绝对路径 (沙箱边界)")
    content: str = Field("", description="文件内容")
    create_dirs: bool = Field(True, description="父目录不存在时是否自动创建")


class EditFileRequest(BaseModel):
    """精确编辑请求 (search/replace)。"""
    path: str = Field(..., description="文件路径 (相对工作区或绝对)")
    workspace_path: str = Field(..., description="工作区根目录绝对路径 (沙箱边界)")
    old_text: str = Field(..., description="要查找的文本块 (必须唯一)")
    new_text: str = Field(..., description="替换为的文本块")


class DeleteFileRequest(BaseModel):
    """删除文件请求。"""
    path: str = Field(..., description="文件路径 (相对工作区或绝对)")
    workspace_path: str = Field(..., description="工作区根目录绝对路径 (沙箱边界)")
    recursive: bool = Field(False, description="目录时是否递归删除")


class GrepRequest(BaseModel):
    """内容搜索请求。"""
    path: str = Field(..., description="搜索根目录 (相对工作区或绝对)")
    workspace_path: str = Field(..., description="工作区根目录绝对路径 (沙箱边界)")
    pattern: str = Field(..., description="正则表达式")
    glob: str | None = Field(None, description="文件名 glob 过滤, 如 *.ts")
    output_mode: str = Field("content", description="content|files_with_matches|count")


class GlobRequest(BaseModel):
    """文件名匹配请求。"""
    path: str = Field(..., description="搜索根目录 (相对工作区或绝对)")
    workspace_path: str = Field(..., description="工作区根目录绝对路径 (沙箱边界)")
    pattern: str = Field(..., description="glob 模式, 如 **/*.vue")


class RunCommandRequest(BaseModel):
    """执行 shell 命令请求。"""
    command: str = Field(..., description="要执行的命令")
    workspace_path: str = Field(..., description="工作区根目录绝对路径 (沙箱边界)")
    cwd: str | None = Field(None, description="工作目录 (默认为 workspace_path)")
    timeout_ms: int = Field(60000, ge=1000, le=600000, description="超时 (ms)")


# ---------------------------------------------------------------------------
# Agent Runtime
# ---------------------------------------------------------------------------

class AgentChatRequest(BaseModel):
    """Agent 对话请求 — 触发工具循环。"""
    prompt: str = Field(..., description="用户输入")
    model_id: str = Field("default", description="模型 code (zhs_ai_model_info_unify.code)")
    workspace_path: str = Field(..., description="工作区绝对路径")
    user_uuid: str = Field("anonymous", description="用户 UUID")
    chat_id: str | None = Field(None, description="会话 ID, 用于多轮上下文")
    system_prompt: str | None = Field(None, description="自定义系统提示词")
    max_iterations: int = Field(25, ge=1, le=100, description="最大工具循环次数")
    allowed_tools: list[str] | None = Field(None, description="允许使用的工具列表, None=全部")
    permission_mode: str = Field("default", description="权限模式: default/acceptEdits/plan/bypassPermissions")
    history: list[dict[str, Any]] | None = Field(None, description="历史消息 (多轮对话)")


class AgentEventType(str, Enum):
    """Agent 事件类型 — 通过 WebSocket 流式推送。"""
    THINKING = "agent.thinking"           # LLM 思考/推理文本
    TEXT_DELTA = "agent.text.delta"       # 回复文本片段
    TOOL_CALL = "agent.tool.call"         # 工具调用开始
    TOOL_CONFIRM = "agent.tool.confirm"   # 需要用户确认的工具调用
    TOOL_RESULT = "agent.tool.result"     # 工具调用结果
    PLAN_UPDATE = "agent.plan.update"      # 任务计划更新
    PLAN_PROPOSED = "agent.plan.proposed" # Plan 模式阶段1结束: 提交完整计划等待用户确认 (Stage B)
    TODO_UPDATE = "agent.todo.update"     # 任务清单更新 (TaskList 面板订阅)
    USAGE = "agent.usage"                 # Token 用量追踪 (对标 Codex/Gemini)
    COMMAND_RESULT = "agent.command.result"   # Slash 命令纯结果
    COMMAND_HANDLED = "agent.command.handled" # Slash 命令状态修改确认
    ERROR = "agent.error"                 # 错误
    DONE = "agent.done"                   # 一轮完成
    CONTEXT = "agent.context"             # 上下文信息 (加载的文件/记忆等)


# ---------------------------------------------------------------------------
# Skills / Hooks / Memory
# ---------------------------------------------------------------------------

class SkillMeta(BaseModel):
    """Skill 元数据 — 对标 Claude Code SKILL.md frontmatter。"""
    name: str
    description: str
    disable_model_invocation: bool = False
    allowed_tools: list[str] | None = None
    context: str = "main"  # main | fork
    model: str | None = None
    body_path: str | None = None  # SKILL.md 正文路径


class HookConfig(BaseModel):
    """Hook 配置 — 对标 Claude Code Hooks。"""
    event: str  # PreToolUse|PostToolUse|SessionStart|SessionEnd|UserPromptSubmit|Stop
    matcher: str | None = None  # 工具名匹配, 仅 PreToolUse/PostToolUse
    hook_type: str = "command"  # command|http|mcp_tool|prompt
    command: str | None = None
    url: str | None = None


class MemoryEntry(BaseModel):
    """记忆条目。"""
    key: str
    value: str
    scope: str = "project"  # user|project|session
    file_path: str | None = None


# ---------------------------------------------------------------------------
# MCP
# ---------------------------------------------------------------------------

class MCPServerConfig(BaseModel):
    """MCP 服务器配置。"""
    name: str
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    url: str | None = None  # SSE/HTTP 模式
    transport: str = "stdio"  # stdio|sse|http


class MCPTool(BaseModel):
    """MCP 工具定义。"""
    name: str
    description: str
    input_schema: dict[str, Any] = Field(default_factory=dict)
    server_name: str = ""


# ---------------------------------------------------------------------------
# 响应模型
# ---------------------------------------------------------------------------

class DirEntry(BaseModel):
    """目录条目。"""
    name: str
    path: str
    is_dir: bool
    size: int = 0
    modified: float = 0.0


class FileContent(BaseModel):
    """文件内容。"""
    path: str
    content: str
    lines: int
    truncated: bool = False


class WorkspaceMeta(BaseModel):
    """工作区元数据。"""
    path: str
    name: str
    tech_stack: list[str] = Field(default_factory=list)
    git_branch: str | None = None
    git_status: str | None = None
    file_count: int = 0
    last_opened: float = 0.0


class RecentWorkspace(BaseModel):
    """最近工作区条目。"""
    path: str
    name: str
    last_opened: float
    tech_stack: list[str] = Field(default_factory=list)


class ToolCallResult(BaseModel):
    """工具调用结果。"""
    tool: str
    input: dict[str, Any]
    output: str
    error: str | None = None
    success: bool = True

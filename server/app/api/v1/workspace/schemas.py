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
    persona_id: str | None = Field(None, description="Persona 角色 ID (对标 Claude Code Sub-agents / Codex GPTs)")
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

class MCPOAuthConfig(BaseModel):
    """MCP OAuth 配置 (授权码流程, 对标 Codex OAuth)。

    简化版: 支持配置静态 access_token / refresh_token 直接使用,
    同时预留完整授权码流程接口 (build_auth_url / exchange_code / refresh)。
    所有字符串字段支持 ${VAR} 环境变量展开。
    """
    client_id: str = ""
    client_secret: str = ""
    auth_url: str = ""  # 授权端点 (用户浏览器跳转)
    token_url: str = ""  # token 交换/刷新端点
    scopes: list[str] = Field(default_factory=list)
    redirect_uri: str = "http://localhost:8765/callback"
    # 已缓存/静态 token (配置时可直接填入, 跳过交互式授权)
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "Bearer"
    expires_in: int | None = None  # 秒


class MCPAuthConfig(BaseModel):
    """MCP 认证配置 (对标 Claude Code 的认证支持)。

    - none: 无认证
    - bearer: 静态 Bearer Token (从 config 或环境变量读取)
    - oauth: OAuth 2.0 授权码流程 (Codex 风格)
    """
    type: str = "none"  # none|bearer|oauth
    token: str | None = None  # bearer 静态 token (支持 ${VAR})
    oauth: MCPOAuthConfig | None = None


class MCPServerConfig(BaseModel):
    """MCP 服务器配置。

    向后兼容: command/args/env 用于 stdio; url+transport 用于 http/sse。
    api_key/headers/auth 为 P1 缺口补齐新增字段, 全部可选。
    """
    name: str
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    url: str | None = None  # SSE/HTTP 模式端点
    transport: str = "stdio"  # stdio|http|sse
    # P1 缺口补齐: 认证 + 自定义 headers (全部可选, 向后兼容)
    api_key: str | None = None  # 兼容字段: 等价于 auth.type=bearer + auth.token; 支持 ${VAR}
    headers: dict[str, str] = Field(default_factory=dict)  # 自定义请求头
    auth: MCPAuthConfig | None = None  # 结构化认证配置


class MCPTool(BaseModel):
    """MCP 工具定义。"""
    name: str
    description: str
    input_schema: dict[str, Any] = Field(default_factory=dict)
    server_name: str = ""


class MCPServerStatus(BaseModel):
    """MCP 连接器运行状态 (供前端连接器面板可视化)。"""
    name: str
    transport: str = "stdio"  # stdio|http|sse
    online: bool = False  # 在线/离线
    tool_count: int = 0  # 已发现工具数
    url: str | None = None
    error: str | None = None


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
    # Computer Use: 截图等工具可携带 base64 编码的图片 (PNG), 供 LLM vision 接收。
    # 每个元素为不含 data URI 前缀的纯 base64 字符串。
    images: list[str] | None = None


# ---------------------------------------------------------------------------
# Background Agents (多会话并行 — 对标 Claude Code Background Agents / Codex 多会话)
# ---------------------------------------------------------------------------

class StartBackgroundAgentRequest(BaseModel):
    """启动后台 Agent 请求。"""
    prompt: str = Field(..., description="任务描述")
    workspace_path: str = Field(..., description="工作区绝对路径")
    model_id: str = Field("default", description="模型 code")
    user_uuid: str = Field("anonymous", description="用户 UUID")
    max_iterations: int = Field(25, ge=1, le=100, description="最大工具循环次数")
    system_prompt: str | None = Field(None, description="自定义系统提示词 (可选)")
    permission_mode: str = Field("bypassPermissions", description="权限模式 (后台默认 bypassPermissions)")


# ---------------------------------------------------------------------------
# Routines — 定时任务 (对标 Claude Code Routines)
# ---------------------------------------------------------------------------

class CreateRoutineRequest(BaseModel):
    """创建定时任务请求。"""
    name: str = Field(..., description="用户可读名称")
    prompt: str = Field(..., description="定时执行的 agent prompt")
    cron_expression: str = Field(..., description="5 字段 cron 表达式 (分 时 日 月 周)")
    workspace_path: str = Field(..., description="工作区绝对路径")
    model_id: str = Field("default", description="模型 code")
    enabled: bool = Field(True, description="是否启用")


class UpdateRoutineRequest(BaseModel):
    """更新定时任务请求 (所有字段可选)。"""
    name: str | None = Field(None, description="用户可读名称")
    prompt: str | None = Field(None, description="定时执行的 agent prompt")
    cron_expression: str | None = Field(None, description="5 字段 cron 表达式 (分 时 日 月 周)")
    model_id: str | None = Field(None, description="模型 code")
    enabled: bool | None = Field(None, description="是否启用")

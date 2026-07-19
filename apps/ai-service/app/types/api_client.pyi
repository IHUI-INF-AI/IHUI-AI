"""ai-service 端 API 契约类型存根(mypy stub)。

跨端 API 契约类型的 Python 翻译版本(基于 TypeScript ``@ihui/types/api-contracts``)。

本文件是 **mypy 类型存根** — 仅含类型注解(``TypedDict`` / ``Protocol`` / ``Literal``),
无运行时数据/副作用。mypy 在 strict 模式下校验此模块。

同步规则:
- TS 源:``g:\\IHUI-AI\\packages\\types\\src\\api-contracts.ts``
- 修改时:先改 TS,再同步本文件 + ``api_client.py``(类型一对一对应)。
- 任何字段新增/重命名/类型变更需同步更新。

设计:
- 命名与 TS 版本保持 snake_case(避免与 Python 习惯冲突)。
- 复杂嵌套结构用 ``TypedDict(total=False)`` 表达"所有字段可选",与 TS ``?:`` 语义一致。
- 联合类型用 ``Union[...]`` 或 ``Literal[...]`` 表达。
"""

from __future__ import annotations

from typing import Any, Literal, Protocol, TypedDict, Union

# ============================================================================
# 用户与认证
# ============================================================================


class User(TypedDict, total=False):
    id: str
    phone: str
    email: str
    nickname: str
    avatar: str
    familyId: str
    roleId: int
    status: int
    createdAt: str
    updatedAt: str


class UserProfile(User, total=False):
    bio: str
    gender: int
    birthday: str


class AuthToken(TypedDict):
    accessToken: str
    refreshToken: str
    expiresIn: int
    tokenType: str


# ============================================================================
# 通用 API 响应包装
# ============================================================================


class ApiResponse(TypedDict, total=False):
    code: int
    message: str
    data: Any
    errorCode: str


class PaginatedResponse(TypedDict):
    list: list[Any]
    total: int
    page: int
    pageSize: int


class _ApiResultSuccess(Protocol):
    success: Literal[True]
    data: Any


class _ApiResultFailure(Protocol):
    success: Literal[False]
    error: str
    status: int | None
    errorCode: str | None
    retryAfter: int | None


ApiResult = Union[_ApiResultSuccess, _ApiResultFailure]


# ============================================================================
# AI 聊天
# ============================================================================


ChatRole = Literal["system", "user", "assistant", "tool"]


class ChatMessage(TypedDict, total=False):
    role: ChatRole
    content: str


class ChatRequest(TypedDict, total=False):
    model: str
    messages: list[ChatMessage]
    stream: bool
    temperature: float
    maxTokens: int


AgentTaskStatus = Literal["pending", "running", "completed", "failed"]


class AgentTask(TypedDict, total=False):
    id: str
    goal: str
    status: AgentTaskStatus
    result: str


# ============================================================================
# 通知 / WebSocket
# ============================================================================


class _NotificationData(TypedDict, total=False):
    type: str


class WSNotification(TypedDict):
    type: Literal["notification"]
    data: _NotificationData


class _AIResponseMessage(TypedDict, total=False):
    id: str
    role: str
    content: str
    createdAt: str


class AIResponseNotification(TypedDict, total=False):
    type: Literal["ai_response"]
    conversationId: str
    clientMessageId: str
    message: _AIResponseMessage


class NotificationItem(TypedDict, total=False):
    id: str
    type: str
    title: str
    content: str
    isRead: bool
    createdAt: str
    link: str
    extra: dict[str, Any]


class MessageItem(TypedDict, total=False):
    id: str
    fromUserId: str
    fromNickname: str
    fromAvatar: str | None
    content: str
    isRead: bool
    createdAt: str


class UnreadCount(TypedDict, total=False):
    message: int
    notification: int
    customerService: int
    total: int


CustomerServiceSessionStatus = Literal["pending", "active", "closed"]


class CustomerServiceSession(TypedDict, total=False):
    id: str
    userId: str
    userNickname: str
    userAvatar: str
    agentId: str
    agentName: str
    status: CustomerServiceSessionStatus
    lastMessage: str
    lastMessageAt: str
    createdAt: str


CustomerServiceFromType = Literal["user", "agent", "bot"]
CustomerServiceMessageType = Literal["text", "image", "file", "system"]


class CustomerServiceMessage(TypedDict, total=False):
    id: str
    sessionId: str
    fromId: str
    fromType: CustomerServiceFromType
    content: str
    type: CustomerServiceMessageType
    isRead: bool
    createdAt: str


# ============================================================================
# 通知渠道
# ============================================================================


NotificationChannel = Literal[
    "sms",
    "email",
    "notification",
    "push",
    "dingtalk",
    "feishu",
    "wechat",
]


class ChannelConfig(TypedDict, total=False):
    channel: NotificationChannel
    webhookUrl: str
    accessToken: str
    secret: str
    appId: str
    appSecret: str


class DingtalkMessage(TypedDict, total=False):
    msgtype: Literal["text", "markdown", "actionCard"]
    text: dict[str, str]
    markdown: dict[str, str]


class FeishuMessage(TypedDict):
    msg_type: Literal["text", "post", "interactive"]
    content: dict[str, Any]


class WechatWorkMessage(TypedDict, total=False):
    msgtype: Literal["text", "markdown", "news"]
    text: dict[str, str]
    markdown: dict[str, str]


# ============================================================================
# 消息自愈(CLI / API / ai-service 共用)
# ============================================================================


class RepairableMessage(TypedDict):
    role: str
    content: str


class RepairResult(TypedDict, total=False):
    repaired: list[RepairableMessage]
    removed: int
    reasons: list[str]


def repairMessages(messages: list[RepairableMessage]) -> RepairResult:
    """修复 messages 数组结构异常(stub 签名,实现见 cli 端 TS/JS 版同源逻辑)。"""
    ...


# ============================================================================
# 智能体运行时
# ============================================================================


PermissionMode = Literal[
    "default",
    "acceptEdits",
    "bypassPermissions",
    "plan",
    "manual",
]


PermissionDecision = Literal["allow", "deny", "ask"]

DangerLevel = Literal["read", "write", "dangerous"]


class PermissionRules(TypedDict, total=False):
    allow: list[str]
    deny: list[str]
    ask: list[str]
    mode: PermissionMode


class PermissionCheckResult(TypedDict, total=False):
    allowed: bool
    reason: str


PlanState = Literal["initialized", "gathering", "executing", "done", "cancelled"]
PlanEvent = Literal["start", "gather_complete", "execute_complete", "cancel", "reset"]


class PlanContext(TypedDict, total=False):
    currentState: PlanState
    messages: list[Any]
    planSteps: list[str]
    currentStepIndex: int


HookEvent = Literal[
    "preToolCall",
    "postToolCall",
    "userPromptSubmit",
    "preCompact",
    "postCompact",
    "notification",
    "stop",
    "stopFailure",
    "postToolUseFailure",
    "permissionDenied",
    "subagentStart",
    "subagentStop",
    "sessionStart",
    "sessionEnd",
]


class HookContext(TypedDict, total=False):
    workspacePath: str
    sessionId: str
    toolName: str
    toolArgs: Any
    toolResult: Any
    prompt: str
    error: str
    reason: str
    subagentId: str
    subagentType: str
    compactedTokensBefore: int
    compactedTokensAfter: int
    notificationText: str


HookMethod = Literal["POST", "PUT", "GET"]


class HookEntry(TypedDict, total=False):
    name: str
    command: str
    webhook: str
    method: HookMethod
    headers: dict[str, str]
    body: str
    matchTool: str
    blockOnError: bool
    timeout: int


class HooksConfig(TypedDict, total=False):
    preToolCall: list[HookEntry]
    postToolCall: list[HookEntry]
    sessionStart: list[HookEntry]
    sessionEnd: list[HookEntry]
    userPromptSubmit: list[HookEntry]
    preCompact: list[HookEntry]
    postCompact: list[HookEntry]
    notification: list[HookEntry]
    stop: list[HookEntry]
    stopFailure: list[HookEntry]
    postToolUseFailure: list[HookEntry]
    permissionDenied: list[HookEntry]
    subagentStart: list[HookEntry]
    subagentStop: list[HookEntry]


class HookResult(TypedDict, total=False):
    proceed: bool
    reason: str


JSONSchemaType = Literal[
    "object",
    "string",
    "number",
    "integer",
    "boolean",
    "array",
    "null",
]


class JSONSchema(TypedDict, total=False):
    type: Union[JSONSchemaType, list[JSONSchemaType]]
    description: str
    properties: dict[str, JSONSchema]
    required: list[str]
    items: JSONSchema
    enum: list[Union[str, int, bool, None]]
    additionalProperties: Union[bool, JSONSchema]


class PersonaContract(TypedDict):
    input_schema: JSONSchema
    output_schema: JSONSchema


PersonaContracts = dict[str, PersonaContract]

SessionStatus = Literal["running", "completed", "failed", "cancelled"]


class SessionMessage(TypedDict, total=False):
    role: Literal["user", "assistant", "system", "tool"]
    content: str
    timestamp: str
    toolCallId: str
    toolName: str


class SessionState(TypedDict):
    id: str
    sessionId: str
    createdAt: str
    updatedAt: str
    messages: list[SessionMessage]
    status: SessionStatus
    model: str
    toolState: dict[str, Any]
    cwd: str
    error: str


class SessionSummary(TypedDict):
    id: str
    createdAt: str
    updatedAt: str
    status: SessionStatus


SubagentPersona = Literal["researcher", "coder", "reviewer", "planner", "general"]
CapabilityMode = Literal["read-only", "read-write", "execute", "all"]
IsolationMode = Literal["none", "worktree"]


class SkillFrontmatter(TypedDict, total=False):
    name: str
    description: str
    allowedTools: list[str]
    tools: list[str]
    model: str
    tags: list[str]


class SkillDefinition(TypedDict):
    filePath: str
    sourceDir: str
    frontmatter: SkillFrontmatter
    content: str
    hasFrontmatter: bool


# ============================================================================
# 工作区(adjacent tagging wire 协议)
# ============================================================================

SessionId = str
ToolCallId = str
HunkId = str
RewindPoint = str

PromptMode = Literal["default", "plan", "accept-edits", "bypass-permissions"]


class Attachment(TypedDict, total=False):
    kind: Literal["file", "image", "text"]
    path: str
    content: str
    mimeType: str


class BeginPromptData(TypedDict, total=False):
    sessionId: SessionId
    prompt: str
    attachments: list[Attachment]
    mode: PromptMode


class EndPromptData(TypedDict):
    sessionId: SessionId


class CancelPromptData(TypedDict, total=False):
    sessionId: SessionId
    reason: str


class CreateSessionData(TypedDict, total=False):
    workspaceRoot: str
    initialPrompt: str
    modelId: str
    mode: PromptMode


class LoadSessionData(TypedDict):
    sessionId: SessionId


class UsageStats(TypedDict, total=False):
    inputTokens: int
    outputTokens: int
    cacheReadTokens: int
    cacheWriteTokens: int

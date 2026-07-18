// Workspace wire 类型,adjacent tagging({ type: '...', data: { ... } })
// 参考 ACP 协议设计,与多端共享

// ============ 基础 ID 类型 ============
export type SessionId = string
export type ToolCallId = string
export type HunkId = string
export type RewindPoint = string

// ============ Adjacent Tagging 辅助 ============
export interface TaggedRequest<T extends string, D> {
  type: T
  data: D
}

// ============ 5 个核心 Wire 类型 ============

// 1. WorkspaceRequest - workspace 级别请求
export type WorkspaceRequest =
  | TaggedRequest<'begin_prompt', BeginPromptData>
  | TaggedRequest<'end_prompt', EndPromptData>
  | TaggedRequest<'cancel_prompt', CancelPromptData>
  | TaggedRequest<'create_session', CreateSessionData>
  | TaggedRequest<'load_session', LoadSessionData>

export interface BeginPromptData {
  sessionId: SessionId
  prompt: string
  attachments?: Attachment[]
  mode?: PromptMode
}

export interface EndPromptData {
  sessionId: SessionId
}

export interface CancelPromptData {
  sessionId: SessionId
  reason?: string
}

export interface CreateSessionData {
  workspaceRoot: string
  initialPrompt?: string
  modelId?: string
  mode?: PromptMode
}

export interface LoadSessionData {
  sessionId: SessionId
}

export type PromptMode = 'default' | 'plan' | 'accept-edits' | 'bypass-permissions'

export interface Attachment {
  kind: 'file' | 'image' | 'text'
  path?: string
  content?: string
  mimeType?: string
}

// 2. ToolChunk - 工具调用流式 chunk
export type ToolChunk =
  | TaggedRequest<'tool_call_start', ToolCallStartData>
  | TaggedRequest<'tool_call_delta', ToolCallDeltaData>
  | TaggedRequest<'tool_call_end', ToolCallEndData>
  | TaggedRequest<'tool_call_error', ToolCallErrorData>

export interface ToolCallStartData {
  toolCallId: ToolCallId
  toolName: string
  args: Record<string, unknown>
}

export interface ToolCallDeltaData {
  toolCallId: ToolCallId
  delta: string
}

export interface ToolCallEndData {
  toolCallId: ToolCallId
  output: string
  success: boolean
}

export interface ToolCallErrorData {
  toolCallId: ToolCallId
  error: string
  code?: string
}

// 3. WorkspaceEvent - workspace 级别事件(server → client)
export type WorkspaceEvent =
  | TaggedRequest<'session_created', SessionCreatedData>
  | TaggedRequest<'session_loaded', SessionLoadedData>
  | TaggedRequest<'prompt_started', PromptStartedData>
  | TaggedRequest<'prompt_completed', PromptCompletedData>
  | TaggedRequest<'prompt_cancelled', PromptCancelledData>
  | TaggedRequest<'tool_call', ToolChunk>
  | TaggedRequest<'error', ErrorData>

export interface SessionCreatedData {
  sessionId: SessionId
  workspaceRoot: string
  createdAt: number
}

export interface SessionLoadedData {
  sessionId: SessionId
  messages: ConversationItem[]
}

export interface PromptStartedData {
  sessionId: SessionId
  promptId: string
  prompt: string
  startedAt: number
}

export interface PromptCompletedData {
  sessionId: SessionId
  promptId: string
  completedAt: number
  usage?: UsageStats
}

export interface PromptCancelledData {
  sessionId: SessionId
  promptId: string
  reason: string
  cancelledAt: number
}

export interface ErrorData {
  code: string
  message: string
  fatal?: boolean
}

// 4. ConversationItem - 对话项(统一多端消息格式)
export type ConversationItem =
  | TaggedRequest<'user', UserMessage>
  | TaggedRequest<'assistant', AssistantMessage>
  | TaggedRequest<'tool_call', ToolCallMessage>
  | TaggedRequest<'tool_result', ToolResultMessage>
  | TaggedRequest<'system', SystemMessage>

export interface UserMessage {
  content: string
  attachments?: Attachment[]
  timestamp: number
}

export interface AssistantMessage {
  content: string
  modelId: string
  timestamp: number
  usage?: UsageStats
}

export interface ToolCallMessage {
  toolCallId: ToolCallId
  toolName: string
  args: Record<string, unknown>
  timestamp: number
}

export interface ToolResultMessage {
  toolCallId: ToolCallId
  output: string
  success: boolean
  timestamp: number
}

export interface SystemMessage {
  content: string
  timestamp: number
}

// 5. PermissionRequest / PermissionDecision - 权限请求
export type PermissionRequest = TaggedRequest<'permission_request', PermissionRequestData>

export interface PermissionRequestData {
  toolCallId: ToolCallId
  toolName: string
  args: Record<string, unknown>
  reason: string
  mode: PermissionMode
}

export type PermissionDecision =
  TaggedRequest<'allow', PermissionAllowData> | TaggedRequest<'deny', PermissionDenyData>

export interface PermissionAllowData {
  toolCallId: ToolCallId
  always?: boolean
}

export interface PermissionDenyData {
  toolCallId: ToolCallId
  reason: string
}

export type PermissionMode = 'default' | 'plan' | 'accept-edits' | 'bypass-permissions'

// ============ 通用辅助类型 ============
export interface UsageStats {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

// ============ 类型守卫 ============
export function isWorkspaceRequest(x: unknown): x is WorkspaceRequest {
  return typeof x === 'object' && x !== null && 'type' in x && 'data' in x
}

export function isToolChunk(x: unknown): x is ToolChunk {
  return (
    typeof x === 'object' &&
    x !== null &&
    'type' in x &&
    'data' in x &&
    typeof (x as any).type === 'string' &&
    (x as any).type.startsWith('tool_call_')
  )
}

export function isWorkspaceEvent(x: unknown): x is WorkspaceEvent {
  return typeof x === 'object' && x !== null && 'type' in x && 'data' in x
}
